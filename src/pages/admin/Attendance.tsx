import { useState, useCallback, type ChangeEvent, type DragEvent } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle, AlertCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, type AttendanceRow, type AttendanceDuplicateResponse } from "@/services/api";
import { monthNames } from "@/lib/payroll";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParsedRow extends AttendanceRow {
  valid: boolean;
  extra_days: number;
}

export default function AttendancePage() {
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<{ employee_id: string; employee_name: string }[]>([]);
  const { toast } = useToast();

  const parseCSVLine = (line: string): string[] => {
    const out: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    out.push(current.trim());
    return out;
  };

  const toNumberOrZero = (value: string | undefined): number => {
    if (!value) return 0;
    const normalized = String(value).trim().replace(/,/g, ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  };

  const computeDaysFromMarks = (marks: string[]) => {
    let workingDays = 0;
    let paidDays = 0;

    for (const raw of marks) {
      const v = String(raw || "").trim().toUpperCase();
      if (!v) continue;

      // treat any filled day cell as a working day entry
      workingDays += 1;

      if (v === "P") paidDays += 1;
      else if (v === "A") paidDays += 0;
      else if (v === "HL" || v === "H" || v === "HD") paidDays += 0.5;
      else if (v === "L" || v === "CL" || v === "SL" || v === "PL") paidDays += 0;
      else {
        // unknown mark: count as working day but unpaid
        paidDays += 0;
      }
    }

    return {
      workingDays: Math.round(workingDays),
      paidDays: Math.round(paidDays * 100) / 100,
    };
  };

  const parseCSV = (text: string) => {
    const allLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (allLines.length < 2) {
      setRows([]);
      return;
    }

    const normalizeHeader = (h: string) => h.trim().replace(/\s+/g, " ");
    const header = parseCSVLine(allLines[0]).map((h) => normalizeHeader(h));
    const headerLower = header.map((h) => h.toLowerCase());

    const idxEmployeeId = headerLower.findIndex(
      (h) => h === "employee_id" || h === "employee id" || h === "emp id" || h === "employeeid" || h === "empid"
    );
    const idxEmployeeName = headerLower.findIndex(
      (h) => h === "employee_name" || h === "employee name" || h === "name" || h === "employeename"
    );
    const idxWorkingDays = headerLower.findIndex((h) => h === "working_days" || h === "working days" || h === "workingdays");
    const idxPaidDays = headerLower.findIndex((h) => h === "paid_days" || h === "paid days" || h === "paiddays");
    const idxTotalPresent = headerLower.findIndex(
      (h) => h === "total present" || h === "total_present" || h === "totalpresent" || h === "total presents"
    );
    const idxTotalLeaves = headerLower.findIndex(
      (h) => h === "total leaves" || h === "total_leaves" || h === "totalleaves"
    );
    const idxTotalAbsent = headerLower.findIndex(
      (h) => h === "total absent" || h === "total_absent" || h === "totalabsent"
    );

    const dayColumnIndexes: number[] = [];
    for (let i = 0; i < header.length; i++) {
      const h = header[i];
      if (/^\d{1,2}[-/][a-z]{3}$/i.test(h) || /^\d{1,2}[-/][a-z]{3}[-/]\d{2,4}$/i.test(h)) {
        dayColumnIndexes.push(i);
      }
    }

    const dataLines = allLines.slice(1);

    const parsed: ParsedRow[] = dataLines.map((line) => {
      const cols = parseCSVLine(line);

      // Support both formats:
      // A) Simple format: employee_id, employee_name, working_days, paid_days
      // B) Daily sheet: Employee Name, Employee ID, 01-Feb.., Total Present
      const employeeId = idxEmployeeId >= 0 ? (cols[idxEmployeeId] || "").trim() : (cols[1] || "").trim();
      const employeeName = idxEmployeeName >= 0 ? (cols[idxEmployeeName] || "").trim() : (cols[0] || "").trim();

      let workingDays = 0;
      let paidDays = 0;

      if (idxWorkingDays >= 0 && idxPaidDays >= 0) {
        workingDays = toNumberOrZero(cols[idxWorkingDays]);
        paidDays = toNumberOrZero(cols[idxPaidDays]);
      } else if (idxTotalPresent >= 0) {
        // Summary-style sheets (like your Excel export): use explicit Working Days if present,
        // otherwise fallback to counting date columns
        paidDays = toNumberOrZero(cols[idxTotalPresent]);
        if (idxWorkingDays >= 0) {
          workingDays = toNumberOrZero(cols[idxWorkingDays]);
        } else {
          workingDays = dayColumnIndexes.length;
        }
      } else if (dayColumnIndexes.length > 0) {
        const marks = dayColumnIndexes.map((i) => cols[i] || "");
        const computed = computeDaysFromMarks(marks);
        workingDays = computed.workingDays;
        paidDays = computed.paidDays;
      }

      const extraDays = paidDays > workingDays ? Math.round((paidDays - workingDays) * 100) / 100 : 0;
      const valid = !!employeeId && !!employeeName && workingDays > 0 && paidDays >= 0;

      return {
        employee_id: employeeId,
        employee_name: employeeName,
        working_days: workingDays,
        paid_days: paidDays,
        extra_days: extraDays,
        valid,
      };
    });

    setRows(parsed);
  };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      file.text().then(parseCSV);
    }
  }, []);

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) file.text().then(parseCSV);
  };

  const uploadAttendance = async (override = false) => {
    if (rows.length === 0) {
      toast({ title: "No rows", description: "Upload attendance CSV first", variant: "destructive" });
      return;
    }

    if (rows.some((row) => !row.valid)) {
      toast({
        title: "Fix invalid rows",
        description: "Please correct or remove invalid attendance rows before confirming",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setProgress(20);

      const payload = {
        month,
        year,
        rows: rows.map(({ employee_id, employee_name, working_days, paid_days }) => ({
          employee_id,
          employee_name,
          working_days,
          paid_days,
        })),
        override,
      };

      setProgress(60);
      const response = await api.uploadAttendance(payload);
      setProgress(100);

      toast({
        title: `${response.count} attendance records uploaded`,
        description: `Attendance for ${monthNames[month - 1]} ${year} saved successfully.`,
      });
      setRows([]);
    } catch (error) {
      const apiError = error as Error & {
        status?: number;
        data?: {
          requiresOverride?: boolean;
          duplicates?: { employee_id: string; employee_name: string }[];
          invalidRows?: { employee_id: string; employee_name: string; errors: string[] }[];
          message?: string;
        };
      };

      if (apiError.status === 409 && apiError.data?.requiresOverride && Array.isArray(apiError.data.duplicates)) {
        setDuplicates(apiError.data.duplicates);
        setShowOverrideDialog(true);
        return;
      }

      if (apiError.status === 400 && Array.isArray(apiError.data?.invalidRows) && apiError.data.invalidRows.length > 0) {
        const invalidSet = new Set(apiError.data.invalidRows.map((r) => r.employee_id));
        setRows((prev) => prev.map((r) => (invalidSet.has(r.employee_id) ? { ...r, valid: false } : r)));

        const sample = apiError.data.invalidRows
          .slice(0, 3)
          .map((r) => `${r.employee_id || "(missing id)"}: ${r.errors.join(", ")}`)
          .join(" | ");

        toast({
          title: "Upload failed",
          description: `CSV contains invalid rows. ${sample}`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTimeout(() => setProgress(0), 800);
      setUploading(false);
    }
  };

  const handleConfirm = () => uploadAttendance(false);
  const handleOverrideConfirm = () => {
    setShowOverrideDialog(false);
    uploadAttendance(true);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload CSV with columns: employee_id, employee_name, working_days, paid_days
        </p>
      </div>

      {/* Month/Year Selection */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Select Period:</span>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((name, idx) => (
                <SelectItem key={idx} value={String(idx + 1)}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`glass-card rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onClick={() => document.getElementById("csv-input")?.click()}
      >
        <Upload className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
        <p className="text-foreground font-medium">Drop CSV file here or click to upload</p>
        <p className="text-sm text-muted-foreground mt-1">Only .csv files accepted</p>
        <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
      </motion.div>

      {/* Preview */}
      {rows.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{rows.length} rows parsed</span>
              <span className="text-sm text-destructive">{rows.filter((r) => !r.valid).length} invalid</span>
            </div>
            <Button
              onClick={handleConfirm}
              className="gradient-primary text-primary-foreground border-0"
              disabled={uploading}
            >
              Upload for {monthNames[month - 1]} {year}
            </Button>
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Uploading attendance...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Employee ID</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Working Days</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Paid Days</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Extra Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/50 ${!r.valid ? "bg-destructive/5" : ""}`}>
                    <td className="p-3">
                      {r.valid ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      )}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.employee_id}</td>
                    <td className="p-3 text-foreground">{r.employee_name}</td>
                    <td className="p-3 text-right font-mono">{r.working_days}</td>
                    <td className="p-3 text-right font-mono">{r.paid_days}</td>
                    <td className="p-3 text-right font-mono">{r.extra_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Override Confirmation Dialog */}
      <AlertDialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Attendance Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              Attendance records already exist for the following employees in {monthNames[month - 1]} {year}:
              <ul className="mt-2 list-disc list-inside">
                {duplicates.map((d) => (
                  <li key={d.employee_id}>
                    {d.employee_name} ({d.employee_id})
                  </li>
                ))}
              </ul>
              <br />
              Do you want to override the existing records?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverrideConfirm}>Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
