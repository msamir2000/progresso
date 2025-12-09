import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Creditor } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users, Search, Upload, Download } from "lucide-react";
import AddCreditorModal from './AddCreditorModal';
import CreditorDetailView from './CreditorDetailView';
import CreditorUpload from './CreditorUpload';

const CreditorGroup = ({ title, creditors, onGroupSelect, isSelected }) => {
  const totalOwed = creditors.reduce((acc, c) => acc + (c.balance_owed || 0), 0);
  
  // Updated formatCurrency to display as negative numbers in parentheses
  const formatCurrency = (amount) => {
    const numValue = parseFloat(amount) || 0;
    const absValue = Math.abs(numValue);
    // Since creditor balances are liabilities (owed TO creditors), show as negative with parentheses
    return `(${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  };

  return (
    <div 
      className={`p-3 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-blue-100' : 'hover:bg-slate-50'}`}
      onClick={() => onGroupSelect(title.toLowerCase().replace(/ /g, '_'), creditors)}
    >
      <div className="flex justify-between items-center">
        <h4 className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>{title} ({creditors.length})</h4>
        <span className="font-mono text-sm text-slate-600">{formatCurrency(totalOwed)}</span>
      </div>
    </div>
  );
};

const CreditorSummaryTable = ({ title, creditors, onCreditorSelect }) => {
  // Updated formatCurrency to display as negative numbers in parentheses
  const formatCurrency = (amount) => {
    const numValue = parseFloat(amount) || 0;
    const absValue = Math.abs(numValue);
    // Since creditor balances are liabilities (owed TO creditors), show as negative with parentheses
    return `(${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-GB');
    } catch (e) {
      return '—';
    }
  };
  
  const getCommPreference = (creditor) => {
    if (creditor.opted_out) return <Badge variant="destructive">Opted Out</Badge>;
    if (creditor.email_only) return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Email Only</Badge>;
    if (creditor.on_mail_hold) return <Badge variant="secondary">Mail Hold</Badge>;
    return <Badge variant="outline">Default</Badge>;
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>
      {creditors.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="font-semibold text-slate-700">Creditor Name</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Balance Owed</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Balance Submitted</TableHead>
              <TableHead className="font-semibold text-slate-700">Date Submitted</TableHead>
              <TableHead className="font-semibold text-slate-700 text-center">Comm Preference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {creditors.map(creditor => (
              <TableRow 
                key={creditor.id}
                onClick={() => onCreditorSelect(creditor)}
                className="cursor-pointer hover:bg-slate-50"
              >
                <TableCell className="font-medium">{creditor.creditor_name}</TableCell>
                <TableCell className="font-mono text-right">{formatCurrency(creditor.balance_owed)}</TableCell>
                <TableCell className="font-mono text-right">{formatCurrency(creditor.balance_submitted)}</TableCell>
                <TableCell className="text-slate-600">{formatDate(creditor.date_submitted)}</TableCell>
                <TableCell className="text-center">{getCommPreference(creditor)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-slate-500 text-center py-8">No creditors in this category.</p>
      )}
    </div>
  );
};

export default function CreditorTable({ caseId }) {
  const [creditors, setCreditors] = useState([]);
  const [selectedCreditor, setSelectedCreditor] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('secured');
  const [selectedGroupCreditors, setSelectedGroupCreditors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadView, setIsUploadView] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadCreditors = useCallback(async (retryCount = 0) => {
    if (!caseId) {
      setError("No case ID provided.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const data = await Creditor.filter({ case_id: caseId });
      setCreditors(data || []);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading creditors:", error);
      
      // Check if it's a rate limit error and retry
      if (error.message?.includes('Rate limit') && retryCount < 3) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 4000);
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/3)...`);
        setTimeout(() => loadCreditors(retryCount + 1), delay);
        return; // Don't set error or stop loading yet
      }
      
      setError(error.message?.includes('Rate limit') 
        ? 'Server is busy. Please wait a moment and refresh the page.'
        : `Failed to load creditors: ${error.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      loadCreditors();
    }
  }, [caseId, loadCreditors]);

  const handleCreditorSelect = (creditor) => {
    setSelectedCreditor(creditor);
    setIsUploadView(false);
  };
  
  const handleUpdate = () => {
    loadCreditors();
    setSelectedCreditor(null);
  };

  const handleGroupSelect = (groupType, groupCreditors) => {
    setSelectedGroup(groupType);
    setSelectedGroupCreditors(groupCreditors);
    setSelectedCreditor(null);
    setIsUploadView(false);
  };

  const handleExportCreditors = () => {
    if (creditors.length === 0) {
      alert('No creditors to export');
      return;
    }

    // CSV Headers with separate address columns and email address
    const headers = ['Name', 'Address Line 1', 'Address Line 2', 'City', 'County', 'Postcode', 'Account Number', 'Balance Owed', 'Email Address'];
    
    // Helper function to parse address string into components
    const parseAddress = (addressString) => {
      if (!addressString) {
        return ['', '', '', '', ''];
      }
      
      // Split address by newlines
      const lines = addressString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Initialize address components
      let line1 = '';
      let line2 = '';
      let city = '';
      let county = '';
      let postcode = '';
      
      // Parse based on number of lines
      if (lines.length === 1) {
        line1 = lines[0];
      } else if (lines.length === 2) {
        line1 = lines[0];
        line2 = lines[1];
      } else if (lines.length === 3) {
        line1 = lines[0];
        line2 = lines[1];
        city = lines[2];
      } else if (lines.length === 4) {
        line1 = lines[0];
        line2 = lines[1];
        city = lines[2];
        postcode = lines[3];
      } else if (lines.length >= 5) {
        line1 = lines[0];
        line2 = lines[1];
        city = lines[2];
        county = lines[3];
        postcode = lines[4];
      }
      
      return [line1, line2, city, county, postcode];
    };
    
    // Helper to escape CSV cell content
    const escapeCsvCell = (cell) => {
      if (cell === null || cell === undefined) return '';
      let strCell = String(cell);
      if (strCell.includes(',') || strCell.includes('"') || strCell.includes('\n')) {
        return `"${strCell.replace(/"/g, '""')}"`;
      }
      return strCell;
    };
    
    // Format creditor data
    const rows = creditors.map(creditor => {
      const [line1, line2, city, county, postcode] = parseAddress(creditor.creditor_address);
      
      return [
        escapeCsvCell(creditor.creditor_name),
        escapeCsvCell(line1),
        escapeCsvCell(line2),
        escapeCsvCell(city),
        escapeCsvCell(county),
        escapeCsvCell(postcode),
        escapeCsvCell(creditor.account_number),
        escapeCsvCell((parseFloat(creditor.balance_owed) || 0).toFixed(2)),
        escapeCsvCell(creditor.email_address || '')
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
    link.setAttribute('download', `creditors_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const creditorGroups = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = searchTerm 
      ? creditors.filter(c => c.creditor_name.toLowerCase().includes(searchLower))
      : creditors;

    const groups = {
      secured: filtered.filter(c => c.creditor_type === 'secured'),
      moratorium: filtered.filter(c => c.creditor_type === 'moratorium'), // Added moratorium group
      preferential: filtered.filter(c => c.creditor_type === 'preferential'),
      secondary_preferential: filtered.filter(c => c.creditor_type === 'secondary_preferential'),
      unsecured: filtered.filter(c => c.creditor_type === 'unsecured'),
    };

    return groups;
  }, [creditors, searchTerm]);

  // Update selected group when creditors change or initially set
  useEffect(() => {
    // Define a preferred order for group selection
    const orderedGroupKeys = ['secured', 'moratorium', 'preferential', 'secondary_preferential', 'unsecured'];

    // If a group is currently selected and it exists in the new creditorGroups, keep it selected.
    if (selectedGroup && creditorGroups[selectedGroup]) {
      setSelectedGroupCreditors(creditorGroups[selectedGroup]);
    } else {
      // If no group is selected, or the selected group no longer exists/is empty,
      // try to find the first non-empty group based on the preferred order.
      const firstNonEmptyGroup = orderedGroupKeys.find(key => creditorGroups[key] && creditorGroups[key].length > 0);
      
      if (firstNonEmptyGroup) {
        setSelectedGroup(firstNonEmptyGroup);
        setSelectedGroupCreditors(creditorGroups[firstNonEmptyGroup]);
      } else {
        // If all groups are empty, default to 'secured' and clear creditors.
        setSelectedGroup('secured'); 
        setSelectedGroupCreditors([]);
      }
    }
  }, [creditorGroups, selectedGroup]); // Depend on creditorGroups and selectedGroup

  const getGroupTitle = (groupType) => {
    const titles = {
      secured: 'Secured Creditors',
      moratorium: 'Moratorium Creditors', // Added moratorium title
      preferential: 'Preferential Creditors',
      secondary_preferential: 'Secondary Preferential Creditors',
      unsecured: 'Unsecured Creditors'
    };
    return titles[groupType] || 'Creditors';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Creditors</span>
              </div>
              <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleExportCreditors} className="flex items-center gap-2">
                    <Download className="w-4 h-4"/>
                    <span>Export</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsUploadView(true)} className="flex items-center gap-2">
                    <Upload className="w-4 h-4"/>
                    <span>Import</span>
                  </Button>
                  <Button size="icon" onClick={() => setIsModalOpen(true)} title="Add Creditor" className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="w-4 h-4"/>
                  </Button>
              </div>
            </CardTitle>
            <div className="relative mt-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                <Input 
                    placeholder="Search creditors..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </CardHeader>
          <CardContent className="p-2">
            {isLoading ? (
              <div className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></div>
            ) : error ? (
              <div className="p-4 text-center text-red-600">{error}</div>
            ) : (
                <div className="space-y-2">
                    <CreditorGroup 
                      title="Secured" 
                      creditors={creditorGroups.secured} 
                      onGroupSelect={handleGroupSelect}
                      isSelected={selectedGroup === 'secured'}
                    />
                    <CreditorGroup 
                      title="Moratorium" 
                      creditors={creditorGroups.moratorium} 
                      onGroupSelect={handleGroupSelect}
                      isSelected={selectedGroup === 'moratorium'}
                    />
                    <CreditorGroup 
                      title="Preferential" 
                      creditors={creditorGroups.preferential} 
                      onGroupSelect={handleGroupSelect}
                      isSelected={selectedGroup === 'preferential'}
                    />
                    <CreditorGroup 
                      title="Secondary Preferential" 
                      creditors={creditorGroups.secondary_preferential} 
                      onGroupSelect={handleGroupSelect}
                      isSelected={selectedGroup === 'secondary_preferential'}
                    />
                    <CreditorGroup 
                      title="Unsecured" 
                      creditors={creditorGroups.unsecured} 
                      onGroupSelect={handleGroupSelect}
                      isSelected={selectedGroup === 'unsecured'}
                    />
                </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card className="shadow-sm min-h-[600px]">
           {isUploadView ? (
               <CreditorUpload caseId={caseId} onUploadComplete={() => { setIsUploadView(false); handleUpdate(); }} />
           ) : selectedCreditor ? (
               <CreditorDetailView creditor={selectedCreditor} onBack={() => setSelectedCreditor(null)} onUpdate={handleUpdate}/>
           ) : (
               <CardContent className="p-6">
                 <CreditorSummaryTable 
                   title={getGroupTitle(selectedGroup)}
                   creditors={selectedGroupCreditors}
                   onCreditorSelect={handleCreditorSelect}
                 />
               </CardContent>
           )}
        </Card>
      </div>
      <AddCreditorModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        caseId={caseId}
        onCreditorAdded={handleUpdate}
      />
    </div>
  );
}