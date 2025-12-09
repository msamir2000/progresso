import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, Building, Lock, Unlock, RefreshCw, ExternalLink, Users, User, Users2, Edit, Plus, X, FileText, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { InvokeLLM } from '@/api/integrations';

export default function CompaniesHouseLookup({ case_, onUpdate }) {
  const [companyNumber, setCompanyNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [companyData, setCompanyData] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isEditingDirectors, setIsEditingDirectors] = useState(false);
  const [isEditingShareholders, setIsEditingShareholders] = useState(false);
  const [editableDirectors, setEditableDirectors] = useState([]);
  const [editableShareholders, setEditableShareholders] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    if (case_) {
      setCompanyNumber(case_.company_number || '');
      setCompanyName(case_.company_name || '');
      setIsLocked(case_.companies_house_locked || false);
      
      if (case_.directors) {
        setEditableDirectors(case_.directors);
      } else {
        setEditableDirectors([]);
      }
      
      // Set shareholders from case data
      if (case_.shareholders) {
        setEditableShareholders(case_.shareholders.map(s => ({
          ...s,
          email_address: s.email_address || '',
          phone_number: s.phone_number || '',
          address: s.address || ''
        })));
      } else {
        setEditableShareholders([]);
      }
      
      // Set companyData from case if available - but DON'T override shareholders/directors (handled by the next useEffect with a condition)
      if (case_.company_name && case_.company_number) {
        setCompanyData({
          company_name: case_.company_name,
          company_number: case_.company_number,
          incorporation_date: case_.incorporation_date,
          registered_office_address: case_.registered_office_address,
          company_status: case_.company_status,
          company_type: case_.company_type,
          last_confirmation_statement_date: case_.last_confirmation_statement_date,
          next_confirmation_statement_due: case_.next_confirmation_statement_due,
          last_accounts_date: case_.last_accounts_date,
          next_accounts_due: case_.next_accounts_due,
          accounting_reference_date: case_.accounting_reference_date,
          directors: case_.directors || [],
          shareholders: (case_.shareholders || []).map(s => ({
            ...s,
            email_address: s.email_address || '',
            phone_number: s.phone_number || '',
            address: s.address || ''
          })),
          company_name_changes: case_.company_name_changes || []
        });
      }
    }
  }, [case_]);

  useEffect(() => {
    if (companyData) {
      // Only update editable directors/shareholders if they're currently empty
      // This prevents overwriting saved data with search results
      if (companyData.directors && editableDirectors.length === 0) {
        setEditableDirectors(companyData.directors);
      }
      if (companyData.shareholders && editableShareholders.length === 0) {
        setEditableShareholders(companyData.shareholders.map(s => ({
          ...s,
          email_address: s.email_address || '',
          phone_number: s.phone_number || '',
          address: s.address || ''
        })));
      }
    }
  }, [companyData]);

  const handleSearch = async () => {
    if (!companyNumber && !companyName) {
      setSearchError('Please enter either a company number or company name');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setCompanyData(null);
    setEditableDirectors([]);
    setEditableShareholders([]);

    try {
      let formattedCompanyNumber = companyNumber.replace(/\s/g, '');
      if (formattedCompanyNumber && /^\d+$/.test(formattedCompanyNumber)) {
        formattedCompanyNumber = formattedCompanyNumber.padStart(8, '0');
      }

      const companiesHouseUrl = formattedCompanyNumber 
        ? `https://find-and-update.company-information.service.gov.uk/company/${formattedCompanyNumber}`
        : null;

      const prompt = `You are extracting company information from Companies House UK ${companiesHouseUrl ? `from this specific URL: ${companiesHouseUrl}` : `for company: "${companyName}"`}.

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE STEPS EXACTLY:

STEP 1: Navigate to the Companies House page for the company
STEP 2: Extract basic company information from the Overview page
STEP 3: Click on or navigate to the "People" or "Officers" section/tab to find ALL DIRECTORS
STEP 4: For EACH director listed, extract their FULL information including complete address
STEP 5: Click on the "Persons with significant control" section to find shareholders/PSC
STEP 6: Review the "Filing history" section to find confirmation statement and accounts dates

MANDATORY DATA TO EXTRACT:

1. COMPANY DETAILS:
   - Exact registered company name
   - Company number (preserve leading zeros)
   - Date of incorporation
   - Full registered office address (multi-line format)
   - Company status (e.g., Active, Dissolved, Liquidation)
   - Company type (e.g., Private limited company)
   - Date of last confirmation statement filed
   - Next confirmation statement due date
   - Date of last accounts filed
   - Next accounts due date
   - Accounting reference date

2. DIRECTORS (ABSOLUTELY CRITICAL - DO NOT SKIP):
   ⚠️ YOU MUST EXTRACT ALL DIRECTORS - THIS IS MANDATORY
   - Look in the "People", "Officers", or "Current officers" section
   - Extract EVERY SINGLE director listed (both current and recently resigned)
   - For resigned directors, only include those who resigned within the last 3 years
   - For EACH director you MUST provide:
     * Full legal name (as shown on Companies House)
     * Complete correspondence address (full multi-line address)
     * Appointment date (format: YYYY-MM-DD)
     * Resignation date if resigned (format: YYYY-MM-DD) or null if currently active
     * Status: "active" if still serving, "resigned" if no longer serving
   
   ⚠️ If you cannot find ANY directors, this is an ERROR - every UK company must have directors listed

3. SHAREHOLDERS/PSC:
   - Look in the "Persons with significant control" or "PSC" section
   - Extract ALL persons with significant control
   - For EACH shareholder provide:
     * Full name
     * Share class (e.g., "Ordinary")
     * Number of shares held (numeric value)
     * Percentage of shares held (numeric percentage)
     * Type: "ordinary", "preference", or "other"
     * Nominal value per share in pence (e.g., 100 for £1 shares)

4. NAME CHANGES (if any in last 3 years):
   - Previous name
   - New name
   - Date of change

Return in this EXACT JSON structure:

{
  "company_name": "string",
  "company_number": "string",
  "incorporation_date": "YYYY-MM-DD",
  "registered_office_address": "string with newlines",
  "company_status": "string",
  "company_type": "string",
  "last_confirmation_statement_date": "YYYY-MM-DD or null",
  "next_confirmation_statement_due": "YYYY-MM-DD or null",
  "last_accounts_date": "YYYY-MM-DD or null",
  "next_accounts_due": "YYYY-MM-DD or null",
  "accounting_reference_date": "string or null",
  "directors": [
    {
      "name": "Full Name",
      "address": "Complete multi-line address",
      "appointment_date": "YYYY-MM-DD",
      "resignation_date": "YYYY-MM-DD or null",
      "status": "active or resigned"
    }
  ],
  "shareholders": [
    {
      "name": "string",
      "share_class": "string",
      "shares_held": number,
      "percentage_held": number,
      "share_type": "ordinary/preference/other",
      "nominal_value": number
    }
  ],
  "company_name_changes": [
    {
      "previous_name": "string",
      "new_name": "string",
      "change_date": "YYYY-MM-DD"
    }
  ]
}

⚠️ CRITICAL: The "directors" array MUST contain data if the company exists. Do NOT return an empty array unless the company truly has no directors listed (which would be highly unusual).

If the company cannot be found, return: {"error": "Company not found"}`;

      const response = await InvokeLLM({
        prompt: prompt,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            company_name: { type: "string" },
            company_number: { type: "string" },
            incorporation_date: { type: "string" },
            registered_office_address: { type: "string" },
            company_status: { type: "string" },
            company_type: { type: "string" },
            last_confirmation_statement_date: { type: ["string", "null"] },
            next_confirmation_statement_due: { type: ["string", "null"] },
            last_accounts_date: { type: ["string", "null"] },
            next_accounts_due: { type: ["string", "null"] },
            accounting_reference_date: { type: ["string", "null"] },
            directors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  address: { type: "string" },
                  appointment_date: { type: "string" },
                  resignation_date: { type: ["string", "null"] },
                  status: { type: "string", enum: ["active", "resigned"] }
                },
                required: ["name", "address", "appointment_date", "status"]
              }
            },
            shareholders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  share_class: { type: "string" },
                  shares_held: { type: "number" },
                  percentage_held: { type: "number" },
                  share_type: { type: "string", enum: ["ordinary", "preference", "other"] },
                  nominal_value: { type: "number" }
                },
                required: ["name", "share_class", "shares_held", "percentage_held", "share_type", "nominal_value"]
              }
            },
            company_name_changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  previous_name: { type: "string" },
                  new_name: { type: "string" },
                  change_date: { type: "string" }
                }
              }
            },
            error: { type: "string" }
          }
        }
      });

      console.log('Companies House API Response:', response);

      if (response.error) {
        setSearchError(response.error);
        return; // Exit early if there's an error
      }

      setCompanyData(response);
      setEditableDirectors(response.directors || []);
      setEditableShareholders((response.shareholders || []).map(s => ({
        ...s,
        email_address: s.email_address || '', // Initialize contact fields
        phone_number: s.phone_number || '',
        address: s.address || ''
      })));
      setCompanyNumber(response.company_number);
      setCompanyName(response.company_name);

      // Debug logging
      console.log('Directors extracted:', response.directors?.length || 0);
      console.log('Shareholders extracted:', response.shareholders?.length || 0);

      // Show warning if no directors found
      if (!response.directors || response.directors.length === 0) {
        console.warn('⚠️ WARNING: No directors were extracted from Companies House. This is unusual and may indicate an extraction issue.');
        setSearchError('Warning: No directors were found. Please manually verify this information on Companies House and add directors manually if needed.');
      }

      // Show warning if no shareholders found (less critical)
      if (!response.shareholders || response.shareholders.length === 0) {
        console.log('ℹ️ INFO: No shareholders/PSC were extracted. This may be normal for some companies (e.g., sole director companies, or complex structures).');
      }

    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search Companies House. Please try again. Error: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  const handlePopulateCase = async () => {
    console.log('=== POPULATE CASE STARTED ===');
    console.log('Case ID:', case_?.id);
    console.log('Company Data:', companyData);
    
    if (!companyData || !case_?.id) {
      console.error('Missing required data:', { 
        hasCompanyData: !!companyData, 
        hasCaseId: !!case_?.id,
        caseObject: case_ 
      });
      alert('Cannot populate case: Missing company data or case ID');
      return;
    }

    try {
      // Ensure directors have all required fields
      const directorsToSave = editableDirectors.map(director => ({
        name: director.name || '',
        address: director.address || '',
        appointment_date: director.appointment_date || null,
        resignation_date: director.resignation_date || null,
        status: director.status || 'active'
      }));

      // Ensure shareholders have all required fields, including new contact info fields
      const shareholdersToSave = editableShareholders.map(shareholder => ({
        name: shareholder.name || '',
        address: shareholder.address || '',
        email_address: shareholder.email_address || '',
        phone_number: shareholder.phone_number || '',
        share_class: shareholder.share_class || '',
        shares_held: shareholder.shares_held || 0,
        percentage_held: shareholder.percentage_held || 0,
        share_type: shareholder.share_type || 'ordinary',
        nominal_value: shareholder.nominal_value || 0
      }));

      const updateData = {
        company_name: companyData.company_name,
        company_number: companyData.company_number,
        incorporation_date: companyData.incorporation_date,
        registered_office_address: companyData.registered_office_address,
        company_status: companyData.company_status,
        company_type: companyData.company_type,
        last_confirmation_statement_date: companyData.last_confirmation_statement_date,
        next_confirmation_statement_due: companyData.next_confirmation_statement_due,
        last_accounts_date: companyData.last_accounts_date,
        next_accounts_due: companyData.next_accounts_due,
        accounting_reference_date: companyData.accounting_reference_date,
        directors: directorsToSave,
        shareholders: shareholdersToSave,
        company_name_changes: companyData.company_name_changes || [],
        companies_house_locked: isLocked
      };

      console.log('Attempting to update case with data:', updateData);
      console.log('Using Case ID:', case_.id);

      const result = await base44.entities.Case.update(case_.id, updateData);
      
      console.log('Update result:', result);
      console.log('=== POPULATE CASE SUCCESS ===');

      if (onUpdate) {
        console.log('Calling onUpdate callback');
        onUpdate();
      }

      setSearchError('');
      alert('Case populated successfully with Companies House data!');
    } catch (error) {
      console.error('=== POPULATE CASE FAILED ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setSearchError('Failed to populate case data. Error: ' + (error.message || 'Unknown error'));
      alert('Failed to save: ' + (error.message || 'Unknown error'));
    }
  };

  const toggleLock = async () => {
    console.log('=== TOGGLE LOCK STARTED ===');
    console.log('Case ID:', case_?.id);
    console.log('Current lock state:', isLocked);
    
    if (!case_?.id) {
      console.error('No case ID available');
      alert('Cannot lock/unlock. Case not loaded.');
      return;
    }

    const newLockedState = !isLocked;
    console.log('New lock state will be:', newLockedState);
    
    try {
      // Prepare all Companies House data to save along with the lock status
      const directorsToSave = editableDirectors.map(director => ({
        name: director.name || '',
        address: director.address || '',
        appointment_date: director.appointment_date || null,
        resignation_date: director.resignation_date || null,
        status: director.status || 'active'
      }));

      const shareholdersToSave = editableShareholders.map(shareholder => ({
        name: shareholder.name || '',
        address: shareholder.address || '',
        email_address: shareholder.email_address || '',
        phone_number: shareholder.phone_number || '',
        share_class: shareholder.share_class || '',
        shares_held: shareholder.shares_held || 0,
        percentage_held: shareholder.percentage_held || 0,
        share_type: shareholder.share_type || 'ordinary',
        nominal_value: shareholder.nominal_value || 0
      }));

      // Build update data - only include Companies House fields if we have company data
      const updateData = {
        companies_house_locked: newLockedState
      };

      // If we have company data, include all Companies House fields in the save
      if (companyData) {
        Object.assign(updateData, {
          company_name: companyData.company_name,
          company_number: companyData.company_number,
          incorporation_date: companyData.incorporation_date,
          registered_office_address: companyData.registered_office_address,
          company_status: companyData.company_status,
          company_type: companyData.company_type,
          last_confirmation_statement_date: companyData.last_confirmation_statement_date,
          next_confirmation_statement_due: companyData.next_confirmation_statement_due,
          last_accounts_date: companyData.last_accounts_date,
          next_accounts_due: companyData.next_accounts_due,
          accounting_reference_date: companyData.accounting_reference_date,
          directors: directorsToSave,
          shareholders: shareholdersToSave,
          company_name_changes: companyData.company_name_changes || []
        });
      } else {
        // If no companyData from a search, still save the manually edited directors/shareholders
        // and current company number/name if available in state.
        Object.assign(updateData, {
          company_name: companyName,
          company_number: companyNumber,
          directors: directorsToSave,
          shareholders: shareholdersToSave,
          company_name_changes: case_?.company_name_changes || []
        });
      }

      console.log('Attempting to update case with lock data:', updateData);
      
      // Save to database
      const result = await base44.entities.Case.update(case_.id, updateData);
      
      console.log('Lock update result:', result);
      console.log('=== TOGGLE LOCK SUCCESS ===');

      // Update local state
      setIsLocked(newLockedState);

      // Notify parent to refresh
      if (onUpdate) {
        console.log('Calling onUpdate callback');
        onUpdate();
      }

      console.log(`Companies House data ${newLockedState ? 'locked' : 'unlocked'} and saved successfully`);
    } catch (error) {
      console.error('=== TOGGLE LOCK FAILED ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      alert('Failed to save lock status. Error: ' + (error.message || 'Unknown error'));
    }
  };

  const openCompaniesHouse = () => {
    if (companyNumber) {
      const formattedNumber = companyNumber.replace(/\s/g, '').padStart(8, '0');
      window.open(
        `https://find-and-update.company-information.service.gov.uk/company/${formattedNumber}`, 
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  const calculateShareholderEquity = () => {
    if (!editableShareholders || editableShareholders.length === 0) return 0;
    
    return editableShareholders.reduce((total, shareholder) => {
      const sharesValue = (shareholder.shares_held || 0) * (shareholder.nominal_value || 0) / 100;
      return total + sharesValue;
    }, 0);
  };

  const handleAddDirector = () => {
    setEditableDirectors([...editableDirectors, {
      name: '',
      address: '',
      appointment_date: '',
      resignation_date: null,
      status: 'active'
    }]);
  };

  const handleUpdateDirector = (index, field, value) => {
    const updated = [...editableDirectors];
    updated[index] = { ...updated[index], [field]: value };
    setEditableDirectors(updated);
  };

  const handleRemoveDirector = (index) => {
    const updated = editableDirectors.filter((_, idx) => idx !== index);
    setEditableDirectors(updated);
  };

  const handleSaveDirectors = async () => {
    if (!case_?.id) {
      alert('Cannot save. Case not loaded.');
      return;
    }
    
    try {
      // Ensure directors have all required fields and clean up any empty entries
      const directorsToSave = editableDirectors
        .filter(director => director.name && director.name.trim() !== '') // Only save directors with names
        .map(director => ({
          name: director.name || '',
          address: director.address || '',
          appointment_date: director.appointment_date || null,
          resignation_date: director.resignation_date || null,
          status: director.status || 'active'
        }));

      await base44.entities.Case.update(case_.id, { directors: directorsToSave });
      
      // Trigger parent update to refresh the case data
      if (onUpdate) {
        await onUpdate();
      }
      
      setIsEditingDirectors(false);
      alert('Directors saved successfully.');
    } catch (error) {
      console.error('Failed to save directors:', error);
      alert('Failed to save directors: ' + (error.message || 'Unknown error'));
    }
  };

  const handleAddShareholder = () => {
    setEditableShareholders([...editableShareholders, {
      name: '',
      share_class: 'Ordinary',
      shares_held: 0,
      percentage_held: 0,
      share_type: 'ordinary',
      nominal_value: 100,
      email_address: '',
      phone_number: '',
      address: ''
    }]);
  };

  const handleUpdateShareholder = (index, field, value) => {
    const updated = [...editableShareholders];
    updated[index] = { ...updated[index], [field]: value };
    setEditableShareholders(updated);
  };

  const handleRemoveShareholder = (index) => {
    const updated = editableShareholders.filter((_, idx) => idx !== index);
    setEditableShareholders(updated);
  };

  const handleSaveShareholders = async () => {
    if (!case_?.id) {
      alert('Cannot save. Case not loaded.');
      return;
    }
    
    try {
      // Ensure shareholders have all required fields and clean up any empty entries
      const shareholdersToSave = editableShareholders
        .filter(shareholder => shareholder.name && shareholder.name.trim() !== '') // Only save shareholders with names
        .map(shareholder => ({
          name: shareholder.name || '',
          address: shareholder.address || '',
          email_address: shareholder.email_address || '',
          phone_number: shareholder.phone_number || '',
          share_class: shareholder.share_class || '',
          shares_held: shareholder.shares_held || 0,
          percentage_held: shareholder.percentage_held || 0,
          share_type: shareholder.share_type || 'ordinary',
          nominal_value: shareholder.nominal_value || 0
        }));

      await base44.entities.Case.update(case_.id, { shareholders: shareholdersToSave });
      
      // Trigger parent update to refresh the case data
      if (onUpdate) {
        await onUpdate();
      }
      
      setIsEditingShareholders(false);
      alert('Shareholders saved successfully.');
    } catch (error) {
      console.error('Failed to save shareholders:', error);
      alert('Failed to save shareholders: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar Menu */}
      <div className="w-64 flex-shrink-0 border-r bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Building className="w-5 h-5 text-blue-600" />
          Companies House
        </h3>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveSection('overview')}
            className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors border ${
              activeSection === 'overview'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Company Overview
            </div>
          </button>
          <button
            onClick={() => setActiveSection('directors')}
            className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors border ${
              activeSection === 'directors'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Directors
            </div>
          </button>
          <button
            onClick={() => setActiveSection('shareholders')}
            className={`w-full text-left px-4 py-3 text-sm font-medium rounded-lg transition-colors border ${
              activeSection === 'shareholders'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'text-slate-700 hover:bg-slate-100 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <Users2 className="w-4 h-4" />
              Shareholders
            </div>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Company Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-4">
            {/* Search Section */}
            <Card className="border-blue-200 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 py-3">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                  <Search className="w-4 h-4" />
                  Companies House Search
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="company_number" className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Company Number
                    </Label>
                    <Input
                      id="company_number"
                      value={companyNumber}
                      onChange={(e) => setCompanyNumber(e.target.value)}
                      placeholder="e.g., 08540644"
                      disabled={isLocked}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company_name" className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Company Name
                    </Label>
                    <Input
                      id="company_name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g., Parker Getty Ltd"
                      disabled={isLocked}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>

                {searchError && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription className="text-sm">{searchError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    onClick={handleSearch}
                    disabled={isSearching || isLocked || (!companyNumber && !companyName)}
                    className="bg-blue-600 hover:bg-blue-700 h-9 px-4 text-sm"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-3.5 h-3.5 mr-1.5" />
                        Search
                      </>
                    )}
                  </Button>

                  {companyNumber && (
                    <Button
                      onClick={openCompaniesHouse}
                      variant="outline"
                      className="text-blue-600 border-blue-300 hover:bg-blue-50 h-9 px-3 text-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      View Online
                    </Button>
                  )}

                  {companyData && (
                    <>
                      <Button
                        onClick={handlePopulateCase}
                        disabled={isLocked}
                        className="bg-green-600 hover:bg-green-700 text-white h-9 px-4 text-sm"
                      >
                        <Building className="w-3.5 h-3.5 mr-1.5" />
                        Populate Case
                      </Button>

                      <div className="flex-1" />

                      <Button
                        onClick={toggleLock}
                        variant="outline"
                        size="sm"
                        className={`h-9 px-3 text-sm ${isLocked ? 'text-red-600 border-red-300 hover:bg-red-50' : 'text-slate-600 border-slate-300'}`}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-3.5 h-3.5 mr-1.5" />
                            Locked
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5 mr-1.5" />
                            Unlocked
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={handleSearch}
                        variant="outline"
                        size="sm"
                        disabled={isSearching || isLocked}
                        className="h-9 w-9 p-0"
                        title="Refresh data"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Company Information Display */}
            {companyData ? (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 py-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
                    <Building className="w-4 h-4" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Company Name</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.company_name || '—'}</p>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Company Number</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.company_number || '—'}</p>
                    </div>
                    
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Company Status</Label>
                      {companyData.company_status ? (
                        <Badge 
                          className={`mt-1 text-xs ${
                            companyData.company_status.toLowerCase().includes('active') 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-slate-100 text-slate-800 border-slate-300'
                          }`}
                        >
                          {companyData.company_status}
                        </Badge>
                      ) : (
                        <p className="text-sm font-medium text-slate-900">—</p>
                      )}
                    </div>
                    
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Company Type</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.company_type || '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Date of Incorporation</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.incorporation_date ? new Date(companyData.incorporation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Accounting Reference Date</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.accounting_reference_date || '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Last Confirmation Statement</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.last_confirmation_statement_date ? new Date(companyData.last_confirmation_statement_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Next Confirmation Statement Due</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.next_confirmation_statement_due ? new Date(companyData.next_confirmation_statement_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Last Accounts Filed</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.last_accounts_date ? new Date(companyData.last_accounts_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Next Accounts Due</Label>
                      <p className="text-sm font-medium text-slate-900">{companyData.next_accounts_due ? new Date(companyData.next_accounts_due).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-xs font-semibold text-slate-700 mb-1 block">Registered Office Address</Label>
                      <p className="text-sm font-medium text-slate-900 whitespace-pre-line">{companyData.registered_office_address || '—'}</p>
                    </div>

                    {companyData.company_name_changes && companyData.company_name_changes.length > 0 && (
                      <div className="md:col-span-2">
                        <Label className="text-xs font-semibold text-slate-700 mb-2 block">Previous Company Names</Label>
                        <div className="space-y-2">
                          {companyData.company_name_changes.map((change, idx) => (
                            <div key={idx} className="text-sm bg-amber-50 border border-amber-200 rounded p-2">
                              <p className="font-medium text-slate-900">
                                {change.previous_name} → {change.new_name}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                Changed on: {change.change_date ? new Date(change.change_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-blue-200 shadow-sm">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 py-3">
                  <CardTitle className="text-base text-blue-900 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 pb-4">
                  <div className="text-center py-12">
                    <Building className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-slate-600 mb-1">No Company Data</h3>
                    <p className="text-xs text-slate-500">Search for a company above to view details</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Directors Section */}
        {activeSection === 'directors' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-blue-900 text-base">
                  <User className="w-4 h-4" />
                  Directors & Officers
                </CardTitle>
                {!isEditingDirectors && (
                  <Button
                    onClick={() => setIsEditingDirectors(true)}
                    variant="outline"
                    size="sm"
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Directors
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              {editableDirectors && editableDirectors.length > 0 ? (
                <div className="space-y-3">
                  {editableDirectors.map((director, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      {isEditingDirectors ? (
                        /* Edit Mode */
                        <div className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
                            <div className="flex-1">
                              <Label className="text-xs font-semibold text-slate-700 mb-1 block">Director Name</Label>
                              <Input
                                value={director.name || ''}
                                onChange={(e) => handleUpdateDirector(idx, 'name', e.target.value)}
                                placeholder="Full name"
                                className="h-8 text-sm font-medium"
                              />
                            </div>
                            <Button
                              onClick={() => handleRemoveDirector(idx)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 mt-4"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">Appointment Date</Label>
                              <Input
                                type="date"
                                value={director.appointment_date || ''}
                                onChange={(e) => handleUpdateDirector(idx, 'appointment_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">Resignation Date</Label>
                              <Input
                                type="date"
                                value={director.resignation_date || ''}
                                onChange={(e) => handleUpdateDirector(idx, 'resignation_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>

                            <div>
                              <Label className="text-xs text-slate-600 mb-1 block">Status</Label>
                              <Select
                                value={director.status || 'active'}
                                onValueChange={(value) => handleUpdateDirector(idx, 'status', value)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="resigned">Resigned</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-slate-600 mb-1 block">Address</Label>
                            <Textarea
                              value={director.address || ''}
                              onChange={(e) => handleUpdateDirector(idx, 'address', e.target.value)}
                              placeholder="Full correspondence address"
                              className="min-h-[60px] text-sm resize-none"
                            />
                          </div>
                        </div>
                      ) : (
                        /* View Mode - Compact */
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <p className="text-sm font-bold text-slate-900">{director.name || 'Unnamed Director'}</p>
                                <Badge className={`text-xs px-2 py-0.5 ${
                                  director.status === 'active' 
                                    ? 'bg-green-100 text-green-800 border-green-200' 
                                    : 'bg-slate-100 text-slate-800 border-slate-200'
                                }`}>
                                  {director.status === 'active' ? 'Active' : 'Resigned'}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-600">
                                {director.appointment_date && (
                                  <span>
                                    Appointed: {new Date(director.appointment_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                                {director.resignation_date && (
                                  <span className="border-l border-slate-300 pl-3">
                                    Resigned: {new Date(director.resignation_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>

                              {director.address && (
                                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{director.address}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {isEditingDirectors && (
                    <div className="flex justify-between items-center pt-2">
                      <Button
                        onClick={handleAddDirector}
                        variant="outline"
                        size="sm"
                        className="text-blue-700 border-blue-300 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Director
                      </Button>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setIsEditingDirectors(false);
                            // Revert changes if cancelled:
                            const originalDirectors = case_?.directors || companyData?.directors || [];
                            setEditableDirectors(originalDirectors);
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveDirectors}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Directors
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : isEditingDirectors ? (
                <div className="text-center py-8 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No directors found</p>
                  <Button
                    onClick={handleAddDirector}
                    variant="outline"
                    size="sm"
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Director
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Shareholders Section */}
        {activeSection === 'shareholders' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-purple-100 border-b border-purple-200 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-purple-900 text-base">
                  <Users2 className="w-4 h-4" />
                  Shareholders & Persons with Significant Control
                </CardTitle>
                {!isEditingShareholders && (
                  <Button
                    onClick={() => setIsEditingShareholders(true)}
                    variant="outline"
                    size="sm"
                    className="text-purple-700 border-purple-300 hover:bg-purple-50"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Shareholders
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              {editableShareholders && editableShareholders.length > 0 ? (
                <div className="space-y-4">
                  {/* Total Equity Summary */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Total Shareholder Equity</p>
                        <p className="text-xl font-bold text-purple-900 mt-0.5">
                          £{calculateShareholderEquity().toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-slate-600">Total Shareholders</p>
                        <p className="text-lg font-bold text-slate-800 mt-0.5">{editableShareholders.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shareholders List */}
                  <div className="space-y-3">
                    {editableShareholders.map((shareholder, idx) => {
                      const shareholderValue = ((shareholder.shares_held || 0) * (shareholder.nominal_value || 0)) / 100;
                      
                      return (
                        <div key={idx} className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                          {isEditingShareholders ? (
                            <div className="p-3 space-y-3">
                              {/* Edit Mode - Header with Name and Remove Button */}
                              <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-200">
                                <div className="flex-1">
                                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">Shareholder Name</Label>
                                  <Input
                                    value={shareholder.name || ''}
                                    onChange={(e) => handleUpdateShareholder(idx, 'name', e.target.value)}
                                    placeholder="Full name"
                                    className="h-8 text-sm font-medium"
                                  />
                                </div>
                                <Button
                                  onClick={() => handleRemoveShareholder(idx)}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0 mt-4"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>

                              {/* Contact Information */}
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                <p className="text-xs font-semibold text-slate-700 mb-2">Contact Information</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Email Address</Label>
                                    <Input
                                      type="email"
                                      value={shareholder.email_address || ''}
                                      onChange={(e) => handleUpdateShareholder(idx, 'email_address', e.target.value)}
                                      placeholder="email@example.com"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Phone Number</Label>
                                    <Input
                                      value={shareholder.phone_number || ''}
                                      onChange={(e) => handleUpdateShareholder(idx, 'phone_number', e.target.value)}
                                      placeholder="Phone number"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <Label className="text-xs text-slate-600 mb-1 block">Address</Label>
                                  <Textarea
                                    value={shareholder.address || ''}
                                    onChange={(e) => handleUpdateShareholder(idx, 'address', e.target.value)}
                                    placeholder="Full address"
                                    className="text-sm min-h-[60px]"
                                  />
                                </div>
                              </div>

                              {/* Share Details */}
                              <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                <p className="text-xs font-semibold text-purple-700 mb-2">Share Details</p>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Share Class</Label>
                                    <Input
                                      value={shareholder.share_class || ''}
                                      onChange={(e) => handleUpdateShareholder(idx, 'share_class', e.target.value)}
                                      placeholder="Ordinary"
                                      className="h-8 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Type</Label>
                                    <Select
                                      value={shareholder.share_type || 'ordinary'}
                                      onValueChange={(value) => handleUpdateShareholder(idx, 'share_type', value)}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="ordinary">Ordinary</SelectItem>
                                        <SelectItem value="preference">Preference</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Shares Held</Label>
                                    <Input
                                      type="number"
                                      value={shareholder.shares_held || 0}
                                      onChange={(e) => handleUpdateShareholder(idx, 'shares_held', parseFloat(e.target.value) || 0)}
                                      className="h-8 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">% Held</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={shareholder.percentage_held || 0}
                                      onChange={(e) => handleUpdateShareholder(idx, 'percentage_held', parseFloat(e.target.value) || 0)}
                                      className="h-8 text-sm"
                                    />
                                  </div>

                                  <div>
                                    <Label className="text-xs text-slate-600 mb-1 block">Nominal (p)</Label>
                                    <Input
                                      type="number"
                                      value={shareholder.nominal_value || 0}
                                      onChange={(e) => handleUpdateShareholder(idx, 'nominal_value', parseFloat(e.target.value) || 0)}
                                      placeholder="100"
                                      className="h-8 text-sm"
                                    />
                                  </div>
                                </div>
                                <div className="mt-2 bg-white p-2 rounded border border-purple-300">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-purple-700">Total Value</Label>
                                    <p className="text-sm font-bold text-purple-900">£{shareholderValue.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* View Mode - Compact Single Row */
                            <div className="p-3">
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                {/* Name and Value */}
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className="flex-shrink-0">
                                    <p className="text-sm font-bold text-slate-900">{shareholder.name || 'Unnamed Shareholder'}</p>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                      {shareholder.share_class || 'N/A'} • {(shareholder.shares_held || 0).toLocaleString()} shares • {(shareholder.percentage_held || 0).toFixed(2)}%
                                    </p>
                                  </div>
                                  
                                  <div className="border-l border-slate-300 pl-4 flex-shrink-0">
                                    <p className="text-xs text-slate-600">Total Value</p>
                                    <p className="text-sm font-bold text-purple-900">£{shareholderValue.toFixed(2)}</p>
                                  </div>

                                  {/* Contact Info */}
                                  {(shareholder.email_address || shareholder.phone_number) && (
                                    <div className="border-l border-slate-300 pl-4 flex-shrink-0">
                                      {shareholder.email_address && (
                                        <p className="text-xs text-slate-700">{shareholder.email_address}</p>
                                      )}
                                      {shareholder.phone_number && (
                                        <p className="text-xs text-slate-700 mt-0.5">{shareholder.phone_number}</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Address */}
                                  {shareholder.address && (
                                    <div className="border-l border-slate-300 pl-4 flex-1 min-w-0">
                                      <p className="text-xs text-slate-600 truncate">{shareholder.address}</p>
                                    </div>
                                  )}
                                </div>

                                {/* Share Details */}
                                <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                                  <div className="text-center px-2">
                                    <p className="text-slate-600">Type</p>
                                    <p className="font-semibold text-slate-900 capitalize">{shareholder.share_type || 'ordinary'}</p>
                                  </div>
                                  <div className="text-center px-2 border-l border-slate-300">
                                    <p className="text-slate-600">Nominal Value</p>
                                    <p className="font-semibold text-slate-900">{shareholder.nominal_value || 0}p</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Action Buttons */}
                  {isEditingShareholders && (
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
                      <Button
                        onClick={handleAddShareholder}
                        variant="outline"
                        size="sm"
                        className="text-purple-700 border-purple-300 hover:bg-purple-50 h-8 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Add Shareholder
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            setIsEditingShareholders(false);
                            const originalShareholders = (case_?.shareholders || companyData?.shareholders || []).map(s => ({
                                ...s,
                                email_address: s.email_address || '',
                                phone_number: s.phone_number || '',
                                address: s.address || ''
                            }));
                            setEditableShareholders(originalShareholders);
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveShareholders}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 h-8 text-xs"
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-4">No shareholders found</p>
                  {isEditingShareholders && (
                    <Button
                      onClick={handleAddShareholder}
                      variant="outline"
                      size="sm"
                      className="text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Shareholder
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}