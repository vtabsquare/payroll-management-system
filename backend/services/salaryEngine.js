/**
 * Round to 2 decimal places for currency calculations.
 */
function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Calculate salary using business logic:
 * 1. Calculate full monthly gross (base + hra + other + special + incentive)
 * 2. Apply attendance proration to the entire gross amount
 * 3. Subtract fixed incentive deduction from attendance-adjusted gross
 *
 * Input:
 * - basic: base salary from employee record
 * - hra: HRA from employee record
 * - other_allowance: other allowance from employee record
 * - special_pay: special pay from employee record
 * - incentive: employee-specific monthly incentive deduction amount
 * - working_days: total working days in month
 * - paid_days: actual paid days for employee
 * - extra_days: additional days to pay (optional)
 * - incentive_payout: optional accumulated incentive payout (admin-controlled)
 *
 * Output:
 * - basic_salary, hra, other_allowance, special_pay: individual prorated components
 * - incentive_deduction: FIXED amount (not prorated)
 * - gross_salary: attendance-adjusted gross (monthly gross × proration factor)
 * - net_salary: gross - incentive_deduction + incentive_payout
 */
function calculateSalary(input) {
  const workingDays = Number(input.working_days);
  const paidDays = Number(input.paid_days);
  const extraDays = Number(input.extra_days || 0);

  if (!Number.isFinite(workingDays) || workingDays <= 0) {
    throw new Error("working_days must be greater than 0");
  }

  const normalizedPaidDays = Math.min(Math.max(paidDays, 0), workingDays);
  const normalizedExtraDays = Math.max(extraDays, 0);
  const salaryFactor = normalizedPaidDays / workingDays;
  const extraFactor = normalizedExtraDays / workingDays;

  // Get base amounts
  const basicBase = Number(input.basic || input.base_salary || 0);
  const hraBase = Number(input.hra || 0);
  const otherBase = Number(input.other_allowance || 0);
  const specialBase = Number(input.special_pay || 0);
  const incentiveBase = Number(input.incentive || 0);

  // Step 1: Calculate FULL MONTHLY GROSS (including incentive)
  const monthlyGross = roundCurrency(basicBase + hraBase + otherBase + specialBase + incentiveBase);

  // Step 2: Apply attendance proration to ENTIRE GROSS
  const attendanceAdjustedGross = roundCurrency(monthlyGross * salaryFactor);
  
  // Handle extra days if present
  const extraGross = roundCurrency(monthlyGross * extraFactor);
  const grossSalary = roundCurrency(attendanceAdjustedGross + extraGross);

  // Calculate individual prorated components for breakdown display
  const basicProrated = roundCurrency(basicBase * salaryFactor);
  const hraProrated = roundCurrency(hraBase * salaryFactor);
  const otherProrated = roundCurrency(otherBase * salaryFactor);
  const specialProrated = roundCurrency(specialBase * salaryFactor);

  const basicExtra = roundCurrency(basicBase * extraFactor);
  const hraExtra = roundCurrency(hraBase * extraFactor);
  const otherExtra = roundCurrency(otherBase * extraFactor);
  const specialExtra = roundCurrency(specialBase * extraFactor);

  const basicTotal = roundCurrency(basicProrated + basicExtra);
  const hraTotal = roundCurrency(hraProrated + hraExtra);
  const otherTotal = roundCurrency(otherProrated + otherExtra);
  const specialTotal = roundCurrency(specialProrated + specialExtra);

  // Step 3: Fixed incentive deduction (NOT prorated)
  const incentiveDeduction = roundCurrency(incentiveBase);

  // Incentive payout (admin-controlled)
  const incentivePayout = roundCurrency(Number(input.incentive_payout || 0));

  // Step 4: Calculate Net Pay
  const netSalary = roundCurrency(grossSalary - incentiveDeduction + incentivePayout);

  return {
    salary_factor: roundCurrency(salaryFactor),
    extra_days: roundCurrency(normalizedExtraDays),
    basic_salary: basicTotal,
    hra: hraTotal,
    other_allowance: otherTotal,
    special_pay: specialTotal,
    incentive_deduction: incentiveDeduction,
    incentive_payout: incentivePayout,
    gross_salary: grossSalary,
    net_salary: netSalary,
  };
}

module.exports = {
  calculateSalary,
  roundCurrency,
};
