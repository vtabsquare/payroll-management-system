const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

/**
 * POST /payslip-requests
 * Employee creates a payslip request
 */
router.post("/", authorize("employee"), async (req, res) => {
  try {
    const { month, year, request_message } = req.body || {};

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

    // Resolve employee from auth user
    const [users, employees, existing] = await Promise.all([
      db.getAll(SHEETS.USERS),
      db.getAll(SHEETS.EMPLOYEES),
      db.getAll(SHEETS.PAYSLIP_REQUESTS),
    ]);

    const user = users.find((u) => String(u.user_id) === String(req.user.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const employee =
      employees.find((e) => String(e.employee_id) === String(user.employee_id)) ||
      employees.find((e) => String(e.company_email).toLowerCase() === String(user.email).toLowerCase());

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    // Duplicate check
    const duplicate = existing.find(
      (r) =>
        String(r.employee_id) === String(employee.employee_id) &&
        Number(r.month) === monthNum &&
        Number(r.year) === yearNum
    );
    if (duplicate) {
      return res.status(409).json({ message: "A payslip request already exists for this month/year" });
    }

    const record = {
      request_id: nextId(existing.map((r) => ({ id: r.request_id }))),
      employee_id: employee.employee_id,
      employee_name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
      employee_code: employee.employee_id,
      month: monthNum,
      year: yearNum,
      request_message: String(request_message || "").trim(),
      status: "pending",
      requested_at: nowIso(),
      processed_at: "",
      processed_by: "",
      admin_comment: "",
      payslip_id: "",
    };

    await db.append(SHEETS.PAYSLIP_REQUESTS, record);

    return res.status(201).json({ request: record });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create request" });
  }
});

/**
 * GET /payslip-requests/my
 * Employee gets their own requests
 */
router.get("/my", authorize("employee"), async (req, res) => {
  try {
    const [users, employees, requests] = await Promise.all([
      db.getAll(SHEETS.USERS),
      db.getAll(SHEETS.EMPLOYEES),
      db.getAll(SHEETS.PAYSLIP_REQUESTS),
    ]);

    const user = users.find((u) => String(u.user_id) === String(req.user.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const employee =
      employees.find((e) => String(e.employee_id) === String(user.employee_id)) ||
      employees.find((e) => String(e.company_email).toLowerCase() === String(user.email).toLowerCase());

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const myRequests = requests
      .filter((r) => String(r.employee_id) === String(employee.employee_id))
      .sort((a, b) => {
        const dateA = new Date(a.requested_at || 0).getTime();
        const dateB = new Date(b.requested_at || 0).getTime();
        return dateB - dateA;
      });

    return res.json({ requests: myRequests });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load requests" });
  }
});

/**
 * GET /payslip-requests
 * Admin gets all requests
 */
router.get("/", authorize("admin"), async (_req, res) => {
  try {
    const requests = await db.getAll(SHEETS.PAYSLIP_REQUESTS);

    const sorted = [...requests].sort((a, b) => {
      const dateA = new Date(a.requested_at || 0).getTime();
      const dateB = new Date(b.requested_at || 0).getTime();
      return dateB - dateA;
    });

    return res.json({ requests: sorted });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load requests" });
  }
});

/**
 * POST /payslip-requests/:id/approve
 * Admin approves a request
 */
router.post("/:id/approve", authorize("admin"), async (req, res) => {
  try {
    const requests = await db.getAll(SHEETS.PAYSLIP_REQUESTS);
    const current = requests.find((r) => String(r.request_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (current.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be approved" });
    }

    // Find corresponding payroll record
    const payroll = await db.getAll(SHEETS.PAYROLL);
    const payrollRecord = payroll.find(
      (p) =>
        String(p.employee_id) === String(current.employee_id) &&
        Number(p.month) === Number(current.month) &&
        Number(p.year) === Number(current.year)
    );

    if (!payrollRecord) {
      return res.status(400).json({
        message: `No payroll record found for ${current.employee_name} for ${current.month}/${current.year}`,
      });
    }

    const updated = await db.updateById(SHEETS.PAYSLIP_REQUESTS, req.params.id, {
      ...current,
      status: "approved",
      processed_at: nowIso(),
      processed_by: String(req.user.id),
      payslip_id: String(payrollRecord.payroll_id),
    });

    return res.json({ request: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to approve request" });
  }
});

/**
 * POST /payslip-requests/:id/reject
 * Admin rejects a request
 */
router.post("/:id/reject", authorize("admin"), async (req, res) => {
  try {
    const { admin_comment } = req.body || {};

    const requests = await db.getAll(SHEETS.PAYSLIP_REQUESTS);
    const current = requests.find((r) => String(r.request_id) === String(req.params.id));

    if (!current) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (current.status !== "pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected" });
    }

    const updated = await db.updateById(SHEETS.PAYSLIP_REQUESTS, req.params.id, {
      ...current,
      status: "rejected",
      processed_at: nowIso(),
      processed_by: String(req.user.id),
      admin_comment: String(admin_comment || "").trim(),
    });

    return res.json({ request: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to reject request" });
  }
});

module.exports = router;
