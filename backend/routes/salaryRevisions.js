const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate, authorize("admin"));

function monthKeyToNumber(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return Number.NaN;
  const [year, month] = String(monthKey).split("-").map(Number);
  return year * 12 + month;
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthKey(date = new Date()) {
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeScheduleStatuses(schedules, currentMonthKey) {
  const currentMonthNum = monthKeyToNumber(currentMonthKey);
  return schedules.map((item) => {
    const start = monthKeyToNumber(item.start_month);
    const end = monthKeyToNumber(item.end_month);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return item;
    }

    if (String(item.status).toLowerCase() === "applied") {
      return item;
    }

    if (start <= currentMonthNum && currentMonthNum <= end) {
      return { ...item, status: "active" };
    }

    if (start > currentMonthNum) {
      return { ...item, status: "upcoming" };
    }

    return { ...item, status: "completed" };
  });
}

function enrichNotifications(notifications, schedules, employees, currentMonthKey) {
  const currentMonthNum = monthKeyToNumber(currentMonthKey);

  return notifications.map((notification) => {
    const employee = employees.find(
      (emp) => String(emp.employee_id) === String(notification.employee_id)
    );

    const targetSchedule = schedules
      .filter(
        (item) =>
          String(item.employee_id) === String(notification.employee_id) &&
          Number(item.salary) === Number(notification.new_salary)
      )
      .sort((a, b) => monthKeyToNumber(a.start_month) - monthKeyToNumber(b.start_month))[0];

    const activeSchedule = schedules.find((item) => {
      const start = monthKeyToNumber(item.start_month);
      const end = monthKeyToNumber(item.end_month);
      return (
        String(item.employee_id) === String(notification.employee_id) &&
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= currentMonthNum &&
        currentMonthNum <= end
      );
    });

    const reminderCount = Number(notification.reminder_count) || 0;

    return {
      ...notification,
      reminder_count: reminderCount,
      reminder_number: Math.min(reminderCount + 1, 3),
      final_reminder: reminderCount >= 2,
      employee_name: employee
        ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
        : String(notification.employee_id),
      current_salary: Number(activeSchedule?.salary || employee?.base_salary || 0),
      new_salary: Number(notification.new_salary || 0),
      effective_month: targetSchedule?.start_month || "",
    };
  });
}

async function syncSalaryScheduleInternal() {
  const currentMonthKey = getMonthKey();
  const nextMonthKey = getNextMonthKey();

  const [scheduleRows, notificationRows] = await Promise.all([
    db.getAll(SHEETS.SALARY_SCHEDULE),
    db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS),
  ]);

  const normalizedSchedules = normalizeScheduleStatuses(scheduleRows, currentMonthKey);

  const hasStatusChanges = normalizedSchedules.some(
    (item, index) => String(item.status || "") !== String(scheduleRows[index]?.status || "")
  );

  if (hasStatusChanges) {
    await db.replaceAll(SHEETS.SALARY_SCHEDULE, normalizedSchedules);
  }

  const toCreate = normalizedSchedules.filter(
    (item) =>
      String(item.start_month) === nextMonthKey &&
      String(item.status).toLowerCase() !== "applied"
  );

  let createdCount = 0;
  const nextNotifications = [...notificationRows];

  for (const schedule of toCreate) {
    const existingPending = nextNotifications.find(
      (notification) =>
        String(notification.employee_id) === String(schedule.employee_id) &&
        Number(notification.new_salary) === Number(schedule.salary) &&
        String(notification.status).toLowerCase() === "pending"
    );

    if (existingPending) {
      continue;
    }

    const notification = {
      notification_id: nextId(nextNotifications.map((item) => ({ id: item.notification_id }))),
      employee_id: String(schedule.employee_id),
      new_salary: Number(schedule.salary) || 0,
      reminder_count: 0,
      status: "pending",
    };

    await db.append(SHEETS.SALARY_CHANGE_NOTIFICATIONS, notification);
    nextNotifications.push(notification);
    createdCount += 1;
  }

  return {
    createdCount,
    scheduleCount: normalizedSchedules.length,
    currentMonthKey,
    nextMonthKey,
  };
}

router.post("/sync", async (_req, res) => {
  try {
    const summary = await syncSalaryScheduleInternal();
    return res.json({
      message: "Salary schedule sync complete",
      ...summary,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to sync salary schedule" });
  }
});

router.get("/notifications", async (_req, res) => {
  try {
    await syncSalaryScheduleInternal();

    const currentMonthKey = getMonthKey();
    const [notifications, schedules, employees] = await Promise.all([
      db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS),
      db.getAll(SHEETS.SALARY_SCHEDULE),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const pending = notifications.filter(
      (item) => String(item.status || "pending").toLowerCase() === "pending"
    );

    const enriched = enrichNotifications(pending, schedules, employees, currentMonthKey)
      .filter((item) => Boolean(item.effective_month))
      .sort((a, b) => {
        if (a.final_reminder !== b.final_reminder) {
          return a.final_reminder ? -1 : 1;
        }
        return (b.reminder_count || 0) - (a.reminder_count || 0);
      });

    return res.json({ notifications: enriched });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load notifications" });
  }
});

router.post("/notifications/:id/ignore", async (req, res) => {
  try {
    const notifications = await db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS);
    const current = notifications.find(
      (item) => String(item.notification_id) === String(req.params.id)
    );

    if (!current) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (String(current.status).toLowerCase() !== "pending") {
      return res.status(400).json({ message: "Notification is not pending" });
    }

    const updated = await db.updateById(SHEETS.SALARY_CHANGE_NOTIFICATIONS, req.params.id, {
      ...current,
      reminder_count: (Number(current.reminder_count) || 0) + 1,
      status: "pending",
    });

    return res.json({ notification: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to ignore notification" });
  }
});

router.post("/notifications/:id/apply", async (req, res) => {
  try {
    const [notifications, schedules, employees] = await Promise.all([
      db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS),
      db.getAll(SHEETS.SALARY_SCHEDULE),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const notification = notifications.find(
      (item) => String(item.notification_id) === String(req.params.id)
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (String(notification.status).toLowerCase() !== "pending") {
      return res.status(400).json({ message: "Notification is not pending" });
    }

    const employee = employees.find(
      (item) => String(item.employee_id) === String(notification.employee_id)
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const matchingSchedule = schedules
      .filter(
        (item) =>
          String(item.employee_id) === String(notification.employee_id) &&
          Number(item.salary) === Number(notification.new_salary)
      )
      .sort((a, b) => monthKeyToNumber(a.start_month) - monthKeyToNumber(b.start_month))[0];

    if (!matchingSchedule) {
      return res.status(404).json({ message: "Matching salary schedule not found" });
    }

    await db.updateById(SHEETS.EMPLOYEES, employee.employee_id, {
      ...employee,
      base_salary: Number(notification.new_salary) || 0,
      updated_at: new Date().toISOString(),
    });

    const currentMonthKey = getMonthKey();
    const normalizedSchedules = normalizeScheduleStatuses(schedules, currentMonthKey).map((item) => {
      if (String(item.salaryrev_id) === String(matchingSchedule.salaryrev_id)) {
        return { ...item, status: "applied" };
      }
      return item;
    });

    await db.replaceAll(SHEETS.SALARY_SCHEDULE, normalizedSchedules);

    const updatedNotification = await db.updateById(SHEETS.SALARY_CHANGE_NOTIFICATIONS, req.params.id, {
      ...notification,
      status: "applied",
    });

    return res.json({
      message: "Salary updated successfully",
      notification: updatedNotification,
      employee_id: employee.employee_id,
      base_salary: Number(notification.new_salary) || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to apply salary revision" });
  }
});

module.exports = router;
