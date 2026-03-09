import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { UserPlus, RotateCcw, Power, X, Unlock, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, type UserRecord } from "@/services/api";

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });
  const { toast } = useToast();

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.getUsers();
      setUsers(response.users);
    } catch (error) {
      toast({
        title: "Failed to load users",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const toggleActive = async (user: UserRecord) => {
    try {
      const response = await api.updateUser(user.id, { active: !user.active });
      setUsers((prev) => prev.map((item) => (item.id === user.id ? response.user : item)));
      toast({ title: "User status updated" });
    } catch (error) {
      toast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const resetPassword = async (user: UserRecord) => {
    try {
      const response = await api.resetUserPassword(user.id);
      if (response.emailDelivered === false && response.temporaryPassword) {
        toast({
          title: "Password reset",
          description: response.emailFailureReason
            ? `Temporary password: ${response.temporaryPassword} (${response.emailFailureReason})`
            : `Temporary password: ${response.temporaryPassword}`,
        });
        return;
      }

      toast({ title: "Password reset", description: response.message });
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const unlockUser = async (user: UserRecord) => {
    try {
      const response = await api.unlockUser(user.id);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? response.user : item)));
      toast({ title: "User unlocked", description: response.message });
    } catch (error) {
      toast({
        title: "Unlock failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const toggleSalaryVisibility = async (user: UserRecord) => {
    try {
      const response = await api.updateUser(user.id, { can_view_salaries: !user.can_view_salaries });
      setUsers((prev) => prev.map((item) => (item.id === user.id ? response.user : item)));
      toast({ 
        title: "Salary visibility updated",
        description: response.user.can_view_salaries ? "User can now view salaries" : "User cannot view salaries"
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    try {
      const response = await api.createUser({
        email: String(formData.get("email") || ""),
        role: String(formData.get("role") || "employee") === "admin" ? "admin" : "employee",
        employee_id: String(formData.get("employee_id") || ""),
        password: String(formData.get("password") || ""),
      });
      setUsers((prev) => [...prev, response.user]);
      setOpen(false);
      toast({ title: "User created" });
    } catch (error) {
      toast({
        title: "Create failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleRoleChange = (user: UserRecord, newRole: "admin" | "employee") => {
    if (user.role === newRole) return;
    
    setConfirmDialog({
      open: true,
      title: "Update User Role",
      description: `Are you sure you want to change ${user.email}'s role from ${user.role} to ${newRole}?`,
      onConfirm: async () => {
        try {
          const response = await api.updateUser(user.id, { role: newRole });
          setUsers((prev) => prev.map((item) => (item.id === user.id ? response.user : item)));
          toast({ title: "User role updated", description: `Role changed to ${newRole}` });
        } catch (error) {
          toast({
            title: "Update failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
        setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} });
      },
    });
  };

  const handleResetAttempts = (user: UserRecord) => {
    if ((user.login_attempt || 0) === 0) return;
    
    setConfirmDialog({
      open: true,
      title: "Reset Login Attempts",
      description: `Reset login attempts for ${user.email} from ${user.login_attempt || 0} to 0?`,
      onConfirm: async () => {
        try {
          const response = await api.unlockUser(user.id);
          setUsers((prev) => prev.map((item) => (item.id === user.id ? response.user : item)));
          toast({ title: "Login attempts reset" });
        } catch (error) {
          toast({
            title: "Reset failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          });
        }
        setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage login credentials and roles</p>
        </div>
        <Button className="gradient-primary text-primary-foreground border-0" onClick={() => setOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Role</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Salary View</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Last Login</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Attempts</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Status</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="border-b border-border/50 hover:bg-muted/20 transition-colors"
              >
                <td className="p-4 font-medium text-foreground">{u.email}</td>
                <td className="p-4 text-center">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u, e.target.value as "admin" | "employee")}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm capitalize cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-4 text-center">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={() => toggleSalaryVisibility(u)} 
                    title={u.can_view_salaries ? "Can view salaries" : "Cannot view salaries"}
                  >
                    {u.can_view_salaries ? <Eye className="w-4 h-4 text-success" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                </td>
                <td className="p-4 text-center text-xs text-muted-foreground">
                  {u.last_login ? new Date(u.last_login).toLocaleString() : "—"}
                </td>
                <td className="p-4 text-center">
                  <button
                    onClick={() => handleResetAttempts(u)}
                    disabled={(u.login_attempt || 0) === 0}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      (u.login_attempt || 0) >= 3
                        ? "bg-destructive/10 text-destructive hover:bg-destructive/20 cursor-pointer"
                        : (u.login_attempt || 0) > 0
                        ? "bg-muted text-muted-foreground hover:bg-muted/70 cursor-pointer"
                        : "bg-muted text-muted-foreground cursor-default"
                    }`}
                    title={(u.login_attempt || 0) > 0 ? "Click to reset attempts" : "No attempts to reset"}
                  >
                    {u.login_attempt || 0}/3
                  </button>
                </td>
                <td className="p-4 text-center">
                  <Badge className={u.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetPassword(u)} title="Reset Password">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(u)} title="Toggle Active">
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Temporary Password</Label>
              <Input id="password" name="password" type="text" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee_id">Employee Link (id / EMP code / email)</Label>
              <Input id="employee_id" name="employee_id" placeholder="1 or EMP001 or employee@company.com" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground border-0">
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {confirmDialog.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">{confirmDialog.description}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, title: "", description: "", onConfirm: () => {} })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gradient-primary text-primary-foreground border-0"
              onClick={confirmDialog.onConfirm}
            >
              Confirm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
