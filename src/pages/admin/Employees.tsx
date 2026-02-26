import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit2, Power, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { employees as initialEmployees, type Employee } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const { toast } = useToast();

  const filtered = list.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.emp_id.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStatus = (id: string) => {
    setList((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: e.status === "active" ? "inactive" : "active" } : e))
    );
    toast({ title: "Status updated" });
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (emp: Employee) => { setEditing(emp); setModalOpen(true); };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Partial<Employee> = {
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      department: fd.get("department") as string,
      designation: fd.get("designation") as string,
      base_salary: Number(fd.get("base_salary")),
    };
    if (editing) {
      setList((prev) => prev.map((emp) => (emp.id === editing.id ? { ...emp, ...data } : emp)));
      toast({ title: "Employee updated" });
    } else {
      const newEmp: Employee = {
        ...data,
        id: String(list.length + 1),
        emp_id: `EMP${String(list.length + 1).padStart(3, "0")}`,
        joining_date: new Date().toISOString().split("T")[0],
        bank_name: "", account_number: "", ifsc_code: "", pan: "",
        other_allowance: 0, special_pay: 0,
        incentive_type: "fixed", incentive_amount: 0, status: "active",
      } as Employee;
      setList((prev) => [...prev, newEmp]);
      toast({ title: "Employee added" });
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} total employees</p>
        </div>
        <Button onClick={openAdd} className="gradient-primary text-primary-foreground border-0">
          <Plus className="w-4 h-4 mr-2" /> Add Employee
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-4 font-medium text-muted-foreground">ID</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Name</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Department</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Designation</th>
                <th className="text-right p-4 font-medium text-muted-foreground">Base Salary</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
                <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((emp) => (
                  <motion.tr
                    key={emp.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                  >
                    <td className="p-4 font-mono text-xs text-muted-foreground">{emp.emp_id}</td>
                    <td className="p-4 font-medium text-foreground">{emp.name}</td>
                    <td className="p-4 text-muted-foreground">{emp.department}</td>
                    <td className="p-4 text-muted-foreground">{emp.designation}</td>
                    <td className="p-4 text-right font-mono text-foreground">{formatCurrency(emp.base_salary)}</td>
                    <td className="p-4 text-center">
                      <Badge variant={emp.status === "active" ? "default" : "secondary"}
                        className={emp.status === "active" ? "bg-success/10 text-success border-0" : ""}>
                        {emp.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(emp.id)}>
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" defaultValue={editing?.name} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" defaultValue={editing?.email} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Input name="department" defaultValue={editing?.department} required />
              </div>
              <div className="space-y-2">
                <Label>Designation</Label>
                <Input name="designation" defaultValue={editing?.designation} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Base Salary (₹)</Label>
              <Input name="base_salary" type="number" defaultValue={editing?.base_salary} required />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="gradient-primary text-primary-foreground border-0">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
