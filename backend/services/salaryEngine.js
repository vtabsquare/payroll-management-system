/**
 * Round to 2 decimal places for currency calculations.
 */
function roundCurrency(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Calculate salary with proration and dynamic incentive deduction logic.
 *
 * Input:
 * - basic: base salary from employee record
 * - hra: HRA from employee record (fixed component, NOT calculated)
 * - other_allowance: other allowance from employee record
 * - special_pay: special pay from employee record
 * - incentive: employee-specific monthly incentive deduction amount
 * - working_days: total working days in month
 * - paid_days: actual paid days for employee
 * - extra_days: additional days to pay (optional)
 * - incentive_payout: optional accumulated incentive payout (admin-controlled)
 *
 * Output:
 * - All prorated components (including incentive deduction)
 * - incentive_deduction: prorated employee-specific incentive
 * - incentive_payout: passed through if provided
 * - gross_salary: sum of all prorated components INCLUDING incentive deduction
 * - net_salary: gross - incentive_deduction + incentive_payout
 *
 * Note: Gross salary now includes incentive deduction to ensure attendance/LOP
 * calculations are based on the full salary structure. The incentive is still
 * deducted at the net salary stage.
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

  // Prorate all components
  const basicBase = Number(input.basic || input.base_salary || 0);
  const hraBase = Number(input.hra || 0);
  const otherBase = Number(input.other_allowance || 0);
  const specialBase = Number(input.special_pay || 0);

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

  // Dynamic incentive deduction: use employee-specific incentive
  // This is prorated based on attendance like other components
  const employeeIncentiveBase = Number(input.incentive || 0);
  const incentiveProrated = roundCurrency(employeeIncentiveBase * salaryFactor);
  const incentiveExtra = roundCurrency(employeeIncentiveBase * extraFactor);
  const incentiveDeduction = roundCurrency(incentiveProrated + incentiveExtra);

  // Incentive payout (admin-controlled, passed in)
  const incentivePayout = roundCurrency(Number(input.incentive_payout || 0));

  // Gross salary: sum of all prorated components INCLUDING incentive deduction
  // This ensures attendance and LOP calculations are based on the full gross including incentive
  const grossSalary = roundCurrency(basicTotal + hraTotal + otherTotal + specialTotal + incentiveDeduction);

  // Net salary: gross - incentive_deduction + incentive_payout
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
