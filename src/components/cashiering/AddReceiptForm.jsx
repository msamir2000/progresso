import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, X, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import AccountCodeSearch from '../accounting/AccountCodeSearch';

export default function AddReceiptForm({ case_, onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    transaction_type: 'receipt',
    account_type: 'case_account',
    target_account: 'primary',
    reference: '',
    payee_name: '',
    date_of_invoice: '',
    invoice_number: '',
    net_amount: '',
    vat_amount: '',
    account_code: '',
    bank_remittance_url: null,
    vat_irrecoverable: false
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isUploadingRemittance, setIsUploadingRemittance] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // If VAT Irrecoverable is checked, set account code to VIRC
      if (field === 'vat_irrecoverable' && value === true) {
        updated.account_code = 'VIRC';
      }
      
      // If VAT Irrecoverable is unchecked, clear account code
      if (field === 'vat_irrecoverable' && value === false) {
        updated.account_code = '';
      }
      
      return updated;
    });
  };

  const handleRemittanceUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingRemittance(true);

    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed');
      }

      setFormData(prev => ({ ...prev, bank_remittance_url: uploadResult.file_url }));
    } catch (error) {
      console.error('Error uploading bank remittance:', error);
      setError('Failed to upload bank remittance. Please try again.');
    } finally {
      setIsUploadingRemittance(false);
      event.target.value = '';
    }
  };

  const handleRemoveRemittance = () => {
    setFormData(prev => ({ ...prev, bank_remittance_url: null }));
  };

  const triggerRemittanceUpload = () => {
    const fileInput = document.getElementById('bank-remittance-upload');
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.description || !formData.amount) {
      setError('Please fill in all required fields');
      return;
    }

    if (!currentUser?.signature_image_url) {
      setError('You need to upload your signature in Settings → User Management before posting transactions.');
      return;
    }

    setIsSaving(true);

    try {
      const transactionData = {
        case_id: case_.id,
        transaction_date: formData.transaction_date,
        description: formData.description,
        amount: parseFloat(formData.amount),
        transaction_type: formData.transaction_type,
        account_type: formData.account_type,
        target_account: formData.target_account,
        reference: formData.reference,
        payee_name: formData.payee_name,
        date_of_invoice: formData.date_of_invoice,
        invoice_number: formData.invoice_number,
        net_amount: formData.net_amount ? parseFloat(formData.net_amount) : null,
        vat_amount: formData.vat_amount ? parseFloat(formData.vat_amount) : null,
        account_code: formData.account_code,
        status: 'pending_approval',
        bank_remittance_url: formData.bank_remittance_url,
        signature_image_url: currentUser.signature_image_url,
        signed_by: currentUser.email,
        signed_date: new Date().toISOString(),
        office_holder_signature: currentUser.full_name,
        approver_grade: currentUser.grade
      };

      await base44.entities.Transaction.create(transactionData);

      if (onSuccess) {
        onSuccess();
      }

      // Reset form
      setFormData({
        transaction_date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        transaction_type: 'receipt',
        account_type: 'case_account',
        target_account: 'primary',
        reference: '',
        payee_name: '',
        date_of_invoice: '',
        invoice_number: '',
        net_amount: '',
        vat_amount: '',
        account_code: '',
        bank_remittance_url: null,
        vat_irrecoverable: false
      });

    } catch (error) {
      console.error('Error creating transaction:', error);
      setError('Failed to create transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Manual Transaction</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="transaction_type">Transaction Type *</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(value) => handleChange('transaction_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="transaction_date">Transaction Date *</Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date}
                onChange={(e) => handleChange('transaction_date', e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Enter transaction description"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payee_name">Payee Name</Label>
              <Input
                id="payee_name"
                value={formData.payee_name}
                onChange={(e) => handleChange('payee_name', e.target.value)}
                placeholder="Enter payee name"
              />
            </div>

            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => handleChange('reference', e.target.value)}
                placeholder="Enter reference"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="net_amount">Net Amount</Label>
              <Input
                id="net_amount"
                type="number"
                step="0.01"
                value={formData.net_amount}
                onChange={(e) => handleChange('net_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="vat_amount">VAT Amount</Label>
              <Input
                id="vat_amount"
                type="number"
                step="0.01"
                value={formData.vat_amount}
                onChange={(e) => handleChange('vat_amount', e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label htmlFor="amount">Gross Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date_of_invoice">Invoice Date</Label>
              <Input
                id="date_of_invoice"
                type="date"
                value={formData.date_of_invoice}
                onChange={(e) => handleChange('date_of_invoice', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => handleChange('invoice_number', e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>
          </div>

          {/* VAT Irrecoverable Checkbox - Only for Payments */}
          {formData.transaction_type === 'payment' && (
            <div className="flex items-center space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <input
                type="checkbox"
                id="vat_irrecoverable"
                checked={formData.vat_irrecoverable}
                onChange={(e) => handleChange('vat_irrecoverable', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <Label htmlFor="vat_irrecoverable" className="text-sm font-medium text-slate-800 cursor-pointer">
                VAT Irrecoverable
              </Label>
            </div>
          )}

          <div>
            <Label htmlFor="account_code">Account Code</Label>
            <AccountCodeSearch
              value={formData.account_code}
              onChange={(value) => handleChange('account_code', value)}
              disabled={formData.vat_irrecoverable}
            />
            {formData.vat_irrecoverable && (
              <p className="text-xs text-amber-600 mt-1">Account code automatically set to VIRC when VAT Irrecoverable is checked</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="account_type">Account Type</Label>
              <Select
                value={formData.account_type}
                onValueChange={(value) => handleChange('account_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="case_account">Case Account</SelectItem>
                  <SelectItem value="vat_control">VAT Control</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="target_account">Bank Account</Label>
              <Select
                value={formData.target_account}
                onValueChange={(value) => handleChange('target_account', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bank Remittance Upload Section */}
          <div>
            <Label htmlFor="bank_remittance">Bank Remittance</Label>
            <div className="mt-2">
              {formData.bank_remittance_url ? (
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <Upload className="w-3 h-3 mr-1" />
                    Remittance Attached
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(formData.bank_remittance_url, '_blank')}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:text-red-700"
                    onClick={handleRemoveRemittance}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={triggerRemittanceUpload}
                  disabled={isUploadingRemittance}
                >
                  {isUploadingRemittance ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Bank Remittance
                    </>
                  )}
                </Button>
              )}
              <Input
                id="bank-remittance-upload"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                onChange={handleRemittanceUpload}
                className="hidden"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Create Transaction'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}