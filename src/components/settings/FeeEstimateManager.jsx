import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit, Save, X, Loader2, Star, StarOff, ChevronDown, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FeeEstimateManager() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTemplates, setExpandedTemplates] = useState({});
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    template_name: '',
    is_default: false,
    template_data: []
  });
  const [newTask, setNewTask] = useState({
    category: '',
    activity: '',
    partner_hours: 0,
    manager_hours: 0,
    executive_hours: 0,
    secretary_hours: 0,
    notes: ''
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const loadedTemplates = await base44.entities.FeeEstimateTemplate.list();
      setTemplates(loadedTemplates || []);
      // Expand all templates by default
      const expanded = {};
      (loadedTemplates || []).forEach(template => {
        expanded[template.id] = true;
      });
      setExpandedTemplates(expanded);
    } catch (error) {
      console.error('Error loading fee estimate templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTemplate = (templateId) => {
    setExpandedTemplates(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  const handleAddTemplate = async () => {
    if (!formData.template_name) {
      alert('Please enter a template name');
      return;
    }
    try {
      await base44.entities.FeeEstimateTemplate.create(formData);
      setShowAddForm(false);
      setFormData({
        template_name: '',
        is_default: false,
        template_data: []
      });
      await loadTemplates();
    } catch (error) {
      console.error('Error adding template:', error);
      alert('Failed to add template');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      await Promise.all(
        templates.map(t => 
          base44.entities.FeeEstimateTemplate.update(t.id, { ...t, is_default: false })
        )
      );
      await base44.entities.FeeEstimateTemplate.update(template.id, { ...template, is_default: true });
      await loadTemplates();
    } catch (error) {
      console.error('Error setting default template:', error);
      alert('Failed to set default template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await base44.entities.FeeEstimateTemplate.delete(id);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const handleAddTask = () => {
    if (!newTask.category || !newTask.activity) {
      alert('Please enter both category and activity');
      return;
    }

    const taskWithId = {
      ...newTask,
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    const updatedTemplateData = [...(editingTemplate.template_data || []), taskWithId];
    
    setEditingTemplate({
      ...editingTemplate,
      template_data: updatedTemplateData
    });

    setNewTask({
      category: '',
      activity: '',
      partner_hours: 0,
      manager_hours: 0,
      executive_hours: 0,
      secretary_hours: 0,
      notes: ''
    });
  };

  const handleDeleteTask = (taskId) => {
    const updatedTemplateData = editingTemplate.template_data.filter(t => t.id !== taskId);
    setEditingTemplate({
      ...editingTemplate,
      template_data: updatedTemplateData
    });
  };

  const handleSaveTemplate = async () => {
    try {
      await base44.entities.FeeEstimateTemplate.update(editingTemplate.id, editingTemplate);
      setEditingTemplate(null);
      await loadTemplates();
      alert('Template saved successfully');
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const getTotalHours = (template) => {
    return (template.template_data || []).reduce((sum, task) => {
      return sum + (task.partner_hours || 0) + (task.manager_hours || 0) + 
             (task.executive_hours || 0) + (task.secretary_hours || 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Fee Estimate Templates</CardTitle>
          <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {showAddForm && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-4">Create New Fee Estimate Template</h3>
            <div className="space-y-4">
              <div>
                <Label>Template Name *</Label>
                <Input
                  value={formData.template_name}
                  onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                  placeholder="e.g., Standard CVL Fee Estimate"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="is_default" className="cursor-pointer">Set as default template</Label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleAddTemplate} className="bg-green-600 hover:bg-green-700">
                <Save className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {templates.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="font-medium mb-2">No fee estimate templates configured</p>
            <p className="text-sm">Click "New Template" to create your first template</p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div key={template.id} className="border rounded-lg overflow-hidden">
                {/* Template Header */}
                <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTemplate(template.id)}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      {expandedTemplates[template.id] ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>
                    <div>
                      <h3 className="font-semibold text-slate-900">{template.template_name}</h3>
                      <p className="text-sm text-slate-600">
                        {(template.template_data || []).length} activities • {getTotalHours(template).toFixed(2)} total hours
                        {template.is_default && <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Default</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(template)}
                      disabled={template.is_default}
                      title="Set as default"
                    >
                      {template.is_default ? (
                        <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      ) : (
                        <StarOff className="w-4 h-4 text-slate-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Activities Table - Expanded by Default */}
                {expandedTemplates[template.id] && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">Category</TableHead>
                          <TableHead className="font-semibold">Activity</TableHead>
                          <TableHead className="font-semibold text-center">Partner</TableHead>
                          <TableHead className="font-semibold text-center">Manager</TableHead>
                          <TableHead className="font-semibold text-center">Executive</TableHead>
                          <TableHead className="font-semibold text-center">Secretary</TableHead>
                          <TableHead className="font-semibold text-center">Total</TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(template.template_data || []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-slate-500 py-8">
                              No activities in this template yet
                            </TableCell>
                          </TableRow>
                        ) : (
                          (template.template_data || []).map((task) => (
                            <TableRow key={task.id}>
                              <TableCell className="font-medium">{task.category}</TableCell>
                              <TableCell>{task.activity}</TableCell>
                              <TableCell className="text-center">{task.partner_hours || 0}</TableCell>
                              <TableCell className="text-center">{task.manager_hours || 0}</TableCell>
                              <TableCell className="text-center">{task.executive_hours || 0}</TableCell>
                              <TableCell className="text-center">{task.secretary_hours || 0}</TableCell>
                              <TableCell className="text-center font-semibold">
                                {((task.partner_hours || 0) + (task.manager_hours || 0) + 
                                  (task.executive_hours || 0) + (task.secretary_hours || 0)).toFixed(1)}
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">{task.notes || '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit Template Modal */}
        {editingTemplate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Edit: {editingTemplate.template_name}</h2>
                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setEditingTemplate(null)}>
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Add New Activity Form */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900 mb-4">Add Activity</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Category *</Label>
                      <Input
                        value={newTask.category}
                        onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
                        placeholder="e.g., Administration, Assets"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Activity *</Label>
                      <Input
                        value={newTask.activity}
                        onChange={(e) => setNewTask({ ...newTask, activity: e.target.value })}
                        placeholder="e.g., Case setup and planning"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Partner Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={newTask.partner_hours}
                        onChange={(e) => setNewTask({ ...newTask, partner_hours: parseFloat(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Manager Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={newTask.manager_hours}
                        onChange={(e) => setNewTask({ ...newTask, manager_hours: parseFloat(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Executive Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={newTask.executive_hours}
                        onChange={(e) => setNewTask({ ...newTask, executive_hours: parseFloat(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Secretary Hours</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={newTask.secretary_hours}
                        onChange={(e) => setNewTask({ ...newTask, secretary_hours: parseFloat(e.target.value) || 0 })}
                        className="h-8"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Notes</Label>
                      <Input
                        value={newTask.notes}
                        onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                        placeholder="Additional notes..."
                        className="h-8"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddTask} className="mt-3 h-8 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Activity
                  </Button>
                </div>

                {/* Activities Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold">Category</TableHead>
                        <TableHead className="font-semibold">Activity</TableHead>
                        <TableHead className="font-semibold text-center">Partner</TableHead>
                        <TableHead className="font-semibold text-center">Manager</TableHead>
                        <TableHead className="font-semibold text-center">Executive</TableHead>
                        <TableHead className="font-semibold text-center">Secretary</TableHead>
                        <TableHead className="font-semibold text-center">Total</TableHead>
                        <TableHead className="font-semibold text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(editingTemplate.template_data || []).map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.category}</TableCell>
                          <TableCell>{task.activity}</TableCell>
                          <TableCell className="text-center">{task.partner_hours || 0}</TableCell>
                          <TableCell className="text-center">{task.manager_hours || 0}</TableCell>
                          <TableCell className="text-center">{task.executive_hours || 0}</TableCell>
                          <TableCell className="text-center">{task.secretary_hours || 0}</TableCell>
                          <TableCell className="text-center font-semibold">
                            {((task.partner_hours || 0) + (task.manager_hours || 0) + 
                              (task.executive_hours || 0) + (task.secretary_hours || 0)).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}