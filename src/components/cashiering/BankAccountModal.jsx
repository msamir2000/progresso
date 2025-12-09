import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Loader2, Save } from 'lucide-react';
import { ChartOfAccount } from '@/api/entities';

export default function BankAccountModal({
  isOpen,
  onClose,
  onSave,
  bankAccountData,
  setBankAccountData,
  error,
  isSaving,
  isEditing
}) {
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  useEffect(() => {
    const loadChartOfAccounts = async () => {
      if (!isOpen) return;
      
      setIsLoadingAccounts(true);
      try {
        const accounts = await ChartOfAccount.list();
        // Filter for only accounts with account_group "Represented By"
        const representedByAccounts = accounts.filter(account => 
          account.account_group === "Represented By"
        );
        setChartOfAccounts(representedByAccounts);
      } catch (error) {
        console.error('Error loading chart of accounts:', error);
        setChartOfAccounts([]);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadChartOfAccounts();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{isEditing ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-md mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="account_name" className="text-sm font-medium text-slate-700 mb-1 block">
              Account Name
            </Label>
            <Input
              id="account_name"
              value={bankAccountData.account_name}
              onChange={(e) => setBankAccountData({...bankAccountData, account_name: e.target.value})}
              placeholder="Enter account name"
              className="h-9"
              disabled={isSaving}
            />
          </div>

          <div>
            <Label htmlFor="bank_name" className="text-sm font-medium text-slate-700 mb-1 block">
              Bank Name
            </Label>
            <Input
              id="bank_name"
              value={bankAccountData.bank_name}
              onChange={(e) => setBankAccountData({...bankAccountData, bank_name: e.target.value})}
              placeholder="Enter bank name"
              className="h-9"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="account_number" className="text-sm font-medium text-slate-700 mb-1 block">
                Account Number
              </Label>
              <Input
                id="account_number"
                value={bankAccountData.account_number}
                onChange={(e) => setBankAccountData({...bankAccountData, account_number: e.target.value})}
                placeholder="12345678"
                className="h-9"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="sort_code" className="text-sm font-medium text-slate-700 mb-1 block">
                Sort Code
              </Label>
              <Input
                id="sort_code"
                value={bankAccountData.sort_code}
                onChange={(e) => setBankAccountData({...bankAccountData, sort_code: e.target.value})}
                placeholder="12-34-56"
                className="h-9"
                disabled={isSaving}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="account_type" className="text-sm font-medium text-slate-700 mb-1 block">
              Account Type
            </Label>
            <Select
              value={bankAccountData.account_type}
              onValueChange={(value) => setBankAccountData({...bankAccountData, account_type: value})}
              disabled={isSaving}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GBP Primary">GBP Primary</SelectItem>
                <SelectItem value="GBP Trading">GBP Trading</SelectItem>
                <SelectItem value="GBP Treasury">GBP Treasury</SelectItem>
                <SelectItem value="Foreign Account">Foreign Account</SelectItem>
                <SelectItem value="Petty Cash">Petty Cash</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="chart_of_accounts" className="text-sm font-medium text-slate-700 mb-1 block">
              Chart of Accounts Code
            </Label>
            {isLoadingAccounts ? (
              <div className="h-9 border border-slate-300 rounded-md bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            ) : (
              <Select
                value={bankAccountData.chart_of_accounts}
                onValueChange={(value) => setBankAccountData({...bankAccountData, chart_of_accounts: value})}
                disabled={isSaving}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select account code" />
                </SelectTrigger>
                <SelectContent>
                  {chartOfAccounts.length === 0 ? (
                    <SelectItem value={null} disabled className="text-red-600 font-semibold">No "Represented By" accounts found</SelectItem>
                  ) : (
                    chartOfAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.account_code}>
                        {account.account_code} - {account.account_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Update Account' : 'Save Account'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}