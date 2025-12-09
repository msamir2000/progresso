
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function BondRatesManager() {
  const [rates, setRates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // The editingId, showAddForm, and formData states are no longer needed
  // as editing and adding functionalities are being removed from the UI.
  // const [editingId, setEditingId] = useState(null);
  // const [showAddForm, setShowAddForm] = useState(false);
  // const [formData, setFormData] = useState({
  //   year: 2025,
  //   range_min: 0,
  //   range_max: null,
  //   premium_corporate: 0,
  //   premium_mvl: 0,
  //   specific_bond_amount: 0
  // });

  useEffect(() => {
    loadRates();
  }, []);

  const loadRates = async () => {
    setIsLoading(true);
    try {
      const loadedRates = await base44.entities.BondingRate.list('-year');
      setRates(loadedRates || []);
    } catch (error) {
      console.error('Error loading bonding rates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // handleAdd, handleUpdate, handleDelete functions are no longer needed
  // as the corresponding UI elements and functionality are being removed.

  // const handleAdd = async () => {
  //   try {
  //     await base44.entities.BondingRate.create({ ...formData, year: 2025 });
  //     setShowAddForm(false);
  //     setFormData({
  //       year: 2025,
  //       range_min: 0,
  //       range_max: null,
  //       premium_corporate: 0,
  //       premium_mvl: 0,
  //       specific_bond_amount: 0
  //     });
  //     await loadRates();
  //   } catch (error) {
  //     console.error('Error adding bond rate:', error);
  //     alert('Failed to add bond rate');
  //   }
  // };

  // const handleUpdate = async (id, data) => {
  //   try {
  //     await base44.entities.BondingRate.update(id, data);
  //     setEditingId(null);
  //     await loadRates();
  //   } catch (error) {
  //     console.error('Error updating bond rate:', error);
  //     alert('Failed to update bond rate');
  //   }
  // };

  // const handleDelete = async (id) => {
  //   if (!confirm('Are you sure you want to delete this bond rate?')) return;
  //   try {
  //     await base44.entities.BondingRate.delete(id);
  //     await loadRates();
  //   } catch (error) {
  //     console.error('Error deleting bond rate:', error);
  //     alert('Failed to delete bond rate');
  //   }
  // };

  const handlePopulate2025Data = async () => {
    if (!confirm('This will add all 2025 bond rates from the PDF. Continue?')) return;

    const rates2025 = [
      { year: 2025, range_min: 0, range_max: 500, premium_corporate: 34.50, premium_mvl: 17.25, specific_bond_amount: 5000 },
      { year: 2025, range_min: 501, range_max: 5000, premium_corporate: 80.50, premium_mvl: 40.25, specific_bond_amount: 5000 },
      { year: 2025, range_min: 5001, range_max: 10000, premium_corporate: 120.75, premium_mvl: 60.38, specific_bond_amount: 10000 },
      { year: 2025, range_min: 10001, range_max: 25000, premium_corporate: 166.75, premium_mvl: 83.38, specific_bond_amount: 25000 },
      { year: 2025, range_min: 25001, range_max: 50000, premium_corporate: 225.40, premium_mvl: 112.70, specific_bond_amount: 50000 },
      { year: 2025, range_min: 50001, range_max: 100000, premium_corporate: 363.40, premium_mvl: 181.70, specific_bond_amount: 100000 },
      { year: 2025, range_min: 100001, range_max: 250000, premium_corporate: 607.20, premium_mvl: 303.60, specific_bond_amount: 250000 },
      { year: 2025, range_min: 250001, range_max: 500000, premium_corporate: 862.50, premium_mvl: 431.25, specific_bond_amount: 500000 },
      { year: 2025, range_min: 500001, range_max: 1000000, premium_corporate: 1214.40, premium_mvl: 607.20, specific_bond_amount: 1000000 },
      { year: 2025, range_min: 1000001, range_max: 2000000, premium_corporate: 1782.50, premium_mvl: 891.25, specific_bond_amount: 2000000 },
      { year: 2025, range_min: 2000001, range_max: 3500000, premium_corporate: 2300.00, premium_mvl: 1150.00, specific_bond_amount: 3500000 },
      { year: 2025, range_min: 3500001, range_max: 5000000, premium_corporate: 3162.50, premium_mvl: 1581.25, specific_bond_amount: 5000000 },
      { year: 2025, range_min: 5000001, range_max: null, premium_corporate: 3680.00, premium_mvl: 1840.00, specific_bond_amount: 5000000 }
    ];

    try {
      await base44.entities.BondingRate.bulkCreate(rates2025);
      alert('Successfully populated 2025 bond rates');
      await loadRates();
    } catch (error) {
      console.error('Error populating 2025 data:', error);
      alert('Failed to populate 2025 data');
    }
  };

  const formatCurrency = (amount) => {
    return `£${amount?.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`;
  };

  // Filter rates for 2025 only
  const filteredRates = rates.filter(r => r.year === 2025).sort((a, b) => a.range_min - b.range_min);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Bonding Rates for 2025</CardTitle>
          <div className="flex gap-2">
            {filteredRates.length === 0 && (
              <Button onClick={handlePopulate2025Data} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Populate 2025 Data
              </Button>
            )}
            {/* The "Add Rate" button is removed */}
            {/* <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Rate
            </Button> */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* The Add New Bond Rate form is removed */}
        {/* {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Add New Bond Rate for 2025</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Range Min (£)</Label>
                <Input
                  type="number"
                  value={formData.range_min}
                  onChange={(e) => setFormData({ ...formData, range_min: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Range Max (£) - Leave empty for no limit</Label>
                <Input
                  type="number"
                  value={formData.range_max || ''}
                  onChange={(e) => setFormData({ ...formData, range_max: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="No upper limit"
                />
              </div>
              <div>
                <Label>Premium Corporate (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.premium_corporate}
                  onChange={(e) => setFormData({ ...formData, premium_corporate: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Premium MVL (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.premium_mvl}
                  onChange={(e) => setFormData({ ...formData, premium_mvl: parseFloat(e.target.value) })}
                />
              </div>
              <div>
                <Label>Specific Bond Amount (£)</Label>
                <Input
                  type="number"
                  value={formData.specific_bond_amount}
                  onChange={(e) => setFormData({ ...formData, specific_bond_amount: parseFloat(e.target.value) })}
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
        )} */}

        {filteredRates.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No bond rates configured for 2025</p>
            {/* The previous message "Click 'Add Rate' to create bond rate brackets for this year" is updated */}
            <p className="text-sm">Bond rates will appear here once data is populated</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Asset Range</TableHead>
                  <TableHead className="font-semibold text-right">Premium Corporate</TableHead>
                  <TableHead className="font-semibold text-right">Premium MVL</TableHead>
                  <TableHead className="font-semibold text-right">Specific Bond Amount</TableHead>
                  {/* The "Actions" TableHead is removed */}
                  {/* <TableHead className="font-semibold text-center">Actions</TableHead> */}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRates.map((rate) => (
                  <TableRow key={rate.id}>
                    {/* The conditional rendering for editing a row is removed */}
                    {/* {editingId === rate.id ? (
                      <EditRow rate={rate} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                    ) : ( */}
                      <>
                        <TableCell className="font-medium">
                          {formatCurrency(rate.range_min)} - {rate.range_max ? formatCurrency(rate.range_max) : 'and over'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(rate.premium_corporate)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(rate.premium_mvl)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(rate.specific_bond_amount)}</TableCell>
                        {/* The TableCell with action buttons is removed */}
                        {/* <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingId(rate.id)}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(rate.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell> */}
                      </>
                    {/* )} */}
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

// The EditRow component is kept as per instructions, although it is no longer used by BondRatesManager directly.
function EditRow({ rate, onSave, onCancel }) {
  const [editData, setEditData] = useState({ ...rate });

  return (
    <>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={editData.range_min}
            onChange={(e) => setEditData({ ...editData, range_min: parseFloat(e.target.value) })}
            className="h-8"
          />
          <span className="text-sm text-slate-500">to</span>
          <Input
            type="number"
            value={editData.range_max || ''}
            onChange={(e) => setEditData({ ...editData, range_max: e.target.value ? parseFloat(e.target.value) : null })}
            className="h-8"
            placeholder="No limit"
          />
        </div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={editData.premium_corporate}
          onChange={(e) => setEditData({ ...editData, premium_corporate: parseFloat(e.target.value) })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={editData.premium_mvl}
          onChange={(e) => setEditData({ ...editData, premium_mvl: parseFloat(e.target.value) })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={editData.specific_bond_amount}
          onChange={(e) => setEditData({ ...editData, specific_bond_amount: parseFloat(e.target.value) })}
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(rate.id, editData)}
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
