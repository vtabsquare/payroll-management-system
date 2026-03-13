const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso } = require("../utils/helpers");
const { calculateSalary, roundCurrency } = require("../services/salaryEngine");
const { sendEmail, buildPayslipEmail } = require("../services/emailService");
const { generatePayslipPDF } = require("../services/pdfService");
const { authenticate, authorize } = require("../middleware/auth");
const { maskSalaries } = require("../middleware/maskSalaries");

const router = express.Router();
router.use(authenticate, maskSalaries);

function ledgerSortValue(row) {
  return Number(row.year) * 12 + Number(row.month);
}

function normalizeLedgerRow(row) {
  const entryType = String(row.entry_type || "deduction").toLowerCase();
  const amount = roundCurrency(Number(row.amount || 0));
  const runningBalance = roundCurrency(Number(row.running_balance || 0));
  const status = String(row.status || (runningBalance <= 0 ? "paid" : "not_paid"));
  return {
    ...row,
    entry_type: entryType,
    amount,
    running_balance: runningBalance,
    status,
    reference: String(row.reference || ""),
    transaction_date: String(row.transaction_date || ""),
  };
}

function buildLedgerSnapshot(ledgerRows, employeeId) {
  return ledgerRows
    .filter((entry) => String(entry.employee_id) === String(employeeId))
    .map(normalizeLedgerRow)
    .sort((a, b) => {
      const diff = ledgerSortValue(a) - ledgerSortValue(b);
      if (diff !== 0) return diff;
      return Number(a.ledger_id) - Number(b.ledger_id);
    });
}

function getEmployeeLedgerBalance(ledgerRows, employeeId) {
  const rows = buildLedgerSnapshot(ledgerRows, employeeId);
  if (rows.length === 0) return 0;
  return roundCurrency(Number(rows[rows.length - 1].running_balance || 0));
}

async function recalculateLedgerTotals() {
  const ledgerRows = await db.getAll(SHEETS.INCENTIVE_LEDGER);

  const byEmployee = new Map();
  for (const entry of ledgerRows) {
    const empId = String(entry.employee_id || "").trim();
    if (!empId) continue;
    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, []);
    }
    byEmployee.get(empId).push(entry);
  }

  const updates = [];
  for (const [, entries] of byEmployee.entries()) {
    entries.sort((a, b) => {
      const diff = ledgerSortValue(a) - ledgerSortValue(b);
      if (diff !== 0) return diff;
      return Number(a.ledger_id) - Number(b.ledger_id);
    });

    let runningBalance = 0;
    for (const entry of entries) {
      const normalized = normalizeLedgerRow(entry);
      runningBalance = normalized.entry_type === "payout"
        ? roundCurrency(runningBalance - normalized.amount)
        : roundCurrency(runningBalance + normalized.amount);

      updates.push({
        ledger_id: entry.ledger_id,
        running_balance: runningBalance,
        status: runningBalance <= 0 ? "paid" : normalized.entry_type === "payout" ? "partially_paid" : "not_paid",
      });
    }
  }

  for (const update of updates) {
    const current = ledgerRows.find((e) => String(e.ledger_id) === String(update.ledger_id));
    if (current) {
      await db.updateById(SHEETS.INCENTIVE_LEDGER, update.ledger_id, {
        ...current,
        running_balance: update.running_balance,
        status: update.status,
      });
    }
  }

  return updates.length;
}

function canAccessRecord(user, record, users, employees) {
  if (user.role === "admin") return true;

  const currentUser = users.find((u) => String(u.user_id) === String(user.id));
  if (!currentUser) return false;

  const employee =
    employees.find((e) => String(e.employee_id) === String(currentUser.employee_id)) ||
    employees.find((e) => String(e.company_email).toLowerCase() === String(currentUser.email).toLowerCase());

  if (!employee) return false;
  return String(employee.employee_id) === String(record.employee_id);
}

// Salary schedule logic removed - base_salary is now updated directly via Update Now action

router.get("/", async (req, res) => {
  try {
    const [payrollRows, users, employees] = await Promise.all([
      db.getAll(SHEETS.PAYROLL),
      db.getAll(SHEETS.USERS),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    let rows = payrollRows;

    if (req.query.month) {
      rows = rows.filter((row) => Number(row.month) === Number(req.query.month));
    }
    if (req.query.year) {
      rows = rows.filter((row) => Number(row.year) === Number(req.query.year));
    }
    if (req.query.emp_id) {
      rows = rows.filter((row) => String(row.employee_id) === String(req.query.emp_id));
    }

    rows = rows.filter((row) => canAccessRecord(req.user, row, users, employees));

    return res.json({ payroll: rows });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load payroll" });
  }
});

/**
 * POST /payroll/generate
 * Body: { month, year, incentiveSelections: [{ employee_id, amount }] }
 * Generates payroll from permanent attendance records.
 * Creates monthly payroll and incentive deduction ledger transactions.
 * Optionally integrates incentive payouts into payroll.
 */
router.post("/generate", authorize("admin"), async (req, res) => {
  try {
    const { month, year, incentiveSelections } = req.body || {};

    if (!month || !year) {
      return res.status(400).json({ message: "month and year are required" });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: "month must be between 1 and 12" });
    }

    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ message: "year must be a valid year" });
    }

    // Parse incentive selections
    const incentiveMap = new Map();
    if (Array.isArray(incentiveSelections)) {
      incentiveSelections.forEach((sel) => {
        if (sel.employee_id && Number(sel.amount) > 0) {
          incentiveMap.set(String(sel.employee_id), roundCurrency(Number(sel.amount)));
        }
      });
    }

    // Fetch all required data
    const [employees, attendanceRecords, existingPayroll, incentiveLedger] = await Promise.all([
      db.getAll(SHEETS.EMPLOYEES),
      db.getAll(SHEETS.ATTENDANCE_RECORDS),
      db.getAll(SHEETS.PAYROLL),
      db.getAll(SHEETS.INCENTIVE_LEDGER),
    ]);

    // Filter attendance for this month/year
    const attendanceForMonth = attendanceRecords.filter(
      (rec) => Number(rec.month) === monthNum && Number(rec.year) === yearNum
    );

    if (attendanceForMonth.length === 0) {
      return res.status(400).json({
        message: "No attendance records found for this month/year. Please upload attendance first.",
      });
    }

    // Build attendance map by employee_id
    const attendanceByEmp = new Map(
      attendanceForMonth.map((rec) => [String(rec.employee_id), rec])
    );

    // Filter active employees
    const activeEmployees = employees.filter(
      (emp) => String(emp.status).toLowerCase() === "active"
    );

    const generated = [];
    const ledgerEntries = [];

    for (const emp of activeEmployees) {
      const attendance = attendanceByEmp.get(String(emp.employee_id));
      if (!attendance) continue;

      // Check for duplicate payroll
      const duplicate = existingPayroll.find(
        (item) =>
          String(item.employee_id) === String(emp.employee_id) &&
          Number(item.month) === monthNum &&
          Number(item.year) === yearNum
      );
      if (duplicate) continue;

      // Check for duplicate deduction ledger entry
      const existingLedgerEntry = incentiveLedger.find(
        (entry) =>
          String(entry.employee_id) === String(emp.employee_id) &&
          Number(entry.month) === monthNum &&
          Number(entry.year) === yearNum &&
          String(entry.entry_type || "deduction").toLowerCase() === "deduction"
      );

      const breakdown = calculateSalary({
        basic: Number(emp.base_salary || 0),
        hra: Number(emp.hra || 0),
        other_allowance: Number(emp.other_allowance || 0),
        special_pay: Number(emp.special_pay || 0),
        incentive: Number(emp.incentive || 0),
        working_days: Number(attendance.working_days),
        paid_days: Number(attendance.paid_days),
        extra_days: Number(attendance.extra_days || 0),
        incentive_payout: 0,
      });

      // Get incentive amount for this employee if selected
      const incentiveAmount = incentiveMap.get(String(emp.employee_id)) || 0;

      // Build payroll record
      const payrollRecord = {
        payroll_id: nextId([...existingPayroll, ...generated].map((item) => ({ id: item.payroll_id }))),
        employee_id: emp.employee_id,
        employee_name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
        month: monthNum,
        year: yearNum,
        working_days: Number(attendance.working_days),
        paid_days: Number(attendance.paid_days),
        extra_days: Number(attendance.extra_days || 0),
        basic_salary: breakdown.basic_salary,
        hra: breakdown.hra,
        other_allowance: breakdown.other_allowance,
        special_pay: breakdown.special_pay,
        incentive_deduction: breakdown.incentive_deduction,
        incentive_payout: breakdown.incentive_payout,
        incentive_amount: incentiveAmount,
        gross_salary: breakdown.gross_salary,
        net_salary: roundCurrency(breakdown.net_salary + incentiveAmount),
        payment_status: "Pending",
        payment_date: "",
        created_at: nowIso(),
      };

      generated.push(payrollRecord);

      // Create deduction ledger transaction if not exists
      if (!existingLedgerEntry && breakdown.incentive_deduction > 0) {
        const previousBalance = getEmployeeLedgerBalance([...incentiveLedger, ...ledgerEntries], emp.employee_id);
        const runningBalance = roundCurrency(previousBalance + breakdown.incentive_deduction);

        const ledgerEntry = {
          ledger_id: nextId([...incentiveLedger, ...ledgerEntries].map((e) => ({ id: e.ledger_id }))),
          employee_id: emp.employee_id,
          month: monthNum,
          year: yearNum,
          entry_type: "deduction",
          amount: roundCurrency(breakdown.incentive_deduction),
          running_balance: runningBalance,
          status: runningBalance > 0 ? "not_paid" : "paid",
          reference: `${monthNum}-${yearNum} incentive deduction`,
          transaction_date: `${String(yearNum).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-01`,
          created_at: nowIso(),
        };
        ledgerEntries.push(ledgerEntry);
      }

      // Create payout ledger transaction if incentive was added to payroll
      if (incentiveAmount > 0) {
        const previousBalance = getEmployeeLedgerBalance([...incentiveLedger, ...ledgerEntries], emp.employee_id);
        const runningBalance = roundCurrency(previousBalance - incentiveAmount);

        const payoutEntry = {
          ledger_id: nextId([...incentiveLedger, ...ledgerEntries].map((e) => ({ id: e.ledger_id }))),
          employee_id: emp.employee_id,
          month: monthNum,
          year: yearNum,
          entry_type: "payout",
          amount: roundCurrency(incentiveAmount),
          running_balance: runningBalance,
          status: runningBalance <= 0 ? "paid" : "partially_paid",
          reference: `Paid via ${monthNum}-${yearNum} payroll`,
          transaction_date: `${String(yearNum).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-01`,
          created_at: nowIso(),
        };
        ledgerEntries.push(payoutEntry);
      }
    }

    // Persist payroll records
    for (const record of generated) {
      await db.append(SHEETS.PAYROLL, record);
    }

    // Persist ledger entries
    for (const entry of ledgerEntries) {
      await db.append(SHEETS.INCENTIVE_LEDGER, entry);
    }

    return res.status(201).json({
      generated,
      count: generated.length,
      ledgerEntriesCreated: ledgerEntries.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Payroll generation failed" });
  }
});

router.get("/incentive-balances", authorize("admin"), async (_req, res) => {
  try {
    const [ledgerRows, employees] = await Promise.all([
      db.getAll(SHEETS.INCENTIVE_LEDGER),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const balances = employees
      .filter((emp) => String(emp.status).toLowerCase() === "active")
      .map((emp) => {
        const balance = getEmployeeLedgerBalance(ledgerRows, emp.employee_id);
        return {
          employee_id: emp.employee_id,
          employee_name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
          balance: balance,
        };
      })
      .filter((item) => item.balance > 0);

    return res.json({ balances });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load incentive balances" });
  }
});

router.get("/incentive-ledger", authorize("admin"), async (_req, res) => {
  try {
    const [ledgerRows, employees] = await Promise.all([
      db.getAll(SHEETS.INCENTIVE_LEDGER),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const byEmployeeId = new Map(
      employees.map((employee) => [String(employee.employee_id), `${employee.first_name || ""} ${employee.last_name || ""}`.trim()])
    );

    const ledger = [...ledgerRows]
      .map((row) => ({
        ...normalizeLedgerRow(row),
        employee_name: byEmployeeId.get(String(row.employee_id)) || "",
      }))
      .sort((a, b) => {
        const dateA = ledgerSortValue(a);
        const dateB = ledgerSortValue(b);
        if (dateA !== dateB) return dateB - dateA;
        return Number(b.ledger_id) - Number(a.ledger_id);
      });

    return res.json({ ledger });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load incentive ledger" });
  }
});

router.post("/incentive-ledger/payout", authorize("admin"), async (req, res) => {
  try {
    const ledgerRows = await db.getAll(SHEETS.INCENTIVE_LEDGER);
    const employees = await db.getAll(SHEETS.EMPLOYEES);
    const { employee_id, payout_amount, payout_date, reference } = req.body || {};

    if (!employee_id) {
      return res.status(400).json({ message: "employee_id is required" });
    }

    const employee = employees.find((row) => String(row.employee_id) === String(employee_id));
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const amount = Number(payout_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "payout_amount must be a valid positive number" });
    }

    const balanceBeforePayout = getEmployeeLedgerBalance(ledgerRows, employee_id);
    if (balanceBeforePayout <= 0) {
      return res.status(400).json({ message: "No unpaid incentive balance available for payout" });
    }

    if (amount > balanceBeforePayout) {
      return res.status(400).json({ message: "payout_amount cannot exceed current unpaid balance" });
    }

    const transactionDate = String(payout_date || "").trim() || new Date().toISOString().slice(0, 10);
    const [payoutYear, payoutMonth] = transactionDate.split("-").map(Number);
    const runningBalance = roundCurrency(balanceBeforePayout - amount);
    const ledgerEntry = {
      ledger_id: nextId(ledgerRows.map((e) => ({ id: e.ledger_id }))),
      employee_id: String(employee_id),
      month: Number.isFinite(payoutMonth) ? payoutMonth : new Date().getMonth() + 1,
      year: Number.isFinite(payoutYear) ? payoutYear : new Date().getFullYear(),
      entry_type: "payout",
      amount: roundCurrency(amount),
      running_balance: runningBalance,
      status: runningBalance <= 0 ? "paid" : "partially_paid",
      reference: String(reference || "").trim(),
      transaction_date: transactionDate,
      created_at: nowIso(),
    };

    await db.append(SHEETS.INCENTIVE_LEDGER, ledgerEntry);

    return res.status(201).json({ ledger: normalizeLedgerRow(ledgerEntry) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create payout entry" });
  }
});

router.patch("/:id/mark-paid", authorize("admin"), async (req, res) => {
  try {
    const payroll = await db.getAll(SHEETS.PAYROLL);
    const current = payroll.find((item) => String(item.payroll_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    const updated = await db.updateById(SHEETS.PAYROLL, req.params.id, {
      ...current,
      payment_status: "Paid",
      payment_date: new Date().toISOString().slice(0, 10),
    });

    return res.json({ payroll: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to mark paid" });
  }
});

router.get("/:id/download-payslip", authorize("admin"), async (req, res) => {
  try {
    const payroll = await db.getAll(SHEETS.PAYROLL);
    const employees = await db.getAll(SHEETS.EMPLOYEES);

    const current = payroll.find((item) => String(item.payroll_id) === String(req.params.id));
    if (!current) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    const employee = employees.find((emp) => String(emp.employee_id) === String(current.employee_id));
    if (!employee) {
      return res.status(400).json({ message: "Employee not found" });
    }

    // Generate PDF payslip
    console.log("[Payslip Download] Generating PDF for", current.employee_id, current.month, current.year);
    let pdfBuffer;
    try {
      pdfBuffer = await generatePayslipPDF(current, employee);
      console.log("[Payslip Download] PDF generated, size:", pdfBuffer.length, "bytes");
    } catch (pdfError) {
      console.error("[Payslip Download] PDF generation failed:", pdfError);
      return res.status(500).json({
        message: "Failed to generate payslip PDF: " + (pdfError.message || "Unknown error"),
      });
    }

    const pdfFilename = `Payslip_${employee.employee_id}_${current.month}_${current.year}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdfFilename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("[Payslip Download] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to download payslip" });
  }
});

router.post("/:id/send-payslip", authorize("admin"), async (req, res) => {
  try {
    const payroll = await db.getAll(SHEETS.PAYROLL);
    const employees = await db.getAll(SHEETS.EMPLOYEES);

    const current = payroll.find((item) => String(item.payroll_id) === String(req.params.id));
    if (!current) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    const employee = employees.find((emp) => String(emp.employee_id) === String(current.employee_id));
    if (!employee || !employee.company_email) {
      return res.status(400).json({ message: "Employee email not found" });
    }

    // Generate PDF payslip
    console.log("[Payslip] Generating PDF for", current.employee_id, current.month, current.year);
    let pdfBuffer;
    try {
      pdfBuffer = await generatePayslipPDF(current, employee);
      console.log("[Payslip] PDF generated, size:", pdfBuffer.length, "bytes");
    } catch (pdfError) {
      console.error("[Payslip] PDF generation failed:", pdfError);
      return res.status(500).json({
        message: "Failed to generate payslip PDF: " + (pdfError.message || "Unknown error"),
      });
    }

    // Build email with minimal body (PDF is the main content)
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[(current.month || 1) - 1] || "Unknown";
    const employeeName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
    
    const emailSubject = `Payslip for ${monthName} ${current.year}`;
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color: #0d2137;">Payslip - ${monthName} ${current.year}</h2>
        <p>Dear ${employeeName},</p>
        <p>Please find attached your payslip for ${monthName} ${current.year}.</p>
        <p>If you have any questions, please contact the HR department.</p>
        <br/>
        <p>Best regards,<br/>VTAB Square Pvt Ltd</p>
      </div>
    `;

    const pdfFilename = `Payslip_${employee.employee_id}_${current.month}_${current.year}.pdf`;

    let delivery;
    try {
      delivery = await sendEmail({
        to: employee.company_email,
        subject: emailSubject,
        html: emailHtml,
        attachment: {
          content: pdfBuffer,
          name: pdfFilename,
        },
      });
    } catch (emailError) {
      console.error("[Payslip] Email send failed:", emailError);
      return res.status(503).json({
        message: emailError instanceof Error ? emailError.message : "Failed to send payslip email",
      });
    }

    if (!delivery.delivered) {
      return res.status(503).json({
        message: delivery.reason || "Brevo email delivery is not configured",
      });
    }

    const nextStatus = current.payment_status === "Pending" ? "Sent" : current.payment_status;

    const updated = await db.updateById(SHEETS.PAYROLL, req.params.id, {
      ...current,
      payment_status: nextStatus,
    });

    console.log("[Payslip] Email sent successfully with PDF attachment to", employee.company_email);
    return res.json({ payroll: updated });
  } catch (error) {
    console.error("[Payslip] Error:", error);
    return res.status(500).json({ message: error.message || "Failed to send payslip" });
  }
});

/**
 * POST /payroll/incentive-ledger/recalculate-totals
 * Recalculates running balances and statuses for all ledger entries.
 */
router.post("/incentive-ledger/recalculate-totals", authorize("admin"), async (req, res) => {
  try {
    const updatedCount = await recalculateLedgerTotals();

    return res.json({
      message: "Successfully recalculated running balances for all ledger entries",
      updatedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to recalculate totals" });
  }
});

/**
 * DELETE /payroll/bulk/delete
 * Delete selected payroll records and clean up related incentive ledger entries
 * Body: { payroll_ids: string[] }
 */
router.delete("/bulk/delete", authorize("admin"), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.payroll_ids)
      ? req.body.payroll_ids.map((id) => String(id || "").trim()).filter(Boolean)
      : [];

    if (ids.length === 0) {
      return res.status(400).json({ message: "payroll_ids array is required" });
    }

    const uniqueIds = Array.from(new Set(ids));
    const payrollRecords = await db.getAll(SHEETS.PAYROLL);
    const payrollById = new Map(payrollRecords.map((record) => [String(record.payroll_id), record]));

    const recordsToDelete = uniqueIds
      .map((id) => payrollById.get(id))
      .filter(Boolean);

    if (recordsToDelete.length === 0) {
      return res.status(404).json({ message: "No matching payroll records found" });
    }

    const ledgerEntries = await db.getAll(SHEETS.INCENTIVE_LEDGER);
    const ledgerIdsToDelete = new Set();

    for (const record of recordsToDelete) {
      const employeeId = String(record.employee_id);
      const month = Number(record.month);
      const year = Number(record.year);

      for (const entry of ledgerEntries) {
        if (
          String(entry.employee_id) === employeeId &&
          Number(entry.month) === month &&
          Number(entry.year) === year
        ) {
          ledgerIdsToDelete.add(String(entry.ledger_id));
        }
      }
    }

    // Get row positions for all records to delete, then sort by row number descending
    // This ensures we delete from bottom to top, avoiding row shift issues
    const payrollRowPositions = [];
    for (const record of recordsToDelete) {
      const rowInfo = await db.getGoogleSheetRowById(SHEETS.PAYROLL, record.payroll_id);
      if (rowInfo) {
        payrollRowPositions.push({ id: record.payroll_id, rowNumber: rowInfo.rowNumber });
      }
    }
    payrollRowPositions.sort((a, b) => b.rowNumber - a.rowNumber);

    const ledgerRowPositions = [];
    for (const ledgerId of ledgerIdsToDelete) {
      const rowInfo = await db.getGoogleSheetRowById(SHEETS.INCENTIVE_LEDGER, ledgerId);
      if (rowInfo) {
        ledgerRowPositions.push({ id: ledgerId, rowNumber: rowInfo.rowNumber });
      }
    }
    ledgerRowPositions.sort((a, b) => b.rowNumber - a.rowNumber);

    // Delete in reverse row order (bottom to top)
    for (const { id } of payrollRowPositions) {
      await db.deleteById(SHEETS.PAYROLL, id);
    }

    for (const { id } of ledgerRowPositions) {
      await db.deleteById(SHEETS.INCENTIVE_LEDGER, id);
    }

    await recalculateLedgerTotals();

    return res.json({
      message: "Selected payroll records deleted successfully",
      deletedPayrollRecords: recordsToDelete.length,
      deletedLedgerEntries: ledgerIdsToDelete.size,
      deletedPayrollIds: recordsToDelete.map((record) => record.payroll_id),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete selected payroll records" });
  }
});

/**
 * DELETE /payroll/:payroll_id
 * Delete a single payroll record and clean up related incentive ledger entries
 */
router.delete("/:payroll_id", authorize("admin"), async (req, res) => {
  try {
    const { payroll_id } = req.params;

    if (!payroll_id) {
      return res.status(400).json({ message: "payroll_id is required" });
    }

    // Get the payroll record to find related ledger entries
    const payrollRecords = await db.getAll(SHEETS.PAYROLL);
    const payrollRecord = payrollRecords.find((p) => String(p.payroll_id) === String(payroll_id));

    if (!payrollRecord) {
      return res.status(404).json({ message: "Payroll record not found" });
    }

    const employeeId = String(payrollRecord.employee_id);
    const month = Number(payrollRecord.month);
    const year = Number(payrollRecord.year);

    // Delete the payroll record
    await db.deleteById(SHEETS.PAYROLL, payroll_id);

    // Find and delete related incentive ledger entries (deduction and payout for this month/year/employee)
    const ledgerEntries = await db.getAll(SHEETS.INCENTIVE_LEDGER);
    const relatedEntries = ledgerEntries.filter(
      (entry) =>
        String(entry.employee_id) === employeeId &&
        Number(entry.month) === month &&
        Number(entry.year) === year
    );

    for (const entry of relatedEntries) {
      await db.deleteById(SHEETS.INCENTIVE_LEDGER, entry.ledger_id);
    }

    await recalculateLedgerTotals();

    return res.json({
      message: "Payroll record deleted successfully",
      deletedPayrollId: payroll_id,
      deletedLedgerEntries: relatedEntries.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete payroll record" });
  }
});

/**
 * DELETE /payroll/period/:month/:year
 * Delete all payroll records for a specific month/year and clean up related incentive ledger entries
 */
router.delete("/period/:month/:year", authorize("admin"), async (req, res) => {
  try {
    const { month, year } = req.params;

    if (!month || !year) {
      return res.status(400).json({ message: "month and year are required" });
    }

    const monthNum = Number(month);
    const yearNum = Number(year);

    if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: "month must be between 1 and 12" });
    }

    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
      return res.status(400).json({ message: "year must be a valid year" });
    }

    // Get all payroll records for this period
    const payrollRecords = await db.getAll(SHEETS.PAYROLL);
    const recordsToDelete = payrollRecords.filter(
      (p) => Number(p.month) === monthNum && Number(p.year) === yearNum
    );

    if (recordsToDelete.length === 0) {
      return res.status(404).json({ message: "No payroll records found for this period" });
    }

    // Delete all payroll records for this period
    for (const record of recordsToDelete) {
      await db.deleteById(SHEETS.PAYROLL, record.payroll_id);
    }

    // Find and delete all related incentive ledger entries for this period
    const ledgerEntries = await db.getAll(SHEETS.INCENTIVE_LEDGER);
    const relatedEntries = ledgerEntries.filter(
      (entry) => Number(entry.month) === monthNum && Number(entry.year) === yearNum
    );

    for (const entry of relatedEntries) {
      await db.deleteById(SHEETS.INCENTIVE_LEDGER, entry.ledger_id);
    }

    await recalculateLedgerTotals();

    return res.json({
      message: `Successfully deleted all payroll records for ${monthNum}/${yearNum}`,
      deletedPayrollRecords: recordsToDelete.length,
      deletedLedgerEntries: relatedEntries.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete payroll records" });
  }
});

module.exports = router;
