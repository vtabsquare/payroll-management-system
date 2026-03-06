const express = require("express");
const authRoutes = require("./auth");
const employeeRoutes = require("./employees");
const userRoutes = require("./users");
const attendanceRoutes = require("./attendance");
const payrollRoutes = require("./payroll");
const salaryRevisionRoutes = require("./salaryRevisions");
const salaryScheduleRoutes = require("./salarySchedule");
const meRoutes = require("./me");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "payflow-backend" });
});

router.use("/auth", authRoutes);
router.use("/employees", employeeRoutes);
router.use("/users", userRoutes);
router.use("/attendance", attendanceRoutes);
router.use("/payroll", payrollRoutes);
router.use("/salary-revisions", salaryRevisionRoutes);
router.use("/salary-schedule", salaryScheduleRoutes);
router.use("/me", meRoutes);

module.exports = router;
