import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Mail, Lock, Eye, ArrowDownAZ, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { monthNames, type PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { useToast } from "@/hooks/use-toast";
import PayslipModal from "@/components/PayslipModal";
import { api } from "@/services/api";

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState<Set<string>>(new Set());
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "id">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [viewPayslip, setViewPayslip] = useState<PayrollRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const filtered = useMemo(() => {
    let next = records;
    if (monthFilter !== "all") {
      next = next.filter((record) => String(record.month) === monthFilter);
    }
    if (yearFilter !== "all") {
      next = next.filter((record) => String(record.year) === yearFilter);
    }
    if (employeeFilter !== "all") {
      next = next.filter((record) => record.employee_id === employeeFilter);
    }
    return [...next].sort((a, b) => {
      if (sortBy === "id") {
        const aId = String(a.employee_id || "").toLowerCase();
        const bId = String(b.employee_id || "").toLowerCase();
        return sortOrder === "asc" ? aId.localeCompare(bId, undefined, { numeric: true }) : bId.localeCompare(aId, undefined, { numeric: true });
      }

      const aName = String(a.employee_name || "").toLowerCase();
      const bName = String(b.employee_name || "").toLowerCase();
      return sortOrder === "asc" ? aName.localeCompare(bName) : bName.localeCompare(aName);
    });
  }, [records, monthFilter, yearFilter, employeeFilter, sortBy, sortOrder]);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((record) => {
      const employeeId = String(record.employee_id || "").trim();
      const employeeName = String(record.employee_name || "").trim();
      if (!employeeId) return;
      if (!map.has(employeeId)) {
        map.set(employeeId, employeeName || employeeId);
      }
    });
    return Array.from(map.entries()).map(([empId, employeeName]) => ({ empId, employeeName }));
  }, [records]);

  const safeEmployeeOptions = useMemo(
    () => employeeOptions.filter((option) => typeof option.empId === "string" && option.empId.trim().length > 0),
    [employeeOptions]
  );

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    records.forEach((record) => years.add(record.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  useEffect(() => {
    if (employeeFilter !== "all" && !safeEmployeeOptions.some((option) => option.empId === employeeFilter)) {
      setEmployeeFilter("all");
    }
  }, [employeeFilter, safeEmployeeOptions]);

  useEffect(() => {
    const validIds = new Set(records.map((record) => String(record.payroll_id)));
    setSelectedPayrollIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [records]);

  const loadPayroll = async () => {
    try {
      setLoading(true);
      const response = await api.getPayroll();
      setRecords(response.payroll);
    } catch (error) {
      toast({
        title: "Failed to load payroll",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, []);

  const markPaid = async (id: string) => {
    try {
      const response = await api.markPayrollPaid(id);
      setRecords((prev) => prev.map((record) => (record.payroll_id === id ? response.payroll : record)));
      toast({ title: "Marked as paid" });
    } catch (error) {
      toast({
        title: "Unable to mark paid",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const sendPayslip = async (id: string) => {
    try {
      const response = await api.sendPayslip(id);
      setRecords((prev) => prev.map((record) => (record.payroll_id === id ? response.payroll : record)));
      toast({ title: "Payslip sent via email" });
    } catch (error) {
      toast({
        title: "Unable to send payslip",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const downloadPayslip = (record: PayrollRecord) => {
    const downloadUrl = api.downloadPayslipUrl(record.payroll_id);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  };

  const deleteRecord = async (payrollId: string, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete the payroll record for ${employeeName}? This will also remove related incentive ledger entries.`)) {
      return;
    }

    try {
      const response = await api.deletePayrollRecord(payrollId);
      setRecords((prev) => prev.filter((r) => r.payroll_id !== payrollId));
      setSelectedPayrollIds((prev) => {
        const next = new Set(prev);
        next.delete(payrollId);
        return next;
      });
      toast({
        title: "Payroll record deleted",
        description: `Deleted payroll and ${response.deletedLedgerEntries} incentive ledger entries`,
      });
    } catch (error) {
      toast({
        title: "Failed to delete record",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const deleteAllForPeriod = async () => {
    if (monthFilter === "all" || yearFilter === "all") {
      toast({
        title: "Please select a specific period",
        description: "You must select both a month and year to delete all records for that period",
        variant: "destructive",
      });
      return;
    }

    const month = Number(monthFilter);
    const year = Number(yearFilter);
    const periodName = `${monthNames[month - 1]} ${year}`;
    const recordCount = records.filter((r) => r.month === month && r.year === year).length;

    if (!confirm(`Are you sure you want to delete ALL ${recordCount} payroll records for ${periodName}? This will also remove all related incentive ledger entries. This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.deletePayrollPeriod(month, year);
      setRecords((prev) => prev.filter((r) => r.month !== month || r.year !== year));
      toast({
        title: "All payroll records deleted",
        description: `Deleted ${response.deletedPayrollRecords} payroll records and ${response.deletedLedgerEntries} incentive ledger entries for ${periodName}`,
      });
      setMonthFilter("all");
      setYearFilter("all");
    } catch (error) {
      toast({
        title: "Failed to delete records",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const deleteSelectedRecords = async () => {
    const selectedIds = Array.from(selectedPayrollIds) as string[];
    if (selectedIds.length === 0) {
      toast({
        title: "No payroll selected",
        description: "Please select at least one payroll record",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected payroll records? This will also remove related incentive ledger entries.`)) {
      return;
    }

    try {
      const response = await api.deletePayrollBulk(selectedIds);
      const deletedPayrollIds = Array.isArray(response.deletedPayrollIds)
        ? response.deletedPayrollIds.map((id) => String(id))
        : selectedIds;
      const deletedIds = new Set<string>(deletedPayrollIds);
      setRecords((prev) => prev.filter((record) => !deletedIds.has(record.payroll_id)));
      setSelectedPayrollIds(new Set<string>());
      toast({
        title: "Selected payroll records deleted",
        description: `Deleted ${response.deletedPayrollRecords} payroll records and ${response.deletedLedgerEntries} incentive ledger entries`,
      });
    } catch (error) {
      toast({
        title: "Failed to delete selected records",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const statusColor = (s: string) => {
    if (s === "Paid") return "bg-success/10 text-success border-0";
    if (s === "Sent") return "bg-info/10 text-info border-0";
    return "bg-warning/10 text-warning border-0";
  };

  const filteredPayrollIds = filtered.map((record) => String(record.payroll_id));
  const allFilteredSelected = filteredPayrollIds.length > 0 && filteredPayrollIds.every((id) => selectedPayrollIds.has(id));

  const toggleSelectAllFiltered = () => {
    setSelectedPayrollIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredPayrollIds.forEach((id) => next.delete(id));
      } else {
        filteredPayrollIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRecordSelection = (payrollId: string) => {
    setSelectedPayrollIds((prev) => {
      const next = new Set(prev);
      if (next.has(payrollId)) {
        next.delete(payrollId);
      } else {
        next.add(payrollId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payroll Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{records.length} records</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedPayrollIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteSelectedRecords}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedPayrollIds.size})
            </Button>
          )}
          {monthFilter !== "all" && yearFilter !== "all" && (
            <Button
              variant="destructive"
              size="sm"
              onClick={deleteAllForPeriod}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete All for {monthNames[Number(monthFilter) - 1] || ""} {yearFilter}
            </Button>
          )}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <SelectItem key={m} value={String(m)}>{monthNames[m - 1]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {safeEmployeeOptions.map((option) => (
                <SelectItem key={option.empId} value={option.empId}>
                  {option.employeeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-center p-4 font-medium text-muted-foreground w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all visible payroll records"
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>Employee</span>
                    <div className="relative">
                      <button
                        onClick={() => setShowSortDropdown(!showSortDropdown)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                        title="Sort options"
                      >
                        <ArrowDownAZ className="w-4 h-4" />
                      </button>
                      {showSortDropdown && (
                        <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[160px]">
                          <button
                            onClick={() => {
                              setSortBy("name");
                              setSortOrder("asc");
                              setShowSortDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                          >
                            <ArrowUp className="w-3 h-3" />
                            Sort by Name (A-Z)
                          </button>
                          <button
                            onClick={() => {
                              setSortBy("name");
                              setSortOrder("desc");
                              setShowSortDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                          >
                            <ArrowDown className="w-3 h-3" />
                            Sort by Name (Z-A)
                          </button>
                          <div className="border-t border-border my-1"></div>
                          <button
                            onClick={() => {
                              setSortBy("id");
                              setSortOrder("asc");
                              setShowSortDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                          >
                            <ArrowUp className="w-3 h-3" />
                            Sort by ID (Ascending)
                          </button>
                          <button
                            onClick={() => {
                              setSortBy("id");
                              setSortOrder("desc");
                              setShowSortDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                          >
                            <ArrowDown className="w-3 h-3" />
                            Sort by ID (Descending)
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      ({sortBy === "name" ? "Name" : "ID"} {sortOrder === "asc" ? "↑" : "↓"})
                    </span>
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-muted-foreground">Period</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Gross</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Deductions</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr
                  key={r.payroll_id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                >
                  <td className="p-4 text-center">
                    <input
                      type="checkbox"
                      checked={selectedPayrollIds.has(String(r.payroll_id))}
                      onChange={() => toggleRecordSelection(String(r.payroll_id))}
                      aria-label={`Select payroll record for ${r.employee_name}`}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-foreground">{r.employee_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.employee_id}</div>
                  </td>
                  <td className="p-4 text-muted-foreground">{monthNames[r.month - 1]} {r.year}</td>
                  <td className="p-4 text-right font-mono text-foreground">{formatCurrency(r.gross_salary)}</td>
                  <td className="p-4 text-right font-mono text-destructive">{formatCurrency(r.incentive_deduction)}</td>
                  <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net_salary)}</td>
                  <td className="p-4 text-center">
                    <Badge className={statusColor(r.payment_status)}>{r.payment_status}</Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)} title="View Payslip">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadPayslip(r)} title="Download Payslip">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {r.payment_status === "Pending" && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaid(r.payroll_id)} title="Mark Paid">
                            <Lock className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendPayslip(r.payroll_id)} title="Send Email">
                            <Mail className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                        onClick={() => deleteRecord(r.payroll_id, r.employee_name)} 
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">No payroll records found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
