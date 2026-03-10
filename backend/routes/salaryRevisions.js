const express = require("express");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextId } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");
const { maskSalaries } = require("../middleware/maskSalaries");

const router = express.Router();
router.use(authenticate, authorize("admin"), maskSalaries);

function getDaysUntilDate(targetDate) {
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function normalizeScheduleStatuses(schedules) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return schedules.map((item) => {
    if (String(item.status).toLowerCase() === "applied") {
      return item;
    }

    const targetDate = new Date(item.target_date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate < today) {
      return { ...item, status: "completed" };
    }

    return { ...item, status: "upcoming" };
  });
}

function enrichNotifications(notifications, schedules, employees) {
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
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0];

    const reminderCount = Number(notification.reminder_count) || 0;
    const daysUntil = targetSchedule ? getDaysUntilDate(targetSchedule.target_date) : 999;

    return {
      ...notification,
      reminder_count: reminderCount,
      reminder_number: Math.min(reminderCount + 1, 3),
      final_reminder: reminderCount >= 2,
      employee_name: employee
        ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
        : String(notification.employee_id),
      current_salary: Number(employee?.base_salary || 0),
      new_salary: Number(notification.new_salary || 0),
      target_date: targetSchedule?.target_date || "",
      days_until: daysUntil,
    };
  });
}

async function syncSalaryScheduleInternal() {
  const [scheduleRows, notificationRows] = await Promise.all([
    db.getAll(SHEETS.SALARY_SCHEDULE),
    db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS),
  ]);

  const normalizedSchedules = normalizeScheduleStatuses(scheduleRows);

  const hasStatusChanges = normalizedSchedules.some(
    (item, index) => String(item.status || "") !== String(scheduleRows[index]?.status || "")
  );

  if (hasStatusChanges) {
    await db.replaceAll(SHEETS.SALARY_SCHEDULE, normalizedSchedules);
  }

  // Create notifications for schedules within 7 days and not applied
  const toCreate = normalizedSchedules.filter((item) => {
    if (String(item.status).toLowerCase() === "applied") return false;
    const daysUntil = getDaysUntilDate(item.target_date);
    return daysUntil >= 0 && daysUntil <= 7;
  });

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

    const [notifications, schedules, employees] = await Promise.all([
      db.getAll(SHEETS.SALARY_CHANGE_NOTIFICATIONS),
      db.getAll(SHEETS.SALARY_SCHEDULE),
      db.getAll(SHEETS.EMPLOYEES),
    ]);

    const pending = notifications.filter(
      (item) => String(item.status || "pending").toLowerCase() === "pending"
    );

    const enriched = enrichNotifications(pending, schedules, employees)
      .filter((item) => Boolean(item.target_date))
      .sort((a, b) => {
        if (a.final_reminder !== b.final_reminder) {
          return a.final_reminder ? -1 : 1;
        }
        if (a.days_until !== b.days_until) {
          return a.days_until - b.days_until;
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
      .sort((a, b) => String(a.target_date).localeCompare(String(b.target_date)))[0];

    if (!matchingSchedule) {
      return res.status(404).json({ message: "Matching salary schedule not found" });
    }

    await db.updateById(SHEETS.EMPLOYEES, employee.employee_id, {
      ...employee,
      base_salary: Number(notification.new_salary) || 0,
      updated_at: new Date().toISOString(),
    });

    const normalizedSchedules = normalizeScheduleStatuses(schedules).map((item) => {
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
