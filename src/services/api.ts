import type { Employee, PayrollRecord } from "@/lib/payroll";

export type UserRole = "admin" | "employee";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  employee_id?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  role: UserRole;
  active: boolean;
  employee_id?: string;
  last_login?: string;
  login_attempt?: number;
}

export interface ResetUserPasswordResponse {
  message: string;
  emailDelivered?: boolean;
  emailFailureReason?: string;
  temporaryPassword?: string;
}

export interface AttendanceRow {
  employee_id: string;
  employee_name: string;
  working_days: number;
  paid_days: number;
}

export interface AttendanceRecord {
  attendance_id: string;
  employee_id: string;
  employee_name: string;
  month: number;
  year: number;
  working_days: number;
  paid_days: number;
  created_at: string;
}

export interface AttendanceUploadResponse {
  message: string;
  count: number;
  month: number;
  year: number;
}

export interface AttendanceDuplicateResponse {
  message: string;
  duplicates: { employee_id: string; employee_name: string }[];
  requiresOverride: boolean;
}

export interface SalaryChangeNotification {
  notification_id: string;
  employee_id: string;
  employee_name: string;
  current_salary: number;
  new_salary: number;
  effective_month: string;
  reminder_count: number;
  reminder_number: number;
  final_reminder: boolean;
  status: "pending" | "applied";
}

export interface IncentiveLedgerEntry {
  ledger_id: string;
  employee_id: string;
  employee_name?: string;
  month: number;
  year: number;
  entry_type: "deduction" | "payout";
  amount: number;
  running_balance: number;
  status: "not_paid" | "partially_paid" | "paid";
  reference: string;
  transaction_date: string;
  created_at: string;
}

export interface SalaryScheduleEntry {
  salaryrev_id: string;
  employee_id: string;
  employee_name?: string;
  start_month: string;
  end_month: string;
  salary: number;
  status: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_KEY = "payroll_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "API request failed") as Error & {
      status?: number;
      data?: unknown;
    };
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  health: () => apiRequest<{ status: string }>("/health"),

  login: (payload: { email: string; password: string; role: UserRole }) =>
    apiRequest<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; password: string }) =>
    apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getEmployees: (search = "") =>
    apiRequest<{ employees: Employee[] }>(`/employees${search ? `?q=${encodeURIComponent(search)}` : ""}`),

  addEmployee: (payload: Partial<Employee>) =>
    apiRequest<{ employee: Employee }>("/employees", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateEmployee: (id: string, payload: Partial<Employee>) =>
    apiRequest<{ employee: Employee }>(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  updateEmployeeStatus: (id: string, status: "active" | "inactive") =>
    apiRequest<{ employee: Employee }>(`/employees/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  getUsers: () => apiRequest<{ users: UserRecord[] }>("/users"),

  createUser: (payload: { email: string; role: UserRole; employee_id?: string; password: string }) =>
    apiRequest<{ user: UserRecord }>("/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateUser: (id: string, payload: Partial<UserRecord>) =>
    apiRequest<{ user: UserRecord }>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  resetUserPassword: (id: string, password?: string) =>
    apiRequest<ResetUserPasswordResponse>(`/users/${id}/reset-password`, {
      method: "POST",
      body: JSON.stringify(password ? { password } : {}),
    }),

  unlockUser: (id: string) =>
    apiRequest<{ message: string; user: UserRecord }>(`/users/${id}/unlock`, {
      method: "POST",
    }),

  uploadAttendance: (payload: { month: number; year: number; rows: AttendanceRow[]; override?: boolean }) =>
    apiRequest<AttendanceUploadResponse | AttendanceDuplicateResponse>("/attendance/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAttendance: (query?: { month?: number; year?: number }) => {
    const params = new URLSearchParams();
    if (query?.month) params.set("month", String(query.month));
    if (query?.year) params.set("year", String(query.year));
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{ attendance: AttendanceRecord[] }>(`/attendance${suffix}`);
  },

  checkAttendance: (month: number, year: number) =>
    apiRequest<{ exists: boolean; count: number; month: number; year: number }>(
      `/attendance/check?month=${month}&year=${year}`
    ),

  generatePayroll: (payload: { month: number; year: number }) =>
    apiRequest<{ generated: PayrollRecord[]; count: number; ledgerEntriesCreated: number; ledgerEntriesPaidOut: number }>("/payroll/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getPayroll: (query?: { month?: string; year?: string; emp_id?: string }) => {
    const params = new URLSearchParams();
    if (query?.month) params.set("month", query.month);
    if (query?.year) params.set("year", query.year);
    if (query?.emp_id) params.set("emp_id", query.emp_id);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{ payroll: PayrollRecord[] }>(`/payroll${suffix}`);
  },

  getIncentiveLedger: () =>
    apiRequest<{ ledger: IncentiveLedgerEntry[] }>("/payroll/incentive-ledger"),

  createIncentivePayout: (payload: {
    employee_id: string;
    payout_amount: number;
    payout_date: string;
    reference?: string;
  }) =>
    apiRequest<{ ledger: IncentiveLedgerEntry }>("/payroll/incentive-ledger/payout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recalculateLedgerTotals: () =>
    apiRequest<{ message: string; updatedCount: number }>("/payroll/incentive-ledger/recalculate-totals", {
      method: "POST",
    }),

  markPayrollPaid: (id: string) =>
    apiRequest<{ payroll: PayrollRecord }>(`/payroll/${id}/mark-paid`, {
      method: "PATCH",
    }),

  sendPayslip: (id: string) =>
    apiRequest<{ payroll: PayrollRecord }>(`/payroll/${id}/send-payslip`, {
      method: "POST",
    }),

  syncSalarySchedule: () =>
    apiRequest<{ message: string; createdCount: number; scheduleCount: number }>(
      "/salary-revisions/sync",
      {
        method: "POST",
      }
    ),

  getSalaryChangeNotifications: () =>
    apiRequest<{ notifications: SalaryChangeNotification[] }>("/salary-revisions/notifications"),

  ignoreSalaryChangeNotification: (id: string) =>
    apiRequest<{ notification: SalaryChangeNotification }>(`/salary-revisions/notifications/${id}/ignore`, {
      method: "POST",
    }),

  applySalaryChangeNotification: (id: string) =>
    apiRequest<{ message: string; notification: SalaryChangeNotification; employee_id: string; base_salary: number }>(
      `/salary-revisions/notifications/${id}/apply`,
      {
        method: "POST",
      }
    ),

  getSalarySchedule: () =>
    apiRequest<{ schedule: SalaryScheduleEntry[] }>("/salary-schedule"),

  createSalarySchedule: (payload: Omit<SalaryScheduleEntry, "salaryrev_id" | "employee_name">) =>
    apiRequest<{ schedule: SalaryScheduleEntry }>("/salary-schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateSalarySchedule: (
    id: string,
    payload: Partial<Omit<SalaryScheduleEntry, "salaryrev_id" | "employee_name">>
  ) =>
    apiRequest<{ schedule: SalaryScheduleEntry }>(`/salary-schedule/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteSalarySchedule: (id: string) =>
    apiRequest<{ message: string }>(`/salary-schedule/${id}`, {
      method: "DELETE",
    }),

  downloadPayslipUrl: (id: string) => {
    const token = getStoredToken();
    return `${API_BASE_URL}/payroll/${id}/download-payslip${token ? `?token=${token}` : ""}`;
  },

  getProfile: () => apiRequest<{ profile: Employee }>("/me/profile"),
};
