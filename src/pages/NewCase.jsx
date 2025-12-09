
import React, { useState, useEffect } from "react";
import { Case } from "@/api/entities";
import { User } from "@/api/entities";
import { DiaryTemplate } from '@/api/entities'; // New import
import { CaseDiaryEntry } from '@/api/entities'; // New import
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { InvokeLLM } from "@/api/integrations";

export default function NewCase() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingCompanyData, setIsFetchingCompanyData] = useState(false);
  const [companyFetchError, setCompanyFetchError] = useState(null);
  const [companyDataFetched, setCompanyDataFetched] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    company_name: "",
    company_number: "",
    case_type: "",
    case_reference: "",
    // Hidden fields that will be populated from Companies House
    incorporation_date: "",
    registered_office_address: "",
    directors: [],
    shareholders: [],
    company_name_changes: [], // Added company_name_changes field
    // Default values
    appointment_date: "",
    administrator_name: "",
    assigned_user: "",
    status: "active"
  });

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const userData = await User.me().catch(() => null);
      setCurrentUser(userData);
      if (userData) {
        setFormData(prev => ({ 
          ...prev, 
          assigned_user: userData.email,
          administrator_name: userData.full_name || ""
        }));
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Reset company data validation when company name or number changes
    if (field === 'company_name' || field === 'company_number') {
      setCompanyDataFetched(false);
      setCompanyFetchError(null);
    }
  };

  const handleFetchCompanyData = async () => {
    if (!formData.company_number || !formData.company_name) {
      setCompanyFetchError("Please enter both company name and company number first.");
      return;
    }

    setIsFetchingCompanyData(true);
    setCompanyFetchError(null);
    setCompanyDataFetched(false);

    try {
      const result = await InvokeLLM({
        prompt: `Verify and fetch detailed information for the UK company with number ${formData.company_number} and name "${formData.company_name}". Please confirm if the company name matches the official company name registered with Companies House, and provide:
        1. Official company name (exactly as registered)
        2. Registered office address
        3. Date of incorporation (in YYYY-MM-DD format)
        4. List of all directors who have held office in the last 3 years, including their appointment dates and resignation dates (if applicable)
        5. List of shareholders and their shareholdings, including share class, number of shares held, and percentage ownership
        6. List of any company name changes in the last 3 years, including previous name, new name, and date of change
        
        If the company name provided does not match the official registered name, please indicate this in the response.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            name_matches: { type: "boolean", description: "Whether the provided company name matches the official registered name" },
            official_company_name: { type: "string", description: "The official company name as registered with Companies House" },
            registered_office_address: { type: "string" },
            incorporation_date: { type: "string", description: "The date in YYYY-MM-DD format." },
            directors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  appointment_date: { type: "string", description: "Date in YYYY-MM-DD format" },
                  resignation_date: { type: "string", description: "Date in YYYY-MM-DD format, null if still active" },
                  status: { type: "string", enum: ["active", "resigned"] }
                },
                required: ["name", "appointment_date", "status"]
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
                  share_type: { type: "string", enum: ["ordinary", "preference", "other"] }
                },
                required: ["name", "shares_held", "share_type"]
              }
            },
            company_name_changes: { // Added company_name_changes to schema
              type: "array",
              items: {
                type: "object",
                properties: {
                  previous_name: { type: "string" },
                  new_name: { type: "string" },
                  change_date: { type: "string", description: "Date in YYYY-MM-DD format" }
                },
                required: ["previous_name", "new_name", "change_date"]
              }
            }
          },
          required: ["name_matches", "official_company_name", "registered_office_address", "incorporation_date", "directors", "shareholders", "company_name_changes"] // Added to required
        }
      });

      if (result && result.official_company_name && result.registered_office_address && result.incorporation_date) {
        // Update form data with fetched information
        setFormData(prev => ({
          ...prev,
          company_name: result.official_company_name, // Update to official name
          incorporation_date: result.incorporation_date,
          registered_office_address: result.registered_office_address,
          directors: result.directors || [],
          shareholders: result.shareholders || [],
          company_name_changes: result.company_name_changes || [] // Assign fetched data
        }));

        if (!result.name_matches) {
          setCompanyFetchError(`Company name updated to official registered name: "${result.official_company_name}"`);
        }

        setCompanyDataFetched(true);
      } else {
        setCompanyFetchError("Could not retrieve complete company information. Please check the company number and name.");
      }
    } catch (error) {
      console.error("Error fetching company data:", error);
      setCompanyFetchError("Failed to fetch company data. The service might be unavailable.");
    }
    
    setIsFetchingCompanyData(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!companyDataFetched) {
      setCompanyFetchError("Please verify company details with Companies House before creating the case.");
      return;
    }

    setIsSubmitting(true);

    try {
      const caseData = {
        ...formData,
        appointment_date: new Date().toISOString().split('T')[0], // Set to today
        tasks_completed: [],
        case_strategy_note: "",
        review_1_month_note: "",
        review_6_month_note: "",
        additional_reviews: [],
        case_notes: ""
      };

      // Create the case and capture the returned case object
      const newCase = await Case.create(caseData);

      // Auto-populate diary entries from template for CVL cases
      if (formData.case_type === 'CVL') {
        try {
          // Find the default CVL diary template
          const allTemplates = await DiaryTemplate.list();
          const defaultTemplate = allTemplates.find(
            t => t.case_type === 'CVL' && t.is_default === true
          );

          if (defaultTemplate && defaultTemplate.diary_entries && Array.isArray(defaultTemplate.diary_entries)) {
            // Create a CaseDiaryEntry for each entry in the template
            const diaryEntriesToCreate = defaultTemplate.diary_entries.map(entry => ({
              case_id: newCase.id, // Assign the ID of the newly created case
              entry_id: entry.id,
              category: entry.category,
              title: entry.title,
              description: entry.description || '',
              reference_point: entry.reference_point,
              time_offset: entry.time,
              deadline_date: null, // Will be calculated once reference dates are set
              status: 'pending',
              notes: '',
              order: entry.order || 0
            }));

            // Bulk create all diary entries
            await CaseDiaryEntry.bulkCreate(diaryEntriesToCreate);
            console.log(`Created ${diaryEntriesToCreate.length} diary entries for CVL case ${newCase.id}`);
          } else {
            console.warn('No default CVL diary template found or template has no entries.');
          }
        } catch (diaryError) {
          console.error('Failed to create diary entries for CVL case:', diaryError);
          // Don't fail the case creation if diary creation fails, just log the error.
        }
      }

      alert('Case created successfully!');
      window.location.href = createPageUrl('MyCases'); // Redirect to MyCases as per outline

    } catch (error) {
      console.error("Error creating case:", error);
      alert('Failed to create case. Please try again.'); // Show error alert
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-display font-bold text-2xl text-slate-900">Create New Case</h1>
            <p className="text-slate-600">Enter the basic details for the new insolvency case.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-lg border-0 bg-white rounded-2xl">
            <CardHeader className="pb-6">
              <CardTitle className="font-display font-bold text-xl text-slate-900 flex items-center gap-3">
                <Building className="w-6 h-6 text-blue-700" />
                Case Information
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="company_name" className="font-medium text-slate-700">
                      Company Name *
                    </Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => handleInputChange("company_name", e.target.value)}
                      placeholder="Enter company name"
                      className="bg-white border-slate-300"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company_number" className="font-medium text-slate-700">
                      Company Number *
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="company_number"
                        value={formData.company_number}
                        onChange={(e) => handleInputChange("company_number", e.target.value)}
                        placeholder="e.g. 12345678"
                        className="bg-white border-slate-300"
                        required
                      />
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={handleFetchCompanyData} 
                        disabled={isFetchingCompanyData || !formData.company_name || !formData.company_number}
                        className="flex items-center gap-2 whitespace-nowrap"
                      >
                        <RefreshCw className={`w-4 h-4 ${isFetchingCompanyData ? 'animate-spin' : ''}`} />
                        {isFetchingCompanyData ? 'Verifying...' : 'Verify'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Company verification status */}
                {companyFetchError && (
                  <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                    companyDataFetched ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {companyFetchError}
                  </div>
                )}

                {companyDataFetched && !companyFetchError && (
                  <div className="p-3 rounded-lg border bg-green-50 border-green-200 text-green-700 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    Company details verified with Companies House
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="case_type" className="font-medium text-slate-700">
                      Case Type *
                    </Label>
                    <Select
                      value={formData.case_type}
                      onValueChange={(value) => handleInputChange("case_type", value)}
                    >
                      <SelectTrigger className="bg-white border-slate-300">
                        <SelectValue placeholder="Select case type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Administration">Administration</SelectItem>
                        <SelectItem value="CVL">CVL</SelectItem>
                        <SelectItem value="MVL">MVL</SelectItem>
                        <SelectItem value="CWU">CWU</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="case_reference" className="font-medium text-slate-700">
                      Case Reference *
                    </Label>
                    <Input
                      id="case_reference"
                      value={formData.case_reference}
                      onChange={(e) => handleInputChange("case_reference", e.target.value)}
                      placeholder="e.g. CVL-2024-001"
                      className="bg-white border-slate-300"
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(createPageUrl("Dashboard"))}
                    className="border-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !companyDataFetched}
                    className="bg-blue-700 hover:bg-blue-800 shadow-lg shadow-blue-500/30 font-semibold"
                  >
                    {isSubmitting ? "Creating..." : "Create Case"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
