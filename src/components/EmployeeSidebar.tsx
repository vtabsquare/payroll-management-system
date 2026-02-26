import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, History, User, ChevronLeft, ChevronRight, LogOut } from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/employee" },
  { label: "Salary History", icon: History, path: "/employee/history" },
  { label: "Profile", icon: User, path: "/employee/profile" },
];

export default function EmployeeSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-screen bg-sidebar sticky top-0 flex flex-col border-r border-sidebar-border"
    >
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        {!collapsed ? (
          <span className="text-lg font-bold text-sidebar-primary">PayFlow</span>
        ) : (
          <span className="text-lg font-bold text-sidebar-primary">P</span>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="whitespace-nowrap">
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link to="/" className="sidebar-link text-destructive">
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className="sidebar-link w-full justify-center">
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.aside>
  );
}
