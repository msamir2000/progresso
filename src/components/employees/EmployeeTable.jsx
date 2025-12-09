import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Employee } from '@/api/entities';
import { Case } from '@/api/entities';
import { Search, Upload, Plus, Settings, Loader2, FileText, Download } from 'lucide-react';

import AddEmployeeModal from './AddEmployeeModal';
import EmployeeDetailView from './EmployeeDetailView';
import EmployeeUpload from './EmployeeUpload';
import CompanySettingsModal from './CompanySettingsModal';
import RPSManagement from './RPSManagement';

export default function EmployeeTable({ caseId }) {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRPSManagement, setShowRPSManagement] = useState(false);
  const [caseData, setCaseData] = useState(null);

  const loadEmployees = useCallback(async (retryCount = 0) => {
    if (!caseId) {
      console.error('No case ID provided for loading employees');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const allEmployees = await Employee.filter({ case_id: caseId });
      setEmployees(allEmployees || []);
    } catch (error) {
      console.error('Failed to load employees:', error);
      
      // Check if it's a rate limit error and retry
      if (error.message?.includes('Rate limit') && retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => loadEmployees(retryCount + 1), delay);
        return; // Don't show alert or stop loading yet
      }
      
      alert(error.message?.includes('Rate limit')
        ? 'Server is busy. Please wait a moment and try again.'
        : `Failed to load employees: ${error.message || 'Unknown error'}`);
    } finally {
      if (retryCount === 0 || (error && !error.message?.includes('Rate limit'))) {
        setIsLoading(false);
      }
    }
  }, [caseId]);

  const loadCaseData = useCallback(async () => {
    try {
      const allCases = await Case.list();
      const foundCase = allCases.find(c => c.id === caseId);
      setCaseData(foundCase);
    } catch (error) {
      console.error('Failed to load case data:', error);
    }
  }, [caseId]);

  useEffect(() => {
    loadEmployees();
    loadCaseData();
  }, [loadEmployees, loadCaseData]);

  useEffect(() => {
    const filtered = employees.filter(emp => {
      const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
      const search = searchTerm.toLowerCase();
      return fullName.includes(search) || 
             (emp.email_address && emp.email_address.toLowerCase().includes(search)) ||
             (emp.national_insurance_number && emp.national_insurance_number.toLowerCase().includes(search));
    });
    setFilteredEmployees(filtered);
  }, [searchTerm, employees]);

  const handleEmployeeAdded = () => {
    loadEmployees();
    setShowAddModal(false);
  };

  const handleUploadComplete = () => {
    loadEmployees();
    setShowUploadModal(false);
  };

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee(employee);
  };

  const handleBackFromDetail = () => {
    setSelectedEmployee(null);
    loadEmployees();
  };

  const handleExportEmployees = () => {
    if (employees.length === 0) {
      alert('No employees to export');
      return;
    }

    // CSV Headers
    const headers = ['Title', 'First Name', 'Last Name', 'Address Line 1', 'Address Line 2', 'City', 'County', 'Postcode', 'Email Address'];
    
    // Helper to escape CSV cell content
    const escapeCsvCell = (cell) => {
      if (cell === null || cell === undefined) return '';
      let strCell = String(cell);
      if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
        return `"${strCell.replace(/"/g, '""')}"`;
      }
      return strCell;
    };
    
    // Format employee data
    const rows = employees.map(emp => {
      return [
        escapeCsvCell(emp.title || ''),
        escapeCsvCell(emp.first_name),
        escapeCsvCell(emp.last_name),
        escapeCsvCell(emp.address?.line1 || ''),
        escapeCsvCell(emp.address?.line2 || ''),
        escapeCsvCell(emp.address?.city || ''),
        escapeCsvCell(emp.address?.county || ''),
        escapeCsvCell(emp.address?.postcode || ''),
        escapeCsvCell(emp.email_address || '')
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '£0.00';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  };

  // Show RPS Management view
  if (showRPSManagement) {
    return (
      <RPSManagement 
        caseId={caseId} 
        caseData={caseData}
        onBack={() => setShowRPSManagement(false)} 
      />
    );
  }

  // Show upload view
  if (showUploadModal) {
    return (
      <EmployeeUpload 
        caseId={caseId} 
        onUploadComplete={handleUploadComplete}
        onBack={() => setShowUploadModal(false)}
      />
    );
  }

  // Show employee detail view
  if (selectedEmployee) {
    return (
      <EmployeeDetailView
        employee={selectedEmployee}
        onBack={handleBackFromDetail}
        onUpdate={loadEmployees}
      />
    );
  }

  // Main employee list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Employees</h3>
        
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRPSManagement(true)}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            RPS Management
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettingsModal(true)}
            className="text-slate-600 border-slate-200 hover:bg-slate-50"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button onClick={() => setShowUploadModal(true)} size="sm" variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button onClick={handleExportEmployees} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowAddModal(true)} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Employee
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-600">No employees found. Add your first employee to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead className="font-semibold text-blue-900 py-2">Name</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Wage Arrears</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Notice Pay</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Holiday Pay</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Pension Contributions</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Redundancy</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Other</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2 bg-red-50">Pref. Claim (£)</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2 bg-red-50">Unsecured Claim (£)</TableHead>
                  <TableHead className="text-right font-semibold text-blue-900 py-2">Total Claim</TableHead>
                  <TableHead className="text-center font-semibold text-blue-900 py-2">RPS Status</TableHead>
                  <TableHead className="text-center font-semibold text-blue-900 py-2">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => {
                  const wageArrears = (emp.wage_arrears_preferential || 0) + (emp.wage_arrears_unsecured || 0);
                  const noticePay = (emp.notice_pay_preferential || 0) + (emp.notice_pay_unsecured || 0);
                  const holidayPay = (emp.holiday_pay_preferential || 0) + (emp.holiday_pay_unsecured || 0);
                  const pensionContributions = (emp.pension_contributions_preferential || 0) + (emp.pension_contributions_unsecured || 0);
                  const redundancy = emp.redundancy_pay_unsecured || 0;
                  const other = 0; // Other is now removed since pension is separate
                  
                  return (
                    <TableRow key={emp.id} className="h-12">
                      <TableCell className="font-medium py-2">
                        {emp.title ? `${emp.title} ` : ''}{emp.first_name} {emp.last_name}
                      </TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(wageArrears)}</TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(noticePay)}</TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(holidayPay)}</TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(pensionContributions)}</TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(redundancy)}</TableCell>
                      <TableCell className="text-right py-2">{formatCurrency(other)}</TableCell>
                      <TableCell className="text-right py-2 font-semibold bg-red-50">{formatCurrency(emp.total_preferential_claim || 0)}</TableCell>
                      <TableCell className="text-right py-2 font-semibold bg-red-50">{formatCurrency(emp.total_unsecured_claim || 0)}</TableCell>
                      <TableCell className="text-right py-2">
                        {formatCurrency((emp.total_preferential_claim || 0) + (emp.total_unsecured_claim || 0))}
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Badge 
                          variant={emp.rps_claim_status === 'submitted' ? 'default' : 'destructive'}
                          className={emp.rps_claim_status === 'submitted' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                        >
                          {emp.rps_claim_status === 'submitted' ? 'Submitted' : 'To Submit'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEmployeeClick(emp)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Total Row */}
                <TableRow className="bg-slate-100">
                  <TableCell className="font-bold py-3">Total</TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.wage_arrears_preferential || 0) + (emp.wage_arrears_unsecured || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.notice_pay_preferential || 0) + (emp.notice_pay_unsecured || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.holiday_pay_preferential || 0) + (emp.holiday_pay_unsecured || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.pension_contributions_preferential || 0) + (emp.pension_contributions_unsecured || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.redundancy_pay_unsecured || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3">
                    {formatCurrency(0)}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3 text-blue-700 bg-red-50">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.total_preferential_claim || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3 text-blue-700 bg-red-50">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.total_unsecured_claim || 0), 0))}
                  </TableCell>
                  <TableCell className="text-right font-bold py-3 text-blue-700">
                    {formatCurrency(filteredEmployees.reduce((sum, emp) => 
                      sum + (emp.total_preferential_claim || 0) + (emp.total_unsecured_claim || 0), 0))}
                  </TableCell>
                  <TableCell className="py-3"></TableCell>
                  <TableCell className="py-3"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onEmployeeAdded={handleEmployeeAdded}
        caseId={caseId}
      />

      <CompanySettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}