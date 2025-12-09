import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  FileText,
  ChevronDown,
  ClipboardList,
  Package,
  Users,
  Landmark,
  Search,
  PlusCircle,
  FileDown,
  Loader2,
  AlertCircle
} from "lucide-react";
import { StatementOfAffairs } from "@/api/entities";
import { base44 } from '@/api/base44Client';


export default function CaseStrategyForm({ initialData, onSave, isEditing, caseId, onToggleEdit }) {
  const dateInputRef = useRef(null);
  const [currentDate, setCurrentDate] = useState('');
  const [loadedCaseId, setLoadedCaseId] = useState(null);
  const isInitialLoadRef = useRef(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [strategyData, setStrategyData] = useState({
    assets: [{ asset_name: '', book_value: '', realizable_value: '', strategy: '' }],
    tlr_hmrc_owed: '',
    tlr_estimated_loss: '',
    tlr_profitable: '',
    tlr_conclusion: '',
    other_tax_strategy: '',
    has_employees: '',
    employee_debts: '',
    pension_scheme: '',
    employee_strategy: '',
    books_records_collected: '',
    estimated_deficiency: '',
    matters_identified: '',
    investigation_strategy: '',
    specific_issue: '',
    specific_strategy: ''
  });

  const [openSections, setOpenSections] = useState({
    assets_recovery: true,
    tax_recoveries: false,
    employee_pension: false,
    investigations: false,
    case_specific_issues: false
  });

  const [soaAssets, setSoaAssets] = useState([]);


  // Load fresh data from database when form is accessed
  useEffect(() => {
    const loadFreshData = async () => {
      if (caseId) {
        console.log('📂 Loading fresh Case Strategy data from database for case:', caseId);
        setLoadedCaseId(caseId);
        
        try {
          const freshCase = await base44.entities.Case.filter({ id: caseId });
          const caseData = freshCase[0];
          
          if (caseData) {
            setCurrentDate(caseData.case_strategy_note_date || '');

            if (caseData.case_strategy_note) {
              try {
                const parsedData = typeof caseData.case_strategy_note === 'string' 
                  ? JSON.parse(caseData.case_strategy_note) 
                  : caseData.case_strategy_note;
                console.log('✅ Loaded fresh Case Strategy data from database');
                
                const mergedData = { ...strategyData, ...parsedData };
                if (!mergedData.assets || mergedData.assets.length === 0) {
                  mergedData.assets = [{ asset_name: '', book_value: '', realizable_value: '', strategy: '' }];
                }
                setStrategyData(mergedData);
              } catch (error) {
                console.error('❌ Error parsing case_strategy_note:', error);
              }
            } else {
              console.log('ℹ️ No existing Case Strategy data found in database');
            }
          }
        } catch (error) {
          console.error('❌ Error loading fresh data from database:', error);
        }
      }
    };

    loadFreshData();
  }, [caseId]);

  useEffect(() => {
    loadSoaAssets();
  }, [caseId]);

  const loadSoaAssets = async () => {
    if (!caseId) return;

    try {
      const soaRecords = await StatementOfAffairs.filter({ case_id: caseId });
      if (soaRecords && soaRecords.length > 0) {
        const latestSoa = soaRecords.sort((a, b) => b.version - a.version)[0];
        if (latestSoa.data && latestSoa.data.assets) {
          setSoaAssets(latestSoa.data.assets || []);
        }
      }
    } catch (error) {
      console.error("Error loading SoA assets:", error);
    }
  };

  // Auto-save to database whenever strategyData or currentDate changes
  useEffect(() => {
    if (!loadedCaseId) return;
    
    // Skip saving on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    const saveTimeout = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        console.log('💾 Auto-saving Case Strategy data...');
        await base44.entities.Case.update(loadedCaseId, {
          case_strategy_note: JSON.stringify(strategyData),
          case_strategy_note_date: currentDate
        });
        console.log('✅ Case Strategy auto-saved');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
      } catch (error) {
        console.error('❌ Error auto-saving Case Strategy:', error);
        setSaveError(error.message || 'Save failed');
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [loadedCaseId, strategyData, currentDate]);

  const toggleSection = (key) => {
    setOpenSections(prevOpenSections => {
      const isCurrentlyOpen = prevOpenSections[key];
      const allClosed = Object.keys(prevOpenSections).reduce((acc, sectionKey) => {
        acc[sectionKey] = false;
        return acc;
      }, {});

      if (!isCurrentlyOpen) {
        allClosed[key] = true;
      }

      return allClosed;
    });
  };

  const isSectionComplete = (sectionKey) => {
    switch(sectionKey) {
      case 'assets_recovery':
        return strategyData.assets && strategyData.assets.length > 0 && 
               strategyData.assets.some(a => a.asset_name && a.strategy);
      case 'tax_recoveries':
        return !!(strategyData.tlr_conclusion || strategyData.other_tax_strategy);
      case 'employee_pension':
        return !!(strategyData.has_employees && strategyData.employee_strategy);
      case 'investigations':
        return !!(strategyData.books_records_collected && strategyData.investigation_strategy);
      case 'case_specific_issues':
        return !!(strategyData.specific_issue || strategyData.specific_strategy);
      default:
        return false;
    }
  };

  const handleSectionChange = (section, value) => {
    const newStrategyData = { ...strategyData, [section]: value };
    setStrategyData(newStrategyData);
  };

  const handleAssetChange = (index, field, value) => {
    const newAssets = [...strategyData.assets];
    newAssets[index] = { ...newAssets[index], [field]: value };
    handleSectionChange('assets', newAssets);
  };

  const addAsset = () => {
    const newAssets = [...strategyData.assets, { asset_name: '', book_value: '', realizable_value: '', strategy: '' }];
    handleSectionChange('assets', newAssets);
  };

  const removeAsset = (index) => {
    if (strategyData.assets.length > 1) {
      const newAssets = strategyData.assets.filter((_, i) => i !== index);
      handleSectionChange('assets', newAssets);
    }
  };

  const handleDateChange = (e) => {
    setCurrentDate(e.target.value);
  };

  const handleDateClick = () => {
    if (isEditing && dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (err) {
        // Fallback for browsers that don't support showPicker (e.g., Firefox doesn't support it directly on date input)
        // For type="date", browsers usually show a calendar on click/focus anyway.
        // Focusing might be sufficient for most, but showPicker is more direct if supported.
        dateInputRef.current.focus();
      }
    }
  };

  const sections = {
    assets_recovery: {
      title: 'Assets Recovery',
      icon: <Package className="w-4 h-4" />,
      content: (
        <div className="space-y-4">
          {isEditing && soaAssets.length > 0 && (
            <div className="text-sm text-slate-600 bg-blue-50 px-3 py-1 rounded-full">
              Auto-populated from Statement of Affairs
            </div>
          )}
          {strategyData.assets.map((asset, index) => (
            <div key={index} className="bg-slate-50 p-4 rounded-lg border space-y-3">
              <div className="flex items-center justify-end">
                {isEditing && strategyData.assets.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAsset(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Asset Description</Label>
                  <Input
                    className="bg-white border-slate-300"
                    placeholder="Asset description"
                    value={asset.asset_name}
                    onChange={(e) => handleAssetChange(index, 'asset_name', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600">Estimated Value per SOA (£)</Label>
                  <Input
                    className="bg-white border-slate-300"
                    placeholder="0.00"
                    value={asset.realizable_value}
                    onChange={(e) => handleAssetChange(index, 'realizable_value', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Recovery Strategy</Label>
                <Textarea
                  className="bg-white border-slate-300"
                  placeholder="Detail the recovery strategy for this asset..."
                  value={asset.strategy}
                  onChange={(e) => handleAssetChange(index, 'strategy', e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>
            </div>
          ))}
          {isEditing && (
            <button
              onClick={addAsset}
              className="w-full p-4 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-blue-400 transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Add Additional Asset</span>
            </button>
          )}
        </div>
      )
    },
    tax_recoveries: {
      title: 'Tax Recoveries',
      icon: <Landmark className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
            <Label className="text-blue-700 font-semibold text-base">Terminal Loss Relief Claim "TLR"</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Sum(s) owed to HMRC on SOA</Label>
                <Input
                  className="bg-white border-slate-300"
                  placeholder="£0.00"
                  value={strategyData.tlr_hmrc_owed || ''}
                  onChange={(e) => handleSectionChange('tlr_hmrc_owed', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Def. Account estimated loss</Label>
                <Input
                  className="bg-white border-slate-300"
                  placeholder="£0.00"
                  value={strategyData.tlr_estimated_loss || ''}
                  onChange={(e) => handleSectionChange('tlr_estimated_loss', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">Was the Company profitable in the last 3 years / CT returns on file</Label>
                <Select
                  value={strategyData.tlr_profitable || ''}
                  onValueChange={(value) => handleSectionChange('tlr_profitable', value)}
                  disabled={!isEditing}
                >
                  <SelectTrigger className="bg-white border-slate-300">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Conclusion "TLR" Claim</Label>
              <Textarea
                className="bg-white border-slate-300"
                placeholder="Conclusion regarding TLR claim viability and strategy..."
                value={strategyData.tlr_conclusion || ''}
                onChange={(e) => handleSectionChange('tlr_conclusion', e.target.value)}
                disabled={!isEditing}
                rows={3}
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-blue-700 font-semibold">Strategy Other Tax Refunds / Credits</Label>
            <Textarea
              className="bg-white border-slate-300 min-h-[120px]"
              placeholder="Detail strategy for other tax refunds and credits..."
              value={strategyData.other_tax_strategy || ''}
              onChange={(e) => handleSectionChange('other_tax_strategy', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </div>
      )
    },
    employee_pension: {
      title: 'Employee / Pension',
      icon: <Users className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Does the Company have Employees?</Label>
              <Select
                value={strategyData.has_employees || ''}
                onValueChange={(value) => handleSectionChange('has_employees', value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Are sums owed to the Employees?</Label>
              <Select
                value={strategyData.employee_debts || ''}
                onValueChange={(value) => handleSectionChange('employee_debts', value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Did the Company operate a Pension scheme?</Label>
              <Select
                value={strategyData.pension_scheme || ''}
                onValueChange={(value) => handleSectionChange('pension_scheme', value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-blue-700 font-semibold">Strategy</Label>
            <Textarea
              className="bg-white border-slate-300 min-h-[120px]"
              placeholder="Detail strategy for employee and pension matters..."
              value={strategyData.employee_strategy || ''}
              onChange={(e) => handleSectionChange('employee_strategy', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </div>
      )
    },
    investigations: {
      title: 'Investigations',
      icon: <Search className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Company Books & Records paper and electronic provided and collected</Label>
              <Select
                value={strategyData.books_records_collected || ''}
                onValueChange={(value) => handleSectionChange('books_records_collected', value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">What is the estimated Deficiency to Creditors (£)</Label>
              <Input
                className="bg-white border-slate-300"
                placeholder="£0.00"
                value={strategyData.estimated_deficiency || ''}
                onChange={(e) => handleSectionChange('estimated_deficiency', e.target.value)}
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-slate-600">Have any matters been identified/brought to IPs Attention</Label>
              <Select
                value={strategyData.matters_identified || ''}
                onValueChange={(value) => handleSectionChange('matters_identified', value)}
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-white border-slate-300">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-blue-700 font-semibold">Initial Investigation Strategy</Label>
            <Textarea
              className="bg-white border-slate-300 min-h-[120px]"
              placeholder="Detail the initial investigation strategy..."
              value={strategyData.investigation_strategy || ''}
              onChange={(e) => handleSectionChange('investigation_strategy', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </div>
      )
    },
    case_specific_issues: {
      title: 'Case Specific Issues',
      icon: <AlertTriangle className="w-4 h-4" />,
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <Label className="text-blue-700 font-semibold">Issue</Label>
            <Textarea
              className="bg-white border-slate-300 min-h-[120px]"
              placeholder="Describe any case-specific issues..."
              value={strategyData.specific_issue || ''}
              onChange={(e) => handleSectionChange('specific_issue', e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="space-y-3">
            <Label className="text-blue-700 font-semibold">Strategy</Label>
            <Textarea
              className="bg-white border-slate-300 min-h-[120px]"
              placeholder="Detail the strategy to address these issues..."
              value={strategyData.specific_strategy || ''}
              onChange={(e) => handleSectionChange('specific_strategy', e.target.value)}
              disabled={!isEditing}
            />
          </div>
        </div>
      )
    }
  };

  const handleExportToHTML = () => {
    const formattedDate = currentDate ? new Date(currentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not specified';
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Case Strategy Note</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; line-height: 1.6; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 10px; margin-top: 0; }
    .review-date { color: #475569; font-size: 1.1em; margin-bottom: 30px; font-weight: bold; }
    h2 { color: #3b82f6; margin-top: 30px; background: #eff6ff; padding: 10px; border-radius: 5px; font-size: 1.5em; }
    h3 { color: #1e40af; margin-top: 20px; font-size: 1.2em; }
    .section { margin-bottom: 30px; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #475569; display: block; margin-bottom: 5px; }
    .value { color: #1e293b; background: #f8fafc; padding: 10px; border-radius: 5px; border: 1px solid #e2e8f0; white-space: pre-wrap; word-wrap: break-word;}
    .asset-item { background: #f1f5f9; padding: 15px; margin-bottom: 15px; border-radius: 8px; border: 1px solid #cbd5e1; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 8px; text-align: left; border: 1px solid #cbd5e1; }
    th { background: #3b82f6; color: white; }
    .signature-section { margin-top: 60px; page-break-inside: avoid; background: #f1f5f9; padding: 25px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .signature-row { display: flex; gap: 40px; margin-bottom: 15px; }
    .signature-column { flex: 1; }
    .signature-line { border-bottom: 2px solid #000; height: 60px; margin-bottom: 5px; }
    .signature-label { font-size: 13px; color: #000; margin-top: 5px; margin-bottom: 8px; }
    .print-label { font-size: 13px; color: #000; }
  </style>
</head>
<body>
  <h1>Case Strategy Note</h1>
  <div class="review-date">Date of Review: ${formattedDate}</div>
  
  <h2>Assets Recovery</h2>
  ${strategyData.assets.map((asset, index) => `
    <div class="asset-item">
      <div class="field">
        <span class="label">Asset ${index + 1}:</span>
        <div class="value">${asset.asset_name || 'N/A'}</div>
      </div>
      <div class="field">
        <span class="label">Estimated Value per SOA:</span>
        <div class="value">£${asset.realizable_value || '0.00'}</div>
      </div>
      <div class="field">
        <span class="label">Recovery Strategy:</span>
        <div class="value">${asset.strategy || 'N/A'}</div>
      </div>
    </div>
  `).join('')}
  
  <h2>Tax Recoveries</h2>
  <div class="section">
    <h3>Terminal Loss Relief Claim (TLR)</h3>
    <div class="field">
      <span class="label">Sum(s) owed to HMRC on SOA:</span>
      <div class="value">£${strategyData.tlr_hmrc_owed || '0.00'}</div>
    </div>
    <div class="field">
      <span class="label">Def. Account estimated loss:</span>
      <div class="value">£${strategyData.tlr_estimated_loss || '0.00'}</div>
    </div>
    <div class="field">
      <span class="label">Was the Company profitable in the last 3 years:</span>
      <div class="value">${strategyData.tlr_profitable || 'N/A'}</div>
    </div>
    <div class="field">
      <span class="label">Conclusion TLR Claim:</span>
      <div class="value">${strategyData.tlr_conclusion || 'N/A'}</div>
    </div>
  </div>
  <div class="field">
    <span class="label">Strategy Other Tax Refunds / Credits:</span>
    <div class="value">${strategyData.other_tax_strategy || 'N/A'}</div>
  </div>
  
  <h2>Employee / Pension</h2>
  <div class="field">
    <span class="label">Does the Company have Employees:</span>
    <div class="value">${strategyData.has_employees || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Are sums owed to the Employees:</span>
    <div class="value">${strategyData.employee_debts || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Did the Company operate a Pension scheme:</span>
    <div class="value">${strategyData.pension_scheme || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Strategy:</span>
    <div class="value">${strategyData.employee_strategy || 'N/A'}</div>
  </div>
  
  <h2>Investigations</h2>
  <div class="field">
    <span class="label">Company Books & Records collected:</span>
    <div class="value">${strategyData.books_records_collected || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Estimated Deficiency to Creditors:</span>
    <div class="value">£${strategyData.estimated_deficiency || '0.00'}</div>
  </div>
  <div class="field">
    <span class="label">Matters identified:</span>
    <div class="value">${strategyData.matters_identified || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Initial Investigation Strategy:</span>
    <div class="value">${strategyData.investigation_strategy || 'N/A'}</div>
  </div>
  
  <h2>Case Specific Issues</h2>
  <div class="field">
    <span class="label">Issue:</span>
    <div class="value">${strategyData.specific_issue || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Strategy:</span>
    <div class="value">${strategyData.specific_strategy || 'N/A'}</div>
  </div>
  
  <div class="signature-section">
    <div class="signature-row">
      <div class="signature-column">
        <div class="signature-line"></div>
        <div class="signature-label">Office Holders Signature</div>
      </div>
      <div class="signature-column">
        <div class="signature-line"></div>
        <div class="signature-label">Admin Signature</div>
      </div>
    </div>
    <div class="signature-row">
      <div class="signature-column">
        <div class="print-label">Print Name</div>
      </div>
      <div class="signature-column">
        <div class="print-label">Print Name</div>
      </div>
    </div>
  </div>
  
</body>
</html>
    `;
    
    const newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">Case Strategy</h2>
          <input
            ref={dateInputRef}
            type="date"
            value={currentDate}
            onChange={handleDateChange}
            onClick={handleDateClick}
            onFocus={handleDateClick}
            disabled={!isEditing}
            style={{ colorScheme: 'light' }}
            className={`w-40 h-9 px-3 py-2 text-sm rounded-md border border-slate-300 bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 ${!isEditing ? 'font-bold' : ''}`}
          />

          {/* Save Status Indicators */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved!
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </div>
          )}
        </div>
        
        {/* Right side - Export and Lock */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleExportToHTML}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium hover:bg-green-200 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <button
            onClick={() => onToggleEdit && onToggleEdit()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              isEditing 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {isEditing ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            <span>{isEditing ? 'Unlocked' : 'Locked'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 p-4 bg-slate-100 rounded-lg border">
        {Object.entries(sections).map(([key, section]) => {
          const isComplete = isSectionComplete(key);
          return (
            <button
              key={key}
              onClick={() => toggleSection(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${
                openSections[key]
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-700 border border-slate-200'
              }`}
            >
              <div className={`${openSections[key] ? 'text-white' : 'text-slate-600'}`}>
                {section.icon}
              </div>
              <span>{section.title}</span>
              {isComplete && !openSections[key] && (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              )}
              {openSections[key] && (
                <ChevronDown className="w-4 h-4 text-white" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-[400px]">
        {Object.entries(sections).map(([key, section]) => (
          openSections[key] && (
            <Card key={key} className="border border-slate-200 shadow-sm">
              <CardHeader className="bg-blue-50 border-b border-blue-200">
                <CardTitle className="flex items-center gap-3 text-blue-800">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    {section.icon}
                  </div>
                  <span className="font-semibold text-lg">{section.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 bg-white">
                {section.content}
              </CardContent>
            </Card>
          )
        ))}

        {!Object.values(openSections).some(isOpen => isOpen) && (
          <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <div className="text-center">
              <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Select a Strategy Section</h3>
              <p className="text-slate-500">Choose a section above to begin developing your case strategy</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}