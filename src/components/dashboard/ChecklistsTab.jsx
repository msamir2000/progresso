import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckSquare, Shield, FileCheck, ClipboardCheck, ChevronDown, Upload, Loader2, FileDown, Check, AlertCircle, Plus, Trash2, FileText, X, Building } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
// Removed: import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// Custom Signature Canvas Component
const SignatureCanvasComponent = ({ onSave, onCancel }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || e.touches[0].clientX;
    const clientY = e.clientY || e.touches[0].clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    } else {
        alert('Please provide a signature.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-slate-300 rounded-lg bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair w-full"
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={clearCanvas}>
          Clear
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={saveSignature} disabled={!hasDrawn} className="bg-blue-600 hover:bg-blue-700">
          Save Signature
        </Button>
      </div>
    </div>
  );
};


export default function ChecklistsTab({ caseData: propCaseData, onUpdate }) {
  const [activeSection, setActiveSection] = useState('pre_appointment');
  const [activeSubSection, setActiveSubSection] = useState('company_information');
  const [isAmlExpanded, setIsAmlExpanded] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isUploadingSnapshot, setIsUploadingSnapshot] = useState(false);
  const [isUploadingGroupChart, setIsUploadingGroupChart] = useState(false);
  // New states for GDPR file uploads
  const [isUploadingGDPRICO, setIsUploadingGDPRICO] = useState(false);
  const [isUploadingGDPRRiskAssessment, setIsUploadingGDPRRiskAssessment] = useState(false);
  
  // States for Signature Dialog
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [currentSignatureField, setCurrentSignatureField] = useState(null);
  // Removed: const sigCanvas = useRef(null);

  // Use local state that syncs with prop to ensure fresh data is always displayed
  const [caseData, setCaseData] = useState(propCaseData);

  const saveTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const caseIdRef = useRef(null);
  const isLoadingFromDbRef = useRef(false);

  const [formData, setFormData] = useState({
    appointment_takers: '',
    appointment_type: '',
    company_name: '',
    former_name: '',
    company_number: '',
    registered_address: '',
    principal_trading_address: '',
    principal_activity: '',
    date_of_incorporation: '',
    date_ceasing_trade: '',
    geographical_extent: '',
    introducer: '',
    controlling_interest_companies: '',
    other_group_companies: '',
    company_snapshot_url: '',
    group_structure_chart_url: '',
    // Ethical Review fields (Updated keys to match case_ fields)
    ethical_advisory_position: '',
    ethical_advisory_insolvency_options: false,
    ethical_advisory_conveying_meeting: false,
    ethical_advisory_preparing_soa: false,
    ethical_advisory_general_meeting: false,
    ethical_advisory_details: '',
    ethical_strategic_advice_changed: '',
    ethical_strategic_advice_details: '',
    ethical_conflict_company_search: false,
    ethical_conflict_personal_relationships: false,
    ethical_conflict_directors_alerted: false,
    ethical_conflict_client_database: false,
    ethical_facts: '',
    ethical_communications: '',
    ethical_considerations: '',
    ethical_fees_pre: '',
    ethical_fees_post: '',
    ethical_threat_integrity: false,
    ethical_threat_objectivity: false,
    ethical_threat_complexities: false,
    ethical_threat_confidentiality: false,
    ethical_threat_compliance: false,
    ethical_no_threats_identified: false,
    ethical_threats_details: '',
    ethical_safeguards: '',
    ethical_acceptance: '',
    ethical_adequate_resources: '',
    ethical_resources_details: '',
    // Bribery Act fields
    bribery_overseas_risk: '',
    bribery_overseas_details: '',
    bribery_regular_contact: '',
    bribery_regular_contact_details: '',
    bribery_introducer_payment: '',
    bribery_introducer_payment_details: '',
    bribery_individuals_payment: '',
    bribery_individuals_payment_details: '',
    bribery_unusual_circumstances: '',
    bribery_unusual_details: '',
    bribery_peps_involved: '',
    bribery_peps_details: '',
    bribery_risk_level: '',
    bribery_risk_notes: '',
    // GDPR fields
    gdpr_ico_registered: '',
    gdpr_ico_search_results: '',
    gdpr_ico_upload_url: '',
    gdpr_directors_confirmed: '',
    gdpr_directors_confirmation_details: '',
    gdpr_trading_continue: '',
    gdpr_data_transfer_sale: '',
    gdpr_special_category_data: '',
    gdpr_processes_in_place: '',
    gdpr_data_required_insolvency: '',
    gdpr_byod_policy: '',
    gdpr_data_uk_eu: '',
    gdpr_issues_identified: '',
    gdpr_risk_assessment_url: '',
    gdpr_strategy_notes: '',
    // AML KYC fields
    aml_psc_discrepancy_noted: false,
    aml_psc_discrepancy_details: '',
    aml_directors: [],
    aml_shareholders: [],
    aml_additional_notes: '',
    // AML Risk Assessment fields
    aml_risk_cash_business: '',
    aml_risk_cash_business_narrative: '',
    aml_risk_criminal_investigation: '',
    aml_risk_criminal_investigation_narrative: '',
    aml_risk_relevant_person: '',
    aml_risk_relevant_person_narrative: '',
    aml_risk_pep: '',
    aml_risk_pep_narrative: '',
    aml_risk_accounts_match: '',
    aml_risk_accounts_match_narrative: '',
    aml_risk_complex_ownership: '',
    aml_risk_complex_ownership_narrative: '',
    aml_risk_known_introduction: '',
    aml_risk_known_introduction_narrative: '',
    aml_risk_no_asset_company: '',
    aml_risk_no_asset_company_narrative: '',
    aml_risk_regulated_sector: '',
    aml_risk_regulated_sector_narrative: '',
    aml_risk_distribution_anticipated: '',
    aml_risk_distribution_narrative: '',
    aml_risk_significant_fees: '',
    aml_risk_significant_fees_narrative: '',
    aml_risk_high_value_assets: '',
    aml_risk_high_value_assets_narrative: '',
    aml_risk_high_risk_country: '',
    aml_risk_high_risk_country_narrative: '',
    aml_risk_de_jure_director: '',
    aml_risk_de_jure_director_narrative: '',
    aml_risk_non_face_to_face: '',
    aml_risk_non_face_to_face_narrative: '',
    aml_risk_identity_verification: '',
    aml_risk_identity_verification_narrative: '',
    aml_risk_ofsi_check_completed: '',
    aml_risk_ofsi_check_narrative: '',
    aml_risk_ofsi_concerns: '',
    aml_risk_ofsi_concerns_narrative: '',
    aml_risk_assessment_level: '',
    // Client Verification fields
    aml_cdd_verification_obtained: '',
    aml_cdd_verification_notes: '',
    // Declaration fields (Updated keys to match outline)
    declaration_reviewed_by_name: '',
    declaration_reviewed_by_signature: '',
    declaration_reviewed_by_date: '',
    declaration_pre_appointment_signed: '',
    declaration_pre_appointment_name: '',
    declaration_pre_appointment_date: '',
    declaration_ethical_guidelines: false,
    declaration_qualified_ip: false,
    declaration_checks_completed: false,
    declaration_internal_authorisation: false, // Renamed from declaration_internal_auth
    declaration_office_holder_signed: '',
    declaration_office_holder_name: '',
    declaration_office_holder_date: '',
    declaration_issues: [], // Changed to array for dynamic issues
    declaration_review_month1_issues: '',
    declaration_review_month1_reviewed_by: '', // Renamed from signature/completed
    declaration_review_yr1_issues: '',
    declaration_review_yr1_reviewed_by: '', // Renamed from signature/completed
    declaration_review_yr2_issues: '',
    declaration_review_yr2_reviewed_by: '', // Renamed from signature/completed
    declaration_review_yr3_issues: '',
    declaration_review_yr3_reviewed_by: '', // Renamed from signature/completed
  });

  // Sync with parent's caseData whenever it changes
  useEffect(() => {
    setCaseData(propCaseData);
  }, [propCaseData]);

  // Load data on mount or when caseData changes
  useEffect(() => {
    console.log('📂 INITIAL LOAD - caseData prop:', caseData);
    if (caseData?.id) {
      console.log('📂 Loading Checklist data for case:', caseData.id);
      isLoadingFromDbRef.current = true;
      caseIdRef.current = caseData.id;
      
      let loadedDeclarationIssues = [];
      // Attempt to parse declaration_issues if it's a string (from serialized storage)
      if (typeof caseData.declaration_issues === 'string') {
        try {
          loadedDeclarationIssues = JSON.parse(caseData.declaration_issues);
        } catch (e) {
          console.error('Error parsing declaration_issues from string:', e);
          loadedDeclarationIssues = [];
        }
      } else if (Array.isArray(caseData.declaration_issues)) {
        // If it's already an array, use it directly
        loadedDeclarationIssues = caseData.declaration_issues;
      } else if (caseData.declaration_issues_identified || caseData.declaration_action_to_take || caseData.declaration_action_completed) {
        // Fallback for old fields, convert to new array format if new field is not present
        loadedDeclarationIssues = [{ 
            id: 'initial-' + Date.now(), // Unique ID for converted existing data
            issue_identified: caseData.declaration_issues_identified || '', 
            action_to_take: caseData.declaration_action_to_take || '', 
            action_completed: caseData.declaration_action_completed || '' 
          }]; 
      }

      // Helper to format trading addresses
      const formatTradingAddress = () => {
        if (Array.isArray(caseData.trading_addresses) && caseData.trading_addresses.length > 0) {
          const addr = caseData.trading_addresses[0];
          return [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean).join('\n');
        } else if (caseData.trading_address) {
          if (typeof caseData.trading_address === 'string') {
            return caseData.trading_address;
          } else if (typeof caseData.trading_address === 'object') {
            return [caseData.trading_address.line1, caseData.trading_address.line2, caseData.trading_address.city, caseData.trading_address.county, caseData.trading_address.postcode].filter(Boolean).join('\n');
          }
        }
        return '';
      };

      const newFormData = {
        appointment_takers: `${caseData.ip_name || 'Duncan'} and ${caseData.joint_ip_name || 'Rupen Patel'}`,
        appointment_type: caseData.case_type || '',
        company_name: caseData.company_name || '',
        former_name: caseData.company_name_changes?.[0]?.previous_name || '',
        company_number: caseData.company_number || '',
        registered_address: caseData.registered_office_address || '',
        principal_trading_address: formatTradingAddress(),
        principal_activity: caseData.principal_activity || '',
        date_of_incorporation: caseData.incorporation_date || '',
        date_ceasing_trade: caseData.date_ceasing_trade || '',
        geographical_extent: caseData.geographical_extent || '',
        introducer: caseData.introducer || '',
        controlling_interest_companies: caseData.controlling_interest_companies || '',
        other_group_companies: caseData.other_group_companies || '',
        company_snapshot_url: caseData.company_snapshot_url || '',
        group_structure_chart_url: caseData.group_structure_chart_url || '',
        // Ethical Review fields (using direct caseData field names)
        ethical_advisory_position: caseData.ethical_advisory_position || '',
        ethical_advisory_insolvency_options: caseData.ethical_advisory_insolvency_options || false,
        ethical_advisory_conveying_meeting: caseData.ethical_advisory_conveying_meeting || false,
        ethical_advisory_preparing_soa: caseData.ethical_advisory_preparing_soa || false,
        ethical_advisory_general_meeting: caseData.ethical_advisory_general_meeting || false,
        ethical_advisory_details: caseData.ethical_advisory_details || '',
        ethical_strategic_advice_changed: caseData.ethical_strategic_advice_changed || '',
        ethical_strategic_advice_details: caseData.ethical_strategic_advice_details || '',
        ethical_conflict_company_search: caseData.ethical_conflict_company_search || false,
        ethical_conflict_personal_relationships: caseData.ethical_conflict_personal_relationships || false,
        ethical_conflict_directors_alerted: caseData.ethical_conflict_directors_alerted || false,
        ethical_conflict_client_database: caseData.ethical_conflict_client_database || false,
        ethical_facts: caseData.ethical_facts || '',
        ethical_communications: caseData.ethical_communications || '',
        ethical_considerations: caseData.ethical_considerations || '',
        ethical_fees_pre: caseData.ethical_fees_pre || '',
        ethical_fees_post: caseData.ethical_fees_post || '',
        ethical_threat_integrity: caseData.ethical_threat_integrity || false,
        ethical_threat_objectivity: caseData.ethical_threat_objectivity || false,
        ethical_threat_complexities: caseData.ethical_threat_complexities || false,
        ethical_threat_confidentiality: caseData.ethical_threat_confidentiality || false,
        ethical_threat_compliance: caseData.ethical_threat_compliance || false,
        ethical_no_threats_identified: caseData.ethical_no_threats_identified || false,
        ethical_threats_details: caseData.ethical_threats_details || '',
        ethical_safeguards: caseData.ethical_safeguards || '',
        ethical_acceptance: caseData.ethical_acceptance || '',
        ethical_adequate_resources: caseData.ethical_adequate_resources || '',
        ethical_resources_details: caseData.ethical_resources_details || '',
        // Bribery Act fields
        bribery_overseas_risk: caseData.bribery_overseas_risk || '',
        bribery_overseas_details: caseData.bribery_overseas_details || '',
        bribery_regular_contact: caseData.bribery_regular_contact || '',
        bribery_regular_contact_details: caseData.bribery_regular_contact_details || '',
        bribery_introducer_payment: caseData.bribery_introducer_payment || '',
        bribery_introducer_payment_details: caseData.bribery_introducer_payment_details || '',
        bribery_individuals_payment: caseData.bribery_individuals_payment || '',
        bribery_individuals_payment_details: caseData.bribery_individuals_payment_details || '',
        bribery_unusual_circumstances: caseData.bribery_unusual_circumstances || '',
        bribery_unusual_details: caseData.bribery_unusual_details || '',
        bribery_peps_involved: caseData.bribery_peps_involved || '',
        bribery_peps_details: caseData.bribery_peps_details || '',
        bribery_risk_level: caseData.bribery_risk_level || '',
        bribery_risk_notes: caseData.bribery_risk_notes || '',
        // GDPR fields
        gdpr_ico_registered: caseData.gdpr_ico_registered || '',
        gdpr_ico_search_results: caseData.gdpr_ico_search_results || '',
        gdpr_ico_upload_url: caseData.gdpr_ico_upload_url || '',
        gdpr_directors_confirmed: caseData.gdpr_directors_confirmed || '',
        gdpr_directors_confirmation_details: caseData.gdpr_directors_confirmation_details || '',
        gdpr_trading_continue: caseData.gdpr_trading_continue || '',
        gdpr_data_transfer_sale: caseData.gdpr_data_transfer_sale || '',
        gdpr_special_category_data: caseData.gdpr_special_category_data || '',
        gdpr_processes_in_place: caseData.gdpr_processes_in_place || '',
        gdpr_data_required_insolvency: caseData.gdpr_data_required_insolvency || '',
        gdpr_byod_policy: caseData.gdpr_byod_policy || '',
        gdpr_data_uk_eu: caseData.gdpr_data_uk_eu || '',
        gdpr_issues_identified: caseData.gdpr_issues_identified || '',
        gdpr_risk_assessment_url: caseData.gdpr_risk_assessment_url || '',
        gdpr_strategy_notes: caseData.gdpr_strategy_notes || '',
        // AML KYC fields
        aml_psc_discrepancy_noted: caseData.aml_psc_discrepancy_noted || false,
        aml_psc_discrepancy_details: caseData.aml_psc_discrepancy_details || '',
        aml_directors: Array.isArray(caseData.aml_directors) ? caseData.aml_directors.map(d => ({ ...d, position: undefined })) : [], // Ensure 'position' is removed on load
        aml_shareholders: Array.isArray(caseData.aml_shareholders) ? caseData.aml_shareholders.map(sh => ({ ...sh, shares_held: sh.shares_held || '' })) : [],
        aml_additional_notes: caseData.aml_additional_notes || '',
        // AML Risk Assessment fields
        aml_risk_cash_business: caseData.aml_risk_cash_business || '',
        aml_risk_cash_business_narrative: caseData.aml_risk_cash_business_narrative || '',
        aml_risk_criminal_investigation: caseData.aml_risk_criminal_investigation || '',
        aml_risk_criminal_investigation_narrative: caseData.aml_risk_criminal_investigation_narrative || '',
        aml_risk_relevant_person: caseData.aml_risk_relevant_person || '',
        aml_risk_relevant_person_narrative: caseData.aml_risk_relevant_person_narrative || '',
        aml_risk_pep: caseData.aml_risk_pep || '',
        aml_risk_pep_narrative: caseData.aml_risk_pep_narrative || '',
        aml_risk_accounts_match: caseData.aml_risk_accounts_match || '',
        aml_risk_accounts_match_narrative: caseData.aml_risk_accounts_match_narrative || '',
        aml_risk_complex_ownership: caseData.aml_risk_complex_ownership || '',
        aml_risk_complex_ownership_narrative: caseData.aml_risk_complex_ownership_narrative || '',
        aml_risk_known_introduction: caseData.aml_risk_known_introduction || '',
        aml_risk_known_introduction_narrative: caseData.aml_risk_known_introduction_narrative || '',
        aml_risk_no_asset_company: caseData.aml_risk_no_asset_company || '',
        aml_risk_no_asset_company_narrative: caseData.aml_risk_no_asset_company_narrative || '',
        aml_risk_regulated_sector: caseData.aml_risk_regulated_sector || '',
        aml_risk_regulated_sector_narrative: caseData.aml_risk_regulated_sector_narrative || '',
        aml_risk_distribution_anticipated: caseData.aml_risk_distribution_anticipated || '',
        aml_risk_distribution_narrative: caseData.aml_risk_distribution_narrative || '',
        aml_risk_significant_fees: caseData.aml_risk_significant_fees || '',
        aml_risk_significant_fees_narrative: caseData.aml_risk_significant_fees_narrative || '',
        aml_risk_high_value_assets: caseData.aml_risk_high_value_assets || '',
        aml_risk_high_value_assets_narrative: caseData.aml_risk_high_value_assets_narrative || '',
        aml_risk_high_risk_country: caseData.aml_risk_high_risk_country || '',
        aml_risk_high_risk_country_narrative: caseData.aml_risk_high_risk_country_narrative || '',
        aml_risk_de_jure_director: caseData.aml_risk_de_jure_director || '',
        aml_risk_de_jure_director_narrative: caseData.aml_risk_de_jure_director_narrative || '',
        aml_risk_non_face_to_face: caseData.aml_risk_non_face_to_face || '',
        aml_risk_non_face_to_face_narrative: caseData.aml_risk_non_face_to_face_narrative || '',
        aml_risk_identity_verification: caseData.aml_risk_identity_verification || '',
        aml_risk_identity_verification_narrative: caseData.aml_risk_identity_verification_narrative || '',
        aml_risk_ofsi_check_completed: caseData.aml_risk_ofsi_check_completed || '',
        aml_risk_ofsi_check_narrative: caseData.aml_risk_ofsi_check_narrative || '',
        aml_risk_ofsi_concerns: caseData.aml_risk_ofsi_concerns || '',
        aml_risk_ofsi_concerns_narrative: caseData.aml_risk_ofsi_concerns_narrative || '',
        aml_risk_assessment_level: caseData.aml_risk_assessment_level || '',
        // Client Verification fields
        aml_cdd_verification_obtained: caseData.aml_cdd_verification_obtained || '',
        aml_cdd_verification_notes: caseData.aml_cdd_verification_notes || '',
        // Declaration fields
        declaration_reviewed_by_name: caseData.declaration_reviewed_by_name || '',
        declaration_reviewed_by_signature: caseData.declaration_reviewed_by_signature || '',
        declaration_reviewed_by_date: caseData.declaration_reviewed_by_date || '',
        declaration_pre_appointment_signed: caseData.declaration_pre_appointment_signed || '',
        declaration_pre_appointment_name: caseData.declaration_pre_appointment_name || '',
        declaration_pre_appointment_date: caseData.declaration_pre_appointment_date || '',
        declaration_ethical_guidelines: caseData.declaration_ethical_guidelines || false,
        declaration_qualified_ip: caseData.declaration_qualified_ip || false,
        declaration_checks_completed: caseData.declaration_checks_completed || false,
        declaration_internal_authorisation: caseData.declaration_internal_authorisation || false, // Renamed
        declaration_office_holder_signed: caseData.declaration_office_holder_signed || '',
        declaration_office_holder_name: caseData.declaration_office_holder_name || '',
        declaration_office_holder_date: caseData.declaration_office_holder_date || '',
        declaration_issues: loadedDeclarationIssues, // Use the processed issues
        declaration_review_month1_issues: caseData.declaration_review_month1_issues || '',
        declaration_review_month1_reviewed_by: caseData.declaration_review_month1_reviewed_by || '', // Load from old field
        declaration_review_yr1_issues: caseData.declaration_review_yr1_issues || '',
        declaration_review_yr1_reviewed_by: caseData.declaration_review_yr1_reviewed_by || '', // Load from old field
        declaration_review_yr2_issues: caseData.declaration_review_yr2_issues || '',
        declaration_review_yr2_reviewed_by: caseData.declaration_review_yr2_reviewed_by || '', // Load from old field
        declaration_review_yr3_issues: caseData.declaration_review_yr3_issues || '',
        declaration_review_yr3_reviewed_by: caseData.declaration_review_yr3_reviewed_by || '', // Load from old field
      };
      
      console.log('✅ Loaded existing Checklist data:', newFormData);
      setFormData(newFormData);
      
      // Reset loading flag after data is set
      setTimeout(() => {
        isLoadingFromDbRef.current = false;
      }, 100);
    }

    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [caseData]);

  // Auto-save function
  const saveDebounced = useCallback((data) => {
    if (!caseIdRef.current) {
      console.warn('⚠️ Cannot save: No case ID available in ref.');
      return;
    }

    // Skip save if data is being loaded from database
    if (isLoadingFromDbRef.current) {
      console.log('⏭️ Skipping save - data is being loaded from database');
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    console.log('⏰ Setting save timeout (2 seconds)...');
    
    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) {
        console.log('❌ Component unmounted, aborting save');
        return;
      }
      if (!caseIdRef.current) {
        console.log('❌ No case ID at save time, aborting');
        return;
      }

      console.log('💾 Auto-saving Checklist data for case:', caseIdRef.current);
      setIsSaving(true);

      try {
        const updatePayload = {
          company_name: data.company_name || '',
          company_number: data.company_number || '',
          incorporation_date: data.date_of_incorporation || null,
          registered_office_address: data.registered_address || '',
          principal_activity: data.principal_activity || '',
          date_ceasing_trade: data.date_ceasing_trade || null,
          geographical_extent: data.geographical_extent || '',
          introducer: data.introducer || '',
          controlling_interest_companies: data.controlling_interest_companies || '',
          other_group_companies: data.other_group_companies || '',
          company_snapshot_url: data.company_snapshot_url || '',
          group_structure_chart_url: data.group_structure_chart_url || '',
          // Ethical Review fields (using direct data field names)
          ethical_advisory_position: data.ethical_advisory_position || '',
          ethical_advisory_insolvency_options: data.ethical_advisory_insolvency_options || false,
          ethical_advisory_conveying_meeting: data.ethical_advisory_conveying_meeting || false,
          ethical_advisory_preparing_soa: data.ethical_advisory_preparing_soa || false,
          ethical_advisory_general_meeting: data.ethical_advisory_general_meeting || false,
          ethical_advisory_details: data.ethical_advisory_details || '',
          ethical_strategic_advice_changed: data.ethical_strategic_advice_changed || '',
          ethical_strategic_advice_details: data.ethical_strategic_advice_details || '',
          ethical_conflict_company_search: data.ethical_conflict_company_search || false,
          ethical_conflict_personal_relationships: data.ethical_conflict_personal_relationships || false,
          ethical_conflict_directors_alerted: data.ethical_conflict_directors_alerted || false,
          ethical_conflict_client_database: data.ethical_conflict_client_database || false,
          ethical_facts: data.ethical_facts || '',
          ethical_communications: data.ethical_communications || '',
          ethical_considerations: data.ethical_considerations || '',
          ethical_fees_pre: data.ethical_fees_pre || '',
          ethical_fees_post: data.ethical_fees_post || '',
          ethical_threat_integrity: data.ethical_threat_integrity || false,
          ethical_threat_objectivity: data.ethical_threat_objectivity || false,
          ethical_threat_complexities: data.ethical_threat_complexities || false,
          ethical_threat_confidentiality: data.ethical_threat_confidentiality || false,
          ethical_threat_compliance: data.ethical_threat_compliance || false,
          ethical_no_threats_identified: data.ethical_no_threats_identified || false,
          ethical_threats_details: data.ethical_threats_details || '',
          ethical_safeguards: data.ethical_safeguards || '',
          ethical_acceptance: data.ethical_acceptance || '',
          ethical_adequate_resources: data.ethical_adequate_resources || '',
          ethical_resources_details: data.ethical_resources_details || '',
          // Bribery Act fields
          bribery_overseas_risk: data.bribery_overseas_risk || '',
          bribery_overseas_details: data.bribery_overseas_details || '',
          bribery_regular_contact: data.bribery_regular_contact || '',
          bribery_regular_contact_details: data.bribery_regular_contact_details || '',
          bribery_introducer_payment: data.bribery_introducer_payment || '',
          bribery_introducer_payment_details: data.bribery_introducer_payment_details || '',
          bribery_individuals_payment: data.bribery_individuals_payment || '',
          bribery_individuals_payment_details: data.bribery_individuals_payment_details || '',
          bribery_unusual_circumstances: data.bribery_unusual_circumstances || '',
          bribery_unusual_details: data.bribery_unusual_details || '',
          bribery_peps_involved: data.bribery_peps_involved || '',
          bribery_peps_details: data.bribery_peps_details || '',
          bribery_risk_level: data.bribery_risk_level || '',
          bribery_risk_notes: data.bribery_risk_notes || '',
          // GDPR fields
          gdpr_ico_registered: data.gdpr_ico_registered || '',
          gdpr_ico_search_results: data.gdpr_ico_search_results || '',
          gdpr_ico_upload_url: data.gdpr_ico_upload_url || '',
          gdpr_directors_confirmed: data.gdpr_directors_confirmed || '',
          gdpr_directors_confirmation_details: data.gdpr_directors_confirmation_details || '',
          gdpr_trading_continue: data.gdpr_trading_continue || '',
          gdpr_data_transfer_sale: data.gdpr_data_transfer_sale || '',
          gdpr_special_category_data: data.gdpr_special_category_data || '',
          gdpr_processes_in_place: data.gdpr_processes_in_place || '',
          gdpr_data_required_insolvency: data.gdpr_data_required_insolvency || '',
          gdpr_byod_policy: data.gdpr_byod_policy || '',
          gdpr_data_uk_eu: data.gdpr_data_uk_eu || '',
          gdpr_issues_identified: data.gdpr_issues_identified || '',
          gdpr_risk_assessment_url: data.gdpr_risk_assessment_url || '',
          gdpr_strategy_notes: data.gdpr_strategy_notes || '',
          // AML KYC fields
          aml_psc_discrepancy_noted: data.aml_psc_discrepancy_noted || false,
          aml_psc_discrepancy_details: data.aml_psc_discrepancy_details || '',
          aml_directors: data.aml_directors || [], // This will now save objects without 'position'
          aml_shareholders: data.aml_shareholders || [],
          aml_additional_notes: data.aml_additional_notes || '',
          // AML Risk Assessment fields
          aml_risk_cash_business: data.aml_risk_cash_business || '',
          aml_risk_cash_business_narrative: data.aml_risk_cash_business_narrative || '',
          aml_risk_criminal_investigation: data.aml_risk_criminal_investigation || '',
          aml_risk_criminal_investigation_narrative: data.aml_risk_criminal_investigation_narrative || '',
          aml_risk_relevant_person: data.aml_risk_relevant_person || '',
          aml_risk_relevant_person_narrative: data.aml_risk_relevant_person_narrative || '',
          aml_risk_pep: data.aml_risk_pep || '',
          aml_risk_pep_narrative: data.aml_risk_pep_narrative || '',
          aml_risk_accounts_match: data.aml_risk_accounts_match || '',
          aml_risk_accounts_match_narrative: data.aml_risk_accounts_match_narrative || '',
          aml_risk_complex_ownership: data.aml_risk_complex_ownership || '',
          aml_risk_complex_ownership_narrative: data.aml_risk_complex_ownership_narrative || '',
          aml_risk_known_introduction: data.aml_risk_known_introduction || '',
          aml_risk_known_introduction_narrative: data.aml_risk_known_introduction_narrative || '',
          aml_risk_no_asset_company: data.aml_risk_no_asset_company || '',
          aml_risk_no_asset_company_narrative: data.aml_risk_no_asset_company_narrative || '',
          aml_risk_regulated_sector: data.aml_risk_regulated_sector || '',
          aml_risk_regulated_sector_narrative: data.aml_risk_regulated_sector_narrative || '',
          aml_risk_distribution_anticipated: data.aml_risk_distribution_anticipated || '',
          aml_risk_distribution_narrative: data.aml_risk_distribution_narrative || '',
          aml_risk_significant_fees: data.aml_risk_significant_fees || '',
          aml_risk_significant_fees_narrative: data.aml_risk_significant_fees_narrative || '',
          aml_risk_high_value_assets: data.aml_risk_high_value_assets || '',
          aml_risk_high_value_assets_narrative: data.aml_risk_high_value_assets_narrative || '',
          aml_risk_high_risk_country: data.aml_risk_high_risk_country || '',
          aml_risk_high_risk_country_narrative: data.aml_risk_high_risk_country_narrative || '',
          aml_risk_de_jure_director: data.aml_risk_de_jure_director || '',
          aml_risk_de_jure_director_narrative: data.aml_risk_de_jure_director_narrative || '',
          aml_risk_non_face_to_face: data.aml_risk_non_face_to_face || '',
          aml_risk_non_face_to_face_narrative: data.aml_risk_non_face_to_face_narrative || '',
          aml_risk_identity_verification: data.aml_risk_identity_verification || '',
          aml_risk_identity_verification_narrative: data.aml_risk_identity_verification_narrative || '',
          aml_risk_ofsi_check_completed: data.aml_risk_ofsi_check_completed || '',
          aml_risk_ofsi_check_narrative: data.aml_risk_ofsi_check_narrative || '',
          aml_risk_ofsi_concerns: data.aml_risk_ofsi_concerns || '',
          aml_risk_ofsi_concerns_narrative: data.aml_risk_ofsi_concerns_narrative || '',
          aml_risk_assessment_level: data.aml_risk_assessment_level || '',
          // Client Verification fields
          aml_cdd_verification_obtained: data.aml_cdd_verification_obtained || '',
          aml_cdd_verification_notes: data.aml_cdd_verification_notes || '',
          // Declaration fields
          declaration_reviewed_by_name: data.declaration_reviewed_by_name || '',
          declaration_reviewed_by_signature: data.declaration_reviewed_by_signature || '',
          declaration_reviewed_by_date: data.declaration_reviewed_by_date || '',
          declaration_pre_appointment_signed: data.declaration_pre_appointment_signed || '',
          declaration_pre_appointment_name: data.declaration_pre_appointment_name || '',
          declaration_pre_appointment_date: data.declaration_pre_appointment_date || '',
          declaration_ethical_guidelines: data.declaration_ethical_guidelines || false,
          declaration_qualified_ip: data.declaration_qualified_ip || false,
          declaration_checks_completed: data.declaration_checks_completed || false,
          declaration_internal_authorisation: data.declaration_internal_authorisation || false, // Renamed
          declaration_office_holder_signed: data.declaration_office_holder_signed || '',
          declaration_office_holder_name: data.declaration_office_holder_name || '',
          declaration_office_holder_date: data.declaration_office_holder_date || '',
          declaration_issues: JSON.stringify(data.declaration_issues || []), // Now an array, serialize to string
          declaration_review_month1_issues: data.declaration_review_month1_issues || '',
          declaration_review_month1_reviewed_by: data.declaration_review_month1_reviewed_by || '', // Renamed
          declaration_review_yr1_issues: data.declaration_review_yr1_issues || '',
          declaration_review_yr1_reviewed_by: data.declaration_review_yr1_reviewed_by || '', // Renamed
          declaration_review_yr2_issues: data.declaration_review_yr2_issues || '',
          declaration_review_yr2_reviewed_by: data.declaration_review_yr2_reviewed_by || '', // Renamed
          declaration_review_yr3_issues: data.declaration_review_yr3_issues || '',
          declaration_review_yr3_reviewed_by: data.declaration_review_yr3_reviewed_by || '', // Renamed
        };

        console.log('📤 Saving payload:', updatePayload);
        
        await base44.entities.Case.update(caseIdRef.current, updatePayload);
        
        console.log('✅ Checklist data saved successfully');
        
        if (isMountedRef.current) {
          setLastSaved(new Date());
          
          // Refresh case data from database after save
          if (onUpdate) {
            await onUpdate();
          }
        }
      } catch (error) {
        console.error('❌ Error saving Checklist data:', error);
      } finally {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    }, 2000);
  }, [onUpdate]);

  // Handle input changes
  const handleInputChange = (field, value) => {
    console.log(`📝 Input changed: ${field}`);
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    saveDebounced(newFormData);
  };

  // Generic file upload handler
  const handleFileUpload = async (file, directorId, shareholderId, fieldName) => {
    setIsSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      let newFormData;
      if (directorId) {
        newFormData = {
          ...formData,
          aml_directors: formData.aml_directors.map(d =>
            d.id === directorId ? { ...d, [fieldName]: file_url } : d
          ),
        };
      } else if (shareholderId) {
        newFormData = {
          ...formData,
          aml_shareholders: (Array.isArray(formData.aml_shareholders) ? formData.aml_shareholders : []).map(s =>
            s.id === shareholderId ? { ...s, [fieldName]: file_url } : s
          ),
        };
      } else {
        // This handles general file uploads not related to directors/shareholders table
        newFormData = { ...formData, [fieldName]: file_url };
      }
      setFormData(newFormData);
      saveDebounced(newFormData); // Trigger save for the updated form data
      return file_url;
    } catch (error) {
      console.error(`Error uploading ${fieldName}:`, error);
      alert('Failed to upload file. Please try again.');
      return null;
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  // Specific file upload handlers for non-table fields
  const handleSnapshotUpload = (event) => handleFileUpload(event.target.files[0], null, null, 'company_snapshot_url', setIsUploadingSnapshot);
  const handleGroupChartUpload = (event) => handleFileUpload(event.target.files[0], null, null, 'group_structure_chart_url', setIsUploadingGroupChart);
  const handleGDPRICOUpload = (event) => handleFileUpload(event.target.files[0], null, null, 'gdpr_ico_upload_url', setIsUploadingGDPRICO);
  const handleGDPRRiskAssessmentUpload = (event) => handleFileUpload(event.target.files[0], null, null, 'gdpr_risk_assessment_url', setIsUploadingGDPRRiskAssessment);

  // Removed: handleClearSignature and handleSaveSignature are no longer needed here

  const handleAddDirector = () => {
    const newDirector = {
      id: Date.now().toString(),
      name: '',
      instructing: false,
      creditsafe_url: '',
      id_docs_url: '',
      previous_insolvency: ''
    };
    handleInputChange('aml_directors', [...(formData.aml_directors || []), newDirector]);
  };

  const handleUpdateDirector = (id, field, value) => {
    const updated = (formData.aml_directors || []).map(dir =>
      dir.id === id ? { ...dir, [field]: value } : dir
    );
    handleInputChange('aml_directors', updated);
  };

  const handleRemoveDirector = (id) => {
    const updated = (formData.aml_directors || []).filter(dir => dir.id !== id);
    handleInputChange('aml_directors', updated);
  };

  const handleAddShareholder = () => {
    const newShareholder = {
      id: Date.now().toString(),
      name: '',
      shares_held: '', // New field added here
      shareholding: '', 
      beneficial_owner: '',
      creditsafe_url: '',
      id_docs_url: '',
      previous_insolvency: '',
      previous_insolvency_details: ''
    };
    const currentShareholders = Array.isArray(formData.aml_shareholders) ? formData.aml_shareholders : [];
    handleInputChange('aml_shareholders', [...currentShareholders, newShareholder]);
  };

  const handleUpdateShareholder = (id, field, value) => {
    const currentShareholders = Array.isArray(formData.aml_shareholders) ? formData.aml_shareholders : [];
    const updated = currentShareholders.map(sh =>
      sh.id === id ? { ...sh, [field]: value } : sh
    );
    handleInputChange('aml_shareholders', updated);
  };

  const handleRemoveShareholder = (id) => {
    const currentShareholders = Array.isArray(formData.aml_shareholders) ? formData.aml_shareholders : [];
    const updated = currentShareholders.filter(sh => sh.id !== id);
    handleInputChange('aml_shareholders', updated);
  };

  const handleExportToHTML = () => {
    const sections = [
      { key: 'ethical_review', label: 'Ethical Review' },
      { key: 'bribery_act', label: 'Bribery Act Assessment' },
      { key: 'gdpr', label: 'GDPR Assessment' },
      { key: 'aml_cdd', label: 'AML & CDD' },
      { key: 'enhanced_due_diligence', label: 'Enhanced Due Diligence' },
      { key: 'declaration', label: 'Declaration' }
    ];

    const formatDate = (dateStr) => {
      if (!dateStr) return 'Not provided';
      try {
        return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (error) {
        console.error("Error formatting date:", dateStr, error);
        return 'Invalid Date';
      }
    };

    const formatBoolean = (val) => {
      if (val === true) return '✓ Yes';
      if (val === false) return '✗ No';
      return 'Not specified';
    };

    const formatValue = (val) => {
      if (val === null || val === undefined || val === '') return 'Not provided';
      if (typeof val === 'boolean') return formatBoolean(val);
      if (Array.isArray(val)) {
        if (val.length === 0) return 'None';
        return val.map(item => item.name || item.issue_identified || String(item)).join(', ');
      }
      return val;
    };

    const renderFileAttachment = (fileUrl, label) => {
      if (!fileUrl) return '';
      
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileUrl);
      const isPDF = /\.pdf$/i.test(fileUrl);
      
      if (isImage) {
        return `
          <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="font-weight: 600; color: #334155; margin-bottom: 10px;">${label}</p>
            <img src="${fileUrl}" alt="${label}" style="max-width: 100%; height: auto; border: 1px solid #cbd5e1; border-radius: 4px;" />
          </div>
        `;
      } else if (isPDF) {
        return `
          <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="font-weight: 600; color: #334155; margin-bottom: 10px;">${label}</p>
            <a href="${fileUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">
              📄 View PDF Document
            </a>
          </div>
        `;
      } else {
        return `
          <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <p style="font-weight: 600; color: #334155; margin-bottom: 10px;">${label}</p>
            <a href="${fileUrl}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: 500;">
              📎 View Attachment
            </a>
          </div>
        `;
      }
    };

    const renderSignature = (signatureUrl, name) => {
      if (!signatureUrl) return '';
      return `
        <div style="margin: 15px 0; padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; display: inline-block;">
          <img src="${signatureUrl}" alt="Signature of ${name}" style="height: 60px; display: block;" />
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b; text-align: center;">Signed by: ${name || 'Not specified'}</p>
        </div>
      `;
    };

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>AML & Ethics Checklist - ${caseData?.company_name || 'Case'}</title>
        <style>
          @media print {
            @page { margin: 2cm; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page-break { page-break-before: always; }
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #ffffff;
          }
          
          .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 3px solid #3b82f6;
            margin-bottom: 40px;
          }
          
          .header h1 {
            margin: 0;
            color: #1e40af;
            font-size: 32px;
            font-weight: 700;
          }
          
          .header .case-info {
            margin-top: 15px;
            font-size: 16px;
            color: #64748b;
          }
          
          .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
          }
          
          .section-title {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px 8px 0 0;
            font-size: 20px;
            font-weight: 600;
            margin: 0;
          }
          
          .section-content {
            border: 2px solid #3b82f6;
            border-top: none;
            border-radius: 0 0 8px 8px;
            padding: 25px;
            background: #f8fafc;
          }
          
          .field-group {
            margin-bottom: 20px;
            background: white;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
          }
          
          .field-label {
            font-weight: 600;
            color: #334155;
            margin-bottom: 8px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .field-value {
            color: #1e293b;
            padding: 10px;
            background: #f1f5f9;
            border-radius: 4px;
            min-height: 20px;
          }
          
          .field-value.long-text {
            white-space: pre-wrap;
            line-height: 1.8;
          }
          
          .checkbox-item {
            display: flex;
            align-items: center;
            padding: 10px;
            background: white;
            margin-bottom: 8px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
          }
          
          .checkbox {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid #3b82f6;
            border-radius: 4px;
            margin-right: 12px;
            text-align: center;
            line-height: 18px;
            font-weight: bold;
            color: #3b82f6;
            flex-shrink: 0;
          }
          
          .subsection {
            margin: 25px 0;
            padding: 20px;
            background: white;
            border-radius: 6px;
            border: 1px solid #cbd5e1;
          }
          
          .subsection-title {
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 15px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 8px;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background: white;
            border-radius: 6px;
            overflow: hidden;
          }
          
          th {
            background: #3b82f6;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
          }
          
          td {
            padding: 12px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          tr:last-child td {
            border-bottom: none;
          }
          
          tr:hover {
            background: #f8fafc;
          }
          
          .directors-table, .shareholders-table {
            margin-top: 15px;
          }
          
          .risk-indicator {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .risk-low { background: #dcfce7; color: #166534; }
          .risk-normal { background: #dbeafe; color: #1e40af; } /* Added for 'normal' risk */
          .risk-medium { background: #fef9c3; color: #854d0e; }
          .risk-high { background: #fee2e2; color: #991b1b; }
          
          .footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
            text-align: center;
            color: #64748b;
            font-size: 14px;
          }
          
          .attachments-section {
            margin-top: 30px;
            padding: 20px;
            background: #eff6ff;
            border-radius: 8px;
            border: 2px dashed #3b82f6;
          }
          
          .attachments-title {
            font-weight: 600;
            color: #1e40af;
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AML & Ethics Checklist</h1>
          <div class="case-info">
            <strong>${formData.company_name || 'N/A'}</strong><br>
            Case Reference: ${caseData?.case_reference || 'N/A'} | 
            Appointment Date: ${formatDate(caseData?.appointment_date)}<br>
            Generated: ${new Date().toLocaleString('en-GB')}
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">0. General Company Information</h2>
          <div class="section-content">
            <div class="subsection">
                <h3 class="subsection-title">Appointment Details</h3>
                <div class="field-group">
                    <div class="field-label">Name of proposed appointment takers</div>
                    <div class="field-value">${formatValue(formData.appointment_takers)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Type of appointment</div>
                    <div class="field-value">${formatValue(formData.appointment_type)}</div>
                </div>
            </div>
            <div class="subsection">
                <h3 class="subsection-title">Company Identification</h3>
                <div class="field-group">
                    <div class="field-label">Company Name</div>
                    <div class="field-value">${formatValue(formData.company_name)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Company Number</div>
                    <div class="field-value">${formatValue(formData.company_number)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Former Name</div>
                    <div class="field-value">${formatValue(formData.former_name)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Date of Incorporation</div>
                    <div class="field-value">${formatDate(formData.date_of_incorporation)}</div>
                </div>
            </div>
            <div class="subsection">
                <h3 class="subsection-title">Address and Activity</h3>
                <div class="field-group">
                    <div class="field-label">Registered Address</div>
                    <div class="field-value long-text">${formatValue(formData.registered_address)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Principal Trading Address</div>
                    <div class="field-value long-text">${formatValue(formData.principal_trading_address)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Principal Activity</div>
                    <div class="field-value">${formatValue(formData.principal_activity)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Date of Ceasing Trade</div>
                    <div class="field-value">${formatDate(formData.date_ceasing_trade)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Geographical Extent of Trading/COMI</div>
                    <div class="field-value">${formatValue(formData.geographical_extent)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Introducer</div>
                    <div class="field-value">${formatValue(formData.introducer)}</div>
                </div>
            </div>
            <div class="subsection">
                <h3 class="subsection-title">Group Information</h3>
                <div class="field-group">
                    <div class="field-label">Companies in which the company / director(s) has a controlling interest</div>
                    <div class="field-value long-text">${formatValue(formData.controlling_interest_companies)}</div>
                </div>
                <div class="field-group">
                    <div class="field-label">Other group companies</div>
                    <div class="field-value long-text">${formatValue(formData.other_group_companies)}</div>
                </div>
            </div>

            <!-- General Attachments -->
            ${formData.company_snapshot_url || formData.group_structure_chart_url ? `
              <div class="attachments-section">
                <div class="attachments-title">📎 General Company Documents</div>
                ${renderFileAttachment(formData.company_snapshot_url, 'Company Snapshot Report')}
                ${renderFileAttachment(formData.group_structure_chart_url, 'Group Structure Chart')}
              </div>
            ` : ''}
          </div>
        </div>
    `;

    // 1. ETHICAL REVIEW SECTION
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">1. Ethical Review</h2>
        <div class="section-content">
          <div class="subsection">
            <h3 class="subsection-title">Advisory Position</h3>
            <div class="field-group">
              <div class="field-label">Did the firm act in an ethical_advisory position prior to engagement?</div>
              <div class="field-value">${formatValue(formData.ethical_advisory_position)}</div>
            </div>
            ${formData.ethical_advisory_position === 'yes' ? `
              <div class="checkbox-item">
                <span class="checkbox">${formData.ethical_advisory_insolvency_options ? '✓' : ''}</span>
                <span>Advice given on insolvency options</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox">${formData.ethical_advisory_conveying_meeting ? '✓' : ''}</span>
                <span>Conveying meeting for Director</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox">${formData.ethical_advisory_preparing_soa ? '✓' : ''}</span>
                <span>Helping in preparing Statement of Affairs</span>
              </div>
              <div class="checkbox-item">
                <span class="checkbox">${formData.ethical_advisory_general_meeting ? '✓' : ''}</span>
                <span>Conveying general meeting of members</span>
              </div>
              ${formData.ethical_advisory_details ? `
                <div class="field-group">
                  <div class="field-label">Additional Details</div>
                  <div class="field-value long-text">${formData.ethical_advisory_details}</div>
                </div>
              ` : ''}
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Strategic Advice</h3>
            <div class="field-group">
              <div class="field-label">Has initial strategic advice materially changed during engagement?</div>
              <div class="field-value">${formatValue(formData.ethical_strategic_advice_changed)}</div>
            </div>
            ${formData.ethical_strategic_advice_changed === 'yes' ? `
              <div class="field-group">
                <div class="field-label">Details of Changes</div>
                <div class="field-value long-text">${formData.ethical_strategic_advice_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Conflict Checks</h3>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_conflict_company_search ? '✓' : ''}</span>
              <span>Company search reviewed for conflicts</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_conflict_personal_relationships ? '✓' : ''}</span>
              <span>Personal/professional relationships considered</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_conflict_directors_alerted ? '✓' : ''}</span>
              <span>Directors alerted to conflicts of interest</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_conflict_client_database ? '✓' : ''}</span>
              <span>Client database reviewed for conflicts</span>
            </div>
          </div>

          ${formData.ethical_facts || formData.ethical_communications || formData.ethical_considerations ? `
            <div class="subsection">
              <h3 class="subsection-title">Ethical Analysis</h3>
              ${formData.ethical_facts ? `
                <div class="field-group">
                  <div class="field-label">The Facts</div>
                  <div class="field-value long-text">${formData.ethical_facts}</div>
                </div>
              ` : ''}
              ${formData.ethical_communications ? `
                <div class="field-group">
                  <div class="field-label">Communications</div>
                  <div class="field-value long-text">${formData.ethical_communications}</div>
                </div>
              ` : ''}
              ${formData.ethical_considerations ? `
                <div class="field-group">
                  <div class="field-label">Considerations</div>
                  <div class="field-value long-text">${formData.ethical_considerations}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${formData.ethical_fees_pre || formData.ethical_fees_post ? `
            <div class="subsection">
              <h3 class="subsection-title">Fees</h3>
              ${formData.ethical_fees_pre ? `
                <div class="field-group">
                  <div class="field-label">Pre-appointment Fees</div>
                  <div class="field-value long-text">${formData.ethical_fees_pre}</div>
                </div>
              ` : ''}
              ${formData.ethical_fees_post ? `
                <div class="field-group">
                  <div class="field-label">Post-appointment Fees</div>
                  <div class="field-value long-text">${formData.ethical_fees_post}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="subsection">
            <h3 class="subsection-title">Threats to Fundamental Principles</h3>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_threat_integrity ? '✓' : ''}</span>
              <span>Any threat to my integrity considered</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_threat_objectivity ? '✓' : ''}</span>
              <span>Any threat to my objectivity considered</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_threat_complexities ? '✓' : ''}</span>
              <span>The specific complexities of this case; I have sufficient knowledge and skill</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_threat_confidentiality ? '✓' : ''}</span>
              <span>Confidentiality considerations</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_threat_compliance ? '✓' : ''}</span>
              <span>My ability to comply with the relevant laws and regulations</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.ethical_no_threats_identified ? '✓' : ''}</span>
              <span>No threats to the fundamental principles, real or perceived, have been identified</span>
            </div>
            ${formData.ethical_threats_details ? `
              <div class="field-group">
                <div class="field-label">Threat Details</div>
                <div class="field-value long-text">${formData.ethical_threats_details}</div>
              </div>
            ` : ''}
          </div>

          ${formData.ethical_safeguards || formData.ethical_acceptance ? `
            <div class="subsection">
              <h3 class="subsection-title">Safeguards & Acceptance</h3>
              ${formData.ethical_safeguards ? `
                <div class="field-group">
                  <div class="field-label">Safeguards in Place</div>
                  <div class="field-value long-text">${formData.ethical_safeguards}</div>
                </div>
              ` : ''}
              ${formData.ethical_acceptance ? `
                <div class="field-group">
                  <div class="field-label">Acceptance Conclusion</div>
                  <div class="field-value long-text">${formData.ethical_acceptance}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="subsection">
            <h3 class="subsection-title">Firm Resources</h3>
            <div class="field-group">
              <div class="field-label">Does the firm have adequate skills and resources to undertake the assignment?</div>
              <div class="field-value">${formatValue(formData.ethical_adequate_resources)}</div>
            </div>
            ${formData.ethical_resources_details ? `
              <div class="field-group">
                <div class="field-label">Resource Details</div>
                <div class="field-value long-text">${formData.ethical_resources_details}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    // 2. BRIBERY ACT ASSESSMENT SECTION
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">2. Bribery Act Assessment</h2>
        <div class="section-content">
          <div class="subsection">
            <h3 class="subsection-title">Overseas Corruption Risk</h3>
            <div class="field-group">
              <div class="field-label">Are individuals involved overseas persons or entities based in a known risk area?</div>
              <div class="field-value">${formatValue(formData.bribery_overseas_risk)}</div>
            </div>
            ${formData.bribery_overseas_risk === 'yes' && formData.bribery_overseas_details ? `
              <div class="field-group">
                <div class="field-label">Details</div>
                <div class="field-value long-text">${formData.bribery_overseas_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Introduction Source</h3>
            <div class="field-group">
              <div class="field-label">Is the source of introduction a regular contact of the firm?</div>
              <div class="field-value">${formatValue(formData.bribery_regular_contact)}</div>
            </div>
            ${formData.bribery_regular_contact === 'no' && formData.bribery_regular_contact_details ? `
              <div class="field-group">
                <div class="field-label">Details</div>
                <div class="field-value long-text">${formData.bribery_regular_contact_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Introducer Payments</h3>
            <div class="field-group">
              <div class="field-label">Is the introducer being paid/rewarded for anything other than work done?</div>
              <div class="field-value">${formatValue(formData.bribery_introducer_payment)}</div>
            </div>
            ${formData.bribery_introducer_payment === 'yes' && formData.bribery_introducer_payment_details ? `
              <div class="field-group">
                <div class="field-label">Payment Details</div>
                <div class="field-value long-text">${formData.bribery_introducer_payment_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Individual Payments</h3>
            <div class="field-group">
              <div class="field-label">Are any individuals associated with the appointment being paid/rewarded?</div>
              <div class="field-value">${formatValue(formData.bribery_individuals_payment)}</div>
            </div>
            ${formData.bribery_individuals_payment === 'yes' && formData.bribery_individuals_payment_details ? `
              <div class="field-group">
                <div class="field-label">Payment Details</div>
                <div class="field-value long-text">${formData.bribery_individuals_payment_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Unusual Circumstances</h3>
            <div class="field-group">
              <div class="field-label">Anything unusual known about client or prospective appointment?</div>
              <div class="field-value">${formatValue(formData.bribery_unusual_circumstances)}</div>
            </div>
            ${formData.bribery_unusual_circumstances === 'yes' && formData.bribery_unusual_details ? `
              <div class="field-group">
                <div class="field-label">Details</div>
                <div class="field-value long-text">${formData.bribery_unusual_details}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Politically Exposed Persons (PEPs)</h3>
            <div class="field-group">
              <div class="field-label">Has the client been involved with any politically exposed persons (PEPs)?</div>
              <div class="field-value">${formatValue(formData.bribery_peps_involved)}</div>
            </div>
            ${formData.bribery_peps_involved === 'yes' && formData.bribery_peps_details ? `
              <div class="field-group">
                <div class="field-label">PEP Details</div>
                <div class="field-value long-text">${formData.bribery_peps_details}</div>
              </div>
            ` : ''}
          </div>

          ${formData.bribery_risk_level || formData.bribery_risk_notes ? `
            <div class="subsection">
              <h3 class="subsection-title">Risk Assessment</h3>
              ${formData.bribery_risk_level ? `
                <div class="field-group">
                  <div class="field-label">Overall Bribery Risk Level</div>
                  <div class="field-value">
                    <span class="risk-indicator risk-${formData.bribery_risk_level}">${formData.bribery_risk_level.toUpperCase()}</span>
                  </div>
                </div>
              ` : ''}
              ${formData.bribery_risk_notes ? `
                <div class="field-group">
                  <div class="field-label">Risk Notes</div>
                  <div class="field-value long-text">${formData.bribery_risk_notes}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 3. GDPR Section
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">3. GDPR Assessment</h2>
        <div class="section-content">
          <div class="subsection">
            <h3 class="subsection-title">ICO Registration</h3>
            <div class="field-group">
              <div class="field-label">Is the company or are the director's listed on the ICO register?</div>
              <div class="field-value">${formatValue(formData.gdpr_ico_registered)}</div>
            </div>
            ${formData.gdpr_ico_search_results ? `
              <div class="field-group">
                <div class="field-label">ICO Search Results</div>
                <div class="field-value long-text">${formData.gdpr_ico_search_results}</div>
              </div>
            ` : ''}
          </div>

          ${formData.gdpr_directors_confirmed || formData.gdpr_trading_continue || formData.gdpr_data_transfer_sale || 
            formData.gdpr_special_category_data || formData.gdpr_processes_in_place || formData.gdpr_data_required_insolvency || 
            formData.gdpr_byod_policy || formData.gdpr_data_uk_eu ? `
            <div class="subsection">
              <h3 class="subsection-title">GDPR Questions</h3>
              ${formData.gdpr_directors_confirmed ? `
                <div class="field-group">
                  <div class="field-label">Have directors confirmed that they do not consider themselves or the Company to be data controllers or data processors?</div>
                  <div class="field-value">${formatValue(formData.gdpr_directors_confirmed)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_directors_confirmed === 'yes' && formData.gdpr_directors_confirmation_details ? `
                <div class="field-group">
                  <div class="field-label">Directors' Confirmation Details</div>
                  <div class="field-value long-text">${formData.gdpr_directors_confirmation_details}</div>
                </div>
              ` : ''}
              ${formData.gdpr_trading_continue ? `
                <div class="field-group">
                  <div class="field-label">Will trading continue post appointment?</div>
                  <div class="field-value">${formatValue(formData.gdpr_trading_continue)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_data_transfer_sale ? `
                <div class="field-group">
                  <div class="field-label">Will data be transferred as part of a going concern sale?</div>
                  <div class="field-value">${formatValue(formData.gdpr_data_transfer_sale)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_special_category_data ? `
                <div class="field-group">
                  <div class="field-label">Does the Company hold any special category data?</div>
                  <div class="field-value">${formatValue(formData.gdpr_special_category_data)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_processes_in_place ? `
                <div class="field-group">
                  <div class="field-label">Did the Company have processes and procedures in place for GDPR?</div>
                  <div class="field-value">${formatValue(formData.gdpr_processes_in_place)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_data_required_insolvency ? `
                <div class="field-group">
                  <div class="field-label">Is the data collected required for the purposes of insolvency?</div>
                  <div class="field-value">${formatValue(formData.gdpr_data_required_insolvency)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_byod_policy ? `
                <div class="field-group">
                  <div class="field-label">Did the Company have a bring your own device policy?</div>
                  <div class="field-value">${formatValue(formData.gdpr_byod_policy)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_data_uk_eu ? `
                <div class="field-group">
                  <div class="field-label">Is the data held within the UK or EU territories?</div>
                  <div class="field-value">${formatValue(formData.gdpr_data_uk_eu)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          ${formData.gdpr_issues_identified || formData.gdpr_strategy_notes ? `
            <div class="subsection">
              <h3 class="subsection-title">Specific GDPR Issues & Strategy</h3>
              ${formData.gdpr_issues_identified ? `
                <div class="field-group">
                  <div class="field-label">Have any specific GDPR issues been identified?</div>
                  <div class="field-value long-text">${formatValue(formData.gdpr_issues_identified)}</div>
                </div>
              ` : ''}
              ${formData.gdpr_strategy_notes ? `
                <div class="field-group">
                  <div class="field-label">GDPR Strategy Review Notes</div>
                  <div class="field-value long-text">${formatValue(formData.gdpr_strategy_notes)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <!-- GDPR Attachments -->
          ${formData.gdpr_ico_upload_url || formData.gdpr_risk_assessment_url ? `
            <div class="attachments-section">
              <div class="attachments-title">📎 Attached Documents (GDPR)</div>
              ${renderFileAttachment(formData.gdpr_ico_upload_url, 'ICO Documentation')}
              ${renderFileAttachment(formData.gdpr_risk_assessment_url, 'Personal Data Initial Risk Assessment')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 4. AML & CDD Section
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">4. AML & Customer Due Diligence</h2>
        <div class="section-content">
          <div class="subsection">
            <h3 class="subsection-title">PSC Information</h3>
            <div class="field-group">
              <div class="field-label">PSC Discrepancy Noted?</div>
              <div class="field-value">${formatBoolean(formData.aml_psc_discrepancy_noted)}</div>
            </div>
            ${formData.aml_psc_discrepancy_noted && formData.aml_psc_discrepancy_details ? `
              <div class="field-group">
                <div class="field-label">Discrepancy Details & Action Taken</div>
                <div class="field-value long-text">${formatValue(formData.aml_psc_discrepancy_details)}</div>
              </div>
            ` : ''}
          </div>

          <!-- Directors AML Data -->
          ${(formData.aml_directors && formData.aml_directors.length > 0) ? `
            <div class="subsection">
              <h3 class="subsection-title">Directors / PSCs - AML Verification</h3>
              <table class="directors-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Instructing</th>
                    <th>Creditsafe Check</th>
                    <th>ID Documents</th>
                    <th>Previous Insolvency</th>
                  </tr>
                </thead>
                <tbody>
                  ${(formData.aml_directors || []).map(dir => `
                    <tr>
                      <td>${dir.name || 'N/A'}</td>
                      <td>${formatBoolean(dir.instructing)}</td>
                      <td>${dir.creditsafe_url ? '✓ Attached' : 'Not provided'}</td>
                      <td>${dir.id_docs_url ? '✓ Attached' : 'Not provided'}</td>
                      <td>${dir.previous_insolvency || 'None recorded'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <!-- Director Attachments -->
              ${(() => {
                const attachments = (formData.aml_directors || []).filter(dir => dir.creditsafe_url || dir.id_docs_url);
                
                if (attachments.length > 0) {
                  return `
                    <div class="attachments-section">
                      <div class="attachments-title">📎 Director/PSC Documents</div>
                      ${attachments.map(dir => `
                        ${dir.creditsafe_url ? renderFileAttachment(dir.creditsafe_url, `Creditsafe Report - ${dir.name}`) : ''}
                        ${dir.id_docs_url ? renderFileAttachment(dir.id_docs_url, `ID Documents - ${dir.name}`) : ''}
                      `).join('')}
                    </div>
                  `;
                }
                return '';
              })()}
            </div>
          ` : ''}

          <!-- Shareholders AML Data -->
          ${(formData.aml_shareholders && formData.aml_shareholders.length > 0) ? `
            <div class="subsection">
              <h3 class="subsection-title">Shareholders - AML Verification</h3>
              <table class="shareholders-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Shares Held</th>
                    <th>Shareholding & %</th>
                    <th>Beneficial Owner</th>
                    <th>Creditsafe Check</th>
                    <th>ID Documents</th>
                    <th>Previous Insolvency</th>
                  </tr>
                </thead>
                <tbody>
                  ${(formData.aml_shareholders || []).map(sh => `
                    <tr>
                      <td>${sh.name || 'N/A'}</td>
                      <td>${sh.shares_held || 'N/A'}</td>
                      <td>${sh.shareholding || 'N/A'}</td>
                      <td>${formatValue(sh.beneficial_owner)}</td>
                      <td>${sh.creditsafe_url ? '✓ Attached' : 'Not provided'}</td>
                      <td>${sh.id_docs_url ? '✓ Attached' : 'Not provided'}</td>
                      <td>${sh.previous_insolvency === 'yes' ? `Yes: ${sh.previous_insolvency_details || 'N/A'}` : (sh.previous_insolvency === 'no' ? 'No' : 'N/A')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <!-- Shareholder Attachments -->
              ${(() => {
                const attachments = (formData.aml_shareholders || []).filter(sh => sh.creditsafe_url || sh.id_docs_url);
                
                if (attachments.length > 0) {
                  return `
                    <div class="attachments-section">
                      <div class="attachments-title">📎 Shareholder Documents</div>
                      ${attachments.map(sh => `
                        ${sh.creditsafe_url ? renderFileAttachment(sh.creditsafe_url, `Creditsafe Report - ${sh.name}`) : ''}
                        ${sh.id_docs_url ? renderFileAttachment(sh.id_docs_url, `ID Documents - ${sh.name}`) : ''}
                      `).join('')}
                    </div>
                  `;
                }
                return '';
              })()}
            </div>
          ` : ''}

          ${formData.aml_additional_notes ? `
            <div class="subsection">
              <h3 class="subsection-title">Additional AML Notes</h3>
              <div class="field-group">
                <div class="field-value long-text">${formatValue(formData.aml_additional_notes)}</div>
              </div>
            </div>
          ` : ''}

          ${formData.aml_cdd_verification_obtained || formData.aml_cdd_verification_notes ? `
            <div class="subsection">
              <h3 class="subsection-title">CDD Verification Status</h3>
              ${formData.aml_cdd_verification_obtained ? `
                <div class="field-group">
                  <div class="field-label">Has all required CDD verification been obtained and evidence placed in the file?</div>
                  <div class="field-value">${formatValue(formData.aml_cdd_verification_obtained)}</div>
                </div>
              ` : ''}
              ${formData.aml_cdd_verification_notes ? `
                <div class="field-group">
                  <div class="field-label">CDD Verification Notes (if not obtained)</div>
                  <div class="field-value long-text">${formatValue(formData.aml_cdd_verification_notes)}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 5. Enhanced Due Diligence Section (AML Risk Assessment Fields)
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">5. AML Risk Assessment (Enhanced Due Diligence)</h2>
        <div class="section-content">
          <p style="margin-bottom: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <strong>Note:</strong> Appointments may be considered to carry a higher risk. Enhanced due diligence (EDD) may be appropriate 
            where any additional risk factors are identified. The questions below cover key risks.
          </p>

          <div class="subsection">
            <h3 class="subsection-title">Client Risk Factors</h3>
            <div class="field-group">
              <div class="field-label">1. Cash-based business?</div>
              <div class="field-value">${formatValue(formData.aml_risk_cash_business)}</div>
            </div>
            ${formData.aml_risk_cash_business_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_cash_business_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">2. Subject of criminal investigations?</div>
              <div class="field-value">${formatValue(formData.aml_risk_criminal_investigation)}</div>
            </div>
            ${formData.aml_risk_criminal_investigation_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_criminal_investigation_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">3. "Relevant person" as defined by Reg 8 of 2017 Regulations?</div>
              <div class="field-value">${formatValue(formData.aml_risk_relevant_person)}</div>
            </div>
            ${formData.aml_risk_relevant_person_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_relevant_person_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">4. Directors/beneficial owners PEPs or associates?</div>
              <div class="field-value">${formatValue(formData.aml_risk_pep)}</div>
            </div>
            ${formData.aml_risk_pep_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_pep_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">5. Accounts available and match disclosed history?</div>
              <div class="field-value">${formatValue(formData.aml_risk_accounts_match)}</div>
            </div>
            ${formData.aml_risk_accounts_match_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_accounts_match_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">6. Unusually complex ownership structures?</div>
              <div class="field-value">${formatValue(formData.aml_risk_complex_ownership)}</div>
            </div>
            ${formData.aml_risk_complex_ownership_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_complex_ownership_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">7. Introduction from a known source?</div>
              <div class="field-value">${formatValue(formData.aml_risk_known_introduction)}</div>
            </div>
            ${formData.aml_risk_known_introduction_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_known_introduction_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">8. 'No asset' company and reasonable?</div>
              <div class="field-value">${formatValue(formData.aml_risk_no_asset_company)}</div>
            </div>
            ${formData.aml_risk_no_asset_company_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_no_asset_company_narrative}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Service/Sector Risk Factors</h3>
            <div class="field-group">
              <div class="field-label">9. Client operates within a regulated sector for ML purposes?</div>
              <div class="field-value">${formatValue(formData.aml_risk_regulated_sector)}</div>
            </div>
            ${formData.aml_risk_regulated_sector_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_regulated_sector_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">10. Anticipated distribution of assets back to debtor/shareholders?</div>
              <div class="field-value">${formatValue(formData.aml_risk_distribution_anticipated)}</div>
            </div>
            ${formData.aml_risk_distribution_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_distribution_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">11. Fees significant compared to other matters?</div>
              <div class="field-value">${formatValue(formData.aml_risk_significant_fees)}</div>
            </div>
            ${formData.aml_risk_significant_fees_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_significant_fees_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">12. Instruction will involve high value assets?</div>
              <div class="field-value">${formatValue(formData.aml_risk_high_value_assets)}</div>
            </div>
            ${formData.aml_risk_high_value_assets_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_high_value_assets_narrative}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Geographical Risk Factors</h3>
            <div class="field-group">
              <div class="field-label">13. Any relevant parties in high risk countries?</div>
              <div class="field-value">${formatValue(formData.aml_risk_high_risk_country)}</div>
            </div>
            ${formData.aml_risk_high_risk_country_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_high_risk_country_narrative}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Channel Risk Factors – Face to Face Contact</h3>
            <div class="field-group">
              <div class="field-label">14. Are you taking instructions from a de jure director?</div>
              <div class="field-value">${formatValue(formData.aml_risk_de_jure_director)}</div>
            </div>
            ${formData.aml_risk_de_jure_director_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_de_jure_director_narrative}</div>
              </div>
            ` : ''}
            
            <div class="field-group">
              <div class="field-label">15. Assignment involves non-face-to-face business relationship?</div>
              <div class="field-value">${formatValue(formData.aml_risk_non_face_to_face)}</div>
            </div>
            ${formData.aml_risk_non_face_to_face_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_non_face_to_face_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">16. (If 15 Yes) Can adequate identity verification be established?</div>
              <div class="field-value">${formatValue(formData.aml_risk_identity_verification)}</div>
            </div>
            ${formData.aml_risk_identity_verification_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_identity_verification_narrative}</div>
              </div>
            ` : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Office of Financial Sanctions Implementation (OFSI) Targets Check</h3>
            <div class="field-group">
              <div class="field-label">17. OFSI list check completed?</div>
              <div class="field-value">${formatValue(formData.aml_risk_ofsi_check_completed)}</div>
            </div>
            ${formData.aml_risk_ofsi_check_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_ofsi_check_narrative}</div>
              </div>
            ` : ''}

            <div class="field-group">
              <div class="field-label">18. OFSI check highlighted concerns?</div>
              <div class="field-value">${formatValue(formData.aml_risk_ofsi_concerns)}</div>
            </div>
            ${formData.aml_risk_ofsi_concerns_narrative ? `
              <div class="field-group" style="margin-left: 32px;">
                <div class="field-label">Narrative</div>
                <div class="field-value long-text">${formData.aml_risk_ofsi_concerns_narrative}</div>
              </div>
            ` : ''}
          </div>

          ${formData.aml_risk_assessment_level ? `
            <div class="subsection">
              <h3 class="subsection-title">Overall Risk Assessment Conclusion</h3>
              <div class="field-group">
                <div class="field-label">AML Risk Assessment Level</div>
                <div class="field-value">
                  <span class="risk-indicator risk-${
                    formData.aml_risk_assessment_level === 'high' ? 'high' :
                    (formData.aml_risk_assessment_level === 'normal' ? 'normal' : 'low')
                  }">
                    ${
                      formData.aml_risk_assessment_level === 'simplified_due_diligence' ? 'SIMPLIFIED DUE DILIGENCE' :
                      formData.aml_risk_assessment_level.toUpperCase()
                    }
                  </span>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // 6. Declaration Section
    htmlContent += `
      <div class="section page-break">
        <h2 class="section-title">6. Declaration</h2>
        <div class="section-content">
          <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <p style="margin: 0; color: #1e40af; font-weight: 500; line-height: 1.8;">
              I have assessed the risks of Money Laundering on this proposed assignment and completed the verification work 
              required in accordance with this assessment and as evidenced on this checklist and the documents appended to it.
            </p>
          </div>

          ${formData.declaration_reviewed_by_name || formData.declaration_reviewed_by_signature || formData.declaration_reviewed_by_date ? `
            <div class="subsection">
              <h3 class="subsection-title">Reviewed by</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                ${formData.declaration_reviewed_by_name ? `
                  <div class="field-group">
                    <div class="field-label">Name</div>
                    <div class="field-value">${formatValue(formData.declaration_reviewed_by_name)}</div>
                  </div>
                ` : ''}
                ${formData.declaration_reviewed_by_signature ? `
                  <div class="field-group">
                    <div class="field-label">Signature</div>
                    ${renderSignature(formData.declaration_reviewed_by_signature, formData.declaration_reviewed_by_name)}
                  </div>
                ` : ''}
                ${formData.declaration_reviewed_by_date ? `
                  <div class="field-group">
                    <div class="field-label">Date</div>
                    <div class="field-value">${formatDate(formData.declaration_reviewed_by_date)}</div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}

          <div class="subsection">
            <h3 class="subsection-title">Pre-appointment Acceptance Review Completed Satisfactorily</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
              ${formData.declaration_pre_appointment_name ? `
                <div class="field-group">
                  <div class="field-label">IP Name</div>
                  <div class="field-value">${formatValue(formData.declaration_pre_appointment_name)}</div>
                </div>
              ` : ''}
              ${formData.declaration_pre_appointment_date ? `
                <div class="field-group">
                  <div class="field-label">Date</div>
                  <div class="field-value">${formatDate(formData.declaration_pre_appointment_date)}</div>
                </div>
              ` : ''}
            </div>
            ${formData.declaration_pre_appointment_signed ? renderSignature(formData.declaration_pre_appointment_signed, formData.declaration_pre_appointment_name) : ''}
          </div>

          <div class="subsection">
            <h3 class="subsection-title">Office Holder Confirmations</h3>
            <p style="margin-bottom: 15px; font-style: italic; color: #475569;">
              As the proposed office holder, I have satisfied myself that reasonable steps have been taken to establish that there 
              has been no work performed by this firm or any of its principals or employees, or that there are other circumstances 
              which require that the appointment is declined, and that:
            </p>
            
            <div class="checkbox-item">
              <span class="checkbox">${formData.declaration_ethical_guidelines ? '✓' : ''}</span>
              <span>The ethical guidelines for obtaining the insolvency work have been taken into consideration.</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.declaration_qualified_ip ? '✓' : ''}</span>
              <span>I am an Insolvency Practitioner qualified to act under Section 390 of the Insolvency Act 1986.</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.declaration_checks_completed ? '✓' : ''}</span>
              <span>All necessary checks have been carried out and that no material professional relationship or conflict has been revealed.</span>
            </div>
            <div class="checkbox-item">
              <span class="checkbox">${formData.declaration_internal_authorisation ? '✓' : ''}</span>
              <span>I have the necessary Internal Authorisation from the firm to undertake the appointment.</span>
            </div>

            <div style="margin-top: 20px;">
              ${formData.declaration_office_holder_name ? `
                <div class="field-group">
                  <div class="field-label">Office Holder Name</div>
                  <div class="field-value">${formatValue(formData.declaration_office_holder_name)}</div>
                </div>
              ` : ''}
              ${formData.declaration_office_holder_date ? `
                <div class="field-group">
                  <div class="field-label">Date</div>
                  <div class="field-value">${formatDate(formData.declaration_office_holder_date)}</div>
                </div>
              ` : ''}
              ${formData.declaration_office_holder_signed ? renderSignature(formData.declaration_office_holder_signed, formData.declaration_office_holder_name) : ''}
            </div>
          </div>

          ${formData.declaration_issues && formData.declaration_issues.length > 0 ? `
            <div class="subsection">
              <h3 class="subsection-title">Issues Identified for Follow Up at Date of Signing</h3>
              <table>
                <thead>
                  <tr>
                    <th style="width: 25%;">Issues Identified</th>
                    <th style="width: 40%;">Action to be Taken</th>
                    <th style="width: 35%;">Action Completed</th>
                  </tr>
                </thead>
                <tbody>
                  ${(formData.declaration_issues || []).map(issue => `
                        <tr>
                          <td style="white-space: pre-wrap;">${issue.issue_identified || 'Not specified'}</td>
                          <td style="white-space: pre-wrap;">${issue.action_to_take || 'Not specified'}</td>
                          <td style="white-space: pre-wrap;">${issue.action_completed || 'Pending'}</td>
                        </tr>
                      `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${(formData.declaration_review_month1_issues || formData.declaration_review_yr1_issues || formData.declaration_review_yr2_issues || formData.declaration_review_yr3_issues) ? `
            <div class="subsection">
              <h3 class="subsection-title">Regular Reviews</h3>
              <p style="margin-bottom: 15px; font-size: 14px; color: #64748b;">
                All appointments should be reviewed for ML issues on a regular basis. It is recommended that this review takes place 
                at Month 1 and on the anniversary of the appointment or any significant change of circumstance.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Review Period</th>
                    <th>Issues Identified</th>
                    <th>Reviewed By (Initial, Print Name and Date)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Month 1</strong></td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_month1_issues || 'None identified'}</td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_month1_reviewed_by || 'Not completed'}</td>
                  </tr>
                  <tr>
                    <td><strong>Year 1</strong></td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr1_issues || 'None identified'}</td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr1_reviewed_by || 'Not completed'}</td>
                  </tr>
                  <tr>
                    <td><strong>Year 2</strong></td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr2_issues || 'None identified'}</td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr2_reviewed_by || 'Not completed'}</td>
                  </tr>
                  <tr>
                    <td><strong>Year 3</strong></td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr3_issues || 'None identified'}</td>
                    <td style="white-space: pre-wrap;">${formData.declaration_review_yr3_reviewed_by || 'Not completed'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    htmlContent += `
        <div class="footer">
          <p><strong>End of AML & Ethics Checklist</strong></p>
          <p>Generated by Progresso Case Management System</p>
          <p>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AML_Ethics_Checklist_${caseData?.case_reference || 'Export'}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };


  const sectionsConfig = {
    pre_appointment: {
      label: 'Pre-Appointment Checklist',
      icon: FileCheck,
      content: <p className="text-slate-500">Pre-Appointment checklist content coming soon</p>
    },
    post_appointment: {
      label: 'Post-Appointment Checklist',
      icon: ClipboardCheck,
      content: <p className="text-slate-500">Post-Appointment checklist content coming soon</p>
    }
  };

  const handleSectionChange = (newSection) => {
    setActiveSection(newSection);
    if (newSection === 'aml_ethics') {
      // If we are already on AML & Ethics and click it again, toggle its expansion.
      // Otherwise, ensure it's expanded and set defaults for its sub-sections.
      if (activeSection === 'aml_ethics') {
        setIsAmlExpanded(!isAmlExpanded);
      } else {
        setIsAmlExpanded(true);
        setActiveSubSection('company_information'); // Default to first sub-section
      }
    } else {
      setIsAmlExpanded(false); // Collapse AML & Ethics if switching away
      setActiveSubSection(null); // Clear active sub-section for non-AML sections
    }
    // Removed activeSubSubSection state and related logic
  };

  const handleSubSectionChange = (newSubSection) => {
    setActiveSubSection(newSubSection);
    // No longer need to handle sub-sub-sections specifically here
  };

  // Removed handleSubSubSectionChange as it's no longer needed

  const renderContent = () => {
    const section = sectionsConfig[activeSection];
    if (!section) return null;

    if (activeSection === 'aml_ethics') {
      const subSection = section.subSections[activeSubSection];
      if (!subSection) return null;

      const isAmlRelated = activeSubSection === 'aml_kyc' || activeSubSection === 'risk_assessment' || activeSubSection === 'client_verification' || activeSubSection === 'declaration';
      const borderColorClass = isAmlRelated ? 'border-t-purple-500' : 'border-t-blue-500';
      const bgColorClass = isAmlRelated ? 'from-purple-50 to-purple-100' : 'from-blue-50 to-blue-100';
      const titleColorClass = isAmlRelated ? 'text-purple-900' : 'text-blue-900';

      return (
        <Card className={`border-t-4 ${borderColorClass}`}>
          <CardHeader className={`border-b bg-gradient-to-r ${bgColorClass}`}>
            <CardTitle className={`text-xl font-bold ${titleColorClass}`}>{subSection.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {subSection.content}
          </CardContent>
        </Card>
      );
    } else { // Top-level sections other than aml_ethics (pre_appointment, post_appointment)
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <section.icon className="w-5 h-5 text-blue-600" />
              {section.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {section.content}
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <div className="flex gap-6 h-full">
      {/* Left Sidebar Navigation */}
      <div className="w-64 flex-shrink-0">
        <Card className="sticky top-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Checklists
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            {Object.keys(sectionsConfig).map((sectionId) => {
              const section = sectionsConfig[sectionId];
              const Icon = section.icon;
              const isActiveSection = activeSection === sectionId;
              
              return (
                <div key={sectionId}>
                  <Button
                    variant={isActiveSection ? "secondary" : "ghost"}
                    className={`w-full justify-start gap-2 ${
                      isActiveSection
                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' 
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={() => handleSectionChange(sectionId)}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1 text-left">{section.label}</span>
                    {sectionId === 'aml_ethics' && (
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform ${
                          isAmlExpanded && isActiveSection ? 'rotate-180' : ''
                        }`} 
                      />
                    )}
                  </Button>
                  
                  {sectionId === 'aml_ethics' && isActiveSection && isAmlExpanded && (
                    <div className="ml-4 mt-1 space-y-1">
                      {Object.keys(section.subSections).map((subSectionId) => {
                        const subSection = section.subSections[subSectionId];
                        const isActiveSubSection = activeSubSection === subSectionId;
                        const isAmlRelated = subSectionId === 'aml_kyc' || subSectionId === 'risk_assessment' || subSectionId === 'client_verification' || subSectionId === 'declaration';
                        
                        return (
                          <div key={subSectionId}>
                            <Button
                              variant={isActiveSubSection ? "secondary" : "ghost"}
                              className={`w-full justify-start text-sm ${
                                isActiveSubSection
                                  ? isAmlRelated
                                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-100'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                  : 'text-slate-600 hover:bg-slate-50'
                              }`}
                              onClick={() => handleSubSectionChange(subSectionId)}
                            >
                              <span className="flex-1 text-left">{subSection.label}</span>
                              {/* Removed nested ChevronDown and sub-sub-sections logic */}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        {activeSection === 'aml_ethics' && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-600">
                <Shield className="w-5 h-5" />
                <h2 className="text-xl font-bold">AML & Ethics Checklist</h2>
              </div>
              <div className="flex items-center gap-3">
                {isSaving && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                )}
                {!isSaving && lastSaved && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="w-4 h-4" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </div>
                )}
                <Button
                  onClick={() => {
                    const currentCase = caseData || propCaseData;
                    if (!currentCase) {
                      alert('Case data not available. Please try again.');
                      return;
                    }
                    
                    // Populate from Companies House data stored in case
                    const formatTradingAddress = () => {
                      if (Array.isArray(currentCase.trading_addresses) && currentCase.trading_addresses.length > 0) {
                        const addr = currentCase.trading_addresses[0];
                        return [addr.line1, addr.line2, addr.city, addr.county, addr.postcode].filter(Boolean).join('\n');
                      } else if (currentCase.trading_address) {
                        if (typeof currentCase.trading_address === 'string') {
                          return currentCase.trading_address;
                        } else if (typeof currentCase.trading_address === 'object') {
                          return [currentCase.trading_address.line1, currentCase.trading_address.line2, currentCase.trading_address.city, currentCase.trading_address.county, currentCase.trading_address.postcode].filter(Boolean).join('\n');
                        }
                      }
                      return '';
                    };

                    const populated = {
                      ...formData,
                      company_name: currentCase.company_name || '',
                      company_number: currentCase.company_number || '',
                      former_name: currentCase.company_name_changes?.[0]?.previous_name || '',
                      date_of_incorporation: currentCase.incorporation_date || '',
                      registered_address: currentCase.registered_office_address || '',
                      principal_trading_address: formatTradingAddress(),
                      principal_activity: currentCase.principal_activity || '',
                      date_ceasing_trade: currentCase.date_ceasing_trade || '',
                      geographical_extent: currentCase.geographical_extent || '',
                      introducer: currentCase.introducer || '',
                      controlling_interest_companies: currentCase.controlling_interest_companies || '',
                      other_group_companies: currentCase.other_group_companies || '',
                    };
                    setFormData(populated);
                    saveDebounced(populated);
                  }}
                  disabled={!caseData && !propCaseData}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Building className="w-4 h-4 mr-2" />
                  Populate from Companies House
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportToHTML}
                  className="border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export to HTML
                </Button>
              </div>
            </div>
            <p className="text-sm text-slate-500">Complete all sections of the AML & Ethics review</p>
          </div>
        )}
        
        {renderContent()}
      </div>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Signature</DialogTitle>
            <DialogDescription>
              Draw your signature below using your mouse or touchscreen
            </DialogDescription>
          </DialogHeader>
          <SignatureCanvasComponent
            onSave={(dataUrl) => {
              handleInputChange(currentSignatureField, dataUrl);
              setShowSignatureDialog(false);
              setCurrentSignatureField(null);
            }}
            onCancel={() => {
              setShowSignatureDialog(false);
              setCurrentSignatureField(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}