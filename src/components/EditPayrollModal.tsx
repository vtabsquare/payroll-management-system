import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PayrollRecord } from "@/lib/payroll";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, roundCurrency } from "@/lib/salaryEngine";

interface EditPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: PayrollRecord | null;
  onSuccess: (updatedRecord: PayrollRecord) => void;
}

export function EditPayrollModal({ isOpen, onClose, record, onSuccess }: EditPayrollModalProps) {
  const [basicSalary, setBasicSalary] = useState(0);
  const [hra, setHra] = useState(0);
  const [otherAllowance, setOtherAllowance] = useState(0);
  const [specialPay, setSpecialPay] = useState(0);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (record && isOpen) {
      setBasicSalary(record.basic_salary);
      setHra(record.hra);
      setOtherAllowance(record.other_allowance);
      setSpecialPay(record.special_pay);
    }
  }, [record, isOpen]);

  if (!record) return null;

  const grossSalary = basicSalary + hra + otherAllowance + specialPay;
  const netSalary = roundCurrency(grossSalary - record.incentive_deduction + record.incentive_payout + (record.incentive_amount || 0));

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.editPayroll(record.payroll_id, {
        basic_salary: basicSalary,
        hra: hra,
        other_allowance: otherAllowance,
        special_pay: specialPay,
        gross_salary: grossSalary,
        net_salary: netSalary,
      });
      toast({
        title: "Success",
        description: "Payroll record updated successfully",
      });
      onSuccess(response.payroll);
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error.message || "Failed to update payroll",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle>Edit Payroll - {record.employee_name}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Incentive fields are locked to preserve ledger integrity. Adjusting components will auto-calculate Gross & Net Pay.
          </p>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="basic" className="text-right text-muted-foreground">Basic</Label>
            <Input
              id="basic"
              type="number"
              value={basicSalary || ""}
              onChange={(e) => setBasicSalary(Number(e.target.value) || 0)}
              className="col-span-3 font-mono bg-background"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="hra" className="text-right text-muted-foreground">HRA</Label>
            <Input
              id="hra"
              type="number"
              value={hra || ""}
              onChange={(e) => setHra(Number(e.target.value) || 0)}
              className="col-span-3 font-mono bg-background"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="other" className="text-right text-muted-foreground">Other</Label>
            <Input
              id="other"
              type="number"
              value={otherAllowance || ""}
              onChange={(e) => setOtherAllowance(Number(e.target.value) || 0)}
              className="col-span-3 font-mono bg-background"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="special" className="text-right text-muted-foreground">Special</Label>
            <Input
              id="special"
              type="number"
              value={specialPay || ""}
              onChange={(e) => setSpecialPay(Number(e.target.value) || 0)}
              className="col-span-3 font-mono bg-background"
            />
          </div>

          <div className="mt-4 border-t border-border/50 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Salary</span>
              <span className="font-mono">{formatCurrency(grossSalary)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Incentive Deduction (Locked)</span>
              <span className="font-mono text-destructive">{formatCurrency(record.incentive_deduction)}</span>
            </div>
            <div className="flex justify-between font-semibold mt-2">
              <span>New Net Pay</span>
              <span className="font-mono text-success">{formatCurrency(netSalary)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving} className="bg-transparent border-border/50 hover:bg-muted">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
