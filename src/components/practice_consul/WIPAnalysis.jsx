import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input'; // Added Input import
import { base44 } from '@/api/base44Client';
import { PoundSterling, Loader2, TrendingUp, User, Clock, X, Building, FileText, Upload, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Hourly rates for calculating WIP
const HOURLY_RATES = {
  Partner: 700,
  Manager: 500,
  Executive: 250,
  Secretary: 70
};

export default function WIPAnalysis() {
  const [cases, setCases] = useState([]);
  const [timesheetEntries, setTimesheetEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedCase, setSelectedCase] = useState(null);
  const [searchTerm, setSearchTerm] = useState(''); // Added searchTerm state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [casesData, timesheetsData, usersData] = await Promise.all([
        base44.entities.Case.list('-appointment_date'),
        base44.entities.TimesheetEntry.list(),
        base44.entities.User.list()
      ]);
      
      setCases(casesData || []);
      setTimesheetEntries(timesheetsData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading WIP data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateWIP = (caseReference, isPreAppointment = false) => {
    let caseTimesheets = timesheetEntries.filter(
      entry => entry.case_reference === caseReference && (entry.status === 'approved' || (isPreAppointment && entry.status === 'submitted'))
    );

    // Filter for pre-appointment entries if in pre-appointment mode
    if (isPreAppointment) {
      caseTimesheets = caseTimesheets.filter(entry => {
        const taskDesc = (entry.task_description || '').toLowerCase();
        const narrative = (entry.narrative || '').toLowerCase();
        const activity = (entry.activity || '').toLowerCase();
        return taskDesc.includes('pre-appointment') || 
               taskDesc.includes('pre appointment') ||
               narrative.includes('pre-appointment') || 
               narrative.includes('pre appointment') ||
               activity.includes('pre-appointment') ||
               activity.includes('pre appointment');
      });
    }

    let totalWIP = 0;
    caseTimesheets.forEach(entry => {
      const user = users.find(u => u.email === entry.user_email);
      const hourlyRate = user?.hourly_rate || 250; // Default to £250 if not set
      const hours = entry.duration_seconds / 3600;
      // Only add to WIP if billable
      if (entry.billable !== false) {
        totalWIP += hours * hourlyRate;
      }
    });

    return totalWIP;
  };

  const getWIPBreakdown = (caseReference, isPreAppointment = false) => {
    let caseTimesheets = timesheetEntries.filter(
      entry => entry.case_reference === caseReference && (entry.status === 'approved' || (isPreAppointment && entry.status === 'submitted'))
    );

    // Filter for pre-appointment entries if needed
    if (isPreAppointment) {
      caseTimesheets = caseTimesheets.filter(entry => {
        const taskDesc = (entry.task_description || '').toLowerCase();
        const narrative = (entry.narrative || '').toLowerCase();
        const activity = (entry.activity || '').toLowerCase();
        return taskDesc.includes('pre-appointment') || 
               taskDesc.includes('pre appointment') ||
               narrative.includes('pre-appointment') || 
               narrative.includes('pre appointment') ||
               activity.includes('pre-appointment') ||
               activity.includes('pre appointment');
      });
    }

    const breakdown = {
      Partner: { hours: 0, cost: 0 },
      Manager: { hours: 0, cost: 0 },
      Executive: { hours: 0, cost: 0 },
      Secretary: { hours: 0, cost: 0 }
    };

    const userBreakdown = {};

    caseTimesheets.forEach(entry => {
      const user = users.find(u => u.email === entry.user_email);
      const userGrade = user?.grade || 'Case Admin';
      const hourlyRate = user?.hourly_rate || 250; // Default to £250 if not set
      
      const hours = entry.duration_seconds / 3600;
      const cost = entry.billable !== false ? hours * hourlyRate : 0;

      // Map grade to breakdown category
      let breakdownCategory = userGrade;
      if (userGrade === 'IP') breakdownCategory = 'Partner';
      if (userGrade === 'Case Admin') breakdownCategory = 'Executive';
      
      // Initialize breakdown category if it doesn't exist
      if (!breakdown[breakdownCategory]) {
        breakdown[breakdownCategory] = { hours: 0, cost: 0 };
      }

      breakdown[breakdownCategory].hours += hours;
      breakdown[breakdownCategory].cost += cost;

      if (!userBreakdown[entry.user_email]) {
        userBreakdown[entry.user_email] = {
          name: entry.user_name,
          role: userGrade,
          hours: 0,
          cost: 0
        };
      }
      userBreakdown[entry.user_email].hours += hours;
      userBreakdown[entry.user_email].cost += cost;
    });

    return { breakdown, userBreakdown: Object.values(userBreakdown), timesheetEntries: caseTimesheets };
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatHours = (hours) => {
    return hours.toFixed(2);
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  const getFeeEstimate = (caseData) => {
    if (caseData.fee_estimate_data) {
      try {
        const feeData = JSON.parse(caseData.fee_estimate_data);
        let total = 0;
        if (Array.isArray(feeData)) {
          feeData.forEach(row => {
            const partnerCost = (row.partner_hours || 0) * HOURLY_RATES.Partner;
            const managerCost = (row.manager_hours || 0) * HOURLY_RATES.Manager;
            const executiveCost = (row.executive_hours || 0) * HOURLY_RATES.Executive;
            const secretaryCost = (row.secretary_hours || 0) * HOURLY_RATES.Secretary;
            total += partnerCost + managerCost + executiveCost + secretaryCost;
          });
        }
        return total;
      } catch (e) {
        return 0;
      }
    }
    return 0;
  };

  const getFeeBasis = (caseData) => {
    const basis = [];
    if (caseData.fee_resolution_fixed) basis.push('Fixed Fee');
    if (caseData.fee_resolution_time_costs) basis.push('Time Costs');
    if (caseData.fee_resolution_percentage) basis.push('% of Realisations');
    
    return basis.length > 0 ? basis.join(', ') : 'Not Set';
  };

  const postAppointmentCases = cases.filter(c => c.status === 'active' && c.appointment_date);
  const preAppointmentCases = cases; // Show all cases in Pre Appointment tab

  // Filter cases based on search term
  const filteredPostAppointmentCases = postAppointmentCases.filter(c => 
    !searchTerm || c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.case_reference.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const filteredPreAppointmentCases = preAppointmentCases.filter(c => 
    !searchTerm || c.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.case_reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCSVUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: file_url,
        json_schema: {
          type: "object",
          properties: {
            timesheets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  user_email: { type: "string" },
                  user_name: { type: "string" },
                  case_reference: { type: "string" },
                  task_description: { type: "string" },
                  activity: { type: "string" },
                  narrative: { type: "string" },
                  duration_seconds: { type: "number" },
                  billable: { type: "boolean" },
                  status: { type: "string" }
                }
              }
            }
          }
        }
      });

      if (result.status === 'success' && result.output?.timesheets) {
        await base44.entities.TimesheetEntry.bulkCreate(result.output.timesheets);
        await loadData();
        alert(`Successfully uploaded ${result.output.timesheets.length} timesheet entries`);
      } else {
        throw new Error(result.details || 'Failed to extract data from CSV');
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      setUploadError(error.message || 'Failed to upload CSV file');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const renderCaseTable = (casesList, isPreAppointment = false) => {
    if (casesList.length === 0) {
      return (
        <div className="h-[calc(100vh-24rem)] flex items-center justify-center text-center py-12 text-slate-500">
          <div className="space-y-4">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto" />
            <p className="font-medium">No cases found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-[calc(100vh-24rem)] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-white">
            <TableRow className="bg-blue-50">
              <TableHead className="font-semibold py-1">Case Reference</TableHead>
              <TableHead className="font-semibold py-1">Company Name</TableHead>
              <TableHead className="font-semibold py-1">Case Type</TableHead>
              <TableHead className="font-semibold py-1">Appointment Date</TableHead>
              <TableHead className="font-semibold text-right py-1">{isPreAppointment ? 'Pre-App WIP' : 'Current WIP'}</TableHead>
              {!isPreAppointment && (
                <>
                  <TableHead className="font-semibold text-right py-1">Fee Estimate</TableHead>
                  <TableHead className="font-semibold text-right py-1">Fee Basis</TableHead>
                  <TableHead className="font-semibold text-right py-1">% Complete</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {casesList.map((case_) => {
              const currentWIP = calculateWIP(case_.case_reference, isPreAppointment);
              const feeEstimate = !isPreAppointment ? getFeeEstimate(case_) : 0;
              const percentComplete = feeEstimate > 0 ? (currentWIP / feeEstimate) * 100 : 0;
              
              return (
                <TableRow 
                  key={case_.id}
                  className="hover:bg-slate-50 cursor-pointer h-10"
                  onClick={() => setSelectedCase(case_)}
                >
                  <TableCell className="font-mono font-medium py-1 whitespace-nowrap">{case_.case_reference}</TableCell>
                  <TableCell className="font-medium py-1 whitespace-nowrap">{case_.company_name}</TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    <Badge variant="outline">{case_.case_type}</Badge>
                  </TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    {case_.appointment_date 
                      ? new Date(case_.appointment_date).toLocaleDateString('en-GB')
                      : '—'
                    }
                  </TableCell>
                  <TableCell className="text-right font-semibold py-1 whitespace-nowrap">
                    {formatCurrency(currentWIP)}
                  </TableCell>
                  {!isPreAppointment && (
                    <>
                      <TableCell className="text-right py-1 whitespace-nowrap">
                        {feeEstimate > 0 ? formatCurrency(feeEstimate) : '—'}
                      </TableCell>
                      <TableCell className="text-right py-1 whitespace-nowrap">
                        <span className="text-sm">{getFeeBasis(case_)}</span>
                      </TableCell>
                      <TableCell className="text-right py-1 whitespace-nowrap">
                        {feeEstimate > 0 ? (
                          <span className={`font-semibold ${
                            percentComplete > 100 ? 'text-red-600' : 
                            percentComplete > 80 ? 'text-amber-600' : 
                            'text-green-600'
                          }`}>
                            {percentComplete.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mx-[-2cm]">
      {/* Cases Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-6">
            <CardTitle className="flex items-center gap-2 text-blue-600">
              Work in Progress Analysis
              <PoundSterling className="w-5 h-5" />
            </CardTitle>

            {/* Upload Section */}
            <div className="flex flex-row items-center gap-4 flex-nowrap">
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={isUploading}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload">
                <Button 
                  asChild
                  disabled={isUploading}
                  className="cursor-pointer whitespace-nowrap"
                >
                  <span>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload CSV
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <Info 
                className="w-4 h-4 text-slate-400 cursor-help" 
                title="Upload a CSV file containing timesheet data to import into the system"
              />
              {uploadError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-md text-red-800 text-xs whitespace-nowrap">
                  {uploadError}
                </div>
              )}
            </div>

            <div className="w-96">
              <Input
                placeholder="Search by case name or reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="active">
                Post Appointment ({filteredPostAppointmentCases.length})
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                Pre Appointment ({filteredPreAppointmentCases.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              {renderCaseTable(filteredPostAppointmentCases, false)}
            </TabsContent>

            <TabsContent value="pipeline">
              {renderCaseTable(filteredPreAppointmentCases, true)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Full Screen Case Details Modal */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900">
                  {selectedCase?.company_name}
                </DialogTitle>
                <p className="text-sm text-slate-500 font-mono">{selectedCase?.case_reference}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 pt-3 pb-6">
            {selectedCase && (() => {
              // Determine if we're viewing a pre-appointment case based on active tab
              const isPreAppView = activeTab === 'pipeline';
              const { breakdown, userBreakdown, timesheetEntries: caseTimesheetEntries } = getWIPBreakdown(selectedCase.case_reference, isPreAppView);

              // Prepare chart data for staff members
              // const chartData = userBreakdown.map(user => ({
              //   name: user.name,
              //   WIP: parseFloat(user.cost.toFixed(2)),
              //   Hours: parseFloat(user.hours.toFixed(2))
              // }));

              return (
                <div className="space-y-3">
                  {/* WIP Breakdown by Role */}
                  <Card className="border-slate-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Clock className="w-5 h-5 text-blue-600" />
                        WIP Breakdown by Role
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {Object.values(breakdown).every(data => data.hours === 0) ? (
                        <div className="text-center py-8 text-slate-500">
                          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="font-medium">No {isPreAppView ? 'pre-appointment' : ''} time entries found</p>
                          <p className="text-sm mt-1">
                            {isPreAppView 
                              ? 'Time entries must include "pre-appointment" or "pre appointment" in the task description, narrative, or activity field.'
                              : 'No approved timesheet entries for this case.'}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                          {Object.entries(breakdown).map(([role, data]) => (
                            data.hours > 0 && (
                              <div key={role} className="p-4">
                                <p className="text-sm font-medium text-slate-600 mb-2">
                                  {role === 'Partner' ? 'Insolvency Practitioner' : role}
                                </p>
                                <div className="flex items-baseline gap-2">
                                  <p className="text-2xl font-bold text-blue-600">{formatHours(data.hours)}h</p>
                                  <p className="text-2xl font-bold text-green-700">{formatCurrency(data.cost)}</p>
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* WIP Breakdown by User */}
                  {userBreakdown.length > 0 && (
                    <Card className="border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <User className="w-5 h-5 text-blue-600" />
                          WIP Breakdown by User
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 border-slate-200">
                              <TableHead className="font-semibold text-xs">User</TableHead>
                              <TableHead className="font-semibold text-xs">Role</TableHead>
                              <TableHead className="font-semibold text-right text-xs">Hours</TableHead>
                              <TableHead className="font-semibold text-right text-xs">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {userBreakdown.map((user, idx) => (
                              <TableRow key={idx} className="border-slate-200">
                                <TableCell className="font-medium text-sm py-2">{user.name}</TableCell>
                                <TableCell className="py-2">
                                  <Badge variant="outline" className="text-xs">{user.role}</Badge></TableCell>
                                <TableCell className="text-right text-sm font-semibold py-2">{formatHours(user.hours)}h</TableCell>
                                <TableCell className="text-right text-sm font-bold py-2">{formatCurrency(user.cost)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detailed Timesheet Entries */}
                  {caseTimesheetEntries.length > 0 && (
                    <Card className="border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                          Detailed Time Entries ({caseTimesheetEntries.length} approved entries)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-slate-50 border-slate-200">
                                <TableHead className="font-semibold text-xs">Date</TableHead>
                                <TableHead className="font-semibold text-xs">User</TableHead>
                                <TableHead className="font-semibold text-xs">Task</TableHead>
                                <TableHead className="font-semibold text-xs">Activity</TableHead>
                                <TableHead className="font-semibold text-xs">Narrative</TableHead>
                                <TableHead className="font-semibold text-right text-xs">Duration</TableHead>
                                <TableHead className="font-semibold text-center text-xs">Billable</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {caseTimesheetEntries
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((entry) => (
                                <TableRow key={entry.id} className="border-slate-200">
                                  <TableCell className="whitespace-nowrap text-xs py-2">
                                    {new Date(entry.date).toLocaleDateString('en-GB')}
                                  </TableCell>
                                  <TableCell className="font-medium text-xs py-2">{entry.user_name}</TableCell>
                                  <TableCell className="text-xs py-2">{entry.task_description || '—'}</TableCell>
                                  <TableCell className="text-xs py-2">{entry.activity || '—'}</TableCell>
                                  <TableCell className="max-w-md py-2">
                                    <div className="text-xs text-slate-600 line-clamp-2">
                                      {entry.narrative || '—'}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-xs py-2">
                                    {formatDuration(entry.duration_seconds)}
                                  </TableCell>
                                  <TableCell className="text-center py-2">
                                    {entry.billable ? (
                                      <Badge className="bg-green-100 text-green-800 text-xs">Yes</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">No</Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}