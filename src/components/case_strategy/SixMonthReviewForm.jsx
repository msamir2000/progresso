import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building,
  AlertCircle,
  Search,
  ChevronDown,
  FileText,
  Users,
  TrendingUp,
  ClipboardList,
  Shield,
  FileDown,
  Receipt,
  Landmark,
  PoundSterling,
  CheckCircle2,
  ListChecks,
  Loader2
} from "lucide-react";

const ActionPointInput = ({ value, onChange, onRemove, isEditing }) => (
  <div className="flex items-center gap-2">
    <Input
      className="bg-white border-slate-300"
      placeholder="Action point matter..."
      value={value.matter}
      onChange={(e) => onChange('matter', e.target.value)}
      disabled={!isEditing}
    />
    <Input
      className="bg-white border-slate-300 w-48"
      placeholder="Actioned by & date..."
      value={value.actioned_by_date}
      onChange={(e) => onChange('actioned_by_date', e.target.value)}
      disabled={!isEditing}
    />
    {isEditing && (
      <Button variant="ghost" size="icon" onClick={onRemove} className="text-red-500 hover:text-red-700">
        <AlertCircle className="w-4 h-4" />
      </Button>
    )}
  </div>
);

export default function SixMonthReviewForm({ initialData, onSave, isEditing }) {
  const dateInputRef = useRef(null);
  const [currentDate, setCurrentDate] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Initial state for reviewData, with 3 default action points
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

  // All sections are closed initially
  const [openSections, setOpenSections] = useState({
    statutory: false,
    compliance: false,
    progression: false,
    investigations: false,
    tax: false,
    distributions: false,
    fees_and_expenses: false,
    action_points: false,
    closure: false
  });

  useEffect(() => {
    setIsLoadingData(true);
    if (initialData) {
      try {
        let parsedData;
        if (typeof initialData === 'string') {
          parsedData = JSON.parse(initialData);
        } else {
          parsedData = initialData;
        }

        setReviewData(prevReviewData => {
            const newReviewData = { ...prevReviewData }; // Start with current default/existing
            for (const sectionKey in prevReviewData) { // Iterate over expected sections
                if (parsedData[sectionKey] && typeof parsedData[sectionKey] === 'object') {
                    // If parsedData has this section and it's an object, merge its content.
                    newReviewData[sectionKey] = { ...prevReviewData[sectionKey], ...parsedData[sectionKey] };
                } else if (parsedData.hasOwnProperty(sectionKey)) {
                    // If parsedData has this key but it's not an object (e.g., null, primitive), assign directly.
                    newReviewData[sectionKey] = parsedData[sectionKey];
                }
            }

            // Special handling for action_points: ensure at least 3 points if not present or empty in parsedData
            // This ensures the form always has input fields for action points, even if initial data is empty
            if (!newReviewData.action_points || !newReviewData.action_points.points || newReviewData.action_points.points.length === 0) {
                newReviewData.action_points = {
                    points: [
                        { matter: '', actioned_by_date: '' },
                        { matter: '', actioned_by_date: '' },
                        { matter: '', actioned_by_date: '' }
                    ]
                };
            }
            return newReviewData;
        });

      } catch (error) {
        console.error("Failed to parse 6 month review initial data:", error);
      }
    }
    setIsLoadingData(false);
  }, [initialData]);

  // Handle currentDate for the date input
  useEffect(() => {
    if (initialData?.review_6_month_date) {
      setCurrentDate(initialData.review_6_month_date);
    }
  }, [initialData?.review_6_month_date]);

  const toggleSection = (key) => {
    setOpenSections(prevOpenSections => {
      const isCurrentlyOpen = prevOpenSections[key];
      
      const allClosed = Object.keys(prevOpenSections).reduce((acc, sectionKey) => {
        acc[sectionKey] = false;
        return acc;
      }, {});
      
      if (!isCurrentlyOpen) {
        allClosed[key] = true;
      }
      
      return allClosed;
    });
  };

  const handleSectionChange = (section, field, value) => {
    const updatedReviewData = {
      ...reviewData,
      [section]: {
        ...reviewData[section],
        [field]: value
      }
    };
    setReviewData(updatedReviewData);
    
    // IMMEDIATE SAVE - save to database on every change
    if (onSave) {
      const currentInitialData = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      
      const { action_points, ...reviewNoteWithoutActionPoints } = updatedReviewData;

      const dataToSave = { 
        review_6_month_note: reviewNoteWithoutActionPoints,
        review_6_month_signature_url: currentInitialData?.review_6_month_signature_url,
        review_6_month_signed_by: currentInitialData?.review_6_month_signed_by,
        review_6_month_signature_url_2: currentInitialData?.review_6_month_signature_url_2,
        review_6_month_signed_by_2: currentInitialData?.review_6_month_signed_by_2,
        review_6_month_date: currentInitialData?.review_6_month_date || new Date().toISOString().split('T')[0],
      };
      onSave(dataToSave);
    }
  };

  const handleActionPointChange = (index, field, value) => {
    const updatedPoints = [...reviewData.action_points.points];
    // Ensure the point at index exists before updating. If not, initialize.
    if (!updatedPoints[index]) {
      updatedPoints[index] = { matter: '', actioned_by_date: '' };
    }
    updatedPoints[index] = { ...updatedPoints[index], [field]: value };
    
    const updatedReviewData = {
      ...reviewData,
      action_points: {
        ...reviewData.action_points,
        points: updatedPoints
      }
    };
    setReviewData(updatedReviewData);
    
    // IMMEDIATE SAVE - save to database on every change
    if (onSave) {
      const currentInitialData = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      
      const { action_points, ...reviewNoteWithoutActionPoints } = updatedReviewData;

      const dataToSave = { 
        review_6_month_note: reviewNoteWithoutActionPoints,
        review_6_month_signature_url: currentInitialData?.review_6_month_signature_url,
        review_6_month_signed_by: currentInitialData?.review_6_month_signed_by,
        review_6_month_signature_url_2: currentInitialData?.review_6_month_signature_url_2,
        review_6_month_signed_by_2: currentInitialData?.review_6_month_signed_by_2,
        review_6_month_date: currentInitialData?.review_6_month_date || new Date().toISOString().split('T')[0],
      };
      onSave(dataToSave);
    }
  };

  const addActionPoint = () => {
    const newPoints = [...reviewData.action_points.points, { matter: '', actioned_by_date: '' }];
    handleSectionChange('action_points', 'points', newPoints); // This will trigger a save without action_points in review_6_month_note
  };

  const removeActionPoint = (index) => {
    const newPoints = reviewData.action_points.points.filter((_, i) => i !== index);
    handleSectionChange('action_points', 'points', newPoints); // This will trigger a save without action_points in review_6_month_note
  };
  
  const handleExportToHTML = () => {
    const formattedDate = currentDate ? new Date(currentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Not specified';
    
    // Note: For export, we use the current internal state (reviewData) which still contains action_points,
    // as export represents the full review content, regardless of what's sent to 'onSave'.
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>6 Month Review</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto; line-height: 1.6; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 10px; margin-top: 0; }
    .review-date { color: #475569; font-size: 1.1em; margin-bottom: 30px; font-weight: bold; }
    .signature-boxes { border: 2px solid #cbd5e1; border-radius: 8px; padding: 25px; background: #f8fafc; margin-top: 40px; margin-bottom: 40px; max-width: 900px; margin-left: auto; margin-right: auto; }
    .signature-content { display: flex; gap: 30px; margin-bottom: 20px; }
    .signature-column { flex: 1; }
    .signature-line { border-bottom: 3px solid #000; height: 80px; margin-bottom: 8px; }
    .column-label { font-size: 14px; color: #000; display: block; text-align: left; font-weight: 500; margin-bottom: 15px; }
    .print-name-line { border-bottom: 3px solid #000; height: 60px; margin-bottom: 8px; }
    .print-label { font-size: 14px; color: #000; display: block; text-align: left; font-weight: 500; }
    h2 { color: #3b82f6; margin-top: 40px; background: #eff6ff; padding: 12px 15px; border-radius: 5px; font-size: 1.4em; border: 1px solid #dbeafe; }
    h3 { color: #2563eb; margin-top: 25px; margin-bottom: 15px; font-size: 1.1em; border-bottom: 1px solid #eff6ff; padding-bottom: 5px; }
    .field { margin-bottom: 20px; padding: 15px; background: #fdfdfd; border: 1px solid #e0e7ff; border-radius: 6px; }
    .label { font-weight: bold; color: #475569; display: block; margin-bottom: 8px; font-size: 0.95em; }
    .value { color: #1e293b; background: #f8fafc; padding: 12px; border-radius: 4px; border: 1px solid #e2e8f0; white-space: pre-wrap; word-break: break-word; font-size: 0.9em; }
    .checkbox-container { display: flex; align-items: center; margin-bottom: 10px; }
    .checkbox { display: inline-block; width: 18px; height: 18px; border: 2px solid #3b82f6; margin-right: 10px; flex-shrink: 0; position: relative; top: 2px; }
    .checked { background-color: #3b82f6; border-color: #3b82f6; }
    .checked::after { content: '✔'; color: white; font-size: 12px; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    .checkbox-label { color: #1e293b; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>6 Month Review</h1>
  <div class="review-date">Date of Review: ${formattedDate}</div>
  
  <h2>Statutory</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.statutory.narrative || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Initial Case Bonding Value:</span>
    <div class="value">£${reviewData.statutory.initial_bond_value || '0'}</div>
  </div>
  <div class="field">
    <span class="label">Current Bond Value:</span>
    <div class="value">£${reviewData.statutory.current_bond_value || '0'}</div>
  </div>
  <div class="field">
    <span class="label">Action Required:</span>
    <div class="value">${reviewData.statutory.action_required || 'N/A'}</div>
  </div>
  
  <h2>Compliance</h2>
  <h3>Bribery Act</h3>
  <div class="field">
    <div class="value">${reviewData.compliance.bribery || 'N/A'}</div>
  </div>
  
  <h3>Ethical Review</h3>
  <div class="field">
    <div class="value">${reviewData.compliance.ethical || 'N/A'}</div>
  </div>
  
  <h3>Money Laundering</h3>
  <div class="field">
    <div class="value">${reviewData.compliance.money_laundering || 'N/A'}</div>
  </div>
  
  <h3>NOCLAR</h3>
  <div class="field">
    <div class="value">${reviewData.compliance.noclmar || 'N/A'}</div>
  </div>
  
  <h2>Progression</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.progression.narrative || 'N/A'}</div>
  </div>
  
  <h2>Investigations</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.investigations.narrative || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">CDDA Return Due Date and submissions date:</span>
    <div class="value">${reviewData.investigations.cdda_return_date || 'N/A'}</div>
  </div>
  
  <h2>Tax</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.tax.narrative || 'N/A'}</div>
  </div>
  
  <h2>Distributions</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.distributions.narrative || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Secured: Date and sum:</span>
    <div class="value">${reviewData.distributions.secured_sum || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Preferential: Date and sum:</span>
    <div class="value">${reviewData.distributions.preferential_sum || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Unsecured: Date and sum:</span>
    <div class="value">${reviewData.distributions.unsecured_sum || 'N/A'}</div>
  </div>
  
  <h2>Fees & Expenses</h2>
  <div class="field">
    <span class="label">Narrative:</span>
    <div class="value">${reviewData.fees_and_expenses.narrative || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Basis agreed (incl. cap):</span>
    <div class="value">${reviewData.fees_and_expenses.basis_agreed || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">Level of (net) fees billed:</span>
    <div class="value">£${reviewData.fees_and_expenses.fees_billed || '0'}</div>
  </div>
  <div class="field">
    <span class="label">Revision adequate level:</span>
    <div class="value">${reviewData.fees_and_expenses.revision_level || 'N/A'}</div>
  </div>
  
  <h2>Action Points</h2>
  ${reviewData.action_points.points.map((point, index) => `
    <div class="field action-point">
      <span class="label">Matter ${index + 1}:</span>
      <div class="value">${point.matter || 'N/A'}</div>
      <span class="label">Actioned by & date:</span>
      <div class="value">${point.actioned_by_date || 'N/A'}</div>
    </div>
  `).join('')}
  
  <h2>Closure</h2>
  <div class="field">
    <span class="label">Is this case ready to be closed?</span>
    <div class="value">${reviewData.closure.ready_for_closure || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">If no, what are the key matters preventing closure?</span>
    <div class="value">${reviewData.closure.matters_preventing || 'N/A'}</div>
  </div>
  <div class="field">
    <span class="label">When is it currently anticipated this case will be concluded?</span>
    <div class="value">${reviewData.closure.anticipated_date || 'N/A'}</div>
  </div>
  
  <div class="signature-boxes">
    <div class="signature-content">
      <div class="signature-column">
        <div class="signature-line"></div>
        <span class="column-label">Office Holders Signature</span>
      </div>
      <div class="signature-column">
        <div class="signature-line"></div>
        <span class="column-label">Admin Signature</span>
      </div>
    </div>
    <div class="signature-content">
      <div class="signature-column">
        <div class="print-name-line"></div>
        <span class="print-label">Print Name</span>
      </div>
      <div class="signature-column">
        <div class="print-name-line"></div>
        <span class="print-label">Print Name</span>
      </div>
    </div>
  </div>
  
</body>
</html>
    `;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups for this website to export the review.');
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setCurrentDate(newDate);
    if (onSave) {
      // Ensure initialData is correctly parsed to get existing signature data for export if needed
      const currentInitialData = typeof initialData === 'string' ? JSON.parse(initialData) : initialData;
      
      // Get the current reviewData and remove 'action_points' from it
      // to remove action points sync via the review_6_month_note payload.
      const reviewNoteToSave = currentInitialData?.review_6_month_note ? 
        (typeof currentInitialData.review_6_month_note === 'string' ? JSON.parse(currentInitialData.review_6_month_note) : currentInitialData.review_6_month_note) 
        : reviewData;
      
      const { action_points, ...reviewNoteWithoutActionPoints } = reviewNoteToSave;

      const dataToSave = { 
        review_6_month_date: newDate,
        review_6_month_signature_url: currentInitialData?.review_6_month_signature_url,
        review_6_month_signed_by: currentInitialData?.review_6_month_signed_by,
        review_6_month_signature_url_2: currentInitialData?.review_6_month_signature_url_2,
        review_6_month_signed_by_2: currentInitialData?.review_6_month_signed_by_2,
        review_6_month_note: reviewNoteWithoutActionPoints // Excludes action_points
      };
      onSave(dataToSave);
    }
  };

  const handleDateClick = () => {
    if (isEditing && dateInputRef.current) {
      try {
        dateInputRef.current.showPicker();
      } catch (err) {
        // Fallback for browsers that don't support showPicker (e.g., Firefox)
        dateInputRef.current.focus();
      }
    }
  };

  const sections = {
    statutory: {
        title: 'Statutory',
        icon: <Building className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate for Companies House filings and Statutory Advertising.</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.statutory.narrative} onChange={(e) => handleSectionChange('statutory', 'narrative', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold mt-4 block">Bonding</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input className="bg-white border-slate-300" placeholder="Initial Case Bonding Value" value={reviewData.statutory.initial_bond_value} onChange={(e) => handleSectionChange('statutory', 'initial_bond_value', e.target.value)} disabled={!isEditing} />
                    <Input className="bg-white border-slate-300" placeholder="Current Bond Value" value={reviewData.statutory.current_bond_value} onChange={(e) => handleSectionChange('statutory', 'current_bond_value', e.target.value)} disabled={!isEditing} />
                </div>
                <Input className="bg-white border-slate-300 mt-4" placeholder="Action Required (state)" value={reviewData.statutory.action_required} onChange={(e) => handleSectionChange('statutory', 'action_required', e.target.value)} disabled={!isEditing} />
            </div>
        )
    },
    compliance: {
        title: 'Compliance',
        icon: <Shield className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Bribery Act</Label>
                <Textarea className="bg-white border-slate-300" placeholder="Have any factors come to light which give rise to any concern under the Bribery Act 2010?" value={reviewData.compliance.bribery} onChange={(e) => handleSectionChange('compliance', 'bribery', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold">Ethical Review</Label>
                <Textarea className="bg-white border-slate-300" placeholder="Have any matters come to light that raise a potential threat to the five fundamental principles of the Code of Ethics?" value={reviewData.compliance.ethical} onChange={(e) => handleSectionChange('compliance', 'ethical', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold">Money Laundering</Label>
                <Textarea className="bg-white border-slate-300" placeholder="Have any factors come to light which would cause concern under the current Money Laundering Regs?" value={reviewData.compliance.money_laundering} onChange={(e) => handleSectionChange('compliance', 'money_laundering', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold">NOCLAR</Label>
                <Textarea className="bg-white border-slate-300" placeholder="Have any instances of NOCLAR been identified? Detail how they were dealt with." value={reviewData.compliance.noclmar} onChange={(e) => handleSectionChange('compliance', 'noclmar', e.target.value)} disabled={!isEditing} />
            </div>
        )
    },
    progression: {
        title: 'Progression',
        icon: <TrendingUp className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate for Insurance File Note, Assets Files Notes, Remaining Assets, ERA File Note, Pension Schemes and Progress Reports.</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.progression.narrative} onChange={(e) => handleSectionChange('progression', 'narrative', e.target.value)} disabled={!isEditing} />
            </div>
        )
    },
    investigations: {
        title: 'Investigations',
        icon: <Search className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate for SIP2 File Note and further recovery work.</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.investigations.narrative} onChange={(e) => handleSectionChange('investigations', 'narrative', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold mt-4 block">CDDA Return Due Date and submissions date</Label>
                <Input className="bg-white border-slate-300" placeholder="State Deadline date and date of submission" value={reviewData.investigations.cdda_return_date} onChange={(e) => handleSectionChange('investigations', 'cdda_return_date', e.target.value)} disabled={!isEditing} />
            </div>
        )
    },
    tax: {
        title: 'Tax',
        icon: <FileText className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate for VAT File Note, VAT Reclaim, Bank reconciliations and CT returns.</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.tax.narrative} onChange={(e) => handleSectionChange('tax', 'narrative', e.target.value)} disabled={!isEditing} />
            </div>
        )
    },
    distributions: {
        title: 'Distributions',
        icon: <Users className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.distributions.narrative} onChange={(e) => handleSectionChange('distributions', 'narrative', e.target.value)} disabled={!isEditing} />
                <div className="grid grid-cols-1 md::grid-cols-3 gap-4 mt-4">
                    <Input className="bg-white border-slate-300" placeholder="Secured: Date and sum" value={reviewData.distributions.secured_sum} onChange={(e) => handleSectionChange('distributions', 'secured_sum', e.target.value)} disabled={!isEditing} />
                    <Input className="bg-white border-slate-300" placeholder="Preferential: Date and sum" value={reviewData.distributions.preferential_sum} onChange={(e) => handleSectionChange('distributions', 'preferential_sum', e.target.value)} disabled={!isEditing} />
                    <Input className="bg-white border-slate-300" placeholder="Unsecured: Date and sum" value={reviewData.distributions.unsecured_sum} onChange={(e) => handleSectionChange('distributions', 'unsecured_sum', e.target.value)} disabled={!isEditing} />
                </div>
            </div>
        )
    },
    fees_and_expenses: {
        title: 'Fees & Expenses',
        icon: <PoundSterling className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Provide narrative as appropriate</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.fees_and_expenses.narrative} onChange={(e) => handleSectionChange('fees_and_expenses', 'narrative', e.target.value)} disabled={!isEditing} />
                <div className="grid grid-cols-1 md::grid-cols-3 gap-4 mt-4">
                    <Input className="bg-white border-slate-300" placeholder="Basis agreed (incl. cap)" value={reviewData.fees_and_expenses.basis_agreed} onChange={(e) => handleSectionChange('fees_and_expenses', 'basis_agreed', e.target.value)} disabled={!isEditing} />
                    <Input type="number" className="bg-white border-slate-300" placeholder="Level of (net) fees billed (£)" value={reviewData.fees_and_expenses.fees_billed} onChange={(e) => handleSectionChange('fees_and_expenses', 'fees_billed', e.target.value)} disabled={!isEditing} />
                    <Input className="bg-white border-slate-300" placeholder="Revision adequate level" value={reviewData.fees_and_expenses.revision_level} onChange={(e) => handleSectionChange('fees_and_expenses', 'revision_level', e.target.value)} disabled={!isEditing} />
                </div>
            </div>
        )
    },
    action_points: {
        title: 'Action Points',
        icon: <ListChecks className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Matters carried forward and/or requiring action following this case review</Label>
                <div className="space-y-2">
                    {reviewData.action_points.points.map((point, index) => (
                        <ActionPointInput
                            key={index}
                            value={point}
                            onChange={(field, value) => handleActionPointChange(index, field, value)}
                            onRemove={() => removeActionPoint(index)}
                            isEditing={isEditing}
                        />
                    ))}
                </div>
                {isEditing && <Button onClick={addActionPoint}>Add Action Point</Button>}
            </div>
        )
    },
    closure: {
        title: 'Closure',
        icon: <CheckCircle2 className="w-4 h-4" />,
        content: (
            <div className="p-4 rounded-lg bg-slate-50 border space-y-4">
                <Label className="text-blue-700 font-semibold">Is this case ready to be closed?</Label>
                <Input className="bg-white border-slate-300" value={reviewData.closure.ready_for_closure} onChange={(e) => handleSectionChange('closure', 'ready_for_closure', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold">If no, what are the key matters preventing closure?</Label>
                <Textarea className="bg-white border-slate-300" value={reviewData.closure.matters_preventing} onChange={(e) => handleSectionChange('closure', 'matters_preventing', e.target.value)} disabled={!isEditing} />
                <Label className="text-blue-700 font-semibold">When is it currently anticipated this case will be concluded?</Label>
                <Input type="date" className="bg-white border-slate-300" value={reviewData.closure.anticipated_date} onChange={(e) => handleSectionChange('closure', 'anticipated_date', e.target.value)} disabled={!isEditing} />
            </div>
        )
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-slate-600">Loading review data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h2 className="text-2xl font-bold text-slate-900">6 Month Review</h2>
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
        
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <button
            onClick={handleExportToHTML}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium hover:bg-green-200 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            isEditing 
              ? 'bg-green-100 text-green-700' 
              : 'bg-red-100 text-red-700'
          }`}>
            {isEditing ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            <span>{isEditing ? 'Unlocked' : 'Locked'}</span>
          </div>
        </div>
      </div>

      {/* Horizontal Navigation Menu */}
      <div className="flex flex-wrap gap-2 p-4 bg-slate-100 rounded-lg border">
        {Object.entries(sections).map(([key, section]) => (
          <button
            key={key}
            onClick={() => toggleSection(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-200 ${
              openSections[key] 
                ? 'bg-blue-600 text-white shadow-sm' 
                : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-700 border border-slate-200'
            }`}
          >
            <div className={`${openSections[key] ? 'text-white' : 'text-slate-600'}`}>
              {section.icon}
            </div>
            <span>{section.title}</span>
            {openSections[key] && (
              <ChevronDown className="w-4 h-4 text-white" />
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[400px]">
        {Object.entries(sections).map(([key, section]) => (
          openSections[key] && (
            <Card key={key} className="border border-slate-200 shadow-sm">
              <CardHeader className="bg-blue-50 border-b border-blue-200">
                <CardTitle className="flex items-center gap-3 text-blue-800">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    {section.icon}
                  </div>
                  <span className="font-semibold text-lg">{section.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 pb-6 bg-white">
                {section.content}
              </CardContent>
            </Card>
          )
        ))}
        
        {!Object.values(openSections).some(isOpen => isOpen) && (
          <div className="flex items-center justify-center h-64 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <div className="text-center">
              <ClipboardList className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">Select a Review Section</h3>
              <p className="text-slate-500">Choose a section above to begin the review process</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}