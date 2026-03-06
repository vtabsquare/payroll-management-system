const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { authenticate, authorize } = require("../middleware/auth");
const { nextId, nowIso, toBoolean } = require("../utils/helpers");
const { sendEmail } = require("../services/emailService");

const router = express.Router();
router.use(authenticate, authorize("admin"));

function resolveEmployee(employees, value, email) {
  if (value) {
    const needle = String(value).trim();
    const byEmpId = employees.find((employee) => String(employee.employee_id) === needle);
    if (byEmpId) return byEmpId;

    const byEmail = employees.find(
      (employee) => String(employee.company_email).toLowerCase() === needle.toLowerCase()
    );
    if (byEmail) return byEmail;
  }

  if (!email) return null;
  return (
    employees.find(
      (employee) => String(employee.company_email).toLowerCase() === String(email).toLowerCase()
    ) || null
  );
}

router.get("/", async (_req, res) => {
  try {
    const users = await db.getAll(SHEETS.USERS);
    return res.json({
      users: users.map((user) => ({
        id: user.user_id,
        email: user.email,
        role: user.role,
        active: toBoolean(user.is_active),
        employee_id: user.employee_id || "",
        last_login: user.last_login || "",
        login_attempt: Number(user.login_attempt) || 0,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load users" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { email, role, employee_id, password } = req.body || {};

    if (!email || !role || !password) {
      return res.status(400).json({ message: "email, role and password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await db.getAll(SHEETS.USERS);
    if (existing.some((user) => String(user.email).toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ message: "User email already exists" });
    }

    const normalizedRole = role === "employee" ? "employee" : "admin";
    let normalizedEmployeeId = employee_id || "";

    if (normalizedRole === "employee") {
      const employees = await db.getAll(SHEETS.EMPLOYEES);
      const linkedEmployee = resolveEmployee(employees, employee_id, normalizedEmail);
      if (!linkedEmployee) {
        return res
          .status(400)
          .json({ message: "Employee link is required for employee role (id, emp_id, or employee email)." });
      }
      normalizedEmployeeId = linkedEmployee.employee_id;
    } else {
      normalizedEmployeeId = "";
    }

    const user = {
      user_id: nextId(existing.map((item) => ({ id: item.user_id }))),
      employee_id: normalizedEmployeeId,
      email: normalizedEmail,
      role: normalizedRole,
      is_active: true,
      password_hash: await bcrypt.hash(password, 10),
      created_at: nowIso(),
      last_login: "",
    };

    await db.append(SHEETS.USERS, user);

    return res.status(201).json({
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        active: user.is_active,
        employee_id: user.employee_id,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to create user" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const [users, employees] = await Promise.all([
      db.getAll(SHEETS.USERS),
      db.getAll(SHEETS.EMPLOYEES),
    ]);
    const current = users.find((user) => String(user.id) === String(req.params.id));
    if (!current) {
      return res.status(404).json({ message: "User not found" });
    }

    const nextRole = req.body.role ? (req.body.role === "employee" ? "employee" : "admin") : current.role;
    let nextEmployeeId =
      req.body.employee_id === undefined ? current.employee_id : String(req.body.employee_id || "");

    if (nextRole === "employee") {
      const linkedEmployee = resolveEmployee(employees, nextEmployeeId, current.email);
      if (!linkedEmployee) {
        return res
          .status(400)
          .json({ message: "Employee link is required for employee role (id, emp_id, or employee email)." });
      }
      nextEmployeeId = linkedEmployee.employee_id;
    } else {
      nextEmployeeId = "";
    }

    const updates = {
      ...current,
      role: nextRole,
      is_active: req.body.active === undefined ? current.is_active : toBoolean(req.body.active),
      employee_id: nextEmployeeId,
      // last_login is set during login
    };

    const user = await db.updateById(SHEETS.USERS, req.params.id, updates);

    return res.json({
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        active: toBoolean(user.is_active),
        employee_id: user.employee_id || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update user" });
  }
});

router.post("/:id/reset-password", async (req, res) => {
  try {
    const users = await db.getAll(SHEETS.USERS);
    const user = users.find((item) => String(item.user_id) === String(req.params.id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const temporaryPassword = req.body.password || `Temp@${Math.random().toString(36).slice(2, 8)}`;

    if (String(temporaryPassword).length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    await db.updateById(SHEETS.USERS, user.user_id, {
      ...user,
      password_hash: await bcrypt.hash(temporaryPassword, 10),
    });

    let delivery = { delivered: false, reason: "Email service unavailable" };
    try {
      delivery = await sendEmail({
        to: user.email,
        subject: "Payroll account password reset",
        html: `<p>Your temporary password is <strong>${temporaryPassword}</strong>.</p><p>Please login and change it immediately.</p>`,
      });
    } catch (emailError) {
      delivery = {
        delivered: false,
        reason: emailError instanceof Error ? emailError.message : "Email send failed",
      };
    }

    if (!delivery.delivered) {
      return res.json({
        message: "Password reset complete, but email could not be delivered",
        temporaryPassword,
        emailDelivered: false,
        emailFailureReason: delivery.reason || "Email service unavailable",
      });
    }

    return res.json({ message: "Password reset complete", emailDelivered: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to reset password" });
  }
});

router.post("/:id/unlock", async (req, res) => {
  try {
    const users = await db.getAll(SHEETS.USERS);
    const user = users.find((item) => String(item.user_id) === String(req.params.id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.updateById(SHEETS.USERS, user.user_id, {
      ...user,
      login_attempt: 0,
    });

    return res.json({
      message: "User account unlocked",
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        active: toBoolean(user.is_active),
        employee_id: user.employee_id || "",
        last_login: user.last_login || "",
        login_attempt: 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to unlock user" });
  }
});

module.exports = router;
