import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, RotateCcw, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface UserRecord {
  id: string;
  email: string;
  role: "admin" | "employee";
  active: boolean;
}

const initialUsers: UserRecord[] = [
  { id: "1", email: "admin@company.com", role: "admin", active: true },
  { id: "2", email: "arjun@company.com", role: "employee", active: true },
  { id: "3", email: "priya@company.com", role: "employee", active: true },
  { id: "4", email: "rahul@company.com", role: "employee", active: false },
];

export default function UserManagement() {
  const [users, setUsers] = useState(initialUsers);
  const { toast } = useToast();

  const toggleActive = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
    toast({ title: "User status updated" });
  };

  const resetPassword = (email: string) => {
    toast({ title: "Password reset", description: `Reset link sent to ${email}` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage login credentials and roles</p>
        </div>
        <Button className="gradient-primary text-primary-foreground border-0">
          <UserPlus className="w-4 h-4 mr-2" /> Create User
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left p-4 font-medium text-muted-foreground">Email</th>
              <th className="text-center p-4 font-medium text-muted-foreground">Role</th>
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
                <td className="p-4 text-center">
                  <Badge className={u.active ? "bg-success/10 text-success border-0" : "bg-muted text-muted-foreground border-0"}>
                    {u.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-4">
                  <div className="flex justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resetPassword(u.email)} title="Reset Password">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(u.id)} title="Toggle Active">
                      <Power className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
