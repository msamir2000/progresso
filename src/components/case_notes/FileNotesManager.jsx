import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Trash2, Save, Loader2, Edit, Package, Users, BookOpen, RefreshCw, BookText, Shield, Calculator } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function FileNotesManager({ caseId, caseData, onUpdate }) {
  const [fileNotes, setFileNotes] = useState([]);
  const [isEditing, setIsEditing] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeSection, setActiveSection] = useState('assets');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    loadCurrentUser();
    loadFileNotes();
  }, [caseId]);

  const loadCurrentUser = async () => {
    try {
      const user = await base44.auth.me();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadFileNotes = async () => {
    try {
      const cases = await base44.entities.Case.filter({ id: caseId });
      if (cases && cases.length > 0) {
        setFileNotes(cases[0].file_notes || []);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('Error loading file notes:', error);
      setFileNotes([]);
      setIsInitialized(true);
    }
  };

  const handleAddNote = async (section) => {
    const newNote = {
      id: `note_${Date.now()}`,
      section: section,
      title: '',
      content: '',
      created_date: new Date().toISOString(),
      created_by: currentUser?.email || '',
      updated_date: new Date().toISOString(),
      updated_by: currentUser?.email || ''
    };

    const updatedNotes = [...fileNotes, newNote];
    setFileNotes(updatedNotes);
    setIsEditing({ [newNote.id]: true });
    
    // Immediately save to database
    setIsSaving(true);
    try {
      await base44.entities.Case.update(caseId, {
        file_notes: updatedNotes
      });
      await loadFileNotes();
    } catch (error) {
      console.error('Error saving new file note:', error);
      alert('Failed to save file note. Please try again.');
      setFileNotes(fileNotes);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateNote = (noteId, field, value) => {
    const updatedNotes = fileNotes.map(note => {
      if (note.id === noteId) {
        return {
          ...note,
          [field]: value,
          updated_date: new Date().toISOString(),
          updated_by: currentUser?.email || ''
        };
      }
      return note;
    });
    setFileNotes(updatedNotes);
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await base44.entities.Case.update(caseId, {
        file_notes: fileNotes
      });
      
      setIsEditing({});
      
      // Reload our own data directly from database
      await loadFileNotes();
    } catch (error) {
      console.error('Error saving file notes:', error);
      alert('Failed to save file notes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this file note?')) {
      return;
    }

    const updatedNotes = fileNotes.filter(note => note.id !== noteId);
    setFileNotes(updatedNotes);
    
    setIsSaving(true);
    try {
      await base44.entities.Case.update(caseId, {
        file_notes: updatedNotes
      });
      await loadFileNotes();
    } catch (error) {
      console.error('Error deleting file note:', error);
      alert('Failed to delete file note. Please try again.');
      setFileNotes(fileNotes);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEdit = (noteId) => {
    setIsEditing(prev => ({
      ...prev,
      [noteId]: !prev[noteId]
    }));
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  const hasUnsavedChanges = Object.values(isEditing).some(v => v === true);

  // Filter notes by active section
  const filteredNotes = fileNotes.filter(note => note.section === activeSection);

  const getSectionIcon = (section) => {
    switch (section) {
      case 'assets': return Package;
      case 'insurance': return Shield;
      case 'employee': return Users;
      case 'books_records': return BookText;
      case 'case_file_notes': return BookOpen;
      case 'tax_considerations': return Calculator;
      case 'update': return RefreshCw;
      default: return FileText;
    }
  };

  const getSectionTitle = (section) => {
    switch (section) {
      case 'assets': return 'Assets';
      case 'insurance': return 'Insurance';
      case 'employee': return 'Employee';
      case 'books_records': return 'Books & Records';
      case 'case_file_notes': return 'Case File Notes';
      case 'tax_considerations': return 'Tax Considerations';
      case 'update': return 'Update';
      default: return 'File Notes';
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Side Menu */}
      <div className="w-56 flex-shrink-0 border-r bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-800 mb-4">File Notes Sections</h3>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveSection('assets')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'assets'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            Assets
          </button>
          <button
            onClick={() => setActiveSection('insurance')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'insurance'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Shield className="w-4 h-4" />
            Insurance
          </button>
          <button
            onClick={() => setActiveSection('employee')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'employee'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Employee
          </button>
          <button
            onClick={() => setActiveSection('books_records')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'books_records'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookText className="w-4 h-4" />
            Books & Records
          </button>
          <button
            onClick={() => setActiveSection('case_file_notes')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'case_file_notes'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Case File Notes
          </button>
          {caseData?.case_type === 'MVL' && (
            <button
              onClick={() => setActiveSection('tax_considerations')}
              className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                activeSection === 'tax_considerations'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Tax Considerations
            </button>
          )}
          <button
            onClick={() => setActiveSection('update')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
              activeSection === 'update'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Update
          </button>
        </nav>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {React.createElement(getSectionIcon(activeSection), { className: "w-6 h-6 text-blue-600" })}
                {getSectionTitle(activeSection)}
              </h2>
              <p className="text-slate-600">Notes and observations for {getSectionTitle(activeSection).toLowerCase()}</p>
            </div>
            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save All Changes
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={() => handleAddNote(activeSection)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                {React.createElement(getSectionIcon(activeSection), { className: "w-16 h-16 text-slate-300 mx-auto mb-4" })}
                <h3 className="font-semibold text-slate-900 mb-2">No Notes in {getSectionTitle(activeSection)}</h3>
                <p className="text-slate-500">Add your first note to get started</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredNotes.map((note) => (
                <Card key={note.id} className="border-slate-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {isEditing[note.id] ? (
                          <Input
                            placeholder="Note title..."
                            value={note.title || ''}
                            onChange={(e) => handleUpdateNote(note.id, 'title', e.target.value)}
                            className="font-semibold text-lg"
                          />
                        ) : (
                          <CardTitle className="text-lg">
                            {note.title || 'Untitled Note'}
                          </CardTitle>
                        )}
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-slate-500">
                            Created: {formatDateTime(note.created_date)}
                            {note.created_by && ` by ${note.created_by}`}
                          </p>
                          {note.updated_date && note.updated_date !== note.created_date && (
                            <>
                              <span className="text-slate-300">•</span>
                              <p className="text-xs text-slate-500">
                                Updated: {formatDateTime(note.updated_date)}
                                {note.updated_by && ` by ${note.updated_by}`}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditing[note.id] ? (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            Editing
                          </Badge>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleEdit(note.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isEditing[note.id] ? (
                      <Textarea
                        placeholder="Enter file note content..."
                        value={note.content || ''}
                        onChange={(e) => handleUpdateNote(note.id, 'content', e.target.value)}
                        className="min-h-[150px]"
                      />
                    ) : (
                      <div 
                        className="text-slate-700 whitespace-pre-wrap cursor-pointer hover:bg-slate-50 p-3 rounded-md"
                        onClick={() => toggleEdit(note.id)}
                      >
                        {note.content || 'No content yet. Click to edit.'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}