
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FileText, Search, Plus, Trash2, BookOpen, BarChart2, Flag, University, CheckCircle, ListChecks } from "lucide-react";
import { Case } from "@/api/entities";

const FormSection = ({ title, icon, children }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-3 text-lg font-semibold text-blue-800">
        {icon}
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4 pt-4">
      {children}
    </CardContent>
  </Card>
);

const MenuButton = ({ label, isActive, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
      isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-slate-200/60'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const SEEKING_INFO_SOURCES = [
  'Deficiency Account',
  'Creditor Correspondence',
  'Books and Records',
  'Bank Statements',
  'Director Questionnaire',
  'PN1 Search Results',
  'BBL/CBIL',
  'JRS Grant'
];

const SIP2FileNote = ({ caseId, caseData }) => {
  const [activeSection, setActiveSection] = useState('key_checks');
  const [sip2Data, setSip2Data] = useState({
    background: '',
    initial_assessment: '',
    potential_claim: '',
    directors_questionnaire_returned: null,
    books_records_delivered: null,
    bank_statements_reviewed: null,
    pn1_status: null,
    potential_claim_check: null,
    bounce_back_loan_check: null,
    case_sifted_in: null,
    cdda_date_submitted: '',
    examiner_name: '',
    examiner_contact_number: '',
    examiner_email: '',
    examiner_address: '',
    correspondence: '',
    seeking_information: [],
    analysis_claims: [
      { potential_claim: '', potential_claim_identified: '', comments: '' }
    ],
    outcome: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedCaseData, setLoadedCaseData] = useState(null); // Added state for loaded case data
  const [hasChanges, setHasChanges] = useState(false); // Added state for changes, no logic implemented as per outline

  const formatForInput = (dateString) => {
      if (!dateString) return '';
      try {
          const date = new Date(dateString);
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
      } catch (e) {
          return '';
      }
  };

  const loadSIP2Data = useCallback(async () => {
    setIsLoading(true);
    if (!caseId) { // Added check for caseId from outline
        setIsLoading(false);
        return;
    }
    try {
      // Changed to use Case.get(caseId) as per outline
      const fetchedCase = await Case.get(caseId);
      setLoadedCaseData(fetchedCase); // Store the fetched case data

      if (fetchedCase?.sip2_file_note_data) {
        let existingData = JSON.parse(fetchedCase.sip2_file_note_data);

        // Ensure seeking_information array exists and items have a sub_heading property
        // And ensure it's always an array. Explicitly omit 'document_ref' during load.
        existingData.seeking_information = (existingData.seeking_information || []).map(item => ({
            source: item.source || '',
            sub_heading: item.sub_heading || '',
            narrative: item.narrative || ''
            // document_ref is intentionally omitted
        }));

        // NEW MIGRATION FOR OUTCOME
        let outcomes = [];
        if (existingData.outcome) {
            if (typeof existingData.outcome === 'string' && existingData.outcome.trim() !== '') {
                // Handle old string format
                outcomes = [{ text: existingData.outcome, date: new Date().toISOString() }];
            } else if (Array.isArray(existingData.outcome) && existingData.outcome.length > 0) {
                // Handle new array format
                outcomes = existingData.outcome;
            }
        }
        // Ensure there is at least one outcome box for the UI
        if (outcomes.length === 0) {
            outcomes.push({ text: '', date: new Date().toISOString() });
        }
        existingData.outcome = outcomes;

        // Merge existing data with default structure, ensuring new fields are present
        setSip2Data(prevSip2Data => {
            const mergedData = {
              ...prevSip2Data, // Start with default structure (including new fields)
              ...existingData, // Overlay existing data
              seeking_information: existingData.seeking_information, // Use the processed seeking_information
              analysis_claims: existingData.analysis_claims && existingData.analysis_claims.length > 0 ? existingData.analysis_claims : prevSip2Data.analysis_claims,
              outcome: existingData.outcome,
            };

            // --- Migration logic for old field names to new field names and structure ---
            // Migrate cdda_submission_date to cdda_date_submitted if present in old data and new field is empty
            if (existingData.cdda_submission_date && !mergedData.cdda_date_submitted) {
              mergedData.cdda_date_submitted = existingData.cdda_submission_date;
            }
            // Migrate examiner_details to examiner_name if present in old data and new field is empty
            if (existingData.examiner_details && !mergedData.examiner_name) {
              mergedData.examiner_name = existingData.examiner_details;
            }

            // NEW MIGRATION: Migrate deficiency_account to seeking_information if it exists as a top-level field
            if (existingData.deficiency_account && existingData.deficiency_account.trim() !== '') {
                const deficiencyAccountExistsInSeekingInfo = mergedData.seeking_information.some(
                    item => item.source === 'Deficiency Account'
                );

                if (!deficiencyAccountExistsInSeekingInfo) {
                    const newDeficiencyEntry = {
                        source: 'Deficiency Account',
                        sub_heading: 'Legacy Data', // Default heading for migrated data
                        narrative: existingData.deficiency_account
                        // document_ref is intentionally omitted for migrated data
                    };
                    mergedData.seeking_information.push(newDeficiencyEntry);
                }
            }

            // Migrate old analysis_claims structure to new structure
            if (mergedData.analysis_claims) {
              mergedData.analysis_claims = mergedData.analysis_claims.map(claim => {
                const newClaim = {
                  potential_claim: claim.potential_claim || '',
                  potential_claim_identified: claim.potential_claim_identified || '',
                  comments: claim.comments || '',
                };
                // If old fields exist, ensure their values are carried over if not empty, otherwise default
                if (claim.period && !newClaim.potential_claim) newClaim.potential_claim = `Period: ${claim.period}`;
                if (claim.final_claim && !newClaim.potential_claim_identified) newClaim.potential_claim_identified = claim.final_claim;
                return newClaim;
              });
            }

            // Explicitly remove old field names from the merged data to clean up
            delete mergedData.cdda_submission_date;
            delete mergedData.examiner_details;
            delete mergedData.deficiency_account; // Ensure this old field is removed after migration
            // Explicitly remove summary if it exists in old data to prevent it from reappearing
            delete mergedData.summary;
            // --- End Migration Logic ---
            return mergedData;
        });

      } else {
        // If no data exists, ensure there's one empty outcome box
        setSip2Data(prev => ({
            ...prev,
            outcome: [{ text: '', date: new Date().toISOString() }]
        }));
      }
    } catch (error) {
      console.error("Error loading SIP2 data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [caseId]); // `sip2Data` was removed from dependencies here because it's only used as `prevSip2Data` in `setSip2Data` callback

  useEffect(() => {
    if (caseId) {
      loadSIP2Data();
    }
  }, [caseId, loadSIP2Data]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Case.update(caseId, {
        sip2_file_note_data: JSON.stringify(sip2Data)
      });
      setHasChanges(false); // Reset hasChanges after saving
    } catch (error) {
      console.error("Error saving SIP2 data:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSip2Data(prev => ({ ...prev, [field]: value }));
    setHasChanges(true); // Indicate changes
  };

  const handleRadioChange = (field, value) => {
    setSip2Data(prev => ({ ...prev, [field]: value === 'yes' }));
    setHasChanges(true); // Indicate changes
  };

  const handleSeekingInfoChange = (index, field, value) => {
    const updatedInfo = [...sip2Data.seeking_information];
    // Check if the index is valid and the item exists
    if (updatedInfo[index]) {
        updatedInfo[index] = { ...updatedInfo[index], [field]: value };
        setSip2Data(prev => ({ ...prev, seeking_information: updatedInfo }));
        setHasChanges(true); // Indicate changes
    }
  };

  const handleAnalysisChange = (index, field, value) => {
    const updatedAnalysis = [...sip2Data.analysis_claims];
    updatedAnalysis[index] = { ...updatedAnalysis[index], [field]: value };
    setSip2Data(prev => ({ ...prev, analysis_claims: updatedAnalysis }));
    setHasChanges(true); // Indicate changes
  };

  const addAnalysisClaim = () => {
    setSip2Data(prev => ({
      ...prev,
      analysis_claims: [...prev.analysis_claims, { potential_claim: '', potential_claim_identified: '', comments: '' }] // Updated structure
    }));
    setHasChanges(true); // Indicate changes
  };

  const removeAnalysisClaim = (index) => {
    if (sip2Data.analysis_claims.length > 1) {
      const updatedAnalysis = sip2Data.analysis_claims.filter((_, i) => i !== index);
      setSip2Data(prev => ({ ...prev, analysis_claims: updatedAnalysis }));
      setHasChanges(true); // Indicate changes
    }
  };

  const addSeekingInfoEntryForSource = (source) => {
    const newEntry = {
        source: source,
        sub_heading: '',
        narrative: ''
        // document_ref is intentionally omitted
    };
    setSip2Data(prev => ({
        ...prev,
        seeking_information: [...prev.seeking_information, newEntry]
    }));
    setHasChanges(true); // Indicate changes
  };

  const removeSeekingInfoItem = (index) => {
    const updatedInfo = sip2Data.seeking_information.filter((_, i) => i !== index);
    setSip2Data(prev => ({ ...prev, seeking_information: updatedInfo }));
    setHasChanges(true); // Indicate changes
  };

  const handleOutcomeChange = (index, field, value) => {
    const updatedOutcomes = [...sip2Data.outcome];
    updatedOutcomes[index][field] = value;
    setSip2Data(prev => ({ ...prev, outcome: updatedOutcomes }));
    setHasChanges(true); // Indicate changes
  };

  const addOutcomeBox = () => {
    setSip2Data(prev => ({
        ...prev,
        outcome: [...prev.outcome, { text: '', date: new Date().toISOString() }]
    }));
    setHasChanges(true); // Indicate changes
  };

  const removeOutcomeBox = (index) => {
    if (sip2Data.outcome.length === 1) {
        // Don't remove the last box, just clear it.
        const newOutcomes = [...sip2Data.outcome];
        newOutcomes[0].text = '';
        newOutcomes[0].date = new Date().toISOString(); // Also reset date
        setSip2Data(prev => ({ ...prev, outcome: newOutcomes }));
        setHasChanges(true); // Indicate changes
        return;
    }
    const updatedOutcomes = sip2Data.outcome.filter((_, i) => i !== index);
    setSip2Data(prev => ({ ...prev, outcome: updatedOutcomes }));
    setHasChanges(true); // Indicate changes
  };

  const exportAsHTML = () => {
    const cssStyles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
        color: #1e293b;
        padding: 30px;
        max-width: 1200px;
        margin: 0 auto;
        background: white;
      }
      h1 {
        font-size: 28px;
        color: #1e40af;
        border-bottom: 3px solid #3b82f6;
        padding-bottom: 12px;
        margin-bottom: 25px;
        font-weight: bold;
        page-break-after: avoid;
        text-align: left;
      }
      h2 {
        font-size: 22px;
        color: #1e40af;
        margin-top: 30px;
        margin-bottom: 15px;
        font-weight: 600;
        border-bottom: 2px solid #e2e8f0;
        padding-bottom: 8px;
        page-break-before: auto;
        page-break-after: avoid;
        text-align: left;
      }
      h3 {
        font-size: 18px;
        color: #334155;
        margin-top: 20px;
        margin-bottom: 10px;
        font-weight: 600;
        page-break-after: avoid;
        text-align: left;
      }
      h4 {
        font-size: 16px;
        color: #334155;
        margin-top: 15px;
        margin-bottom: 8px;
        font-weight: 600;
        page-break-after: avoid;
        text-align: left;
      }
      p {
        margin: 10px 0;
        color: #475569;
        text-align: left;
      }
      .header-info {
        background-color: #f8fafc;
        border: none;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 25px;
        page-break-inside: avoid;
        page-break-after: avoid;
      }
      .header-info p {
        margin: 5px 0;
        text-align: left;
      }
      .section {
        margin-bottom: 30px;
        padding: 20px;
        background: transparent;
        border: none;
        border-radius: 8px;
        page-break-inside: avoid;
        page-break-before: auto;
      }
      .key-checks {
        background-color: transparent;
        border: none;
        padding: 15px;
        margin: 15px 0;
        page-break-inside: avoid;
      }
      .info-box {
        background-color: transparent;
        border: none;
        padding: 15px;
        margin: 15px 0;
        page-break-inside: avoid;
      }
      .outcome-box {
        background-color: transparent;
        border: none;
        padding: 15px;
        margin: 15px 0;
        page-break-inside: avoid;
      }
      ul {
        padding-left: 25px;
        margin: 10px 0;
        text-align: left;
      }
      li {
        margin: 8px 0;
        color: #475569;
        text-align: left;
      }
      strong {
        color: #1e293b;
        font-weight: 600;
      }
      @media print {
        body { padding: 20px; }
        @page {
          size: A4;
          margin: 1.5cm;
        }
        h1 {
          page-break-after: avoid;
        }
        h2 {
          page-break-before: auto;
          page-break-after: avoid;
        }
        h3, h4 {
          page-break-after: avoid;
        }
        .header-info {
          page-break-inside: avoid;
          page-break-after: avoid;
        }
        .section {
          page-break-inside: avoid;
          page-break-before: auto;
        }
        .key-checks, .info-box, .outcome-box {
          page-break-inside: avoid;
        }
        ul, ol {
          page-break-inside: avoid;
        }
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `;

    // Use loadedCaseData instead of caseData prop, with fallback
    const actualCaseData = loadedCaseData || caseData || {};
    const companyName = actualCaseData?.company_name || 'N/A';
    const caseReference = actualCaseData?.case_reference || 'N/A';
    const caseType = actualCaseData?.case_type || 'N/A';
    const appointmentDate = actualCaseData?.appointment_date || null;

    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      } catch (e) {
        return 'N/A';
      }
    };

    const booleanToYesNo = (val) => val === true ? 'Yes' : val === false ? 'No' : 'N/A';
    const cleanText = (text) => text ? text.replace(/\n/g, '<br>') : '—';

    // 1. Key Status Checks
    const keyStatusChecksHTML = `
      <div class="section key-checks">
        <h2>Key Status Checks</h2>
        <ul>
          <li><strong>Directors Questionnaire Returned:</strong> ${booleanToYesNo(sip2Data.directors_questionnaire_returned)}</li>
          <li><strong>Books & Records Delivered Up:</strong> ${booleanToYesNo(sip2Data.books_records_delivered)}</li>
          <li><strong>Bank Statements Reviewed:</strong> ${booleanToYesNo(sip2Data.bank_statements_reviewed)}</li>
          <li><strong>Bounce Back Loan:</strong> ${booleanToYesNo(sip2Data.bounce_back_loan_check)}</li>
          <li><strong>PN1 Status:</strong> ${booleanToYesNo(sip2Data.pn1_status)}</li>
          <li><strong>Potential Claim:</strong> ${booleanToYesNo(sip2Data.potential_claim_check)}</li>
        </ul>
      </div>
    `;

    // 2. Summary & Assessment
    const summaryHTML = `
      <div class="section">
        <h2>Summary & Initial Assessment</h2>
        <h3>Background</h3>
        <p>${cleanText(sip2Data.background)}</p>
        <h3>Initial Assessment</h3>
        <p>${cleanText(sip2Data.initial_assessment)}</p>
        <h3>Potential Claim</h3>
        <p>${cleanText(sip2Data.potential_claim)}</p>
      </div>
    `;

    // 3. Insolvency Service
    const insolvencyServiceHTML = `
      <div class="section info-box">
        <h2>Insolvency Service</h2>
        <ul>
          <li><strong>Case Sifted In:</strong> ${booleanToYesNo(sip2Data.case_sifted_in)}</li>
          <li><strong>CDDA Date Submitted:</strong> ${formatDate(sip2Data.cdda_date_submitted)}</li>
        </ul>
        <h3>Examiner Details</h3>
        <ul>
          <li><strong>Name:</strong> ${cleanText(sip2Data.examiner_name)}</li>
          <li><strong>Contact Number:</strong> ${cleanText(sip2Data.examiner_contact_number)}</li>
          <li><strong>Email:</strong> ${cleanText(sip2Data.examiner_email)}</li>
          <li><strong>Address:</strong> ${cleanText(sip2Data.examiner_address)}</li>
        </ul>
        <h3>Correspondence</h3>
        <p>${cleanText(sip2Data.correspondence)}</p>
      </div>
    `;

    // 4. Seeking Information
    let seekingInfoHTML = '<div class="section"><h2>Seeking Information</h2>';
    if (sip2Data.seeking_information && sip2Data.seeking_information.length > 0) {
      const groupedSeekingInfo = sip2Data.seeking_information.reduce((acc, item) => {
        if (!acc[item.source]) acc[item.source] = [];
        acc[item.source].push(item);
        return acc;
      }, {});

      // Use the global SEEKING_INFO_SOURCES array for order
      SEEKING_INFO_SOURCES.forEach(sourceKey => {
        const itemsForSource = groupedSeekingInfo[sourceKey];
        if (itemsForSource && itemsForSource.length > 0) {
          seekingInfoHTML += `<h3>${cleanText(sourceKey)}</h3><ul>`;
          itemsForSource.forEach((info, index) => {
            seekingInfoHTML += `<li><strong>Entry ${itemsForSource.length > 1 ? index + 1 : ''}</strong></li>`;
            if (info.sub_heading && info.sub_heading !== 'Legacy Data') seekingInfoHTML += `<li><em>Sub-heading:</em> ${cleanText(info.sub_heading)}</li>`;
            if (info.narrative) seekingInfoHTML += `<li><em>Narrative:</em> ${cleanText(info.narrative)}</li>`;
          });
          seekingInfoHTML += '</ul>';
        }
      });
      
      if (Object.keys(groupedSeekingInfo).length === 0 && sip2Data.seeking_information.length === 0) {
        seekingInfoHTML += '<p>No information requests recorded.</p>';
      } else if (Object.keys(groupedSeekingInfo).length === 0 && sip2Data.seeking_information.length > 0) {
        // This case handles if there's data, but all sources are custom/not in SEEKING_INFO_SOURCES
        // For now, we assume all sources are in SEEKING_INFO_SOURCES for displaying purposes.
        // If there were genuinely other sources, they wouldn't be displayed with the current loop.
        // But the original code only displayed sources from SEEKING_INFO_SOURCES anyway.
        seekingInfoHTML += '<p>No information requests recorded for known sources.</p>';
      }
    } else {
      seekingInfoHTML += '<p>No information requests recorded.</p>';
    }
    seekingInfoHTML += '</div>';

    // 5. Analysis
    const totalPotentialClaims = sip2Data.analysis_claims.reduce((sum, claim) => {
      return sum + (parseFloat(claim.potential_claim_identified) || 0);
    }, 0);
    const totalFinalClaims = 0;

    let analysisHTML = `
      <div class="section">
        <h2>Analysis</h2>
        <div class="key-checks">
          <h3>Summary of Claims</h3>
          <p><strong>Total Potential Claims:</strong> £${totalPotentialClaims.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p><strong>Total Final Claims:</strong> £${totalFinalClaims.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <h3>Claims Detail</h3>
    `;
    
    if (sip2Data.analysis_claims && sip2Data.analysis_claims.length > 0) {
      sip2Data.analysis_claims.forEach((claim, index) => {
        analysisHTML += `
          <div class="info-box">
            <h4>Claim ${index + 1}</h4>
            <p><strong>Description:</strong> ${cleanText(claim.potential_claim)}</p>
            <p><strong>Identified Value:</strong> £${(parseFloat(claim.potential_claim_identified) || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p><strong>Comments:</strong> ${cleanText(claim.comments)}</p>
          </div>
        `;
      });
    } else {
      analysisHTML += '<p>No claims recorded.</p>';
    }
    analysisHTML += '</div>';

    // 6. Outcome
    let outcomeHTML = '<div class="section outcome-box"><h2>Outcome</h2>';
    if (sip2Data.outcome && sip2Data.outcome.length > 0) {
      sip2Data.outcome.forEach((entry, index) => {
        if (index === 0) {
          outcomeHTML += `
            <h3>Initial Outcome</h3>
            <p>${cleanText(entry.text)}</p>
          `;
        } else {
          outcomeHTML += `
            <h3>Update ${index} (${formatDate(entry.date)})</h3>
            <p>${cleanText(entry.text)}</p>
          `;
        }
      });
    } else {
      outcomeHTML += '<p>No outcome recorded.</p>';
    }
    outcomeHTML += '</div>';

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SIP 2 Investigation File Note - ${companyName}</title>
  <style>${cssStyles}</style>
</head>
<body>
  <h1>SIP 2 Investigation File Note</h1>
  <div class="header-info">
    <p><strong>Company:</strong> ${companyName}</p>
    <p><strong>Case Reference:</strong> ${caseReference}</p>
    <p><strong>Case Type:</strong> ${caseType}</p>
    <p><strong>Appointment Date:</strong> ${formatDate(appointmentDate)}</p>
  </div>
  
  ${keyStatusChecksHTML}
  ${summaryHTML}
  ${insolvencyServiceHTML}
  ${seekingInfoHTML}
  ${analysisHTML}
  ${outcomeHTML}
</body>
</html>`;

    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(htmlContent);
      newTab.document.close();
      // Removed newTab.print() as per the outline for better user control.
    } else {
      alert('Please allow popups to export the SIP 2 file note');
    }
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'summary_assessment':
        return (
          <FormSection title="Summary & Initial Assessment" icon={<BookOpen className="w-5 h-5"/>}>
            <div className="space-y-2">
                <Label>Background</Label>
                <Textarea value={sip2Data.background} onChange={(e) => handleInputChange('background', e.target.value)} placeholder="Detail the background of the case..." rows={4} />
            </div>
            {/* Deficiency Account field removed from here */}
            <div className="space-y-2">
                <Label>Initial Assessment</Label>
                <Textarea value={sip2Data.initial_assessment} onChange={(e) => handleInputChange('initial_assessment', e.target.value)} placeholder="Describe the initial assessment..." rows={4} />
            </div>
            <div className="space-y-2">
                <Label>Potential Claim</Label>
                <Textarea value={sip2Data.potential_claim} onChange={(e) => handleInputChange('potential_claim', e.target.value)} placeholder="Identify any potential claims..." rows={4} />
            </div>
          </FormSection>
        );

      case 'key_checks':
        return (
          <FormSection title="Key Status Checks" icon={<ListChecks className="w-5 h-5"/>}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Directors Questionnaire Returned</Label>
                <RadioGroup value={sip2Data.directors_questionnaire_returned === true ? 'yes' : sip2Data.directors_questionnaire_returned === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('directors_questionnaire_returned', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="dq-yes" /><Label htmlFor="dq-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="dq-no" /><Label htmlFor="dq-no">No</Label></div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Books & Records Delivered Up</Label>
                <RadioGroup value={sip2Data.books_records_delivered === true ? 'yes' : sip2Data.books_records_delivered === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('books_records_delivered', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="br-yes" /><Label htmlFor="br-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="br-no" /><Label htmlFor="br-no">No</Label></div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Bank Statements Reviewed</Label>
                <RadioGroup value={sip2Data.bank_statements_reviewed === true ? 'yes' : sip2Data.bank_statements_reviewed === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('bank_statements_reviewed', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="bs-yes" /><Label htmlFor="bs-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="bs-no" /><Label htmlFor="bs-no">No</Label></div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Bounce Back Loan</Label>
                <RadioGroup value={sip2Data.bounce_back_loan_check === true ? 'yes' : sip2Data.bounce_back_loan_check === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('bounce_back_loan_check', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="bbl-yes" /><Label htmlFor="bbl-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="bbl-no" /><Label htmlFor="bbl-no">No</Label></div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">PN1 Status</Label>
                <RadioGroup value={sip2Data.pn1_status === true ? 'yes' : sip2Data.pn1_status === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('pn1_status', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="pn1-yes" /><Label htmlFor="pn1-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="pn1-no" /><Label htmlFor="pn1-no">No</Label></div>
                </RadioGroup>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Potential claim</Label>
                <RadioGroup value={sip2Data.potential_claim_check === true ? 'yes' : sip2Data.potential_claim_check === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('potential_claim_check', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="pot-claim-yes" /><Label htmlFor="pot-claim-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="pot-claim-no" /><Label htmlFor="pot-claim-no">No</Label></div>
                </RadioGroup>
            </div>
          </FormSection>
        );

      case 'insolvency_service':
        return (
          <FormSection title="Insolvency Service" icon={<University className="w-5 h-5"/>}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center p-4 border rounded-lg bg-slate-50">
                <Label className="font-semibold text-slate-700">Case Sifted In</Label>
                <RadioGroup value={sip2Data.case_sifted_in === true ? 'yes' : sip2Data.case_sifted_in === false ? 'no' : ''} onValueChange={(val) => handleRadioChange('case_sifted_in', val)} className="flex items-center gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="sifted-yes" /><Label htmlFor="sifted-yes">Yes</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="sifted-no" /><Label htmlFor="sifted-no">No</Label></div>
                </RadioGroup>
            </div>

            <div className="space-y-2">
                <Label>CDDA Date Submitted</Label>
                <Input type="date" value={formatForInput(sip2Data.cdda_date_submitted)} onChange={(e) => handleInputChange('cdda_date_submitted', e.target.value)} />
            </div>

            <div className="space-y-4">
                <Label className="text-lg font-semibold text-slate-800">Examiner Details</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={sip2Data.examiner_name} onChange={(e) => handleInputChange('examiner_name', e.target.value)} placeholder="Examiner name" />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact Number</Label>
                        <Input value={sip2Data.examiner_contact_number} onChange={(e) => handleInputChange('examiner_contact_number', e.target.value)} placeholder="Contact number" />
                    </div>
                    <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" value={sip2Data.examiner_email} onChange={(e) => handleInputChange('examiner_email', e.target.value)} placeholder="Email address" />
                    </div>
                    <div className="space-y-2">
                        <Label>Address</Label>
                        <Textarea value={sip2Data.examiner_address} onChange={(e) => handleInputChange('examiner_address', e.target.value)} placeholder="Address" rows={3} />
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Correspondence</Label>
                <Textarea value={sip2Data.correspondence} onChange={(e) => handleInputChange('correspondence', e.target.value)} placeholder="Record correspondence details..." rows={6} />
            </div>
          </FormSection>
        );

      case 'seeking_info':
        return (
          <FormSection title="Seeking Information" icon={<Search className="w-5 h-5"/>}>
            <div className="space-y-4">
              {SEEKING_INFO_SOURCES.map(source => {
                const itemsForSource = sip2Data.seeking_information
                  .map((item, index) => ({ ...item, originalIndex: index }))
                  .filter(item => item.source === source);

                return (
                  <div key={source} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-800">{source}</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addSeekingInfoEntryForSource(source)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Entry
                      </Button>
                    </div>

                    {itemsForSource.map((item) => (
                      <div key={item.originalIndex} className="p-4 border rounded-lg bg-slate-50 relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSeekingInfoItem(item.originalIndex)}
                          className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>

                        <div className="space-y-2">
                           <Label className="text-sm">Sub-heading</Label>
                           <Input
                                value={item.sub_heading || ''}
                                onChange={(e) => handleSeekingInfoChange(item.originalIndex, 'sub_heading', e.target.value)}
                                placeholder="Heading"
                                className="font-semibold"
                           />
                           <Label className="text-sm mt-3 block">Narrative</Label>
                           <Textarea
                            value={item.narrative}
                            onChange={(e) => handleSeekingInfoChange(item.originalIndex, 'narrative', e.target.value)}
                            rows={6}
                            placeholder="Enter detailed narrative..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </FormSection>
        );

      case 'analysis':
        const totalPotentialClaims = sip2Data.analysis_claims.reduce((sum, claim) => {
          return sum + (parseFloat(claim.potential_claim_identified) || 0);
        }, 0);

        const totalFinalClaims = 0; // This value is now dependent on what 'final claim' means in the new design.

        return (
          <FormSection title="Analysis" icon={<BarChart2 className="w-5 h-5"/>}>
            {/* Summary Table */}
            <div className="bg-slate-50 border rounded-lg p-4">
              <h4 className="font-semibold text-slate-800 mb-4">Summary</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded border">
                  <Label className="text-sm font-medium text-slate-600">Total Potential Claims</Label>
                  <div className="text-2xl font-bold text-blue-700 mt-1">
                    £{totalPotentialClaims.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-center p-3 bg-white rounded border">
                  <Label className="text-sm font-medium text-slate-600">Total Final Claims</Label>
                  <div className="text-2xl font-bold text-green-700 mt-1">
                    £{totalFinalClaims.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Claims Detail Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-slate-800">Claims Detail</h4>
                <Button variant="outline" onClick={addAnalysisClaim} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Plus className="w-4 h-4 mr-2" /> Add Claim
                </Button>
              </div>

              {sip2Data.analysis_claims.map((claim, index) => (
                <div key={index} className="p-4 border rounded-lg bg-slate-50 space-y-3"> {/* Removed 'relative' as delete button is now inline */}
                   {/* Row for Description, Value, and Delete Button */}
                   <div className="flex items-end gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 space-y-1.5 min-w-[120px]">
                            <Label className="text-sm font-medium">Potential Claim</Label>
                            <Input
                                value={claim.potential_claim}
                                onChange={(e) => handleAnalysisChange(index, 'potential_claim', e.target.value)}
                                placeholder="Claim description (e.g., Unpaid salary)"
                            />
                        </div>
                         <div className="w-32 space-y-1.5 min-w-[80px]">
                            <Label className="text-sm font-medium">Value (£)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={claim.potential_claim_identified}
                                onChange={(e) => handleAnalysisChange(index, 'potential_claim_identified', e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        {sip2Data.analysis_claims.length > 1 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeAnalysisClaim(index)}
                                className="text-red-500 hover:text-red-700 mb-0.5 flex-shrink-0"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                   </div>
                   {/* Comments Section */}
                   <div className="space-y-1.5">
                        <Label className="text-sm font-medium">Comments</Label>
                        <Textarea
                            value={claim.comments}
                            onChange={(e) => handleAnalysisChange(index, 'comments', e.target.value)}
                            rows={3}
                            placeholder="Add comments about this claim..."
                        />
                   </div>
                </div>
              ))}
            </div>
          </FormSection>
        );

      case 'outcome':
        return (
          <FormSection title="Outcome" icon={<Flag className="w-5 h-5"/>}>
            <div className="space-y-4">
                {(sip2Data.outcome || []).map((entry, index) => (
                    <div key={index} className="relative p-4 border rounded-lg bg-slate-50 space-y-3">
                        {index === 0 ? (
                            // First box - no date field
                            <div>
                                <Label className="text-sm font-medium">Initial Outcome</Label>
                                <Textarea
                                    value={entry.text}
                                    onChange={(e) => handleOutcomeChange(index, 'text', e.target.value)}
                                    placeholder="Detail the initial outcome..."
                                    rows={6}
                                    className="mt-1"
                                />
                            </div>
                        ) : (
                            // Update boxes - with date field next to title
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">Update</Label>
                                    <div className="flex items-center gap-2 mr-8">
                                        <Label className="text-sm font-medium">Date:</Label>
                                        <Input
                                            type="date"
                                            value={formatForInput(entry.date)}
                                            onChange={(e) => handleOutcomeChange(index, 'date', e.target.value)}
                                            className="w-40"
                                        />
                                    </div>
                                </div>
                                <Textarea
                                    value={entry.text}
                                    onChange={(e) => handleOutcomeChange(index, 'text', e.target.value)}
                                    placeholder="Provide an update..."
                                    rows={6}
                                />
                            </div>
                        )}
                        {sip2Data.outcome.length > 1 && index > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOutcomeBox(index)}
                                className="absolute top-2 right-2 text-red-500 hover:text-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                ))}
                <Button variant="outline" onClick={addOutcomeBox}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Update Box
                </Button>
            </div>
          </FormSection>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-600">Loading SIP2 file note...</span>
      </div>
    );
  }

  const sections = [
    { key: 'key_checks', label: 'Key Status Checks', icon: <ListChecks className="w-4 h-4" /> },
    { key: 'summary_assessment', label: 'Summary & Assessment', icon: <BookOpen className="w-4 h-4" /> },
    { key: 'insolvency_service', label: 'Insolvency Service', icon: <University className="w-4 h-4" /> },
    { key: 'seeking_info', label: 'Seeking Information', icon: <Search className="w-4 h-4" /> },
    { key: 'analysis', label: 'Analysis', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'outcome', label: 'Outcome', icon: <Flag className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-slate-900">
              SIP 2 Investigation File Note
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={exportAsHTML}
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges} // Disable save if no changes
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Progress
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b">
              {sections.map(section => (
                <MenuButton
                  key={section.key}
                  label={section.label}
                  icon={section.icon}
                  isActive={activeSection === section.key}
                  onClick={() => setActiveSection(section.key)}
                />
              ))}
            </div>
            <div className="mt-6">
              {renderContent()}
            </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SIP2FileNote;
