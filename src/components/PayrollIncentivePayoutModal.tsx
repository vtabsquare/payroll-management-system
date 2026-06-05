import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { api, type IncentiveLedgerEntry } from "@/services/api";
import type { PayrollRecord } from "@/lib/payroll";
import { monthNames } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";

interface PayrollIncentivePayoutModalProps {
  payrollRecord: PayrollRecord;
  onClose: () => void;
  onSuccess: (updatedPayroll: PayrollRecord) => void;
}

export function PayrollIncentivePayoutModal({
  payrollRecord,
  onClose,
  onSuccess,
}: PayrollIncentivePayoutModalProps) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [error, setError] = useState("");

  const alreadyPaidAmount = Number(payrollRecord.incentive_amount || 0);
  const periodLabel = `${monthNames[payrollRecord.month - 1]} ${payrollRecord.year}`;

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setBalanceLoading(true);
        const { balances } = await api.getIncentiveBalances();
        const match = balances.find(
          (b) => String(b.employee_id) === String(payrollRecord.employee_id)
        );
        setCurrentBalance(match?.balance || 0);
      } catch (err) {
        setError("Failed to load incentive balance");
      } finally {
        setBalanceLoading(false);
      }
    };
    fetchBalance();
  }, [payrollRecord.employee_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const payoutAmount = Number(amount);

    if (!payoutAmount || payoutAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (payoutAmount > currentBalance) {
      setError(
        `Amount cannot exceed current balance of ${formatCurrency(currentBalance)}`
      );
      return;
    }

    setLoading(true);

    try {
      const result = await api.payIncentiveFromPayroll(payrollRecord.payroll_id, {
        payout_amount: payoutAmount,
        reference: reference.trim() || undefined,
      });

      onSuccess(result.payroll);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pay incentive");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Pay Incentive
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Info */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Employee
            </label>
            <div className="p-3 bg-muted/30 rounded-lg text-foreground">
              <span className="font-medium">{payrollRecord.employee_name}</span>
              <span className="text-xs text-muted-foreground font-mono ml-2">
                {payrollRecord.employee_id}
              </span>
            </div>
          </div>

          {/* Payroll Period */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Payroll Period
            </label>
            <div className="p-3 bg-muted/30 rounded-lg text-foreground font-medium">
              {periodLabel}
            </div>
          </div>

          {/* Already Paid Warning */}
          {alreadyPaidAmount > 0 && (
            <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Previous Payout Detected</p>
                <p className="text-muted-foreground mt-0.5">
                  Already paid{" "}
                  <span className="font-semibold text-foreground">
                    {formatCurrency(alreadyPaidAmount)}
                  </span>{" "}
                  incentive for {periodLabel}. Proceeding will add to the existing
                  payout.
                </p>
              </div>
            </div>
          )}

          {/* Current Balance */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Available Incentive Balance
            </label>
            {balanceLoading ? (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="h-5 w-24 bg-muted animate-pulse rounded" />
              </div>
            ) : currentBalance > 0 ? (
              <div className="p-3 bg-primary/10 rounded-lg text-primary font-mono font-semibold">
                {formatCurrency(currentBalance)}
              </div>
            ) : (
              <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                No unpaid incentive balance available
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div>
            <label
              htmlFor="incentive-payout-amount"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Payout Amount <span className="text-destructive">*</span>
            </label>
            <input
              id="incentive-payout-amount"
              type="number"
              step="0.01"
              min="0"
              max={currentBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter amount"
              disabled={balanceLoading || currentBalance <= 0}
              required
            />
          </div>

          {/* Reference */}
          <div>
            <label
              htmlFor="incentive-payout-reference"
              className="block text-sm font-medium text-muted-foreground mb-1"
            >
              Reference / Note
            </label>
            <input
              id="incentive-payout-reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Optional payment reference"
              disabled={balanceLoading || currentBalance <= 0}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors disabled:opacity-50"
              disabled={loading || balanceLoading || currentBalance <= 0}
            >
              {loading ? "Processing..." : "Pay Incentive"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
