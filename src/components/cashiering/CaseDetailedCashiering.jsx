import React, { useState, useEffect, useMemo, useRef } from "react";
import { Case } from "@/api/entities";
import { Transaction } from "@/api/entities";
import { AccountingEntry } from "@/api/entities";
import { ChartOfAccount } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calculator, FileText, TrendingUp, PoundSterling, Loader2, AlertCircle, RefreshCw, Shield, TrendingDown } from "lucide-react";
import AccountSummaryCard from "./AccountSummaryCard";
import TrialBalance from "../accounting/TrialBalance";
import ReceiptsAndPayments from "./ReceiptsAndPayments";
import DistributionsManager from "./DistributionsManager";

export default function CaseDetailedCashiering({ case_, onBack, hideHeader = false }) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('trial_balance');
  const [retryCount, setRetryCount] = useState(0);
  const [vatControlBalance, setVatControlBalance] = useState(0);
  const [assetRealisations, setAssetRealisations] = useState(0);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('primary');
  const loadingRef = useRef(false);
  const lastCaseIdRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      if (!case_?.id) return;
      
      // Prevent duplicate calls
      if (loadingRef.current || lastCaseIdRef.current === case_.id) {
        return;
      }
      
      loadingRef.current = true;
      lastCaseIdRef.current = case_.id;
      setIsLoading(true);
      setError(null);

      try {
        // Load transactions
        const transactionsData = await Transaction.filter({ case_id: case_.id });
        setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
        
        // Load Chart of Accounts
        const coaData = await ChartOfAccount.list();
        setChartOfAccounts(Array.isArray(coaData) ? coaData : []);
        
        // Load VAT Control Account balance from accounting entries
        try {
          const vat003Entries = await AccountingEntry.filter({
            case_id: case_.id,
            account_code: 'VAT003'
          });
          
          if (vat003Entries && vat003Entries.length > 0) {
            let totalDebits = 0;
            let totalCredits = 0;
            
            vat003Entries.forEach(entry => {
              totalDebits += parseFloat(entry.debit_amount) || 0;
              totalCredits += parseFloat(entry.credit_amount) || 0;
            });
            
            // Net balance: debits - credits
            // Positive (debit balance) = refund due from HMRC
            // Negative (credit balance) = payment due to HMRC
            const netBalance = totalDebits - totalCredits;
            setVatControlBalance(netBalance);
            console.log('VAT Control Account (VAT003) balance:', netBalance);
          } else {
            setVatControlBalance(0);
          }
        } catch (vatError) {
          console.error('Error loading VAT Control balance:', vatError);
          setVatControlBalance(0);
        }
        
        // Calculate Asset Realisations from account groups (APPROVED transactions only)
        try {
          const accountingEntries = await AccountingEntry.filter({ case_id: case_.id });
          const chartOfAccountsData = await ChartOfAccount.list();
          const caseTransactions = await Transaction.filter({ case_id: case_.id });
          
          // Get approved transaction IDs only
          const approvedTransactionIds = caseTransactions
            .filter(t => t.status === 'approved')
            .map(t => t.id);
          
          // Filter entries to only those from approved transactions
          const approvedEntries = accountingEntries.filter(entry => 
            approvedTransactionIds.includes(entry.transaction_id)
          );
          
          let totalRealisations = 0;
          
          // Get unique account codes from approved entries
          const accountCodesInEntries = [...new Set(approvedEntries.map(e => e.account_code))];
          
          // For each account code, check if its account_group is a realisation group
          accountCodesInEntries.forEach(accountCode => {
            const account = chartOfAccountsData.find(acc => acc.account_code === accountCode);
            
            if (!account) return;
            
            const accountGroup = (account.account_group || '').trim();
            
            // Only include accounts in realisation groups
            if (accountGroup === 'Asset Realisations' ||
                accountGroup === 'Fixed Charge Realisations' || 
                accountGroup === 'Floating Charge Realisations') {
              
              // Sum up this account's entries (credits - debits) from approved transactions
              const accountEntries = approvedEntries.filter(entry => entry.account_code === accountCode);
              
              let accountBalance = 0;
              accountEntries.forEach(entry => {
                accountBalance += (parseFloat(entry.credit_amount) || 0) - (parseFloat(entry.debit_amount) || 0);
              });
              
              totalRealisations += accountBalance;
            }
          });
          
          setAssetRealisations(totalRealisations);
          console.log('Asset Realisations (from realisation groups, approved only):', totalRealisations);
        } catch (assetError) {
          console.error('Error calculating asset realisations:', assetError);
          setAssetRealisations(0);
        }
        
        setRetryCount(0);
      } catch (err) {
        console.error("Error loading cashiering data:", err);
        const errorMessage = err.message || "Failed to load data";
        
        if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
          setError("Rate limit exceeded. Please wait a moment and try again.");
        } else if (errorMessage.includes('Network Error') || errorMessage.includes('Failed to fetch')) {
          setError("Network connection issue loading data. Please check your internet connection.");
        } else {
          setError(errorMessage);
        }
        
        setRetryCount(prev => prev + 1);
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
      }
    };

    loadData();
  }, [case_?.id]);

  const handleRetry = () => {
    // Reset the loading ref to allow retry
    loadingRef.current = false;
    lastCaseIdRef.current = null;
    setRetryCount(prev => prev + 1);
  };

  const accountBalance = useMemo(() => {
    const transactionsArray = Array.isArray(transactions) ? transactions : [];
    return transactionsArray
      .filter(t => {
        if (t.account_type !== 'case_account') return false;
        if (selectedAccount === 'all') return true;
        return t.target_account === selectedAccount || !t.target_account;
      })
      .reduce((acc, t) => {
        if (t.transaction_type === 'receipt') {
          return acc + (parseFloat(t.amount) || 0);
        } else {
          return acc - (parseFloat(t.amount) || 0);
        }
      }, 0);
  }, [transactions, selectedAccount]);

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Determine VAT box styling based on balance
  const getVATBoxStyle = () => {
    if (vatControlBalance < -0.01) {
      // Credit balance (negative) = Payment due TO HMRC = Red
      return {
        containerClass: 'bg-red-50 border border-red-300 rounded-lg px-6 py-2 min-w-[270px]',
        labelClass: 'text-xs font-medium text-red-700',
        valueClass: 'text-lg font-bold text-red-900',
        label: 'VAT Control Account (Payment Due)'
      };
    } else if (vatControlBalance > 0.01) {
      // Debit balance (positive) = Refund due FROM HMRC = Green
      return {
        containerClass: 'bg-green-50 border border-green-300 rounded-lg px-6 py-2 min-w-[270px]',
        labelClass: 'text-xs font-medium text-green-700',
        valueClass: 'text-lg font-bold text-green-900',
        label: 'VAT Control Account (Refund Due)'
      };
    } else {
      // Zero or near-zero balance = Neutral
      return {
        containerClass: 'bg-slate-50 border border-slate-200 rounded-lg px-6 py-2 min-w-[270px]',
        labelClass: 'text-xs font-medium text-slate-600',
        valueClass: 'text-lg font-bold text-slate-900',
        label: 'VAT Control Account'
      };
    }
  };

  const vatBoxStyle = getVATBoxStyle();

  // Determine available bank accounts
  const hasSecondaryAccount = case_.secondary_bank_details && 
    case_.secondary_bank_details.bank_name && 
    case_.secondary_bank_details.account_number;

  const bankAccountOptions = [
    { value: 'primary', label: case_.bank_details?.bank_name || 'Primary Account' },
    ...(hasSecondaryAccount ? [{ value: 'secondary', label: case_.secondary_bank_details.bank_name || 'Secondary Account' }] : [])
  ];

  const toolbarItems = [
    { id: 'trial_balance', label: 'Trial Balance', icon: Calculator },
    { id: 'rnp', label: 'R&P', icon: FileText },
    { id: 'eos', label: 'EOS', icon: Shield },
    { id: 'distributions', label: 'Distributions', icon: PoundSterling }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'trial_balance':
        return <TrialBalance caseId={case_.id} selectedAccount={selectedAccount} />;
      case 'rnp':
        return <ReceiptsAndPayments case_={case_} selectedAccount={selectedAccount} onClose={() => {}} />;
      case 'eos':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Estimated Outcome Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Estimated Outcome Statement</h3>
                <p className="text-slate-500">EOS functionality will be implemented here.</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'distributions':
        return <DistributionsManager caseId={case_.id} />;
      default:
        return null;
    }
  };

  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-6">
        {!hideHeader && (
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Summary
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-slate-600 font-medium">Loading case data...</p>
              {retryCount > 0 && (
                <p className="text-slate-500 text-sm mt-2">
                  Retry attempt {retryCount} of 3...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className="space-y-6">
        {!hideHeader && (
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Summary
            </Button>
          </div>
        )}

        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center max-w-md mx-auto">
              <div className="text-red-500 mb-4">
                <AlertCircle className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {error.includes('Rate limit') ? 'Rate Limit Exceeded' : 'Connection Error'}
              </h3>
              <p className="text-slate-600 mb-6">{error}</p>
              {error.includes('Rate limit') && (
                <p className="text-sm text-slate-500 mb-4">
                  Please wait a moment before trying again. This helps prevent server overload.
                </p>
              )}
              <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Summary
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{case_.company_name}</h1>
              <p className="text-slate-600">{case_.case_reference}</p>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            {/* Main toolbar with buttons */}
            <div className="flex items-center flex-wrap gap-2">
              {toolbarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant={activeSection === item.id ? "default" : "outline"}
                    onClick={() => setActiveSection(item.id)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                );
              })}
              
              {/* Bank Account Selector */}
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bankAccountOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Account Balances */}
            <div className="flex gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-6 py-2 min-w-[270px]">
                <div className="text-center">
                  <p className="text-xs font-medium text-blue-600">Case Account Balance</p>
                  <p className="text-lg font-bold text-blue-900">£{formatCurrency(accountBalance)}</p>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg px-6 py-2 min-w-[270px]">
                <div className="text-center">
                  <p className="text-xs font-medium text-purple-600">Asset Realisations</p>
                  <p className="text-lg font-bold text-purple-900">£{formatCurrency(assetRealisations)}</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg px-6 py-2 min-w-[270px]">
                <div className="text-center">
                  <p className="text-xs font-medium text-green-600">SOA ETR</p>
                  <p className="text-lg font-bold text-green-900">£{formatCurrency(case_.soa_etr || 0)}</p>
                </div>
              </div>

              <div 
                className="rounded-lg px-6 py-2 min-w-[270px]"
                style={{ backgroundColor: 'rgba(165, 124, 0, 0.08)', border: '1px solid rgba(165, 124, 0, 0.3)' }}
              >
                <div className="text-center">
                  <p className="text-xs font-medium" style={{ color: '#A57C00' }}>Distributions</p>
                  <p className="text-lg font-bold" style={{ color: '#7d5d00' }}>£{formatCurrency(case_.total_funds_distributed || 0)}</p>
                </div>
              </div>

              <div className={vatBoxStyle.containerClass}>
                <div className="text-center">
                  <p className={vatBoxStyle.labelClass}>{vatBoxStyle.label}</p>
                  <p className={vatBoxStyle.valueClass}>£{formatCurrency(Math.abs(vatControlBalance))}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Show network error warning if we have partial data */}
      {error && transactions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="text-amber-800 font-medium">Connection Issue</p>
                <p className="text-amber-700 text-sm">{error}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Area */}
      {renderContent()}
    </div>
  );
}