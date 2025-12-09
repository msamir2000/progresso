
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Employee } from "@/api/entities";
import { calculateEmployeeClaims } from "./claimsCalculator";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";

export default function AddEmployeeModal({ isOpen, onClose, onEmployeeAdded, caseId }) {
  const [formData, setFormData] = useState({
    case_id: caseId, // case_id is now part of formData state
    first_name: "", // New field
    last_name: "", // New field
    title: "",
    address: { line1: "", line2: "", city: "", county: "", postcode: "" }, // Address as nested object
    email_address: "",
    phone_number: "",
    date_of_birth: "",
    national_insurance_number: "",
    start_date: "",
    end_date: "",
    yearly_salary: "",
    pay_type: "salaried", // New field
    holiday_entitlement: "28",
    days_taken: "0",
    days_carried_forward: "0",
    work_days_per_week: "5",
    date_last_paid: "",
    holiday_year_start_date: "", // New field
    employer_pension_percent: "3", // New field
    employee_pension_percent: "5", // New field
    pension_opted_in: "yes", // Existing field, default value
    date_contributions_last_paid: "" // New field
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null); // Retain error state

  const clearForm = () => {
    setFormData({
      case_id: caseId, // Ensure case_id is correctly set on reset
      first_name: "", // Reset new field
      last_name: "", // Reset new field
      title: "",
      address: { line1: "", line2: "", city: "", county: "", postcode: "" },
      email_address: "",
      phone_number: "",
      date_of_birth: "",
      national_insurance_number: "",
      start_date: "",
      end_date: "",
      yearly_salary: "",
      pay_type: "salaried", // Reset new field
      holiday_entitlement: "28",
      days_taken: "0",
      days_carried_forward: "0",
      work_days_per_week: "5",
      date_last_paid: "",
      holiday_year_start_date: "",
      employer_pension_percent: "3",
      employee_pension_percent: "5",
      pension_opted_in: "yes",
      date_contributions_last_paid: ""
    });
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      clearForm(); // Reset form data when modal opens
    }
  }, [isOpen, caseId]); // Added caseId to dependency array as it's used in initial state

  const handleInputChange = (field, value) => {
    if (field.startsWith('address.')) {
        const addressField = field.split('.')[1];
        setFormData(prev => ({
            ...prev,
            address: {
                ...prev.address,
                [addressField]: value
            }
        }));
    } else {
        setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const requiredFields = ['first_name', 'last_name', 'start_date', 'end_date', 'yearly_salary'];
      for (const field of requiredFields) {
        if (!formData[field]) {
          setError(`Please fill in the ${field.replace('_', ' ')} field.`);
          setIsSubmitting(false);
          return;
        }
      }

      // formData already contains the address object and case_id
      const employeeData = { ...formData }; 

      // calculateEmployeeClaims and Employee.create must be able to handle the address object
      const calculatedClaims = calculateEmployeeClaims(employeeData);

      await Employee.create({ ...employeeData, ...calculatedClaims });
      onEmployeeAdded();
      handleClose(); // Use handleClose to reset form and close dialog
    } catch (err) {
      setError("Failed to save employee. Please check the details and try again.");
      console.error(err);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
          <DialogDescription>
            Enter the details for the new employee.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4 px-2">

            {/* Personal Details */}
            <h3 className="font-semibold text-lg border-b pb-2">Personal Details</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Mr, Ms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name || ''}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name || ''}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email_address">Email</Label>
                <Input
                  id="email_address"
                  type="email"
                  value={formData.email_address || ''}
                  onChange={(e) => handleInputChange('email_address', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number || ''}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth || ''}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="national_insurance_number">National Insurance Number</Label>
                <Input
                  id="national_insurance_number"
                  value={formData.national_insurance_number || ''}
                  onChange={(e) => handleInputChange('national_insurance_number', e.target.value)}
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="mt-4">
              <Label className="mb-2 block">Address</Label>
              <div className="space-y-2">
                <Input placeholder="Line 1" value={formData.address.line1 || ''} onChange={(e) => handleInputChange('address.line1', e.target.value)} />
                <Input placeholder="Line 2" value={formData.address.line2 || ''} onChange={(e) => handleInputChange('address.line2', e.target.value)} />
                <Input placeholder="City" value={formData.address.city || ''} onChange={(e) => handleInputChange('address.city', e.target.value)} />
                <Input placeholder="County" value={formData.address.county || ''} onChange={(e) => handleInputChange('address.county', e.target.value)} />
                <Input placeholder="Postcode" value={formData.address.postcode || ''} onChange={(e) => handleInputChange('address.postcode', e.target.value)} />
              </div>
            </div>

            {/* Pension Information */}
            <h3 className="font-semibold text-lg border-b pb-2 mt-6">Pension Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="pension_opted_in">Pension Opted In</Label>
                <Select
                  value={formData.pension_opted_in || 'yes'}
                  onValueChange={(value) => handleInputChange('pension_opted_in', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select pension status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_pension_percent">Employee Pension %</Label>
                <Input
                  id="employee_pension_percent"
                  type="number"
                  step="0.01"
                  value={formData.employee_pension_percent || ''}
                  onChange={(e) => handleInputChange('employee_pension_percent', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employer_pension_percent">Employer Pension %</Label>
                <Input
                  id="employer_pension_percent"
                  type="number"
                  step="0.01"
                  value={formData.employer_pension_percent || ''}
                  onChange={(e) => handleInputChange('employer_pension_percent', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_contributions_last_paid">Last Contributions Paid</Label>
                <Input
                  id="date_contributions_last_paid"
                  type="date"
                  value={formData.date_contributions_last_paid || ''}
                  onChange={(e) => handleInputChange('date_contributions_last_paid', e.target.value)}
                />
              </div>
            </div>

            {/* Holiday Information */}
            <h3 className="font-semibold text-lg border-b pb-2 mt-6">Holiday Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="holiday_entitlement">Annual Holiday Entitlement (days)</Label>
                <Input
                  id="holiday_entitlement"
                  type="number"
                  step="0.5"
                  value={formData.holiday_entitlement || ''}
                  onChange={(e) => handleInputChange('holiday_entitlement', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_taken">Days Taken</Label>
                <Input
                  id="days_taken"
                  type="number"
                  step="0.5"
                  value={formData.days_taken || ''}
                  onChange={(e) => handleInputChange('days_taken', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days_carried_forward">Days Carried Forward</Label>
                <Input
                  id="days_carried_forward"
                  type="number"
                  step="0.5"
                  value={formData.days_carried_forward || ''}
                  onChange={(e) => handleInputChange('days_carried_forward', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="holiday_year_start_date">Holiday Year Start Date</Label>
                <Input
                  id="holiday_year_start_date"
                  type="date"
                  value={formData.holiday_year_start_date || ''}
                  onChange={(e) => handleInputChange('holiday_year_start_date', e.target.value)}
                />
              </div>
            </div>

            {/* Employment Details */}
            <h3 className="font-semibold text-lg border-b pb-2 mt-4">Employment Details</h3>
            <div className="grid grid-cols-2 gap-6 mt-4">
                <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date *</Label>
                    <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date || ''}
                        onChange={(e) => handleInputChange('start_date', e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end_date">End Date *</Label>
                    <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date || ''}
                        onChange={(e) => handleInputChange('end_date', e.target.value)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="yearly_salary">Yearly Salary (£) *</Label>
                    <Input
                        id="yearly_salary"
                        type="number"
                        step="0.01"
                        value={formData.yearly_salary || ''}
                        onChange={(e) => handleInputChange('yearly_salary', parseFloat(e.target.value) || 0)}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="work_days_per_week">Work Days per Week</Label>
                    <Input
                        id="work_days_per_week"
                        type="number"
                        step="0.5"
                        value={formData.work_days_per_week || ''}
                        onChange={(e) => handleInputChange('work_days_per_week', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="pay_type">Pay Type</Label>
                    <Select
                      value={formData.pay_type || 'salaried'}
                      onValueChange={(value) => handleInputChange('pay_type', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select pay type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="salaried">Salaried</SelectItem>
                        <SelectItem value="variable">Variable Pay</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="date_last_paid">Date Last Paid</Label>
                    <Input
                        id="date_last_paid"
                        type="date"
                        value={formData.date_last_paid || ''}
                        onChange={(e) => handleInputChange('date_last_paid', e.target.value)}
                    />
                </div>
            </div>

          </div>

          {error && <p className="text-sm text-red-600 flex items-center gap-2 mt-4 px-2"><AlertCircle className="w-4 h-4" /> {error}</p>}

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Add Employee
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
