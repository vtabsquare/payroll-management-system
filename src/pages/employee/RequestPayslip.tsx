import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthNames } from "@/lib/payroll";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function RequestPayslip() {
  const [month, setMonth] = useState<string>("");
  const [year, setYear] = useState<string>("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleSubmit = async () => {
    if (!month || !year) {
      toast({ title: "Please select a month and year", variant: "destructive" });
      return;
    }

    if (!message.trim()) {
      toast({ title: "Please provide a message", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await api.createPayslipRequest({
        month: Number(month),
        year: Number(year),
        request_message: message,
      });
      toast({ title: "Payslip request submitted successfully" });
      setMonth("");
      setYear("");
      setMessage("");
    } catch (error) {
      toast({
        title: "Failed to submit request",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Request Payslip</h1>
        <p className="text-sm text-muted-foreground mt-1">Request your payslip for a specific month and year</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-xl p-6 max-w-lg"
      >
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Month</label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger>
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {monthNames[m - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Year</label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note to your request..."
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px] resize-none"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2">
            <Send className="w-4 h-4" />
            {submitting ? "Submitting..." : "Request Payslip"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
