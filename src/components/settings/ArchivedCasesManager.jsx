import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Archive, Search, Undo2, Loader2, AlertCircle, Eye, Briefcase } from 'lucide-react';

export default function ArchivedCasesManager() {
  const [archivedCases, setArchivedCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRestoring, setIsRestoring] = useState(null);

  useEffect(() => {
    loadArchivedCases();
  }, []);

  const loadArchivedCases = async () => {
    setIsLoading(true);
    try {
      const allCases = await base44.entities.Case.list('-updated_date', 1000);
      const archived = allCases.filter(c => c.bonding_archived === true);
      setArchivedCases(archived);
    } catch (error) {
      console.error('Error loading archived cases:', error);
      setArchivedCases([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreCase = async (caseId) => {
    setIsRestoring(caseId);
    try {
      await base44.entities.Case.update(caseId, {
        bonding_archived: false
      });
      
      // Reload the archived cases list
      loadArchivedCases();
    } catch (error) {
      console.error('Error restoring case:', error);
      alert('Failed to restore case: ' + (error.message || 'Unknown error'));
    } finally {
      setIsRestoring(null);
    }
  };

  const filteredCases = archivedCases.filter(case_ => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      case_.company_name?.toLowerCase().includes(searchLower) ||
      case_.case_reference?.toLowerCase().includes(searchLower) ||
      case_.case_type?.toLowerCase().includes(searchLower)
    );
  });

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

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-slate-600">Loading archived cases...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-600" />
            Archived Cases
          </CardTitle>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search archived cases..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Cases archived from the bonding section. These cases are not loaded on application startup.
        </p>
      </CardHeader>
      <CardContent>
        {filteredCases.length === 0 ? (
          <div className="text-center py-12">
            <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">
              {searchTerm ? 'No matching archived cases' : 'No archived cases'}
            </h3>
            <p className="text-slate-500">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Archived cases from the bonding section will appear here'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold text-slate-700">Case Reference</TableHead>
                  <TableHead className="font-semibold text-slate-700">Company Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Case Type</TableHead>
                  <TableHead className="font-semibold text-slate-700">Appointment Date</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Initial Bond</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Total Bond</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map(case_ => {
                  const bondIncreases = case_.bond_increases || [];
                  const totalIncreases = bondIncreases.reduce((sum, inc) => sum + (parseFloat(inc.increase_value) || 0), 0);
                  const totalBond = (parseFloat(case_.initial_bond_value) || 0) + totalIncreases;

                  return (
                    <TableRow key={case_.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-blue-600">
                        {case_.case_reference}
                      </TableCell>
                      <TableCell className="font-medium">
                        {case_.company_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{case_.case_type}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatDate(case_.appointment_date)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        £{formatCurrency(case_.initial_bond_value || 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        £{formatCurrency(totalBond)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreCase(case_.id)}
                          disabled={isRestoring === case_.id}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          {isRestoring === case_.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <Undo2 className="w-4 h-4 mr-1" />
                              Restore
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {filteredCases.length > 0 && (
          <div className="mt-4 text-sm text-slate-600">
            Showing {filteredCases.length} of {archivedCases.length} archived case{archivedCases.length !== 1 ? 's' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  );
}