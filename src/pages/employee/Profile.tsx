import { motion } from "framer-motion";
import { employees } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { User, Building, CreditCard, Calendar } from "lucide-react";

const emp = employees[0]; // Simulate logged-in employee

const sections = [
  {
    title: "Personal Information",
    icon: User,
    fields: [
      { label: "Full Name", value: emp.name },
      { label: "Email", value: emp.email },
      { label: "Employee ID", value: emp.emp_id },
      { label: "PAN", value: emp.pan },
    ],
  },
  {
    title: "Employment Details",
    icon: Building,
    fields: [
      { label: "Department", value: emp.department },
      { label: "Designation", value: emp.designation },
      { label: "Joining Date", value: emp.joining_date },
      { label: "Status", value: emp.status },
    ],
  },
  {
    title: "Bank Details",
    icon: CreditCard,
    fields: [
      { label: "Bank Name", value: emp.bank_name },
      { label: "Account Number", value: emp.account_number },
      { label: "IFSC Code", value: emp.ifsc_code },
    ],
  },
  {
    title: "Salary Structure",
    icon: Calendar,
    fields: [
      { label: "Base Salary", value: formatCurrency(emp.base_salary) },
      { label: "Other Allowance", value: formatCurrency(emp.other_allowance) },
      { label: "Special Pay", value: formatCurrency(emp.special_pay) },
      { label: "Incentive", value: `${formatCurrency(emp.incentive_amount)} (${emp.incentive_type})` },
    ],
  },
];

export default function Profile() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal and employment information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section, i) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <section.icon className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{section.title}</h3>
            </div>
            <div className="space-y-3">
              {section.fields.map((f) => (
                <div key={f.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium text-foreground">{f.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
