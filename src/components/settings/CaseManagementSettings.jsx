
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Archive, 
  Trash2, 
  Search, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Briefcase,
  FileArchive,
  MoreVertical
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function CaseManagementSettings() {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  
  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState({ open: false, case: null });
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Archive confirmation
  const [archiveDialog, setArchiveDialog] = useState({ open: false, case: null });
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    setIsLoading(true);
    setError('');
    try {
      const allCases = await base44.entities.Case.list('-updated_date');
      setCases(allCases || []);
    } catch (err) {
      console.error('Error loading cases:', err);
      setError('Failed to load cases');
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveCase = async (caseToArchive) => {
    setIsArchiving(true);
    setError('');
    
    try {
      await base44.entities.Case.update(caseToArchive.id, {
        status: 'completed'
      });
      
      setSuccessMessage(`Case "${caseToArchive.company_name}" archived successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      await loadCases();
      setArchiveDialog({ open: false, case: null });
    } catch (err) {
      console.error('Error archiving case:', err);
      setError('Failed to archive case. Please try again.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeleteCase = async (caseToDelete) => {
    setIsDeleting(true);
    setError('');
    
    try {
      // Delete related records first
      const [creditors, employees, transactions, documents, diaryEntries, timesheetEntries] = await Promise.all([
        base44.entities.Creditor.filter({ case_id: caseToDelete.id }),
        base44.entities.Employee.filter({ case_id: caseToDelete.id }),
        base44.entities.Transaction.filter({ case_id: caseToDelete.id }),
        base44.entities.Document.filter({ case_id: caseToDelete.id }),
        base44.entities.CaseDiaryEntry.filter({ case_id: caseToDelete.id }),
        base44.entities.TimesheetEntry.filter({ case_reference: caseToDelete.case_reference })
      ]);

      // Delete all related records
      const deletePromises = [
        ...creditors.map(c => base44.entities.Creditor.delete(c.id)),
        ...employees.map(e => base44.entities.Employee.delete(e.id)),
        ...transactions.map(t => base44.entities.Transaction.delete(t.id)),
        ...documents.map(d => base44.entities.Document.delete(d.id)),
        ...diaryEntries.map(d => base44.entities.CaseDiaryEntry.delete(d.id)),
        ...timesheetEntries.map(t => base44.entities.TimesheetEntry.delete(t.id))
      ];

      await Promise.all(deletePromises);
      
      // Finally delete the case itself
      await base44.entities.Case.delete(caseToDelete.id);
      
      setSuccessMessage(`Case "${caseToDelete.company_name}" and all related data deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      await loadCases();
      setDeleteDialog({ open: false, case: null });
    } catch (err) {
      console.error('Error deleting case:', err);
      setError('Failed to delete case. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestoreCase = async (caseToRestore) => {
    try {
      await base44.entities.Case.update(caseToRestore.id, {
        status: 'active'
      });
      
      setSuccessMessage(`Case "${caseToRestore.company_name}" restored successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      await loadCases();
    } catch (err) {
      console.error('Error restoring case:', err);
      setError('Failed to restore case. Please try again.');
    }
  };

  const activeCases = cases.filter(c => c.status === 'active');
  const archivedCases = cases.filter(c => c.status === 'completed');

  const filterCases = (caseList) => {
    if (!searchTerm) return caseList;
    
    const term = searchTerm.toLowerCase();
    return caseList.filter(c => 
      c.company_name?.toLowerCase().includes(term) ||
      c.case_reference?.toLowerCase().includes(term) ||
      c.case_type?.toLowerCase().includes(term)
    );
  };

  const filteredActiveCases = filterCases(activeCases);
  const filteredArchivedCases = filterCases(archivedCases);

  const getCaseTypeBadgeColor = (caseType) => {
    const colors = {
      'CVL': 'bg-blue-100 text-blue-800',
      'MVL': 'bg-green-100 text-green-800',
      'Administration': 'bg-purple-100 text-purple-800',
      'CVA': 'bg-orange-100 text-orange-800',
      'CWU': 'bg-red-100 text-red-800',
      'Moratoriums': 'bg-yellow-100 text-yellow-800',
      'Receiverships': 'bg-pink-100 text-pink-800'
    };
    return colors[caseType] || 'bg-slate-100 text-slate-800';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-blue-600" />
            Case Management
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Archive closed cases or delete cases from the system permanently
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {activeCases.length} Active
          </Badge>
          <Badge variant="outline" className="text-sm">
            {archivedCases.length} Archived
          </Badge>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder="Search cases by name, reference, or type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Active Cases ({filteredActiveCases.length})
          </TabsTrigger>
          <TabsTrigger value="archived" className="flex items-center gap-2">
            <FileArchive className="w-4 h-4" />
            Archived Cases ({filteredArchivedCases.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Cases Tab */}
        <TabsContent value="active" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {filteredActiveCases.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">No active cases found</p>
                  {searchTerm && <p className="text-sm">Try a different search term</p>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Company Name</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Reference</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Type</TableHead>
                        <TableHead className="font-semibold text-slate-700">Appointment Date</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Admin</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActiveCases.map((case_) => (
                        <TableRow key={case_.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">{case_.company_name}</TableCell>
                          <TableCell className="text-slate-600">{case_.case_reference}</TableCell>
                          <TableCell>
                            <Badge className={getCaseTypeBadgeColor(case_.case_type)}>
                              {case_.case_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {case_.appointment_date ? new Date(case_.appointment_date).toLocaleDateString('en-GB') : '—'}
                          </TableCell>
                          <TableCell className="text-slate-600">{case_.assigned_user || '—'}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setArchiveDialog({ open: true, case: case_ })}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive Case
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteDialog({ open: true, case: case_ })}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Case
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Archived Cases Tab */}
        <TabsContent value="archived" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {filteredArchivedCases.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileArchive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">No archived cases found</p>
                  {searchTerm && <p className="text-sm">Try a different search term</p>}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Company Name</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Reference</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Type</TableHead>
                        <TableHead className="font-semibold text-slate-700">Appointment Date</TableHead>
                        <TableHead className="font-semibold text-slate-700">Case Admin</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredArchivedCases.map((case_) => (
                        <TableRow key={case_.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-500">{case_.company_name}</TableCell>
                          <TableCell className="text-slate-500">{case_.case_reference}</TableCell>
                          <TableCell>
                            <Badge className={getCaseTypeBadgeColor(case_.case_type)} variant="outline">
                              {case_.case_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {case_.appointment_date ? new Date(case_.appointment_date).toLocaleDateString('en-GB') : '—'}
                          </TableCell>
                          <TableCell className="text-slate-500">{case_.assigned_user || '—'}</TableCell>
                          <TableCell className="text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleRestoreCase(case_)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Restore to Active
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteDialog({ open: true, case: case_ })}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete Permanently
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialog.open} onOpenChange={(open) => !isArchiving && setArchiveDialog({ open, case: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Case?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{archiveDialog.case?.company_name}</strong>?
              <br/><br/>
              The case will be moved to the Archived Cases tab and can be restored later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleArchiveCase(archiveDialog.case)}
              disabled={isArchiving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isArchiving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Archiving...
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive Case
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !isDeleting && setDeleteDialog({ open, case: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case Permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <strong>{deleteDialog.case?.company_name}</strong>?
              <br/><br/>
              <span className="text-red-600 font-semibold">This action cannot be undone!</span>
              <br/><br/>
              This will delete:
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>The case and all its details</li>
                <li>All creditors</li>
                <li>All employees</li>
                <li>All transactions</li>
                <li>All documents</li>
                <li>All diary entries</li>
                <li>All timesheet entries</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDeleteCase(deleteDialog.case)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
