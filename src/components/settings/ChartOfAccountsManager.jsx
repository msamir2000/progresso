import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ChartOfAccountsManager() {
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: '',
    account_group: '',
    description: ''
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const loadedAccounts = await base44.entities.ChartOfAccount.list('account_code');
      setAccounts(loadedAccounts || []);
      
      // Set first group as active by default
      if (loadedAccounts && loadedAccounts.length > 0) {
        const groups = [...new Set(loadedAccounts.map(acc => acc.account_group || 'Ungrouped'))];
        const sortedGroups = groups.sort((a, b) => a.localeCompare(b));
        if (sortedGroups.length > 0 && !activeGroup) {
          setActiveGroup(sortedGroups[0]);
        }
      }
    } catch (error) {
      console.error('Error loading chart of accounts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.account_code || !formData.account_name || !formData.account_type) {
      alert('Please fill in all required fields (Account Code, Name, and Type)');
      return;
    }
    try {
      await base44.entities.ChartOfAccount.create(formData);
      setShowAddForm(false);
      setFormData({
        account_code: '',
        account_name: '',
        account_type: '',
        account_group: '',
        description: ''
      });
      await loadAccounts();
    } catch (error) {
      console.error('Error adding account:', error);
      alert('Failed to add account');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await base44.entities.ChartOfAccount.update(id, data);
      setEditingId(null);
      await loadAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      alert('Failed to update account');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this account? This may affect transaction categorization.')) return;
    try {
      await base44.entities.ChartOfAccount.delete(id);
      await loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account');
    }
  };

  // Group accounts by account_group and sort
  const groupedAccounts = accounts.reduce((acc, account) => {
    const group = account.account_group || 'Ungrouped';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(account);
    return acc;
  }, {});

  // Sort groups alphabetically and accounts within each group A-Z by name
  const sortedGroups = Object.keys(groupedAccounts).sort((a, b) => a.localeCompare(b));
  sortedGroups.forEach(group => {
    groupedAccounts[group].sort((a, b) => a.account_name.localeCompare(b.account_name));
  });

  // Get accounts for the active group and filter by search term
  const activeGroupAccounts = activeGroup ? (groupedAccounts[activeGroup] || []).filter(account => {
    if (!searchTerm) return true;
    const query = searchTerm.toLowerCase();
    return account.account_code?.toLowerCase().includes(query) ||
           account.account_name?.toLowerCase().includes(query) ||
           account.account_type?.toLowerCase().includes(query) ||
           account.description?.toLowerCase().includes(query);
  }) : [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chart of Accounts Configuration</CardTitle>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Add New Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Account Code *</Label>
                <Input
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                  placeholder="e.g., 1000"
                />
              </div>
              <div>
                <Label>Account Name *</Label>
                <Input
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  placeholder="e.g., Cash at Bank"
                />
              </div>
              <div>
                <Label>Account Type *</Label>
                <Input
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                  placeholder="e.g., Assets, Liabilities, Revenue, Expenses"
                />
              </div>
              <div>
                <Label>Account Group</Label>
                <Input
                  value={formData.account_group}
                  onChange={(e) => setFormData({ ...formData, account_group: e.target.value })}
                  placeholder="e.g., Bank Accounts, Sales"
                />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {accounts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No accounts configured</p>
            <p className="text-sm">Click "Add Account" to create your first accounting code</p>
          </div>
        ) : (
          <div className="flex border rounded-lg overflow-hidden">
            {/* Left Side Menu */}
            <div className="w-64 flex-shrink-0 border-r bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-800 mb-4 text-sm">Account Groups</h3>
              <nav className="space-y-1">
                {sortedGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => setActiveGroup(group)}
                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeGroup === group
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right Content Area */}
            <div className="flex-1 overflow-y-auto">
              {activeGroup && activeGroupAccounts.length > 0 ? (
                <div>
                  {/* Group Header with Search */}
                  <div className="bg-slate-100 px-4 py-3 border-b border-slate-300 sticky top-0">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-700">{activeGroup}</h3>
                      <p className="text-xs text-slate-500">{activeGroupAccounts.length} account(s)</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Search accounts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Accounts Table */}
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-xs h-8 py-1">Code</TableHead>
                        <TableHead className="font-semibold text-xs h-8 py-1">Name</TableHead>
                        <TableHead className="font-semibold text-xs h-8 py-1">Type</TableHead>
                        <TableHead className="font-semibold text-xs h-8 py-1">Description</TableHead>
                        <TableHead className="font-semibold text-xs h-8 py-1 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeGroupAccounts.map((account) => (
                        <TableRow key={account.id} className="h-8">
                          {editingId === account.id ? (
                            <EditRow account={account} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                          ) : (
                            <>
                              <TableCell className="font-mono font-semibold text-sm py-1">{account.account_code}</TableCell>
                              <TableCell className="font-medium text-sm py-1">{account.account_name}</TableCell>
                              <TableCell className="text-sm py-1">{account.account_type}</TableCell>
                              <TableCell className="text-xs text-slate-600 py-1">{account.description || '-'}</TableCell>
                              <TableCell className="text-center py-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingId(account.id)}
                                    className="text-blue-600 hover:text-blue-700 h-6 w-6 p-0"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(account.id)}
                                    className="text-red-600 hover:text-red-700 h-6 w-6 p-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <p className="text-sm">No accounts in this group</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditRow({ account, onSave, onCancel }) {
  const [editData, setEditData] = useState({ ...account });

  return (
    <>
      <TableCell className="py-1">
        <Input
          value={editData.account_code}
          onChange={(e) => setEditData({ ...editData, account_code: e.target.value })}
          className="h-7 font-mono text-sm"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={editData.account_name}
          onChange={(e) => setEditData({ ...editData, account_name: e.target.value })}
          className="h-7 text-sm"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={editData.account_type}
          onChange={(e) => setEditData({ ...editData, account_type: e.target.value })}
          className="h-7 text-sm"
        />
      </TableCell>
      <TableCell className="py-1">
        <Input
          value={editData.description || ''}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          className="h-7 text-sm"
        />
      </TableCell>
      <TableCell className="text-center py-1">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(account.id, editData)}
            className="text-green-600 hover:text-green-700 h-6 w-6 p-0"
          >
            <Save className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-700 h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </TableCell>
    </>
  );
}