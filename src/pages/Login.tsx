import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "admin";
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication
    if (email && password) {
      toast({ title: "Login successful", description: `Welcome back!` });
      navigate(role === "admin" ? "/admin" : "/employee");
    } else {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex gradient-hero">
      {/* Left panel */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md"
        >
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <h1 className="text-4xl font-extrabold text-foreground mb-4">
            {role === "admin" ? "Admin Portal" : "Employee Portal"}
          </h1>
          <p className="text-muted-foreground text-lg">
            {role === "admin"
              ? "Manage payroll, employees, and salary calculations from your dashboard."
              : "View your salary history, download payslips, and manage your profile."}
          </p>
        </motion.div>
      </div>

      {/* Right panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-sm"
        >
          <div className="glass-card rounded-2xl p-8">
            <div className="mb-8">
              <span className="text-2xl font-bold gradient-text">PayFlow</span>
              <h2 className="text-xl font-semibold text-foreground mt-4">Sign in</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your credentials to continue
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground border-0 font-semibold">
                Sign In
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-6">
              Demo: use any email/password to login
            </p>
          </div>

          <div className="mt-4 text-center lg:hidden">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
