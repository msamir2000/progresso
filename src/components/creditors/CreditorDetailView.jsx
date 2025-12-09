import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea"; // Textarea is not used, can be removed if not needed elsewhere
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Creditor } from "@/api/entities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building,
  Mail,
  User,
  PoundSterling,
  Calendar,
  CreditCard,
  MapPin,
  Users,
  ArrowLeft,
  Edit,
  Save,
  X,
  Settings,
  ShieldCheck,
  UserX,
  Trash2
} from "lucide-react";

export default function CreditorDetailView({ creditor, onBack, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editedData, setEditedData] = useState({});

  useEffect(() => {
    if (creditor) {
      const initialData = {
        creditor_name: creditor.creditor_name || "",
        creditor_address: creditor.creditor_address || "", // This will be rebuilt from address lines for saving
        address_line_1: "",
        address_line_2: "",
        address_line_3: "",
        address_line_4: "",
        address_line_5: "",
        account_number: creditor.account_number || "",
        balance_owed: creditor.balance_owed || 0,
        balance_submitted: creditor.balance_submitted || "",
        date_submitted: creditor.date_submitted ? creditor.date_submitted.split('T')[0] : "",
        date_admitted: creditor.date_admitted ? creditor.date_admitted.split('T')[0] : "",
        creditor_type: creditor.creditor_type || "unsecured",
        unsecured_creditor_type: creditor.unsecured_creditor_type || "",
        is_finance_company: creditor.is_finance_company || false, // Added field
        contact_name: creditor.contact_name || "",
        email_address: creditor.email_address || "",
        telephone_number: creditor.telephone_number || "",
        mobile_number: creditor.mobile_number || "",
        on_mail_hold: creditor.on_mail_hold || false,
        email_only: creditor.email_only || false,
        opted_out: creditor.opted_out || false,
        date_of_opt_out: creditor.date_of_opt_out ? creditor.date_of_opt_out.split('T')[0] : "",
        security_type: creditor.security_type || "",
        security_date_of_creation: creditor.security_date_of_creation ? creditor.security_date_of_creation.split('T')[0] : "",
        security_date_of_registration: creditor.security_date_of_registration ? creditor.security_date_of_registration.split('T')[0] : ""
      };

      if (creditor.creditor_address) {
        const lines = creditor.creditor_address.split('\n');
        initialData.address_line_1 = lines[0] || "";
        initialData.address_line_2 = lines[1] || "";
        initialData.address_line_3 = lines[2] || "";
        initialData.address_line_4 = lines[3] || "";
        initialData.address_line_5 = lines[4] || "";
      }
      setEditedData(initialData);
      setIsEditing(false); // Reset editing state when creditor changes
    } else {
        // If no creditor is provided, clear editedData to avoid displaying stale info
        setEditedData({});
        setIsEditing(false);
    }
  }, [creditor]);

  // Helper function to format currency as negative (in parentheses) for liabilities
  const formatCurrency = (amount) => {
    const numValue = parseFloat(amount) || 0;
    // Since creditor balances are liabilities (owed TO creditors), show as negative with parentheses  
    // and include the pound sign and two decimal places.
    return `(£${Math.abs(numValue).toLocaleString('en-GB', { minimumFractionDigits: 2 })})`;
  };

  if (!creditor || Object.keys(editedData).length === 0) {
    return (
        <div className="flex items-center justify-center h-full p-8 text-center">
            <div>
                <UserX className="w-12 h-12 mx-auto text-slate-400" />
                <h3 className="mt-4 text-lg font-medium text-slate-800">No Creditor Selected</h3>
                <p className="mt-1 text-sm text-slate-500">Please select a creditor from the list to see their details.</p>
            </div>
        </div>
    );
  }

  const getTypeColor = (type) => {
    switch (type) {
      case 'secured': return 'bg-green-100 text-green-800 border-green-200';
      case 'moratorium': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'preferential': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'secondary_preferential': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'unsecured': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getUnsecuredTypeLabel = (type) => {
    const typeMap = {
      trade_expense: "Trade & Expense",
      customers_deposits: "Customers & Deposits",
      utilities: "Utilities",
      bank: "Bank",
      landlord: "Landlord",
      connected_parties: "Connected Parties",
      contingent_liabilities: "Contingent Liabilities",
      lender: "Lender",
      finance_company: "Finance Company"
    };
    return typeMap[type] || "Not specified";
  };

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const addressLines = [
        editedData.address_line_1,
        editedData.address_line_2,
        editedData.address_line_3,
        editedData.address_line_4,
        editedData.address_line_5,
      ];
      const fullAddress = addressLines.filter(line => line).join('\n');

      const updateData = {
        ...editedData,
        creditor_address: fullAddress,
        balance_owed: parseFloat(editedData.balance_owed) || 0,
        balance_submitted: editedData.balance_submitted ? parseFloat(editedData.balance_submitted) : null,
        date_submitted: editedData.date_submitted || null,
        date_admitted: editedData.date_admitted || null,
        date_of_opt_out: editedData.date_of_opt_out || null,
        security_date_of_creation: editedData.security_date_of_creation || null,
        security_date_of_registration: editedData.security_date_of_registration || null,
      };

      await Creditor.update(creditor.id, updateData);
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Error updating creditor:", error);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    // Re-initialize editedData from the original creditor prop to discard changes
    if (creditor) {
      const lines = creditor.creditor_address ? creditor.creditor_address.split('\n') : [];
      setEditedData({
        creditor_name: creditor.creditor_name || "",
        creditor_address: creditor.creditor_address || "",
        address_line_1: lines[0] || "",
        address_line_2: lines[1] || "",
        address_line_3: lines[2] || "",
        address_line_4: lines[3] || "",
        address_line_5: lines[4] || "",
        account_number: creditor.account_number || "",
        balance_owed: creditor.balance_owed || 0,
        balance_submitted: creditor.balance_submitted || "",
        date_submitted: creditor.date_submitted ? creditor.date_submitted.split('T')[0] : "",
        date_admitted: creditor.date_admitted ? creditor.date_admitted.split('T')[0] : "",
        creditor_type: creditor.creditor_type || "unsecured",
        unsecured_creditor_type: creditor.unsecured_creditor_type || "",
        is_finance_company: creditor.is_finance_company || false, // Added field to handleCancel
        contact_name: creditor.contact_name || "",
        email_address: creditor.email_address || "",
        telephone_number: creditor.telephone_number || "",
        mobile_number: creditor.mobile_number || "",
        on_mail_hold: creditor.on_mail_hold || false,
        email_only: creditor.email_only || false,
        opted_out: creditor.opted_out || false,
        date_of_opt_out: creditor.date_of_opt_out ? creditor.date_of_opt_out.split('T')[0] : "",
        security_type: creditor.security_type || "",
        security_date_of_creation: creditor.security_date_of_creation ? creditor.security_date_of_creation.split('T')[0] : "",
        security_date_of_registration: creditor.security_date_of_registration ? creditor.security_date_of_registration.split('T')[0] : ""
      });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await Creditor.delete(creditor.id);
      setShowDeleteDialog(false);
      if (onUpdate) onUpdate();
      onBack(); // Navigate back to creditor list
    } catch (error) {
      console.error("Error deleting creditor:", error);
      alert("Failed to delete creditor. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-xl text-slate-900">
              {isEditing ? editedData.creditor_name : creditor.creditor_name}
            </h3>
            <Badge className={`capitalize font-medium text-sm px-3 py-1 ${getTypeColor(isEditing ? editedData.creditor_type : creditor.creditor_type)}`}>
              {(isEditing ? editedData.creditor_type : creditor.creditor_type)?.replace('_', ' ')} Creditor
            </Badge>
            {(isEditing ? editedData.creditor_type : creditor.creditor_type) === 'unsecured' && (
              <div className="flex items-center gap-2 ml-8">
                <span className="text-sm font-medium text-slate-600">Creditor Type:</span>
                <Badge variant="outline" className="font-medium text-sm px-3 py-1">
                  {getUnsecuredTypeLabel(isEditing ? editedData.unsecured_creditor_type : creditor.unsecured_creditor_type)}
                </Badge>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Grid - 3 rows layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        
        {/* Left Column */}
        <div className="space-y-3">
          
          {/* Basic Information - Full height */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="w-4 h-4 text-slate-600" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                
                {(isEditing ? editedData.creditor_type : creditor.creditor_type) === 'unsecured' ? (
                  <>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Creditor Name</Label>
                      {isEditing ? (
                        <Input
                          value={editedData.creditor_name}
                          onChange={(e) => handleInputChange("creditor_name", e.target.value)}
                          className="bg-white text-sm h-8"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-slate-900 h-8 flex items-center">{creditor.creditor_name}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Unsecured Creditor Type</Label>
                      {isEditing ? (
                        <Select
                          value={editedData.unsecured_creditor_type}
                          onValueChange={(value) => handleInputChange("unsecured_creditor_type", value)}
                        >
                          <SelectTrigger className="bg-white text-sm h-8">
                            <SelectValue placeholder="Select unsecured type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trade_expense">Trade & Expense</SelectItem>
                            <SelectItem value="customers_deposits">Customers & Deposits</SelectItem>
                            <SelectItem value="utilities">Utilities</SelectItem>
                            <SelectItem value="bank">Bank</SelectItem>
                            <SelectItem value="landlord">Landlord</SelectItem>
                            <SelectItem value="connected_parties">Connected Parties</SelectItem>
                            <SelectItem value="contingent_liabilities">Contingent Liabilities</SelectItem>
                            <SelectItem value="lender">Lender</SelectItem>
                            <SelectItem value="finance_company">Finance Company</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-medium text-slate-900 h-8 flex items-center">
                          {getUnsecuredTypeLabel(creditor.unsecured_creditor_type)}
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <Label className="text-xs font-medium text-slate-600">Creditor Name</Label>
                    {isEditing ? (
                      <Input
                        value={editedData.creditor_name}
                        onChange={(e) => handleInputChange("creditor_name", e.target.value)}
                        className="bg-white text-sm h-8"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900 h-8 flex items-center">{creditor.creditor_name}</p>
                    )}
                  </div>
                )}

                <div>
                  <Label className="text-xs font-medium text-slate-600">Contact Person</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.contact_name}
                      onChange={(e) => handleInputChange("contact_name", e.target.value)}
                      className="bg-white text-sm h-8"
                    />
                  ) : (
                    <p className="text-sm text-slate-900 h-8 flex items-center">
                      {creditor.contact_name || <span className="text-slate-400">Not provided</span>}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Account Number</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.account_number}
                      onChange={(e) => handleInputChange("account_number", e.target.value)}
                      className="bg-white text-sm h-8 font-mono"
                    />
                  ) : (
                    <p className="text-sm font-mono text-slate-900 h-8 flex items-center">
                      {creditor.account_number || <span className="text-slate-400 font-normal not-font-mono">Not provided</span>}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Email Address</Label>
                  {isEditing ? (
                    <Input
                      type="email"
                      value={editedData.email_address}
                      onChange={(e) => handleInputChange("email_address", e.target.value)}
                      className="bg-white text-sm h-8"
                    />
                  ) : (
                    <p className="text-sm text-blue-600 h-8 flex items-center">
                      {creditor.email_address || <span className="text-slate-400">Not provided</span>}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Telephone Number</Label>
                  {isEditing ? (
                    <Input
                      type="tel"
                      value={editedData.telephone_number}
                      onChange={(e) => handleInputChange("telephone_number", e.target.value)}
                      className="bg-white text-sm h-8"
                    />
                  ) : (
                    <p className="text-sm text-slate-900 h-8 flex items-center">
                      {creditor.telephone_number || <span className="text-slate-400">Not provided</span>}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Mobile Number</Label>
                  {isEditing ? (
                    <Input
                      type="tel"
                      value={editedData.mobile_number}
                      onChange={(e) => handleInputChange("mobile_number", e.target.value)}
                      className="bg-white text-sm h-8"
                    />
                  ) : (
                    <p className="text-sm text-slate-900 h-8 flex items-center">
                      {creditor.mobile_number || <span className="text-slate-400">Not provided</span>}
                    </p>
                  )}
                </div>

                <div className="col-span-2">
                  <div className="flex items-center space-x-2 p-2 border rounded-lg bg-slate-50/50">
                    <Checkbox
                      id="is_finance_company"
                      checked={editedData.is_finance_company}
                      onCheckedChange={(checked) => handleInputChange("is_finance_company", checked)}
                      disabled={!isEditing}
                      className="border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label htmlFor="is_finance_company" className="text-sm font-medium cursor-pointer">Finance Company</Label>
                  </div>
                </div>
                
                {editedData.creditor_type === 'secured' && (
                  <>
                    <hr className="my-2 col-span-2 border-slate-200" />
                    <div className="col-span-2">
                      <Label className="text-xs font-medium text-slate-600">Type of Security</Label>
                      {isEditing ? (
                        <Select value={editedData.security_type} onValueChange={(value) => handleInputChange("security_type", value)}>
                          <SelectTrigger className="bg-white text-sm h-8 mt-1"><SelectValue placeholder="Select type..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Debenture">Debenture</SelectItem>
                            <SelectItem value="Fixed & Floating Charge">Fixed & Floating Charge</SelectItem>
                            <SelectItem value="Fixed Charge">Fixed Charge</SelectItem>
                            <SelectItem value="Rent Deposit Deed">Rent Deposit Deed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm font-medium text-slate-900 h-8 flex items-center">
                          {editedData.security_type || <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-600">Date of Creation</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedData.security_date_of_creation}
                          onChange={(e) => handleInputChange("security_date_of_creation", e.target.value)}
                          className="bg-white text-sm h-8 mt-1"
                        />
                      ) : (
                        <p className="text-sm font-medium text-slate-900 h-8 flex items-center">
                          {editedData.security_date_of_creation ? new Date(editedData.security_date_of_creation).toLocaleDateString('en-GB') : <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>
                     <div>
                      <Label className="text-xs font-medium text-slate-600">Date of Registration</Label>
                       {isEditing ? (
                        <Input
                          type="date"
                          value={editedData.security_date_of_registration}
                          onChange={(e) => handleInputChange("security_date_of_registration", e.target.value)}
                          className="bg-white text-sm h-8 mt-1"
                        />
                      ) : (
                        <p className="text-sm font-medium text-slate-900 h-8 flex items-center">
                          {editedData.security_date_of_registration ? new Date(editedData.security_date_of_registration).toLocaleDateString('en-GB') : <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Financial Information - Compact */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <PoundSterling className="w-4 h-4 text-green-600" />
                Financial Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
               <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Balance Owed</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData.balance_owed}
                        onChange={(e) => handleInputChange("balance_owed", e.target.value)}
                        className="bg-white text-sm h-8"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 h-8 flex items-center">
                        {formatCurrency(creditor.balance_owed)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Date Submitted (claim form)</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editedData.date_submitted}
                        onChange={(e) => handleInputChange("date_submitted", e.target.value)}
                        className="bg-white text-sm h-8"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 h-8 flex items-center">
                        {creditor.date_submitted ? new Date(creditor.date_submitted).toLocaleDateString('en-GB') : <span className="text-slate-400">Not set</span>}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Balance Submitted</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={editedData.balance_submitted}
                        onChange={(e) => handleInputChange("balance_submitted", e.target.value)}
                        className="bg-white text-sm h-8"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900 h-8 flex items-center">
                        {creditor.balance_submitted ? formatCurrency(creditor.balance_submitted) : <span className="text-slate-400">Not set</span>}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Date Admitted (for dividend purposes)</Label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editedData.date_admitted}
                        onChange={(e) => handleInputChange("date_admitted", e.target.value)}
                        className="bg-white text-sm h-8"
                      />
                    ) : (
                      <p className="text-sm text-slate-900 h-8 flex items-center">
                        {creditor.date_admitted ? new Date(creditor.date_admitted).toLocaleDateString('en-GB') : <span className="text-slate-400">Not set</span>}
                      </p>
                    )}
                  </div>
                </div>
            </CardContent>
          </Card>

          {/* Voting & Proxies - New */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-indigo-600" />
                Voting & Proxies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Voting Rights</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Proxy Holder</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Proxy Date</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Meeting Attendance</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          
          {/* Address Information - Full height */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="w-4 h-4 text-red-600" />
                Address Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {isEditing ? (
                <div className="space-y-2">
                  <Input placeholder="Address Line 1" value={editedData.address_line_1} onChange={(e) => handleInputChange("address_line_1", e.target.value)} className="bg-white text-sm h-8" />
                  <Input placeholder="Address Line 2" value={editedData.address_line_2} onChange={(e) => handleInputChange("address_line_2", e.target.value)} className="bg-white text-sm h-8" />
                  <Input placeholder="Town/City" value={editedData.address_line_3} onChange={(e) => handleInputChange("address_line_3", e.target.value)} className="bg-white text-sm h-8" />
                  <Input placeholder="County" value={editedData.address_line_4} onChange={(e) => handleInputChange("address_line_4", e.target.value)} className="bg-white text-sm h-8" />
                  <Input placeholder="Postcode" value={editedData.address_line_5} onChange={(e) => handleInputChange("address_line_5", e.target.value)} className="bg-white text-sm h-8" />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-slate-900 h-8 flex items-center px-3 rounded bg-slate-50 border">{editedData.address_line_1 || "—"}</div>
                  <div className="text-sm text-slate-900 h-8 flex items-center px-3 rounded bg-slate-50 border">{editedData.address_line_2 || "—"}</div>
                  <div className="text-sm text-slate-900 h-8 flex items-center px-3 rounded bg-slate-50 border">{editedData.address_line_3 || "—"}</div>
                  <div className="text-sm text-slate-900 h-8 flex items-center px-3 rounded bg-slate-50 border">{editedData.address_line_4 || "—"}</div>
                  <div className="text-sm text-slate-900 h-8 flex items-center px-3 rounded bg-slate-50 border">{editedData.address_line_5 || "—"}</div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Communication Preferences - Compact */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="w-4 h-4 text-purple-600" />
                Communication Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="space-y-3">
                <div className="flex items-center space-x-2 p-2 border rounded-lg bg-slate-50/50">
                  <Checkbox
                    id="on_mail_hold"
                    checked={editedData.on_mail_hold}
                    onCheckedChange={(checked) => handleInputChange("on_mail_hold", checked)}
                    disabled={!isEditing}
                    className="border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="on_mail_hold" className="text-sm font-medium cursor-pointer">On Mail Hold</Label>
                </div>
                <div className="flex items-center space-x-2 p-2 border rounded-lg bg-slate-50/50">
                  <Checkbox
                    id="email_only"
                    checked={editedData.email_only}
                    onCheckedChange={(checked) => handleInputChange("email_only", checked)}
                    disabled={!isEditing}
                    className="border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <Label htmlFor="email_only" className="text-sm font-medium cursor-pointer">Email Only</Label>
                </div>
                <div className="p-2 border rounded-lg bg-slate-50/50">
                  <div className="flex items-center space-x-2 mb-2">
                    <Checkbox
                      id="opted_out"
                      checked={editedData.opted_out}
                      onCheckedChange={(checked) => handleInputChange("opted_out", checked)}
                      disabled={!isEditing}
                      className="border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <Label htmlFor="opted_out" className="text-sm font-medium cursor-pointer">Opted Out</Label>
                  </div>
                  {editedData.opted_out && (
                    <div className="ml-6">
                      <Label className="text-xs font-medium text-slate-600">Date of Opt Out</Label>
                      {isEditing ? (
                        <Input
                          type="date"
                          value={editedData.date_of_opt_out}
                          onChange={(e) => handleInputChange("date_of_opt_out", e.target.value)}
                          className="bg-white text-sm h-8 mt-1"
                        />
                      ) : (
                        <p className="text-sm text-slate-900 h-8 flex items-center">
                          {creditor.date_of_opt_out ? new Date(creditor.date_of_opt_out).toLocaleDateString('en-GB') : <span className="text-slate-400">Not set</span>}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Distributions - New */}
          <Card className="flex flex-col">
            <CardHeader className="p-3 pb-2 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="w-4 h-4 text-orange-600" />
                Distributions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Distribution 1</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Date Paid</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Distribution 2</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Date Paid</Label>
                  <p className="text-sm text-slate-900 h-8 flex items-center">
                    <span className="text-slate-400">Not set</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Creditor?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{creditor.creditor_name}</strong>?
              <br /><br />
              This action cannot be undone. The creditor will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Creditor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}