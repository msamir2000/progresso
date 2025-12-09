import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { base44 } from '@/api/base44Client';
import { 
  Eye, 
  Calendar, 
  Briefcase, 
  TrendingUp, 
  PoundSterling,
  Building,
  Search,
  Clock, // Added Clock icon import
  ArrowUp, // Added ArrowUp icon import
  ArrowDown // Added ArrowDown icon import
} from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (e) {
    return '—';
  }
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '£0.00';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP'
  }).format(amount);
};

const getLastReviewDate = (caseData) => {
  const reviewDates = [
    caseData.case_strategy_note_date,
    caseData.review_1_month_date,
    caseData.review_6_month_date
  ].filter(Boolean);

  if (caseData.additional_reviews && caseData.additional_reviews.length > 0) {
    reviewDates.push(...caseData.additional_reviews.map(r => r.review_date).filter(Boolean));
  }

  if (reviewDates.length === 0) return null;
  
  return reviewDates.sort((a, b) => new Date(b) - new Date(a))[0];
};

const estimateClosureDate = (caseData) => {
  if (!caseData.appointment_date) return null;
  
  const appointmentDate = new Date(caseData.appointment_date);
  // Estimate based on case type - these are rough estimates
  const estimatedMonths = {
    'Administration': 12,
    'CVL': 18,
    'MVL': 6,
    'CWU': 3,
    'Moratoriums': 3,
    'Receiverships': 12
  };
  
  const months = estimatedMonths[caseData.case_type] || 12;
  const closureDate = new Date(appointmentDate);
  closureDate.setMonth(closureDate.getMonth() + months);
  
  return closureDate.toISOString().split('T')[0];
};

export default function CaseTypeDetailModal({ 
  isOpen, 
  onClose, 
  caseType, 
  cases, 
  onCaseClick 
}) {
  const [caseFunds, setCaseFunds] = useState({});
  const [isLoadingFunds, setIsLoadingFunds] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('company_name'); // New state for sorting
  const [sortDirection, setSortDirection] = useState('asc'); // New state for sort direction

  const calculateProgress = useCallback((caseData) => {
    const completedOrN_A_Tasks = (caseData.tasks_progress || []).filter(
      t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())
    ).length;

    const getTotalTasksForCase = (type) => {
      if (type === 'CVL') {
        return 81; // CVL template has 81 tasks
      } else if (type === 'MVL') {
        return 74; // MVL template has 74 tasks
      } else if (type === 'Administration') {
        return 74; // Administration template has 74 tasks
      }
      return 74; // Default fallback for other types
    };

    const totalTasksForProgress = getTotalTasksForCase(caseData.case_type);
    const progressRatio = totalTasksForProgress > 0 ? completedOrN_A_Tasks / totalTasksForProgress : 0;
    const progress = Math.round(progressRatio * 100);
    
    // Cap progress at 100%
    return Math.min(progress, 100);
  }, []);

  const filteredCases = useMemo(() => {
    return cases.filter(case_ => case_.case_type === caseType);
  }, [cases, caseType]);

  // Filter cases based on active tab and search term
  const displayedCases = useMemo(() => {
    let filtered = filteredCases;

    // Filter by pipeline/active
    if (activeTab === 'pipeline') {
      filtered = filtered.filter(c => !c.appointment_date || c.appointment_date === '');
    } else if (activeTab === 'active') {
      filtered = filtered.filter(c => c.appointment_date && c.appointment_date !== '');
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(case_ => 
        case_.company_name?.toLowerCase().includes(query) ||
        case_.case_reference?.toLowerCase().includes(query) ||
        case_.administrator_name?.toLowerCase().includes(query)
      );
    }

    // Sort cases based on sortBy and sortDirection
    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'company_name') {
        const nameA = (a.company_name || '').toLowerCase();
        const nameB = (b.company_name || '').toLowerCase();
        comparison = nameA.localeCompare(nameB);
      } else if (sortBy === 'progress') {
        const progressA = calculateProgress(a);
        const progressB = calculateProgress(b);
        comparison = progressA - progressB;
      } else if (sortBy === 'appointment_date') {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
        comparison = dateA - dateB;
      } else if (sortBy === 'status') {
        const statusOrder = { 'green': 1, 'amber': 2, 'red': 3, '': 4 };
        const statusA = statusOrder[a.action_points_status || ''] || 4;
        const statusB = statusOrder[b.action_points_status || ''] || 4;
        comparison = statusA - statusB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCases, activeTab, searchTerm, sortBy, sortDirection, calculateProgress]);

  const statistics = useMemo(() => {
    const totalCases = filteredCases.length;
    const completedCases = filteredCases.filter(c => c.status === 'completed').length;
    const activeCases = filteredCases.filter(c => c.appointment_date && c.appointment_date !== '' && c.status !== 'completed').length; // Changed filter to exclude completed cases
    const pipelineCases = filteredCases.filter(c => !c.appointment_date || c.appointment_date === '').length;
    const onHoldCases = filteredCases.filter(c => c.status === 'on_hold').length;

    const averageProgress = filteredCases.length > 0
      ? Math.round(filteredCases.reduce((sum, c) => sum + calculateProgress(c), 0) / filteredCases.length)
      : 0;

    // Calculate average case duration for completed cases
    const completedCasesWithDates = filteredCases.filter(c => 
      c.status === 'completed' && c.appointment_date && c.closure_date
    );

    const averageDuration = completedCasesWithDates.length > 0
      ? Math.round(completedCasesWithDates.reduce((sum, case_) => {
          const appointmentDate = new Date(case_.appointment_date);
          const closureDate = new Date(case_.closure_date);
          const diffInMonths = (closureDate.getFullYear() - appointmentDate.getFullYear()) * 12 +
            (closureDate.getMonth() - appointmentDate.getMonth());
          return sum + Math.max(0, diffInMonths); // Ensure non-negative duration
        }, 0) / completedCasesWithDates.length)
      : 0;

    return { totalCases, completedCases, activeCases, pipelineCases, onHoldCases, averageProgress, averageDuration };
  }, [filteredCases, calculateProgress]);

  useEffect(() => {
    const loadCaseFunds = () => {
      if (!isOpen || displayedCases.length === 0) {
        setCaseFunds({});
        return;
      }

      setIsLoadingFunds(true);
      const fundsMap = {};

      // Use pre-calculated total_funds_held from case entity to avoid rate limiting
      displayedCases.forEach(case_ => {
        fundsMap[case_.id] = parseFloat(case_.total_funds_held) || 0;
      });

      setCaseFunds(fundsMap);
      setIsLoadingFunds(false);
    };

    loadCaseFunds();
  }, [isOpen, displayedCases]); 

  const handleSortByCompanyName = () => {
    if (sortBy === 'company_name') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('company_name');
      setSortDirection('asc');
    }
  };

  const handleSortByProgress = () => {
    if (sortBy === 'progress') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('progress');
      setSortDirection('asc');
    }
  };

  const handleSortByAppointmentDate = () => {
    if (sortBy === 'appointment_date') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('appointment_date');
      setSortDirection('desc'); // Default to descending for dates (newest first)
    }
  };

  const handleSortByStatus = () => {
    if (sortBy === 'status') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('status');
      setSortDirection('asc');
    }
  };

  if (!isOpen || !caseType) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            {caseType} Cases
            <Badge variant="outline" className="font-mono text-sm">
              {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Statistics */}
          <div className="p-6 pb-4 border-b border-slate-200">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-medium text-blue-600">Total Cases</p>
                      <p className="text-xl font-bold text-blue-900">{statistics.totalCases}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-xs font-medium text-orange-600">Pipeline</p>
                      <p className="text-xl font-bold text-orange-900">{statistics.pipelineCases}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs font-medium text-green-600">Active Cases</p>
                      <p className="text-xl font-bold text-green-900">{statistics.activeCases}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs font-medium text-purple-600">Completed</p>
                      <p className="text-xl font-bold text-purple-900">{statistics.completedCases}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs font-medium text-amber-600">Avg Progress</p>
                      <p className="text-xl font-bold text-amber-900">{statistics.averageProgress}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* New Card for Average Duration */}
              <Card className="bg-indigo-50 border-indigo-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="text-xs font-medium text-indigo-600">Avg Duration</p>
                      <p className="text-xl font-bold text-indigo-900">
                        {statistics.averageDuration > 0 ? `${statistics.averageDuration}mo` : 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Filter Tabs and Search */}
          <div className="px-6 pt-4 pb-2 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Tab buttons */}
              <div className="flex gap-2">
                <Button
                  variant={activeTab === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('active')}
                  className={activeTab === 'active' ? 'bg-blue-600' : ''}
                >
                  Active ({statistics.activeCases})
                </Button>
                <Button
                  variant={activeTab === 'pipeline' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('pipeline')}
                  className={activeTab === 'pipeline' ? 'bg-blue-600' : ''}
                >
                  Pipeline ({statistics.pipelineCases})
                </Button>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Cases Table */}
          <ScrollArea className="flex-1">
            <div className="p-6">
              {displayedCases.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {searchTerm ? 'No cases found' : `No ${activeTab} cases found`}
                  </h3>
                  <p className="text-slate-500">
                    {searchTerm 
                      ? 'Try adjusting your search terms' 
                      : `There are currently no ${activeTab} cases of this type.`}
                  </p>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      {caseType} Case Details - {activeTab === 'active' ? 'Active' : 'Pipeline'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead 
                              className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={handleSortByCompanyName}
                            >
                              <div className="flex items-center gap-2">
                                Company
                                {sortBy === 'company_name' && (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ArrowDown className="w-4 h-4 text-blue-600" />
                                  )
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-700">Reference</TableHead>
                            <TableHead 
                              className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={handleSortByProgress}
                            >
                              <div className="flex items-center gap-2">
                                Progress
                                {sortBy === 'progress' && (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ArrowDown className="w-4 h-4 text-blue-600" />
                                  )
                                )}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={handleSortByAppointmentDate}
                            >
                              <div className="flex items-center gap-2">
                                Appointment Date
                                {sortBy === 'appointment_date' && (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ArrowDown className="w-4 h-4 text-blue-600" />
                                  )
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-700">Last Review</TableHead>
                            <TableHead className="font-semibold text-slate-700">Est. Closure</TableHead>
                            <TableHead className="font-semibold text-slate-700">Funds Held</TableHead>
                            <TableHead 
                              className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={handleSortByStatus}
                            >
                              <div className="flex items-center gap-2">
                                Status
                                {sortBy === 'status' && (
                                  sortDirection === 'asc' ? (
                                    <ArrowUp className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ArrowDown className="w-4 h-4 text-blue-600" />
                                  )
                                )}
                              </div>
                            </TableHead>
                            <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayedCases.map((case_) => {
                            const progress = calculateProgress(case_); 
                            const lastReviewDate = getLastReviewDate(case_);
                            const estimatedClosure = estimateClosureDate(case_);
                            const fundsHeld = caseFunds[case_.id];
                            
                            return (
                              <TableRow key={case_.id} className="hover:bg-slate-50">
                                <TableCell>
                                  <div className="font-semibold text-slate-900">{case_.company_name}</div>
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {case_.case_reference}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                      <div
                                        className="bg-blue-600 h-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-slate-700 min-w-[3rem] text-right">
                                      {progress}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {formatDate(case_.appointment_date)}
                                </TableCell>
                                <TableCell>
                                  {formatDate(lastReviewDate)}
                                </TableCell>
                                <TableCell>
                                  {formatDate(estimatedClosure)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <PoundSterling className="w-3 h-3 text-slate-400" />
                                    <span className="text-sm font-medium">
                                      {isLoadingFunds ? '...' : formatCurrency(fundsHeld)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center justify-center">
                                    {case_.action_points_status === 'red' && (
                                      <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-red-700 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">R</span>
                                      </div>
                                    )}
                                    {case_.action_points_status === 'amber' && (
                                      <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">A</span>
                                      </div>
                                    )}
                                    {case_.action_points_status === 'green' && (
                                      <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-green-700 flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">G</span>
                                      </div>
                                    )}
                                    {!case_.action_points_status && (
                                      <span className="text-sm text-slate-400">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      onClose();
                                      onCaseClick(case_);
                                    }}
                                    className="hover:bg-blue-50"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}