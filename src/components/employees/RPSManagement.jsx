import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Info, FileSignature, Send, Plus, Trash2, PoundSterling, Save, AlertCircle, Loader2, Upload, CheckCircle, Download } from 'lucide-react';
import { Employee } from '@/api/entities';
import { Case } from '@/api/entities'; // Assuming a Case entity exists for updating case data
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { base44 } from '@/api/base44Client';

export default function RPSManagement({ caseId, caseData, onBack }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [payrollData, setPayrollData] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rp14aData, setRp14aData] = useState({
    employer_name: '',
    champ_case_reference: '',
    employees: []
  });

  const [rpsClaimData, setRpsClaimData] = useState({
    file_url: '',
    upload_date: '',
    employees: []
  });
  const [isUploadingRPS, setIsUploadingRPS] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Helper function to calculate years of service
  const calculateYearsOfService = (startDate, endDate) => {
    if (!startDate || !endDate) return 0; // Requires both start and end date
    const start = new Date(startDate);
    const end = new Date(endDate); // Always use end_date provided

    // Ensure valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn("Invalid date provided to calculateYearsOfService:", startDate, endDate);
      return 0;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    // Convert milliseconds to years, accounting for leap years approximately
    const yearsDiff = diffTime / (1000 * 60 * 60 * 24 * 365.25);
    return yearsDiff;
  };

  // Helper function to determine if employee qualifies for redundancy
  const qualifiesForRedundancy = (employee) => {
    const yearsOfService = calculateYearsOfService(employee.start_date, employee.end_date);
    return yearsOfService >= 2;
  };

  // Helper function to determine if employee qualifies for notice pay (1+ month service)
  const qualifiesForNoticePay = (employee) => {
    if (!employee.start_date || !employee.end_date) return false; // Requires both start and end date
    const start = new Date(employee.start_date);
    const end = new Date(employee.end_date); // Always use end_date provided

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.warn("Invalid date provided to qualifiesForNoticePay:", employee.start_date, employee.end_date);
      return false;
    }

    // Calculate approximate months difference
    const monthsDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44); // Average days per month
    return monthsDiff >= 1; // 1 month or more
  };

  // Helper function to calculate column 22e (total holiday entitlement at end date)
  const calculateColumn22e = (rp14aEmployee) => {
    const holidayYearStartStr = rp14aEmployee.holiday_year_start_date;
    const endDateStr = rp14aEmployee.employment_end_date;
    const annualEntitlement = parseFloat(rp14aEmployee.contracted_holiday_entitlement) || 28; // Default 28 days
    const carriedForward = parseFloat(rp14aEmployee.holiday_days_carried_forward) || 0;
    
    if (!holidayYearStartStr || !endDateStr) return 0;

    const holidayYearStart = new Date(holidayYearStartStr);
    const endDate = new Date(endDateStr);

    if (isNaN(holidayYearStart.getTime()) || isNaN(endDate.getTime())) {
      console.warn("Invalid date provided for holiday calculation:", holidayYearStartStr, endDateStr);
      return 0;
    }
    
    const daysDiff = (endDate.getTime() - holidayYearStart.getTime()) / (1000 * 60 * 60 * 24);
    
    // If end date is before holiday year start, return only carried forward (ensuring non-negative)
    if (daysDiff < 0) {
        return Math.max(0, carriedForward);
    }
    
    // Calculate accrued holiday (proportion of annual entitlement based on days worked)
    const daysInYear = 365.25; // Approximate for leap years
    const accruedHoliday = (daysDiff / daysInYear) * annualEntitlement;
    
    // Column 22e = Carried Forward (22c) + Accrued Holiday.
    const totalEntitlement = carriedForward + accruedHoliday;
    
    // Ensure the result is not negative, then round to nearest 0.5
    const nonNegativeTotal = Math.max(0, totalEntitlement);
    const roundedToHalf = Math.round(nonNegativeTotal * 2) / 2;
    
    return roundedToHalf;
  };

  // Effect to load employees initially and on caseId change
  useEffect(() => {
    loadEmployees();
  }, [caseId]);

  // Effect to reload employees when coming back to this view (e.g., component remounts)
  useEffect(() => {
    // This effect ensures employees are loaded when the component is first mounted or becomes visible.
    // The previous effect handles updates based on caseId.
    loadEmployees();
  }, []); // Empty dependency array means it runs once on mount

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const allEmployees = await Employee.list();
      const caseEmployees = allEmployees.filter(e => e.case_id === caseId);
      setEmployees(caseEmployees);
      // If an employee was previously selected, re-select them to update payrollData if needed
      if (selectedEmployee) {
        const updatedSelectedEmployee = caseEmployees.find(e => e.id === selectedEmployee.id);
        if (updatedSelectedEmployee) {
          handleEmployeeSelect(updatedSelectedEmployee.id); // Re-trigger selection logic with updated employee data
        } else {
          setSelectedEmployee(null);
          setPayrollData([]);
        }
      }
    } catch (error) {
      console.error('Failed to load employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmployeeSelect = async (employeeId) => {
    // Reload employees first to get the latest data
    try {
      const allEmployees = await Employee.list();
      const caseEmployees = allEmployees.filter(e => e.case_id === caseId);
      setEmployees(caseEmployees); // Update state with latest employee list

      const employee = caseEmployees.find(e => e.id === employeeId);
      setSelectedEmployee(employee);

      // Check if employee pay_type is exactly 'salaried' - if yes, initialize monthly data
      // For salaried employees, yearly_salary should always be present, but pay_type is the primary discriminator for data entry type.
      if (employee?.pay_type === 'salaried') {
        // Calculate monthly gross pay
        const monthlyGrossPay = (employee.yearly_salary / 12).toFixed(2);

        // If no payroll data, or existing data is weekly (no 'month' prop),
        // re-initialize to monthly data for the last 12 months based on appointment date.
        if (!employee?.payroll_data || employee.payroll_data.length === 0 || !employee.payroll_data[0].hasOwnProperty('month')) {
          // Get case appointment date to determine which months to show
          const appointmentDate = caseData?.appointment_date ? new Date(caseData.appointment_date) : new Date();
          const currentMonthIndex = appointmentDate.getMonth(); // 0-indexed
          const currentYear = appointmentDate.getFullYear();

          const initialData = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(currentYear, currentMonthIndex, 1); // Start from the 1st of the appointment month
            date.setMonth(date.getMonth() - i); // Subtract 'i' months to go backward in time

            return {
              month: date.getMonth() + 1, // 1-indexed month
              month_name: date.toLocaleString('en-GB', { month: 'long', year: 'numeric' }),
              pay_amount: monthlyGrossPay, // Auto-populate with calculated monthly pay
              bonus_commission: ''
            };
          }).reverse(); // Reverse to show oldest to newest (e.g., Jan 2023, Feb 2023, ..., Dec 2023)

          setPayrollData(initialData);
        } else {
          // Existing data is monthly, use it. Ensure bonus_commission exists for existing entries.
          setPayrollData(employee.payroll_data.map(item => ({
            ...item,
            bonus_commission: item.bonus_commission || '' // Ensure the field exists for older data
          })));
        }
      } else { // This branch handles non-salaried employees (e.g., 'variable_pay')
        // If employee has existing payroll data and it appears to be structured as weekly data (has 'week' property)
        if (employee?.payroll_data && employee.payroll_data.length > 0 && employee.payroll_data[0].hasOwnProperty('week')) {
          setPayrollData(employee.payroll_data);
        } else {
          // Otherwise (no data, or data is monthly/malformed for variable pay), initialize with 52 empty weekly rows.
          const initialData = Array.from({ length: 52 }, (_, i) => ({
            week: 52 - i, // Week 52, 51, ..., 1 (most recent first)
            pay_amount: ''
          }));
          setPayrollData(initialData);
        }
      }
    } catch (error) {
      console.error('Error loading employee:', error);
    }
  };

  const handlePayrollChange = (index, field, value) => {
    const updatedData = [...payrollData];
    updatedData[index][field] = value;
    setPayrollData(updatedData);
  };

  const handleAddWeek = () => {
    // This function is only relevant for variable pay employees
    if (selectedEmployee?.pay_type === 'salaried') return;

    // For variable pay, payrollData is ordered most recent first (descending week numbers)
    // Find the current highest week number, or default to 0 if no data
    const maxWeekNumber = payrollData.length > 0
      ? Math.max(...payrollData.map(w => w.week || 0))
      : 0;

    // Create a new week entry with the next week number, and add it to the beginning (most recent)
    const newWeek = {
      week: maxWeekNumber + 1,
      pay_amount: ''
    };
    setPayrollData([newWeek, ...payrollData]);
  };

  const handleRemoveWeek = (index) => {
    // This function is only relevant for variable pay employees
    if (selectedEmployee?.pay_type === 'salaried') return;

    const updatedData = payrollData.filter((_, i) => i !== index);
    setPayrollData(updatedData);
  };

  // Calculate average weekly pay according to UK guidance
  // Reference: https://www.gov.uk/government/publications/calculating-holiday-pay-for-workers-without-fixed-hours-or-pay
  const calculateAverageWeeklyPay = (employee, currentPayrollData) => {
    if (!employee || !currentPayrollData || currentPayrollData.length === 0) {
      return {
        avg12Week: { averagePay: 0, totalPay: 0, weeksConsidered: 0 },
        avg52Week: { averagePay: 0, totalPay: 0, weeksConsidered: 0 }
      };
    }

    const payType = employee.pay_type; // 'salaried' or 'variable_pay'

    // Helper to calculate average for a given period (12 or 52 weeks)
    const calculateForPeriod = (data, weeksInPeriod) => {
      let relevantData;
      let totalPay = 0;
      let weeksConsidered = 0;

      if (payType === 'salaried') {
        // For salaried, data is monthly, ordered oldest to newest (`.reverse()` in handleEmployeeSelect)
        // Convert weeks to approximate months (12 weeks ≈ 3 months, 52 weeks = 12 months)
        const monthsToConsider = weeksInPeriod === 12 ? 3 : 12;
        
        // Get the most recent 'monthsToConsider' entries
        relevantData = data.slice(-monthsToConsider); 

        // Filter out months with zero total pay (base + bonus)
        const monthsWithPay = relevantData.filter(m => {
          const basePay = parseFloat(m.pay_amount) || 0;
          const bonusComm = parseFloat(m.bonus_commission) || 0;
          return (basePay + bonusComm) > 0;
        });

        if (monthsWithPay.length === 0) {
          return { averagePay: 0, totalPay: 0, weeksConsidered: 0 };
        }

        totalPay = monthsWithPay.reduce((sum, month) => {
          const basePay = parseFloat(month.pay_amount) || 0;
          const bonusComm = parseFloat(month.bonus_commission) || 0;
          return sum + basePay + bonusComm;
        }, 0);

        // Calculate total weeks in the period (using 52/12 weeks per month average, as per UK guidance practice)
        weeksConsidered = monthsWithPay.length * (52 / 12); 
        
        return {
          averagePay: weeksConsidered > 0 ? totalPay / weeksConsidered : 0,
          totalPay: totalPay,
          // Round weeksConsidered if it's derived from months, for display clarity
          weeksConsidered: Math.round(weeksConsidered)
        };

      } else { // variable_pay
        // For variable, data is weekly, ordered most recent first (descending week number)
        // Get the N most recent weeks
        relevantData = data.slice(0, weeksInPeriod); 

        // Filter out weeks with zero pay
        const weeksWithPay = relevantData.filter(w => w.pay_amount && parseFloat(w.pay_amount) > 0);

        if (weeksWithPay.length === 0) {
          return { averagePay: 0, totalPay: 0, weeksConsidered: 0 };
        }

        totalPay = weeksWithPay.reduce((sum, week) => sum + (parseFloat(week.pay_amount) || 0), 0);
        weeksConsidered = weeksWithPay.length;

        return {
          averagePay: weeksConsidered > 0 ? totalPay / weeksConsidered : 0,
          totalPay: totalPay,
          weeksConsidered: weeksWithPay.length // Use actual number of weeks with pay
        };
      }
    };

    const avg12WeekResult = calculateForPeriod(currentPayrollData, 12);
    const avg52WeekResult = calculateForPeriod(currentPayrollData, 52);

    return {
      avg12Week: {
        averagePay: Math.round(avg12WeekResult.averagePay * 100) / 100,
        totalPay: Math.round(avg12WeekResult.totalPay * 100) / 100,
        weeksConsidered: avg12WeekResult.weeksConsidered
      },
      avg52Week: {
        averagePay: Math.round(avg52WeekResult.averagePay * 100) / 100,
        totalPay: Math.round(avg52WeekResult.totalPay * 100) / 100,
        weeksConsidered: avg52WeekResult.weeksConsidered
      }
    };
  };

  const handleSaveWeeklyPay = async () => { // Renamed from handleSavePayrollData
    if (!selectedEmployee) return;

    try {
      setIsSaving(true);
      
      // Calculate the averages using the current payrollData state
      const { avg12Week, avg52Week } = calculateAverageWeeklyPay(selectedEmployee, payrollData);

      await Employee.update(selectedEmployee.id, {
        payroll_data: payrollData, // Save the current state of payrollData
        average_weekly_pay_12_weeks: avg12Week.averagePay,
        average_weekly_pay_52_weeks: avg52Week.averagePay,
      });
      alert('Payroll data and average weekly pay saved successfully');
      loadEmployees(); // Re-load employees to ensure updated data for selected employee, including new average fields
    } catch (error) {
      console.error('Error saving weekly pay data:', error);
      alert('Failed to save weekly pay data');
    } finally {
      setIsSaving(false);
    }
  };

  const initializeRP14aData = (caseEmployees) => {
    // Initialize with existing employee data, mapping relevant fields
    const employeesData = caseEmployees.map(emp => {
      const autoRedundancyStatus = qualifiesForRedundancy(emp) ? 'Yes' : 'No';
      const autoNoticePayStatus = qualifiesForNoticePay(emp) ? 'Yes' : 'No'; // New: Auto-populate based on service
      return {
        employee_id: emp.id,
        title: emp.title || '',
        forenames: emp.first_name || '',
        surname: emp.last_name || '',
        is_director: emp.is_director ? 'Yes' : 'No', // Assuming employee might have an `is_director` field
        date_of_birth: emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split('T')[0] : '', // Format date for input type="date"
        ni_number: emp.national_insurance_number || '',
        ni_class: emp.ni_class || '', // Assuming employee might have ni_class
        employment_start_date: emp.start_date ? new Date(emp.start_date).toISOString().split('T')[0] : '', // Format date
        date_notice_given: emp.date_notice_given ? new Date(emp.date_notice_given).toISOString().split('T')[0] : '', // Format date
        employment_end_date: emp.end_date ? new Date(emp.end_date).toISOString().split('T')[0] : '', // Format date
        entitled_to_redundancy: emp.entitled_to_redundancy !== undefined ? (emp.entitled_to_redundancy ? 'Yes' : 'No') : autoRedundancyStatus, // Auto-populate based on service, but allow override if employee has this field explicitly
        entitled_to_notice: emp.entitled_to_notice !== undefined ? (emp.entitled_to_notice ? 'Yes' : 'No') : autoNoticePayStatus, // Auto-populate based on service, but allow override
        employer_owed: emp.employer_owed || '',
        // Populate basic_weekly_pay from employee's saved value, or 12-week average if available, else empty
        basic_weekly_pay: emp.basic_weekly_pay !== undefined && emp.basic_weekly_pay !== '' ? emp.basic_weekly_pay : (emp.average_weekly_pay_12_weeks || ''),
        average_hours_worked: emp.average_hours_worked || '',
        day_of_week_paid: emp.day_of_week_paid || '',
        ap_from_date_1: '',
        ap_to_date_1: '',
        ap_amount_1: '',
        ap_type_1: '',
        ap_from_date_2: '',
        ap_to_date_2: '',
        ap_amount_2: '',
        ap_type_2: '',
        holiday_year_start_date: emp.holiday_year_start_date ? new Date(emp.holiday_year_start_date).toISOString().split('T')[0] : '',
        contracted_holiday_entitlement: emp.holiday_entitlement || '',
        holiday_days_carried_forward: emp.days_carried_forward || '',
        holiday_days_taken: emp.days_taken || '',
        // total_days_holiday_owed is calculated dynamically on display and not stored in state
        weekly_pay_52_week: emp.weekly_pay_52_week !== undefined && emp.weekly_pay_52_week !== '' ? emp.weekly_pay_52_week : (emp.average_weekly_pay_52_weeks || ''), // Initialize from employee's calculated average or existing field
        reason_not_52_week_rate: '',
        hp_from_date_1: '', // New fields for "Taken but Not Paid Holiday"
        hp_to_date_1: '',
        hp_status_52_week: '',
        hp_from_date_2: '',
        hp_to_date_2: '',
        hp_from_date_3: '',
        hp_to_date_3: ''
      };
    });

    setRp14aData({
      employer_name: caseData?.company_name || '',
      champ_case_reference: '',
      employees: employeesData
    });
  };

  const handleRP14aChange = (index, field, value) => {
    setRp14aData(prev => {
      const newData = { ...prev };
      if (field === 'employer_name' || field === 'champ_case_reference') {
        newData[field] = value;
      } else {
        const newEmployees = [...prev.employees];
        newEmployees[index] = { ...newEmployees[index], [field]: value };
        newData.employees = newEmployees;
      }
      return newData;
    });
  };

  const handleSaveRP14a = async () => {
    try {
      setIsSaving(true);
      // Save RP14a data to case.rp14a_data field
      await Case.update(caseId, {
        // Exclude total_days_holiday_owed from being saved as it's a derived field
        rp14a_data: JSON.stringify({
          ...rp14aData,
          employees: rp14aData.employees.map(emp => {
            const { total_days_holiday_owed, ...rest } = emp;
            return rest;
          })
        })
      });
      alert('RP14a data saved successfully');
    } catch (error) {
      console.error('Error saving RP14a data:', error);
      alert('Failed to save RP14a data');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportRP14a = () => {
    // Create CSV headers
    const headers = [
      'No.',
      'Title',
      'Forenames',
      'Surname',
      'Director?',
      'Date of Birth',
      'NI Number',
      'NI Class',
      'Start Date',
      'Notice Given',
      'End Date',
      'Redundancy?',
      'Notice Pay?',
      'Employer Owed',
      'Basic Weekly Pay',
      'Avg Hours',
      'Day Paid',
      '18a. AP From Date 1',
      '18b. AP To Date 1',
      '18c. AP Amount 1',
      '18d. AP Type 1',
      '19a. AP From Date 2',
      '19b. AP To Date 2',
      '19c. AP Amount 2',
      '19d. AP Type 2',
      '22a. Holiday Year Start Date',
      '22b. Contracted Holiday Entitlement',
      '22c. Holiday Days Carried Forward',
      '22d. Holiday Days Taken',
      '22e. Total No. of Days Holiday Owed', // This will be the calculated value
      '22f. Weekly Pay (52 week reference period)',
      '22g. Reason for not providing 52 week rate',
      '23a. HP From Date 1',
      '23b. HP To Date 1',
      '23c. Status of 52-week rate of pay for past holiday periods',
      '24a. HP From Date 2',
      '24b. HP To Date 2',
      '25a. HP From Date 3',
      '25b. HP To Date 3'
    ];

    // Create CSV rows
    const rows = rp14aData.employees.map((emp, index) => [
      index + 1,
      emp.title,
      emp.forenames,
      emp.surname,
      emp.is_director,
      emp.date_of_birth,
      emp.ni_number,
      emp.ni_class,
      emp.employment_start_date,
      emp.date_notice_given,
      emp.employment_end_date,
      emp.entitled_to_redundancy,
      emp.entitled_to_notice,
      emp.employer_owed,
      emp.basic_weekly_pay,
      emp.average_hours_worked,
      emp.day_of_week_paid,
      emp.ap_from_date_1,
      emp.ap_to_date_1,
      emp.ap_amount_1,
      emp.ap_type_1,
      emp.ap_from_date_2,
      emp.ap_to_date_2,
      emp.ap_amount_2,
      emp.ap_type_2,
      emp.holiday_year_start_date,
      emp.contracted_holiday_entitlement,
      emp.holiday_days_carried_forward,
      emp.holiday_days_taken,
      calculateColumn22e(emp).toFixed(1), // Export calculated value for 22e, rounded to 1 decimal place
      emp.weekly_pay_52_week, // This will export the saved value, not the live calculated average
      emp.reason_not_52_week_rate,
      emp.hp_from_date_1,
      emp.hp_to_date_1,
      emp.hp_status_52_week,
      emp.hp_from_date_2,
      emp.hp_to_date_2,
      emp.hp_from_date_3,
      emp.hp_to_date_3
    ]);

    // Add metadata rows at the top
    const metadata = [
      ['Employer Name:', rp14aData.employer_name],
      ['CHAMP Case Reference:', rp14aData.champ_case_reference],
      [] // Empty row for spacing
    ];

    // Combine metadata and data
    const csvContent = [
      ...metadata.map(row => row.join(',')),
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Escape commas and quotes in cell values
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `RP14a_${caseData?.case_reference || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load RP14a data when tab is accessed, or when employees are updated
  useEffect(() => {
    // Only proceed if employees array is populated (or confirmed empty by loading === false)
    // and caseData is available.
    if (!loading && caseData) {
      if (caseData.rp14a_data) {
        try {
          const parsedData = JSON.parse(caseData.rp14a_data);

          // Create a base `employees` array from current case employees (fresh data)
          const currentCaseEmployeesAsRP14a = employees.map(emp => {
              const autoRedundancyStatus = qualifiesForRedundancy(emp) ? 'Yes' : 'No';
              const autoNoticePayStatus = qualifiesForNoticePay(emp) ? 'Yes' : 'No'; // New: Auto-populate based on service
              return {
                  employee_id: emp.id,
                  title: emp.title || '',
                  forenames: emp.first_name || '',
                  surname: emp.last_name || '',
                  is_director: emp.is_director ? 'Yes' : 'No',
                  date_of_birth: emp.date_of_birth ? new Date(emp.date_of_birth).toISOString().split('T')[0] : '',
                  ni_number: emp.national_insurance_number || '',
                  ni_class: emp.ni_class || '',
                  employment_start_date: emp.start_date ? new Date(emp.start_date).toISOString().split('T')[0] : '',
                  date_notice_given: emp.date_notice_given ? new Date(emp.date_notice_given).toISOString().split('T')[0] : '',
                  employment_end_date: emp.end_date ? new Date(emp.end_date).toISOString().split('T')[0] : '',
                  entitled_to_redundancy: emp.entitled_to_redundancy !== undefined ? (emp.entitled_to_redundancy ? 'Yes' : 'No') : autoRedundancyStatus, // Auto-populate this
                  entitled_to_notice: emp.entitled_to_notice !== undefined ? (emp.entitled_to_notice ? 'Yes' : 'No') : autoNoticePayStatus, // Auto-populate this
                  employer_owed: emp.employer_owed || '',
                  basic_weekly_pay: emp.basic_weekly_pay !== undefined && emp.basic_weekly_pay !== '' ? emp.basic_weekly_pay : (emp.average_weekly_pay_12_weeks || ''),
                  average_hours_worked: emp.average_hours_worked || '',
                  day_of_week_paid: emp.day_of_week_paid || '',
                  ap_from_date_1: '', // Initialize new fields for fresh employees
                  ap_to_date_1: '',
                  ap_amount_1: '',
                  ap_type_1: '',
                  ap_from_date_2: '',
                  ap_to_date_2: '',
                  ap_amount_2: '',
                  ap_type_2: '',
                  holiday_year_start_date: emp.holiday_year_start_date ? new Date(emp.holiday_year_start_date).toISOString().split('T')[0] : '',
                  contracted_holiday_entitlement: emp.holiday_entitlement || '',
                  holiday_days_carried_forward: emp.days_carried_forward || '',
                  holiday_days_taken: emp.days_taken || '',
                  // total_days_holiday_owed is calculated dynamically for display, not initialized here
                  weekly_pay_52_week: emp.weekly_pay_52_week !== undefined && emp.weekly_pay_52_week !== '' ? emp.weekly_pay_52_week : (emp.average_weekly_pay_52_weeks || ''), // Initialize from employee's calculated average
                  reason_not_52_week_rate: '',
                  hp_from_date_1: '',
                  hp_to_date_1: '',
                  hp_status_52_week: '',
                  hp_from_date_2: '',
                  hp_to_date_2: '',
                  hp_from_date_3: '',
                  hp_to_date_3: ''
              };
          });

          // Merge saved RP14a employee data onto the current structure
          const mergedEmployees = currentCaseEmployeesAsRP14a.map(currentEmp => {
              const savedEmp = parsedData.employees?.find(sEmp => sEmp.employee_id === currentEmp.employee_id);
              // Use savedEmp's basic_weekly_pay if it exists (even if 0 or empty string), otherwise fall back to currentEmp's (which has 12-week average)
              const basicWeeklyPay = savedEmp?.basic_weekly_pay !== undefined ? savedEmp.basic_weekly_pay : currentEmp.basic_weekly_pay;
              const weeklyPay52Week = savedEmp?.weekly_pay_52_week !== undefined ? savedEmp.weekly_pay_52_week : currentEmp.weekly_pay_52_week;
              const entitledToRedundancy = savedEmp?.entitled_to_redundancy !== undefined ? savedEmp.entitled_to_redundancy : currentEmp.entitled_to_redundancy; // Prioritize saved value
              const entitledToNotice = savedEmp?.entitled_to_notice !== undefined ? savedEmp.entitled_to_notice : currentEmp.entitled_to_notice; // Prioritize saved value
              
              // Only merge explicitly saved fields; total_days_holiday_owed is always dynamic
              const merged = savedEmp ? {
                ...currentEmp,
                ...savedEmp,
                basic_weekly_pay: basicWeeklyPay,
                weekly_pay_52_week: weeklyPay52Week,
                entitled_to_redundancy: entitledToRedundancy,
                entitled_to_notice: entitledToNotice
              } : currentEmp;

              // Ensure derived holiday fields are not directly set from savedEmp if we want them always calculated.
              // For other holiday fields (22a, b, c, d) that are inputs, we merge them.
              // total_days_holiday_owed (22e) is explicitly not merged/saved.

              return merged;
          });

          setRp14aData({
            employer_name: parsedData.employer_name || caseData.company_name || '',
            champ_case_reference: parsedData.champ_case_reference || '',
            employees: mergedEmployees
          });
        } catch (error) {
          console.error('Error parsing RP14a data from caseData, re-initializing:', error);
          initializeRP14aData(employees); // Fallback to full initialization if parsing fails
        }
      } else {
        initializeRP14aData(employees); // No saved data, initialize from scratch using current employees
      }
    }
  }, [caseId, caseData, employees, loading]); // Added employees and loading to dependency array to ensure proper sync

  const handleRPSFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploadingRPS(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // Upload the file first
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // For now, we'll just save the file URL
      // After you upload a sample, we'll configure the extraction schema
      const newRpsClaimData = {
        file_url,
        upload_date: new Date().toISOString(),
        employees: [] // Will be populated after we configure extraction
      };

      setRpsClaimData(newRpsClaimData);

      // Save to case
      await Case.update(caseId, {
        rps_claim_data: JSON.stringify(newRpsClaimData)
      });

      setUploadSuccess(true);
      alert('RPS claim file uploaded successfully. Please share the file structure so we can configure data extraction.');

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading RPS claim file:', error);
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setIsUploadingRPS(false);
    }
  };

  const calculateResidualClaims = (employee) => {
    // Residual = Total Claim - RPS Processed
    const residualPref = (employee.total_preferential || 0) - (employee.rps_pref_processed || 0);
    const residualUnsecured = (employee.total_unsecured || 0) - (employee.rps_unsecured_processed || 0);

    return {
      residual_pref: Math.max(0, residualPref),
      residual_unsecured: Math.max(0, residualUnsecured)
    };
  };

  // Load RPS claim data if it exists
  useEffect(() => {
    if (caseData?.rps_claim_data) {
      try {
        const parsedData = JSON.parse(caseData.rps_claim_data);
        setRpsClaimData(parsedData);
      } catch (error) {
        console.error('Error parsing RPS claim data:', error);
      }
    }
  }, [caseData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Calculate current averages for display based on selected employee and payrollData state
  const currentDisplayedAverages = selectedEmployee
    ? calculateAverageWeeklyPay(selectedEmployee, payrollData)
    : {
        avg12Week: { averagePay: 0, totalPay: 0, weeksConsidered: 0 },
        avg52Week: { averagePay: 0, totalPay: 0, weeksConsidered: 0 }
      };

  const avg12WeekDisplay = currentDisplayedAverages.avg12Week;
  const avg52WeekDisplay = currentDisplayedAverages.avg52Week;

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">RPS Management</h3>
        </div>
      </div>

      {/* RPS Tabs */}
      <Tabs defaultValue="information" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full bg-blue-50 text-blue-700">
          <TabsTrigger value="information" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Information
          </TabsTrigger>
          <TabsTrigger value="rp14a" className="flex items-center gap-2">
            <FileSignature className="w-4 h-4" />
            RP14a
          </TabsTrigger>
          <TabsTrigger value="rps_claim" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            RPS Claim
          </TabsTrigger>
        </TabsList>

        {/* Information Tab */}
        <TabsContent value="information">
          <Card>
            <CardHeader>
              <CardTitle>RPS Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="prose max-w-none">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  1. Employment (Allocation of Tips) Act 2023
                </h3>
                <p className="text-slate-700 mb-2">
                  The Act introduced significant changes to the handling of tips, gratuities, and service charges by employers.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mb-3">
                  <li>Amendments to the Employment Rights Act 1996 (ERA) via s27D require fair allocation of qualifying tips among workers.</li>
                  <li>Section 27(1)(c) ERA confirms that qualifying tips are classed as &quot;wages&quot;.</li>
                  <li>Both employer-distributed and customer-paid tips qualify under s27C ERA.</li>
                </ul>
                <p className="text-slate-700 mb-1 font-medium">Where tips form a regular part of income:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mb-3 ml-4">
                  <li>A 12-week average should be used for redundancy and notice pay calculations.</li>
                  <li>A 52-week average should be applied for holiday pay calculations.</li>
                </ul>

                <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">
                  2. Temporary Pay Reductions
                </h3>
                <p className="text-slate-700 mb-2">
                  Temporary reductions in pay should not be used when calculating redundancy, notice, or holiday pay.
                </p>
                <p className="text-slate-700 mb-2">
                  The salary in place prior to the reduction (i.e., contractual pay) should be used.
                </p>
                <p className="text-slate-700 mb-1 font-medium">If pay was variable before the reduction:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mb-3 ml-4">
                  <li>Apply a 12-week average for redundancy and notice pay.</li>
                  <li>Apply a 52-week average for holiday pay.</li>
                </ul>

                <h3 className="text-lg font-semibold text-slate-900 mb-2 mt-4">
                  3. Resignation and Business Closure Scenarios
                </h3>
                <p className="text-slate-700 mb-2">
                  If an employee resigns but is unable to work their full notice due to the business ceasing to trade, this is treated as redundancy.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mb-3">
                  <li>They may claim redundancy, statutory notice, arrears of pay, and accrued holiday.</li>
                  <li>RP1 / RP14a should reflect the notice start date for statutory notice claim purposes.</li>
                </ul>
                <p className="text-slate-700 mb-1 font-medium">If the full notice period is worked before the business closes:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 ml-4">
                  <li>Only arrears of pay and accrued holiday can be claimed from RPS.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RP14a Tab */}
        <TabsContent value="rp14a">
          <Card>
            <CardHeader>
              <Tabs defaultValue="rp14a_form" className="space-y-4"> {/* Changed defaultValue */}
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4">
                    <CardTitle>RP14a</CardTitle>
                    <TabsList className="grid grid-cols-5 bg-blue-50 text-blue-700"> {/* Changed grid-cols-4 to grid-cols-5 */}
                      <TabsTrigger value="rp14a_form">RP14a Form</TabsTrigger> {/* Added new trigger */}
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="arrears">Arrears</TabsTrigger>
                      <TabsTrigger value="holiday_owed">Hol. Pay Owed</TabsTrigger>
                      <TabsTrigger value="holiday_taken">Hol. Taken But Not Paid</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleExportRP14a}
                      variant="outline"
                      className="flex-shrink-0"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      onClick={handleSaveRP14a}
                      disabled={isSaving}
                      className="bg-blue-600 hover:bg-blue-700 flex-shrink-0"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save RP14a Data
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* RP14a Form Tab - Full Table */}
                <TabsContent value="rp14a_form">
                  {/* Common Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Employer Name</Label>
                      <Input
                        value={rp14aData.employer_name}
                        onChange={(e) => handleRP14aChange(0, 'employer_name', e.target.value)}
                        placeholder="Enter employer name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">CHAMP Case Reference (if known)</Label>
                      <Input
                        value={rp14aData.champ_case_reference}
                        onChange={(e) => handleRP14aChange(0, 'champ_case_reference', e.target.value)}
                        placeholder="Enter CHAMP reference"
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {/* Full Employee Details Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs w-12 min-w-[3rem] py-2">No.</TableHead>
                            <TableHead className="text-xs w-16 min-w-[4rem] py-2">Title</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Forenames</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Surname</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Director?</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Date of Birth</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">NI Number</TableHead>
                            <TableHead className="text-xs w-16 min-w-[4rem] py-2">NI Class</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Start Date</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Notice Given</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">End Date</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Redundancy?</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Notice Pay?</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Employer Owed</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Basic Weekly Pay</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Avg Hours</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Day Paid</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">18a. AP From Date 1</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">18b. AP To Date 1</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">18c. AP Amount 1</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">18d. AP Type 1</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">19a. AP From Date 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">19b. AP To Date 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">19c. AP Amount 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">19d. AP Type 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22a. Holiday Year Start Date</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22b. Contracted Holiday Entitlement</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22c. Holiday Days Carried Forward</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22d. Holiday Days Taken</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22e. Total No. of Days Holiday Owed</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">22f. Weekly Pay (52 week reference period)</TableHead>
                            <TableHead className="text-xs w-32 min-w-[8rem] py-2">22g. Reason for not providing 52 week rate</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">23a. HP From Date 1</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">23b. HP To Date 1</TableHead>
                            <TableHead className="text-xs w-32 min-w-[8rem] py-2">23c. Status of 52-week rate of pay for past holiday periods</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">24a. HP From Date 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">24b. HP To Date 2</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">25a. HP From Date 3</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">25b. HP To Date 3</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rp14aData.employees.map((emp, index) => (
                            <TableRow key={emp.employee_id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium py-2 px-1 align-middle">{index + 1}</TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.title}
                                  onValueChange={(value) => handleRP14aChange(index, 'title', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Mr">Mr</SelectItem>
                                    <SelectItem value="Mrs">Mrs</SelectItem>
                                    <SelectItem value="Miss">Miss</SelectItem>
                                    <SelectItem value="Ms">Ms</SelectItem>
                                    <SelectItem value="Dr">Dr</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.forenames}
                                  onChange={(e) => handleRP14aChange(index, 'forenames', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Forenames"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.surname}
                                  onChange={(e) => handleRP14aChange(index, 'surname', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Surname"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.is_director}
                                  onValueChange={(value) => handleRP14aChange(index, 'is_director', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.date_of_birth}
                                  onChange={(e) => handleRP14aChange(index, 'date_of_birth', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ni_number}
                                  onChange={(e) => handleRP14aChange(index, 'ni_number', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="AB123456C"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ni_class}
                                  onChange={(e) => handleRP14aChange(index, 'ni_class', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Class"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.employment_start_date}
                                  onChange={(e) => handleRP14aChange(index, 'employment_start_date', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.date_notice_given}
                                  onChange={(e) => handleRP14aChange(index, 'date_notice_given', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.employment_end_date}
                                  onChange={(e) => handleRP14aChange(index, 'employment_end_date', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.entitled_to_redundancy}
                                  onValueChange={(value) => handleRP14aChange(index, 'entitled_to_redundancy', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.entitled_to_notice}
                                  onValueChange={(value) => handleRP14aChange(index, 'entitled_to_notice', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.employer_owed}
                                  onChange={(e) => handleRP14aChange(index, 'employer_owed', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Amount"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.basic_weekly_pay}
                                  onChange={(e) => handleRP14aChange(index, 'basic_weekly_pay', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1 bg-green-50 border-green-200"
                                  placeholder="£"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.average_hours_worked}
                                  onChange={(e) => handleRP14aChange(index, 'average_hours_worked', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Hours"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.day_of_week_paid}
                                  onValueChange={(value) => handleRP14aChange(index, 'day_of_week_paid', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue placeholder="Day" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Monday">Monday</SelectItem>
                                    <SelectItem value="Tuesday">Tuesday</SelectItem>
                                    <SelectItem value="Wednesday">Wednesday</SelectItem>
                                    <SelectItem value="Thursday">Thursday</SelectItem>
                                    <SelectItem value="Friday">Friday</SelectItem>
                                    <SelectItem value="Saturday">Saturday</SelectItem>
                                    <SelectItem value="Sunday">Sunday</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_from_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_from_date_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_to_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_to_date_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.ap_amount_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_amount_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="£"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ap_type_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_type_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Type"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_from_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_from_date_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_to_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_to_date_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.ap_amount_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_amount_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="£"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ap_type_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_type_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Type"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.holiday_year_start_date}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_year_start_date', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.contracted_holiday_entitlement}
                                  onChange={(e) => handleRP14aChange(index, 'contracted_holiday_entitlement', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Days"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.holiday_days_carried_forward}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_days_carried_forward', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Days"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.holiday_days_taken}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_days_taken', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Days"
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2 text-center border-r align-middle">
                                <span className="text-sm font-medium text-blue-700">
                                  {calculateColumn22e(emp).toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <span className="text-sm font-medium text-slate-900">
                                  {formatCurrency(emp.average_weekly_pay_52_weeks || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.reason_not_52_week_rate}
                                  onChange={(e) => handleRP14aChange(index, 'reason_not_52_week_rate', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Reason"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_1', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.hp_status_52_week}
                                  onChange={(e) => handleRP14aChange(index, 'hp_status_52_week', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="Status"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_2', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_3}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_3', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_3}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_3', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {rp14aData.employees.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <p className="font-medium">No employees found for this case</p>
                      <p className="text-sm">Add employees to the case to complete the RP14a form</p>
                    </div>
                  )}
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details">
                  {/* Common Fields */}
                  <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">Employer Name</Label>
                      <Input
                        value={rp14aData.employer_name}
                        onChange={(e) => handleRP14aChange(0, 'employer_name', e.target.value)}
                        placeholder="Enter employer name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-slate-700">CHAMP Case Reference (if known)</Label>
                      <Input
                        value={rp14aData.champ_case_reference}
                        onChange={(e) => handleRP14aChange(0, 'champ_case_reference', e.target.value)}
                        placeholder="Enter CHAMP reference"
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {/* Employee Details Table - No. to Day Paid only */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs w-12 min-w-[3rem] py-2">No.</TableHead>
                            <TableHead className="text-xs w-16 min-w-[4rem] py-2">Title</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Forenames</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Surname</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Director?</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Date of Birth</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">NI Number</TableHead>
                            <TableHead className="text-xs w-16 min-w-[4rem] py-2">NI Class</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Start Date</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Notice Given</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">End Date</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Redundancy?</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Notice Pay?</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Employer Owed</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Basic Weekly Pay</TableHead>
                            <TableHead className="text-xs w-20 min-w-[5rem] py-2">Avg Hours</TableHead>
                            <TableHead className="text-xs w-24 min-w-[6rem] py-2">Day Paid</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rp14aData.employees.map((emp, index) => (
                            <TableRow key={emp.employee_id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium py-2 px-1 align-middle">{index + 1}</TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.title}
                                  onValueChange={(value) => handleRP14aChange(index, 'title', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Mr">Mr</SelectItem>
                                    <SelectItem value="Mrs">Mrs</SelectItem>
                                    <SelectItem value="Miss">Miss</SelectItem>
                                    <SelectItem value="Ms">Ms</SelectItem>
                                    <SelectItem value="Dr">Dr</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.forenames}
                                  onChange={(e) => handleRP14aChange(index, 'forenames', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.surname}
                                  onChange={(e) => handleRP14aChange(index, 'surname', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.is_director}
                                  onValueChange={(value) => handleRP14aChange(index, 'is_director', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.date_of_birth}
                                  onChange={(e) => handleRP14aChange(index, 'date_of_birth', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ni_number}
                                  onChange={(e) => handleRP14aChange(index, 'ni_number', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="AB123456C"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ni_class}
                                  onChange={(e) => handleRP14aChange(index, 'ni_class', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.employment_start_date}
                                  onChange={(e) => handleRP14aChange(index, 'employment_start_date', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.date_notice_given}
                                  onChange={(e) => handleRP14aChange(index, 'date_notice_given', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.employment_end_date}
                                  onChange={(e) => handleRP14aChange(index, 'employment_end_date', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.entitled_to_redundancy}
                                  onValueChange={(value) => handleRP14aChange(index, 'entitled_to_redundancy', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.entitled_to_notice}
                                  onValueChange={(value) => handleRP14aChange(index, 'entitled_to_notice', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.employer_owed}
                                  onChange={(e) => handleRP14aChange(index, 'employer_owed', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.basic_weekly_pay}
                                  onChange={(e) => handleRP14aChange(index, 'basic_weekly_pay', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1 bg-green-50 border-green-200"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.average_hours_worked}
                                  onChange={(e) => handleRP14aChange(index, 'average_hours_worked', e.target.value)}
                                  className="h-6 text-xs border-0 shadow-none px-1"
                                  placeholder="40"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Select
                                  value={emp.day_of_week_paid}
                                  onValueChange={(value) => handleRP14aChange(index, 'day_of_week_paid', value)}
                                >
                                  <SelectTrigger className="h-6 text-xs border-0 shadow-none">
                                    <SelectValue placeholder="Select day" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Monday">Monday</SelectItem>
                                    <SelectItem value="Tuesday">Tuesday</SelectItem>
                                    <SelectItem value="Wednesday">Wednesday</SelectItem>
                                    <SelectItem value="Thursday">Thursday</SelectItem>
                                    <SelectItem value="Friday">Friday</SelectItem>
                                    <SelectItem value="Saturday">Saturday</SelectItem>
                                    <SelectItem value="Sunday">Sunday</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {rp14aData.employees.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <p className="font-medium">No employees found for this case</p>
                      <p className="text-sm">Add employees to the case to complete the RP14a form</p>
                    </div>
                  )}
                </TabsContent>

                {/* Arrears Tab */}
                <TabsContent value="arrears">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs py-2">No.</TableHead>
                            <TableHead className="text-xs py-2">Employee Name</TableHead>
                            <TableHead className="text-xs py-2">18a. AP From Date 1</TableHead>
                            <TableHead className="text-xs py-2">18b. AP To Date 1</TableHead>
                            <TableHead className="text-xs py-2">18c. AP Amount 1</TableHead>
                            <TableHead className="text-xs py-2">18d. AP Type 1</TableHead>
                            <TableHead className="text-xs py-2">19a. AP From Date 2</TableHead>
                            <TableHead className="text-xs py-2">19b. AP To Date 2</TableHead>
                            <TableHead className="text-xs py-2">19c. AP Amount 2</TableHead>
                            <TableHead className="text-xs py-2">19d. AP Type 2</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rp14aData.employees.map((emp, index) => (
                            <TableRow key={emp.employee_id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium py-2 align-middle">{index + 1}</TableCell>
                              <TableCell className="text-xs font-medium py-2 align-middle">
                                {emp.forenames} {emp.surname}
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_from_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_from_date_1', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_to_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_to_date_1', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.ap_amount_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_amount_1', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ap_type_1}
                                  onChange={(e) => handleRP14aChange(index, 'ap_type_1', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Type"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_from_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_from_date_2', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.ap_to_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_to_date_2', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={emp.ap_amount_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_amount_2', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.ap_type_2}
                                  onChange={(e) => handleRP14aChange(index, 'ap_type_2', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Type"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {rp14aData.employees.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <p className="font-medium">No employees found for this case</p>
                      <p className="text-sm">Add employees to the case to complete the RP14a form</p>
                    </div>
                  )}
                </TabsContent>

                {/* Holiday Pay Owed Tab */}
                <TabsContent value="holiday_owed">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs py-2">No.</TableHead>
                            <TableHead className="text-xs py-2">Employee Name</TableHead>
                            <TableHead className="text-xs py-2">22a. Holiday Year Start Date</TableHead>
                            <TableHead className="text-xs py-2">22b. Contracted Holiday Entitlement</TableHead>
                            <TableHead className="text-xs py-2">22c. Holiday Days Carried Forward</TableHead>
                            <TableHead className="text-xs py-2">22d. Holiday Days Taken</TableHead>
                            <TableHead className="text-xs py-2">22e. Total No. of Days Holiday Owed</TableHead>
                            <TableHead className="text-xs py-2">22f. Weekly Pay (52 week reference period)</TableHead>
                            <TableHead className="text-xs py-2">22g. Reason for not providing 52 week rate</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rp14aData.employees.map((emp, index) => (
                            <TableRow key={emp.employee_id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium py-2 align-middle">{index + 1}</TableCell>
                              <TableCell className="text-xs font-medium py-2 align-middle">
                                {emp.forenames} {emp.surname}
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.holiday_year_start_date}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_year_start_date', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.contracted_holiday_entitlement}
                                  onChange={(e) => handleRP14aChange(index, 'contracted_holiday_entitlement', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.holiday_days_carried_forward}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_days_carried_forward', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={emp.holiday_days_taken}
                                  onChange={(e) => handleRP14aChange(index, 'holiday_days_taken', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="0"
                                />
                              </TableCell>
                              <TableCell className="px-2 py-2 text-center border-r align-middle">
                                <span className="text-sm font-medium text-blue-700">
                                  {calculateColumn22e(emp).toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <span className="text-sm font-medium text-slate-900">
                                  {formatCurrency(emp.average_weekly_pay_52_weeks || 0)}
                                </span>
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.reason_not_52_week_rate}
                                  onChange={(e) => handleRP14aChange(index, 'reason_not_52_week_rate', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Reason"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {rp14aData.employees.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <p className="font-medium">No employees found for this case</p>
                      <p className="text-sm">Add employees to the case to complete the RP14a form</p>
                    </div>
                  )}
                </TabsContent>

                {/* Taken but Not Paid Holiday Tab */}
                <TabsContent value="holiday_taken">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-xs py-2">No.</TableHead>
                            <TableHead className="text-xs py-2">Employee Name</TableHead>
                            <TableHead className="text-xs py-2">23a. HP From Date 1</TableHead>
                            <TableHead className="text-xs py-2">23b. HP To Date 1</TableHead>
                            <TableHead className="text-xs py-2">23c. Status of 52-week rate of pay for past holiday periods</TableHead>
                            <TableHead className="text-xs py-2">24a. HP From Date 2</TableHead>
                            <TableHead className="text-xs py-2">24b. HP To Date 2</TableHead>
                            <TableHead className="text-xs py-2">25a. HP From Date 3</TableHead>
                            <TableHead className="text-xs py-2">25b. HP To Date 3</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {rp14aData.employees.map((emp, index) => (
                            <TableRow key={emp.employee_id} className="hover:bg-slate-50">
                              <TableCell className="text-xs font-medium py-2 align-middle">{index + 1}</TableCell>
                              <TableCell className="text-xs font-medium py-2 align-middle">
                                {emp.forenames} {emp.surname}
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_1', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_1}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_1', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  value={emp.hp_status_52_week}
                                  onChange={(e) => handleRP14aChange(index, 'hp_status_52_week', e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Status"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_2', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_2}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_2', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_from_date_3}
                                  onChange={(e) => handleRP14aChange(index, 'hp_from_date_3', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                              <TableCell className="py-2 px-1 align-middle">
                                <Input
                                  type="date"
                                  value={emp.hp_to_date_3}
                                  onChange={(e) => handleRP14aChange(index, 'hp_to_date_3', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {rp14aData.employees.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <p className="font-medium">No employees found for this case</p>
                      <p className="text-sm">Add employees to the case to complete the RP14a form</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </TabsContent>

        {/* RPS Claim Tab */}
        <TabsContent value="rps_claim">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Submit RPS Claims</span>
                <div className="flex items-center gap-3">
                  <Label htmlFor="rps-file-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      {isUploadingRPS ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload RPS Claim Form
                        </>
                      )}
                    </div>
                    <Input
                      id="rps-file-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleRPSFileUpload}
                      disabled={isUploadingRPS}
                    />
                  </Label>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Upload Status Messages */}
              {uploadError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    {uploadError}
                  </AlertDescription>
                </Alert>
              )}

              {uploadSuccess && (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    RPS claim file uploaded successfully. Please share the file structure so we can configure data extraction.
                  </AlertDescription>
                </Alert>
              )}

              {/* File Info */}
              {rpsClaimData.file_url && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">RPS Claim Form Uploaded</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Uploaded on: {new Date(rpsClaimData.upload_date).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                    <a
                      href={rpsClaimData.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      View File →
                    </a>
                  </div>
                </div>
              )}

              {/* Claims Data Table */}
              {rpsClaimData.employees && rpsClaimData.employees.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs">Employee Name</TableHead>
                        <TableHead className="text-xs">Claim Type</TableHead>
                        <TableHead className="text-xs text-right">Gross Claim</TableHead>
                        <TableHead className="text-xs text-right">RPS Pref Claim</TableHead>
                        <TableHead className="text-xs text-right">RPS Unsec Claim</TableHead>
                        <TableHead className="text-xs text-right">RPS Processed</TableHead>
                        <TableHead className="text-xs text-right bg-blue-50">Residual Pref</TableHead>
                        <TableHead className="text-xs text-right bg-blue-50">Residual Unsec</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rpsClaimData.employees.map((emp, index) => {
                        const residuals = calculateResidualClaims(emp);
                        return (
                          <TableRow key={index}>
                            <TableCell className="font-medium text-sm align-middle">{emp.employee_name}</TableCell>
                            <TableCell className="text-sm align-middle">{emp.claim_type}</TableCell>
                            <TableCell className="text-right text-sm align-middle">{formatCurrency(emp.gross_claim)}</TableCell>
                            <TableCell className="text-right text-sm align-middle">{formatCurrency(emp.rps_pref_claim)}</TableCell>
                            <TableCell className="text-right text-sm align-middle">{formatCurrency(emp.rps_unsecured_claim)}</TableCell>
                            <TableCell className="text-right text-sm align-middle">{formatCurrency(emp.rps_processed)}</TableCell>
                            <TableCell className="text-right text-sm bg-blue-50 font-semibold align-middle">{formatCurrency(residuals.residual_pref)}</TableCell>
                            <TableCell className="text-right text-sm bg-blue-50 font-semibold align-middle">{formatCurrency(residuals.residual_unsecured)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Send className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No RPS Claim Data</h3>
                  <p className="text-slate-500 mb-4">
                    Upload an RPS claim form to extract and track claim information.
                  </p>
                  <p className="text-sm text-slate-400">
                    The system will automatically extract claim details and calculate residual amounts.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}