import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { employees, monthNames } from "@/lib/mockData";
import { calculateSalary, formatCurrency } from "@/lib/salaryEngine";
import { useToast } from "@/hooks/use-toast";

export default function GeneratePayroll() {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("2026");
  const [generated, setGenerated] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const { toast } = useToast();

  const handleGenerate = () => {
    const activeEmps = employees.filter((e) => e.status === "active");
    const payrolls = activeEmps.map((emp) => {
      const breakdown = calculateSalary({
        base_salary: emp.base_salary,
        other_allowance: emp.other_allowance,
        special_pay: emp.special_pay,
        incentive_type: emp.incentive_type,
        incentive_amount: emp.incentive_amount,
        working_days: 22,
        paid_days: 20 + Math.floor(Math.random() * 3), // simulate
      });
      return { emp, ...breakdown };
    });
    setResults(payrolls);
    setGenerated(true);
    toast({ title: "Payroll generated", description: `${payrolls.length} records created` });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generate Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">Select period and generate payroll for all active employees</p>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!month}
            className="gradient-primary text-primary-foreground border-0 h-10"
          >
            <Calculator className="w-4 h-4 mr-2" /> Generate
          </Button>
        </div>
      </div>

      {generated && results.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-success" />
            <span className="font-medium text-foreground">
              {results.length} payroll records generated for {monthNames[Number(month) - 1]} {year}
            </span>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 font-medium text-muted-foreground">Employee</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Basic</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">HRA</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Deductions</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.emp.id} className="border-b border-border/50">
                    <td className="p-4 font-medium text-foreground">{r.emp.name}</td>
                    <td className="p-4 text-right font-mono text-muted-foreground">{formatCurrency(r.basic)}</td>
                    <td className="p-4 text-right font-mono text-muted-foreground">{formatCurrency(r.hra)}</td>
                    <td className="p-4 text-right font-mono text-foreground">{formatCurrency(r.gross)}</td>
                    <td className="p-4 text-right font-mono text-destructive">{formatCurrency(r.deductions)}</td>
                    <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
