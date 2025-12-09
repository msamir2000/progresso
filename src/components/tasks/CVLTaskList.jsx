import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TaskTemplate } from '@/api/entities';
import { Case } from '@/api/entities';
import { User } from '@/api/entities';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Loader2,
  RefreshCw,
  X
} from 'lucide-react';

// Define the category order to match Settings
const CVL_CATEGORY_ORDER = [
  'PreApp',
  'Administrative',
  'Assets',
  'Employee',
  'Pension',
  'Creditors',
  'VAT',
  'Distributions',
  'Fees',
  'Investigations',
  'Litigation',
  'Closure'
];

export default function CVLTaskList({ caseData, onUpdate }) {
  const [tasks, setTasks] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [localTaskProgress, setLocalTaskProgress] = useState([]);
  const saveTimeoutRef = useRef(null);
  const isInitializedRef = useRef(false);
  const hasLoadedTasksRef = useRef(false);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const completedOrNA = localTaskProgress.filter(
      t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())
    ).length;
    const totalTasks = tasks.length;
    const percentage = totalTasks > 0 ? Math.round((completedOrNA / totalTasks) * 100) : 0;
    
    return {
      completed: completedOrNA,
      total: totalTasks,
      percentage
    };
  }, [localTaskProgress, tasks]);

  const loadTasks = useCallback(async () => {
    if (!hasLoadedTasksRef.current) {
      setIsInitialLoading(true);
    }
    
    try {
      console.log('=== LOADING TASKS FOR CVL CASE ===');
      console.log('Case Type:', caseData.case_type);
      
      const allTemplates = await TaskTemplate.list();
      console.log('All templates loaded:', allTemplates.length);
      console.log('Templates by case type:', allTemplates.map(t => ({ name: t.template_name, type: t.case_type, isDefault: t.is_default })));
      
      const cvlTemplates = allTemplates.filter(t => t.case_type === 'CVL');
      console.log('CVL templates found:', cvlTemplates.length);
      
      if (cvlTemplates.length === 0) {
        console.warn('No CVL templates found!');
        setTasks([]);
        setIsInitialLoading(false);
        return;
      }

      const defaultTemplate = cvlTemplates.find(t => t.is_default) || cvlTemplates[0];
      console.log('Selected template:', defaultTemplate?.template_name, 'Tasks count:', defaultTemplate?.tasks?.length);
      
      if (defaultTemplate && defaultTemplate.tasks && Array.isArray(defaultTemplate.tasks)) {
        console.log('Setting tasks:', defaultTemplate.tasks.length);
        setTasks(defaultTemplate.tasks);
        hasLoadedTasksRef.current = true;
      } else {
        console.error('Template has no tasks array!');
        setTasks([]);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsInitialLoading(false);
    }
  }, [caseData.case_type]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!isInitializedRef.current && caseData.tasks_progress) {
      setLocalTaskProgress(caseData.tasks_progress || []);
      isInitializedRef.current = true;
    }
  }, [caseData.tasks_progress]);

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
    
    return uniqueCategories.sort((a, b) => {
      const indexA = CVL_CATEGORY_ORDER.indexOf(a);
      const indexB = CVL_CATEGORY_ORDER.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return 0;
    });
  }, [tasks]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const getCategoryStatus = useCallback((categoryName) => {
    const relevantTasks = tasks.filter(t => t.category === categoryName);
    if (relevantTasks.length === 0) return null;

    const allRelevantTasksProgressed = relevantTasks.every(t => {
      const progress = localTaskProgress.find(p => p.task_id === t.id);
      return progress?.status === 'completed' || progress?.status === 'not_applicable';
    });
    
    return allRelevantTasksProgressed;
  }, [tasks, localTaskProgress]);

  const filteredTasks = useMemo(() => {
    if (!activeCategory || tasks.length === 0) {
      return [];
    }
    return tasks.filter(t => t.category === activeCategory);
  }, [tasks, activeCategory]);

  const groupedTasks = useMemo(() => {
    if (!activeCategory || filteredTasks.length === 0) {
      return {};
    }
    const sortedTasks = [...filteredTasks].sort((a, b) => (a.order || 0) - (b.order || 0));
    return {
      [activeCategory]: sortedTasks
    };
  }, [filteredTasks, activeCategory]);

  const saveToBackendSilently = useCallback(async (updatedProgress) => {
    try {
      await Case.update(caseData.id, {
        tasks_progress: updatedProgress
      });
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [caseData.id, onUpdate]);

  const handleTaskStatusChange = async (taskId, newStatus) => {
    let user;
    try {
      user = await User.me();
    } catch (error) {
      console.error('Failed to get user:', error);
      return;
    }
    
    setLocalTaskProgress(prevProgress => {
      const updatedProgress = [...prevProgress];
      const existingIndex = updatedProgress.findIndex(p => p.task_id === taskId);
      
      const progressItem = {
        task_id: taskId,
        status: newStatus,
        completed_date: newStatus !== 'pending' ? new Date().toISOString() : null,
        completed_by: newStatus !== 'pending' ? user.email : null,
        na_reason: existingIndex >= 0 && newStatus === 'not_applicable' ? updatedProgress[existingIndex].na_reason || '' : ''
      };

      if (existingIndex >= 0) {
        updatedProgress[existingIndex] = progressItem;
      } else {
        updatedProgress.push(progressItem);
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToBackendSilently(updatedProgress);
      }, 500);

      return updatedProgress;
    });
  };

  const handleNAReasonChange = (taskId, reason) => {
    setLocalTaskProgress(prevProgress => {
      const updatedProgress = [...prevProgress];
      const existingIndex = updatedProgress.findIndex(p => p.task_id === taskId);
      
      if (existingIndex >= 0) {
        updatedProgress[existingIndex] = {
          ...updatedProgress[existingIndex],
          na_reason: reason
        };

        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
          saveToBackendSilently(updatedProgress);
        }, 2000);
      }

      return updatedProgress;
    });
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (caseData.case_type !== 'CVL') {
    return null;
  }

  if (isInitialLoading && !hasLoadedTasksRef.current) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (tasks.length === 0 && !isInitialLoading) {
    return (
      <div className="text-center py-12 w-full">
        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Tasks Available</h3>
        <p className="text-slate-600 mb-4">
          No CVL task template has been configured for this case type.
        </p>
        <p className="text-sm text-slate-500">
          Please configure a CVL task template in Settings to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Case Progression */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900">Overall Case Progression</h3>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-100 text-blue-700 text-base px-3 py-1">
                {overallProgress.percentage}%
              </Badge>
              <span className="text-sm text-slate-600">CVL Template</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>Tasks Complete</span>
              <span className="font-medium">{overallProgress.completed} of {overallProgress.total}</span>
            </div>
            <Progress value={overallProgress.percentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Task Categories and List */}
      <div className="flex h-full">
        {/* Left Sidebar - Category Menu */}
        <div className="w-56 flex-shrink-0 border-r bg-slate-50 p-4">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Task Categories</h3>
          <nav className="space-y-1">
            {categories.map((category) => {
              const isComplete = getCategoryStatus(category);
              const isActive = activeCategory === category;
              
              let bgColor = 'bg-white hover:bg-slate-100';
              let borderColor = 'border-slate-200';
              let textColor = 'text-slate-700';
              
              if (isActive) {
                bgColor = 'bg-blue-100';
                textColor = 'text-blue-800';
                borderColor = 'border-blue-300';
              } else if (isComplete === true) {
                bgColor = 'bg-green-50 hover:bg-green-100';
                borderColor = 'border-green-300';
              } else if (isComplete === false) {
                bgColor = 'bg-red-50 hover:bg-red-100';
                borderColor = 'border-red-300';
              }
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md border transition-all ${bgColor} ${borderColor} ${textColor}`}
                >
                  {category}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content - Task List */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="p-6">
            <div className="space-y-3">
              {Object.keys(groupedTasks).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Tasks in this Category</h3>
                  <p className="text-slate-600">Select another category or add tasks to this one.</p>
                </div>
              ) : (
                Object.entries(groupedTasks).map(([category, categoryTasks]) => (
                  <div key={category}>
                    <h3 className="text-lg font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                      {category}
                    </h3>
                    <div className="space-y-3">
                      {categoryTasks.map((task) => {
                        const taskProgress = localTaskProgress.find(p => p.task_id === task.id);
                        const isCompleted = taskProgress?.status === 'completed';
                        const isNA = taskProgress?.status === 'not_applicable';

                        return (
                          <div key={task.id} className="py-1">
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm ${isCompleted ? 'text-green-900 line-through' : isNA ? 'text-amber-900' : 'text-slate-900'}`}>
                                  {task.name}
                                </p>
                              </div>

                              <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    checked={isCompleted}
                                    onCheckedChange={() => handleTaskStatusChange(task.id, isCompleted ? 'pending' : 'completed')}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs text-slate-700">Yes</span>
                                </div>
                                
                                <div className="flex items-center gap-1.5">
                                  <Checkbox
                                    checked={isNA}
                                    onCheckedChange={() => handleTaskStatusChange(task.id, isNA ? 'pending' : 'not_applicable')}
                                    className="h-4 w-4"
                                  />
                                  <span className="text-xs text-slate-700">N/A</span>
                                </div>
                              </div>
                            </div>

                            {isNA && (
                              <div className="mt-1 ml-4">
                                <Textarea
                                  value={taskProgress?.na_reason || ''}
                                  onChange={(e) => handleNAReasonChange(task.id, e.target.value)}
                                  placeholder="Reason required for N/A..."
                                  className="text-xs h-12 bg-blue-50 border-blue-200"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}