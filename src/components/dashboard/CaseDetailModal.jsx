import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  X,
  Save,
  Edit,
  Briefcase,
  Building,
  Users,
  Landmark,
  Users2,
  FileText,
  ClipboardList,
  Loader2,
  XCircle,
  Check,
  Shield,
  Search,
  BookText,
  Plus,
  FileDown,
  Lock,
  Unlock,
  Trash2,
  AlertCircle,
  RefreshCw,
  PoundSterling,
  UserPlus,
  Calendar,
  TrendingUp,
  User as UserIcon,
  CheckSquare,
  Clock,
  Download,
  ListChecks,
  Target,
  BookOpen,
  FileSpreadsheet,
  FolderOpen,
  PlusCircle,
  Pencil,
  Calculator
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

import { Creditor } from '@/api/entities';
import { Employee } from '@/api/entities';
import { TimesheetEntry } from '@/api/entities';
import { FeeEstimateTemplate } from "@/api/entities";
import { User } from "@/api/entities";

import CreditorTable from '../creditors/CreditorTable';
import EmployeeTable from '../employees/EmployeeTable';
import { TheJohnsonTab } from '../the_johnson/TheJohnsonTab';
import CaseStrategyForm from '../case_strategy/CaseStrategyForm';
import OneMonthReviewForm from '../case_strategy/OneMonthReviewForm';
import SixMonthReviewForm from '../case_strategy/SixMonthReviewForm';
import StatementOfAffairsManager from '../soa/StatementOfAffairsManager';
import DeclarationOfSolvencyManager from '../soa/DeclarationOfSolvencyManager';
import TaskListWithCVL from '../tasks/TaskListWithCVL';
import TaskListWithMVL from '../tasks/TaskListWithMVL';
import AdministrationTaskList from '../tasks/AdministrationTaskList';
import CompaniesHouseLookup from '../companies_house/CompaniesHouseLookup';
import { Templates } from '@/api/entities';
import CaseDetailedCashiering from '../cashiering/CaseDetailedCashiering';
import DeficiencyAccount from '../investigations/DeficiencyAccount';
import BankStatementAnalysis from '../investigations/BankStatementAnalysis';
import SIP2FileNote from '../investigations/SIP2FileNote';
import CaseDiaryManager from '../case_diary/CaseDiaryManager';
import FileNotesManager from '../case_notes/FileNotesManager';
import { TaskTemplate } from '@/api/entities';
import VotesTable from './VotesTable';
import CreditorUpload from '../creditors/CreditorUpload';
import EmployeeUpload from '../employees/EmployeeUpload';
import ChecklistsTab from './ChecklistsTab';
import BudgetFeesTab from './BudgetFeesTab';
import DetailsTab from './DetailsTab';
import ActionPointsTab from './ActionPointsTab';
import DocumentsTab from './DocumentsTab';
import ReviewsTab from './ReviewsTab';
import InvestigationsTab from './InvestigationsTab';
import CaseDiaryTab from './CaseDiaryTab';


const DetailItem = ({ label, children, className }) => (
  <div className={`py-2 ${className || ''}`}>
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <div className="text-sm text-slate-900">{children}</div>
  </div>
);

const formatForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return '—';
    }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
      return '—';
  }
};


const formatAddress = (addressObj) => {
    if (!addressObj || typeof addressObj !== 'object') return '—';
    const addressString = [
        addressObj.line1,
        addressObj.line2,
        addressObj.city,
        addressObj.county,
        addressObj.postcode
    ].filter(Boolean).join('\n');
    return addressString || '—';
};



class StatementOfAffairsErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Statement of Affairs Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Statement of Affairs Unavailable</h3>
          <p className="text-slate-600 mb-4">
            The Statement of Affairs module encountered an error and cannot load.
          </p>
          <p className="text-sm text-slate-500 mb-4">
            Error: {this.state.error?.message || 'Unknown error occurred'}
          </p>
          <Button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Define hourly rates matching Settings
const HOURLY_RATES = {
  Partner: 700,
  Manager: 500,
  Executive: 250,
  Secretary: 70
};

// All possible categories for the time ledger and SIP9 reporting
// These are now aligned with the SIP9_CATEGORIES names.
const ALL_CATEGORIES = [
  'STATUTORY AND ADMINISTRATIVE TASKS',
  'REALISATION OF ASSETS',
  'INVESTIGATIONS',
  'CREDITORS',
  'EMPLOYEES',
  'TRADING'
];

// Fee Estimate Categories (now used for display grouping and initial structure)
const FEE_ESTIMATE_CATEGORIES = [
  { id: 'statutory', name: 'STATUTORY AND ADMINISTRATIVE TASKS' },
  { id: 'realisation', name: 'REALISATION OF ASSETS' },
  { id: 'investigations', name: 'INVESTIGATIONS' },
  { id: 'creditors', name: 'CREDITORS' },
  { id: 'employees', name: 'EMPLOYEES' },
];

// SIP9 Categories (similar to Fee Estimate but with a conditional 'Trading' for ADM)
const SIP9_CATEGORIES = [
  { id: 'statutory', name: 'STATUTORY AND ADMINISTRATIVE TASKS' },
  { id: 'realisation', name: 'REALISATION OF ASSETS' },
  { id: 'trading', name: 'TRADING' }, // New category for SIP9, conditional for ADM
  { id: 'investigations', name: 'INVESTIGATIONS' },
  { id: 'creditors', name: 'CREDITORS' },
  { id: 'employees', name: 'EMPLOYEES' },
];


// Fee Estimate Template (this constant is now mostly for reference, actual template comes from DB)
const FEE_ESTIMATE_TEMPLATE_DEFINITIONS = [
  // STATUTORY AND ADMINISTRATIVE TASKS
  { id: 'sat-1', category: 'statutory', activity: 'Appointment notifications' },
  { id: 'sat-2', category: 'statutory', activity: 'Statutory reporting' },
  { id: 'sat-3', category: 'statutory', activity: 'Statutory filing' },
  { id: 'sat-4', category: 'statutory', activity: 'Case Planning and file reviews' },
  { id: 'sat-5', category: 'statutory', activity: 'Meeting with Debtor/directors' },
  { id: 'sat-6', category: 'statutory', activity: 'Correspondence with directors/debtor/bankrupt' },
  { id: 'sat-7', category: 'statutory', activity: 'Collecting Company\'s Accounting Records' },
  { id: 'sat-8', category: 'statutory', activity: 'Meeting with Advisers' },
  { id: 'sat-9', category: 'statutory', activity: 'Review of appointment validity and procedure (ADM only)' },
  { id: 'sat-10', category: 'statutory', activity: 'Case specific cashering' },
  { id: 'sat-11', category: 'statutory', activity: 'Decision Procedures' },
  { id: 'sat-12', category: 'statutory', activity: 'Creditors committee correspondence and reporting' },
  { id: 'sat-13', category: 'statutory', activity: 'Agreement of pre appointment VAT/PAYE/CT returns' },
  { id: 'sat-14', category: 'statutory', activity: 'VAT and CT matters post appointment' },
  { id: 'sat-15', category: 'statutory', activity: 'Final review and drafting closing documents' },
  { id: 'sat-16', category: 'statutory', activity: 'Costs of petition' },
  { id: 'sat-17', category: 'statutory', activity: 'IVA/CVA variation request' },
  { id: 'sat-18', category: 'statutory', activity: 'ADM Extension' },

  // REALISATION OF ASSETS
  { id: 'roa-1', category: 'realisation', activity: 'Insuring and securing assets' },
  { id: 'roa-2', category: 'realisation', activity: 'Instructing and liaising with agents' },
  { id: 'roa-3', category: 'realisation', activity: 'Instructing and liaising with solicitors' },
  { id: 'roa-4', category: 'realisation', activity: 'Negotiating sale/recovery of asset' },
  { id: 'roa-5', category: 'realisation', activity: 'Retention of Title issues' },

  // INVESTIGATIONS
  { id: 'inv-1', category: 'investigations', activity: 'Pension investigations' },
  { id: 'inv-2', category: 'investigations', activity: 'Analysis of financial records' },
  { id: 'inv-3', category: 'investigations', activity: 'SIP 2 work program' },
  { id: 'inv-4', category: 'investigations', activity: 'CDDA Reports' },
  { id: 'inv-5', category: 'investigations', activity: 'Legal Correspondence' },
  { id: 'inv-6', category: 'investigations', activity: 'Asset Tracing' },
  { id: 'inv-7', category: 'investigations', activity: 'HM Land Registry Searches' },
  { id: 'inv-8', category: 'investigations', activity: 'Other investigations (give detail)' },
  { id: 'inv-9', category: 'investigations', activity: 'IVA Equity Calculation' },

  // CREDITORS
  { id: 'cre-1', category: 'creditors', activity: 'Employees including supervision of subcontractors' },
  { id: 'cre-2', category: 'creditors', activity: 'Pensions creditors' },
  { id: 'cre-3', category: 'creditors', activity: 'General Correspondence and telephone calls' },
  { id: 'cre-4', category: 'creditors', activity: 'Review and log claims' },
  { id: 'cre-5', category: 'creditors', activity: 'Adjudication of claims' },
  { id: 'cre-6', category: 'creditors', activity: 'Secured Creditors' },
  { id: 'cre-7', category: 'creditors', activity: 'Dividends' },
  { id: 'cre-8', category: 'creditors', activity: 'Distributions to members' },

  // EMPLOYEES
  { id: 'emp-1', category: 'employees', activity: 'Employee claims review' },
  { id: 'emp-2', category: 'employees', activity: 'Statutory redundancy pay calculation' },
  { id: 'emp-3', category: 'employees', activity: 'Employee correspondence' },
];

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(amount);
};



// Category mapping from task descriptions for Time Ledger and SIP9 reports
// Now aligns with the `name` values from SIP9_CATEGORIES and FEE_ESTIMATE_CATEGORIES
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
    return 'STATUTORY AND ADMINISTRATIVE TASKS'; // Default to a common category
  }
};


export default function CaseDetailModal({ case_, isOpen, onClose, onUpdate, users }) {
  const [caseData, setCaseData] = useState({});
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("companies_house");
  const [activeDetailsSection, setActiveDetailsSection] = useState('case_overview');
  const [activeBudgetSection, setActiveBudgetSection] = useState('case-parameters'); // Default to case-parameters
  const [expandedAddressIndex, setExpandedAddressIndex] = useState(0);
  const [totalTasksInTemplate, setTotalTasksInTemplate] = useState(0);
  const [currentUserForPermissions, setCurrentUserForPermissions] = useState(null);

  // Add local users state as fallback
  const [localUsers, setLocalUsers] = useState([]);
  
  // New states for team assignment modal (renamed to match outline)
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignRole, setAssignRole] = useState('');
  const [assignUser, setAssignUser] = useState(null);
  const [assignInactiveDate, setAssignInactiveDate] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [showDatePrompt, setShowDatePrompt] = useState(false);
  const [datePromptType, setDatePromptType] = useState(''); // 'active' or 'inactive'
  const [tempDate, setTempDate] = useState('');

  // New states for additional staff
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaffMember, setEditingStaffMember] = useState(null);
  // Adjusted newStaffMember state to align with proposed modal structure
  const [newStaffMember, setNewStaffMember] = useState({ role: '', email: '', name: '', assigned_date: '', inactive_date: '' });


  const [votesLocked, setVotesLocked] = useState(false);
  const [isSavingVotes, setIsSavingVotes] = useState(false);

  // State for Work in Progress (WIP)
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [isLoadingWIP, setIsLoadingWIP] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');



  // Fee Estimate Template State
  const [feeEstimateTemplate, setFeeEstimateTemplate] = useState(null);

  // Editable Case Name State
  const [isEditingCaseName, setIsEditingCaseName] = useState(false);
  const [editedCaseName, setEditedCaseName] = useState('');

  // State for detailed fee estimate data (new structure for fee-estimate tab)
  // This state now holds the hours/notes for each activity, keyed by activity.id
  const [caseFeeEstimate, setCaseFeeEstimate] = useState({});
  const [feeEstimateLocked, setFeeEstimateLocked] = useState(false);

  // NEW: SIP9 Fee Table State - Removed sip9Data and sip9Locked as per user request to replace with report
  // const [sip9Data, setSip9Data] = useState({});
  // const [sip9Locked, setSip9Locked] = useState(false);

  // Load users only when modal opens (essential for Details tab)
  useEffect(() => {
    const loadUsers = async () => {
      if (isOpen) {
        try {
          const usersList = await base44.entities.User.list('-created_date', 1000);
          console.log('Loaded users for modal:', usersList?.length || 0);
          console.log('Case Admin users:', usersList?.filter(u => u.grade === 'Case Admin').length || 0);
          setLocalUsers(usersList || []);
        } catch (error) {
          console.error('Error loading users:', error);
        }
      }
    };
    loadUsers();
  }, [isOpen]);

  // Always use locally loaded users to ensure we have all users with grades
  const availableUsers = localUsers;

  // Define user objects from users list
  const assignedUser = useMemo(() => {
    return availableUsers.find(u => u.email === caseData.assigned_user);
  }, [availableUsers, caseData.assigned_user]);

  const managerUser = useMemo(() => {
    return availableUsers.find(u => u.email === caseData.manager_user);
  }, [availableUsers, caseData.manager_user]);

  const cashieringUser = useMemo(() => {
    return availableUsers.find(u => u.email === caseData.cashiering_user);
  }, [availableUsers, caseData.cashiering_user]);

  // Derivations from loaded feeEstimateTemplate
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

  // Calculate totals for a task (item in the FEE_ESTIMATE_TEMPLATE_DEFINITIONS)
  // This now takes an activity object from `allFeeEstimateActivities`
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
  }, [caseFeeEstimate]); // Only depends on caseFeeEstimate for actual hour values

  // Update fee estimate for a task
  const updateTaskFeeEstimate = (taskId, field, value) => {
    setCaseFeeEstimate(prev => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value
      }
    }));
  };

  // Calculate category totals
  // This now iterates over `allFeeEstimateActivities` to find tasks within a category
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

  // Calculate grand totals
  // This now iterates over `FEE_ESTIMATE_CATEGORIES` (our global list of categories for structure)
  const calculateGrandTotals = useCallback(() => {
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    FEE_ESTIMATE_CATEGORIES.forEach(category => {
      const { totalHours, totalCost } = calculateCategoryTotals(category.id);
      grandTotalHours += totalHours;
      grandTotalCost += totalCost;
    });

    return { grandTotalHours, grandTotalCost };
  }, [FEE_ESTIMATE_CATEGORIES, calculateCategoryTotals]);

  // New function to calculate total fee estimate for Decision Procedure tab
  const calculateTotalFeeEstimate = useCallback(() => {
    return calculateGrandTotals().grandTotalCost;
  }, [calculateGrandTotals]);

  // SIP9 Report Data derived from Fee Estimate
  const sip9ReportData = useMemo(() => {
    const report = [];
    let grandTotalHours = 0;
    let grandTotalCost = 0;

    const categoriesToProcess = SIP9_CATEGORIES.filter(cat => {
      // Only include 'Trading' category if case type is Administration
      if (cat.id === 'trading' && caseData.case_type !== 'Administration') {
        return false;
      }
      return true;
    });

    categoriesToProcess.forEach(category => {
      // Reuse existing function to calculate totals for each category from fee estimate data
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


  // Load Fee Estimate Template
  const loadFeeEstimateTemplate = useCallback(async () => {
      try {
          const templates = await FeeEstimateTemplate.list();
          // Prioritize default template, otherwise take the first available
          const defaultTemplate = templates.find(t => t.is_default) || templates[0];
          setFeeEstimateTemplate(defaultTemplate);
      } catch (error) {
          console.error('Error loading fee estimate template:', error);
          setFeeEstimateTemplate(null);
      }
  }, []);


  useEffect(() => {
    if (isOpen && case_?.id && activeTab === 'budget_fees') {
        loadFeeEstimateTemplate(); // Load template only when user navigates to budget_fees tab
    }

    if (case_) {
      let migratedCase = { ...case_ };

      if (Array.isArray(migratedCase.trading_addresses)) {
        migratedCase.trading_addresses = migratedCase.trading_addresses.map(addr => ({
          line1: addr.line1 || '',
          line2: addr.line2 || '',
          city: addr.city || '',
          county: addr.county || '',
          postcode: addr.postcode || '',
        }));
      } else if (migratedCase.trading_address) {
        let addressObj = {
          line1: '',
          line2: '',
          city: '',
          county: '',
          postcode: ''
        };
        if (typeof migratedCase.trading_address === 'string') {
          const addressLines = migratedCase.trading_address.split('\n').filter(line => line.trim());
          addressObj = {
            line1: addressLines[0] || '',
            line2: addressLines[1] || '',
            city: addressLines[2] || '',
            county: addressLines[3] || ''
          };
          if(addressLines.length > 4) {
              addressObj.postcode = addressLines[4] || '';
            }
        } else if (typeof migratedCase.trading_address === 'object') {
          addressObj = { ...migratedCase.trading_address };
        }
        migratedCase.trading_addresses = [addressObj];
        delete migratedCase.trading_address;
      } else {
        migratedCase.trading_addresses = [{
          line1: '',
          line2: '',
          city: '',
          county: '',
          postcode: '',
        }];
      }

      if (!migratedCase.assignment_history) {
        migratedCase.assignment_history = [];
      }

      const getActiveUserEmail = (role) => {
        const activeAssignment = migratedCase.assignment_history.find(
          h => h.role === role && !h.unassigned_date
        );
        return activeAssignment ? activeAssignment.user_email : '';
      };

      if (!migratedCase.assigned_user) {
        migratedCase.assigned_user = getActiveUserEmail('assigned_user');
      }
      if (!migratedCase.manager_user) {
        migratedCase.manager_user = getActiveUserEmail('manager_user');
      }
      if (!migratedCase.cashiering_user) {
        migratedCase.cashiering_user = getActiveUserEmail('cashiering_user');
      }

      // Ensure soa_etr is initialized
      if (typeof migratedCase.soa_etr === 'undefined' || migratedCase.soa_etr === null) {
          migratedCase.soa_etr = 0;
      }

      // Ensure resolutions is initialized
      if (!migratedCase.resolutions) {
        migratedCase.resolutions = [];
      }

      // Ensure additional_reviews is initialized
      if (!migratedCase.additional_reviews) {
        migratedCase.additional_reviews = [];
      }

      // Ensure action_points is initialized
      if (!migratedCase.action_points) {
        migratedCase.action_points = [];
      }

      // Ensure additional_staff is initialized
      if (!migratedCase.additional_staff) {
        migratedCase.additional_staff = [];
      }

      // Ensure meetings_resolutions_na is initialized
      if (typeof migratedCase.meetings_resolutions_na === 'undefined' || migratedCase.meetings_resolutions_na === null) {
          migratedCase.meetings_resolutions_na = false;
      }

      // Ensure fee decision procedure fields are initialized
      migratedCase.fee_decision_procedure_type = migratedCase.fee_decision_procedure_type || '';
      migratedCase.fee_decision_circulated_date = migratedCase.fee_decision_circulated_date || '';
      migratedCase.fee_decision_procedure_date = migratedCase.fee_decision_procedure_date || '';
      migratedCase.fee_decision_procedure_time = migratedCase.fee_decision_procedure_time || '';
      migratedCase.fee_resolution_fixed = !!migratedCase.fee_resolution_fixed;
      migratedCase.fee_resolution_time_costs = !!migratedCase.fee_resolution_time_costs;
      migratedCase.fee_resolution_percentage = !!migratedCase.fee_resolution_percentage;

      // Ensure CWU specific fields are initialized
      migratedCase.date_petition_filed = migratedCase.date_petition_filed || '';
      migratedCase.date_winding_up_order = migratedCase.date_winding_up_order || '';
      migratedCase.court_reference_number = migratedCase.court_reference_number || '';

      // Initialize new fields for "Trading Information"
      migratedCase.trading_name = migratedCase.trading_name ?? '';
      // principal_activity is now moved to case_overview
      // migratedCase.principal_activity = migratedCase.principal_activity ?? '';
      migratedCase.date_ceasing_trade = migratedCase.date_ceasing_trade ?? '';

      // Initialize new fields for "Meetings & Resolutions"
      migratedCase.board_meeting_date = migratedCase.board_meeting_date ?? '';
      migratedCase.board_meeting_location = migratedCase.board_meeting_location ?? '';
      migratedCase.board_resolution_passed_date = migratedCase.board_resolution_passed_date ?? '';
      migratedCase.members_meeting_type = migratedCase.members_meeting_type ?? '';
      migratedCase.members_meeting_date = migratedCase.members_meeting_date ?? '';
      migratedCase.members_meeting_location = migratedCase.members_meeting_location ?? '';
      migratedCase.members_resolution_date = migratedCase.members_resolution_date ?? '';
      migratedCase.creditors_decisions_procedure_type = migratedCase.creditors_decisions_procedure_type ?? '';
      migratedCase.creditors_decisions_convened_by = migratedCase.creditors_decisions_convened_by ?? '';
      migratedCase.creditors_decision_passed_date = migratedCase.creditors_decision_passed_date ?? '';


      // Initialize fee estimate parameters
      const feeEstimate = migratedCase.fee_estimate || {};
      migratedCase.fee_estimate = {
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
      };

      // Initialize detailed fee activities for 'fee-estimate' tab using new structure
      // Parse case_.fee_estimate_data if available, otherwise default to empty object
      let parsedFeeEstimateData = {};
      if (migratedCase.fee_estimate_data) {
        let rawFeeEstimateData = migratedCase.fee_estimate_data;
        if (typeof rawFeeEstimateData === 'string') {
          try {
            rawFeeEstimateData = JSON.parse(rawFeeEstimateData);
          } catch (e) {
            console.error('Error parsing fee estimate data (string):', e);
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

      // Removed SIP9 data initialization as SIP9 table is now a report.
      // let parsedSip9Data = {};
      // if (migratedCase.sip9_data) { /* ... */ }
      // setSip9Data(parsedSip9Data);

      // Initialize new AML & Ethics fields
      migratedCase.aml_psc_discrepancy_noted = migratedCase.aml_psc_discrepancy_noted ?? false;
      migratedCase.aml_psc_discrepancy_details = migratedCase.aml_psc_discrepancy_details ?? '';
      migratedCase.aml_directors_data = migratedCase.aml_directors_data ?? '';
      migratedCase.aml_shareholders_data = migratedCase.aml_shareholders_data ?? '';
      migratedCase.aml_additional_notes = migratedCase.aml_additional_notes ?? '';

      migratedCase.aml_risk_cash_business = migratedCase.aml_risk_cash_business ?? 'no';
      migratedCase.aml_risk_cash_business_narrative = migratedCase.aml_risk_cash_business_narrative ?? '';
      migratedCase.aml_risk_criminal_investigation = migratedCase.aml_risk_criminal_investigation ?? 'no';
      migratedCase.aml_risk_criminal_investigation_narrative = migratedCase.aml_risk_criminal_investigation_narrative ?? '';
      migratedCase.aml_risk_relevant_person = migratedCase.aml_risk_relevant_person ?? 'no';
      migratedCase.aml_risk_relevant_person_narrative = migratedCase.aml_risk_relevant_person_narrative ?? '';
      migratedCase.aml_risk_pep = migratedCase.aml_risk_pep ?? 'no';
      migratedCase.aml_risk_pep_narrative = migratedCase.aml_risk_pep_narrative ?? '';
      migratedCase.aml_risk_accounts_match = migratedCase.aml_risk_accounts_match ?? 'yes'; // Default to yes, as 'no' implies issues
      migratedCase.aml_risk_accounts_match_narrative = migratedCase.aml_risk_accounts_match_narrative ?? '';
      migratedCase.aml_risk_complex_ownership = migratedCase.aml_risk_complex_ownership ?? 'no';
      migratedCase.aml_risk_complex_ownership_narrative = migratedCase.aml_risk_complex_ownership_narrative ?? '';
      migratedCase.aml_risk_known_introduction = migratedCase.aml_risk_known_introduction ?? 'yes'; // Default to yes
      migratedCase.aml_risk_known_introduction_narrative = migratedCase.aml_risk_known_introduction_narrative ?? '';
      migratedCase.aml_risk_no_asset_company = migratedCase.aml_risk_no_asset_company ?? 'no';
      migratedCase.aml_risk_no_asset_company_narrative = migratedCase.aml_risk_no_asset_company_narrative ?? '';
      migratedCase.aml_risk_regulated_sector = migratedCase.aml_risk_regulated_sector ?? 'no';
      migratedCase.aml_risk_regulated_sector_narrative = migratedCase.aml_risk_regulated_sector_narrative ?? '';
      migratedCase.aml_risk_distribution_anticipated = migratedCase.aml_risk_distribution_anticipated ?? 'no';
      migratedCase.aml_risk_distribution_narrative = migratedCase.aml_risk_distribution_narrative ?? '';
      migratedCase.aml_risk_significant_fees = migratedCase.aml_risk_significant_fees ?? 'no';
      migratedCase.aml_risk_significant_fees_narrative = migratedCase.aml_risk_significant_fees_narrative ?? '';
      migratedCase.aml_risk_high_value_assets = migratedCase.aml_risk_high_value_assets ?? 'no';
      migratedCase.aml_risk_high_value_assets_narrative = migratedCase.aml_risk_high_value_assets_narrative ?? '';
      migratedCase.aml_risk_high_risk_country = migratedCase.aml_risk_high_risk_country ?? 'no';
      migratedCase.aml_risk_high_risk_country_narrative = migratedCase.aml_risk_high_risk_country_narrative ?? '';
      migratedCase.aml_risk_de_jure_director = migratedCase.aml_risk_de_jure_director ?? 'yes'; // Default to yes
      migratedCase.aml_risk_de_jure_director_narrative = migratedCase.aml_risk_de_jure_director_narrative ?? '';
      migratedCase.aml_risk_non_face_to_face = migratedCase.aml_risk_non_face_to_face ?? 'no';
      migratedCase.aml_risk_non_face_to_face_narrative = migratedCase.aml_risk_non_face_to_face_narrative ?? '';
      migratedCase.aml_risk_identity_verification = migratedCase.aml_risk_identity_verification ?? 'yes'; // Default to yes
      migratedCase.aml_risk_identity_verification_narrative = migratedCase.aml_risk_identity_verification_narrative ?? '';
      migratedCase.aml_risk_ofsi_check_completed = migratedCase.aml_risk_ofsi_check_completed ?? 'no';
      migratedCase.aml_risk_ofsi_check_narrative = migratedCase.aml_risk_ofsi_check_narrative ?? '';
      migratedCase.aml_risk_ofsi_concerns = migratedCase.aml_risk_ofsi_concerns ?? 'no';
      migratedCase.aml_risk_ofsi_concerns_narrative = migratedCase.aml_risk_ofsi_concerns_narrative ?? '';
      migratedCase.aml_risk_assessment_level = migratedCase.aml_risk_assessment_level ?? 'normal'; // sensible default

      setCaseData(migratedCase);
    } else {
      setCaseData({});
      // Reset all fee estimate related states when case_ is null
      setCaseFeeEstimate({}); // Reset new detailed fee estimate state
      // Removed SIP9 data reset
      // setSip9Data({});
    }
  }, [case_, isOpen, activeTab, loadFeeEstimateTemplate]);


  useEffect(() => {
    // Only load WIP data when user navigates to budget_fees tab
    const loadWithDelay = async () => {
      if (isOpen && case_?.id && activeTab === 'budget_fees') {
        loadTimesheetData();
        // Set default dates for WIP section
        if (case_.appointment_date) {
          setDateFrom(formatForInput(case_.appointment_date));
        } else {
          setDateFrom('');
        }
        setDateTo(new Date().toISOString().split('T')[0]); // Default to today
      }
    };
    loadWithDelay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, case_?.id]);

  // Load current user only when action_points tab is active
  useEffect(() => {
    const loadUser = async () => {
      if (activeTab === 'action_points') {
        try {
          const user = await base44.auth.me();
          setCurrentUserForPermissions(user);
        } catch (error) {
          console.error('Error loading user:', error);
        }
      }
    };
    loadUser();
  }, [activeTab]);

  useEffect(() => {
    if (case_?.id) {
      setActiveDetailsSection('case_overview');
      setExpandedAddressIndex(0);
      setActiveBudgetSection('case-parameters'); // Default to case-parameters
      setFeeEstimateLocked(false);
      setVotesLocked(false);
      setIsEditingCaseName(false);
      setEditedCaseName('');
      setShowAddStaffModal(false);
      setNewStaffMember({ role: '', email: '', name: '', assigned_date: '', inactive_date: '' });
      setAssignInactiveDate('');
    }
  }, [case_?.id]);

  // Reset form when Add Staff Modal opens
  useEffect(() => {
    if (showAddStaffModal && !editingStaffMember) {
      setNewStaffMember({ 
        role: '', 
        email: '', 
        name: '', 
        assigned_date: '', 
        inactive_date: '' 
      });
    } else if (showAddStaffModal && editingStaffMember) {
      setNewStaffMember({
        role: editingStaffMember.role || '',
        email: editingStaffMember.email || '',
        name: editingStaffMember.name || '',
        assigned_date: editingStaffMember.added_date || '',
        inactive_date: editingStaffMember.inactive_date || ''
      });
    }
  }, [showAddStaffModal, editingStaffMember]);



  // Load Timesheet Data for WIP
  const loadTimesheetData = useCallback(async () => {
    if (!case_?.case_reference) return;

    setIsLoadingWIP(true);
    try {
      // Fetch all timesheet entries for this case
      const allEntries = await TimesheetEntry.list('-created_date', 10000);
      // Filter for this case's entries that are approved only
      const entries = allEntries.filter(entry => 
        entry.case_reference === case_.case_reference && 
        entry.status === 'approved'
      );
      console.log('Loaded approved timesheet entries for WIP:', entries.length, 'entries for case', case_.case_reference);
      setTimesheetEntries(entries || []);
    } catch (error) {
      console.error('Error loading timesheet data:', error);
    } finally {
      setIsLoadingWIP(false);
    }
  }, [case_?.case_reference]);


  const getFilteredEntries = useMemo(() => {
    if (!dateFrom || !dateTo) return timesheetEntries;

    return timesheetEntries.filter(entry => {
      const entryDate = entry.date;
      return entryDate >= dateFrom && entryDate <= dateTo;
    });
  }, [timesheetEntries, dateFrom, dateTo]);

  const timeLedger = useMemo(() => {
    const ledger = {};
    // Initialize ledger with all categories from ALL_CATEGORIES (new names)
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

      // If the category returned by categorizeTask is not in ALL_CATEGORIES,
      // it might indicate an unexpected task description or an unlisted category.
      // We should only add to categories defined in ALL_CATEGORIES.
      if (!ALL_CATEGORIES.includes(category)) {
        console.warn(`Task category "${category}" from description "${entry.task_description}" not found in ALL_CATEGORIES.`);
        return; // Skip this entry
      }

      const user = availableUsers?.find(u => u.email === entry.user_email);
      const userRole = user?.role || 'Executive';

      let roleCategory = 'Administrators';
      if (userRole === 'admin' || userRole === 'partner') {
        roleCategory = 'IP Directors';
      } else if (userRole === 'manager') {
        roleCategory = 'Managers';
      }
      // Note: Secretary role is intentionally excluded from this specific time ledger structure as per new requirements.
      // If a secretary logs time, it will fall under 'Administrators' for the Time Ledger display.

      const hours = entry.duration_seconds / 3600;
      let rateKey = 'Executive';
      if (userRole === 'admin' || userRole === 'partner') rateKey = 'Partner';
      else if (userRole === 'manager') rateKey = 'Manager';
      else if (userRole === 'secretary') rateKey = 'Secretary'; // Include secretary for individual rate lookup

      const cost = hours * (HOURLY_RATES[rateKey] || 0);

      ledger[category][roleCategory].hours += hours;
      ledger[category][roleCategory].cost += cost;
    });

    return ledger;
  }, [getFilteredEntries, availableUsers]);

  const timeLedgerAllCategoriesWithData = useMemo(() => {
    return timeLedger;
  }, [timeLedger]);

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
      const user = availableUsers?.find(u => u.email === entry.user_email);
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
  }, [getFilteredEntries, availableUsers]);

  const { breakdown: wipBreakdownData, userBreakdown } = wipBreakdown;
  const totalWIP = useMemo(() => Object.values(wipBreakdownData).reduce((sum, item) => sum + item.cost, 0), [wipBreakdownData]);

  const formatHours = (hours) => {
    return hours.toFixed(2);
  };

  // Calculate totals for time ledger (Now only includes IP, Manager, Admin)
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

  // Calculate grand total for time ledger (Now only includes IP, Manager, Admin)
  const ledgerGrandTotal = useMemo(() => ({
    hours: ledgerTotals.ipHours + ledgerTotals.managerHours + ledgerTotals.adminHours,
    cost: ledgerTotals.ipCost + ledgerTotals.managerCost + ledgerTotals.adminCost
  }), [ledgerTotals]);

  const exportTimeLedgerAsHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Time Ledger - ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 10px;
      font-size: 11px;
    }
    h1 {
      color: #333;
      font-size: 14px;
      margin-bottom: 5px;
      text-align: center;
    }
    .info {
      color: #666;
      margin-bottom: 10px;
      font-size: 10px;
      text-align: center;
    }
    table {
      width: 50%;
      border-collapse: collapse;
      margin: 10px auto;
      font-size: 11px;
      table-layout: fixed;
    }
    th {
      background-color: #A57C00;
      color: white;
      padding: 4px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #8B6800;
      font-size: 10px;
      height: 30px;
    }
    th:first-child {
      text-align: left;
      width: 25%;
    }
    th:nth-child(2), th:nth-child(3), th:nth-child(4), th:nth-child(5), th:nth-child(6), th:nth-child(7) {
      width: 12.5%;
    }
    td {
      padding: 3px;
      border: 1px solid #ddd;
      text-align: center;
      font-size: 10px;
      height: 20px;
    }
    td:first-child {
      text-align: left;
      font-weight: 500;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .total-row {
      background-color: #A57C00 !important;
      color: white;
      font-weight: bold;
    }
    .total-cost-row {
      background-color: #8B6800 !important;
      color: white;
      font-weight: bold;
    }
    .spacer-row {
      height: 5px;
      background: transparent !important;
      border: none !important;
    }
    .spacer-row td {
      border: none !important;
    }
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

    // Open HTML in a new tab
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
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      font-size: 12px;
    }
    h1 {
      color: #333;
      font-size: 18px;
      margin-bottom: 10px;
      text-align: center;
    }
    .info {
      color: #666;
      margin-bottom: 20px;
      font-size: 11px;
      text-align: center;
    }
    .resolution {
      margin-bottom: 30px;
      border: 1px solid #ddd;
      padding: 15px;
      border-radius: 8px;
    }
    .resolution-name {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 10px;
      color: #333;
    }
    .resolution-text {
      margin-bottom: 15px;
      padding: 10px;
      background: #f9f9f9;
      border-left: 3px solid #8b5cf6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 11px;
    }
    th {
      background-color: #8b5cf6;
      color: white;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      border: 1px solid #7c3aed;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #ddd;
      text-align: left;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .vote-for {
      color: #059669;
      font-weight: bold;
    }
    .vote-against {
      color: #dc2626;
      font-weight: bold;
    }
    .total-row {
      background-color: #e9d5ff !important;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Creditor Votes</h1>
  <div class="info">
    <strong>Case:</strong> ${case_?.company_name || 'N/A'} (${case_?.case_reference || 'N/A'})<br>
    <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}
  </div>

  ${(caseData.resolutions || []).map((resolution, idx) => {
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




  // Load task count only when task_list tab is active
  useEffect(() => {
    const loadTaskCount = async () => {
      if (!caseData.case_type || activeTab !== 'task_list') {
        return;
      }

      try {
        const allTemplates = await TaskTemplate.list();
        const caseTypeTemplates = allTemplates.filter(t => t.case_type === caseData.case_type);

        if (caseTypeTemplates.length === 0) {
          setTotalTasksInTemplate(0);
          return;
        }

        // Prioritize default template, otherwise take the first available
        const defaultTemplate = caseTypeTemplates.find(t => t.is_default) || caseTypeTemplates[0];

        if (defaultTemplate && defaultTemplate.tasks && Array.isArray(defaultTemplate.tasks)) {
          setTotalTasksInTemplate(defaultTemplate.tasks.length);
        } else {
          setTotalTasksInTemplate(0);
        }
      } catch (error) {
        console.error('Failed to load task count:', error);
        setTotalTasksInTemplate(0);
      }
    };

    // Only load if caseData.id is available and user is on task_list tab
    if (caseData.id && activeTab === 'task_list') {
      loadTaskCount();
    }
  }, [caseData.case_type, caseData.id, activeTab]);

  // Restore handlePrint function
  const handlePrint = (reviewKey) => {
    let content = '';
    let title = '';
    let contentElementId = '';

    if (reviewKey === 'caseStrategy') {
      title = 'Case Strategy Note';
      contentElementId = 'case-strategy-content';
    } else if (reviewKey === 'oneMonth') {
      title = '1 Month Review';
      contentElementId = '1-month-review-content';
    } else if (reviewKey === 'sixMonth') {
      title = '6 Month Review';
      contentElementId = '6-month-review-content';
    } else if (reviewKey.startsWith('additional_')) {
      const index = parseInt(reviewKey.split('_')[1], 10);
      const additionalReview = caseData.additional_reviews && caseData.additional_reviews[index];
      title = additionalReview ? additionalReview.review_name : 'Additional Review';
      contentElementId = `additional-review-content-${index}`;
    } else {
        console.warn(`Unknown reviewKey '${reviewKey}' for printing.`);
        return;
    }

    const contentElement = document.getElementById(contentElementId);
    if (contentElement) {
      content = contentElement.innerHTML;
    } else {
      console.warn(`Content element with ID '${contentElementId}' not found for printing.`);
      content = '<p>Content not available for printing or element not found.</p>';
    }

    const printWindow = window.open('', '_blank');

    const styles = [
      '@page { size: A4; margin: 2cm; }',
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; padding: 20px; }',
      'h1, h2, h3, h4 { color: #1e40af; margin-top: 1em; margin-bottom: 0.5em; }',
      'h1 { font-size: 24px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }',
      'h2 { font-size: 20px; }',
      'h3 { font-size: 18px; }',
      'h4 { font-size: 16px; }',
      '.header { border-bottom: 3px solid #3b82f6; margin-bottom: 2em; padding-bottom: 1em; }',
      '.signature-section { margin-top: 3em; padding-top: 1em; border-top: 1px solid #cbd5e1; }',
      '.signature-image { max-width: 200px; margin: 1em 0; }',
      'table { width: 100%; border-collapse: collapse; margin: 1em 0; }',
      'th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }',
      'th { background-color: #f1f5f9; font-weight: 600; }',
      '.field-label { font-weight: 600; color: #475569; margin-bottom: 0.25em; }',
      '.field-value { color: #1e293b; padding: 0.5em; background: #f8fafc; border-radius: 4px; }',
      '@media print { body { padding: 0; } }'
    ].join(' ');

    const companyName = caseData.company_name || 'N/A';
    const caseReference = caseData.case_reference || 'N/A';
    const caseType = caseData.case_type || 'N/A';

    const htmlParts = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<title>' + title + ' - ' + companyName + '</title>',
      '<style>' + styles + '</style>',
      '</head>',
      '<body>',
      '<div class="header">',
      '<h1>' + title + '</h1>',
      '<p><strong>Company:</strong> ' + companyName + '</p>',
      '<p><strong>Case Reference:</strong> ' + caseReference + '</p>',
      '<p><strong>Case Type:</strong> ' + caseType + '</p>',
      '</div>',
      '<div class="content">' + content + '</div>',
      '</body>',
      '</html>'
    ];

    printWindow.document.write(htmlParts.join(''));
    printWindow.document.close();

    setTimeout(function() {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleInputChange = (field, value) => {
    setCaseData(prev => {
      const newData = { ...prev };
      const fields = field.split('.');

      let current = newData;
      for (let i = 0; i < fields.length - 1; i++) {
        const fieldPart = fields[i];
        const arrayMatch = fieldPart.match(/(\w+)\[(\d+)\]/);
        if (arrayMatch) {
          const arrayName = arrayMatch[1];
          const index = parseInt(arrayMatch[2], 10);
          if (!current[arrayName]) {
            current[arrayName] = [];
          }
          if (current[arrayName].length <= index) {
            current[arrayName].length = index + 1;
          }
          if (!current[arrayName][index]) {
            current[arrayName][index] = {};
          }
          current = current[arrayName][index];
        } else {
          if (!current[fieldPart]) {
            current[fieldPart] = {};
          }
          current = current[fieldPart];
        }
      }

      const lastFieldPart = fields[fields.length - 1];
      const lastArrayMatch = lastFieldPart.match(/(\w+)\[(\d+)\]/);
      if (lastArrayMatch) {
        const arrayName = lastArrayMatch[1];
        const index = parseInt(lastArrayMatch[2], 10);
        if (!current[arrayName]) {
          current[arrayName] = [];
        }
        if (current[arrayName].length <= index) {
          current[arrayName].length = index + 1;
        }
        current[arrayName][index] = value;
      } else {
        current[lastFieldPart] = value;
      }
      return newData;
    });
  };

  const handleCancelDetailsEdit = () => {
    setCaseData(case_);
    setIsEditingDetails(false);
  };

  const handleSaveDetails = async () => {
    setIsSaving(true);
    try {
      // Only include fields that should be updated, excluding built-in fields
      const updateData = {
        case_type: caseData.case_type,
        case_reference: caseData.case_reference,
        appointment_date: caseData.appointment_date ? caseData.appointment_date.split('T')[0] : '',
        status: caseData.status,
        company_name: caseData.company_name,
        principal_activity: caseData.principal_activity,
        closure_date: caseData.closure_date ? caseData.closure_date.split('T')[0] : '',
        closure_reason: caseData.closure_reason || '',
        date_registered_office_changed: caseData.date_registered_office_changed ? caseData.date_registered_office_changed.split('T')[0] : '',
        new_registered_office_address: caseData.new_registered_office_address || '',
        trading_name: caseData.trading_name || '',
        trading_addresses: caseData.trading_addresses || [],
        date_ceasing_trade: caseData.date_ceasing_trade ? caseData.date_ceasing_trade.split('T')[0] : '',
        meetings_resolutions_na: caseData.meetings_resolutions_na || false,
        board_meeting_date: caseData.board_meeting_date ? caseData.board_meeting_date.split('T')[0] : '',
        board_meeting_location: caseData.board_meeting_location || '',
        board_resolution_passed_date: caseData.board_resolution_passed_date ? caseData.board_resolution_passed_date.split('T')[0] : '',
        members_meeting_type: caseData.members_meeting_type || '',
        members_meeting_date: caseData.members_meeting_date ? caseData.members_meeting_date.split('T')[0] : '',
        members_meeting_location: caseData.members_meeting_location || '',
        members_resolution_date: caseData.members_resolution_date ? caseData.members_resolution_date.split('T')[0] : '',
        creditors_decisions_procedure_type: caseData.creditors_decisions_procedure_type || '',
        creditors_decisions_convened_by: caseData.creditors_decisions_convened_by || '',
        creditors_decision_passed_date: caseData.creditors_decision_passed_date ? caseData.creditors_decision_passed_date.split('T')[0] : '',
        vat_registered: caseData.vat_registered || false,
        vat_number: caseData.vat_number || '',
        date_of_last_vat_return: caseData.date_of_last_vat_return ? caseData.date_of_last_vat_return.split('T')[0] : '',
        date_of_vat_deregistration: caseData.date_of_vat_deregistration ? caseData.date_of_vat_deregistration.split('T')[0] : '',
        ct_number: caseData.ct_number || '',
        date_of_last_ct_return: caseData.date_of_last_ct_return ? caseData.date_of_last_ct_return.split('T')[0] : '',
        employer_paye_reference: caseData.employer_paye_reference || ''
      };

      // Add CWU-specific fields if case type is CWU
      if (caseData.case_type === 'CWU') {
        updateData.date_petition_filed = caseData.date_petition_filed ? caseData.date_petition_filed.split('T')[0] : '';
        updateData.date_winding_up_order = caseData.date_winding_up_order ? caseData.date_winding_up_order.split('T')[0] : '';
        updateData.court_reference_number = caseData.court_reference_number || '';
      }

      await base44.entities.Case.update(caseData.id, updateData);

      // Wait 2 seconds before refreshing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh from database to ensure all users see the same data
      await handleCaseUpdate();
      
      setIsEditingDetails(false);
    } catch (error) {
      console.error("Failed to save case details:", error);
      alert('Failed to save case details: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCaseNameUpdate = async () => {
    if (!editedCaseName.trim()) {
      alert('Case name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await base44.entities.Case.update(case_.id, {
        company_name: editedCaseName.trim()
      });
      
      // Refresh from database to ensure all users see the same data
      await handleCaseUpdate();
      
      setIsEditingCaseName(false);
    } catch (error) {
      console.error('Error updating case name:', error);
      alert('Failed to update case name: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditingCaseName = () => {
    setEditedCaseName(caseData.company_name || '');
    setIsEditingCaseName(true);
  };



  const handleResetCaseParameters = () => {
    // Revert case parameter states
    const feeEstimate = case_.fee_estimate || {};

    setCaseData(prev => ({
      ...prev,
      soa_etr: case_.soa_etr || 0,
      fee_decision_procedure_type: case_.fee_decision_procedure_type || '',
      fee_decision_circulated_date: case_.fee_decision_circulated_date || '',
      fee_decision_procedure_date: case_.fee_decision_procedure_date || '',
      fee_decision_procedure_time: case_.fee_decision_procedure_time || '',
      fee_resolution_fixed: !!case_.fee_resolution_fixed,
      fee_resolution_time_costs: !!case_.fee_resolution_time_costs,
      fee_resolution_percentage: !!case_.fee_resolution_percentage,
      // New fee_estimate fields:
      fee_estimate: {
          ...feeEstimate, // Retain existing fee_estimate fields
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
        ...(caseData.fee_estimate || {}),
        // New fields to be saved
        number_of_employees: caseData.fee_estimate?.number_of_employees || 0,
        number_of_creditors: caseData.fee_estimate?.number_of_creditors || 0,
        number_of_shareholders: caseData.fee_estimate?.number_of_shareholders || 0,
        liquidation_committee: caseData.fee_estimate?.liquidation_committee || 'no',
        stakeholder_concerns_sip2: caseData.fee_estimate?.stakeholder_concerns_sip2 || 'no',
        investigations_complexity: caseData.fee_estimate?.investigations_complexity || 'standard',
        antecedent_transactions_identified: caseData.fee_estimate?.antecedent_transactions_identified || 'no',
        public_interest: caseData.fee_estimate?.public_interest || 'low',
        assets_realisations_complexity: caseData.fee_estimate?.assets_realisations_complexity || 'simple',
        disputes_with_key_creditors: caseData.fee_estimate?.disputes_with_key_creditors || 'no',
        case_complexity_assessment: caseData.fee_estimate?.case_complexity_assessment || 'simple',
      };

      const updateData = {
        ...caseData,
        fee_estimate: updatedFeeEstimateParameters,
        soa_etr: caseData.soa_etr,
        fee_decision_procedure_type: caseData.fee_decision_procedure_type,
        fee_decision_circulated_date: caseData.fee_decision_circulated_date,
        fee_decision_procedure_date: caseData.fee_decision_procedure_date,
        fee_decision_procedure_time: caseData.fee_decision_procedure_time,
        fee_resolution_fixed: caseData.fee_resolution_fixed,
        fee_resolution_time_costs: caseData.fee_resolution_time_costs,
        fee_resolution_percentage: caseData.fee_resolution_percentage,
      };

      await base44.entities.Case.update(caseData.id, updateData);
      // Fetch the updated case from the server to ensure consistency.
      const updatedCases = await base44.entities.Case.list();
      const refreshedCase = updatedCases.find(c => c.id === caseData.id);
      if (refreshedCase) {
        setCaseData(refreshedCase); // Update local caseData with fresh data
      }
    } catch (error) {
      console.error("Failed to save case parameters:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Save fee estimate to case (for the detailed fee estimate table)
  const handleSaveDetailedFeeEstimate = async () => {
    setIsSaving(true);
    try {
      // Map the caseFeeEstimate (keyed by activity.id) back to an array structure
      const updatedFeeEstimateData = allFeeEstimateActivities.map(activity => ({
        ...activity, // Keep original activity details like category, activity name
        ...caseFeeEstimate[activity.id], // Overlay the hours and notes from local state
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

  // Removed handleSaveSip9 function as SIP9 table is now a report.
  // const handleSaveSip9 = async () => { /* ... */ };

  const handleSaveVotes = async () => {
    setIsSavingVotes(true);
    try {
      await base44.entities.Case.update(caseData.id, { resolutions: caseData.resolutions });
    } catch (error) {
      console.error('Error saving votes:', error);
      alert('Failed to save votes. Please try again.');
    } finally {
      setIsSavingVotes(false);
    }
  };



  const handleChecklistUpdate = async (field, value) => {
    try {
      setIsSaving(true);
      
      // Update the database
      await base44.entities.Case.update(caseData.id, { [field]: value });
      
      // Fetch the fresh data from the database
      const updatedCase = await base44.entities.Case.filter({ id: caseData.id });
      if (updatedCase && updatedCase.length > 0) {
        // Update local state with fresh data
        setCaseData(updatedCase[0]);
      }
      
      setIsSaving(false);
      
    } catch (error) {
      console.error('Error updating checklist:', error);
      alert('Failed to save. Please try again.');
      // Re-fetch case data to revert to server state in case of an error if the local state was updated optimistically
      const refreshedCaseOnError = await base44.entities.Case.filter({ id: caseData.id });
      if (refreshedCaseOnError && refreshedCaseOnError.length > 0) {
        setCaseData(refreshedCaseOnError[0]);
      }
      setIsSaving(false);
    }
  };


  const statusStyles = {
    active: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    on_hold: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  const getCaseAge = (appointmentDateString) => {
    if (!appointmentDateString) return 'N/A';

    const appointmentDate = new Date(appointmentDateString);
    const today = new Date();

    let years = today.getFullYear() - appointmentDate.getFullYear();
    let months = today.getMonth() - appointmentDate.getMonth();

    // Adjust months and years if months is negative
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

  const isSectionComplete = (section) => {
    switch(section) {
      case 'case_overview':
        let baseComplete = !!(caseData.case_type && caseData.case_reference && caseData.appointment_date && caseData.company_name && caseData.status && caseData.principal_activity);
        if (caseData.case_type === 'CWU') {
          return baseComplete && !!(caseData.date_petition_filed && caseData.date_winding_up_order && caseData.court_reference_number);
        }
        return baseComplete;
      case 'staff_assigned':
        return !!(caseData.ip_name && caseData.assigned_user);
      case 'trading_information':
        // Check if trading_name, principal_activity, date_ceasing_trade are filled
        const tradingInfoBase = !!(caseData.trading_name && caseData.date_ceasing_trade); // Removed principal_activity
        // Check if there's at least one trading address and if its line1 and postcode are filled
        const tradingAddressesComplete = Array.isArray(caseData.trading_addresses) &&
            caseData.trading_addresses.length > 0 &&
            caseData.trading_addresses.every(addr => addr.line1 && addr.postcode);
        return tradingInfoBase && tradingAddressesComplete;
      case 'meetings_resolutions':
        if (caseData.meetings_resolutions_na) {
          return true;
        }
        const boardMeetingsComplete = !!(
            caseData.board_meeting_date &&
            caseData.board_meeting_location &&
            caseData.board_resolution_passed_date
        );
        const membersMeetingsComplete = !!(
            caseData.members_meeting_type &&
            caseData.members_meeting_date &&
            caseData.members_meeting_location &&
            caseData.members_resolution_date
        );
        let creditorsDecisionsComplete = true; // Assume true if MVL, or if not MVL and data is present
        if (caseData.case_type !== 'MVL') {
            creditorsDecisionsComplete = !!(
                caseData.creditors_decisions_procedure_type &&
                caseData.creditors_decisions_convened_by &&
                caseData.creditors_decision_passed_date
            );
        }
        return boardMeetingsComplete && membersMeetingsComplete && creditorsDecisionsComplete;
      case 'tax_details':
        return !!(caseData.ct_number);
      default:
        return false;
    }
  };

  // Function to refresh case data (used by FileNotesManager and CompaniesHouseLookup)
  const handleCaseUpdate = async () => {
    if (caseData.id) {
      try {
        console.log('=== REFRESHING CASE DATA FROM DATABASE ===');
        console.log('Case ID:', caseData.id);

        // Add a delay to ensure database has been updated and prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Fetch fresh data directly from database
        const refreshedCaseArray = await base44.entities.Case.filter({ id: caseData.id });
        if (refreshedCaseArray && refreshedCaseArray.length > 0) {
          let refreshedCase = refreshedCaseArray[0];

          // Ensure additional_staff is initialized and parsed if needed
          if (!refreshedCase.additional_staff) {
            refreshedCase.additional_staff = [];
          } else if (typeof refreshedCase.additional_staff === 'string') {
            try {
              refreshedCase.additional_staff = JSON.parse(refreshedCase.additional_staff);
              console.log('Parsed additional_staff from string to array');
            } catch (e) {
              console.error('Failed to parse additional_staff:', e);
              refreshedCase.additional_staff = [];
            }
          }

          // Ensure assignment_history is initialized
          if (!refreshedCase.assignment_history) {
            refreshedCase.assignment_history = [];
          }

          console.log('=== CASE DATA REFRESHED ===');
          console.log('Additional Staff:', JSON.stringify(refreshedCase.additional_staff, null, 2));
          console.log('Assignment History:', JSON.stringify(refreshedCase.assignment_history, null, 2));
          console.log('========================');

          setCaseData(refreshedCase);
        } else {
          console.warn('No case found after refresh');
        }
      } catch (error) {
        console.error("Failed to refresh case data after update:", error);
      }
    }
  };

  // Define tabs configuration based on the outline and existing functionality
  const tabsConfig = useMemo(() => [
    { id: 'companies_house', label: 'Companies House', icon: Building, conditional: false },
    { id: 'checklists', label: 'Checklists', icon: CheckSquare, conditional: false },
    { id: 'details', label: 'Details', icon: FileText, conditional: false },
    { id: 'task_list', label: 'Task List', icon: ListChecks, conditional: false },
    { id: 'reviews', label: 'Reviews', icon: Calendar, conditional: false },
    { id: 'action_points', label: 'Action Points', icon: Target, conditional: false },
    { id: 'case_diary', label: 'Case Diary', icon: BookOpen, conditional: true, condition: (caseData.case_type !== 'Advisory') },
    { id: 'file_notes', label: 'File Notes', icon: FileText, conditional: false }, // New tab
    { id: 'creditors', label: 'Creditors', icon: Users, conditional: true, condition: (caseData.case_type !== 'Advisory') },
    { id: 'employees', label: 'Employees', icon: Briefcase, conditional: true, condition: (caseData.case_type !== 'Receiverships' && caseData.case_type !== 'Advisory') },
    // Consolidated Statement of Affairs / Declaration of Solvency handling
    {
      id: 'statement_of_affairs',
      label: caseData.case_type === 'MVL' ? 'Declaration of Solvency' : 'Statement of Affairs',
      icon: FileSpreadsheet,
      conditional: true,
      condition: (caseData.case_type !== 'Receiverships' && caseData.case_type !== 'Advisory')
    },
    { id: 'investigations', label: 'Investigations', icon: Search, conditional: true, condition: (caseData.case_type !== 'MVL' && caseData.case_type !== 'Receiverships' && caseData.case_type !== 'Advisory' && caseData.case_type !== 'CVA' && caseData.case_type !== 'Moratoriums') },
    { id: 'documents', label: 'Docs', icon: FolderOpen, conditional: false },
    { id: 'budget_fees', label: 'Budget Fee', icon: PoundSterling, conditional: false },
    // Preserving existing tabs not in the outline
    { id: 'cashiering', label: 'Cashiering', icon: Landmark, conditional: false },
    { id: 'the_johnson', label: 'The Johnson', icon: null, customIcon: true, conditional: false },
  ], [caseData.case_type, caseData.additional_reviews]);


  if (!case_ || !caseData || !caseData.id) return null;

  const completedOrN_A_Tasks = caseData.tasks_progress && Array.isArray(caseData.tasks_progress)
    ? caseData.tasks_progress.filter(
        t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())
      ).length
    : 0;

  const totalTasksForProgress = totalTasksInTemplate;
  const progressRatio = totalTasksForProgress > 0 ? completedOrN_A_Tasks / totalTasksForProgress : 0;
  const progressPercentage = Math.round(progressRatio * 100);
  const circumference = 2 * Math.PI * 18;
  const dashOffset = circumference * (1 - progressRatio);

  const DetailsSectionMenu = ({ section, label, isActive, onClick }) => {
    const isComplete = isSectionComplete(section);
    let classes = 'w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors border';

    if (isActive) {
      classes += ' bg-blue-100 text-blue-700 border-blue-500';
    } else {
      if (isComplete) {
        classes += ' bg-green-50 text-slate-700 hover:bg-green-100 border-green-400';
      } else {
        classes += ' bg-red-50 text-slate-700 hover:bg-red-100 border-red-400';
      }
    }

    return (
      <button
        onClick={onClick}
        className={classes}
      >
        {label}
      </button>
    );
  };

  const getAssignmentDate = (role) => {
    const assignments = (caseData.assignment_history || [])
      .filter(h => h.role === role)
      .sort((a, b) => new Date(b.assigned_date || 0) - new Date(a.assigned_date || 0));

    const mostRecentAssignment = assignments[0];
    if (!mostRecentAssignment || !mostRecentAssignment.assigned_date) {
      return '—';
    }

    return formatDate(mostRecentAssignment.assigned_date);
  };

  // Renamed from handleOpenAssignModal
  const handleOpenAssignModal = (role) => {
    setAssignRole(role);
    setAssignUser(caseData[role] || null);

    // Find the current active assignment and pre-populate inactive date if it exists
    const currentAssignment = (caseData.assignment_history || []).find(
      h => h.role === role && !h.unassigned_date
    );

    // If there's an assignment with an unassigned_date set, it means it has an inactive date
    if (currentAssignment?.unassigned_date) {
      setAssignInactiveDate(currentAssignment.unassigned_date.split('T')[0]);
    } else {
      setAssignInactiveDate('');
    }

    setShowAssignModal(true);
  };

  // Renamed from handleAssignUser
  const handleAssignTeamMember = async () => {
    if (!assignRole) {
      alert('No role selected for assignment.');
      return;
    }

    setIsAssigning(true);

    const now = new Date().toISOString();

    let updatedHistory = Array.isArray(caseData.assignment_history)
      ? [...caseData.assignment_history]
      : [];

    console.log('=== STARTING TEAM ASSIGNMENT ===');
    console.log('Role:', assignRole);
    console.log('Selected User:', assignUser);
    console.log('Inactive Date:', assignInactiveDate);
    console.log('Current Assignment History:', JSON.stringify(caseData.assignment_history, null, 2));

    // Find the currently active assignment for this role
    const currentAssignment = updatedHistory.find(h => h.role === assignRole && !h.unassigned_date);

    let newAssignmentEmail = assignUser;
    let newAssignmentName = '';

    // Check if we're updating the same user (just adding/changing inactive date)
    if (currentAssignment && assignUser && currentAssignment.user_email === assignUser) {
      // Update the existing assignment's inactive date
      updatedHistory = updatedHistory.map(h => {
        if (h.role === assignRole && !h.unassigned_date && h.user_email === assignUser) {
          console.log('Updating existing assignment with inactive date');
          return {
            ...h,
            unassigned_date: assignInactiveDate ? new Date(assignInactiveDate).toISOString() : null
          };
        }
        return h;
      });
    } else {
      // Different user or unassigning - create new assignment
      // First, unassign the currently assigned user for this role if one exists
      updatedHistory = updatedHistory.map(h => {
        if (h.role === assignRole && !h.unassigned_date) {
          console.log('Unassigning current user:', h.user_email);
          return { ...h, unassigned_date: now };
        }
        return h;
      });

      // If assignUser is not null, it means we are assigning someone
      if (assignUser) {
        const user = availableUsers.find(u => u.email === assignUser);
        newAssignmentName = user?.full_name || assignUser;

        const newAssignment = {
          role: assignRole,
          user_email: assignUser,
          user_name: newAssignmentName,
          assigned_date: now,
          unassigned_date: assignInactiveDate ? new Date(assignInactiveDate).toISOString() : null
        };

        console.log('Creating new assignment:', JSON.stringify(newAssignment, null, 2));
        updatedHistory.push(newAssignment);
      } else {
        // If assignUser is null, it means we are explicitly unassigning (setting the role to '')
        newAssignmentEmail = '';
        console.log('Explicitly unassigning - no new user');
      }
    }

    console.log('Updated Assignment History to save:', JSON.stringify(updatedHistory, null, 2));

    try {
      console.log('=== SAVING TO DATABASE ===');
      console.log('Case ID:', caseData.id);
      console.log('Role field to update:', assignRole);
      console.log('New email value:', newAssignmentEmail);
      console.log('History entries count:', updatedHistory.length);

      await base44.entities.Case.update(caseData.id, {
        [assignRole]: newAssignmentEmail,
        assignment_history: updatedHistory
      });

      console.log('=== SAVE SUCCESSFUL ===');

      // Refresh from database to ensure all users see the same data
      await handleCaseUpdate();

      // Notify parent component to refresh its data
      if (onUpdate) {
        await onUpdate();
      }

      setShowAssignModal(false);
      setAssignRole('');
      setAssignUser(null);
      setAssignInactiveDate('');

    } catch (error) {
      console.error('=== SAVE FAILED ===');
      console.error('Error details:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
      alert(`Failed to update assignment: ${errorMessage}`);
    } finally {
      setIsAssigning(false);
    }
    };

  const handleAddAdditionalStaff = async () => {
    if (!newStaffMember.role) {
      alert('Please select a role.');
      return;
    }
    if (!newStaffMember.email) {
      alert('Please select a user to assign.');
      return;
    }

    setIsSaving(true);
    const staffName = newStaffMember.name || newStaffMember.email;

    console.log('=== ADDING/UPDATING ADDITIONAL STAFF ===');
    console.log('Current Staff Member:', editingStaffMember);
    console.log('New Staff Member Data:', newStaffMember);

    let updatedAdditionalStaff;

    if (editingStaffMember) {
      // Update existing staff member - ensure inactive_date is properly saved
      const inactiveDateValue = newStaffMember.inactive_date ? 
        (typeof newStaffMember.inactive_date === 'string' && newStaffMember.inactive_date.includes('T') ? 
          newStaffMember.inactive_date.split('T')[0] : 
          newStaffMember.inactive_date) : 
        null;

      const updatedStaffData = {
        id: editingStaffMember.id,
        name: staffName,
        email: newStaffMember.email,
        role: newStaffMember.role,
        added_date: newStaffMember.assigned_date || editingStaffMember.added_date,
        inactive_date: inactiveDateValue
      };
      console.log('Updating staff member:', JSON.stringify(updatedStaffData, null, 2));

      updatedAdditionalStaff = (caseData.additional_staff || []).map(staff => 
        staff.id === editingStaffMember.id ? updatedStaffData : staff
      );
    } else {
      // Add new staff member
      const inactiveDateValue = newStaffMember.inactive_date ? 
        (typeof newStaffMember.inactive_date === 'string' && newStaffMember.inactive_date.includes('T') ? 
          newStaffMember.inactive_date.split('T')[0] : 
          newStaffMember.inactive_date) : 
        null;

      const newStaff = {
        id: `staff_${Date.now()}`,
        name: staffName,
        email: newStaffMember.email,
        role: newStaffMember.role,
        added_date: newStaffMember.assigned_date || new Date().toISOString().split('T')[0],
        inactive_date: inactiveDateValue
      };
      console.log('Adding new staff member:', JSON.stringify(newStaff, null, 2));
      updatedAdditionalStaff = [...(caseData.additional_staff || []), newStaff];
    }

    console.log('Updated Additional Staff Array:', JSON.stringify(updatedAdditionalStaff, null, 2));

    try {
      await base44.entities.Case.update(caseData.id, { additional_staff: updatedAdditionalStaff });

      // Update local state immediately with the new data
      setCaseData(prev => ({
        ...prev,
        additional_staff: updatedAdditionalStaff
      }));

      // Close modal
      setNewStaffMember({ role: '', email: '', name: '', assigned_date: '', inactive_date: '' });
      setEditingStaffMember(null);
      setShowAddStaffModal(false);
      setShowDatePrompt(false);
      setIsSaving(false);

      // Notify parent to refresh so data persists across navigation
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving staff:', error);
      alert('Failed to save: ' + (error?.message || 'Unknown error'));
      setIsSaving(false);
    }
  };

  const handleEditAdditionalStaff = (staff) => {
    setEditingStaffMember(staff);
    setShowAddStaffModal(true);
  };

  const handleRemoveAdditionalStaff = async (staffId) => {
    if (!confirm('Are you sure you want to remove this additional staff member?')) {
      return;
    }

    setIsSaving(true);
    const updatedAdditionalStaff = (caseData.additional_staff || []).filter(staff => staff.id !== staffId);

    try {
      await base44.entities.Case.update(caseData.id, { additional_staff: updatedAdditionalStaff });

      // Refresh from database to ensure all users see the same data
      await handleCaseUpdate();

      // Notify parent component to refresh its data
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Error removing additional staff:', error);
      alert('Failed to remove additional staff. Please try again.');
    } finally {
      setIsSaving(false);
    }
    };

  const handleExportFeeEstimate = () => {
    if (!allFeeEstimateActivities.length) return;

    const companyName = caseData.company_name || 'N/A';
    const caseReference = caseData.case_reference || 'N/A';

    const exportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fee Estimate - ${companyName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            text-align: center;
            font-size: 24px;
            margin-bottom: 10px;
            color: #1a202c;
        }
        h2 {
            text-align: center;
            font-size: 18px;
            color: #64748b;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        th, td {
            padding: 12px 15px;
            border: 1px solid #e2e8f0;
            font-size: 13px;
        }
        th {
            background-color: #f1f5f9;
            font-weight: 600;
            text-align: left;
            color: #4a5568;
        }
        td {
            color: #2d3748;
        }
        .category-header {
            background-color: #e0e7ff;
            font-weight: 700;
            color: #2b6cb0;
            padding: 10px 15px;
            border-bottom: 2px solid #a7c3ff;
        }
        .total-row {
            font-weight: 700;
            background-color: #f8fafc;
            color: #065f46;
        }
        .grand-total-row {
            font-weight: 800;
            background-color: #d1fae5;
            color: #047857;
            font-size: 14px;
        }
        .text-right {
            text-align: right;
        }
        .text-center {
            text-align: center;
        }
        .notes-column {
            width: 20%;
        }
        .hours-column {
            width: 8%;
        }
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
    const companyName = caseData.company_name || 'N/A';
    const caseReference = caseData.case_reference || 'N/A';
    const { categories, grandTotalHours, grandTotalCost } = sip9ReportData;

    const exportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIP9 Time Analysis - ${companyName} (${caseReference})</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 40px;
            line-height: 1.6;
            color: #333;
            font-size: 13px;
        }
        h1 {
            text-align: center;
            font-size: 24px;
            margin-bottom: 10px;
            color: #1a202c;
        }
        h2 {
            text-align: center;
            font-size: 18px;
            color: #64748b;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        th, td {
            padding: 12px 15px;
            border: 1px solid #e2e8f0;
        }
        th {
            background-color: #A57C00;
            color: white;
            font-weight: 600;
            text-align: left;
            font-size: 14px;
        }
        th.text-right {
            text-align: right;
        }
        td {
            color: #2d3748;
        }
        .text-center {
            text-align: center;
        }
        .text-right {
            text-align: right;
        }
        .total-row th {
            background-color: #8B6800;
        }
        .total-row th:first-child {
            text-align: left;
        }
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
              <th className="text-left font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>TOTAL</th>
              <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>${sip9ReportData.grandTotalHours.toFixed(2)}</th>
              <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white', borderRight: '3px solid white' }}>${formatCurrency(sip9ReportData.grandTotalCost)}</th>
              <th className="text-right font-bold" style={{ backgroundColor: '#8B6800', color: 'white' }}>
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

  const IP_DETAILS_MAP = {
    'Duncan': { fullName: 'Duncan Coutts', ipNumber: '31070' },
    'Rupen': { fullName: 'Rupen Patel', ipNumber: '31374' },
    'Nimish': { fullName: 'Nimish Patel', ipNumber: '8679' }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
            <DialogHeader className="p-6 pb-4 border-b border-slate-200">
                <DialogTitle className="relative text-2xl font-bold text-slate-900 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${statusStyles[caseData.status || 'active']}`}></div>
                        {caseData.company_name || 'Unknown Company'}
                    </div>

                    <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
                        <div className="text-sm font-medium text-slate-600">Progress:</div>
                        <div className="flex items-center gap-2">
                            <div className="relative w-12 h-12">
                                <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="rgb(226, 232, 240)"
                                        strokeWidth="4"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="18"
                                        stroke="rgb(59, 130, 246)"
                                        strokeWidth="4"
                                        fill="transparent"
                                        strokeDasharray={`${circumference}`}
                                        strokeDashoffset={`${dashOffset}`}
                                        strokeLinecap="round"
                                        className="transition-all duration-500"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold text-slate-700">
                                        {progressPercentage}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-base font-normal text-slate-600 ml-[-1cm]">
                            {caseData.case_type || 'Unknown Type'} appointed on {formatDate(caseData.appointment_date)}
                        </span>
                    </div>
                </DialogTitle>
            </DialogHeader>

            <div className="flex-1 flex flex-col overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
                    <TabsList className="flex flex-row justify-start items-center bg-white border-b border-slate-200 p-2 gap-1 rounded-none overflow-x-auto">
                        {tabsConfig.map((tab) => {
                            if (tab.conditional && !tab.condition) return null;
                            const Icon = tab.icon;

                            if (tab.customIcon) {
                                // Custom rendering for The Johnson tab
                                return (
                                    <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 data-[state=active]:text-purple-700 data-[state=active]:bg-gradient-to-r from-purple-100 to-blue-100 data-[state=active]:border border-purple-200/80 data-[state=active]:shadow-sm">
                                        <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                            <span className="text-white text-[10px] font-bold">AI</span>
                                        </div>
                                        <span className="font-semibold">{tab.label}</span>
                                    </TabsTrigger>
                                );
                            }

                            return (
                                <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm">
                                    {Icon && <Icon className="w-4 h-4"/>}{tab.label}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>

                    <div className="flex-1 overflow-auto">
                        <TabsContent value="companies_house" className="flex-1 mt-0 h-full">
                           <CompaniesHouseLookup case_={caseData} onUpdate={handleCaseUpdate} />
                        </TabsContent>

                        {/* Checklists Tab Content */}
                        <TabsContent value="checklists" className="flex-1 mt-0 h-full">
                          <div className="p-6">
                            <ChecklistsTab case_={caseData} onChecklistUpdate={handleChecklistUpdate} />
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="details" className="flex-1 mt-0 h-full">
                          <DetailsTab 
                            caseData={caseData}
                            isEditingDetails={isEditingDetails}
                            isSaving={isSaving}
                            availableUsers={availableUsers}
                            activeDetailsSection={activeDetailsSection}
                            setActiveDetailsSection={setActiveDetailsSection}
                            handleInputChange={handleInputChange}
                            handleSaveDetails={handleSaveDetails}
                            handleCancelDetailsEdit={handleCancelDetailsEdit}
                            setIsEditingDetails={setIsEditingDetails}
                            isEditingCaseName={isEditingCaseName}
                            editedCaseName={editedCaseName}
                            setEditedCaseName={setEditedCaseName}
                            startEditingCaseName={startEditingCaseName}
                            handleCaseNameUpdate={handleCaseNameUpdate}
                            setIsEditingCaseName={setIsEditingCaseName}
                            assignedUser={assignedUser}
                            managerUser={managerUser}
                            cashieringUser={cashieringUser}
                            getAssignmentDate={getAssignmentDate}
                            handleOpenAssignModal={handleOpenAssignModal}
                            handleEditAdditionalStaff={handleEditAdditionalStaff}
                            handleRemoveAdditionalStaff={handleRemoveAdditionalStaff}
                            setShowAddStaffModal={setShowAddStaffModal}
                            isSectionComplete={isSectionComplete}
                            onCaseUpdate={handleCaseUpdate}
                          />
                        </TabsContent>

                        <TabsContent value="task_list" className="flex-1 mt-0 h-full p-6">
                            {caseData.case_type === 'MVL' ? (
                                <TaskListWithMVL caseData={caseData} onUpdate={handleCaseUpdate} />
                            ) : caseData.case_type === 'Administration' ? (
                                <AdministrationTaskList caseData={caseData} onUpdate={handleCaseUpdate} />
                            ) : (
                                <TaskListWithCVL caseData={caseData} onUpdate={handleCaseUpdate} />
                            )}
                        </TabsContent>

                        <TabsContent value="reviews" className="flex-1 mt-0 h-full p-0">
                          <ReviewsTab 
                            caseData={caseData}
                            caseId={caseData.id}
                            onCaseUpdate={handleCaseUpdate}
                          />
                        </TabsContent>

                        <TabsContent value="action_points" className="mt-0 h-full">
                          <ActionPointsTab 
                            caseData={caseData}
                            onCaseUpdate={handleCaseUpdate}
                            currentUserForPermissions={currentUserForPermissions}
                          />
                        </TabsContent>

                        <TabsContent value="case_diary" className="mt-0 h-full p-0">
                          <CaseDiaryTab 
                            caseId={caseData.id}
                            caseData={caseData}
                            onCaseUpdate={handleCaseUpdate}
                          />
                        </TabsContent>

                        {/* New File Notes Tab Content */}
                        <TabsContent value="file_notes" className="mt-0 h-full p-6">
                          <FileNotesManager 
                            caseId={caseData.id} 
                            caseData={caseData}
                            onUpdate={handleCaseUpdate}
                          />
                        </TabsContent>

                        <TabsContent value="creditors" className="flex-1 mt-0 h-full p-6">
                            <CreditorTable caseId={caseData.id} onUpdate={handleCaseUpdate} />
                        </TabsContent>

                        <TabsContent value="employees" className="flex-1 mt-0 h-full p-6">
                            <EmployeeTable caseId={caseData.id} onUpdate={handleCaseUpdate} />
                        </TabsContent>

                        <TabsContent value="statement_of_affairs" className="flex-1 mt-0 h-full p-6">
                            {caseData.id ? (
                                caseData.case_type !== 'MVL' ? (
                                    <StatementOfAffairsErrorBoundary>
                                        <React.Suspense
                                            fallback={
                                                <div className="flex items-center justify-center py-12">
                                                    <div className="text-center">
                                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                                                        <p className="text-slate-600">Loading Statement of Affairs...</p>
                                                    </div>
                                                </div>
                                            }
                                        >
                                            <StatementOfAffairsManager caseId={caseData.id} onUpdate={handleCaseUpdate} />
                                        </React.Suspense>
                                    </StatementOfAffairsErrorBoundary>
                                ) : (
                                    <DeclarationOfSolvencyManager caseId={caseData.id} onUpdate={handleCaseUpdate} />
                                )
                            ) : (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center">
                                        <FileSpreadsheet className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500">Loading case data...</p>
                                        <p className="text-xs text-slate-400 mt-2">Case ID: {caseData.id || 'undefined'}</p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {caseData.case_type !== 'MVL' && caseData.case_type !== 'CVA' && caseData.case_type !== 'Moratoriums' && (
                            <TabsContent value="investigations" className="mt-0 h-full p-0">
                              <InvestigationsTab caseId={caseData.id} onCaseUpdate={handleCaseUpdate} />
                            </TabsContent>
                        )}

                        <TabsContent value="documents" className="flex-1 mt-0 h-full p-6">
                            <DocumentsTab caseData={caseData} />
                        </TabsContent>

                        <TabsContent value="budget_fees" className="flex-1 mt-0 h-full">
                          <BudgetFeesTab 
                            caseData={caseData} 
                            case_={case_} 
                            users={availableUsers}
                            onCaseUpdate={handleCaseUpdate}
                          />
                        </TabsContent>

                        <TabsContent value="cashiering" className="flex-1 mt-0 h-full">
                            <div className="p-6">
                                <CaseDetailedCashiering case_={caseData} hideHeader={true} />
                            </div>
                        </TabsContent>

                        <TabsContent value="the_johnson" className="flex-1 mt-0 h-full">
                          <div className="p-6">
                              <TheJohnsonTab caseId={caseData.id} />
                          </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Date Prompt Dialog */}
            <Dialog open={showDatePrompt} onOpenChange={setShowDatePrompt}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {datePromptType === 'active' ? 'Set Active Date' : 'Set Inactive Date'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-input">
                                {datePromptType === 'active' ? 'Active Date' : 'Inactive Date'}
                            </Label>
                            <Input
                                id="date-input"
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDatePrompt(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => {
                            if (showAssignModal) {
                                // For team assignment modal
                                if (datePromptType === 'active') {
                                    setAssignInactiveDate('');
                                } else {
                                    setAssignInactiveDate(tempDate);
                                }
                            } else if (showAddStaffModal) {
                                // For additional staff modal
                                if (datePromptType === 'active') {
                                    setNewStaffMember({ ...newStaffMember, inactive_date: '' });
                                } else {
                                    setNewStaffMember({ ...newStaffMember, inactive_date: tempDate });
                                }
                            }
                            setShowDatePrompt(false);
                        }}>
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Team Member Modal (renamed from Team Assignment Modal) */}
            <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Add Team Member</DialogTitle>
                        <DialogDescription>
                            Select role, user, and optional inactive date for the assignment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="assign-role">
                                Role
                            </Label>
                            <Select
                                value={assignRole}
                                onValueChange={setAssignRole}
                            >
                                <SelectTrigger id="assign-role">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="assigned_user">Case Admin</SelectItem>
                                    <SelectItem value="manager_user">Manager</SelectItem>
                                    <SelectItem value="cashiering_user">Cashier</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="assign-user">
                                User
                            </Label>
                            <Select
                                value={assignUser}
                                onValueChange={setAssignUser}
                            >
                                <SelectTrigger id="assign-user">
                                    <SelectValue placeholder="Select a user" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px] overflow-y-auto">
                                    <SelectItem value={null}>None (Remove Assignment)</SelectItem>
                                    {(() => {
                                      const filtered = availableUsers.filter(user => {
                                        const userGrade = (user.grade || '').trim();
                                        if (assignRole === 'cashiering_user') {
                                          return userGrade === 'Cashier';
                                        } else if (assignRole === 'manager_user') {
                                          return userGrade === 'Manager';
                                        } else if (assignRole === 'assigned_user') {
                                          return userGrade === 'Case Admin';
                                        }
                                        return true;
                                      });
                                      console.log(`Filtered users for ${assignRole}:`, filtered.length, filtered.map(u => u.full_name));
                                      return filtered.map((user) => (
                                        <SelectItem key={user.email} value={user.email}>
                                          {user.full_name}
                                        </SelectItem>
                                      ));
                                    })()}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Assignment Status</Label>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setDatePromptType('active');
                                        setTempDate('');
                                        setShowDatePrompt(true);
                                    }}
                                    className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                                        !assignInactiveDate
                                            ? 'border-green-500 bg-green-50 text-green-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-green-300'
                                    }`}
                                >
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setDatePromptType('inactive');
                                        setTempDate(assignInactiveDate || '');
                                        setShowDatePrompt(true);
                                    }}
                                    className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                                        assignInactiveDate
                                            ? 'border-red-500 bg-red-50 text-red-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-red-300'
                                    }`}
                                >
                                    Inactive
                                </button>
                            </div>
                            {assignInactiveDate && (
                                <div className="text-sm text-slate-600 text-center">
                                    Inactive Date: {assignInactiveDate}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            setShowAssignModal(false);
                            setAssignInactiveDate('');
                        }}>Cancel</Button>
                        <Button onClick={handleAssignTeamMember} disabled={isAssigning}>
                            {isAssigning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Additional Staff Modal */}
            <Dialog open={showAddStaffModal} onOpenChange={(open) => {
              setShowAddStaffModal(open);
              if (!open) {
                setEditingStaffMember(null);
                setShowDatePrompt(false);
              }
            }}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>{editingStaffMember ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
                  <p className="text-sm text-slate-600">Select role, user, and optional inactive date for the assignment.</p>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="staff-role">Role</Label>
                    <Select
                      value={newStaffMember.role}
                      onValueChange={(value) => setNewStaffMember({ ...newStaffMember, role: value })}
                    >
                      <SelectTrigger id="staff-role">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assigned_user">Case Admin</SelectItem>
                        <SelectItem value="manager_user">Manager</SelectItem>
                        <SelectItem value="cashiering_user">Cashier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="staff-user">User</Label>
                    <Select
                      value={newStaffMember.email}
                      onValueChange={(value) => {
                        const selectedUser = availableUsers.find(u => u.email === value);
                        setNewStaffMember({
                          ...newStaffMember,
                          email: value,
                          name: selectedUser?.full_name || ''
                        });
                      }}
                    >
                      <SelectTrigger id="staff-user">
                        <SelectValue placeholder="Select user" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {(() => {
                          const filtered = availableUsers.filter(user => {
                            const userGrade = (user.grade || '').trim();
                            if (newStaffMember.role === 'cashiering_user') {
                              return userGrade === 'Cashier';
                            } else if (newStaffMember.role === 'manager_user') {
                              return userGrade === 'Manager';
                            } else if (newStaffMember.role === 'assigned_user') {
                              return userGrade === 'Case Admin';
                            }
                            return true;
                          });
                          console.log(`Filtered additional staff users for ${newStaffMember.role}:`, filtered.length, filtered.map(u => u.full_name));
                          return filtered.map(user => (
                            <SelectItem key={user.email} value={user.email}>
                              {user.full_name || user.email}
                            </SelectItem>
                          ));
                        })()}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="assigned-date">Assigned Date</Label>
                    <Input
                      id="assigned-date"
                      type="date"
                      {...(newStaffMember.assigned_date ? { value: newStaffMember.assigned_date } : {})}
                      onChange={(e) => setNewStaffMember({ ...newStaffMember, assigned_date: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Assignment Status</Label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setDatePromptType('active');
                                setTempDate('');
                                setShowDatePrompt(true);
                            }}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                                !newStaffMember.inactive_date
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-green-300'
                            }`}
                        >
                            Active
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                setDatePromptType('inactive');
                                setTempDate(newStaffMember.inactive_date ? (typeof newStaffMember.inactive_date === 'string' && newStaffMember.inactive_date.includes('T') ? newStaffMember.inactive_date.split('T')[0] : newStaffMember.inactive_date) : '');
                                setShowDatePrompt(true);
                            }}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 font-medium transition-all ${
                                newStaffMember.inactive_date
                                    ? 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-red-300'
                            }`}
                        >
                            Inactive
                        </button>
                    </div>
                    {newStaffMember.inactive_date && (
                        <div className="text-sm text-slate-600 text-center">
                            Inactive Date: {typeof newStaffMember.inactive_date === 'string' && newStaffMember.inactive_date.includes('T') ? newStaffMember.inactive_date.split('T')[0] : newStaffMember.inactive_date}
                        </div>
                    )}
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowAddStaffModal(false);
                    setEditingStaffMember(null);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddAdditionalStaff} disabled={isSaving || !newStaffMember.role || !newStaffMember.email}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {editingStaffMember ? 'Update' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </DialogContent>
    </Dialog>
  );
}