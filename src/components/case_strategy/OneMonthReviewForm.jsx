import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FileText,
  Shield,
  ClipboardList,
  Search,
  Building,
  Users,
  DollarSign,
  XCircle,
  CheckSquare,
  Upload,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function OneMonthReviewForm({
  initialData,
  onSave,
  isEditing = false,
  onToggleEdit,
  onCaseUpdate
}) {
  const [sectionData, setSectionData] = useState({});
  const [activeSection, setActiveSection] = useState('statutory');
  const [reviewDate, setReviewDate] = useState('');
  const [caseId, setCaseId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const saveTimeoutRef = useRef(null);
  const isLoadingFromPropsRef = useRef(false);

  // Initialize state immediately from initialData to prevent jitter
  useEffect(() => {
    if (initialData?.id) {
      setCaseId(initialData.id);
      setReviewDate(initialData.review_1_month_date || '');
      
      if (initialData.review_1_month_note) {
        try {
          const parsedData = JSON.parse(initialData.review_1_month_note);
          setSectionData(parsedData);
        } catch (error) {
          console.error('❌ Error parsing initial review_1_month_note:', error);
        }
      }
    }
  }, [initialData?.id]);

  // Load fresh data from database in background
  useEffect(() => {
    const loadFreshData = async () => {
      if (initialData?.id) {
        setIsLoadingData(true);
        try {
          const freshCase = await base44.entities.Case.filter({ id: initialData.id });
          const caseData = freshCase[0];
          
          if (caseData) {
            setReviewDate(caseData.review_1_month_date || '');

            if (caseData.review_1_month_note) {
              try {
                const parsedData = JSON.parse(caseData.review_1_month_note);
                setSectionData(parsedData);
              } catch (error) {
                console.error('❌ Error parsing fresh review_1_month_note:', error);
              }
            }
          }
        } catch (error) {
          console.error('❌ Error loading fresh data:', error);
        } finally {
          setIsLoadingData(false);
        }
      }
    };

    loadFreshData();
  }, [initialData?.id]);

  // Immediate save function (used when clicking lock)
  const saveImmediately = useCallback(async () => {
    if (!caseId) {
      console.warn('⚠️ Cannot save: No caseId available');
      setSaveError('No case ID found');
      return false;
    }

    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const dataToSave = {
        review_1_month_note: JSON.stringify(sectionData),
        review_1_month_date: reviewDate
      };

      console.log('💾 SAVING 1 Month Review data immediately to case:', caseId);
      console.log('📝 Data being saved:', dataToSave);

      if (onSave) {
        await onSave(dataToSave);
      } else {
        await base44.entities.Case.update(caseId, dataToSave);
      }

      console.log('✅ 1 Month Review data SAVED SUCCESSFULLY');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (error) {
      console.error('❌ ERROR saving 1 Month Review data:', error);
      setSaveError(error.message || 'Save failed');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [caseId, sectionData, reviewDate, onSave]);

  // Auto-save whenever sectionData or reviewDate changes
  useEffect(() => {
    if (!caseId) return;
    
    // Skip auto-save if data is being loaded from props
    if (isLoadingFromPropsRef.current) {
      return;
    }

    const saveTimeout = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        console.log('💾 Auto-saving 1 Month Review data...');
        const dataToSave = {
          review_1_month_note: JSON.stringify(sectionData),
          review_1_month_date: reviewDate
        };
        
        if (onSave) {
          await onSave(dataToSave);
        } else {
          await base44.entities.Case.update(caseId, dataToSave);
        }
        
        console.log('✅ Auto-save successful');
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 1500);
      } catch (error) {
        console.error('❌ Auto-save error:', error);
        setSaveError(error.message || 'Save failed');
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => clearTimeout(saveTimeout);
  }, [caseId, sectionData, reviewDate, onSave]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle lock button click
  const handleLockToggle = async () => {
    console.log('🔒 Lock button clicked, isEditing:', isEditing);

    if (isEditing) {
      // Save before locking
      console.log('💾 Saving data before locking...');
      const success = await saveImmediately();

      if (success) {
        console.log('✅ Data saved, now locking form');
        if (onToggleEdit) {
          onToggleEdit();
        }
      } else {
        console.error('❌ Save failed, not locking form');
        // Still allow locking even if save fails, but show error
        if (onToggleEdit) {
          onToggleEdit();
        }
      }
    } else {
      // Just unlock
      console.log('🔓 Unlocking form');
      if (onToggleEdit) {
        onToggleEdit();
      }
    }
  };

  const handleSectionChange = (section, field, value) => {
    if (!isEditing) return;

    const updatedSectionData = {
      ...sectionData,
      [section]: {
        ...(sectionData[section] || {}),
        [field]: value
      }
    };
    setSectionData(updatedSectionData);
  };

  const handleDateChange = (e) => {
    if (!isEditing) return;
    setReviewDate(e.target.value);
  };

  const handleFileUpload = (section, field) => async (event) => {
    if (!isEditing) return;

    const file = event.target.files[0];
    if (file) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        handleSectionChange(section, field, file_url);
      } catch (error) {
        console.error('Error uploading file:', error);
        setSaveError('File upload failed');
      }
    }
  };

  const handleDrop = (section, field) => async (event) => {
    if (!isEditing) return;
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        handleSectionChange(section, field, file_url);
      } catch (error) {
        console.error('Error uploading file:', error);
        setSaveError('File upload failed');
      }
    }
  };

  const handlePaste = (section, field) => async (event) => {
    if (!isEditing) return;
    
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            handleSectionChange(section, field, file_url);
          } catch (error) {
            console.error('Error uploading file:', error);
            setSaveError('File upload failed');
          }
        }
        break;
      }
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleExportToHTML = () => {
    // Function to format section data for export
    const formatSectionForExport = (sectionKey, sectionTitle) => {
      const data = sectionData[sectionKey] || {};
      
      let contentHtml = '';
      
      // Format based on section type
      if (sectionKey === 'statutory') {
        contentHtml += '<p class="subsection-title">Companies House Screenshot: ' + (data.companies_house_screenshot ? `<a href="${data.companies_house_screenshot}" target="_blank">View File</a>` : 'N/A') + '</p>';
        
        contentHtml += '<h3>Companies House Filings</h3>';
        contentHtml += '<table class="data-table">';
        contentHtml += '<tr><th>Filing</th><th>Status</th><th>Date</th></tr>';
        ['winding_up_resolution', 'notice_of_appointment_form_600', 'statutory_statement_of_affairs', 'form_ad01_change_of_registered_office_address'].forEach(key => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const status = data[`${key}_status`] || 'N/A';
          const date = data[`${key}_date`] || 'N/A';
          contentHtml += `<tr><td>${label}</td><td>${status}</td><td>${date}</td></tr>`;
        });
        contentHtml += '</table>';
        
        contentHtml += '<p class="subsection-title">London Gazette Screenshot: ' + (data.london_gazette_screenshot ? `<a href="${data.london_gazette_screenshot}" target="_blank">View File</a>` : 'N/A') + '</p>';
        
        contentHtml += '<h3>Statutory Advertising</h3>';
        contentHtml += '<table class="data-table">';
        contentHtml += '<tr><th>Advertising</th><th>Status</th><th>Date</th></tr>';
        ['london_gazette', 'other_advertising_if_applicable'].forEach(key => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          const status = data[`${key}_status`] || 'N/A';
          const date = data[`${key}_date`] || 'N/A';
          contentHtml += `<tr><td>${label}</td><td>${status}</td><td>${date}</td></tr>`;
        });
        contentHtml += '</table>';
      } else if (sectionKey === 'compliance') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          ['bribery', 'ml', 'ethical', 'noncompliance'].forEach(prefix => {
            const title = prefix === 'ml' ? 'Money Laundering' : 
                         prefix === 'bribery' ? 'Bribery Act' :
                         prefix === 'ethical' ? 'Ethical Review' : 'Non-Compliance';
            const relevantData = Object.entries(data).filter(([key]) => key.startsWith(prefix));
            if (relevantData.length > 0) {
              contentHtml += `<h3>${title}</h3>`;
              contentHtml += '<table class="data-table">';
              relevantData.forEach(([key, value]) => {
                const label = key.replace(prefix + '_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                contentHtml += `<tr><td>${label}</td><td>${value || 'N/A'}</td></tr>`;
              });
              contentHtml += '</table>';
            }
          });
        }
      } else if (sectionKey === 'reporting') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<h3>Initial Report to Creditors</h3>';
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Report Sent</td><td>${data.report_sent || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Date Sent</td><td>${data.report_date || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'assets') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Insurance file note complete</td><td>${data.insurance_complete || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Asset file notes complete</td><td>${data.asset_notes_complete || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Remaining assets to be realised</td><td>${data.remaining_assets || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Additional assets come to light</td><td>${data.additional_assets || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'employee') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<h3>RPS</h3>';
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>RP14 Submitted</td><td>${data.rp14_submitted || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Employee File Note Started</td><td>${data.employee_note_started || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Date Submitted</td><td>${data.rp14_date || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>RP14a Submitted</td><td>${data.rp14a_submitted || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>ERA Agent Instruction</td><td>${data.era_instruction || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          contentHtml += '<h3>Pension</h3>';
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Company Pension Scheme exists</td><td>${data.pension_exists || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'investigations') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>SIP2 File Note Started</td><td>${data.sip2_started || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Books & records delivered</td><td>${data.books_delivered || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Director Questionnaires</td><td>${data.director_questionnaires || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Antecedent transactions</td><td>${data.antecedent_transactions || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Creditor Questionnaires</td><td>${data.creditor_questionnaires || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Bank statements obtained</td><td>${data.bank_statements || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'tax') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>VAT file note complete</td><td>${data.vat_note_complete || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>VAT returns updated</td><td>${data.vat_returns_updated || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>VAT Deregistered</td><td>${data.vat_deregistered || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>VAT reclaim due</td><td>${data.vat_reclaim_due || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>CT returns outstanding</td><td>${data.ct_returns_outstanding || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'fees') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Basis of Remuneration</td><td>${data.remuneration_basis || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Revision Required</td><td>${data.revision_required || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Basis Agreed</td><td>${data.basis_agreed || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Voted Against</td><td>${data.voted_against || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Fees Cap (£)</td><td>${data.fees_cap || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Current WIP (£)</td><td>${data.current_wip || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
          if (data.notes) {
            contentHtml += '<h3>Notes</h3>';
            contentHtml += `<p class="notes-text">${data.notes}</p>`;
          }
        }
      } else if (sectionKey === 'action_points') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Action Point</td><td>${data.point_1 || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Narrative</td><td>${data.narrative_1 || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Time Estimate</td><td>${data.time_estimate_1 || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Date Inputted</td><td>${data.date_inputted_1 || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
        }
      } else if (sectionKey === 'closure') {
        const hasData = Object.keys(data).length > 0;
        if (!hasData) {
          contentHtml += '<p class="no-data">No data available</p>';
        } else {
          contentHtml += '<table class="data-table">';
          contentHtml += `<tr><td>Ready to close?</td><td>${data.ready_to_close || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Preventing matters</td><td>${data.preventing_matters || 'N/A'}</td></tr>`;
          contentHtml += `<tr><td>Anticipated date</td><td>${data.anticipated_date || 'N/A'}</td></tr>`;
          contentHtml += '</table>';
        }
      }
      
      return `<div class="section"><h2>${sectionTitle}</h2>${contentHtml}</div>`;
    };

    // Generate content for all sections
    const allSectionsHtml = [
      formatSectionForExport('statutory', 'Statutory'),
      formatSectionForExport('compliance', 'Compliance'),
      formatSectionForExport('reporting', 'Reporting'),
      formatSectionForExport('assets', 'Assets'),
      formatSectionForExport('employee', 'Employee'),
      formatSectionForExport('investigations', 'Investigations'),
      formatSectionForExport('tax', 'Tax'),
      formatSectionForExport('fees', 'Fees & Expenses'),
      formatSectionForExport('action_points', 'Action Points'),
      formatSectionForExport('closure', 'Closure')
    ].join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>1 Month Review</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #333;
      background: #fff;
    }
    h1 {
      color: #1e40af;
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #cbd5e0;
      font-size: 24px;
      font-weight: 600;
      page-break-after: avoid;
    }
    h2 {
      color: #1e40af;
      margin: 20px 0 10px 0;
      padding-bottom: 5px;
      border-bottom: 1px solid #cbd5e0;
      font-size: 16px;
      font-weight: 600;
      page-break-after: avoid;
    }
    h3 {
      color: #4a5568;
      margin: 12px 0 8px 0;
      font-size: 13px;
      font-weight: 600;
      page-break-after: avoid;
    }
    .review-date {
      text-align: center;
      margin-bottom: 20px;
      font-size: 12px;
      color: #4a5568;
      font-weight: 600;
    }
    .section {
      margin-bottom: 15px;
      padding: 10px 0;
      /* Removed blue border-left and its associated padding/background */
    }
    .subsection-title {
      font-weight: 600;
      margin: 8px 0;
      color: #4a5568;
      font-size: 11px;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 11px;
      page-break-inside: auto; /* Allow tables to break across pages */
    }
    .data-table th {
      background: #f1f5f9;
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      border: 1px solid #cbd5e0;
      color: #4a5568;
      font-size: 11px;
    }
    .data-table td {
      padding: 6px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      background: #ffffff;
    }
    .data-table tr {
      page-break-inside: avoid; /* Keep table rows together if possible */
    }
    .data-table tr:nth-child(even) td {
      background: #f9fafb;
    }
    .no-data {
      color: #64748b;
      font-style: italic;
      margin: 8px 0;
      font-size: 11px;
    }
    .notes-text {
      margin: 8px 0;
      line-height: 1.6;
      font-size: 11px;
      white-space: pre-wrap; /* Preserve newlines from textarea */
    }
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    @media print {
      body {
        font-size: 10px;
      }
      h1 { 
        font-size: 20px;
      }
      h2 { 
        font-size: 14px;
      }
      h3 { 
        font-size: 12px;
      }
      .section {
        margin-bottom: 12px;
        padding: 0; /* Adjusted padding as border is removed */
      }
      .data-table {
        page-break-inside: auto; /* Allow tables to break across pages for print too */
      }
      .data-table th,
      .data-table td {
        padding: 5px 8px;
        font-size: 10px;
      }
    }
  </style>
</head>
<body>
  <h1>1 Month Review Summary</h1>
  <p class="review-date"><strong>Review Date:</strong> ${reviewDate || 'Not set'}</p>
  ${allSectionsHtml}
</body>
</html>`;
    
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    } else {
      alert("Please allow pop-ups for this website to export the review.");
    }
  };

  const sections = {
    statutory: {
      label: 'Statutory',
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 text-lg">Companies House Filings</h3>

            <div>
              <Label className="text-sm text-slate-600 mb-2 block">Upload Companies House Screenshot</Label>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 transition-colors"
                onDrop={handleDrop('statutory', 'companies_house_screenshot')}
                onDragOver={handleDragOver}
                onPaste={handlePaste('statutory', 'companies_house_screenshot')}
                tabIndex={0}
              >
                {sectionData.statutory?.companies_house_screenshot ? (
                  <div className="space-y-3">
                    <img 
                      src={sectionData.statutory.companies_house_screenshot} 
                      alt="Companies House Screenshot" 
                      className="max-w-full h-auto rounded-lg border border-slate-200"
                    />
                    {isEditing && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSectionChange('statutory', 'companies_house_screenshot', '')}
                      >
                        Remove Screenshot
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-blue-500">Or paste a screenshot here (Ctrl+V / Cmd+V)</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('statutory', 'companies_house_screenshot')}
                      disabled={!isEditing}
                      className="hidden"
                      id="companies-house-upload"
                    />
                    <label htmlFor="companies-house-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" className="mt-3" disabled={!isEditing}>
                        Choose File
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[2fr,1.5fr,1.5fr] gap-4 bg-slate-50 p-3 border-b">
                <div className="font-medium text-sm text-slate-700 uppercase tracking-wide">FILING</div>
                <div className="font-medium text-sm text-slate-700 text-center uppercase tracking-wide">COMPLETED</div>
                <div className="font-medium text-sm text-slate-700 text-center uppercase tracking-wide">DATE</div>
              </div>

              {[
                { label: 'Winding up resolution', key: 'winding_up_resolution' },
                { label: 'Notice of Appointment Form 600', key: 'notice_of_appointment_form_600' },
                { label: 'Statutory Statement of Affairs', key: 'statutory_statement_of_affairs' },
                { label: 'Form AD01 change of registered office address', key: 'form_ad01_change_of_registered_office_address' }
              ].map((filing, index) => (
                <div key={filing.key} className={`grid grid-cols-[2fr,1.5fr,1.5fr] gap-4 p-3 items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <div className="text-sm text-slate-700">{filing.label}</div>
                  <div className="flex justify-center">
                    <RadioGroup
                      value={sectionData.statutory?.[`${filing.key}_status`] || ''}
                      onValueChange={(value) => handleSectionChange('statutory', `${filing.key}_status`, value)}
                      disabled={!isEditing}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${filing.key}-yes`} />
                        <Label htmlFor={`${filing.key}-yes`} className="text-sm">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${filing.key}-no`} />
                        <Label htmlFor={`${filing.key}-no`} className="text-sm">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id={`${filing.key}-na`} />
                        <Label htmlFor={`${filing.key}-na`} className="text-sm">N/A</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={sectionData.statutory?.[`${filing.key}_date`] || ''}
                      onChange={(e) => handleSectionChange('statutory', `${filing.key}_date`, e.target.value)}
                      disabled={!isEditing}
                      placeholder="dd / mm / yyyy"
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t">
            <h3 className="font-semibold text-slate-900 text-lg">Statutory Advertising</h3>

            <div>
              <Label className="text-sm text-slate-600 mb-2 block">Upload London Gazette Screenshot</Label>
              <div 
                className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center bg-white hover:border-blue-400 transition-colors"
                onDrop={handleDrop('statutory', 'london_gazette_screenshot')}
                onDragOver={handleDragOver}
                onPaste={handlePaste('statutory', 'london_gazette_screenshot')}
                tabIndex={0}
              >
                {sectionData.statutory?.london_gazette_screenshot ? (
                  <div className="space-y-3">
                    <img 
                      src={sectionData.statutory.london_gazette_screenshot} 
                      alt="London Gazette Screenshot" 
                      className="max-w-full h-auto rounded-lg border border-slate-200"
                    />
                    {isEditing && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleSectionChange('statutory', 'london_gazette_screenshot', '')}
                      >
                        Remove Screenshot
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600 mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-blue-500">Or paste a screenshot here (Ctrl+V / Cmd+V)</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload('statutory', 'london_gazette_screenshot')}
                      disabled={!isEditing}
                      className="hidden"
                      id="london-gazette-upload"
                    />
                    <label htmlFor="london-gazette-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" className="mt-3" disabled={!isEditing}>
                        Choose File
                      </Button>
                    </label>
                  </>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[2fr,1.5fr,1.5fr] gap-4 bg-slate-50 p-3 border-b">
                <div className="font-medium text-sm text-slate-700 uppercase tracking-wide">ADVERTISING</div>
                <div className="font-medium text-sm text-slate-700 text-center uppercase tracking-wide">COMPLETED</div>
                <div className="font-medium text-sm text-slate-700 text-center uppercase tracking-wide">DATE</div>
              </div>

              {[
                { label: 'London Gazette', key: 'london_gazette' },
                { label: 'Other Advertising (if applicable)', key: 'other_advertising_if_applicable' }
              ].map((advertising, index) => (
                <div key={advertising.key} className={`grid grid-cols-[2fr,1.5fr,1.5fr] gap-4 p-3 items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <div className="text-sm text-slate-700">{advertising.label}</div>
                  <div className="flex justify-center">
                    <RadioGroup
                      value={sectionData.statutory?.[`${advertising.key}_status`] || ''}
                      onValueChange={(value) => handleSectionChange('statutory', `${advertising.key}_status`, value)}
                      disabled={!isEditing}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id={`${advertising.key}-yes`} />
                        <Label htmlFor={`${advertising.key}-yes`} className="text-sm">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id={`${advertising.key}-no`} />
                        <Label htmlFor={`${advertising.key}-no`} className="text-sm">No</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="na" id={`${advertising.key}-na`} />
                        <Label htmlFor={`${advertising.key}-na`} className="text-sm">N/A</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Input
                      type="date"
                      value={sectionData.statutory?.[`${advertising.key}_date`] || ''}
                      onChange={(e) => handleSectionChange('statutory', `${advertising.key}_date`, e.target.value)}
                      disabled={!isEditing}
                      placeholder="dd / mm / yyyy"
                      className="w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },

    compliance: {
      label: 'Compliance',
      icon: Shield,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bribery Act</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Concerns identified under Bribery Act 2010</Label>
                <RadioGroup
                  value={sectionData.compliance?.bribery_concerns || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'bribery_concerns', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="bribery-concerns-yes" />
                    <Label htmlFor="bribery-concerns-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="bribery-concerns-no" />
                    <Label htmlFor="bribery-concerns-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="bribery-concerns-na" />
                    <Label htmlFor="bribery-concerns-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">MLRO consulted if required</Label>
                <RadioGroup
                  value={sectionData.compliance?.bribery_mlro_consulted || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'bribery_mlro_consulted', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="bribery-mlro-yes" />
                    <Label htmlFor="bribery-mlro-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="bribery-mlro-no" />
                    <Label htmlFor="bribery-mlro-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="bribery-mlro-na" />
                    <Label htmlFor="bribery-mlro-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <Textarea
                placeholder="Details..."
                value={sectionData.compliance?.bribery_details || ''}
                onChange={(e) => handleSectionChange('compliance', 'bribery_details', e.target.value)}
                disabled={!isEditing}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Money Laundering</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Concerns under Money Laundering Regulations</Label>
                <RadioGroup
                  value={sectionData.compliance?.ml_concerns || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'ml_concerns', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="ml-concerns-yes" />
                    <Label htmlFor="ml-concerns-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ml-concerns-no" />
                    <Label htmlFor="ml-concerns-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="ml-concerns-na" />
                    <Label htmlFor="ml-concerns-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">MLRO consulted if required</Label>
                <RadioGroup
                  value={sectionData.compliance?.ml_mlro_consulted || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'ml_mlro_consulted', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="ml-mlro-yes" />
                    <Label htmlFor="ml-mlro-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ml-mlro-no" />
                    <Label htmlFor="ml-mlro-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="ml-mlro-na" />
                    <Label htmlFor="ml-mlro-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <Textarea
                placeholder="Details..."
                value={sectionData.compliance?.ml_details || ''}
                onChange={(e) => handleSectionChange('compliance', 'ml_details', e.target.value)}
                disabled={!isEditing}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ethical Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Potential threats to fundamental principles identified</Label>
                <RadioGroup
                  value={sectionData.compliance?.ethical_threats || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'ethical_threats', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="ethical-threats-yes" />
                    <Label htmlFor="ethical-threats-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ethical-threats-no" />
                    <Label htmlFor="ethical-threats-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="ethical-threats-na" />
                    <Label htmlFor="ethical-threats-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Safeguards continue to be appropriate</Label>
                <RadioGroup
                  value={sectionData.compliance?.ethical_safeguards || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'ethical_safeguards', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="ethical-safeguards-yes" />
                    <Label htmlFor="ethical-safeguards-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="ethical-safeguards-no" />
                    <Label htmlFor="ethical-safeguards-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="ethical-safeguards-na" />
                    <Label htmlFor="ethical-safeguards-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <Textarea
                placeholder="Details..."
                value={sectionData.compliance?.ethical_details || ''}
                onChange={(e) => handleSectionChange('compliance', 'ethical_details', e.target.value)}
                disabled={!isEditing}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Non-Compliance with Laws and Regulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Instances of non-compliance identified</Label>
                <RadioGroup
                  value={sectionData.compliance?.noncompliance_identified || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'noncompliance_identified', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="noncompliance-yes" />
                    <Label htmlFor="noncompliance-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="noncompliance-no" />
                    <Label htmlFor="noncompliance-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="noncompliance-na" />
                    <Label htmlFor="noncompliance-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Dealt with appropriately</Label>
                <RadioGroup
                  value={sectionData.compliance?.noncompliance_dealt_with || ''}
                  onValueChange={(value) => handleSectionChange('compliance', 'noncompliance_dealt_with', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="noncompliance-dealt-yes" />
                    <Label htmlFor="noncompliance-dealt-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="noncompliance-dealt-no" />
                    <Label htmlFor="noncompliance-dealt-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="noncompliance-dealt-na" />
                    <Label htmlFor="noncompliance-dealt-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <Textarea
                placeholder="Details..."
                value={sectionData.compliance?.noncompliance_details || ''}
                onChange={(e) => handleSectionChange('compliance', 'noncompliance_details', e.target.value)}
                disabled={!isEditing}
                className="min-h-[100px]"
              />
            </CardContent>
          </Card>
        </div>
      )
    },

    reporting: {
      label: 'Reporting',
      icon: ClipboardList,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Initial Report to Creditors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Report Sent</Label>
                <RadioGroup
                  value={sectionData.reporting?.report_sent || ''}
                  onValueChange={(value) => handleSectionChange('reporting', 'report_sent', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="report-sent-yes" />
                    <Label htmlFor="report-sent-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="report-sent-no" />
                    <Label htmlFor="report-sent-no" className="text-sm">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Date Sent</Label>
                <Input
                  type="date"
                  value={sectionData.reporting?.report_date || ''}
                  onChange={(e) => handleSectionChange('reporting', 'report_date', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Reporting notes..."
                value={sectionData.reporting?.notes || ''}
                onChange={(e) => handleSectionChange('reporting', 'notes', e.target.value)}
                disabled={!isEditing}
                className="min-h-[150px]"
              />
            </CardContent>
          </Card>
        </div>
      )
    },

    assets: {
      label: 'Assets',
      icon: Building,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2 block">Insurance file note complete</Label>
              <RadioGroup
                value={sectionData.assets?.insurance_complete || ''}
                onValueChange={(value) => handleSectionChange('assets', 'insurance_complete', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="insurance-yes" />
                  <Label htmlFor="insurance-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="insurance-no" />
                  <Label htmlFor="insurance-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="insurance-na" />
                  <Label htmlFor="insurance-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Asset file notes complete</Label>
              <RadioGroup
                value={sectionData.assets?.asset_notes_complete || ''}
                onValueChange={(value) => handleSectionChange('assets', 'asset_notes_complete', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="asset-notes-yes" />
                  <Label htmlFor="asset-notes-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="asset-notes-no" />
                  <Label htmlFor="asset-notes-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="asset-notes-na" />
                  <Label htmlFor="asset-notes-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Remaining assets to be realised</Label>
              <RadioGroup
                value={sectionData.assets?.remaining_assets || ''}
                onValueChange={(value) => handleSectionChange('assets', 'remaining_assets', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="remaining-assets-yes" />
                  <Label htmlFor="remaining-assets-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="remaining-assets-no" />
                  <Label htmlFor="remaining-assets-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="remaining-assets-na" />
                  <Label htmlFor="remaining-assets-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have any Additional Assets Come to Light</Label>
              <RadioGroup
                value={sectionData.assets?.additional_assets || ''}
                onValueChange={(value) => handleSectionChange('assets', 'additional_assets', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="additional-assets-yes" />
                  <Label htmlFor="additional-assets-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="additional-assets-no" />
                  <Label htmlFor="additional-assets-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="additional-assets-na" />
                  <Label htmlFor="additional-assets-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Notes</Label>
            <Textarea
              placeholder="Asset notes..."
              value={sectionData.assets?.notes || ''}
              onChange={(e) => handleSectionChange('assets', 'notes', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>
        </div>
      )
    },

    employee: {
      label: 'Employee',
      icon: Users,
      content: (
        <div className="space-y-6">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">RPS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm mb-2 block">RP14 Submitted</Label>
                <RadioGroup
                  value={sectionData.employee?.rp14_submitted || ''}
                  onValueChange={(value) => handleSectionChange('employee', 'rp14_submitted', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="rp14-yes" />
                    <Label htmlFor="rp14-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="rp14-no" />
                    <Label htmlFor="rp14-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="rp14-na" />
                    <Label htmlFor="rp14-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Employee File Note Started</Label>
                <RadioGroup
                  value={sectionData.employee?.employee_note_started || ''}
                  onValueChange={(value) => handleSectionChange('employee', 'employee_note_started', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="employee-note-yes" />
                    <Label htmlFor="employee-note-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="employee-note-no" />
                    <Label htmlFor="employee-note-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="employee-note-na" />
                    <Label htmlFor="employee-note-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Date Submitted</Label>
                <Input
                  type="date"
                  value={sectionData.employee?.rp14_date || ''}
                  onChange={(e) => handleSectionChange('employee', 'rp14_date', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">RP14a Submitted</Label>
                <RadioGroup
                  value={sectionData.employee?.rp14a_submitted || ''}
                  onValueChange={(value) => handleSectionChange('employee', 'rp14a_submitted', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="rp14a-yes" />
                    <Label htmlFor="rp14a-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="rp14a-no" />
                    <Label htmlFor="rp14a-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="rp14a-na" />
                    <Label htmlFor="rp14a-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm mb-2 block">ERA Agent Instruction given</Label>
                <RadioGroup
                  value={sectionData.employee?.era_instruction || ''}
                  onValueChange={(value) => handleSectionChange('employee', 'era_instruction', value)}
                  disabled={!isEditing}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id="era-yes" />
                    <Label htmlFor="era-yes" className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id="era-no" />
                    <Label htmlFor="era-no" className="text-sm">No</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="na" id="era-na" />
                    <Label htmlFor="era-na" className="text-sm">N/A</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold text-lg mb-4">Pension</h3>
            <div>
              <Label className="text-sm mb-2 block">Company Pension Scheme exists</Label>
              <RadioGroup
                value={sectionData.employee?.pension_exists || ''}
                onValueChange={(value) => handleSectionChange('employee', 'pension_exists', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="pension-yes" />
                  <Label htmlFor="pension-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="pension-no" />
                  <Label htmlFor="pension-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="pension-na" />
                  <Label htmlFor="pension-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Notes</Label>
            <Textarea
              placeholder="Employee notes..."
              value={sectionData.employee?.notes || ''}
              onChange={(e) => handleSectionChange('employee', 'notes', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>
        </div>
      )
    },

    investigations: {
      label: 'Investigations',
      icon: Search,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2 block">Has the SIP2 File Note Been Started</Label>
              <RadioGroup
                value={sectionData.investigations?.sip2_started || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'sip2_started', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="sip2-yes" />
                  <Label htmlFor="sip2-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="sip2-no" />
                  <Label htmlFor="sip2-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="sip2-na" />
                  <Label htmlFor="sip2-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have the Company's books & records been delivered up</Label>
              <RadioGroup
                value={sectionData.investigations?.books_delivered || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'books_delivered', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="books-yes" />
                  <Label htmlFor="books-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="books-no" />
                  <Label htmlFor="books-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="books-na" />
                  <Label htmlFor="books-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have the director(s) Questionnaires been returned</Label>
              <RadioGroup
                value={sectionData.investigations?.director_questionnaires || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'director_questionnaires', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="director-q-yes" />
                  <Label htmlFor="director-q-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="director-q-no" />
                  <Label htmlFor="director-q-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="director-q-na" />
                  <Label htmlFor="director-q-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have any Antecedent transactions been identified</Label>
              <RadioGroup
                value={sectionData.investigations?.antecedent_transactions || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'antecedent_transactions', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="antecedent-yes" />
                  <Label htmlFor="antecedent-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="antecedent-no" />
                  <Label htmlFor="antecedent-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="antecedent-na" />
                  <Label htmlFor="antecedent-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have any Creditor(s) Questionnaires been returned</Label>
              <RadioGroup
                value={sectionData.investigations?.creditor_questionnaires || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'creditor_questionnaires', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="creditor-q-yes" />
                  <Label htmlFor="creditor-q-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="creditor-q-no" />
                  <Label htmlFor="creditor-q-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="creditor-q-na" />
                  <Label htmlFor="creditor-q-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have the Company bank statements been obtained</Label>
              <RadioGroup
                value={sectionData.investigations?.bank_statements || ''}
                onValueChange={(value) => handleSectionChange('investigations', 'bank_statements', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="bank-statements-yes" />
                  <Label htmlFor="bank-statements-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="bank-statements-no" />
                  <Label htmlFor="bank-statements-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="bank-statements-na" />
                  <Label htmlFor="bank-statements-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Notes</Label>
            <Textarea
              placeholder="Enter any additional notes about investigations..."
              value={sectionData.investigations?.notes || ''}
              onChange={(e) => handleSectionChange('investigations', 'notes', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>
        </div>
      )
    },

    tax: {
      label: 'Tax',
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2 block">VAT file note complete</Label>
              <RadioGroup
                value={sectionData.tax?.vat_note_complete || ''}
                onValueChange={(value) => handleSectionChange('tax', 'vat_note_complete', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="vat-note-yes" />
                  <Label htmlFor="vat-note-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="vat-note-no" />
                  <Label htmlFor="vat-note-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="vat-note-na" />
                  <Label htmlFor="vat-note-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">VAT returns updated / to date</Label>
              <RadioGroup
                value={sectionData.tax?.vat_returns_updated || ''}
                onValueChange={(value) => handleSectionChange('tax', 'vat_returns_updated', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="vat-returns-yes" />
                  <Label htmlFor="vat-returns-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="vat-returns-no" />
                  <Label htmlFor="vat-returns-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="vat-returns-na" />
                  <Label htmlFor="vat-returns-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Company VAT Deregistered</Label>
              <RadioGroup
                value={sectionData.tax?.vat_deregistered || ''}
                onValueChange={(value) => handleSectionChange('tax', 'vat_deregistered', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="vat-dereg-yes" />
                  <Label htmlFor="vat-dereg-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="vat-dereg-no" />
                  <Label htmlFor="vat-dereg-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="vat-dereg-na" />
                  <Label htmlFor="vat-dereg-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Further VAT reclaim due</Label>
              <RadioGroup
                value={sectionData.tax?.vat_reclaim_due || ''}
                onValueChange={(value) => handleSectionChange('tax', 'vat_reclaim_due', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="vat-reclaim-yes" />
                  <Label htmlFor="vat-reclaim-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="vat-reclaim-no" />
                  <Label htmlFor="vat-reclaim-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="vat-reclaim-na" />
                  <Label htmlFor="vat-reclaim-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Any CT returns outstanding</Label>
              <RadioGroup
                value={sectionData.tax?.ct_returns_outstanding || ''}
                onValueChange={(value) => handleSectionChange('tax', 'ct_returns_outstanding', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="ct-outstanding-yes" />
                  <Label htmlFor="ct-outstanding-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="ct-outstanding-no" />
                  <Label htmlFor="ct-outstanding-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="ct-outstanding-na" />
                  <Label htmlFor="ct-outstanding-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Notes</Label>
            <Textarea
              placeholder="Tax notes..."
              value={sectionData.tax?.notes || ''}
              onChange={(e) => handleSectionChange('tax', 'notes', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>
        </div>
      )
    },

    fees: {
      label: 'Fees & Expenses',
      icon: DollarSign,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2 block">Basis of Remuneration</Label>
              <RadioGroup
                value={sectionData.fees?.remuneration_basis || ''}
                onValueChange={(value) => handleSectionChange('fees', 'remuneration_basis', value)}
                disabled={!isEditing}
                className="flex gap-4 flex-wrap"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="time_cost" id="time-cost" />
                  <Label htmlFor="time-cost" className="text-sm">Time Cost</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed_fee" id="fixed-fee" />
                  <Label htmlFor="fixed-fee" className="text-sm">Fixed Fee</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="text-sm">% of Realisations</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tbc" id="tbc" />
                  <Label htmlFor="tbc" className="text-sm">TBC</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Revision of Agreed Fees required</Label>
              <RadioGroup
                value={sectionData.fees?.revision_required || ''}
                onValueChange={(value) => handleSectionChange('fees', 'revision_required', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="revision-yes" />
                  <Label htmlFor="revision-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="revision-no" />
                  <Label htmlFor="revision-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="revision-na" />
                  <Label htmlFor="revision-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Remuneration Basis Agreed with Creditors</Label>
              <RadioGroup
                value={sectionData.fees?.basis_agreed || ''}
                onValueChange={(value) => handleSectionChange('fees', 'basis_agreed', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="basis-agreed-yes" />
                  <Label htmlFor="basis-agreed-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="basis-agreed-no" />
                  <Label htmlFor="basis-agreed-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="basis-agreed-na" />
                  <Label htmlFor="basis-agreed-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Have creditors voted against the fee resolution</Label>
              <RadioGroup
                value={sectionData.fees?.voted_against || ''}
                onValueChange={(value) => handleSectionChange('fees', 'voted_against', value)}
                disabled={!isEditing}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="voted-against-yes" />
                  <Label htmlFor="voted-against-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="voted-against-no" />
                  <Label htmlFor="voted-against-no" className="text-sm">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="na" id="voted-against-na" />
                  <Label htmlFor="voted-against-na" className="text-sm">N/A</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Fees Cap (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={sectionData.fees?.fees_cap || ''}
                onChange={(e) => handleSectionChange('fees', 'fees_cap', e.target.value)}
                disabled={!isEditing}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label className="text-sm mb-2 block">Current Work in Progress (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={sectionData.fees?.current_wip || ''}
                onChange={(e) => handleSectionChange('fees', 'current_wip', e.target.value)}
                disabled={!isEditing}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Notes</Label>
            <Textarea
              placeholder="Fee notes..."
              value={sectionData.fees?.notes || ''}
              onChange={(e) => handleSectionChange('fees', 'notes', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>
        </div>
      )
    },

    action_points: {
      label: 'Action Points',
      icon: CheckSquare,
      content: (
        <div className="space-y-4">
          <div className="border rounded-lg p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label className="text-sm mb-2 block font-semibold">Action Point 1</Label>
                <Input
                  placeholder="Enter action point..."
                  value={sectionData.action_points?.point_1 || ''}
                  onChange={(e) => handleSectionChange('action_points', 'point_1', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="md:col-span-3">
                <Label className="text-sm mb-2 block">Narrative</Label>
                <Textarea
                  placeholder="Enter narrative for this action point..."
                  value={sectionData.action_points?.narrative_1 || ''}
                  onChange={(e) => handleSectionChange('action_points', 'narrative_1', e.target.value)}
                  disabled={!isEditing}
                  className="min-h-[80px]"
                />
              </div>

              <div>
                <Label className="text-sm mb-2 block">Time to complete Estimate (Weeks/Months/Years)</Label>
                <Input
                  placeholder="e.g. 2 Weeks, 3 Months"
                  value={sectionData.action_points?.time_estimate_1 || ''}
                  onChange={(e) => handleSectionChange('action_points', 'time_estimate_1', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-sm mb-2 block">Date Action Point Inputted</Label>
                <Input
                  type="date"
                  value={sectionData.action_points?.date_inputted_1 || ''}
                  onChange={(e) => handleSectionChange('action_points', 'date_inputted_1', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </div>
        </div>
      )
    },

    closure: {
      label: 'Closure',
      icon: XCircle,
      content: (
        <div className="space-y-6">
          <div>
            <Label className="text-sm mb-2 block">Is this case ready to be closed?</Label>
            <RadioGroup
              value={sectionData.closure?.ready_to_close || ''}
              onValueChange={(value) => handleSectionChange('closure', 'ready_to_close', value)}
              disabled={!isEditing}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="ready-yes" />
                <Label htmlFor="ready-yes" className="text-sm">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="ready-no" />
                <Label htmlFor="ready-no" className="text-sm">No</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="na" id="ready-na" />
                <Label htmlFor="ready-na" className="text-sm">N/A</Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-sm mb-2 block">Key matters preventing closure</Label>
            <Textarea
              placeholder="If no, what are the key matters preventing closure?"
              value={sectionData.closure?.preventing_matters || ''}
              onChange={(e) => handleSectionChange('closure', 'preventing_matters', e.target.value)}
              disabled={!isEditing}
              className="min-h-[120px]"
            />
          </div>

          <div>
            <Label className="text-sm mb-2 block">Anticipated conclusion date</Label>
            <Input
              type="date"
              value={sectionData.closure?.anticipated_date || ''}
              onChange={(e) => handleSectionChange('closure', 'anticipated_date', e.target.value)}
              disabled={!isEditing}
            />
          </div>
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
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-white rounded-lg p-4 border border-slate-200">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-900">1 Month Review</h2>
          <Input
            type="date"
            value={reviewDate}
            onChange={handleDateChange}
            disabled={!isEditing}
            className="w-48"
            placeholder="dd / mm / yyyy"
          />

          {/* Save Status Indicators */}
          {isSaving && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              Saved!
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              {saveError}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Export Button */}
          <Button
            onClick={handleExportToHTML}
            variant="outline"
            className="bg-green-50 text-green-700 border-green-300 hover:bg-green-100"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>

          {/* Lock/Unlock Button */}
          <div
            onClick={handleLockToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer shadow-sm ${
              isEditing
                ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                : 'bg-red-100 text-red-700 hover:bg-red-200 border-2 border-red-300'
            }`}
          >
            {isEditing ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            )}
            <span className="font-semibold">{isEditing ? 'Unlocked' : 'Locked'}</span>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {Object.entries(sections).map(([key, section]) => (
          <Button
            key={key}
            variant={activeSection === key ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveSection(key)}
            className="whitespace-nowrap"
          >
            <section.icon className="w-4 h-4 mr-2" />
            {section.label}
          </Button>
        ))}
      </div>

      {/* Content Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {React.createElement(sections[activeSection].icon, { className: "w-5 h-5" })}
            {sections[activeSection].label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sections[activeSection].content}
        </CardContent>
      </Card>
    </div>
  );
}