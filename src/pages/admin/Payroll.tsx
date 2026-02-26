import { useState } from "react";
import { motion } from "framer-motion";
import { Download, Mail, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { payrollRecords as initialRecords, monthNames, type PayrollRecord } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { useToast } from "@/hooks/use-toast";
import PayslipModal from "@/components/PayslipModal";

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>(initialRecords);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);
  const { toast } = useToast();

  const filtered = monthFilter === "all" ? records : records.filter((r) => String(r.month) === monthFilter);

  const markPaid = (id: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, payment_status: "Paid" as const } : r))
    );
    toast({ title: "Marked as paid" });
  };

  const sendPayslip = (id: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, payment_status: "Sent" as const } : r))
    );
    toast({ title: "Payslip sent via email" });
  };

  const statusColor = (s: string) => {
    if (s === "Paid") return "bg-success/10 text-success border-0";
    if (s === "Sent") return "bg-info/10 text-info border-0";
    return "bg-warning/10 text-warning border-0";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{records.length} records</p>
        </div>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <SelectItem key={m} value={String(m)}>{monthNames[m - 1]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Deductions</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
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
                  <td className="p-4 text-right font-mono text-foreground">{formatCurrency(r.gross)}</td>
                  <td className="p-4 text-right font-mono text-destructive">{formatCurrency(r.deductions)}</td>
                  <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net)}</td>
                  <td className="p-4 text-center">
                    <Badge className={statusColor(r.payment_status)}>{r.payment_status}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)} title="View Payslip">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {r.payment_status === "Pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaid(r.id)} title="Mark Paid">
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendPayslip(r.id)} title="Send Email">
                            <Mail className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
