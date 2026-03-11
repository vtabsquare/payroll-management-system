export interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  company_email: string;
  phone?: string;
  designation: string;
  employee_type?: string;
  date_of_joining: string;
  date_of_birth?: string;
  gender?: string;
  aadhaar_number?: string;
  pan_number?: string;
  pf_number?: string;
  pf_amount?: number;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  base_salary: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  incentive: number;
  status: "active" | "inactive";
  created_at?: string;
  updated_at?: string;
}

export interface PayrollRecord {
  payroll_id: string;
  employee_id: string;
  employee_name: string;
  month: number;
  year: number;
  working_days: number;
  paid_days: number;
  extra_days?: number;
  basic_salary: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  incentive_deduction: number;
  incentive_payout: number;
  gross_salary: number;
  net_salary: number;
  payment_status: "Pending" | "Paid" | "Sent";
  payment_date: string;
  created_at: string;
}

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
