import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Creditor } from '@/api/entities';
import { Plus, Loader2, Calculator, PoundSterling, FileDown, MoreVertical, Trash2 } from 'lucide-react';

export default function DistributionsManager({ caseId }) {
  const [creditors, setCreditors] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeclareForm, setShowDeclareForm] = useState(false);
  const [distributionType, setDistributionType] = useState('');
  const [sumToDistribute, setSumToDistribute] = useState('');
  const [sumToRetain, setSumToRetain] = useState('');
  const [distributionDate, setDistributionDate] = useState('');
  const [selectedCreditors, setSelectedCreditors] = useState([]);
  const [distributionResult, setDistributionResult] = useState(null);
  const [distributionHistory, setDistributionHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, [caseId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const creditorsData = await Creditor.filter({ case_id: caseId });
      setCreditors(creditorsData || []);
      
      // Load distributions and shareholders from case
      const { base44 } = await import('@/api/base44Client');
      const caseData = await base44.entities.Case.filter({ id: caseId });
      if (caseData && caseData[0]) {
        if (caseData[0].distributions_data) {
          const savedDistributions = JSON.parse(caseData[0].distributions_data);
          setDistributionHistory(savedDistributions);
        }
        if (caseData[0].shareholders) {
          setShareholders(caseData[0].shareholders || []);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredCreditors = () => {
    if (!distributionType) return [];
    
    // If members distribution, return shareholders
    if (distributionType === 'members') {
      return shareholders.map(s => ({
        id: s.name,
        creditor_name: s.name,
        balance_submitted: ((s.shares_held || 0) * (s.nominal_value || 0)) / 100, // Convert pence to pounds
        creditor_type: 'members'
      }));
    }
    
    // Show all creditors of the selected type, regardless of agreed claim status
    const filtered = creditors.filter(c => c.creditor_type === distributionType);
    
    console.log('Filtered creditors for', distributionType, ':', filtered.length);
    return filtered;
  };

  const getEligibleCreditors = () => {
    // Only creditors/members with agreed claims are eligible for distribution
    return getFilteredCreditors().filter(c => {
      const hasValidBalance = c.balance_submitted && parseFloat(c.balance_submitted) > 0;
      return hasValidBalance;
    });
  };

  const calculateDistribution = () => {
    const eligibleCreditors = getEligibleCreditors();
    const distribute = parseFloat(sumToDistribute) || 0;
    const retain = parseFloat(sumToRetain) || 0;
    const netDistribution = distribute - retain;

    if (netDistribution <= 0) {
      alert('Net distribution must be greater than zero');
      return;
    }

    // Calculate total claims (only eligible creditors with agreed claims)
    const totalClaims = eligibleCreditors.reduce((sum, c) => sum + (c.balance_submitted || 0), 0);

    if (totalClaims === 0) {
      alert('Total claims cannot be zero');
      return;
    }

    // Calculate dividend rate
    let dividendRate;
    let dividendRateLabel;
    
    if (distributionType === 'members') {
      // For members: calculate rate per share capital (£ per £1 of share capital)
      dividendRate = totalClaims > 0 ? netDistribution / totalClaims : 0;
      dividendRateLabel = `£${dividendRate.toFixed(2)} per share`;
    } else {
      // For creditors: calculate pence in pound
      dividendRate = (netDistribution / totalClaims) * 100;
      dividendRateLabel = `${dividendRate.toFixed(2)}p`;
    }

    // Calculate individual distributions (only for eligible creditors)
    const distributions = eligibleCreditors.map(c => {
      const claimAmount = c.balance_submitted || 0;
      const distribution = (claimAmount / totalClaims) * netDistribution;
      return {
        creditor_name: c.creditor_name,
        claim_amount: claimAmount,
        distribution: distribution
      };
    });

    setDistributionResult({
      distributionType,
      sumToDistribute: distribute,
      sumToRetain: retain,
      netDistribution,
      totalClaims,
      penceInPound: dividendRate, // Keep this name for backward compatibility
      dividendRateLabel,
      distributions
    });
  };

  const saveDeclaredDistribution = async () => {
    if (!distributionResult) return;

    const newDistribution = {
      id: Date.now().toString(),
      date: distributionDate || new Date().toISOString(),
      ...distributionResult
    };

    const updatedHistory = [newDistribution, ...distributionHistory];
    setDistributionHistory(updatedHistory);
    
    // Save to database
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.entities.Case.update(caseId, {
        distributions_data: JSON.stringify(updatedHistory)
      });
    } catch (error) {
      console.error('Error saving distribution:', error);
      alert('Failed to save distribution. Please try again.');
      return;
    }
    
    // Reset form
    setShowDeclareForm(false);
    setDistributionType('');
    setSumToDistribute('');
    setSumToRetain('');
    setDistributionDate('');
    setDistributionResult(null);
  };

  const formatCurrency = (amount) => {
    return `£${(amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getTypeLabel = (type) => {
    const labels = {
      secured: 'Secured',
      preferential: 'Preferential',
      secondary_preferential: 'Secondary Preferential',
      unsecured: 'Unsecured',
      members: 'Members'
    };
    return labels[type] || type;
  };

  const handleDeleteDistribution = async () => {
    if (!selectedHistoryItem) return;

    const updatedHistory = distributionHistory.filter(d => d.id !== selectedHistoryItem.id);
    setDistributionHistory(updatedHistory);
    
    // Save to database
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.entities.Case.update(caseId, {
        distributions_data: JSON.stringify(updatedHistory)
      });
      setSelectedHistoryItem(null);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting distribution:', error);
      alert('Failed to delete distribution. Please try again.');
    }
  };

  const exportToHTML = (distribution) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${getTypeLabel(distribution.distributionType)} Distribution - ${formatDate(distribution.date)}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      color: #1e293b;
    }
    h1 {
      color: #1e40af;
      margin-bottom: 10px;
    }
    .date {
      color: #64748b;
      margin-bottom: 30px;
    }
    .summary {
      background-color: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 30px;
    }
    .summary h2 {
      color: #1e40af;
      margin-top: 0;
      margin-bottom: 15px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      color: #1e40af;
      font-size: 14px;
      margin-bottom: 8px;
    }
    .summary-value {
      background-color: white;
      padding: 12px;
      border-radius: 6px;
      font-weight: bold;
      color: #1e40af;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    th {
      background-color: #f8fafc;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .text-right {
      text-align: right;
    }
    .font-medium {
      font-weight: 500;
    }
    .text-green {
      color: #15803d;
      font-weight: 600;
    }
    @media print {
      body {
        margin: 20px;
      }
    }
  </style>
</head>
<body>
  <h1>${getTypeLabel(distribution.distributionType)} Distribution</h1>
  <p class="date">Date: ${formatDate(distribution.date)}</p>
  
  <div class="summary">
    <h2>Distribution Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-label">${distribution.distributionType === 'members' ? 'Number of Members:' : 'Number of Claims:'}</div>
        <div class="summary-value">${distribution.distributions.length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">${distribution.distributionType === 'members' ? 'Issued Share Capital (£):' : 'Total Claims:'}</div>
        <div class="summary-value">${formatCurrency(distribution.totalClaims)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Net Distribution:</div>
        <div class="summary-value">${formatCurrency(distribution.netDistribution)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">${distribution.distributionType === 'members' ? 'Rate per Share:' : 'Pence in Pound:'}</div>
        <div class="summary-value">${distribution.dividendRateLabel || (distribution.penceInPound.toFixed(2) + 'p')}</div>
      </div>
    </div>
  </div>

  <h2>Distribution Details</h2>
  <table>
    <thead>
      <tr>
        <th>${distribution.distributionType === 'members' ? 'Member Name' : 'Creditor Name'}</th>
        <th class="text-right">${distribution.distributionType === 'members' ? 'Shares Held' : 'Agreed Claim'}</th>
        <th class="text-right">Dividend Rate</th>
        <th class="text-right">Distribution (£)</th>
      </tr>
    </thead>
    <tbody>
      ${distribution.distributions.map(dist => `
        <tr>
          <td class="font-medium">${dist.creditor_name}</td>
          <td class="text-right">${formatCurrency(dist.claim_amount)}</td>
          <td class="text-right">${distribution.dividendRateLabel || (distribution.penceInPound.toFixed(2) + 'p')}</td>
          <td class="text-right text-green">${formatCurrency(dist.distribution)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    newWindow.document.write(html);
    newWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex min-h-[600px]">
          {/* Left Sidebar - Distribution History */}
          <div className="w-64 border-r border-slate-200 bg-slate-50 p-4">
            <div className="mb-4">
              <Button 
                onClick={() => setShowDeclareForm(!showDeclareForm)}
                className="w-full bg-blue-600 hover:bg-blue-700 mb-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Declare Distribution
              </Button>
            </div>

            <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Distribution History
            </div>
            
            <div className="space-y-1">
              {distributionHistory.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No distributions yet</p>
              ) : (
                distributionHistory.map((dist) => (
                  <div 
                    key={dist.id} 
                    onClick={() => {
                      setSelectedHistoryItem(dist);
                      setShowDeclareForm(false);
                    }}
                    className={`bg-white border rounded p-2 hover:bg-blue-50 transition-colors cursor-pointer text-sm ${
                      selectedHistoryItem?.id === dist.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="font-medium text-slate-900">{getTypeLabel(dist.distributionType)}</div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-500">{formatDate(dist.date)}</span>
                      <span className="text-blue-600 font-semibold">{dist.dividendRateLabel || `${dist.penceInPound.toFixed(2)}p in £`}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-6">
            {showDeclareForm ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">Declare New Distribution</h2>
                  <Button 
                    onClick={calculateDistribution}
                    disabled={!distributionType || !sumToDistribute}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Calculator className="w-4 h-4 mr-2" />
                    Calculate Distribution
                  </Button>
                </div>
              {/* Input Form */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Distribution Type</Label>
                  <Select value={distributionType} onValueChange={setDistributionType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secured">Secured</SelectItem>
                      <SelectItem value="preferential">Preferential</SelectItem>
                      <SelectItem value="secondary_preferential">Secondary Preferential</SelectItem>
                      <SelectItem value="unsecured">Unsecured</SelectItem>
                      <SelectItem value="members">Members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date of Distribution</Label>
                  <Input
                    type="date"
                    value={distributionDate}
                    onChange={(e) => setDistributionDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sum to Distribute (£)</Label>
                  <Input
                    type="text"
                    value={sumToDistribute ? parseFloat(sumToDistribute).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '');
                      if (value === '' || !isNaN(value)) {
                        setSumToDistribute(value);
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sum to Retain (£)</Label>
                  <Input
                    type="text"
                    value={sumToRetain ? parseFloat(sumToRetain).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                    onChange={(e) => {
                      const value = e.target.value.replace(/,/g, '');
                      if (value === '' || !isNaN(value)) {
                        setSumToRetain(value);
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Distribution Summary - Show First */}
              {distributionResult && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-blue-900 mb-3">Distribution Summary</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{distributionType === 'members' ? 'Number of Members:' : 'Number of Claims:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{distributionResult.distributions.length}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{distributionType === 'members' ? 'Issued Share Capital (£):' : 'Total Claims:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{formatCurrency(distributionResult.totalClaims)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">Net Distribution:</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{formatCurrency(distributionResult.netDistribution)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{distributionType === 'members' ? 'Rate per Share:' : 'Pence in Pound:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{distributionResult.dividendRateLabel}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Eligible Creditors/Members with Distributions */}
              {distributionType && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">
                    {distributionType === 'members' ? 'Eligible Members' : 'Eligible Creditors'} ({getFilteredCreditors().length})
                  </h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{distributionType === 'members' ? 'Member Name' : 'Creditor Name'}</TableHead>
                          <TableHead className="text-right">{distributionType === 'members' ? 'Shares Held' : 'Agreed Claim'}</TableHead>
                          <TableHead className="text-right">Dividend Rate</TableHead>
                          <TableHead className="text-right">Distributions (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredCreditors().map((creditor) => {
                          const hasAgreedClaim = creditor.balance_submitted && parseFloat(creditor.balance_submitted) > 0;
                          const distData = distributionResult?.distributions.find(d => d.creditor_name === creditor.creditor_name);
                          return (
                            <TableRow key={creditor.id} className={!hasAgreedClaim ? 'opacity-40' : ''}>
                              <TableCell className="font-medium">{creditor.creditor_name}</TableCell>
                              <TableCell className="text-right">{formatCurrency(creditor.balance_submitted)}</TableCell>
                              <TableCell className="text-right">
                                {distributionResult && hasAgreedClaim ? distributionResult.dividendRateLabel : '—'}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-700">
                                {distData ? formatCurrency(distData.distribution) : '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {distributionResult && (
                <div className="flex justify-end gap-3 mt-6">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowDeclareForm(false);
                      setDistributionResult(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={saveDeclaredDistribution}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Save Distribution
                  </Button>
                </div>
              )}
              </div>
            ) : selectedHistoryItem ? (
              <div className="space-y-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{getTypeLabel(selectedHistoryItem.distributionType)} Distribution</h2>
                    <p className="text-sm text-slate-500 mt-1">Date: {formatDate(selectedHistoryItem.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => exportToHTML(selectedHistoryItem)}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Export
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => setShowDeleteDialog(true)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Distribution Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">Distribution Summary</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{selectedHistoryItem.distributionType === 'members' ? 'Number of Members:' : 'Number of Claims:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{selectedHistoryItem.distributions.length}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{selectedHistoryItem.distributionType === 'members' ? 'Issued Share Capital (£):' : 'Total Claims:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{formatCurrency(selectedHistoryItem.totalClaims)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">Net Distribution:</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{formatCurrency(selectedHistoryItem.netDistribution)}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-blue-700 text-sm block mb-2">{selectedHistoryItem.distributionType === 'members' ? 'Rate per Share:' : 'Pence in Pound:'}</span>
                      <p className="font-bold text-blue-900 bg-white rounded p-3">{selectedHistoryItem.dividendRateLabel || `${selectedHistoryItem.penceInPound.toFixed(2)}p`}</p>
                    </div>
                  </div>
                </div>

                {/* Distribution Details Table */}
                <div>
                  <h4 className="font-semibold text-slate-900 mb-3">Distribution Details</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>{selectedHistoryItem.distributionType === 'members' ? 'Member Name' : 'Creditor Name'}</TableHead>
                          <TableHead className="text-right">{selectedHistoryItem.distributionType === 'members' ? 'Shares Held' : 'Agreed Claim'}</TableHead>
                          <TableHead className="text-right">Dividend Rate</TableHead>
                          <TableHead className="text-right">Distribution (£)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedHistoryItem.distributions.map((dist, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{dist.creditor_name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(dist.claim_amount)}</TableCell>
                            <TableCell className="text-right">{selectedHistoryItem.dividendRateLabel || `${selectedHistoryItem.penceInPound.toFixed(2)}p`}</TableCell>
                            <TableCell className="text-right font-semibold text-green-700">
                              {formatCurrency(dist.distribution)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <PoundSterling className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">Distributions</h3>
                  <p className="text-slate-500">Click "Declare Distribution" to create a new distribution</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Distribution</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this {selectedHistoryItem && getTypeLabel(selectedHistoryItem.distributionType)} distribution? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDistribution}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}