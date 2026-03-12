const { google } = require("googleapis");
const { SHEETS, SHEET_HEADERS } = require("../utils/schema");
const seed = require("../utils/seedData");

function normalizeValue(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function parseCell(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

function columnLetter(index) {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const mod = (n - 1) % 26;
    result = String.fromCharCode(65 + mod) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

class SheetsService {
  constructor() {
    this.sheetId = process.env.GOOGLE_SHEET_ID;
    this.clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    this.privateKey = process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : "";

    this.useGoogleSheets = Boolean(this.sheetId && this.clientEmail && this.privateKey);
    this.allowMemoryFallback =
      String(process.env.ALLOW_MEMORY_FALLBACK || "").toLowerCase() === "true";

    this.memoryStore = {
      [SHEETS.EMPLOYEES]: [...seed.employees],
      [SHEETS.USERS]: [...seed.users],
      [SHEETS.PAYROLL]: [...seed.payroll],
      [SHEETS.ATTENDANCE_RECORDS]: [...(seed.attendanceRecords || [])],
      [SHEETS.INCENTIVE_LEDGER]: [...(seed.incentiveLedger || [])],
      [SHEETS.SALARY_SCHEDULE]: [...(seed.salarySchedule || [])],
      [SHEETS.SALARY_CHANGE_NOTIFICATIONS]: [...(seed.salaryChangeNotifications || [])],
    };

    this.sheetsApi = null;
    if (this.useGoogleSheets) {
      const auth = new google.auth.JWT({
        email: this.clientEmail,
        key: this.privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      this.sheetsApi = google.sheets({ version: "v4", auth });
    }
  }

  getPrimaryKey(sheetName) {
    if (sheetName === SHEETS.EMPLOYEES) return "employee_id";
    if (sheetName === SHEETS.USERS) return "user_id";
    if (sheetName === SHEETS.PAYROLL) return "payroll_id";
    if (sheetName === SHEETS.ATTENDANCE_RECORDS) return "attendance_id";
    if (sheetName === SHEETS.INCENTIVE_LEDGER) return "ledger_id";
    if (sheetName === SHEETS.SALARY_SCHEDULE) return "salaryrev_id";
    if (sheetName === SHEETS.SALARY_CHANGE_NOTIFICATIONS) return "notification_id";
    return "id";
  }

  ensureAvailable() {
    if (this.useGoogleSheets) return;
    if (this.allowMemoryFallback) return;
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY (or set ALLOW_MEMORY_FALLBACK=true for development)."
    );
  }

  async ensureHeaders(sheetName) {
    if (!this.useGoogleSheets) return;

    const headerRange = `${sheetName}!1:1`;
    const result = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range: headerRange,
    });

    const current = result.data.values?.[0] || [];
    const expected = SHEET_HEADERS[sheetName];

    if (current.length === 0) {
      await this.sheetsApi.spreadsheets.values.update({
        spreadsheetId: this.sheetId,
        range: headerRange,
        valueInputOption: "RAW",
        requestBody: { values: [expected] },
      });
      return;
    }

    const normalizedCurrent = current.map((item) => String(item || "").trim());
    const normalizedExpected = expected.map((item) => String(item || "").trim());
    const matches =
      normalizedCurrent.length === normalizedExpected.length &&
      normalizedCurrent.every((item, index) => item === normalizedExpected[index]);

    if (!matches) {
      const currentIsPrefixOfExpected =
        normalizedCurrent.length < normalizedExpected.length &&
        normalizedCurrent.every((item, index) => item === normalizedExpected[index]);

      if (currentIsPrefixOfExpected) {
        await this.sheetsApi.spreadsheets.values.update({
          spreadsheetId: this.sheetId,
          range: headerRange,
          valueInputOption: "RAW",
          requestBody: { values: [expected] },
        });
        return;
      }

      throw new Error(
        `Sheet headers mismatch for ${sheetName}. Expected: ${normalizedExpected.join(", ")}. Found: ${normalizedCurrent.join(", ")}`
      );
    }
  }

  async getAll(sheetName) {
    if (!this.useGoogleSheets) {
      this.ensureAvailable();
      return [...(this.memoryStore[sheetName] || [])];
    }

    await this.ensureHeaders(sheetName);

    const range = `${sheetName}!A:Z`;
    const result = await this.sheetsApi.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
    });

    const values = result.data.values || [];
    if (values.length < 2) return [];

    const headers = values[0];
    const pk = this.getPrimaryKey(sheetName);
    return values.slice(1).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = parseCell(row[index] ?? "");
      });
      return item;
    }).filter((item) => String(item[pk] ?? "").trim() !== "");
  }

  async append(sheetName, rowData) {
    if (!this.useGoogleSheets) {
      this.ensureAvailable();
      this.memoryStore[sheetName].push(rowData);
      return rowData;
    }

    await this.ensureHeaders(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    const row = headers.map((header) => normalizeValue(rowData[header]));

    await this.sheetsApi.spreadsheets.values.append({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });

    return rowData;
  }

  async updateById(sheetName, id, updates) {
    const pk = this.getPrimaryKey(sheetName);
    if (!this.useGoogleSheets) {
      this.ensureAvailable();
      const index = this.memoryStore[sheetName].findIndex((item) => String(item[pk]) === String(id));
      if (index === -1) return null;
      const updated = { ...this.memoryStore[sheetName][index], ...updates };
      this.memoryStore[sheetName][index] = updated;
      return updated;
    }

    await this.ensureHeaders(sheetName);
    const rows = await this.getAll(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    const rowIndex = rows.findIndex((item) => String(item[pk]) === String(id));

    if (rowIndex === -1) return null;

    const updated = { ...rows[rowIndex], ...updates };
    const values = headers.map((header) => normalizeValue(updated[header]));
    const endColumn = columnLetter(headers.length - 1);

    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A${rowIndex + 2}:${endColumn}${rowIndex + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [values] },
    });

    return updated;
  }

  async replaceAll(sheetName, rows) {
    if (!this.useGoogleSheets) {
      this.ensureAvailable();
      this.memoryStore[sheetName] = rows;
      return;
    }

    await this.ensureHeaders(sheetName);
    const headers = SHEET_HEADERS[sheetName];
    const values = [headers, ...rows.map((row) => headers.map((header) => normalizeValue(row[header])))];

    await this.sheetsApi.spreadsheets.values.update({
      spreadsheetId: this.sheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      requestBody: { values },
    });
  }

  async findById(sheetName, id) {
    const rows = await this.getAll(sheetName);
    const pk = this.getPrimaryKey(sheetName);
    return rows.find((item) => String(item[pk]) === String(id)) || null;
  }

  async deleteById(sheetName, id) {
    const pk = this.getPrimaryKey(sheetName);
    if (!this.useGoogleSheets) {
      this.ensureAvailable();
      const index = this.memoryStore[sheetName].findIndex((item) => String(item[pk]) === String(id));
      if (index === -1) return false;
      this.memoryStore[sheetName].splice(index, 1);
      return true;
    }

    await this.ensureHeaders(sheetName);
    const rows = await this.getAll(sheetName);
    const rowIndex = rows.findIndex((item) => String(item[pk]) === String(id));
    if (rowIndex === -1) return false;

    const spreadsheetMeta = await this.sheetsApi.spreadsheets.get({
      spreadsheetId: this.sheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    const targetSheet = (spreadsheetMeta.data.sheets || []).find(
      (sheet) => String(sheet?.properties?.title || "") === String(sheetName)
    );
    const targetSheetId = targetSheet?.properties?.sheetId;

    if (targetSheetId === undefined || targetSheetId === null) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    await this.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: this.sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: Number(targetSheetId),
                dimension: "ROWS",
                startIndex: rowIndex + 1, // zero-based, includes header row at index 0
                endIndex: rowIndex + 2,
              },
            },
          },
        ],
      },
    });

    return true;
  }
}

module.exports = {
  SheetsService,
};
