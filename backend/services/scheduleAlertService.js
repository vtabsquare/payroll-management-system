const db = require("./db");
const { SHEETS } = require("../utils/schema");
const { sendEmail } = require("./emailService");

/**
 * Build a professional HTML email for salary schedule alerts.
 *
 * @param {Object} opts
 * @param {string} opts.employeeName  – full name of the employee
 * @param {string} opts.employeeId    – e.g. "EMP002"
 * @param {string} opts.targetDate    – ISO date string (YYYY-MM-DD)
 * @param {number} opts.salary        – scheduled salary amount
 * @param {number} opts.daysRemaining – 0-3
 * @returns {{ subject: string, html: string }}
 */
function buildAlertEmail({ employeeName, employeeId, targetDate, salary, daysRemaining }) {
  // Format the target date nicely (e.g. "30 April 2026")
  const dateObj = new Date(targetDate + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const formattedSalary = Number(salary).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  });

  // Urgency configuration
  const urgencyConfig = {
    3: {
      subject: `📋 Salary Revision Reminder: 3 Days Remaining — ${employeeName} (${employeeId})`,
      bannerBg: "#dcfce7",
      bannerBorder: "#86efac",
      bannerColor: "#166534",
      bannerIcon: "📋",
      bannerText: "EARLY REMINDER",
      headline: "Salary revision target date is approaching",
      bodyText: `This is a courtesy reminder that the salary revision for <strong>${employeeName}</strong> is scheduled in <strong>3 days</strong>.`,
    },
    2: {
      subject: `⚠️ Salary Revision Reminder: 2 Days Remaining — ${employeeName} (${employeeId})`,
      bannerBg: "#fef9c3",
      bannerBorder: "#fde047",
      bannerColor: "#854d0e",
      bannerIcon: "⚠️",
      bannerText: "FOLLOW-UP REMINDER",
      headline: "Salary revision is due in 2 days",
      bodyText: `The salary revision for <strong>${employeeName}</strong> is now <strong>2 days away</strong>. Please ensure all necessary approvals and actions are in progress.`,
    },
    1: {
      subject: `🔴 URGENT: Salary Revision Due Tomorrow — ${employeeName} (${employeeId})`,
      bannerBg: "#ffedd5",
      bannerBorder: "#fdba74",
      bannerColor: "#9a3412",
      bannerIcon: "🔴",
      bannerText: "URGENT – DUE TOMORROW",
      headline: "Salary revision is due tomorrow",
      bodyText: `The salary revision for <strong>${employeeName}</strong> is due <strong>tomorrow</strong>. Immediate attention is required to ensure timely processing.`,
    },
    0: {
      subject: `🚨 ACTION REQUIRED: Salary Revision Due Today — ${employeeName} (${employeeId})`,
      bannerBg: "#fee2e2",
      bannerBorder: "#fca5a5",
      bannerColor: "#991b1b",
      bannerIcon: "🚨",
      bannerText: "FINAL NOTICE – DUE TODAY",
      headline: "Salary revision is due today",
      bodyText: `The salary revision for <strong>${employeeName}</strong> is <strong>due today</strong>. Please take immediate action to apply the scheduled salary change.`,
    },
  };

  const config = urgencyConfig[daysRemaining] || urgencyConfig[3];

  const daysLabel =
    daysRemaining === 0
      ? "Today"
      : daysRemaining === 1
      ? "Tomorrow"
      : `${daysRemaining} days`;

  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; padding: 24px;">
      <div style="max-width: 600px; margin: 0 auto;">

        <!-- Urgency Banner -->
        <div style="background: ${config.bannerBg}; border: 1px solid ${config.bannerBorder}; border-radius: 10px 10px 0 0; padding: 14px 20px; text-align: center;">
          <strong style="color: ${config.bannerColor}; font-size: 13px; letter-spacing: 1px;">
            ${config.bannerIcon} ${config.bannerText}
          </strong>
        </div>

        <!-- Main Card -->
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; padding: 28px 24px;">

          <h2 style="margin: 0 0 6px; color: #0f172a; font-size: 20px;">
            ${config.headline}
          </h2>
          <p style="margin: 0 0 24px; color: #64748b; font-size: 14px; line-height: 1.6;">
            ${config.bodyText}
          </p>

          <!-- Details Table -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 45%;">Employee</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px;">${employeeName} (${employeeId})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0;">Scheduled Salary</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; border-top: 1px solid #e2e8f0;">${formattedSalary}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0;">Target Date</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-size: 14px; border-top: 1px solid #e2e8f0;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-top: 1px solid #e2e8f0;">Time Remaining</td>
                <td style="padding: 8px 0; font-weight: 700; font-size: 14px; border-top: 1px solid #e2e8f0; color: ${config.bannerColor};">${daysLabel}</td>
              </tr>
            </table>
          </div>

          <!-- Action hint -->
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center; line-height: 1.5;">
            This is an automated reminder from the Payroll Management System.<br/>
            Please log in to the admin panel to take the required action.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 16px;">
          <p style="color: #94a3b8; font-size: 11px; margin: 0;">
            VTab Square Payroll &bull; Automated Alert System
          </p>
        </div>
      </div>
    </div>
  `;

  return { subject: config.subject, html };
}

/**
 * Get today's date string in YYYY-MM-DD format (IST timezone).
 */
function getTodayIST() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, "0");
  const dd = String(istDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculate the number of calendar days between today (IST) and the target date.
 * Returns a positive number if target is in the future, 0 if today, negative if past.
 */
function daysUntil(targetDateStr) {
  const today = getTodayIST();
  const todayMs = new Date(today + "T00:00:00Z").getTime();
  const targetMs = new Date(targetDateStr + "T00:00:00Z").getTime();
  return Math.round((targetMs - todayMs) / (24 * 60 * 60 * 1000));
}

/**
 * Main function: check all upcoming salary schedules and send alerts
 * for entries whose target_date is 0-3 days away.
 */
async function checkAndSendAlerts() {
  const today = getTodayIST();
  console.log(`[ScheduleAlert] Running daily check at ${new Date().toISOString()} (IST date: ${today})`);

  try {
    // 1. Load schedule entries + employees + users (for admin emails)
    const [scheduleRows, employees, users] = await Promise.all([
      db.getAll(SHEETS.SALARY_SCHEDULE),
      db.getAll(SHEETS.EMPLOYEES),
      db.getAll(SHEETS.USERS),
    ]);

    // 2. Build employee name map
    const employeeMap = new Map(
      employees.map((emp) => [
        String(emp.employee_id),
        `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
      ])
    );

    // 3. Get admin emails
    const adminEmails = getAdminEmails(users, employees);
    if (adminEmails.length === 0) {
      console.log("[ScheduleAlert] No admin emails found. Skipping alerts.");
      return { sent: 0, skipped: 0, errors: 0 };
    }

    console.log(`[ScheduleAlert] Admin recipients: ${adminEmails.join(", ")}`);

    // 4. Filter to "upcoming" entries only
    const upcomingEntries = scheduleRows.filter(
      (row) => String(row.status || "").toLowerCase() === "upcoming"
    );

    console.log(`[ScheduleAlert] Found ${upcomingEntries.length} upcoming schedule entries`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    for (const entry of upcomingEntries) {
      const targetDate = String(entry.target_date || "");
      if (!targetDate) {
        skipped++;
        continue;
      }

      const remaining = daysUntil(targetDate);

      // Only send alerts for 0-3 days remaining
      if (remaining < 0 || remaining > 3) {
        skipped++;
        continue;
      }

      // Check if we already sent an alert for this date
      const lastAlertSent = String(entry.last_alert_sent || "");
      if (lastAlertSent === today) {
        console.log(`[ScheduleAlert] Already sent alert today for ${entry.salaryrev_id} (${targetDate}), skipping`);
        skipped++;
        continue;
      }

      const employeeName = employeeMap.get(String(entry.employee_id)) || "Unknown Employee";

      // Build the email
      const emailContent = buildAlertEmail({
        employeeName,
        employeeId: String(entry.employee_id),
        targetDate,
        salary: Number(entry.salary),
        daysRemaining: remaining,
      });

      // Send to all admin emails
      let allSent = true;
      for (const adminEmail of adminEmails) {
        try {
          await sendEmail({
            to: adminEmail,
            subject: emailContent.subject,
            html: emailContent.html,
          });
          console.log(`[ScheduleAlert] ✅ Sent alert to ${adminEmail} for ${employeeName} (${remaining} days remaining)`);
        } catch (emailError) {
          console.error(`[ScheduleAlert] ❌ Failed to send to ${adminEmail}:`, emailError.message);
          allSent = false;
          errors++;
        }
      }

      // Update last_alert_sent to prevent duplicate emails today
      if (allSent) {
        try {
          await db.updateById(SHEETS.SALARY_SCHEDULE, entry.salaryrev_id, {
            ...entry,
            last_alert_sent: today,
          });
        } catch (updateError) {
          console.error(`[ScheduleAlert] Failed to update last_alert_sent for ${entry.salaryrev_id}:`, updateError.message);
        }
        sent++;
      }
    }

    console.log(`[ScheduleAlert] Complete — Sent: ${sent}, Skipped: ${skipped}, Errors: ${errors}`);
    return { sent, skipped, errors };
  } catch (error) {
    console.error("[ScheduleAlert] Fatal error during alert check:", error.message);
    return { sent: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Get admin email addresses from either the env variable or the Users sheet.
 * Priority: ADMIN_ALERT_EMAILS env var > admin users from DB
 */
function getAdminEmails(users, employees) {
  // 1. Check env variable first
  const envEmails = process.env.ADMIN_ALERT_EMAILS;
  if (envEmails) {
    return envEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
  }

  // 2. Fall back to admin users from the Users sheet
  const adminUsers = users.filter(
    (u) => String(u.role || "").toLowerCase() === "admin" && String(u.is_active || "").toLowerCase() !== "false"
  );

  // Map admin users to their emails — prefer company_email from Employees sheet
  const adminEmails = [];
  for (const admin of adminUsers) {
    // Try to find the employee record for their company email
    const emp = employees.find((e) => String(e.employee_id) === String(admin.employee_id));
    const email = emp?.company_email || admin.email;
    if (email) {
      adminEmails.push(email);
    }
  }

  return [...new Set(adminEmails)]; // deduplicate
}

module.exports = {
  checkAndSendAlerts,
  buildAlertEmail,
  getTodayIST,
  daysUntil,
};
