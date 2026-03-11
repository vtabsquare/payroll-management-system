import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, type SalaryScheduleEntry, type Employee } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Trash2, Plus, Search, X } from "lucide-react";

export default function SalarySchedule() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [schedule, setSchedule] = useState<SalaryScheduleEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const [selectedEntry, setSelectedEntry] = useState<SalaryScheduleEntry | null>(null);
  const [editForm, setEditForm] = useState({
    employee_id: "",
    target_date: "",
    salary: "",
    status: "",
  });
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!employeeSearchTerm.trim()) return employees;
    const term = employeeSearchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.employee_id.toLowerCase().includes(term) ||
        emp.first_name.toLowerCase().includes(term) ||
        emp.last_name.toLowerCase().includes(term)
    );
  }, [employees, employeeSearchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [scheduleRes, employeesRes] = await Promise.all([
        api.getSalarySchedule(),
        api.getEmployees(),
      ]);
      setSchedule(scheduleRes.schedule);
      setEmployees(employeesRes.employees);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load salary schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSchedule = useMemo(() => {
    if (!searchTerm.trim()) return schedule;
    const term = searchTerm.toLowerCase();
    return schedule.filter(
      (entry) =>
        entry.employee_id.toLowerCase().includes(term) ||
        entry.employee_name?.toLowerCase().includes(term) ||
        entry.target_date.toLowerCase().includes(term) ||
        entry.status.toLowerCase().includes(term)
    );
  }, [schedule, searchTerm]);

  const handleEdit = (entry: SalaryScheduleEntry) => {
    setSelectedEntry(entry);
    setEditForm({
      employee_id: entry.employee_id,
      target_date: entry.target_date,
      salary: String(entry.salary),
      status: entry.status,
    });
    setEmployeeSearchTerm("");
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: SalaryScheduleEntry) => {
    setSelectedEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    setEditForm({
      employee_id: "",
      target_date: "",
      salary: "",
      status: "upcoming",
    });
    setEmployeeSearchTerm("");
    setCreateDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedEntry) return;

    try {
      const payload: any = {};
      if (editForm.employee_id !== selectedEntry.employee_id) {
        payload.employee_id = editForm.employee_id;
      }
      if (editForm.target_date !== selectedEntry.target_date) {
        payload.target_date = editForm.target_date;
      }
      if (Number(editForm.salary) !== selectedEntry.salary) {
        payload.salary = Number(editForm.salary);
      }
      if (editForm.status !== selectedEntry.status) {
        payload.status = editForm.status;
      }

      await api.updateSalarySchedule(selectedEntry.salaryrev_id, payload);
      toast({
        title: "Success",
        description: "Salary schedule entry updated successfully",
      });
      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update salary schedule entry",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = async () => {
    if (!selectedEntry) return;

    try {
      await api.deleteSalarySchedule(selectedEntry.salaryrev_id);
      toast({
        title: "Success",
        description: "Salary schedule entry deleted successfully",
      });
      setDeleteDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete salary schedule entry",
        variant: "destructive",
      });
    }
  };

  const saveCreate = async () => {
    if (!editForm.employee_id || !editForm.target_date || !editForm.salary) {
      toast({
        title: "Validation Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    try {
      await api.createSalarySchedule({
        employee_id: editForm.employee_id,
        target_date: editForm.target_date,
        salary: Number(editForm.salary),
        status: editForm.status || "upcoming",
      });
      toast({
        title: "Success",
        description: "Salary schedule entry created successfully",
      });
      setCreateDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create salary schedule entry",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "applied":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Salary Schedule</h1>
        <p className="text-muted-foreground">
          Manage salary revision schedules for employees
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by employee ID, name, month, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading salary schedule...</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead>Target Date</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedule.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No salary schedule entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchedule.map((entry) => (
                  <TableRow key={entry.salaryrev_id}>
                    <TableCell className="font-mono">{entry.employee_id}</TableCell>
                    <TableCell>{entry.employee_name || "—"}</TableCell>
                    <TableCell>{entry.target_date}</TableCell>
                    <TableCell>₹{entry.salary.toLocaleString()}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(
                          entry.status
                        )}`}
                      >
                        {entry.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(entry)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Salary Schedule</DialogTitle>
            <DialogDescription>
              Update the salary schedule entry details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-employee">Employee</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by ID, name..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="h-9 pl-9 pr-9"
                  />
                  {employeeSearchTerm && (
                    <X
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 cursor-pointer hover:text-foreground"
                      onClick={() => setEmployeeSearchTerm("")}
                    />
                  )}
                </div>
                {employeeSearchTerm && filteredEmployees.length === 0 && (
                  <p className="text-xs text-muted-foreground">No employees found</p>
                )}
                <Select
                  value={editForm.employee_id}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, employee_id: value })
                  }
                >
                  <SelectTrigger id="edit-employee">
                    <SelectValue placeholder={employeeSearchTerm ? "Select from filtered results" : "Select employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No employees found
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <SelectItem key={emp.employee_id} value={emp.employee_id}>
                          {emp.employee_id} - {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-target-date">Target Date</Label>
              <Input
                id="edit-target-date"
                type="date"
                value={editForm.target_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, target_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-salary">Salary</Label>
              <Input
                id="edit-salary"
                type="number"
                value={editForm.salary}
                onChange={(e) =>
                  setEditForm({ ...editForm, salary: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, status: value })
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Salary Schedule</DialogTitle>
            <DialogDescription>
              Create a new salary schedule entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-employee">Employee</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by ID, name..."
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                    className="h-9 pl-9 pr-9"
                  />
                  {employeeSearchTerm && (
                    <X
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 cursor-pointer hover:text-foreground"
                      onClick={() => setEmployeeSearchTerm("")}
                    />
                  )}
                </div>
                {employeeSearchTerm && filteredEmployees.length === 0 && (
                  <p className="text-xs text-muted-foreground">No employees found</p>
                )}
                <Select
                  value={editForm.employee_id}
                  onValueChange={(value) =>
                    setEditForm({ ...editForm, employee_id: value })
                  }
                >
                  <SelectTrigger id="create-employee">
                    <SelectValue placeholder={employeeSearchTerm ? "Select from filtered results" : "Select employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No employees found
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <SelectItem key={emp.employee_id} value={emp.employee_id}>
                          {emp.employee_id} - {emp.first_name} {emp.last_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-target-date">Target Date</Label>
              <Input
                id="create-target-date"
                type="date"
                value={editForm.target_date}
                onChange={(e) =>
                  setEditForm({ ...editForm, target_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-salary">Salary</Label>
              <Input
                id="create-salary"
                type="number"
                value={editForm.salary}
                onChange={(e) =>
                  setEditForm({ ...editForm, salary: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, status: value })
                }
              >
                <SelectTrigger id="create-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="applied">Applied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Salary Schedule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this salary schedule entry? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
