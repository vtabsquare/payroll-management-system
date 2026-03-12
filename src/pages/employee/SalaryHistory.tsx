import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { monthNames, type PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";
import PayslipModal from "@/components/PayslipModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function SalaryHistory() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.getPayroll();
        setRecords(response.payroll);
      } catch (error) {
        toast({
          title: "Failed to load history",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const years = useMemo(() => {
    const values = new Set(records.map((record) => String(record.year)));
    return Array.from(values).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const yearMatch = yearFilter === "all" || String(record.year) === yearFilter;
      const monthMatch = monthFilter === "all" || String(record.month) === monthFilter;
      return yearMatch && monthMatch;
    });
  }, [records, yearFilter, monthFilter]);

  const downloadPayslip = (record: PayrollRecord) => {
    const printable = `
      <html>
        <head><title>Payslip ${record.employee_id} ${record.month}/${record.year}</title></head>
        <body style="font-family:Arial,sans-serif;padding:24px;">
          <h2>Payslip - ${monthNames[record.month - 1]} ${record.year}</h2>
          <p><strong>${record.employee_name}</strong> (${record.employee_id})</p>
          <p>Working Days: ${record.working_days} | Paid Days: ${record.paid_days}</p>
          <table style="width:100%;border-collapse:collapse;max-width:560px;margin-top:16px;">
            <tr><td>Basic Salary</td><td style="text-align:right;">₹${record.basic_salary.toFixed(2)}</td></tr>
            <tr><td>HRA</td><td style="text-align:right;">₹${record.hra.toFixed(2)}</td></tr>
            <tr><td>Other Allowance</td><td style="text-align:right;">₹${record.other_allowance.toFixed(2)}</td></tr>
            <tr><td>Special Pay</td><td style="text-align:right;">₹${record.special_pay.toFixed(2)}</td></tr>
            <tr style="border-top:1px solid #ccc;"><td><strong>Gross Salary</strong></td><td style="text-align:right;"><strong>₹${record.gross_salary.toFixed(2)}</strong></td></tr>
            <tr><td>Incentive Deduction</td><td style="text-align:right;color:red;">-₹${record.incentive_deduction.toFixed(2)}</td></tr>
            ${record.incentive_payout > 0 ? `<tr><td>Incentive Payout (6-month)</td><td style="text-align:right;color:green;">+₹${record.incentive_payout.toFixed(2)}</td></tr>` : ""}
            <tr style="border-top:2px solid #333;"><td><strong>Net Salary</strong></td><td style="text-align:right;"><strong>₹${record.net_salary.toFixed(2)}</strong></td></tr>
          </table>
          <p style="margin-top:24px;">Payment Status: ${record.payment_status}</p>
          <script>window.print()</script>
        </body>
      </html>
    `;
    const blob = new Blob([printable], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Salary History</h1>
        <p className="text-sm text-muted-foreground mt-1">View all your past payslips</p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {monthNames.map((month, index) => (
              <SelectItem key={month} value={String(index + 1)}>{month}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            {filtered.map((r, i) => (
              <motion.tr
                key={r.payroll_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                <td className="p-4 text-foreground">{monthNames[r.month - 1]} {r.year}</td>
                <td className="p-4 text-right font-mono text-muted-foreground">{formatCurrency(r.gross_salary)}</td>
                <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net_salary)}</td>
                <td className="p-4 text-center">
                  <Badge className={r.payment_status === "Paid" ? "bg-success/10 text-success border-0" : "bg-warning/10 text-warning border-0"}>
                    {r.payment_status}
                  </Badge>
                </td>
                <td className="p-4 text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)} title="View Payslip">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadPayslip(r)} title="Download Payslip">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </motion.tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">No salary records found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
