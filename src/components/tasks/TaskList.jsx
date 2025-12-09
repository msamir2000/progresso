
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Case } from '@/api/entities';
import { User } from '@/api/entities';
import { TaskTemplate } from '@/api/entities';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Loader2,
  FileText
} from 'lucide-react';
import CVLTaskList from './CVLTaskList';

const TaskList = ({ caseData, onUpdate }) => {
  const [tasks, setTasks] = useState([]); // Added new state for tasks from template
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTasksProgress, setCurrentTasksProgress] = useState(caseData.tasks_progress || []);
  const [taskTemplate, setTaskTemplate] = useState(null);
  const [initialProgressCalculated, setInitialProgressCalculated] = useState(false);
  
  // Use a ref to track if initial data (user/template) has been loaded for the *current caseData.id*.
  // This ref is set to true once successfully loaded and reset when caseData.id changes.
  const hasLoadedInitialDataRef = React.useRef(false); 
  
  // Use a ref to store the last caseData.id for which we initiated a data load.
  // This helps prevent unnecessary re-loads when only other props change.
  const lastProcessedCaseIdRef = React.useRef(null);

  const loadCurrentUser = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
      // Don't set global error here, as it might overwrite more critical task data errors
    }
  };

  // Combined and managed initial data loading
  useEffect(() => {
    const loadTaskTemplate = async () => {
      try {
        const templates = await TaskTemplate.list();
        let template = null;
        
        if (caseData.case_type === 'CVL') {
          template = templates.find(t => t.case_type === 'CVL' && t.is_default) ||
                    templates.find(t => t.case_type === 'CVL');
        } else if (caseData.case_type === 'MVL') {
          template = templates.find(t => t.case_type === 'MVL' && t.template_name === '1 september 2025') ||
                    templates.find(t => t.case_type === 'MVL' && t.is_default) ||
                    templates.find(t => t.case_type === 'MVL');
        }
        
        if (template) {
          setTaskTemplate(template);
          setTasks(template.tasks || []);
        }
      } catch (error) {
        console.error('Error loading task template:', error);
        setError('Failed to load task template');
      }
    };

    const loadInitialData = async () => {
      // Show loading spinner if it's the very first time loading data for a specific case ID,
      // or if the previous load for this ID failed.
      if (!hasLoadedInitialDataRef.current) {
        setIsLoading(true);
      }
      setInitialProgressCalculated(false); // Reset calculation status for new load attempt
      setError(null); // Clear any previous errors

      try {
        await loadCurrentUser();
        // Load template if CVL or MVL case type
        if (caseData.case_type === 'CVL' || caseData.case_type === 'MVL') {
          await loadTaskTemplate();
        }
        // Mark that initial data (user and template) has been loaded for this case.
        hasLoadedInitialDataRef.current = true;
        setInitialProgressCalculated(true); // Now that template and user data are loaded, progress can be calculated.
      } catch (err) {
        console.error('Error loading initial TaskList data:', err);
        // Only set a general error message if it's the initial load that failed.
        if (!hasLoadedInitialDataRef.current) {
          setError('Failed to load task data. Please try again.');
        }
        // If initial load failed, ensure the flag is not set so it can try again
        hasLoadedInitialDataRef.current = false;
      } finally {
        setIsLoading(false); // Always turn off loading at the end of the load attempt.
      }
    };

    // Logic to reset loading flags when caseData.id changes
    if (caseData?.id && lastProcessedCaseIdRef.current !== caseData.id) {
        // A new case ID has been provided, so reset the "initial loaded" flag
        hasLoadedInitialDataRef.current = false;
        lastProcessedCaseIdRef.current = caseData.id; // Update the last processed ID
    } else if (!caseData?.id && lastProcessedCaseIdRef.current !== null) {
        // If caseData.id becomes null (e.g., no case selected), clear refs and states.
        hasLoadedInitialDataRef.current = false;
        lastProcessedCaseIdRef.current = null;
        setTaskTemplate(null);
        setTasks([]);
        setIsLoading(false);
        setInitialProgressCalculated(false);
    } else if (caseData?.id && lastProcessedCaseIdRef.current === caseData.id && taskTemplate && taskTemplate.case_type !== caseData.case_type) {
        // If caseData.id is the same, but case_type has changed (meaning template needs to be reloaded)
        // We force a re-load, but keep hasLoadedInitialDataRef.current true to avoid showing a full loader.
        // The `loadInitialData` will still update `setTaskTemplate` and `setTasks`.
        hasLoadedInitialDataRef.current = false; // Temporarily unset to allow loadInitialData to run, but setIsLoading will be false
        // Then loadInitialData will run and set it back to true.
        // The `setIsLoading(true)` condition in loadInitialData will be `!true` so no spinner.
    }

    // Only run loadInitialData if caseData.id is available and initial data has not yet been loaded
    // for this specific component instance (or for this new caseData.id as per reset logic above).
    if (caseData?.id && !hasLoadedInitialDataRef.current) {
      loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseData?.id, caseData?.case_type]); // Depend on ID and type. Removed `caseData?.tasks_progress` to avoid unnecessary template re-loads on progress updates.

  // This useEffect ensures `currentTasksProgress` is always in sync with `caseData.tasks_progress`.
  useEffect(() => {
    setCurrentTasksProgress(caseData.tasks_progress || []);
  }, [caseData.tasks_progress]);


  // Calculate overall completion based on the legacy tasks_completed field for non-templated cases
  const calculateLegacyProgress = () => {
    const totalTasks = 74; // Legacy total task count
    const completedTasks = (caseData.tasks_completed || []).length;
    const percentage = Math.round((completedTasks / totalTasks) * 100);

    return { completed: completedTasks, total: totalTasks, percentage };
  };

  // Calculate progress for CVL/MVL cases using ALL tasks from template
  const calculateTemplatedProgress = () => { // Renamed from calculateCVLProgress
    const tasksProgress = currentTasksProgress || [];

    // Get total tasks from the template - this is the complete count from PreApp to Closure
    const totalTasks = taskTemplate?.tasks?.length || tasksProgress.length || 1;

    // Count completed tasks (either completed or N/A with reason)
    const completedTasks = tasksProgress.filter(p =>
      (p.status === 'completed') ||
      (p.status === 'not_applicable' && p.na_reason && p.na_reason.trim().length > 0)
    ).length;

    const percentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return { completed: completedTasks, total: totalTasks, percentage };
  };

  const getProgressColor = (percentage) => {
    if (percentage <= 10) return 'bg-red-500';
    if (percentage <= 40) return 'bg-orange-500';
    if (percentage <= 70) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getProgressTextColor = (percentage) => {
    if (percentage <= 10) return 'text-red-700';
    if (percentage <= 40) return 'text-orange-700';
    if (percentage <= 70) return 'text-blue-700';
    return 'text-green-700';
  };

  const getProgressBgColor = (percentage) => {
    if (percentage <= 10) return 'bg-red-50';
    if (percentage <= 40) return 'bg-orange-50';
    if (percentage <= 70) return 'bg-blue-50';
    return 'bg-green-50';
  };

  const getProgressBorderColor = (percentage) => {
    if (percentage <= 10) return 'border-red-200';
    if (percentage <= 40) return 'border-orange-200';
    if (percentage <= 70) return 'border-blue-200';
    return 'border-green-200';
  };

  const isCVLCase = caseData.case_type === 'CVL';
  const isMVLCase = caseData.case_type === 'MVL';
  const isTemplatedCase = isCVLCase || isMVLCase;

  let progress;

  // Only calculate actual progress if initial data (user, template) is loaded and ready for calculation
  if (initialProgressCalculated && !isLoading) {
    progress = isTemplatedCase ? calculateTemplatedProgress() : calculateLegacyProgress();
  } else {
    // Default to 0% when not yet loaded or calculated
    progress = { completed: 0, total: 0, percentage: 0 };
  }

  // Handler to update tasks progress from CVL component
  const handleTasksProgressUpdate = (updatedTasksProgress) => {
    setCurrentTasksProgress(updatedTasksProgress);
  };

  // Handler to refresh progress when templated tasks are updated
  const handleTemplatedTaskUpdate = () => { // Renamed from handleCVLTaskUpdate
    // This will trigger a re-render with updated caseData from parent
    if (onUpdate) {
      onUpdate();
    }
  };

  // Only show loading on first load for a specific case ID (as detected by `hasLoadedInitialDataRef` and `lastProcessedCaseIdRef` logic)
  if (isLoading && !hasLoadedInitialDataRef.current) { 
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading task list...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Overall Case Progression */}
      <Card className={`border-2 shadow-sm ${getProgressBgColor(progress.percentage)} ${getProgressBorderColor(progress.percentage)}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              Overall Case Progression
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`${getProgressTextColor(progress.percentage)} border-current font-medium`}>
                {progress.percentage}%
              </Badge>
              {isTemplatedCase && ( // Applied to both CVL and MVL
                <Badge variant="secondary" className="text-xs">
                  {caseData.case_type} Template
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="space-y-2">
            {/* Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Tasks Complete</span>
                <span className="font-medium">{progress.completed} of {progress.total}</span>
              </div>
              <Progress
                value={progress.percentage}
                className={`w-full h-2 ${
                  progress.percentage < 10
                    ? '[&>div]:bg-red-500'
                    : progress.percentage >= 85
                    ? '[&>div]:bg-green-500'
                    : '[&>div]:bg-blue-500'
                }`}
              />
            </div>

            {/* Completion Badge Only */}
            {progress.percentage === 100 && (
              <div className="flex justify-center pt-2 border-t border-slate-100">
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-2 py-1">
                  Complete
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Templated Task List (CVL or MVL) */}
      {isTemplatedCase && (
        <CVLTaskList // This component name is now a bit misleading, but it's used for both
          caseData={caseData}
          onUpdate={handleTemplatedTaskUpdate}
          onTasksProgressUpdate={handleTasksProgressUpdate}
        />
      )}

      {/* Legacy Task Information - Only for non-templated cases */}
      {!isTemplatedCase && (
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4">
            <div className="text-center text-slate-600">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="font-medium text-slate-800 mb-2">Legacy Task System</h3>
              <p className="text-sm">
                This case uses the legacy task tracking system with {progress.total} predefined tasks.
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Consider updating to use task templates for better tracking.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TaskList;
