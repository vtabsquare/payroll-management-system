export interface SalaryInput {
  basic: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  working_days: number;
  paid_days: number;
  incentive_payout?: number;
}

export interface SalaryBreakdown {
  salary_factor: number;
  basic_salary: number;
  hra: number;
  other_allowance: number;
  special_pay: number;
  incentive_deduction: number;
  incentive_payout: number;
  gross_salary: number;
  net_salary: number;
}

const MONTHLY_INCENTIVE_DEDUCTION = 1000;

function roundCurrency(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

export function calculateSalary(input: SalaryInput): SalaryBreakdown {
  const salaryFactor = input.paid_days / input.working_days;

  const basicProrated = roundCurrency(input.basic * salaryFactor);
  const hraProrated = roundCurrency(input.hra * salaryFactor);
  const otherProrated = roundCurrency(input.other_allowance * salaryFactor);
  const specialProrated = roundCurrency(input.special_pay * salaryFactor);

  // Incentive deduction: ₹1000, capped to not make basic negative
  const incentiveDeduction = roundCurrency(Math.min(MONTHLY_INCENTIVE_DEDUCTION, basicProrated));

  // Incentive payout from 6-month accumulation
  const incentivePayout = roundCurrency(input.incentive_payout || 0);

  // Gross salary: sum of all prorated components
  const grossSalary = roundCurrency(basicProrated + hraProrated + otherProrated + specialProrated);

  // Net salary: gross - incentive_deduction + incentive_payout
  const netSalary = roundCurrency(grossSalary - incentiveDeduction + incentivePayout);

  return {
    salary_factor: roundCurrency(salaryFactor),
    basic_salary: basicProrated,
    hra: hraProrated,
    other_allowance: otherProrated,
    special_pay: specialProrated,
    incentive_deduction: incentiveDeduction,
    incentive_payout: incentivePayout,
    gross_salary: grossSalary,
    net_salary: netSalary,
  };
}

export function formatCurrency(amount: number | string): string {
  // If the value is already a masked string, return it as-is
  if (typeof amount === 'string' && amount.includes('*')) {
    return amount;
  }
  
  // Convert to number and check for NaN
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) {
    return '₹*****';
  }
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(numAmount);
}
