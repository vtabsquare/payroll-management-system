import { useEffect, useMemo, useState } from "react";
import { monthNames, type PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, ArrowDownAZ, ArrowUp, ArrowDown } from "lucide-react";
import PayslipModal from "@/components/PayslipModal";
import { motion } from "framer-motion";
import { api } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function PayslipsPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
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

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    records.forEach((record) => years.add(record.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [records]);

  useEffect(() => {
    const loadPayslips = async () => {
      try {
        setLoading(true);
        const response = await api.getPayroll();
        setRecords(response.payroll);
      } catch (error) {
        toast({
          title: "Failed to load payslips",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadPayslips();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payslips</h1>
          <p className="text-sm text-muted-foreground mt-1">View detailed salary breakdowns for all employees</p>
        </div>
        <div className="flex items-center gap-3">
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
              {employeeOptions.map((option) => (
                <SelectItem key={option.empId} value={option.empId}>
                  {option.employeeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
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
              <th className="text-right p-4 font-medium text-muted-foreground">Net Pay</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 font-medium text-muted-foreground">View</th>
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
                <td className="p-4">
                  <div className="font-medium text-foreground">{r.employee_name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{r.employee_id}</div>
                </td>
                <td className="p-4 text-muted-foreground">{monthNames[r.month - 1]} {r.year}</td>
                <td className="p-4 text-right font-mono font-semibold text-foreground">{formatCurrency(r.net_salary)}</td>
                <td className="p-4 text-center">
                  <Badge className={r.payment_status === "Paid" ? "bg-success/10 text-success border-0" : r.payment_status === "Sent" ? "bg-info/10 text-info border-0" : "bg-warning/10 text-warning border-0"}>
                    {r.payment_status}
                  </Badge>
                </td>
                <td className="p-4 text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewPayslip(r)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                </td>
              </motion.tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">No payslips found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PayslipModal record={viewPayslip} onClose={() => setViewPayslip(null)} />
    </div>
  );
}
