const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId, nowIso, toBoolean } = require("../utils/helpers");
const { sendEmail } = require("../services/emailService");

const router = express.Router();
const resetStore = new Map();

function signToken(user) {
  return jwt.sign(
    {
      id: user.user_id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id || "",
      can_view_salaries: toBoolean(user.can_view_salaries),
    },
    process.env.JWT_SECRET || "dev_secret_change_me",
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

async function ensureSeedUserPasswords() {
  const users = await db.getAll(SHEETS.USERS);

  for (const user of users) {
    if (user.password_hash) continue;

    const defaultPassword = user.role === "admin" ? "Admin@123" : "Employee@123";
    const password_hash = await bcrypt.hash(defaultPassword, 10);
    await db.updateById(SHEETS.USERS, user.user_id, {
      ...user,
      password_hash,
    });
  }
}

const MAX_LOGIN_ATTEMPTS = 3;

router.post("/login", async (req, res) => {
  try {
    await ensureSeedUserPasswords();

    const { email, password, role } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const users = await db.getAll(SHEETS.USERS);
    const user = users.find((item) => String(item.email).toLowerCase() === String(email).toLowerCase());

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const loginAttempts = Number(user.login_attempt) || 0;

    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      return res.status(403).json({ message: "Account locked due to too many failed login attempts. Please contact admin." });
    }

    if (!toBoolean(user.is_active)) {
      return res.status(403).json({ message: "User is inactive" });
    }

    if (role && String(user.role || "").toLowerCase() !== String(role).toLowerCase()) {
      return res.status(403).json({ message: "Role mismatch" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const newAttempts = loginAttempts + 1;
      await db.updateById(SHEETS.USERS, user.user_id, {
        ...user,
        login_attempt: newAttempts,
      });

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        return res.status(403).json({ message: "Account locked due to too many failed login attempts. Please contact admin." });
      }

      return res.status(401).json({ message: `Invalid credentials. ${MAX_LOGIN_ATTEMPTS - newAttempts} attempt(s) remaining.` });
    }

    await db.updateById(SHEETS.USERS, user.user_id, {
      ...user,
      login_attempt: 0,
      last_login: nowIso(),
    });

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.user_id,
        email: user.email,
        role: user.role,
        employee_id: user.employee_id || "",
        can_view_salaries: toBoolean(user.can_view_salaries),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Login failed" });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body || {};
    const genericMessage = "If an account exists, reset instructions were sent";
    if (!email) {
      return res.status(400).json({ message: "email is required" });
    }

    const users = await db.getAll(SHEETS.USERS);
    const user = users.find((item) => String(item.email).toLowerCase() === String(email).toLowerCase());

    if (!user) {
      return res.json({ message: genericMessage });
    }

    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${token}`;

    let delivery = { delivered: false };
    try {
      delivery = await sendEmail({
        to: user.email,
        subject: "Reset your payroll account password",
        html: `<p>Hello,</p><p>Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 20 minutes.</p>`,
      });
    } catch {
      delivery = { delivered: false };
    }

    if (delivery.delivered) {
      resetStore.set(token, {
        userId: user.user_id,
        expiresAt: Date.now() + 1000 * 60 * 20,
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to start reset" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ message: "token and password are required" });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    const record = resetStore.get(token);
    if (!record || record.expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const users = await db.getAll(SHEETS.USERS);
    const user = users.find((item) => String(item.user_id) === String(record.userId));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await db.updateById(SHEETS.USERS, user.user_id, {
      ...user,
      password_hash,
    });

    resetStore.delete(token);

    return res.json({ message: "Password reset successful" });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Password reset failed" });
  }
});

router.get("/bootstrap-users", async (_req, res) => {
  await ensureSeedUserPasswords();
  const users = await db.getAll(SHEETS.USERS);
  const visible = users.map((user) => ({
    id: user.user_id,
    email: user.email,
    role: user.role,
    active: toBoolean(user.is_active),
    employee_id: user.employee_id || "",
  }));

  if (!visible.find((user) => user.role === "admin")) {
    const all = await db.getAll(SHEETS.USERS);
    const record = {
      user_id: nextId(all.map((item) => ({ id: item.user_id }))),
      email: "admin@company.com",
      role: "admin",
      is_active: true,
      employee_id: "",
      password_hash: await bcrypt.hash("Admin@123", 10),
      created_at: nowIso(),
      last_login: "",
    };
    await db.append(SHEETS.USERS, record);
    visible.push({ id: record.user_id, email: record.email, role: record.role, active: true, employee_id: "" });
  }

  return res.json({ users: visible, note: "Default passwords: Admin@123 / Employee@123" });
});

module.exports = router;
