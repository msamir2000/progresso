import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  RefreshCw,
  Calendar
} from 'lucide-react';

export default function DiaryDiagnostic() {
  const [caseReference, setCaseReference] = useState('GLINK8');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const runDiagnostic = async () => {
    if (!caseReference.trim()) {
      setError('Please enter a case reference');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      // 1. Find the case
      const cases = await base44.entities.Case.list();
      const matchingCase = cases.find(c => 
        c.case_reference && c.case_reference.toLowerCase().includes(caseReference.toLowerCase())
      );

      if (!matchingCase) {
        setError(`Case with reference containing "${caseReference}" not found`);
        setLoading(false);
        return;
      }

      // 2. Check for diary entries
      const diaryEntries = await base44.entities.CaseDiaryEntry.filter({ 
        case_id: matchingCase.id 
      });

      // 3. Check for diary templates
      const diaryTemplates = await base44.entities.DiaryTemplate.list();
      const cvlTemplates = diaryTemplates.filter(t => t.case_type === matchingCase.case_type);
      const defaultTemplate = cvlTemplates.find(t => t.is_default);

      // 4. Get current user
      const currentUser = await base44.auth.me();

      setResults({
        case: matchingCase,
        diaryEntries: diaryEntries || [],
        totalTemplates: diaryTemplates.length,
        caseTypeTemplates: cvlTemplates.length,
        defaultTemplate: defaultTemplate,
        currentUser: currentUser,
        hasAppointmentDate: !!matchingCase.appointment_date
      });

    } catch (err) {
      console.error('Diagnostic error:', err);
      setError(`Error running diagnostic: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const initializeDiaryEntries = async () => {
    if (!results || !results.defaultTemplate) {
      setError('No default diary template found for this case type');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const template = results.defaultTemplate;
      const templateEntries = template.diary_entries || [];

      // Create diary entries from template
      const entriesToCreate = templateEntries.map(entry => ({
        case_id: results.case.id,
        entry_id: entry.id,
        category: entry.category,
        title: entry.title,
        description: entry.description || '',
        reference_point: entry.reference_point,
        time_offset: entry.time,
        deadline_date: null, // Will be calculated when reference point is available
        status: 'pending',
        notes: '',
        order: entry.order
      }));

      // Create entries in bulk
      for (const entry of entriesToCreate) {
        await base44.entities.CaseDiaryEntry.create(entry);
      }

      // Re-run diagnostic to show results
      await runDiagnostic();

      alert(`Successfully initialized ${entriesToCreate.length} diary entries!`);

    } catch (err) {
      console.error('Error initializing diary entries:', err);
      setError(`Error initializing diary entries: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-blue-600" />
              Case Diary Diagnostic Tool
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="Enter case reference (e.g., GLINK8)"
                value={caseReference}
                onChange={(e) => setCaseReference(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && runDiagnostic()}
              />
              <Button onClick={runDiagnostic} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span className="ml-2">Check</span>
              </Button>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {results && (
          <div className="space-y-4">
            {/* Case Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Case Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Company Name</p>
                    <p className="font-semibold">{results.case.company_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Case Reference</p>
                    <p className="font-semibold">{results.case.case_reference}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Case Type</p>
                    <p className="font-semibold">{results.case.case_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Appointment Date</p>
                    <p className="font-semibold">
                      {results.hasAppointmentDate 
                        ? new Date(results.case.appointment_date).toLocaleDateString()
                        : 'Not Set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Case ID</p>
                    <p className="font-mono text-xs">{results.case.id}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Diary Entries Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {results.diaryEntries.length > 0 ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  Diary Entries Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {results.diaryEntries.length}
                    </p>
                    <p className="text-sm text-slate-600">Diary entries found for this case</p>
                  </div>

                  {results.diaryEntries.length === 0 && (
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800">
                        No diary entries found. This case needs to be initialized with diary entries.
                      </AlertDescription>
                    </Alert>
                  )}

                  {results.diaryEntries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Entry Status Breakdown:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-100 rounded p-3">
                          <p className="text-xs text-slate-600">Pending</p>
                          <p className="text-lg font-semibold">
                            {results.diaryEntries.filter(e => e.status === 'pending').length}
                          </p>
                        </div>
                        <div className="bg-green-100 rounded p-3">
                          <p className="text-xs text-green-700">Completed</p>
                          <p className="text-lg font-semibold text-green-800">
                            {results.diaryEntries.filter(e => 
                              e.status === 'completed_on_time' || e.status === 'completed_late'
                            ).length}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Template Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {results.defaultTemplate ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  Diary Template Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">Total Templates</p>
                    <p className="text-xl font-semibold">{results.totalTemplates}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">{results.case.case_type} Templates</p>
                    <p className="text-xl font-semibold">{results.caseTypeTemplates}</p>
                  </div>
                </div>

                {results.defaultTemplate ? (
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-sm font-medium text-green-800">
                      ✓ Default template found: {results.defaultTemplate.template_name}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Contains {results.defaultTemplate.total_entries} diary entries
                    </p>
                  </div>
                ) : (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      No default {results.case.case_type} diary template found. 
                      Please create one in Settings → Diary Templates.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* User Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Current User</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-slate-600">Email</p>
                    <p className="font-semibold">{results.currentUser?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Grade</p>
                    <p className="font-semibold">{results.currentUser?.grade || 'Not Set'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Button */}
            {results.diaryEntries.length === 0 && results.defaultTemplate && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <p className="text-blue-900 font-medium">
                      Would you like to initialize diary entries for this case?
                    </p>
                    <Button 
                      onClick={initializeDiaryEntries}
                      disabled={loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Initializing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Initialize Diary Entries
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}