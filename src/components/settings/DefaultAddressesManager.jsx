import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DefaultAddressesManager() {
  const [addresses, setAddresses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  const loadAddresses = async () => {
    setIsLoading(true);
    try {
      const loadedAddresses = await base44.entities.DefaultAddress.list('name');
      setAddresses(loadedAddresses || []);
    } catch (error) {
      console.error('Error loading default addresses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.address) {
      alert('Please fill in both name and address');
      return;
    }
    try {
      await base44.entities.DefaultAddress.create(formData);
      setShowAddForm(false);
      setFormData({ name: '', address: '' });
      await loadAddresses();
    } catch (error) {
      console.error('Error adding address:', error);
      alert('Failed to add address');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await base44.entities.DefaultAddress.update(id, data);
      setEditingId(null);
      await loadAddresses();
    } catch (error) {
      console.error('Error updating address:', error);
      alert('Failed to update address');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this default address?')) return;
    try {
      await base44.entities.DefaultAddress.delete(id);
      await loadAddresses();
    } catch (error) {
      console.error('Error deleting address:', error);
      alert('Failed to delete address');
    }
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
          <CardTitle>Default Addresses Configuration</CardTitle>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Address
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Add New Default Address</h3>
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HMRC VAT Office, Companies House"
                />
              </div>
              <div>
                <Label>Address * (Each line on a new line)</Label>
                <Textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Line 1&#10;Line 2&#10;City&#10;Postcode"
                  rows={5}
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

        {addresses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No default addresses configured</p>
            <p className="text-sm">Click "Add Address" to create your first default address</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold w-1/3">Name</TableHead>
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold text-center w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.map((address) => (
                  <TableRow key={address.id}>
                    {editingId === address.id ? (
                      <EditRow address={address} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                    ) : (
                      <>
                        <TableCell className="font-medium">{address.name}</TableCell>
                        <TableCell>
                          <div className="whitespace-pre-line text-sm text-slate-600">
                            {address.address}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(address.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(address.id)}
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

function EditRow({ address, onSave, onCancel }) {
  const [editData, setEditData] = useState({ ...address });

  return (
    <>
      <TableCell>
        <Input
          value={editData.name}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Textarea
          value={editData.address}
          onChange={(e) => setEditData({ ...editData, address: e.target.value })}
          className="min-h-[80px]"
          rows={4}
        />
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(address.id, editData)}
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