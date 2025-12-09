import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  FileText,
  CheckSquare,
  TrendingUp,
  Clock,
  PoundSterling,
  ArrowLeft,
  Upload,
  Loader2,
  User,
  AlertCircle,
  FileEdit
} from 'lucide-react';
import TimesheetApproval from '../components/practice_consul/TimesheetApproval';
import WIPAnalysis from '../components/practice_consul/WIPAnalysis';
import ActiveCaseList from '../components/practice_consul/ActiveCaseList';
import ResourcePlanning from '../components/practice_consul/ResourcePlanning';
import ProtectedPage from '../components/utils/ProtectedPage';
import { base44 } from '@/api/base44Client';

const FeatureCard = ({ icon: Icon, title, description, onClick }) => (
  <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-slate-600">{description}</p>
    </CardContent>
  </Card>
);

export default function PracticeConsul() {
  const [activeView, setActiveView] = useState('overview');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [timesheetTab, setTimesheetTab] = useState('pending');
  const [currentUser, setCurrentUser] = useState(null); // State to store current user data

  // Fetch current user details on component mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await base44.auth.me();
        console.log('=== PRACTICE CONSUL USER CHECK ===');
        console.log('Current user loaded:', user);
        console.log('User email:', user?.email);
        console.log('User name:', user?.full_name);
        console.log('User grade:', user?.grade);
        console.log('==================================');
        setCurrentUser(user);
      } catch (error) {
        console.error("Failed to fetch current user:", error);
        // Optionally handle error, e.g., redirect or show a message
      }
    };
    fetchCurrentUser();
  }, []); // Empty dependency array ensures this runs once on mount


  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    setUploadError(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  user_email: { type: "string" },
                  user_name: { type: "string" },
                  date: { type: "string" },
                  case_reference: { type: "string" },
                  task_description: { type: "string" },
                  narrative: { type: "string" },
                  duration_hours: { type: "number" },
                  billable: { type: "boolean" }
                }
              }
            }
          }
        }
      });

      if (extractResult.status === "success" && extractResult.output?.entries) {
        const entries = extractResult.output.entries.map(entry => ({
          ...entry,
          duration_seconds: Math.round((entry.duration_hours || 0) * 3600),
          status: 'approved',
          approved_date: new Date().toISOString()
        }));

        await base44.entities.TimesheetEntry.bulkCreate(entries);
        alert(`Successfully imported ${entries.length} timesheet entries`);
        setRefreshKey(prev => prev + 1);
      } else {
        setUploadError('Could not extract timesheet data. Please ensure your Excel file has columns: User Email, User Name, Date, Case Reference, Task Description, Narrative, Duration (Hours), Billable');
      }
    } catch (error) {
      console.error('Error uploading timesheet file:', error);
      setUploadError('Failed to upload file: ' + error.message);
    } finally {
      setUploadingFile(false);
      event.target.value = '';
    }
  };

  const features = [
    {
      icon: FileText,
      title: 'Custom Reports',
      description: 'Generate tailored reports for practice management, case analysis, and performance metrics.',
      view: 'custom_reports'
    },
    {
      icon: CheckSquare,
      title: 'Timesheet Approval',
      description: 'Review and approve timesheets submitted by team members with detailed time tracking.',
      view: 'timesheet_approval',
      requiredGrades: ['IP', 'Manager'] // Manager grade now has access
    },
    {
      icon: TrendingUp,
      title: 'Case Time Cost Budget',
      description: 'Monitor case budgets, track time costs, and review Work in Progress (WIP) against estimates.',
      view: 'case_budget'
    },
    {
      icon: PoundSterling,
      title: 'WIP Analysis',
      description: 'Analyze unbilled work in progress across cases and team members.',
      view: 'wip_analysis'
    },
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      description: 'Track key performance indicators and practice efficiency metrics.',
      view: 'performance'
    },
    {
      icon: Clock,
      title: 'Resource Planning',
      description: 'Manage team capacity, workload distribution, and resource allocation.',
      view: 'resource_planning'
    }
  ];

  // Filter features based on user grade
  const visibleFeatures = features.filter(feature => {
    // If feature has no grade restrictions, show it to everyone
    if (!feature.requiredGrades) {
      return true;
    }

    // If user hasn't loaded yet, hide restricted features temporarily
    if (!currentUser) {
      return false;
    }

    // Check if user's grade is in the required grades list
    const userGrade = currentUser.grade;
    const hasAccess = feature.requiredGrades.includes(userGrade);
    
    console.log(`[FEATURE CHECK] "${feature.title}" - Required: [${feature.requiredGrades.join(', ')}] | User grade: "${userGrade}" | Access: ${hasAccess}`);

    return hasAccess;
  });

  // Check if current user has access to the active view
  const canAccessActiveView = () => {
    if (activeView === 'overview') return true;
    
    const feature = features.find(f => f.view === activeView);
    if (!feature) return true; // Unknown view, let it through

    if (!feature.requiredGrades) return true; // No restrictions
    
    if (!currentUser) return false; // User not loaded yet
    
    const hasAccess = feature.requiredGrades.includes(currentUser.grade);
    
    console.log(`[VIEW ACCESS CHECK] View: "${activeView}" | User grade: "${currentUser.grade}" | Access: ${hasAccess}`);
    
    return hasAccess;
  };

  console.log('=== RENDER INFO ===');
  console.log('Active view:', activeView);
  console.log('Current user grade:', currentUser?.grade);
  console.log('Visible features:', visibleFeatures.map(f => f.title));
  console.log('Can access active view:', canAccessActiveView());
  console.log('==================');

  return (
    <ProtectedPage requiredPermission="practice_consul" pageName="Practice Consul">
      <div className="min-h-screen p-6 md:p-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-blue-700" />
              <h1 className="text-3xl font-bold font-display text-slate-900">Practice Consul</h1>
            </div>
            <p className="text-slate-600 text-lg">
              Comprehensive practice management and reporting tools
            </p>
          </div>

          {/* Back Button and Navigation on Same Row */}
          {activeView !== 'overview' && (
            <div className="flex items-center justify-between mb-6">
              <Button
                variant="outline"
                onClick={() => setActiveView('overview')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Overview
              </Button>

              {activeView === 'timesheet_approval' && canAccessActiveView() && (
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    onClick={() => setTimesheetTab('draft')}
                    className={`bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 ${timesheetTab === 'draft' ? 'text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <FileEdit className="w-4 h-4 mr-2" />
                    Draft Timesheets
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={() => setTimesheetTab('pending')}
                    className={`bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 ${timesheetTab === 'pending' || timesheetTab === 'approved' || timesheetTab === 'rejected' ? 'text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Timesheet Approval
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setTimesheetTab('user_timesheets')}
                    className={`bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 ${timesheetTab === 'user_timesheets' ? 'text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    <User className="w-4 h-4 mr-2" />
                    User Timesheets
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-3">
                {activeView === 'timesheet_approval' && canAccessActiveView() && (
                  <Label htmlFor="timesheet-upload" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                      {uploadingFile ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      ) : (
                        <><Upload className="w-4 h-4" /> Upload Excel</>
                      )}
                    </div>
                    <Input
                      id="timesheet-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </Label>
                )}
              </div>
            </div>
          )}

          {/* Upload Error Message */}
          {uploadError && activeView === 'timesheet_approval' && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md mb-6">
              <p className="font-medium">Upload Error</p>
              <p className="text-sm">{uploadError}</p>
            </div>
          )}

          {/* Content */}
          {activeView === 'overview' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleFeatures.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  onClick={() => setActiveView(feature.view)}
                />
              ))}
            </div>
          ) : !canAccessActiveView() ? (
            <Card className="border-red-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h2>
                  <p className="text-slate-600 mb-4">
                    This feature is only available to IP and Manager grade users.
                  </p>
                  {currentUser?.grade && (
                    <p className="text-sm text-slate-500 mb-6">
                      Your current grade: <span className="font-semibold">{currentUser.grade}</span>
                    </p>
                  )}
                  <Button
                    onClick={() => setActiveView('overview')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Return to Overview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : activeView === 'timesheet_approval' ? (
            <TimesheetApproval key={refreshKey} activeTab={timesheetTab} onTabChange={setTimesheetTab} />
          ) : activeView === 'wip_analysis' ? (
            <WIPAnalysis />
          ) : activeView === 'custom_reports' ? (
            <ActiveCaseList />
          ) : activeView === 'resource_planning' ? (
            <ResourcePlanning />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-slate-500">
                  <p className="text-lg font-medium">Coming Soon</p>
                  <p className="text-sm mt-2">This feature is under development</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}