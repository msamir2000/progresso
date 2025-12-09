import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function ReceiptsAndPayments({ case_, onClose, selectedAccount = 'primary' }) {
  const [dateFrom, setDateFrom] = useState(case_?.appointment_date || '');
  const [dateTo, setDateTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rnpData, setRnpData] = useState({
    assetRealisations: {},
    costOfRealisations: {},
    tradingExpenses: {},
    preferentialCreditors: {},
    secondaryPreferentialCreditors: {},
    unsecuredCreditors: {},
    bankBalances: {},
    vatControlBalance: 0,
    interestBearingBalance: 0,
    soaData: {}
  });

  useEffect(() => {
    if (dateFrom && dateTo) {
      loadRnPData();
    }
  }, [dateFrom, dateTo, selectedAccount]);

  const loadRnPData = async () => {
    setIsLoading(true);
    try {
      console.log('=== R&P LOADING - ONLY POSTED TRANSACTIONS ===');
      
      const soaDocs = await base44.entities.StatementOfAffairs.filter({
        case_id: case_.id
      });
      const latestSoa = soaDocs.sort((a, b) => b.version - a.version)[0];
      
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      const sinceAppointment = new Date(case_.appointment_date);

      const allAccountingEntries = await base44.entities.AccountingEntry.filter({
        case_id: case_.id
      });

      console.log('Total accounting entries found:', allAccountingEntries.length);

      // CRITICAL FIX: Get all valid transaction IDs to filter out orphaned entries
      const allTransactions = await base44.entities.Transaction.filter({ case_id: case_.id });

      // Filter transactions by selected account if not 'all'
      const filteredTransactions = selectedAccount === 'all' 
        ? allTransactions 
        : allTransactions.filter(t => {
            const txAccount = t.target_account || 'primary';
            return txAccount === selectedAccount;
          });

      console.log('Transactions after account filter:', filteredTransactions.length, 'for account:', selectedAccount);

      const validTransactionIds = new Set(filteredTransactions.map(t => t.id));
      
      // Filter out orphaned accounting entries (where transaction was deleted)
      // Exclude adjusting entries (VAT allocations) as they're account-wide, not bank-specific
      const validAccountingEntries = allAccountingEntries.filter(entry => {
        // Skip adjusting entries (VAT allocations) - they don't relate to specific bank accounts
        if (entry.journal_type === 'adjusting') return false;
        // Only keep entries that reference existing transactions
        if (!entry.transaction_id) return false;
        return validTransactionIds.has(entry.transaction_id);
      });
      
      console.log('Valid accounting entries after filtering orphans:', validAccountingEntries.length);
      console.log('Orphaned entries removed:', allAccountingEntries.length - validAccountingEntries.length);

      const assetRealisations = {};
      const aaEntries = validAccountingEntries.filter(e => e.account_type === 'AA');
      console.log('AA entries (Asset Realisations):', aaEntries.length);
      
      const aaAccountNames = [...new Set(aaEntries.map(e => e.account_name))];
      
      aaAccountNames.forEach(accountName => {
        const entriesInPeriod = aaEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= fromDate &&
          new Date(e.entry_date) <= toDate
        );
        
        const entriesSinceApp = aaEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= sinceAppointment &&
          new Date(e.entry_date) <= toDate
        );
        
        const amountInPeriod = entriesInPeriod.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        const amountSinceApp = entriesSinceApp.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        if (Math.abs(amountInPeriod) > 0.01 || Math.abs(amountSinceApp) > 0.01) {
          assetRealisations[accountName] = {
            period: Math.abs(amountInPeriod),
            sinceApp: Math.abs(amountSinceApp)
          };
          console.log(`Asset Realisation: ${accountName} - Period: ${amountInPeriod}, Since App: ${amountSinceApp}`);
        }
      });

      const costOfRealisations = {};
      const coEntries = validAccountingEntries.filter(e => e.account_type === 'CO');
      console.log('CO entries (Cost of Realisations):', coEntries.length);
      
      const coAccountNames = [...new Set(coEntries.map(e => e.account_name))];
      
      coAccountNames.forEach(accountName => {
        const entriesInPeriod = coEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= fromDate &&
          new Date(e.entry_date) <= toDate
        );
        
        const entriesSinceApp = coEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= sinceAppointment &&
          new Date(e.entry_date) <= toDate
        );
        
        const amountInPeriod = entriesInPeriod.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        const amountSinceApp = entriesSinceApp.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        if (Math.abs(amountInPeriod) > 0.01 || Math.abs(amountSinceApp) > 0.01) {
          costOfRealisations[accountName] = {
            period: Math.abs(amountInPeriod),
            sinceApp: Math.abs(amountSinceApp)
          };
          console.log(`Cost of Realisation: ${accountName} - Period: ${amountInPeriod}, Since App: ${amountSinceApp}`);
        }
      });

      const tradingExpenses = {};
      const trEntries = validAccountingEntries.filter(e => e.account_type === 'TR');
      console.log('TR entries (Trading Expenses):', trEntries.length);
      
      const trAccountNames = [...new Set(trEntries.map(e => e.account_name))];
      
      trAccountNames.forEach(accountName => {
        const entriesInPeriod = trEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= fromDate &&
          new Date(e.entry_date) <= toDate
        );
        
        const entriesSinceApp = trEntries.filter(e => 
          e.account_name === accountName &&
          new Date(e.entry_date) >= sinceAppointment &&
          new Date(e.entry_date) <= toDate
        );
        
        const amountInPeriod = entriesInPeriod.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        const amountSinceApp = entriesSinceApp.reduce((sum, e) => 
          sum + (parseFloat(e.credit_amount) || 0) - (parseFloat(e.debit_amount) || 0), 0
        );
        
        if (Math.abs(amountInPeriod) > 0.01 || Math.abs(amountSinceApp) > 0.01) {
          tradingExpenses[accountName] = {
            period: Math.abs(amountInPeriod),
            sinceApp: Math.abs(amountSinceApp)
          };
          console.log(`Trading Expense: ${accountName} - Period: ${amountInPeriod}, Since App: ${amountSinceApp}`);
        }
      });

      const creditors = await base44.entities.Creditor.filter({
        case_id: case_.id
      });

      const preferentialPayments = { period: 0, sinceApp: 0 };
      const secondaryPreferentialPayments = { period: 0, sinceApp: 0 };
      const unsecuredPayments = { period: 0, sinceApp: 0 };

      creditors.forEach(creditor => {
        const creditorEntries = validAccountingEntries.filter(e => 
          e.description?.includes(creditor.creditor_name) ||
          e.account_name?.includes(creditor.creditor_name)
        );
        
        creditorEntries.forEach(entry => {
          const entryDate = new Date(entry.entry_date);
          const inPeriod = entryDate >= fromDate && entryDate <= toDate;
          const sinceApp = entryDate >= sinceAppointment && entryDate <= toDate;
          
          if (!inPeriod && !sinceApp) return;
          
          const amount = parseFloat(entry.debit_amount) || 0;
          
          if (creditor.creditor_type === 'preferential') {
            if (inPeriod) preferentialPayments.period += amount;
            if (sinceApp) preferentialPayments.sinceApp += amount;
          } else if (creditor.creditor_type === 'secondary_preferential') {
            if (inPeriod) secondaryPreferentialPayments.period += amount;
            if (sinceApp) secondaryPreferentialPayments.sinceApp += amount;
          } else if (creditor.creditor_type === 'unsecured') {
            if (inPeriod) unsecuredPayments.period += amount;
            if (sinceApp) unsecuredPayments.sinceApp += amount;
          }
        });
      });

      const bankBalances = {};
      const bankEntries = validAccountingEntries.filter(e => 
        e.account_group === 'Bank Accounts' &&
        new Date(e.entry_date) <= toDate
      );
      
      const bankAccountNames = [...new Set(bankEntries.map(e => e.account_name))];
      console.log('Bank accounts found:', bankAccountNames);

      bankAccountNames.forEach(accountName => {
        const entries = bankEntries.filter(e => e.account_name === accountName);
        const balance = entries.reduce((sum, e) => 
          sum + (parseFloat(e.debit_amount) || 0) - (parseFloat(e.credit_amount) || 0), 0
        );

        if (Math.abs(balance) > 0.01) {
          bankBalances[accountName] = balance;
          console.log(`Bank Balance: ${accountName} = ${balance}`);
        }
      });

      const vatControlEntries = validAccountingEntries.filter(e =>
        (e.account_code === 'VAT003' || 
         (e.account_name && e.account_name.toLowerCase().includes('vat control'))) &&
        new Date(e.entry_date) <= toDate
      );
      
      const vatControlBalance = vatControlEntries.reduce((sum, e) =>
        sum + (parseFloat(e.debit_amount) || 0) - (parseFloat(e.credit_amount) || 0), 0
      );
      
      console.log('VAT Control Account balance:', vatControlBalance);

      // Load Interest Bearing Current Account (FLTC) balance
      const fltcEntries = validAccountingEntries.filter(e =>
        (e.account_code === 'FLTC' || 
         (e.account_name && e.account_name.toLowerCase().includes('interest bearing current account'))) &&
        new Date(e.entry_date) <= toDate
      );
      
      const interestBearingBalance = fltcEntries.reduce((sum, e) =>
        sum + (parseFloat(e.debit_amount) || 0) - (parseFloat(e.credit_amount) || 0), 0
      );
      
      console.log('Interest Bearing Current Account balance:', interestBearingBalance);

      let soaData = {};
      if (latestSoa && latestSoa.data) {
        try {
          const data = typeof latestSoa.data === 'string' ? JSON.parse(latestSoa.data) : latestSoa.data;
          soaData = {
            stock: data.stock_book_value || 0,
            preferentialCreditors: data.preferential_creditors_total || 0,
            secondaryPreferentialCreditors: data.secondary_preferential_total || 0,
            unsecuredCreditors: data.unsecured_creditors_total || 0
          };
        } catch (e) {
          console.error('Error parsing SOA data:', e);
        }
      }

      console.log('=== R&P DATA COMPLETE ===');
      console.log('Asset Realisations:', assetRealisations);
      console.log('Cost of Realisations:', costOfRealisations);
      console.log('Trading Expenses:', tradingExpenses);
      console.log('Bank Balances:', bankBalances);
      console.log('VAT Control:', vatControlBalance);
      console.log('Interest Bearing:', interestBearingBalance);

      setRnpData({
        assetRealisations,
        costOfRealisations,
        tradingExpenses,
        preferentialCreditors: preferentialPayments,
        secondaryPreferentialCreditors: secondaryPreferentialPayments,
        unsecuredCreditors: unsecuredPayments,
        bankBalances,
        vatControlBalance,
        interestBearingBalance,
        soaData
      });
    } catch (error) {
      console.error('Error loading R&P data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTotals = () => {
    const periodTotal = 
      Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.period, 0) -
      Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.period, 0) -
      Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.period, 0) -
      rnpData.preferentialCreditors.period -
      rnpData.secondaryPreferentialCreditors.period -
      rnpData.unsecuredCreditors.period;

    const sinceAppTotal = 
      Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.sinceApp, 0) -
      Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.sinceApp, 0) -
      Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.sinceApp, 0) -
      rnpData.preferentialCreditors.sinceApp -
      rnpData.secondaryPreferentialCreditors.sinceApp -
      rnpData.unsecuredCreditors.sinceApp;

    return { periodTotal, sinceAppTotal };
  };

  const totals = calculateTotals();

  const handleExport = () => {
    const isCVL = case_?.case_type === 'CVL';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipts & Payments - ${case_?.company_name}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      background-color: #f9fafb;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
      color: #1e293b;
    }
    .header p {
      margin: 5px 0;
      color: #64748b;
    }
    table {
      width: 1100px; /* Changed from 900px */
      margin: 0 auto;
      border-collapse: collapse;
      background: white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 16px;
      font-size: 14px;
    }
    th {
      background-color: #A57C00;
      color: white;
      font-weight: 600;
      text-align: center;
    }
    .section-header {
      background-color: #f1f5f9;
      font-weight: bold;
    }
    .indent {
      padding-left: 32px;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .bold {
      font-weight: bold;
    }
    .total-row {
      background-color: #A57C00;
      color: white;
      font-weight: bold;
    }
    .empty-row td {
      padding: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Receipts & Payments Account</h1>
    <p><strong>${case_?.company_name}</strong></p>
    <p>Case Reference: ${case_?.case_reference}</p>
    <p>Period: ${formatDate(dateFrom)} to ${formatDate(dateTo)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 100px;">${showSoA ? 'SoA' : 'Dec of Sol'}<br/>(£)</th> <!-- Changed from 75px to 100px -->
        <th style="text-align: left; width: 33%;"></th>
        <th style="width: 150px;">From ${formatDate(dateFrom)}<br/>to ${formatDate(dateTo)} (£)</th> <!-- Changed from 75px to 150px -->
        <th style="width: 150px;">From ${formatDate(case_.appointment_date)}<br/>to ${formatDate(dateTo)} (£)</th> <!-- Changed from 75px to 150px -->
      </tr>
    </thead>
    <tbody>
      <!-- Asset Realisations -->
      <tr class="section-header">
        <td></td>
        <td class="bold">ASSET REALISATIONS</td>
        <td></td>
        <td></td>
      </tr>
      ${Object.entries(rnpData.assetRealisations).map(([name, values]) => `
      <tr>
        <td class="text-right">${rnpData.soaData.stock !== 0 ? formatCurrency(rnpData.soaData.stock) : 'NIL'}</td>
        <td class="indent">${name}</td>
        <td class="text-right">${values.period !== 0 ? formatCurrency(values.period) : 'NIL'}</td>
        <td class="text-right">${values.sinceApp !== 0 ? formatCurrency(values.sinceApp) : 'NIL'}</td>
      </tr>
      `).join('')}
      <tr>
        <td class="text-right"></td>
        <td class="indent"></td>
        <td class="text-right bold">
          ${Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.period, 0) !== 0 
            ? formatCurrency(Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.period, 0)) 
            : 'NIL'}
        </td>
        <td class="text-right bold">
          ${Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
            ? formatCurrency(Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.sinceApp, 0)) 
            : 'NIL'}
        </td>
      </tr>
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Cost of Realisations -->
      <tr class="section-header">
        <td></td>
        <td class="bold">COST OF REALISATIONS</td>
        <td></td>
        <td></td>
      </tr>
      ${Object.entries(rnpData.costOfRealisations).map(([name, values]) => `
      <tr>
        <td class="text-right"></td>
        <td class="indent">${name}</td>
        <td class="text-right">${values.period !== 0 ? `(${formatCurrency(values.period)})` : 'NIL'}</td>
        <td class="text-right">${values.sinceApp !== 0 ? `(${formatCurrency(values.sinceApp)})` : 'NIL'}</td>
      </tr>
      `).join('')}
      <tr>
        <td class="text-right"></td>
        <td class="indent"></td>
        <td class="text-right bold">
          ${Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.period, 0) !== 0 
            ? `(${formatCurrency(Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.period, 0))})` 
            : 'NIL'}
        </td>
        <td class="text-right bold">
          ${Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
            ? `(${formatCurrency(Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.sinceApp, 0))})` 
            : 'NIL'}
        </td>
      </tr>
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Trading Expenses -->
      <tr class="section-header">
        <td></td>
        <td class="bold">TRADING EXPENSES</td>
        <td></td>
        <td></td>
      </tr>
      ${Object.entries(rnpData.tradingExpenses).map(([name, values]) => `
      <tr>
        <td class="text-right"></td>
        <td class="indent">${name}</td>
        <td class="text-right">${values.period !== 0 ? `(${formatCurrency(values.period)})` : 'NIL'}</td>
        <td class="text-right">${values.sinceApp !== 0 ? `(${formatCurrency(values.sinceApp)})` : 'NIL'}</td>
      </tr>
      `).join('')}
      <tr>
        <td class="text-right"></td>
        <td class="indent"></td>
        <td class="text-right bold">
          ${Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.period, 0) !== 0 
            ? `(${formatCurrency(Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.period, 0))})` 
            : 'NIL'}
        </td>
        <td class="text-right bold">
          ${Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
            ? `(${formatCurrency(Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.sinceApp, 0))})` 
            : 'NIL'}
        </td>
      </tr>
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Preferential Creditors -->
      ${rnpData.preferentialCreditors.period === 0 && rnpData.preferentialCreditors.sinceApp === 0 ? `
      <tr class="section-header">
        <td></td>
        <td class="bold">PREFERENTIAL CREDITORS</td>
        <td class="text-right">NIL</td>
        <td class="text-right">NIL</td>
      </tr>
      ` : `
      <tr class="section-header">
        <td></td>
        <td class="bold">PREFERENTIAL CREDITORS</td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td class="text-right"></td>
        <td class="indent">Employee</td>
        <td class="text-right">${formatCurrency(rnpData.preferentialCreditors.period)}</td>
        <td class="text-right">${formatCurrency(rnpData.preferentialCreditors.sinceApp)}</td>
      </tr>
      `}
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Secondary Preferential Creditors -->
      ${rnpData.secondaryPreferentialCreditors.period === 0 && rnpData.secondaryPreferentialCreditors.sinceApp === 0 ? `
      <tr class="section-header">
        <td></td>
        <td class="bold">SECONDARY PREFERENTIAL CREDITORS</td>
        <td class="text-right">NIL</td>
        <td class="text-right">NIL</td>
      </tr>
      ` : `
      <tr class="section-header">
        <td></td>
        <td class="bold">SECONDARY PREFERENTIAL CREDITORS</td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td class="text-right"></td>
        <td class="indent">HMRC</td>
        <td class="text-right">${formatCurrency(rnpData.secondaryPreferentialCreditors.period)}</td>
        <td class="text-right">${formatCurrency(rnpData.secondaryPreferentialCreditors.sinceApp)}</td>
      </tr>
      `}
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Unsecured Creditors -->
      ${rnpData.unsecuredCreditors.period === 0 && rnpData.unsecuredCreditors.sinceApp === 0 ? `
      <tr class="section-header">
        <td></td>
        <td class="bold">UNSECURED CREDITORS</td>
        <td class="text-right">NIL</td>
        <td class="text-right">NIL</td>
      </tr>
      ` : `
      <tr class="section-header">
        <td></td>
        <td class="bold">UNSECURED CREDITORS</td>
        <td></td>
        <td></td>
      </tr>
      <tr>
        <td class="text-right"></td>
        <td class="indent"></td>
        <td class="text-right">${formatCurrency(rnpData.unsecuredCreditors.period)}</td>
        <td class="text-right">${formatCurrency(rnpData.unsecuredCreditors.sinceApp)}</td>
      </tr>
      `}
      <tr class="empty-row">
        <td></td><td></td><td></td><td></td>
      </tr>

      <!-- Totals -->
      <tr class="total-row">
        <td class="text-right"></td>
        <td></td>
        <td class="text-right">${formatCurrency(totals.periodTotal)}</td>
        <td class="text-right">${formatCurrency(totals.sinceAppTotal)}</td>
      </tr>

      <!-- Represented By -->
      <tr class="section-header">
        <td></td>
        <td class="bold">REPRESENTED BY</td>
        <td></td>
        <td></td>
      </tr>
      ${Object.entries(rnpData.bankBalances).map(([name, balance]) => `
      <tr>
        <td class="text-right"></td>
        <td class="indent">${name}</td>
        <td class="text-right"></td>
        <td class="text-right">${formatCurrency(balance)}</td>
      </tr>
      `).join('')}
      <tr>
        <td class="text-right"></td>
        <td class="indent">VAT Control Account</td>
        <td class="text-right"></td>
        <td class="text-right">
          ${rnpData.vatControlBalance < 0 
            ? `(${formatCurrency(Math.abs(rnpData.vatControlBalance))})` 
            : formatCurrency(Math.abs(rnpData.vatControlBalance))}
        </td>
      </tr>
      <tr>
        <td class="text-right"></td>
        <td class="indent">Interest Bearing Current Account</td>
        <td class="text-right"></td>
        <td class="text-right">
          ${Math.abs(rnpData.interestBearingBalance) > 0.01 
            ? formatCurrency(rnpData.interestBearingBalance) 
            : 'NIL'}
        </td>
      </tr>
      
      <!-- Final Total -->
      <tr class="total-row">
        <td class="text-right"></td>
        <td></td>
        <td class="text-right"></td>
        <td class="text-right">
          ${formatCurrency(
            Object.values(rnpData.bankBalances).reduce((sum, v) => sum + v, 0) + 
            rnpData.vatControlBalance + 
            rnpData.interestBearingBalance
          )}
        </td>
      </tr>
    </tbody>
  </table>
</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();
  };

  const isCVL = case_?.case_type === 'CVL';
  const isAdministration = case_?.case_type === 'Administration';
  const showSoA = isCVL || isAdministration;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-end gap-4">
          <div className="w-48">
            <Label className="text-sm font-medium text-slate-700">Date From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="w-48">
            <Label className="text-sm font-medium text-slate-700">Date To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => loadRnPData()}
            disabled={!dateFrom || !dateTo || isLoading}
            className="text-blue-600 border-blue-300"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700"
            disabled={!dateFrom || !dateTo}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : !dateFrom || !dateTo ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <p>Please select date range to generate Receipts & Payments account</p>
        </div>
      ) : (
        <div className="border border-slate-300 rounded-lg overflow-hidden mx-auto" style={{ maxWidth: '1100px' }}> {/* Changed from 900px */}
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#A57C00' }}>
              <tr>
                <th className="border border-slate-300 px-4 py-1 text-center font-semibold text-white" style={{ width: '100px' }}> {/* Changed from 75px to 100px */}
                  {showSoA ? 'SoA' : 'Dec of Sol'}<br/>(£)
                </th>
                <th className="border border-slate-300 px-4 py-1 text-left font-semibold text-white w-1/3"></th>
                <th className="border border-slate-300 px-4 py-1 text-center font-semibold text-white" style={{ width: '150px' }}> {/* Changed from 75px to 150px */}
                  From {formatDate(dateFrom)}<br/>to {formatDate(dateTo)} (£)
                </th>
                <th className="border border-slate-300 px-4 py-1 text-center font-semibold text-white" style={{ width: '150px' }}> {/* Changed from 75px to 150px */}
                  From {formatDate(case_.appointment_date)}<br/>to {formatDate(dateTo)} (£)
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Asset Realisations */}
              <tr className="bg-slate-50">
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1 font-bold">
                  ASSET REALISATIONS
                </td>
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1"></td>
              </tr>
              {Object.entries(rnpData.assetRealisations).map(([name, values]) => (
                <tr key={name}>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {rnpData.soaData.stock !== 0 ? formatCurrency(rnpData.soaData.stock) : 'NIL'}
                  </td>
                  <td className="border border-slate-300 px-4 py-1 pl-8">{name}</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.period !== 0 ? formatCurrency(values.period) : 'NIL'}
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.sinceApp !== 0 ? formatCurrency(values.sinceApp) : 'NIL'}
                  </td>
                </tr>
              ))}
              
              {/* Total Asset Realisations - immediately after entries with no gap */}
              <tr>
                <td className="border border-slate-300 px-4 py-1 text-right"></td>
                <td className="border border-slate-300 px-4 py-1 pl-8"></td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.period, 0) !== 0 
                    ? formatCurrency(Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.period, 0)) 
                    : 'NIL'}
                </td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
                    ? formatCurrency(Object.values(rnpData.assetRealisations).reduce((sum, v) => sum + v.sinceApp, 0)) 
                    : 'NIL'}
                </td>
              </tr>

              {/* Empty row after total */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Cost of Realisations */}
              <tr className="bg-slate-50">
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1 font-bold">
                  COST OF REALISATIONS
                </td>
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1"></td>
              </tr>
              {Object.entries(rnpData.costOfRealisations).map(([name, values]) => (
                <tr key={name}>
                  <td className="border border-slate-300 px-4 py-1 text-right"></td>
                  <td className="border border-slate-300 px-4 py-1 pl-8">{name}</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.period !== 0 ? `(${formatCurrency(values.period)})` : 'NIL'}
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.sinceApp !== 0 ? `(${formatCurrency(values.sinceApp)})` : 'NIL'}
                  </td>
                </tr>
              ))}
              
              {/* Total Cost of Realisations - immediately after entries with no gap */}
              <tr>
                <td className="border border-slate-300 px-4 py-1 text-right"></td>
                <td className="border border-slate-300 px-4 py-1 pl-8"></td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.period, 0) !== 0 
                    ? `(${formatCurrency(Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.period, 0))})` 
                    : 'NIL'}
                </td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
                    ? `(${formatCurrency(Object.values(rnpData.costOfRealisations).reduce((sum, v) => sum + v.sinceApp, 0))})` 
                    : 'NIL'}
                </td>
              </tr>

              {/* Empty row after total */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Trading Expenses */}
              <tr className="bg-slate-50">
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1 font-bold">
                  TRADING EXPENSES
                </td>
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1"></td>
              </tr>
              {Object.entries(rnpData.tradingExpenses).map(([name, values]) => (
                <tr key={name}>
                  <td className="border border-slate-300 px-4 py-1 text-right"></td>
                  <td className="border border-slate-300 px-4 py-1 pl-8">{name}</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.period !== 0 ? `(${formatCurrency(values.period)})` : 'NIL'}
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {values.sinceApp !== 0 ? `(${formatCurrency(values.sinceApp)})` : 'NIL'}
                  </td>
                </tr>
              ))}
              
              {/* Total Trading Expenses */}
              <tr>
                <td className="border border-slate-300 px-4 py-1 text-right"></td>
                <td className="border border-slate-300 px-4 py-1 pl-8"></td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.period, 0) !== 0 
                    ? `(${formatCurrency(Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.period, 0))})` 
                    : 'NIL'}
                </td>
                <td className="border border-slate-300 px-4 py-1 text-right font-bold">
                  {Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.sinceApp, 0) !== 0 
                    ? `(${formatCurrency(Object.values(rnpData.tradingExpenses).reduce((sum, v) => sum + v.sinceApp, 0))})` 
                    : 'NIL'}
                </td>
              </tr>

              {/* Empty row after total */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Preferential Creditors */}
              {rnpData.preferentialCreditors.period === 0 && rnpData.preferentialCreditors.sinceApp === 0 ? (
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-4 py-1"></td>
                  <td className="border border-slate-300 px-4 py-1 font-bold">
                    PREFERENTIAL CREDITORS
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                </tr>
              ) : (
                <>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1 font-bold">
                      PREFERENTIAL CREDITORS
                    </td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-4 py-1 text-right"></td>
                    <td className="border border-slate-300 px-4 py-1 pl-8">Employee</td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.preferentialCreditors.period)}
                    </td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.preferentialCreditors.sinceApp)}
                    </td>
                  </tr>
                </>
              )}

              {/* Gap between sections */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Secondary Preferential Creditors */}
              {rnpData.secondaryPreferentialCreditors.period === 0 && rnpData.secondaryPreferentialCreditors.sinceApp === 0 ? (
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-4 py-1"></td>
                  <td className="border border-slate-300 px-4 py-1 font-bold">
                    SECONDARY PREFERENTIAL CREDITORS
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                </tr>
              ) : (
                <>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1 font-bold">
                      SECONDARY PREFERENTIAL CREDITORS
                    </td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-4 py-1 text-right"></td>
                    <td className="border border-slate-300 px-4 py-1 pl-8">HMRC</td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.secondaryPreferentialCreditors.period)}
                    </td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.secondaryPreferentialCreditors.sinceApp)}
                    </td>
                  </tr>
                </>
              )}

              {/* Gap between sections */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Unsecured Creditors */}
              {rnpData.unsecuredCreditors.period === 0 && rnpData.unsecuredCreditors.sinceApp === 0 ? (
                <tr className="bg-slate-50">
                  <td className="border border-slate-300 px-4 py-1"></td>
                  <td className="border border-slate-300 px-4 py-1 font-bold">
                    UNSECURED CREDITORS
                  </td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                  <td className="border border-slate-300 px-4 py-1 text-right">NIL</td>
                </tr>
              ) : (
                <>
                  <tr className="bg-slate-50">
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1 font-bold">
                      UNSECURED CREDITORS
                    </td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                    <td className="border border-slate-300 px-4 py-1"></td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-4 py-1 text-right"></td>
                    <td className="border border-slate-300 px-4 py-1 pl-8"></td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.unsecuredCreditors.period)}
                    </td>
                    <td className="border border-slate-300 px-4 py-1 text-right">
                      {formatCurrency(rnpData.unsecuredCreditors.sinceApp)}
                    </td>
                  </tr>
                </>
              )}

              {/* Gap between sections */}
              <tr>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
                <td className="border border-slate-300 px-4 py-3"></td>
              </tr>

              {/* Totals */}
              <tr className="font-bold" style={{ backgroundColor: '#A57C00' }}>
                <td className="border border-slate-300 px-4 py-2 text-right text-white"></td>
                <td className="border border-slate-300 px-4 py-2 text-white"></td>
                <td className="border border-slate-300 px-4 py-2 text-right text-white">
                  {formatCurrency(totals.periodTotal)}
                </td>
                <td className="border border-slate-300 px-4 py-2 text-right text-white">
                  {formatCurrency(totals.sinceAppTotal)}
                </td>
              </tr>

              {/* Represented By */}
              <tr className="bg-slate-50">
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1 font-bold">
                  REPRESENTED BY
                </td>
                <td className="border border-slate-300 px-4 py-1"></td>
                <td className="border border-slate-300 px-4 py-1"></td>
              </tr>
              {Object.entries(rnpData.bankBalances).map(([name, balance]) => (
                <tr key={name}>
                  <td className="border border-slate-300 px-4 py-1 text-right"></td>
                  <td className="border border-slate-300 px-4 py-1 pl-8">{name}</td>
                  <td className="border border-slate-300 px-4 py-1 text-right"></td>
                  <td className="border border-slate-300 px-4 py-1 text-right">
                    {formatCurrency(balance)}
                  </td>
                </tr>
              ))}

              {/* VAT Control Account */}
              <tr>
                <td className="border border-slate-300 px-4 py-2 text-right"></td>
                <td className="border border-slate-300 px-4 py-2 pl-8">VAT Control Account</td>
                <td className="border border-slate-300 px-4 py-2 text-right"></td>
                <td className="border border-slate-300 px-4 py-2 text-right">
                  {rnpData.vatControlBalance < 0 
                    ? `(${formatCurrency(Math.abs(rnpData.vatControlBalance))})`
                    : formatCurrency(Math.abs(rnpData.vatControlBalance))
                  }
                </td>
              </tr>
      
              {/* Interest Bearing Current Account */}
              <tr>
                <td className="border border-slate-300 px-4 py-2 text-right"></td>
                <td className="border border-slate-300 px-4 py-2 pl-8">Interest Bearing Current Account</td>
                <td className="border border-slate-300 px-4 py-2 text-right"></td>
                <td className="border border-slate-300 px-4 py-2 text-right">
                  {Math.abs(rnpData.interestBearingBalance) > 0.01 
                    ? formatCurrency(rnpData.interestBearingBalance) 
                    : 'NIL'
                  }
                </td>
              </tr>
              
              {/* Final Total */}
              <tr className="font-bold" style={{ backgroundColor: '#A57C00' }}>
                <td className="border border-slate-300 px-4 py-2 text-right text-white"></td>
                <td className="border border-slate-300 px-4 py-2 text-white"></td>
                <td className="border border-slate-300 px-4 py-2 text-right text-white"></td>
                <td className="border border-slate-300 px-4 py-2 text-right text-white">
                  {formatCurrency(
                    Object.values(rnpData.bankBalances).reduce((sum, v) => sum + v, 0) + 
                    rnpData.vatControlBalance + 
                    rnpData.interestBearingBalance
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}