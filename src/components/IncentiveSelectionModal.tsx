import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/salaryEngine";
import { Loader2 } from "lucide-react";

interface IncentiveBalance {
  employee_id: string;
  employee_name: string;
  balance: number;
}

interface IncentiveSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (selections: { employee_id: string; amount: number }[]) => void;
  balances: IncentiveBalance[];
  loading?: boolean;
}

export default function IncentiveSelectionModal({
  open,
  onClose,
  onConfirm,
  balances,
  loading = false,
}: IncentiveSelectionModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      setSelected(new Set());
    }
  }, [open]);

  const toggleSelection = (employeeId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelected(newSelected);
  };

  const toggleAll = () => {
    if (selected.size === balances.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(balances.map((b) => b.employee_id)));
    }
  };

  const handleConfirm = () => {
    const selections = balances
      .filter((b) => selected.has(b.employee_id))
      .map((b) => ({
        employee_id: b.employee_id,
        amount: b.balance,
      }));
    onConfirm(selections);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Incentives to Payroll</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Select employees whose incentive balances should be included in this payroll generation.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {balances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No employees have unpaid incentive balances.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 border-b bg-muted/50 sticky top-0">
                <Checkbox
                  checked={selected.size === balances.length && balances.length > 0}
                  onCheckedChange={toggleAll}
                />
                <div className="flex-1 font-semibold text-sm">Employee</div>
                <div className="w-32 font-semibold text-sm text-right">Balance</div>
              </div>

              {balances.map((balance) => (
                <div
                  key={balance.employee_id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleSelection(balance.employee_id)}
                >
                  <Checkbox
                    checked={selected.has(balance.employee_id)}
                    onCheckedChange={() => toggleSelection(balance.employee_id)}
                  />
                  <div className="flex-1">
                    <p className="font-medium">{balance.employee_name}</p>
                    <p className="text-xs text-muted-foreground">{balance.employee_id}</p>
                  </div>
                  <div className="w-32 text-right font-semibold text-green-600">
                    {formatCurrency(balance.balance)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {selected.size} of {balances.length} selected
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={loading || selected.size === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue with {selected.size} {selected.size === 1 ? "employee" : "employees"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
