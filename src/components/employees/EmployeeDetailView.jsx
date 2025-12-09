import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Employee } from '@/api/entities';
import { Creditor } from '@/api/entities';
import { Case } from '@/api/entities'; // Added Case import
import { ArrowLeft, Save, Edit, Loader2, XCircle, PoundSterling, CheckCircle, Trash2, Plus, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { calculateEmployeeClaims } from './claimsCalculator';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { base44 } from '@/api/base44Client';

export default function EmployeeDetailView({ employee, onBack, onUpdate }) {
  const [employeeData, setEmployeeData] = useState(employee);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('personal');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (employee) {
      setEmployeeData(employee);
    }
  }, [employee]);

  const handleInputChange = (field, value) => {
    setEmployeeData(prev => {
      const newData = { ...prev };
      const fields = field.split('.');
      
      let current = newData;
      for (let i = 0; i < fields.length - 1; i++) {
        if (!current[fields[i]]) {
          current[fields[i]] = {};
        }
        current = current[fields[i]];
      }
      
      current[fields[fields.length - 1]] = value;
      return newData;
    });
  };

  const updateRP14aData = async () => {
    try {
      // Fetch the case to get existing RP14a data
      const cases = await Case.list();
      const currentCase = cases.find(c => c.id === employeeData.case_id);
      
      if (!currentCase) return;
      
      // Parse existing RP14a data or initialize empty object
      let rp14aData = {};
      try {
        rp14aData = currentCase.rp14a_data ? JSON.parse(currentCase.rp14a_data) : {};
      } catch (e) {
        console.warn("Failed to parse existing RP14a data, initializing empty object.", e);
        rp14aData = {};
      }
      
      // Initialize employees array if it doesn't exist
      if (!rp14aData.employees) {
        rp14aData.employees = [];
      }
      
      // Find or create employee entry in RP14a data
      let employeeRP14aIndex = rp14aData.employees.findIndex(
        emp => emp.employee_id === employeeData.id
      );
      
      const newEmployeeRP14aEntry = {
        employee_id: employeeData.id,
        full_name: `${employeeData.title ? employeeData.title + ' ' : ''}${employeeData.first_name} ${employeeData.last_name}`.trim(),
        date_of_birth: employeeData.date_of_birth,
        end_date: employeeData.end_date,
        national_insurance_number: employeeData.national_insurance_number,
        ni_class: employeeData.ni_class,
        average_weekly_pay_52_weeks: employeeData.average_weekly_pay_52_weeks // Column 22f
      };

      if (employeeRP14aIndex === -1) {
        // Create new entry
        rp14aData.employees.push(newEmployeeRP14aEntry);
      } else {
        // Update existing entry, preserving other RP14a specific data if any
        rp14aData.employees[employeeRP14aIndex] = {
          ...rp14aData.employees[employeeRP14aIndex], // Preserve existing fields
          ...newEmployeeRP14aEntry // Override with new data
        };
      }
      
      // Save updated RP14a data back to case
      await Case.update(currentCase.id, {
        rp14a_data: JSON.stringify(rp14aData)
      });
    } catch (error) {
      console.error('Failed to update RP14a data:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Employee.update(employeeData.id, employeeData);
      
      // Update RP14a data in the case when key employee details change
      await updateRP14aData();
      
      if (onUpdate) {
        await onUpdate();
      }
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save employee:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEmployeeData(employee);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    try {
      await Employee.delete(employeeData.id);
      if (onUpdate) {
        await onUpdate();
      }
      onBack();
    } catch (error) {
      console.error('Failed to delete employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  const handleRecalculate = async () => {
    try {
      // Calculate claims using the calculator (await since it's async)
      const claims = await calculateEmployeeClaims(employeeData);
      const updatedData = { ...employeeData, ...claims };
      setEmployeeData(updatedData);
      
      // Save the calculated claims to the database
      await Employee.update(employeeData.id, updatedData);
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Failed to update employee claims:', error);
    }
  };

  const handleUpdateCreditors = async () => {
    try {
      const creditors = await Creditor.filter({ case_id: employeeData.case_id });
      
      const residualCreditorName = `${employeeData.first_name} ${employeeData.last_name} (Residual Claim)`;
      const rpsCreditorName = "Redundancy Payments Service";
      
      const residualCreditor = creditors.find(c => c.creditor_name === residualCreditorName);
      const residualAmount = (employeeData.total_preferential_claim || 0) + (employeeData.total_unsecured_claim || 0);

      if (residualCreditor) {
        await Creditor.update(residualCreditor.id, {
          balance_owed: residualAmount,
          creditor_type: 'preferential'
        });
      } else if (residualAmount > 0) {
        await Creditor.create({
          case_id: employeeData.case_id,
          creditor_name: residualCreditorName,
          creditor_address: employeeData.address ? 
            [employeeData.address.line1, employeeData.address.line2, employeeData.address.city, employeeData.address.county, employeeData.address.postcode].filter(Boolean).join('\n') 
            : '',
          balance_owed: residualAmount,
          creditor_type: 'preferential'
        });
      }
      
      const rpsAmount = 
        (employeeData.rps_wage_arrears_processed || 0) +
        (employeeData.rps_holiday_pay_processed || 0) +
        (employeeData.rps_notice_pay_processed || 0) +
        (employeeData.rps_redundancy_pay_processed || 0) +
        (employeeData.rps_pension_contributions_processed || 0);

      const rpsCreditor = creditors.find(c => c.creditor_name === rpsCreditorName);

      if (rpsCreditor) {
        await Creditor.update(rpsCreditor.id, {
          balance_owed: rpsAmount,
          creditor_type: 'preferential'
        });
      } else if (rpsAmount > 0) {
        await Creditor.create({
          case_id: employeeData.case_id,
          creditor_name: rpsCreditorName,
          creditor_address: 'Redundancy Payments Service\nInsolvency Service\nPO Box 203\nBirmingham\nB1 1HT',
          balance_owed: rpsAmount,
          creditor_type: 'preferential'
        });
      }
      
      if (onUpdate) {
        await onUpdate();
      }
    } catch (error) {
      console.error('Failed to update creditors:', error);
    }
  };

  if (!employeeData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '£0.00';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value);
  };

  const DetailField = ({ label, value, field, type = 'text' }) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {isEditing ? (
        <Input
          type={type}
          value={value || ''}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className="h-9"
        />
      ) : (
        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
          <p className="text-sm font-medium text-slate-800">
            {type === 'date' ? formatDate(value) : (value || '—')}
          </p>
        </div>
      )}
    </div>
  );

  const CurrencyField = ({ label, value, field }) => (
    <div className="space-y-1">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      {isEditing ? (
        <Input
          type="number"
          step="0.01"
          value={value || ''}
          onChange={(e) => handleInputChange(field, parseFloat(e.target.value) || 0)}
          className="h-9"
        />
      ) : (
        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
          <p className="text-sm font-medium text-slate-800">{formatCurrency(value)}</p>
        </div>
      )}
    </div>
  );

  const niClassOptions = [
    { value: 'A', label: 'Class A - Standard rate' },
    { value: 'B', label: 'Class B - Married women/widows (reduced rate)' },
    { value: 'C', label: 'Class C - Over state pension age' },
    { value: 'H', label: 'Class H - Apprentices under 25' },
    { value: 'J', label: 'Class J - Deferment granted' },
    { value: 'M', label: 'Class M - Under 21' },
    { value: 'Z', label: 'Class Z - Under 21 (deferment)' },
  ];

  const getNiClassLabel = (value) => {
    const option = niClassOptions.find(opt => opt.value === value);
    return option ? option.label : '—';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between py-3 px-6 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Employees
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">
              {employeeData.title ? `${employeeData.title} ` : ''}{employeeData.first_name} {employeeData.last_name}
            </h2>
            <div className="flex items-center gap-2 ml-20">
              <span className="text-sm text-slate-600">RPS Status:</span>
              {isEditing ? (
                <Select value={employeeData.rps_claim_status || 'to_submit'} onValueChange={(value) => handleInputChange('rps_claim_status', value)}>
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="to_submit">To Submit</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={employeeData.rps_claim_status === 'submitted' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                  {employeeData.rps_claim_status === 'submitted' ? 'Submitted' : 'To Submit'}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Details
              </Button>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 flex-shrink-0 border-r bg-slate-50 p-4">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveSection('personal')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'personal' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Personal Info
            </button>
            <button
              onClick={() => setActiveSection('employment')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'employment' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Employment Details
            </button>
            <button
              onClick={() => setActiveSection('weekly_pay')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'weekly_pay' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Calculate Weekly Pay
            </button>
            <button
              onClick={() => setActiveSection('claims')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'claims' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              Claims Breakdown
            </button>
            <button
              onClick={() => setActiveSection('rps')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeSection === 'rps' ? 'bg-blue-100 text-blue-700' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              RPS Details
            </button>
          </nav>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {activeSection === 'personal' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-blue-800">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">Title</Label>
                      {isEditing ? (
                        <Select value={employeeData.title || ''} onValueChange={(value) => handleInputChange('title', value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Mr">Mr</SelectItem>
                            <SelectItem value="Mrs">Mrs</SelectItem>
                            <SelectItem value="Miss">Miss</SelectItem>
                            <SelectItem value="Ms">Ms</SelectItem>
                            <SelectItem value="Dr">Dr</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-sm font-medium text-slate-800">{employeeData.title || '—'}</p>
                        </div>
                      )}
                    </div>
                    <DetailField label="First Name" value={employeeData.first_name} field="first_name" />
                    <DetailField label="Last Name" value={employeeData.last_name} field="last_name" />
                    <DetailField label="Email" value={employeeData.email_address} field="email_address" type="email" />
                    <DetailField label="Phone Number" value={employeeData.phone_number} field="phone_number" type="tel" />
                    <DetailField label="Date of Birth" value={employeeData.date_of_birth} field="date_of_birth" type="date" />
                  </div>
                  
                  {/* National Insurance Number and NI Class */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <DetailField label="National Insurance Number" value={employeeData.national_insurance_number} field="national_insurance_number" />
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">NI Class</Label>
                      {isEditing ? (
                        <Select
                          value={employeeData.ni_class || ''}
                          onValueChange={(value) => handleInputChange('ni_class', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select NI Class" />
                          </SelectTrigger>
                          <SelectContent>
                            {niClassOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-sm font-medium text-slate-800">
                            {getNiClassLabel(employeeData.ni_class)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <DetailField label="Address Line 1" value={employeeData.address?.line1} field="address.line1" />
                    <DetailField label="Address Line 2" value={employeeData.address?.line2} field="address.line2" />
                    <DetailField label="City" value={employeeData.address?.city} field="address.city" />
                    <DetailField label="County" value={employeeData.address?.county} field="address.county" />
                    <DetailField label="Postcode" value={employeeData.address?.postcode} field="address.postcode" />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'employment' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-blue-800">Employment Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <DetailField label="Start Date" value={employeeData.start_date} field="start_date" type="date" />
                    <DetailField label="End Date" value={employeeData.end_date} field="end_date" type="date" />
                    <DetailField label="Date Last Paid" value={employeeData.date_last_paid} field="date_last_paid" type="date" />
                    <CurrencyField label="Yearly Salary" value={employeeData.yearly_salary} field="yearly_salary" />
                    <DetailField label="Work Days Per Week" value={employeeData.work_days_per_week} field="work_days_per_week" type="number" />
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">Pay Type</Label>
                      {isEditing ? (
                        <Select value={employeeData.pay_type || 'salaried'} onValueChange={(value) => handleInputChange('pay_type', value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="salaried">Salaried</SelectItem>
                            <SelectItem value="variable">Variable Pay</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-sm font-medium text-slate-800 capitalize">
                            {employeeData.pay_type === 'variable' ? 'Variable Pay' : 'Salaried'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">Claim Type</Label>
                      {isEditing ? (
                        <Select value={employeeData.claim_type || 'statutory'} onValueChange={(value) => handleInputChange('claim_type', value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contractual">Contractual Claim</SelectItem>
                            <SelectItem value="statutory">Statutory Claim</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-sm font-medium text-slate-800 capitalize">
                            {employeeData.claim_type === 'contractual' ? 'Contractual Claim' : 'Statutory Claim'}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className={`space-y-1 ${employeeData.claim_type === 'contractual' ? 'border-2 border-blue-400 rounded-lg p-2 bg-blue-50' : ''}`}>
                      <Label className={`text-sm font-medium ${employeeData.claim_type === 'statutory' ? 'text-slate-400' : 'text-slate-700'}`}>Contractual Notice Period (Months)</Label>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={employeeData.contractual_notice_period || ''}
                          onChange={(e) => handleInputChange('contractual_notice_period', parseFloat(e.target.value) || 0)}
                          className="h-9"
                          disabled={employeeData.claim_type === 'statutory'}
                        />
                      ) : (
                        <div className={`h-9 flex items-center px-3 border border-slate-200 rounded-md ${employeeData.claim_type === 'statutory' ? 'bg-slate-100' : 'bg-slate-50'}`}>
                          <p className={`text-sm font-medium ${employeeData.claim_type === 'statutory' ? 'text-slate-400' : 'text-slate-800'}`}>
                            {employeeData.contractual_notice_period || '—'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">12 Weekly Average Pay</Label>
                      <Input
                        type="text"
                        value={`£${(employeeData.average_weekly_pay_12_weeks || 0).toFixed(2)}`}
                        readOnly
                        className="bg-green-50 border-green-200"
                      />
                      <p className="text-xs text-slate-500 mt-1">Calculated from payroll data</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">52 Week Average Pay</Label>
                      <Input
                        type="text"
                        value={`£${(employeeData.average_weekly_pay_52_weeks || 0).toFixed(2)}`}
                        readOnly
                        className="bg-green-50 border-green-200"
                      />
                      <p className="text-xs text-slate-500 mt-1">Calculated from payroll data</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <DetailField label="Holiday Year Start Date" value={employeeData.holiday_year_start_date} field="holiday_year_start_date" type="date" />
                    <DetailField label="Holiday Entitlement (Days)" value={employeeData.holiday_entitlement} field="holiday_entitlement" type="number" />
                    <DetailField label="Days Taken" value={employeeData.days_taken} field="days_taken" type="number" />
                    <DetailField label="Days Carried Forward" value={employeeData.days_carried_forward} field="days_carried_forward" type="number" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium text-slate-700">Pension Opted In</Label>
                      {isEditing ? (
                        <Select value={employeeData.pension_opted_in || 'yes'} onValueChange={(value) => handleInputChange('pension_opted_in', value)}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-9 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-sm font-medium text-slate-800">
                            {employeeData.pension_opted_in === 'yes' ? 'Yes' : (employeeData.pension_opted_in === 'no' ? 'No' : '—')}
                          </p>
                        </div>
                      )}
                    </div>
                    <DetailField label="Employer Pension %" value={employeeData.employer_pension_percent} field="employer_pension_percent" type="number" />
                    <DetailField label="Employee Pension %" value={employeeData.employee_pension_percent} field="employee_pension_percent" type="number" />
                    <DetailField label="Date Contributions Last Paid" value={employeeData.date_contributions_last_paid} field="date_contributions_last_paid" type="date" />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'weekly_pay' && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-blue-800">Calculate Average Weekly Pay</CardTitle>
                      <p className="text-xs text-slate-600 mt-0.5">Enter weekly or monthly payroll data to calculate average weekly pay</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex items-start gap-2 max-w-3xl">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-blue-900 text-sm mb-0.5">How to use this calculator</h4>
                        <p className="text-sm text-blue-800 leading-tight">
                          Enter payroll data for the employee and click "Save Data" to automatically compute the 12-week and 52-week averages. These values will be saved to the employee record and used in RPS claims calculations.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-xs font-semibold text-blue-800">12 Week Average</h3>
                        <PoundSterling className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex items-baseline gap-4 justify-between">
                        <div className="text-2xl font-bold text-blue-900">
                          £{(employeeData.average_weekly_pay_12_weeks || 0).toFixed(2)}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-blue-700">
                            Based on {(() => {
                              const payrollData = employeeData.payroll_data || [];
                              const weeksWithPay = payrollData.filter(w => parseFloat(w.pay_amount || 0) > 0).length;
                              return Math.min(weeksWithPay, 12);
                            })()} weeks with pay
                          </p>
                          <p className="text-xs text-blue-600">
                            Total pay: £{(() => {
                              const payrollData = employeeData.payroll_data || [];
                              const last12 = payrollData.slice(0, 12);
                              return last12.reduce((sum, w) => sum + parseFloat(w.pay_amount || 0), 0).toFixed(2);
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="text-xs font-semibold text-green-800">52 Week Average</h3>
                        <PoundSterling className="w-3.5 h-3.5 text-green-600" />
                      </div>
                      <div className="flex items-baseline gap-4 justify-between">
                        <div className="text-2xl font-bold text-green-900">
                          £{(employeeData.average_weekly_pay_52_weeks || 0).toFixed(2)}
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-green-700">
                            Based on {(() => {
                              const payrollData = employeeData.payroll_data || [];
                              const weeksWithPay = payrollData.filter(w => parseFloat(w.pay_amount || 0) > 0).length;
                              return Math.min(weeksWithPay, 52);
                            })()} weeks with pay
                          </p>
                          <p className="text-xs text-green-600">
                            Total pay: £{(() => {
                              const payrollData = employeeData.payroll_data || [];
                              return payrollData.reduce((sum, w) => sum + parseFloat(w.pay_amount || 0), 0).toFixed(2);
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {employeeData.pay_type === 'salaried' ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-700">Monthly Payroll Data (Last 12 months)</h3>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const payrollData = employeeData.payroll_data || [];
                            const monthsWithPay = payrollData.filter(m => {
                              const basePay = parseFloat(m.pay_amount || 0);
                              const bonus = parseFloat(m.bonus_commission || 0);
                              return (basePay + bonus) > 0;
                            });
                            
                            const totalPay = monthsWithPay.reduce((sum, m) => {
                              const basePay = parseFloat(m.pay_amount || 0);
                              const bonus = parseFloat(m.bonus_commission || 0);
                              return sum + basePay + bonus;
                            }, 0);
                            
                            const monthlyAvg = monthsWithPay.length > 0 ? totalPay / monthsWithPay.length : 0;
                            const weeklyAvg12 = monthlyAvg / 4.33;
                            const weeklyAvg52 = monthlyAvg / 4.33;
                            
                            await base44.entities.Employee.update(employeeData.id, {
                              payroll_data: payrollData,
                              average_weekly_pay_12_weeks: weeklyAvg12,
                              average_weekly_pay_52_weeks: weeklyAvg52
                            });
                            
                            setEmployeeData(prev => ({
                              ...prev,
                              average_weekly_pay_12_weeks: weeklyAvg12,
                              average_weekly_pay_52_weeks: weeklyAvg52
                            }));
                            
                            if (onUpdate) await onUpdate();
                          }}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save Data
                        </Button>
                      </div>

                      <div className="border rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-slate-50 z-10">
                              <TableRow>
                                <TableHead>Month</TableHead>
                                <TableHead>Base Pay (£)</TableHead>
                                <TableHead>Bonus/Commission (£)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const months = [
                                  'December 2024', 'January 2025', 'February 2025', 'March 2025',
                                  'April 2025', 'May 2025', 'June 2025', 'July 2025',
                                  'August 2025', 'September 2025', 'October 2025', 'November 2025'
                                ];
                                const payrollData = employeeData.payroll_data || [];
                                
                                return months.map((monthName, index) => {
                                  const monthData = payrollData.find(m => m.month_name === monthName) || {};
                                  
                                  return (
                                    <TableRow key={index}>
                                      <TableCell className="font-medium">{monthName}</TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={monthData.pay_amount || ''}
                                          onChange={(e) => {
                                            const newPayrollData = [...(employeeData.payroll_data || [])];
                                            const existingIndex = newPayrollData.findIndex(m => m.month_name === monthName);
                                            
                                            const updatedMonth = {
                                              month: index + 1,
                                              month_name: monthName,
                                              pay_amount: e.target.value,
                                              bonus_commission: monthData.bonus_commission || '0.00'
                                            };
                                            
                                            if (existingIndex >= 0) {
                                              newPayrollData[existingIndex] = updatedMonth;
                                            } else {
                                              newPayrollData.push(updatedMonth);
                                            }
                                            
                                            setEmployeeData(prev => ({ ...prev, payroll_data: newPayrollData }));
                                          }}
                                          className="h-8"
                                          placeholder="0.00"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={monthData.bonus_commission || ''}
                                          onChange={(e) => {
                                            const newPayrollData = [...(employeeData.payroll_data || [])];
                                            const existingIndex = newPayrollData.findIndex(m => m.month_name === monthName);
                                            
                                            const updatedMonth = {
                                              month: index + 1,
                                              month_name: monthName,
                                              pay_amount: monthData.pay_amount || '0.00',
                                              bonus_commission: e.target.value
                                            };
                                            
                                            if (existingIndex >= 0) {
                                              newPayrollData[existingIndex] = updatedMonth;
                                            } else {
                                              newPayrollData.push(updatedMonth);
                                            }
                                            
                                            setEmployeeData(prev => ({ ...prev, payroll_data: newPayrollData }));
                                          }}
                                          className="h-8"
                                          placeholder="0.00"
                                        />
                                      </TableCell>
                                    </TableRow>
                                  );
                                });
                              })()}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        * Enter monthly gross pay amounts, including any bonuses or commissions. Months with no pay (£0.00 or empty) are excluded from average calculations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-slate-700">Weekly Payroll Data (Most recent weeks first)</h3>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const payrollData = employeeData.payroll_data || [];
                            const weeksWithPay = payrollData.filter(w => parseFloat(w.pay_amount || 0) > 0);

                            const last12 = weeksWithPay.slice(0, 12);
                            const total12 = last12.reduce((sum, w) => sum + parseFloat(w.pay_amount || 0), 0);
                            const avg12 = last12.length > 0 ? total12 / 12 : 0;

                            const total52 = weeksWithPay.reduce((sum, w) => sum + parseFloat(w.pay_amount || 0), 0);
                            const avg52 = weeksWithPay.length > 0 ? total52 / Math.min(weeksWithPay.length, 52) : 0;

                            await base44.entities.Employee.update(employeeData.id, {
                              payroll_data: payrollData,
                              average_weekly_pay_12_weeks: avg12,
                              average_weekly_pay_52_weeks: avg52
                            });

                            setEmployeeData(prev => ({
                              ...prev,
                              average_weekly_pay_12_weeks: avg12,
                              average_weekly_pay_52_weeks: avg52
                            }));

                            if (onUpdate) await onUpdate();
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          Save Data
                        </Button>
                      </div>

                      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="max-h-96 overflow-y-auto">
                          <Table>
                            <TableHeader className="sticky top-0 bg-slate-100 z-10 border-b">
                              <TableRow>
                                <TableHead className="w-24 font-semibold text-slate-700 py-2 text-sm">Week</TableHead>
                                <TableHead className="font-semibold text-slate-700 py-2 text-sm">Pay Amount (£)</TableHead>
                                <TableHead className="w-24 text-center font-semibold text-slate-700 py-2 text-sm">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(() => {
                                const payrollData = employeeData.payroll_data || [];
                                const weeks = Array.from({ length: 52 }, (_, i) => 52 - i);

                                return weeks.map((weekNum) => {
                                  const weekData = payrollData.find(w => w.week === weekNum) || {};

                                  return (
                                    <TableRow key={weekNum} className="hover:bg-slate-50 border-b border-slate-100">
                                      <TableCell className="font-semibold text-slate-700 py-1.5 text-sm">{weekNum}</TableCell>
                                      <TableCell className="py-1.5">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={weekData.pay_amount || ''}
                                          onChange={(e) => {
                                            const newPayrollData = [...(employeeData.payroll_data || [])];
                                            const existingIndex = newPayrollData.findIndex(w => w.week === weekNum);

                                            const updatedWeek = {
                                              week: weekNum,
                                              pay_amount: e.target.value
                                            };

                                            if (existingIndex >= 0) {
                                              newPayrollData[existingIndex] = updatedWeek;
                                            } else {
                                              newPayrollData.push(updatedWeek);
                                            }

                                            setEmployeeData(prev => ({ ...prev, payroll_data: newPayrollData }));
                                          }}
                                          className="h-7 text-sm border-0 shadow-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                          placeholder="0.00"
                                        />
                                      </TableCell>
                                      <TableCell className="text-center py-1.5">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            const newPayrollData = (employeeData.payroll_data || []).filter(w => w.week !== weekNum);
                                            setEmployeeData(prev => ({ ...prev, payroll_data: newPayrollData }));
                                          }}
                                          className="text-red-500 hover:text-red-600 hover:bg-red-50 h-6 w-6 p-0"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                });
                              })()}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        * Enter weekly gross pay amounts. Weeks with no pay (£0.00 or empty) are excluded from average calculations.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === 'claims' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-blue-800">Claims Breakdown</CardTitle>
                  <Button onClick={handleRecalculate} size="sm" variant="outline" className="text-blue-600 border-blue-200">
                    <PoundSterling className="w-4 h-4 mr-2" />
                    Recalculate Claims
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Claim Type</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700 bg-red-50">Preferential Claim</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700 bg-red-50">Unsecured Claim</TableHead>
                        <TableHead className="text-right font-semibold text-slate-700">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">Wage Arrears Claim</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.wage_arrears_preferential || 0)}</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.wage_arrears_unsecured || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency((employeeData.wage_arrears_preferential || 0) + (employeeData.wage_arrears_unsecured || 0))}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">Holiday Pay Claim</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.holiday_pay_preferential || 0)}</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.holiday_pay_unsecured || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency((employeeData.holiday_pay_preferential || 0) + (employeeData.holiday_pay_unsecured || 0))}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">Notice Pay Claim</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.notice_pay_preferential || 0)}</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.notice_pay_unsecured || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency((employeeData.notice_pay_preferential || 0) + (employeeData.notice_pay_unsecured || 0))}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">Redundancy Pay Claim</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">—</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.redundancy_pay_unsecured || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency(employeeData.redundancy_pay_unsecured || 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">Pension Contributions Claim</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.pension_contributions_preferential || 0)}</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">{formatCurrency(employeeData.pension_contributions_unsecured || 0)}</TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency((employeeData.pension_contributions_preferential || 0) + (employeeData.pension_contributions_unsecured || 0))}
                        </TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-800">
                          {isEditing ? (
                            <Input
                              type="text"
                              value={employeeData.other_claim_title || 'Other'}
                              onChange={(e) => handleInputChange('other_claim_title', e.target.value)}
                              className="h-8 w-48"
                              placeholder="Enter claim title"
                            />
                          ) : (
                            employeeData.other_claim_title || 'Other'
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">—</TableCell>
                        <TableCell className="text-right text-slate-800 bg-red-50">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              value={employeeData.other_unsecured || 0}
                              onChange={(e) => {
                                const newOtherUnsecured = parseFloat(e.target.value) || 0;
                                setEmployeeData(prev => {
                                  const updatedEmployee = { ...prev, other_unsecured: newOtherUnsecured };
                                  // Recalculate total unsecured claim based on the updated 'other_unsecured'
                                  updatedEmployee.total_unsecured_claim =
                                    (updatedEmployee.wage_arrears_unsecured || 0) +
                                    (updatedEmployee.holiday_pay_unsecured || 0) +
                                    (updatedEmployee.notice_pay_unsecured || 0) +
                                    (updatedEmployee.redundancy_pay_unsecured || 0) +
                                    (updatedEmployee.pension_contributions_unsecured || 0) +
                                    newOtherUnsecured;
                                  return updatedEmployee;
                                });
                              }}
                              className="h-8 text-right w-32 ml-auto"
                            />
                          ) : (
                            formatCurrency(employeeData.other_unsecured || 0)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {formatCurrency(employeeData.other_unsecured || 0)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="bg-blue-50">
                        <TableCell className="font-bold text-slate-900">Total Claims</TableCell>
                        <TableCell className="text-right font-bold text-blue-700 bg-red-50">
                          {formatCurrency(employeeData.total_preferential_claim || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700 bg-red-50">
                          {formatCurrency(employeeData.total_unsecured_claim || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-900">
                          {formatCurrency((employeeData.total_preferential_claim || 0) + (employeeData.total_unsecured_claim || 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {activeSection === 'rps' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-blue-800">RPS Claims</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">Redundancy Payments Service claim details</p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateCreditors} size="sm" variant="outline" className="text-green-600 border-green-200">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Update Creditors
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-slate-300">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">Claim Type</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700">RPS Claimed</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700">RPS Processed</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700 bg-orange-50 border-l-2 border-r border-orange-200">Claimed Preferential</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700 bg-orange-50 border-r-2 border-orange-200">Claimed Unsecured</th>
                          <th className="text-right py-3 px-4 font-semibold text-slate-700">Residual Claim</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">Wage Arrears</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_wage_arrears_claimed || 0}
                                onChange={(e) => handleInputChange('rps_wage_arrears_claimed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_wage_arrears_claimed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_wage_arrears_processed || 0}
                                onChange={(e) => handleInputChange('rps_wage_arrears_processed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_wage_arrears_processed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-l-2 border-r border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_wage_arrears_claimed_preferential || 0}
                                onChange={(e) => handleInputChange('rps_wage_arrears_claimed_preferential', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_wage_arrears_claimed_preferential || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-r-2 border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_wage_arrears_claimed_unsecured || 0}
                                onChange={(e) => handleInputChange('rps_wage_arrears_claimed_unsecured', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_wage_arrears_claimed_unsecured || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            £{((employeeData.rps_wage_arrears_claimed || 0) - (employeeData.rps_wage_arrears_processed || 0)).toFixed(2)}
                          </td>
                        </tr>
                        
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">Holiday Pay</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_holiday_pay_claimed || 0}
                                onChange={(e) => handleInputChange('rps_holiday_pay_claimed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_holiday_pay_claimed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_holiday_pay_processed || 0}
                                onChange={(e) => handleInputChange('rps_holiday_pay_processed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_holiday_pay_processed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-l-2 border-r border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_holiday_pay_claimed_preferential || 0}
                                onChange={(e) => handleInputChange('rps_holiday_pay_claimed_preferential', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_holiday_pay_claimed_preferential || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-r-2 border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_holiday_pay_claimed_unsecured || 0}
                                onChange={(e) => handleInputChange('rps_holiday_pay_claimed_unsecured', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_holiday_pay_claimed_unsecured || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            £{((employeeData.rps_holiday_pay_claimed || 0) - (employeeData.rps_holiday_pay_processed || 0)).toFixed(2)}
                          </td>
                        </tr>
                        
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">Notice Pay</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_notice_pay_claimed || 0}
                                onChange={(e) => handleInputChange('rps_notice_pay_claimed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_notice_pay_claimed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_notice_pay_processed || 0}
                                onChange={(e) => handleInputChange('rps_notice_pay_processed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_notice_pay_processed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-l-2 border-r border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_notice_pay_claimed_preferential || 0}
                                onChange={(e) => handleInputChange('rps_notice_pay_claimed_preferential', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_notice_pay_claimed_preferential || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-r-2 border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_notice_pay_claimed_unsecured || 0}
                                onChange={(e) => handleInputChange('rps_notice_pay_claimed_unsecured', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_notice_pay_claimed_unsecured || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            £{((employeeData.rps_notice_pay_claimed || 0) - (employeeData.rps_notice_pay_processed || 0)).toFixed(2)}
                          </td>
                        </tr>
                        
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">Redundancy Pay</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_redundancy_pay_claimed || 0}
                                onChange={(e) => handleInputChange('rps_redundancy_pay_claimed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_redundancy_pay_claimed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_redundancy_pay_processed || 0}
                                onChange={(e) => handleInputChange('rps_redundancy_pay_processed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_redundancy_pay_processed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-l-2 border-r border-orange-200 font-medium text-slate-800">
                            —
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-r-2 border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_redundancy_pay_claimed_unsecured || 0}
                                onChange={(e) => handleInputChange('rps_redundancy_pay_claimed_unsecured', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_redundancy_pay_claimed_unsecured || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            £{((employeeData.rps_redundancy_pay_claimed || 0) - (employeeData.rps_redundancy_pay_processed || 0)).toFixed(2)}
                          </td>
                        </tr>
                        
                        <tr className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-3 px-4 font-medium text-slate-800">Pension Contributions</td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_pension_contributions_claimed || 0}
                                onChange={(e) => handleInputChange('rps_pension_contributions_claimed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_pension_contributions_claimed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_pension_contributions_processed || 0}
                                onChange={(e) => handleInputChange('rps_pension_contributions_processed', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right"
                              />
                            ) : (
                              <span className="text-slate-800">£{(employeeData.rps_pension_contributions_processed || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-l-2 border-r border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_pension_contributions_claimed_preferential || 0}
                                onChange={(e) => handleInputChange('rps_pension_contributions_claimed_preferential', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_pension_contributions_claimed_preferential || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-orange-50 border-r-2 border-orange-200">
                            {isEditing ? (
                              <Input
                                type="number"
                                step="0.01"
                                value={employeeData.rps_pension_contributions_claimed_unsecured || 0}
                                onChange={(e) => handleInputChange('rps_pension_contributions_claimed_unsecured', parseFloat(e.target.value) || 0)}
                                className="h-8 text-right bg-white"
                              />
                            ) : (
                              <span className="font-medium text-slate-800">£{(employeeData.rps_pension_contributions_claimed_unsecured || 0).toFixed(2)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-slate-900">
                            £{((employeeData.rps_pension_contributions_claimed || 0) - (employeeData.rps_pension_contributions_processed || 0)).toFixed(2)}
                          </td>
                        </tr>
                        
                        <tr className="border-t-2 border-slate-300 bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">Total</td>
                          <td className="py-3 px-4 text-right font-bold text-blue-900">
                            £{(
                              (employeeData.rps_wage_arrears_claimed || 0) +
                              (employeeData.rps_holiday_pay_claimed || 0) +
                              (employeeData.rps_notice_pay_claimed || 0) +
                              (employeeData.rps_redundancy_pay_claimed || 0) +
                              (employeeData.rps_pension_contributions_claimed || 0)
                            ).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-900">
                            £{(
                              (employeeData.rps_wage_arrears_processed || 0) +
                              (employeeData.rps_holiday_pay_processed || 0) +
                              (employeeData.rps_notice_pay_processed || 0) +
                              (employeeData.rps_redundancy_pay_processed || 0) +
                              (employeeData.rps_pension_contributions_processed || 0)
                            ).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 bg-orange-100 border-l-2 border-r border-orange-200">
                            £{(
                              (employeeData.rps_wage_arrears_claimed_preferential || 0) +
                              (employeeData.rps_holiday_pay_claimed_preferential || 0) +
                              (employeeData.rps_notice_pay_claimed_preferential || 0) +
                              (employeeData.rps_pension_contributions_claimed_preferential || 0)
                            ).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 bg-orange-100 border-r-2 border-orange-200">
                            £{(
                              (employeeData.rps_wage_arrears_claimed_unsecured || 0) +
                              (employeeData.rps_holiday_pay_claimed_unsecured || 0) +
                              (employeeData.rps_notice_pay_claimed_unsecured || 0) +
                              (employeeData.rps_redundancy_pay_claimed_unsecured || 0) +
                              (employeeData.rps_pension_contributions_claimed_unsecured || 0)
                            ).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            £{(
                              ((employeeData.rps_wage_arrears_claimed || 0) - (employeeData.rps_wage_arrears_processed || 0)) +
                              ((employeeData.rps_holiday_pay_claimed || 0) - (employeeData.rps_holiday_pay_processed || 0)) +
                              ((employeeData.rps_notice_pay_claimed || 0) - (employeeData.rps_notice_pay_processed || 0)) +
                              ((employeeData.rps_redundancy_pay_claimed || 0) - (employeeData.rps_redundancy_pay_processed || 0)) +
                              ((employeeData.rps_pension_contributions_claimed || 0) - (employeeData.rps_pension_contributions_processed || 0))
                            ).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Employee</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Are you sure you want to delete {employeeData.first_name} {employeeData.last_name}? 
                  This action cannot be undone and will permanently remove all employee data.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDelete}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  >
                    Delete Employee
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}