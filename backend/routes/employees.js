const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../services/db");
const { SHEETS } = require("../utils/schema");
const { nextEmpId, nextId, nowIso } = require("../utils/helpers");
const { authenticate, authorize } = require("../middleware/auth");
const { maskSalaries } = require("../middleware/maskSalaries");

const router = express.Router();

function parseCSVLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

router.use(authenticate, authorize("admin"), maskSalaries);

function validateEmployee(body) {
  const required = ["first_name", "last_name", "company_email", "designation"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length > 0) {
    return `Missing fields: ${missing.join(", ")}`;
  }
  return null;
}

router.get("/", async (req, res) => {
  try {
    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const q = String(req.query.q || "").toLowerCase();

    const filtered = q
      ? rows.filter((row) =>
          [
            row.first_name,
            row.last_name,
            row.employee_id,
            row.designation,
            row.company_email,
            row.phone,
          ].some((field) =>
            String(field || "").toLowerCase().includes(q)
          )
        )
      : rows;

    return res.json({ employees: filtered });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load employees" });
  }
});

router.post("/", async (req, res) => {
  try {
    const error = validateEmployee(req.body || {});
    if (error) {
      return res.status(400).json({ message: error });
    }

    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const employeeId = nextEmpId(rows, "employee_id");
    const companyEmail = String(req.body.company_email || "").trim().toLowerCase();
    
    const employee = {
      employee_id: employeeId,
      first_name: String(req.body.first_name || "").trim(),
      last_name: String(req.body.last_name || "").trim(),
      company_email: companyEmail,
      phone: String(req.body.phone || "").trim(),
      designation: String(req.body.designation || "").trim(),
      employee_type: String(req.body.employee_type || "").trim(),
      date_of_joining: String(req.body.date_of_joining || new Date().toISOString().slice(0, 10)),
      date_of_birth: String(req.body.date_of_birth || ""),
      gender: String(req.body.gender || ""),
      aadhaar_number: String(req.body.aadhaar_number || ""),
      pan_number: String(req.body.pan_number || ""),
      pf_number: String(req.body.pf_number || ""),
      bank_name: String(req.body.bank_name || ""),
      account_number: String(req.body.account_number || ""),
      ifsc_code: String(req.body.ifsc_code || ""),
      status: String(req.body.status || "").toLowerCase() === "inactive" ? "inactive" : "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    await db.append(SHEETS.EMPLOYEES, employee);

    // Automatically create user account for the employee
    let userCreated = false;
    let temporaryPassword = null;
    let userCreationError = null;

    try {
      const users = await db.getAll(SHEETS.USERS);
      const userExists = users.some((user) => String(user.email).toLowerCase() === companyEmail);

      if (!userExists) {
        temporaryPassword = `Emp@${Math.random().toString(36).slice(2, 10)}`;
        const user = {
          user_id: nextId(users.map((item) => ({ id: item.user_id }))),
          employee_id: employeeId,
          email: companyEmail,
          role: "employee",
          is_active: true,
          can_view_salaries: false,
          password_hash: await bcrypt.hash(temporaryPassword, 10),
          created_at: nowIso(),
          last_login: "",
          login_attempt: 0,
        };

        await db.append(SHEETS.USERS, user);
        userCreated = true;
      }
    } catch (userError) {
      userCreationError = userError.message || "Failed to create user account";
    }

    return res.status(201).json({
      employee,
      userCreated,
      temporaryPassword,
      userCreationError,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add employee" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const existingRows = await db.getAll(SHEETS.EMPLOYEES);
    const existing = existingRows.find((row) => String(row.employee_id) === String(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const updates = {
      ...existing,
      ...req.body,
      company_email:
        req.body.company_email === undefined
          ? existing.company_email
          : String(req.body.company_email || "").trim().toLowerCase(),
      updated_at: nowIso(),
    };

    const employee = await db.updateById(SHEETS.EMPLOYEES, req.params.id, updates);
    return res.json({ employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update employee" });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const rows = await db.getAll(SHEETS.EMPLOYEES);
    const existing = rows.find((row) => String(row.employee_id) === String(req.params.id));
    if (!existing) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const status = req.body.status === "inactive" ? "inactive" : "active";
    const employee = await db.updateById(SHEETS.EMPLOYEES, req.params.id, {
      ...existing,
      status,
      updated_at: nowIso(),
    });

    return res.json({ employee });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to update status" });
  }
});

router.post("/sync-sharepoint", async (req, res) => {
  try {
    const {
      MS_GRAPH_TENANT_ID,
      MS_GRAPH_CLIENT_ID,
      MS_GRAPH_CLIENT_SECRET,
      SHAREPOINT_CSV_URL,
    } = process.env;

    if (!MS_GRAPH_TENANT_ID || !MS_GRAPH_CLIENT_ID || !MS_GRAPH_CLIENT_SECRET || !SHAREPOINT_CSV_URL) {
      return res.status(400).json({ message: "SharePoint sync is not configured in .env" });
    }

    // 1. Get Access Token
    const tokenParams = new URLSearchParams({
      client_id: MS_GRAPH_CLIENT_ID,
      scope: "https://graph.microsoft.com/.default",
      client_secret: MS_GRAPH_CLIENT_SECRET,
      grant_type: "client_credentials",
    });

    const tokenResponse = await fetch(`https://login.microsoftonline.com/${MS_GRAPH_TENANT_ID}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errTxt = await tokenResponse.text();
      throw new Error(`Failed to get Graph token: ${errTxt}`);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch CSV from Sharing URL
    // Format sharing URL for Graph API: https://learn.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0
    const base64Value = Buffer.from(SHAREPOINT_CSV_URL).toString("base64");
    const encodedUrl = "u!" + base64Value.replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");

    const csvResponse = await fetch(`https://graph.microsoft.com/v1.0/shares/${encodedUrl}/driveItem/content`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!csvResponse.ok) {
      const errTxt = await csvResponse.text();
      throw new Error(`Failed to fetch CSV from SharePoint: ${errTxt}`);
    }
    const csvText = await csvResponse.text();

    // 3. Parse CSV
    const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      return res.status(400).json({ message: "CSV file is empty or has no data rows" });
    }

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase());
    let empIdIndex = headers.indexOf("empid");
    if (empIdIndex === -1) empIdIndex = headers.indexOf("crc6f_empid");
    if (empIdIndex === -1) empIdIndex = headers.indexOf("crc6f_employeeid");
    if (empIdIndex === -1) empIdIndex = headers.indexOf("employeeid");
    
    let activeFlagIndex = headers.indexOf("crc6f_activeflag");
    if (activeFlagIndex === -1) activeFlagIndex = headers.indexOf("activeflag");

    if (empIdIndex === -1 || activeFlagIndex === -1) {
      return res.status(400).json({ message: `CSV missing 'empid'/'crc6f_empid' or 'crc6f_activeflag' columns. Headers: ${headers.join(", ")}` });
    }

    const sharepointStatuses = new Map();
    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const empId = row[empIdIndex]?.toLowerCase();
      const activeFlag = row[activeFlagIndex]?.toLowerCase();
      if (empId) {
        sharepointStatuses.set(empId, activeFlag === "true" || activeFlag === "1" || activeFlag === "yes" || activeFlag === "active" ? "active" : "inactive");
      }
    }

    // 4. Update Database
    const employees = await db.getAll(SHEETS.EMPLOYEES);
    let updatedCount = 0;

    for (const emp of employees) {
      const dbEmpId = String(emp.employee_id || "").trim().toLowerCase();
      const spStatus = sharepointStatuses.get(dbEmpId);
      if (spStatus && String(emp.status).toLowerCase() !== spStatus) {
        await db.updateById(SHEETS.EMPLOYEES, emp.employee_id, {
          ...emp,
          status: spStatus,
          updated_at: nowIso(),
        });
        updatedCount++;
      }
    }

    return res.json({ message: "Sync successful", updatedCount });
  } catch (error) {
    console.error("[SharePoint Sync Error]", error);
    return res.status(500).json({ message: error.message || "Failed to sync with SharePoint" });
  }
});

module.exports = router;
