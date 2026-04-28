const cron = require("node-cron");
const { checkAndSendAlerts } = require("./scheduleAlertService");

/**
 * Start the salary schedule alert cron job.
 * Runs every day at 9:00 AM IST (03:30 UTC) to check for upcoming
 * salary revision target dates and send reminder emails to admins.
 *
 * Alert schedule:
 *   D-3  →  Early reminder
 *   D-2  →  Follow-up reminder
 *   D-1  →  Urgent reminder
 *   D-0  →  Final notice (due today)
 */
function startScheduleAlertCron() {
  // 9:00 AM IST = 03:30 UTC → cron: "30 3 * * *"
  const cronExpression = "30 3 * * *";

  const task = cron.schedule(cronExpression, async () => {
    console.log("[Cron] Salary schedule alert job triggered");
    try {
      const result = await checkAndSendAlerts();
      console.log("[Cron] Alert job finished:", JSON.stringify(result));
    } catch (error) {
      console.error("[Cron] Alert job failed:", error.message);
    }
  }, {
    timezone: "UTC",
  });

  console.log("[Cron] Salary schedule alert cron registered (daily at 9:00 AM IST / 03:30 UTC)");

  return task;
}

module.exports = { startScheduleAlertCron };
