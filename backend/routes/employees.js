const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextEmpId, nowIso } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, authorize("admin"));

function validateEmployee(body) {
  const required = ["first_name", "last_name", "company_email", "designation"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length > 0) {
    return `Missing fields: ${missing.join(", ")}`;
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const q = String(req.query.q || "").toLowerCase();

    const filtered = q
      ? rows.filter((row) =>
          [
            row.first_name,
            row.last_name,
            row.employee_id,
            row.designation,
            row.company_email,
            row.phone,
          ].some((field) =>
            String(field || "").toLowerCase().includes(q)
          )
        )
      : rows;

    return res.json({ employees: filtered });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load employees" });
  }
});

router.post("/", async (req, res) => {
  try {
    const error = validateEmployee(req.body || {});
    if (error) {
      return res.status(400).json({ message: error });
    }

    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const employeeId = nextEmpId(rows, "employee_id");
    const employee = {
      employee_id: employeeId,
      first_name: String(req.body.first_name || "").trim(),
      last_name: String(req.body.last_name || "").trim(),
      company_email: String(req.body.company_email || "").trim().toLowerCase(),
      phone: String(req.body.phone || "").trim(),
      designation: String(req.body.designation || "").trim(),
      employee_type: String(req.body.employee_type || "").trim(),
      date_of_joining: String(req.body.date_of_joining || new Date().toISOString().slice(0, 10)),
      date_of_birth: String(req.body.date_of_birth || ""),
      gender: String(req.body.gender || ""),
      aadhaar_number: String(req.body.aadhaar_number || ""),
      pan_number: String(req.body.pan_number || ""),
      pf_number: String(req.body.pf_number || ""),
      bank_name: String(req.body.bank_name || ""),
      account_number: String(req.body.account_number || ""),
      ifsc_code: String(req.body.ifsc_code || ""),
      status: String(req.body.status || "").toLowerCase() === "inactive" ? "inactive" : "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    await db.append(SHEETS.EMPLOYEES, employee);
    return res.status(201).json({ employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add employee" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const existingRows = await db.getAll(SHEETS.EMPLOYEES);
    const existing = existingRows.find((row) => String(row.employee_id) === String(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const updates = {
      ...existing,
      ...req.body,
      company_email:
        req.body.company_email === undefined
          ? existing.company_email
          : String(req.body.company_email || "").trim().toLowerCase(),
      updated_at: nowIso(),
    };

    const employee = await db.updateById(SHEETS.EMPLOYEES, req.params.id, updates);
    return res.json({ employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update employee" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const existing = rows.find((row) => String(row.employee_id) === String(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const status = req.body.status === "inactive" ? "inactive" : "active";
    const employee = await db.updateById(SHEETS.EMPLOYEES, req.params.id, {
      ...existing,
      status,
      updated_at: nowIso(),
    });

    return res.json({ employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update status" });
  }
});

module.exports = router;
