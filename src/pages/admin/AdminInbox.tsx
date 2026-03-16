import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Clock, CheckCircle, XCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { monthNames, type PayslipRequest } from "@/lib/payroll";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import PayslipModal from "@/components/PayslipModal";
import type { PayrollRecord } from "@/lib/payroll";

export default function AdminInbox() {
  const [requests, setRequests] = useState<PayslipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await api.getAllPayslipRequests();
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

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const response = await api.approvePayslipRequest(id);
      setRequests((prev) => prev.map((r) => (r.request_id === id ? response.request : r)));
      toast({ title: "Request approved" });
    } catch (error) {
      toast({
        title: "Failed to approve",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    setProcessing(rejectId);
    try {
      const response = await api.rejectPayslipRequest(rejectId, rejectComment);
      setRequests((prev) => prev.map((r) => (r.request_id === rejectId ? response.request : r)));
      toast({ title: "Request rejected" });
      setRejectId(null);
      setRejectComment("");
    } catch (error) {
      toast({
        title: "Failed to reject",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleViewPayroll = async (r: PayslipRequest) => {
    try {
      const response = await api.getPayroll({
        month: String(r.month),
        year: String(r.year),
        emp_id: r.employee_id,
      });
      if (response.payroll.length > 0) {
        setViewPayslip(response.payroll[0]);
      } else {
        toast({ title: "No payroll record found", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Failed to load payroll",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage employee payslip requests</p>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 font-medium text-muted-foreground">Employee Name</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Employee Code</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Month</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Year</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Requested Date</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
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
                    <td className="p-4">
                      <div className="font-medium text-foreground">{r.employee_name}</div>
                    </td>
                    <td className="p-4 text-muted-foreground font-mono">{r.employee_code}</td>
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
                    <td className="p-4">
                      <div className="flex justify-center gap-1">
                        {r.status === "pending" && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                              onClick={() => handleApprove(r.request_id)}
                              disabled={processing === r.request_id}
                              title="Approve"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setRejectId(r.request_id);
                                setRejectComment("");
                              }}
                              disabled={processing === r.request_id}
                              title="Reject"
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleViewPayroll(r)}
                          title="View Payroll"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {!loading && requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No payslip requests
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border rounded-xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-lg font-semibold text-foreground mb-4">Reject Request</h3>
            <textarea
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={processing === rejectId}
              >
                {processing === rejectId ? "Rejecting..." : "Reject"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
