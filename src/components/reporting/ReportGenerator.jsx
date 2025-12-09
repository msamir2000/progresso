import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

import { Reports } from '@/api/entities';
import { StatementOfAffairs } from '@/api/entities';
import { Asset } from '@/api/entities';
import { InvokeLLM } from '@/api/integrations';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Wand2, AlertCircle, FileWarning, Save, CheckCircle } from 'lucide-react';

const quillModules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image'],
    ['clean']
  ],
};

export default function ReportGenerator({ case_, creditors, employees }) {
  const [reportType, setReportType] = useState('SIP6');
  const [instructions, setInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [generatedReport, setGeneratedReport] = useState(null);
  const [draftContent, setDraftContent] = useState('');
  
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadExistingReport();
  }, [case_, reportType]);

  const loadExistingReport = async () => {
    if (!case_?.id) return;
    setIsLoading(true);
    setError(null);
    try {
      const reports = await Reports.filter({ case_id: case_.id, report_type: reportType }, '-created_date', 1);
      if (reports.length > 0) {
        setGeneratedReport(reports[0]);
        setDraftContent(reports[0].ai_draft || '');
      } else {
        setGeneratedReport(null);
        setDraftContent('');
      }
    } catch (e) {
      setError('Failed to load existing reports.');
      console.error(e);
    }
    setIsLoading(false);
  };
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
        const [soaRecords, assets] = await Promise.all([
            StatementOfAffairs.filter({ case_id: case_.id }, '-version', 1),
            Asset.filter({ case_id: case_.id })
        ]);

        const latestSoA = soaRecords.length > 0 ? soaRecords[0] : null;

        const prompt = `
You are "The Johnson", an expert insolvency report writer. Your task is to generate a draft for a ${reportType === 'SIP6' ? 'SIP 6 - Initial Report to Creditors' : reportType} for the case: ${case_.company_name}.

**User's Specific Instructions:**
${instructions || 'No specific instructions provided. Follow standard procedure.'}

**Case Data:**
- Company Name: ${case_.company_name} (${case_.company_number})
- Case Type: ${case_.case_type}
- Date of Appointment: ${case_.appointment_date}
- IP Name: ${case_.ip_name}
- Administrator: ${case_.administrator_name}

**Statement of Affairs Summary (as at ${latestSoA?.as_at_date}):**
${latestSoA ? JSON.stringify(latestSoA.data, null, 2) : 'No Statement of Affairs available.'}

**Assets Summary:**
${assets.length > 0 ? assets.map(a => `- ${a.asset_name}: Realisable Value £${a.realisable_value}`).join('\\n') : 'No assets recorded.'}

**Creditors Summary:**
- Total Creditors: ${creditors.length}
- Secured: ${creditors.filter(c => c.creditor_type === 'secured').length}
- Preferential: ${creditors.filter(c => c.creditor_type === 'preferential').length}
- Unsecured: ${creditors.filter(c => c.creditor_type === 'unsecured').length}

**Employees Summary:**
- Total Employees: ${employees.length}

Based on all this information and the user's instructions, generate the report draft. The output must be in rich HTML format. Also, identify any crucial information that is missing or appears inconsistent and would normally be required for this type of report.
        `;

        const result = await InvokeLLM({
            prompt,
            response_json_schema: {
                type: "object",
                properties: {
                    draft_html: { type: "string", description: "The full report draft in rich HTML format, including headings, paragraphs, and lists." },
                    missing_information: { type: "array", items: { type: "string" }, description: "A list of missing or inconsistent data points needed to complete the report." }
                },
                required: ["draft_html", "missing_information"]
            }
        });

        if (result && result.draft_html) {
            const reportData = {
                case_id: case_.id,
                report_type: reportType,
                ai_draft: result.draft_html,
                missing_items: result.missing_information || []
            };

            let updatedReport;
            if (generatedReport) {
                updatedReport = await Reports.update(generatedReport.id, reportData);
            } else {
                updatedReport = await Reports.create(reportData);
            }
            setGeneratedReport(updatedReport);
            setDraftContent(updatedReport.ai_draft);
        } else {
            throw new Error("AI did not return the expected report format.");
        }

    } catch (e) {
        setError(`Failed to generate report: ${e.message}`);
        console.error(e);
    }
    setIsGenerating(false);
  };
  
  const handleSave = async () => {
    if (!generatedReport) {
        setError("Cannot save, no report has been generated yet.");
        return;
    }
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
        const updatedReport = await Reports.update(generatedReport.id, { ai_draft: draftContent });
        setGeneratedReport(updatedReport);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
    } catch(e) {
        setError(`Failed to save changes: ${e.message}`);
        console.error(e);
    }
    setIsSaving(false);
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reporting Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="report-type">Report Type</Label>
            <Select id="report-type" value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a report type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIP6">SIP 6 - Initial Report to Creditors</SelectItem>
                <SelectItem value="AnnualReport">Annual Progress Report</SelectItem>
                <SelectItem value="FinalReport">Final Report</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="instructions">Specific Instructions for The Johnson</Label>
            <Textarea
              id="instructions"
              placeholder="e.g., 'Please focus on the recovery of book debts and provide a detailed breakdown.' or 'Keep the report concise and use formal language throughout.'"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  {generatedReport ? 'Re-generate Draft' : 'Generate Draft'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
        </div>
      )}

      {(generatedReport?.missing_items?.length > 0) && (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-700">
                    <FileWarning className="w-5 h-5" />
                    Missing Information
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-2 text-sm text-slate-600">The AI identified the following missing information required to generate a complete report:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">
                    {generatedReport.missing_items.map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ul>
            </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Generated Draft</CardTitle>
            <div className="flex items-center gap-2">
                {saveSuccess && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Saved!</span>}
                <Button onClick={handleSave} disabled={isSaving || !generatedReport}>
                    {isSaving ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                        <><Save className="w-4 h-4 mr-2" /> Save Draft</>
                    )}
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="bg-white rounded-lg">
            <ReactQuill
              theme="snow"
              value={draftContent}
              onChange={setDraftContent}
              modules={quillModules}
              placeholder="The generated report draft will appear here. You can edit it directly."
              className="min-h-[400px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}