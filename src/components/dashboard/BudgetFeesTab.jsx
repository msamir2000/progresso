import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Save,
  XCircle,
  Loader2,
  FileDown,
  RefreshCw,
  Lock,
  Unlock,
  Plus,
  ClipboardList,
  Clock,
  TrendingUp,
  Users,
  PoundSterling,
  FileText,
  Calendar,
  Download
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { FeeEstimateTemplate } from "@/api/entities";
import { TimesheetEntry } from '@/api/entities';
import VotesTable from './VotesTable';

const HOURLY_RATES = {
  Partner: 700,
  Manager: 500,
  Executive: 250,
  Secretary: 70
};

const ALL_CATEGORIES = [
  'STATUTORY AND ADMINISTRATIVE TASKS',
  'REALISATION OF ASSETS',
  'INVESTIGATIONS',
  'CREDITORS',
  'EMPLOYEES',
  'TRADING'
];

const FEE_ESTIMATE_CATEGORIES = [
  { id: 'statutory', name: 'STATUTORY AND ADMINISTRATIVE TASKS' },
  { id: 'realisation', name: 'REALISATION OF ASSETS' },
  { id: 'investigations', name: 'INVESTIGATIONS' },
  { id: 'creditors', name: 'CREDITORS' },
  { id: 'employees', name: 'EMPLOYEES' },
];

const SIP9_CATEGORIES = [
  { id: 'statutory', name: 'STATUTORY AND ADMINISTRATIVE TASKS' },
  { id: 'realisation', name: 'REALISATION OF ASSETS' },
  { id: 'trading', name: 'TRADING' },
  { id: 'investigations', name: 'INVESTIGATIONS' },
  { id: 'creditors', name: 'CREDITORS' },
  { id: 'employees', name: 'EMPLOYEES' },
];

const categorizeTask = (taskDescription) => {
  const desc = taskDescription.toLowerCase();

  if (desc.includes('admin') || desc.includes('planning') || desc.includes('meeting') || desc.includes('correspondence') || desc.includes('statutory') || desc.includes('filing') || desc.includes('reporting')) {
    return 'STATUTORY AND ADMINISTRATIVE TASKS';
  } else if (desc.includes('asset') || desc.includes('realisation') || desc.includes('sale') || desc.includes('property') || desc.includes('retention of title')) {
    return 'REALISATION OF ASSETS';
  } else if (desc.includes('investigation') || desc.includes('sip') || desc.includes('director') || desc.includes('pension') || desc.includes('financial records') || desc.includes('cdda')) {
    return 'INVESTIGATIONS';
  } else if (desc.includes('creditor') || desc.includes('claims') || desc.includes('proof') || desc.includes('adjudication') || desc.includes('secured')) {
    return 'CREDITORS';
  } else if (desc.includes('employee') || desc.includes('redundancy') || desc.includes('wages') || desc.includes('staff')) {
    return 'EMPLOYEES';
  } else if (desc.includes('trading') || desc.includes('trade')) {
    return 'TRADING';
  } else {
    return 'STATUTORY AND ADMINISTRATIVE TASKS';
  }
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(amount);
};

const formatHours = (hours) => {
  return hours.toFixed(2);
};

const formatForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
};

export default function BudgetFeesTab({ caseData, case_, users, onCaseUpdate }) {
  const [activeBudgetSection, setActiveBudgetSection] = useState('case-parameters');
  const [isSaving, setIsSaving] = useState(false);
  const [feeEstimateTemplate, setFeeEstimateTemplate] = useState(null);
  const [caseFeeEstimate, setCaseFeeEstimate] = useState({});
  const [feeEstimateLocked, setFeeEstimateLocked] = useState(false);
  const [votesLocked, setVotesLocked] = useState(false);
  const [isSavingVotes, setIsSavingVotes] = useState(false);
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [isLoadingWIP, setIsLoadingWIP] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [localCaseData, setLocalCaseData] = useState(caseData);

  useEffect(() => {
    setLocalCaseData(caseData);
  }, [caseData]);

  const loadFeeEstimateTemplate = useCallback(async () => {
    try {
      const templates = await FeeEstimateTemplate.list();
      const defaultTemplate = templates.find(t => t.is_default) || templates[0];
      setFeeEstimateTemplate(defaultTemplate);
    } catch (error) {
      console.error('Error loading fee estimate template:', error);
      setFeeEstimateTemplate(null);
    }
  }, []);

  useEffect(() => {
    loadFeeEstimateTemplate();
  }, [loadFeeEstimateTemplate]);

  useEffect(() => {
    let parsedFeeEstimateData = {};
    if (caseData.fee_estimate_data) {
      let rawFeeEstimateData = caseData.fee_estimate_data;
      if (typeof rawFeeEstimateData === 'string') {
        try {
          rawFeeEstimateData = JSON.parse(rawFeeEstimateData);
        } catch (e) {
          console.error('Error parsing fee estimate data:', e);
          rawFeeEstimateData = [];
        }
      }
      if (Array.isArray(rawFeeEstimateData)) {
        rawFeeEstimateData.forEach(item => {
          parsedFeeEstimateData[item.id] = {
            partner_hours: item.partner_hours,
            manager_hours: item.manager_hours,
            executive_hours: item.executive_hours,
            secretary_hours: item.secretary_hours,
            notes: item.notes,
          };
        });
      }
    }
    setCaseFeeEstimate(parsedFeeEstimateData);
  }, [caseData.fee_estimate_data]);

  const loadTimesheetData = useCallback(async () => {
    if (!case_?.case_reference) return;

    setIsLoadingWIP(true);
    try {
      const entries = await TimesheetEntry.filter({
        case_reference: case_.case_reference,
        status: 'approved'
      });
      setTimesheetEntries(entries || []);
    } catch (error) {
      console.error('Error loading timesheet data:', error);
    } finally {
      setIsLoadingWIP(false);
    }
  }, [case_?.case_reference]);

  useEffect(() => {
    if (case_?.id) {
      loadTimesheetData();
      if (case_.appointment_date) {
        setDateFrom(formatForInput(case_.appointment_date));
      } else {
        setDateFrom('');
      }
      setDateTo(new Date().toISOString().split('T')[0]);
    }
  }, [case_?.id, case_?.appointment_date, loadTimesheetData]);

  const allFeeEstimateActivities = useMemo(() => {
    if (!feeEstimateTemplate || !feeEstimateTemplate.template_data) return [];
    try {
      return typeof feeEstimateTemplate.template_data === 'string'
        ? JSON.parse(feeEstimateTemplate.template_data)
        : feeEstimateTemplate.template_data;
    } catch (e) {
      console.error("Error parsing feeEstimateTemplate.template_data:", e);
      return [];
    }
  }, [feeEstimateTemplate]);

  const calculateTaskTotals = useCallback((taskActivity) => {
    const taskData = caseFeeEstimate[taskActivity.id] || {};
    const partnerHours = parseFloat(taskData.partner_hours || 0);
    const managerHours = parseFloat(taskData.manager_hours || 0);
    const executiveHours = parseFloat(taskData.executive_hours || 0);
    const secretaryHours = parseFloat(taskData.secretary_hours || 0);

    const totalHours = partnerHours + managerHours + executiveHours + secretaryHours;
    const totalCost = (partnerHours * HOURLY_RATES.Partner) +
                     (managerHours * HOURLY_RATES.Manager) +
                     (executiveHours * HOURLY_RATES.Executive) +
                     (secretaryHours * HOURLY_RATES.Secretary);

    return { totalHours, totalCost };
  }, [caseFeeEstimate]);

  const updateTaskFeeEstimate = (taskId, field, value) => {
    setCaseFeeEstimate(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  const calculateCategoryTotals = useCallback((categoryId) => {
    const categoryTasks = allFeeEstimateActivities.filter(t => t.category === categoryId);
    let totalHours = 0;
    let totalCost = 0;

    categoryTasks.forEach(task => {
      const { totalHours: taskHours, totalCost: taskCost } = calculateTaskTotals(task);
      totalHours += taskHours;
      totalCost += taskCost;
    });

    return { totalHours, totalCost };
  }, [allFeeEstimateActivities, calculateTaskTotals]);

  const calculateGrandTotals = useCallback(() => {
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    FEE_ESTIMATE_CATEGORIES.forEach(category => {
      const { totalHours, totalCost } = calculateCategoryTotals(category.id);
      grandTotalHours += totalHours;
      grandTotalCost += totalCost;
    });

    return { grandTotalHours, grandTotalCost };
  }, [calculateCategoryTotals]);

  const calculateTotalFeeEstimate = useCallback(() => {
    return calculateGrandTotals().grandTotalCost;
  }, [calculateGrandTotals]);

  const sip9ReportData = useMemo(() => {
    const report = [];
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    const categoriesToProcess = SIP9_CATEGORIES.filter(cat => {
      if (cat.id === 'trading' && caseData.case_type !== 'Administration') {
        return false;
      }
      return true;
    });

    categoriesToProcess.forEach(category => {
      const { totalHours, totalCost } = calculateCategoryTotals(category.id);
      report.push({
        name: category.name,
        totalHours,
        totalCost,
        averageHourlyCost: totalHours > 0 ? totalCost / totalHours : 0
      });
      grandTotalHours += totalHours;
      grandTotalCost += totalCost;
    });

    return { categories: report, grandTotalHours, grandTotalCost };
  }, [caseData.case_type, calculateCategoryTotals]);

  const getFilteredEntries = useMemo(() => {
    if (!dateFrom || !dateTo) return timesheetEntries;

    return timesheetEntries.filter(entry => {
      const entryDate = entry.date;
      return entryDate >= dateFrom && entryDate <= dateTo;
    });
  }, [timesheetEntries, dateFrom, dateTo]);

  const timeLedger = useMemo(() => {
    const ledger = {};
    ALL_CATEGORIES.forEach(category => {
      ledger[category] = {
        'IP Directors': { hours: 0, cost: 0 },
        'Managers': { hours: 0, cost: 0 },
        'Administrators': { hours: 0, cost: 0 }
      };
    });

    const filteredEntries = getFilteredEntries;

    filteredEntries.forEach(entry => {
      const category = categorizeTask(entry.task_description);

      if (!ALL_CATEGORIES.includes(category)) {
        console.warn(`Task category "${category}" not found in ALL_CATEGORIES.`);
        return;
      }

      const user = users?.find(u => u.email === entry.user_email);
      const userRole = user?.role || 'Executive';

      let roleCategory = 'Administrators';
      if (userRole === 'admin' || userRole === 'partner') {
        roleCategory = 'IP Directors';
      } else if (userRole === 'manager') {
        roleCategory = 'Managers';
      }

      const hours = entry.duration_seconds / 3600;
      let rateKey = 'Executive';
      if (userRole === 'admin' || userRole === 'partner') rateKey = 'Partner';
      else if (userRole === 'manager') rateKey = 'Manager';
      else if (userRole === 'secretary') rateKey = 'Secretary';

      const cost = hours * (HOURLY_RATES[rateKey] || 0);

      ledger[category][roleCategory].hours += hours;
      ledger[category][roleCategory].cost += cost;
    });

    return ledger;
  }, [getFilteredEntries, users]);

  const wipBreakdown = useMemo(() => {
    const breakdown = {
      Partner: { hours: 0, cost: 0 },
      Manager: { hours: 0, cost: 0 },
      Executive: { hours: 0, cost: 0 },
      Secretary: { hours: 0, cost: 0 }
    };

    const userBreakdownMap = {};
    const filteredEntries = getFilteredEntries;

    filteredEntries.forEach(entry => {
      const user = users?.find(u => u.email === entry.user_email);
      let rateCategory = 'Executive';
      if (user?.role === 'admin' || user?.role === 'partner') {
        rateCategory = 'Partner';
      } else if (user?.role === 'manager') {
        rateCategory = 'Manager';
      } else if (user?.role === 'secretary') {
        rateCategory = 'Secretary';
      }

      const hours = entry.duration_seconds / 3600;
      const hourlyRate = HOURLY_RATES[rateCategory] || 0;
      const cost = hours * hourlyRate;

      breakdown[rateCategory].hours += hours;
      breakdown[rateCategory].cost += cost;

      if (!userBreakdownMap[entry.user_email]) {
        userBreakdownMap[entry.user_email] = {
          name: user?.full_name || entry.user_email,
          role: rateCategory,
          hours: 0,
          cost: 0
        };
      }
      userBreakdownMap[entry.user_email].hours += hours;
      userBreakdownMap[entry.user_email].cost += cost;
    });

    return { breakdown, userBreakdown: Object.values(userBreakdownMap) };
  }, [getFilteredEntries, users]);

  const { breakdown: wipBreakdownData, userBreakdown } = wipBreakdown;
  const totalWIP = useMemo(() => Object.values(wipBreakdownData).reduce((sum, item) => sum + item.cost, 0), [wipBreakdownData]);

  const ledgerTotals = useMemo(() => {
    const totals = {
      ipHours: 0,
      managerHours: 0,
      adminHours: 0,
      ipCost: 0,
      managerCost: 0,
      adminCost: 0,
    };

    Object.values(timeLedger).forEach(data => {
      totals.ipHours += data['IP Directors'].hours;
      totals.managerHours += data['Managers'].hours;
      totals.adminHours += data['Administrators'].hours;
      totals.ipCost += data['IP Directors'].cost;
      totals.managerCost += data['Managers'].cost;
      totals.adminCost += data['Administrators'].cost;
    });

    return totals;
  }, [timeLedger]);

  const ledgerGrandTotal = useMemo(() => ({
    hours: ledgerTotals.ipHours + ledgerTotals.managerHours + ledgerTotals.adminHours,
    cost: ledgerTotals.ipCost + ledgerTotals.managerCost + ledgerTotals.adminCost
  }), [ledgerTotals]);

  const getCaseAge = (appointmentDateString) => {
    if (!appointmentDateString) return 'N/A';

    const appointmentDate = new Date(appointmentDateString);
    const today = new Date();

    let years = today.getFullYear() - appointmentDate.getFullYear();
    let months = today.getMonth() - appointmentDate.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    let result = [];
    if (years > 0) {
      result.push(`${years} Year${years !== 1 ? 's' : ''}`);
    }
    if (months > 0) {
      result.push(`${months} Month${months !== 1 ? 's' : ''}`);
    }

    return result.length > 0 ? result.join(', ') : 'Less than a month';
  };

  const handleInputChange = (field, value) => {
    setLocalCaseData(prev => {
      const newData = { ...prev };
      const fields = field.split('.');

      let current = newData;
      for (let i = 0; i < fields.length - 1; i++) {
        if (!current[fields[i]]) {
          current[fields[i]] = {};
        }
        current = current[fields[i]];
      }

      current[fields[fields.length - 1]] = value;
      return newData;
    });
  };

  const handleResetCaseParameters = () => {
    const feeEstimate = case_.fee_estimate || {};

    setLocalCaseData(prev => ({
      ...prev,
      soa_etr: case_.soa_etr || 0,
      fee_decision_procedure_type: case_.fee_decision_procedure_type || '',
      fee_decision_circulated_date: case_.fee_decision_circulated_date || '',
      fee_decision_procedure_date: case_.fee_decision_procedure_date || '',
      fee_decision_procedure_time: case_.fee_decision_procedure_time || '',
      fee_resolution_fixed: !!case_.fee_resolution_fixed,
      fee_resolution_time_costs: !!case_.fee_resolution_time_costs,
      fee_resolution_percentage: !!case_.fee_resolution_percentage,
      fee_estimate: {
        ...feeEstimate,
        number_of_employees: feeEstimate.number_of_employees || 0,
        number_of_creditors: feeEstimate.number_of_creditors || 0,
        number_of_shareholders: feeEstimate.number_of_shareholders || 0,
        liquidation_committee: feeEstimate.liquidation_committee || 'no',
        stakeholder_concerns_sip2: feeEstimate.stakeholder_concerns_sip2 || 'no',
        investigations_complexity: feeEstimate.investigations_complexity || 'standard',
        antecedent_transactions_identified: feeEstimate.antecedent_transactions_identified || 'no',
        public_interest: feeEstimate.public_interest || 'low',
        assets_realisations_complexity: feeEstimate.assets_realisations_complexity || 'simple',
        disputes_with_key_creditors: feeEstimate.disputes_with_key_creditors || 'no',
        case_complexity_assessment: feeEstimate.case_complexity_assessment || 'simple',
      }
    }));
  };

  const handleSaveCaseParameters = async () => {
    setIsSaving(true);
    try {
      const updatedFeeEstimateParameters = {
        ...(localCaseData.fee_estimate || {}),
        number_of_employees: localCaseData.fee_estimate?.number_of_employees || 0,
        number_of_creditors: localCaseData.fee_estimate?.number_of_creditors || 0,
        number_of_shareholders: localCaseData.fee_estimate?.number_of_shareholders || 0,
        liquidation_committee: localCaseData.fee_estimate?.liquidation_committee || 'no',
        stakeholder_concerns_sip2: localCaseData.fee_estimate?.stakeholder_concerns_sip2 || 'no',
        investigations_complexity: localCaseData.fee_estimate?.investigations_complexity || 'standard',
        antecedent_transactions_identified: localCaseData.fee_estimate?.antecedent_transactions_identified || 'no',
        public_interest: localCaseData.fee_estimate?.public_interest || 'low',
        assets_realisations_complexity: localCaseData.fee_estimate?.assets_realisations_complexity || 'simple',
        disputes_with_key_creditors: localCaseData.fee_estimate?.disputes_with_key_creditors || 'no',
        case_complexity_assessment: localCaseData.fee_estimate?.case_complexity_assessment || 'simple',
      };

      const updateData = {
        ...localCaseData,
        fee_estimate: updatedFeeEstimateParameters,
        soa_etr: localCaseData.soa_etr,
        fee_decision_procedure_type: localCaseData.fee_decision_procedure_type,
        fee_decision_circulated_date: localCaseData.fee_decision_circulated_date,
        fee_decision_procedure_date: localCaseData.fee_decision_procedure_date,
        fee_decision_procedure_time: localCaseData.fee_decision_procedure_time,
        fee_resolution_fixed: localCaseData.fee_resolution_fixed,
        fee_resolution_time_costs: localCaseData.fee_resolution_time_costs,
        fee_resolution_percentage: localCaseData.fee_resolution_percentage,
      };

      await base44.entities.Case.update(localCaseData.id, updateData);
      if (onCaseUpdate) await onCaseUpdate();
    } catch (error) {
      console.error("Failed to save case parameters:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDetailedFeeEstimate = async () => {
    setIsSaving(true);
    try {
      const updatedFeeEstimateData = allFeeEstimateActivities.map(activity => ({
        ...activity,
        ...caseFeeEstimate[activity.id],
      }));

      await base44.entities.Case.update(case_.id, {
        fee_estimate_data: JSON.stringify(updatedFeeEstimateData)
      });
    } catch (error) {
      console.error('Error saving detailed fee estimate:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVotes = async () => {
    setIsSavingVotes(true);
    try {
      await base44.entities.Case.update(localCaseData.id, { resolutions: localCaseData.resolutions });
    } catch (error) {
      console.error('Error saving votes:', error);
      alert('Failed to save votes. Please try again.');
    } finally {
      setIsSavingVotes(false);
    }
  };

  const exportTimeLedgerAsHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Time Ledger - ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 10px; font-size: 11px; }
    h1 { color: #333; font-size: 14px; margin-bottom: 5px; text-align: center; }
    .info { color: #666; margin-bottom: 10px; font-size: 10px; text-align: center; }
    table { width: 50%; border-collapse: collapse; margin: 10px auto; font-size: 11px; table-layout: fixed; }
    th { background-color: #A57C00; color: white; padding: 4px; text-align: center; font-weight: bold; border: 1px solid #8B6800; font-size: 10px; height: 30px; }
    th:first-child { text-align: left; width: 25%; }
    th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6), th:nth-child(7) { width: 12.5%; }
    td { padding: 3px; border: 1px solid #ddd; text-align: center; font-size: 10px; height: 20px; }
    td:first-child { text-align: left; font-weight: 500; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .total-row { background-color: #A57C00 !important; color: white; font-weight: bold; }
    .total-cost-row { background-color: #8B6800 !important; color: white; font-weight: bold; }
    .spacer-row { height: 5px; background: transparent !important; border: none !important; }
    .spacer-row td { border: none !important; }
  </style>
</head>
<body>
  <h1>Time Ledger</h1>
  <div class="info">
    <strong>Case:</strong> ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})<br>
    <strong>Period:</strong> ${dateFrom ? new Date(dateFrom).toLocaleDateString('en-GB') : 'N/A'} - ${dateTo ? new Date(dateTo).toLocaleDateString('en-GB') : 'N/A'}<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}
  </div>

  <table>
    <thead>
      <tr>
        <th>Category Name</th>
        <th>IP Directors<br>Hours</th>
        <th>Managers<br>Hours</th>
        <th>Administrators<br>Hours</th>
        <th>Total<br>Hours</th>
        <th>Total<br>Cost (£)</th>
        <th>Avg Rate<br>per hour (£)</th>
      </tr>
    </thead>
    <tbody>
      ${ALL_CATEGORIES.map(category => {
        const data = timeLedger[category];
        const ipHours = data['IP Directors'].hours;
        const managerHours = data['Managers'].hours;
        const adminHours = data['Administrators'].hours;
        const totalHours = ipHours + managerHours + adminHours;
        const totalCost = data['IP Directors'].cost + data['Managers'].cost + data['Administrators'].cost;
        const avgRate = totalHours > 0 ? totalCost / totalHours : 0;

        return `
          <tr>
            <td>${category}</td>
            <td>${formatHours(ipHours)}</td>
            <td>${formatHours(managerHours)}</td>
            <td>${formatHours(adminHours)}</td>
            <td>${formatHours(totalHours)}</td>
            <td>${formatCurrency(totalCost)}</td>
            <td>${formatCurrency(avgRate)}</td>
          </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td>Total</td>
        <td>${formatHours(ledgerTotals.ipHours)}</td>
        <td>${formatHours(ledgerTotals.managerHours)}</td>
        <td>${formatHours(ledgerTotals.adminHours)}</td>
        <td>${formatHours(ledgerGrandTotal.hours)}</td>
        <td>${formatCurrency(ledgerGrandTotal.cost)}</td>
        <td>${formatCurrency(ledgerGrandTotal.hours > 0 ? ledgerGrandTotal.cost / ledgerGrandTotal.hours : 0)}</td>
      </tr>
      <tr class="spacer-row">
        <td colspan="7"></td>
      </tr>
      <tr class="total-cost-row">
        <td>Total (£)</td>
        <td>${formatCurrency(ledgerTotals.ipCost)}</td>
        <td>${formatCurrency(ledgerTotals.managerCost)}</td>
        <td>${formatCurrency(ledgerTotals.adminCost)}</td>
        <td></td>
        <td>${formatCurrency(ledgerGrandTotal.cost)}</td>
        <td>${formatCurrency(ledgerGrandTotal.hours > 0 ? ledgerGrandTotal.cost / ledgerGrandTotal.hours : 0)}</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the time ledger');
    }
  };

  const exportVotesAsHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Creditor Votes - ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
    h1 { color: #333; font-size: 18px; margin-bottom: 10px; text-align: center; }
    .info { color: #666; margin-bottom: 20px; font-size: 11px; text-align: center; }
    .resolution { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
    .resolution-name { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #333; }
    .resolution-text { margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-left: 3px solid #8b5cf6; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
    th { background-color: #8b5cf6; color: white; padding: 8px; text-align: left; font-weight: bold; border: 1px solid #7c3aed; }
    td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .vote-for { color: #059669; font-weight: bold; }
    .vote-against { color: #dc2626; font-weight: bold; }
    .total-row { background-color: #e9d5ff !important; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Creditor Votes</h1>
  <div class="info">
    <strong>Case:</strong> ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}
  </div>

  ${(localCaseData.resolutions || []).map((resolution, idx) => {
    const votes = resolution.votes || {};
    const totalFor = Object.values(votes).filter(v => v === 'for').length;
    const totalAgainst = Object.values(votes).filter(v => v === 'against').length;
    
    return `
    <div class="resolution">
      <div class="resolution-name">Resolution ${idx + 1}: ${resolution.name || 'Unnamed Resolution'}</div>
      ${resolution.full_text ? `<div class="resolution-text">${resolution.full_text}</div>` : ''}
      
      <table>
        <thead>
          <tr>
            <th>Creditor</th>
            <th>Vote</th>
            <th>Amount (£)</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(votes).map(([creditorId, vote]) => {
            return `
            <tr>
              <td>${creditorId}</td>
              <td class="${vote === 'for' ? 'vote-for' : 'vote-against'}">${vote === 'for' ? 'FOR' : 'AGAINST'}</td>
              <td>—</td>
            </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td>TOTALS</td>
            <td><span class="vote-for">FOR: ${totalFor}</span> / <span class="vote-against">AGAINST: ${totalAgainst}</span></td>
            <td>—</td>
          </tr>
        </tbody>
      </table>
    </div>
    `;
  }).join('')}
</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the votes report');
    }
  };

  const handleExportFeeEstimate = () => {
    if (!allFeeEstimateActivities.length) return;

    const companyName = localCaseData.company_name || 'N/A';
    const caseReference = localCaseData.case_reference || 'N/A';

    const exportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fee Estimate - ${companyName}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; color: #333; }
        h1 { text-align: center; font-size: 24px; margin-bottom: 10px; color: #1a202c; }
        h2 { text-align: center; font-size: 18px; color: #64748b; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        th, td { padding: 12px 15px; border: 1px solid #e2e8f0; font-size: 13px; }
        th { background-color: #f1f5f9; font-weight: 600; text-align: left; color: #4a5568; }
        td { color: #2d3748; }
        .category-header { background-color: #e0e7ff; font-weight: 700; color: #2b6cb0; padding: 10px 15px; border-bottom: 2px solid #a7c3ff; }
        .total-row { font-weight: 700; background-color: #f8fafc; color: #065f46; }
        .grand-total-row { font-weight: 800; background-color: #d1fae5; color: #047857; font-size: 14px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .notes-column { width: 20%; }
        .hours-column { width: 8%; }
    </style>
</head>
<body>
    <h1>Fee Estimate</h1>
    <h2>${companyName} - ${caseReference}</h2>
    
    <table>
        <thead>
            <tr>
                <th style="width: 20%;">Activity</th>
                <th class="text-center hours-column">Partner<br/>(£${HOURLY_RATES.Partner}/hr)</th>
                <th class="text-center hours-column">Manager<br/>(£${HOURLY_RATES.Manager}/hr)</th>
                <th class="text-center hours-column">Executive<br/>(£${HOURLY_RATES.Executive}/hr)</th>
                <th class="text-center hours-column">Secretary<br/>(£${HOURLY_RATES.Secretary}/hr)</th>
                <th class="text-center hours-column">Total Hours</th>
                <th class="text-right hours-column">Total Cost (£)</th>
                <th class="notes-column">Notes</th>
            </tr>
        </thead>
        <tbody>
            ${FEE_ESTIMATE_CATEGORIES.map(category => {
                const categoryActivities = allFeeEstimateActivities.filter(t => t.category === category.id);
                const { totalHours: catTotalHours, totalCost: catTotalCost } = calculateCategoryTotals(category.id);

                if (categoryActivities.length === 0) return '';

                return `
                    <tr>
                        <td colspan="8" class="category-header">${category.name}</td>
                    </tr>
                    ${categoryActivities.map(task => {
                        const taskData = caseFeeEstimate[task.id] || {};
                        const partnerHours = parseFloat(taskData.partner_hours || 0);
                        const managerHours = parseFloat(taskData.manager_hours || 0);
                        const executiveHours = parseFloat(taskData.executive_hours || 0);
                        const secretaryHours = parseFloat(taskData.secretary_hours || 0);
                        const { totalHours: taskTotalHours, totalCost: taskTotalCost } = calculateTaskTotals(task);
                        return `
                            <tr>
                                <td>${task.activity}</td>
                                <td class="text-center">${partnerHours.toFixed(1)}</td>
                                <td class="text-center">${managerHours.toFixed(1)}</td>
                                <td class="text-center">${executiveHours.toFixed(1)}</td>
                                <td class="text-center">${secretaryHours.toFixed(1)}</td>
                                <td class="text-center">${taskTotalHours.toFixed(1)}</td>
                                <td class="text-right">${taskTotalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td>${taskData.notes || '—'}</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="total-row">
                        <td colspan="5" class="text-right">Total for ${category.name}:</td>
                        <td class="text-center">${catTotalHours.toFixed(1)}</td>
                        <td class="text-right">${catTotalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td></td>
                    </tr>
                `;
            }).join('')}
            ${(() => {
                const { grandTotalHours, grandTotalCost } = calculateGrandTotals();
                return `
                    <tr class="grand-total-row">
                        <td colspan="5" class="text-right">Grand Total:</td>
                        <td class="text-center">${grandTotalHours.toFixed(1)}</td>
                        <td class="text-right">${grandTotalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td></td>
                    </tr>
                `;
            })()}
        </tbody>
    </table>
</body>
</html>
    `;

    const blob = new Blob([exportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.document.write(exportContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the fee estimate report.');
    }
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const handleExportSIP9 = () => {
    const companyName = localCaseData.company_name || 'N/A';
    const caseReference = localCaseData.case_reference || 'N/A';
    const { categories, grandTotalHours, grandTotalCost } = sip9ReportData;

    const exportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIP9 Time Analysis - ${companyName} (${caseReference})</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; line-height: 1.6; color: #333; font-size: 13px; }
        h1 { text-align: center; font-size: 24px; margin-bottom: 10px; color: #1a202c; }
        h2 { text-align: center; font-size: 18px; color: #64748b; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        th, td { padding: 12px 15px; border: 1px solid #e2e8f0; }
        th { background-color: #A57C00; color: white; font-weight: 600; text-align: left; font-size: 14px; }
        th.text-right { text-align: right; }
        td { color: #2d3748; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .total-row th { background-color: #8B6800; }
        .total-row th:first-child { text-align: left; }
    </style>
</head>
<body>
    <h1>Estimated Time Costs on a Blended Rate Basis</h1>
    <h2>${companyName} - ${caseReference}</h2>
    
    <table>
        <thead>
            <tr>
                <th>Category</th>
                <th class="text-right">Time (Hours)</th>
                <th class="text-right">Cost (£)</th>
                <th class="text-right">Average Hourly Cost (£)</th>
            </tr>
        </thead>
        <tbody>
            ${categories.map((entry) => {
                return `
                    <tr>
                        <td>${entry.name}</td>
                        <td class="text-right">${entry.totalHours > 0 ? entry.totalHours.toFixed(2) : '0.00'}</td>
                        <td class="text-right">${formatCurrency(entry.totalCost)}</td>
                        <td class="text-right">${formatCurrency(entry.averageHourlyCost)}</td>
                    </tr>
                `;
              }).join('')}
            <tr class="total-row">
              <th className="text-left font-bold" style="background-color: #8B6800; color: white; border-right: 3px solid white">TOTAL</th>
              <th className="text-right font-bold" style="background-color: #8B6800; color: white; border-right: 3px solid white">${sip9ReportData.grandTotalHours.toFixed(2)}</th>
              <th className="text-right font-bold" style="background-color: #8B6800; color: white; border-right: 3px solid white">${formatCurrency(sip9ReportData.grandTotalCost)}</th>
              <th className="text-right font-bold" style="background-color: #8B6800; color: white">
                ${formatCurrency(sip9ReportData.grandTotalHours > 0 ? sip9ReportData.grandTotalCost / sip9ReportData.grandTotalHours : 0)}
              </th>
            </tr>
        </tbody>
    </table>
</body>
</html>
    `;

    const blob = new Blob([exportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (newWindow) {
      newWindow.document.write(exportContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the SIP9 Time Analysis report.');
    }
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  return (
    <div className="flex h-full">
      {/* Left Side Menu */}
      <div className="w-64 flex-shrink-0 border-r bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-800 mb-4">Budget & Fees</h3>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveBudgetSection('case-parameters')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'case-parameters'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Case Parameters
          </button>
          <button
            onClick={() => setActiveBudgetSection('fee-estimate')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'fee-estimate'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Fee Estimate
          </button>
          <button
            onClick={() => setActiveBudgetSection('sip9-fee-table')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'sip9-fee-table'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            SIP9 Time Analysis
          </button>
          <button
            onClick={() => setActiveBudgetSection('decision-procedure')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'decision-procedure'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Decision Procedure
          </button>
          <button
            onClick={() => setActiveBudgetSection('votes')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'votes'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Votes
          </button>
          <button
            onClick={() => setActiveBudgetSection('wip')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeBudgetSection === 'wip'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Work in Progress
          </button>
        </nav>
      </div>

      {/* Right Side Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeBudgetSection === 'case-parameters' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Case Parameters</h2>
                <p className="text-slate-600">Estimate key case metrics for fee calculation</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetCaseParameters}
                  className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCaseParameters}
                  disabled={isSaving}
                  className="bg-blue-700 hover:bg-blue-800"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </div>

            <Card className="border-slate-200">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Case Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="number_of_employees">Number of Employees</Label>
                    <Input
                      id="number_of_employees"
                      type="number"
                      value={localCaseData.fee_estimate?.number_of_employees || ''}
                      onChange={(e) => handleInputChange('fee_estimate.number_of_employees', parseInt(e.target.value) || 0)}
                      placeholder="Enter number"
                      className="bg-blue-50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number_of_creditors">Number of Creditors</Label>
                    <Input
                      id="number_of_creditors"
                      type="number"
                      value={localCaseData.fee_estimate?.number_of_creditors || ''}
                      onChange={(e) => handleInputChange('fee_estimate.number_of_creditors', parseInt(e.target.value) || 0)}
                      placeholder="Enter number"
                      className="bg-blue-50"
                    />
                  </div>

                  <div>
                    <Label htmlFor="number_of_shareholders">Number of Shareholders</Label>
                    <Input
                      id="number_of_shareholders"
                      type="number"
                      value={localCaseData.fee_estimate?.number_of_shareholders || ''}
                      onChange={(e) => handleInputChange('fee_estimate.number_of_shareholders', parseInt(e.target.value) || 0)}
                      placeholder="Enter number"
                      className="bg-blue-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="liquidation_committee">Liquidation Committee</Label>
                    <Select
                      value={localCaseData.fee_estimate?.liquidation_committee || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.liquidation_committee', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="stakeholder_concerns_sip2">Stakeholder Concerns (SIP 2)</Label>
                    <Select
                      value={localCaseData.fee_estimate?.stakeholder_concerns_sip2 || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.stakeholder_concerns_sip2', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="investigations_complexity">Investigations</Label>
                    <Select
                      value={localCaseData.fee_estimate?.investigations_complexity || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.investigations_complexity', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select complexity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="complex">Complex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="antecedent_transactions">Antecedent Transactions Identified</Label>
                    <Select
                      value={localCaseData.fee_estimate?.antecedent_transactions_identified || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.antecedent_transactions_identified', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="public_interest">Public Interest</Label>
                    <Select
                      value={localCaseData.fee_estimate?.public_interest || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.public_interest', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="assets_realisations">Assets Realisations</Label>
                    <Select
                      value={localCaseData.fee_estimate?.assets_realisations_complexity || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.assets_realisations_complexity', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select complexity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="complex">Complex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="disputes_creditors">Disputes with Key Creditors</Label>
                    <Select
                      value={localCaseData.fee_estimate?.disputes_with_key_creditors || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.disputes_with_key_creditors', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="case_complexity">Case Complexity Assessment</Label>
                    <Select
                      value={localCaseData.fee_estimate?.case_complexity_assessment || ''}
                      onValueChange={(value) => handleInputChange('fee_estimate.case_complexity_assessment', value)}
                    >
                      <SelectTrigger className="bg-blue-50">
                        <SelectValue placeholder="Select complexity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="simple">Simple</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="complex">Complex</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeBudgetSection === 'fee-estimate' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Fee Estimate</h2>
                <p className="text-slate-600">Detailed fee estimation by activity</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleExportFeeEstimate}
                  variant="outline"
                  className="text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export HTML
                </Button>
                <Button
                  onClick={() => {
                    if (!feeEstimateTemplate || !feeEstimateTemplate.template_data) {
                      alert('No fee estimate template found.');
                      return;
                    }
                    if (confirm('This will sync the fee estimate with the current template. Existing hours and notes for matching activities will be preserved. New activities from the template will be added. Continue?')) {
                      try {
                        const templateActivities = typeof feeEstimateTemplate.template_data === 'string'
                          ? JSON.parse(feeEstimateTemplate.template_data)
                          : feeEstimateTemplate.template_data;

                        const newCaseFeeEstimate = {};
                        templateActivities.forEach(templateActivity => {
                          newCaseFeeEstimate[templateActivity.id] = {
                            partner_hours: caseFeeEstimate[templateActivity.id]?.partner_hours || templateActivity.partner_hours || '',
                            manager_hours: caseFeeEstimate[templateActivity.id]?.manager_hours || templateActivity.manager_hours || '',
                            executive_hours: caseFeeEstimate[templateActivity.id]?.executive_hours || templateActivity.executive_hours || '',
                            secretary_hours: caseFeeEstimate[templateActivity.id]?.secretary_hours || templateActivity.secretary_hours || '',
                            notes: caseFeeEstimate[templateActivity.id]?.notes || templateActivity.notes || '',
                          };
                        });

                        setCaseFeeEstimate(newCaseFeeEstimate);

                        const activitiesToSave = templateActivities.map(templateActivity => ({
                          ...templateActivity,
                          ...newCaseFeeEstimate[templateActivity.id]
                        }));

                        base44.entities.Case.update(case_.id, {
                          fee_estimate_data: JSON.stringify(activitiesToSave)
                        }).catch(error => {
                          console.error('Error saving synced fee estimate:', error);
                          alert('Failed to save synced fee estimate: ' + error.message);
                        });
                      } catch (error) {
                        console.error('Error parsing template data for sync:', error);
                        alert('Failed to parse template data: ' + error.message);
                      }
                    }
                  }}
                  variant="outline"
                  className="text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync from Template
                </Button>
                <Button
                  onClick={() => setFeeEstimateLocked(!feeEstimateLocked)}
                  variant={feeEstimateLocked ? "destructive" : "outline"}
                  className={feeEstimateLocked ? "bg-red-600 hover:bg-red-700 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}
                >
                  {feeEstimateLocked ? (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Locked
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4 mr-2" />
                      Unlocked
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleSaveDetailedFeeEstimate}
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={isSaving || feeEstimateLocked}
                >
                  {isSaving ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
                  Save Fee Estimate
                </Button>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-600 text-white">
                      <th className="text-left p-2 font-semibold border-r border-purple-500 min-w-[250px]">Activity</th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-20">
                        <div>Partner/</div>
                        <div>Director</div>
                        <div className="text-[10px] font-normal mt-1">(£{HOURLY_RATES.Partner}/hr)</div>
                      </th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-20">
                        <div>Manager/</div>
                        <div>Asst Mgr</div>
                        <div className="text-[10px] font-normal mt-1">(£{HOURLY_RATES.Manager}/hr)</div>
                      </th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-20">
                        <div>Executive/</div>
                        <div>Admin</div>
                        <div className="text-[10px] font-normal mt-1">(£{HOURLY_RATES.Executive}/hr)</div>
                      </th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-20">Secretary<br/>Hours</th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-24">Total Hrs</th>
                      <th className="text-center p-2 font-semibold border-r border-purple-500 w-24">Total Cost</th>
                      <th className="text-left p-2 font-semibold min-w-[200px]">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FEE_ESTIMATE_CATEGORIES.map(category => {
                      const categoryActivities = allFeeEstimateActivities.filter(t => t.category === category.id);
                      const { totalHours: catTotalHours, totalCost: catTotalCost } = calculateCategoryTotals(category.id);

                      return (
                        <React.Fragment key={category.id}>
                          <tr className="bg-slate-700 text-white font-semibold">
                            <td colSpan="8" className="p-1.5 text-xs">
                              {category.name}
                            </td>
                          </tr>

                          {categoryActivities.map(taskActivity => {
                            const taskData = caseFeeEstimate[taskActivity.id] || {};
                            const { totalHours, totalCost } = calculateTaskTotals(taskActivity);

                            return (
                              <tr key={taskActivity.id} className="border-b border-slate-200 hover:bg-slate-50">
                                <td className="p-1 text-xs border-r">{taskActivity.activity}</td>
                                <td className="p-0 border-r">
                                  <input
                                    type="number"
                                    className="w-full h-8 text-center text-xs border-0 focus:ring-1 focus:ring-purple-300 p-0 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={taskData.partner_hours || ''}
                                    onChange={(e) => updateTaskFeeEstimate(taskActivity.id, 'partner_hours', e.target.value)}
                                    disabled={feeEstimateLocked}
                                  />
                                </td>
                                <td className="p-0 border-r">
                                  <input
                                    type="number"
                                    className="w-full h-8 text-center text-xs border-0 focus:ring-1 focus:ring-purple-300 p-0 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={taskData.manager_hours || ''}
                                    onChange={(e) => updateTaskFeeEstimate(taskActivity.id, 'manager_hours', e.target.value)}
                                    disabled={feeEstimateLocked}
                                  />
                                </td>
                                <td className="p-0 border-r">
                                  <input
                                    type="number"
                                    className="w-full h-8 text-center text-xs border-0 focus:ring-1 focus:ring-purple-300 p-0 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={taskData.executive_hours || ''}
                                    onChange={(e) => updateTaskFeeEstimate(taskActivity.id, 'executive_hours', e.target.value)}
                                    disabled={feeEstimateLocked}
                                  />
                                </td>
                                <td className="p-0 border-r">
                                  <input
                                    type="number"
                                    className="w-full h-8 text-center text-xs border-0 focus:ring-1 focus:ring-purple-300 p-0 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="0"
                                    min="0"
                                    step="0.5"
                                    value={taskData.secretary_hours || ''}
                                    onChange={(e) => updateTaskFeeEstimate(taskActivity.id, 'secretary_hours', e.target.value)}
                                    disabled={feeEstimateLocked}
                                  />
                                </td>
                                <td className="p-1 text-center text-xs border-r font-semibold bg-slate-100">
                                  {totalHours.toFixed(1)}
                                </td>
                                <td className="p-1 text-right text-xs border-r font-semibold bg-slate-100">
                                  £{totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="p-0 border-r">
                                  <input
                                    type="text"
                                    className="w-full h-8 text-xs border-0 focus:ring-1 focus:ring-purple-300 px-1 py-0 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="Add notes..."
                                    value={taskData.notes || ''}
                                    onChange={(e) => updateTaskFeeEstimate(taskActivity.id, 'notes', e.target.value)}
                                    disabled={feeEstimateLocked}
                                  />
                                </td>
                              </tr>
                            );
                          })}

                          <tr className="bg-slate-200 border-b-2 border-slate-400 font-semibold">
                            <td className="p-1 text-xs border-r">Subtotal:</td>
                            <td colSpan="6" className="p-1 text-center text-xs border-r">
                              Total Hours: {catTotalHours.toFixed(1)} &nbsp;&nbsp;&nbsp; Total Cost: £{catTotalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-1 text-xs"></td>
                          </tr>
                        </React.Fragment>
                      );
                    })}

                    {(() => {
                      const { grandTotalHours, grandTotalCost } = calculateGrandTotals();
                      return (
                        <tr className="bg-slate-800 text-white font-bold">
                          <td className="p-1.5 text-xs border-r">TOTAL</td>
                          <td colSpan="5" className="p-1 text-right text-xs border-r">
                            Total Hours: {grandTotalHours.toFixed(1)}
                          </td>
                          <td className="p-1 text-right text-xs border-r">
                            £{grandTotalCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-1 text-xs"></td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeBudgetSection === 'sip9-fee-table' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Estimated Time Costs on a Blended Rate Basis</h2>
                <p className="text-slate-600">Breakdown of fee estimate by activity category</p>
              </div>
              <Button
                onClick={handleExportSIP9}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Export HTML
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: '#A57C00' }}>
                    <TableHead className="text-white font-semibold" style={{ width: '40%', borderRight: '3px solid white' }}>Category</TableHead>
                    <TableHead className="text-white font-semibold text-right" style={{ width: '20%', borderRight: '3px solid white' }}>Time (Hours)</TableHead>
                    <TableHead className="text-white font-semibold text-right" style={{ width: '20%', borderRight: '3px solid white' }}>Cost (£)</TableHead>
                    <TableHead className="text-white font-semibold text-right" style={{ width: '20%' }}>Average Hourly Cost (£)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sip9ReportData.categories.map((entry) => (
                    <TableRow key={entry.name}>
                      <TableCell className="font-medium" style={{ borderRight: '3px solid white', backgroundColor: '#f8f9fa' }}>{entry.name}</TableCell>
                      <TableCell className="text-right" style={{ borderRight: '3px solid white', backgroundColor: '#f8f9fa' }}>
                        {entry.totalHours > 0 ? entry.totalHours.toFixed(2) : '0.00'}
                      </TableCell>
                      <TableCell className="text-right" style={{ borderRight: '3px solid white', backgroundColor: '#f8f9fa' }}>
                        {formatCurrency(entry.totalCost)}
                      </TableCell>
                      <TableCell className="text-right" style={{ backgroundColor: '#f8f9fa' }}>
                        {formatCurrency(entry.averageHourlyCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="total-row">
                    <th className="text-left font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>TOTAL</th>
                    <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>{sip9ReportData.grandTotalHours.toFixed(2)}</th>
                    <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>{formatCurrency(sip9ReportData.grandTotalCost)}</th>
                    <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white' }}>
                      {formatCurrency(sip9ReportData.grandTotalHours > 0 ? sip9ReportData.grandTotalCost / sip9ReportData.grandTotalHours : 0)}
                    </th>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {activeBudgetSection === 'decision-procedure' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Decision Procedure</h2>
              <p className="text-slate-600">Fee approval decision procedure details</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 shadow-sm">
              <Label className="text-slate-700 font-medium text-lg">Fee Estimate</Label>
              <div className="relative mt-2">
                <Input
                  type="text"
                  value={`£${calculateTotalFeeEstimate().toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  className="bg-white border-green-300 font-bold text-green-700 text-xl"
                  readOnly
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Calculated from Fee Estimate table</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label htmlFor="fee_decision_procedure_type" className="text-slate-700 font-medium">Type of Decision Procedure for Fee Approval</Label>
                <Select
                  value={localCaseData.fee_decision_procedure_type || ''}
                  onValueChange={(value) => handleInputChange('fee_decision_procedure_type', value)}
                >
                  <SelectTrigger id="fee_decision_procedure_type" className="mt-2 bg-white">
                    <SelectValue placeholder="Select procedure type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deemed Consent">Deemed Consent</SelectItem>
                    <SelectItem value="Virtual Meeting">Virtual Meeting</SelectItem>
                    <SelectItem value="Physical Meeting">Physical Meeting</SelectItem>
                    <SelectItem value="Correspondence">Correspondence</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label htmlFor="fee_decision_circulated_date" className="text-slate-700 font-medium">Date Circulated</Label>
                <Input
                  id="fee_decision_circulated_date"
                  type="date"
                  value={formatForInput(localCaseData.fee_decision_circulated_date)}
                  onChange={(e) => handleInputChange('fee_decision_circulated_date', e.target.value)}
                  className="mt-2 bg-white"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label htmlFor="fee_decision_procedure_date" className="text-slate-700 font-medium">Date of Decision Procedure</Label>
                <Input
                  id="fee_decision_procedure_date"
                  type="date"
                  value={formatForInput(localCaseData.fee_decision_procedure_date)}
                  onChange={(e) => handleInputChange('fee_decision_procedure_date', e.target.value)}
                  className="mt-2 bg-white"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <Label htmlFor="fee_decision_procedure_time" className="text-slate-700 font-medium">Time</Label>
                <Input
                  id="fee_decision_procedure_time"
                  type="time"
                  value={localCaseData.fee_decision_procedure_time || ''}
                  onChange={(e) => handleInputChange('fee_decision_procedure_time', e.target.value)}
                  className="mt-2 bg-white"
                />
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Fee Resolution Sought</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fee_resolution_fixed"
                      checked={localCaseData.fee_resolution_fixed || false}
                      onChange={(e) => handleInputChange('fee_resolution_fixed', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="fee_resolution_fixed" className="ml-3 text-slate-700 font-medium cursor-pointer">
                      Fixed Fee
                    </Label>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fee_resolution_time_costs"
                      checked={localCaseData.fee_resolution_time_costs || false}
                      onChange={(e) => handleInputChange('fee_resolution_time_costs', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="fee_resolution_time_costs" className="ml-3 text-slate-700 font-medium cursor-pointer">
                      Time Costs
                    </Label>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fee_resolution_percentage"
                      checked={localCaseData.fee_resolution_percentage || false}
                      onChange={(e) => handleInputChange('fee_resolution_percentage', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="fee_resolution_percentage" className="ml-3 text-slate-700 font-medium cursor-pointer">
                      % of Realisations
                    </Label>
                  </div>
                </div>
              </div>
            </div>

            {localCaseData.fee_decision_procedure_date && (
              <Card className="border-amber-200 shadow-lg bg-amber-50">
                <CardContent className="p-6 text-center">
                  <Label className="text-slate-700 font-medium text-lg">Days Remaining till Deadline</Label>
                  <div className="mt-3">
                    <span className="text-5xl font-bold text-amber-700">
                      {(() => {
                        const deadline = new Date(localCaseData.fee_decision_procedure_date);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        deadline.setHours(0, 0, 0, 0);
                        const diffTime = deadline - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return diffDays >= 0 ? diffDays : 0;
                      })()}
                    </span>
                    <span className="text-2xl text-slate-600 ml-2">days</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeBudgetSection === 'votes' && (
          <div className="space-y-6">
            <Card className="border border-slate-200">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-slate-900 font-bold flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-purple-600" />
                    Creditor Votes
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={exportVotesAsHTML}
                      variant="outline"
                      size="sm"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      onClick={() => setVotesLocked(!votesLocked)}
                      variant="outline"
                      size="sm"
                      className={votesLocked ? "border-red-300 text-red-700 hover:bg-red-50" : "border-green-300 text-green-700 hover:bg-green-50"}
                    >
                      {votesLocked ? (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Locked
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4 mr-2" />
                          Unlocked
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={handleSaveVotes}
                      variant="outline"
                      size="sm"
                      className="border-blue-300 text-blue-700 hover:bg-blue-50"
                      disabled={isSavingVotes}
                    >
                      {isSavingVotes ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        const newResolution = {
                          id: `resolution_${Date.now()}`,
                          name: `Resolution ${(localCaseData.resolutions || []).length + 1}`,
                          full_text: '',
                          votes: {}
                        };
                        const updatedResolutions = [...(localCaseData.resolutions || []), newResolution];
                        handleInputChange('resolutions', updatedResolutions);
                      }}
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700"
                      disabled={votesLocked}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Resolution
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <VotesTable
                  caseId={localCaseData.id}
                  resolutions={localCaseData.resolutions || []}
                  onResolutionsChange={(updatedResolutions) => handleInputChange('resolutions', updatedResolutions)}
                  isLocked={votesLocked}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeBudgetSection === 'wip' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Work in Progress (Time Costs) Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingWIP ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <PoundSterling className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-blue-900">Current WIP</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 mb-1">
                          {formatCurrency(totalWIP)}
                        </p>
                        <p className="text-sm text-blue-700">
                          Time to date
                        </p>
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-900">Fee Estimate</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 mb-1">
                          {formatCurrency(calculateGrandTotals().grandTotalCost)}
                        </p>
                        <p className="text-sm text-green-700">
                          {calculateGrandTotals().grandTotalCost > 0 && totalWIP > 0 ? `${((totalWIP / calculateGrandTotals().grandTotalCost) * 100).toFixed(1)}% utilized` : 'Not set'}
                        </p>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-5 h-5 text-amber-600" />
                          <span className="font-medium text-amber-900">Age of Case</span>
                        </div>
                        <p className="text-2xl font-bold text-amber-900 mb-1">
                          {getCaseAge(case_?.appointment_date)}
                        </p>
                        <p className="text-sm text-amber-700">
                          Since {case_?.appointment_date ? new Date(case_?.appointment_date).toLocaleDateString('en-GB') : 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                      <div>
                        <Label htmlFor="date-from" className="text-sm font-medium text-slate-700">Date From</Label>
                        <Input
                          id="date-from"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date-to" className="text-sm font-medium text-slate-700">Date To</Label>
                        <Input
                          id="date-to"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-amber-700" />
                    Time Ledger
                  </CardTitle>
                  {dateFrom && dateTo && Object.keys(timeLedger).length > 0 && (
                    <Button onClick={exportTimeLedgerAsHTML} variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      Export as HTML
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingWIP ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow style={{ backgroundColor: '#A57C00' }}>
                          <TableHead className="font-bold text-white border-r border-[#8B6800] py-2">Category Name</TableHead>
                          <TableHead className="font-bold text-white text-center border-r border-[#8B6800] py-2">IP Directors<br/>Hours</TableHead>
                          <TableHead className="font-bold text-white text-center border-r border-[#8B6800] py-2">Managers<br/>Hours</TableHead>
                          <TableHead className="font-bold text-white text-center border-r border-[#8B6800] py-2">Administrators<br/>Hours</TableHead>
                          <TableHead className="font-bold text-white text-center border-r border-[#8B6800] py-2">Total<br/>Hours</TableHead>
                          <TableHead className="font-bold text-white text-right border-r border-[#8B6800] py-2">Total<br/>Cost (£)</TableHead>
                          <TableHead className="font-bold text-white text-right py-2">Avg Rate<br/>per hour (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ALL_CATEGORIES.map((category) => {
                          const data = timeLedger[category];
                          const ipHours = data['IP Directors'].hours;
                          const managerHours = data['Managers'].hours;
                          const adminHours = data['Administrators'].hours;
                          const totalHours = ipHours + managerHours + adminHours;
                          const totalCost = data['IP Directors'].cost + data['Managers'].cost + data['Administrators'].cost;
                          const avgRate = totalHours > 0 ? totalCost / totalHours : 0;

                          return (
                            <TableRow key={category} className="border-b">
                              <TableCell className="font-medium py-2">{category}</TableCell>
                              <TableCell className="text-center py-2">{formatHours(ipHours)}</TableCell>
                              <TableCell className="text-center py-2">{formatHours(managerHours)}</TableCell>
                              <TableCell className="text-center py-2">{formatHours(adminHours)}</TableCell>
                              <TableCell className="text-center font-semibold py-2">{formatHours(totalHours)}</TableCell>
                              <TableCell className="text-right font-semibold py-2">{formatCurrency(totalCost)}</TableCell>
                              <TableCell className="text-right py-2">{formatCurrency(avgRate)}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow style={{ backgroundColor: '#A57C00' }} className="font-bold">
                          <TableCell className="text-white py-2">Total</TableCell>
                          <TableCell className="text-white text-center py-2">{formatHours(ledgerTotals.ipHours)}</TableCell>
                          <TableCell className="text-white text-center py-2">{formatHours(ledgerTotals.managerHours)}</TableCell>
                          <TableCell className="text-white text-center py-2">{formatHours(ledgerTotals.adminHours)}</TableCell>
                          <TableCell className="text-white text-center py-2">{formatHours(ledgerGrandTotal.hours)}</TableCell>
                          <TableCell className="text-white text-right py-2">{formatCurrency(ledgerGrandTotal.cost)}</TableCell>
                          <TableCell className="text-white text-right py-2">
                            {formatCurrency(ledgerGrandTotal.hours > 0 ? ledgerGrandTotal.cost / ledgerGrandTotal.hours : 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="h-3 bg-transparent border-none">
                          <TableCell colSpan={7} className="p-0 border-none"></TableCell>
                        </TableRow>
                        <TableRow style={{ backgroundColor: '#A57C00' }} className="font-bold">
                          <TableCell className="text-white py-2">Total (£)</TableCell>
                          <TableCell className="text-white text-center py-2">{formatCurrency(ledgerTotals.ipCost)}</TableCell>
                          <TableCell className="text-white text-center py-2">{formatCurrency(ledgerTotals.managerCost)}</TableCell>
                          <TableCell className="text-white text-center py-2">{formatCurrency(ledgerTotals.adminCost)}</TableCell>
                          <TableCell className="text-white text-center py-2" colSpan="2" style={{textAlign: "right"}}>{formatCurrency(ledgerGrandTotal.cost)}</TableCell>
                          <TableCell className="text-white text-right py-2">{formatCurrency(ledgerGrandTotal.hours > 0 ? ledgerGrandTotal.cost / ledgerGrandTotal.hours : 0)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {Object.values(wipBreakdownData).some(data => data.hours > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-purple-600" />
                    WIP by Role
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(wipBreakdownData).map(([role, data]) => (
                      data.hours > 0 && (
                        <Card key={role} className="bg-slate-50">
                          <CardContent className="p-4">
                            <p className="text-sm font-medium text-slate-600 mb-2">{role}</p>
                            <p className="text-xl font-bold text-blue-600 mb-1">
                              {formatHours(data.hours)} hrs
                            </p>
                            <p className="text-lg font-semibold text-slate-700">
                              {formatCurrency(data.cost)}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {userBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-600" />
                    WIP by Team Member
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Team Member</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold text-right">Hours</TableHead>
                        <TableHead className="font-semibold text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userBreakdown
                        .sort((a, b) => b.cost - a.cost)
                        .map((user, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {formatHours(user.hours)}
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCurrency(user.cost)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}