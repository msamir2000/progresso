import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Save,
  Edit,
  Loader2,
  XCircle,
  Trash2,
  CheckSquare,
  Clock,
  FileText,
  Target,
  Plus
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        return '—';
    }
};

export default function ActionPointsTab({ caseData, onCaseUpdate, currentUserForPermissions }) {
  const [actionPointsFilter, setActionPointsFilter] = useState('current');
  const [actionPoints, setActionPoints] = useState([]);
  const [isEditingActionPoints, setIsEditingActionPoints] = useState(false);
  const [editingPointId, setEditingPointId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newActionPoint, setNewActionPoint] = useState({
    title: '',
    narrative: '',
    timeToComplete: '',
    dateEntered: new Date().toISOString().split('T')[0],
    updateNote: '',
    dateCompleted: '',
    status: 'current',
  });

  // Load action points from case data
  useEffect(() => {
    if (caseData?.action_points) {
      setActionPoints(caseData.action_points);
    } else {
      setActionPoints([]);
    }
  }, [caseData]);

  const filteredActionPoints = actionPoints.filter(point => point.status === actionPointsFilter);

  const handleAddActionPoint = async () => {
    if (!newActionPoint.title || !newActionPoint.narrative) {
      alert('Please fill in title and narrative');
      return;
    }

    const pointToAdd = {
      ...newActionPoint,
      id: Date.now().toString(),
      createdDate: new Date().toISOString()
    };

    const updatedPoints = [...actionPoints, pointToAdd];

    try {
      setIsSaving(true);
      await base44.entities.Case.update(caseData.id, { action_points: updatedPoints });
      setActionPoints(updatedPoints);
      setNewActionPoint({
        title: '',
        narrative: '',
        timeToComplete: '',
        dateEntered: new Date().toISOString().split('T')[0],
        updateNote: '',
        dateCompleted: '',
        status: 'current'
      });
      setIsEditingActionPoints(false);
      setEditingPointId(null);
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error adding action point:', error);
      alert('Failed to add action point: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkActionPointComplete = async (pointId) => {
    const updatedPoints = actionPoints.map(point => {
      if (point.id === pointId) {
        return {
          ...point,
          status: 'completed',
          dateCompleted: new Date().toISOString().split('T')[0]
        };
      }
      return point;
    });

    try {
      await base44.entities.Case.update(caseData.id, { action_points: updatedPoints });
      setActionPoints(updatedPoints);
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error updating action point:', error);
      alert('Failed to complete action point: ' + error.message);
    }
  };

  const handleUpdateActionPointNote = async (pointId, note) => {
    const updatedPoints = actionPoints.map(point => {
      if (point.id === pointId) {
        return { ...point, updateNote: note };
      }
      return point;
    });

    try {
      await base44.entities.Case.update(caseData.id, { action_points: updatedPoints });
      setActionPoints(updatedPoints);
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error updating action point note:', error);
      alert('Failed to update action point note: ' + error.message);
    }
  };

  const handleDeleteActionPoint = async (pointId) => {
    if (!confirm('Are you sure you want to delete this action point?')) return;

    const updatedPoints = actionPoints.filter(point => point.id !== pointId);

    try {
      await base44.entities.Case.update(caseData.id, { action_points: updatedPoints });
      setActionPoints(updatedPoints);
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error deleting action point:', error);
      alert('Failed to delete action point: ' + error.message);
    }
  };

  const handleEditActionPoint = (point) => {
    setEditingPointId(point.id);
    setNewActionPoint(point);
    setIsEditingActionPoints(true);
  };

  const handleSaveEditActionPoint = async () => {
    if (!newActionPoint.title || !newActionPoint.narrative) {
      alert('Please fill in title and narrative');
      return;
    }

    const updatedPoints = actionPoints.map(point =>
      point.id === editingPointId ? newActionPoint : point
    );

    try {
      setIsSaving(true);
      await base44.entities.Case.update(caseData.id, { action_points: updatedPoints });
      setActionPoints(updatedPoints);
      setNewActionPoint({
        title: '',
        narrative: '',
        timeToComplete: '',
        dateEntered: new Date().toISOString().split('T')[0],
        updateNote: '',
        dateCompleted: '',
        status: 'current'
      });
      setIsEditingActionPoints(false);
      setEditingPointId(null);
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error updating action point:', error);
      alert('Failed to update action point: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingActionPoints(false);
    setEditingPointId(null);
    setNewActionPoint({
      title: '',
      narrative: '',
      timeToComplete: '',
      dateEntered: new Date().toISOString().split('T')[0],
      updateNote: '',
      dateCompleted: '',
      status: 'current'
    });
  };

  const canChangeActionPointsStatus = currentUserForPermissions && 
    (currentUserForPermissions.grade === 'IP' || currentUserForPermissions.grade === 'Manager');

  const handleActionPointsStatusChange = async (newStatus) => {
    if (!canChangeActionPointsStatus) return;
    
    setIsSaving(true);
    try {
      await base44.entities.Case.update(caseData.id, { action_points_status: newStatus });
      if (onCaseUpdate) onCaseUpdate();
    } catch (error) {
      console.error('Error updating action points status:', error);
      alert('Failed to update status: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportActionPoints = () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Action Points - ${caseData?.company_name || 'Case'}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 40px;
      max-width: 1200px;
      margin: 0 auto;
      color: #333;
    }
    h1 {
      color: #1e40af;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      color: #475569;
      margin-top: 30px;
      border-bottom: 2px solid #cbd5e1;
      padding-bottom: 8px;
      margin-bottom: 20px;
    }
    p {
      margin-bottom: 10px;
    }
    .action-point {
      border: 1px solid #e2e8f0;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      background: #f8fafc;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .action-point.completed {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .field {
      margin-bottom: 8px;
      display: flex;
      align-items: baseline;
    }
    .field-label {
      font-weight: bold;
      color: #475569;
      min-width: 150px;
      flex-shrink: 0;
    }
    .field-value {
      color: #1e293b;
      flex-grow: 1;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .status-current {
      background: #dbeafe;
      color: #1e40af;
    }
    .status-completed {
      background: #dcfce7;
      color: #166534;
    }
  </style>
</head>
<body>
  <h1>Action Points</h1>
  <p><strong>Case:</strong> ${caseData?.company_name || 'N/A'} (${caseData?.case_reference || 'N/A'})</p>
  <p><strong>Exported:</strong> ${new Date().toLocaleString()}</p>

  <h2>Current Action Points</h2>
  ${actionPoints.filter(p => p.status === 'current').map(point => `
    <div class="action-point">
      <div class="field">
        <span class="field-label">Status:</span>
        <span class="status-badge status-current">CURRENT</span>
      </div>
      <div class="field">
        <span class="field-label">Title:</span>
        <span class="field-value">${point.title || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Narrative:</span>
        <span class="field-value">${point.narrative || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Time to Complete:</span>
        <span class="field-value">${point.timeToComplete || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Date Entered:</span>
        <span class="field-value">${point.dateEntered ? formatDate(point.dateEntered) : 'N/A'}</span>
      </div>
      ${point.updateNote ? `
      <div class="field">
        <span class="field-label">Update Note:</span>
        <span class="field-value">${point.updateNote}</span>
      </div>
      ` : ''}
    </div>
  `).join('') || '<p>No current action points</p>'}

  <h2>Completed Action Points</h2>
  ${actionPoints.filter(p => p.status === 'completed').map(point => `
    <div class="action-point completed">
      <div class="field">
        <span class="field-label">Status:</span>
        <span class="status-badge status-completed">COMPLETED</span>
      </div>
      <div class="field">
        <span class="field-label">Title:</span>
        <span class="field-value">${point.title || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Narrative:</span>
        <span class="field-value">${point.narrative || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Time to Complete:</span>
        <span class="field-value">${point.timeToComplete || 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Date Entered:</span>
        <span class="field-value">${point.dateEntered ? formatDate(point.dateEntered) : 'N/A'}</span>
      </div>
      <div class="field">
        <span class="field-label">Date Completed:</span>
        <span class="field-value">${point.dateCompleted ? formatDate(point.dateCompleted) : 'N/A'}</span>
      </div>
      ${point.updateNote ? `
      <div class="field">
        <span class="field-label">Update Note:</span>
        <span class="field-value">${point.updateNote}</span>
      </div>
      ` : ''}
    </div>
  `).join('') || '<p>No completed action points</p>'}
</body>
</html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const newWindow = window.open(url, '_blank');
    if (!newWindow) {
      alert('Please allow pop-ups to open the exported HTML file.');
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar Menu */}
      <div className="w-48 border-r bg-slate-50 p-3 flex-shrink-0">
        <div className="space-y-1">
          {/* Filters First */}
          <Button
            variant={actionPointsFilter === 'current' ? 'default' : 'ghost'}
            className={`w-full justify-start h-9 ${actionPointsFilter === 'current' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            onClick={() => setActionPointsFilter('current')}
          >
            <Clock className="w-4 h-4 mr-2" />
            Current
            <Badge variant="secondary" className="ml-auto text-xs">
              {actionPoints.filter(p => p.status === 'current').length}
            </Badge>
          </Button>
          <Button
            variant={actionPointsFilter === 'completed' ? 'default' : 'ghost'}
            className={`w-full justify-start h-9 ${actionPointsFilter === 'completed' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
            onClick={() => setActionPointsFilter('completed')}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Completed
            <Badge variant="secondary" className="ml-auto text-xs">
              {actionPoints.filter(p => p.status === 'completed').length}
            </Badge>
          </Button>

          {/* 2cm Gap */}
          <div className="h-8"></div>

          {/* Action Buttons */}
          {!isEditingActionPoints && (
            <Button
              className="w-full justify-start h-9 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setIsEditingActionPoints(true);
                setEditingPointId(null);
                setNewActionPoint({
                  title: '',
                  narrative: '',
                  timeToComplete: '',
                  dateEntered: new Date().toISOString().split('T')[0],
                  updateNote: '',
                  dateCompleted: '',
                  status: 'current'
                });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start h-9"
            onClick={handleExportActionPoints}
          >
            <FileText className="w-4 h-4 mr-2" />
            Export HTML
          </Button>
        </div>
      </div>

      {/* Main Content Area - Full Width */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Status Section */}
        <Card className="mb-4 border-2 border-slate-300">
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-lg font-semibold text-slate-900">Status</h3>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => handleActionPointsStatusChange('red')}
                  disabled={!canChangeActionPointsStatus}
                  className={`w-14 h-14 rounded-full border-3 transition-all flex items-center justify-center ${
                    caseData?.action_points_status === 'red'
                      ? 'bg-red-500 border-red-700 scale-110 shadow-lg'
                      : 'bg-red-100 border-red-200 hover:bg-red-200'
                  } ${!canChangeActionPointsStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={!canChangeActionPointsStatus ? 'Only IP and Manager can change status' : 'Red'}
                >
                  <span className={`text-xl font-bold ${
                    caseData?.action_points_status === 'red' ? 'text-white' : 'text-red-600'
                  }`}>R</span>
                </button>
                <button
                  onClick={() => handleActionPointsStatusChange('amber')}
                  disabled={!canChangeActionPointsStatus}
                  className={`w-14 h-14 rounded-full border-3 transition-all flex items-center justify-center ${
                    caseData?.action_points_status === 'amber'
                      ? 'bg-amber-400 border-amber-600 scale-110 shadow-lg'
                      : 'bg-amber-100 border-amber-200 hover:bg-amber-200'
                  } ${!canChangeActionPointsStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={!canChangeActionPointsStatus ? 'Only IP and Manager can change status' : 'Amber'}
                >
                  <span className={`text-xl font-bold ${
                    caseData?.action_points_status === 'amber' ? 'text-white' : 'text-amber-600'
                  }`}>A</span>
                </button>
                <button
                  onClick={() => handleActionPointsStatusChange('green')}
                  disabled={!canChangeActionPointsStatus}
                  className={`w-14 h-14 rounded-full border-3 transition-all flex items-center justify-center ${
                    caseData?.action_points_status === 'green'
                      ? 'bg-green-500 border-green-700 scale-110 shadow-lg'
                      : 'bg-green-100 border-green-200 hover:bg-green-200'
                  } ${!canChangeActionPointsStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  title={!canChangeActionPointsStatus ? 'Only IP and Manager can change status' : 'Green'}
                >
                  <span className={`text-xl font-bold ${
                    caseData?.action_points_status === 'green' ? 'text-white' : 'text-green-600'
                  }`}>G</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {/* Add/Edit Form - Compact */}
          {isEditingActionPoints && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">
                  {editingPointId ? 'Edit Action Point' : 'Add New Action Point'}
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <Label className="text-sm">Title</Label>
                      <Input
                        value={newActionPoint.title}
                        onChange={(e) => setNewActionPoint({...newActionPoint, title: e.target.value})}
                        placeholder="Enter title"
                        className="h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Time to Complete</Label>
                      <Input
                        value={newActionPoint.timeToComplete}
                        onChange={(e) => setNewActionPoint({...newActionPoint, timeToComplete: e.target.value})}
                        placeholder="e.g. 2 weeks"
                        className="h-9"
                      />
                    </div>

                    <div>
                      <Label className="text-sm">Date Entered</Label>
                      <Input
                        type="date"
                        value={newActionPoint.dateEntered}
                        onChange={(e) => setNewActionPoint({...newActionPoint, dateEntered: e.target.value})}
                        className="h-9"
                      />
                    </div>

                    <div className="col-span-4">
                      <Label className="text-sm">Narrative</Label>
                      <Textarea
                        value={newActionPoint.narrative}
                        onChange={(e) => setNewActionPoint({...newActionPoint, narrative: e.target.value})}
                        placeholder="Enter detailed narrative"
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancelEdit} className="h-9">
                      Cancel
                    </Button>
                    <Button
                      onClick={editingPointId ? handleSaveEditActionPoint : handleAddActionPoint}
                      className="h-9 bg-blue-600 hover:bg-blue-700"
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      {editingPointId ? 'Update' : 'Add'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Points List */}
          {filteredActionPoints.length === 0 && !isEditingActionPoints ? (
            <Card>
              <CardContent className="p-8 text-center text-slate-500">
                <Target className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No {actionPointsFilter} action points</p>
              </CardContent>
            </Card>
          ) : (
            filteredActionPoints.map((point) => (
              <Card key={point.id} className={point.status === 'completed' ? 'bg-green-50 border-green-200' : ''}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-lg">{point.title}</h4>
                        <Badge className={`capitalize ${point.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {point.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{point.narrative}</p>
                    </div>
                    <div className="flex gap-2">
                      {/* Edit Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditActionPoint(point)}
                        className="h-8 p-1.5"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteActionPoint(point.id)}
                        className="h-8 p-1.5 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Time to Complete:</span>
                      <p className="font-medium">{point.timeToComplete || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Date Entered:</span>
                      <p className="font-medium">{formatDate(point.dateEntered)}</p>
                    </div>
                    {point.dateCompleted && (
                      <div>
                        <span className="text-slate-500">Date Completed:</span>
                        <p className="font-medium text-green-600">{formatDate(point.dateCompleted)}</p>
                      </div>
                    )}
                  </div>

                  {point.updateNote && (
                    <div className="mt-3 p-3 bg-slate-100 rounded">
                      <span className="text-xs text-slate-500">Update Note:</span>
                      <p className="text-sm mt-1">{point.updateNote}</p>
                    </div>
                  )}

                  {point.status === 'current' && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add update note..."
                          value={point.updateNote || ''}
                          onChange={(e) => handleUpdateActionPointNote(point.id, e.target.value)}
                          className="h-9"
                        />
                        <Button
                          onClick={() => handleMarkActionPointComplete(point.id)}
                          className="h-9"
                          variant="outline"
                        >
                          <CheckSquare className="w-4 h-4 mr-2" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}