
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Loader2, Shield, Plus, TrendingUp, FileText, Edit, Calculator, RefreshCw, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BankReconciliation from './BankReconciliation';

const safeString = (value, defaultValue = '') => value || defaultValue;
const safeNumber = (value, defaultValue = 0) => {
  const num = parseFloat(value);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

const formatCurrency = (amount) => {
  return safeNumber(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

const parseFormattedNumber = (value) => {
  return String(value || '').replace(/,/g, '');
};

const formatNumberWithCommas = (value) => {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue === '' || stringValue === '.') return stringValue;
  const parts = stringValue.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

export default function BondingActions({ 
  selectedCase, 
  selectedOption, 
  onClose, 
  bondingRates, 
  currentUser,
  users,
  onUpdate 
}) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [bondFormData, setBondFormData] = useState({
    soa_etr: '',
    selected_bond_level: '',
    bond_premium: '',
    bond_date: new Date().toISOString().split('T')[0],
    submitted_by: ''
  });

  const [bondIncreaseFormData, setBondIncreaseFormData] = useState({
    selected_bond_level: '',
    bond_premium: '',
    bond_date: new Date().toISOString().split('T')[0],
    submitted_by: ''
  });

  const [bondClosureFormData, setBondClosureFormData] = useState({
    bond_level: '',
    closure_date: new Date().toISOString().split('T')[0],
    bond_premium: '',
    submitted_by: ''
  });

  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [editedHistoryData, setEditedHistoryData] = useState({
    initial_bond_value: '',
    bond_signed_date: ''
  });

  const [bondIncreases, setBondIncreases] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // NEW: State for VAT module
  const [activeVatTab, setActiveVatTab] = useState('vat_return');
  const [vatReturnData, setVatReturnData] = useState({
    date_from: '',
    date_to: '',
    box1: '',
    box2: '0',
    box3: '',
    box4: '',
    box5: '',
    box6: '',
    box7: '',
    box8: '0',
    box9: '0'
  });

  // NEW: State for VAT426
  const [vat426Data, setVat426Data] = useState({
    date_from: '',
    date_to: '',
    entries: []
  });
  const [isLoadingVat426, setIsLoadingVat426] = useState(false);

  // NEW: State for VAT427
  const [vat427Data, setVat427Data] = useState({
    date_from: '',
    date_to: '',
    entries: []
  });
  const [isLoadingVat427, setIsLoadingVat427] = useState(false);

  // NEW: State for VAT history
  const [vatHistory, setVatHistory] = useState([]);
  const [isLoadingVatHistory, setIsLoadingVatHistory] = useState(false);

  // NEW: Load VAT data from accounting entries, excluding VAT Allocation entries
  useEffect(() => {
    const loadVATData = async () => {
      if (selectedOption === 'vat' && activeVatTab === 'vat_return' && selectedCase?.id) {
        try {
          console.log('=== VAT DATA LOADING - BOX 6 BREAKDOWN ===');
          
          // Fetch chart of accounts to identify AA and CO type accounts
          const chartOfAccounts = await base44.entities.ChartOfAccount.list();
          const aaAccounts = chartOfAccounts.filter(account => account.account_type === 'AA');
          const aaAccountCodes = aaAccounts.map(account => account.account_code);
          
          console.log('AA Account Codes found:', aaAccountCodes);
          console.log('AA Accounts details:', aaAccounts.map(a => ({ code: a.account_code, name: a.account_name })));
          
          const coAccountCodes = chartOfAccounts
            .filter(account => account.account_type === 'CO')
            .map(account => account.account_code);

          // Fetch transactions to filter for approved only
          const transactions = await base44.entities.Transaction.filter({
            case_id: selectedCase.id
          });

          console.log('Total transactions:', transactions.length);
          
          // Get IDs of approved transactions only (these are on the trial balance)
          const approvedTransactionIds = transactions
            .filter(t => t.status === 'approved')
            .map(t => t.id);
          
          console.log('Approved transactions:', approvedTransactionIds.length);
          console.log('Pending/Draft transactions excluded:', transactions.length - approvedTransactionIds.length);

          // Fetch accounting entries for VAT accounts and CO accounts
          const accountingEntries = await base44.entities.AccountingEntry.filter({
            case_id: selectedCase.id
          });

          console.log('Total accounting entries:', accountingEntries.length);

          // Filter to only entries from approved transactions (on trial balance)
          const approvedEntries = accountingEntries.filter(e => 
            e.transaction_id && approvedTransactionIds.includes(e.transaction_id)
          );

          console.log('Approved accounting entries:', approvedEntries.length);
          console.log('Unapproved entries excluded:', accountingEntries.length - approvedEntries.length);

          // Filter out VAT Allocation to Control Account entries
          const nonAllocationEntries = approvedEntries.filter(e => 
            e.description !== 'VAT Allocation to Control Account'
          );

          console.log('Non-allocation entries:', nonAllocationEntries.length);

          // Calculate VAT002 balance (VAT on Sales) - credits minus debits
          const vat002Entries = nonAllocationEntries.filter(e => e.account_code === 'VAT002');
          const vat002Balance = vat002Entries.reduce((sum, entry) => {
            return sum + safeNumber(entry.credit_amount) - safeNumber(entry.debit_amount);
          }, 0);

          // Calculate VAT001 balance (VAT on Purchases) - debits minus credits
          const vat001Entries = nonAllocationEntries.filter(e => e.account_code === 'VAT001');
          const vat001Balance = vat001Entries.reduce((sum, entry) => {
            return sum + safeNumber(entry.debit_amount) - safeNumber(entry.credit_amount);
          }, 0);

          // Calculate Box 6 from AA account type entries - debits minus credits
          const aaEntries = nonAllocationEntries.filter(e => aaAccountCodes.includes(e.account_code));
          
          console.log('=== BOX 6 CALCULATION BREAKDOWN ===');
          console.log('Total AA entries found (approved only):', aaEntries.length);
          
          let box6Balance = 0;
          aaEntries.forEach((entry, index) => {
            const debit = safeNumber(entry.debit_amount);
            const credit = safeNumber(entry.credit_amount);
            const net = debit - credit;
            box6Balance += net;
            
            console.log(`Entry ${index + 1}:`, {
              date: entry.entry_date,
              account_code: entry.account_code,
              account_name: entry.account_name,
              description: entry.description,
              transaction_id: entry.transaction_id,
              debit: debit.toFixed(2),
              credit: credit.toFixed(2),
              net: net.toFixed(2),
              running_total: box6Balance.toFixed(2)
            });
          });
          
          console.log('Final Box 6 Balance (Approved Transactions Only):', box6Balance.toFixed(2));
          console.log('===================================');

          // Calculate Box 7 from CO account type entries - debits minus credits
          const coEntries = nonAllocationEntries.filter(e => coAccountCodes.includes(e.account_code));
          const box7Balance = coEntries.reduce((sum, entry) => {
            return sum + safeNumber(entry.debit_amount) - safeNumber(entry.credit_amount);
          }, 0);

          // Auto-populate boxes with correct calculations
          const box1Value = vat002Balance.toFixed(2);
          const box2Value = '0'; // Box 2 defaults to 0
          const box4Value = vat001Balance.toFixed(2);
          const box3Value = (safeNumber(box1Value) + safeNumber(box2Value)).toFixed(2); // Box 3 = Box 1 + Box 2
          const box5Value = (safeNumber(box3Value) - safeNumber(box4Value)).toFixed(2); // Box 5 = Box 3 - Box 4 (positive means due to HMRC, negative means refund)
          const box6Value = Math.abs(box6Balance).toFixed(2); // Remove negative sign
          const box7Value = box7Balance.toFixed(2);

          setVatReturnData({
            date_from: selectedCase.appointment_date || '',
            date_to: '',
            box1: box1Value,
            box2: box2Value,
            box3: box3Value,
            box4: box4Value,
            box5: box5Value,
            box6: box6Value,
            box7: box7Value,
            box8: '0',
            box9: '0'
          });
        } catch (error) {
          console.error('Error loading VAT data:', error);
        }
      }
    };

    loadVATData();
  }, [selectedOption, activeVatTab, selectedCase?.id, selectedCase?.appointment_date]);

  // NEW: Load VAT426 data from payment vouchers in documents
  useEffect(() => {
    const loadVat426Data = async () => {
      if (activeVatTab === 'vat426' && selectedCase?.id && vat426Data.date_from && vat426Data.date_to) {
        setIsLoadingVat426(true);
        try {
          console.log('=== VAT426 DATA LOADING ===');
          console.log('Case ID:', selectedCase.id);
          console.log('Date range:', vat426Data.date_from, 'to', vat426Data.date_to);

          // Fetch approved payment transactions directly
          const allTransactions = await base44.entities.Transaction.filter({
            case_id: selectedCase.id,
            transaction_type: 'payment',
            status: 'approved'
          });

          console.log('Found approved payment transactions:', allTransactions.length);

          // Filter by invoice date range
          const dateFrom = new Date(vat426Data.date_from);
          dateFrom.setHours(0, 0, 0, 0);
          const dateTo = new Date(vat426Data.date_to);
          dateTo.setHours(23, 59, 59, 999);
          
          const entries = [];

          for (const transaction of allTransactions) {
            try {
              console.log('Processing transaction:', transaction.id);
              
              // Use invoice date if available, otherwise use transaction date
              const invoiceDateStr = transaction.date_of_invoice || transaction.transaction_date;
              
              if (!invoiceDateStr) {
                console.log('No date found for transaction:', transaction.id);
                continue;
              }
              
              const invoiceDate = new Date(invoiceDateStr);
              
              console.log('Comparing dates - Invoice:', invoiceDate.toISOString(), 'From:', dateFrom.toISOString(), 'To:', dateTo.toISOString());
              
              // Check if invoice date is within range
              if (invoiceDate < dateFrom || invoiceDate > dateTo) {
                console.log('Date out of range - skipping');
                continue;
              }

              console.log('Date in range - processing entry');

              // Determine tax year based on invoice date (April 5 to April 4)
              const year = invoiceDate.getFullYear();
              const month = invoiceDate.getMonth() + 1;
              const day = invoiceDate.getDate();
              
              let taxYear;
              if (month > 4 || (month === 4 && day >= 5)) {
                // Format as YY/YY (e.g., 25/26 for 2025/2026)
                const currentYearShort = String(year).slice(-2);
                const nextYearShort = String(year + 1).slice(-2);
                taxYear = `${currentYearShort}/${nextYearShort}`;
              } else {
                // Format as YY/YY (e.g., 24/25 for 2024/2025)
                const prevYearShort = String(year - 1).slice(-2);
                const currentYearShort = String(year).slice(-2);
                taxYear = `${prevYearShort}/${currentYearShort}`;
              }

              // Extract VAT amount
              const vatAmount = safeNumber(transaction.vat_amount || 0);

              // Only include transactions with VAT > 0
              if (vatAmount <= 0) {
                console.log('Skipping transaction with no VAT:', transaction.id);
                continue;
              }

              // Extract supplier/payee name
              const supplierName = transaction.payee_name || 'N/A';

              // Extract invoice number
              const invoiceNumber = transaction.invoice_number || transaction.reference || 'N/A';

              // Extract description
              const description = transaction.description || 'N/A';

              console.log('Adding entry:', { supplierName, invoiceNumber, description, vatAmount, taxYear });

              entries.push({
                id: transaction.id,
                supplier_name: supplierName,
                supplier_reference: invoiceNumber,
                type_of_goods: description,
                tax_point: taxYear,
                date_of_invoice: invoiceDateStr,
                vat_amount_pounds: Math.floor(vatAmount),
                vat_amount_pence: Math.round((vatAmount % 1) * 100)
              });
            } catch (parseError) {
              console.error('Error processing transaction:', parseError, transaction);
              continue;
            }
          }

          console.log('Final entries count:', entries.length);
          console.log('Final entries:', entries);
          console.log('=========================');

          // Sort by invoice date
          entries.sort((a, b) => new Date(a.date_of_invoice).getTime() - new Date(b.date_of_invoice).getTime());

          setVat426Data(prev => ({ ...prev, entries }));
        } catch (error) {
          console.error('Error loading VAT426 data:', error);
        } finally {
          setIsLoadingVat426(false);
        }
      }
    };

    loadVat426Data();
  }, [activeVatTab, selectedCase?.id, vat426Data.date_from, vat426Data.date_to]);

  // NEW: Load VAT427 data from payment vouchers in documents (same as VAT426 but with supplier address)
  useEffect(() => {
    const loadVat427Data = async () => {
      if (activeVatTab === 'vat427' && selectedCase?.id && vat427Data.date_from && vat427Data.date_to) {
        setIsLoadingVat427(true);
        try {
          console.log('=== VAT427 DATA LOADING ===');
          console.log('Case ID:', selectedCase.id);
          console.log('Date range:', vat427Data.date_from, 'to', vat427Data.date_to);

          // Fetch approved payment transactions directly
          const allTransactions = await base44.entities.Transaction.filter({
            case_id: selectedCase.id,
            transaction_type: 'payment',
            status: 'approved'
          });

          console.log('Found approved payment transactions:', allTransactions.length);

          // Filter by invoice date range
          const dateFrom = new Date(vat427Data.date_from);
          dateFrom.setHours(0, 0, 0, 0);
          const dateTo = new Date(vat427Data.date_to);
          dateTo.setHours(23, 59, 59, 999);
          
          const entries = [];

          for (const transaction of allTransactions) {
            try {
              console.log('Processing transaction:', transaction.id);
              
              // Use invoice date if available, otherwise use transaction date
              const invoiceDateStr = transaction.date_of_invoice || transaction.transaction_date;
              
              if (!invoiceDateStr) {
                console.log('No date found for transaction:', transaction.id);
                continue;
              }
              
              const invoiceDate = new Date(invoiceDateStr);
              
              console.log('Comparing dates - Invoice:', invoiceDate.toISOString(), 'From:', dateFrom.toISOString(), 'To:', dateTo.toISOString());
              
              // Check if invoice date is within range
              if (invoiceDate < dateFrom || invoiceDate > dateTo) {
                console.log('Date out of range - skipping');
                continue;
              }

              console.log('Date in range - processing entry');

              // Determine tax year based on invoice date (April 5 to April 4)
              const year = invoiceDate.getFullYear();
              const month = invoiceDate.getMonth() + 1;
              const day = invoiceDate.getDate();
              
              let taxYear;
              if (month > 4 || (month === 4 && day >= 5)) {
                const currentYearShort = String(year).slice(-2);
                const nextYearShort = String(year + 1).slice(-2);
                taxYear = `${currentYearShort}/${nextYearShort}`;
              } else {
                const prevYearShort = String(year - 1).slice(-2);
                const currentYearShort = String(year).slice(-2);
                taxYear = `${prevYearShort}/${currentYearShort}`;
              }

              // Extract VAT amount
              const vatAmount = safeNumber(transaction.vat_amount || 0);

              // Only include transactions with VAT > 0
              if (vatAmount <= 0) {
                console.log('Skipping transaction with no VAT:', transaction.id);
                continue;
              }

              // Extract supplier/payee name
              const supplierName = transaction.payee_name || 'N/A';

              // Extract invoice number
              const invoiceNumber = transaction.invoice_number || transaction.reference || 'N/A';

              // Extract description
              const description = transaction.description || 'N/A';

              console.log('Adding entry:', { supplierName, invoiceNumber, description, vatAmount, taxYear });

              entries.push({
                id: transaction.id,
                supplier_name: supplierName,
                supplier_address: '', // Empty by default, will be editable
                supplier_reference: invoiceNumber,
                type_of_goods: description,
                tax_point: taxYear,
                date_of_invoice: invoiceDateStr,
                vat_amount_pounds: Math.floor(vatAmount),
                vat_amount_pence: Math.round((vatAmount % 1) * 100)
              });
            } catch (parseError) {
              console.error('Error processing transaction:', parseError, transaction);
              continue;
            }
          }

          console.log('Final entries count:', entries.length);
          console.log('Final entries:', entries);
          console.log('=========================');

          // Sort by invoice date
          entries.sort((a, b) => new Date(a.date_of_invoice).getTime() - new Date(b.date_of_invoice).getTime());

          setVat427Data(prev => ({ ...prev, entries }));
        } catch (error) {
          console.error('Error loading VAT427 data:', error);
        } finally {
          setIsLoadingVat427(false);
        }
      }
    };

    loadVat427Data();
  }, [activeVatTab, selectedCase?.id, vat427Data.date_from, vat427Data.date_to]);

  // NEW: Load VAT history from documents
  useEffect(() => {
    const loadVatHistory = async () => {
      if (activeVatTab === 'history' && selectedCase?.id) {
        setIsLoadingVatHistory(true);
        try {
          // Fetch VAT-related documents
          const documents = await base44.entities.Document.filter({
            case_id: selectedCase.id
          });
          
          const vatDocs = documents.filter(doc => 
            doc.doc_type && (
              doc.doc_type.includes('VAT Return') || 
              doc.doc_type.includes('VAT 426') ||
              doc.doc_type.includes('VAT 427') || // Added VAT 427
              doc.doc_type.includes('VAT833')
            )
          );
          
          // Parse and format the history
          const history = vatDocs.map(doc => {
            try {
              const data = doc.raw_text ? JSON.parse(doc.raw_text) : {};
              const sumValue = data.sum !== undefined ? data.sum : data.box5 !== undefined ? data.box5 : 0;

              return {
                id: doc.id,
                type: doc.doc_type,
                date_from: data.date_from || 'N/A',
                date_to: data.date_to || 'N/A',
                sum: sumValue,
                created_date: doc.created_date,
                file_url: doc.file_url
              };
            } catch (e) {
              console.error('Error parsing raw_text for VAT document:', doc.id, e);
              return null;
            }
          }).filter(item => item !== null);
          
          setVatHistory(history);
        } catch (error) {
          console.error('Error loading VAT history:', error);
        } finally {
          setIsLoadingVatHistory(false);
        }
      }
    };
    
    loadVatHistory();
  }, [activeVatTab, selectedCase?.id]);

  // Set submitted_by when component mounts or selectedCase changes
  useEffect(() => {
    if (selectedCase && (selectedOption === 'set_up_bond' || selectedOption === 'increase_bond' || selectedOption === 'close_bond')) {
      const cashierEmail = selectedCase.cashiering_user;
      if (cashierEmail && users) {
        const cashierUser = users.find(u => u.email === cashierEmail);
        if (cashierUser) {
          if (selectedOption === 'set_up_bond') {
            setBondFormData(prev => ({
              ...prev,
              submitted_by: cashierUser.full_name || cashierEmail
            }));
          } else if (selectedOption === 'increase_bond') {
            setBondIncreaseFormData(prev => ({
              ...prev,
              submitted_by: cashierUser.full_name || cashierEmail
            }));
          } else if (selectedOption === 'close_bond') {
            setBondClosureFormData(prev => ({
              ...prev,
              submitted_by: cashierUser.full_name || cashierEmail
            }));
          }
        } else {
          if (selectedOption === 'set_up_bond') {
            setBondFormData(prev => ({ ...prev, submitted_by: cashierEmail }));
          } else if (selectedOption === 'increase_bond') {
            setBondIncreaseFormData(prev => ({ ...prev, submitted_by: cashierEmail }));
          } else if (selectedOption === 'close_bond') {
            setBondClosureFormData(prev => ({ ...prev, submitted_by: cashierEmail }));
          }
        }
      } else if (currentUser) {
        if (selectedOption === 'set_up_bond') {
          setBondFormData(prev => ({ 
            ...prev, 
            submitted_by: currentUser.full_name || '' 
          }));
        } else if (selectedOption === 'increase_bond') {
          setBondIncreaseFormData(prev => ({ 
            ...prev, 
            submitted_by: currentUser.full_name || '' 
          }));
        } else if (selectedOption === 'close_bond') {
          setBondClosureFormData(prev => ({ 
            ...prev, 
            submitted_by: currentUser.full_name || '' 
          }));
        }
      }
    }
  }, [selectedCase, selectedOption, users, currentUser]);

  // Initialize edit form data when viewing bond history
  useEffect(() => {
    if (selectedOption === 'bond_history' && selectedCase) {
      setEditedHistoryData({
        initial_bond_value: selectedCase.initial_bond_value || '',
        bond_signed_date: selectedCase.bond_signed_date || ''
      });
      setBondIncreases(selectedCase.bond_increases || []);
    }
  }, [selectedOption, selectedCase]);

  // Initialize bond closure form with current bond level
  useEffect(() => {
    if (selectedOption === 'close_bond' && selectedCase) {
      const increases = selectedCase.bond_increases || [];
      const totalIncreases = increases.reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0);
      const currentBondLevel = safeNumber(selectedCase.initial_bond_value) + totalIncreases;
      setBondClosureFormData(prev => ({
        ...prev,
        bond_level: currentBondLevel.toString(),
        bond_premium: currentBondLevel.toString()
      }));
    }
  }, [selectedOption, selectedCase]);

  const handleBondLevelChange = (selectedRateId) => {
    setBondFormData((prev) => {
      const updatedData = { ...prev, selected_bond_level: selectedRateId };
      const matchingRate = bondingRates.find(rate => rate.id === selectedRateId);

      if (matchingRate && selectedCase) {
        const caseType = selectedCase.case_type?.toUpperCase();
        const premium = caseType === 'MVL' ? 
          safeNumber(matchingRate.premium_mvl) : 
          safeNumber(matchingRate.premium_corporate);
        updatedData.bond_premium = premium;
      } else {
        updatedData.bond_premium = '';
      }

      return updatedData;
    });
  };

  const handleBondIncreaseLevelChange = (selectedRateId) => {
    setBondIncreaseFormData((prev) => {
      const updatedData = { ...prev, selected_bond_level: selectedRateId };
      const matchingRate = bondingRates.find(rate => rate.id === selectedRateId);

      if (matchingRate && selectedCase) {
        const caseType = selectedCase.case_type?.toUpperCase();
        const newBondPremium = caseType === 'MVL' ? 
          safeNumber(matchingRate.premium_mvl) : 
          safeNumber(matchingRate.premium_corporate);
        
        // Calculate the difference (increase) from the current bond value
        const increases = selectedCase.bond_increases || [];
        const totalIncreases = increases.reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0);
        const currentBondValue = safeNumber(selectedCase.initial_bond_value) + totalIncreases;
        const increasePremium = Math.max(0, newBondPremium - currentBondValue);
        
        updatedData.bond_premium = increasePremium;
      } else {
        updatedData.bond_premium = '';
      }

      return updatedData;
    });
  };

  const handleSaveBondSetup = async () => {
    if (!bondFormData.soa_etr || !bondFormData.selected_bond_level || !bondFormData.bond_date) {
      alert('Please complete all required fields.');
      return;
    }

    setIsSaving(true);

    try {
      const bondPremium = safeNumber(bondFormData.bond_premium);
      const selectedRate = bondingRates.find(rate => rate.id === bondFormData.selected_bond_level);

      await base44.entities.Case.update(selectedCase.id, {
        soa_etr: safeNumber(parseFormattedNumber(bondFormData.soa_etr)),
        initial_bond_value: bondPremium,
        bond_signed_by: currentUser?.full_name,
        bond_signed_date: bondFormData.bond_date,
        bond_submitted_by: bondFormData.submitted_by
      });

      // Generate bond setup document HTML
      const bondSetupHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bond Setup - ${selectedCase.case_reference}</title>
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
                <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Company Name</div>
                <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Case Type</div>
                <div class="info-value">${selectedCase.case_type || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Appointment Date</div>
                <div class="info-value">${selectedCase.appointment_date ? formatDate(selectedCase.appointment_date) : 'N/A'}</div>
              </div>
            </div>
          </div>

          <h2>Bond Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Statement of Affairs ETR</div>
              <div class="info-value">£${formatCurrency(safeNumber(parseFormattedNumber(bondFormData.soa_etr)))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Bond Date</div>
              <div class="info-value">${formatDate(bondFormData.bond_date)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Bond Level Range</div>
              <div class="info-value">${selectedRate ? `£${formatCurrency(selectedRate.range_min)} - ${selectedRate.range_max ? `£${formatCurrency(selectedRate.range_max)}` : 'No limit'}` : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Specific Bond Amount</div>
              <div class="info-value">£${selectedRate ? formatCurrency(selectedRate.specific_bond_amount) : '0.00'}</div>
            </div>
          </div>

          <div class="premium-section">
            <h2 style="margin-top: 0; border: none;">Bond Premium by Insolvency Practitioner</h2>
            <div class="premium-grid">
              ${selectedCase.ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(bondPremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(bondPremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name_2 ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name_2}</div>
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
                  ${bondFormData.submitted_by || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Signed By</div>
                <div class="info-value" style="font-size: 12px; font-weight: 600;">
                  ${currentUser?.full_name || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Date</div>
                <div class="info-value">${formatDate(bondFormData.bond_date)}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([bondSetupHTML], { type: 'text/html' });
      const filename = `BOND-${selectedCase.case_reference}-${bondFormData.bond_date.replace(/-/g, '')}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Document.create({
        case_id: selectedCase.id,
        file_url: uploadResult.file_url,
        doc_type: 'Bonding',
        raw_text: JSON.stringify({
          case_id: selectedCase.id,
          soa_etr: safeNumber(parseFormattedNumber(bondFormData.soa_etr)),
          bond_date: bondFormData.bond_date,
          bond_premium: bondPremium,
          bond_level_range: selectedRate ? 
            `£${formatCurrency(selectedRate.range_min)} - ${selectedRate.range_max ? `£${formatCurrency(selectedRate.range_max)}` : 'No limit'}` : 
            'N/A',
          specific_bond_amount: selectedRate ? selectedRate.specific_bond_amount : 0,
          submitted_by: bondFormData.submitted_by,
          signed_by: currentUser?.full_name
        })
      });

      alert('Bond setup completed successfully!');
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Error saving bond setup:', error);
      alert('Failed to save bond setup: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveIncreaseBond = async () => {
    if (!bondIncreaseFormData.selected_bond_level || !bondIncreaseFormData.bond_date) {
      alert('Please complete all required fields.');
      return;
    }

    setIsSaving(true);

    try {
      const increasePremium = safeNumber(bondIncreaseFormData.bond_premium);
      const selectedRate = bondingRates.find(rate => rate.id === bondIncreaseFormData.selected_bond_level);

      // Add new increase to the bond_increases array
      const currentIncreases = selectedCase.bond_increases || [];
      const newIncrease = {
        increase_value: increasePremium,
        increase_date: bondIncreaseFormData.bond_date,
        submitted_by: bondIncreaseFormData.submitted_by,
        signed_by: currentUser?.email,
        approver_name: currentUser?.full_name,
        signed_date: new Date().toISOString()
      };

      await base44.entities.Case.update(selectedCase.id, {
        bond_increases: [...currentIncreases, newIncrease]
      });

      // Generate bond increase document HTML
      const bondIncreaseHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bond Increase - ${selectedCase.case_reference}</title>
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
              color: #10b981;
              border-bottom: 3px solid #10b981;
              padding-bottom: 10px;
            }
            h2 { 
              font-size: 14px; 
              font-weight: 600; 
              margin: 20px 0 10px 0;
              color: #10b981;
              border-bottom: 2px solid #a7f3d0;
              padding-bottom: 5px;
            }
            .header-info { 
              background-color: #f0fdf4; 
              border: 2px solid #10b981; 
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
              color: #10b981; 
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
              background-color: #f0fdf4;
              border: 2px solid #10b981;
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
              border: 2px solid #a7f3d0;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .premium-name {
              font-weight: 600;
              color: #10b981;
              margin-bottom: 10px;
              font-size: 12px;
            }
            .premium-amount {
              font-size: 24px;
              font-weight: bold;
              color: #10b981;
            }
            .signature-section {
              margin-top: 30px;
              padding: 15px;
              border: 2px solid #10b981;
              border-radius: 5px;
              background-color: #f0fdf4;
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
          <h1>Bond Increase</h1>
          
          <div class="header-info">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Case Reference</div>
                <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Company Name</div>
                <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Case Type</div>
                <div class="info-value">${selectedCase.case_type || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Appointment Date</div>
                <div class="info-value">${selectedCase.appointment_date ? formatDate(selectedCase.appointment_date) : 'N/A'}</div>
              </div>
            </div>
          </div>

          <h2>Bond Increase Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Revised Bond Level</div>
              <div class="info-value">${selectedRate ? `£${formatCurrency(selectedRate.range_min)} - ${selectedRate.range_max ? `£${formatCurrency(selectedRate.range_max)}` : 'No limit'}` : 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Bond Date</div>
              <div class="info-value">${formatDate(bondIncreaseFormData.bond_date)}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Previous Bond Value</div>
              <div class="info-value">£${formatCurrency(
                safeNumber(selectedCase.initial_bond_value) + 
                (selectedCase.bond_increases || []).reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0) - 
                increasePremium
              )}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Increase Amount</div>
              <div class="info-value">£${formatCurrency(increasePremium)}</div>
            </div>
          </div>

          <div class="premium-section">
            <h2 style="margin-top: 0; border: none;">Bond Premium Increase by Insolvency Practitioner</h2>
            <div class="premium-grid">
              ${selectedCase.ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(increasePremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(increasePremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name_2 ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name_2}</div>
                  <div class="premium-amount">£${formatCurrency(increasePremium)}</div>
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
                  ${bondIncreaseFormData.submitted_by || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Signed By</div>
                <div class="info-value" style="font-size: 12px; font-weight: 600;">
                  ${currentUser?.full_name || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Date</div>
                <div class="info-value">${formatDate(bondIncreaseFormData.bond_date)}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([bondIncreaseHTML], { type: 'text/html' });
      const filename = `BOND-INCREASE-${selectedCase.case_reference}-${bondIncreaseFormData.bond_date.replace(/-/g, '')}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Document.create({
        case_id: selectedCase.id,
        file_url: uploadResult.file_url,
        doc_type: 'Bonding',
        raw_text: JSON.stringify({
          type: 'bond_increase',
          case_id: selectedCase.id,
          bond_date: bondIncreaseFormData.bond_date,
          increase_premium: increasePremium,
          previous_bond_value: safeNumber(selectedCase.initial_bond_value) + 
            (selectedCase.bond_increases || []).reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0) - 
            increasePremium,
          bond_level_range: selectedRate ? 
            `£${formatCurrency(selectedRate.range_min)} - ${selectedRate.range_max ? `£${formatCurrency(selectedRate.range_max)}` : 'No limit'}` : 
            'N/A',
          submitted_by: bondIncreaseFormData.submitted_by,
          signed_by: currentUser?.full_name
        })
      });

      alert('Bond increase completed successfully!');
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Error saving bond increase:', error);
      alert('Failed to save bond increase: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCloseBond = async () => {
    if (!bondClosureFormData.bond_level || !bondClosureFormData.closure_date) {
      alert('Please complete all required fields.');
      return;
    }

    setIsSaving(true);

    try {
      const closurePremium = safeNumber(parseFormattedNumber(bondClosureFormData.bond_premium));

      // Generate bond closure document HTML
      const bondClosureHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bond Closure - ${selectedCase.case_reference}</title>
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
              color: #dc2626;
              border-bottom: 3px solid #dc2626;
              padding-bottom: 10px;
            }
            h2 { 
              font-size: 14px; 
              font-weight: 600; 
              margin: 20px 0 10px 0;
              color: #dc2626;
              border-bottom: 2px solid #fca5a5;
              padding-bottom: 5px;
            }
            .header-info { 
              background-color: #fef2f2; 
              border: 2px solid #dc2626; 
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
              color: #dc2626; 
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
              background-color: #fef2f2;
              border: 2px solid #dc2626;
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
              border: 2px solid #fca5a5;
              padding: 15px;
              border-radius: 5px;
              text-align: center;
            }
            .premium-name {
              font-weight: 600;
              color: #dc2626;
              margin-bottom: 10px;
              font-size: 12px;
            }
            .premium-amount {
              font-size: 24px;
              font-weight: bold;
              color: #dc2626;
            }
            .signature-section {
              margin-top: 30px;
              padding: 15px;
              border: 2px solid #dc2626;
              border-radius: 5px;
              background-color: #fef2f2;
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
          <h1>Bond Closure</h1>
          
          <div class="header-info">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Case Reference</div>
                <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Company Name</div>
                <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Case Type</div>
                <div class="info-value">${selectedCase.case_type || 'N/A'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Appointment Date</div>
                <div class="info-value">${selectedCase.appointment_date ? formatDate(selectedCase.appointment_date) : 'N/A'}</div>
              </div>
            </div>
          </div>

          <h2>Bond Closure Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Final Bond Level</div>
              <div class="info-value">£${formatCurrency(safeNumber(parseFormattedNumber(bondClosureFormData.bond_level)))}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Closure Date</div>
              <div class="info-value">${formatDate(bondClosureFormData.closure_date)}</div>
            </div>
          </div>

          <div class="premium-section">
            <h2 style="margin-top: 0; border: none;">Bond Premium by Insolvency Practitioner</h2>
            <div class="premium-grid">
              ${selectedCase.ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(closurePremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name}</div>
                  <div class="premium-amount">£${formatCurrency(closurePremium)}</div>
                </div>
              ` : ''}
              ${selectedCase.joint_ip_name_2 ? `
                <div class="premium-box">
                  <div class="premium-name">${selectedCase.joint_ip_name_2}</div>
                  <div class="premium-amount">£${formatCurrency(closurePremium)}</div>
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
                  ${bondClosureFormData.submitted_by || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Signed By</div>
                <div class="info-value" style="font-size: 12px; font-weight: 600;">
                  ${currentUser?.full_name || 'N/A'}
                </div>
              </div>
              <div>
                <div class="info-label">Date</div>
                <div class="info-value">${formatDate(bondClosureFormData.closure_date)}</div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([bondClosureHTML], { type: 'text/html' });
      const filename = `BOND-CLOSURE-${selectedCase.case_reference}-${bondClosureFormData.closure_date.replace(/-/g, '')}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Document.create({
        case_id: selectedCase.id,
        file_url: uploadResult.file_url,
        doc_type: 'Bonding',
        raw_text: JSON.stringify({
          type: 'bond_closure',
          case_id: selectedCase.id,
          bond_level: safeNumber(parseFormattedNumber(bondClosureFormData.bond_level)),
          closure_date: bondClosureFormData.closure_date,
          bond_premium: closurePremium,
          submitted_by: bondClosureFormData.submitted_by,
          signed_by: currentUser?.full_name
        })
      });

      alert('Bond closure completed successfully!');
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Error saving bond closure:', error);
      alert('Failed to save bond closure: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBondHistory = async () => {
    setIsSaving(true);
    try {
      await base44.entities.Case.update(selectedCase.id, {
        initial_bond_value: safeNumber(parseFormattedNumber(editedHistoryData.initial_bond_value)),
        bond_signed_date: editedHistoryData.bond_signed_date,
        bond_increases: bondIncreases
      });

      alert('Bond history updated successfully!');
      setIsEditingHistory(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating bond history:', error);
      alert('Failed to update bond history: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBondIncrease = () => {
    setBondIncreases(prev => [...prev, {
      increase_value: 0,
      increase_date: new Date().toISOString().split('T')[0],
      submitted_by: '',
      signed_by: currentUser?.email,
      approver_name: currentUser?.full_name,
      signed_date: new Date().toISOString()
    }]);
  };

  const handleRemoveBondIncrease = (index) => {
    setBondIncreases(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateBondIncrease = (index, field, value) => {
    setBondIncreases(prev => prev.map((inc, i) => 
      i === index ? { ...inc, [field]: value } : inc
    ));
  };

  const handleArchiveCase = async () => {
    if (!window.confirm('Are you sure you want to archive this case from the bonding section? This will remove it from the bonding view.')) {
      return;
    }

    setIsArchiving(true);
    try {
      await base44.entities.Case.update(selectedCase.id, {
        bonding_archived: true
      });
      
      alert('Case has been archived from the bonding section.');
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Error archiving case:', error);
      alert('Failed to archive case: ' + (error.message || 'Unknown error'));
    } finally {
      setIsArchiving(false);
    }
  };

  const handleVatInputChange = (field, value) => {
    setVatReturnData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate Box 3 (Total VAT due) = Box 1 + Box 2
      const box1 = safeNumber(parseFormattedNumber(updated.box1));
      const box2 = safeNumber(parseFormattedNumber(updated.box2));
      updated.box3 = (box1 + box2).toFixed(2);
      
      // Auto-calculate Box 5 (Net VAT) = Box 3 - Box 4 (positive = due to HMRC, negative = refund)
      const box3Value = safeNumber(parseFormattedNumber(updated.box3));
      const box4 = safeNumber(parseFormattedNumber(updated.box4));
      updated.box5 = (box3Value - box4).toFixed(2);
      
      return updated;
    });
  };

  const handleExportVatReturn = () => {
    const box5Value = safeNumber(parseFormattedNumber(vatReturnData.box5));
    const box5Status = box5Value > 0 ? 'Due to HMRC' : box5Value < 0 ? 'Refund from HMRC' : 'No amount due';
    const box5Color = box5Value > 0 ? '#dc2626' : box5Value < 0 ? '#16a34a' : '#64748b';

    const vatReturnHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>VAT Return - ${selectedCase.case_reference}</title>
  <style>
    @page { size: A4 portrait; margin: 20mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 11px; 
      line-height: 1.4; 
      color: #1f2937; 
      padding: 20px;
    }
    h1 { 
      font-size: 24px; 
      font-weight: bold; 
      margin-bottom: 20px; 
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
    }
    .header-info { 
      background-color: #eff6ff; 
      border: 2px solid #2563eb; 
      padding: 15px; 
      border-radius: 5px; 
      margin-bottom: 20px;
    }
    .info-grid { 
      display: grid; 
      grid-template-columns: repeat(2, 1fr); 
      gap: 15px; 
    }
    .info-item { margin-bottom: 10px; }
    .info-label { 
      font-size: 9px; 
      font-weight: 600; 
      color: #2563eb; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
      margin-bottom: 3px;
    }
    .info-value { 
      font-weight: 500; 
      font-size: 11px;
      color: #1f2937; 
    }
    .vat-boxes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .vat-box {
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      background-color: #f8fafc;
    }
    .vat-box.highlight {
      background-color: #eff6ff;
      border-color: #2563eb;
    }
    .vat-box.success {
      background-color: #f0fdf4;
      border-color: #16a34a;
    }
    .vat-box.error {
      background-color: #fef2f2;
      border-color: #dc2626;
    }
    .box-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .box-number {
      font-size: 18px;
      font-weight: bold;
      color: #2563eb;
    }
    .box-label {
      font-size: 10px;
      color: #475569;
      line-height: 1.3;
    }
    .box-value {
      font-size: 20px;
      font-weight: bold;
      color: #1f2937;
      font-family: 'Courier New', monospace;
    }
    .summary {
      margin-top: 30px;
      padding: 20px;
      background-color: #eff6ff;
      border: 2px solid #2563eb;
      border-radius: 8px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .summary-row:last-child {
      border-bottom: none;
      font-size: 16px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>VAT Return</h1>
  
  <div class="header-info">
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Case Reference</div>
        <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Company Name</div>
        <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Period From</div>
        <div class="info-value">${vatReturnData.date_from ? formatDate(vatReturnData.date_from) : 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Period To</div>
        <div class="info-value">${vatReturnData.date_to ? formatDate(vatReturnData.date_to) : 'N/A'}</div>
      </div>
    </div>
  </div>

  <div class="vat-boxes">
    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">1</div>
        <div class="box-label">VAT due in the period on sales and other outputs</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box1)))}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">2</div>
        <div class="box-label">VAT due in the period on acquisitions of goods made in Northern Ireland from EU Member States</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box2)))}</div>
    </div>

    <div class="vat-box highlight">
      <div class="box-header">
        <div class="box-number">3</div>
        <div class="box-label">Total VAT due (Box 1 + Box 2)</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box3)))}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">4</div>
        <div class="box-label">VAT reclaimed in the period on purchases and other inputs (including acquisitions from EU Member States)</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box4)))}</div>
    </div>

    <div class="vat-box ${box5Value > 0 ? 'error' : box5Value < 0 ? 'success' : 'highlight'}">
      <div class="box-header">
        <div class="box-number">5</div>
        <div class="box-label">Net VAT to pay to HMRC or reclaim (Box 3 - Box 4)</div>
      </div>
      <div class="box-value" style="color: ${box5Color}">£${formatCurrency(Math.abs(box5Value))}</div>
      <div style="font-size: 10px; margin-top: 5px; color: ${box5Color}; font-weight: 600;">${box5Status}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">6</div>
        <div class="box-label">Total value of sales and all other outputs excluding any VAT</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box6)))}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">7</div>
        <div class="box-label">Total value of purchases and all other inputs excluding any VAT</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box7)))}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">8</div>
        <div class="box-label">Total value of dispatches of goods and related costs (excluding VAT) from Northern Ireland to EU Member States</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box8)))}</div>
    </div>

    <div class="vat-box">
      <div class="box-header">
        <div class="box-number">9</div>
        <div class="box-label">Total value of acquisitions of goods and related costs (excluding VAT) made in Northern Ireland from EU Member States</div>
      </div>
      <div class="box-value">£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box9)))}</div>
    </div>
  </div>

  <div class="summary">
    <h2 style="margin-bottom: 15px; color: #2563eb;">Summary</h2>
    <div class="summary-row">
      <span>Total VAT Due (Box 3):</span>
      <span>£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box3)))}</span>
    </div>
    <div class="summary-row">
      <span>Total VAT Reclaimed (Box 4):</span>
      <span>£${formatCurrency(safeNumber(parseFormattedNumber(vatReturnData.box4)))}</span>
    </div>
    <div class="summary-row" style="color: ${box5Color}">
      <span>Net VAT ${box5Status}:</span>
      <span>£${formatCurrency(Math.abs(box5Value))}</span>
    </div>
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #64748b;">
    Generated on ${formatDate(new Date().toISOString().split('T')[0])}
  </div>
</body>
</html>`;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(vatReturnHTML);
      newWindow.document.close();
    }
  };

  const handleSaveVat426 = async () => {
    if (!vat426Data.date_from || !vat426Data.date_to || vat426Data.entries.length === 0) {
      alert('Please select a date range and ensure there are transactions to save.');
      return;
    }

    setIsSaving(true);
    try {
      const totalVAT = vat426Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);

      // Generate VAT426 HTML document
      const vat426HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>VAT 426 - ${selectedCase.case_reference}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 10px; 
      line-height: 1.3; 
      color: #1f2937; 
      padding: 15px;
    }
    h1 { 
      font-size: 20px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
    }
    .header-info { 
      background-color: #eff6ff; 
      border: 2px solid #2563eb; 
      padding: 12px; 
      border-radius: 5px; 
      margin-bottom: 15px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .info-item { }
    .info-label { 
      font-size: 8px; 
      font-weight: 600; 
      color: #2563eb; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
      margin-bottom: 2px;
    }
    .info-value { 
      font-weight: 500; 
      font-size: 10px;
      color: #1f2937; 
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      text-align: left;
    }
    th {
      background-color: #eff6ff;
      font-weight: 600;
      color: #1e40af;
      font-size: 9px;
    }
    td {
      font-size: 9px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-mono {
      font-family: 'Courier New', monospace;
    }
    .total-row {
      background-color: #eff6ff;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>VAT 426 - Input Tax Deduction Claimed</h1>
  
  <div class="header-info">
    <div class="info-item">
      <div class="info-label">Case Reference</div>
      <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Company Name</div>
      <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Period From</div>
      <div class="info-value">${formatDate(vat426Data.date_from)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Period To</div>
      <div class="info-value">${formatDate(vat426Data.date_to)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Name of supplier</th>
        <th>Supplier reference or invoice number</th>
        <th>Type of goods or services</th>
        <th class="text-center">Tax point</th>
        <th class="text-center">Date of invoice</th>
        <th class="text-right">VAT (£)</th>
        <th class="text-right">VAT (p)</th>
      </tr>
    </thead>
    <tbody>
      ${vat426Data.entries.map(entry => `
        <tr>
          <td>${entry.supplier_name}</td>
          <td>${entry.supplier_reference}</td>
          <td>${entry.type_of_goods}</td>
          <td class="text-center">${entry.tax_point}</td>
          <td class="text-center">${formatDate(entry.date_of_invoice)}</td>
          <td class="text-right font-mono">${entry.vat_amount_pounds}</td>
          <td class="text-right font-mono">${entry.vat_amount_pence.toString().padStart(2, '0')}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="5" class="text-right">TOTAL:</td>
        <td class="text-right font-mono">${Math.floor(totalVAT)}</td>
        <td class="text-right font-mono">${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #64748b;">
    Generated on ${formatDate(new Date().toISOString().split('T')[0])} | Total entries: ${vat426Data.entries.length}
  </div>
</body>
</html>`;

      const blob = new Blob([vat426HTML], { type: 'text/html' });
      const filename = `VAT426-${selectedCase.case_reference}-${vat426Data.date_from}-to-${vat426Data.date_to}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Document.create({
        case_id: selectedCase.id,
        file_url: uploadResult.file_url,
        doc_type: 'VAT 426',
        raw_text: JSON.stringify({
          date_from: vat426Data.date_from,
          date_to: vat426Data.date_to,
          sum: totalVAT,
          entries: vat426Data.entries
        })
      });

      alert('VAT 426 saved successfully!');
      setActiveVatTab('history');
    } catch (error) {
      console.error('Error saving VAT 426:', error);
      alert('Failed to save VAT 426: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveVat427 = async () => {
    if (!vat427Data.date_from || !vat427Data.date_to || vat427Data.entries.length === 0) {
      alert('Please select a date range and ensure there are transactions to save.');
      return;
    }

    setIsSaving(true);
    try {
      const totalVAT = vat427Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);

      // Generate VAT427 HTML document
      const vat427HTML = `
<!DOCTYPE html>
<html>
<head>
  <title>VAT 427 - ${selectedCase.case_reference}</title>
  <style>
    @page { size: A4 landscape; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 10px; 
      line-height: 1.3; 
      color: #1f2937; 
      padding: 15px;
    }
    h1 { 
      font-size: 20px; 
      font-weight: bold; 
      margin-bottom: 15px; 
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 8px;
    }
    .header-info { 
      background-color: #eff6ff; 
      border: 2px solid #2563eb; 
      padding: 12px; 
      border-radius: 5px; 
      margin-bottom: 15px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
    }
    .info-item { }
    .info-label { 
      font-size: 8px; 
      font-weight: 600; 
      color: #2563eb; 
      text-transform: uppercase; 
      letter-spacing: 0.05em; 
      margin-bottom: 2px;
    }
    .info-value { 
      font-weight: 500; 
      font-size: 10px;
      color: #1f2937; 
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px;
      text-align: left;
    }
    th {
      background-color: #eff6ff;
      font-weight: 600;
      color: #1e40af;
      font-size: 9px;
    }
    td {
      font-size: 9px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .font-mono {
      font-family: 'Courier New', monospace;
    }
    .total-row {
      background-color: #eff6ff;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>VAT 427 - Input Tax Deduction Claimed</h1>
  
  <div class="header-info">
    <div class="info-item">
      <div class="info-label">Case Reference</div>
      <div class="info-value">${selectedCase.case_reference || 'N/A'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Company Name</div>
      <div class="info-value">${selectedCase.company_name || 'N/A'}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Period From</div>
      <div class="info-value">${formatDate(vat427Data.date_from)}</div>
    </div>
    <div class="info-item">
      <div class="info-label">Period To</div>
      <div class="info-value">${formatDate(vat427Data.date_to)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Name of supplier</th>
        <th>Address of supplier</th>
        <th>Supplier reference or invoice number</th>
        <th>Type of goods or services</th>
        <th class="text-center">Tax point</th>
        <th class="text-center">Date of invoice</th>
        <th class="text-right">VAT (£)</th>
        <th class="text-right">VAT (p)</th>
      </tr>
    </thead>
    <tbody>
      ${vat427Data.entries.map(entry => `
        <tr>
          <td>${entry.supplier_name}</td>
          <td>${entry.supplier_address || 'N/A'}</td>
          <td>${entry.supplier_reference}</td>
          <td>${entry.type_of_goods}</td>
          <td class="text-center">${entry.tax_point}</td>
          <td class="text-center">${formatDate(entry.date_of_invoice)}</td>
          <td class="text-right font-mono">${entry.vat_amount_pounds}</td>
          <td class="text-right font-mono">${entry.vat_amount_pence.toString().padStart(2, '0')}</td>
        </tr>
      `).join('')}
      <tr class="total-row">
        <td colspan="6" class="text-right">TOTAL:</td>
        <td class="text-right font-mono">${Math.floor(totalVAT)}</td>
        <td class="text-right font-mono">${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #64748b;">
    Generated on ${formatDate(new Date().toISOString().split('T')[0])} | Total entries: ${vat427Data.entries.length}
  </div>
</body>
</html>`;

      const blob = new Blob([vat427HTML], { type: 'text/html' });
      const filename = `VAT427-${selectedCase.case_reference}-${vat427Data.date_from}-to-${vat427Data.date_to}`;
      const file = new File([blob], `${filename}.html`, { type: 'text/html' });
      
      const uploadResult = await base44.integrations.Core.UploadFile({ file });

      await base44.entities.Document.create({
        case_id: selectedCase.id,
        file_url: uploadResult.file_url,
        doc_type: 'VAT 427',
        raw_text: JSON.stringify({
          date_from: vat427Data.date_from,
          date_to: vat427Data.date_to,
          sum: totalVAT,
          entries: vat427Data.entries
        })
      });

      alert('VAT 427 saved successfully!');
      setActiveVatTab('history');
    } catch (error) {
      console.error('Error saving VAT 427:', error);
      alert('Failed to save VAT 427: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateVat427Entry = (index, field, value) => {
    setVat427Data(prev => ({
      ...prev,
      entries: prev.entries.map((entry, i) => 
        i === index ? { ...entry, [field]: value } : entry
      )
    }));
  };

  if (!selectedCase || !selectedOption) return null;

  // Determine Box 5 styling based on value
  const box5Value = safeNumber(parseFormattedNumber(vatReturnData.box5));
  const box5IsDueToHMRC = box5Value > 0;
  const box5IsRefund = box5Value < 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full mx-4 max-h-[90vh] overflow-auto border border-slate-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-semibold text-slate-900">
              {selectedOption === 'set_up_bond' && 'Set Up Bond'}
              {selectedOption === 'increase_bond' && 'Increase Bond'}
              {selectedOption === 'bond_history' && 'Bond History'}
              {selectedOption === 'bank_reconciliation' && 'Bank Reconciliation'}
              {selectedOption === 'archive_case' && 'Archive Case'}
              {selectedOption === 'close_bond' && 'Close Bond'}
              {selectedOption === 'vat' && 'VAT Management'}
            </h2>
            {selectedOption === 'vat' && selectedCase.date_of_vat_deregistration && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-sm font-semibold text-purple-800">Date VAT De-registration:</span>
                <span className="text-sm text-purple-700">{formatDate(selectedCase.date_of_vat_deregistration)}</span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6">
          {selectedOption === 'vat' ? (
            <div className="flex gap-6 min-h-[600px]">
              {/* Left Sidebar Navigation */}
              <div className="w-64 flex-shrink-0 space-y-2">
                <button
                  onClick={() => setActiveVatTab('vat_return')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeVatTab === 'vat_return'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm font-medium'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <Calculator className="w-5 h-5" />
                  <span>VAT Return</span>
                </button>

                <button
                  onClick={() => setActiveVatTab('vat426')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeVatTab === 'vat426'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm font-medium'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>VAT 426</span>
                </button>

                <button
                  onClick={() => setActiveVatTab('vat427')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeVatTab === 'vat427'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm font-medium'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>VAT 427</span>
                </button>

                <button
                  onClick={() => setActiveVatTab('vat833')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeVatTab === 'vat833'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm font-medium'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span>VAT833</span>
                </button>

                <button
                  onClick={() => setActiveVatTab('history')}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center gap-3 ${
                    activeVatTab === 'history'
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-sm font-medium'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <Edit className="w-5 h-5" />
                  <span>History</span>
                </button>
              </div>

              {/* Right Content Area */}
              <div className="flex-1">
                {activeVatTab === 'vat_return' && (
                  <Card className="border-2 border-blue-200 h-full">
                    <div className="p-4 h-full overflow-auto">
                      <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-blue-600" />
                        VAT Return
                      </h3>

                      {/* Date Range Section */}
                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date From</Label>
                          <Input
                            type="date"
                            value={vatReturnData.date_from}
                            onChange={(e) => handleVatInputChange('date_from', e.target.value)}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date To</Label>
                          <Input
                            type="date"
                            value={vatReturnData.date_to}
                            onChange={(e) => handleVatInputChange('date_to', e.target.value)}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* VAT Boxes - Two Column Layout */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* Box 1 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">1</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              VAT due in the period on sales and other outputs
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box1)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box1', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm bg-blue-50"
                            />
                          </div>
                        </div>

                        {/* Box 2 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">2</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              VAT due in the period on acquisitions of goods made in Northern Ireland from EU Member States
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box2)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box2', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Box 3 */}
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-blue-900 text-sm">3</span>
                            <Label className="text-xs font-semibold text-blue-900 flex-1 leading-tight">
                              Total VAT due
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-blue-700 font-semibold text-sm">£</span>
                            <Input
                              type="text"
                              value={formatNumberWithCommas(vatReturnData.box3)}
                              readOnly
                              className="font-mono bg-blue-100 font-semibold text-blue-900 h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Box 4 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">4</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              VAT reclaimed in the period on purchases and other inputs (including acquisitions from EU Member States)
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box4)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box4', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm bg-blue-50"
                            />
                          </div>
                        </div>

                        {/* Box 5 - Dynamic styling based on value */}
                        <div className={`border-2 rounded-lg p-2 ${
                          box5IsDueToHMRC 
                            ? 'bg-red-50 border-red-300' 
                            : box5IsRefund 
                            ? 'bg-green-50 border-green-300'
                            : 'bg-slate-50 border-slate-300'
                        }`}>
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className={`font-bold text-sm ${
                              box5IsDueToHMRC 
                                ? 'text-red-900' 
                                : box5IsRefund 
                                ? 'text-green-900'
                                : 'text-slate-900'
                            }`}>5</span>
                            <Label className={`text-xs font-semibold flex-1 leading-tight ${
                              box5IsDueToHMRC 
                                ? 'text-red-900' 
                                : box5IsRefund 
                                ? 'text-green-900'
                                : 'text-slate-700'
                            }`}>
                              Net VAT to pay to HMRC or reclaim
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`font-semibold text-sm ${
                              box5IsDueToHMRC 
                                ? 'text-red-700' 
                                : box5IsRefund 
                                ? 'text-green-700'
                                : 'text-slate-500'
                            }`}>£</span>
                            <Input
                              type="text"
                              value={formatNumberWithCommas(Math.abs(box5Value).toFixed(2))}
                              readOnly
                              className={`font-mono font-semibold h-8 text-sm ${
                                box5IsDueToHMRC 
                                  ? 'bg-red-100 text-red-900' 
                                  : box5IsRefund 
                                  ? 'bg-green-100 text-green-900'
                                  : 'bg-slate-100 text-slate-900'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Box 6 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">6</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              Total value of sales and all other outputs excluding any VAT
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box6)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box6', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm bg-blue-50"
                            />
                          </div>
                        </div>

                        {/* Box 7 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">7</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              Total value of purchases and all other inputs excluding any VAT
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box7)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box7', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm bg-blue-50"
                            />
                          </div>
                        </div>

                        {/* Box 8 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">8</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              Total value of dispatches of goods and related costs (excluding VAT) from Northern Ireland to EU Member States
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box8)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box8', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm"
                            />
                          </div>
                        </div>

                        {/* Box 9 */}
                        <div className="bg-slate-50 border border-slate-300 rounded-lg p-2">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="font-bold text-slate-900 text-sm">9</span>
                            <Label className="text-xs text-slate-700 flex-1 leading-tight">
                              Total value of acquisitions of goods and related costs (excluding VAT) made in Northern Ireland from EU Member States
                            </Label>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-sm">£</span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={formatNumberWithCommas(vatReturnData.box9)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  handleVatInputChange('box9', parsed);
                                }
                              }}
                              placeholder="0.00"
                              className="font-mono h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
                        <Button variant="outline" onClick={onClose} size="sm">
                          Cancel
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={handleExportVatReturn} 
                          size="sm"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" size="sm">
                          <Save className="w-4 h-4 mr-2" />
                          Save VAT Return
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {activeVatTab === 'vat426' && (
                  <Card className="border-2 border-blue-200 h-full">
                    <div className="p-4 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          VAT 426
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Trigger reload by toggling the dates
                              const currentFrom = vat426Data.date_from;
                              const currentTo = vat426Data.date_to;
                              setVat426Data(prev => ({ ...prev, date_from: '', date_to: '' }));
                              setTimeout(() => {
                                setVat426Data(prev => ({ ...prev, date_from: currentFrom, date_to: currentTo }));
                              }, 10);
                            }}
                            disabled={isLoadingVat426 || !vat426Data.date_from || !vat426Data.date_to}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingVat426 ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Export to CSV
                              const csvHeaders = 'Name of supplier,Supplier reference or invoice number,Type of goods or services,Tax point,Date of invoice,VAT Amount (£),VAT Amount (p)\n';
                              const csvRows = vat426Data.entries.map(entry => {
                                return [
                                  `"${entry.supplier_name}"`,
                                  `"${entry.supplier_reference}"`,
                                  `"${entry.type_of_goods}"`,
                                  entry.tax_point,
                                  formatDate(entry.date_of_invoice),
                                  entry.vat_amount_pounds,
                                  entry.vat_amount_pence.toString().padStart(2, '0')
                                ].join(',');
                              }).join('\n');
                              
                              const totalVAT = vat426Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);
                              const totalRow = `\n"TOTAL","","","","",${Math.floor(totalVAT)},${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}`;
                              
                              const csvContent = csvHeaders + csvRows + totalRow;
                              const blob = new Blob([csvContent], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `VAT426-${selectedCase.case_reference}-${vat426Data.date_from}-to-${vat426Data.date_to}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            disabled={vat426Data.entries.length === 0}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>

                      {/* Date Range Section */}
                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date From</Label>
                          <Input
                            type="date"
                            value={vat426Data.date_from}
                            onChange={(e) => setVat426Data(prev => ({ ...prev, date_from: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date To</Label>
                          <Input
                            type="date"
                            value={vat426Data.date_to}
                            onChange={(e) => setVat426Data(prev => ({ ...prev, date_to: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>

                      {/* VAT426 Table */}
                      <div className="flex-1 overflow-auto border border-slate-300 rounded-lg">
                        {isLoadingVat426 ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                              <p className="text-sm text-slate-600">Loading transactions...</p>
                            </div>
                          </div>
                        ) : !vat426Data.date_from || !vat426Data.date_to ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-slate-500">
                              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                              <p className="text-sm">Please select date range to load transactions</p>
                            </div>
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="bg-blue-50 sticky top-0">
                              <tr>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Name of supplier
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Supplier reference<br/>or invoice number
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Type of goods<br/>or services
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700" colSpan="2">
                                  Time of supply
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700" colSpan="2">
                                  Amount of VAT<br/>claimed
                                </th>
                              </tr>
                              <tr className="bg-blue-50">
                                <th className="border border-slate-300 px-2 py-1"></th>
                                <th className="border border-slate-300 px-2 py-1"></th>
                                <th className="border border-slate-300 px-2 py-1"></th>
                                <th className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700 text-xs">
                                  Tax point
                                </th>
                                <th className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700 text-xs">
                                  Date of invoice
                                </th>
                                <th className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700 text-xs">
                                  £
                                </th>
                                <th className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-700 text-xs">
                                  p
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {vat426Data.entries.length === 0 ? (
                                <tr>
                                  <td colSpan="7" className="border border-slate-300 px-2 py-8 text-center text-slate-500">
                                    No transactions found in the selected date range
                                  </td>
                                </tr>
                              ) : (
                                vat426Data.entries.map((entry, index) => (
                                  <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.supplier_name}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.supplier_reference}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.type_of_goods}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                                      {entry.tax_point}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                                      {formatDate(entry.date_of_invoice)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">
                                      {entry.vat_amount_pounds}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">
                                      {entry.vat_amount_pence.toString().padStart(2, '0')}
                                    </td>
                                  </tr>
                                ))
                              )}
                              {vat426Data.entries.length > 0 && (
                                <tr className="bg-blue-50 font-semibold">
                                  <td colSpan="5" className="border border-slate-300 px-2 py-2 text-right">
                                    TOTAL:
                                  </td>
                                  <td className="border border-slate-300 px-2 py-2 text-right font-mono">
                                    {Math.floor(vat426Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0))}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-2 text-right font-mono">
                                    {Math.round((vat426Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0) % 1) * 100).toString().padStart(2, '0')}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {vat426Data.entries.length > 0 && (
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
                          <Button variant="outline" onClick={onClose} size="sm">
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Export to CSV
                              const csvHeaders = 'Name of supplier,Supplier reference or invoice number,Type of goods or services,Tax point,Date of invoice,VAT Amount (£),VAT Amount (p)\n';
                              const csvRows = vat426Data.entries.map(entry => {
                                return [
                                  `"${entry.supplier_name}"`,
                                  `"${entry.supplier_reference}"`,
                                  `"${entry.type_of_goods}"`,
                                  entry.tax_point,
                                  formatDate(entry.date_of_invoice),
                                  entry.vat_amount_pounds,
                                  entry.vat_amount_pence.toString().padStart(2, '0')
                                ].join(',');
                              }).join('\n');
                              
                              const totalVAT = vat426Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);
                              const totalRow = `\n"TOTAL","","","","",${Math.floor(totalVAT)},${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}`;
                              
                              const csvContent = csvHeaders + csvRows + totalRow;
                              const blob = new Blob([csvContent], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `VAT426-${selectedCase.case_reference}-${vat426Data.date_from}-to-${vat426Data.date_to}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            disabled={vat426Data.entries.length === 0}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                          <Button
                            onClick={handleSaveVat426}
                            className="bg-blue-600 hover:bg-blue-700"
                            size="sm"
                            disabled={isSaving || vat426Data.entries.length === 0}
                          >
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Save VAT 426
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {activeVatTab === 'vat427' && (
                  <Card className="border-2 border-blue-200 h-full">
                    <div className="p-4 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          VAT 427
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const currentFrom = vat427Data.date_from;
                              const currentTo = vat427Data.date_to;
                              setVat427Data(prev => ({ ...prev, date_from: '', date_to: '' }));
                              setTimeout(() => {
                                setVat427Data(prev => ({ ...prev, date_from: currentFrom, date_to: currentTo }));
                              }, 10);
                            }}
                            disabled={isLoadingVat427 || !vat427Data.date_from || !vat427Data.date_to}
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingVat427 ? 'animate-spin' : ''}`} />
                            Refresh
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const csvHeaders = 'Name of supplier,Address of supplier,Supplier reference or invoice number,Type of goods or services,Tax point,Date of invoice,VAT Amount (£),VAT Amount (p)\n';
                              const csvRows = vat427Data.entries.map(entry => {
                                return [
                                  `"${entry.supplier_name}"`,
                                  `"${entry.supplier_address || ''}"`,
                                  `"${entry.supplier_reference}"`,
                                  `"${entry.type_of_goods}"`,
                                  entry.tax_point,
                                  formatDate(entry.date_of_invoice),
                                  entry.vat_amount_pounds,
                                  entry.vat_amount_pence.toString().padStart(2, '0')
                                ].join(',');
                              }).join('\n');
                              
                              const totalVAT = vat427Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);
                              const totalRow = `\n"TOTAL","","","","","",${Math.floor(totalVAT)},${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}`;
                              
                              const csvContent = csvHeaders + csvRows + totalRow;
                              const blob = new Blob([csvContent], { type: 'text/csv' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `VAT427-${selectedCase.case_reference}-${vat427Data.date_from}-to-${vat427Data.date_to}.csv`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            }}
                            disabled={vat427Data.entries.length === 0}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date From</Label>
                          <Input
                            type="date"
                            value={vat427Data.date_from}
                            onChange={(e) => setVat427Data(prev => ({ ...prev, date_from: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-slate-700">Date To</Label>
                          <Input
                            type="date"
                            value={vat427Data.date_to}
                            onChange={(e) => setVat427Data(prev => ({ ...prev, date_to: e.target.value }))}
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex-1 overflow-auto border border-slate-300 rounded-lg">
                        {isLoadingVat427 ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                              <p className="text-sm text-slate-600">Loading transactions...</p>
                            </div>
                          </div>
                        ) : !vat427Data.date_from || !vat427Data.date_to ? (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-slate-500">
                              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                              <p className="text-sm">Please select date range to load transactions</p>
                            </div>
                          </div>
                        ) : (
                          <table className="w-full text-xs">
                            <thead className="bg-blue-50 sticky top-0">
                              <tr>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Name of supplier
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Address of supplier
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Supplier reference<br/>or invoice number
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">
                                  Type of goods<br/>or services
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                                  Tax point
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-center font-semibold text-slate-700">
                                  Date of invoice
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                                  VAT (£)
                                </th>
                                <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">
                                  VAT (p)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {vat427Data.entries.length === 0 ? (
                                <tr>
                                  <td colSpan="8" className="border border-slate-300 px-2 py-8 text-center text-slate-500">
                                    No transactions found in the selected date range
                                  </td>
                                </tr>
                              ) : (
                                vat427Data.entries.map((entry, index) => (
                                  <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.supplier_name}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      <Input
                                        type="text"
                                        value={entry.supplier_address || ''}
                                        onChange={(e) => handleUpdateVat427Entry(index, 'supplier_address', e.target.value)}
                                        placeholder="Enter address"
                                        className="h-7 text-xs"
                                      />
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.supplier_reference}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5">
                                      {entry.type_of_goods}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                                      {entry.tax_point}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-center">
                                      {formatDate(entry.date_of_invoice)}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">
                                      {entry.vat_amount_pounds}
                                    </td>
                                    <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">
                                      {entry.vat_amount_pence.toString().padStart(2, '0')}
                                    </td>
                                  </tr>
                                ))
                              )}
                              {vat427Data.entries.length > 0 && (
                                <tr className="bg-blue-50 font-semibold">
                                  <td colSpan="6" className="border border-slate-300 px-2 py-2 text-right">
                                    TOTAL:
                                  </td>
                                  <td className="border border-slate-300 px-2 py-2 text-right font-mono">
                                    {Math.floor(vat427Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0))}
                                  </td>
                                  <td className="border border-slate-300 px-2 py-2 text-right font-mono">
                                    {Math.round((vat427Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0) % 1) * 100).toString().padStart(2, '0')}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-4">
                        <Button variant="outline" onClick={onClose} size="sm" disabled={vat427Data.entries.length === 0}>
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const csvHeaders = 'Name of supplier,Address of supplier,Supplier reference or invoice number,Type of goods or services,Tax point,Date of invoice,VAT Amount (£),VAT Amount (p)\n';
                            const csvRows = vat427Data.entries.map(entry => {
                              return [
                                `"${entry.supplier_name}"`,
                                `"${entry.supplier_address || ''}"`,
                                `"${entry.supplier_reference}"`,
                                `"${entry.type_of_goods}"`,
                                entry.tax_point,
                                formatDate(entry.date_of_invoice),
                                entry.vat_amount_pounds,
                                entry.vat_amount_pence.toString().padStart(2, '0')
                              ].join(',');
                            }).join('\n');
                            
                            const totalVAT = vat427Data.entries.reduce((sum, e) => sum + safeNumber(e.vat_amount_pounds) + (safeNumber(e.vat_amount_pence) / 100), 0);
                            const totalRow = `\n"TOTAL","","","","","",${Math.floor(totalVAT)},${Math.round((totalVAT % 1) * 100).toString().padStart(2, '0')}`;
                            
                            const csvContent = csvHeaders + csvRows + totalRow;
                            const blob = new Blob([csvContent], { type: 'text/csv' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `VAT427-${selectedCase.case_reference}-${vat427Data.date_from}-to-${vat427Data.date_to}.csv`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          disabled={vat427Data.entries.length === 0}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                        <Button
                          onClick={handleSaveVat427}
                          className="bg-blue-600 hover:bg-blue-700"
                          size="sm"
                          disabled={isSaving || vat427Data.entries.length === 0}
                        >
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                          Save VAT 427
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}

                {activeVatTab === 'vat833' && (
                  <Card className="border-2 border-blue-200 h-full">
                    <div className="p-4 h-full flex flex-col">
                      <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        VAT833
                      </h3>
                      <div className="flex-1 flex items-center justify-center text-slate-500">
                        <div className="text-center">
                          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <p className="text-slate-600">VAT833 functionality will be implemented here.</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {activeVatTab === 'history' && (
                  <Card className="border-2 border-blue-200 h-full">
                    <div className="p-4 h-full flex flex-col">
                      <h3 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Edit className="w-4 h-4 text-blue-600" />
                        VAT History
                      </h3>
                      
                      {isLoadingVatHistory ? (
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                      ) : vatHistory.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-slate-500">
                          <div className="text-center">
                            <Edit className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-600">No VAT submissions found.</p>
                            <p className="text-sm text-slate-500 mt-2">VAT returns and forms will appear here once saved.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-auto border border-slate-300 rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-50 sticky top-0">
                              <tr>
                                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">
                                  Type
                                </th>
                                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">
                                  Date From
                                </th>
                                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-700">
                                  Date To
                                </th>
                                <th className="border border-slate-300 px-3 py-2 text-right font-semibold text-slate-700">
                                  Sum (£)
                                </th>
                                <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">
                                  Date Submitted
                                </th>
                                <th className="border border-slate-300 px-3 py-2 text-center font-semibold text-slate-700">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {vatHistory.map((record, index) => (
                                <tr key={record.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                  <td className="border border-slate-300 px-3 py-2 font-medium">
                                    {record.type}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2">
                                    {formatDate(record.date_from)}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2">
                                    {formatDate(record.date_to)}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2 text-right font-mono">
                                    {formatCurrency(safeNumber(record.sum))}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2 text-center text-xs">
                                    {formatDate(record.created_date)}
                                  </td>
                                  <td className="border border-slate-300 px-3 py-2 text-center">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      asChild
                                      className="h-7 text-xs"
                                    >
                                      <a href={record.file_url} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-3 h-3 mr-1" />
                                        View
                                      </a>
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          ) : selectedOption === 'set_up_bond' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="font-semibold text-blue-800">Case:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.company_name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Reference:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_reference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Type:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_type}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Appointment Date:</span>
                      <span className="text-blue-700 ml-2">
                        {selectedCase.appointment_date ? formatDate(selectedCase.appointment_date) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Statement of Affairs ETR (£) *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithCommas(bondFormData.soa_etr)}
                    onChange={(e) => {
                      const parsedValue = parseFormattedNumber(e.target.value);
                      if (/^-?\d*\.?\d*$/.test(parsedValue) || parsedValue === '') {
                        setBondFormData(prev => ({ ...prev, soa_etr: parsedValue }));
                      }
                    }}
                    placeholder="Enter ETR value"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Bond Date *</Label>
                  <Input
                    type="date"
                    value={bondFormData.bond_date}
                    onChange={(e) => setBondFormData(prev => ({ ...prev, bond_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700">Bond Level *</Label>
                  <Select value={bondFormData.selected_bond_level} onValueChange={handleBondLevelChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select bond level" />
                    </SelectTrigger>
                    <SelectContent>
                      {bondingRates
                        .filter(rate => rate.year === new Date().getFullYear())
                        .sort((a, b) => a.range_min - b.range_min)
                        .map(rate => (
                          <SelectItem key={rate.id} value={rate.id}>
                            £${formatCurrency(rate.range_min)} - {rate.range_max ? `£${formatCurrency(rate.range_max)}` : 'No limit'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Bond Premium by IP (£)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedCase.ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.ip_name}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                    {selectedCase.joint_ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                    {selectedCase.joint_ip_name_2 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name_2}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Submitted By</Label>
                  <Input
                    type="text"
                    value={bondFormData.submitted_by}
                    onChange={(e) => setBondFormData(prev => ({ ...prev, submitted_by: e.target.value }))}
                    placeholder="Enter name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleSaveBondSetup}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!bondFormData.soa_etr || !bondFormData.selected_bond_level || !bondFormData.bond_date || isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Post
                </Button>
              </div>
            </div>
          ) : selectedOption === 'bond_history' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="font-semibold text-blue-800">Case:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.company_name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Reference:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_reference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Date of Appointment:</span>
                      <span className="text-blue-700 ml-2">
                        {selectedCase.appointment_date ? formatDate(selectedCase.appointment_date) : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingHistory(!isEditingHistory)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {isEditingHistory ? 'Cancel Edit' : 'Edit'}
                  </Button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <div className="space-y-2">
                  {/* Initial Bond Level Row */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-6 text-sm">
                      <div className="flex-shrink-0">
                        <span className="font-semibold text-blue-800">Initial Bond Level:</span>
                        <div className="text-blue-700 mt-1 text-lg font-medium">
                          {isEditingHistory ? (
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formatNumberWithCommas(editedHistoryData.initial_bond_value)}
                              onChange={(e) => {
                                const parsed = parseFormattedNumber(e.target.value);
                                if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                  setEditedHistoryData(prev => ({ ...prev, initial_bond_value: parsed }));
                                }
                              }}
                              className="h-9 w-32"
                            />
                          ) : (
                            selectedCase.initial_bond_value ? 
                              `£${formatCurrency(selectedCase.initial_bond_value)}` : 
                              'Not set'
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="font-semibold text-blue-800">Date of Bond:</span>
                        <div className="text-blue-700 mt-1 font-medium">
                          {isEditingHistory ? (
                            <Input
                              type="date"
                              value={editedHistoryData.bond_signed_date || ''}
                              onChange={(e) => setEditedHistoryData(prev => ({ 
                                ...prev, 
                                bond_signed_date: e.target.value 
                              }))}
                              className="h-9 w-40"
                            />
                          ) : (
                            selectedCase.bond_signed_date ? 
                              formatDate(selectedCase.bond_signed_date) : 
                              'N/A'
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="font-semibold text-blue-800">IP Bonded & Premium:</span>
                        <div className="flex flex-wrap items-center gap-4 mt-1">
                          {selectedCase.ip_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-blue-700 font-medium">{selectedCase.ip_name}</span>
                              <span className="text-blue-900 font-bold">
                                £${formatCurrency(selectedCase.initial_bond_value || 0)}
                              </span>
                            </div>
                          )}
                          {selectedCase.joint_ip_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-blue-700 font-medium">{selectedCase.joint_ip_name}</span>
                              <span className="text-blue-900 font-bold">
                                £${formatCurrency(selectedCase.initial_bond_value || 0)}
                              </span>
                            </div>
                          )}
                          {selectedCase.joint_ip_name_2 && (
                            <div className="flex items-center gap-2">
                              <span className="text-blue-700 font-medium">{selectedCase.joint_ip_name_2}</span>
                              <span className="text-blue-900 font-bold">
                                £${formatCurrency(selectedCase.initial_bond_value || 0)}
                              </span>
                            </div>
                          )}
                          {!selectedCase.ip_name && !selectedCase.joint_ip_name && !selectedCase.joint_ip_name_2 && (
                            <span className="text-blue-700 italic">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bond Increases Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-green-800">Bond Increases:</span>
                      {isEditingHistory && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddBondIncrease}
                          className="text-green-600 border-green-300 hover:bg-green-50"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Increase
                        </Button>
                      )}
                    </div>

                    {bondIncreases.length === 0 ? (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center text-green-700 italic">
                        No bond increases recorded
                      </div>
                    ) : (
                      bondIncreases.map((increase, index) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start gap-6 text-sm">
                            <div className="flex-shrink-0">
                              <span className="font-semibold text-green-800">Increase #{index + 1}:</span>
                              <div className="text-green-700 mt-1 text-lg font-medium">
                                {isEditingHistory ? (
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    value={formatNumberWithCommas(increase.increase_value)}
                                    onChange={(e) => {
                                      const parsed = parseFormattedNumber(e.target.value);
                                      if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                                        handleUpdateBondIncrease(index, 'increase_value', safeNumber(parsed));
                                      }
                                    }}
                                    className="h-9 w-32"
                                  />
                                ) : (
                                  `£${formatCurrency(increase.increase_value)}`
                                )}
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span className="font-semibold text-green-800">Date:</span>
                              <div className="text-green-700 mt-1 font-medium">
                                {isEditingHistory ? (
                                  <Input
                                    type="date"
                                    value={increase.increase_date || ''}
                                    onChange={(e) => handleUpdateBondIncrease(index, 'increase_date', e.target.value)}
                                    className="h-9 w-40"
                                  />
                                ) : (
                                  formatDate(increase.increase_date)
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <span className="font-semibold text-green-800">Approved By:</span>
                              <div className="text-green-700 mt-1 font-medium">
                                {increase.approver_name || increase.signed_by || 'N/A'}
                                {increase.signed_date && ` on ${formatDate(increase.signed_date)}`}
                              </div>
                            </div>
                            {isEditingHistory && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBondIncrease(index)}
                                className="text-red-600 hover:bg-red-50"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Summary Row */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-6 text-sm">
                      <div>
                        <span className="font-semibold text-amber-800">Current Total Bond Value:</span>
                        <div className="text-amber-700 mt-1 text-lg font-medium">
                          {isEditingHistory ? 
                            `£${formatCurrency(
                              safeNumber(parseFormattedNumber(editedHistoryData.initial_bond_value)) + 
                              bondIncreases.reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0)
                            )}` :
                            `£${formatCurrency(
                              safeNumber(selectedCase.initial_bond_value) + 
                              (selectedCase.bond_increases || []).reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0)
                            )}`
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {isEditingHistory && (
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsEditingHistory(false);
                        setEditedHistoryData({
                          initial_bond_value: selectedCase.initial_bond_value || '',
                          bond_signed_date: selectedCase.bond_signed_date || ''
                        });
                        setBondIncreases(selectedCase.bond_increases || []);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveBondHistory}
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : selectedOption === 'increase_bond' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="font-semibold text-blue-800">Case:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.company_name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Reference:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_reference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Type:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_type}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700">Revised Bond Level *</Label>
                  <Select value={bondIncreaseFormData.selected_bond_level} onValueChange={handleBondIncreaseLevelChange}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select revised bond level" />
                    </SelectTrigger>
                    <SelectContent>
                      {bondingRates
                        .filter(rate => rate.year === new Date().getFullYear())
                        .sort((a, b) => a.range_min - b.range_min)
                        .map(rate => (
                          <SelectItem key={rate.id} value={rate.id}>
                            £${formatCurrency(rate.range_min)} - {rate.range_max ? `£${formatCurrency(rate.range_max)}` : 'No limit'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Bond Date *</Label>
                  <Input
                    type="date"
                    value={bondIncreaseFormData.bond_date}
                    onChange={(e) => setBondIncreaseFormData(prev => ({ ...prev, bond_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Bond Premium by IP (£)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedCase.ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.ip_name}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondIncreaseFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                    {selectedCase.joint_ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondIncreaseFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                    {selectedCase.joint_ip_name_2 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name_2}</div>
                        <div className="text-2xl font-bold text-blue-700">
                          £{formatCurrency(bondIncreaseFormData.bond_premium)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Submitted By</Label>
                  <Input
                    type="text"
                    value={bondIncreaseFormData.submitted_by}
                    onChange={(e) => setBondIncreaseFormData(prev => ({ ...prev, submitted_by: e.target.value }))}
                    placeholder="Enter name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleSaveIncreaseBond}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!bondIncreaseFormData.selected_bond_level || !bondIncreaseFormData.bond_date || isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Post
                </Button>
              </div>
            </div>
          ) : selectedOption === 'bank_reconciliation' ? (
            <BankReconciliation 
              case_={selectedCase}
              onClose={onClose}
              onUpdate={onUpdate}
            />
          ) : selectedOption === 'archive_case' ? (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="font-semibold text-amber-800">Case:</span>
                      <span className="text-amber-700 ml-2">{selectedCase.company_name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-amber-800">Reference:</span>
                      <span className="text-amber-700 ml-2">{selectedCase.case_reference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-amber-800">Status:</span>
                      <span className="text-amber-700 ml-2">{selectedCase.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center py-12">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Archive Case from Bonding</h3>
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  This will remove the case from the bonding section view. The case data will remain in the system but will no longer appear in bonding reports.
                </p>
                
                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleArchiveCase}
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={isArchiving}
                  >
                    {isArchiving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Archiving...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Confirm Archive
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : selectedOption === 'close_bond' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="font-semibold text-blue-800">Case:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.company_name}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Reference:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_reference}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-blue-800">Type:</span>
                      <span className="text-blue-700 ml-2">{selectedCase.case_type}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Bond Level *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formatNumberWithCommas(bondClosureFormData.bond_level)}
                    onChange={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                        setBondClosureFormData(prev => ({ ...prev, bond_level: parsed }));
                      }
                    }}
                    placeholder="Enter bond level"
                    className="mt-1 bg-slate-50"
                    readOnly
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Closure Date *</Label>
                  <Input
                    type="date"
                    value={bondClosureFormData.closure_date}
                    onChange={(e) => setBondClosureFormData(prev => ({ ...prev, closure_date: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">Bond Premium by IP (£)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    {selectedCase.ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.ip_name}</div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(bondClosureFormData.bond_premium)}
                          onChange={(e) => {
                            const parsed = parseFormattedNumber(e.target.value);
                            if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                              setBondClosureFormData(prev => ({ ...prev, bond_premium: parsed }));
                            }
                          }}
                          placeholder="0.00"
                          className="text-center font-bold text-blue-700"
                        />
                      </div>
                    )}
                    {selectedCase.joint_ip_name && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name}</div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(bondClosureFormData.bond_premium)}
                          onChange={(e) => {
                            const parsed = parseFormattedNumber(e.target.value);
                            if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                              setBondClosureFormData(prev => ({ ...prev, bond_premium: parsed }));
                            }
                          }}
                          placeholder="0.00"
                          className="text-center font-bold text-blue-700"
                        />
                      </div>
                    )}
                    {selectedCase.joint_ip_name_2 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                        <div className="font-semibold text-blue-900 mb-2">{selectedCase.joint_ip_name_2}</div>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatNumberWithCommas(bondClosureFormData.bond_premium)}
                          onChange={(e) => {
                            const parsed = parseFormattedNumber(e.target.value);
                            if (/^-?\d*\.?\d*$/.test(parsed) || parsed === '') {
                              setBondClosureFormData(prev => ({ ...prev, bond_premium: parsed }));
                            }
                          }}
                          placeholder="0.00"
                          className="text-center font-bold text-blue-700"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">Submitted By</Label>
                  <Input
                    type="text"
                    value={bondClosureFormData.submitted_by}
                    onChange={(e) => setBondClosureFormData(prev => ({ ...prev, submitted_by: e.target.value }))}
                    placeholder="Enter name"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button
                  onClick={handleSaveCloseBond}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={!bondClosureFormData.bond_level || !bondClosureFormData.closure_date || isSaving}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Post
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
