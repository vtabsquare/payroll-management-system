import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { UserPlus, RotateCcw, Power, X, Unlock, Edit } from "lucide-react";
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
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handleEditUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editUser) return;
    const formData = new FormData(event.currentTarget);

    try {
      const response = await api.updateUser(editUser.id, {
        email: String(formData.get("email") || ""),
        role: String(formData.get("role") || "employee") === "admin" ? "admin" : "employee",
        employee_id: String(formData.get("employee_id") || ""),
      });
      setUsers((prev) => prev.map((item) => (item.id === editUser.id ? response.user : item)));
      setEditUser(null);
      toast({ title: "User updated" });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
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
                  <Badge variant="outline" className="capitalize">{u.role}</Badge>
                </td>
                <td className="p-4 text-center text-xs text-muted-foreground">
                  {u.last_login ? new Date(u.last_login).toLocaleString() : "—"}
                </td>
                <td className="p-4 text-center">
                  <Badge className={(u.login_attempt || 0) >= 3 ? "bg-destructive/10 text-destructive border-0" : "bg-muted text-muted-foreground border-0"}>
                    {u.login_attempt || 0}/3
                  </Badge>
                </td>
                <td className="p-4 text-center">
                  <Badge className={u.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(u)} title="Edit User">
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetPassword(u)} title="Reset Password">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(u)} title="Toggle Active">
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                    {(u.login_attempt || 0) >= 3 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => unlockUser(u)} title="Unlock Account">
                        <Unlock className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </motion.tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">No users found</td>
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

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={editUser?.email} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <select id="edit-role" name="role" defaultValue={editUser?.role} className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-employee_id">Employee Link (id / EMP code / email)</Label>
              <Input id="edit-employee_id" name="employee_id" defaultValue={editUser?.employee_id} placeholder="1 or EMP001 or employee@company.com" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                <X className="w-4 h-4 mr-2" /> Cancel
              </Button>
              <Button type="submit" className="gradient-primary text-primary-foreground border-0">
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
