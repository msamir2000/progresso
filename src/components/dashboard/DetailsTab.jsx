import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  X,
  Save,
  Edit,
  Briefcase,
  Building,
  Users,
  Landmark,
  Users2,
  Loader2,
  XCircle,
  Check,
  Lock,
  Trash2,
  Pencil,
  Plus
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DetailItem = ({ label, children, className }) => (
  <div className={`py-2 ${className || ''}`}>
    <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
    <div className="text-sm text-slate-900">{children}</div>
  </div>
);

const formatForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return '—';
    }
};

const formatDateTime = (dateString) => {
  if (!dateString) return '—';
  try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
      return '—';
  }
};

const formatAddress = (addressObj) => {
    if (!addressObj || typeof addressObj !== 'object') return '—';
    const addressString = [
        addressObj.line1,
        addressObj.line2,
        addressObj.city,
        addressObj.county,
        addressObj.postcode
    ].filter(Boolean).join('\n');
    return addressString || '—';
};

const IP_DETAILS_MAP = {
  'Duncan': { fullName: 'Duncan Coutts', ipNumber: '31070' },
  'Rupen': { fullName: 'Rupen Patel', ipNumber: '31374' },
  'Nimish': { fullName: 'Nimish Patel', ipNumber: '8679' }
};

export default function DetailsTab({ 
  caseData,
  isEditingDetails,
  isSaving,
  availableUsers,
  activeDetailsSection,
  setActiveDetailsSection,
  handleInputChange,
  handleSaveDetails,
  handleCancelDetailsEdit,
  setIsEditingDetails,
  isEditingCaseName,
  editedCaseName,
  setEditedCaseName,
  startEditingCaseName,
  handleCaseNameUpdate,
  setIsEditingCaseName,
  assignedUser,
  managerUser,
  cashieringUser,
  getAssignmentDate,
  handleOpenAssignModal,
  handleEditAdditionalStaff,
  handleRemoveAdditionalStaff,
  setShowAddStaffModal,
  isSectionComplete,
  onCaseUpdate
}) {
  const statusStyles = {
    active: 'bg-green-100 text-green-800 border-green-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
    on_hold: 'bg-amber-100 text-amber-800 border-amber-200',
  };

  const DetailsSectionMenu = ({ section, label, isActive, onClick }) => {
    const isComplete = isSectionComplete(section);
    let classes = 'w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors border';

    if (isActive) {
      classes += ' bg-blue-100 text-blue-700 border-blue-500';
    } else {
      if (isComplete) {
        classes += ' bg-green-50 text-slate-700 hover:bg-green-100 border-green-400';
      } else {
        classes += ' bg-red-50 text-slate-700 hover:bg-red-100 border-red-400';
      }
    }

    return (
      <button
        onClick={onClick}
        className={classes}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <h3 className="font-display font-semibold text-lg">Case & Staff Details</h3>
        {!isEditingDetails ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditingDetails(true)} className="text-blue-700 border-blue-200 hover:bg-blue-50 hover:text-blue-800">
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelDetailsEdit}>
              <XCircle className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveDetails} disabled={isSaving} className="bg-blue-700 hover:bg-blue-800">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save All
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Submenu */}
        <div className="w-64 flex-shrink-0 border-r bg-slate-50 p-4">
          <nav className="space-y-3">
            <DetailsSectionMenu
              section="case_overview"
              label="Case Overview"
              isActive={activeDetailsSection === 'case_overview'}
              onClick={() => setActiveDetailsSection('case_overview')}
            />
            <DetailsSectionMenu
              section="staff_assigned"
              label="Staff Assigned"
              isActive={activeDetailsSection === 'staff_assigned'}
              onClick={() => setActiveDetailsSection('staff_assigned')}
            />
            <DetailsSectionMenu
              section="trading_information"
              label="Trading Information"
              isActive={activeDetailsSection === 'trading_information'}
              onClick={() => setActiveDetailsSection('trading_information')}
            />
            <DetailsSectionMenu
              section="meetings_resolutions"
              label="Meetings & Resolutions"
              isActive={activeDetailsSection === 'meetings_resolutions'}
              onClick={() => setActiveDetailsSection('meetings_resolutions')}
            />
            <DetailsSectionMenu
              section="tax_details"
              label="Tax Details"
              isActive={activeDetailsSection === 'tax_details'}
              onClick={() => setActiveDetailsSection('tax_details')}
            />
          </nav>
        </div>

        {/* Right Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6">
            {/* Case Overview Section */}
            {activeDetailsSection === 'case_overview' && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="font-semibold text-base flex items-center gap-2 text-blue-800">
                    <Briefcase className="w-4 h-4 text-blue-700" />
                    Case Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                      {/* Case Name - Editable */}
                      <div>
                        <Label className="text-sm font-medium text-slate-600 flex items-center gap-2">
                          Company Name
                          {!isEditingCaseName && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={startEditingCaseName}
                              className="h-6 w-6 p-0"
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                          )}
                        </Label>
                        {isEditingCaseName ? (
                          <div className="flex gap-2 mt-1">
                            <Input
                              value={editedCaseName}
                              onChange={(e) => setEditedCaseName(e.target.value)}
                              className="flex-1 h-10"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={handleCaseNameUpdate}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={isSaving}
                            >
                              {isSaving ? <Loader2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsEditingCaseName(false)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-base font-semibold text-slate-800 mt-1">{caseData.company_name || '—'}</p>
                        )}
                      </div>

                    <DetailItem label="Case Type">
                      {isEditingDetails ? (
                        <Select value={caseData.case_type} onValueChange={(value) => handleInputChange("case_type", value)}>
                          <SelectTrigger className="h-10"><SelectValue/></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Administration">Administration</SelectItem>
                            <SelectItem value="CVL">CVL</SelectItem>
                            <SelectItem value="MVL">MVL</SelectItem>
                            <SelectItem value="CWU">CWU</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-base font-semibold text-slate-800">{caseData.case_type || '—'}</p>
                        </div>
                      )}
                    </DetailItem>

                    <DetailItem label="Status">
                      {isEditingDetails ? (
                        <Select value={caseData.status} onValueChange={(value) => handleInputChange("status", value)}>
                          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <Badge className={`capitalize border font-semibold text-sm px-3 py-1 ${statusStyles[caseData.status] || 'bg-slate-100 text-slate-800'}`}>
                            {(caseData.status || '').replace('_', ' ')}
                          </Badge>
                        </div>
                      )}
                    </DetailItem>

                    {/* Case Reference */}
                    <div>
                      <Label className="text-sm font-medium text-slate-600">Case Reference</Label>
                      {isEditingDetails ? (
                        <Input value={caseData.case_reference || ''} onChange={(e) => handleInputChange('case_reference', e.target.value)} className="h-10 mt-1" />
                      ) : (
                        <p className="text-base font-semibold text-slate-800 mt-1">{caseData.case_reference || '—'}</p>
                      )}
                    </div>

                    <DetailItem label="Date of Appointment">
                      {isEditingDetails ? (
                        <Input type="date" value={formatForInput(caseData.appointment_date)} onChange={(e) => handleInputChange('appointment_date', e.target.value)} className="h-10" />
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-base font-semibold text-slate-800">{formatDate(caseData.appointment_date)}</p>
                        </div>
                      )}
                    </DetailItem>

                    {caseData.case_type === 'CWU' && (
                      <>
                        <DetailItem label="Date Petition Filed">
                          {isEditingDetails ? (
                            <Input type="date" value={formatForInput(caseData.date_petition_filed)} onChange={(e) => handleInputChange('date_petition_filed', e.target.value)} className="h-10"/>
                          ) : (
                            <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                              <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_petition_filed)}</p>
                            </div>
                          )}
                        </DetailItem>
                        <DetailItem label="Date of Winding Up Order">
                          {isEditingDetails ? (
                            <Input type="date" value={formatForInput(caseData.date_winding_up_order)} onChange={(e) => handleInputChange('date_winding_up_order', e.target.value)} className="h-10"/>
                          ) : (
                            <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                              <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_winding_up_order)}</p>
                            </div>
                          )}
                        </DetailItem>
                        <DetailItem label="Court Reference Number">
                          {isEditingDetails ? (
                            <Input value={caseData.court_reference_number || ''} onChange={(e) => handleInputChange('court_reference_number', e.target.value)} className="h-10" />
                          ) : (
                            <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                              <p className="text-base font-semibold text-slate-800">{caseData.court_reference_number || '—'}</p>
                            </div>
                          )}
                        </DetailItem>
                      </>
                    )}

                    {/* Principal Activity */}
                    <div className="md:col-span-2">
                      <DetailItem label="Principal Activity">
                        {isEditingDetails ? (
                          <Textarea
                            value={caseData.principal_activity || ''}
                            onChange={(e) => handleInputChange('principal_activity', e.target.value)}
                            placeholder="Enter principal business activity"
                            className="mt-1"
                            rows={3}
                          />
                        ) : (
                          <p className="text-base font-semibold text-slate-800 mt-1 whitespace-pre-wrap">{caseData.principal_activity || '—'}</p>
                        )}
                      </DetailItem>
                    </div>

                    <DetailItem label="Closure Date">
                      {isEditingDetails ? (
                        <Input type="date" value={formatForInput(caseData.closure_date)} onChange={(e) => handleInputChange('closure_date', e.target.value)} className="h-10" />
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-base font-semibold text-slate-800">{formatDate(caseData.closure_date)}</p>
                        </div>
                      )}
                    </DetailItem>

                    <DetailItem label="Closure Reason">
                      {isEditingDetails ? (
                        <Select value={caseData.closure_reason || ''} onValueChange={(value) => handleInputChange("closure_reason", value)}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Case Progressed to Closure">Case Progressed to Closure</SelectItem>
                            <SelectItem value="Alternative IP appointed">Alternative IP appointed</SelectItem>
                            <SelectItem value="Appointment not progressed">Appointment not progressed</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-base font-semibold text-slate-800">{caseData.closure_reason || '—'}</p>
                        </div>
                      )}
                    </DetailItem>

                    <DetailItem label="Date Registered Office Changed">
                      {isEditingDetails ? (
                        <Input type="date" value={formatForInput(caseData.date_registered_office_changed)} onChange={(e) => handleInputChange('date_registered_office_changed', e.target.value)} className="h-10"/>
                      ) : (
                        <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                          <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_registered_office_changed)}</p>
                        </div>
                      )}
                    </DetailItem>

                    <div className="md:col-span-2">
                      <DetailItem label="New Registered Office Address">
                        {isEditingDetails ? (
                          <div className="space-y-2">
                            <Select
                              value={caseData.new_registered_office_address || ''}
                              onValueChange={(value) => handleInputChange("new_registered_office_address", value)}
                            >
                              <SelectTrigger className="h-10">
                                <SelectValue placeholder="Select an address or enter manually" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="C/O Coots & Boots, Suite 35, Unit 2, 94a Wycliffe Road, Northampton, NN1 5JF">
                                  C/O Coots & Boots, Suite 35, Unit 2, 94a Wycliffe Road, Northampton, NN1 5JF
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Textarea
                              value={caseData.new_registered_office_address || ''}
                              onChange={(e) => handleInputChange('new_registered_office_address', e.target.value)}
                              placeholder="Or enter address manually..."
                              className="min-h-[80px]"
                            />
                          </div>
                        ) : (
                          <div className="min-h-[80px] flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                            <p className="text-base font-semibold text-slate-800 whitespace-pre-wrap">
                              {caseData.new_registered_office_office_address || '—'}
                            </p>
                          </div>
                        )}
                      </DetailItem>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Staff Assigned Section */}
            {activeDetailsSection === 'staff_assigned' && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="font-semibold text-base flex items-center gap-2 text-blue-800">
                    <Users2 className="w-4 h-4 text-blue-700" />
                    Staff Assigned
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* IP Details Table */}
                  <div>
                    <h4 className="text-sm font-semibold text-blue-700 mb-3">Insolvency Practitioners</h4>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold text-slate-700">Position</TableHead>
                            <TableHead className="font-semibold text-slate-700">Name</TableHead>
                            <TableHead className="font-semibold text-slate-700">IP Number</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Joint IP Name 1 (Primary) */}
                          <TableRow className="bg-blue-50/30">
                            <TableCell className="font-medium text-slate-700">Joint IP Name 1</TableCell>
                            <TableCell className="font-semibold text-slate-800">
                              {IP_DETAILS_MAP[caseData.ip_name]?.fullName || caseData.ip_name || '—'}
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800">
                              {IP_DETAILS_MAP[caseData.ip_name]?.ipNumber || '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="text-xs">
                                <Lock className="w-3 h-3 mr-1" />
                                Locked
                              </Badge>
                            </TableCell>
                          </TableRow>

                          {/* Joint IP Name 2 */}
                          {caseData.joint_ip_name && (
                            <TableRow className="bg-blue-50/30">
                              <TableCell className="font-medium text-slate-700">Joint IP Name 2</TableCell>
                              <TableCell className="font-semibold text-slate-800">
                                {IP_DETAILS_MAP[caseData.joint_ip_name]?.fullName || caseData.joint_ip_name}
                              </TableCell>
                              <TableCell className="font-semibold text-slate-800">
                                {IP_DETAILS_MAP[caseData.joint_ip_name]?.ipNumber || '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Locked
                                </Badge>
                            </TableCell>
                            </TableRow>
                          )}

                          {/* Joint IP Name 3 */}
                          {caseData.joint_ip_name_2 && (
                            <TableRow className="bg-blue-50/30">
                              <TableCell className="font-medium text-slate-700">Joint IP Name 3</TableCell>
                              <TableCell className="font-semibold text-slate-800">
                                {IP_DETAILS_MAP[caseData.joint_ip_name_2]?.fullName || caseData.joint_ip_name_2}
                              </TableCell>
                              <TableCell className="font-semibold text-slate-800">
                                {IP_DETAILS_MAP[caseData.joint_ip_name_2]?.ipNumber || '—'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary" className="text-xs">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Locked
                                </Badge>
                            </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Team Assignment Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-blue-700 mb-3">Team Assignments</h4>
                    </div>

                    {/* Team Assignment Table - Shows unique assignments per user */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead className="text-center">Assigned Date</TableHead>
                          <TableHead className="text-center">Inactive Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Display unique assignments for primary roles */}
                        {(() => {
                          const roleDisplayMap = {
                            'assigned_user': 'Case Admin',
                            'manager_user': 'Manager',
                            'cashiering_user': 'Cashier'
                          };
                          
                          // First, check current active assignments from case data fields
                          const currentAssignments = [];
                          
                          // Add current assigned_user if exists
                          if (caseData.assigned_user) {
                            const user = availableUsers.find(u => u.email === caseData.assigned_user);
                            currentAssignments.push({
                              role: 'assigned_user',
                              user_email: caseData.assigned_user,
                              user_name: user?.full_name || caseData.assigned_user,
                              assigned_date: getAssignmentDate('assigned_user'),
                              unassigned_date: null,
                              isActive: true
                            });
                          }
                          
                          // Add current manager_user if exists
                          if (caseData.manager_user) {
                            const user = availableUsers.find(u => u.email === caseData.manager_user);
                            currentAssignments.push({
                              role: 'manager_user',
                              user_email: caseData.manager_user,
                              user_name: user?.full_name || caseData.manager_user,
                              assigned_date: getAssignmentDate('manager_user'),
                              unassigned_date: null,
                              isActive: true
                            });
                          }
                          
                          // Add current cashiering_user if exists
                          if (caseData.cashiering_user) {
                            const user = availableUsers.find(u => u.email === caseData.cashiering_user);
                            currentAssignments.push({
                              role: 'cashiering_user',
                              user_email: caseData.cashiering_user,
                              user_name: user?.full_name || caseData.cashiering_user,
                              assigned_date: getAssignmentDate('cashiering_user'),
                              unassigned_date: null,
                              isActive: true
                            });
                          }
                          
                          // Get historical (inactive) assignments from history
                          const historicalAssignments = (caseData.assignment_history || [])
                            .filter(assignment => assignment.unassigned_date)
                            .sort((a, b) => new Date(b.assigned_date || 0) - new Date(a.assigned_date || 0));
                          
                          // Combine current and historical
                          const allAssignments = [...currentAssignments, ...historicalAssignments];
                          
                          return allAssignments.map((assignment, idx) => {
                            const displayRole = roleDisplayMap[assignment.role];
                            const isActive = !assignment.unassigned_date;
                            
                            return (
                              <TableRow key={idx} className={isActive ? 'bg-green-50' : ''}>
                                <TableCell className="font-medium">
                                  {displayRole}
                                  {isActive && (
                                    <Badge className="ml-2 bg-green-600 text-white text-xs">Active</Badge>
                                  )}
                                </TableCell>
                                <TableCell>{assignment.user_name || assignment.user_email || '—'}</TableCell>
                                <TableCell className="text-center">
                                  {assignment.assigned_date ? formatDate(assignment.assigned_date) : '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {assignment.unassigned_date ? formatDate(assignment.unassigned_date) : '—'}
                                </TableCell>
                                <TableCell>
                                  {isActive ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleOpenAssignModal(assignment.role)}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        if (confirm('Remove this assignment history entry?')) {
                                          try {
                                            const updatedHistory = (caseData.assignment_history || []).filter(h => 
                                              !(h.role === assignment.role && 
                                                h.user_email === assignment.user_email && 
                                                h.assigned_date === assignment.assigned_date)
                                            );
                                            
                                            await base44.entities.Case.update(caseData.id, {
                                              assignment_history: updatedHistory
                                            });
                                            
                                            await onCaseUpdate();
                                          } catch (error) {
                                            console.error('Error deleting assignment:', error);
                                            alert('Failed to delete: ' + (error?.message || 'Unknown error'));
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}

                        {/* Additional Staff */}
                        {(caseData.additional_staff || []).map((staff, index) => {
                          const roleDisplayMap = {
                            'assigned_user': 'Case Admin',
                            'manager_user': 'Manager',
                            'cashiering_user': 'Cashier'
                          };
                          const displayRole = roleDisplayMap[staff.role] || staff.role;
                          
                          // Normalize inactive_date for comparison
                          const inactiveDate = staff.inactive_date ? 
                            (typeof staff.inactive_date === 'string' && staff.inactive_date.includes('T') ? 
                              staff.inactive_date.split('T')[0] : 
                              staff.inactive_date) : 
                            null;
                          
                          const isActive = !inactiveDate;
                          
                          return (
                            <TableRow key={staff.id || index} className={isActive ? 'bg-green-50' : ''}>
                              <TableCell className="font-medium">
                                {displayRole}
                                {isActive && (
                                  <Badge className="ml-2 bg-green-600 text-white text-xs">Active</Badge>
                                )}
                              </TableCell>
                              <TableCell>{staff.name}</TableCell>
                              <TableCell className="text-center">
                                {staff.added_date ? formatDate(staff.added_date) : '—'}
                              </TableCell>
                              <TableCell className="text-center">{inactiveDate ? formatDate(inactiveDate) : '—'}</TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditAdditionalStaff(staff)}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Add Button Below Table */}
                    <div className="flex justify-start">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddStaffModal(true)}
                        className="flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Add Team Member
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trading Information Section */}
            {activeDetailsSection === 'trading_information' && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="font-semibold text-base flex items-center gap-2 text-blue-800">
                    <Building className="w-4 h-4 text-blue-700" />
                    Trading Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Trading Name */}
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Trading Name</Label>
                    {isEditingDetails ? (
                      <Input
                        value={caseData.trading_name || ''}
                        onChange={(e) => handleInputChange('trading_name', e.target.value)}
                        placeholder="Enter trading name"
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-base font-semibold text-slate-800 mt-1">{caseData.trading_name || '—'}</p>
                    )}
                  </div>

                  {/* Trading Addresses */}
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Trading Addresses</Label>
                    {isEditingDetails ? (
                      <div className="space-y-3 mt-2">
                        {(caseData.trading_addresses || []).map((address, index) => (
                          <Card key={index} className="p-4 bg-slate-50">
                            <div className="space-y-2">
                              <Input
                                placeholder="Address Line 1"
                                value={address.line1 || ''}
                                onChange={(e) => handleInputChange(`trading_addresses[${index}].line1`, e.target.value)}
                              />
                              <Input
                                placeholder="Address Line 2"
                                value={address.line2 || ''}
                                onChange={(e) => handleInputChange(`trading_addresses[${index}].line2`, e.target.value)}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <Input
                                  placeholder="City"
                                  value={address.city || ''}
                                  onChange={(e) => handleInputChange(`trading_addresses[${index}].city`, e.target.value)}
                                />
                                <Input
                                  placeholder="County"
                                  value={address.county || ''}
                                  onChange={(e) => handleInputChange(`trading_addresses[${index}].county`, e.target.value)}
                                />
                              </div>
                              <Input
                                placeholder="Postcode"
                                value={address.postcode || ''}
                                onChange={(e) => handleInputChange(`trading_addresses[${index}].postcode`, e.target.value)}
                              />
                            </div>
                          </Card>
                        ))}
                        <Button
                          onClick={() => {
                            const newAddresses = [...(caseData.trading_addresses || []), { line1: '', line2: '', city: '', county: '', postcode: '' }];
                            handleInputChange('trading_addresses', newAddresses);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Address
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {(caseData.trading_addresses || []).length === 0 ? (
                          <p className="text-sm text-slate-500">No trading addresses added</p>
                        ) : (
                          (caseData.trading_addresses || []).map((address, index) => (
                            <div key={index} className="p-3 bg-slate-50 rounded-md border">
                              <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap">
                                {formatAddress(address)}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Date Ceasing Trade */}
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Date Ceasing Trade</Label>
                    {isEditingDetails ? (
                      <Input
                        type="date"
                        value={formatForInput(caseData.date_ceasing_trade)}
                        onChange={(e) => handleInputChange('date_ceasing_trade', e.target.value)}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-base font-semibold text-slate-800 mt-1">{formatDate(caseData.date_ceasing_trade)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meetings & Resolutions Section */}
            {activeDetailsSection === 'meetings_resolutions' && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="font-semibold text-base flex items-center gap-2 text-blue-800">
                    <Users className="w-4 h-4 text-blue-700" />
                    Meetings & Resolutions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* N/A Checkbox */}
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    {isEditingDetails ? (
                      <Checkbox
                        id="meetings_resolutions_na"
                        checked={caseData.meetings_resolutions_na || false}
                        onCheckedChange={(checked) => handleInputChange('meetings_resolutions_na', !!checked)}
                      />
                    ) : (
                      <div className="w-5 h-5 border-2 rounded-md flex items-center justify-center bg-white border-blue-200">
                        {caseData.meetings_resolutions_na && <Check className="w-3.5 h-3.5 text-blue-700" />}
                      </div>
                    )}
                    <Label htmlFor="meetings_resolutions_na" className="text-base font-semibold text-slate-800">
                      Meetings & Resolutions Not Applicable
                    </Label>
                  </div>

                  {!caseData.meetings_resolutions_na && (
                    <>
                      {/* Board Meeting Details */}
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-blue-700">Board Meeting</h4>
                        
                        <div>
                          <Label className="text-sm font-medium text-slate-600">Board Meeting Date & Time</Label>
                          {isEditingDetails ? (
                            <Input
                              type="datetime-local"
                              value={caseData.board_meeting_date ? caseData.board_meeting_date.slice(0, 16) : ''}
                              onChange={(e) => handleInputChange('board_meeting_date', e.target.value)}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{formatDateTime(caseData.board_meeting_date)}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-slate-600">Board Meeting Location</Label>
                          {isEditingDetails ? (
                            <Input
                              value={caseData.board_meeting_location || ''}
                              onChange={(e) => handleInputChange('board_meeting_location', e.target.value)}
                              placeholder="Enter location"
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{caseData.board_meeting_location || '—'}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-slate-600">Board Resolution Passed Date</Label>
                          {isEditingDetails ? (
                            <Input
                              type="date"
                              value={formatForInput(caseData.board_resolution_passed_date)}
                              onChange={(e) => handleInputChange('board_resolution_passed_date', e.target.value)}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{formatDate(caseData.board_resolution_passed_date)}</p>
                          )}
                        </div>
                      </div>

                      {/* Members Meeting/Resolution Details */}
                      <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-blue-700">Members Resolution</h4>

                        <div>
                          <Label className="text-sm font-medium text-slate-600">Members Meeting Type</Label>
                          {isEditingDetails ? (
                            <Select
                              value={caseData.members_meeting_type || ''}
                              onValueChange={(value) => handleInputChange('members_meeting_type', value)}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Physical Meeting">Physical Meeting</SelectItem>
                                <SelectItem value="Virtual Meeting">Virtual Meeting</SelectItem>
                                <SelectItem value="Written Resolution">Written Resolution</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{caseData.members_meeting_type || '—'}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-slate-600">Members Meeting Date & Time</Label>
                          {isEditingDetails ? (
                            <Input
                              type="datetime-local"
                              value={caseData.members_meeting_date ? caseData.members_meeting_date.slice(0, 16) : ''}
                              onChange={(e) => handleInputChange('members_meeting_date', e.target.value)}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{formatDateTime(caseData.members_meeting_date)}</p>
                          )}
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium text-slate-600">Members Meeting Location</Label>
                          {isEditingDetails ? (
                            <Input
                              value={caseData.members_meeting_location || ''}
                              onChange={(e) => handleInputChange('members_meeting_location', e.target.value)}
                              placeholder="Enter location"
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{caseData.members_meeting_location || '—'}</p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-medium text-slate-600">Date Members Meeting Resolution Passed</Label>
                          {isEditingDetails ? (
                            <Input
                              type="date"
                              value={formatForInput(caseData.members_resolution_date)}
                              onChange={(e) => handleInputChange('members_resolution_date', e.target.value)}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-base font-semibold text-slate-800 mt-1">{formatDate(caseData.members_resolution_date)}</p>
                          )}
                        </div>
                      </div>

                      {/* Creditors Decision Procedure - Only if NOT MVL */}
                      {caseData.case_type !== 'MVL' && (
                        <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                          <h4 className="font-semibold text-blue-700">Creditors Decision Procedure</h4>

                          <div>
                            <Label className="text-sm font-medium text-slate-600">Procedure Type</Label>
                            {isEditingDetails ? (
                              <Select
                                value={caseData.creditors_decisions_procedure_type || ''}
                                onValueChange={(value) => handleInputChange('creditors_decisions_procedure_type', value)}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Deemed Consent">Deemed Consent</SelectItem>
                                  <SelectItem value="Virtual Meeting">Virtual Meeting</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-base font-semibold text-slate-800 mt-1">{caseData.creditors_decisions_procedure_type || '—'}</p>
                            )}
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-slate-600">Convened By</Label>
                            {isEditingDetails ? (
                              <Select
                                value={caseData.creditors_decisions_convened_by || ''}
                                onValueChange={(value) => handleInputChange('creditors_decisions_convened_by', value)}
                              >
                                <SelectTrigger className="mt-1">
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Team">Team</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <p className="text-base font-semibold text-slate-800 mt-1">{caseData.creditors_decisions_convened_by || '—'}</p>
                            )}
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-slate-600">Decision Passed Date</Label>
                            {isEditingDetails ? (
                              <Input
                                type="date"
                                value={formatForInput(caseData.creditors_decision_passed_date)}
                                onChange={(e) => handleInputChange('creditors_decision_passed_date', e.target.value)}
                                className="mt-1"
                              />
                            ) : (
                              <p className="text-base font-semibold text-slate-800 mt-1">{formatDate(caseData.creditors_decision_passed_date)}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tax Details Section */}
            {activeDetailsSection === 'tax_details' && (
              <Card className="bg-white rounded-xl shadow-sm border-slate-200/80">
                <CardHeader>
                  <CardTitle className="font-semibold text-base flex items-center gap-2 text-blue-800">
                    <Landmark className="w-4 h-4 text-blue-700" />
                    Tax Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {isEditingDetails ? (
                      <Checkbox id="vat_registered" checked={caseData.vat_registered} onCheckedChange={(checked) => handleInputChange('vat_registered', !!checked)}/>
                    ) : (
                      <div className="w-5 h-5 border-2 rounded-md flex items-center justify-center bg-slate-50 border-slate-200">
                        {caseData.vat_registered && <Check className="w-3.5 h-3.5 text-blue-700" />}
                      </div>
                    )}
                    <Label htmlFor="vat_registered" className="text-base font-semibold text-slate-800">VAT Registered</Label>
                  </div>

                  {caseData.vat_registered && (
                    <div className="space-y-4 pl-8">
                      <DetailItem label="VAT Number">
                        {isEditingDetails ? (
                          <Input id="vat_number" value={caseData.vat_number || ''} onChange={(e) => handleInputChange('vat_number', e.target.value)} placeholder="Enter VAT number" className="h-10"/>
                        ) : (
                          <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                            <p className="text-base font-semibold text-slate-800">{caseData.vat_number || '—'}</p>
                          </div>
                        )}
                      </DetailItem>

                      <DetailItem label="Date of Last VAT Return">
                        {isEditingDetails ? (
                          <Input id="date_of_last_vat_return" type="date" value={formatForInput(caseData.date_of_last_vat_return)} onChange={(e) => handleInputChange('date_of_last_vat_return', e.target.value)} className="h-10"/>
                        ) : (
                          <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                            <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_of_last_vat_return)}</p>
                          </div>
                        )}
                      </DetailItem>

                      <DetailItem label="Date of VAT De-Registration">
                        {isEditingDetails ? (
                          <Input id="date_of_vat_deregistration" type="date" value={formatForInput(caseData.date_of_vat_deregistration)} onChange={(e) => handleInputChange('date_of_vat_deregistration', e.target.value)} className="h-10"/>
                        ) : (
                          <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                            <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_of_vat_deregistration)}</p>
                          </div>
                        )}
                      </DetailItem>
                    </div>
                  )}

                  <DetailItem label="CT Number">
                    {isEditingDetails ? (
                      <Input id="ct_number" value={caseData.ct_number || ''} onChange={(e) => handleInputChange('ct_number', e.target.value)} className="h-10" />
                    ) : (
                      <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                        <p className="text-base font-semibold text-slate-800">{caseData.ct_number || '—'}</p>
                      </div>
                    )}
                  </DetailItem>

                  <DetailItem label="Last CT Return">
                    {isEditingDetails ? (
                      <Input id="date_of_last_ct_return" type="date" value={formatForInput(caseData.date_of_last_ct_return)} onChange={(e) => handleInputChange('date_of_last_ct_return', e.target.value)} className="h-10" />
                    ) : (
                      <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                        <p className="text-base font-semibold text-slate-800">{formatDate(caseData.date_of_last_ct_return)}</p>
                        </div>
                    )}
                  </DetailItem>

                  <DetailItem label="Employer PAYE Reference">
                    {isEditingDetails ? (
                      <Input id="employer_paye_reference" value={caseData.employer_paye_reference || ''} onChange={(e) => handleInputChange('employer_paye_reference', e.target.value)} placeholder="Enter PAYE reference" className="h-10" />
                    ) : (
                      <div className="h-10 flex items-center px-3 border border-slate-200 rounded-md bg-slate-50">
                        <p className="text-base font-semibold text-slate-800">{caseData.employer_paye_reference || '—'}</p>
                      </div>
                    )}
                  </DetailItem>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}