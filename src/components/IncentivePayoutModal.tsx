import { useState } from "react";
import { X } from "lucide-react";
import { api } from "@/services/api";
import { formatCurrency } from "@/lib/salaryEngine";

interface IncentivePayoutModalProps {
  employeeId: string;
  employeeName: string;
  currentBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function IncentivePayoutModal({
  employeeId,
  employeeName,
  currentBalance,
  onClose,
  onSuccess,
}: IncentivePayoutModalProps) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const payoutAmount = Number(amount);

    if (!payoutAmount || payoutAmount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (payoutAmount > currentBalance) {
      setError(`Amount cannot exceed current balance of ${formatCurrency(currentBalance)}`);
      return;
    }

    setLoading(true);

    try {
      await api.createIncentivePayout({
        employee_id: employeeId,
        payout_amount: payoutAmount,
        payout_date: paymentDate,
        reference: reference.trim() || `Standalone incentive payout`,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6 m-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Pay Incentive</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Employee
            </label>
            <div className="p-3 bg-muted/30 rounded-lg text-foreground">
              {employeeName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Current Balance
            </label>
            <div className="p-3 bg-primary/10 rounded-lg text-primary font-mono font-semibold">
              {formatCurrency(currentBalance)}
            </div>
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-muted-foreground mb-1">
              Payout Amount <span className="text-destructive">*</span>
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={currentBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter amount"
              required
            />
          </div>

          <div>
            <label htmlFor="paymentDate" className="block text-sm font-medium text-muted-foreground mb-1">
              Payment Date <span className="text-destructive">*</span>
            </label>
            <input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-muted-foreground mb-1">
              Reference / Note
            </label>
            <input
              id="reference"
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Optional payment reference"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {error}
            </div>
          )}

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
              disabled={loading}
            >
              {loading ? "Processing..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
