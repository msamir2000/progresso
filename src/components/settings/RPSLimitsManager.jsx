import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function RPSLimitsManager() {
  const [limits, setLimits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    weekly_limit: 0,
    effective_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadLimits();
  }, []);

  const loadLimits = async () => {
    setIsLoading(true);
    try {
      const loadedLimits = await base44.entities.RPSWeeklyLimit.list('-year');
      setLimits(loadedLimits || []);
    } catch (error) {
      console.error('Error loading RPS limits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    try {
      await base44.entities.RPSWeeklyLimit.create(formData);
      setShowAddForm(false);
      setFormData({
        year: new Date().getFullYear(),
        weekly_limit: 0,
        effective_date: new Date().toISOString().split('T')[0]
      });
      await loadLimits();
    } catch (error) {
      console.error('Error adding RPS limit:', error);
      alert('Failed to add RPS limit');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await base44.entities.RPSWeeklyLimit.update(id, data);
      setEditingId(null);
      await loadLimits();
    } catch (error) {
      console.error('Error updating RPS limit:', error);
      alert('Failed to update RPS limit');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this RPS limit?')) return;
    try {
      await base44.entities.RPSWeeklyLimit.delete(id);
      await loadLimits();
    } catch (error) {
      console.error('Error deleting RPS limit:', error);
      alert('Failed to delete RPS limit');
    }
  };

  const formatCurrency = (amount) => {
    return `£${amount?.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

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
          <CardTitle>RPS Weekly Limits Configuration</CardTitle>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Limit
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Add New RPS Weekly Limit</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Weekly Limit (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.weekly_limit}
                  onChange={(e) => setFormData({ ...formData, weekly_limit: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={formData.effective_date}
                  onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
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

        {limits.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No RPS limits configured</p>
            <p className="text-sm">Click "Add Limit" to create your first RPS weekly limit</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Year</TableHead>
                  <TableHead className="font-semibold">Weekly Limit</TableHead>
                  <TableHead className="font-semibold">Effective Date</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {limits.map((limit) => (
                  <TableRow key={limit.id}>
                    {editingId === limit.id ? (
                      <EditRow limit={limit} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                    ) : (
                      <>
                        <TableCell className="font-medium">{limit.year}</TableCell>
                        <TableCell>{formatCurrency(limit.weekly_limit)}</TableCell>
                        <TableCell>{formatDate(limit.effective_date)}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(limit.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(limit.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
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
        )}
      </CardContent>
    </Card>
  );
}

function EditRow({ limit, onSave, onCancel }) {
  const [editData, setEditData] = useState({ ...limit });

  return (
    <>
      <TableCell>
        <Input
          type="number"
          value={editData.year}
          onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={editData.weekly_limit}
          onChange={(e) => setEditData({ ...editData, weekly_limit: parseFloat(e.target.value) })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="date"
          value={editData.effective_date}
          onChange={(e) => setEditData({ ...editData, effective_date: e.target.value })}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(limit.id, editData)}
            className="text-green-600 hover:text-green-700"
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </>
  );
}