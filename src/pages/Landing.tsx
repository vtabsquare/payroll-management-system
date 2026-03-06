import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, Database, Mail, BarChart3, Calculator, Users, FileText, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const floatingCards = [
  { title: "Salary Calculation", icon: Calculator, delay: 0 },
  { title: "Attendance Upload", icon: FileText, delay: 0.15 },
  { title: "Payslip Generation", icon: FileText, delay: 0.3 },
  { title: "Email Delivery", icon: Mail, delay: 0.45 },
];

const features = [
  { title: "Automated Payroll", desc: "Generate payroll in seconds with precise calculations", icon: Zap },
  { title: "Secure Auth", desc: "Role-based access with JWT authentication", icon: Shield },
  { title: "Cloud Storage", desc: "Google Sheets powered persistent storage", icon: Database },
  { title: "Email Integration", desc: "Send payslips directly via Brevo API", icon: Mail },
  { title: "Live Dashboard", desc: "Real-time analytics and salary insights", icon: BarChart3 },
  { title: "Employee Portal", desc: "Self-service portal for salary history", icon: Users },
];

function TiltCard({ title, icon: Icon, delay }: { title: string; icon: typeof Calculator; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ rotateX: -5, rotateY: 5, scale: 1.05, z: 50 }}
      style={{ perspective: 800, transformStyle: "preserve-3d" }}
      className="glass-card rounded-2xl p-8 cursor-pointer group"
    >
      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="h-1 w-12 gradient-primary rounded-full mt-3 group-hover:w-full transition-all duration-500" />
    </motion.div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b border-border/30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold gradient-text">Payroll</span>
          <div className="flex gap-3">
            <Link to="/login?role=employee">
              <Button variant="ghost" size="sm">Employee Login</Button>
            </Link>
            <Link to="/login?role=admin">
              <Button size="sm" className="gradient-primary text-primary-foreground border-0">Admin Login</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 gradient-hero overflow-hidden">
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary mb-6">
              Payroll Management Reimagined
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-foreground leading-tight mb-6">
              Smart Payroll.
              <br />
              <span className="gradient-text">Simplified.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
              Automate salary calculations, generate payslips, and manage your workforce — all from one beautiful dashboard.
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/login?role=admin">
                <Button size="lg" className="gradient-primary text-primary-foreground border-0 px-8 h-12 text-base font-semibold shadow-lg">
                  Get Started
                </Button>
              </Link>
              <Link to="/login?role=employee">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  Employee Portal
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-info/5 rounded-full blur-3xl" />
      </section>

      {/* 3D Cards */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-3xl font-bold text-center mb-4 text-foreground"
          >
            How It Works
          </motion.h2>
          <p className="text-center text-muted-foreground mb-16 max-w-lg mx-auto">
            Four simple steps from attendance to payslip delivery
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {floatingCards.map((card) => (
              <TiltCard key={card.title} {...card} />
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            className="text-3xl font-bold text-center mb-16 text-foreground"
          >
            Everything You Need
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <span className="text-sm font-bold gradient-text">Payroll</span>
          <span className="text-xs text-muted-foreground">© 2026 Payroll. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
