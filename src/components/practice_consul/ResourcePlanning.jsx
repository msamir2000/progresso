import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Users, FileText, X, ArrowUpDown, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ResourcePlanning() {
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [showCasesModal, setShowCasesModal] = useState(false);
  const [sortByStatus, setSortByStatus] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [casesData, usersData] = await Promise.all([
          base44.entities.Case.list('-created_date', 10000),
          base44.entities.User.list('-created_date', 1000)
        ]);

        setCases(casesData || []);
        setUsers(usersData || []);
      } catch (error) {
        console.error('Error loading resource planning data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Map full case type names to abbreviations
  const caseTypeMap = {
    'Administration': 'ADM',
    'CVL': 'CVL',
    'MVL': 'MVL',
    'CWU': 'CWU',
    'Moratoriums': 'Moratoriums',
    'Receiverships': 'Receiverships',
    'CVA': 'CVA',
    'IVA': 'IVA',
    'BKR': 'BKR',
    'Advisory': 'Advisory'
  };

  const caseTypes = ['ADM', 'CVL', 'MVL', 'CWU', 'Moratoriums', 'Receiverships', 'CVA', 'IVA', 'BKR', 'Advisory'];

  // Get all case admins (excluding Lavina and Krunal)
  const caseAdmins = useMemo(() => {
    return users.filter(u => {
      if (u.grade !== 'Case Admin') return false;
      const email = u.email.toLowerCase();
      return !email.includes('lavina') && !email.includes('krunal');
    });
  }, [users]);

  // Calculate breakdown for each case admin
  const adminBreakdown = useMemo(() => {
    return caseAdmins.map(admin => {
      const adminCases = cases.filter(c => c.assigned_user === admin.email);
      
      // Count by case type
      const breakdown = {
        ADM: 0,
        CVL: 0,
        MVL: 0,
        CWU: 0,
        Moratoriums: 0,
        Receiverships: 0,
        CVA: 0,
        IVA: 0,
        BKR: 0,
        Advisory: 0
      };

      adminCases.forEach(c => {
        const mappedType = caseTypeMap[c.case_type] || c.case_type;
        if (breakdown.hasOwnProperty(mappedType)) {
          breakdown[mappedType]++;
        }
      });

      return {
        email: admin.email,
        name: admin.full_name || admin.email,
        totalCases: adminCases.length,
        breakdown
      };
    }).sort((a, b) => b.totalCases - a.totalCases);
  }, [caseAdmins, cases, caseTypeMap]);

  const handleAdminClick = (admin) => {
    setSelectedAdmin(admin);
    setShowCasesModal(true);
  };

  const selectedAdminCases = useMemo(() => {
    if (!selectedAdmin) return [];
    let filtered = cases.filter(c => c.assigned_user === selectedAdmin.email);
    
    if (sortByStatus) {
      const statusOrder = { 'red': 1, 'amber': 2, 'green': 3 };
      filtered = [...filtered].sort((a, b) => {
        const aStatus = statusOrder[a.action_points_status] || 4;
        const bStatus = statusOrder[b.action_points_status] || 4;
        return sortByStatus === 'asc' ? aStatus - bStatus : bStatus - aStatus;
      });
    }
    
    return filtered;
  }, [selectedAdmin, cases, sortByStatus]);
  
  const handleStatusSort = () => {
    setSortByStatus(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleExportHTML = () => {
    if (!selectedAdmin || selectedAdminCases.length === 0) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Cases for ${selectedAdmin.name}</title>
        <style>
          @page { size: A4; margin: 8mm; }
          body { font-family: Arial, sans-serif; padding: 8px; font-size: 8px; margin: 0; }
          h1 { color: #1e40af; margin: 0 0 3px 0; font-size: 16px; font-weight: 600; }
          .subtitle { color: #64748b; margin: 0 0 8px 0; font-size: 9px; }
          table { width: 100%; border-collapse: collapse; margin-top: 0; }
          th, td { padding: 3px 6px; text-align: left; border-bottom: 1px solid #e5e7eb; height: 13px; font-size: 8px; line-height: 1.2; }
          th { background-color: #f3f4f6; font-weight: 600; color: #111827; }
          .status-circle { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 3px; vertical-align: middle; }
          .status-red { background-color: #ef4444; }
          .status-amber { background-color: #f59e0b; }
          .status-green { background-color: #22c55e; }
          .status-gray { background-color: #9ca3af; }
          .badge { display: inline-block; padding: 1px 4px; border-radius: 2px; font-size: 7px; border: 1px solid #e5e7eb; background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <h1>Cases for ${selectedAdmin.name}</h1>
        <p class="subtitle">Total Cases: ${selectedAdminCases.length}</p>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Date of Appointment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${selectedAdminCases.map(caseItem => `
              <tr>
                <td>${caseItem.company_name || '—'}</td>
                <td><span class="badge">${caseTypeMap[caseItem.case_type] || caseItem.case_type}</span></td>
                <td>${caseItem.case_reference || '—'}</td>
                <td>${formatDate(caseItem.appointment_date)}</td>
                <td>
                  <span class="status-circle ${
                    caseItem.action_points_status === 'green' ? 'status-green' :
                    caseItem.action_points_status === 'amber' ? 'status-amber' :
                    caseItem.action_points_status === 'red' ? 'status-red' :
                    'status-gray'
                  }"></span>
                  ${caseItem.action_points_status || 'N/A'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return '—';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading resource planning data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            Case Admin Workload Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {adminBreakdown.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No case admins found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold text-slate-700 w-64 text-lg py-4">Case Admin</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center w-40 text-lg py-4">Total Cases</TableHead>
                    {caseTypes.map(type => (
                      <TableHead key={type} className="font-semibold text-slate-700 text-center text-base w-32 py-4">
                        {type}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adminBreakdown.map((admin) => (
                    <TableRow key={admin.email} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-900 text-lg py-4">
                        <button
                          onClick={() => handleAdminClick(admin)}
                          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left text-lg"
                        >
                          {admin.name}
                        </button>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <Badge className="bg-blue-600 text-white font-semibold text-base px-4 py-1">
                          {admin.totalCases}
                        </Badge>
                      </TableCell>
                      {caseTypes.map(type => (
                        <TableCell key={type} className="text-center py-4">
                          {admin.breakdown[type] > 0 ? (
                            <span className="text-slate-700 font-semibold text-base">{admin.breakdown[type]}</span>
                          ) : (
                            <span className="text-slate-400 text-base">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cases Modal */}
      <Dialog open={showCasesModal} onOpenChange={setShowCasesModal}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Cases for {selectedAdmin?.name} ({selectedAdminCases.length})
              </DialogTitle>
              <Button
                onClick={handleExportHTML}
                size="sm"
                className="flex items-center gap-2 mr-[4cm]"
              >
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </DialogHeader>
          <div className="overflow-auto flex-1">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">Company</TableHead>
                  <TableHead className="font-semibold text-slate-700">Type</TableHead>
                  <TableHead className="font-semibold text-slate-700">Reference</TableHead>
                  <TableHead className="font-semibold text-slate-700">Date of Appointment</TableHead>
                  <TableHead className="font-semibold text-slate-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleStatusSort}
                      className="flex items-center gap-1 hover:bg-slate-100"
                    >
                      Status
                      <ArrowUpDown className="w-3 h-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedAdminCases.map((caseItem) => (
                  <TableRow key={caseItem.id} className="hover:bg-slate-50">
                    <TableCell className="font-medium text-slate-900">
                      {caseItem.company_name || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {caseTypeMap[caseItem.case_type] || caseItem.case_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {caseItem.case_reference || '—'}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {formatDate(caseItem.appointment_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        <div className={`w-6 h-6 rounded-full ${
                          caseItem.action_points_status === 'green' ? 'bg-green-500' :
                          caseItem.action_points_status === 'amber' ? 'bg-amber-500' :
                          caseItem.action_points_status === 'red' ? 'bg-red-500' :
                          'bg-gray-300'
                        }`} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}