import { motion } from "framer-motion";
import { Users, FileText, IndianRupee, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AnimatedCounter from "@/components/AnimatedCounter";
import { employees, payrollRecords } from "@/lib/mockData";
import { formatCurrency } from "@/lib/salaryEngine";

const stats = [
  { label: "Total Employees", value: employees.filter(e => e.status === "active").length, icon: Users, color: "text-primary" },
  { label: "Payrolls This Month", value: payrollRecords.filter(p => p.month === 2 && p.year === 2026).length, icon: FileText, color: "text-info" },
  { label: "Total Expense", value: payrollRecords.reduce((s, p) => s + p.net, 0), icon: IndianRupee, prefix: "₹", color: "text-success" },
  { label: "Pending Payments", value: payrollRecords.filter(p => p.payment_status === "Pending").length, icon: Clock, color: "text-warning" },
];

const trendData = [
  { month: "Oct", amount: 280000 },
  { month: "Nov", amount: 295000 },
  { month: "Dec", amount: 310000 },
  { month: "Jan", amount: 300045 },
  { month: "Feb", amount: 77000 },
];

const statusData = [
  { name: "Paid", value: 1, color: "hsl(160, 84%, 39%)" },
  { name: "Sent", value: 1, color: "hsl(210, 100%, 52%)" },
  { name: "Pending", value: 2, color: "hsl(38, 92%, 50%)" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your payroll system</p>
      </div>

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
              <AnimatedCounter value={s.value} prefix={s.prefix} />
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
