const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

router.get("/profile", async (req, res) => {
  try {
    const users = await db.getAll(SHEETS.USERS);
    const employees = await db.getAll(SHEETS.EMPLOYEES);

    const user = users.find((item) => String(item.user_id) === String(req.user.id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "admin") {
      return res.json({
        profile: {
          id: user.user_id,
          email: user.email,
          role: user.role,
        },
      });
    }

    const employee =
      employees.find((item) => String(item.employee_id) === String(user.employee_id)) ||
      employees.find((item) => String(item.company_email).toLowerCase() === String(user.email).toLowerCase());
    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    return res.json({ profile: employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load profile" });
  }
});

module.exports = router;
