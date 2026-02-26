import { useState } from "react";
import { payrollRecords, monthNames, type PayrollRecord } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import PayslipModal from "@/components/PayslipModal";
import { motion } from "framer-motion";

export default function PayslipsPage() {
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payslips</h1>
        <p className="text-sm text-muted-foreground mt-1">View detailed salary breakdowns for all employees</p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 font-medium text-muted-foreground">View</th>
            </tr>
          </thead>
          <tbody>
            {payrollRecords.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                <td className="p-4">
                  <div className="font-medium text-foreground">{r.employee_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.emp_id}</div>
                </td>
                <td className="p-4 text-muted-foreground">{monthNames[r.month - 1]} {r.year}</td>
                <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net)}</td>
                <td className="p-4 text-center">
                  <Badge className={r.payment_status === "Paid" ? "bg-success/10 text-success border-0" : r.payment_status === "Sent" ? "bg-info/10 text-info border-0" : "bg-warning/10 text-warning border-0"}>
                    {r.payment_status}
                  </Badge>
                </td>
                <td className="p-4 text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
