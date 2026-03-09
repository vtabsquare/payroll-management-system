const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");
const { maskSalaries } = require("../middleware/maskSalaries");

const router = express.Router();
router.use(authenticate, maskSalaries);

/**
 * GET /salary-schedule
 * Returns all salary schedule entries with employee names enriched
 */
router.get("/", authorize("admin"), async (req, res) => {
  try {
    const [scheduleRows, employees] = await Promise.all([
      db.getAll(SHEETS.SALARY_SCHEDULE),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const employeeMap = new Map(
      employees.map((emp) => [
        String(emp.employee_id),
        `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
      ])
    );

    const enrichedSchedule = scheduleRows.map((row) => ({
      ...row,
      employee_name: employeeMap.get(String(row.employee_id)) || "",
    }));

    // Sort by start_month descending (most recent first)
    enrichedSchedule.sort((a, b) => {
      const aKey = String(a.start_month || "");
      const bKey = String(b.start_month || "");
      return bKey.localeCompare(aKey);
    });

    return res.json({ schedule: enrichedSchedule });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load salary schedule" });
  }
});

/**
 * POST /salary-schedule
 * Creates a new salary schedule entry
 */
router.post("/", authorize("admin"), async (req, res) => {
  try {
    const { employee_id, start_month, end_month, salary, status } = req.body;

    if (!employee_id || !start_month || !end_month || !salary) {
      return res.status(400).json({ message: "employee_id, start_month, end_month, and salary are required" });
    }

    const scheduleRows = await db.getAll(SHEETS.SALARY_SCHEDULE);

    const newEntry = {
      salaryrev_id: nextId(scheduleRows.map((item) => ({ id: item.salaryrev_id }))),
      employee_id: String(employee_id),
      start_month: String(start_month),
      end_month: String(end_month),
      salary: Number(salary),
      status: String(status || "upcoming"),
    };

    await db.append(SHEETS.SALARY_SCHEDULE, newEntry);

    return res.status(201).json({ schedule: newEntry });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create salary schedule entry" });
  }
});

/**
 * PATCH /salary-schedule/:id
 * Updates an existing salary schedule entry
 */
router.patch("/:id", authorize("admin"), async (req, res) => {
  try {
    const scheduleRows = await db.getAll(SHEETS.SALARY_SCHEDULE);
    const current = scheduleRows.find((row) => String(row.salaryrev_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Salary schedule entry not found" });
    }

    const updated = {
      ...current,
      employee_id: req.body.employee_id !== undefined ? String(req.body.employee_id) : current.employee_id,
      start_month: req.body.start_month !== undefined ? String(req.body.start_month) : current.start_month,
      end_month: req.body.end_month !== undefined ? String(req.body.end_month) : current.end_month,
      salary: req.body.salary !== undefined ? Number(req.body.salary) : Number(current.salary),
      status: req.body.status !== undefined ? String(req.body.status) : current.status,
    };

    const result = await db.updateById(SHEETS.SALARY_SCHEDULE, req.params.id, updated);

    return res.json({ schedule: result });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update salary schedule entry" });
  }
});

/**
 * DELETE /salary-schedule/:id
 * Deletes a salary schedule entry
 */
router.delete("/:id", authorize("admin"), async (req, res) => {
  try {
    const scheduleRows = await db.getAll(SHEETS.SALARY_SCHEDULE);
    const current = scheduleRows.find((row) => String(row.salaryrev_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Salary schedule entry not found" });
    }

    await db.deleteById(SHEETS.SALARY_SCHEDULE, req.params.id);

    return res.json({ message: "Salary schedule entry deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to delete salary schedule entry" });
  }
});

module.exports = router;
