import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, Loader2, ChevronDown, Trash2, Eye, Download } from "lucide-react";
import { AccountingService } from "./AccountingService";
import { base44 } from "@/api/base44Client";
import { motion, AnimatePresence } from "framer-motion";

export default function TrialBalance({ caseId, selectedAccount = 'all' }) {
  const [trialBalanceData, setTrialBalanceData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  const [accountTransactions, setAccountTransactions] = useState({});
  const [loadingTransactions, setLoadingTransactions] = useState({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [isAllocatingVAT, setIsAllocatingVAT] = useState(false);
  const [showVATHistory, setShowVATHistory] = useState(false);
  const [vatHistory, setVATHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedAllocationEntries, setSelectedAllocationEntries] = useState(null);
  const [showAllocationDetail, setShowAllocationDetail] = useState(false);

  // Load current user, all users, and chart of accounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const [user, allUsers, chartAccounts] = await Promise.all([
          base44.auth.me(),
          base44.entities.User.list(),
          base44.entities.ChartOfAccount.list()
        ]);
        setCurrentUser(user);
        setUsers(allUsers || []);
        setChartOfAccounts(chartAccounts || []);
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };
    loadUserData();
  }, []);

  // Check if user can delete transactions (only Cashier and IP grades)
  const canDeleteTransactions = currentUser && (currentUser.grade === 'Cashier' || currentUser.grade === 'IP');

  const loadTrialBalance = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await AccountingService.getTrialBalance(caseId, selectedAccount);
      let trialBalanceArray = Array.isArray(data) ? data : [];
      
      // IMPORTANT: AccountingService.getTrialBalance() only includes accounts from APPROVED transactions
      // VAT allocations are adjusting entries with no corresponding Transaction record
      // So we need to manually recalculate VAT001, VAT002, and VAT003 balances including adjusting entries
      
      try {
        // Get Chart of Accounts for VAT account details
        const chartAccounts = await base44.entities.ChartOfAccount.list();
        
        // Process each VAT account: VAT001, VAT002, VAT003
        const vatAccountCodes = ['VAT001', 'VAT002', 'VAT003'];
        
        for (const vatCode of vatAccountCodes) {
          // Fetch ALL accounting entries for this VAT account (including adjusting entries)
          const vatEntries = await base44.entities.AccountingEntry.filter({
            case_id: caseId,
            account_code: vatCode
          });
          
          if (vatEntries && vatEntries.length > 0) {
            // Calculate the total balance including adjusting entries
            let totalDebits = 0;
            let totalCredits = 0;
            
            vatEntries.forEach(entry => {
              totalDebits += parseFloat(entry.debit_amount) || 0;
              totalCredits += parseFloat(entry.credit_amount) || 0;
            });
            
            const netBalance = totalDebits - totalCredits;
            
            // Find if this VAT account is already in the trial balance
            const existingIndex = trialBalanceArray.findIndex(acc => acc.account_code === vatCode);
            
            // Get account details from Chart of Accounts
            const vatAccount = chartAccounts.find(acc => acc.account_code === vatCode);
            
            if (vatAccount) {
              const accountData = {
                ...vatAccount,
                net_balance: netBalance
              };
              
              if (existingIndex >= 0) {
                // Update existing account with recalculated balance
                trialBalanceArray[existingIndex] = accountData;
                console.log(`Updated ${vatCode} balance to:`, netBalance);
              } else {
                // Add new account to trial balance (even if balance is zero, so transactions can be checked)
                trialBalanceArray.push(accountData);
                console.log(`Added ${vatCode} to trial balance with balance:`, netBalance);
              }
            }
          } else if (!trialBalanceArray.some(acc => acc.account_code === vatCode)) {
            // No entries found and not in trial balance - check if account exists in chart
            const vatAccount = chartAccounts.find(acc => acc.account_code === vatCode);
            if (vatAccount) {
              // Add it with zero balance (account exists but has no transactions yet)
              trialBalanceArray.push({
                ...vatAccount,
                net_balance: 0
              });
              console.log(`Added ${vatCode} to trial balance with zero balance (no entries yet)`);
            }
          }
        }
      } catch (vatError) {
        console.error('Error recalculating VAT account balances:', vatError);
        // Don't fail the whole load if this fails
      }
      
      setTrialBalanceData(trialBalanceArray);
      setRetryCount(0);
    } catch (error) {
      console.error("Error loading trial balance:", error);
      
      if (error.message && (error.message.includes('Network Error') || error.message.includes('Failed to fetch'))) {
        setError("Network connection issue loading trial balance. Please check your internet connection.");
      } else {
        setError(`Failed to load trial balance: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (caseId) {
      loadTrialBalance();
    }
  }, [caseId, refreshKey, selectedAccount]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setAccountTransactions({});
    setExpandedAccounts(new Set());
  };

  const handleVATAllocation = async () => {
    setIsAllocatingVAT(true);
    try {
      // First, find the most recent VAT allocation date
      const allVATEntries = await base44.entities.AccountingEntry.filter({ 
        case_id: caseId
      });
      
      // Find all previous VAT allocation entries
      const previousAllocations = allVATEntries.filter(entry => 
        entry.reference && entry.reference.includes('VAT Allocation') &&
        entry.journal_type === 'adjusting'
      );
      
      // Get the most recent allocation date
      let lastAllocationDate = null;
      if (previousAllocations.length > 0) {
        const sortedAllocations = previousAllocations.sort((a, b) => 
          new Date(b.entry_date) - new Date(a.entry_date)
        );
        lastAllocationDate = sortedAllocations[0].entry_date;
        console.log('Last VAT allocation date:', lastAllocationDate);
      }

      // Get VAT Receivable (VAT001) and VAT Payable (VAT002) entries
      const vat001Entries = allVATEntries.filter(e => e.account_code === 'VAT001');
      const vat002Entries = allVATEntries.filter(e => e.account_code === 'VAT002');

      // Filter entries to only include those AFTER the last allocation date
      const newVat001Entries = lastAllocationDate 
        ? vat001Entries.filter(e => new Date(e.entry_date) > new Date(lastAllocationDate))
        : vat001Entries;
      
      const newVat002Entries = lastAllocationDate 
        ? vat002Entries.filter(e => new Date(e.entry_date) > new Date(lastAllocationDate))
        : vat002Entries;

      console.log('New VAT001 entries since last allocation:', newVat001Entries.length);
      console.log('New VAT002 entries since last allocation:', newVat002Entries.length);

      // Calculate balances from NEW entries only
      let vat001NewBalance = 0;
      newVat001Entries.forEach(entry => {
        vat001NewBalance += (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
      });

      let vat002NewBalance = 0;
      newVat002Entries.forEach(entry => {
        vat002NewBalance += (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
      });

      console.log('VAT001 new balance to allocate:', vat001NewBalance);
      console.log('VAT002 new balance to allocate:', vat002NewBalance);

      // Check if there are any NEW balances to allocate
      if (Math.abs(vat001NewBalance) < 0.01 && Math.abs(vat002NewBalance) < 0.01) {
        if (lastAllocationDate) {
          alert(`No further VAT allocation required. No new VAT entries found after the last allocation on ${new Date(lastAllocationDate).toLocaleDateString('en-GB')}.`);
        } else {
          alert('No VAT entries found to allocate.');
        }
        setIsAllocatingVAT(false);
        return;
      }

      // Show summary of what will be allocated
      const summaryMessage = lastAllocationDate 
        ? `This will allocate new VAT entries since ${new Date(lastAllocationDate).toLocaleDateString('en-GB')}:\n\n` +
          `VAT Receivable: £${Math.abs(vat001NewBalance).toFixed(2)}\n` +
          `VAT Payable: £${Math.abs(vat002NewBalance).toFixed(2)}\n\nContinue?`
        : `This will allocate all VAT Receivable and VAT Payable balances to the VAT Control Account. Continue?`;

      if (!window.confirm(summaryMessage)) {
        setIsAllocatingVAT(false);
        return;
      }

      // Get or create VAT Control Account
      const chartAccounts = await base44.entities.ChartOfAccount.list();
      let vatControlAccount = chartAccounts.find(acc => acc.account_code === 'VAT003');
      
      if (!vatControlAccount) {
        vatControlAccount = await base44.entities.ChartOfAccount.create({
          account_code: 'VAT003',
          account_name: 'VAT Control Account',
          account_type: 'Liabilities',
          account_group: 'VAT',
          description: 'VAT Control Account for periodic allocations'
        });
      }

      // Get VAT account details for journal entries
      const vat001Account = chartAccounts.find(acc => acc.account_code === 'VAT001');
      const vat002Account = chartAccounts.find(acc => acc.account_code === 'VAT002');

      // Get the case details to use appointment_date as transaction date
      const caseDetails = await base44.entities.Case.filter({ id: caseId });
      const transactionDate = caseDetails[0]?.appointment_date || new Date().toISOString().split('T')[0];

      // Create a unique transaction ID for this VAT allocation
      const vatAllocationTransactionId = `VAT_ALLOCATION_${Date.now()}`;
      const reference = `VAT Allocation ${new Date().toLocaleDateString('en-GB')}`;

      // Create journal entries for VAT allocation
      const entries = [];

      // If VAT Receivable has a debit balance (positive), credit it and debit VAT Control
      if (vat001NewBalance > 0.01) {
        entries.push({
          case_id: caseId,
          transaction_id: vatAllocationTransactionId,
          entry_date: transactionDate,
          account_code: 'VAT001',
          account_name: vat001Account?.account_name || 'VAT Receivable',
          account_type: vat001Account?.account_type || 'Assets',
          account_group: vat001Account?.account_group || 'VAT',
          description: 'VAT Allocation to Control Account',
          debit_amount: 0,
          credit_amount: vat001NewBalance,
          reference: reference,
          journal_type: 'adjusting'
        });

        entries.push({
          case_id: caseId,
          transaction_id: vatAllocationTransactionId,
          entry_date: transactionDate,
          account_code: 'VAT003',
          account_name: vatControlAccount.account_name,
          account_type: vatControlAccount.account_type,
          account_group: vatControlAccount.account_group,
          description: 'VAT Allocation from VAT Receivable',
          debit_amount: vat001NewBalance,
          credit_amount: 0,
          reference: reference,
          journal_type: 'adjusting'
        });
      }

      // If VAT Payable has a credit balance (negative), debit it and credit VAT Control
      if (vat002NewBalance < -0.01) {
        const vat002Amount = Math.abs(vat002NewBalance);
        
        entries.push({
          case_id: caseId,
          transaction_id: vatAllocationTransactionId,
          entry_date: transactionDate,
          account_code: 'VAT002',
          account_name: vat002Account?.account_name || 'VAT Payable',
          account_type: vat002Account?.account_type || 'Liabilities',
          account_group: vat002Account?.account_group || 'VAT',
          description: 'VAT Allocation to Control Account',
          debit_amount: vat002Amount,
          credit_amount: 0,
          reference: reference,
          journal_type: 'adjusting'
        });

        entries.push({
          case_id: caseId,
          transaction_id: vatAllocationTransactionId,
          entry_date: transactionDate,
          account_code: 'VAT003',
          account_name: vatControlAccount.account_name,
          account_type: vatControlAccount.account_type,
          account_group: vatControlAccount.account_group,
          description: 'VAT Allocation from VAT Payable',
          debit_amount: 0,
          credit_amount: vat002Amount,
          reference: reference,
          journal_type: 'adjusting'
        });
      }

      // Create all entries
      for (const entry of entries) {
        await base44.entities.AccountingEntry.create(entry);
      }

      alert(`VAT allocation completed successfully. ${entries.length} journal entries created.`);
      
      // Wait longer for database to fully commit and propagate changes
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear expanded accounts and transactions cache first
      setAccountTransactions({});
      setExpandedAccounts(new Set());
      
      // Force a direct reload of trial balance
      await loadTrialBalance();

    } catch (error) {
      console.error("Error allocating VAT:", error);
      alert('Failed to allocate VAT: ' + (error.message || 'Unknown error'));
    } finally {
      setIsAllocatingVAT(false);
    }
  };

  const handleShowVATHistory = async () => {
    setShowVATHistory(true);
    setIsLoadingHistory(true);
    
    try {
      // Fetch all accounting entries for this case
      const allEntries = await base44.entities.AccountingEntry.filter({ case_id: caseId });
      
      // Filter for VAT allocation transactions
      const vatAllocationTransactions = allEntries.filter(entry => 
        entry.reference && entry.reference.includes('VAT Allocation')
      );
      
      // Group entries by transaction_id
      const groupedByTransaction = {};
      vatAllocationTransactions.forEach(entry => {
        if (!groupedByTransaction[entry.transaction_id]) {
          groupedByTransaction[entry.transaction_id] = [];
        }
        groupedByTransaction[entry.transaction_id].push(entry);
      });
      
      // Create history records
      const historyRecords = Object.keys(groupedByTransaction).map(transactionId => {
        const entries = groupedByTransaction[transactionId];
        const firstEntry = entries[0];
        
        // Calculate amounts from entries
        const vatReceivableEntry = entries.find(e => e.account_code === 'VAT001' && e.credit_amount > 0);
        const vatPayableEntry = entries.find(e => e.account_code === 'VAT002' && e.debit_amount > 0);
        
        // Sum debit/credit for VAT Control to get the net effect on control account
        const vatControlDebit = entries.filter(e => e.account_code === 'VAT003').reduce((sum, e) => sum + (e.debit_amount || 0), 0);
        const vatControlCredit = entries.filter(e => e.account_code === 'VAT003').reduce((sum, e) => sum + (e.credit_amount || 0), 0);
        
        return {
          transaction_id: transactionId,
          date: firstEntry.entry_date,
          reference: firstEntry.reference,
          vat_receivable_allocated: vatReceivableEntry ? vatReceivableEntry.credit_amount : 0,
          vat_payable_allocated: vatPayableEntry ? vatPayableEntry.debit_amount : 0,
          net_to_control: vatControlCredit - vatControlDebit, // Net effect on VAT Control
          created_date: firstEntry.created_date,
          entries: entries // Store all entries for detail view
        };
      });
      
      // Sort by date descending (most recent first)
      historyRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setVATHistory(historyRecords);
    } catch (error) {
      console.error("Error loading VAT allocation history:", error);
      alert('Failed to load VAT allocation history: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleViewAllocationDetail = (record) => {
    setSelectedAllocationEntries(record);
    setShowAllocationDetail(true);
  };

  const handleDeleteEntry = async (entryId, accountCode) => {
    setDeletingEntry(entryId);
    
    try {
      // Step 1: Get the entry being deleted to find its transaction_id
      const entryToDelete = await base44.entities.AccountingEntry.filter({ id: entryId });
      if (!entryToDelete || entryToDelete.length === 0) {
        throw new Error('Entry not found');
      }
      
      const transactionId = entryToDelete[0].transaction_id;
      const isAdjustingEntry = entryToDelete[0].journal_type === 'adjusting';
      
      // Step 2: Determine what we're deleting
      if (isAdjustingEntry) {
        // For adjusting entries (like VAT allocations), confirm single entry deletion
        if (!window.confirm('Are you sure you want to delete this adjusting entry? This cannot be undone.')) {
          setDeletingEntry(null);
          return;
        }
        
        // Delete only this single entry
        await base44.entities.AccountingEntry.delete(entryId);
        console.log('Deleted adjusting entry:', entryId);
      } else {
        // For transaction-based entries, delete the ENTIRE transaction with all related entries
        if (!window.confirm('Are you sure you want to delete this entire transaction? This will remove ALL related entries including VAT and bank account postings. This cannot be undone.')) {
          setDeletingEntry(null);
          return;
        }
        
        // Step 3: Find ALL entries for this transaction
        const allRelatedEntries = await base44.entities.AccountingEntry.filter({ 
          case_id: caseId,
          transaction_id: transactionId
        });
        
        console.log(`Found ${allRelatedEntries.length} related entries to delete for transaction ${transactionId}`);
        console.log('Entries being deleted:', allRelatedEntries.map(e => ({
          account_code: e.account_code,
          account_name: e.account_name,
          debit: e.debit_amount,
          credit: e.credit_amount
        })));
        
        // Step 4: Delete ALL related entries (including VAT and bank account entries)
        await Promise.all(allRelatedEntries.map(entry => 
          base44.entities.AccountingEntry.delete(entry.id)
        ));
        
        console.log(`Successfully deleted all ${allRelatedEntries.length} entries for transaction ${transactionId}`);
        
        // Step 5: Also delete the Transaction record itself if it exists
        try {
          const transaction = await base44.entities.Transaction.filter({ id: transactionId });
          if (transaction && transaction.length > 0) {
            await base44.entities.Transaction.delete(transactionId);
            console.log('Deleted transaction record:', transactionId);
            
            // Step 6: Delete associated voucher document if it exists
            const documents = await base44.entities.Document.filter({ case_id: caseId });
            const voucherDocs = documents.filter(doc => {
              try {
                const docData = JSON.parse(doc.raw_text || '{}');
                return docData.transaction_id === transactionId;
              } catch (e) {
                return false;
              }
            });
            
            if (voucherDocs.length > 0) {
              await Promise.all(voucherDocs.map(doc => base44.entities.Document.delete(doc.id)));
              console.log(`Deleted ${voucherDocs.length} associated voucher document(s)`);
            }
          }
        } catch (txError) {
          console.log('Transaction record not found or already deleted:', txError.message);
        }
      }
      
      // Refresh the trial balance
      handleRefresh();
      
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert('Failed to delete: ' + (error.message || 'Unknown error'));
    } finally {
      setDeletingEntry(null);
    }
  };

  const handleViewVoucher = async (entry) => {
    setViewingDocument(entry.id);
    
    try {
      // Get the transaction details
      const transactions = await base44.entities.Transaction.filter({ id: entry.transaction_id });
      const transaction = transactions[0];
      
      if (!transaction) {
        alert('Transaction not found for this voucher.');
        setViewingDocument(null);
        return;
      }
      
      // Get case details
      const cases = await base44.entities.Case.filter({ id: caseId });
      const caseDetails = cases[0];
      
      if (!caseDetails) {
        alert('Case details not found.');
        setViewingDocument(null);
        return;
      }
      
      // Regenerate the voucher HTML with current signatures from User Management
      const voucherHTML = generateVoucherHTML(transaction, caseDetails, chartOfAccounts, users);
      
      const voucherWindow = window.open('', '_blank', 'width=900,height=800');
      
      if (!voucherWindow) {
        alert('Please allow popups to view vouchers');
        return;
      }
      
      voucherWindow.document.open();
      voucherWindow.document.write(voucherHTML);
      voucherWindow.document.close();
      
      voucherWindow.addEventListener('load', () => {
        setTimeout(() => {
          // Content is now loaded with all embedded PDFs/images
        }, 1500);
      });
    } catch (error) {
      console.error("Error loading voucher:", error);
      alert('Failed to load voucher: ' + (error.message || 'Unknown error'));
    } finally {
      setViewingDocument(null);
    }
  };

  const toggleAccountExpansion = async (accountCode, e) => {
    e?.stopPropagation();
    
    const newExpanded = new Set(expandedAccounts);
    
    if (newExpanded.has(accountCode)) {
      newExpanded.delete(accountCode);
      setExpandedAccounts(newExpanded);
    } else {
      newExpanded.add(accountCode);
      setExpandedAccounts(newExpanded);
      
      if (!accountTransactions[accountCode]) {
        setLoadingTransactions(prev => ({ ...prev, [accountCode]: true }));
        try {
          const entries = await base44.entities.AccountingEntry.filter({ 
            case_id: caseId,
            account_code: accountCode 
          });
          
          // FILTER OUT orphaned entries (where transaction was deleted)
          // Get all transactions for this case
          const allTransactions = await base44.entities.Transaction.filter({ case_id: caseId });
          const validTransactionIds = new Set(allTransactions.map(t => t.id));
          
          // Only keep entries that either:
          // 1. Have journal_type === 'adjusting' (VAT allocations, etc.)
          // 2. Have a transaction_id that exists in the current transactions list
          // 3. Match the selected account filter if not 'all'
          const validEntries = entries.filter(entry => {
            if (entry.journal_type === 'adjusting') return true;
            if (!entry.transaction_id) return false;
            if (!validTransactionIds.has(entry.transaction_id)) return false;
            
            // Apply account filter
            if (selectedAccount !== 'all') {
              const transaction = allTransactions.find(t => t.id === entry.transaction_id);
              if (transaction && transaction.target_account !== selectedAccount) {
                return false;
              }
            }
            
            return true;
          });
          
          setAccountTransactions(prev => ({ ...prev, [accountCode]: validEntries }));
        } catch (error) {
          console.error("Error loading account transactions:", error);
        } finally {
          setLoadingTransactions(prev => ({ ...prev, [accountCode]: false }));
        }
      }
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const getBalanceType = (account) => {
    const balance = parseFloat(account.net_balance) || 0;
    if (balance === 0) return { type: 'zero', amount: '0.00' };
    
    // net_balance = total_debits - total_credits
    // Positive balance means more debits (show in debit column)
    // Negative balance means more credits (show in credit column)
    
    return {
      type: balance > 0 ? 'debit' : 'credit',
      amount: formatCurrency(balance)
    };
  };

  const sortedTrialBalanceData = React.useMemo(() => {
    const data = [...trialBalanceData];
    
    const getCategoryOrder = (account) => {
      const group = (account.account_group || '').toLowerCase();
      const name = (account.account_name || '').toLowerCase();
      const code = (account.account_code || '').toLowerCase();
      
      if (name.includes('interest bearing current account') || code === 'fltc') {
        return 0;
      }
      
      if (group.includes('bank') || name.includes('bank') || code.includes('bank')) {
        return 1;
      }
      
      if (group.includes('realisation') || group.includes('realisations') || 
          name.includes('realisation') || name.includes('realisations')) {
        return 2;
      }
      
      if (group.includes('cost') || name.includes('cost')) {
        return 3;
      }
      
      if (group.includes('vat') || name.includes('vat') || code.includes('vat')) {
        return 5;
      }
      
      return 4;
    };
    
    const getVATSubOrder = (code) => {
      // Explicit ordering for VAT accounts
      if (code === 'VAT001') return 1; // VAT Receivable first
      if (code === 'VAT002') return 2; // VAT Payable second
      if (code === 'VAT003') return 3; // VAT Control Account last
      return 0;
    };
    
    return data.sort((a, b) => {
      const orderA = getCategoryOrder(a);
      const orderB = getCategoryOrder(b);
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // Special handling for VAT accounts - use explicit sub-ordering
      const codeA = (a.account_code || '').toUpperCase();
      const codeB = (b.account_code || '').toUpperCase();
      
      if (codeA.startsWith('VAT') && codeB.startsWith('VAT')) {
        const subOrderA = getVATSubOrder(codeA);
        const subOrderB = getVATSubOrder(codeB);
        if (subOrderA !== subOrderB) {
          return subOrderA - subOrderB;
        }
      }
      
      return (a.account_code || '').localeCompare(b.account_code || '');
    });
  }, [trialBalanceData]);

  const totals = sortedTrialBalanceData.reduce((acc, account) => {
    const balanceInfo = getBalanceType(account);
    if (balanceInfo.type === 'debit') {
      acc.totalDebits += Math.abs(parseFloat(account.net_balance) || 0);
    } else if (balanceInfo.type === 'credit') {
      acc.totalCredits += Math.abs(parseFloat(account.net_balance) || 0);
    }
    return acc;
  }, { totalDebits: 0, totalCredits: 0 });

  const handleExportHTML = async () => {
    try {
      // Load all transactions for all accounts
      const allTransactionsMap = {};
      
      // Create a copy of the sortedTrialBalanceData to prevent re-renders during export transaction loading
      const currentSortedData = [...sortedTrialBalanceData];

      // Get all transactions for this case to filter orphaned entries during export
      const allTransactions = await base44.entities.Transaction.filter({ case_id: caseId });
      const validTransactionIds = new Set(allTransactions.map(t => t.id));

      // Use Promise.all to fetch transactions concurrently
      await Promise.all(currentSortedData.map(async (account) => {
        const entries = await base44.entities.AccountingEntry.filter({ 
          case_id: caseId,
          account_code: account.account_code 
        });

        // Filter out orphaned entries
        const validEntries = entries.filter(entry => {
          if (entry.journal_type === 'adjusting') return true;
          if (!entry.transaction_id) return false;
          return validTransactionIds.has(entry.transaction_id);
        });

        allTransactionsMap[account.account_code] = validEntries || [];
      }));

      // Generate HTML
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Trial Balance Export</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f8fafc;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      .container {
        padding: 10px;
        margin: 0;
        box-shadow: none;
      }
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1e293b;
      margin-bottom: 10px;
    }
    .export-date {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #f1f5f9;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 2px solid #cbd5e1;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    .account-row {
      background: #f8fafc;
      font-weight: 600;
      border-top: 2px solid #cbd5e1;
      color: #1e293b;
    }
    .transaction-row {
      background: #ffffff;
    }
    .transaction-row:hover {
      background: #f1f5f9;
    }
    .totals-row {
      background: #f1f5f9;
      font-weight: 700;
      border-top: 3px solid #94a3b8;
      border-bottom: 3px solid #94a3b8;
    }
    .balance-check {
      margin-top: 20px;
      padding: 15px;
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      border-radius: 4px;
    }
    .balance-check.error {
      background: #fef2f2;
      border-left-color: #ef4444;
    }
    .transaction-section {
      margin-left: 40px;
      margin-top: 10px;
      margin-bottom: 20px;
    }
    .transaction-table {
      font-size: 13px;
      width: calc(100% - 40px);
    }
    .transaction-table th {
      background: #A57C00;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    .transaction-table td {
      border-bottom: 1px dashed #e0e0e0;
    }
    .transaction-table tr:last-child td {
      border-bottom: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Trial Balance</h1>
    <div class="export-date">Exported on ${new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}</div>
    
    <table>
      <thead>
        <tr>
          <th style="width: 120px">Account Code</th>
          <th style="width: 350px">Account Name</th>
          <th style="width: 120px">Account Type</th>
          <th class="text-right" style="width: 120px">Debit (£)</th>
          <th class="text-right" style="width: 120px">Credit (£)</th>
          <th class="text-right" style="width: 120px">Account Balance (£)</th>
        </tr>
      </thead>
      <tbody>
        ${currentSortedData.map(account => {
          const balanceInfo = getBalanceType(account);
          const transactions = allTransactionsMap[account.account_code] || [];
          const isInterestBearingAccount = account.account_code === 'FLTC' || 
            (account.account_name || '').toLowerCase().includes('interest bearing current account');

          let runningBalance = 0; // Initialize running balance for each account

          return `
            <tr class="account-row">
              <td style="font-family: monospace">${account.account_code}</td>
              <td><strong>${account.account_name}</strong></td>
              <td style="width: 120px">${account.account_type}</td>
              <td class="text-right" style="font-family: monospace; width: 120px;">
                ${balanceInfo.type === 'debit' ? balanceInfo.amount : ''}
              </td>
              <td class="text-right" style="font-family: monospace; width: 120px;">
                ${balanceInfo.type === 'credit' ? balanceInfo.amount : ''}
              </td>
              <td class="text-right" style="font-family: monospace; width: 120px;">
                ${isInterestBearingAccount && balanceInfo.type === 'debit' ? balanceInfo.amount : ''}
              </td>
            </tr>
            ${transactions.length > 0 ? `
              <tr>
                <td colspan="6" style="padding: 0; border: none;">
                  <div class="transaction-section">
                    <table class="transaction-table">
                      <thead>
                        <tr>
                          <th style="width: 100px">Date</th>
                          <th style="width: 300px">Description</th>
                          <th style="width: 150px">Reference</th>
                          <th class="text-right" style="width: 120px">Debit (£)</th>
                          <th class="text-right" style="width: 120px">Credit (£)</th>
                          <th class="text-right" style="width: 120px">Account Balance (£)</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${transactions.map(entry => {
                          runningBalance += (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
                          return `
                            <tr class="transaction-row">
                              <td>${formatDate(entry.entry_date)}</td>
                              <td>${entry.description || '—'}</td>
                              <td style="font-family: monospace; font-size: 12px">${entry.reference || '—'}</td>
                              <td class="text-right" style="font-family: monospace">
                                ${entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : ''}
                              </td>
                              <td class="text-right" style="font-family: monospace">
                                ${entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : ''}
                              </td>
                              <td class="text-right" style="font-family: monospace">
                                ${isInterestBearingAccount ? formatCurrency(runningBalance) : ''}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            ` : ''}
          `;
        }).join('')}
        
        <tr class="totals-row">
          <td></td>
          <td></td>
          <td></td>
          <td><strong>Totals:</strong></td>
          <td class="text-right" style="font-family: monospace">${formatCurrency(totals.totalDebits)}</td>
          <td class="text-right" style="font-family: monospace">${formatCurrency(totals.totalCredits)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
    
    <div class="balance-check ${Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 ? '' : 'error'}">
      <strong>Balance Check:</strong> 
      ${Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
        ? '✓ Balanced' 
        : `Difference: £${formatCurrency(Math.abs(totals.totalDebits - totals.totalCredits))}`
      }
    </div>
  </div>
</body>
</html>
      `;

      // Open in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(html);
        newWindow.document.close();
      } else {
        alert('Please allow popups to export the trial balance');
      }
    } catch (error) {
      console.error("Error exporting trial balance:", error);
      alert('Failed to export trial balance: ' + (error.message || 'Unknown error'));
    }
  };

  if (isLoading && trialBalanceData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            <span>Loading trial balance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Trial Balance</h3>
            <p className="text-slate-600 mb-4">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Trial Balance</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportHTML}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export to HTML
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={isAllocatingVAT}
                >
                  {isAllocatingVAT ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Allocating...
                    </>
                  ) : (
                    <>
                      VAT Allocation
                      <ChevronDown className="w-4 h-4" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleShowVATHistory}>
                  History
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleVATAllocation} disabled={isAllocatingVAT}>
                  Allocate to VAT Control Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading || isAllocatingVAT}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sortedTrialBalanceData.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No accounting entries found for this case.</p>
            <p className="text-sm">Trial balance will appear here once transactions are approved.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-12 text-blue-900"></TableHead>
                  <TableHead className="w-32 text-blue-900 font-bold">Account Code</TableHead>
                  <TableHead className="w-96 text-blue-900 font-bold">Account Name</TableHead>
                  <TableHead className="w-32 text-blue-900 font-bold text-xs">Account Type</TableHead>
                  <TableHead className="w-32 text-right px-4 text-blue-900 font-bold">Debit (£)</TableHead>
                  <TableHead className="w-32 text-right px-4 text-blue-900 font-bold">Credit (£)</TableHead>
                  <TableHead className="w-32 text-right px-4 text-blue-900 font-bold">Account Balance (£)</TableHead>
                  <TableHead className="w-24 text-center text-blue-900 font-bold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTrialBalanceData.map((account) => {
                  const balanceInfo = getBalanceType(account);
                  const isExpanded = expandedAccounts.has(account.account_code);
                  const transactions = accountTransactions[account.account_code] || [];
                  const isLoadingTx = loadingTransactions[account.account_code];
                  
                  // Check if this is the Interest Bearing Current Account (FLTC)
                  const isInterestBearingAccount = account.account_code === 'FLTC' || 
                    (account.account_name || '').toLowerCase().includes('interest bearing current account');
                  
                  return (
                    <React.Fragment key={account.account_code}>
                      <TableRow 
                        className="hover:bg-slate-50 cursor-pointer border-b-2 border-slate-200 bg-slate-50"
                        onClick={(e) => toggleAccountExpansion(account.account_code, e)}
                      >
                        <TableCell className="w-12">
                          <div className="flex items-center justify-center h-full">
                            <motion.div
                              initial={false}
                              animate={{ rotate: isExpanded ? 0 : -90 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </motion.div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold w-32">{account.account_code}</TableCell>
                        <TableCell className="font-semibold w-96">{account.account_name}</TableCell>
                        <TableCell className="font-medium text-slate-600 w-32 text-xs">{account.account_type}</TableCell>
                        <TableCell className="text-right font-mono font-semibold w-32 px-4">
                          {balanceInfo.type === 'debit' ? balanceInfo.amount : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold w-32 px-4">
                          {balanceInfo.type === 'credit' ? balanceInfo.amount : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold w-32 px-4">
                          {isInterestBearingAccount && balanceInfo.type === 'debit' ? balanceInfo.amount : ''}
                        </TableCell>
                        <TableCell className="w-24"></TableCell>
                      </TableRow>

                      <AnimatePresence>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={8} className="p-0 bg-slate-50/30">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                {isLoadingTx ? (
                                  <div className="py-4">
                                    <div className="flex items-center justify-center text-slate-500">
                                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                      Loading transactions...
                                    </div>
                                  </div>
                                ) : transactions.length === 0 ? (
                                  <div className="py-4 text-center text-slate-500 text-sm">
                                    No transactions found for this account
                                  </div>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-blue-50">
                                        <TableHead className="text-xs font-semibold text-blue-800 w-12"></TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 w-32">Date</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 w-96">Description</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 w-32">Reference</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 text-right w-32 px-4">Debit (£)</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 text-right w-32 px-4">Credit (£)</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 text-right w-32 px-4">Account Balance (£)</TableHead>
                                        <TableHead className="text-xs font-semibold text-blue-800 text-center w-24">Actions</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {(() => {
                                        // Calculate running balance for Interest Bearing Current Account
                                        let runningBalance = 0;
                                        
                                        return transactions.map((entry, idx) => {
                                          // Update running balance
                                          runningBalance += (parseFloat(entry.debit_amount) || 0) - (parseFloat(entry.credit_amount) || 0);
                                          
                                          return (
                                            <TableRow key={entry.id || idx} className="bg-white hover:bg-slate-50">
                                              <TableCell className="w-12"></TableCell>
                                              <TableCell className="text-sm text-slate-700 w-32">{formatDate(entry.entry_date)}</TableCell>
                                              <TableCell className="text-sm text-slate-700 w-96">{entry.description || '—'}</TableCell>
                                              <TableCell className="text-sm font-mono text-slate-600 w-32">{entry.reference || '—'}</TableCell>
                                              <TableCell className="text-sm text-right font-mono text-slate-700 w-32 px-4">
                                                {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : ''}
                                              </TableCell>
                                              <TableCell className="text-sm text-right font-mono text-slate-700 w-32 px-4">
                                                {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : ''}
                                              </TableCell>
                                              <TableCell className="text-sm text-right font-mono font-semibold text-green-700 w-32 px-4">
                                                {isInterestBearingAccount ? formatCurrency(runningBalance) : ''}
                                              </TableCell>
                                              <TableCell className="text-center w-24">
                                                <div className="flex items-center justify-center gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleViewVoucher(entry);
                                                    }}
                                                    disabled={viewingDocument === entry.id}
                                                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    title="View Voucher"
                                                  >
                                                    {viewingDocument === entry.id ? (
                                                      <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                      <Eye className="w-4 h-4" />
                                                    )}
                                                  </Button>
                                                  {canDeleteTransactions && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEntry(entry.id, account.account_code);
                                                      }}
                                                      disabled={deletingEntry === entry.id}
                                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                      title="Delete Entry"
                                                    >
                                                      {deletingEntry === entry.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                      ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                      )}
                                                    </Button>
                                                  )}
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          );
                                        });
                                      })()}
                                    </TableBody>
                                  </Table>
                                )}
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}

                <TableRow className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                  <TableCell className="w-12"></TableCell>
                  <TableCell className="w-32"></TableCell>
                  <TableCell className="w-96"></TableCell>
                  <TableCell className="w-32 font-semibold text-xs">Totals:</TableCell>
                  <TableCell className="text-right font-mono w-32 px-4">{formatCurrency(totals.totalDebits)}</TableCell>
                  <TableCell className="text-right font-mono w-32 px-4">{formatCurrency(totals.totalCredits)}</TableCell>
                  <TableCell className="w-32"></TableCell>
                  <TableCell className="w-24"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <div className="mt-4 p-3 bg-slate-50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Balance Check:</span>
                <span className={`font-mono ${Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
                    ? '✓ Balanced' 
                    : `Difference: £${formatCurrency(Math.abs(totals.totalDebits - totals.totalCredits))}`
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* VAT Allocation History Modal */}
      <Dialog open={showVATHistory} onOpenChange={setShowVATHistory}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">VAT Allocation History</DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Loading history...</span>
              </div>
            ) : vatHistory.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No Allocation History</h3>
                <p className="text-slate-500">
                  No VAT allocations have been made for this case yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  Total allocations: <span className="font-semibold">{vatHistory.length}</span>
                </p>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">VAT Receivable</TableHead>
                      <TableHead className="text-right">VAT Payable</TableHead>
                      <TableHead className="text-right">Net to Control</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatHistory.map((record, index) => (
                      <TableRow key={record.transaction_id || index}>
                        <TableCell className="font-medium">
                          {formatDate(record.date)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {record.reference}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.vat_receivable_allocated > 0 
                            ? `£${formatCurrency(record.vat_receivable_allocated)}`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {record.vat_payable_allocated > 0 
                            ? `£${formatCurrency(record.vat_payable_allocated)}`
                            : '—'
                          }
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          £${formatCurrency(record.net_to_control)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewAllocationDetail(record)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* VAT Allocation Detail Modal */}
      <Dialog open={showAllocationDetail} onOpenChange={setShowAllocationDetail}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">VAT Allocation Journal Entries</DialogTitle>
          </DialogHeader>
          
          {selectedAllocationEntries && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-600">Date</p>
                  <p className="font-semibold">{formatDate(selectedAllocationEntries.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-600">Reference</p>
                  <p className="font-semibold font-mono text-sm">{selectedAllocationEntries.reference}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Journal Entries:</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Debit (£)</TableHead>
                      <TableHead className="text-right">Credit (£)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedAllocationEntries.entries.map((entry, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{entry.account_code}</TableCell>
                        <TableCell>{entry.account_name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{entry.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-slate-300 font-semibold bg-slate-50">
                      <TableCell colSpan={3} className="text-right">Totals:</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(selectedAllocationEntries.entries.reduce((sum, e) => sum + (e.debit_amount || 0), 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(selectedAllocationEntries.entries.reduce((sum, e) => sum + (e.credit_amount || 0), 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// Helper function to generate voucher HTML with signatures from User Management
const generateVoucherHTML = (transaction, caseDetails, chartOfAccounts, users = []) => {
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
    return Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
    } catch (e) {
      return 'N/A';
    }
  };

  const getAccountName = (code) => {
    if (!code) return 'Unknown Account';
    const account = chartOfAccounts.find(a => a.account_code === code);
    return account?.account_name || code || 'Unknown Account';
  };

  const isPDF = (url) => {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || urlLower.includes('pdf');
  };

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
  } = transaction;

  // Helper function to find user by grade and name
  const findUserByGradeAndName = (grade, name) => {
    if (!name) return null;
    return users.find(u => u.grade === grade && u.full_name?.toLowerCase().includes(name.toLowerCase()));
  };

  // Look up submitter's signature from User Management
  let submitterUser = users.find(u => u.email === signed_by);
  // Fallback: try to find by name if email match fails
  if (!submitterUser && office_holder_signature) {
    submitterUser = users.find(u => u.full_name === office_holder_signature);
  }
  // Fallback: if grade is IP, check case IP names (Duncan, Rupen, Nimish)
  if (!submitterUser && approver_grade === 'IP') {
    submitterUser = findUserByGradeAndName('IP', caseDetails.ip_name) || 
                    findUserByGradeAndName('IP', caseDetails.joint_ip_name) || 
                    findUserByGradeAndName('IP', caseDetails.joint_ip_name_2);
  }
  // Fallback: if grade is Cashier, check case cashiering_user
  if (!submitterUser && approver_grade === 'Cashier') {
    submitterUser = users.find(u => u.email === caseDetails.cashiering_user);
  }
  
  const submitterSignature = signature_image_url || submitterUser?.signature_image_url;
  const submitterName = office_holder_signature || submitterUser?.full_name || signed_by || 'Unknown';

  // Look up approver's signature from User Management
  let approverUser = users.find(u => u.email === transaction.approver_signed_by);
  // Fallback: try to find by name if email match fails
  if (!approverUser && transaction.approver_name) {
    approverUser = users.find(u => u.full_name === transaction.approver_name);
  }
  // Fallback: if grade is IP, check case IP names (Duncan, Rupen, Nimish)
  if (!approverUser && transaction.approver_grade === 'IP') {
    approverUser = findUserByGradeAndName('IP', caseDetails.ip_name) || 
                   findUserByGradeAndName('IP', caseDetails.joint_ip_name) || 
                   findUserByGradeAndName('IP', caseDetails.joint_ip_name_2);
  }
  // Fallback: if grade is Cashier, check case cashiering_user
  if (!approverUser && transaction.approver_grade === 'Cashier') {
    approverUser = users.find(u => u.email === caseDetails.cashiering_user);
  }
  
  const approverSignature = transaction.approver_signature_url || approverUser?.signature_image_url;
  const approverName = transaction.approver_name || approverUser?.full_name || transaction.approver_signed_by || 'Unknown';

  const bankAccountCode = target_account === 'primary' ?
    caseDetails.bank_details?.chart_of_accounts :
    caseDetails.secondary_bank_details?.chart_of_accounts;

  const bankAccountName = target_account === 'primary' ?
    `${caseDetails.bank_details?.bank_name || 'Unknown Bank'} (${caseDetails.bank_details?.account_type || 'Unknown Type'})` :
    `${caseDetails.secondary_bank_details?.bank_name || 'Unknown Bank'} (${caseDetails.secondary_bank_details?.account_type || 'Unknown Type'})`;

  const numNetAmount = parseFloat(net_amount) || 0;
  const numVatAmount = parseFloat(vat_amount) || 0;
  const numGrossAmount = parseFloat(amount) || 0;

  const journalEntries = [];
  if (transaction_type === 'payment') {
    journalEntries.push({ account: getAccountName(account_code), code: account_code, debit: numNetAmount, credit: 0 });
    if (numVatAmount > 0) {
      journalEntries.push({ account: 'VAT on Purchases', code: 'VAT001', debit: numVatAmount, credit: 0 });
    }
    journalEntries.push({ account: 'Cash at Bank', code: bankAccountCode || 'BANK001', debit: 0, credit: numGrossAmount });
  } else {
    journalEntries.push({ account: 'Cash at Bank', code: bankAccountCode || 'BANK001', debit: numGrossAmount, credit: 0 });
    journalEntries.push({ account: getAccountName(account_code), code: account_code || 'UNKNOWN', debit: 0, credit: numVatAmount > 0 ? numNetAmount : numGrossAmount });
    if (numVatAmount > 0) {
      journalEntries.push({ account: 'VAT on Sales', code: 'VAT002', debit: 0, credit: numVatAmount });
    }
  }

  const totals = journalEntries.reduce((acc, entry) => {
    acc.debit += entry.debit;
    acc.credit += entry.credit;
    return acc;
  }, { debit: 0, credit: 0 });

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
      <title>Transaction Payment Voucher - ${reference}</title>
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
            Case: <strong>${caseDetails.company_name || 'N/A'}</strong> (${caseDetails.case_reference || 'N/A'})
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
              <span class="badge ${transaction_type === 'receipt' ? 'badge-receipt' : 'badge-payment'}">
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
            ${journalEntries.map(entry => `
              <tr>
                <td>${entry.account}</td>
                <td class="font-mono">${entry.code}</td>
                <td class="text-right font-mono">${entry.debit > 0 ? formatCurrency(entry.debit) : ''}</td>
                <td class="text-right font-mono">${entry.credit > 0 ? formatCurrency(entry.credit) : ''}</td>
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
            <span class="vat-code">${transaction_type === 'payment' ? 'VAT001' : 'VAT002'}</span>.
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
                    ${approver_grade}
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
                ${transaction.approver_grade ? `
                  <div style="font-size: 9px; color: #A57C00; font-weight: 600; margin-bottom: 2px;">
                    ${transaction.approver_grade}
                  </div>
                ` : ''}
                <div style="font-size: 9px; color: #6b7280;">
                  Date: ${transaction.approver_signed_date ? formatDate(transaction.approver_signed_date) : 'N/A'}
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
        window.addEventListener('afterprint', function() {
          window.close();
        });
      </script>
    </body>
    </html>
  `;
};