
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { TaskTemplate } from '@/api/entities';
import { Case } from '@/api/entities';
import { User } from '@/api/entities';

const MVL_CATEGORY_ORDER = [
  'Pre-Appointment',
  'Administrative',
  'Assets',
  'Creditors',
  'TAX', // Changed from 'Tax' to 'TAX'
  'Employee',
  'Pension',
  'Fees',
  'Shareholders',
  'Closure'
];

export default function MVLTaskList({ caseData, onUpdate }) {
  const [taskProgress, setTaskProgress] = useState({});
  const [templateTasks, setTemplateTasks] = useState([]);
  const [activeCategory, setActiveCategory] = useState(MVL_CATEGORY_ORDER[0]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimeoutRef = useRef(null);

  const saveToBackendSilently = useCallback(async (currentTaskProgress) => {
    try {
      const progressArray = Object.values(currentTaskProgress);
      await Case.update(caseData.id, {
        tasks_progress: progressArray
      });

      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  }, [caseData.id, onUpdate]);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);

    try {
      const allTemplates = await TaskTemplate.list();
      const mvlTemplates = allTemplates.filter(t => t.case_type === caseData.case_type);

      if (mvlTemplates.length === 0) {
        setTemplateTasks([]);
        setTaskProgress({});
        setIsLoading(false);
        return;
      }

      const defaultTemplate = mvlTemplates.find(t => t.is_default) || mvlTemplates[0];

      if (defaultTemplate && defaultTemplate.tasks) {
        setTemplateTasks(defaultTemplate.tasks);

        const initialProgressMap = (caseData.tasks_progress || []).reduce((acc, p) => {
          acc[p.task_id] = p;
          return acc;
        }, {});
        setTaskProgress(initialProgressMap);
      } else {
        setTemplateTasks([]);
        setTaskProgress({});
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [caseData.case_type, caseData.tasks_progress]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleTaskToggle = async (taskId, newStatus, naReason = '') => {
    let user;
    try {
      user = await User.me();
    } catch (error) {
      console.error('Failed to get user:', error);
      return;
    }

    setTaskProgress(prevProgress => {
      const updatedProgress = { ...prevProgress };
      const existingTask = updatedProgress[taskId];

      let statusToSet = newStatus;
      let completedDate = null;
      let completedBy = null;
      let currentNaReason = '';

      if (statusToSet === 'completed') {
        if (existingTask?.status === 'completed') {
          statusToSet = 'pending';
        } else {
          completedDate = new Date().toISOString();
          completedBy = user.email;
        }
      } else if (statusToSet === 'not_applicable') {
        if (existingTask?.status === 'not_applicable' && existingTask?.na_reason?.trim() === naReason.trim()) {
          statusToSet = 'pending';
        } else {
          completedDate = new Date().toISOString();
          completedBy = user.email;
          currentNaReason = naReason.trim();
        }
      } else {
        statusToSet = 'pending';
      }

      if (statusToSet === 'pending') {
        delete updatedProgress[taskId];
      } else {
        updatedProgress[taskId] = {
          task_id: taskId,
          status: statusToSet,
          completed_date: completedDate,
          completed_by: completedBy,
          na_reason: currentNaReason
        };
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveToBackendSilently(updatedProgress);
      }, (newStatus === 'not_applicable' && naReason) ? 2000 : 500);

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

  // Don't render anything if this is not an MVL case
  if (caseData.case_type !== 'MVL') {
    return null;
  }

  const completedOrN_A_Tasks = Object.values(taskProgress).filter(
    t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())
  ).length;

  const totalTasks = templateTasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedOrN_A_Tasks / totalTasks) * 100) : 0;

  const activeCategoryTasks = templateTasks.filter(t => t.category === activeCategory);

  return (
    <div className="h-full flex flex-col">
      {/* Top Header - Overall Progress */}
      <div className="bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-200 p-6 rounded-t-xl">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-blue-600">📈</span>
            Overall Case Progression
          </h3>
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold text-sm">
              {progressPercentage}%
            </div>
            <div className="text-sm font-medium text-slate-600">
              MVL Template
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span className="font-medium">Tasks Complete</span>
            <span className="font-semibold">{completedOrN_A_Tasks} of {totalTasks}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Categories */}
        <div className="w-48 flex-shrink-0 border-r bg-white p-3">
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">Task Categories</h3>
          <nav className="space-y-1.5">
            {MVL_CATEGORY_ORDER.map(category => {
              const isActive = activeCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`w-full text-left px-3 py-1.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-red-50 text-slate-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Content Area - Tasks */}
        <div className="flex-1 p-6 overflow-y-auto bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading tasks...</p>
            </div>
          ) : activeCategoryTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">No tasks in this category</p>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-semibold text-slate-800 mb-6">{activeCategory}</h2>
              <div className="space-y-1">
                {activeCategoryTasks.map((task) => {
                  const progress = taskProgress[task.id] || { status: 'pending' };
                  const isCompleted = progress.status === 'completed';
                  const isNA = progress.status === 'not_applicable' && progress.na_reason?.trim();

                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100 hover:bg-slate-50 px-2 rounded transition-colors"
                    >
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          isCompleted || isNA ? 'line-through text-green-600' : 'text-slate-800'
                        }`}>
                          {task.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={() => handleTaskToggle(task.id, 'completed')}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-slate-600">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isNA}
                            onChange={() => {
                              if (!isNA) {
                                const reason = prompt('Please provide a reason for marking this task as N/A:');
                                if (reason && reason.trim()) {
                                  handleTaskToggle(task.id, 'not_applicable', reason);
                                }
                              } else {
                                handleTaskToggle(task.id, 'pending');
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                          />
                          <span className="text-sm font-medium text-slate-600">N/A</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
