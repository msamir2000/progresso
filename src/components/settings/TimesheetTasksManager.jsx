
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Define the custom display order
const CUSTOM_CATEGORY_ORDER = [
  'STATUTORY AND ADMINISTRATIVE TASKS',
  'REALISATION OF ASSETS',
  'INVESTIGATIONS',
  'CREDITORS',
  'EMPLOYEES',
  'TRADING',
  'NON CHARGEABLE'
];

export default function TimesheetTasksManager() {
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    activity: '',
    task_code: '',
    is_active: true
  });

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const loadedTasks = await base44.entities.TimesheetTask.list('category');
      setTasks(loadedTasks || []);
    } catch (error) {
      console.error('Error loading timesheet tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.category || !formData.activity) {
      alert('Please fill in both category and activity name');
      return;
    }
    try {
      await base44.entities.TimesheetTask.create(formData);
      setShowAddForm(false);
      setFormData({
        category: '',
        activity: '',
        task_code: '',
        is_active: true
      });
      await loadTasks();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await base44.entities.TimesheetTask.update(id, data);
      setEditingId(null);
      await loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this timesheet task?')) return;
    try {
      await base44.entities.TimesheetTask.delete(id);
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const toggleActive = async (task) => {
    try {
      await base44.entities.TimesheetTask.update(task.id, {
        ...task,
        is_active: !task.is_active
      });
      await loadTasks();
    } catch (error) {
      console.error('Error toggling task status:', error);
      alert('Failed to update task status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Group tasks by category
  const tasksByCategory = tasks.reduce((acc, task) => {
    if (!acc[task.category]) {
      acc[task.category] = [];
    }
    acc[task.category].push(task);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Timesheet Tasks Configuration</CardTitle>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Add New Timesheet Task</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOM_CATEGORY_ORDER.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Activity Name *</Label>
                <Input
                  value={formData.activity}
                  onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  placeholder="e.g., Case setup, Review files"
                  className="h-8"
                />
              </div>
              <div>
                <Label>Task Code (Optional)</Label>
                <Input
                  value={formData.task_code}
                  onChange={(e) => setFormData({ ...formData, task_code: e.target.value })}
                  placeholder="e.g., ADM-001"
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAdd} className="bg-green-600 hover:bg-green-700" size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} size="sm">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {tasks.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No timesheet tasks configured</p>
            <p className="text-sm">Click "Add Task" to create your first timesheet activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(tasksByCategory)
              .sort(([catA], [catB]) => {
                const indexA = CUSTOM_CATEGORY_ORDER.indexOf(catA);
                const indexB = CUSTOM_CATEGORY_ORDER.indexOf(catB);
                
                // If both are in the custom order, sort by their position
                if (indexA !== -1 && indexB !== -1) {
                  return indexA - indexB;
                }
                // If A is in custom order but B is not, A comes first
                if (indexA !== -1) return -1;
                // If B is in custom order but A is not, B comes first
                if (indexB !== -1) return 1;
                // If neither are in custom order, sort alphabetically
                return catA.localeCompare(catB);
              })
              .map(([category, categoryTasks]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <h3 className="font-semibold text-slate-800">{category}</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold h-8 py-2">Activity</TableHead>
                        <TableHead className="font-semibold h-8 py-2">Task Code</TableHead>
                        <TableHead className="font-semibold text-center h-8 py-2">Status</TableHead>
                        <TableHead className="font-semibold text-center h-8 py-2">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryTasks.map((task) => (
                        <TableRow key={task.id} className="h-10">
                          {editingId === task.id ? (
                            <EditRow task={task} onSave={handleUpdate} onCancel={() => setEditingId(null)} />
                          ) : (
                            <>
                              <TableCell className="font-medium py-2">{task.activity}</TableCell>
                              <TableCell className="text-slate-600 py-2">{task.task_code || '-'}</TableCell>
                              <TableCell className="text-center py-2">
                                <button
                                  onClick={() => toggleActive(task)}
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    task.is_active
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {task.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </TableCell>
                              <TableCell className="text-center py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingId(task.id)}
                                    className="text-blue-600 hover:text-blue-700 h-7 w-7 p-0"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(task.id)}
                                    className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EditRow({ task, onSave, onCancel }) {
  const [editData, setEditData] = useState({ ...task });

  return (
    <>
      <TableCell className="py-2">
        <Input
          value={editData.activity}
          onChange={(e) => setEditData({ ...editData, activity: e.target.value })}
          className="h-7 text-sm"
        />
      </TableCell>
      <TableCell className="py-2">
        <Input
          value={editData.task_code || ''}
          onChange={(e) => setEditData({ ...editData, task_code: e.target.value })}
          className="h-7 text-sm"
          placeholder="Optional"
        />
      </TableCell>
      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={editData.is_active}
            onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
            className="w-4 h-4"
          />
        </div>
      </TableCell>
      <TableCell className="text-center py-2">
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSave(task.id, editData)}
            className="text-green-600 hover:text-green-700 h-7 w-7 p-0"
          >
            <Save className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-600 hover:text-slate-700 h-7 w-7 p-0"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </TableCell>
    </>
  );
}
