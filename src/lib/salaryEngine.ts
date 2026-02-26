export interface SalaryInput {
  base_salary: number;
  other_allowance: number;
  special_pay: number;
  incentive_type: "fixed" | "prorated";
  incentive_amount: number;
  working_days: number;
  paid_days: number;
}

export interface SalaryBreakdown {
  proration: number;
  basic: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  incentive: number;
  gross: number;
  deductions: number;
  net: number;
}

export function calculateSalary(input: SalaryInput): SalaryBreakdown {
  const proration = input.paid_days / input.working_days;

  const basic = Math.round(input.base_salary * proration);
  const hra = Math.round(basic * 0.30);
  const other_allowance = Math.round(input.other_allowance * proration);
  const special_pay = Math.round(input.special_pay * proration);

  const incentive =
    input.incentive_type === "fixed"
      ? input.incentive_amount
      : Math.round(input.incentive_amount * proration);

  const gross = basic + hra + other_allowance + special_pay + incentive;
  const deductions = Math.round(basic * 0.10);
  const net = gross - deductions;

  return { proration, basic, hra, other_allowance, special_pay, incentive, gross, deductions, net };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
