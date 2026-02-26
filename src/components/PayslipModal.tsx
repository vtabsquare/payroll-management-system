import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type PayrollRecord, monthNames } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { Separator } from "@/components/ui/separator";

interface Props {
  record: PayrollRecord | null;
  onClose: () => void;
}

export default function PayslipModal({ record, onClose }: Props) {
  if (!record) return null;

  const earnings = [
    { label: "Basic Salary", value: record.basic },
    { label: "HRA (30% of Basic)", value: record.hra },
    { label: "Other Allowance", value: record.other_allowance },
    { label: "Special Pay", value: record.special_pay },
    { label: "Incentive", value: record.incentive },
  ];

  const deductions = [
    { label: "PF / Deductions (10% of Basic)", value: record.deductions },
  ];

  return (
    <Dialog open={!!record} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip — {monthNames[record.month - 1]} {record.year}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Employee Info */}
          <div className="flex justify-between text-sm">
            <div>
              <p className="font-semibold text-foreground">{record.employee_name}</p>
              <p className="text-muted-foreground font-mono text-xs">{record.emp_id}</p>
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
            <span className="font-mono font-bold text-primary">{formatCurrency(record.gross)}</span>
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

          <Separator />

          {/* Net */}
          <div className="flex justify-between px-4 py-4 rounded-xl gradient-primary">
            <span className="font-bold text-primary-foreground text-lg">Net Pay</span>
            <span className="font-mono font-bold text-primary-foreground text-lg">{formatCurrency(record.net)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
