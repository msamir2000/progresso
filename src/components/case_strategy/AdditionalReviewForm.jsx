import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, FileDown } from "lucide-react";
import SignatureDialog from '../cashiering/SignatureDialog';
import { User } from '@/api/entities';

export default function AdditionalReviewForm({ 
  reviewIndex, 
  reviewName, 
  initialData, 
  reviewDate,
  onSave, 
  isEditing, 
  onToggleEdit,
  onDelete 
}) {
  const dateInputRef = useRef(null);
  const [currentDate, setCurrentDate] = useState('');
  const [currentReviewName, setCurrentReviewName] = useState(reviewName || '');
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [isReviewSigned, setIsReviewSigned] = useState(false);
  const [signatureData, setSignatureData] = useState(null);
  const [reviewData, setReviewData] = useState({
    statutory: { narrative: '', initial_bond_value: '', current_bond_value: '', action_required: '' },
    compliance: { bribery: '', ethical: '', money_laundering: '', noclmar: '' },
    progression: { narrative: '' },
    investigations: { narrative: '', cdda_return_date: '' },
    tax: { narrative: '' },
    distributions: { narrative: '', secured_sum: '', preferential_sum: '', unsecured_sum: '' },
    fees_and_expenses: { narrative: '', basis_agreed: '', fees_billed: '', revision_level: '' },
    action_points: { points: [{ matter: '', actioned_by_date: '' }, { matter: '', actioned_by_date: '' }, { matter: '', actioned_by_date: '' }] },
    closure: { ready_for_closure: '', matters_preventing: '', anticipated_date: '' }
  });

  useEffect(() => {
    if (reviewDate) {
      setCurrentDate(reviewDate);
    }
  }, [reviewDate]);

  useEffect(() => {
    if (initialData) {
      try {
        const parsed = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
        setReviewData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Error parsing review data:', e);
      }
    }
  }, [initialData]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setCurrentDate(newDate);
    if (onSave) {
      onSave({ review_date: newDate });
    }
  };

  const handleDateClick = () => {
    if (isEditing && dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (err) {
        dateInputRef.current.focus();
      }
    }
  };

  const handleReviewNameChange = (e) => {
    const newName = e.target.value;
    setCurrentReviewName(newName);
    if (onSave) {
      onSave({ review_name: newName });
    }
  };

  const handleFieldChange = (section, field, value) => {
    const updatedData = {
      ...reviewData,
      [section]: {
        ...reviewData[section],
        [field]: value
      }
    };
    setReviewData(updatedData);
    if (onSave) {
      onSave({ review_note: JSON.stringify(updatedData) });
    }
  };

  const handleActionPointChange = (index, field, value) => {
    const updatedPoints = [...reviewData.action_points.points];
    updatedPoints[index] = { ...updatedPoints[index], [field]: value };
    const updatedData = {
      ...reviewData,
      action_points: { points: updatedPoints }
    };
    setReviewData(updatedData);
    if (onSave) {
      onSave({ review_note: JSON.stringify(updatedData) });
    }
  };

  const handleSignatureComplete = async (signatureDataUrl) => {
    try {
      const user = await User.me();
      setIsReviewSigned(true);
      setSignatureData(signatureDataUrl);
      setShowSignatureDialog(false);

      if (onSave) {
        onSave({
          [`additional_review_${reviewIndex}_signature_url`]: signatureDataUrl,
          [`additional_review_${reviewIndex}_signed_by`]: user.full_name,
          [`additional_review_${reviewIndex}_signed_date`]: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error saving signature:', error);
    }
  };

  const handleExportToHTML = () => {
    const formattedDate = currentDate ? new Date(currentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not specified';
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${currentReviewName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; line-height: 1.6; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 10px; }
    .review-date { color: #475569; font-size: 1.1em; margin-bottom: 30px; font-weight: bold; }
    h2 { color: #3b82f6; margin-top: 40px; background: #eff6ff; padding: 12px 15px; border-radius: 5px; font-size: 1.4em; border: 1px solid #dbeafe; }
    .field { margin-bottom: 20px; padding: 15px; background: #fdfdfd; border: 1px solid #e0e7ff; border-radius: 6px; }
    .label { font-weight: bold; color: #475569; display: block; margin-bottom: 8px; font-size: 0.95em; }
    .value { color: #1e293b; background: #f8fafc; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0; white-space: pre-wrap; word-break: break-word; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${currentReviewName}</h1>
  <div class="review-date">Date of Review: ${formattedDate}</div>
  
  <h2>Statutory</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.statutory.narrative || 'N/A'}</div>
  </div>
  
  <h2>Compliance</h2>
  <div class="field">
    <span class="label">Bribery Act:</span>
    <div class="value">${reviewData.compliance.bribery || 'N/A'}</div>
  </div>
  
  <h2>Progression</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.progression.narrative || 'N/A'}</div>
  </div>
  
  <h2>Action Points</h2>
  ${reviewData.action_points.points.map((point, i) => `
    <div class="field">
      <span class="label">Action ${i + 1}:</span>
      <div class="value">${point.matter || 'N/A'}</div>
      <span class="label">Due Date:</span>
      <div class="value">${point.actioned_by_date || 'N/A'}</div>
    </div>
  `).join('')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentReviewName.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <div className="flex items-center gap-3 flex-1">
          <Input
            type="text"
            value={currentReviewName}
            onChange={handleReviewNameChange}
            disabled={!isEditing}
            className="text-2xl font-bold h-auto border-0 px-0 focus:ring-0 disabled:opacity-100"
          />
          <input
            ref={dateInputRef}
            type="date"
            value={currentDate}
            onChange={handleDateChange}
            onClick={handleDateClick}
            onFocus={handleDateClick}
            disabled={!isEditing}
            style={{ colorScheme: 'light' }}
            className={`w-40 h-9 px-3 py-2 text-sm rounded-md border border-slate-300 bg-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100 ${!isEditing ? 'font-bold' : ''}`}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExportToHTML}
            className="text-green-600 border-green-300"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            onClick={onDelete}
            className="text-red-600 border-red-300"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          
          <button
            onClick={() => onToggleEdit && onToggleEdit()}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              isEditing 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {isEditing ? '🔓 Unlocked' : '🔒 Locked'}
          </button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statutory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Narrative</Label>
            <Textarea
              value={reviewData.statutory.narrative}
              onChange={(e) => handleFieldChange('statutory', 'narrative', e.target.value)}
              disabled={!isEditing}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Action Points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {reviewData.action_points.points.map((point, index) => (
            <div key={index} className="space-y-2 p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Matter {index + 1}</Label>
                <Input
                  value={point.matter}
                  onChange={(e) => handleActionPointChange(index, 'matter', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              <div>
                <Label>To be actioned by</Label>
                <Input
                  type="date"
                  value={point.actioned_by_date}
                  onChange={(e) => handleActionPointChange(index, 'actioned_by_date', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {showSignatureDialog && (
        <SignatureDialog
          onClose={() => setShowSignatureDialog(false)}
          onSign={handleSignatureComplete}
        />
      )}
    </div>
  );
}