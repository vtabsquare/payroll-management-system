import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calculator, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { monthNames, type PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";
import IncentiveSelectionModal from "@/components/IncentiveSelectionModal";

export default function GeneratePayroll() {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const [generated, setGenerated] = useState(false);
  const [results, setResults] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  const [attendanceExists, setAttendanceExists] = useState<boolean | null>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [incentiveBalances, setIncentiveBalances] = useState<{ employee_id: string; employee_name: string; balance: number }[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const { toast } = useToast();

  // Check attendance when month/year changes
  useEffect(() => {
    const checkAttendance = async () => {
      if (!month || !year) return;

      setCheckingAttendance(true);
      try {
        const result = await api.checkAttendance(Number(month), Number(year));
        setAttendanceExists(result.exists);
        setAttendanceCount(result.count);
      } catch {
        setAttendanceExists(null);
      } finally {
        setCheckingAttendance(false);
      }
    };

    checkAttendance();
  }, [month, year]);

  const handleGenerate = async () => {
    if (!attendanceExists) {
      toast({
        title: "Attendance required",
        description: `No attendance records found for ${monthNames[Number(month) - 1]} ${year}. Please upload attendance first.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setLoadingBalances(true);
      const balancesResponse = await api.getIncentiveBalances();
      setIncentiveBalances(balancesResponse.balances);
      setShowIncentiveModal(true);
    } catch (error) {
      toast({
        title: "Failed to load incentive balances",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoadingBalances(false);
    }
  };

  const handleIncentiveConfirm = async (selections: { employee_id: string; amount: number }[]) => {
    try {
      setLoading(true);
      setShowIncentiveModal(false);
      const response = await api.generatePayroll({ 
        month: Number(month), 
        year: Number(year),
        incentiveSelections: selections.length > 0 ? selections : undefined,
      });
      setResults(response.generated);
      setGenerated(true);

      if (response.count === 0) {
        toast({
          title: "No new records",
          description: "Payroll already exists for all employees with attendance in this period.",
        });
      } else {
        const incentiveMessage = selections.length > 0 
          ? ` Incentives added for ${selections.length} ${selections.length === 1 ? 'employee' : 'employees'}.`
          : '';
        toast({
          title: "Payroll generated",
          description: `${response.count} records created. ${response.ledgerEntriesCreated} incentive ledger entries added.${incentiveMessage}`,
        });
      }
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Generate Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select period and generate payroll for all active employees with attendance records
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!month || loading || !attendanceExists}
            className="gradient-primary text-primary-foreground border-0 h-10"
          >
            <Calculator className="w-4 h-4 mr-2" /> {loading ? "Generating..." : "Generate"}
          </Button>
        </div>

        {/* Attendance status indicator */}
        {month && year && !checkingAttendance && (
          <div className="flex items-center gap-2 text-sm">
            {attendanceExists ? (
              <>
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-muted-foreground">
                  {attendanceCount} attendance records found for {monthNames[Number(month) - 1]} {year}
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="text-destructive">
                  No attendance records for {monthNames[Number(month) - 1]} {year}. Upload attendance first.
                </span>
              </>
            )}
          </div>
        )}

        {checkingAttendance && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4 animate-pulse" />
            <span>Checking attendance records...</span>
          </div>
        )}
      </div>

      <IncentiveSelectionModal
        open={showIncentiveModal}
        onClose={() => setShowIncentiveModal(false)}
        onConfirm={handleIncentiveConfirm}
        balances={incentiveBalances}
        loading={loading}
      />

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
                  <th className="text-right p-4 font-medium text-muted-foreground">Incentive Ded.</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Incentive Amount</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.payroll_id} className="border-b border-border/50">
                    <td className="p-4 font-medium text-foreground">{r.employee_name}</td>
                    <td className="p-4 text-right font-mono text-muted-foreground">
                      {formatCurrency(r.basic_salary)}
                    </td>
                    <td className="p-4 text-right font-mono text-muted-foreground">{formatCurrency(r.hra)}</td>
                    <td className="p-4 text-right font-mono text-foreground">{formatCurrency(r.gross_salary)}</td>
                    <td className="p-4 text-right font-mono text-destructive">
                      {formatCurrency(r.incentive_deduction)}
                    </td>
                    <td className="p-4 text-right font-mono text-success">
                      {(r.incentive_amount || 0) > 0 ? formatCurrency(r.incentive_amount || 0) : "-"}
                    </td>
                    <td className="p-4 text-right font-mono font-semibold text-foreground">
                      {formatCurrency(r.net_salary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {generated && results.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Info className="w-5 h-5" />
            <span>No new payroll records were generated. Payroll may already exist for this period.</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
