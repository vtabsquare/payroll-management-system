function maskCurrency(value) {
  if (value === null || value === undefined || value === "") return value;
  return "₹*****";
}

function maskEmployeeSalaries(employee) {
  return {
    ...employee,
    base_salary: maskCurrency(employee.base_salary),
    hra: maskCurrency(employee.hra),
    other_allowance: maskCurrency(employee.other_allowance),
    special_pay: maskCurrency(employee.special_pay),
    incentive: maskCurrency(employee.incentive),
    pf_amount: maskCurrency(employee.pf_amount),
  };
}

function maskPayrollSalaries(payroll) {
  return {
    ...payroll,
    basic_salary: maskCurrency(payroll.basic_salary),
    hra: maskCurrency(payroll.hra),
    other_allowance: maskCurrency(payroll.other_allowance),
    special_pay: maskCurrency(payroll.special_pay),
    incentive_deduction: maskCurrency(payroll.incentive_deduction),
    incentive_payout: maskCurrency(payroll.incentive_payout),
    gross_salary: maskCurrency(payroll.gross_salary),
    net_salary: maskCurrency(payroll.net_salary),
  };
}

function maskIncentiveLedger(ledger) {
  return {
    ...ledger,
    amount: maskCurrency(ledger.amount),
    running_balance: maskCurrency(ledger.running_balance),
  };
}

function maskSalarySchedule(schedule) {
  return {
    ...schedule,
    salary: maskCurrency(schedule.salary),
  };
}

function maskSalaryNotification(notification) {
  return {
    ...notification,
    new_salary: maskCurrency(notification.new_salary),
  };
}

function maskSalaries(req, res, next) {
  // Admins and users with can_view_salaries permission see all data unmasked
  if (!req.user || req.user.can_view_salaries || req.user.role === 'admin') {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (data && typeof data === "object") {
      // For employee role: don't mask their own profile data
      if (data.profile && typeof data.profile === "object") {
        // Profile is always the logged-in user's own data, so don't mask it
        // Employees should see their own salary information
        return originalJson(data);
      }
      
      // For employee role: don't mask their own payroll records
      if (data.payroll && Array.isArray(data.payroll)) {
        // Payroll records are already filtered by canAccessRecord in the route
        // So employees only get their own records - don't mask them
        return originalJson(data);
      }
      
      // Mask other data types (employees list, ledger, etc.) for non-admin users
      if (data.employees && Array.isArray(data.employees)) {
        data.employees = data.employees.map(maskEmployeeSalaries);
      }
      if (data.employee && typeof data.employee === "object") {
        data.employee = maskEmployeeSalaries(data.employee);
      }
      if (data.generated && Array.isArray(data.generated)) {
        data.generated = data.generated.map(maskPayrollSalaries);
      }
      if (data.ledger && Array.isArray(data.ledger)) {
        data.ledger = data.ledger.map(maskIncentiveLedger);
      }
      if (data.schedule && Array.isArray(data.schedule)) {
        data.schedule = data.schedule.map(maskSalarySchedule);
      }
      if (data.notifications && Array.isArray(data.notifications)) {
        data.notifications = data.notifications.map(maskSalaryNotification);
      }
    }
    return originalJson(data);
  };

  next();
}

module.exports = { maskSalaries };
