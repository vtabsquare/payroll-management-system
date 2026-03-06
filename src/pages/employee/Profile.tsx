import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type { Employee } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { User, Building, CreditCard, Calendar } from "lucide-react";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.getProfile();
        setProfile(response.profile);
      } catch (error) {
        toast({
          title: "Failed to load profile",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    };

    load();
  }, []);

  const sections = useMemo(() => {
    if (!profile) return [];

    return [
      {
        title: "Personal Information",
        icon: User,
        fields: [
          { label: "Full Name", value: `${profile.first_name} ${profile.last_name}` },
          { label: "Email", value: profile.company_email },
          { label: "Employee ID", value: profile.employee_id },
          { label: "PAN", value: profile.pan_number || "—" },
        ],
      },
      {
        title: "Employment Details",
        icon: Building,
        fields: [
          { label: "Employee Type", value: profile.employee_type || "—" },
          { label: "Designation", value: profile.designation },
          { label: "Joining Date", value: profile.date_of_joining },
          { label: "Status", value: profile.status },
        ],
      },
      {
        title: "Bank Details",
        icon: CreditCard,
        fields: [
          { label: "Bank Name", value: profile.bank_name },
          { label: "Account Number", value: profile.account_number },
          { label: "IFSC Code", value: profile.ifsc_code },
        ],
      },
      {
        title: "Salary Structure",
        icon: Calendar,
        fields: [
          { label: "Base Salary", value: formatCurrency(profile.base_salary) },
          { label: "HRA", value: formatCurrency(profile.hra) },
          { label: "Other Allowance", value: formatCurrency(profile.other_allowance) },
          { label: "Special Pay", value: formatCurrency(profile.special_pay) },
        ],
      },
    ];
  }, [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your personal and employment information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {!profile && (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">Loading profile...</div>
        )}
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
