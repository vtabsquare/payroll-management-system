const employees = [
  {
    id: "1",
    emp_id: "EMP001",
    name: "Arjun Mehta",
    email: "arjun@company.com",
    department: "Engineering",
    designation: "Senior Developer",
    joining_date: "2022-03-15",
    bank_name: "HDFC Bank",
    account_number: "XXXX1234",
    ifsc_code: "HDFC0001234",
    pan: "ABCDE1234F",
    base_salary: 60000,
    other_allowance: 5000,
    special_pay: 3000,
    incentive_type: "fixed",
    incentive_amount: 5000,
    status: "active",
  },
  {
    id: "2",
    emp_id: "EMP002",
    name: "Priya Sharma",
    email: "priya@company.com",
    department: "Design",
    designation: "UI/UX Lead",
    joining_date: "2021-08-01",
    bank_name: "ICICI Bank",
    account_number: "XXXX5678",
    ifsc_code: "ICIC0005678",
    pan: "FGHIJ5678K",
    base_salary: 55000,
    other_allowance: 4000,
    special_pay: 2500,
    incentive_type: "prorated",
    incentive_amount: 4000,
    status: "active",
  },
  {
    id: "3",
    emp_id: "EMP003",
    name: "Rahul Verma",
    email: "rahul@company.com",
    department: "Marketing",
    designation: "Marketing Manager",
    joining_date: "2023-01-10",
    bank_name: "SBI",
    account_number: "XXXX9012",
    ifsc_code: "SBIN0009012",
    pan: "KLMNO9012P",
    base_salary: 50000,
    other_allowance: 3500,
    special_pay: 2000,
    incentive_type: "fixed",
    incentive_amount: 3000,
    status: "active",
  },
];

const users = [
  {
    id: "1",
    email: "admin@company.com",
    password_hash: "",
    role: "admin",
    active: true,
    employee_id: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    email: "arjun@company.com",
    password_hash: "",
    role: "employee",
    active: true,
    employee_id: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const payroll = [];
const attendanceRecords = [];
const incentiveLedger = [];
const salarySchedule = [];
const salaryChangeNotifications = [];

module.exports = {
  employees,
  users,
  payroll,
  attendanceRecords,
  incentiveLedger,
  salarySchedule,
  salaryChangeNotifications,
};
