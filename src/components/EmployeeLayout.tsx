import { Outlet } from "react-router-dom";
import EmployeeSidebar from "./EmployeeSidebar";

export default function EmployeeLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <EmployeeSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
