import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, FileText, ArrowUpDown, Download, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ActiveCaseList() {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('appointment_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedMonths, setSelectedMonths] = useState([]);

  const exportToCSV = () => {
    const headers = ['Case Name', 'Case Reference', 'Case Type', 'Date of Appointment', 'Appointment Holders', 'Fee Basis', 'Post App WIP', 'Billed to Date'];
    const rows = sortedCases.map(c => [
      c.company_name || '',
      c.case_reference || '',
      c.case_type || '',
      c.appointment_date || '',
      getAppointmentHolders(c),
      getFeeBasis(c),
      formatCurrency(c.total_funds_distributed || 0),
      formatCurrency(c.billed_to_date || 0)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `active_cases_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    loadActiveCases();
  }, []);

  const loadActiveCases = async () => {
    setIsLoading(true);
    try {
      const allCases = await base44.entities.Case.list('-appointment_date', 500);
      // Filter to include only active cases with an appointment date and exclude Advisory cases
      const casesWithAppointmentDate = (allCases || []).filter(c => 
        c.appointment_date && 
        c.appointment_date !== '' && 
        c.case_type !== 'Advisory' &&
        c.status === 'active'
      );
      setCases(casesWithAppointmentDate);
    } catch (error) {
      console.error('Error loading active cases:', error);
      setCases([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  };

  const formatMonthYear = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return '—';
    }
  };

  const formatMonthOnly = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        month: 'long'
      });
    } catch (e) {
      return '—';
    }
  };

  // Get unique months from cases (month names only, without year)
  const availableMonths = React.useMemo(() => {
    const months = new Set();
    cases.forEach(c => {
      if (c.appointment_date) {
        months.add(formatMonthOnly(c.appointment_date));
      }
    });
    // Sort months in calendar order
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    return Array.from(months).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
  }, [cases]);

  const toggleMonth = (month) => {
    setSelectedMonths(prev => 
      prev.includes(month) 
        ? prev.filter(m => m !== month)
        : [...prev, month]
    );
  };

  const clearMonthFilter = () => {
    setSelectedMonths([]);
  };

  const getAppointmentHolders = (caseData) => {
    const nameMapping = {
      'Duncan': 'Duncan Coutts',
      'Rupen': 'Rupen Patel',
      'Nimish': 'Nimish Patel'
    };
    
    const holders = [];
    if (caseData.ip_name) holders.push(nameMapping[caseData.ip_name] || caseData.ip_name);
    if (caseData.joint_ip_name) holders.push(nameMapping[caseData.joint_ip_name] || caseData.joint_ip_name);
    if (caseData.joint_ip_name_2) holders.push(nameMapping[caseData.joint_ip_name_2] || caseData.joint_ip_name_2);
    return holders.length > 0 ? holders.join(', ') : '—';
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredCases = cases.filter(c => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        c.company_name?.toLowerCase().includes(search) ||
        c.case_reference?.toLowerCase().includes(search) ||
        c.case_type?.toLowerCase().includes(search) ||
        getAppointmentHolders(c).toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }
    
    // Month filter
    if (selectedMonths.length > 0) {
      const caseMonth = formatMonthOnly(c.appointment_date);
      if (!selectedMonths.includes(caseMonth)) return false;
    }
    
    return true;
  });

  const sortedCases = [...filteredCases].sort((a, b) => {
    let aValue, bValue;

    if (sortField === 'appointment_date') {
      aValue = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
      bValue = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
    } else if (sortField === 'appointment_holders') {
      aValue = getAppointmentHolders(a).toLowerCase();
      bValue = getAppointmentHolders(b).toLowerCase();
    } else if (sortField === 'case_type') {
      aValue = (a.case_type || '').toLowerCase();
      bValue = (b.case_type || '').toLowerCase();
    } else if (sortField === 'status') {
      const statusOrder = { 'red': 0, 'amber': 1, 'green': 2 };
      aValue = statusOrder[a.action_points_status] ?? 3;
      bValue = statusOrder[b.action_points_status] ?? 3;
    }

    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading active cases...</span>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getFeeBasis = (caseData) => {
    const basis = [];
    if (caseData.fee_resolution_fixed) basis.push('Fixed Fee');
    if (caseData.fee_resolution_time_costs) basis.push('Time Costs');
    if (caseData.fee_resolution_percentage) basis.push('% of Realisations');
    return basis.length > 0 ? basis.join(', ') : '—';
  };

  return (
    <div className="space-y-6 mx-[-225px]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                Active Case List
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                All active cases across all case types
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-100 text-blue-700 text-lg px-3 py-1">
                {filteredCases.length} Active Cases
              </Badge>
              {selectedMonths.length > 0 && (
                <Button
                  onClick={clearMonthFilter}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  Clear Month Filter
                </Button>
              )}
              <Button
                onClick={exportToCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export to CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by company name, case reference, case type, or appointment holders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Cases Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="font-semibold">Case Name</TableHead>
                  <TableHead className="font-semibold">Case Reference</TableHead>
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('case_type')}
                      className="flex items-center gap-1 hover:bg-slate-200"
                    >
                      Case Type
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSort('appointment_date')}
                        className="flex items-center gap-1 hover:bg-slate-200"
                      >
                        Date of Appointment
                        <ArrowUpDown className="w-3 h-3" />
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-7 w-7 p-0 ${selectedMonths.length > 0 ? 'bg-blue-100 border-blue-300' : ''}`}
                          >
                            <Filter className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64" align="start">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-sm">Filter by Month</h4>
                              {selectedMonths.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={clearMonthFilter}
                                  className="h-6 text-xs"
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2">
                              {availableMonths.map(month => (
                                <div key={month} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={month}
                                    checked={selectedMonths.includes(month)}
                                    onCheckedChange={() => toggleMonth(month)}
                                  />
                                  <label
                                    htmlFor={month}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    {month}
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                  <TableHead className="font-semibold">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('appointment_holders')}
                      className="flex items-center gap-1 hover:bg-slate-200"
                    >
                      Appointment Holders
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold text-right">Fee Basis</TableHead>
                  <TableHead className="font-semibold text-right">Post App WIP</TableHead>
                  <TableHead className="font-semibold text-right">Billed to Date</TableHead>
                  <TableHead className="font-semibold text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1 hover:bg-slate-200 mx-auto"
                    >
                      Status
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                      {searchTerm || selectedMonths.length > 0 ? 'No cases found matching your filters' : 'No active cases found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCases.map((caseData) => (
                    <TableRow key={caseData.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium">{caseData.company_name || '—'}</TableCell>
                      <TableCell>{caseData.case_reference || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {caseData.case_type || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(caseData.appointment_date)}</TableCell>
                      <TableCell>{getAppointmentHolders(caseData)}</TableCell>
                      <TableCell className="text-sm text-right">{getFeeBasis(caseData)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(caseData.total_funds_distributed || 0)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(caseData.billed_to_date || 0)}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <div className={`w-6 h-6 rounded-full ${
                            caseData.action_points_status === 'green' ? 'bg-green-500' :
                            caseData.action_points_status === 'amber' ? 'bg-amber-500' :
                            caseData.action_points_status === 'red' ? 'bg-red-500' :
                            'bg-gray-300'
                          }`} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {sortedCases.length > 0 && (
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing {sortedCases.length} of {cases.length} active cases
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}