import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit2, Power, UserRoundCheck, User, Building, CreditCard, Calendar, ChevronLeft, ChevronRight, X, Check, ChevronDown, CheckCircle2, AlertCircle, MinusCircle, ArrowUpDown, ArrowUp, ArrowDown, ArrowDownAZ } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { type Employee } from "@/lib/payroll";
import { formatCurrency } from "@/lib/salaryEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { api, type IncentiveLedgerEntry } from "@/services/api";

const PAGE_SIZE = 6;

export default function EmployeesPage() {
  const [list, setList] = useState<Employee[]>([]);
  const [incentiveLedger, setIncentiveLedger] = useState<IncentiveLedgerEntry[]>([]);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("table");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutEmployeeId, setPayoutEmployeeId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().slice(0, 10));
  const [payoutReference, setPayoutReference] = useState("");
  const [ledgerSaving, setLedgerSaving] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'id' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [ledgerSortBy, setLedgerSortBy] = useState<'date' | 'employee' | 'amount' | null>(null);
  const [ledgerSortOrder, setLedgerSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const { toast } = useToast();

  // Get unique designations from existing employees
  const uniqueDesignations = useMemo(() => {
    const designations = new Set<string>();
    list.forEach(emp => {
      if (emp.designation && emp.designation.trim()) {
        designations.add(emp.designation.trim());
      }
    });
    return Array.from(designations).sort();
  }, [list]);

  const isMaskedValue = (value: unknown) => typeof value === "string" && value.includes("*");

  const toNumeric = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      if (isMaskedValue(value)) return 0;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const displayCurrency = (value: unknown): string => {
    if (isMaskedValue(value)) return String(value);
    return formatCurrency(toNumeric(value));
  };

  const grossDisplay = (employee: Employee): string => {
    const parts = [employee.base_salary, employee.hra, employee.other_allowance, employee.special_pay];
    if (parts.some(isMaskedValue)) {
      return "₹*****";
    }
    return formatCurrency(parts.reduce((sum, part) => sum + toNumeric(part), 0));
  };

  const calculateProfileCompletion = (employee: Employee): { level: 'complete' | 'partial' | 'minimal', filledCount: number, totalCount: number } => {
    const allFields = [
      employee.first_name,
      employee.last_name,
      employee.company_email,
      employee.phone,
      employee.designation,
      employee.employee_type,
      employee.date_of_joining,
      employee.date_of_birth,
      employee.gender,
      employee.aadhaar_number,
      employee.pan_number,
      employee.pf_number,
      employee.bank_name,
      employee.account_number,
      employee.ifsc_code,
      employee.base_salary,
      employee.hra,
      employee.other_allowance,
      employee.special_pay,
      employee.incentive,
    ];
    const filledCount = allFields.filter(field => {
      if (field === null || field === undefined) return false;
      if (typeof field === 'string') return field.trim() !== '';
      if (typeof field === 'number') return true;
      return false;
    }).length;
    const totalCount = allFields.length;
    const percentage = (filledCount / totalCount) * 100;
    
    let level: 'complete' | 'partial' | 'minimal';
    if (percentage === 100) {
      level = 'complete';
    } else if (percentage >= 50) {
      level = 'partial';
    } else {
      level = 'minimal';
    }
    
    return { level, filledCount, totalCount };
  };

  const filtered = useMemo(() => {
    let result = list;
    
    // Apply search filter
    const query = search.trim().toLowerCase();
    if (query) {
      const normalizedQuery = query.replace(/\s+/g, "");
      result = result.filter((employee) => {
        const firstName = String(employee.first_name || "").toLowerCase();
        const lastName = String(employee.last_name || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const fullNameNoSpace = `${firstName}${lastName}`;
        const employeeId = String(employee.employee_id || "").toLowerCase();

        return (
          fullName.includes(query) ||
          fullNameNoSpace.includes(normalizedQuery) ||
          employeeId.includes(normalizedQuery)
        );
      });
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      result.sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (sortBy === 'id') {
      result.sort((a, b) => {
        return sortOrder === 'asc' 
          ? a.employee_id.localeCompare(b.employee_id)
          : b.employee_id.localeCompare(a.employee_id);
      });
    }
    
    return result;
  }, [list, search, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectedEmployees = useMemo(
    () => list.filter((employee) => selectedEmployeeIds.includes(employee.employee_id)),
    [list, selectedEmployeeIds]
  );

  const selectedFilteredCount = useMemo(
    () => filtered.filter((employee) => selectedEmployeeIds.includes(employee.employee_id)).length,
    [filtered, selectedEmployeeIds]
  );

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.getEmployees();
      setList(response.employees);
    } catch (error) {
      toast({
        title: "Failed to load employees",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredLedger = useMemo(() => {
    let result = incentiveLedger;
    
    // Apply search filter
    const query = search.trim().toLowerCase();
    if (query) {
      const normalizedQuery = query.replace(/\s+/g, "");
      const matchingEmployeeIds = new Set<string>();

      for (const employee of list) {
        const firstName = String(employee.first_name || "").toLowerCase();
        const lastName = String(employee.last_name || "").toLowerCase();
        const fullName = `${firstName} ${lastName}`.trim();
        const fullNameNoSpace = `${firstName}${lastName}`;
        const employeeId = String(employee.employee_id || "").toLowerCase();

        if (
          fullName.includes(query) ||
          fullNameNoSpace.includes(normalizedQuery) ||
          employeeId.includes(normalizedQuery)
        ) {
          matchingEmployeeIds.add(employee.employee_id);
        }
      }

      result = result.filter((entry) => matchingEmployeeIds.has(entry.employee_id));
    }
    
    // Apply sorting
    if (ledgerSortBy === 'date') {
      result.sort((a, b) => {
        const dateA = `${a.year}-${String(a.month).padStart(2, '0')}`;
        const dateB = `${b.year}-${String(b.month).padStart(2, '0')}`;
        return ledgerSortOrder === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      });
    } else if (ledgerSortBy === 'employee') {
      result.sort((a, b) => {
        const nameA = (a.employee_name || '').toLowerCase();
        const nameB = (b.employee_name || '').toLowerCase();
        return ledgerSortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    } else if (ledgerSortBy === 'amount') {
      result.sort((a, b) => {
        const amountA = Number(a.amount) || 0;
        const amountB = Number(b.amount) || 0;
        return ledgerSortOrder === 'asc' ? amountA - amountB : amountB - amountA;
      });
    }
    
    return result;
  }, [incentiveLedger, search, list, ledgerSortBy, ledgerSortOrder]);

  const ledgerSummary = useMemo(() => {
    const byEmployee = new Map<string, IncentiveLedgerEntry[]>();
    for (const entry of filteredLedger) {
      const rows = byEmployee.get(entry.employee_id) || [];
      rows.push(entry);
      byEmployee.set(entry.employee_id, rows);
    }

    let totalBalance = 0;
    let totalPaidOut = 0;
    let latestPayoutDate = "";

    for (const entries of byEmployee.values()) {
      const ordered = [...entries].sort((a, b) => {
        const diff = (Number(a.year) * 12 + Number(a.month)) - (Number(b.year) * 12 + Number(b.month));
        if (diff !== 0) return diff;
        return Number(a.ledger_id) - Number(b.ledger_id);
      });
      const latest = ordered[ordered.length - 1];
      totalBalance += toNumeric(latest?.running_balance || 0);

      for (const entry of entries) {
        if (entry.entry_type === "payout") {
          totalPaidOut += toNumeric(entry.amount || 0);
          if (!latestPayoutDate || String(entry.transaction_date || "") > latestPayoutDate) {
            latestPayoutDate = String(entry.transaction_date || "");
          }
        }
      }
    }

    return {
      totalBalance,
      totalPaidOut,
      latestPayoutDate,
    };
  }, [filteredLedger]);

  const payoutEmployeeOptions = useMemo(() => {
    const balances = new Map<string, number>();
    for (const entry of incentiveLedger) {
      balances.set(entry.employee_id, toNumeric(entry.running_balance || 0));
    }
    return list
      .map((employee) => ({
        employee,
        balance: balances.get(employee.employee_id) || 0,
      }))
      .filter((item) => item.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [incentiveLedger, list]);

  const loadIncentiveLedger = async () => {
    try {
      setLedgerLoading(true);
      const response = await api.getIncentiveLedger();
      setIncentiveLedger(response.ledger);
    } catch (error) {
      toast({
        title: "Failed to load incentive ledger",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
    loadIncentiveLedger();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    setSelectedEmployeeIds((prev) => prev.filter((id) => list.some((employee) => employee.employee_id === id)));
  }, [list]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.employee-input-container')) {
        setShowEmployeeSuggestions(false);
      }
      if (!target.closest('.employee-selector-dropdown')) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((prev) => {
      if (checked) {
        if (prev.includes(employeeId)) return prev;
        return [...prev, employeeId];
      }
      return prev.filter((id) => id !== employeeId);
    });
  };

  const handleSelectAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedEmployeeIds([]);
      return;
    }
    setSelectedEmployeeIds(filtered.map((employee) => employee.employee_id));
  };

  const toggleStatus = async (employee: Employee) => {
    try {
      const nextStatus = employee.status === "active" ? "inactive" : "active";
      await api.updateEmployeeStatus(employee.employee_id, nextStatus);
      setList((prev) => prev.map((item) => (item.employee_id === employee.employee_id ? { ...item, status: nextStatus } : item)));
      if (editing?.employee_id === employee.employee_id) {
        setEditing((prev) => (prev ? { ...prev, status: nextStatus } : prev));
      }
      toast({ title: "Status updated" });
    } catch (error) {
      toast({
        title: "Status update failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const openAdd = () => { setEditing(null); setFormData({}); setFormStep(1); setModalOpen(true); };
  const openEdit = (emp: Employee) => { setEditing(emp); setFormData(emp); setFormStep(1); setModalOpen(true); };

  const handleInputChange = (field: keyof Employee, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Multi-select employee state
  const [employeeInput, setEmployeeInput] = useState("");
  const [employeeSuggestions, setEmployeeSuggestions] = useState<Employee[]>([]);
  const [showEmployeeSuggestions, setShowEmployeeSuggestions] = useState(false);
  
  // Get current selected employees
  const currentSelectedEmployees = useMemo(() => {
    const desig = formData.designation || "";
    return desig.split(',').map(d => d.trim()).filter(d => d.length > 0);
  }, [formData.designation]);

  const handleEmployeeInputChange = (value: string) => {
    setEmployeeInput(value);

    if (value.length > 0) {
      const filtered = list.filter(emp =>
        (emp.first_name.toLowerCase().includes(value.toLowerCase()) ||
         emp.last_name.toLowerCase().includes(value.toLowerCase()) ||
         emp.employee_id.toLowerCase().includes(value.toLowerCase())) &&
        !currentSelectedEmployees.includes(emp.employee_id)
      );
      setEmployeeSuggestions(filtered);
      setShowEmployeeSuggestions(true);
    } else {
      setShowEmployeeSuggestions(false);
    }
  };
  
  const addEmployee = (employee: Employee) => {
    const current = currentSelectedEmployees;
    if (!current.includes(employee.employee_id)) {
      const employeeName = `${employee.first_name} ${employee.last_name} (${employee.employee_id})`;
      const updated = [...current, employeeName].join(', ');
      handleInputChange('designation', updated);
    }
    setEmployeeInput("");
    setShowEmployeeSuggestions(false);
  };
  
  const removeEmployee = (employeeToRemove: string) => {
    const updated = currentSelectedEmployees.filter(d => d !== employeeToRemove).join(', ');
    handleInputChange('designation', updated);
  };
  
  const handleEmployeeKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && employeeInput.trim()) {
      // Find exact match or add as custom entry
      const exactMatch = list.find(emp => 
        emp.first_name.toLowerCase() === employeeInput.trim().toLowerCase() ||
        emp.last_name.toLowerCase() === employeeInput.trim().toLowerCase() ||
        emp.employee_id.toLowerCase() === employeeInput.trim().toLowerCase()
      );
      
      if (exactMatch) {
        addEmployee(exactMatch);
      } else {
        // Add as custom entry
        const current = currentSelectedEmployees;
        if (!current.includes(employeeInput.trim())) {
          const updated = [...current, employeeInput.trim()].join(', ');
          handleInputChange('designation', updated);
        }
        setEmployeeInput("");
        setShowEmployeeSuggestions(false);
      }
    }
  };


  const valueOrDash = (value: unknown) => {
    if (value === null || value === undefined) return "-";
    const text = String(value).trim();
    return text.length > 0 ? text : "-";
  };

  const renderDetail = (label: string, value: unknown) => (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground break-all">{valueOrDash(value)}</span>
    </div>
  );

  const getEmployeeSections = (employee: Employee) => [
    {
      title: "Personal Information",
      icon: User,
      fields: [
        { label: "Employee ID", value: employee.employee_id },
        { label: "First Name", value: employee.first_name },
        { label: "Last Name", value: employee.last_name },
        { label: "Company Email", value: employee.company_email },
        { label: "Phone", value: employee.phone },
        { label: "Date of Birth", value: employee.date_of_birth },
        { label: "Gender", value: employee.gender },
        { label: "Aadhaar Number", value: employee.aadhaar_number },
        { label: "PAN Number", value: employee.pan_number },
      ],
    },
    {
      title: "Employment Details",
      icon: Building,
      fields: [
        { label: "Designation", value: employee.designation },
        { label: "Employee Type", value: employee.employee_type },
        { label: "Date of Joining", value: employee.date_of_joining },
        { label: "PF Number", value: employee.pf_number },
        { label: "Status", value: employee.status },
      ],
    },
    {
      title: "Bank Details",
      icon: CreditCard,
      fields: [
        { label: "Bank Name", value: employee.bank_name },
        { label: "Account Number", value: employee.account_number },
        { label: "IFSC Code", value: employee.ifsc_code },
      ],
    },
    {
      title: "Salary Structure",
      icon: Calendar,
      fields: [
        { label: "Base Salary", value: formatCurrency(employee.base_salary) },
        { label: "HRA", value: formatCurrency(employee.hra) },
        { label: "Other Allowance", value: formatCurrency(employee.other_allowance) },
        { label: "Special Pay", value: formatCurrency(employee.special_pay) },
        { label: "Incentive Deduction", value: formatCurrency(employee.incentive) },
      ],
    },
  ];

  const validateMandatoryFields = () => {
    const requiredFields = [
      { field: 'first_name', label: 'First Name' },
      { field: 'last_name', label: 'Last Name' },
      { field: 'company_email', label: 'Company Email' },
      { field: 'phone', label: 'Phone' },
      { field: 'aadhaar_number', label: 'Aadhaar Number' },
      { field: 'pan_number', label: 'PAN Number' },
      { field: 'employee_type', label: 'Employee Type' },
      { field: 'designation', label: 'Designation' },
    ];

    const missingFields = requiredFields.filter(
      ({ field }) => !formData[field as keyof Employee] || String(formData[field as keyof Employee]).trim() === ''
    );

    if (missingFields.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
        variant: "destructive",
      });
      return false;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.company_email && !emailRegex.test(formData.company_email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    // Validate mandatory fields
    if (!validateMandatoryFields()) {
      return;
    }

    const data: Partial<Employee> = {
      employee_id: formData.employee_id || editing?.employee_id || "",
      first_name: formData.first_name || "",
      last_name: formData.last_name || "",
      company_email: formData.company_email || "",
      phone: formData.phone || "",
      designation: formData.designation || "",
      employee_type: formData.employee_type || "",
      date_of_joining: formData.date_of_joining || "",
      date_of_birth: formData.date_of_birth || "",
      gender: formData.gender || "",
      aadhaar_number: formData.aadhaar_number || "",
      pan_number: formData.pan_number || "",
      pf_number: formData.pf_number || "",
      bank_name: formData.bank_name || "",
      account_number: formData.account_number || "",
      ifsc_code: formData.ifsc_code || "",
      base_salary: Number(formData.base_salary) || 0,
      hra: Number(formData.hra) || 0,
      other_allowance: Number(formData.other_allowance) || 0,
      special_pay: Number(formData.special_pay) || 0,
      incentive: Number(formData.incentive) || 0,
      status: formData.status === "inactive" ? "inactive" : "active",
    };

    try {
      if (editing) {
        const response = await api.updateEmployee(editing.employee_id, data);
        setList((prev) => prev.map((emp) => (emp.employee_id === editing.employee_id ? response.employee : emp)));
        toast({ title: "Employee updated" });
      } else {
        const response = await api.addEmployee(data);
        setList((prev) => [...prev, response.employee]);
        
        if (response.userCreated && response.temporaryPassword) {
          toast({
            title: "Employee & User Account Created",
            description: `Employee added successfully. Login credentials:\nEmail: ${response.employee.company_email}\nPassword: ${response.temporaryPassword}`,
            duration: 10000,
          });
        } else if (response.userCreationError) {
          toast({
            title: "Employee added",
            description: `Employee created but user account creation failed: ${response.userCreationError}`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Employee added",
            description: "User account already exists for this email",
          });
        }
      }
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleLedgerSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!payoutEmployeeId) return;

    const parsedAmount = Number(payoutAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Payout amount must be a valid positive number",
        variant: "destructive",
      });
      return;
    }

    try {
      setLedgerSaving(true);
      const response = await api.createIncentivePayout({
        employee_id: payoutEmployeeId,
        payout_amount: parsedAmount,
        payout_date: payoutDate,
        reference: payoutReference.trim(),
      });

      const employeeName = list.find((employee) => employee.employee_id === payoutEmployeeId);
      setIncentiveLedger((prev) => [{
        ...response.ledger,
        employee_name: employeeName ? `${employeeName.first_name} ${employeeName.last_name}`.trim() : response.ledger.employee_name,
      }, ...prev]);
      toast({ title: "Payout recorded" });
      setPayoutOpen(false);
      setPayoutEmployeeId("");
      setPayoutAmount("");
      setPayoutReference("");
    } catch (error) {
      toast({
        title: "Payout failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLedgerSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground mt-1">{list.length} total employees</p>
        </div>
        <Button onClick={openAdd} className="gradient-primary text-primary-foreground border-0">
          <Plus className="w-4 h-4 mr-2" /> Add Employee
        </Button>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="inline-flex rounded-lg border border-border/70 bg-card p-1 w-fit">
          <Button
            size="sm"
            variant={viewMode === "cards" ? "default" : "ghost"}
            onClick={() => setViewMode("cards")}
          >
            Cards
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
        </div>
      </div>

      <Card className="glass-card border-border/60">
        <CardContent className="p-6">
          <div className="space-y-1 mb-5">
            <h3 className="text-base font-semibold text-foreground">Employee Selection</h3>
            <p className="text-sm text-muted-foreground">
              Select one or more employees below to view full details in cards.
            </p>
          </div>

          <div className="employee-selector-dropdown w-full max-w-md">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-sm border border-input rounded-xl bg-card hover:bg-accent/40 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <span className={selectedEmployeeIds.length === 0 ? "text-muted-foreground" : "text-foreground font-medium"}>
                {selectedEmployeeIds.length === 0
                  ? "Select employees..."
                  : `${selectedEmployeeIds.length} employee${selectedEmployeeIds.length > 1 ? 's' : ''} selected`}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
              <div className="mt-2 w-full border border-border rounded-xl bg-card shadow-sm overflow-hidden">
                <div className="border-b border-border/60 px-2 py-2 bg-muted/20">
                  <label className="flex items-center gap-3 cursor-pointer group rounded-lg hover:bg-accent/50 px-2 py-2 transition-colors">
                    <Checkbox
                      id="select-all-dropdown"
                      checked={filtered.length > 0 && selectedFilteredCount === filtered.length}
                      onCheckedChange={(checked) => handleSelectAllFiltered(checked === true)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      Select all ({filtered.length})
                    </span>
                  </label>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1.5">
                  {filtered.map((employee) => (
                    <label
                      key={`dropdown-${employee.employee_id}`}
                      className="flex items-center gap-3 px-2.5 py-2.5 rounded-lg hover:bg-accent/40 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedEmployeeIds.includes(employee.employee_id)}
                        onCheckedChange={(checked) => handleEmployeeSelection(employee.employee_id, checked === true)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-0.5"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-foreground truncate pr-2">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <span 
                            className={`shrink-0 w-1.5 h-1.5 rounded-full ${employee.status === 'active' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.4)]' : 'bg-destructive shadow-[0_0_4px_rgba(239,68,68,0.4)]'}`} 
                            title={employee.status}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-[1px]">
                          {employee.employee_id} <span className="opacity-50 mx-0.5">•</span> {employee.designation}
                        </p>
                      </div>
                    </label>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">No employees available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {selectedEmployeeIds.length > 0 && (
            <div className="mt-5">
              <div className="flex flex-wrap gap-2">
                {selectedEmployees.map((emp) => (
                  <Badge
                    key={`badge-${emp.employee_id}`}
                    variant="outline"
                    className="px-2.5 py-1 text-xs font-medium bg-background/50 border-border/60 flex items-center gap-1.5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all cursor-pointer group shadow-sm"
                    onClick={() => handleEmployeeSelection(emp.employee_id, false)}
                  >
                    <span>{emp.first_name} {emp.last_name}</span>
                    <X className="w-3 h-3 text-muted-foreground group-hover:text-destructive transition-colors" />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {viewMode === "cards" && selectedEmployees.length > 0 && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <UserRoundCheck className="h-4 w-4 text-primary" />
            Selected employee details ({selectedEmployees.length})
          </div>
          {selectedEmployees.map((employee) => (
            <div key={`card-container-${employee.employee_id}`} className="space-y-6 animate-in fade-in duration-500">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <h2 className="text-xl font-bold text-foreground">
                  {employee.first_name} {employee.last_name}
                </h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(employee)}>
                    <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleStatus(employee)}>
                    <Power className="w-3.5 h-3.5 mr-2" />
                    {employee.status === "active" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getEmployeeSections(employee).map((section, i) => (
                  <Card key={`${employee.employee_id}-${section.title}`} className="glass-card border-border/60 overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <section.icon className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-foreground">{section.title}</h3>
                      </div>
                      <div className="space-y-3">
                        {section.fields.map((f) => (
                          <div key={`${employee.employee_id}-${section.title}-${f.label}`}>
                            {renderDetail(f.label, f.value)}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === "cards" && selectedEmployees.length === 0 && (
        <Card className="glass-card border-border/60">
          <CardContent className="p-4 text-sm text-muted-foreground">
            Select one or more employees above to view full details in cards.
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {viewMode === "table" && (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 font-medium text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Employee</span>
                      <div className="relative">
                        <button
                          onClick={() => setShowSortDropdown(!showSortDropdown)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors p-1 rounded hover:bg-accent"
                          title="Sort options"
                        >
                          <ArrowDownAZ className="w-4 h-4" />
                        </button>
                        {showSortDropdown && (
                          <div className="absolute left-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-50 min-w-[160px]">
                            <button
                              onClick={() => {
                                setSortBy('name');
                                setSortOrder('asc');
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                            >
                              <ArrowUp className="w-3 h-3" />
                              Sort by Name (A-Z)
                            </button>
                            <button
                              onClick={() => {
                                setSortBy('name');
                                setSortOrder('desc');
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                            >
                              <ArrowDown className="w-3 h-3" />
                              Sort by Name (Z-A)
                            </button>
                            <div className="border-t border-border my-1"></div>
                            <button
                              onClick={() => {
                                setSortBy('id');
                                setSortOrder('asc');
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                            >
                              <ArrowUp className="w-3 h-3" />
                              Sort by ID (Ascending)
                            </button>
                            <button
                              onClick={() => {
                                setSortBy('id');
                                setSortOrder('desc');
                                setShowSortDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm transition-colors flex items-center gap-2"
                            >
                              <ArrowDown className="w-3 h-3" />
                              Sort by ID (Descending)
                            </button>
                          </div>
                        )}
                      </div>
                      {sortBy && (
                        <span className="text-xs text-muted-foreground">
                          ({sortBy === 'name' ? 'Name' : 'ID'} {sortOrder === 'asc' ? '↑' : '↓'})
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Profile</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Gross Salary</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Base Salary</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">HRA</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Other Allowance</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Special Pay</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">Incentive</th>
                  <th className="text-right p-4 font-medium text-muted-foreground">PF Amount</th>
                  <th className="text-center p-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {paginated.map((emp) => (
                    <motion.tr
                      key={emp.employee_id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors"
                    >
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${emp.status === "active" ? "bg-emerald-500" : "bg-red-500"}`}
                              title={emp.status === "active" ? "Active" : "Inactive"}
                            />
                            <div className="font-medium text-foreground">{emp.first_name} {emp.last_name}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">{emp.employee_id}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {(() => {
                            const completion = calculateProfileCompletion(emp);
                            if (completion.level === 'complete') {
                              return <CheckCircle2 className="w-5 h-5 text-success" title={`Profile Complete (${completion.filledCount}/${completion.totalCount} fields)`} />;
                            } else if (completion.level === 'partial') {
                              return <AlertCircle className="w-5 h-5 text-warning" title={`Partially Complete (${completion.filledCount}/${completion.totalCount} fields)`} />;
                            } else {
                              return <MinusCircle className="w-5 h-5 text-destructive" title={`Incomplete (${completion.filledCount}/${completion.totalCount} fields)`} />;
                            }
                          })()}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {grossDisplay(emp)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.base_salary)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.hra)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.other_allowance)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.special_pay)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.incentive)}
                      </td>
                      <td className="p-4 text-right font-mono text-foreground">
                        {displayCurrency(emp.pf_amount)}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(emp)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(emp)}>
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                  {!loading && paginated.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-muted-foreground">No employees found</td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === "table" && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Current Unpaid Incentive Balance</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(ledgerSummary.totalBalance)}</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Total Paid Out</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(ledgerSummary.totalPaidOut)}</div>
          </CardContent>
        </Card>
        <Card className="glass-card border-border/60">
          <CardContent className="p-5">
            <div className="text-xs text-muted-foreground">Last Payout Date</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{ledgerSummary.latestPayoutDate || "-"}</div>
          </CardContent>
        </Card>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Incentive Ledger</h3>
            <p className="text-xs text-muted-foreground mt-1">Track deduction and payout transactions with running balance.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const result = await api.recalculateLedgerTotals();
                  toast({
                    title: "Success",
                    description: `Recalculated ${result.updatedCount} ledger entries`,
                  });
                  loadIncentiveLedger();
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to recalculate totals",
                    variant: "destructive",
                  });
                }
              }}
            >
              Recalculate Totals
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setPayoutOpen(true);
                setPayoutDate(new Date().toISOString().slice(0, 10));
              }}
              className="gradient-primary text-primary-foreground border-0"
            >
              Pay Incentive
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Ledger ID</th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  <button
                    onClick={() => {
                      if (ledgerSortBy === 'employee') {
                        setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setLedgerSortBy('employee');
                        setLedgerSortOrder('asc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Employee
                    {ledgerSortBy === 'employee' ? (
                      ledgerSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">
                  <button
                    onClick={() => {
                      if (ledgerSortBy === 'date') {
                        setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setLedgerSortBy('date');
                        setLedgerSortOrder('asc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Month
                    {ledgerSortBy === 'date' ? (
                      ledgerSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="text-left p-3 font-medium text-muted-foreground">Type</th>
                <th className="text-right p-3 font-medium text-muted-foreground">
                  <button
                    onClick={() => {
                      if (ledgerSortBy === 'amount') {
                        setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setLedgerSortBy('amount');
                        setLedgerSortOrder('asc');
                      }
                    }}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Amount
                    {ledgerSortBy === 'amount' ? (
                      ledgerSortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    ) : (
                      <ArrowUpDown className="w-4 h-4 opacity-50" />
                    )}
                  </button>
                </th>
                <th className="text-right p-3 font-medium text-muted-foreground">Running Balance</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Transaction Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Reference</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Created At</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((entry) => {
                return (
                  <tr key={entry.ledger_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-mono text-foreground">{entry.ledger_id}</td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{entry.employee_name || "-"}</div>
                      <div className="text-xs text-muted-foreground">{entry.employee_id}</div>
                    </td>
                    <td className="p-3 text-foreground">{`${String(entry.month).padStart(2, "0")}/${entry.year}`}</td>
                    <td className="p-3 text-foreground capitalize">{entry.entry_type}</td>
                    <td className="p-3 text-right font-mono text-foreground">{displayCurrency(entry.amount)}</td>
                    <td className="p-3 text-right font-mono text-foreground font-semibold">{displayCurrency(entry.running_balance)}</td>
                    <td className="p-3 text-center">
                      <Badge className={entry.status === "paid" ? "bg-success/10 text-success border-0" : entry.status === "partially_paid" ? "bg-warning/10 text-warning border-0" : "bg-muted text-foreground border-0"}>
                        {entry.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-3 text-foreground">{entry.transaction_date || "-"}</td>
                    <td className="p-3 text-foreground">{entry.reference || "-"}</td>
                    <td className="p-3 text-muted-foreground">{entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}</td>
                  </tr>
                );
              })}
              {!ledgerLoading && filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">No incentive ledger entries found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          
          {/* Modern Progress Bar */}
          <div className="mb-8">
            <div className="relative">
              <div className="absolute top-[19px] left-[19px] right-[19px] h-0.5 bg-muted"></div>
              <div 
                className="absolute top-[19px] left-[19px] h-0.5 bg-primary transition-all duration-300"
                style={{ width: `${((formStep - 1) / 3) * (100 - (38 / 9))}%` }}
              ></div>
              <div className="relative flex justify-between">
                {[
                  { step: 1, label: "Personal", icon: User },
                  { step: 2, label: "Employment", icon: Building },
                  { step: 3, label: "Bank", icon: CreditCard },
                  { step: 4, label: "Salary", icon: Calendar },
                ].map(({ step, label, icon: Icon }) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setFormStep(step)}
                    className="flex flex-col items-center group -m-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      step <= formStep
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : "bg-muted text-muted-foreground group-hover:bg-muted-80"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                      step <= formStep ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                    }`}>
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            <AnimatePresence mode="wait">
              {formStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Employee ID</Label>
                        <Input
                          value={formData.employee_id || ""}
                          onChange={(e) => handleInputChange("employee_id", e.target.value)}
                          placeholder={editing ? "Employee ID" : "Auto-generated"}
                          disabled={!editing}
                          className="h-11"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">First Name *</Label>
                          <Input 
                            value={formData.first_name || ""}
                            onChange={(e) => handleInputChange("first_name", e.target.value)}
                            required 
                            className="h-11" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Last Name *</Label>
                          <Input 
                            value={formData.last_name || ""}
                            onChange={(e) => handleInputChange("last_name", e.target.value)}
                            required 
                            className="h-11" 
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Company Email *</Label>
                        <Input 
                          value={formData.company_email || ""}
                          onChange={(e) => handleInputChange("company_email", e.target.value)}
                          type="email" 
                          required 
                          className="h-11" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Phone *</Label>
                        <Input 
                          value={formData.phone || ""}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          required
                          className="h-11" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Date of Birth</Label>
                        <Input 
                          value={formData.date_of_birth || ""}
                          onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
                          type="date" 
                          className="h-11" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Gender</Label>
                        <Input 
                          value={formData.gender || ""}
                          onChange={(e) => handleInputChange("gender", e.target.value)}
                          className="h-11" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Aadhaar Number *</Label>
                        <Input 
                          value={formData.aadhaar_number || ""}
                          onChange={(e) => handleInputChange("aadhaar_number", e.target.value)}
                          required
                          className="h-11" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">PAN Number *</Label>
                        <Input 
                          value={formData.pan_number || ""}
                          onChange={(e) => handleInputChange("pan_number", e.target.value)}
                          required
                          className="h-11" 
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {formStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Employee Type *</Label>
                      <select
                        value={formData.employee_type || ""}
                        onChange={(e) => handleInputChange("employee_type", e.target.value)}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select employee type</option>
                        <option value="Full Time">Full Time</option>
                        <option value="Intern">Intern</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Designation *</Label>
                      <select
                        value={formData.designation || ""}
                        onChange={(e) => handleInputChange("designation", e.target.value)}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Select designation</option>
                        {uniqueDesignations.map((designation) => (
                          <option key={designation} value={designation}>
                            {designation}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Date of Joining</Label>
                      <Input 
                        value={formData.date_of_joining || ""}
                        onChange={(e) => handleInputChange("date_of_joining", e.target.value)}
                        type="date" 
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">PF Number</Label>
                      <Input 
                        value={formData.pf_number || ""}
                        onChange={(e) => handleInputChange("pf_number", e.target.value)}
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <select
                        value={formData.status || "active"}
                        onChange={(e) => handleInputChange("status", e.target.value)}
                        className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {formStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bank Name</Label>
                      <Input 
                        value={formData.bank_name || ""}
                        onChange={(e) => handleInputChange("bank_name", e.target.value)}
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Account Number</Label>
                      <Input 
                        value={formData.account_number || ""}
                        onChange={(e) => handleInputChange("account_number", e.target.value)}
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">IFSC Code</Label>
                      <Input 
                        value={formData.ifsc_code || ""}
                        onChange={(e) => handleInputChange("ifsc_code", e.target.value)}
                        className="h-11" 
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {formStep === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Base Salary (₹)</Label>
                      <Input 
                        value={formData.base_salary || ""}
                        onChange={(e) => handleInputChange("base_salary", e.target.value)}
                        type="number" 
                        required 
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">HRA (₹)</Label>
                      <Input 
                        value={formData.hra || ""}
                        onChange={(e) => handleInputChange("hra", e.target.value)}
                        type="number" 
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Other Allowance (₹)</Label>
                      <Input 
                        value={formData.other_allowance || ""}
                        onChange={(e) => handleInputChange("other_allowance", e.target.value)}
                        type="number" 
                        className="h-11" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Special Pay (₹)</Label>
                      <Input 
                        value={formData.special_pay || ""}
                        onChange={(e) => handleInputChange("special_pay", e.target.value)}
                        type="number" 
                        className="h-11" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Monthly Incentive Deduction (₹)</Label>
                      <Input 
                        value={formData.incentive || ""}
                        onChange={(e) => handleInputChange("incentive", e.target.value)}
                        type="number" 
                        className="h-11" 
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Amount deducted monthly from basic salary</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">PF Amount (₹)</Label>
                      <Input 
                        value={formData.pf_amount || ""}
                        onChange={(e) => handleInputChange("pf_amount", e.target.value)}
                        type="number" 
                        className="h-11" 
                        placeholder="0"
                      />
                      <p className="text-xs text-muted-foreground">Provident Fund contribution amount</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-border/60">
              <div>
                {formStep > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setFormStep(formStep - 1)}
                    className="h-11 px-6"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Previous
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setModalOpen(false)}
                  className="h-11 px-6"
                >
                  Cancel
                </Button>
                {formStep < 4 ? (
                  <Button 
                    type="button" 
                    onClick={() => setFormStep(formStep + 1)}
                    className="h-11 px-6 gradient-primary text-primary-foreground border-0"
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button 
                    type="button"
                    onClick={handleSave}
                    disabled={!formData.employee_type || !formData.designation || !formData.base_salary}
                    className="h-11 px-6 gradient-primary text-primary-foreground border-0"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {editing ? "Save Changes" : "Create Employee"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={payoutOpen} onOpenChange={setPayoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Incentive Payout</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleLedgerSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <select
                value={payoutEmployeeId}
                onChange={(e) => setPayoutEmployeeId(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">Select employee</option>
                {payoutEmployeeOptions.map((item) => (
                  <option key={item.employee.employee_id} value={item.employee.employee_id}>
                    {`${item.employee.first_name} ${item.employee.last_name} (${item.employee.employee_id}) - ${formatCurrency(item.balance)}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Payout Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Payout Date</Label>
              <Input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={payoutReference}
                onChange={(e) => setPayoutReference(e.target.value)}
                placeholder="e.g. Mar settlement"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPayoutOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={ledgerSaving}>
                {ledgerSaving ? "Saving..." : "Record Payout"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
