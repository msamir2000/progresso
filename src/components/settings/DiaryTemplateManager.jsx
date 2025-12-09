
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Upload,
  Download,
  BookOpen,
  Plus,
  Trash2,
  Star,
  StarOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  Info,
  Save,
  X,
  Pencil // Added Pencil icon for editing
} from 'lucide-react';
import { DiaryTemplate } from '@/api/entities';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';

const CASE_TYPES = [
  { value: 'CVL', label: 'Creditors Voluntary Liquidation (CVL)' },
  { value: 'MVL', label: 'Members Voluntary Liquidation (MVL)' },
  { value: 'Administration', label: 'Administration' },
  { value: 'CVA', label: 'Company Voluntary Arrangement (CVA)' }
];

const formatTimeDisplay = (timeValue) => {
  if (!timeValue || timeValue === 'TBD') return 'TBD';
  
  // Replace Business Day(s) with Working Day(s)
  let formatted = timeValue.replace(/Business Day\(s\)/gi, 'Working Day(s)');
  
  const numMatch = formatted.match(/^([+-]?\d+)\s*(day|days|month|months|working day|working days)?/i);
  if (numMatch) {
    const number = parseInt(numMatch[1], 10);
    const unit = numMatch[2] ? numMatch[2].toLowerCase() : null;
    
    let displayUnit = 'Day(s)';
    if (unit && (unit.startsWith('month'))) {
      displayUnit = 'Month(s)';
    } else if (unit && (unit.startsWith('working day'))) {
      displayUnit = 'Working Day(s)';
    }

    if (number === 0) {
      return `0 ${displayUnit}`;
    } else if (number > 0) {
      return `+${number} ${displayUnit}`;
    } else {
      return `${number} ${displayUnit}`;
    }
  }
  
  return formatted;
};

export default function DiaryTemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedCaseType, setSelectedCaseType] = useState('CVL');
  const [templateName, setTemplateName] = useState('');
  const [viewingTemplate, setViewingTemplate] = useState(null);

  const [showAddEntryForm, setShowAddEntryForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    category: '',
    title: '',
    reference_point: 'Date of Appointment',
    time: ''
  });
  const [addingEntry, setAddingEntry] = useState(false);

  // New state variables for editing functionality
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [editingEntryData, setEditingEntryData] = useState(null);
  const [savingEntry, setSavingEntry] = useState(false);


  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const templateList = await DiaryTemplate.list('-updated_date');
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load diary templates:', error);
      setUploadError('Failed to load templates. Please refresh the page.');
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

    const fileExtension = file.name.toLowerCase().split('.').pop();
    const supportedTypes = ['csv', 'pdf'];
    if (!supportedTypes.includes(fileExtension)) {
      setUploadError(`File type .${fileExtension} is not supported. Please use CSV or PDF files.`);
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const { file_url } = await UploadFile({ file });
      
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            diary_entries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  diary_task: { type: "string", description: "The name/title of the diary task" },
                  grouping: { type: "string", description: "Pre Appointment or Post Appointment" },
                  reference: { type: "string", description: "Reference point like Date of Appointment" },
                  time: { type: "string", description: "Timing like -5 Working Day(s), 1 Day(s), etc." }
                },
                required: ["diary_task", "grouping", "time"]
              }
            }
          }
        }
      });

      if (extractResult.status === "success" && extractResult.output?.diary_entries) {
        const diaryEntries = extractResult.output.diary_entries.map((entry, index) => ({
          id: `${selectedCaseType.toLowerCase()}_diary_${index + 1}`,
          category: entry.grouping || 'Post Appointment',
          title: entry.diary_task || 'Untitled Task',
          description: '',
          order: index + 1,
          required: true,
          reference_point: entry.reference || 'Date of Appointment',
          time: entry.time || 'TBD'
        }));

        const templateData = {
          case_type: selectedCaseType,
          template_name: templateName,
          diary_entries: diaryEntries,
          file_url: file_url,
          total_entries: diaryEntries.length,
          is_default: false
        };

        const existingTemplate = templates.find(t =>
          t.case_type === selectedCaseType && t.template_name === templateName
        );

        if (existingTemplate) {
          await DiaryTemplate.update(existingTemplate.id, templateData);
        } else {
          await DiaryTemplate.create(templateData);
        }

        setUploadSuccess(true);
        setTemplateName('');
        setTimeout(() => setUploadSuccess(false), 3000);
        await loadTemplates();
      } else {
        setUploadError('Could not extract diary entries from file. Please check the format.');
      }
    } catch (error) {
      setUploadError(`Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      event.target.value = '';
      setIsUploading(false);
    }
  };

  const handleSetDefault = async (template) => {
    try {
      const sameTypeTemplates = templates.filter(t => t.case_type === template.case_type);
      await Promise.all(
        sameTypeTemplates.map(t =>
          DiaryTemplate.update(t.id, { ...t, is_default: false })
        )
      );

      await DiaryTemplate.update(template.id, { ...template, is_default: true });
      await loadTemplates();
    } catch (error) {
      setUploadError('Failed to set default template');
    }
  };

  const handleDeleteTemplate = async (template) => {
    if (confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
      try {
        await DiaryTemplate.delete(template.id);
        await loadTemplates();
        if (viewingTemplate && viewingTemplate.id === template.id) {
          setViewingTemplate(null);
        }
      } catch (error) {
        setUploadError('Failed to delete template');
      }
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.title.trim() || !newEntry.category.trim() || !newEntry.reference_point.trim() || !newEntry.time.trim()) {
      setUploadError('All fields are required to add a new entry');
      return;
    }

    if (!viewingTemplate) {
      setUploadError('No template selected');
      return;
    }

    setAddingEntry(true);
    setUploadError(null);

    try {
      const maxId = viewingTemplate.diary_entries.reduce((max, entry) => {
        const idNum = parseInt(entry.id.split('_').pop()) || 0; // Extracts number from 'cvl_diary_123'
        return Math.max(max, idNum);
      }, 0);

      const newEntryWithId = {
        id: `${viewingTemplate.case_type.toLowerCase()}_diary_${maxId + 1}`,
        category: newEntry.category.trim(),
        title: newEntry.title.trim(),
        description: '', // Default empty description for manually added entries
        order: viewingTemplate.diary_entries.length + 1, // Simple ordering, can be improved
        required: true, // Default to true for manually added entries
        reference_point: newEntry.reference_point.trim(),
        time: newEntry.time.trim()
      };

      const updatedEntries = [...viewingTemplate.diary_entries, newEntryWithId];

      await DiaryTemplate.update(viewingTemplate.id, {
        ...viewingTemplate,
        diary_entries: updatedEntries,
        total_entries: updatedEntries.length
      });

      setTemplates(prev => prev.map(t => 
        t.id === viewingTemplate.id 
          ? { ...t, diary_entries: updatedEntries, total_entries: updatedEntries.length }
          : t
      ));

      setViewingTemplate(prev => ({
        ...prev,
        diary_entries: updatedEntries,
        total_entries: updatedEntries.length
      }));

      setNewEntry({
        category: '',
        title: '',
        reference_point: 'Date of Appointment',
        time: ''
      });
      setShowAddEntryForm(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      setUploadError(`Failed to add entry: ${error.message}`);
    } finally {
      setAddingEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!viewingTemplate) {
      setUploadError('No template selected');
      return;
    }

    if (!confirm('Are you sure you want to delete this diary entry?')) {
      return;
    }

    setUploadError(null); // Clear any previous errors
    try {
      const updatedEntries = viewingTemplate.diary_entries.filter(entry => entry.id !== entryId);

      await DiaryTemplate.update(viewingTemplate.id, {
        ...viewingTemplate,
        diary_entries: updatedEntries,
        total_entries: updatedEntries.length
      });

      setTemplates(prev => prev.map(t => 
        t.id === viewingTemplate.id 
          ? { ...t, diary_entries: updatedEntries, total_entries: updatedEntries.length }
          : t
      ));

      setViewingTemplate(prev => ({
        ...prev,
        diary_entries: updatedEntries,
        total_entries: updatedEntries.length
      }));

      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      setUploadError(`Failed to delete entry: ${error.message}`);
    }
  };

  const startEditingEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEditingEntryData({ ...entry });
    setUploadError(null); // Clear any previous errors
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
    setEditingEntryData(null);
    setUploadError(null); // Clear any previous errors
  };

  const saveEditedEntry = async () => {
    if (!editingEntryData.title.trim() || !editingEntryData.category.trim() || !editingEntryData.reference_point.trim() || !editingEntryData.time.trim()) {
      setUploadError('All fields (title, category, reference point, time) are required to save changes.');
      return;
    }

    setSavingEntry(true);
    setUploadError(null);

    try {
      const updatedEntries = viewingTemplate.diary_entries.map(entry =>
        entry.id === editingEntryId ? editingEntryData : entry
      );

      await DiaryTemplate.update(viewingTemplate.id, {
        ...viewingTemplate,
        diary_entries: updatedEntries
      });

      setTemplates(prev => prev.map(t =>
        t.id === viewingTemplate.id
          ? { ...t, diary_entries: updatedEntries }
          : t
      ));

      setViewingTemplate(prev => ({
        ...prev,
        diary_entries: updatedEntries
      }));

      setEditingEntryId(null);
      setEditingEntryData(null);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (error) {
      setUploadError(`Failed to save entry: ${error.message}`);
    } finally {
      setSavingEntry(false);
    }
  };

  const downloadSampleFile = () => {
    const sampleData = `Diary Task,Grouping,Reference,Time
Circular to Creditors enc Notice of Deemed Consent + Cert of Postage,Pre Appointment,Creditors Meeting,-5 Working Day(s)
Circular to Members,Pre Appointment,Members meeting,-5 Working Day(s)
Email HMRC using notifications.hmrccvl@hmrc.gsi.gov.uk,Pre Appointment,Creditors Meeting,-5 Working Day(s)
Complete Insurance File Note - take out open cover,Post Appointment,Date of Appointment,1 Day(s)
Start ERA File Note,Post Appointment,Date of Appointment,1 Day(s)
Case Strategy Note,Post Appointment,Date of Appointment,1 Day(s)`;

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_diary_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-green-800">
            <Upload className="w-6 h-6" />
            Upload Diary Template
          </CardTitle>
          <p className="text-sm text-green-600">
            Upload CSV or PDF files containing diary entry templates for different case types.
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
              Diary template uploaded successfully!
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <Label htmlFor="caseType">Case Type</Label>
              <Select value={selectedCaseType} onValueChange={setSelectedCaseType}>
                <SelectTrigger className="h-9">
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
                placeholder="e.g., Standard CVL Diary"
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="fileUpload">Upload File</Label>
              <Label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-300 rounded-md px-3 py-2 hover:bg-slate-50 h-9">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isUploading ? 'Uploading...' : 'Choose File'}
                <Input
                  id="fileUpload"
                  type="file"
                  accept=".csv,.pdf"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </Label>
            </div>
            <div>
              <Button variant="outline" onClick={downloadSampleFile} className="text-green-600 border-green-300 hover:bg-green-50 h-9">
                <Download className="w-3 h-3 mr-1" />
                Download CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates by Case Type */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-green-600" />
            Diary Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <h3 className="text-lg font-semibold flex items-center justify-between">
                    {type.label}
                    <Badge variant="outline">
                      {templates.filter(t => t.case_type === type.value).length} template(s)
                    </Badge>
                  </h3>

                  {templates.filter(t => t.case_type === type.value).length === 0 ? (
                    <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
                      <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                      <h4 className="font-medium">No templates found</h4>
                      <p className="text-sm">Upload a diary template for {type.label} cases.</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold text-slate-700">Template Name</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Entries</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
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
                                  <Badge variant="outline">{template.total_entries} entries</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setViewingTemplate(template)}
                                      className="text-blue-600 hover:text-blue-700"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
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
        </CardContent>
      </Card>

      {/* Template Viewer */}
      {viewingTemplate && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diary Template: {viewingTemplate.template_name}</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowAddEntryForm(!showAddEntryForm);
                    cancelEditingEntry(); // Exit editing mode if opening add form
                  }}
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
                <Button variant="outline" onClick={() => setViewingTemplate(null)}>
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-slate-600">Case Type</Label>
                  <p className="font-medium">{viewingTemplate.case_type}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-slate-600">Total Entries</Label>
                  <p className="font-medium">{viewingTemplate.total_entries}</p>
                </div>
              </div>

              {/* Add Entry Form */}
              {showAddEntryForm && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                  <h4 className="font-semibold text-green-800">Add New Diary Entry</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Category *</Label>
                      <Select
                        value={newEntry.category}
                        onValueChange={(value) => setNewEntry(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pre Appointment">Pre Appointment</SelectItem>
                          <SelectItem value="Post Appointment">Post Appointment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Reference Point *</Label>
                      <Input
                        value={newEntry.reference_point}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, reference_point: e.target.value }))}
                        placeholder="e.g., Date of Appointment"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium text-slate-700">Diary Entry Title *</Label>
                      <Input
                        value={newEntry.title}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Complete Insurance File Note"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-slate-700">Time (relative to reference) *</Label>
                      <Input
                        value={newEntry.time}
                        onChange={(e) => setNewEntry(prev => ({ ...prev, time: e.target.value }))}
                        placeholder="e.g., -5 Day(s), +1 Month(s), 0 Day(s)"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Use format: -5 Day(s) for before, +1 Day(s) for after, 0 Day(s) for same day. You can also specify 'Working Day(s)' or 'Month(s)'.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleAddEntry}
                      disabled={addingEntry}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {addingEntry ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Add Entry
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddEntryForm(false);
                        setNewEntry({
                          category: '',
                          title: '',
                          reference_point: 'Date of Appointment',
                          time: ''
                        });
                        setUploadError(null);
                      }}
                      disabled={addingEntry}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing entries display */}
              {Object.entries(
                viewingTemplate.diary_entries.reduce((acc, entry) => {
                  if (!acc[entry.category]) acc[entry.category] = [];
                  acc[entry.category].push(entry);
                  return acc;
                }, {})
              ).map(([category, entries]) => (
                <div key={category} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2 border-b">
                    <h4 className="font-semibold text-slate-800">{category}</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold text-slate-700 w-96">Diary Entry</TableHead>
                          <TableHead className="font-semibold text-slate-700">Reference Point</TableHead>
                          <TableHead className="font-semibold text-slate-700 w-56">
                            <div className="flex items-center gap-2">
                              Time
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="text-slate-500 hover:text-slate-700">
                                    <Info className="w-4 h-4" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4">
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-slate-900">Time Format Examples</h4>
                                    <div className="text-sm text-slate-700 space-y-2">
                                      <div><strong>Before reference:</strong></div>
                                      <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                                        <li><code>-5 Day(s)</code> - 5 days before</li>
                                        <li><code>-2 Working Day(s)</code> - 2 working days before</li>
                                        <li><code>-1 Month(s)</code> - 1 month before</li>
                                      </ul>
                                      <div><strong>After reference:</strong></div>
                                      <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                                        <li><code>+1 Day(s)</code> - 1 day after</li>
                                        <li><code>+7 Day(s)</code> - 7 days after</li>
                                        <li><code>+2 Month(s)</code> - 2 months after</li>
                                      </ul>
                                      <div><strong>On the date:</strong></div>
                                      <ul className="list-disc list-inside ml-2 space-y-1 text-xs">
                                        <li><code>0 Day(s)</code> - On the reference date</li>
                                      </ul>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map((entry) => {
                          const isEditing = editingEntryId === entry.id;
                          
                          return (
                            <TableRow key={entry.id} className="border-b border-slate-200">
                              <TableCell className="py-2 px-4">
                                {isEditing ? (
                                  <Input
                                    value={editingEntryData.title}
                                    onChange={(e) => setEditingEntryData({...editingEntryData, title: e.target.value})}
                                    className="h-8"
                                    disabled={savingEntry}
                                  />
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></span>
                                    <div className="flex-1">
                                      <p className="font-medium text-slate-800 whitespace-nowrap overflow-hidden text-ellipsis">{entry.title}</p>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="py-2 px-4">
                                {isEditing ? (
                                  <Input
                                    value={editingEntryData.reference_point}
                                    onChange={(e) => setEditingEntryData({...editingEntryData, reference_point: e.target.value})}
                                    className="h-8"
                                    disabled={savingEntry}
                                  />
                                ) : (
                                  <span className="text-sm font-medium text-slate-700">
                                    {entry.reference_point || 'Date of Appointment'}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 px-4">
                                {isEditing ? (
                                  <Input
                                    value={editingEntryData.time}
                                    onChange={(e) => setEditingEntryData({...editingEntryData, time: e.target.value})}
                                    placeholder="e.g., -5 Day(s), +1 Month(s)"
                                    className="h-8"
                                    disabled={savingEntry}
                                  />
                                ) : (
                                  <span className="text-sm font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded">
                                    {formatTimeDisplay(entry.time)}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="py-2 px-4 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={saveEditedEntry}
                                      disabled={savingEntry}
                                      className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    >
                                      {savingEntry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={cancelEditingEntry}
                                      disabled={savingEntry}
                                      className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        startEditingEntry(entry);
                                        setShowAddEntryForm(false); // Close add form if opening edit
                                      }}
                                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
