export interface Employee {
  id: string;
  emp_id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  joining_date: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  pan: string;
  base_salary: number;
  other_allowance: number;
  special_pay: number;
  incentive_type: "fixed" | "prorated";
  incentive_amount: number;
  status: "active" | "inactive";
}

export interface PayrollRecord {
  id: string;
  emp_id: string;
  employee_name: string;
  month: number;
  year: number;
  working_days: number;
  paid_days: number;
  basic: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  incentive: number;
  gross: number;
  deductions: number;
  net: number;
  payment_status: "Pending" | "Paid" | "Sent";
  generated_date: string;
}

export const employees: Employee[] = [
  {
    id: "1", emp_id: "EMP001", name: "Arjun Mehta", email: "arjun@company.com",
    department: "Engineering", designation: "Senior Developer", joining_date: "2022-03-15",
    bank_name: "HDFC Bank", account_number: "XXXX1234", ifsc_code: "HDFC0001234", pan: "ABCDE1234F",
    base_salary: 60000, other_allowance: 5000, special_pay: 3000,
    incentive_type: "fixed", incentive_amount: 5000, status: "active"
  },
  {
    id: "2", emp_id: "EMP002", name: "Priya Sharma", email: "priya@company.com",
    department: "Design", designation: "UI/UX Lead", joining_date: "2021-08-01",
    bank_name: "ICICI Bank", account_number: "XXXX5678", ifsc_code: "ICIC0005678", pan: "FGHIJ5678K",
    base_salary: 55000, other_allowance: 4000, special_pay: 2500,
    incentive_type: "prorated", incentive_amount: 4000, status: "active"
  },
  {
    id: "3", emp_id: "EMP003", name: "Rahul Verma", email: "rahul@company.com",
    department: "Marketing", designation: "Marketing Manager", joining_date: "2023-01-10",
    bank_name: "SBI", account_number: "XXXX9012", ifsc_code: "SBIN0009012", pan: "KLMNO9012P",
    base_salary: 50000, other_allowance: 3500, special_pay: 2000,
    incentive_type: "fixed", incentive_amount: 3000, status: "active"
  },
  {
    id: "4", emp_id: "EMP004", name: "Sneha Patel", email: "sneha@company.com",
    department: "HR", designation: "HR Executive", joining_date: "2023-06-20",
    bank_name: "Axis Bank", account_number: "XXXX3456", ifsc_code: "UTIB0003456", pan: "QRSTU3456V",
    base_salary: 40000, other_allowance: 3000, special_pay: 1500,
    incentive_type: "prorated", incentive_amount: 2500, status: "active"
  },
  {
    id: "5", emp_id: "EMP005", name: "Vikram Singh", email: "vikram@company.com",
    department: "Engineering", designation: "Backend Developer", joining_date: "2022-11-05",
    bank_name: "Kotak Bank", account_number: "XXXX7890", ifsc_code: "KKBK0007890", pan: "WXYZA7890B",
    base_salary: 52000, other_allowance: 4500, special_pay: 2500,
    incentive_type: "fixed", incentive_amount: 4000, status: "inactive"
  },
];

export const payrollRecords: PayrollRecord[] = [
  {
    id: "1", emp_id: "EMP001", employee_name: "Arjun Mehta", month: 1, year: 2026,
    working_days: 22, paid_days: 22, basic: 60000, hra: 18000, other_allowance: 5000,
    special_pay: 3000, incentive: 5000, gross: 91000, deductions: 6000, net: 85000,
    payment_status: "Paid", generated_date: "2026-02-01"
  },
  {
    id: "2", emp_id: "EMP002", employee_name: "Priya Sharma", month: 1, year: 2026,
    working_days: 22, paid_days: 20, basic: 50000, hra: 15000, other_allowance: 3636,
    special_pay: 2273, incentive: 3636, gross: 74545, deductions: 5000, net: 69545,
    payment_status: "Sent", generated_date: "2026-02-01"
  },
  {
    id: "3", emp_id: "EMP003", employee_name: "Rahul Verma", month: 1, year: 2026,
    working_days: 22, paid_days: 22, basic: 50000, hra: 15000, other_allowance: 3500,
    special_pay: 2000, incentive: 3000, gross: 73500, deductions: 5000, net: 68500,
    payment_status: "Pending", generated_date: "2026-02-01"
  },
  {
    id: "4", emp_id: "EMP001", employee_name: "Arjun Mehta", month: 2, year: 2026,
    working_days: 20, paid_days: 18, basic: 54000, hra: 16200, other_allowance: 4500,
    special_pay: 2700, incentive: 5000, gross: 82400, deductions: 5400, net: 77000,
    payment_status: "Pending", generated_date: "2026-02-26"
  },
];

export const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
