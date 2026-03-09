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
import { ArrowLeft, Pencil, Trash2, Plus } from "lucide-react";

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
    start_month: "",
    end_month: "",
    salary: "",
    status: "",
  });

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
        entry.start_month.toLowerCase().includes(term) ||
        entry.end_month.toLowerCase().includes(term) ||
        entry.status.toLowerCase().includes(term)
    );
  }, [schedule, searchTerm]);

  const handleEdit = (entry: SalaryScheduleEntry) => {
    setSelectedEntry(entry);
    setEditForm({
      employee_id: entry.employee_id,
      start_month: entry.start_month,
      end_month: entry.end_month,
      salary: String(entry.salary),
      status: entry.status,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (entry: SalaryScheduleEntry) => {
    setSelectedEntry(entry);
    setDeleteDialogOpen(true);
  };

  const handleCreate = () => {
    setEditForm({
      employee_id: "",
      start_month: "",
      end_month: "",
      salary: "",
      status: "upcoming",
    });
    setCreateDialogOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedEntry) return;

    try {
      const payload: any = {};
      if (editForm.employee_id !== selectedEntry.employee_id) {
        payload.employee_id = editForm.employee_id;
      }
      if (editForm.start_month !== selectedEntry.start_month) {
        payload.start_month = editForm.start_month;
      }
      if (editForm.end_month !== selectedEntry.end_month) {
        payload.end_month = editForm.end_month;
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
    if (!editForm.employee_id || !editForm.start_month || !editForm.end_month || !editForm.salary) {
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
        start_month: editForm.start_month,
        end_month: editForm.end_month,
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
                <TableHead>Start Month</TableHead>
                <TableHead>End Month</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedule.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No salary schedule entries found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSchedule.map((entry) => (
                  <TableRow key={entry.salaryrev_id}>
                    <TableCell className="font-mono">{entry.employee_id}</TableCell>
                    <TableCell>{entry.employee_name || "—"}</TableCell>
                    <TableCell>{entry.start_month}</TableCell>
                    <TableCell>{entry.end_month}</TableCell>
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
              <Select
                value={editForm.employee_id}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, employee_id: value })
                }
              >
                <SelectTrigger id="edit-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.employee_id} - {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-start">Start Month</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={editForm.start_month.split('-')[1] || ''}
                  onValueChange={(month) => {
                    const year = editForm.start_month.split('-')[0] || new Date().getFullYear().toString();
                    setEditForm({ ...editForm, start_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={editForm.start_month.split('-')[0] || ''}
                  onValueChange={(year) => {
                    const month = editForm.start_month.split('-')[1] || '01';
                    setEditForm({ ...editForm, start_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-end">End Month</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={editForm.end_month.split('-')[1] || ''}
                  onValueChange={(month) => {
                    const year = editForm.end_month.split('-')[0] || new Date().getFullYear().toString();
                    setEditForm({ ...editForm, end_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={editForm.end_month.split('-')[0] || ''}
                  onValueChange={(year) => {
                    const month = editForm.end_month.split('-')[1] || '01';
                    setEditForm({ ...editForm, end_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              <Select
                value={editForm.employee_id}
                onValueChange={(value) =>
                  setEditForm({ ...editForm, employee_id: value })
                }
              >
                <SelectTrigger id="create-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id}>
                      {emp.employee_id} - {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-start">Start Month</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={editForm.start_month.split('-')[1] || ''}
                  onValueChange={(month) => {
                    const year = editForm.start_month.split('-')[0] || new Date().getFullYear().toString();
                    setEditForm({ ...editForm, start_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={editForm.start_month.split('-')[0] || ''}
                  onValueChange={(year) => {
                    const month = editForm.start_month.split('-')[1] || '01';
                    setEditForm({ ...editForm, start_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-end">End Month</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={editForm.end_month.split('-')[1] || ''}
                  onValueChange={(month) => {
                    const year = editForm.end_month.split('-')[0] || new Date().getFullYear().toString();
                    setEditForm({ ...editForm, end_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">January</SelectItem>
                    <SelectItem value="02">February</SelectItem>
                    <SelectItem value="03">March</SelectItem>
                    <SelectItem value="04">April</SelectItem>
                    <SelectItem value="05">May</SelectItem>
                    <SelectItem value="06">June</SelectItem>
                    <SelectItem value="07">July</SelectItem>
                    <SelectItem value="08">August</SelectItem>
                    <SelectItem value="09">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={editForm.end_month.split('-')[0] || ''}
                  onValueChange={(year) => {
                    const month = editForm.end_month.split('-')[1] || '01';
                    setEditForm({ ...editForm, end_month: `${year}-${month}` });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
