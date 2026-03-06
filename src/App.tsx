import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminLayout from "./components/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import SalarySchedule from "./pages/admin/SalarySchedule";
import UserManagement from "./pages/admin/UserManagement";
import Attendance from "./pages/admin/Attendance";
import GeneratePayroll from "./pages/admin/GeneratePayroll";
import Payroll from "./pages/admin/Payroll";
import Payslips from "./pages/admin/Payslips";
import EmployeeLayout from "./components/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import SalaryHistory from "./pages/employee/SalaryHistory";
import Profile from "./pages/employee/Profile";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="employees" element={<Employees />} />
                  <Route path="salary-schedule" element={<SalarySchedule />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="attendance" element={<Attendance />} />
                  <Route path="generate" element={<GeneratePayroll />} />
                  <Route path="payroll" element={<Payroll />} />
                  <Route path="payslips" element={<Payslips />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute allowedRoles={["employee"]} />}>
                <Route path="/employee" element={<EmployeeLayout />}>
                  <Route index element={<EmployeeDashboard />} />
                  <Route path="history" element={<SalaryHistory />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
