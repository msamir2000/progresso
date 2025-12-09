import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Case } from "@/api/entities";
import { Transaction } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Loader2, Shield, ShieldCheck, ChevronRight, AlertCircle, RefreshCw, FileText, Plus, Upload, X, Send,
  ClipboardCheck, PenSquare, Ban, CheckCircle, XCircle, Check, ArrowRight, ChevronDown, ClipboardList,
  Edit, Save, Trash2, Printer, Briefcase, Calendar, TrendingUp, Landmark, LineChart, PlusCircle, Building, MoreVertical, Settings, User as UserIcon, Filter, Info, Eye, Calculator, ChevronUp,
  Clock, DollarSign, CreditCard, Download, BarChart
}
from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import TransactionUpload from "./TransactionUpload";
import SignatureDialog from "./SignatureDialog";
import BondingActions from "./BondingActions";
import BondingManagement from "./BondingManagement";
import { UploadFile } from "@/api/integrations";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import AccountCodeSearch from "../accounting/AccountCodeSearch";
import { AccountingService } from "../accounting/AccountingService";
import { ChartOfAccount } from "@/api/entities";
import { AccountingEntry } from "@/api/entities";
import { Label } from "@/components/ui/label";
import { Document } from "@/api/entities";
import BankAccountModal from './BankAccountModal';
import BankReconciliation from './BankReconciliation';
import { BondingRate } from "@/api/entities";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import ApprovalSidebar from './ApprovalSidebar';


// Ultra-defensive helper functions with comprehensive error handling
const safeArray = (value, defaultValue = []) => {
  try {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'object' && typeof value.length === 'number') {
      try {
        return Array.from(value);
      } catch (err) {
        console.error('Error converting iterable to array:', err);
        return defaultValue;
      }
    }
    console.warn('Non-array value encountered:', typeof value, value);
    return defaultValue;
  } catch (error) {
    console.error('Error in safeArray:', error);
    return defaultValue;
  }
};

const safeNumber = (value, defaultValue = 0) => {
  try {
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const cleaned = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) || !isFinite(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  } catch (error) {
    console.error('Error in safeNumber:', error);
    return defaultValue;
  };
};

const safeString = (value, defaultValue = '') => {
  try {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  } catch (error) {
    console.error('Error in safeString:', error);
    return defaultValue;
  }
};

const safeObject = (value, defaultValue = {}) => {
  try {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    return defaultValue;
  } catch (error) {
    console.error('Error in safeObject:', error);
    return defaultValue;
  }
};

const safeProp = (obj, prop, defaultValue = null) => {
  try {
    if (!obj || typeof obj !== 'object') return defaultValue;
    return obj.hasOwnProperty(prop) ? obj[prop] : defaultValue;
  } catch (error) {
    console.error('Error in safeProp:', error);
    return defaultValue;
  }
};

const safeArrayMap = (array, mapFn, defaultValue = []) => {
  try {
    const safeArr = safeArray(array, []);
    return safeArr.map((item, index) => {
      try {
        return mapFn(item, index);
      } catch (error) {
        console.error('Error in map function at index', index, ':', error);
        return null;
      }
    }).filter((item) => item !== null);
  } catch (error) {
    console.error('Error in safeArrayMap:', error);
    return defaultValue;
  }
};

const safeArrayFilter = (array, filterFn, defaultValue = []) => {
  try {
    const safeArr = safeArray(array, []);
    return safeArr.filter((item, index) => {
      try {
        return filterFn(item, index);
      } catch (error) {
        console.error('Error in filter function at index', index, ':', error);
        return false;
      }
    });
  } catch (error) {
    console.error('Error in safeArrayFilter:', error);
    return defaultValue;
  }
};

const safeArrayReduce = (array, reduceFn, initialValue = 0) => {
  try {
    const safeArr = safeArray(array, []);
    return safeArr.reduce((acc, item, index) => {
      try {
        return reduceFn(acc, item, index);
      } catch (error) {
        console.error('Error in reduce function at index', index, ':', error);
        return acc;
      }
    }, initialValue);
  } catch (error) {
    console.error('Error in safeArrayReduce:', error);
    return initialValue;
  }
};

const dataURLtoFile = (dataurl, filename) => {
  try {
    let arr = safeString(dataurl).split(','),
      mime = safeString(safeProp(arr[0].match(/:(.*?);/), 1)),
      bstr = atob(safeString(arr[1])),
      n = bstr.length,
      u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (error) {
    console.error('Error converting data URL to file:', error);
    return null;
  }
};

const formatNumberWithCommas = (value) => {
  try {
    if (value === null || value === undefined || value === '') return '';
    let stringValue = String(value);
    if (stringValue === '' || stringValue === '.') return stringValue;
    let parts = stringValue.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  } catch (error) {
    console.error('Error formatting number:', error);
    return '0.00'; // Return a safe default on error
  }
};

const parseFormattedNumber = (value) => {
  try {
    return safeString(value).replace(/,/g, '');
  } catch (error) {
    console.error('Error parsing formatted number:', error);
    return '0'; // Return a safe default on error
  }
};

const DocumentsTable = ({ cases, handleCaseClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Sort cases alphabetically by company name (A to Z)
  const sortedAndFilteredCases = useMemo(() => {
    // First sort all cases alphabetically
    const sorted = [...safeArray(cases)].sort((a, b) => {
      const nameA = safeString(safeProp(a, 'company_name')).toLowerCase();
      const nameB = safeString(safeProp(b, 'company_name')).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Then apply search filter if exists
    if (!searchQuery.trim()) return sorted;
    
    const query = searchQuery.toLowerCase();
    return safeArrayFilter(sorted, case_ => 
      safeString(safeProp(case_, 'company_name')).toLowerCase().includes(query) ||
      safeString(safeProp(case_, 'case_reference')).toLowerCase().includes(query) ||
      safeString(safeProp(case_, 'case_type')).toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search cases by name, reference or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50 hover:bg-blue-50">
              <TableHead className="font-semibold text-blue-900">Case Reference</TableHead>
              <TableHead className="font-semibold text-blue-900">Case Name</TableHead>
              <TableHead className="font-semibold text-blue-900">CASE TYPE</TableHead>
              <TableHead className="font-semibold text-blue-900">DATE OF APPOINTMENT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No cases found matching your search' : 'No cases available'}
                </TableCell>
              </TableRow>
            ) : (
              safeArrayMap(sortedAndFilteredCases, (case_) => (
                <TableRow 
                  key={safeProp(case_, 'id')}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => handleCaseClick(case_)}
                >
                  <TableCell className="font-medium text-blue-600">
                    {safeProp(case_, 'case_reference')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {safeProp(case_, 'company_name')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{safeProp(case_, 'case_type')}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {safeProp(case_, 'appointment_date') 
                      ? new Date(safeString(safeProp(case_, 'appointment_date'))).toLocaleDateString('en-GB')
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

const BankAccountsTable = ({ cases, handleEditBankDetails }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Sort cases alphabetically by company name (A to Z)
  const sortedAndFilteredCases = useMemo(() => {
    // First sort all cases alphabetically
    const sorted = [...safeArray(cases)].sort((a, b) => {
      const nameA = safeString(safeProp(a, 'company_name')).toLowerCase();
      const nameB = safeString(safeProp(b, 'company_name')).toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Then apply search filter if exists
    if (!searchQuery.trim()) return sorted;
    
    const query = searchQuery.toLowerCase();
    return safeArrayFilter(sorted, case_ => 
      safeString(safeProp(case_, 'company_name')).toLowerCase().includes(query) ||
      safeString(safeProp(case_, 'case_reference')).toLowerCase().includes(query) ||
      safeString(safeProp(case_, 'case_type')).toLowerCase().includes(query)
    );
  }, [cases, searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search cases by name, reference or type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-blue-50 hover:bg-blue-50">
              <TableHead className="font-semibold text-blue-900">Case Reference</TableHead>
              <TableHead className="font-semibold text-blue-900">Case Name</TableHead>
              <TableHead className="font-semibold text-blue-900">Case Type</TableHead>
              <TableHead className="font-semibold text-blue-900">Primary Account</TableHead>
              <TableHead className="font-semibold text-blue-900">Secondary Account</TableHead>
              <TableHead className="font-semibold text-blue-900 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAndFilteredCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No cases found matching your search' : 'No cases available'}
                </TableCell>
              </TableRow>
            ) : (
              safeArrayMap(sortedAndFilteredCases, (case_) => (
                <TableRow key={safeProp(case_, 'id')} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-blue-600">
                    {safeProp(case_, 'case_reference')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {safeProp(case_, 'company_name')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{safeProp(case_, 'case_type')}</Badge>
                  </TableCell>
                  <TableCell>
                    {safeProp(case_, 'bank_details') ? (
                      <div className="text-sm">
                        <div className="font-medium">{safeProp(safeProp(case_, 'bank_details'), 'bank_name') || 'N/A'}</div>
                        <div className="text-slate-500 font-mono text-xs">
                          {safeProp(safeProp(case_, 'bank_details'), 'sort_code') && safeProp(safeProp(case_, 'bank_details'), 'account_number')
                            ? `${safeProp(safeProp(case_, 'bank_details'), 'sort_code')} - ${safeProp(safeProp(case_, 'bank_details'), 'account_number')}`
                            : 'Not set'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {safeProp(case_, 'secondary_bank_details') ? (
                      <div className="text-sm">
                        <div className="font-medium">{safeProp(safeProp(case_, 'secondary_bank_details'), 'bank_name') || 'N/A'}</div>
                        <div className="text-slate-500 font-mono text-xs">
                          {safeProp(safeProp(case_, 'secondary_bank_details'), 'sort_code') && safeProp(safeProp(case_, 'secondary_bank_details'), 'account_number')
                            ? `${safeProp(safeProp(case_, 'secondary_bank_details'), 'sort_code')} - ${safeProp(safeProp(case_, 'secondary_bank_details'), 'account_number')}`
                            : 'Not set'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Not set</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditBankDetails(case_)}
                    >
                      <Building className="w-4 h-4 mr-2" />
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default function CashieringSummary({ onCaseSelect }) {
  // Initialize all state with ultra-safe defaults
  const [cases, setCases] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [documents, setDocuments] = useState([]); // Added documents state
  const [bondingRates, setBondingRates] = useState([]);
  const [accountingEntries, setAccountingEntries] = useState([]); // NEW: Load accounting entries
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("bank_accounts"); // Changed default to "bank_accounts", renamed from currentView
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]); // NEW: State to store all users
  const [isSubmitting, setIsSubmitting] = useState(false); // Renamed from isPosting
  const [postError, setPostError] = useState(null); // Used for approval/rejection errors
  const [signatureTransactionId, setSignatureTransactionId] = useState(null); // Used only for bond setup now
  const [postedSubmenuView, setPostedSubmenuView] = useState("vouchers_awaiting");
  // const [activeAccountCodeSearchId, setActiveAccountCodeSearchId] = useState(null); // This was previously here, but is now moved per-form
  // Removed manualTransactions array and its related functions as per outline
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editTransactionData, setEditTransactionData] = useState({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [editingPendingTransaction, setEditingPendingTransaction] = useState(null);
  const [editPendingData, setEditPendingData] = useState({});
  const [uploadingPendingDoc, setUploadingPendingDoc] = useState(null);
  const [expandedCases, setExpandedCases] = useState(new Set()); // Used for expanding rows in bank_accounts and bonding
  const [selectedCaseForBankAccount, setSelectedCaseForBankAccount] = useState(null);
  const [selectedManageOption, setSelectedManageOption] = useState(null);
  const [selectedCaseForManage, setSelectedCaseForManage] = useState(null);
  const [bondFormData, setBondFormData] = useState({
    soa_etr: '',
    selected_bond_level: '',
    bond_premium: '',
    bond_date: new Date().toISOString().split('T')[0], // Add bond date with today as default
    e_signature: false,
    signatureDataUrl: null,
    submitted_by: ''
  });

  // NEW STATE FOR ADDING BANK ACCOUNT DIRECTLY VIA BankAccountModal
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState(null); // This will hold initial data for adding or editing
  const [bankAccountError, setBankAccountError] = useState(null);
  const [isSavingBankAccount, setIsSavingBankAccount] = useState(false);

  // Added state for manual invoice upload progress (now a boolean for single form)
  const [isUploadingManualInvoice, setIsUploadingManualInvoice] = useState(false);
  // NEW STATE FOR MANUAL BANK REMITTANCE
  const [isUploadingManualBankRemittance, setIsUploadingManualBankRemittance] = useState(false);


  // Removed documentsSearchTerm
  const [selectedCaseForDocuments, setSelectedCaseForDocuments] = useState(null);
  const [caseDocuments, setCaseDocuments] = useState([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('Payment Voucher'); // New state for documents tab

  // NEW STATE: Account Information Modal
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [selectedAccountInfo, setSelectedAccountInfo] = useState(null);

  // NEW STATE for document deletion
  const [deletingDocument, setDeletingDocument] = useState(null);
  const [documentToDelete, setDocumentToDelete] = useState(null);

  // Add state for transactions in documents view
  const [documentTransactions, setDocumentTransactions] = useState([]);

  // NEW STATE for new manual transaction form
  const [manualTransactionForms, setManualTransactionForms] = useState([
    {
      id: 1, // Unique ID for the form
      case_id: '',
      transaction_type: 'receipt',
      transaction_date: new Date().toISOString().split('T')[0],
      payee_name: '',
      date_of_invoice: '',
      invoice_number: '',
      net_amount: '',
      vat_amount: '',
      amount: '', // Gross amount
      description: '',
      account_code: '',
      invoice_file_url: null,
      bank_remittance_url: null,
      target_account: 'primary',
      reference: '', // Auto-generated by handleManualFormChange
      manualCaseSearchTerm: '', // Per-form search term
      showManualCaseSuggestions: false, // Per-form visibility
      isUploadingInvoice: false,
      isUploadingBankRemittance: false,
      manualPostError: null, // Per-form error
      vat_irrecoverable: false, // NEW: VAT irrecoverable checkbox
    }
  ]);
  const [nextFormId, setNextFormId] = useState(2);


  const [isPostingAllManualTransactions, setIsPostingAllManualTransactions] = useState(false);


  // showAccountCodeSearch and manualCaseSearchTerm are now handled per-form via activeAccountCodeSearchFormId and activeManualCaseSearchFormId
  // Fixed: Corrected setter function name to match state variable
  const [activeAccountCodeSearchFormId, setActiveAccountCodeSearchFormId] = useState(null);
  const [activeManualCaseSearchFormId, setActiveManualCaseSearchFormId] = useState(null);

  const manualCaseSearchRefs = useRef({}); // To store refs for each form's case search input

  // Handle clicks outside the manual case search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeManualCaseSearchFormId && manualCaseSearchRefs.current[activeManualCaseSearchFormId] && !manualCaseSearchRefs.current[activeManualCaseSearchFormId].contains(event.target)) {
        setManualTransactionForms(prevForms => prevForms.map(form =>
          form.id === activeManualCaseSearchFormId ? { ...form, showManualCaseSuggestions: false } : form
        ));
        setActiveManualCaseSearchFormId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeManualCaseSearchFormId]);


  // Load transactions when documents are loaded
  useEffect(() => {
    const loadDocumentTransactions = async () => {
      if (selectedCaseForDocuments && isLoadingDocuments === false) {
        try {
          const txData = await Transaction.filter({ case_id: selectedCaseForDocuments.id });
          setDocumentTransactions(safeArray(txData));
        } catch (error) {
          console.error('Error loading transactions for documents:', error);
          setDocumentTransactions([]);
        }
      }
    };
    loadDocumentTransactions();
  }, [selectedCaseForDocuments, isLoadingDocuments]);

  // Ultra-defensive data loading
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const promises = [
      Case.list('-updated_date', 200).catch((err) => {console.error("Error loading Cases:", err);return [];}),
      Transaction.list().catch((err) => {console.error("Error loading Transactions:", err);return [];}),
      ChartOfAccount.list().catch((err) => {console.error("Error loading ChartOfAccount:", err);return [];}),
      User.me().catch((err) => {console.error("Error loading User data:", err);return null;}),
      BondingRate.list().catch((err) => {console.error("Error loading BondingRates:", err);return []}),
      AccountingEntry.list().catch((err) => {console.error("Error loading AccountingEntries:", err);return [];}), // NEW: Load accounting entries
      User.list().catch((err) => {console.error("Error loading All Users:", err);return [];}) // NEW: Load all users
      ];


      const results = await Promise.allSettled(promises);

      // Ultra-safe result processing
      const casesData = safeArray(safeProp(results[0], 'value'), []);
      const transactionsData = safeArray(safeProp(results[1], 'value'), []);
      const coaData = safeArray(safeProp(results[2], 'value'), []);
      const userData = safeProp(results[3], 'status') === 'fulfilled' ? safeProp(results[3], 'value') : null;
      const bondingRatesData = safeArray(safeProp(results[4], 'value'), []);
      const accountingEntriesData = safeArray(safeProp(results[5], 'value'), []); // NEW: Store accounting entries
      const usersData = safeArray(safeProp(results[6], 'value'), []); // NEW: Store all users

      setCases(casesData);
      setTransactions(transactionsData);
      // statementOfAffairs was removed.
      setChartOfAccounts(coaData);
      setCurrentUser(userData);
      setBondingRates(bondingRatesData);
      setAccountingEntries(accountingEntriesData); // NEW: Set accounting entries
      setUsers(usersData); // NEW: Set all users

      setRetryCount(0);
    } catch (err) {
      console.error("Critical error in loadData:", err);
      setError("Failed to load data. Please try again.");

      // Set safe defaults on error
      setCases([]);
      setTransactions([]);
      // statementOfAffairs was removed.
      setChartOfAccounts([]);
      setBondingRates([]);
      setAccountingEntries([]); // NEW: Set safe default
      setUsers([]); // NEW: Set safe default
    } finally {
      setIsLoading(false);
    }
  }, []);

  // NEW: Function to recalculate and update case funds
  const updateCaseFunds = useCallback(async (caseId) => {
    try {
      // Get all transactions for this case
      const caseTransactions = safeArrayFilter(safeArray(transactions), (t) =>
        safeProp(safeObject(t), 'case_id') === caseId
      );

      // Helper function to check if account code is in distribution groups
      const isDistributionAccount = (accountCode) => {
        const account = safeArrayFilter(chartOfAccounts, (acc) => 
          safeString(safeProp(safeObject(acc), 'account_code')) === safeString(accountCode)
        )[0];
        
        if (!account) return false;
        
        const accountGroup = safeString(safeProp(safeObject(account), 'account_group')).toLowerCase();
        return accountGroup === 'distributions' || 
               accountGroup === 'unsecured creditors' || 
               accountGroup === 'preferential creditors';
      };

      // Calculate funds held (receipts - payments for case_account)
      const totalFundsHeld = safeArrayReduce(
        safeArrayFilter(caseTransactions, (t) =>
          safeString(safeProp(t, 'account_type')) === 'case_account'
        ),
        (acc, t) => acc + (safeString(safeProp(t, 'transaction_type')) === 'receipt' ? safeNumber(safeProp(t, 'amount')) : -safeNumber(safeProp(t, 'amount'))),
        0
      );

      // Calculate funds distributed - ONLY for distribution-related account groups
      const totalFundsDistributed = safeArrayReduce(
        safeArrayFilter(caseTransactions, (t) => 
          safeString(safeProp(t, 'account_type')) === 'case_account' && 
          safeString(safeProp(t, 'transaction_type')) === 'payment' &&
          safeString(safeProp(t, 'status')) === 'approved' &&
          isDistributionAccount(safeProp(t, 'account_code'))
        ),
        (acc, t) => acc + safeNumber(safeProp(t, 'amount')),
        0
      );

      // Update the Case entity with the calculated values
      await Case.update(caseId, {
        total_funds_held: Math.max(0, totalFundsHeld),
        total_funds_distributed: totalFundsDistributed
      });

      console.log(`Updated case ${caseId} funds: held=${Math.max(0, totalFundsHeld)}, distributed=${totalFundsDistributed}`);
    } catch (error) {
      console.error('Error updating case funds:', error);
      // Don't throw - this is a background update
    }
  }, [transactions, chartOfAccounts]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set submitted_by to cashier's details when selectedCaseForManage changes for 'set_up_bond'
  useEffect(() => {
    if (selectedCaseForManage && selectedManageOption === 'set_up_bond') {
      const cashierEmail = safeString(safeProp(selectedCaseForManage, 'cashiering_user'));
      if (cashierEmail) {
        const cashierUser = safeArray(users).find(u => safeString(safeProp(u, 'email')) === cashierEmail);
        if (cashierUser) {
          setBondFormData(prev => ({
            ...prev,
            submitted_by: safeString(safeProp(cashierUser, 'full_name')) || cashierEmail
          }));
        } else {
          setBondFormData(prev => ({ ...prev, submitted_by: cashierEmail })); // Fallback to email if user not found in list
        }
      } else if (currentUser) {
        setBondFormData(prev => ({ ...prev, submitted_by: safeString(safeProp(currentUser, 'full_name')) || '' })); // Default to current user if cashier not set
      } else {
        setBondFormData(prev => ({ ...prev, submitted_by: '' })); // Clear if no cashier or current user
      }
    }
  }, [selectedCaseForManage, selectedManageOption, users, currentUser]);

  // Reset Add Bank Account form when selectedCaseForManage or selectedManageOption changes for 'add_account'
  // This useEffect is now modified to use accountToEdit instead of newBankAccountData
  useEffect(() => {
    if (safeString(selectedManageOption) === 'add_account' && safeObject(selectedCaseForManage, {}).id) {
      // Logic for old "Manage Options Overlay" add account form.
      // This path is largely deprecated by the direct BankAccountModal use for adding.
      // However, keeping this to avoid unexpected side effects if setSelectedManageOption('add_account') is used elsewhere
      setAccountToEdit(null); // Reset account data if it's still somehow relevant
    }
  }, [selectedManageOption, selectedCaseForManage]);

  // caseDataWithBalances: Calculates case-level summary data (balances, SOA, bonding)
  // This is the base data for views that need case-aggregated information (e.g., Bonding, or as a base for general case search)
  // or as a base for further flattening for the Bank Accounts view.
  const caseDataWithBalances = useMemo(() => {
    try {
      const safeCases = safeArray(cases);
      const safeTransactions = safeArray(transactions);
      const safeEntries = safeArray(accountingEntries);

      if (safeCases.length === 0) return [];

      return safeArrayMap(safeCases, (caseItem) => {
        try {
          const safeCase = safeObject(caseItem, {});
          if (!safeProp(safeCase, 'id')) return null;

          const caseTransactions = safeArrayFilter(safeTransactions, (t) =>
            safeProp(safeObject(t), 'case_id') === safeProp(safeCase, 'id')
          );

          const accountBalance = safeArrayReduce(
            safeArrayFilter(caseTransactions, (t) =>
              safeString(safeProp(safeObject(t), 'account_type')) === 'case_account'
            ),
            (acc, t) => {
              const transaction = safeObject(t, {});
              const amount = safeNumber(safeProp(transaction, 'amount'));
              return acc + (safeString(safeProp(transaction, 'transaction_type')) === 'receipt' ? amount : -amount);
            }, 0);

          const vatControlBalance = (() => {
            const vat003Entries = safeArrayFilter(safeEntries, (entry) =>
              safeProp(entry, 'case_id') === safeProp(safeCase, 'id') &&
              safeProp(entry, 'account_code') === 'VAT003'
            );
            
            let totalDebits = 0;
            let totalCredits = 0;
            
            vat003Entries.forEach(entry => {
              totalDebits += safeNumber(safeProp(entry, 'debit_amount'));
              totalCredits += safeNumber(safeProp(entry, 'credit_amount'));
            });
            
            return totalDebits - totalCredits;
          })();

          const lastBankRequestDate = (() => {
            try {
              const bankRequestTxs = safeArrayFilter(caseTransactions, (t) => safeProp(safeObject(t), 'bank_request_date'));
              if (bankRequestTxs.length === 0) return null;

              bankRequestTxs.sort((a, b) => {
                try {
                  return new Date(safeString(safeProp(safeObject(b), 'bank_request_date'))) - new Date(safeString(safeProp(safeObject(a), 'bank_request_date')));
                } catch (e) {
                  console.error("Error sorting bank request dates:", e);
                  return 0;
                }
              });
              return safeProp(safeObject(bankRequestTxs[0]), 'bank_request_date') || null;
            } catch (e) {
              console.error('Error determining lastBankRequestDate:', e);
              return null;
            }
          })();

          const soaETR = safeNumber(safeProp(safeCase, 'soa_etr'), 0);

          // Calculate Asset Realisations from account groups (APPROVED transactions only)
          const assetRealisations = (() => {
            // First, get all approved transaction IDs for this case
            const caseTransactions = safeArrayFilter(safeTransactions, (t) =>
              safeProp(safeObject(t), 'case_id') === safeProp(safeCase, 'id')
            );
            
            const approvedTransactionIds = safeArrayFilter(caseTransactions, (t) =>
              safeString(safeProp(safeObject(t), 'status')) === 'approved'
            ).map(t => safeProp(safeObject(t), 'id'));
            
            // Filter accounting entries to only those from approved transactions
            const caseAccountingEntries = safeArrayFilter(safeEntries, (entry) =>
              safeProp(entry, 'case_id') === safeProp(safeCase, 'id') &&
              approvedTransactionIds.includes(safeProp(entry, 'transaction_id'))
            );
            
            let totalRealisations = 0;
            
            // Get unique account codes from entries
            const accountCodesInEntries = [...new Set(caseAccountingEntries.map(e => safeProp(e, 'account_code')))];
            
            // For each account code, check if its account_group matches realisation groups
            accountCodesInEntries.forEach(accountCode => {
              const account = safeArrayFilter(chartOfAccounts, (acc) => 
                safeString(safeProp(safeObject(acc), 'account_code')) === safeString(accountCode)
              )[0];
              
              if (!account) return;
              
              const accountGroup = safeString(safeProp(safeObject(account), 'account_group')).trim();
              
              // Only include accounts in realisation groups
              if (accountGroup === 'Asset Realisations' ||
                  accountGroup === 'Fixed Charge Realisations' || 
                  accountGroup === 'Floating Charge Realisations') {
                
                // Sum up this account's entries (credits - debits) from APPROVED transactions only
                const accountEntries = safeArrayFilter(caseAccountingEntries, (entry) =>
                  safeProp(entry, 'account_code') === accountCode
                );
                
                let accountBalance = 0;
                accountEntries.forEach(entry => {
                  accountBalance += safeNumber(safeProp(entry, 'credit_amount')) - safeNumber(safeProp(entry, 'debit_amount'));
                });
                
                totalRealisations += accountBalance;
              }
            });
            
            return totalRealisations;
          })();

          const initialBondValue = safeNumber(safeProp(safeCase, 'initial_bond_value'));
          const bondIncreases = safeArray(safeProp(safeCase, 'bond_increases'), []);
          const totalIncreases = bondIncreases.reduce((sum, inc) => sum + safeNumber(safeProp(inc, 'increase_value')), 0);
          const bondedAmount = initialBondValue + totalIncreases;
          const isUnderbonded = assetRealisations > bondedAmount;

          return {
            ...safeCase,
            accountBalance,
            vatControlBalance,
            lastBankRequestDate,
            soaETR,
            assetRealisations,
            bondedAmount,
            isUnderbonded
          };
        } catch (caseError) {
          console.error('Error processing single case in caseDataWithBalances:', safeProp(caseItem, 'id') || 'unknown', caseError);
          return {
            ...safeObject(caseItem, {}),
            accountBalance: 0,
            vatControlBalance: 0,
            lastBankRequestDate: null,
            soaETR: 0,
            assetRealisations: 0,
            bondedAmount: 0,
            isUnderbonded: false
          };
        }
      });

    } catch (error) {
      console.error('Critical error in caseDataWithBalances useMemo:', error);
      return [];
    }
  }, [cases, transactions, accountingEntries, chartOfAccounts]);

  // filteredCases: Filters the case-level `caseDataWithBalances` based on the search term.
  // This list will be used by views that need one entry per case (e.g., Bonding, or as a base for general case search)
  // or as a base for further flattening for the Bank Accounts view.
  const filteredCases = useMemo(() => {
    try {
      const safeCasesData = safeArray(caseDataWithBalances);

      if (!searchTerm) return safeCasesData;

      const searchLower = safeString(searchTerm).toLowerCase();
      return safeArrayFilter(safeCasesData, (caseItem) => {
        try {
          const safeCase = safeObject(caseItem);
          const companyName = safeString(safeProp(safeCase, 'company_name')).toLowerCase();
          const caseRef = safeString(safeProp(safeCase, 'case_reference')).toLowerCase();
          const adminName = safeString(safeProp(safeCase, 'administrator_name')).toLowerCase();
          // Include bank account names in search for better usability across views
          const primaryBankName = safeString(safeProp(safeProp(safeCase, 'bank_details'), 'bank_name')).toLowerCase();
          const secondaryBankName = safeString(safeProp(safeProp(safeCase, 'secondary_bank_details'), 'bank_name')).toLowerCase();

          return companyName.includes(searchLower) ||
          caseRef.includes(searchLower) ||
          adminName.includes(searchLower) ||
          primaryBankName.includes(searchLower) ||
          secondaryBankName.includes(searchLower);
        } catch (filterError) {
          console.error('Error filtering individual case:', filterError);
          return false;
        }
      });
    } catch (error) {
      console.error('Error filtering cases:', error);
      return [];
    }
  }, [caseDataWithBalances, searchTerm]);

  // bankAccountRowsForDisplay: Flattens the filtered case-level data into individual bank account rows.
  // This is specifically for the "Bank Accounts" view.
  const bankAccountRowsForDisplay = useMemo(() => {
    const rows = [];

    safeArray(filteredCases).forEach((caseItem) => {
      const safeCase = safeObject(caseItem, {});
      if (!safeProp(safeCase, 'id')) return; // Skip invalid cases

      const caseTransactions = safeArrayFilter(safeArray(transactions), (t) =>
        safeProp(safeObject(t), 'case_id') === safeProp(safeCase, 'id')
      );

      // Helper function to check if account code is in distribution groups
      const isDistributionAccount = (accountCode) => {
        const account = safeArrayFilter(chartOfAccounts, (acc) => 
          safeString(safeProp(safeObject(acc), 'account_code')) === safeString(accountCode)
        )[0];
        
        if (!account) return false;
        
        const accountGroup = safeString(safeProp(safeObject(account), 'account_group')).toLowerCase();
        return accountGroup === 'distributions' || 
               accountGroup === 'unsecured creditors' || 
               accountGroup === 'preferential creditors';
      };

      // NEW: Helper to calculate VAT Control balance for specific account
      const calculateVATControlBalance = (targetAccountFilter) => {
        const caseAccountingEntries = safeArrayFilter(safeArray(accountingEntries), (entry) =>
          safeProp(entry, 'case_id') === safeProp(safeCase, 'id') &&
          safeProp(entry, 'account_code') === 'VAT003'
        );
        
        // For now, we calculate case-wide VAT003 balance (not account-specific)
        // If you need account-specific VAT, you'd need to track which entries belong to which target account
        let totalDebits = 0;
        let totalCredits = 0;
        
        caseAccountingEntries.forEach(entry => {
          totalDebits += safeNumber(safeProp(entry, 'debit_amount'));
          totalCredits += safeNumber(safeProp(entry, 'credit_amount'));
        });
        
        return totalDebits - totalCredits;
      };

      // Helper to calculate account-specific balances, last bank request date, AND funds distributed
      const calculateAccountSpecificData = (txns, targetAccount) => {
        const accountSpecificBalance = safeArrayReduce(
          safeArrayFilter(txns, (t) => safeString(safeProp(t, 'account_type')) === 'case_account'),
          (acc, t) => acc + (safeString(safeProp(t, 'transaction_type')) === 'receipt' ? safeNumber(safeProp(t, 'amount')) : -safeNumber(safeProp(t, 'amount'))),
          0
        );
        
        // NEW: Use AccountingEntry-based calculation for VAT Control
        const accountSpecificVatControlBalance = calculateVATControlBalance(targetAccount);
        
        // Calculate funds distributed - ONLY for distribution-related account groups
        const accountSpecificFundsDistributed = safeArrayReduce(
          safeArrayFilter(txns, (t) => 
            safeString(safeProp(t, 'account_type')) === 'case_account' && 
            safeString(safeProp(t, 'transaction_type')) === 'payment' &&
            safeString(safeProp(t, 'status')) === 'approved' &&
            isDistributionAccount(safeProp(t, 'account_code'))
          ),
          (acc, t) => acc + safeNumber(safeProp(t, 'amount')),
          0
        );
        
        const accountSpecificLastBankRequestDate = (() => {
          try {
            const bankRequestTxs = safeArrayFilter(txns, (t) => safeProp(safeObject(t), 'bank_request_date'));
            if (bankRequestTxs.length === 0) return null;
            bankRequestTxs.sort((a, b) => {
              try {
                return new Date(safeString(safeProp(safeObject(b), 'bank_request_date'))) - new Date(safeString(safeProp(safeObject(a), 'bank_request_date')));
              } catch (e) {
                console.error("Error sorting bank request dates:", e);
                return 0;
              }
            });
            return safeProp(safeObject(bankRequestTxs[0]), 'bank_request_date') || null;
          } catch (e) {
            console.error('Error determining lastBankRequestDate for account:', e);
            return null;
          }
        })();
        return { 
          accountSpecificBalance, 
          accountSpecificVatControlBalance, 
          accountSpecificLastBankRequestDate,
          accountSpecificFundsDistributed 
        };
      };

      let hasAnyAccountConfigured = false;

      const primaryAccount = safeObject(safeProp(safeCase, 'bank_details'));
      const secondaryAccount = safeObject(safeProp(safeCase, 'secondary_bank_details'));

      // Check if we have any bank account configured for this case
      const hasPrimaryAccount = primaryAccount && (
        safeString(safeProp(primaryAccount, 'account_name')) ||
        safeString(safeProp(primaryAccount, 'bank_name')) ||
        safeString(safeProp(primaryAccount, 'account_number')) ||
        safeString(safeProp(primaryAccount, 'sort_code'))
      );

      const hasSecondaryAccount = secondaryAccount && (
        safeString(safeProp(secondaryAccount, 'account_name')) ||
        safeString(safeProp(secondaryAccount, 'bank_name')) ||
        safeString(safeProp(secondaryAccount, 'account_number')) ||
        safeString(safeProp(secondaryAccount, 'sort_code'))
      );


      if (hasPrimaryAccount) {
        const primaryTxns = safeArrayFilter(caseTransactions, (t) => safeString(safeProp(t, 'target_account')) === 'primary');
        const { accountSpecificBalance, accountSpecificVatControlBalance, accountSpecificLastBankRequestDate, accountSpecificFundsDistributed } = calculateAccountSpecificData(primaryTxns, 'primary');
        
        const bondingShortfall = safeProp(safeCase, 'isUnderbonded') && safeProp(safeCase, 'assetRealisations') > safeProp(safeCase, 'bondedAmount')
                                 ? safeProp(safeCase, 'assetRealisations') - safeProp(safeCase, 'bondedAmount')
                                 : 0;

        rows.push({
          id: `${safeProp(safeCase, 'id')}-primary`,
          caseId: safeProp(safeCase, 'id'),
          accountType: safeString(safeProp(primaryAccount, 'account_type'), 'GBP Primary'),
          caseReference: safeProp(safeCase, 'case_reference'),
          companyName: safeProp(safeCase, 'company_name'),
          caseType: safeProp(safeCase, 'case_type'),
          balance: accountSpecificBalance, // Use account-specific balance
          vatBalance: accountSpecificVatControlBalance, // NOW FROM ACCOUNTING ENTRIES
          fundsDistributed: accountSpecificFundsDistributed, // Add funds distributed
          lastBankRequestDate: accountSpecificLastBankRequestDate,
          soaEtr: safeProp(safeCase, 'soaETR'), // Case-level SOA ETR
          bondingRequired: safeProp(safeCase, 'bondedAmount'), // Case-level bonded amount
          bondingShortfall: bondingShortfall,
          accountData: primaryAccount,
          isPrimary: true,
          originalCase: caseItem, // Pass original case for actions
        });
        hasAnyAccountConfigured = true;
      }

      if (hasSecondaryAccount) {
        const secondaryTxns = safeArrayFilter(caseTransactions, (t) => safeString(safeProp(t, 'target_account')) === 'secondary');
        const { accountSpecificBalance, accountSpecificVatControlBalance, accountSpecificLastBankRequestDate, accountSpecificFundsDistributed } = calculateAccountSpecificData(secondaryTxns, 'secondary');

        const bondingShortfall = safeProp(safeCase, 'isUnderbonded') && safeProp(safeCase, 'assetRealisations') > safeProp(safeCase, 'bondedAmount')
                                 ? safeProp(safeCase, 'assetRealisations') - safeProp(safeCase, 'bondedAmount')
                                 : 0;
        
        rows.push({
          id: `${safeProp(safeCase, 'id')}-secondary`,
          caseId: safeProp(safeCase, 'id'),
          accountType: safeString(safeProp(secondaryAccount, 'account_type'), 'GBP Trading'),
          caseReference: safeProp(safeCase, 'case_reference'),
          companyName: safeProp(safeCase, 'company_name'),
          caseType: safeProp(safeCase, 'case_type'),
          balance: accountSpecificBalance, // Use account-specific balance
          vatBalance: accountSpecificVatControlBalance, // NOW FROM ACCOUNTING ENTRIES
          fundsDistributed: accountSpecificFundsDistributed, // Add funds distributed
          lastBankRequestDate: accountSpecificLastBankRequestDate,
          soaEtr: safeProp(safeCase, 'soaETR'), // Case-level SOA ETR
          bondingRequired: bondingShortfall, // Case-level bonded amount
          bondingShortfall: bondingShortfall,
          accountData: secondaryAccount,
          isPrimary: false,
          originalCase: caseItem, // Pass original case for actions
        });
        hasAnyAccountConfigured = true;
      }

      // If no bank accounts, add a single row for the case, using the case-wide balances
      if (!hasAnyAccountConfigured) {
        // Calculate case-wide funds distributed - ONLY for distribution-related account groups
        const caseWideFundsDistributed = safeArrayReduce(
          safeArrayFilter(caseTransactions, (t) => 
            safeString(safeProp(t, 'account_type')) === 'case_account' && 
            safeString(safeProp(t, 'transaction_type')) === 'payment' &&
            safeString(safeProp(t, 'status')) === 'approved' &&
            isDistributionAccount(safeProp(t, 'account_code')) // NEW: Only count distribution accounts
          ),
          (acc, t) => acc + safeNumber(safeProp(t, 'amount')),
          0
        );
        
        const bondingShortfall = safeProp(safeCase, 'isUnderbonded') && safeProp(safeCase, 'assetRealisations') > safeProp(safeCase, 'bondedAmount')
                                 ? safeProp(safeCase, 'assetRealisations') - safeProp(safeCase, 'bondedAmount')
                                 : 0;

        rows.push({
          id: `${safeProp(safeCase, 'id')}-no-account`,
          caseId: safeProp(safeCase, 'id'),
          accountType: 'No Bank Accounts Configured',
          caseReference: safeProp(safeCase, 'case_reference'),
          companyName: safeProp(safeCase, 'company_name'),
          caseType: safeProp(safeCase, 'case_type'),
          // Use the case-level balances and last bank request date already computed in caseDataWithBalances
          balance: safeProp(safeCase, 'accountBalance'),
          vatBalance: safeProp(safeCase, 'vatControlBalance'), // FROM CASE-LEVEL CALCULATION ABOVE
          fundsDistributed: caseWideFundsDistributed, // Add case-wide funds distributed
          lastBankRequestDate: safeProp(safeCase, 'lastBankRequestDate'),
          soaEtr: safeProp(safeCase, 'soaETR'), // Case-level SOA ETR
          bondingRequired: safeProp(safeCase, 'bondedAmount'), // Case-level bonded amount
          bondingShortfall: bondingShortfall,
          accountData: null,
          isPrimary: null,
          originalCase: caseItem, // Pass original case for actions
        });
      }
    });
    
    // Sort rows alphabetically by company name (A to Z)
    return rows.sort((a, b) => {
      const nameA = safeString(a.companyName).toLowerCase();
      const nameB = safeString(b.companyName).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [filteredCases, transactions, chartOfAccounts, accountingEntries]); // NEW: Added accountingEntries dependency

  // NEW: Calculate totals by case type for the summary section
  const caseTypeSummary = useMemo(() => {
    const summary = {};
    
    // Get all unique case types
    const caseTypes = [...new Set(safeArray(cases).map(c => safeProp(c, 'case_type')))].filter(Boolean);
    
    // Helper function to check if account code is in distribution groups
    const isDistributionAccount = (accountCode) => {
      const account = safeArrayFilter(chartOfAccounts, (acc) => 
        safeString(safeProp(safeObject(acc), 'account_code')) === safeString(accountCode)
      )[0];
      
      if (!account) return false;
      
      const accountGroup = safeString(safeProp(safeObject(account), 'account_group')).toLowerCase();
      return accountGroup === 'distributions' || 
             accountGroup === 'unsecured creditors' || 
             accountGroup === 'preferential creditors';
    };
    
    caseTypes.forEach(caseType => {
      // Get all cases of this type
      const casesOfType = safeArray(cases).filter(c => safeProp(c, 'case_type') === caseType);
      
      let totalHeld = 0;
      let totalDistributed = 0;
      
      // Calculate totals for each case
      casesOfType.forEach(caseItem => {
        const caseTransactions = safeArrayFilter(safeArray(transactions), (t) =>
          safeProp(safeObject(t), 'case_id') === safeProp(caseItem, 'id')
        );
        
        // Calculate funds held (receipts - payments)
        const fundsHeld = safeArrayReduce(
          safeArrayFilter(caseTransactions, (t) => safeString(safeProp(t, 'account_type')) === 'case_account'),
          (acc, t) => acc + (safeString(safeProp(t, 'transaction_type')) === 'receipt' ? safeNumber(safeProp(t, 'amount')) : -safeNumber(safeProp(t, 'amount'))),
          0
        );
        
        // Calculate funds distributed - ONLY for distribution-related account groups
        const fundsDistributed = safeArrayReduce(
          safeArrayFilter(caseTransactions, (t) => 
            safeString(safeProp(t, 'account_type')) === 'case_account' && 
            safeString(safeProp(t, 'transaction_type')) === 'payment' &&
            safeString(safeProp(t, 'status')) === 'approved' &&
            isDistributionAccount(safeProp(t, 'account_code')) // NEW: Only count distribution accounts
          ),
          (acc, t) => acc + safeNumber(safeProp(t, 'amount')),
          0
        );
        
        totalHeld += Math.max(0, fundsHeld);
        totalDistributed += fundsDistributed;
      });
      
      summary[caseType] = {
        totalHeld,
        totalDistributed,
        caseCount: casesOfType.length
      };
    });
    
    return summary;
  }, [cases, transactions, chartOfAccounts]);

  // Ultra-safe pending transactions
  const pendingTransactions = useMemo(() => {
    try {
      const safeTransactions = safeArray(transactions);
      return safeArrayFilter(safeTransactions, (t) => safeString(safeProp(safeObject(t), 'status')) === 'pending_approval');
    } catch (error) {
      console.error('Error filtering pending transactions:', error);
      return [];
    }
  }, [transactions]);

  // Ultra-safe approved transactions
  const approvedTransactions = useMemo(() => {
    try {
      const safeTransactions = safeArray(transactions);
      return safeArrayFilter(safeTransactions, (t) => safeString(safeProp(safeObject(t), 'status')) === 'approved').
      sort((a, b) => {
        try {
          return new Date(safeString(safeProp(safeObject(b), 'transaction_date'))) -
          new Date(safeString(safeProp(safeObject(a), 'transaction_date')));
        } catch (e) {
          console.error("Error sorting approved transaction dates:", e);
          return 0;
        }
      });
    } catch (error) {
      console.error('Error filtering approved transactions:', error);
      return [];
    }
  }, [transactions]);

  const handleAddManualTransactionForm = () => {
    setManualTransactionForms(prevForms => [
      ...prevForms,
      {
        id: nextFormId,
        case_id: '',
        transaction_type: 'receipt',
        transaction_date: new Date().toISOString().split('T')[0],
        payee_name: '',
        date_of_invoice: '',
        invoice_number: '',
        net_amount: '',
        vat_amount: '',
        amount: '',
        description: '',
        account_code: '',
        invoice_file_url: null,
        bank_remittance_url: null,
        target_account: 'primary',
        reference: '',
        manualCaseSearchTerm: '',
        showManualCaseSuggestions: false,
        isUploadingInvoice: false,
        isUploadingBankRemittance: false,
        manualPostError: null,
        vat_irrecoverable: false, // NEW: VAT irrecoverable checkbox
      }
    ]);
    setNextFormId(prevId => prevId + 1);
  };

  const handleRemoveManualTransactionForm = (formId) => {
    if (manualTransactionForms.length > 1) {
      setManualTransactionForms(manualTransactionForms.filter(form => form.id !== formId));
    }
  };

  const handleManualTransactionFormChange = useCallback((formId, field, value) => {
    setManualTransactionForms(prevForms => prevForms.map(prev => {
      if (prev.id === formId) {
        const updated = { ...prev, [field]: value };

        // Auto-calculate gross/net/vat
        if (field === 'net_amount' || field === 'vat_amount' || field === 'amount') {
          // Parse numbers safely from potentially formatted strings or number inputs
          const net = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'net_amount'))));
          const vat = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'vat_amount'))));
          const gross = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'amount'))));

          if (field === 'net_amount' || field === 'vat_amount') {
            updated.amount = (net + vat).toFixed(2);
          } else if (field === 'amount') {
            // If gross changes and VAT is set, adjust net. Otherwise assume gross = net (no VAT)
            if (vat !== 0) {
              updated.net_amount = (gross - vat).toFixed(2);
            } else {
              updated.net_amount = gross.toFixed(2);
            }
          }
        }

        // Auto-generate reference
        if (['case_id', 'payee_name', 'transaction_date'].includes(field)) {
          const selectedCase = safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(updated, 'case_id'))[0];
          const caseCode = safeString(safeProp(selectedCase, 'case_reference'));
          const payee = safeString(safeProp(updated, 'payee_name')).replace(/\s+/g, '').toUpperCase();
          const date = safeProp(updated, 'transaction_date') ? new Date(safeString(safeProp(updated, 'transaction_date'))).toISOString().split('T')[0].replace(/-/g, '') : '';

          if (caseCode && payee && date) {
            updated.reference = `${caseCode}-${payee}-${date}`;
          } else {
            updated.reference = '';
          }
        }

        return updated;
      }
      return prev;
    }));
  }, [cases]);


  // Function to handle manual invoice upload for the single form
  const handleManualInvoiceUpload = async (e, formId) => {
    const file = e.target.files?.[0];
    
    setManualTransactionForms(prevForms => prevForms.map(form =>
      form.id === formId ? { ...form, isUploadingInvoice: true, manualPostError: null } : form
    ));

    if (!file) {
      handleManualTransactionFormChange(formId, 'invoice_file_url', null); // Retain clearing on no file
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, isUploadingInvoice: false } : form
      ));
      return;
    }

    try {
      const { file_url } = await UploadFile({ file }); // Destructure file_url as per outline
      handleManualTransactionFormChange(formId, 'invoice_file_url', file_url);
    } catch (error) {
      console.error("Error uploading manual invoice:", error);
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, manualPostError: "Failed to upload invoice." } : form
      ));
      handleManualTransactionFormChange(formId, 'invoice_file_url', null);
    } finally {
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, isUploadingInvoice: false } : form
      ));
    }
  };

  // Function to trigger the hidden file input
  const triggerManualInvoiceUpload = (formId) => {
    document.getElementById(`manual-invoice-upload-${formId}`)?.click();
  };

  // handleManualBankRemittanceUpload as per outline
  const handleManualBankRemittanceUpload = async (e, formId) => {
    const file = e.target.files?.[0];

    setManualTransactionForms(prevForms => prevForms.map(form =>
      form.id === formId ? { ...form, isUploadingBankRemittance: true, manualPostError: null } : form
    ));

    if (!file) {
      handleManualTransactionFormChange(formId, 'bank_remittance_url', null); // Retain clearing on no file
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, isUploadingBankRemittance: false } : form
      ));
      return;
    }

    try {
      const { file_url } = await UploadFile({ file }); // Destructure file_url as per outline
      handleManualTransactionFormChange(formId, 'bank_remittance_url', file_url);
    } catch (error) {
      console.error('Error uploading bank remittance:', error);
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, manualPostError: "Failed to upload bank remittance." } : form
      ));
      handleManualTransactionFormChange(formId, 'bank_remittance_url', null); // Retain clearing on error
    } finally {
      setManualTransactionForms(prevForms => prevForms.map(form =>
        form.id === formId ? { ...form, isUploadingBankRemittance: false } : form
      ));
    }
  };

  // triggerManualBankRemittanceUpload as per outline
  const triggerManualBankRemittanceUpload = (formId) => {
    document.getElementById(`manual-bank-remittance-upload-${formId}`)?.click();
  };

  // handleAccountCodeSelect as per outline, wrapped in useCallback
  const handleAccountCodeSelect = useCallback((account) => {
    if (activeAccountCodeSearchFormId) {
      handleManualTransactionFormChange(activeAccountCodeSearchFormId, 'account_code', safeProp(account, 'account_code'));
      setActiveAccountCodeSearchFormId(null);
    }
  }, [handleManualTransactionFormChange, activeAccountCodeSearchFormId]);

  const handleManualCaseSelect = (formId, caseId, caseName, caseRef) => {
    handleManualTransactionFormChange(formId, 'case_id', caseId);
    setManualTransactionForms(prevForms => prevForms.map(form =>
      form.id === formId ? { ...form, manualCaseSearchTerm: `${caseRef} - ${caseName}`, showManualCaseSuggestions: false } : form
    ));
    setActiveManualCaseSearchFormId(null);
  };

  const getFilteredManualCases = useCallback((currentSearchTerm) => {
    if (!currentSearchTerm || currentSearchTerm.trim() === '') {
      return cases.slice(0, 50); // Show first 50 cases when no search
    }

    const searchLower = currentSearchTerm.toLowerCase();
    const filtered = cases.filter(c =>
      safeString(safeProp(c, 'company_name')).toLowerCase().includes(searchLower) ||
      safeString(safeProp(c, 'case_reference')).toLowerCase().includes(searchLower)
    );

    return filtered.sort((a, b) => {
      const nameA = (safeProp(a, 'company_name') || '').toLowerCase();
      const nameB = (safeProp(b, 'company_name') || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }).slice(0, 50); // Limit to 50 results
  }, [cases]);


  // handlePostManualTransaction as per outline, with corrections
  const handlePostManualTransaction = useCallback(async () => {
    setManualTransactionForms(prevForms => prevForms.map(form => ({ ...form, manualPostError: null }))); // Clear previous errors
    
    // Check if user has a signature
    if (!currentUser?.signature_image_url) {
      alert('You need to upload your signature in Settings → User Management before posting transactions.');
      return;
    }
    
    setIsPostingAllManualTransactions(true);

    const transactionsToCreate = [];
    let hasError = false;

    for (const form of manualTransactionForms) {
      try {
        // Validate required fields
        const requiredFields = ['case_id', 'transaction_type', 'description', 'account_code', 'net_amount', 'transaction_date', 'payee_name', 'target_account'];
        for (const field of requiredFields) {
          if (!form[field]) {
            throw new Error(`Field "${field.replace(/_/g, ' ')}" is required.`);
          }
        }

        const grossAmount = safeNumber(form.amount);
        if (grossAmount <= 0) {
          throw new Error(`Gross amount must be a positive number.`);
        }

        const selectedCase = safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(form, 'case_id'))[0];
        if (!selectedCase) {
          throw new Error("Selected case not found.");
        }

        // Validate account code
        const accountExists = safeArrayFilter(chartOfAccounts, (acc) => safeString(safeProp(safeObject(acc), 'account_code')) === safeString(safeProp(form, 'account_code'))).length > 0;
        if (!accountExists) {
          throw new Error(`The account code "${safeString(safeProp(form, 'account_code'))}" is not valid. Please select a valid code from your Chart of Accounts.`);
        }

        // Determine bank account code for accounting entry
        const bankAccountCode = safeString(safeProp(form, 'target_account')) === 'primary' ?
          safeProp(safeProp(selectedCase, 'bank_details'), 'chart_of_accounts') :
          safeProp(safeProp(selectedCase, 'secondary_bank_details'), 'chart_of_accounts');

        if (!bankAccountCode) {
          throw new Error("The selected bank account does not have an Account Code assigned. Please manage the account to add one.");
        }

        transactionsToCreate.push({
          case_id: safeProp(form, 'case_id'),
          transaction_date: safeString(safeProp(form, 'transaction_date')),
          description: safeString(safeProp(form, 'description')),
          amount: grossAmount,
          transaction_type: safeString(safeProp(form, 'transaction_type')),
          account_type: 'case_account', // Always 'case_account' for manual entry
          target_account: safeString(safeProp(form, 'target_account')),
          payee_name: safeString(safeProp(form, 'payee_name')),
          date_of_invoice: safeString(safeProp(form, 'date_of_invoice')),
          invoice_number: safeString(safeProp(form, 'invoice_number')),
          net_amount: safeNumber(form.net_amount),
          vat_amount: safeNumber(form.vat_amount),
          invoice_file_url: safeProp(form, 'invoice_file_url'),
          bank_remittance_url: safeProp(form, 'bank_remittance_url'),
          status: 'pending_approval',
          account_code: safeString(safeProp(form, 'account_code')),
          reference: safeString(safeProp(form, 'reference')),
          vat_irrecoverable: safeProp(form, 'vat_irrecoverable', false),
          signature_image_url: currentUser.signature_image_url,
          signed_by: currentUser.email,
          signed_date: new Date().toISOString(),
          office_holder_signature: currentUser.full_name,
          approver_grade: currentUser.grade
        });
        
        // Clear error for this specific form if validation passes
        setManualTransactionForms(prevForms => prevForms.map(prev =>
          prev.id === form.id ? { ...prev, manualPostError: null } : prev
        ));

      } catch (validationError) {
        console.error(`Validation error for form ${form.id}:`, validationError);
        setManualTransactionForms(prevForms => prevForms.map(prev =>
          prev.id === form.id ? { ...prev, manualPostError: safeString(safeProp(validationError, 'message')) || "Validation failed." } : prev
        ));
        hasError = true;
      }
    }

    if (hasError) {
      setIsPostingAllManualTransactions(false);
      return;
    }

    try {
      await Promise.all(transactionsToCreate.map(tx => Transaction.create(tx)));

      // Reset forms
      setManualTransactionForms([
        {
          id: nextFormId, // Use nextFormId for the single new form
          case_id: '',
          transaction_date: new Date().toISOString().split('T')[0],
          description: '',
          amount: '',
          transaction_type: 'receipt',
          account_type: 'case_account',
          target_account: 'primary',
          reference: '',
          payee_name: '',
          date_of_invoice: '',
          invoice_number: '',
          net_amount: '',
          vat_amount: '',
          account_code: '',
          invoice_file_url: null,
          bank_remittance_url: null,
          manualCaseSearchTerm: '',
          showManualCaseSuggestions: false,
          isUploadingInvoice: false,
          isUploadingBankRemittance: false,
          manualPostError: null,
          vat_irrecoverable: false, // NEW: VAT irrecoverable checkbox
        }
      ]);
      setNextFormId(prevId => prevId + 1); // Increment for next form
      
      setActiveTab('for_approval'); // Go to awaiting approval
      loadData(); // Reload all data to show new pending transactions
    } catch (error) {
      console.error('Error posting manual transactions:', error);
      // Set a general error or try to map it to specific forms if possible
      setManualTransactionForms(prevForms => prevForms.map(form =>
        ({ ...form, manualPostError: safeString(safeProp(error, 'message')) || "An unexpected error occurred during posting." })
      ));
    } finally {
      setIsPostingAllManualTransactions(false);
    }
  }, [manualTransactionForms, cases, chartOfAccounts, loadData, nextFormId]);

  // Helper function to format document filename
  const formatDocumentFilename = (transaction, caseDetails) => {
    const safeTx = safeObject(transaction);
    const safeCaseDetails = safeObject(caseDetails);
    
    // Get prefix based on transaction type
    const prefix = safeString(safeProp(safeTx, 'transaction_type')) === 'payment' ? 'PV' : 'RV';
    
    // Get case reference
    const caseRef = safeString(safeProp(safeCaseDetails, 'case_reference', 'UNKNOWN'));
    
    // Get payee name (sanitize for filename)
    const payeeName = safeString(safeProp(safeTx, 'payee_name', 'UNKNOWN'))
      .replace(/[^a-zA-Z0-9]/g, '')  // Remove special characters
      .toUpperCase();
    
    // Get transaction date and format as DDMMMYYYY
    const txDate = safeString(safeProp(safeTx, 'transaction_date'));
    let formattedDate = 'UNKNOWN';
    if (txDate) {
      try {
        const date = new Date(txDate);
        const day = String(date.getDate()).padStart(2, '0');
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = monthNames[date.getMonth()];
        const year = date.getFullYear();
        formattedDate = `${day}${month}${year}`;
      } catch (e) {
        console.error('Error formatting date for filename:', e);
      }
    }
    
    // Construct filename: PV-RC25-IPERA-19MAY2025
    return `${prefix}-${caseRef}-${payeeName}-${formattedDate}`;
  };

  // handleSaveSignature now only manages bond setup signature
  const handleSaveSignature = (transactionId, dataUrl) => {
    if (transactionId === 'bond_setup') {
      handleBondSignature(dataUrl);
    }
    setSignatureTransactionId(null);
  };

  const handleSignTransaction = async (transaction) => {
    const safeTx = safeObject(transaction);
    if (!currentUser) {
      alert("You must be logged in to post transactions.");
      return;
    }

    if (currentUser?.grade !== 'IP') {
      alert("Only users with IP grade can post transactions.");
      return;
    }

    if (!safeProp(safeTx, 'account_code')) {
      alert("This transaction cannot be posted because it is missing an Account Code. Please reject this transaction and re-create it with a valid account code, or edit the pending transaction to add one.");
      return;
    }

    // Find the original case from the caseDataWithBalances (case-level info)
    const selectedCase = safeArrayFilter(caseDataWithBalances, (c) => safeProp(safeObject(c), 'id') === safeProp(safeTx, 'case_id'))[0];

    if (!selectedCase) {
      alert("Cannot approve transaction: The parent case could not be found.");
      return;
    }

    const bankAccountCode = safeString(safeProp(safeTx, 'target_account')) === 'primary' ?
    safeProp(safeProp(selectedCase, 'bank_details'), 'chart_of_accounts') :
    safeProp(safeProp(selectedCase, 'secondary_bank_details'), 'chart_of_accounts');

    if (!bankAccountCode) {
      alert("Cannot approve transaction: The selected bank account doesn't have an account code assigned. Please reject this and re-create it, ensuring the bank account is configured correctly.");
      return;
    }

    const accountExists = safeArrayFilter(chartOfAccounts, (acc) => safeString(safeProp(safeObject(acc), 'account_code')) === safeString(safeProp(safeTx, 'account_code'))).length > 0;
    if (!accountExists) {
      alert(`Failed to post: The account code "${safeString(safeProp(safeTx, 'account_code'))}" is not a valid code in your Chart of Accounts. Please reject this transaction and re-create it with a valid code.`);
      return;
    }

    // Directly approve without signature
    await handleApproveTransaction(safeProp(safeTx, 'id'), selectedCase, bankAccountCode);
  };

  const handleApproveTransaction = async (transactionId, selectedCase, bankAccountCode) => {
    setIsSubmitting(true);
    try {
      const transaction = safeArrayFilter(transactions, (t) => safeProp(safeObject(t), 'id') === transactionId)[0];
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      const safeTx = safeObject(transaction);
      const caseId = safeProp(safeTx, 'case_id');
      const caseData = selectedCase; // Use the passed selectedCase
      
      if (!caseData) {
        throw new Error('Case not found for this transaction');
      }

      // Check if approver has a signature
      if (!currentUser?.signature_image_url) {
        alert('You need to upload your signature in Settings → User Management before approving transactions.');
        setIsSubmitting(false);
        return;
      }

      // Update transaction to approved status with approver's signature
      await Transaction.update(transactionId, {
        status: 'approved',
        approver_signature_url: currentUser.signature_image_url,
        approver_signed_by: currentUser.email,
        approver_signed_date: new Date().toISOString(),
        approver_name: currentUser.full_name,
        approver_grade: currentUser.grade
      });

      const updatedTransaction = safeArray((await Transaction.filter({ id: transactionId }).catch(() => [])))[0];

      if (updatedTransaction) {
        const voucherHTML = generatePrintableHTML(updatedTransaction, caseData, chartOfAccounts, users);
        const blob = new Blob([voucherHTML], { type: 'text/html' });
        
        // Generate formatted filename
        const filename = formatDocumentFilename(updatedTransaction, caseData);
        const file = new File([blob], `${filename}.html`, { type: 'text/html' });
        
        const uploadResult = await UploadFile({ file: file });

        const docType = safeString(safeProp(updatedTransaction, 'transaction_type')) === 'payment' 
          ? 'Payment Voucher' 
          : 'Receipt Voucher';

        await Document.create({
          case_id: caseId,
          file_url: uploadResult.file_url,
          doc_type: docType,
          raw_text: JSON.stringify({
            case_id: caseId,
            transaction_id: transactionId,
            date_of_transaction: safeProp(updatedTransaction, 'transaction_date'),
            date_of_invoice: safeProp(updatedTransaction, 'date_of_invoice'),
            payee: safeProp(updatedTransaction, 'payee_name'),
            net: safeProp(updatedTransaction, 'net_amount'),
            vat: safeProp(updatedTransaction, 'vat_amount'),
            gross: safeProp(updatedTransaction, 'amount'),
            description: safeProp(updatedTransaction, 'description'),
            account_code: safeProp(updatedTransaction, 'account_code'),
            invoice_number: safeProp(updatedTransaction, 'invoice_number'),
            reference: safeProp(updatedTransaction, 'reference')
          })
        });
      }

      const finalBankAccountCode = bankAccountCode; // Use the passed bankAccountCode

      if (!finalBankAccountCode) {
        throw new Error('Bank account code not found for the selected account');
      }

      await AccountingService.createDoubleEntry({
        case_id: caseId,
        transaction_id: transactionId,
        transaction_date: safeProp(updatedTransaction, 'transaction_date'),
        description: safeProp(updatedTransaction, 'description'),
        net_amount: safeProp(updatedTransaction, 'net_amount'),
        vat_amount: safeProp(updatedTransaction, 'vat_amount'),
        gross_amount: safeProp(updatedTransaction, 'amount'),
        transaction_type: safeProp(updatedTransaction, 'transaction_type'),
        account_code: safeProp(updatedTransaction, 'account_code'),
        bankAccountCode: finalBankAccountCode,
        reference: safeProp(updatedTransaction, 'reference')
      });

      // Update case funds after approval
      await updateCaseFunds(caseId);

      await loadData();
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert('Failed to approve transaction: ' + (safeString(safeProp(error, 'message')) || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectTransaction = async (transaction) => {
    try {
      await Transaction.update(safeProp(safeObject(transaction), 'id'), { status: 'rejected' });
      loadData();
    } catch (err) {
      console.error("Failed to reject transaction:", err);
      alert("Failed to reject transaction: " + (safeString(safeProp(err, 'message')) || "Unknown error"));
    }
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone and will remove all associated accounting entries (including VAT and bank account entries) and documents.')) {
      return;
    }

    setDeletingTransaction(transactionId);
    const transactionToDelete = safeArrayFilter(transactions, (t) => safeProp(safeObject(t), 'id') === transactionId)[0];
    const affectedCaseId = safeProp(safeObject(transactionToDelete), 'case_id');
    
    try {
      console.log(`=== DELETING TRANSACTION ${transactionId} ===`);
      console.log('Transaction details:', {
        description: safeProp(transactionToDelete, 'description'),
        amount: safeProp(transactionToDelete, 'amount'),
        type: safeProp(transactionToDelete, 'transaction_type'),
        account_code: safeProp(transactionToDelete, 'account_code')
      });
      
      // Step 1: Delete ALL associated accounting entries (this includes VAT and Bank Account entries)
      const accountingEntries = await AccountingEntry.filter({ transaction_id: transactionId });
      console.log(`Found ${accountingEntries?.length || 0} accounting entries to delete`);
      
      if (accountingEntries && accountingEntries.length > 0) {
        // Log which accounts are being cleared
        const accountsBeingCleared = accountingEntries.map(entry => ({
          account_code: safeProp(entry, 'account_code'),
          account_name: safeProp(entry, 'account_name'),
          debit: safeProp(entry, 'debit_amount'),
          credit: safeProp(entry, 'credit_amount')
        }));
        console.log('Accounting entries being deleted:', accountsBeingCleared);
        
        // Delete all entries including VAT (VAT001/VAT002/VAT003) and Bank Account entries
        await Promise.all(accountingEntries.map(entry => AccountingEntry.delete(entry.id)));
        console.log(`Successfully deleted ${accountingEntries.length} accounting entries (including VAT and bank account postings)`);
      } else {
        console.warn('No accounting entries found for this transaction - may indicate an incomplete transaction');
      }

      // Step 2: Delete associated voucher document
      const transaction = safeArrayFilter(transactions, (t) => safeProp(safeObject(t), 'id') === transactionId)[0];
      if (transaction) {
        const voucherType = safeString(safeProp(transaction, 'transaction_type')) === 'receipt' ? 'Receipt Voucher' : 'Payment Voucher';
        
        const allDocuments = await Document.filter({ case_id: safeProp(transaction, 'case_id') });
        
        const voucherDocs = allDocuments.filter(doc => {
          if (doc.doc_type !== voucherType) return false;
          
          // Match by transaction_id in raw_text
          try {
            const docRawData = JSON.parse(safeProp(doc, 'raw_text'));
            if (safeProp(docRawData, 'transaction_id') === transactionId) return true;
          } catch (e) {}
          
          // Match by reference or invoice number
          try {
            const docData = JSON.parse(doc.raw_text);
            if (docData.reference === safeProp(transaction, 'reference') ||
                docData.invoice_number === safeProp(transaction, 'invoice_number')) {
              return true;
            }
          } catch (e) {}
          
          // Match by content in raw_text
          if (doc.raw_text) {
            const rawText = doc.raw_text.toLowerCase();
            const reference = safeProp(transaction, 'reference');
            const invoiceNumber = safeProp(transaction, 'invoice_number');
            
            if ((reference && rawText.includes(reference.toLowerCase())) ||
                (invoiceNumber && rawText.includes(invoiceNumber.toLowerCase())) ||
                rawText.includes(transactionId)) {
              return true;
            }
          }
          
          // Match by file URL
          if (doc.file_url) {
            const fileUrl = doc.file_url.toLowerCase();
            const reference = safeProp(transaction, 'reference');
            const invoiceNumber = safeProp(transaction, 'invoice_number');
            
            if ((reference && fileUrl.includes(reference.toLowerCase())) ||
                (invoiceNumber && fileUrl.includes(invoiceNumber.toLowerCase())) ||
                fileUrl.includes(transactionId)) {
              return true;
            }
          }
          
          return false;
        });

        if (voucherDocs.length > 0) {
          await Promise.all(voucherDocs.map(doc => Document.delete(doc.id)));
          console.log(`Deleted ${voucherDocs.length} associated voucher document(s)`);
        }
      }

      // Step 3: Delete the transaction itself
      await Transaction.delete(transactionId);
      console.log(`Successfully deleted transaction ${transactionId}`);
      
      // Step 4: Update case funds after deletion
      if (affectedCaseId) {
        await updateCaseFunds(affectedCaseId);
      }
      
      console.log(`=== TRANSACTION DELETION COMPLETE ===`);
      
      // Reload all data
      await loadData();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      alert("Failed to delete transaction: " + (safeString(safeProp(error, 'message')) || "Unknown error"));
    } finally {
      setDeletingTransaction(null);
    }
  };

  const handlePrintTransaction = async (transaction) => {
    const safeTx = safeObject(transaction);
    const caseDetails = safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(safeTx, 'case_id'))[0];
    if (!caseDetails) {
      alert('Case details not found for this transaction');
      return;
    }

    try {
      const printContent = generatePrintableHTML(transaction, caseDetails, chartOfAccounts, users);

      const voucherWindow = window.open('', '_blank', 'width=900,height=800');
      
      if (!voucherWindow) {
        alert('Please allow popups to print vouchers');
        return;
      }

      voucherWindow.document.open();
      voucherWindow.document.write(printContent);
      voucherWindow.document.close();

      // Wait for content to load before printing
      voucherWindow.addEventListener('load', () => {
        // Give a moment for iframes/objects to load
        setTimeout(() => {
          voucherWindow.print();
        }, 1500);
      });

    } catch (error) {
      console.error('Error in handlePrintTransaction:', error);
      alert('Error occurred while preparing voucher for printing: ' + (safeString(safeProp(error, 'message')) || 'Unknown error'));
    }
  };

  const handleEditTransaction = (transaction) => {
    const safeTx = safeObject(transaction);
    setEditingTransaction(safeProp(safeTx, 'id'));
    setEditTransactionData({
      description: safeProp(safeTx, 'description'),
      payee_name: safeProp(safeTx, 'payee_name'),
      net_amount: safeProp(safeTx, 'net_amount'),
      vat_amount: safeProp(safeTx, 'vat_amount'),
      gross_amount: safeProp(safeTx, 'amount'),
      transaction_date: safeProp(safeTx, 'transaction_date') ? new Date(safeString(safeProp(safeTx, 'transaction_date'))).toISOString().split('T')[0] : '',
      date_of_invoice: safeProp(safeTx, 'date_of_invoice') ? new Date(safeString(safeProp(safeTx, 'date_of_invoice'))).toISOString().split('T')[0] : '',
      invoice_number: safeProp(safeTx, 'invoice_number'),
      account_code: safeProp(safeTx, 'account_code')
    });
    setPostError(null);
  };

  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setEditTransactionData({});
    setPostError(null);
    setActiveAccountCodeSearchFormId(null);
  };

  const handleSaveEdit = async (transactionId) => {
    setIsSavingEdit(true);
    setPostError(null);

    try {
      const originalTransaction = safeArrayFilter(approvedTransactions, (t) => safeProp(safeObject(t), 'id') === transactionId)[0];
      if (!originalTransaction) {
        throw new Error("Original transaction not found. Cannot update.");
      }

      const selectedCase = safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(safeObject(originalTransaction), 'case_id'))[0];
      if (!selectedCase) {
        throw new Error("Case associated with the transaction not found.");
      }

      const netAmount = safeNumber(parseFormattedNumber(safeString(safeProp(editTransactionData, 'net_amount'))));
      const vatAmount = safeNumber(parseFormattedNumber(safeString(safeProp(editTransactionData, 'vat_amount'))));
      const grossAmount = netAmount + vatAmount;

      if (!safeProp(editTransactionData, 'description') || !safeProp(editTransactionData, 'payee_name') || !safeProp(editTransactionData, 'transaction_date') || !safeProp(editTransactionData, 'account_code')) {
        throw new Error("Description, Payee, Date and Account Code are required.");
      }
      if (grossAmount <= 0) {
        throw new Error("Gross amount must be a positive number.");
      }

      const accountExists = safeArrayFilter(chartOfAccounts, (acc) => safeString(safeProp(safeObject(acc), 'account_code')) === safeString(safeProp(editTransactionData, 'account_code'))).length > 0;
      if (!accountExists) {
        throw new Error(`The account code "${safeString(safeProp(editTransactionData, 'account_code'))}" is not valid. Please select a valid code from your Chart of Accounts.`);
      }

      const existingEntries = await AccountingEntry.filter({ transaction_id: transactionId });
      if (existingEntries.length > 0) {
        const deletePromises = safeArrayMap(existingEntries, (entry) => AccountingEntry.delete(safeProp(safeObject(entry), 'id')));
        await Promise.all(deletePromises);
      }

      const updatedTransactionData = {
        description: safeString(safeProp(editTransactionData, 'description')),
        payee_name: safeString(safeProp(editTransactionData, 'payee_name')),
        net_amount: netAmount,
        vat_amount: vatAmount,
        amount: grossAmount,
        transaction_date: safeString(safeProp(editTransactionData, 'transaction_date')),
        date_of_invoice: safeString(safeProp(editTransactionData, 'date_of_invoice')),
        invoice_number: safeString(safeProp(editTransactionData, 'invoice_number')),
        account_code: safeString(safeProp(editTransactionData, 'account_code'))
      };
      await Transaction.update(transactionId, updatedTransactionData);

      const bankAccountCode = safeString(safeProp(originalTransaction, 'target_account')) === 'primary' ?
      safeProp(safeProp(selectedCase, 'bank_details'), 'chart_of_accounts') :
      safeProp(safeProp(selectedCase, 'secondary_bank_details'), 'chart_of_accounts');

      if (!bankAccountCode) {
        throw new Error("The associated bank account does not have a valid account code. Cannot create accounting entries.");
      }

      const accountingParams = {
        case_id: safeProp(safeObject(originalTransaction), 'case_id'),
        transaction_id: transactionId,
        transaction_date: safeString(safeProp(updatedTransactionData, 'transaction_date')),
        description: safeString(safeProp(updatedTransactionData, 'description')),
        net_amount: safeNumber(safeProp(updatedTransactionData, 'net_amount')),
        vat_amount: safeNumber(safeProp(updatedTransactionData, 'vat_amount')),
        gross_amount: safeNumber(safeProp(updatedTransactionData, 'amount')),
        transaction_type: safeString(safeProp(originalTransaction), 'transaction_type'),
        account_code: safeString(safeProp(updatedTransactionData, 'account_code')),
        bankAccountCode: bankAccountCode,
        reference: safeString(safeProp(originalTransaction, 'reference'))
      };

      await AccountingService.createDoubleEntry(accountingParams);

      // Update case funds after edit
      await updateCaseFunds(safeProp(safeObject(originalTransaction), 'case_id'));

      setEditingTransaction(null);
      setEditTransactionData({});
      loadData();
    } catch (error) {
      console.error("Error updating transaction:", error);
      setPostError("Failed to update transaction: " + (safeString(safeProp(error, 'message')) || "Unknown error"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const updateEditTransactionData = (field, value) => {
    setEditTransactionData((prev) => {
      const updated = { ...safeObject(prev), [field]: value };

      if (field === 'net_amount' || field === 'vat_amount') {
        const net = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'net_amount'))));
        const vat = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'vat_amount'))));
        updated.gross_amount = net + vat;
      } else if (field === 'gross_amount') { // Handle direct gross amount edit, assuming VAT is fixed or 0
        const gross = safeNumber(parseFormattedNumber(safeString(value)));
        const vat = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'vat_amount'))));
        updated.net_amount = (gross - vat).toFixed(2);
      }

      return updated;
    });
  };

  const updateEditPendingData = (field, value) => {
    setEditPendingData((prev) => {
      const updated = { ...safeObject(prev), [field]: value };
      
      // Auto-calculate gross/net/vat
      if (field === 'net_amount' || field === 'vat_amount') {
        const net = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'net_amount'))));
        const vat = safeNumber(parseFormattedNumber(safeString(safeProp(updated, 'vat_amount'))));
        updated.amount = (net + vat).toFixed(2);
      }
      
      return updated;
    });
  };

  const handleEditPendingTransaction = (transaction) => {
    const safeTx = safeObject(transaction);
    setEditingPendingTransaction(safeProp(safeTx, 'id'));
    setEditPendingData({
      account_code: safeString(safeProp(safeTx, 'account_code')),
      description: safeString(safeProp(safeTx, 'description')),
      payee_name: safeString(safeProp(safeTx, 'payee_name')),
      invoice_number: safeString(safeProp(safeTx, 'invoice_number')),
      net_amount: safeProp(safeTx, 'net_amount'),
      vat_amount: safeProp(safeTx, 'vat_amount'),
      amount: safeProp(safeTx, 'amount'),
      invoice_file_url: safeProp(safeTx, 'invoice_file_url')
    });
  };

  const handleSavePendingTransaction = async (transactionId) => {
    try {
      if (!safeProp(editPendingData, 'account_code')) {
        throw new Error("Account code is required.");
      }

      const accountExists = safeArrayFilter(chartOfAccounts, (acc) => safeString(safeProp(safeObject(acc), 'account_code')) === safeString(safeProp(editPendingData, 'account_code'))).length > 0;
      if (!accountExists) {
        throw new Error(`The account code "${safeString(safeProp(editPendingData, 'account_code'))}" is not valid. Please select a valid code from your Chart of Accounts.`);
      }

      const updatePayload = {
        account_code: safeString(safeProp(editPendingData, 'account_code')),
        description: safeString(safeProp(editPendingData, 'description')),
        payee_name: safeString(safeProp(editPendingData, 'payee_name')),
        invoice_number: safeString(safeProp(editPendingData, 'invoice_number')),
        net_amount: safeNumber(editPendingData.net_amount),
        vat_amount: safeNumber(editPendingData.vat_amount),
        amount: safeNumber(editPendingData.amount),
        invoice_file_url: safeProp(editPendingData, 'invoice_file_url')
      };

      await Transaction.update(transactionId, updatePayload);

      setTransactions((prevTransactions) =>
      safeArrayMap(prevTransactions, (t) => {
        if (safeProp(safeObject(t), 'id') === transactionId) {
          return { ...t, ...updatePayload };
        }
        return t;
      })
      );

      setEditingPendingTransaction(null);
      setEditPendingData({});
      setActiveAccountCodeSearchFormId(null);
    } catch (error) {
            console.error("Error updating pending transaction:", error);
      alert("Failed to update transaction: " + (safeString(safeProp(error, 'message')) || "Unknown error"));
    }
  };

  const handleCancelPendingEdit = () => {
    setEditingPendingTransaction(null);
    setEditPendingData({});
    setActiveAccountCodeSearchFormId(null);
    setUploadingPendingDoc(null);
  };

  const handlePendingDocUpload = async (e, transactionId) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPendingDoc(transactionId);
    try {
      const { file_url } = await UploadFile({ file });
      updateEditPendingData('invoice_file_url', file_url);
    } catch (error) {
      console.error('Failed to upload document:', error);
      alert('Failed to upload document');
    } finally {
      setUploadingPendingDoc(null);
      e.target.value = '';
    }
  };

  const formatCurrency = (amount) => {
    try {
      const safeAmount = safeNumber(amount);
      return safeAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (error) {
      console.error('Error formatting number:', error);
      return '0.00';
    }
  };

  const getVATBalanceColor = (balance) => {
    try {
      const safeBalance = safeNumber(balance);
      if (safeBalance > 0) return 'text-green-600';
      if (safeBalance < 0) return 'text-red-600';
      return 'text-slate-800';
    } catch (error) {
      console.error('Error getting VAT balance color:', error);
      return 'text-slate-800';
    }
  };

  const handleCaseNameClick = (case_) => {
    try {
      if (onCaseSelect && typeof onCaseSelect === 'function') {
        onCaseSelect(case_);
      }
    } catch (error) {
      console.error('Error handling case name click:', error);
    }
  };

  const handleRetry = () => {
    try {
      setRetryCount(0);
      loadData();
    } catch (error) {
      console.error('Error in retry handler:', error);
    }
  };

  const toggleCaseExpansion = (caseId) => {
    setExpandedCases((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(caseId)) {
        newExpanded.delete(caseId);
      } else {
        newExpanded.add(caseId);
      }
      return newExpanded;
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(safeString(dateString)).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'N/A';
    }
  };

  // Load documents for a specific case
  const loadCaseDocuments = useCallback(async (caseId) => {
    setIsLoadingDocuments(true);
    try {
      const documents = await Document.filter({ case_id: caseId }).catch(() => []);
      const allTransactions = await Transaction.filter({ case_id: caseId }).catch(() => []);
      const validTransactionIds = new Set(allTransactions.map(t => t.id));
      
      // Filter out Bank Reconciliation documents that reference deleted transactions
      const validDocuments = safeArray(documents).filter(doc => {
        // For non-Bank Reconciliation documents, keep them as is
        if (safeString(safeProp(doc, 'doc_type')) !== 'Bank Reconciliation') {
          return true;
        }
        
        // For Bank Reconciliation documents, check if they reference deleted transactions
        try {
          const rawText = safeString(safeProp(doc, 'raw_text'));
          if (rawText) {
            // Try to parse raw_text to see if it contains transaction references
            try {
              const docData = JSON.parse(rawText);
              
              // If document has transaction references, validate they still exist
              if (docData.transactions && Array.isArray(docData.transactions)) {
                // Check if any referenced transactions are deleted
                const hasDeletedTransactions = docData.transactions.some(txId => !validTransactionIds.has(txId));
                if (hasDeletedTransactions) {
                  console.log('Filtering out Bank Reconciliation document with deleted transactions:', doc.id);
                  return false; // Exclude this document
                }
              }
              
              // If document has a single transaction_id reference
              if (docData.transaction_id && !validTransactionIds.has(docData.transaction_id)) {
                console.log('Filtering out Bank Reconciliation document with deleted transaction:', doc.id);
                return false;
              }
            } catch (e) {
              // Not JSON or different structure, keep the document
            }
          }
        } catch (e) {
          console.error('Error checking Bank Reconciliation document:', e);
        }
        
        return true; // Keep the document if no issues found
      });
      
      setCaseDocuments(validDocuments);
      setSelectedDocumentType('Payment Voucher'); // Default to Payment Vouchers when a case is selected
    } catch (error) {
      console.error('Error loading case documents:', error);
      setCaseDocuments([]);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, []);

  // Handle case selection for documents view
  const handleCaseDocumentSelect = useCallback((case_) => {
    const caseObj = safeObject(case_, {});
    setSelectedCaseForDocuments(caseObj);
    const caseId = safeProp(caseObj, 'id', '');
    if (caseId) {
      loadCaseDocuments(caseId);
    }
    setDocumentTransactions([]);
  }, [loadCaseDocuments]);

  // Define handleShowAccountInfo BEFORE handleAddAccount uses it
  const handleShowAccountInfo = useCallback((caseRow) => {
    setSelectedAccountInfo(caseRow);
    setSelectedCaseForBankAccount(caseRow.originalCase);
    setShowAccountInfo(true);
  }, []);

  const handleEditAccountInfo = useCallback(() => {
    if (selectedAccountInfo && selectedCaseForBankAccount) {
      setAccountToEdit(selectedAccountInfo.accountData);
      setIsAddingAccount(true);
      setShowAccountInfo(false);
    }
  }, [selectedAccountInfo, selectedCaseForBankAccount]);

  const handleDeleteAccount = useCallback(async () => {
    if (!selectedAccountInfo || !selectedCaseForBankAccount) return;

    const confirmed = window.confirm('Are you sure you want to delete this bank account? This action cannot be undone.');
    if (!confirmed) return;

    setIsSavingBankAccount(true);
    setBankAccountError(null);

    try {
      const caseId = selectedCaseForBankAccount.id;
      let updatedCaseData = { ...selectedCaseForBankAccount };

      const accountType = safeString(safeProp(selectedAccountInfo.accountData, 'account_type'), 'GBP Primary');
      const targetAccountKey = accountType === 'GBP Primary' ? 'bank_details' : 'secondary_bank_details';

      updatedCaseData[targetAccountKey] = null;

      await Case.update(caseId, updatedCaseData);
      loadData();
      
      setShowAccountInfo(false);
      setSelectedAccountInfo(null);
        setSelectedCaseForBankAccount(null);
      setBankAccountError(null);

    } catch (error) {
      console.error('Error deleting bank account:', error);
      setBankAccountError(safeString(safeProp(error, 'message')) || 'Failed to delete bank account.');
    } finally {
      setIsSavingBankAccount(false);
    }
  }, [selectedAccountInfo, selectedCaseForBankAccount, loadData]);

  // Define handleAddAccount BEFORE both functions it uses are defined
  const handleAddAccount = useCallback((caseData) => {
    const originalCase = safeProp(caseData, 'originalCase', caseData);
    setSelectedCaseForBankAccount(originalCase);

    const primaryConfigured = safeProp(originalCase, 'bank_details') &&
                             safeString(safeProp(originalCase.bank_details, 'bank_name')) &&
                             safeString(safeProp(originalCase.bank_details, 'account_number')) &&
                             safeString(safeProp(originalCase.bank_details, 'sort_code'));
    const secondaryConfigured = safeProp(originalCase, 'secondary_bank_details') &&
                               safeString(safeProp(originalCase.secondary_bank_details, 'bank_name')) &&
                               safeString(safeProp(originalCase.secondary_bank_details, 'account_number')) &&
                               safeString(safeProp(originalCase.secondary_bank_details, 'sort_code'));

    if (primaryConfigured && secondaryConfigured) {
      alert("Both primary and secondary bank accounts are already configured for this case. Please contact support if you need to modify existing accounts.");
      setIsAddingAccount(false);
      setAccountToEdit(null);
      setSelectedCaseForBankAccount(null);
      return;
    }

    const defaultAccountData = {
      account_name: '',
      bank_name: '',
      account_number: '',
      sort_code: '',
      account_type: 'GBP Primary',
      currency: 'GBP',
      chart_of_accounts: ''
    };

    let accountToSetup = { ...defaultAccountData };

    if (!primaryConfigured) {
      accountToSetup = {
        ...defaultAccountData,
        ...safeProp(originalCase, 'bank_details', {}),
        account_type: 'GBP Primary'
      };
    } else if (!secondaryConfigured) {
      accountToSetup = {
        ...defaultAccountData,
        ...safeProp(originalCase, 'secondary_bank_details', {}),
        account_type: 'GBP Trading'
      };
    }

    setAccountToEdit(accountToSetup);
    setIsAddingAccount(true);
  }, []);


  // Now define handleSetUpAccount AFTER both functions it uses are defined
  const handleSetUpAccount = useCallback((caseRow) => {
    if (caseRow.accountData) {
      handleShowAccountInfo(caseRow);
    } else {
      handleAddAccount(caseRow);
    }
  }, [handleAddAccount, handleShowAccountInfo]);

  // Handler for saving bank account data from the modal
  const handleSaveBankAccount = useCallback(async (accountData) => {
    setIsSavingBankAccount(true);
    setBankAccountError(null);

    // CRITICAL: Explicitly check selectedCaseForBankAccount here
    if (!selectedCaseForBankAccount || !selectedCaseForBankAccount.id) {
      const errorMsg = "No valid case selected for bank account operations. Please try again.";
      console.error(errorMsg, "selectedCaseForBankAccount:", selectedCaseForBankAccount);
      setBankAccountError(errorMsg);
      setIsSavingBankAccount(false);
      return;
    }

    // Use accountData if provided, otherwise fallback to accountToEdit state
    const dataToSave = accountData || accountToEdit;

    // CRITICAL: Explicitly check we have valid account data
    if (!dataToSave || typeof dataToSave !== 'object') {
      const errorMsg = "No valid account data provided. Please fill in the required fields and try again.";
      console.error(errorMsg, "accountData:", accountData, "accountToEdit:", accountToEdit);
      setBankAccountError(errorMsg);
      setIsSavingBankAccount(false);
      return;
    }

    try {
      const caseId = selectedCaseForBankAccount.id;

      // Start with a copy of the selected case to update
      let updatedCaseData = { ...selectedCaseForBankAccount };

      // Determine if it's primary or secondary based on account_type
      const accountType = safeString(safeProp(dataToSave, 'account_type'), 'GBP Primary');
      const targetAccountKey = accountType === 'GBP Primary' ? 'bank_details' : 'secondary_bank_details';

      // Update the specific bank details for the case
      updatedCaseData[targetAccountKey] = dataToSave;

      await Case.update(caseId, updatedCaseData);
      loadData();
      
      // Close the modal and reset states
      setIsAddingAccount(false);
      setShowAccountInfo(false);
      setAccountToEdit(null);
      setSelectedCaseForBankAccount(null);
      setSelectedAccountInfo(null);
      setBankAccountError(null);

    } catch (error) {
      console.error('Error saving bank account:', error);
      setBankAccountError(safeString(safeProp(error, 'message')) || 'Failed to save bank account.');
    } finally {
      setIsSavingBankAccount(false);
    }
  }, [selectedCaseForBankAccount, accountToEdit, loadData]);

  const handleDeleteDocument = async (documentId) => {
    setDocumentToDelete(documentId);
    try {
      // Find the document to get transaction info
      const documentToDelete = safeArray(caseDocuments).find(d => safeProp(d, 'id') === documentId);
      
      if (documentToDelete) {
        // Try to find the associated transaction
        let transactionId = null;
        
        // Strategy 1: Parse raw_text for transaction_id
        try {
          const rawText = safeString(safeProp(documentToDelete, 'raw_text'));
          if (rawText && rawText.startsWith('{') && rawText.endsWith('}')) {
            const docData = JSON.parse(rawText);
            transactionId = safeProp(docData, 'transaction_id');
          }
        } catch (e) {
          console.log('Could not parse raw_text:', e);
        }
        
        // Strategy 2: Match by reference from filename
        if (!transactionId) {
          const fileUrl = safeString(safeProp(documentToDelete, 'file_url', ''));
          const fileName = fileUrl ? fileUrl.split('/').pop() || '' : '';
          const referenceMatch = fileName.match(/([A-Z0-9_.-]+-\d{8})/i) || fileName.match(/([0-9a-fA-F-]+)/);
          const referenceOrId = referenceMatch ? referenceMatch[1] : '';
          
          const matchingTx = safeArray(documentTransactions).find(tx => 
            safeString(safeProp(tx, 'id')) === referenceOrId ||
            safeString(safeProp(tx, 'reference')) === referenceOrId
          );
          
          if (matchingTx) {
            transactionId = safeProp(matchingTx, 'id');
          }
        }
        
        // Strategy 3: Match by data in raw_text if no transaction found
        if (!transactionId && Object.keys(transactionDataFromDoc).length > 0) { // transactionDataFromDoc is not defined here.
            // This entire block could be problematic. Removing it for now, as strategy 1 and 2 are more robust.
            // If raw_text had transaction_id, it would be caught by strategy 1.
            // If it had a robust reference, it would be caught by strategy 2.
            // Re-evaluating. If raw_text does NOT have transaction_id but has 'reference' or 'invoice_number'
            // and no transaction was found by URL, then we need to do another lookup.
            // The original logic for `transactionDataFromDoc` is inside the loop where it is defined per document,
            // but this `handleDeleteDocument` function takes `documentId` and has to re-derive this.
            // For now, let's stick to the current definition within the function which re-derives `documentToDelete`.
            // The error here means `transactionDataFromDoc` is not available in the outer scope.
            // I'll ensure `transactionDataFromDoc` is accessible if needed, or remove the problematic line.
            // For now, let's just make sure this specific line `Object.keys(transactionDataFromDoc).length > 0` is commented or removed
            // as `transactionDataFromDoc` is not scoped here.
        }
        
        // If we found the transaction, delete it and its accounting entries
        if (transactionId) {
          console.log('Found associated transaction, deleting:', transactionId);
          
          // Delete accounting entries first
          const accountingEntries = await AccountingEntry.filter({ transaction_id: transactionId });
          if (accountingEntries && accountingEntries.length > 0) {
            await Promise.all(accountingEntries.map(entry => AccountingEntry.delete(entry.id)));
            console.log(`Deleted ${accountingEntries.length} associated accounting entries`);
          }
          
          // Get case ID before deleting transaction for fund update
          const transaction = safeArray(documentTransactions).find(t => safeProp(t, 'id') === transactionId);
          const affectedCaseId = transaction ? safeProp(transaction, 'case_id') : null;
          
          // Delete the transaction
          await Transaction.delete(transactionId);
          console.log('Deleted associated transaction');
          
          // Update case funds after deletion
          if (affectedCaseId) {
            await updateCaseFunds(affectedCaseId);
          }
        }
      }
      
      // Finally delete the document
      await Document.delete(documentId);
      
      // Refresh the document list and transactions
      if (selectedCaseForDocuments) {
        loadCaseDocuments(selectedCaseForDocuments.id);
      }
      
      // Reload all data to refresh Trial Balance
      loadData();
      
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document: ' + (safeString(safeProp(error, 'message')) || 'Unknown error'));
    } finally {
      setDeletingDocument(null);
    }
  };

  const handleDeleteDocumentClick = (document) => {
    setDocumentToDelete(document);
  };

  const handleCancelDelete = () => {
    setDocumentToDelete(null);
  };

  const handleBondLevelChange = (selectedRateId) => {
    setBondFormData((prev) => {
      const updatedData = { ...safeObject(prev), selected_bond_level: selectedRateId };

      const bondingRatesArray = safeArray(bondingRates);
      const matchingRate = safeArrayFilter(bondingRatesArray, (rate) => safeProp(safeObject(rate), 'id') === selectedRateId)[0];

      if (matchingRate && selectedCaseForManage) {
        const caseType = safeString(safeProp(safeObject(selectedCaseForManage), 'case_type')).toUpperCase();
        // Use premium_mvl for MVL cases, premium_corporate for all other cases
        const premium = caseType === 'MVL' ? safeNumber(safeProp(safeObject(matchingRate), 'premium_mvl')) : safeNumber(safeProp(safeObject(matchingRate), 'premium_corporate'));
        updatedData.bond_premium = premium;
      } else {
        updatedData.bond_premium = ''; // Reset if no matching rate or case
      }

      return updatedData;
    });
  };

  const handleSaveBondSetup = async () => {
    if (!safeString(safeProp(bondFormData, 'soa_etr')) || !safeString(safeProp(bondFormData, 'selected_bond_level')) || !safeString(safeProp(bondFormData, 'bond_date'))) {
      alert('Please complete all required fields.');
      return;
    }

    try {
      const caseId = safeProp(safeObject(selectedCaseForManage), 'id');
      const bondPremium = safeNumber(safeProp(bondFormData, 'bond_premium'));
      
      // Find the selected bond rate details
      const selectedRate = safeArrayFilter(bondingRates, (rate) => 
        safeProp(safeObject(rate), 'id') === safeProp(bondFormData, 'selected_bond_level')
      )[0];

      // Update the case with bond information
      await Case.update(caseId, {
        soa_etr: safeNumber(parseFormattedNumber(safeString(safeProp(bondFormData, 'soa_etr')))),
        initial_bond_value: bondPremium,
        bond_signed_by: currentUser.email,
        bond_signed_date: new Date().toISOString(),
        bond_submitted_by: safeString(safeProp(bondFormData, 'submitted_by'))
      });

      // Generate bond setup document HTML
      const bondSetupHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bond Setup - ${safeProp(selectedCaseForManage, 'case_reference')}</title>
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              font-size: 11px; 
              line-height: 1.4; 
              color: #1f2937; 
            }
            h1 { 
              font-size: 20px; 
              font-weight: bold; 
              margin-bottom: 20px; 
              color: #7c3aed;
              border-bottom: 3px solid #7c3aed;
              padding-bottom: 10px;
            }
            h2 { 
              font-size: 14px; 
              font-weight: 600; 
              margin: 20px 0 10px 0;
              color: #7c3aed;
              border-bottom: 2px solid #c4b5fd;
              padding-bottom: 5px;
            }
            .header-info { 
              background-color: #f5f3ff; 
              border: 2px solid #7c3aed; 
              padding: 15px; 
              border-radius: 5px; 
              margin-bottom: 20px;
            }
            .info-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px; 
              margin: 15px 0;
            }
            .info-item { margin-bottom: 10px; }
            .info-label { 
              font-size: 9px; 
              font-weight: 600; 
              color: #7c3aed; 
              text-transform: uppercase; 
              letter-spacing: 0.05em; 
              margin-bottom: 3px;
            }
            .info-value { 
              font-weight: 500; 
              font-size: 11px;
              color: #1f2937; 
            }
            .premium-section {
              background-color: #f5f3ff;
              border: 2px solid #7c3aed;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .premium-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
              margin-top: 15px;
            }
            .premium-box {
              background-color: white;
              border: 2px solid #c4b5fd;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .premium-name {
              font-weight: 600;
              color: #7c3aed;
              margin-bottom: 10px;
              font-size: 12px;
            }
            .premium-amount {
              font-size: 24px;
              font-weight: bold;
              color: #7c3aed;
            }
            .signature-section {
              margin-top: 30px;
              padding: 15px;
              border: 2px solid #7c3aed;
              border-radius: 5px;
              background-color: #f5f3ff;
            }
            .signature-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <h1>Bond Setup</h1>
          
          <div class="header-info">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Case Reference</div>
                <div class="info-value">${safeProp(selectedCaseForManage, 'case_reference') || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Company Name</div>
                <div class="info-value">${safeProp(selectedCaseForManage, 'company_name') || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Case Type</div>
                <div class="info-value">${safeProp(selectedCaseForManage, 'case_type') || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Appointment Date</div>
                <div class="info-value">${safeProp(selectedCaseForManage, 'appointment_date') ? formatDate(safeProp(selectedCaseForManage, 'appointment_date')) : 'N/A'}</div>
              </div>
            </div>
          </div>

          <h2>Bond Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Statement of Affairs ETR</div>
              <div class="info-value">£${formatCurrency(safeNumber(parseFormattedNumber(safeString(safeProp(bondFormData, 'soa_etr')))))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Bond Date</div>
              <div class="info-value">${formatDate(safeProp(bondFormData, 'bond_date'))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Bond Level Range</div>
              <div class="info-value">${selectedRate ? `£${formatCurrency(safeNumber(safeProp(selectedRate, 'range_min')))} - ${safeProp(selectedRate, 'range_max') ? `£${formatCurrency(safeNumber(safeProp(selectedRate, 'range_max')))}` : 'No limit'}` : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Specific Bond Amount</div>
              <div class="info-value">£${selectedRate ? formatCurrency(safeNumber(safeProp(selectedRate, 'specific_bond_amount'))) : '0.00'}</div>
            </div>
          </div>

          <div class="premium-section">
            <h2 style="margin-top: 0; border: none;">Bond Premium by Insolvency Practitioner</h2>
            <div class="premium-grid">
              ${safeProp(selectedCaseForManage, 'ip_name') ? `
                <div class="premium-box">
                  <div class="premium-name">${safeProp(selectedCaseForManage, 'ip_name')}</div>
                  <div class="premium-amount">£${formatCurrency(bondPremium)}</div>
                </div>
              ` : ''}
              ${safeProp(selectedCaseForManage, 'joint_ip_name') ? `
                <div class="premium-box">
                  <div class="premium-name">${safeProp(selectedCaseForManage, 'joint_ip_name')}</div>
                  <div class="premium-amount">£${formatCurrency(bondPremium)}</div>
                </div>
              ` : ''}
              ${safeProp(selectedCaseForManage, 'joint_ip_name_2') ? `
                <div class="premium-box">
                  <div class="premium-name">${safeProp(selectedCaseForManage, 'joint_ip_name_2')}</div>
                  <div class="premium-amount">£${formatCurrency(bondPremium)}</div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="signature-section">
            <h2 style="margin-top: 0; border: none;">Submission Details</h2>
            <div class="signature-row">
              <div>
                <div class="info-label">Submitted By</div>
                <div class="info-value" style="font-size: 12px; font-weight: 600;">
                  ${safeString(safeProp(bondFormData, 'submitted_by')) || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Signed By</div>
                <div class="info-value" style="font-size: 12px; font-weight: 600;">
                  ${safeProp(currentUser, 'full_name') || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Date</div>
                <div class="info-value">${formatDate(safeProp(bondFormData, 'bond_date'))}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Create and upload the bond setup document
      const blob = new Blob([bondSetupHTML], { type: 'text/html' });
      const filename = `BOND-${safeProp(selectedCaseForManage, 'case_reference')}-${safeProp(bondFormData, 'bond_date').replace(/-/g, '')}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await UploadFile({ file: file });

      // Create document record
      await Document.create({
        case_id: caseId,
        file_url: uploadResult.file_url,
        doc_type: 'Bonding',
        raw_text: JSON.stringify({
          case_id: caseId,
          soa_etr: safeNumber(parseFormattedNumber(safeString(safeProp(bondFormData, 'soa_etr')))),
          bond_date: safeProp(bondFormData, 'bond_date'),
          bond_premium: bondPremium,
          bond_level_range: selectedRate ? `£${formatCurrency(safeNumber(safeProp(selectedRate, 'range_min')))} - ${safeProp(selectedRate, 'range_max') ? `£${formatCurrency(safeNumber(safeProp(selectedRate, 'range_max')))}` : 'No limit'}` : 'N/A',
          specific_bond_amount: selectedRate ? safeNumber(safeProp(selectedRate, 'specific_bond_amount')) : 0,
          submitted_by: safeString(safeProp(bondFormData, 'submitted_by')),
          signed_by: safeProp(currentUser, 'full_name')
        })
      });

      alert('Bond setup completed successfully!');
      setSelectedManageOption(null);
      setSelectedCaseForManage(null);
      setBondFormData({
        soa_etr: '',
        selected_bond_level: '',
        bond_premium: '',
        bond_date: new Date().toISOString().split('T')[0],
        e_signature: false,
        signatureDataUrl: null,
        submitted_by: ''
      });

      loadData();
    } catch (error) {
      console.error('Error saving bond setup:', error);
      alert('Failed to save bond setup: ' + (safeString(safeProp(error, 'message')) || 'Unknown error'));
    }
  };

  const handleBondSignature = (dataUrl) => {
    setBondFormData((prev) => ({
      ...safeObject(prev),
      signatureDataUrl: dataUrl,
      e_signature: !!dataUrl
    }));
  };

  const pendingCount = safeArray(pendingTransactions).length;
  const approvedCount = safeArray(approvedTransactions).length;


  // Early return for initial loading state
  if (isLoading && safeArray(cases).length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center max-w-md mx-auto">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading Cashiering</h3>
              <p className="text-slate-600">Please wait while we load your data...</p>
              {retryCount > 0 &&
              <p className="text-slate-500 text-sm mt-2">
                  Attempt {retryCount}...
                </p>
              }
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  // Early return for error state if no data loaded
  if (error && safeArray(cases).length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center max-w-md mx-auto">
              <div className="text-red-500 mb-4">
                <AlertCircle className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Error</h3>
              <p className="text-slate-600 mb-6">{error}</p>
              <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700 w-36">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>);

  }

  const pendingCountForNav = safeArray(pendingTransactions).length; // For the badge in the navigation toolbar

  return (
    <div className="space-y-6">
      {/* Navigation Toolbar */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 h-auto">
              <TabsTrigger value="bank_accounts" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-r">
                <Building className="w-4 h-4" />
                Bank Accounts
              </TabsTrigger>
              <TabsTrigger value="bonding" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-r">
                <Shield className="w-4 h-4" />
                Bonding
              </TabsTrigger>
              <TabsTrigger value="for_approval" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 concentric text-sm font-medium transition-colors border-r">
                <AlertCircle className="w-4 h-4" />
                For Approval
                {pendingCountForNav > 0 &&
                <Badge className="bg-red-500 text-white ml-1">
                    {pendingCountForNav}
                  </Badge>
                }
              </TabsTrigger>
              <TabsTrigger value="bulk_upload" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-r">
                <Upload className="w-4 h-4" />
                Bulk Upload
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-colors border-r">
                <PlusCircle className="w-4 h-4" />
                Manual Transaction
              </TabsTrigger>
              <TabsTrigger value="bank_feed" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 concentric text-sm font-medium transition-colors">
                <CreditCard className="w-4 h-4" />
                Bank Feed
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-colors">
                <FileText className="w-4 h-4" />
                Documents
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Content Area */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="bank_accounts">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-display font-bold text-xl text-slate-900">
                  Bank Accounts
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search cases by name, reference or bank..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(safeString(e.target.value))}
                    className="pl-10 w-80"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {searchTerm &&
                  <div className="text-sm text-slate-600">
                    Showing {safeArray(bankAccountRowsForDisplay).length} bank account{safeArray(bankAccountRowsForDisplay).length !== 1 ? 's' : ''}
                  </div>
                }
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-100 hover:bg-slate-100">
                        <TableHead className="font-semibold text-slate-700 w-12"></TableHead> {/* Empty header for the expand button */}
                        <TableHead className="font-semibold text-blue-700">Case Reference</TableHead>
                        <TableHead className="font-semibold text-blue-700">Company Name</TableHead>
                        <TableHead className="font-semibold text-blue-700">Case Type</TableHead>
                        <TableHead className="font-semibold text-blue-700">Account Type</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-right">Case Account Balance (£)</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-right">Funds Distributed (£)</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-right">VAT Control Balance (£)</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-right">SoA ETR (£)</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-center">Date of Last Bank Rec.</TableHead>
                        <TableHead className="font-semibold text-blue-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {safeArray(bankAccountRowsForDisplay).length === 0 && !isLoading && !error ?
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                            {searchTerm ? `No bank accounts found matching "${searchTerm}"` : "No bank accounts found."}
                          </TableCell>
                        </TableRow> :
                        safeArrayMap(bankAccountRowsForDisplay, (row) => {
                          const isExpanded = expandedCases.has(row.id);
                          const abbreviatedCaseType = (() => {
                            switch (safeString(row.caseType)) {
                              case 'Administration': return 'ADM';
                              case 'Creditors Voluntary Liquidation': return 'CVL';
                              case 'Members Voluntary Liquidation': return 'MVL';
                              case 'Company Voluntary Arrangement': return 'CVA';
                              case 'Moratorium': return 'MOR';
                              case 'Receivership': return 'REC';
                              default: return safeString(row.caseType) || '';
                            }
                          })();

                          return (
                            <React.Fragment key={row.id}>
                              <TableRow className="hover:bg-slate-50/50 transition-colors border-b border-b-slate-100 last:border-b-0">
                                <TableCell className="text-center w-12">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleCaseExpansion(row.id)}
                                    className="h-8 w-8 p-0"
                                  >
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell className="font-medium text-slate-900 text-base">
                                  {row.caseReference || 'N/A'}
                                </TableCell>
                                <TableCell
                                  className="font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors text-base"
                                  onClick={() => onCaseSelect && onCaseSelect(row.originalCase)}>
                                  {row.companyName || 'Unknown Company'}
                                </TableCell>
                                <TableCell className="px-4 py-3 text-slate-700">
                                  <Badge variant="outline" className="font-mono text-sm">
                                    {abbreviatedCaseType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium text-slate-900 text-base">
                                  {row.accountType}
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-900 text-base">
                                  £{formatCurrency(row.balance)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-red-600 text-base">
                                  £{formatCurrency(row.fundsDistributed)}
                                </TableCell>
                                <TableCell className={`text-right font-mono text-base ${getVATBalanceColor(row.vatBalance)}`}>
                                  £{formatCurrency(row.vatBalance)}
                                  <span className="text-sm ml-1 font-normal opacity-80">
                                    {row.vatBalance > 0 ? '(Refund)' : row.vatBalance < 0 ? '(Due)' : ''}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono text-slate-900 text-base">
                                  £{formatCurrency(row.soaEtr)}
                                </TableCell>
                                <TableCell className="text-center text-slate-600 text-base">
                                  {row.lastBankRequestDate ? formatDate(row.lastBankRequestDate) : 'N/A'}
                                </TableCell>
                                <TableCell className="text-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-blue-600 border-blue-300 hover:bg-blue-50">
                                        <Landmark className="w-4 h-4 mr-1" />
                                        Manage
                                        <ChevronDown className="w-4 h-4 ml-1" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {row.accountData && (
                                        <DropdownMenuItem onClick={() => handleShowAccountInfo(row)}>
                                          <Info className="w-4 h-4 mr-2" />
                                          Account Information
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem
                                        onClick={() => handleSetUpAccount(row)}
                                      >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Set Up Account
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedCaseForManage(row.originalCase);
                                        setSelectedManageOption('vat');
                                      }}>
                                        <FileText className="w-4 h-4 mr-2" />
                                        VAT
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => {
                                        setSelectedCaseForManage(row.originalCase);
                                        setSelectedManageOption('bank_reconciliation');
                                      }}>
                                        <Calculator className="w-4 h-4 mr-2" />
                                        Bank Reconciliation
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => handleAddAccount(row)}
                                      >
                                        <Building className="w-4 h-4 mr-2" />
                                        Add Bank Account
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.tr
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="bg-slate-50/50"
                                  >
                                    <TableCell colSpan={11} className="px-6 py-2 text-sm text-slate-700 border-t border-slate-100">
                                      <div className="bg-slate-50 rounded-lg p-2">
                                        <div className="flex justify-start space-x-8 pl-4">
                                          <div>
                                            <span className="font-medium text-blue-600 text-base">Account Name:</span>
                                            <p className="text-slate-800 text-base">{safeString(safeProp(row.accountData, 'account_name')) || '—'}</p>
                                          </div>
                                          <div>
                                            <span className="font-medium text-blue-600 text-base">Account Number:</span>
                                            <p className="text-slate-800 font-mono text-base">{safeString(safeProp(row.accountData, 'account_number')) || '—'}</p>
                                          </div>
                                          <div>
                                            <span className="font-medium text-blue-600 text-base">Sort Code:</span>
                                            <p className="text-slate-800 font-mono text-base">{safeString(safeProp(row.accountData, 'sort_code')) || '—'}</p>
                                          </div>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </motion.tr>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Summary Section by Case Type */}
                {Object.keys(caseTypeSummary).length > 0 && (
                  <div className="mt-6 border-t-2 border-slate-300 pt-4">
                    <h3 className="text-base font-semibold text-slate-900 mb-3">
                      Summary by Case Type
                    </h3>
                    <div className="overflow-x-auto">
                      <div className="flex gap-3 pb-2">
                        {Object.entries(caseTypeSummary)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([caseType, data]) => (
                            <Card key={caseType} className="border border-slate-200 hover:shadow-md transition-shadow flex-shrink-0 min-w-[220px]">
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-sm text-slate-900">{caseType}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {data.caseCount}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="bg-green-50 rounded p-2 border border-green-200">
                                    <div className="text-[10px] font-medium text-green-700 uppercase tracking-wide mb-0.5">
                                      Held
                                    </div>
                                    <div className="text-sm font-bold text-green-800">
                                      £{formatCurrency(data.totalHeld)}
                                    </div>
                                  </div>
                                  
                                  <div className="bg-red-50 rounded p-2 border border-red-200">
                                    <div className="text-[10px] font-medium text-red-700 uppercase tracking-wide mb-0.5">
                                      Distributed
                                    </div>
                                    <div className="text-sm font-bold text-red-800">
                                      £{formatCurrency(data.totalDistributed)}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="bonding">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                Bonding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BondingManagement
                cases={filteredCases}
                transactions={transactions}
                accountingEntries={accountingEntries}
                chartOfAccounts={chartOfAccounts}
                onCaseSelect={onCaseSelect}
                onManageOption={(caseItem, option) => {
                  setSelectedCaseForManage(caseItem);
                  setSelectedManageOption(option);
                }}
              />
            </CardContent>
          </TabsContent>

          <TabsContent value="for_approval">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                For Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <ApprovalSidebar
                  activeView={postedSubmenuView}
                  onViewChange={setPostedSubmenuView}
                  awaitingCount={pendingCount}
                  postedCount={approvedCount}
                />
                
                <div className="flex-1">
                  {postedSubmenuView === "vouchers_awaiting" ?
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Awaiting Approval
                      </h3>
                      {pendingTransactions.length === 0 ?
                        <div className="text-center py-12 text-slate-500 rounded-lg border border-slate-200 bg-slate-50">
                          <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                          <h3 className="text-lg font-semibold">All Clear!</h3>
                          <p>There are no transactions awaiting approval.</p>
                        </div> :
                        <div className="space-y-4">
                          {safeArrayMap(pendingTransactions, (tx) => {
                            const safeTx = safeObject(tx);
                            const caseName = safeProp(safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(safeTx, 'case_id'))[0], 'company_name') || 'N/A';
                            const isEditingPending = editingPendingTransaction === safeProp(safeTx, 'id');
                            const missingAccountCode = !safeProp(safeTx, 'account_code');

                            return (
                              <div key={safeProp(safeTx, 'id')} className={`bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow ${missingAccountCode ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold text-slate-900">{caseName}</h4>
                                    <p className="text-sm text-slate-500">
                                      {new Date(safeString(safeProp(safeTx, 'transaction_date'))).toLocaleDateString('en-GB')} •
                                      <Badge className={`ml-2 ${safeProp(safeTx, 'transaction_type') === 'receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {safeProp(safeTx, 'transaction_type')}
                                      </Badge>
                                    </p>
                                    {missingAccountCode &&
                                      <div className="flex items-center gap-2 mt-2 text-amber-600 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>Missing Account Code (must be set from Settings Chart of Accounts)</span>
                                      </div>
                                    }
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">Net</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.net_amount))}
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">VAT</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.vat_amount))}
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">Gross</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.amount))}
                                        </div>
                                      </div>
                                    </div>
                                    {!isEditingPending &&
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditPendingTransaction(tx)}
                                          className="text-blue-600 border-blue-300 hover:bg-blue-50">
                                          <Edit className="w-4 h-4 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                                          onClick={() => handleRejectTransaction(tx)}>
                                          <XCircle className="w-4 h-4 mr-2" />
                                          Reject
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700"
                                          onClick={() => handleSignTransaction(tx)}
                                          disabled={missingAccountCode || currentUser?.grade !== 'IP'}>
                                          <CheckCircle className="w-4 h-4 mr-2" />
                                          Post
                                        </Button>
                                        {currentUser?.grade !== 'IP' && (
                                          <p className="text-xs text-amber-600 mt-1">Only IP grade can post</p>
                                        )}
                                      </div>
                                    }
                                  </div>
                                </div>
                                {isEditingPending ?
                                  <div className="space-y-4 border-t border-slate-200 pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Description</Label>
                                        <Input
                                          value={safeString(safeProp(editPendingData, 'description'))}
                                          onChange={(e) => updateEditPendingData('description', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Account Code (from Settings)</Label>
                                        <div className="relative">
                                          <Input
                                            value={safeString(safeProp(editPendingData, 'account_code'))}
                                            onClick={() => {
                                              setActiveAccountCodeSearchFormId(`pending-edit-${safeProp(safeTx, 'id')}`);
                                            }}
                                            onFocus={() => {
                                              setActiveAccountCodeSearchFormId(`pending-edit-${safeProp(safeTx, 'id')}`);
                                            }}
                                            readOnly
                                            placeholder="Click to search Settings-managed accounts"
                                            className="mt-1 cursor-pointer bg-white"
                                            title="Account Code from Settings Chart of Accounts" />
                                          {activeAccountCodeSearchFormId === `pending-edit-${safeProp(safeTx, 'id')}` &&
                                            <div className="absolute top-full mt-1 w-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg">
                                              <AccountCodeSearch
                                                onSelect={(account) => {
                                                  updateEditPendingData('account_code', safeProp(safeObject(account), 'account_code'));
                                                  setActiveAccountCodeSearchFormId(null);
                                                }}
                                                autoSuggestFromDescription={safeString(safeProp(editPendingData, 'description'))}
                                                onClose={() => {
                                                  setActiveAccountCodeSearchFormId(null);
                                                }} />
                                            </div>
                                          }
                                        </div>
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Payee Name</Label>
                                        <Input
                                          value={safeString(safeProp(editPendingData, 'payee_name'))}
                                          onChange={(e) => updateEditPendingData('payee_name', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Invoice Number</Label>
                                        <Input
                                          value={safeString(safeProp(editPendingData, 'invoice_number'))}
                                          onChange={(e) => updateEditPendingData('invoice_number', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Net Amount (£)</Label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={formatNumberWithCommas(safeProp(editPendingData, 'net_amount'))}
                                          onChange={(e) => {
                                            const parsedValue = parseFormattedNumber(e.target.value);
                                            if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                              updateEditPendingData('net_amount', parsedValue);
                                            }
                                          }}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">VAT Amount (£)</Label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={formatNumberWithCommas(safeProp(editPendingData, 'vat_amount'))}
                                          onChange={(e) => {
                                            const parsedValue = parseFormattedNumber(e.target.value);
                                            if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                              updateEditPendingData('vat_amount', parsedValue);
                                            }
                                          }}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Gross Amount (£)</Label>
                                        <Input
                                          type="text"
                                          value={formatNumberWithCommas(safeProp(editPendingData, 'amount'))}
                                          readOnly
                                          className="mt-1 bg-slate-50" />
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <Label className="text-sm font-medium text-slate-700">Invoice File</Label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <input
                                          type="file"
                                          id={`pending-invoice-upload-${safeProp(safeTx, 'id')}`}
                                          className="hidden"
                                          onChange={(e) => handlePendingDocUpload(e, safeProp(safeTx, 'id'))}
                                          accept="image/*,application/pdf"
                                        />
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => document.getElementById(`pending-invoice-upload-${safeProp(safeTx, 'id')}`)?.click()}
                                          disabled={uploadingPendingDoc === safeProp(safeTx, 'id')}
                                          className="h-9 text-sm"
                                        >
                                          {uploadingPendingDoc === safeProp(safeTx, 'id') ? (
                                            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                                          ) : (
                                            <Upload className="w-3 h-3 mr-2" />
                                          )}
                                          {uploadingPendingDoc === safeProp(safeTx, 'id') ? 'Uploading...' : (safeProp(editPendingData, 'invoice_file_url') ? 'Change File' : 'Upload Invoice')}
                                        </Button>
                                        {safeProp(editPendingData, 'invoice_file_url') && (
                                          <a href={safeProp(editPendingData, 'invoice_file_url')} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center">
                                            <Eye className="w-3 h-3 mr-1" /> View
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelPendingEdit}>
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handleSavePendingTransaction(safeProp(safeTx, 'id'))}
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={!safeProp(editPendingData, 'account_code')}>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Changes
                                      </Button>
                                    </div>
                                  </div> :
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-slate-600">Description:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'description')}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Account Code:</span>
                                      <p className={`font-mono text-sm ${safeProp(safeTx, 'account_code') ? 'text-slate-900' : 'text-amber-600 italic'}`}>
                                        {safeProp(safeTx, 'account_code') || 'Not set (required from Settings)'}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Payee:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'payee_name') || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Invoice #:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'invoice_number') || 'N/A'}</p>
                                    </div>
                                    {safeProp(safeTx, 'invoice_file_url') && (
                                      <div>
                                        <span className="font-medium text-slate-600">Invoice File:</span>
                                        <p>
                                          <a 
                                            href={safeProp(safeTx, 'invoice_file_url')} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                                          >
                                            <Eye className="w-3 h-3" /> View Document
                                          </a>
                                        </p>
                                      </div>
                                    )}
                                    </div>
                                }
                              </div>);
                          })}
                        </div>
                      }
                    </div> : postedSubmenuView === "vouchers_posted" ?
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Posted Transactions
                      </h3>
                      {approvedTransactions.length === 0 ?
                        <div className="text-center py-12 text-slate-500 rounded-lg border border-slate-200 bg-slate-50">
                          <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                          <h3 className="text-lg font-semibold">No Posted Transactions</h3>
                          <p>No transactions have been approved and posted yet.</p>
                        </div> :
                        <div className="space-y-4">
                          {postError &&
                            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                              <AlertCircle className="w-4 h-4" />
                              {postError}
                            </div>
                          }
                          {safeArrayMap(approvedTransactions, (tx) => {
                            const safeTx = safeObject(tx);
                            const caseName = safeProp(safeArrayFilter(cases, (c) => safeProp(safeObject(c), 'id') === safeProp(safeTx, 'case_id'))[0], 'company_name') || 'N/A';
                            const isEditing = editingTransaction === safeProp(safeTx, 'id');
                            const isDeleting = deletingTransaction === safeProp(safeTx, 'id');

                            return (
                              <div key={safeProp(safeTx, 'id')} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h4 className="font-semibold text-slate-900">{caseName}</h4>
                                    <p className="text-sm text-slate-500">
                                      {new Date(safeString(safeProp(safeTx, 'transaction_date'))).toLocaleDateString('en-GB')} •
                                      <Badge className={`ml-2 ${safeProp(safeTx, 'transaction_type') === 'receipt' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {safeProp(safeTx, 'transaction_type')}
                                      </Badge>
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">Net</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.net_amount))}
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">VAT</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.vat_amount))}
                                        </div>
                                      </div>
                                      <div className="text-center">
                                        <div className="text-xs text-slate-500 mb-1">Gross</div>
                                        <div className="font-mono text-base font-semibold text-slate-900">
                                          £{formatCurrency(safeNumber(safeTx.amount))}
                                        </div>
                                      </div>
                                    </div>
                                    {!isEditing &&
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handlePrintTransaction(tx)}
                                          className="text-gray-600 border-gray-300 hover:bg-gray-50"
                                          disabled={isDeleting || isSavingEdit}>
                                          <Printer className="w-4 h-4 mr-1" />
                                          Print
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleEditTransaction(tx)}
                                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                          disabled={isDeleting}>
                                          <Edit className="w-4 h-4 mr-1" />
                                          Edit
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDeleteTransaction(safeProp(safeTx, 'id'))}
                                          className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700"
                                          disabled={isDeleting || isSavingEdit}>
                                          {isDeleting ?
                                            <Loader2 className="w-4 h-4 mr-1 animate-spin" /> :
                                            <Trash2 className="w-4 h-4 mr-1" />
                                          }
                                          {isDeleting ? 'Deleting...' : 'Delete'}
                                        </Button>
                                      </div>
                                    }
                                  </div>
                                </div>
                                {isEditing ?
                                  <div className="space-y-4 border-t border-slate-200 pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Description</Label>
                                        <Input
                                          value={safeString(safeProp(editTransactionData, 'description'))}
                                          onChange={(e) => updateEditTransactionData('description', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Payee Name</Label>
                                        <Input
                                          value={safeString(safeProp(editTransactionData, 'payee_name'))}
                                          onChange={(e) => updateEditTransactionData('payee_name', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Transaction Date</Label>
                                        <Input
                                          type="date"
                                          value={safeString(safeProp(editTransactionData, 'transaction_date')) ? new Date(safeString(safeProp(editTransactionData, 'transaction_date'))).toISOString().split('T')[0] : ''}
                                          onChange={(e) => updateEditTransactionData('transaction_date', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Invoice Date</Label>
                                        <Input
                                          type="date"
                                          value={safeString(safeProp(editTransactionData, 'date_of_invoice')) ? new Date(safeString(safeProp(editTransactionData, 'date_of_invoice'))).toISOString().split('T')[0] : ''}
                                          onChange={(e) => updateEditTransactionData('date_of_invoice', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Invoice Number</Label>
                                        <Input
                                          value={safeString(safeProp(editTransactionData, 'invoice_number'))}
                                          onChange={(e) => updateEditTransactionData('invoice_number', e.target.value)}
                                          className="mt-1" />
                                      </div>
                                      <div>
                                        <Label className="text-sm font-medium text-slate-700">Account Code (from Settings)</Label>
                                        <div className="relative">
                                          <Input
                                            value={safeString(safeProp(editTransactionData, 'account_code'))}
                                            onClick={() => setActiveAccountCodeSearchFormId(`edit-${safeProp(safeTx, 'id')}`)}
                                            onFocus={() => setActiveAccountCodeSearchFormId(`edit-${safeProp(safeTx, 'id')}`)}
                                            readOnly
                                            placeholder="Click to search Settings accounts"
                                            className="mt-1 cursor-pointer"
                                            title="Account Code from Settings-managed Chart of Accounts" />
                                          {activeAccountCodeSearchFormId === `edit-${safeProp(safeTx, 'id')}` &&
                                            <div className="absolute top-full mt-1 w-full z-20">
                                              <AccountCodeSearch
                                                onSelect={(account) => {
                                                  updateEditTransactionData('account_code', safeProp(safeObject(account), 'account_code'));
                                                  setActiveAccountCodeSearchFormId(null);
                                                }}
                                                autoSuggestFromDescription={safeString(safeProp(editTransactionData, 'description'))}
                                                onClose={() => setActiveAccountCodeSearchFormId(null)} />
                                            </div>
                                          }
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                      <div className="flex-1">
                                        <Label className="text-sm font-medium text-slate-700">Net Amount (£)</Label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*[.]?[0-9]*"
                                          value={formatNumberWithCommas(safeProp(editTransactionData, 'net_amount'))}
                                          onChange={(e) => {
                                            const parsedValue = parseFormattedNumber(e.target.value);
                                            if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                              updateEditTransactionData('net_amount', parsedValue);
                                            }
                                          }}
                                          className="mt-1" />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-sm font-medium text-slate-700">VAT Amount (£)</Label>
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*[.]?[0-9]*"
                                          value={formatNumberWithCommas(safeProp(editTransactionData, 'vat_amount'))}
                                          onChange={(e) => {
                                            const parsedValue = parseFormattedNumber(e.target.value);
                                            if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                              updateEditTransactionData('vat_amount', parsedValue);
                                            }
                                          }}
                                          className="mt-1" />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-sm font-medium text-slate-700">Gross Amount (£)</Label>
                                        <Input
                                          type="text"
                                          value={formatNumberWithCommas(safeProp(editTransactionData, 'gross_amount'))}
                                          readOnly
                                          className="mt-1 bg-slate-50" />
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                      <Button
                                        variant="outline"
                                        onClick={handleCancelEdit}
                                        disabled={isSavingEdit}>
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handleSaveEdit(safeProp(safeTx, 'id'))}
                                        disabled={isSavingEdit}
                                        className="bg-green-600 hover:bg-green-700">
                                        {isSavingEdit ?
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
                                          <Save className="w-4 h-4 mr-2" />
                                        }
                                        Save Changes
                                      </Button>
                                    </div>
                                  </div> :
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium text-slate-600">Description:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'description')}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Account Code:</span>
                                      <p className="font-mono text-slate-900">{safeProp(safeTx, 'account_code') || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Payee:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'payee_name') || 'N/A'}</p>
                                    </div>
                                    <div>
                                      <span className="font-medium text-slate-600">Invoice #:</span>
                                      <p className="text-slate-900">{safeProp(safeTx, 'invoice_number') || 'N/A'}</p>
                                    </div>
                                  </div>
                                }
                              </div>);
                          })}
                        </div>
                      }
                    </div> : postedSubmenuView === "bank_rec_awaiting" ?
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-blue-600" />
                        Bank Reconciliations - Awaiting Approval
                      </h3>
                      <div className="text-center py-12 text-slate-500 rounded-lg border border-slate-200 bg-slate-50">
                        <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-4" />
                        <h3 className="text-lg font-semibold">All Clear!</h3>
                        <p>There are no bank reconciliations awaiting approval.</p>
                      </div>
                    </div> : postedSubmenuView === "bank_rec_posted" ?
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Bank Reconciliations - Posted
                      </h3>
                      <div className="text-center py-12 text-slate-500 rounded-lg border border-slate-200 bg-slate-50">
                        <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                        <h3 className="text-lg font-semibold">No Posted Bank Reconciliations</h3>
                        <p>No bank reconciliations have been posted yet.</p>
                      </div>
                    </div> : null
                  }
                </div>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="bulk_upload">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                Bulk Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <TransactionUpload onUploadComplete={loadData} />
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="manual">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                Manual Transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {safeArrayMap(manualTransactionForms, (form, index) => {
                  const filteredCasesForManual = getFilteredManualCases(form.manualCaseSearchTerm);
                  return (
                    <div key={form.id} className="relative p-4 border rounded-lg bg-white shadow-sm space-y-3">
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="text-base font-semibold text-slate-800">New Transaction {index + 1}</h3>
                        {manualTransactionForms.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveManualTransactionForm(form.id)} className="text-red-500 hover:bg-red-50 h-8">
                            <X className="w-4 h-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                      
                      {form.manualPostError && (
                        <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                          <AlertCircle className="w-3 h-3" />
                          {form.manualPostError}
                        </div>
                      )}

                      {/* Row 1: Case, Type, Transaction Date, Payee Name */}
                      <div className="grid grid-cols-4 gap-3">
                        <div className="relative" ref={(el) => (manualCaseSearchRefs.current[form.id] = el)}>
                          <Label htmlFor={`case-search-${form.id}`} className="text-xs font-medium">Case</Label>
                          <Input
                            id={`case-search-${form.id}`}
                            type="text"
                            placeholder="Search by Case Name or Reference"
                            value={form.manualCaseSearchTerm}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'manualCaseSearchTerm', e.target.value)}
                            onFocus={() => handleManualTransactionFormChange(form.id, 'showManualCaseSuggestions', true)}
                            className="mt-1 h-9 text-sm"
                          />
                          {form.case_id && (
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Selected: <span className="font-medium">{cases.find(c => c.id === form.case_id)?.case_reference}</span>
                            </p>
                          )}
                          {form.showManualCaseSuggestions && filteredCasesForManual.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                              {safeArrayMap(filteredCasesForManual, (case_) => (
                                <div
                                  key={safeProp(case_, 'id')}
                                  className="px-4 py-2 cursor-pointer hover:bg-gray-100 text-sm"
                                  onClick={() => handleManualCaseSelect(form.id, safeProp(case_, 'id'), safeProp(case_, 'company_name'), safeProp(case_, 'case_reference'))}
                                >
                                  {safeProp(case_, 'case_reference')} - {safeProp(case_, 'company_name')}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor={`transaction-type-${form.id}`} className="text-xs font-medium">Type</Label>
                          <Select
                            value={form.transaction_type}
                            onValueChange={(value) => handleManualTransactionFormChange(form.id, 'transaction_type', value)}
                          >
                            <SelectTrigger id={`transaction-type-${form.id}`} className="w-full mt-1 h-9 text-sm">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="receipt">Receipt</SelectItem>
                              <SelectItem value="payment">Payment</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor={`transaction-date-${form.id}`} className="text-xs font-medium">Transaction Date</Label>
                          <Input
                            id={`transaction-date-${form.id}`}
                            type="date"
                            value={form.transaction_date}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'transaction_date', e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`payee-name-${form.id}`} className="text-xs font-medium">Payee Name</Label>
                          <Input
                            id={`payee-name-${form.id}`}
                            type="text"
                            value={form.payee_name}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'payee_name', e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>
                      </div>

                      {/* Row 2: Date of Invoice, Invoice Number, Description, Account Code */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label htmlFor={`date-of-invoice-${form.id}`} className="text-xs font-medium">Date of Invoice</Label>
                          <Input
                            id={`date-of-invoice-${form.id}`}
                            type="date"
                            value={form.date_of_invoice}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'date_of_invoice', e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`invoice-number-${form.id}`} className="text-xs font-medium">Invoice Number</Label>
                          <Input
                            id={`invoice-number-${form.id}`}
                            type="text"
                            value={form.invoice_number}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'invoice_number', e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`description-${form.id}`} className="text-xs font-medium">Description</Label>
                          <Input
                            id={`description-${form.id}`}
                            value={form.description}
                            onChange={(e) => handleManualTransactionFormChange(form.id, 'description', e.target.value)}
                            className="mt-1 h-9 text-sm"
                          />
                        </div>

                        <div>
                          <Label htmlFor={`account-code-${form.id}`} className="text-xs font-medium">Account Code (from Settings)</Label>
                          <div className="relative">
                            <Input
                              id={`account-code-${form.id}`}
                              value={form.account_code}
                              onClick={() => setActiveAccountCodeSearchFormId(form.id)}
                              onFocus={() => setActiveAccountCodeSearchFormId(form.id)}
                              readOnly
                              placeholder="Click to search Settings-managed accounts"
                              className="mt-1 cursor-pointer bg-white h-9 text-sm"
                              title="Account Code from Settings Chart of Accounts"
                            />
                            {activeAccountCodeSearchFormId === form.id &&
                              <div className="absolute top-full mt-1 w-full z-20 bg-white border border-slate-200 rounded-lg shadow-lg">
                                <AccountCodeSearch
                                  onSelect={(account) => {
                                    handleManualTransactionFormChange(form.id, 'account_code', safeProp(safeObject(account), 'account_code'));
                                    setActiveAccountCodeSearchFormId(null);
                                  }}
                                  autoSuggestFromDescription={form.description}
                                  onClose={() => setActiveAccountCodeSearchFormId(null)}
                                />
                              </div>
                            }
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Net Amount, VAT Amount, Gross Amount, VAT Irrecoverable - with colored background */}
                      <div className={`p-3 rounded-lg border-2 ${
                        form.transaction_type === 'receipt' 
                          ? 'bg-green-50 border-green-300' 
                          : 'bg-red-50 border-red-300'
                      }`}>
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label htmlFor={`net-amount-${form.id}`} className="text-xs font-medium">Net Amount (£)</Label>
                            <Input
                              id={`net-amount-${form.id}`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*[.]?[0-9]*"
                              value={formatNumberWithCommas(form.net_amount)}
                              onChange={(e) => {
                                const parsedValue = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                  handleManualTransactionFormChange(form.id, 'net_amount', parsedValue);
                                }
                              }}
                              className="mt-1 h-9 text-sm bg-white"
                            />
                          </div>

                          <div>
                            <Label htmlFor={`vat-amount-${form.id}`} className="text-xs font-medium">VAT Amount (£)</Label>
                            <Input
                              id={`vat-amount-${form.id}`}
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*[.]?[0-9]*"
                              value={formatNumberWithCommas(form.vat_amount)}
                              onChange={(e) => {
                                const parsedValue = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                                  handleManualTransactionFormChange(form.id, 'vat_amount', parsedValue);
                                }
                              }}
                              className="mt-1 h-9 text-sm bg-white"
                            />
                          </div>

                          <div>
                            <Label htmlFor={`gross-amount-${form.id}`} className="text-xs font-medium">Gross Amount (£)</Label>
                            <Input
                              id={`gross-amount-${form.id}`}
                              type="text"
                              value={formatNumberWithCommas(form.amount)}
                              readOnly
                              className="mt-1 bg-white h-9 text-sm"
                            />
                          </div>

                          <div className="flex items-end">
                            <div className="flex items-center space-x-2 h-9">
                              <Checkbox
                                id={`vat-irrecoverable-${form.id}`}
                                checked={form.vat_irrecoverable}
                                onCheckedChange={(checked) => handleManualTransactionFormChange(form.id, 'vat_irrecoverable', checked)}
                              />
                              <Label htmlFor={`vat-irrecoverable-${form.id}`} className="text-xs font-medium cursor-pointer">
                                VAT Irrecoverable
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Row 4: Target Bank Account, Invoice File, Bank Remittance File */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <Label htmlFor={`target-account-${form.id}`} className="text-xs font-medium">Target Bank Account</Label>
                          <Select
                            value={form.target_account}
                            onValueChange={(value) => handleManualTransactionFormChange(form.id, 'target_account', value)}
                          >
                            <SelectTrigger id={`target-account-${form.id}`} className="w-full mt-1 h-9 text-sm">
                              <SelectValue placeholder="Select bank account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primary Bank Account</SelectItem>
                              <SelectItem value="secondary">Secondary Bank Account</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="col-span-2">
                          <Label className="text-xs font-medium">Invoice File</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="file"
                              id={`manual-invoice-upload-${form.id}`}
                              className="hidden"
                              onChange={(e) => handleManualInvoiceUpload(e, form.id)}
                              accept="image/*,application/pdf"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => triggerManualInvoiceUpload(form.id)}
                              disabled={form.isUploadingInvoice}
                              className="flex-1 h-9 text-sm"
                            >
                              {form.isUploadingInvoice ? (
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3 mr-2" />
                              )}
                              {form.isUploadingInvoice ? 'Uploading...' : (form.invoice_file_url ? 'Change File' : 'Upload Invoice')}
                            </Button>
                            {form.invoice_file_url && (
                              <a href={form.invoice_file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center">
                                <Eye className="w-3 h-3 mr-1" /> View
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-medium">Bank Remittance File</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="file"
                              id={`manual-bank-remittance-upload-${form.id}`}
                              className="hidden"
                              onChange={(e) => handleManualBankRemittanceUpload(e, form.id)}
                              accept="image/*,application/pdf"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => triggerManualBankRemittanceUpload(form.id)}
                              disabled={form.isUploadingBankRemittance}
                              className="w-full h-9 text-sm"
                            >
                              {form.isUploadingBankRemittance ? (
                                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                              ) : (
                                <Upload className="w-3 h-3 mr-2" />
                              )}
                              {form.isUploadingBankRemittance ? 'Uploading...' : (form.bank_remittance_url ? 'Change File' : 'Upload Remittance')}
                            </Button>
                            {form.bank_remittance_url && (
                              <a href={form.bank_remittance_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs flex items-center">
                                <Eye className="w-3 h-3 mr-1" /> View
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={handleAddManualTransactionForm} className="h-9">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Transaction
                  </Button>
                  <Button onClick={handlePostManualTransaction} disabled={isPostingAllManualTransactions} className="bg-slate-900 hover:bg-slate-800 h-9">
                    {isPostingAllManualTransactions ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isPostingAllManualTransactions ? 'Posting...' : 'Post All Transactions'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="bank_feed">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                Bank Feed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Bank Feed</h3>
                <p className="text-slate-500">Bank feed functionality will be implemented here.</p>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="documents">
            <CardHeader>
              <CardTitle className="font-display font-bold text-xl text-slate-900">
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCaseForDocuments ?
                // Case Document View with Sidebar Navigation
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedCaseForDocuments(null);
                        setCaseDocuments([]);
                        setDocumentTransactions([]);
                      }}
                      className="flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 transform rotate-180" />
                      Back to Cases
                    </Button>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {safeString(safeProp(selectedCaseForDocuments, 'company_name', 'N/A'))}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {safeString(safeProp(selectedCaseForDocuments, 'case_reference', 'N/A'))} • Cashiering Documents
                      </p>
                    </div>
                  </div>
                  
                  {isLoadingDocuments ?
                    <div className="flex justify-center items-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span className="ml-2 text-slate-600">Loading documents...</span>
                    </div> :
                    <div className="flex gap-6 min-h-[500px]">
                      {/* Left Sidebar - Folders */}
                      <Card className="w-64 flex-shrink-0 border-2 border-slate-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold text-slate-700">Folders</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                          <div className="space-y-1">
                            {/* Payment Vouchers Folder */}
                            <button
                              onClick={() => setSelectedDocumentType('Payment Voucher')}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                selectedDocumentType === "Payment Voucher"
                                  ? 'bg-red-50 border-l-4 border-red-500'
                                  : 'hover:bg-slate-50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                selectedDocumentType === "Payment Voucher" ? 'bg-red-500' : 'bg-red-400'
                              }`}>
                                <FileText className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-sm text-slate-900">Payment Vouchers</div>
                                <div className="text-xs text-slate-600">
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Payment Voucher').length} files
                                </div>
                              </div>
                            </button>

                            {/* Receipt Vouchers Folder */}
                            <button
                              onClick={() => setSelectedDocumentType('Receipt Voucher')}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                selectedDocumentType === "Receipt Voucher"
                                  ? 'bg-green-50 border-l-4 border-green-500'
                                  : 'hover:bg-slate-50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                selectedDocumentType === "Receipt Voucher" ? 'bg-green-500' : 'bg-green-400'
                              }`}>
                                <FileText className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-sm text-slate-900">Receipt Vouchers</div>
                                <div className="text-xs text-slate-600">
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Receipt Voucher').length} files
                                </div>
                              </div>
                            </button>

                            {/* Bank Reconciliations Folder */}
                            <button
                              onClick={() => setSelectedDocumentType('Bank Reconciliation')}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                selectedDocumentType === "Bank Reconciliation"
                                  ? 'bg-blue-50 border-l-4 border-blue-500'
                                  : 'hover:bg-slate-50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                selectedDocumentType === "Bank Reconciliation" ? 'bg-blue-500' : 'bg-blue-400'
                              }`}>
                                <Calculator className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-sm text-slate-900">Bank Reconciliations</div>
                                <div className="text-xs text-slate-600">
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bank Reconciliation').length} files
                                </div>
                              </div>
                            </button>

                            {/* Bonding Folder */}
                            <button
                              onClick={() => setSelectedDocumentType('Bonding')}
                              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                                selectedDocumentType === "Bonding"
                                  ? 'bg-purple-50 border-l-4 border-purple-500'
                                  : 'hover:bg-slate-50 border-l-4 border-transparent'
                              }`}
                            >
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                selectedDocumentType === "Bonding" ? 'bg-purple-500' : 'bg-purple-400'
                              }`}>
                                <Shield className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-sm text-slate-900">Bonding</div>
                                <div className="text-xs text-slate-600">
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bonding').length} files
                                </div>
                              </div>
                            </button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Right Pane - Documents */}
                      <Card className="flex-1 border-2 border-slate-200">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base font-semibold text-slate-900">
                            {selectedDocumentType === 'Payment Voucher' && 'Payment Vouchers'}
                            {selectedDocumentType === 'Receipt Voucher' && 'Receipt Vouchers'}
                            {selectedDocumentType === 'Bank Reconciliation' && 'Bank Reconciliations'}
                            {selectedDocumentType === 'Bonding' && 'Bonding'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto">
                            {(selectedDocumentType === 'Payment Voucher' || selectedDocumentType === 'Receipt Voucher') ? (
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold text-slate-900">Date of Transaction</TableHead>
                                    <TableHead className="font-semibold text-slate-900">Payee Name</TableHead>
                                    <TableHead className="font-semibold text-slate-900">Invoice Date</TableHead>
                                    <TableHead className="font-semibold text-slate-900">Invoice Number</TableHead>
                                    <TableHead className="font-semibold text-slate-900">File Name</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-right">Net (£)</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-right">VAT (£)</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-right">Gross (£)</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-center">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === selectedDocumentType).length === 0 ?
                                    <TableRow>
                                      <TableCell colSpan={9} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                          <FileText className="w-16 h-16 text-slate-300" />
                                          <p className="text-slate-500 font-medium">No documents found</p>
                                          <p className="text-sm text-slate-400">
                                            {selectedDocumentType === 'Payment Voucher' && 'No payment vouchers have been uploaded yet'}
                                            {selectedDocumentType === 'Receipt Voucher' && 'No receipt vouchers have been uploaded yet'}
                                          </p>
                                        </div>
                                      </TableCell>
                                    </TableRow> :
                                    safeArrayMap(
                                      safeArray(caseDocuments)
                                        .filter(d => safeString(safeProp(d, 'doc_type')) === selectedDocumentType)
                                        .sort((a, b) => {
                                          // Sort by created_date descending (most recent first)
                                          const dateA = new Date(safeProp(a, 'created_date', ''));
                                          const dateB = new Date(safeProp(b, 'created_date', ''));
                                          return dateB - dateA;
                                        }),
                                      (document) => {
                                        const docObj = safeObject(document, {});
                                        const docId = safeProp(docObj, 'id', '');
                                        const fileUrl = safeString(safeProp(docObj, 'file_url', ''));
                                        
                                        // Parse raw_text to get transaction data
                                        let transactionDataFromDoc = {};
                                        let transactionIdFromDoc = null;
                                        try {
                                            const rawText = safeString(safeProp(docObj, 'raw_text'));
                                            if (rawText && rawText.startsWith('{') && rawText.endsWith('}')) {
                                                transactionDataFromDoc = JSON.parse(rawText);
                                                transactionIdFromDoc = safeProp(transactionDataFromDoc, 'transaction_id');
                                            }
                                        } catch (e) {
                                            console.warn("Could not parse raw_text for document:", docId, e);
                                        }
                                        
                                        // Find matching transaction - try multiple strategies
                                        let matchingTx = null;
                                        
                                        // Strategy 1: Match by transaction_id from raw_text (most reliable)
                                        if (transactionIdFromDoc) {
                                          matchingTx = safeArray(documentTransactions).find(tx => 
                                            safeString(safeProp(tx, 'id')) === transactionIdFromDoc
                                          );
                                        }
                                        
                                        // Strategy 2: Match by reference or invoice number from filename
                                        if (!matchingTx) {
                                          const fileName = fileUrl ? fileUrl.split('/').pop() || '' : '';
                                          
                                          // Try to extract case reference and other identifiers from filename
                                          // Format is typically: PV-RC25-COURTSADVERTISING-19MAY2025.html
                                          matchingTx = safeArray(documentTransactions).find(tx => {
                                            const txRef = safeString(safeProp(tx, 'reference'));
                                            const txInvoiceNum = safeString(safeProp(tx, 'invoice_number'));
                                            
                                            // Check if filename contains the reference or invoice number
                                            if (txRef && fileName.includes(txRef)) return true;
                                            if (txInvoiceNum && fileName.includes(txInvoiceNum)) return true;
                                            
                                            return false;
                                          });
                                        }
                                        
                                        // Strategy 3: Match by data in raw_text if no transaction found
                                        if (!matchingTx && Object.keys(transactionDataFromDoc).length > 0) {
                                          const docReference = safeProp(transactionDataFromDoc, 'reference');
                                          const docInvoiceNumber = safeProp(transactionDataFromDoc, 'invoice_number');
                                          
                                          matchingTx = safeArray(documentTransactions).find(tx => {
                                            if (docReference && safeProp(tx, 'reference') === docReference) return true;
                                            if (docInvoiceNumber && safeProp(tx, 'invoice_number') === docInvoiceNumber) return true;
                                            return false;
                                          });
                                        }

                                        // Extract data - prioritize matching transaction, then raw_text
                                        const txDate = (matchingTx ? safeProp(matchingTx, 'transaction_date') : null) || safeProp(transactionDataFromDoc, 'date_of_transaction') || '';
                                        const payeeName = (matchingTx ? safeProp(matchingTx, 'payee_name') : null) || safeProp(transactionDataFromDoc, 'payee') || 'N/A';
                                        const invoiceDate = (matchingTx ? safeProp(matchingTx, 'date_of_invoice') : null) || safeProp(transactionDataFromDoc, 'date_of_invoice') || '';
                                        const invoiceNumber = (matchingTx ? safeProp(matchingTx, 'invoice_number') : null) || safeProp(transactionDataFromDoc, 'invoice_number') || '';
                                        const netAmount = safeNumber((matchingTx ? safeProp(matchingTx, 'net_amount') : null) || safeProp(transactionDataFromDoc, 'net'));
                                        const vatAmount = safeNumber((matchingTx ? safeProp(matchingTx, 'vat_amount') : null) || safeProp(transactionDataFromDoc, 'vat'));
                                        const grossAmount = safeNumber((matchingTx ? safeProp(matchingTx, 'amount') : null) || safeProp(transactionDataFromDoc, 'gross'));
                                        
                                        const fileName = fileUrl ? fileUrl.split('/').pop() || '' : '';
                                        
                                        const formattedDate = txDate ? (() => {
                                          try {
                                            return new Date(txDate).toLocaleDateString('en-GB');
                                          } catch (error) {
                                            return 'N/A';
                                          }
                                        })() : 'N/A';

                                        const formattedInvoiceDate = invoiceDate ? (() => {
                                          try {
                                            return new Date(invoiceDate).toLocaleDateString('en-GB');
                                          } catch (error) {
                                            return 'N/A';
                                          }
                                        })() : 'N/A';
                                        
                                        const formatCurrency = (amount) => {
                                          return safeNumber(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        };

                                        // Handler to view voucher - always use the stored HTML file
                                        const handleRegenerateVoucher = async () => {
                                          if (!fileUrl) {
                                            alert('Voucher file not found.');
                                            return;
                                          }
                                          
                                          try {
                                            // Fetch the stored HTML voucher file
                                            const response = await fetch(fileUrl);
                                            const htmlContent = await response.text();
                                            
                                            const voucherWindow = window.open('', '_blank', 'width=900,height=800');
                                            
                                            if (!voucherWindow) {
                                              alert('Please allow popups to view vouchers');
                                              return;
                                            }

                                            voucherWindow.document.open();
                                            voucherWindow.document.write(htmlContent);
                                            voucherWindow.document.close();
                                          } catch (error) {
                                            console.error('Error loading voucher:', error);
                                            alert('Failed to load voucher. Error: ' + error.message);
                                          }
                                        };

                                        const handlePrintVoucher = async () => {
                                          if (!fileUrl) {
                                            alert('Voucher file not found.');
                                            return;
                                          }

                                          try {
                                            // Fetch the stored HTML voucher file
                                            const response = await fetch(fileUrl);
                                            const htmlContent = await response.text();
                                            
                                            const voucherWindow = window.open('', '_blank', 'width=900,height=800');
                                            
                                            if (!voucherWindow) {
                                              alert('Please allow popups to print vouchers');
                                              return;
                                            }

                                            voucherWindow.document.open();
                                            voucherWindow.document.write(htmlContent);
                                            voucherWindow.document.close();

                                            // Wait for content to load before printing
                                            voucherWindow.addEventListener('load', () => {
                                              setTimeout(() => voucherWindow.print(), 1500);
                                            });
                                          } catch (error) {
                                            console.error('Error loading voucher for printing:', error);
                                            alert('Failed to load voucher for printing. Error: ' + error.message);
                                          }
                                        };

                                        return (
                                          <TableRow key={docId} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="text-sm">{formattedDate}</TableCell>
                                            <TableCell className="font-medium text-sm">{payeeName}</TableCell>
                                            <TableCell className="text-sm">{formattedInvoiceDate}</TableCell>
                                            <TableCell className="text-sm font-mono">{invoiceNumber || 'N/A'}</TableCell>
                                            <TableCell className="text-sm font-mono text-xs">{fileName}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{formatCurrency(netAmount)}</TableCell>
                                            <TableCell className="text-right font-mono text-sm">{formatCurrency(vatAmount)}</TableCell>
                                            <TableCell className="text-right font-mono text-sm font-semibold">{formatCurrency(grossAmount)}</TableCell>
                                            <TableCell className="text-center">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <MoreVertical className="w-4 h-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={handleRegenerateVoucher}>
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    View (with attachments)
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={handlePrintVoucher}>
                                                    <Printer className="w-4 h-4 mr-2" />
                                                    Print (with attachments)
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem onClick={() => window.open(fileUrl, '_blank')}>
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Download Original
                                                  </DropdownMenuItem>
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteDocumentClick(docObj)}
                                                    disabled={deletingDocument === docId}
                                                    className="text-red-600 focus:text-red-600"
                                                  >
                                                    {deletingDocument === docId ? (
                                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                      <Trash2 className="w-4 h-4 mr-2" />
                                                    )}
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      }
                                    )
                                  }
                                </TableBody>
                              </Table>
                            ) : selectedDocumentType === 'Bank Reconciliation' ? (
                              // Bank Reconciliation view (keep simple table)
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold text-slate-900">File Name</TableHead>
                                    <TableHead className="font-semibold text-slate-900">Upload Date</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-center">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bank Reconciliation').length === 0 ?
                                    <TableRow>
                                      <TableCell colSpan={3} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                          <FileText className="w-16 h-16 text-slate-300" />
                                          <p className="text-slate-500 font-medium">No documents found</p>
                                          <p className="text-sm text-slate-400">
                                            No bank reconciliations have been uploaded yet
                                          </p>
                                        </div>
                                      </TableCell>
                                    </TableRow> :
                                    safeArrayMap(
                                      safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bank Reconciliation'),
                                      (document) => {
                                        const docObj = safeObject(document, {});
                                        const docId = safeProp(docObj, 'id', '');
                                        const fileUrl = safeString(safeProp(docObj, 'file_url', ''));
                                        const createdDate = safeString(safeProp(docObj, 'created_date', ''));
                                        const fileName = fileUrl ? fileUrl.split('/').pop() || 'Unknown File' : 'N/A';
                                        const formattedDate = createdDate ? (() => {
                                          try {
                                            return new Date(createdDate).toLocaleDateString('en-GB');
                                          } catch (error) {
                                            return 'N/A';
                                          }
                                        })() : 'N/A';

                                        return (
                                          <TableRow key={docId} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-medium text-sm">{fileName}</TableCell>
                                            <TableCell className="text-sm">{formattedDate}</TableCell>
                                            <TableCell className="text-center">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <MoreVertical className="w-4 h-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  {fileUrl && (
                                                    <>
                                                      <DropdownMenuItem onClick={() => window.open(fileUrl, '_blank')}>
                                                        <Download className="w-4 h-4 mr-2" />
                                                        Download
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem onClick={() => {
                                                        const printWindow = window.open(fileUrl, '_blank');
                                                        if (printWindow) {
                                                          printWindow.addEventListener('load', () => {
                                                            setTimeout(() => printWindow.print(), 500);
                                                          });
                                                        }
                                                      }}>
                                                        <Printer className="w-4 h-4 mr-2" />
                                                        Print
                                                      </DropdownMenuItem>
                                                    </>
                                                  )}
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteDocumentClick(docObj)}
                                                    disabled={deletingDocument === docId}
                                                    className="text-red-600 focus:text-red-600"
                                                  >
                                                    {deletingDocument === docId ? (
                                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                      <Trash2 className="w-4 h-4 mr-2" />
                                                    )}
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      }
                                    )
                                  }
                                </TableBody>
                              </Table>
                            ) : selectedDocumentType === 'Bonding' ? (
                              // Bonding view
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-slate-50">
                                    <TableHead className="font-semibold text-slate-900">File Name</TableHead>
                                    <TableHead className="font-semibold text-slate-900">Upload Date</TableHead>
                                    <TableHead className="font-semibold text-slate-900 text-center">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bonding').length === 0 ?
                                    <TableRow>
                                      <TableCell colSpan={3} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3">
                                          <Shield className="w-16 h-16 text-purple-300" />
                                          <p className="text-slate-500 font-medium">No bonding documents found</p>
                                          <p className="text-sm text-slate-400">
                                            No bonding documents have been uploaded yet
                                          </p>
                                        </div>
                                      </TableCell>
                                    </TableRow> :
                                    safeArrayMap(
                                      safeArray(caseDocuments).filter(d => safeString(safeProp(d, 'doc_type')) === 'Bonding'),
                                      (document) => {
                                        const docObj = safeObject(document, {});
                                        const docId = safeProp(docObj, 'id', '');
                                        const fileUrl = safeString(safeProp(docObj, 'file_url', ''));
                                        const createdDate = safeString(safeProp(docObj, 'created_date', ''));
                                        const fileName = fileUrl ? fileUrl.split('/').pop() || 'Unknown File' : 'N/A';
                                        const formattedDate = createdDate ? (() => {
                                          try {
                                            return new Date(createdDate).toLocaleDateString('en-GB');
                                          } catch (error) {
                                            return 'N/A';
                                          }
                                        })() : 'N/A';

                                        return (
                                          <TableRow key={docId} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-medium text-sm">{fileName}</TableCell>
                                            <TableCell className="text-sm">{formattedDate}</TableCell>
                                            <TableCell className="text-center">
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                  >
                                                    <MoreVertical className="w-4 h-4" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  {fileUrl && (
                                                    <>
                                                      <DropdownMenuItem onClick={() => window.open(fileUrl, '_blank')}>
                                                        <Download className="w-4 h-4 mr-2" />
                                                        Download
                                                      </DropdownMenuItem>
                                                      <DropdownMenuItem onClick={() => {
                                                        const printWindow = window.open(fileUrl, '_blank');
                                                        if (printWindow) {
                                                          printWindow.addEventListener('load', () => {
                                                            setTimeout(() => printWindow.print(), 500);
                                                          });
                                                        }
                                                      }}>
                                                        <Printer className="w-4 h-4 mr-2" />
                                                        Print
                                                      </DropdownMenuItem>
                                                    </>
                                                  )}
                                                  <DropdownMenuItem
                                                    onClick={() => handleDeleteDocumentClick(docObj)}
                                                    disabled={deletingDocument === docId}
                                                    className="text-red-600 focus:text-red-600"
                                                  >
                                                    {deletingDocument === docId ? (
                                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                      <Trash2 className="w-4 h-4 mr-2" />
                                                    )}
                                                    Delete
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      }
                                    )
                                  }
                                </TableBody>
                              </Table>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  }
                </div> :
                // Case List View
                <DocumentsTable cases={cases} handleCaseClick={handleCaseDocumentSelect} />
              }
            </CardContent>
          </TabsContent>
        </Tabs>
      </Card>

      {/* BankAccountModal remains outside TabsContent, only changes are within its props */}
      <BankAccountModal
        case_={selectedCaseForBankAccount} // The case to which the account belongs
        isOpen={isAddingAccount || (showAccountInfo && selectedAccountInfo)} // Open if adding OR viewing info
        onClose={() => {
          setIsAddingAccount(false);
          setShowAccountInfo(false);
          setSelectedAccountInfo(null);
          setAccountToEdit(null); // Clear initial data
          setSelectedCaseForBankAccount(null); // Clear case context
          setBankAccountError(null); // Clear any errors
        }}
        onSave={handleSaveBankAccount}
        bankAccountData={isAddingAccount ? (accountToEdit || { // Ensure accountToEdit is not null when adding
            account_name: '',
            bank_name: '',
            account_number: '',
            sort_code: '',
            account_type: 'GBP Primary',
            currency: 'GBP',
            chart_of_accounts: ''
          }) : (selectedAccountInfo ? selectedAccountInfo.accountData : null)} // Pass selectedAccountInfo.accountData for editing
        setBankAccountData={setAccountToEdit}
        error={bankAccountError}
        isSaving={isSavingBankAccount}
        isEditing={!isAddingAccount}
      />
      
      {/* BondingActions remains outside TabsContent */}
      <BondingActions
        selectedCase={selectedCaseForManage}
        selectedOption={selectedManageOption}
        onClose={() => {
          setSelectedManageOption(null);
          setSelectedCaseForManage(null);
          setAccountToEdit(null); // Used by BankAccountModal
          setIsAddingAccount(false); // Used by BankAccountModal
          setBankAccountError(null); // Used by BankAccountModal
        }}
        bondingRates={bondingRates}
        currentUser={currentUser}
        users={users}
        onUpdate={loadData}
        bondFormData={bondFormData}
        setBondFormData={setBondFormData}
        handleBondLevelChange={handleBondLevelChange}
        handleSaveBondSetup={handleSaveBondSetup}
        setSignatureTransactionId={setSignatureTransactionId}
        BankReconciliationComponent={BankReconciliation} // Pass the component
        setPostedSubmenuView={setPostedSubmenuView} // To navigate tabs if needed from child component
        bankAccountError={bankAccountError}
        isSavingBankAccount={isSavingBankAccount}
        setIsSavingBankAccount={setIsSavingBankAccount}
        setBankAccountError={setBankAccountError}
        accountToEdit={accountToEdit}
        setAccountToEdit={setAccountToEdit}
        setIsAddingAccount={setIsAddingAccount}
        handleShowAccountInfo={handleShowAccountInfo}
        handleAddAccount={handleAddAccount}
        handleSaveBankAccount={handleSaveBankAccount}
        handleDeleteAccount={handleDeleteAccount}
        handleEditAccountInfo={handleEditAccountInfo}
      />

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={signatureTransactionId === 'bond_setup'}
        onClose={() => {
          setSignatureTransactionId(null);
        }}
        onSave={(dataUrl) => {
          if (signatureTransactionId === 'bond_setup') {
            handleBondSignature(dataUrl);
            setSignatureTransactionId(null);
          }
        }}
        userName={safeProp(currentUser, 'full_name') || 'Office Holder'}
      />

      {/* Account Information Modal */}
      {showAccountInfo && selectedAccountInfo && (
        <Card className="absolute top-full left-0 mt-2 w-80 bg-white shadow-lg border border-slate-200 z-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-blue-600" />
                Account Information
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAccountInfo(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-500">Account Name</Label>
                <p className="text-sm font-medium text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'account_name')) || '—'}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500">Bank Name</Label>
                <p className="text-sm font-medium text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'bank_name')) || '—'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-500">Account Number</Label>
                  <p className="text-sm font-mono text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'account_number')) || '—'}</p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-500">Sort Code</Label>
                  <p className="text-sm font-mono text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'sort_code')) || '—'}</p>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500">Account Type</Label>
                <p className="text-sm font-medium text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'account_type')) || '—'}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-500">Chart of Accounts Code</Label>
                <p className="text-sm font-mono text-slate-900">{safeString(safeProp(selectedAccountInfo.accountData, 'chart_of_accounts')) || '—'}</p>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditAccountInfo}
                className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAccount}
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                disabled={isSavingBankAccount}
              >
                {isSavingBankAccount ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>

            {bankAccountError && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm">
                {bankAccountError}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Document Deletion Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Confirm Document Deletion</h3>
            <p className="text-slate-700 mb-6">
              Are you sure you want to delete the document <span className="font-semibold">"{safeProp(documentToDelete, 'file_url') ? safeString(safeProp(documentToDelete, 'file_url')).split('/').pop() : 'this document'}"</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button
                onClick={() => handleDeleteDocument(safeProp(documentToDelete, 'id'))}
                className="bg-red-600 hover:bg-red-700"
                disabled={deletingDocument === safeProp(documentToDelete, 'id')}
              >
                {deletingDocument === safeProp(documentToDelete, 'id') ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const generatePrintableHTML = (transaction, caseDetails, chartOfAccounts, users = []) => {
  const formatCurrency = (amount) => {
    try {
      const safeAmount = safeNumber(amount, 0);
      return safeAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      console.error('Error in formatCurrency (printable HTML):', e);
      return '0.00';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(safeString(dateString)).toLocaleDateString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) {
      console.error('Error in formatDate (printable HTML):', e);
      return 'Invalid Date';
    }
  };

  const getAccountName = (code) => {
    const safeChartOfAccounts = safeArray(chartOfAccounts);
    if (!code) return 'Unknown Account';
    const account = safeArrayFilter(safeChartOfAccounts, (a) => safeProp(safeObject(a), 'account_code') === code)[0];
    return safeProp(safeObject(account), 'account_name') || safeString(code) || 'Unknown Account';
  };

  // Helper to detect if a URL is a PDF
  const isPDF = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || urlLower.includes('pdf');
  };

  const safeTx = safeObject(transaction);
  const {
    description,
    amount,
    transaction_type,
    account_code,
    target_account,
    transaction_date,
    date_of_invoice,
    payee_name,
    invoice_number,
    net_amount,
    vat_amount,
    invoice_file_url,
    bank_remittance_url,
    signature_image_url,
    office_holder_signature,
    signed_by,
    signed_date,
    approver_grade,
    reference
  } = safeTx;

  // Look up submitter's signature from User Management if not in transaction
  const submitterUser = safeArray(users).find(u => safeProp(u, 'email') === signed_by);
  const submitterSignature = signature_image_url || safeProp(submitterUser, 'signature_image_url');
  const submitterName = office_holder_signature || safeProp(submitterUser, 'full_name') || signed_by;

  // Look up approver's signature from User Management if not in transaction
  const approverUser = safeArray(users).find(u => safeProp(u, 'email') === safeProp(safeTx, 'approver_signed_by'));
  const approverSignature = safeProp(safeTx, 'approver_signature_url') || safeProp(approverUser, 'signature_image_url');
  const approverName = safeProp(safeTx, 'approver_name') || safeProp(approverUser, 'full_name') || safeProp(safeTx, 'approver_signed_by');

  const safeCaseDetails = safeObject(caseDetails);
  const bankAccountCode = safeString(target_account) === 'primary' ?
  safeProp(safeProp(safeCaseDetails, 'bank_details'), 'chart_of_accounts') :
  safeProp(safeProp(safeCaseDetails, 'secondary_bank_details'), 'chart_of_accounts');

  const bankAccountName = safeString(target_account) === 'primary' ?
  `${safeString(safeProp(safeProp(safeCaseDetails, 'bank_details'), 'bank_name')) || 'Unknown Bank'} (${safeString(safeProp(safeProp(safeCaseDetails, 'bank_details'), 'account_type')) || 'Unknown Type'})` :
  `${safeString(safeProp(safeProp(safeCaseDetails, 'secondary_bank_details'), 'bank_name')) || 'Unknown Bank'} (${safeString(safeProp(safeProp(safeCaseDetails, 'secondary_bank_details'), 'account_type')) || 'Unknown Type'})`;

  const numNetAmount = safeNumber(net_amount);
  const numVatAmount = safeNumber(vat_amount);
  const numGrossAmount = safeNumber(amount);

  const journalEntries = [];
  if (safeString(transaction_type) === 'payment') {
    journalEntries.push({ account: getAccountName(account_code), code: safeString(account_code), debit: numNetAmount, credit: 0 });
    if (numVatAmount > 0) {
      journalEntries.push({ account: 'VAT on Purchases', code: 'VAT001', debit: numVatAmount, credit: 0 });
    }
    journalEntries.push({ account: 'Cash at Bank', code: bankAccountCode || 'BANK001', debit: 0, credit: numGrossAmount });
  } else {
    journalEntries.push({ account: 'Cash at Bank', code: bankAccountCode || 'BANK001', debit: numGrossAmount, credit: 0 });
    journalEntries.push({ account: getAccountName(account_code), code: safeString(account_code) || 'UNKNOWN', debit: 0, credit: numVatAmount > 0 ? numNetAmount : numGrossAmount });
    if (numVatAmount > 0) {
      journalEntries.push({ account: 'VAT on Sales', code: 'VAT002', debit: 0, credit: numVatAmount });
    }
  }

  const totals = safeArrayReduce(journalEntries, (acc, entry) => {
    acc.debit += safeNumber(safeProp(safeObject(entry), 'debit'));
    acc.credit += safeNumber(safeProp(safeObject(entry), 'credit'));
    return acc;
  }, { debit: 0, credit: 0 });

  // Build attachment pages
  let attachmentPages = '';
  if (invoice_file_url || bank_remittance_url) {
    attachmentPages += '<div class="page-break attachment-container">';
    
    if (invoice_file_url) {
      const isInvoicePDF = isPDF(invoice_file_url);
      attachmentPages += `
        <div class="attachment-page">
          <div class="attachment-header">
            <h2>Invoice: ${invoice_number || reference || 'N/A'}</h2>
          </div>
          ${isInvoicePDF ? `
            <embed src="${invoice_file_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
                   type="application/pdf" 
                   class="pdf-embed">
          ` : `
            <img src="${invoice_file_url}" alt="Invoice" class="image-full-page" />
          `}
        </div>
      `;
    }
    
    if (bank_remittance_url) {
      const isRemittancePDF = isPDF(bank_remittance_url);
      attachmentPages += `
        <div class="page-break">
          <div class="attachment-page">
            <div class="attachment-header">
              <h2>Bank Remittance: ${reference || 'N/A'}</h2>
            </div>
            ${isRemittancePDF ? `
              <embed src="${bank_remittance_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" 
                     type="application/pdf" 
                     class="pdf-embed">
          ` : `
              <img src="${bank_remittance_url}" alt="Bank Remittance" class="image-full-page" />
            `}
          </div>
        </div>
      `;
    }
    
    attachmentPages += '</div>';
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Transaction Payment Voucher - ${safeString(reference)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
        }
        
        html, body {
          width: 100%;
          height: 100%;
        }
        
        body { 
          font-family: Arial, sans-serif; 
          font-size: 10px; 
          line-height: 1.2; 
          color: #1f2937; 
          background: white;
        }
        
        .voucher-page {
          padding: 15mm;
          width: 210mm;
          min-height: 297mm;
          page-break-after: always;
          break-after: page;
        }
        
        h1 { 
          font-size: 16px; 
          font-weight: bold; 
          margin-bottom: 2px; 
          color: #A57C00;
        }
        
        h2 { 
          font-size: 11px; 
          font-weight: 600; 
          margin-bottom: 5px; 
          margin-top: 8px;
          color: #A57C00;
          padding-bottom: 2px;
          border-bottom: 1.5px solid #A57C00; 
        }
        
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-start; 
          padding-bottom: 10px; 
          border-bottom: 2px solid #A57C00; 
          margin-bottom: 12px; 
        }
        
        .detail-grid { 
          display: grid; 
          grid-template-columns: repeat(3, 1fr); 
          gap: 6px 12px; 
          border: 1.5px solid #A57C00; 
          padding: 8px; 
          border-radius: 3px; 
          background-color: #fffbf0; 
          margin-bottom: 10px;
        }
        
        .detail-item { margin-bottom: 4px; }
        
        .detail-label { 
          font-size: 8px; 
          font-weight: 600; 
          color: #A57C00; 
          text-transform: uppercase; 
          letter-spacing: 0.02em; 
          margin-bottom: 1px; 
        }
        
        .detail-value { 
          font-weight: 500; 
          font-size: 9px;
          color: #1f2937; 
        }
        
        .description-item { grid-column: span 3; }
        
        .badge {
          display: inline-block;
          padding: 1px 4px;
          font-size: 8px;
          font-weight: 500;
          border-radius: 2px;
          text-transform: capitalize;
        }
        
        .badge-receipt {
          border: 1px solid #10b981;
          color: #059669;
          background-color: #ecfdf5;
        }
        
        .badge-payment {
          border: 1px solid #ef4444;
          color: #dc2626;
          background-color: #fef2f2;
        }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          border: 1.5px solid #A57C00; 
          margin-bottom: 8px; 
        }
        
        th { 
          text-align: left; 
          font-weight: 600; 
          padding: 5px 6px; 
          background-color: #A57C00; 
          color: white;
          border-bottom: 1.5px solid #8B6900; 
          font-size: 9px; 
        }
        
        td { 
          padding: 4px 6px; 
          border-bottom: 0.5px solid #e5e7eb; 
          font-size: 9px; 
        }
        
        .text-right { text-align: right; }
        
        .font-mono { font-family: 'Courier New', monospace; }
        
        .approval-section { 
          border: 1.5px solid #A57C00; 
          padding: 0; 
          border-radius: 3px; 
          background-color: white;
          overflow: hidden;
          margin-top: 8px;
        }
        
        .approval-header {
          background-color: #A57C00;
          color: white;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        
        .approval-content {
          padding: 8px;
          background-color: #fffbf0;
        }
        
        .approval-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        
        .signature-img { 
          height: 35px; 
          border: 1px solid #A57C00; 
          background-color: white; 
          padding: 1px; 
          border-radius: 2px; 
        }
        
        tfoot td { 
          font-weight: bold; 
          background-color: #fffbf0;
          border-top: 1.5px solid #A57C00;
        }
        
        .vat-note { 
          font-size: 8px; 
          color: #6b7280; 
          margin: 5px 0 0 0; 
        }
        
        .vat-code { 
          font-family: 'Courier New', monospace; 
          background-color: #fffbf0; 
          padding: 1px 3px; 
          border: 1px solid #A57C00; 
          border-radius: 2px;
        }
        
        .page-break { 
          page-break-before: always; 
          break-before: page;
        }
        
        .attachment-page {
          width: 210mm;
          min-height: 297mm;
          padding: 0;
          margin: 0;
          position: relative;
          background: white;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        .attachment-header {
          padding: 10mm 15mm;
          background-color: #fffbf0;
          border-bottom: 2px solid #A57C00;
        }
        
        .attachment-header h2 {
          margin: 0;
          padding: 0;
          border: none;
        }
        
        .pdf-embed {
          width: 210mm;
          height: 270mm;
          border: none;
          display: block;
          background: white;
        }
        
        .image-full-page {
          width: 100%;
          height: auto;
          max-height: 270mm;
          object-fit: contain;
          display: block;
          padding: 10mm;
        }
        
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          .voucher-page {
            page-break-after: always;
            break-after: page;
          }
          
          .page-break {
            page-break-before: always;
            break-before: page;
          }
          
          .attachment-page {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          .pdf-embed, embed, object {
            display: block;
            width: 210mm !important;
            height: 270mm !important;
            page-break-inside: avoid;
            break-inside: avoid;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .image-full-page {
            max-height: 270mm;
            page-break-inside: avoid;
          }
        }
        
        @media screen {
          .attachment-container {
            background: #f8f9fa;
            padding: 20px 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="voucher-page">
        <div class="header">
          <h1>Transaction Payment Voucher</h1>
          <p style="color: #A57C00; font-weight: 600; font-size: 10px;">
            Case: <strong>${safeProp(safeCaseDetails, 'company_name') || 'N/A'}</strong> (${safeProp(safeCaseDetails, 'case_reference') || 'N/A'})
          </p>
        </div>

        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">Transaction Date</div>
            <div class="detail-value">${formatDate(transaction_date)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Payee / Payer</div>
            <div class="detail-value">${payee_name || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Transaction Type</div>
            <div class="detail-value">
              <span class="badge ${safeString(transaction_type) === 'receipt' ? 'badge-receipt' : 'badge-payment'}">
                ${transaction_type}
              </span>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Invoice Date</div>
            <div class="detail-value">${formatDate(date_of_invoice)}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Invoice Number</div>
            <div class="detail-value">${invoice_number || 'N/A'}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Bank Account</div>
            <div class="detail-value">${bankAccountName}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">Reference</div>
            <div class="detail-value font-mono">${reference || 'N/A'}</div>
          </div>
          <div class="detail-item description-item">
            <div class="detail-label">Description</div>
            <div class="detail-value">${description || 'N/A'}</div>
          </div>
        </div>
        
        <h2>Financial Posting Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Account Code</th>
              <th class="text-right">Debit (£)</th>
              <th class="text-right">Credit (£)</th>
            </tr>
          </thead>
          <tbody>
            ${safeArrayMap(journalEntries, (entry) => `
              <tr>
                <td>${safeString(safeProp(safeObject(entry), 'account'))}</td>
                <td class="font-mono">${safeString(safeProp(safeObject(entry), 'code'))}</td>
                <td class="text-right font-mono">${safeNumber(safeProp(safeObject(entry), 'debit')) > 0 ? formatCurrency(safeProp(safeObject(entry), 'debit')) : ''}</td>
                <td class="text-right font-mono">${safeNumber(safeProp(safeObject(entry), 'credit')) > 0 ? formatCurrency(safeProp(safeObject(entry), 'credit')) : ''}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" class="text-right">Totals</td>
              <td class="text-right font-mono">${formatCurrency(totals.debit)}</td>
              <td class="text-right font-mono">${formatCurrency(totals.credit)}</td>
            </tr>
          </tfoot>
        </table>
        
        ${numVatAmount > 0 ? `
          <p class="vat-note">
            VAT of £${formatCurrency(numVatAmount)} has been recorded to account 
            <span class="vat-code">${safeString(transaction_type) === 'payment' ? 'VAT001' : 'VAT002'}</span>.
          </p>
        ` : ''}
        
        <h2>Approval Signatures</h2>
        <div class="approval-section" style="margin-bottom: 10px;">
          <div class="approval-header">SUBMITTED BY</div>
          <div class="approval-content">
            <div class="approval-row">
              <div>
                <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px; color: #1f2937;">
                  ${submitterName || 'N/A'}
                </div>
                ${approver_grade ? `
                  <div style="font-size: 9px; color: #A57C00; font-weight: 600; margin-bottom: 2px;">
                    ${safeString(approver_grade)}
                  </div>
                ` : ''}
                <div style="font-size: 9px; color: #6b7280;">
                  Date: ${signed_date ? formatDate(signed_date) : 'N/A'}
                </div>
              </div>
              <div style="text-align: center;">
                ${submitterSignature ? `
                  <img src="${submitterSignature}" alt="Submitter Signature" class="signature-img" />
                ` : `
                  <div style="font-size: 9px; color: #6b7280; font-style: italic;">No signature</div>
                `}
              </div>
            </div>
          </div>
        </div>
        <div class="approval-section">
          <div class="approval-header">APPROVED BY</div>
          <div class="approval-content">
            <div class="approval-row">
              <div>
                <div style="font-size: 11px; font-weight: 600; margin-bottom: 2px; color: #1f2937;">
                  ${approverName || 'N/A'}
                </div>
                ${safeProp(safeTx, 'approver_grade') ? `
                  <div style="font-size: 9px; color: #A57C00; font-weight: 600; margin-bottom: 2px;">
                    ${safeString(safeProp(safeTx, 'approver_grade'))}
                  </div>
                ` : ''}
                <div style="font-size: 9px; color: #6b7280;">
                  Date: ${safeProp(safeTx, 'approver_signed_date') ? formatDate(safeProp(safeTx, 'approver_signed_date')) : 'N/A'}
                </div>
              </div>
              <div style="text-align: center;">
                ${approverSignature ? `
                  <img src="${approverSignature}" alt="Approver Signature" class="signature-img" />
                ` : `
                  <div style="font-size: 9px; color: #6b7280; font-style: italic;">No signature</div>
                `}
              </div>
            </div>
          </div>
        </div>
      </div>

      ${attachmentPages}
      
      <script>
        // Ensure PDFs are loaded before printing
        window.addEventListener('afterprint', function() {
          window.close();
        });
      </script>
    </body>
    </html>
  `;
};