const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, authorize("admin"));

/**
 * Validate a single attendance row.
 * CSV columns: employee_id, employee_name, working_days, paid_days
 */
function validateRow(row, employeeIds) {
  const employeeId = String(row.employee_id || "").trim();
  const employeeName = String(row.employee_name || "").trim();
  const workingDays = Number(row.working_days);
  const paidDays = Number(row.paid_days);
  const normalizedPaidDays =
    Number.isFinite(workingDays) && Number.isFinite(paidDays) && paidDays > workingDays
      ? workingDays
      : paidDays;
  const extraDays =
    Number.isFinite(workingDays) && Number.isFinite(paidDays) && paidDays > workingDays
      ? paidDays - workingDays
      : 0;

  const errors = [];

  if (!employeeId) {
    errors.push("employee_id is required");
  } else if (!employeeIds.has(employeeId.toUpperCase())) {
    errors.push(`employee_id '${employeeId}' does not exist`);
  }

  if (!employeeName) {
    errors.push("employee_name is required");
  }

  if (!Number.isFinite(workingDays) || workingDays <= 0) {
    errors.push("working_days must be > 0");
  }

  if (!Number.isFinite(paidDays) || paidDays < 0) {
    errors.push("paid_days must be >= 0");
  }

  return {
    employee_id: employeeId,
    employee_name: employeeName,
    working_days: workingDays,
    paid_days: normalizedPaidDays,
    extra_days: extraDays,
    valid: errors.length === 0,
    errors,
  };
}

/**
 * POST /attendance/upload
 * Body: { month, year, rows, override? }
 * Stores attendance permanently in AttendanceRecords sheet.
 * Prevents duplicates unless override=true.
 */
router.post("/upload", async (req, res) => {
  try {
    const { month, year, rows, override } = req.body || {};

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

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "rows are required" });
    }

    // Fetch employees to validate employee_id (case-insensitive, trimmed)
    const employees = await db.getAll(SHEETS.EMPLOYEES);
    const employeeIds = new Set(employees.map((e) => String(e.employee_id || "").trim().toUpperCase()));

    // Validate all rows
    const parsed = rows.map((row) => validateRow(row, employeeIds));
    const invalidRows = parsed.filter((row) => !row.valid);

    if (invalidRows.length > 0) {
      return res.status(400).json({
        message: "CSV contains invalid rows",
        invalidRows: invalidRows.map((r) => ({
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          errors: r.errors,
        })),
      });
    }

    // Fetch existing attendance records for this month/year
    const existingRecords = await db.getAll(SHEETS.ATTENDANCE_RECORDS);
    const existingForMonth = existingRecords.filter(
      (rec) => Number(rec.month) === monthNum && Number(rec.year) === yearNum
    );

    // Check for duplicates
    const existingEmpIds = new Set(existingForMonth.map((rec) => String(rec.employee_id)));
    const duplicates = parsed.filter((row) => existingEmpIds.has(row.employee_id));

    if (duplicates.length > 0 && !override) {
      return res.status(409).json({
        message: "Attendance already exists for some employees in this month/year",
        duplicates: duplicates.map((d) => ({
          employee_id: d.employee_id,
          employee_name: d.employee_name,
        })),
        requiresOverride: true,
      });
    }

    // If override, delete existing records for duplicates
    if (override && duplicates.length > 0) {
      const duplicateEmpIds = new Set(duplicates.map((d) => d.employee_id));
      for (const rec of existingForMonth) {
        if (duplicateEmpIds.has(String(rec.employee_id))) {
          await db.deleteById(SHEETS.ATTENDANCE_RECORDS, rec.attendance_id);
        }
      }
    }

    // Insert new attendance records
    const allRecords = await db.getAll(SHEETS.ATTENDANCE_RECORDS);
    const inserted = [];

    for (const row of parsed) {
      const record = {
        attendance_id: nextId([...allRecords, ...inserted].map((r) => ({ id: r.attendance_id }))),
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        month: monthNum,
        year: yearNum,
        working_days: row.working_days,
        paid_days: row.paid_days,
        extra_days: row.extra_days,
        created_at: nowIso(),
      };
      await db.append(SHEETS.ATTENDANCE_RECORDS, record);
      inserted.push(record);
    }

    return res.status(201).json({
      message: "Attendance uploaded successfully",
      count: inserted.length,
      month: monthNum,
      year: yearNum,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to upload attendance" });
  }
});

/**
 * GET /attendance
 * Query params: month, year (optional)
 * Returns attendance records, optionally filtered by month/year.
 */
router.get("/", async (req, res) => {
  try {
    let records = await db.getAll(SHEETS.ATTENDANCE_RECORDS);

    if (req.query.month) {
      records = records.filter((rec) => Number(rec.month) === Number(req.query.month));
    }
    if (req.query.year) {
      records = records.filter((rec) => Number(rec.year) === Number(req.query.year));
    }

    return res.json({ attendance: records });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to fetch attendance" });
  }
});

/**
 * GET /attendance/check
 * Query params: month, year (required)
 * Returns whether attendance exists for the given month/year.
 */
router.get("/check", async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: "month and year are required" });
    }

    const records = await db.getAll(SHEETS.ATTENDANCE_RECORDS);
    const existing = records.filter(
      (rec) => Number(rec.month) === Number(month) && Number(rec.year) === Number(year)
    );

    return res.json({
      exists: existing.length > 0,
      count: existing.length,
      month: Number(month),
      year: Number(year),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to check attendance" });
  }
});

module.exports = router;
