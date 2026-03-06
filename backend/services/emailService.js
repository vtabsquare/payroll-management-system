function buildPayslipEmail(record) {
  const basic = Number(record.basic_salary) || 0;
  const hra = Number(record.hra) || 0;
  const other = Number(record.other_allowance) || 0;
  const special = Number(record.special_pay) || 0;
  const incentivePayout = Number(record.incentive_payout) || 0;
  const incentiveDeduction = Number(record.incentive_deduction) || 0;
  const gross = Number(record.gross_salary) || 0;
  const net = Number(record.net_salary) || 0;

  return {
    subject: `Payslip for ${record.month}/${record.year}`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f4f7fb; padding: 24px;">
        <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
          <h2 style="margin: 0 0 8px; color: #111827;">Payroll Payslip</h2>
          <p style="margin: 0 0 20px; color: #4b5563;">${record.employee_name} (${record.employee_id})</p>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr><td style="padding: 8px 0; color: #6b7280;">Basic</td><td style="text-align:right; font-weight: 600;">₹${basic.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">HRA</td><td style="text-align:right; font-weight: 600;">₹${hra.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Other Allowance</td><td style="text-align:right; font-weight: 600;">₹${other.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Special Pay</td><td style="text-align:right; font-weight: 600;">₹${special.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Incentive Payout</td><td style="text-align:right; font-weight: 600;">₹${incentivePayout.toFixed(2)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;">Incentive Deduction</td><td style="text-align:right; font-weight: 600;">-₹${incentiveDeduction.toFixed(2)}</td></tr>
          </table>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;">
            <strong style="display:flex; justify-content: space-between; color:#065f46;">
              <span>Gross</span><span>₹${gross.toFixed(2)}</span>
            </strong>
          </div>
          <div style="background: #1f2937; border-radius: 10px; padding: 14px; color: #fff;">
            <strong style="display:flex; justify-content: space-between; font-size: 16px;">
              <span>Net Pay</span><span>₹${net.toFixed(2)}</span>
            </strong>
          </div>
        </div>
      </div>
    `,
  };
}

/**
 * Send email via Brevo API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {Object} [options.attachment] - Optional PDF attachment
 * @param {Buffer} [options.attachment.content] - PDF buffer
 * @param {string} [options.attachment.name] - Filename
 */
async function sendEmail({ to, subject, html, attachment }) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_FROM_NAME || process.env.BREVO_SENDER_NAME || "Payroll";

  console.log("[Email] Attempting to send email to:", to);
  console.log("[Email] Sender:", senderEmail, "Name:", senderName);
  console.log("[Email] API Key configured:", apiKey ? "Yes (length: " + apiKey.length + ")" : "No");
  console.log("[Email] Has attachment:", attachment ? "Yes" : "No");

  if (!apiKey || !senderEmail) {
    console.log("[Email] ERROR: Brevo credentials not configured");
    return { delivered: false, reason: "Brevo credentials not configured" };
  }

  const payload = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  };

  // Add attachment if provided
  if (attachment && attachment.content && attachment.name) {
    payload.attachment = [
      {
        content: attachment.content.toString("base64"),
        name: attachment.name,
      },
    ];
    console.log("[Email] Attachment added:", attachment.name, "Size:", attachment.content.length, "bytes");
  }

  console.log("[Email] Sending request to Brevo API...");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  console.log("[Email] Brevo response status:", response.status);
  console.log("[Email] Brevo response body:", responseText);

  if (!response.ok) {
    throw new Error(`Brevo request failed: ${response.status} ${responseText}`);
  }

  console.log("[Email] Email sent successfully!");
  return { delivered: true };
}

module.exports = {
  sendEmail,
  buildPayslipEmail,
};
