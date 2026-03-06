const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

// Company branding colors
const COLORS = {
  darkBlue: "#0d2137",
  white: "#ffffff",
  lightGray: "#f4f7fb",
  textDark: "#111827",
  textMuted: "#6b7280",
  green: "#22c55e",
  greenBg: "#ecfdf5",
  greenBorder: "#a7f3d0",
  greenText: "#065f46",
  orange: "#f97316",
  red: "#ef4444",
  blue: "#3b82f6",
};

// Month names for display
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Generate a 3-page payslip PDF matching the offer letter template design
 * @param {Object} payrollRecord - The payroll record data
 * @param {Object} employee - The employee data
 * @returns {Promise<Buffer>} - PDF as buffer
 */
async function generatePayslipPDF(payrollRecord, employee) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        bufferPages: true,
      });

      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const monthName = MONTH_NAMES[(payrollRecord.month || 1) - 1] || "Unknown";
      const year = payrollRecord.year || new Date().getFullYear();

      // ========== PAGE 1: Cover Page ==========
      drawCoverPage(doc, monthName, year);

      // ========== PAGE 2: Payslip Details ==========
      doc.addPage();
      drawPayslipPage(doc, payrollRecord, employee, monthName, year);

      // ========== PAGE 3: Contact Us ==========
      doc.addPage();
      drawContactPage(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Draw the cover page (Page 1)
 */
function drawCoverPage(doc, monthName, year) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Dark blue background
  doc.rect(0, 0, pageWidth, pageHeight - 80).fill(COLORS.darkBlue);

  // Header - Company info (top left)
  doc.fillColor(COLORS.white).fontSize(10);
  doc.text("www.sirocotech.com", 40, 40);
  doc.text("sales@sirocotech.com", 40, 55);
  doc.text("US: (844) 708-0008", 40, 70);
  doc.text("IND: (996) 258-7975", 40, 85);

  // Top right - VTAB Square logo
  const logoSize = 50;
  const logoX = pageWidth - 100;
  const logoY = 30;
  const logoPath = path.join(__dirname, "../../public/companylogo.jpeg");
  
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
    } else {
      // Fallback to placeholder box
      doc.rect(logoX, logoY, logoSize, logoSize).stroke(COLORS.white);
      doc.fontSize(6).fillColor(COLORS.white);
      doc.text("VTAB", logoX, logoY + 18, { width: logoSize, align: "center" });
      doc.text("SQUARE", logoX, logoY + 23, { width: logoSize, align: "center" });
    }
  } catch (err) {
    console.error("[PDF] Logo load error:", err);
    // Fallback to placeholder
    doc.rect(logoX, logoY, logoSize, logoSize).stroke(COLORS.white);
    doc.fontSize(6).fillColor(COLORS.white);
    doc.text("VTAB", logoX, logoY + 18, { width: logoSize, align: "center" });
    doc.text("SQUARE", logoX, logoY + 23, { width: logoSize, align: "center" });
  }

  // "NOW PART OF" text (below logo)
  doc.fontSize(7).fillColor(COLORS.white);
  doc.text("NOW PART OF", logoX - 10, logoY + logoSize + 8, { width: logoSize + 20, align: "center" });

  // SIROCO branding (properly aligned)
  const sirocoY = logoY + logoSize + 25;
  doc.fontSize(16).fillColor(COLORS.white).font("Helvetica-Bold");
  doc.text("SIROCo", logoX - 10, sirocoY, { width: logoSize + 20, align: "center" });
  
  doc.fontSize(6).font("Helvetica").fillColor("#a0aec0");
  doc.text("Technology for", logoX - 10, sirocoY + 18, { width: logoSize + 20, align: "center" });
  doc.text("Smarter Life", logoX - 10, sirocoY + 26, { width: logoSize + 20, align: "center" });

  // Center content - "Prepared for" text
  const centerY = pageHeight / 2 - 20;
  doc.fontSize(16).fillColor(COLORS.white);
  doc.text("Prepared for", 0, centerY, { width: pageWidth, align: "center" });
  
  doc.fontSize(12).fillColor("#a0aec0");
  doc.text(`Payslip for ${monthName} ${year}`, 0, centerY + 25, { width: pageWidth, align: "center" });

  // Footer - Statement of Confidentiality (light gray section)
  const footerY = pageHeight - 80;
  doc.rect(0, footerY, pageWidth, 80).fill(COLORS.lightGray);

  doc.fillColor(COLORS.textDark).fontSize(10).font("Helvetica-Bold");
  doc.text("Statement of Confidentiality", 40, footerY + 15);

  doc.font("Helvetica").fontSize(8).fillColor(COLORS.textMuted);
  const confidentialityText = "This payslip has been distributed on a confidential basis for your information only. By accepting it, you agree not to disseminate it to any other person or entity in any manner and not to use the information for any purpose other than personal record keeping.";
  doc.text(confidentialityText, 40, footerY + 32, { width: pageWidth - 80, lineGap: 2 });
}

/**
 * Draw the payslip details page (Page 2)
 */
function drawPayslipPage(doc, payrollRecord, employee, monthName, year) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;

  // Header bar (dark blue)
  doc.rect(0, 0, pageWidth, 110).fill(COLORS.darkBlue);

  // Header - Company info (top left)
  doc.fillColor(COLORS.white).fontSize(10);
  doc.text("www.sirocotech.com", margin, 25);
  doc.text("sales@sirocotech.com", margin, 40);
  doc.text("US: (844) 708-0008", margin, 55);
  doc.text("IND: (996) 258-7975", margin, 70);

  // Top right - VTAB Square logo
  const logoSize = 45;
  const logoX = pageWidth - 95;
  const logoY = 25;
  const logoPath = path.join(__dirname, "../../public/companylogo.jpeg");
  
  try {
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, logoX, logoY, { width: logoSize, height: logoSize });
    } else {
      // Fallback to placeholder
      doc.rect(logoX, logoY, logoSize, logoSize).stroke(COLORS.white);
      doc.fontSize(6).fillColor(COLORS.white);
      doc.text("VTAB", logoX, logoY + 16, { width: logoSize, align: "center" });
      doc.text("SQUARE", logoX, logoY + 23, { width: logoSize, align: "center" });
    }
  } catch (err) {
    console.error("[PDF] Logo load error:", err);
    // Fallback to placeholder
    doc.rect(logoX, logoY, logoSize, logoSize).stroke(COLORS.white);
    doc.fontSize(6).fillColor(COLORS.white);
    doc.text("VTAB", logoX, logoY + 16, { width: logoSize, align: "center" });
    doc.text("SQUARE", logoX, logoY + 23, { width: logoSize, align: "center" });
  }

  // "NOW PART OF" and SIROCO branding
  const sirocoY = logoY + logoSize + 6;
  doc.fontSize(6).fillColor(COLORS.white);
  doc.text("NOW PART OF", logoX - 5, sirocoY, { width: logoSize + 10, align: "center" });
  
  doc.fontSize(14).font("Helvetica-Bold");
  doc.text("SIROCo", logoX - 5, sirocoY + 12, { width: logoSize + 10, align: "center" });
  
  doc.fontSize(5).font("Helvetica").fillColor("#a0aec0");
  doc.text("Technology for Smarter Life", logoX - 5, sirocoY + 26, { width: logoSize + 10, align: "center" });

  // Content area
  let y = 130;

  // Title
  doc.fillColor("#22c55e").fontSize(16).font("Helvetica-Bold");
  doc.text("Payslip Statement", margin, y);
  y += 35;

  // Date
  doc.fillColor(COLORS.textDark).fontSize(10).font("Helvetica-Bold");
  const currentDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  doc.text(`Date: ${currentDate}`, margin, y);
  y += 25;

  // Employee details
  doc.font("Helvetica");
  const employeeName = `${employee.first_name || ""} ${employee.last_name || ""}`.trim();
  doc.text(`To ${employeeName},`, margin, y);
  y += 15;
  
  if (employee.company_email) {
    doc.fontSize(9).fillColor(COLORS.textMuted);
    doc.text(employee.company_email, margin, y);
    y += 15;
  }

  // Employee ID
  doc.fontSize(10).fillColor(COLORS.textDark);
  doc.text(`Employee ID: ${employee.employee_id || payrollRecord.employee_id}`, margin, y);
  y += 30;

  // Subject line
  doc.fillColor("#22c55e").font("Helvetica-Bold");
  doc.text(`Subject: Payslip for ${monthName} ${year}`, margin, y);
  y += 30;

  // Greeting
  doc.fillColor(COLORS.textDark).font("Helvetica");
  doc.text(`Dear ${employeeName},`, margin, y);
  y += 20;

  // Intro text
  doc.fontSize(10);
  doc.text(`Please find below your salary details for the month of ${monthName} ${year}.`, margin, y, { width: pageWidth - margin * 2 });
  y += 35;

  // Salary breakdown table
  const tableX = margin;
  const tableWidth = pageWidth - margin * 2;
  const col1Width = tableWidth * 0.6;
  const col2Width = tableWidth * 0.4;

  // Table header
  doc.rect(tableX, y, tableWidth, 25).fill("#f3f4f6");
  doc.fillColor(COLORS.textDark).font("Helvetica-Bold").fontSize(10);
  doc.text("Component", tableX + 10, y + 8);
  doc.text("Amount (₹)", tableX + col1Width + 10, y + 8);
  y += 25;

  // Table rows
  const basic = Number(payrollRecord.basic_salary) || 0;
  const hra = Number(payrollRecord.hra) || 0;
  const other = Number(payrollRecord.other_allowance) || 0;
  const special = Number(payrollRecord.special_pay) || 0;
  const incentivePayout = Number(payrollRecord.incentive_payout) || 0;
  const incentiveDeduction = Number(payrollRecord.incentive_deduction) || 0;
  const gross = Number(payrollRecord.gross_salary) || 0;
  const net = Number(payrollRecord.net_salary) || 0;

  const rows = [
    { label: "Basic Salary", value: basic.toFixed(2) },
    { label: "HRA", value: hra.toFixed(2) },
    { label: "Other Allowance", value: other.toFixed(2) },
    { label: "Special Pay", value: special.toFixed(2) },
    { label: "Incentive Payout", value: incentivePayout.toFixed(2) },
    { label: "Incentive Deduction", value: `-${incentiveDeduction.toFixed(2)}`, isDeduction: true },
  ];

  doc.font("Helvetica").fontSize(10);
  rows.forEach((row, index) => {
    const bgColor = index % 2 === 0 ? COLORS.white : "#fafafa";
    doc.rect(tableX, y, tableWidth, 22).fill(bgColor);
    doc.fillColor(COLORS.textMuted).text(row.label, tableX + 10, y + 6);
    doc.fillColor(row.isDeduction ? COLORS.red : COLORS.textDark);
    doc.text(row.value, tableX + col1Width + 10, y + 6);
    y += 22;
  });

  // Gross salary row
  doc.rect(tableX, y, tableWidth, 28).fill(COLORS.greenBg);
  doc.rect(tableX, y, tableWidth, 28).stroke(COLORS.greenBorder);
  doc.fillColor(COLORS.greenText).font("Helvetica-Bold").fontSize(11);
  doc.text("Gross Salary", tableX + 10, y + 8);
  doc.text(`₹${gross.toFixed(2)}`, tableX + col1Width + 10, y + 8);
  y += 28;

  // Net salary row
  doc.rect(tableX, y, tableWidth, 32).fill(COLORS.darkBlue);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(12);
  doc.text("Net Pay", tableX + 10, y + 10);
  doc.text(`₹${net.toFixed(2)}`, tableX + col1Width + 10, y + 10);
  y += 45;

  // Working days info
  doc.fillColor(COLORS.textMuted).font("Helvetica").fontSize(9);
  doc.text(`Working Days: ${payrollRecord.working_days || 0} | Paid Days: ${payrollRecord.paid_days || 0}`, margin, y);
  y += 30;

  // Closing text
  doc.fillColor(COLORS.textDark).fontSize(10);
  doc.text("Should you require any additional information or documentation, please feel free to contact the HR department.", margin, y, { width: pageWidth - margin * 2 });
  y += 35;

  // Signature section
  doc.fontSize(10).font("Helvetica").fillColor(COLORS.textDark);
  doc.text("Sincerely,", margin, y);
  y += 30;

  // Signature image
  const signaturePath = path.join(__dirname, "../../public/signature.png");
  try {
    if (fs.existsSync(signaturePath)) {
      doc.image(signaturePath, margin, y, { width: 120, height: 40 });
      y += 45;
    } else {
      // Fallback to text placeholder
      doc.fontSize(16).font("Helvetica-Oblique").fillColor(COLORS.textMuted);
      doc.text("[Signature]", margin, y);
      y += 30;
    }
  } catch (err) {
    console.error("[PDF] Signature load error:", err);
    // Fallback to text placeholder
    doc.fontSize(16).font("Helvetica-Oblique").fillColor(COLORS.textMuted);
    doc.text("[Signature]", margin, y);
    y += 30;
  }

  // Signature line
  doc.moveTo(margin, y).lineTo(margin + 200, y).stroke(COLORS.textMuted);
  y += 15;

  // Signatory details
  doc.font("Helvetica").fontSize(9).fillColor(COLORS.textDark);
  doc.text("[Authorized Signatory Name]", margin, y);
  y += 14;
  doc.text("Director", margin, y);
  y += 14;
  doc.text("VTAB Square Pvt Ltd", margin, y);

  // Footer bar
  doc.rect(0, pageHeight - 30, pageWidth, 30).fill(COLORS.darkBlue);
  doc.fillColor(COLORS.white).fontSize(8);
  doc.text("SIROCo", 40, pageHeight - 20);
  doc.text("Technology for Smarter Life", 100, pageHeight - 20);
  doc.text("2", pageWidth - 50, pageHeight - 20);
}

/**
 * Draw the contact page (Page 3)
 */
function drawContactPage(doc) {
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const margin = 40;

  let y = 50;

  // Title
  doc.fillColor(COLORS.darkBlue).fontSize(18).font("Helvetica-Bold");
  doc.text("Contact Us", margin, y);
  y += 40;

  // USA Section
  drawContactSection(doc, y, "USA", COLORS.orange, [
    {
      title: "Corporate Office",
      lines: ["6800 Weiskopf Avenue,", "Suite 150 McKinney,", "TX 75070 USA", "", "Phone: (844) 708-0008", "", "Email: sales@sirocollc.com"],
    },
    {
      title: "Regional Offices",
      lines: ["Atlanta", "Houston", "Jacksonville", "San Diego", "Orland Park"],
    },
  ]);
  y += 160;

  // India Section
  drawContactSection(doc, y, "India", COLORS.green, [
    {
      title: "Development Innovation Center",
      lines: ["Module 12, Thejaswini Building,", "Technopark, Kovalam, 695581", "Kerala, INDIA", "", "Phone: +91 80868 00199", "", "Email: info@sirocotech.com"],
    },
    {
      title: "IT DEVELOPMENT CENTER",
      lines: ["17/99, 5th Street 2nd Floor, Iyappan Nagar,", "Vijayalakshmi Mills, Kuniamuthur,", "Main Road, Coimbatore 641008, Tamil", "Nadu, India", "", "Mail id: information@vtabSquare.com"],
    },
  ]);
  y += 180;

  // MENA Section
  drawContactSection(doc, y, "MENA", COLORS.red, [
    {
      title: "Regional Office",
      lines: ["Amman, Jordan", "", "Phone: +962 65373421", "", "Email: sales@sirocomena.com"],
    },
  ]);

  // Footer bar
  doc.rect(0, pageHeight - 30, pageWidth, 30).fill(COLORS.darkBlue);
  doc.fillColor(COLORS.white).fontSize(8);
  doc.text("SIROCo", 40, pageHeight - 20);
  doc.text("Technology for Smarter Life", 100, pageHeight - 20);
  doc.text("3", pageWidth - 50, pageHeight - 20);
}

/**
 * Draw a contact section with colored header
 */
function drawContactSection(doc, startY, title, headerColor, columns) {
  const pageWidth = doc.page.width;
  const margin = 40;
  const sectionWidth = pageWidth - margin * 2;

  // Section border
  doc.rect(margin, startY, sectionWidth, 140).stroke("#e5e7eb");

  // Header bar
  doc.rect(margin, startY, sectionWidth, 25).fill(headerColor);
  doc.fillColor(COLORS.white).fontSize(12).font("Helvetica-Bold");
  doc.text(title, 0, startY + 7, { width: pageWidth, align: "center" });

  // Columns
  const colWidth = sectionWidth / columns.length;
  columns.forEach((col, index) => {
    const colX = margin + index * colWidth + 15;
    let colY = startY + 35;

    doc.fillColor(COLORS.blue).fontSize(10).font("Helvetica-Bold");
    doc.text(col.title, colX, colY, { width: colWidth - 30 });
    colY += 18;

    doc.fillColor(COLORS.textDark).fontSize(9).font("Helvetica");
    col.lines.forEach((line) => {
      if (line.startsWith("Email:") || line.startsWith("Mail id:")) {
        doc.fillColor(COLORS.blue);
      } else {
        doc.fillColor(COLORS.textDark);
      }
      doc.text(line, colX, colY, { width: colWidth - 30 });
      colY += 11;
    });
  });
}

module.exports = {
  generatePayslipPDF,
};
