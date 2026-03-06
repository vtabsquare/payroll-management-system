function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function nextId(rows) {
  const maxId = rows.reduce((max, row) => {
    const numeric = Number(row.id);
    if (Number.isNaN(numeric)) return max;
    return Math.max(max, numeric);
  }, 0);
  return String(maxId + 1);
}

function nextEmpId(rows, field = "employee_id") {
  const maxNumeric = rows.reduce((max, row) => {
    const value = String((row && row[field]) || "");
    const match = value.match(/EMP(\d+)/i);
    if (!match) return max;
    const num = Number(match[1]);
    if (Number.isNaN(num)) return max;
    return Math.max(max, num);
  }, 0);

  return `EMP${String(maxNumeric + 1).padStart(3, "0")}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = {
  toBoolean,
  nextId,
  nextEmpId,
  nowIso,
};
