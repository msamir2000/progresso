import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Search, Shield, ChevronDown, Plus, TrendingUp, Eye, Calendar, ArrowUp, ArrowDown, FileText, Archive, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

// Safe helper functions
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

export default function BondingManagement({ 
  cases, 
  transactions,
  accountingEntries,
  chartOfAccounts,
  onCaseSelect,
  onManageOption
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('appointment_date');
  const [sortDirection, setSortDirection] = useState('desc'); // desc = recent first
  const [caseToArchive, setCaseToArchive] = useState(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

  // Use bonding data directly from cases prop (already calculated in CashieringSummary)
  const bondingData = useMemo(() => {
    return cases.map(caseItem => {
      // Cases already have assetRealisations and soaETR calculated correctly
      const assetRealisations = safeNumber(caseItem.assetRealisations);
      const initialBondValue = safeNumber(caseItem.initial_bond_value);
      
      // Sum all bond increases from the array
      const bondIncreases = caseItem.bond_increases || [];
      const totalIncreases = bondIncreases.reduce((sum, inc) => sum + safeNumber(inc.increase_value), 0);
      
      const bondedAmount = initialBondValue + totalIncreases;
      const isUnderbonded = assetRealisations > bondedAmount;
      const bondingShortfall = isUnderbonded ? assetRealisations - bondedAmount : 0;

      return {
        ...caseItem,
        assetRealisations,
        bondedAmount,
        isUnderbonded,
        bondingShortfall,
        soaETR: safeNumber(caseItem.soaETR)
      };
    });
  }, [cases]);

  // Filter and sort cases - separate bonding cases from excluded types
  const { bondingCases, excludedCases } = useMemo(() => {
    // Filter out archived cases first
    let allFiltered = bondingData.filter(c => !c.bonding_archived);
    
    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      allFiltered = allFiltered.filter(caseItem => 
        caseItem.company_name?.toLowerCase().includes(searchLower) ||
        caseItem.case_reference?.toLowerCase().includes(searchLower) ||
        caseItem.case_type?.toLowerCase().includes(searchLower)
      );
    }

    // Separate excluded types (Advisory and Receiverships)
    const excluded = allFiltered.filter(c => 
      c.case_type === 'Advisory' || c.case_type === 'Receiverships'
    );
    const bonding = allFiltered.filter(c => 
      c.case_type !== 'Advisory' && c.case_type !== 'Receiverships'
    );

    // Apply sorting to bonding cases
    const sortedBonding = bonding.sort((a, b) => {
      if (sortBy === 'appointment_date') {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      } else if (sortBy === 'case_type') {
        const typeA = (a.case_type || '').toLowerCase();
        const typeB = (b.case_type || '').toLowerCase();
        return sortDirection === 'asc' 
          ? typeA.localeCompare(typeB) 
          : typeB.localeCompare(typeA);
      } else if (sortBy === 'closure_date') {
        const dateA = a.closure_date ? new Date(a.closure_date).getTime() : 0;
        const dateB = b.closure_date ? new Date(b.closure_date).getTime() : 0;
        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      }
      return 0;
    });

    // Sort excluded cases by appointment date (recent first)
    const sortedExcluded = excluded.sort((a, b) => {
      const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
      const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
      return dateB - dateA;
    });

    return { bondingCases: sortedBonding, excludedCases: sortedExcluded };
  }, [bondingData, searchTerm, sortBy, sortDirection]);

  const getStatusBadge = (caseData) => {
    if (caseData.isUnderbonded) {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Underbonded</Badge>;
    } else if (caseData.bondedAmount > 0) {
      return <Badge className="bg-green-100 text-green-800 border-green-200">Adequate</Badge>;
    } else {
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Not Set</Badge>;
    }
  };

  const handleSortByAppointmentDate = () => {
    if (sortBy === 'appointment_date') {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy('appointment_date');
      setSortDirection('desc'); // Default to recent first
    }
  };

  const handleSortByCaseType = () => {
    if (sortBy === 'case_type') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('case_type');
      setSortDirection('asc'); // Default to A-Z
    }
  };

  const handleSortByClosureDate = () => {
    if (sortBy === 'closure_date') {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy('closure_date');
      setSortDirection('desc'); // Default to recent first
    }
  };

  const handleArchiveClick = (caseItem) => {
    setCaseToArchive(caseItem);
    setShowArchiveConfirm(true);
  };

  const handleConfirmArchive = () => {
    if (caseToArchive) {
      onManageOption && onManageOption(caseToArchive, 'archive_case');
      setShowArchiveConfirm(false);
      setCaseToArchive(null);
    }
  };

  const handleCancelArchive = () => {
    setShowArchiveConfirm(false);
    setCaseToArchive(null);
  };

  return (
    <div className="space-y-4">
      {/* Header row with search and button */}
      <div className="flex items-center justify-between gap-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search cases by name, reference or bank..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Button className="bg-purple-600 hover:bg-purple-700 flex-shrink-0">
          <Calendar className="w-4 h-4 mr-2" />
          Bonding Reports
        </Button>
      </div>

      {/* Main Bonding Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-100 hover:bg-slate-100">
              <TableHead className="font-semibold text-blue-700 text-base">Case Reference</TableHead>
              <TableHead 
                className="font-semibold text-blue-700 text-base cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={handleSortByAppointmentDate}
              >
                <div className="flex items-center gap-2">
                  Date of Appointment
                  {sortBy === 'appointment_date' ? (
                    sortDirection === 'desc' ? 
                      <ArrowDown className="w-5 h-5 text-blue-700 stroke-[2.5]" /> : 
                      <ArrowUp className="w-5 h-5 text-blue-700 stroke-[2.5]" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-blue-600 stroke-[2.5]" />
                  )}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold text-blue-700 text-base cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={handleSortByClosureDate}
              >
                <div className="flex items-center gap-2">
                  Date Closed
                  {sortBy === 'closure_date' ? (
                    sortDirection === 'desc' ? 
                      <ArrowDown className="w-5 h-5 text-blue-700 stroke-[2.5]" /> : 
                      <ArrowUp className="w-5 h-5 text-blue-700 stroke-[2.5]" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-blue-600 stroke-[2.5]" />
                  )}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-blue-700 text-base">Case Name</TableHead>
              <TableHead 
                className="font-semibold text-blue-700 text-base cursor-pointer hover:bg-slate-200 transition-colors"
                onClick={handleSortByCaseType}
              >
                <div className="flex items-center gap-2">
                  Case Type
                  {sortBy === 'case_type' ? (
                    sortDirection === 'asc' ? 
                      <ArrowUp className="w-5 h-5 text-blue-700 stroke-[2.5]" /> : 
                      <ArrowDown className="w-5 h-5 text-blue-700 stroke-[2.5]" />
                  ) : (
                    <ArrowDown className="w-5 h-5 text-blue-600 stroke-[2.5]" />
                  )}
                </div>
              </TableHead>
              <TableHead className="font-semibold text-blue-700 text-right text-base">SOA ETR (£)</TableHead>
              <TableHead className="font-semibold text-blue-700 text-right text-base">Asset Realisations (£)</TableHead>
              <TableHead className="font-semibold text-blue-700 text-right text-base">Bonded Amount (£)</TableHead>
              <TableHead className="font-semibold text-blue-700 text-center text-base">Status</TableHead>
              <TableHead className="font-semibold text-blue-700 text-center text-base">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bondingCases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-slate-500 text-base">
                  {searchTerm ? `No bonding cases found matching "${searchTerm}"` : 'No bonding cases found.'}
                </TableCell>
              </TableRow>
            ) : (
              bondingCases.map((caseItem) => {
                const isClosed = caseItem.status === 'completed';
                
                return (
                  <TableRow key={caseItem.id} className={`hover:bg-slate-50/50 transition-colors ${isClosed ? 'bg-slate-50/50' : ''}`}>
                    <TableCell className="font-medium text-slate-900 text-lg py-4">
                      {caseItem.case_reference || 'N/A'}
                      {isClosed && (
                        <Badge className="ml-2 bg-slate-100 text-slate-700 border-slate-300 text-xs">
                          Closed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-700 text-lg py-4">
                      {formatDate(caseItem.appointment_date)}
                    </TableCell>
                    <TableCell className="text-slate-700 text-lg py-4">
                      {caseItem.closure_date ? formatDate(caseItem.closure_date) : 'N/A'}
                    </TableCell>
                    <TableCell
                      className="font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors text-lg py-4"
                      onClick={() => onCaseSelect && onCaseSelect(caseItem)}
                    >
                      {caseItem.company_name || 'Unknown Company'}
                    </TableCell>
                    <TableCell className="text-lg py-4">
                      <Badge variant="outline" className="font-mono text-base">
                        {caseItem.case_type || 'N/A'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-900 text-lg py-4">
                      £{formatCurrency(caseItem.soaETR)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-900 text-lg py-4">
                      £{formatCurrency(caseItem.assetRealisations)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-slate-900 text-lg py-4">
                      £{formatCurrency(caseItem.bondedAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(caseItem)}
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-purple-600 border-purple-300 hover:bg-purple-50"
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Manage Bond
                            <ChevronDown className="w-4 h-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onManageOption && onManageOption(caseItem, 'set_up_bond')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Set Up Bond
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onManageOption && onManageOption(caseItem, 'increase_bond')}>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Increase Bond
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onManageOption && onManageOption(caseItem, 'bond_history')}>
                            <Eye className="w-4 h-4 mr-2" />
                            Bond History
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onManageOption && onManageOption(caseItem, 'close_bond')}>
                            <Shield className="w-4 h-4 mr-2" />
                            Close Bond
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleArchiveClick(caseItem)}>
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Advisory & Receivership Cases Table */}
      {excludedCases.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Badge className="bg-slate-100 text-slate-700 border-slate-300">
              Advisory & Receivership Cases
            </Badge>
            <span className="text-sm font-normal text-slate-600">
              (Bonding Not Applicable)
            </span>
          </h3>
          
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="font-semibold text-slate-700 text-base">Case Reference</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-base">Date of Appointment</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-base">Case Name</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-base">Case Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excludedCases.map((caseItem) => (
                  <TableRow key={caseItem.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium text-slate-900 text-lg py-4">
                      {caseItem.case_reference || 'N/A'}
                    </TableCell>
                    <TableCell className="text-slate-700 text-lg py-4">
                      {formatDate(caseItem.appointment_date)}
                    </TableCell>
                    <TableCell
                      className="font-medium text-slate-900 cursor-pointer hover:text-blue-600 transition-colors text-lg py-4"
                      onClick={() => onCaseSelect && onCaseSelect(caseItem)}
                    >
                      {caseItem.company_name || 'Unknown Company'}
                    </TableCell>
                    <TableCell className="text-lg py-4">
                      <Badge variant="outline" className="font-mono text-base">
                        {caseItem.case_type || 'N/A'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm Archive
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-slate-700 mb-4">
              Are you sure you want to archive this case from the bonding section?
            </p>
            {caseToArchive && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">Case:</span>
                  <span className="text-sm text-slate-900">{caseToArchive.company_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">Reference:</span>
                  <span className="text-sm text-slate-900">{caseToArchive.case_reference}</span>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500 mt-4">
              The case will be moved to the Archived Cases section in Settings and will not be loaded on application startup.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCancelArchive}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmArchive}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              <Archive className="w-4 h-4 mr-2" />
              Yes, Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}