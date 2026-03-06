import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { IndianRupee, CheckCircle, FileText } from "lucide-react";
import type { Employee, PayrollRecord } from "@/lib/payroll";
import { monthNames } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { Badge } from "@/components/ui/badge";
import AnimatedCounter from "@/components/AnimatedCounter";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeDashboard() {
  const [profile, setProfile] = useState<Employee | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        const [profileResponse, payrollResponse] = await Promise.all([api.getProfile(), api.getPayroll()]);
        setProfile(profileResponse.profile);
        setRecords(payrollResponse.payroll);
      } catch (error) {
        toast({
          title: "Failed to load dashboard",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      }
    };

    load();
  }, []);

  const latest = useMemo(() => {
    const sorted = [...records].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    return sorted[sorted.length - 1] || null;
  }, [records]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Welcome, {profile?.first_name || "Employee"} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your latest salary overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Latest Net Pay</span>
            <IndianRupee className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            <AnimatedCounter value={latest?.net_salary || 0} prefix="₹" />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {latest ? `${monthNames[latest.month - 1]} ${latest.year}` : "—"}
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Payment Status</span>
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <Badge className={latest?.payment_status === "Paid" ? "bg-success/10 text-success border-0" : "bg-warning/10 text-warning border-0"}>
            {latest?.payment_status || "—"}
          </Badge>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground">Total Records</span>
            <FileText className="w-5 h-5 text-info" />
          </div>
          <div className="text-2xl font-bold text-foreground">{records.length}</div>
        </motion.div>
      </div>

      {/* Quick payslip */}
      {latest && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-6">
          <h3 className="font-semibold text-foreground mb-4">Quick Payslip — {monthNames[latest.month - 1]} {latest.year}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Basic", value: latest.basic_salary },
              { label: "HRA", value: latest.hra },
              { label: "Gross", value: latest.gross_salary },
              { label: "Net Pay", value: latest.net_salary },
            ].map((item) => (
              <div key={item.label} className="bg-muted/30 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">{item.label}</p>
                <p className="font-mono font-semibold text-foreground mt-1">{formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
