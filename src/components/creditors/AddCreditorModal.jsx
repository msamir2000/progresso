
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
// Textarea is no longer needed for creditor_address, but keeping it as it might be used elsewhere or could be
// removed if confirmed as not used. For now, preserving existing imports unless specifically removed by outline.
// import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X } from 'lucide-react';
import { Creditor } from '@/api/entities';

export default function AddCreditorModal({ isOpen, onClose, caseId, onCreditorAdded }) {
  const [creditorData, setCreditorData] = useState({
    creditor_name: '',
    // creditor_address: '', // Removed as per outline, replaced by address components
    address_line_1: '', // New address field
    address_line_2: '', // New address field
    city: '', // New address field
    county: '', // New address field
    postcode: '', // New address field
    account_number: '', // Moved as per outline
    balance_owed: '',
    balance_submitted: '',
    date_submitted: '',
    date_admitted: '',
    creditor_type: 'unsecured',
    unsecured_creditor_type: '',
    moratorium_debt: 'N/A',
    contact_name: '',
    email_address: '',
    telephone_number: '',
    mobile_number: '',
    on_mail_hold: false,
    email_only: false,
    opted_out: false,
    date_of_opt_out: '',
    security_type: '',
    security_date_of_creation: '',
    security_date_of_registration: '',
    admitted_to_rank: '' // Changed to value input, so initialize as empty string for number
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(''); // New state for form errors

  const handleInputChange = (field, value) => {
    setCreditorData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setFormError(''); // Clear previous errors
    // Validate required fields, updated for new address structure
    if (!creditorData.creditor_name || !creditorData.address_line_1 || !creditorData.balance_owed) {
      setFormError('Please fill in required fields: Creditor Name, Address Line 1, and Balance Owed.');
      return;
    }

    setIsSaving(true);
    try {
      // Construct the full address string from individual fields for the backend
      const fullAddress = [
        creditorData.address_line_1,
        creditorData.address_line_2,
        creditorData.city,
        creditorData.county,
        creditorData.postcode
      ].filter(Boolean).join(', '); // Filter out empty strings and join with comma and space

      await Creditor.create({
        ...creditorData,
        creditor_address: fullAddress, // Send the constructed full address
        case_id: caseId,
        balance_owed: parseFloat(creditorData.balance_owed) || 0,
        balance_submitted: parseFloat(creditorData.balance_submitted) || 0,
        // Parse admitted_to_rank as a float
        admitted_to_rank: parseFloat(creditorData.admitted_to_rank) || 0 
      });
      
      onCreditorAdded();
      handleClose();
    } catch (error) {
      console.error('Failed to create creditor:', error);
      setFormError('Failed to create creditor. Please try again.'); // Set error for display
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setCreditorData({
      creditor_name: '',
      address_line_1: '', // Reset new address fields
      address_line_2: '',
      city: '',
      county: '',
      postcode: '',
      account_number: '', // Reset account number
      balance_owed: '',
      balance_submitted: '',
      date_submitted: '',
      date_admitted: '',
      creditor_type: 'unsecured',
      unsecured_creditor_type: '',
      moratorium_debt: 'N/A',
      contact_name: '',
      email_address: '',
      telephone_number: '',
      mobile_number: '',
      on_mail_hold: false,
      email_only: false,
      opted_out: false,
      date_of_opt_out: '',
      security_type: '',
      security_date_of_creation: '',
      security_date_of_registration: '',
      admitted_to_rank: '' // Reset new field to empty string
    });
    setFormError(''); // Clear error on close
    onClose();
  };

  const formatForInput = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-slate-900">
              Add New Creditor
            </DialogTitle>
            <p className="text-sm text-slate-600">
              Enter the creditor details below. All fields marked with * are required.
            </p>
          </div>
        </DialogHeader>

        <div className="mt-6">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Main Information - Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Left Column - Name and Address */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="creditor_name" className="text-sm font-medium text-slate-700">
                    Creditor Name *
                  </Label>
                  <Input
                    id="creditor_name"
                    value={creditorData.creditor_name}
                    onChange={(e) => handleInputChange('creditor_name', e.target.value)}
                    placeholder="Enter creditor name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-slate-700">
                    Creditor Address *
                  </Label>
                  <div className="mt-1 space-y-2">
                    <Input
                      placeholder="Address Line 1"
                      value={creditorData.address_line_1}
                      onChange={(e) => handleInputChange('address_line_1', e.target.value)}
                    />
                    <Input
                      placeholder="Address Line 2"
                      value={creditorData.address_line_2}
                      onChange={(e) => handleInputChange('address_line_2', e.target.value)}
                    />
                    <Input
                      placeholder="City"
                      value={creditorData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                    />
                    <Input
                      placeholder="County"
                      value={creditorData.county}
                      onChange={(e) => handleInputChange('county', e.target.value)}
                    />
                    <Input
                      placeholder="Postcode"
                      value={creditorData.postcode}
                      onChange={(e) => handleInputChange('postcode', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column - Creditor Types and Account Number */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="creditor_type" className="text-sm font-medium text-slate-700">
                    Creditor Type *
                  </Label>
                  <Select
                    value={creditorData.creditor_type}
                    onValueChange={(value) => handleInputChange('creditor_type', value)}
                  >
                    <SelectTrigger className="mt-1 bg-blue-50">
                      <SelectValue placeholder="Select creditor type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secured">Secured</SelectItem>
                      <SelectItem value="moratorium">Moratorium</SelectItem>
                      <SelectItem value="preferential">Preferential</SelectItem>
                      <SelectItem value="secondary_preferential">Secondary Preferential</SelectItem>
                      <SelectItem value="unsecured">Unsecured</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {creditorData.creditor_type === 'unsecured' && (
                  <div>
                    <Label htmlFor="unsecured_creditor_type" className="text-sm font-medium text-slate-700">
                      Unsecured Creditor Sub-Type
                    </Label>
                    <Select
                      value={creditorData.unsecured_creditor_type || ''}
                      onValueChange={(value) => handleInputChange('unsecured_creditor_type', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select sub-type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trade_expense">Trade Expense</SelectItem>
                        <SelectItem value="customers_deposits">Customer Deposits</SelectItem>
                        <SelectItem value="utilities">Utilities</SelectItem>
                        <SelectItem value="bank">Bank</SelectItem>
                        <SelectItem value="landlord">Landlord</SelectItem>
                        <SelectItem value="connected_parties">Connected Parties</SelectItem>
                        <SelectItem value="contingent_liabilities">Contingent Liabilities</SelectItem>
                        <SelectItem value="lender">Lender</SelectItem>
                        <SelectItem value="finance_company">Finance Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Account Number - Moved here below unsecured creditor sub-type */}
                <div>
                  <Label htmlFor="account_number" className="text-sm font-medium text-slate-700">
                    Account Number
                  </Label>
                  <Input
                    id="account_number"
                    value={creditorData.account_number}
                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                    placeholder="Enter account number"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Financial Information - Balance Fields */}
            <div className="border-t pt-4">
              <h4 className="text-md font-semibold text-slate-700 mb-3">Financial Information</h4>
              
              {/* Balance Owed - Full Width */}
              <div className="mb-4">
                <Label htmlFor="balance_owed" className="text-sm font-medium text-slate-700">
                  Balance Owed (£) *
                </Label>
                <Input
                  id="balance_owed"
                  type="number"
                  step="0.01"
                  value={creditorData.balance_owed}
                  onChange={(e) => handleInputChange('balance_owed', e.target.value)}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>

              {/* Balance Submitted and Date Submitted */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label htmlFor="balance_submitted" className="text-sm font-medium text-slate-700">
                    Balance Submitted (£)
                  </Label>
                  <Input
                    id="balance_submitted"
                    type="number"
                    step="0.01"
                    value={creditorData.balance_submitted}
                    onChange={(e) => handleInputChange('balance_submitted', e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="date_submitted" className="text-sm font-medium text-slate-700">
                    Date Submitted
                  </Label>
                  <Input
                    id="date_submitted"
                    type="date"
                    value={formatForInput(creditorData.date_submitted)}
                    onChange={(e) => handleInputChange('date_submitted', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Admitted to Rank and Date Admitted */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="admitted_to_rank" className="text-sm font-medium text-slate-700">
                    Admitted to Rank (£)
                  </Label>
                  <Input
                    id="admitted_to_rank"
                    type="number"
                    step="0.01"
                    value={creditorData.admitted_to_rank}
                    onChange={(e) => handleInputChange('admitted_to_rank', e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="date_admitted" className="text-sm font-medium text-slate-700">
                    Date Admitted
                  </Label>
                  <Input
                    id="date_admitted"
                    type="date"
                    value={formatForInput(creditorData.date_admitted)}
                    onChange={(e) => handleInputChange('date_admitted', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>


            {/* Contact Information */}
            <div className="border-t pt-4 mt-6">
              <h4 className="text-md font-semibold text-slate-700 mb-3">Contact Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contact_name" className="text-sm font-medium text-slate-700">
                    Contact Name
                  </Label>
                  <Input
                    id="contact_name"
                    value={creditorData.contact_name}
                    onChange={(e) => handleInputChange('contact_name', e.target.value)}
                    placeholder="Enter contact name"
                    className="mt-1 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="email_address" className="text-sm font-medium text-slate-700">
                    Email Address
                  </Label>
                  <Input
                    id="email_address"
                    type="email"
                    value={creditorData.email_address}
                    onChange={(e) => handleInputChange('email_address', e.target.value)}
                    placeholder="Enter email address"
                    className="mt-1 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="telephone_number" className="text-sm font-medium text-slate-700">
                    Telephone Number
                  </Label>
                  <Input
                    id="telephone_number"
                    type="tel"
                    value={creditorData.telephone_number}
                    onChange={(e) => handleInputChange('telephone_number', e.target.value)}
                    placeholder="Enter telephone number"
                    className="mt-1 h-10 flex items-center"
                  />
                </div>

                <div>
                  <Label htmlFor="mobile_number" className="text-sm font-medium text-slate-700">
                    Mobile Number
                  </Label>
                  <Input
                    id="mobile_number"
                    type="tel"
                    value={creditorData.mobile_number}
                    onChange={(e) => handleInputChange('mobile_number', e.target.value)}
                    placeholder="Enter mobile number"
                    className="mt-1 h-10 flex items-center"
                  />
                </div>
              </div>
            </div>

            {/* Security Details (conditional for secured creditor type) */}
            {creditorData.creditor_type === 'secured' && (
              <div className="border-t pt-6 space-y-4">
                <h3 className="text-lg font-semibold text-slate-800">Security Details</h3>
                <div className="space-y-2">
                  <Label htmlFor="security_type" className="text-sm font-medium text-slate-700">
                    Security Type
                  </Label>
                  <Select 
                    value={creditorData.security_type} 
                    onValueChange={(value) => handleInputChange('security_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select security type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Debenture">Debenture</SelectItem>
                      <SelectItem value="Fixed & Floating Charge">Fixed & Floating Charge</SelectItem>
                      <SelectItem value="Fixed Charge">Fixed Charge</SelectItem>
                      <SelectItem value="Rent Deposit Deed">Rent Deposit Deed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="security_date_of_creation" className="text-sm font-medium text-slate-700">
                      Security Creation Date
                    </Label>
                    <Input
                      id="security_date_of_creation"
                      type="date"
                      value={formatForInput(creditorData.security_date_of_creation)}
                      onChange={(e) => handleInputChange('security_date_of_creation', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security_date_of_registration" className="text-sm font-medium text-slate-700">
                      Security Registration Date
                    </Label>
                    <Input
                      id="security_date_of_registration"
                      type="date"
                      value={formatForInput(creditorData.security_date_of_registration)}
                      onChange={(e) => handleInputChange('security_date_of_registration', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Moratorium Debt and Communication Preferences Side by Side */}
            <div className="border-t pt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Moratorium Debt */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Moratorium Debt</h3>
                <div className="space-y-2 mt-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="moratorium_na"
                      name="moratorium_debt"
                      value="N/A"
                      checked={creditorData.moratorium_debt === 'N/A'}
                      onChange={(e) => handleInputChange('moratorium_debt', e.target.value)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <Label htmlFor="moratorium_na" className="text-sm text-slate-600 cursor-pointer">
                      N/A
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="moratorium_pre"
                      name="moratorium_debt"
                      value="Pre Moratorium"
                      checked={creditorData.moratorium_debt === 'Pre Moratorium'}
                      onChange={(e) => handleInputChange('moratorium_debt', e.target.value)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <Label htmlFor="moratorium_pre" className="text-sm text-slate-600 cursor-pointer">
                      Pre Moratorium
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id="moratorium_post"
                      name="moratorium_debt"
                      value="Post Moratorium Debt"
                      checked={creditorData.moratorium_debt === 'Post Moratorium Debt'}
                      onChange={(e) => handleInputChange('moratorium_debt', e.target.value)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 focus:ring-2"
                    />
                    <Label htmlFor="moratorium_post" className="text-sm text-slate-600 cursor-pointer">
                      Post Moratorium Debt
                    </Label>
                  </div>
                </div>
              </div>

              {/* Right Column - Communications Preferences */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Communication Preferences</h3>
                <div className="space-y-3 mt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="on_mail_hold"
                      checked={creditorData.on_mail_hold}
                      onCheckedChange={(checked) => handleInputChange('on_mail_hold', checked)}
                    />
                    <Label htmlFor="on_mail_hold" className="text-sm text-slate-600 cursor-pointer">On mail hold</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="email_only"
                      checked={creditorData.email_only}
                      onCheckedChange={(checked) => handleInputChange('email_only', checked)}
                    />
                    <Label htmlFor="email_only" className="text-sm text-slate-600 cursor-pointer">Email only communication</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="opted_out"
                      checked={creditorData.opted_out}
                      onCheckedChange={(checked) => handleInputChange('opted_out', checked)}
                    />
                    <Label htmlFor="opted_out" className="text-sm text-slate-600 cursor-pointer">Opted out of communications</Label>
                  </div>

                  {creditorData.opted_out && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="date_of_opt_out" className="text-sm font-medium text-slate-700">
                        Date of Opt Out
                      </Label>
                      <Input
                        id="date_of_opt_out"
                        type="date"
                        value={formatForInput(creditorData.date_of_opt_out)}
                        onChange={(e) => handleInputChange('date_of_opt_out', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose} disabled={isSaving}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isSaving ? 'Saving...' : 'Save Creditor'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
