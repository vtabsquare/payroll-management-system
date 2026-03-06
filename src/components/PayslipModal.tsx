import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type PayrollRecord, monthNames } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { Separator } from "@/components/ui/separator";

interface Props {
  record: PayrollRecord | null;
  onClose: () => void;
}

export default function PayslipModal({ record, onClose }: Props) {
  if (!record) return null;

  const earnings = [
    { label: "Basic Salary (Prorated)", value: record.basic_salary },
    { label: "HRA (Prorated)", value: record.hra },
    { label: "Other Allowance (Prorated)", value: record.other_allowance },
    { label: "Special Pay (Prorated)", value: record.special_pay },
  ];

  const deductions = [
    { label: "Incentive Deduction (Monthly ₹1000)", value: record.incentive_deduction },
  ];

  const hasIncentivePayout = record.incentive_payout > 0;

  return (
    <Dialog open={!!record} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payslip — {monthNames[record.month - 1]} {record.year}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Employee Info */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-semibold text-foreground">{record.employee_name}</p>
              <p className="text-muted-foreground font-mono text-xs">{record.employee_id}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Working Days: <span className="text-foreground font-medium">{record.working_days}</span></p>
              <p className="text-muted-foreground">Paid Days: <span className="text-foreground font-medium">{record.paid_days}</span></p>
            </div>
          </div>

          <Separator />

          {/* Earnings */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Earnings</h4>
            <div className="space-y-0.5">
              {earnings.map((e, i) => (
                <div key={e.label} className={i % 2 === 0 ? "payslip-row" : "payslip-row-alt"}>
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-mono text-foreground">{formatCurrency(e.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gross */}
          <div className="flex justify-between px-4 py-3 rounded-lg bg-primary/5">
            <span className="font-semibold text-foreground">Gross Salary</span>
            <span className="font-mono font-bold text-primary">{formatCurrency(record.gross_salary)}</span>
          </div>

          {/* Deductions */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deductions</h4>
            {deductions.map((d) => (
              <div key={d.label} className="payslip-row">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-mono text-destructive">-{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>

          {/* Incentive Payout (if applicable) */}
          {hasIncentivePayout && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Incentive Payout</h4>
              <div className="payslip-row">
                <span className="text-muted-foreground">6-Month Accumulated Incentive</span>
                <span className="font-mono text-success">+{formatCurrency(record.incentive_payout)}</span>
              </div>
            </div>
          )}

          <Separator />

          {/* Net */}
          <div className="flex justify-between px-4 py-4 rounded-xl gradient-primary">
            <span className="font-bold text-primary-foreground text-lg">Net Pay</span>
            <span className="font-mono font-bold text-primary-foreground text-lg">{formatCurrency(record.net_salary)}</span>
          </div>

          {/* Payment Status */}
          <div className="text-center text-sm text-muted-foreground">
            Payment Status: <span className="font-medium text-foreground">{record.payment_status}</span>
            {record.payment_date && <span> • Paid on {record.payment_date}</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
