import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Info, FileCheck, FileSignature, Send } from 'lucide-react';
import { Case } from '@/api/entities';
import { Employee } from '@/api/entities';

export default function RPS() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      loadEmployees(selectedCase);
    }
  }, [selectedCase]);

  const loadCases = async () => {
    try {
      const allCases = await Case.list('-created_date');
      const eligibleCases = allCases.filter(c => 
        c.case_type === 'CVL' || c.case_type === 'Administration'
      );
      setCases(eligibleCases);
      if (eligibleCases.length > 0) {
        setSelectedCase(eligibleCases[0].id);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async (caseId) => {
    try {
      const allEmployees = await Employee.list();
      const caseEmployees = allEmployees.filter(e => e.case_id === caseId);
      setEmployees(caseEmployees);
    } catch (error) {
      console.error('Failed to load employees:', error);
    }
  };

  const selectedCaseData = cases.find(c => c.id === selectedCase);

  if (loading) {
    return (
      <div className="min-h-screen p-6 md:p-8 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading RPS Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-blue-700" />
            <h1 className="text-3xl font-bold font-display text-slate-900">RPS Management</h1>
          </div>
          <p className="text-slate-600 text-lg">
            Redundancy Payments Service claims and management
          </p>
        </div>

        {/* Case Selection */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Select Case:
              </Label>
              <Select value={selectedCase || ''} onValueChange={setSelectedCase}>
                <SelectTrigger className="flex-1 max-w-md">
                  <SelectValue placeholder="Select a case..." />
                </SelectTrigger>
                <SelectContent>
                  {cases.map(case_ => (
                    <SelectItem key={case_.id} value={case_.id}>
                      {case_.company_name} - {case_.case_reference} ({case_.case_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCaseData && (
                <div className="text-sm text-slate-600">
                  <span className="font-medium">{employees.length}</span> employees
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs for RPS Management */}
        {selectedCase ? (
          <Tabs defaultValue="information" className="space-y-6">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="information" className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Information
              </TabsTrigger>
              <TabsTrigger value="rp14" className="flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                RP14
              </TabsTrigger>
              <TabsTrigger value="rp14a" className="flex items-center gap-2">
                <FileSignature className="w-4 h-4" />
                RP14a
              </TabsTrigger>
              <TabsTrigger value="rps_claim" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                RPS Claim
              </TabsTrigger>
            </TabsList>

            {/* Information Tab */}
            <TabsContent value="information">
              <Card>
                <CardHeader>
                  <CardTitle>RPS Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="prose max-w-none">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">
                      About Redundancy Payments Service
                    </h3>
                    <p className="text-slate-700 mb-4">
                      The Redundancy Payments Service (RPS) processes claims from employees for certain statutory payments 
                      when their employer is insolvent and cannot make these payments.
                    </p>
                    
                    <h4 className="text-base font-semibold text-slate-900 mb-2">Eligible Claims</h4>
                    <ul className="list-disc list-inside space-y-2 text-slate-700 mb-4">
                      <li>Statutory redundancy pay</li>
                      <li>Unpaid wages (up to 8 weeks)</li>
                      <li>Accrued holiday pay</li>
                      <li>Notice pay</li>
                      <li>Unpaid pension contributions</li>
                    </ul>

                    <h4 className="text-base font-semibold text-slate-900 mb-2">Weekly Limits</h4>
                    <p className="text-slate-700 mb-4">
                      RPS payments are subject to statutory weekly limits which are updated annually. 
                      The current limits are automatically calculated based on the insolvency date.
                    </p>

                    <h4 className="text-base font-semibold text-slate-900 mb-2">Forms Required</h4>
                    <ul className="list-disc list-inside space-y-2 text-slate-700">
                      <li><strong>RP14:</strong> Employee's claim form</li>
                      <li><strong>RP14a:</strong> Insolvency practitioner's statement</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Case Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700 font-medium">Company:</span>
                        <p className="text-blue-900">{selectedCaseData?.company_name}</p>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Case Type:</span>
                        <p className="text-blue-900">{selectedCaseData?.case_type}</p>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Appointment Date:</span>
                        <p className="text-blue-900">
                          {selectedCaseData?.appointment_date ? 
                            new Date(selectedCaseData.appointment_date).toLocaleDateString('en-GB') : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-blue-700 font-medium">Total Employees:</span>
                        <p className="text-blue-900">{employees.length}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* RP14 Tab */}
            <TabsContent value="rp14">
              <Card>
                <CardHeader>
                  <CardTitle>RP14 - Employee Claim Form</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-slate-500">
                    <FileCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">RP14 Forms</h3>
                    <p className="text-slate-500 mb-4">
                      Generate and manage RP14 claim forms for employees.
                    </p>
                    <p className="text-sm text-slate-400">
                      The RP14 form is completed by employees to claim statutory payments from RPS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* RP14a Tab */}
            <TabsContent value="rp14a">
              <Card>
                <CardHeader>
                  <CardTitle>RP14a - Insolvency Practitioner's Statement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-slate-500">
                    <FileSignature className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">RP14a Forms</h3>
                    <p className="text-slate-500 mb-4">
                      Generate and manage RP14a statements for RPS claims.
                    </p>
                    <p className="text-sm text-slate-400">
                      The RP14a form is completed by the IP to verify employee claims and company insolvency.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* RPS Claim Tab */}
            <TabsContent value="rps_claim">
              <Card>
                <CardHeader>
                  <CardTitle>Submit RPS Claims</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-slate-500">
                    <Send className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-slate-600 mb-2">RPS Claim Submission</h3>
                    <p className="text-slate-500 mb-4">
                      Submit completed claims to the Redundancy Payments Service.
                    </p>
                    <p className="text-sm text-slate-400">
                      Track claim status and manage responses from RPS.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No Case Selected</h3>
              <p className="text-slate-500">
                Please select a case to manage RPS claims.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}