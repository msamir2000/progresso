import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Case } from '@/api/entities';
import { TaskTemplate } from '@/api/entities';
import { TrendingUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const AdministrationTaskList = ({ caseData, onUpdate }) => {
  const [tasks, setTasks] = useState([]);
  const [tasksProgress, setTasksProgress] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('PreApp');
  const [isSaving, setIsSaving] = useState(false);
  const [naDialogOpen, setNaDialogOpen] = useState(false);
  const [currentNaTask, setCurrentNaTask] = useState(null);
  const [naReason, setNaReason] = useState('');
  const [templateName, setTemplateName] = useState('Administration Template');

  useEffect(() => {
    loadTasks();
  }, [caseData?.id]);

  const loadTasks = async () => {
    try {
      const templates = await TaskTemplate.list();
      const adminTemplates = templates.filter(t => t.case_type === 'Administration');
      
      if (adminTemplates.length === 0) {
        setTasks([]);
        return;
      }

      const defaultTemplate = adminTemplates.find(t => t.is_default) || adminTemplates[0];
      setTemplateName(defaultTemplate.template_name);
      setTasks(defaultTemplate.tasks || []);
      
      setTasksProgress(caseData.tasks_progress || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      setTasks([]);
    }
  };

  const categories = [...new Set(tasks.map(t => t.category))];

  const getTaskStatus = (taskId) => {
    const progress = tasksProgress.find(p => p.task_id === taskId);
    return progress || { status: 'pending', na_reason: '' };
  };

  const handleTaskToggle = async (taskId, currentStatus) => {
    if (currentStatus === 'completed') {
      await updateTaskStatus(taskId, 'pending', '');
    } else {
      await updateTaskStatus(taskId, 'completed', '');
    }
  };

  const handleNaToggle = (taskId, currentStatus) => {
    if (currentStatus === 'not_applicable') {
      updateTaskStatus(taskId, 'pending', '');
    } else {
      setCurrentNaTask(taskId);
      const existingProgress = tasksProgress.find(p => p.task_id === taskId);
      setNaReason(existingProgress?.na_reason || '');
      setNaDialogOpen(true);
    }
  };

  const handleNaSubmit = async () => {
    if (!currentNaTask || !naReason.trim()) return;
    await updateTaskStatus(currentNaTask, 'not_applicable', naReason);
    setNaDialogOpen(false);
    setCurrentNaTask(null);
    setNaReason('');
  };

  const updateTaskStatus = async (taskId, status, na_reason = '') => {
    setIsSaving(true);
    try {
      const updatedProgress = [...tasksProgress];
      const existingIndex = updatedProgress.findIndex(p => p.task_id === taskId);

      const newProgress = {
        task_id: taskId,
        status,
        na_reason,
        completed_date: status === 'completed' || status === 'not_applicable' ? new Date().toISOString() : null,
        completed_by: status === 'completed' || status === 'not_applicable' ? caseData.assigned_user : null
      };

      if (existingIndex >= 0) {
        updatedProgress[existingIndex] = newProgress;
      } else {
        updatedProgress.push(newProgress);
      }

      await Case.update(caseData.id, { tasks_progress: updatedProgress });
      setTasksProgress(updatedProgress);
      
      if (onUpdate) {
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to update task:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const categoryTasks = tasks.filter(t => t.category === selectedCategory);
  const completedTasks = tasksProgress.filter(t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())).length;
  const totalTasks = tasks.length;
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="bg-gradient-to-br from-blue-50 to-slate-50 border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-slate-900">Overall Case Progression</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 border-4 border-blue-200">
                <span className="text-lg font-bold text-blue-700">{progressPercentage}%</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-blue-700">{templateName}</div>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tasks Complete</span>
              <span className="font-medium">{completedTasks} of {totalTasks}</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Left Sidebar - Categories */}
        <div className="w-48 flex-shrink-0">
          <h3 className="font-semibold text-slate-900 mb-3">Task Categories</h3>
          <div className="space-y-1">
            {categories.map((category) => {
              const categoryTaskCount = tasks.filter(t => t.category === category).length;
              const categoryCompletedCount = tasks
                .filter(t => t.category === category)
                .filter(t => {
                  const status = getTaskStatus(t.id);
                  return status.status === 'completed' || (status.status === 'not_applicable' && status.na_reason?.trim());
                }).length;
              
              const isActive = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-100 text-blue-700 font-medium border border-blue-300'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{category}</span>
                    {categoryCompletedCount === categoryTaskCount && categoryTaskCount > 0 && (
                      <span className="text-xs text-green-600 font-semibold">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Content - Tasks */}
        <div className="flex-1">
          <Card>
            <CardHeader className="border-b border-slate-200 bg-slate-50">
              <CardTitle className="text-xl font-bold text-slate-900">{selectedCategory}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {categoryTasks.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No tasks in this category</p>
              ) : (
                <div className="space-y-4">
                  {categoryTasks.map((task) => {
                    const taskStatus = getTaskStatus(task.id);
                    const isCompleted = taskStatus.status === 'completed';
                    const isNotApplicable = taskStatus.status === 'not_applicable';

                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex-1">
                          <p
                            className={`text-base ${
                              isCompleted || isNotApplicable
                                ? 'line-through text-green-600'
                                : 'text-slate-800'
                            }`}
                          >
                            {task.name}
                          </p>
                          {isNotApplicable && taskStatus.na_reason && (
                            <p className="text-sm text-slate-500 mt-1 italic">
                              N/A Reason: {taskStatus.na_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-4 ml-4">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`${task.id}-yes`}
                              checked={isCompleted}
                              onCheckedChange={() => handleTaskToggle(task.id, taskStatus.status)}
                              disabled={isSaving}
                            />
                            <Label
                              htmlFor={`${task.id}-yes`}
                              className="text-sm font-medium text-slate-700 cursor-pointer"
                            >
                              Yes
                            </Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`${task.id}-na`}
                              checked={isNotApplicable}
                              onCheckedChange={() => handleNaToggle(task.id, taskStatus.status)}
                              disabled={isSaving}
                            />
                            <Label
                              htmlFor={`${task.id}-na`}
                              className="text-sm font-medium text-slate-700 cursor-pointer"
                            >
                              N/A
                            </Label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* N/A Reason Dialog */}
      <Dialog open={naDialogOpen} onOpenChange={setNaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Task as Not Applicable</DialogTitle>
            <DialogDescription>
              Please provide a reason why this task is not applicable to this case.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={naReason}
              onChange={(e) => setNaReason(e.target.value)}
              placeholder="Enter reason..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNaDialogOpen(false);
                setCurrentNaTask(null);
                setNaReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleNaSubmit}
              disabled={!naReason.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Confirm N/A
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdministrationTaskList;