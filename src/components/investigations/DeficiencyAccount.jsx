import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Calculator, FileText, Save, Loader2, AlertCircle, Plus, Trash2, Lock, Unlock, FileDown } from "lucide-react";
import { Case } from "@/api/entities";
import { StatementOfAffairs } from "@/api/entities";
import { Employee } from "@/api/entities";
import { Creditor } from "@/api/entities";

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return amount < 0 ? `(${formatted})` : formatted;
};

const CurrencyInput = ({ label, value, onChange, disabled = false, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    <Label className="text-sm font-medium text-slate-700">{label}</Label>
    <div className="relative">
      <span className="absolute left-3 top-3 text-slate-500">£</span>
      <Input
        type="number"
        step="0.01"
        value={value || ''}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        disabled={disabled}
        className={`pl-8 ${disabled ? 'bg-slate-50 text-slate-500' : ''}`}
        placeholder="0.00"
      />
    </div>
  </div>
);

export default function DeficiencyAccount({ caseId, onUpdate }) {
  const [caseData, setCaseData] = useState(null);
  const [soaData, setSoaData] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [creditors, setCreditors] = useState([]);
  const [deficiencyData, setDeficiencyData] = useState({
    date_of_last_financial_statements: '',
    date_of_deficiency_account: '',
    reserves_per_management_accounts: 0,
    asset_writedowns: [], // Start empty by default
    redundancy_payments: 0,
    notice_payments: 0,
    deficiency_to_creditors: 0,
    deficiency_to_members: 0,
    share_capital: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingMode, setIsEditingMode] = useState(true);

  const assetWritedownOptions = [
    'Book Debts',
    'Fixtures & Fitting', 
    'Investment in Subsidiary Company',
    'Stock Inventory',
    'Plant & Machinery',
    'Motor Vehicles',
    'Property',
    'Goodwill',
    'Intangible Assets',
    'Other Assets'
  ];

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [caseResult, soaResult, employeeResult, creditorResult] = await Promise.all([
        Case.list().then(cases => cases.find(c => c.id === caseId)),
        StatementOfAffairs.filter({ case_id: caseId }),
        Employee.filter({ case_id: caseId }),
        Creditor.filter({ case_id: caseId })
      ]);

      setCaseData(caseResult);
      setEmployees(employeeResult || []);
      setCreditors(creditorResult || []);

      const latestSoa = soaResult?.sort((a, b) => b.version - a.version)?.[0];
      if (latestSoa) {
        setSoaData(latestSoa.data);
      }

      if (caseResult?.deficiency_account_data) {
        try {
          const existingData = JSON.parse(caseResult.deficiency_account_data);
          setDeficiencyData(prev => ({
            ...prev,
            // Ensure asset_writedowns is an array when loading
            asset_writedowns: existingData.asset_writedowns || [],
            ...existingData
          }));
        } catch (e) {
          console.error("Error parsing existing deficiency data:", e);
        }
      }

    } catch (error) {
      console.error("Error loading deficiency account data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  const calculateDeficiency = React.useCallback(() => {
    const employeeArray = Array.isArray(employees) ? employees : [];
    const creditorArray = Array.isArray(creditors) ? creditors : [];

    const redundancyPayments = employeeArray.reduce((sum, emp) => 
      sum + (parseFloat(emp.redundancy_pay_unsecured) || 0), 0);
    
    const noticePayments = employeeArray.reduce((sum, emp) => 
      sum + (parseFloat(emp.notice_pay_preferential) || 0) + (parseFloat(emp.notice_pay_unsecured) || 0), 0);

    const totalCreditorClaims = creditorArray.reduce((sum, creditor) => 
      sum + (parseFloat(creditor.balance_owed) || 0), 0);

    const totalEstimatedRealisations = caseData?.soa_etr || 0;
    const deficiencyToCreditors = Math.max(0, totalCreditorClaims - totalEstimatedRealisations);

    const shareCapital = caseData?.shareholders?.reduce((sum, shareholder) => 
      sum + ((parseFloat(shareholder.shares_held) || 0) * (parseFloat(shareholder.nominal_value) || 0) / 100), 0) || 0;

    setDeficiencyData(prev => ({
      ...prev,
      redundancy_payments: redundancyPayments,
      notice_payments: noticePayments,
      deficiency_to_creditors: deficiencyToCreditors,
      deficiency_to_members: deficiencyToCreditors + shareCapital, // Updated formula for deficiency to members
      share_capital: shareCapital
    }));
  }, [employees, creditors, caseData]);

  useEffect(() => {
    if (caseId) {
      loadData();
    }
  }, [caseId, loadData]);

  useEffect(() => {
    if (!isLoading) {
      calculateDeficiency();
    }
  }, [calculateDeficiency, deficiencyData.reserves_per_management_accounts, deficiencyData.asset_writedowns, soaData, employees, creditors, isLoading]);

  const handleAddAssetWritedown = () => {
    if (!isEditingMode) return;
    setDeficiencyData(prev => ({
      ...prev,
      asset_writedowns: [...(prev.asset_writedowns || []), { name: '', amount: 0 }]
    }));
  };

  const handleRemoveAssetWritedown = (index) => {
    if (!isEditingMode) return;
    setDeficiencyData(prev => ({
      ...prev,
      asset_writedowns: (prev.asset_writedowns || []).filter((_, i) => i !== index)
    }));
  };

  const handleAssetWritedownChange = (index, field, value) => {
    if (!isEditingMode) return;
    setDeficiencyData(prev => ({
      ...prev,
      asset_writedowns: (prev.asset_writedowns || []).map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        ...deficiencyData,
        // Ensure asset_writedowns is always an array, even if empty
        asset_writedowns: deficiencyData.asset_writedowns || [],
        last_updated: new Date().toISOString()
      };

      await Case.update(caseId, {
        deficiency_account_data: JSON.stringify(dataToSave)
      });

      if (onUpdate) onUpdate();
      
      // Show success message
      alert('Deficiency account saved successfully');
      
    } catch (error) {
      console.error("Error saving deficiency account:", error);
      alert('Error saving deficiency account. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Derived calculations for display
  const totalAssetWritedowns = React.useMemo(() => {
    return (deficiencyData.asset_writedowns || []).reduce((sum, asset) => sum + (asset.amount || 0), 0);
  }, [deficiencyData.asset_writedowns]);

  const adjustedNetWorth = React.useMemo(() => {
    return (deficiencyData.reserves_per_management_accounts || 0) - totalAssetWritedowns;
  }, [deficiencyData.reserves_per_management_accounts, totalAssetWritedowns]);

  const estimatedTradingBalance = React.useMemo(() => {
    return -(deficiencyData.deficiency_to_creditors || 0)
      - (deficiencyData.reserves_per_management_accounts || 0) 
      + totalAssetWritedowns 
      + (deficiencyData.notice_payments || 0)
      + (deficiencyData.redundancy_payments || 0);
  }, [deficiencyData.deficiency_to_creditors, deficiencyData.reserves_per_management_accounts, totalAssetWritedowns, deficiencyData.notice_payments, deficiencyData.redundancy_payments]);

  const handleExportHTML = () => {
    // Get the display content
    const exportContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deficiency Account</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            max-width: 800px;
            margin: 40px auto;
            padding: 20px;
            line-height: 1.6;
        }
        .title {
            text-align: center;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 20px;
        }
        .section {
            margin: 20px 0;
        }
        .row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 14px;
        }
        .indent {
            margin-left: 32px;
        }
        .subsection-header {
            font-weight: 500;
            font-size: 14px;
            margin-top: 12px;
        }
        .border-top {
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            margin-top: 8px;
        }
        .border-top-2 {
            border-top: 2px solid #94a3b8;
            padding-top: 8px;
            margin-top: 24px;
        }
        .separator {
            border-top: 1px solid #e2e8f0;
            margin: 24px 0;
        }
        .total {
            font-weight: 600;
        }
        .red {
            color: #b91c1c;
        }
    </style>
</head>
<body>
    <div class="title">
        Deficiency Account at ${deficiencyData.date_of_deficiency_account ? 
          new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
          }) : '[Date]'}
    </div>

    <div class="section">
        <div class="row">
            <span>Reserves per management accounts as at ${deficiencyData.date_of_last_financial_statements ? 
              new Date(deficiencyData.date_of_last_financial_statements).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              }) : '[Date]'}</span>
            <span>${formatCurrency(deficiencyData.reserves_per_management_accounts)}</span>
        </div>

        ${((deficiencyData.asset_writedowns || []).length > 0) ? `
        <div style="margin-top: 12px;">
            <div class="subsection-header">Less: Asset Values written off as a consequence of Liquidation</div>
            <div class="indent">
                ${(deficiencyData.asset_writedowns || []).map(asset => `
                    <div class="row">
                        <span>${asset.name}</span>
                        <span>${formatCurrency(-asset.amount)}</span>
                    </div>
                `).join('')}
                <div class="row border-top total">
                    <span>Total Asset Writedowns:</span>
                    <span>${formatCurrency(-totalAssetWritedowns)}</span>
                </div>
            </div>
        </div>
        ` : ''}

        <div style="margin-top: 48px;">
            <div class="subsection-header">Less: Liabilities arising as a consequence of Liquidation</div>
            <div class="indent">
                <div class="row">
                    <span>Employee claims – pay in lieu of notice</span>
                    <span>${formatCurrency(-deficiencyData.notice_payments)}</span>
                </div>
                <div class="row">
                    <span>Employee claims – redundancy</span>
                    <span>${formatCurrency(-deficiencyData.redundancy_payments)}</span>
                </div>
                <div class="row border-top total">
                    <span></span>
                    <span>${formatCurrency(-(deficiencyData.notice_payments + deficiencyData.redundancy_payments))}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="separator"></div>

    <div class="section">
        <div class="row">
            <span>Balance being estimated trading (losses)/profits for the period 1 January 2024 to ${deficiencyData.date_of_deficiency_account ? 
              new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              }) : '[Date]'}</span>
            <span>${formatCurrency(estimatedTradingBalance)}</span>
        </div>
    </div>

    <div class="separator"></div>

    <div class="section">
        <div class="row total">
            <span>Deficiency as regards creditors per the statement of affairs as at ${deficiencyData.date_of_deficiency_account ? 
              new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              }) : '[Date]'}</span>
            <span class="red">${formatCurrency(-deficiencyData.deficiency_to_creditors)}</span>
        </div>

        <div class="row">
            <span>Ordinary shares</span>
            <span>${formatCurrency(-deficiencyData.share_capital)}</span>
        </div>

        <div class="row border-top-2 total">
            <span>Deficiency as regards members per the statement of affairs as at ${deficiencyData.date_of_deficiency_account ? 
              new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              }) : '[Date]'}</span>
            <span class="red">${formatCurrency(-deficiencyData.deficiency_to_members)}</span>
        </div>
    </div>
</body>
</html>
    `;

    // Open in new tab
    const blob = new Blob([exportContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Deficiency Account</h2>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || !isEditingMode}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
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
            onClick={handleExportHTML} 
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={() => setIsEditingMode(!isEditingMode)} 
            variant="outline"
            className={`${isEditingMode ? 'text-red-600 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
          >
            {isEditingMode ? (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Lock
              </>
            ) : (
              <>
                <Unlock className="w-4 h-4 mr-2" />
                Unlock
              </>
            )}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Loading deficiency account data...</span>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4 h-[calc(100vh-240px)]">
          {/* Left Side - Input Panes (2 columns out of 5) */}
          <div className="col-span-2 space-y-3 overflow-y-auto">
            
            {/* Automatic Section */}
            <Card className="bg-blue-50/50 border-blue-200">
              <CardContent className="space-y-3 pt-4 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="font-semibold text-blue-900 text-sm">Automatic</h4>
                  <div className="h-px bg-blue-200 flex-1"></div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <CurrencyInput
                    label="Share Capital"
                    value={deficiencyData.share_capital}
                    onChange={() => {}}
                    disabled={true}
                    className="text-xs"
                  />
                  
                  <CurrencyInput
                    label="Deficiency to Members"
                    value={deficiencyData.deficiency_to_members}
                    onChange={() => {}}
                    disabled={true}
                    className="text-xs"
                  />
                  
                  <CurrencyInput
                    label="Deficiency to Creditors"
                    value={deficiencyData.deficiency_to_creditors}
                    onChange={() => {}}
                    disabled={true}
                    className="text-xs"
                  />
                  
                  <CurrencyInput
                    label="Redundancy Payments"
                    value={deficiencyData.redundancy_payments}
                    onChange={() => {}}
                    disabled={true}
                    className="text-xs"
                  />
                  
                  <div className="col-span-2">
                    <CurrencyInput
                      label="Notice Payments"
                      value={deficiencyData.notice_payments}
                      onChange={() => {}}
                      disabled={true}
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Manual Section */}
            <Card>
              <CardContent className="space-y-3 pt-4 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-900 text-sm">Manual</h4>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>
                  {/* The previous save button was here. It has been moved to the top. */}
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700">Date of Last Financial Statements</Label>
                    <Input
                      type="date"
                      value={deficiencyData.date_of_last_financial_statements}
                      onChange={(e) => setDeficiencyData(prev => ({ ...prev, date_of_last_financial_statements: e.target.value }))}
                      disabled={!isEditingMode}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-700">Date of Deficiency Account</Label>
                    <Input
                      type="date"
                      value={deficiencyData.date_of_deficiency_account}
                      onChange={(e) => setDeficiencyData(prev => ({ ...prev, date_of_deficiency_account: e.target.value }))}
                      disabled={!isEditingMode}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-medium text-slate-700">Reserves per Management Accounts</Label>
                  <div className="relative">
                    <span className="absolute left-2 top-2 text-slate-500 text-xs">£</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={deficiencyData.reserves_per_management_accounts || ''}
                      onChange={(e) => setDeficiencyData(prev => ({ ...prev, reserves_per_management_accounts: parseFloat(e.target.value) || 0 }))}
                      disabled={!isEditingMode}
                      className={`pl-6 h-8 text-xs ${!isEditingMode ? 'bg-slate-50 text-slate-500' : ''}`}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right Side - Deficiency Account Display (3 columns out of 5) */}
          <div className="col-span-3">
            <div className="bg-white border rounded-lg p-4 h-full overflow-y-auto">
              <div className="text-center font-bold text-base mb-4">
                Deficiency Account at {deficiencyData.date_of_deficiency_account ? 
                  new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  }) : '[Date]'}
              </div>

              <div className="space-y-2 text-sm">
                {/* Reserves */}
                <div className="flex justify-between py-1">
                  <span>Reserves per management accounts as at {deficiencyData.date_of_last_financial_statements ? 
                    new Date(deficiencyData.date_of_last_financial_statements).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    }) : '[Date]'}</span>
                  <span className="font-semibold">{formatCurrency(deficiencyData.reserves_per_management_accounts)}</span>
                </div>

                {/* Less: Asset Values written off - Only show if has items or in editing mode */}
                {((deficiencyData.asset_writedowns || []).length > 0 || isEditingMode) && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-sm">Less: Asset Values written off as a consequence of Liquidation</span>
                      {isEditingMode && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleAddAssetWritedown}
                          className="text-blue-600 border-blue-200 h-6 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                    
                    {(deficiencyData.asset_writedowns || []).length > 0 ? (
                      <div className="ml-8 space-y-1">
                        {(deficiencyData.asset_writedowns || []).map((asset, index) => (
                          <div key={index} className="flex items-center justify-between group text-xs">
                            <div className="flex items-center gap-2 flex-1">
                              <Select
                                value={asset.name}
                                onValueChange={(value) => handleAssetWritedownChange(index, 'name', value)}
                                disabled={!isEditingMode}
                              >
                                <SelectTrigger className="bg-white w-32 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {assetWritedownOptions.map(option => (
                                    <SelectItem key={option} value={option} className="text-xs">{option}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="relative w-40"> {/* Changed w-28 to w-40 */}
                                <span className="absolute left-1 top-1 text-slate-500 text-xs">£</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={asset.amount || ''}
                                  onChange={(e) => handleAssetWritedownChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                  className="pl-4 bg-white text-xs h-7"
                                  placeholder="0"
                                  disabled={!isEditingMode}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs">{formatCurrency(-asset.amount)}</span>
                              {isEditingMode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveAssetWritedown(index)}
                                  className="text-red-600 h-6 w-6 p-0"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        <div className="border-t border-slate-200 pt-1 mt-2">
                          <div className="flex justify-between font-medium text-xs">
                            <span>Total Asset Writedowns:</span>
                            <span>{formatCurrency(-totalAssetWritedowns)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="ml-8 text-slate-500 text-xs py-1">No asset writedowns</div>
                    )}
                  </div>
                )}

                {/* Less: Liabilities arising as a consequence of Liquidation */}
                <div className="mt-16">
                  <div className="font-medium text-sm mb-1">Less: Liabilities arising as a consequence of Liquidation</div>
                  <div className="ml-8 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Employee claims – pay in lieu of notice</span>
                      <span>{formatCurrency(-deficiencyData.notice_payments)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Employee claims – redundancy</span>
                      <span>{formatCurrency(-deficiencyData.redundancy_payments)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-1 mt-2">
                      <div className="flex justify-end font-medium text-sm">
                        <span>{formatCurrency(-(deficiencyData.notice_payments + deficiencyData.redundancy_payments))}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Balance being estimated trading (losses)/profits */}
                <div className="flex justify-between py-1">
                  <span>Balance being estimated trading (losses)/profits for the period 1 January 2024 to {deficiencyData.date_of_deficiency_account ? 
                    new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    }) : '[Date]'}</span>
                  <span className="font-semibold">{formatCurrency(estimatedTradingBalance)}</span>
                </div>

                <Separator className="my-6" />

                {/* Deficiency as regards creditors */}
                <div className="flex justify-between py-1 font-semibold">
                  <span>Deficiency as regards creditors per the statement of affairs as at {deficiencyData.date_of_deficiency_account ? 
                    new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    }) : '[Date]'}</span>
                  <span className="text-red-600">{formatCurrency(-deficiencyData.deficiency_to_creditors)}</span>
                </div>

                {/* Ordinary shares */}
                <div className="flex justify-between py-1">
                  <span>Ordinary shares</span>
                  <span>{formatCurrency(-deficiencyData.share_capital)}</span>
                </div>

                {/* Final Total */}
                <div className="flex justify-between font-semibold border-t-2 border-slate-300 pt-2">
                  <span>Deficiency as regards members per the statement of affairs as at {deficiencyData.date_of_deficiency_account ? 
                    new Date(deficiencyData.date_of_deficiency_account).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    }) : '[Date]'}</span>
                  <span className="text-red-700">{formatCurrency(-deficiencyData.deficiency_to_members)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}