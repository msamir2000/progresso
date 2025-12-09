/* eslint-disable no-unused-vars */
import { RPSWeeklyLimit } from "@/api/entities";

// Helper to safely parse YYYY-MM-DD strings as UTC dates to avoid timezone issues.
const parseDateUTC = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }
  // Ensure we only have the date part.
  const dateOnly = dateString.split('T')[0];
  // Check for valid YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return null;
  }
  // Append T00:00:00Z to treat as UTC midnight.
  const d = new Date(`${dateOnly}T00:00:00Z`);
  // Check if the resulting date is valid.
  if (isNaN(d.getTime())) {
    return null;
  }
  return d;
};

// Helper to round a number to 2 decimal places
const roundToTwo = (num) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
};

// Function to get the appropriate RPS weekly limit based on a date
const getRPSWeeklyLimit = async (date) => {
  try {
    const limits = await RPSWeeklyLimit.list('-year'); // Order by year descending
    
    if (!limits || limits.length === 0) {
        console.warn('No RPS weekly limits found. Using default.');
        return 700; // Default fallback if no limits in DB
    }

    if (!date) {
      // If no date provided, use the most recent limit
      return limits[0]?.weekly_limit || 700; 
    }

    const claimDate = parseDateUTC(date);
    if (!claimDate) {
        console.warn('Invalid claim date provided to getRPSWeeklyLimit. Using most recent limit.');
        return limits[0]?.weekly_limit || 700;
    }
    
    // Find the limit for the appropriate date
    // RPS limits typically change in April. We need to find the limit that was effective at or before the claim date.
    for (const limit of limits) {
      const effectiveDate = parseDateUTC(limit.effective_date);
      
      // If the claim date is on or after the effective date of this limit, and this limit is applicable to the claim year or earlier
      // The limits are sorted descending by year, so the first match is the most recent applicable one.
      if (effectiveDate && claimDate.getTime() >= effectiveDate.getTime()) {
        return limit.weekly_limit;
      }
    }
    
    // Fallback to the earliest available limit if no specific one is found (e.g., claim date is before all stored limits)
    return limits[limits.length - 1]?.weekly_limit || 700;
  } catch (error) {
    console.error('Error fetching RPS weekly limit:', error);
    return 700; // Default fallback
  }
};

export const calculateWageArrears = async (employee, companySettings) => {
  const weeklyWage = (parseFloat(employee.yearly_salary) || 0) / 52;
  const dailyWage = weeklyWage / (parseInt(employee.work_days_per_week, 10) || 5);
  
  let wageArrearsDays = 0;
  if (employee.date_last_paid && employee.end_date) {
    const lastPaidDate = parseDateUTC(employee.date_last_paid);
    const endDate = parseDateUTC(employee.end_date);
    
    if (lastPaidDate && endDate && lastPaidDate.getTime() < endDate.getTime()) {
      const diffTime = endDate.getTime() - lastPaidDate.getTime();
      wageArrearsDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }
  }

  const totalWageArrears = wageArrearsDays * dailyWage;
  
  // Calculate preferential and unsecured portions
  // Wage arrears have a preferential limit capped at £800 per employee.
  const preferentialWageArrears = Math.min(totalWageArrears, 800);
  const unsecuredWageArrears = Math.max(0, totalWageArrears - preferentialWageArrears);

  return {
    wage_arrears_preferential: preferentialWageArrears,
    wage_arrears_unsecured: unsecuredWageArrears,
    total_wage_arrears: totalWageArrears,
    wage_arrears_days: wageArrearsDays
  };
};

export const calculateHolidayPayEntitlement = async (employee, companySettings) => {
  let holidayPayPreferential = 0;
  let holidayPayUnsecured = 0;
  let totalHolidayPay = 0;

  const holidayEntitlement = parseFloat(employee.holiday_entitlement) || 28;
  const daysTaken = parseFloat(employee.days_taken) || 0;
  const daysCarriedForward = parseFloat(employee.days_carried_forward) || 0;
  
  const yearlySalary = parseFloat(employee.yearly_salary) || 0;
  const workDaysPerWeek = parseInt(employee.work_days_per_week, 10) || 5;
  const weeklyWage = yearlySalary / 52;
  const dailyRate = weeklyWage / workDaysPerWeek;
  
  const holidayYearStartDate = parseDateUTC(employee.holiday_year_start_date);
  const endDate = parseDateUTC(employee.end_date);

  if (holidayYearStartDate && endDate) {
    // Adjust holiday year start to the year of the end date for correct pro-rata calculation
    let currentHolidayYearStart = new Date(holidayYearStartDate);
    currentHolidayYearStart.setUTCFullYear(endDate.getUTCFullYear());
    if (endDate.getTime() < currentHolidayYearStart.getTime()) {
      currentHolidayYearStart.setUTCFullYear(endDate.getUTCFullYear() - 1);
    }
    
    const timeInHolidayYear = endDate.getTime() - currentHolidayYearStart.getTime();
    const daysInHolidayYear = Math.max(0, timeInHolidayYear / (1000 * 3600 * 24));
    
    // Pro-rata entitlement based on calendar days in holiday year up to end date
    // Assuming 365 days in a holiday year for pro-rata calculation
    const proRataEntitlement = (daysInHolidayYear / 365) * holidayEntitlement;
    
    const accruedDays = proRataEntitlement + daysCarriedForward;
    const outstandingDays = accruedDays - daysTaken;
    
    if (outstandingDays > 0) {
      totalHolidayPay = outstandingDays * dailyRate;
      // Holiday pay is entirely preferential (no £800 cap applies to holiday pay under UK law)
      holidayPayPreferential = totalHolidayPay;
      holidayPayUnsecured = 0;
    }
  }

  return {
    holiday_pay_preferential: holidayPayPreferential,
    holiday_pay_unsecured: holidayPayUnsecured,
    total_holiday_pay: totalHolidayPay
  };
};

export const calculateNoticePayEntitlement = async (employee, companySettings) => {
  let notice_pay_weeks = 0;
  let notice_pay_preferential = 0;
  let notice_pay_unsecured = 0;
  let total_notice_pay = 0;

  if (!employee.start_date || !employee.end_date) {
    return {
      notice_pay_weeks,
      notice_pay_preferential,
      notice_pay_unsecured,
      total_notice_pay
    };
  }

  const startDate = parseDateUTC(employee.start_date);
  const endDate = parseDateUTC(employee.end_date);

  if (!startDate || !endDate) {
    return {
      notice_pay_weeks,
      notice_pay_preferential,
      notice_pay_unsecured,
      total_notice_pay
    };
  }

  const yearsOfService = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const fullYearsOfService = Math.floor(yearsOfService);

  // Check if contractual claim with contractual notice period
  if (employee.claim_type === 'contractual' && employee.contractual_notice_period) {
    notice_pay_weeks = parseFloat(employee.contractual_notice_period);
    
    // For contractual notice, use monthly wage
    const monthlyWage = (parseFloat(employee.yearly_salary) || 0) / 12;
    total_notice_pay = (notice_pay_weeks / 4.33) * monthlyWage; // Convert weeks to months (4.33 weeks per month average)
  } else {
    // Statutory notice is 1 week per year of service, up to a max of 12 weeks
    // Min notice is 1 week if served for 1 month or more
    if (yearsOfService >= (1/12)) { // 1 month
      notice_pay_weeks = 1;
      if (fullYearsOfService >= 2) { // 2 years or more
          notice_pay_weeks = Math.min(12, fullYearsOfService);
      }
    }

    // Use 12 week average pay for notice pay calculation
    const weeklyWage = parseFloat(employee.average_weekly_pay_12_weeks) || (parseFloat(employee.yearly_salary) || 0) / 52;
    total_notice_pay = notice_pay_weeks * weeklyWage;
  }

  if (total_notice_pay > 0) {
    // Notice Pay is entirely unsecured under UK insolvency law
    notice_pay_preferential = 0;
    notice_pay_unsecured = total_notice_pay;
  }

  return {
    notice_pay_weeks,
    notice_pay_preferential,
    notice_pay_unsecured,
    total_notice_pay
  };
};

export const calculateRedundancyPayEntitlement = async (employee, companySettings) => {
  let redundancy_pay_weeks = 0;
  let redundancy_pay_unsecured = 0;

  if (!employee.start_date || !employee.end_date || !employee.date_of_birth) {
    return {
      redundancy_pay_weeks,
      redundancy_pay_unsecured
    };
  }

  const startDate = parseDateUTC(employee.start_date);
  const endDate = parseDateUTC(employee.end_date);
  const birthDate = parseDateUTC(employee.date_of_birth);

  if (!startDate || !endDate || !birthDate) {
    return {
      redundancy_pay_weeks,
      redundancy_pay_unsecured
    };
  }

  // Calculate age at dismissal
  const ageAtDismissalYears = (endDate.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  // Calculate years of service (capped at 20 for redundancy calculation)
  const totalYearsOfService = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const yearsOfService = Math.min(20, totalYearsOfService);
  const fullYearsOfService = Math.floor(yearsOfService);

  // Must be at least 18 at dismissal and have at least 2 complete years of service
  if (ageAtDismissalYears < 18 || fullYearsOfService < 2) {
    return {
      redundancy_pay_weeks,
      redundancy_pay_unsecured
    };
  }

  // Calculate redundancy weeks based on age during each year of service
  let totalRedundancyWeeksRaw = 0;
  
  for (let i = 0; i < fullYearsOfService; i++) {
    // Calculate the age at the END of each year of service, counting backwards from dismissal
    // i=0 is the earliest year, i=fullYearsOfService-1 is the most recent year
    const ageForThisYearOfService = Math.floor(ageAtDismissalYears) - (fullYearsOfService - 1 - i);
    
    // UK Statutory Redundancy Pay rates:
    // - Age 41 and over: 1.5 weeks' pay for each full year
    // - Age 22 to 40: 1 week's pay for each full year  
    // - Under 22: 0.5 week's pay for each full year
    if (ageForThisYearOfService >= 41) {
      totalRedundancyWeeksRaw += 1.5;
    } else if (ageForThisYearOfService >= 22) {
      totalRedundancyWeeksRaw += 1;
    } else if (ageForThisYearOfService >= 18) {
      totalRedundancyWeeksRaw += 0.5;
    }
  }

  // Maximum 30 weeks redundancy pay (already limited by 20 years max service)
  redundancy_pay_weeks = Math.min(30, totalRedundancyWeeksRaw);

  // Get RPS weekly limit for the employee's end date
  const rpsWeeklyLimit = await getRPSWeeklyLimit(employee.end_date);
  
  // Calculate weekly wage - use 12-week average if available, otherwise yearly salary
  const weeklyWage = parseFloat(employee.average_weekly_pay_12_weeks) || (parseFloat(employee.yearly_salary) || 0) / 52;
  
  // Apply RPS weekly limit cap (statutory redundancy is capped at the RPS limit)
  const cappedWeeklyWage = Math.min(weeklyWage, rpsWeeklyLimit);
  
  // Redundancy pay is entirely unsecured in insolvency
  redundancy_pay_unsecured = redundancy_pay_weeks * cappedWeeklyWage;

  return {
    redundancy_pay_weeks,
    redundancy_pay_unsecured
  };
};

export const calculatePensionContributions = async (employee, companySettings) => {
  let pension_contributions_preferential = 0;
  let pension_contributions_unsecured = 0;
  let total_pension_contributions = 0;

  // Only calculate pension if employee is opted in
  if (employee.pension_opted_in !== 'yes') {
    return {
      pension_contributions_preferential,
      pension_contributions_unsecured,
      total_pension_contributions
    };
  }

  const lastPaidDate = parseDateUTC(employee.date_contributions_last_paid);
  const endDate = parseDateUTC(employee.end_date);

  if (!lastPaidDate || !endDate || lastPaidDate.getTime() >= endDate.getTime()) {
    return {
      pension_contributions_preferential,
      pension_contributions_unsecured,
      total_pension_contributions
    };
  }

  // Calculate wage arrears between date_contributions_last_paid and end_date
  const yearlySalary = parseFloat(employee.yearly_salary) || 0;
  const workDaysPerWeek = parseInt(employee.work_days_per_week, 10) || 5;
  
  if (yearlySalary === 0 || workDaysPerWeek === 0) {
    return {
      pension_contributions_preferential,
      pension_contributions_unsecured,
      total_pension_contributions
    };
  }
  
  const weeklyWage = yearlySalary / 52;
  const dailyWage = weeklyWage / workDaysPerWeek;
  
  // Calculate the number of days between last paid date and end date
  const timeDiff = endDate.getTime() - lastPaidDate.getTime();
  const daysOwed = Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
  
  // Calculate the wage due for this period
  const wagesDueForPeriod = daysOwed * dailyWage;

  // Get employer pension percentage
  const employerPensionPercent = parseFloat(employee.employer_pension_percent) || 0;

  if (employerPensionPercent > 0 && wagesDueForPeriod > 0) {
    const pensionAmount = wagesDueForPeriod * (employerPensionPercent / 100);
    // Pension contributions are entirely preferential under UK law
    pension_contributions_preferential = pensionAmount;
    pension_contributions_unsecured = 0;
    total_pension_contributions = pensionAmount;
  }

  return {
    pension_contributions_preferential,
    pension_contributions_unsecured,
    total_pension_contributions
  };
};

export const calculateEmployeeClaims = async (employee, companySettings) => {
  if (!employee || !employee.yearly_salary || !employee.start_date || !employee.end_date) {
    return {
      wage_arrears_preferential: 0,
      wage_arrears_unsecured: 0,
      total_wage_arrears: 0,
      wage_arrears_days: 0,
      holiday_pay_preferential: 0,
      holiday_pay_unsecured: 0,
      total_holiday_pay: 0,
      notice_pay_weeks: 0,
      notice_pay_preferential: 0,
      notice_pay_unsecured: 0,
      total_notice_pay: 0,
      redundancy_pay_weeks: 0,
      redundancy_pay_unsecured: 0,
      pension_contributions_preferential: 0,
      pension_contributions_unsecured: 0,
      total_pension_contributions: 0,
      total_preferential_claim: 0,
      total_unsecured_claim: 0
    };
  }

  try {
    const [
      wageArrears,
      holidayPay,
      noticePay,
      redundancyPay,
      pensionContributions
    ] = await Promise.all([
      calculateWageArrears(employee, companySettings),
      calculateHolidayPayEntitlement(employee, companySettings),
      calculateNoticePayEntitlement(employee, companySettings),
      calculateRedundancyPayEntitlement(employee, companySettings),
      calculatePensionContributions(employee, companySettings)
    ]);

    const totalPreferentialClaim = 
      (wageArrears.wage_arrears_preferential || 0) +
      (holidayPay.holiday_pay_preferential || 0) +
      (noticePay.notice_pay_preferential || 0) + 
      (pensionContributions.pension_contributions_preferential || 0);

    const totalUnsecuredClaim = 
      (wageArrears.wage_arrears_unsecured || 0) +
      (holidayPay.holiday_pay_unsecured || 0) + 
      (noticePay.notice_pay_unsecured || 0) +
      (redundancyPay.redundancy_pay_unsecured || 0) +
      (pensionContributions.pension_contributions_unsecured || 0);

    return {
      wage_arrears_preferential: roundToTwo(wageArrears.wage_arrears_preferential),
      wage_arrears_unsecured: roundToTwo(wageArrears.wage_arrears_unsecured),
      total_wage_arrears: roundToTwo(wageArrears.total_wage_arrears),
      wage_arrears_days: wageArrears.wage_arrears_days, // No rounding for days
      holiday_pay_preferential: roundToTwo(holidayPay.holiday_pay_preferential),
      holiday_pay_unsecured: roundToTwo(holidayPay.holiday_pay_unsecured),
      total_holiday_pay: roundToTwo(holidayPay.total_holiday_pay),
      notice_pay_weeks: roundToTwo(noticePay.notice_pay_weeks), // Rounding for consistency
      notice_pay_preferential: roundToTwo(noticePay.notice_pay_preferential),
      notice_pay_unsecured: roundToTwo(noticePay.notice_pay_unsecured),
      total_notice_pay: roundToTwo(noticePay.total_notice_pay),
      redundancy_pay_weeks: roundToTwo(redundancyPay.redundancy_pay_weeks), // Rounding for consistency
      redundancy_pay_unsecured: roundToTwo(redundancyPay.redundancy_pay_unsecured),
      pension_contributions_preferential: roundToTwo(pensionContributions.pension_contributions_preferential),
      pension_contributions_unsecured: roundToTwo(pensionContributions.pension_contributions_unsecured),
      total_pension_contributions: roundToTwo(pensionContributions.total_pension_contributions),
      total_preferential_claim: roundToTwo(totalPreferentialClaim),
      total_unsecured_claim: roundToTwo(totalUnsecuredClaim)
    };
  } catch (error) {
    console.error('Error calculating all claims:', error);
    throw error;
  }
};