import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Clock, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthNames, type PayslipRequest } from "@/lib/payroll";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function EmployeeInbox() {
  const [requests, setRequests] = useState<PayslipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.getMyPayslipRequests();
        setRequests(response.requests);
      } catch (error) {
        toast({
          title: "Failed to load requests",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const statusBadge = (status: string) => {
    if (status === "approved") return { icon: CheckCircle, className: "bg-success/10 text-success border-0", label: "Approved" };
    if (status === "rejected") return { icon: XCircle, className: "bg-destructive/10 text-destructive border-0", label: "Rejected" };
    return { icon: Clock, className: "bg-warning/10 text-warning border-0", label: "Pending" };
  };



  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your payslip requests</p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Month</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Year</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Requested Date</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left p-4 font-medium text-muted-foreground">Admin Comment</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, i) => {
              const badge = statusBadge(r.status);
              return (
                <motion.tr
                  key={r.request_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-4 text-foreground">{monthNames[r.month - 1]}</td>
                  <td className="p-4 text-foreground">{r.year}</td>
                  <td className="p-4 text-muted-foreground">
                    {r.requested_at ? new Date(r.requested_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-4 text-center">
                    <Badge className={badge.className}>
                      <badge.icon className="w-3 h-3 mr-1" />
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground text-sm">
                    {r.status === "rejected" && r.admin_comment ? r.admin_comment : "—"}
                  </td>
                </motion.tr>
              );
            })}
            {!loading && requests.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  No payslip requests yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
