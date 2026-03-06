const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso, toBoolean } = require("../utils/helpers");
const { calculateSalary, roundCurrency } = require("../services/salaryEngine");
const { sendEmail, buildPayslipEmail } = require("../services/emailService");
const { generatePayslipPDF } = require("../services/pdfService");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

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

function monthKeyToNumber(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return Number.NaN;
  const [year, month] = String(monthKey).split("-").map(Number);
  return year * 12 + month;
}

function resolveScheduledBasic(employeeId, month, year, scheduleRows, fallbackSalary) {
  const targetMonthNumber = Number(year) * 12 + Number(month);
  const matchingSchedule = scheduleRows.find((item) => {
    if (String(item.employee_id) !== String(employeeId)) return false;
    const start = monthKeyToNumber(item.start_month);
    const end = monthKeyToNumber(item.end_month);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start <= targetMonthNumber && targetMonthNumber <= end;
  });

  if (!matchingSchedule) {
    return Number(fallbackSalary || 0);
  }

  return Number(matchingSchedule.salary || fallbackSalary || 0);
}

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
 * Body: { month, year }
 * Generates payroll from permanent attendance records.
 * Implements incentive ledger and 6-month payout rule.
 */
router.post("/generate", authorize("admin"), async (req, res) => {
  try {
    const { month, year } = req.body || {};

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

    // Fetch all required data
    const [employees, attendanceRecords, existingPayroll, incentiveLedger, salarySchedule] = await Promise.all([
      db.getAll(SHEETS.EMPLOYEES),
      db.getAll(SHEETS.ATTENDANCE_RECORDS),
      db.getAll(SHEETS.PAYROLL),
      db.getAll(SHEETS.INCENTIVE_LEDGER),
      db.getAll(SHEETS.SALARY_SCHEDULE),
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

      // Check for duplicate ledger entry
      const existingLedgerEntry = incentiveLedger.find(
        (entry) =>
          String(entry.employee_id) === String(emp.employee_id) &&
          Number(entry.month) === monthNum &&
          Number(entry.year) === yearNum
      );

      // Incentive payout is now admin-controlled via ledger edit dialog
      // No automatic 6-month payout logic

      // Calculate salary
      const effectiveBasicSalary = resolveScheduledBasic(
        emp.employee_id,
        monthNum,
        yearNum,
        salarySchedule,
        emp.base_salary
      );

      const breakdown = calculateSalary({
        basic: effectiveBasicSalary,
        hra: Number(emp.hra || 0),
        other_allowance: Number(emp.other_allowance || 0),
        special_pay: Number(emp.special_pay || 0),
        incentive: Number(emp.incentive || 0),
        working_days: Number(attendance.working_days),
        paid_days: Number(attendance.paid_days),
        incentive_payout: 0,
      });

      // Build payroll record
      const payrollRecord = {
        payroll_id: nextId([...existingPayroll, ...generated].map((item) => ({ id: item.payroll_id }))),
        employee_id: emp.employee_id,
        employee_name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
        month: monthNum,
        year: yearNum,
        working_days: Number(attendance.working_days),
        paid_days: Number(attendance.paid_days),
        basic_salary: breakdown.basic_salary,
        hra: breakdown.hra,
        other_allowance: breakdown.other_allowance,
        special_pay: breakdown.special_pay,
        incentive_deduction: breakdown.incentive_deduction,
        incentive_payout: breakdown.incentive_payout,
        gross_salary: breakdown.gross_salary,
        net_salary: breakdown.net_salary,
        payment_status: "Pending",
        payment_date: "",
        created_at: nowIso(),
      };

      generated.push(payrollRecord);

      // Create ledger entry if not exists
      if (!existingLedgerEntry && breakdown.incentive_deduction > 0) {
        // Calculate cumulative total_deducted for this employee
        const previousTotal = incentiveLedger
          .filter((entry) => String(entry.employee_id) === String(emp.employee_id))
          .reduce((sum, entry) => sum + Number(entry.amount_deducted || 0), 0);
        
        const newTotalDeducted = roundCurrency(previousTotal + breakdown.incentive_deduction);

        const ledgerEntry = {
          ledger_id: nextId([...incentiveLedger, ...ledgerEntries].map((e) => ({ id: e.ledger_id }))),
          employee_id: emp.employee_id,
          month: monthNum,
          year: yearNum,
          amount_deducted: breakdown.incentive_deduction,
          total_deducted: newTotalDeducted,
          paid_out: false,
          payout_reference_month: "",
          created_at: nowIso(),
        };
        ledgerEntries.push(ledgerEntry);
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
        ...row,
        employee_name: byEmployeeId.get(String(row.employee_id)) || "",
      }))
      .sort((a, b) => {
        const dateA = Number(a.year) * 12 + Number(a.month);
        const dateB = Number(b.year) * 12 + Number(b.month);
        if (dateA !== dateB) return dateB - dateA;
        return Number(b.ledger_id) - Number(a.ledger_id);
      });

    return res.json({ ledger });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load incentive ledger" });
  }
});

router.patch("/incentive-ledger/:id", authorize("admin"), async (req, res) => {
  try {
    const ledgerRows = await db.getAll(SHEETS.INCENTIVE_LEDGER);
    const current = ledgerRows.find((row) => String(row.ledger_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Ledger entry not found" });
    }

    const nextAmount =
      req.body?.amount_deducted === undefined
        ? Number(current.amount_deducted || 0)
        : Number(req.body.amount_deducted);

    if (!Number.isFinite(nextAmount)) {
      return res.status(400).json({ message: "amount_deducted must be a valid number" });
    }

    // Recalculate total_deducted if amount_deducted changed
    let newTotalDeducted = Number(current.total_deducted || 0);
    if (nextAmount !== Number(current.amount_deducted || 0)) {
      const employeeLedger = ledgerRows.filter(
        (entry) => String(entry.employee_id) === String(current.employee_id)
      );
      const previousTotal = employeeLedger
        .filter((entry) => String(entry.ledger_id) !== String(req.params.id))
        .reduce((sum, entry) => sum + Number(entry.amount_deducted || 0), 0);
      newTotalDeducted = roundCurrency(previousTotal + nextAmount);
    }

    const updated = await db.updateById(SHEETS.INCENTIVE_LEDGER, req.params.id, {
      ...current,
      amount_deducted: nextAmount,
      total_deducted: newTotalDeducted,
      paid_out:
        req.body?.paid_out === undefined
          ? toBoolean(current.paid_out)
          : toBoolean(req.body.paid_out),
      payout_reference_month:
        req.body?.payout_reference_month === undefined
          ? String(current.payout_reference_month || "")
          : String(req.body.payout_reference_month || ""),
    });

    return res.json({ ledger: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update ledger entry" });
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
 * Recalculates total_deducted for all existing ledger entries
 * This is a one-time migration endpoint to fix existing data
 */
router.post("/incentive-ledger/recalculate-totals", authorize("admin"), async (req, res) => {
  try {
    const ledgerRows = await db.getAll(SHEETS.INCENTIVE_LEDGER);

    // Group entries by employee_id
    const byEmployee = new Map();
    for (const entry of ledgerRows) {
      const empId = String(entry.employee_id);
      if (!byEmployee.has(empId)) {
        byEmployee.set(empId, []);
      }
      byEmployee.get(empId).push(entry);
    }

    // Sort each employee's entries by year/month and recalculate cumulative totals
    const updates = [];
    for (const [empId, entries] of byEmployee.entries()) {
      // Sort by year and month ascending
      entries.sort((a, b) => {
        const dateA = Number(a.year) * 12 + Number(a.month);
        const dateB = Number(b.year) * 12 + Number(b.month);
        return dateA - dateB;
      });

      let runningTotal = 0;
      for (const entry of entries) {
        runningTotal += Number(entry.amount_deducted || 0);
        const newTotalDeducted = roundCurrency(runningTotal);

        updates.push({
          ledger_id: entry.ledger_id,
          total_deducted: newTotalDeducted,
        });
      }
    }

    // Apply updates
    for (const update of updates) {
      const current = ledgerRows.find((e) => String(e.ledger_id) === String(update.ledger_id));
      if (current) {
        await db.updateById(SHEETS.INCENTIVE_LEDGER, update.ledger_id, {
          ...current,
          total_deducted: update.total_deducted,
        });
      }
    }

    return res.json({
      message: "Successfully recalculated total_deducted for all ledger entries",
      updatedCount: updates.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to recalculate totals" });
  }
});

module.exports = router;
