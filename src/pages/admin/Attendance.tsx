import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRow {
  emp_id: string;
  name: string;
  working_days: number;
  paid_days: number;
  valid: boolean;
}

export default function AttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const { toast } = useToast();

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n").slice(1); // skip header
    const parsed: AttendanceRow[] = lines.map((line) => {
      const [emp_id, name, working_days, paid_days] = line.split(",").map((s) => s.trim());
      const wd = Number(working_days);
      const pd = Number(paid_days);
      const valid = !!emp_id && !!name && !isNaN(wd) && !isNaN(pd) && pd <= wd && wd > 0;
      return { emp_id, name, working_days: wd, paid_days: pd, valid };
    });
    setRows(parsed);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      file.text().then(parseCSV);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) file.text().then(parseCSV);
  };

  const handleConfirm = () => {
    const validCount = rows.filter((r) => r.valid).length;
    toast({ title: `${validCount} attendance records ready`, description: "Attendance data loaded for payroll generation." });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upload Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload CSV with columns: emp_id, name, working_days, paid_days</p>
      </div>

      {/* Drop zone */}
      <motion.div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
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
            <Button onClick={handleConfirm} className="gradient-primary text-primary-foreground border-0">
              Confirm Upload
            </Button>
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Emp ID</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Working Days</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">Paid Days</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={`border-b border-border/50 ${!r.valid ? "bg-destructive/5" : ""}`}>
                    <td className="p-3">
                      {r.valid ? <CheckCircle className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-destructive" />}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.emp_id}</td>
                    <td className="p-3 text-foreground">{r.name}</td>
                    <td className="p-3 text-right font-mono">{r.working_days}</td>
                    <td className="p-3 text-right font-mono">{r.paid_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
