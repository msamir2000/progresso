
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  FileText,
  Check,
  Calculator,
  Archive,
  Signature,
  Save,
  Loader2,
  ArrowLeft,
  Calendar,
  Banknote,
  TrendingUp, // Added from outline
  PoundSterling, // Added from outline
  AlertCircle, // Added from outline
  RefreshCw, // Added from outline
  Shield, // Added from outline
  BookOpen // Added from outline
} from 'lucide-react';
import { Transaction } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { base44 } from '@/api/base44Client';
import { Document } from '@/api/entities';

// Placeholder for TrialBalance component as it's referenced in the outline's renderContent
// In a real application, this would likely be in its own file and imported.
const TrialBalance = ({ caseId }) => (
  <Card>
    <CardHeader><CardTitle>Trial Balance for Case {caseId}</CardTitle></CardHeader>
    <CardContent>
      <div className="text-center py-12 text-slate-500">
        <Calculator className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-600 mb-2">Trial Balance</h3>
        <p className="text-slate-500">Trial Balance functionality for case {caseId} will be implemented here.</p>
      </div>
    </CardContent>
  </Card>
);

// New SignatureDialog component definition
const SignatureDialog = ({ isOpen, onClose, onSave, title, description, isSaving }) => {
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!signatureData || !signerName) {
      alert('Please provide signature and signer name');
      return;
    }
    onSave(signerName, signatureData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4">{description}</p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="signerNameDialog">Full Name</Label>
            <Input
              id="signerNameDialog"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <Label htmlFor="signatureDialog">Digital Signature</Label>
            <Input
              id="signatureDialog"
              value={signatureData}
              onChange={(e) => setSignatureData(e.target.value)}
              placeholder="Type your name to sign"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !signatureData || !signerName}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSaving ?
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
            <Save className="w-4 h-4 mr-2" />
            }
            Sign & Complete
          </Button>
        </div>
      </div>
    </div>
  );
};


export default function BankReconciliation({ case_, onBack, onUpdate }) {
  const [cashbookTransactions, setCashbookTransactions] = useState([]);
  const [reconciledItems, setReconciledItems] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [lastReconDate, setLastReconDate] = useState('');
  const [reconDate, setReconDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankBalance, setBankBalance] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // New state for save button
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  // Removed reconciliationComplete, completedBySignerName, and reconNotes states.
  const [bankStatementUrl, setBankStatementUrl] = useState('');

  // Added activeSection state as required by the outline's renderContent function
  const [activeSection, setActiveSection] = useState('trial_balance');

  // Added toolbarItems as per outline
  const toolbarItems = [
    { id: 'trial_balance', label: 'Trial Balance', icon: Calculator },
    { id: 'rnp', label: 'R&P', icon: FileText },
    { id: 'eos', label: 'EOS', icon: BookOpen },
    { id: 'distributions', label: 'Distributions', icon: PoundSterling }
  ];

  const [currentUser, setCurrentUser] = useState(null);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const loadCashbookTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch fresh transactions data
      const transactions = await Transaction.filter({ case_id: case_.id });

      // CRITICAL FIX: Only show approved transactions in bank reconciliation
      // Draft, pending, and rejected transactions should not appear here
      const approvedTransactions = transactions.filter(t =>
        t && t.id && t.status === 'approved'
      );

      // Filter transactions since last reconciliation date
      const filteredTransactions = lastReconDate ?
        approvedTransactions.filter((t) => new Date(t.transaction_date) > new Date(lastReconDate)) :
        approvedTransactions;

      console.log('Bank Reconciliation - Total transactions fetched:', transactions.length);
      console.log('Bank Reconciliation - Approved transactions:', approvedTransactions.length);
      console.log('Bank Reconciliation - After date filter:', filteredTransactions.length);

      setCashbookTransactions(filteredTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setCashbookTransactions([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  }, [case_.id, lastReconDate]);

  useEffect(() => {
    loadCashbookTransactions();
  }, [loadCashbookTransactions]);

  // Add a refresh function that can be called from parent
  useEffect(() => {
    if (onUpdate) {
      // If parent provides an onUpdate callback, refresh when called
      loadCashbookTransactions();
    }
  }, [onUpdate, loadCashbookTransactions]);

  const handleBankStatementUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const { file_url } = await UploadFile({ file });
      setBankStatementUrl(file_url);
      setUploadError(null);
    } catch (error) {
      setUploadError(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleItemReconcile = (transactionId) => {
    const newReconciled = new Set(reconciledItems);

    if (newReconciled.has(transactionId)) {
      newReconciled.delete(transactionId);
    } else {
      newReconciled.add(transactionId);
    }

    setReconciledItems(newReconciled);
  };

  const calculateBalances = () => {
    const totalCashbook = cashbookTransactions.reduce((acc, t) => {
      return acc + (t.transaction_type === 'receipt' ? t.amount : -t.amount);
    }, 0);

    const reconciledAmount = cashbookTransactions
      .filter((t) => reconciledItems.has(t.id))
      .reduce((acc, t) => acc + (t.transaction_type === 'receipt' ? t.amount : -t.amount), 0);

    const bankBalanceNum = parseFloat(bankBalance) || 0;
    const difference = bankBalanceNum - reconciledAmount;

    return {
      cashbook: totalCashbook,
      reconciledAmount,
      unreconciledAmount: totalCashbook - reconciledAmount,
      bank: bankBalanceNum,
      difference
    };
  };

  const balances = calculateBalances();

  // New function for saving progress
  const handleSaveReconciliation = async () => {
    setIsSaving(true);
    try {
      // In a real application, you would send this data to your backend
      // for persistence. This is a placeholder for that logic.
      console.log("Saving reconciliation progress:", {
        caseId: case_.id,
        reconDate,
        lastReconDate,
        bankBalance: parseFloat(bankBalance),
        reconciledItems: Array.from(reconciledItems),
        bankStatementUrl,
        balances: balances
      });
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Simulate API call
      // Optionally, show a success message
    } catch (error) {
      console.error('Error saving reconciliation:', error);
      // Optionally, show an error message
    } finally {
      setIsSaving(false);
    }
  };

  // Modified function for completing reconciliation with signature as per outline
  const handleCompleteReconciliation = async (signerNameFromDialog, signatureDataFromDialog) => {
    if (!reconDate || !bankBalance) return; // Added check from outline

    setIsCompleting(true);
    try {
      // Update reconciled transactions
      for (const transactionId of reconciledItems) {
        await Transaction.update(transactionId, {
          is_reconciled_to_bank: true
        });
      }

      // Create a bank reconciliation document record with submitted_by_name
      const reconDocument = await Document.create({
        case_id: case_.id,
        doc_type: 'Bank Reconciliation',
        file_url: bankStatementUrl || '',
        raw_text: JSON.stringify({
          reconciliation_date: reconDate,
          bank_balance: parseFloat(bankBalance),
          cashbook_balance: balances.cashbook,
          reconciled_items: Array.from(reconciledItems),
          submitted_by_name: currentUser?.full_name || signerNameFromDialog,
          submission_date: new Date().toISOString()
        })
      });

      setShowSignatureDialog(false);
      if (onBack) onBack(); // Navigates back after completion
    } catch (error) {
      console.error('Error completing reconciliation:', error);
    } finally {
      setIsCompleting(false);
    }
  };

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    });
  };

  // Added renderContent function as per outline
  const renderContent = () => {
    switch (activeSection) {
      case 'trial_balance':
        return <TrialBalance caseId={case_.id} />;
      case 'rnp':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Receipts & Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Receipts & Payments</h3>
                <p className="text-slate-500">R&P functionality will be implemented here.</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'eos':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Estimated Outcome Statement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Estimated Outcome Statement</h3>
                <p className="text-slate-500">EOS functionality will be implemented here.</p>
              </div>
            </CardContent>
          </Card>
        );
      case 'distributions':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Distributions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-slate-500">
                <PoundSterling className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">Distributions</h3>
                <p className="text-slate-500">Distribution functionality will be implemented here.</p>
              </div>
            </CardContent>
          </Card>
        );
      default:
        // This default case won't be hit with the current toolbarItems,
        // but included for completeness of the outline's logic.
        return null;
    }
  };


  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading transactions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // The 'reconciliationComplete' state and its UI block have been removed as per changes.
  // The completion now directly calls onBack().

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSaveReconciliation}
                disabled={isSaving}
                className="h-9 bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => setShowSignatureDialog(true)}
                disabled={Math.abs(balances.difference) >= 0.01 || !reconDate || !bankBalance}
                className="h-9 bg-blue-600 hover:bg-blue-700"
              >
                <Signature className="w-4 h-4 mr-2" />
                Post
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label htmlFor="lastReconDate" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Last Reconciliation</Label>
              <Input
                id="lastReconDate"
                type="date"
                value={lastReconDate}
                className="mt-1 h-9 text-sm bg-slate-100"
                readOnly
                placeholder="None" />
            </div>
            <div>
              <Label htmlFor="reconDate" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Reconciliation Date</Label>
              <Input
                id="reconDate"
                type="date"
                value={reconDate}
                onChange={(e) => setReconDate(e.target.value)}
                className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label htmlFor="bankBalance" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Bank Statement Balance</Label>
              <Input
                id="bankBalance"
                type="number"
                step="0.01"
                value={bankBalance}
                onChange={(e) => setBankBalance(e.target.value)}
                placeholder="Enter balance"
                className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label htmlFor="bankStatement" className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Bank Statement</Label>
              <div className="mt-1">
                <Label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 rounded-md px-3 py-1.5 hover:bg-slate-50 h-9">
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  <span className="text-sm">{bankStatementUrl ? 'Uploaded' : 'Upload'}</span>
                  <Input
                    type="file"
                    accept=".pdf,.csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleBankStatementUpload}
                    disabled={isUploading} />
                </Label>
              </div>
            </div>
          </div>

          {uploadError &&
          <div className="mt-3 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md text-sm">
              {uploadError}
            </div>
          }
        </CardContent>
      </Card>

      {/* Reconciliation Summary */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <p className="font-medium text-blue-700">Cashbook Balance</p>
          <p className="text-xl font-bold text-blue-900">{formatCurrency(balances.cashbook)}</p>
        </div>
        <div className="text-center bg-slate-50 border border-slate-200 p-4 rounded-lg">
          <p className="font-medium text-slate-700">Bank Balance</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(balances.bank)}</p>
        </div>
        <div className={`text-center p-4 rounded-lg border ${Math.abs(balances.difference) < 0.01 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`font-medium ${Math.abs(balances.difference) < 0.01 ? 'text-green-700' : 'text-red-700'}`}>Difference</p>
          <p className={`text-xl font-bold ${Math.abs(balances.difference) < 0.01 ? 'text-green-900' : 'text-red-900'}`}>
            {formatCurrency(Math.abs(balances.difference))}
          </p>
        </div>
      </div>

      {/* Transactions List - Larger Section */}
      <Card className="bg-card text-card-foreground my-2 rounded-lg border shadow-sm flex-1" style={{ minHeight: '700px' }}>
        <CardHeader className="pt-4 pb-1">
          <CardTitle className="text-xl font-bold text-slate-900">Cashbook Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ?
          <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div> :
          cashbookTransactions.length === 0 ?
          <div className="text-center py-20 text-slate-500">
              <p>No transactions found for reconciliation.</p>
            </div> :

          <div className="overflow-x-auto" style={{ maxHeight: '600px', minHeight: '500px' }}>
              <Table>
                <TableHeader className="sticky top-0 bg-white border-b-2">
                  <TableRow>
                    <TableHead className="w-12 text-xs font-semibold text-slate-700 uppercase tracking-wide">✓</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Date</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Description</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Reference</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Type</TableHead>
                    <TableHead className="text-right text-xs font-semibold text-slate-700 uppercase tracking-wide">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashbookTransactions.map((transaction) =>
                <TableRow key={transaction.id} className="hover:bg-slate-50">
                      <TableCell className="py-2">
                        <Checkbox
                      checked={reconciledItems.has(transaction.id)}
                      onCheckedChange={() => handleItemReconcile(transaction.id)} />

                      </TableCell>
                      <TableCell className="py-2 text-sm">
                        {new Date(transaction.transaction_date).toLocaleDateString('en-GB')}
                      </TableCell>
                      <TableCell className="py-2 text-sm font-medium">{transaction.description}</TableCell>
                      <TableCell className="py-2 text-sm text-slate-600">{transaction.reference || '-'}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                      variant={transaction.transaction_type === 'receipt' ? 'default' : 'secondary'}
                      className="text-xs">

                          {transaction.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2 font-mono font-semibold">
                        {formatCurrency(transaction.amount)}
                      </TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </div>
          }
        </CardContent>
      </Card>

      {/* Signature Dialog */}
      <SignatureDialog
        isOpen={showSignatureDialog}
        onClose={() => setShowSignatureDialog(false)}
        onSave={handleCompleteReconciliation}
        title="Complete Bank Reconciliation"
        description={`Complete the bank reconciliation for ${case_?.company_name || 'this case'} as at ${reconDate}`}
        isSaving={isCompleting}
      />
      {/* Note: The toolbarItems and renderContent from the outline are defined above,
          but are not directly rendered in the existing BankReconciliation UI.
          If the intention was to transform this component into a multi-section view,
          further changes to the JSX return statement would be required.
          As per instructions to preserve existing functionality, the main BankReconciliation UI is kept.
      */}
    </div>
  );
}
