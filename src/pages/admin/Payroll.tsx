import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Mail, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthNames, type PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { useToast } from "@/hooks/use-toast";
import PayslipModal from "@/components/PayslipModal";
import { api } from "@/services/api";

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let next = records;
    if (monthFilter !== "all") {
      next = next.filter((record) => String(record.month) === monthFilter);
    }
    if (employeeFilter !== "all") {
      next = next.filter((record) => record.employee_id === employeeFilter);
    }
    return next;
  }, [records, monthFilter, employeeFilter]);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((record) => {
      if (!map.has(record.employee_id)) {
        map.set(record.employee_id, record.employee_name);
      }
    });
    return Array.from(map.entries()).map(([empId, employeeName]) => ({ empId, employeeName }));
  }, [records]);

  const loadPayroll = async () => {
    try {
      setLoading(true);
      const response = await api.getPayroll();
      setRecords(response.payroll);
    } catch (error) {
      toast({
        title: "Failed to load payroll",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, []);

  const markPaid = async (id: string) => {
    try {
      const response = await api.markPayrollPaid(id);
      setRecords((prev) => prev.map((record) => (record.payroll_id === id ? response.payroll : record)));
      toast({ title: "Marked as paid" });
    } catch (error) {
      toast({
        title: "Unable to mark paid",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const sendPayslip = async (id: string) => {
    try {
      const response = await api.sendPayslip(id);
      setRecords((prev) => prev.map((record) => (record.payroll_id === id ? response.payroll : record)));
      toast({ title: "Payslip sent via email" });
    } catch (error) {
      toast({
        title: "Unable to send payslip",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const downloadPayslip = (record: PayrollRecord) => {
    const downloadUrl = api.downloadPayslipUrl(record.payroll_id);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
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
        <div className="flex items-center gap-3">
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

          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employeeOptions.map((option) => (
                <SelectItem key={option.empId} value={option.empId}>
                  {option.employeeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                  key={r.payroll_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-4">
                    <div className="font-medium text-foreground">{r.employee_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.employee_id}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">{monthNames[r.month - 1]} {r.year}</td>
                  <td className="p-4 text-right font-mono text-foreground">{formatCurrency(r.gross_salary)}</td>
                  <td className="p-4 text-right font-mono text-destructive">{formatCurrency(r.incentive_deduction)}</td>
                  <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net_salary)}</td>
                  <td className="p-4 text-center">
                    <Badge className={statusColor(r.payment_status)}>{r.payment_status}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)} title="View Payslip">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadPayslip(r)} title="Download Payslip">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {r.payment_status === "Pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaid(r.payroll_id)} title="Mark Paid">
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendPayslip(r.payroll_id)} title="Send Email">
                            <Mail className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">No payroll records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
