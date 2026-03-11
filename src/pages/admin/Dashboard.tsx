import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, FileText, IndianRupee, Clock, AlertTriangle, ArrowRight, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Employee, PayrollRecord } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { api, type SalaryChangeNotification } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [salaryNotifications, setSalaryNotifications] = useState<SalaryChangeNotification[]>([]);
  const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);
  const { toast } = useToast();

  const loadSalaryNotifications = async () => {
    try {
      const response = await api.getSalaryChangeNotifications();
      setSalaryNotifications(response.notifications);
    } catch {
      // Silently fail - notifications are optional
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [employeesResponse, payrollResponse] = await Promise.all([
          api.getEmployees(),
          api.getPayroll(),
        ]);
        setEmployees(employeesResponse.employees);
        setPayrollRecords(payrollResponse.payroll);
        loadSalaryNotifications();
      } catch (error) {
        toast({
          title: "Dashboard failed",
          description: error instanceof Error ? error.message : "Unable to load dashboard data",
          variant: "destructive",
        });
      }
    };

    load();
  }, []);

  const handleApplySalaryChange = async (notificationId: string) => {
    setProcessingNotificationId(notificationId);
    try {
      const response = await api.applySalaryChangeNotification(notificationId);
      toast({
        title: "Salary Updated",
        description: response.message,
      });
      setSalaryNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
    } catch (error) {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to apply salary change",
        variant: "destructive",
      });
    } finally {
      setProcessingNotificationId(null);
    }
  };

  const handleIgnoreSalaryChange = async (notificationId: string) => {
    setProcessingNotificationId(notificationId);
    try {
      await api.ignoreSalaryChangeNotification(notificationId);
      toast({ title: "Reminder dismissed" });
      loadSalaryNotifications();
    } catch (error) {
      toast({
        title: "Action Failed",
        description: error instanceof Error ? error.message : "Failed to dismiss reminder",
        variant: "destructive",
      });
    } finally {
      setProcessingNotificationId(null);
    }
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const stats = [
    {
      label: "Total Employees",
      value: employees.filter((e) => e.status === "active").length,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Payrolls This Month",
      value: payrollRecords.filter((p) => p.month === currentMonth && p.year === currentYear).length,
      icon: FileText,
      color: "text-info",
    },
    {
      label: "Total Expense",
      value: payrollRecords.reduce((sum, p) => sum + (Number(p.net_salary) || 0), 0),
      icon: IndianRupee,
      prefix: "",
      color: "text-success",
      formatAsCurrency: true,
    },
    {
      label: "Pending Payments",
      value: payrollRecords.filter((p) => p.payment_status === "Pending").length,
      icon: Clock,
      color: "text-warning",
    },
  ];

  const trendData = useMemo(() => {
    const map = new Map<string, number>();

    payrollRecords.forEach((record) => {
      const key = `${record.year}-${String(record.month).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + (Number(record.net_salary) || 0));
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-6)
      .map(([key, amount]) => {
        const [, month] = key.split("-");
        return {
          month: new Date(2000, Number(month) - 1, 1).toLocaleString("en-US", { month: "short" }),
          amount,
        };
      });
  }, [payrollRecords]);

  const statusData = useMemo(
    () => [
      { name: "Paid", value: payrollRecords.filter((item) => item.payment_status === "Paid").length, color: "hsl(160, 84%, 39%)" },
      { name: "Sent", value: payrollRecords.filter((item) => item.payment_status === "Sent").length, color: "hsl(210, 100%, 52%)" },
      { name: "Pending", value: payrollRecords.filter((item) => item.payment_status === "Pending").length, color: "hsl(38, 92%, 50%)" },
    ],
    [payrollRecords]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your payroll system</p>
      </div>

      {/* Salary Change Notifications */}
      {salaryNotifications.length > 0 && (
        <div className="space-y-3">
          {salaryNotifications.map((notification) => (
            <motion.div
              key={notification.notification_id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`border-l-4 ${notification.final_reminder ? 'border-l-destructive bg-destructive/5' : 'border-l-warning bg-warning/5'}`}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${notification.final_reminder ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                        <AlertTriangle className={`w-5 h-5 ${notification.final_reminder ? 'text-destructive' : 'text-warning'}`} />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-foreground">
                            {notification.final_reminder ? 'Final Reminder' : 'Salary Change Reminder'}
                          </h4>
                          <Badge variant="outline" className="text-xs">
                            Reminder {notification.reminder_number} of 3
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{notification.employee_name}</span>
                          {' '}({notification.employee_id})
                        </p>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-foreground">
                              {notification.employee_name}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Current: ₹{notification.current_salary.toLocaleString()} → New: ₹
                              {notification.new_salary.toLocaleString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Target Date: {notification.target_date} ({notification.days_until} {notification.days_until === 1 ? 'day' : 'days'} remaining)
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-10 md:ml-0">
                      <Button
                        size="sm"
                        onClick={() => handleApplySalaryChange(notification.notification_id)}
                        disabled={processingNotificationId === notification.notification_id}
                      >
                        Update Now
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleIgnoreSalaryChange(notification.notification_id)}
                        disabled={processingNotificationId === notification.notification_id}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Ignore
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={s.value} prefix={s.prefix} formatAsCurrency={s.formatAsCurrency} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 glass-card rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-6">Salary Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trendData}>
              <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-xs" />
              <YAxis axisLine={false} tickLine={false} className="text-xs" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="hsl(160, 84%, 39%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-xl p-6"
        >
          <h3 className="font-semibold text-foreground mb-6">Payment Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-4">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                {s.name}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
