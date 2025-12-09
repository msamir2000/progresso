import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  Download,
  FileText,
  Plus,
  Trash2,
  Star,
  StarOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Pencil, // Added Pencil icon
  Save // Added Save icon
} from 'lucide-react';
import { TaskTemplate } from '@/api/entities';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';

const CASE_TYPES = [
  { value: 'CVL', label: 'Creditors Voluntary Liquidation (CVL)' },
  { value: 'MVL', label: 'Members Voluntary Liquidation (MVL)' },
  { value: 'Administration', label: 'Administration' },
  { value: 'CVA', label: 'Company Voluntary Arrangement (CVA)' }
];

// Define the desired category order for CVL cases
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

// Define the desired category order for MVL cases
const MVL_CATEGORY_ORDER = [
  'Pre-Appointment',
  'Administrative',
  'Assets',
  'Creditors',
  'Tax',
  'Employees',
  'Pension',
  'Fees',
  'Shareholders',
  'Closure'
];

export default function TaskListManager() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedCaseType, setSelectedCaseType] = useState('CVL');
  const [templateName, setTemplateName] = useState('');
  const [viewingTemplate, setViewingTemplate] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null); // New state for tracking task being edited
  const [editingTaskData, setEditingTaskData] = useState(null); // New state for holding edited task data

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const templateList = await TaskTemplate.list('-updated_date');
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load task templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCaseType || !templateName) {
      setUploadError('Please select a case type, enter a template name, and choose a file.');
      return;
    }

    // Check file type before uploading - now includes Excel files
    const fileExtension = file.name.toLowerCase().split('.').pop();
    const supportedTypes = ['csv', 'pdf', 'xlsx', 'xls'];
    if (!supportedTypes.includes(fileExtension)) {
      setUploadError(`Unsupported file type: .${fileExtension}. Please use CSV, PDF, or Excel files (.xlsx, .xls).`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      // Upload the file first
      const { file_url } = await UploadFile({ file });

      // Extract data from the uploaded file
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  name: { type: "string" },
                  id: { type: "string" },
                  order: { type: "number" },
                  required: { type: "boolean" }
                },
                required: ["category", "name"]
              }
            }
          }
        }
      });

      if (extractResult.status === "success" && extractResult.output?.tasks) {
        let tasks = extractResult.output.tasks;

        // Generate IDs for tasks that don't have them
        tasks = tasks.map((task, index) => ({
          ...task,
          id: task.id || `${selectedCaseType.toLowerCase()}_task_${index + 1}_${Date.now() + index}`, // Ensure unique ID
          order: task.order || index + 1,
          required: task.required !== false // Default to true if not specified
        }));

        // Check if a template with this case type already exists
        const existingTemplate = templates.find(t =>
          t.case_type === selectedCaseType && t.template_name === templateName
        );

        const templateData = {
          case_type: selectedCaseType,
          template_name: templateName,
          tasks: tasks,
          file_url: file_url,
          total_tasks: tasks.length,
          is_default: existingTemplate ? existingTemplate.is_default : false
        };

        if (existingTemplate) {
          await TaskTemplate.update(existingTemplate.id, templateData);
        } else {
          await TaskTemplate.create(templateData);
        }

        setUploadSuccess(true);
        setTemplateName('');
        setTimeout(() => setUploadSuccess(false), 3000);
        await loadTemplates();
      } else {
        // More specific error handling for different file types
        let errorMessage = extractResult.details || 'Could not extract task data from file.';

        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          errorMessage += ' If you\'re using an Excel file, please ensure it has clear column headers (Category, Task Name, Required) and data in a simple table format. Alternatively, try converting to CSV format.';
        } else {
          errorMessage += ' Please check the format and ensure it contains task categories and names.';
        }

        setUploadError(errorMessage);
      }
    } catch (error) {
      console.error('Task template upload failed:', error);

      // Provide more specific error messages
      let errorMessage = 'Upload failed: ';
      if (error.message) {
        if (error.message.includes('Unsupported file type')) {
          errorMessage += `The file type .${fileExtension} is not supported by the data extraction service. Please try converting your Excel file to CSV format or use a PDF with clear table structure.`;
        } else if (error.message.includes('400')) {
          errorMessage += 'Bad request. Please check your file format and try again.';
        } else if (error.message.includes('Network')) {
          errorMessage += 'Network error. Please check your connection and try again.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred. Please try again or contact support.';
      }

      setUploadError(errorMessage);
    } finally {
      event.target.value = '';
      setIsUploading(false);
    }
  };

  const handleSetDefault = async (template) => {
    try {
      // First, remove default status from all templates of this case type
      const sameTypeTemplates = templates.filter(t => t.case_type === template.case_type);
      await Promise.all(
        sameTypeTemplates.map(t =>
          TaskTemplate.update(t.id, { ...t, is_default: false })
        )
      );

      // Then set this template as default
      await TaskTemplate.update(template.id, { ...template, is_default: true });

      await loadTemplates();
    } catch (error) {
      console.error('Failed to set default template:', error);
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (confirm(`Are you sure you want to delete the "${template.template_name}" template?`)) {
      try {
        await TaskTemplate.delete(template.id);
        await loadTemplates();
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const downloadSampleFile = () => {
    const sampleData = `Category,Task Name,Required
Initial Setup,Receive instructions and check conflicts,TRUE
Initial Setup,Obtain consent to act,TRUE
Initial Setup,Open case file and set up systems,TRUE
Statutory Compliance,File AD01 with Companies House,TRUE
Statutory Compliance,File Form 600 with Companies House,TRUE
Creditor Communications,Send notification letters to creditors,TRUE
Creditor Communications,Send proof of debt forms to creditors,TRUE`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'sample_task_list.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id);
    setEditingTaskData({ ...task });
  };

  const cancelEditingTask = () => {
    setEditingTaskId(null);
    setEditingTaskData(null);
  };

  const saveEditedTask = async () => {
    if (!editingTaskData || !viewingTemplate) return;

    try {
      const updatedTasks = viewingTemplate.tasks.map(task =>
        task.id === editingTaskId ? editingTaskData : task
      );

      const templateUpdateData = {
        ...viewingTemplate,
        tasks: updatedTasks
      };

      await TaskTemplate.update(viewingTemplate.id, templateUpdateData);

      setViewingTemplate(prev => ({
        ...prev,
        tasks: updatedTasks
      }));

      setTemplates(prev => prev.map(t =>
        t.id === viewingTemplate.id
          ? { ...t, tasks: updatedTasks }
          : t
      ));

      setEditingTaskId(null);
      setEditingTaskData(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      setUploadError(null); // Clear any previous error
    } catch (error) {
      console.error('Failed to update task:', error);
      setUploadError(`Failed to update task: ${error.message}`);
      setUploadSuccess(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!viewingTemplate) return;
    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const updatedTasks = viewingTemplate.tasks.filter(t => t.id !== taskId);

      const templateUpdateData = {
        ...viewingTemplate,
        tasks: updatedTasks,
        total_tasks: updatedTasks.length
      };

      await TaskTemplate.update(viewingTemplate.id, templateUpdateData);

      setViewingTemplate(prev => ({
        ...prev,
        tasks: updatedTasks,
        total_tasks: updatedTasks.length
      }));

      setTemplates(prev => prev.map(t =>
        t.id === viewingTemplate.id
          ? { ...t, tasks: updatedTasks, total_tasks: updatedTasks.length }
          : t
      ));

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
      setUploadError(null); // Clear any previous error
    } catch (error) {
      console.error('Failed to delete task:', error);
      setUploadError(`Failed to delete task: ${error.message}`);
      setUploadSuccess(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-blue-800">
            <Upload className="w-6 h-6" />
            Upload Task List Template
          </CardTitle>
          <p className="text-sm text-blue-600">
            Upload CSV or PDF files containing task lists for different case types.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {uploadError && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {uploadError}
            </div>
          )}
          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Task template uploaded successfully!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="caseType">Case Type</Label>
              <Select value={selectedCaseType} onValueChange={setSelectedCaseType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select case type" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard CVL Checklist"
              />
            </div>
            <div>
              <Label htmlFor="fileUpload">Upload File</Label>
              <Label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? 'Uploading...' : 'Choose File'}
                <Input
                  id="fileUpload"
                  type="file"
                  accept=".csv,.pdf,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="outline" onClick={downloadSampleFile} className="text-blue-600 border-blue-300">
              <Download className="w-4 h-4 mr-2" />
              Download Sample CSV
            </Button>
            <p className="text-xs text-slate-600">
              Supported file types: CSV, PDF, and Excel files (.xlsx, .xls). For best results with Excel files, use clear column headers (Category, Task Name, Required).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates by Case Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600" />
            Task List Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
          <Tabs defaultValue="CVL">
            <TabsList className="grid w-full grid-cols-4">
              {CASE_TYPES.map(type => {
                const count = templates.filter(t => t.case_type === type.value).length;
                return (
                  <TabsTrigger key={type.value} value={type.value} className="text-xs">
                    {type.value} ({count})
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CASE_TYPES.map(type => (
              <TabsContent key={type.value} value={type.value} className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{type.label}</h3>
                    <Badge variant="outline">
                      {templates.filter(t => t.case_type === type.value).length} template(s)
                    </Badge>
                  </div>

                  {templates.filter(t => t.case_type === type.value).length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                      <FileText className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <h4 className="font-medium">No templates found</h4>
                      <p className="text-sm">Upload a task list template for {type.label} cases.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Template Name</TableHead>
                            <TableHead className="text-center">Tasks</TableHead>
                            <TableHead className="text-center">Default</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {templates
                            .filter(t => t.case_type === type.value)
                            .map(template => (
                              <TableRow key={template.id}>
                                <TableCell className="font-medium">
                                  {template.template_name}
                                  {template.is_default && (
                                    <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                                      Default
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="outline">{template.total_tasks} tasks</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSetDefault(template)}
                                    disabled={template.is_default}
                                  >
                                    {template.is_default ? (
                                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                    ) : (
                                      <StarOff className="w-4 h-4 text-slate-400" />
                                    )}
                                  </Button>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setViewingTemplate(template)}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTemplate(template)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
          )
        }
        </CardContent>
      </Card>

      {/* Template Viewer */}
      {viewingTemplate && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Template: {viewingTemplate.template_name}</CardTitle>
              <Button variant="outline" onClick={() => setViewingTemplate(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Task updated successfully!
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Case Type</Label>
                  <p className="font-medium">{viewingTemplate.case_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Total Tasks</Label>
                  <p className="font-medium">{viewingTemplate.total_tasks}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-slate-600 mb-2 block">Tasks by Category</Label>
                <div className="space-y-4">
                  {Object.entries(
                    viewingTemplate.tasks.reduce((acc, task) => {
                      if (!acc[task.category]) acc[task.category] = [];
                      acc[task.category].push(task);
                      return acc;
                    }, {})
                  )
                    .sort(([catA], [catB]) => {
                      // Apply custom ordering based on case type
                      const ORDER_MAP = {
                        'CVL': CVL_CATEGORY_ORDER,
                        'MVL': MVL_CATEGORY_ORDER
                      };
                      
                      const categoryOrder = ORDER_MAP[viewingTemplate.case_type] || [];
                      
                      if (categoryOrder.length > 0) {
                        const indexA = categoryOrder.indexOf(catA);
                        const indexB = categoryOrder.indexOf(catB);
                        
                        // If both categories are in the order list, sort by their position
                        if (indexA !== -1 && indexB !== -1) {
                          return indexA - indexB;
                        }
                        // Categories not in the order list go to the end
                        // If A is in order list but B is not, A comes first (-1)
                        if (indexA !== -1) return -1;
                        // If B is in order list but A is not, B comes first (1)
                        if (indexB !== -1) return 1;
                      }

                      // If no custom order or neither are in the order list, sort them alphabetically
                      return catA.localeCompare(catB);
                    })
                    .map(([category, tasks]) => (
                    <div key={category} className="border rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b">
                        <h4 className="font-semibold text-slate-800">{category}</h4>
                      </div>
                      <ul className="divide-y">
                        {tasks
                          .sort((a, b) => (a.order || 0) - (b.order || 0)) // Sort tasks by order, handling undefined order
                          .map((task) => {
                          const isEditing = editingTaskId === task.id;

                          return (
                            <li key={task.id} className="px-4 py-2 hover:bg-slate-50">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs text-slate-600">Task Name</Label>
                                      <Input
                                        value={editingTaskData.name}
                                        onChange={(e) => setEditingTaskData({ ...editingTaskData, name: e.target.value })}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-slate-600">Category</Label>
                                      <Input
                                        value={editingTaskData.category}
                                        onChange={(e) => setEditingTaskData({ ...editingTaskData, category: e.target.value })}
                                        className="h-8 text-sm"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={saveEditedTask} className="h-7 text-xs">
                                      <Save className="w-3 h-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={cancelEditingTask} className="h-7 text-xs">
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 flex-1">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0"></span>
                                    <span className="text-sm text-slate-800">{task.name}</span>
                                    {!task.required && (
                                      <Badge variant="outline" className="text-xs ml-2">Optional</Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => startEditingTask(task)}
                                      className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700"
                                      title="Edit Task"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteTask(task.id)}
                                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                      title="Delete Task"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}