import { useState } from "react";
import { motion } from "framer-motion";
import { payrollRecords, monthNames, type PayrollRecord } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import PayslipModal from "@/components/PayslipModal";

const empRecords = payrollRecords.filter((r) => r.emp_id === "EMP001");

export default function SalaryHistory() {
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Salary History</h1>
        <p className="text-sm text-muted-foreground mt-1">View all your past payslips</p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
              <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 font-medium text-muted-foreground">View</th>
            </tr>
          </thead>
          <tbody>
            {empRecords.map((r, i) => (
              <motion.tr
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                <td className="p-4 text-foreground">{monthNames[r.month - 1]} {r.year}</td>
                <td className="p-4 text-right font-mono text-muted-foreground">{formatCurrency(r.gross)}</td>
                <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net)}</td>
                <td className="p-4 text-center">
                  <Badge className={r.payment_status === "Paid" ? "bg-success/10 text-success border-0" : "bg-warning/10 text-warning border-0"}>
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
