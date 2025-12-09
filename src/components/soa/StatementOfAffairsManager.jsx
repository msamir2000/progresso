import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, ChevronRight, Trash2, Lock, Unlock, FileDown, RefreshCw, Users, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


// Renamed component from DeclarationOfSolvencyManager to StatementOfAffairsManager as per outline context
export default function StatementOfAffairsManager({ caseId, onUpdate }) {
  // New states introduced by the outline
  const [isLoading, setIsLoading] = useState(false);
  const [soaVersions, setSoaVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [error, setError] = useState(null);

  // Existing states from DeclarationOfSolvencyManager, now managed within currentData or used for calculations/suggestions
  const [sectionsExpanded, setSectionsExpanded] = useState({
    assets: true,
    liabilities: false,
    creditors: false,
    members: false // New section expanded state
  });

  const [isLocked, setIsLocked] = useState(false);
  const [accountCodes, setAccountCodes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState({});
  const [accountsLoading, setAccountsLoading] = useState(true);

  // These will serve as source data for calculations and initial population of currentData
  const [creditors, setCreditors] = useState([]); // All fetched creditors
  const [employees, setEmployees] = useState([]); // All fetched employees
  const [caseData, setCaseData] = useState(null); // Case data

  // Retry logic with exponential backoff
  const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const is429 = error?.message?.includes('429') || error?.status === 429;
        if (is429 && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  };

  // Debounced save to prevent rapid-fire saves
  const saveTimeoutRef = React.useRef(null);
  const saveToDatabase = async (dataToSave) => {
    if (!caseId) return;
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounce the save by 500ms
    return new Promise((resolve, reject) => {
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await retryWithBackoff(async () => {
            const versionToSave = currentVersion === null ? 1 : currentVersion;
            const soaRecords = await base44.entities.StatementOfAffairs.filter({
              case_id: caseId,
              version: versionToSave
            });

            if (soaRecords.length > 0) {
              await base44.entities.StatementOfAffairs.update(soaRecords[0].id, {
                data: dataToSave,
                as_at_date: new Date().toISOString().split('T')[0]
              });
              console.log('✅ Statement of Affairs saved immediately');
            } else {
              const newSoa = await base44.entities.StatementOfAffairs.create({
                case_id: caseId,
                version: versionToSave,
                as_at_date: new Date().toISOString().split('T')[0],
                data: dataToSave
              });
              setCurrentVersion(newSoa.version);
              console.log('✅ Statement of Affairs created immediately');
            }
          });
          resolve();
        } catch (error) {
          console.error('❌ Error saving Statement of Affairs:', error);
          reject(error);
        }
      }, 500);
    });
  };

  const parseNumber = useCallback((value) => {
    if (!value || value === '') return 0;
    const num = parseFloat(value.toString().replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? 0 : num;
  }, []);

  // NEW: Helper function to parse ETR values - treats "uncertain" as 0
  const parseETRValue = useCallback((value) => {
    if (!value || value === '') return 0;
    if (typeof value === 'string' && value.toLowerCase() === 'uncertain') return 0;
    return parseNumber(value);
  }, [parseNumber]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB'); // Or any desired format
    } catch (error) {
        console.error("Error formatting date:", error);
        return dateString; // Return original if invalid
    }
  }, []);

  // Helper to construct the full address string
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    // Handle cases where address is already a string
    if (typeof address === 'string') {
      return address;
    }
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.county,
      address.postcode
    ].filter(Boolean); // Filter out null/undefined/empty strings
    return parts.join(', ');
  }, []);

  // Initial structure for a new Statement of Affairs entry
  const getEmptyDataStructure = useCallback(() => ({
    scheduleA: {
      chargeHolderSections: [
      {
        id: Date.now(),
        assets: {
          fixed: [{ id: `fixed-init-${Date.now()}`, name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }]
        },
        creditors: {
          fixed: [{ name: '', amount: 0 }]
        },
        fixed_charge_surplus: 0
      }
      ],
      globalAssets: {
      floating: [
        { id: `floating-init-${Date.now()}`, name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }
      ],
      uncharged: [
        { id: `uncharged-init-${Date.now()}`, name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }
      ]
      }
    },
    // Schedule C and D will be populated from source data if no existing SoA is found
    scheduleC: {
      companyCreditors: [],
      consumerCreditors: [],
      employeeCreditors: []
    },
    scheduleD: { // Updated structure for shareholders
      shareholders: []
    }
  }), []);

  // currentData now holds the main editable state of the Statement of Affairs
  const [currentData, setCurrentData] = useState(getEmptyDataStructure());

  // Derived states for UI from currentData for clarity, matching original DeclarationOfSolvencyManager
  const chargeHolderSections = currentData.scheduleA.chargeHolderSections;
  const globalAssetsData = currentData.scheduleA.globalAssets;
  const companyCreditorsData = currentData.scheduleC.companyCreditors;
  const consumerCreditorsData = currentData.scheduleC.consumerCreditors;
  const employeeCreditorsData = currentData.scheduleC.employeeCreditors;


  // Load initial data and Statement of Affairs versions
  useEffect(() => {
    const loadAccountCodes = async () => {
      try {
        setAccountsLoading(true);
        
        // Check sessionStorage first
        const cachedAccounts = sessionStorage.getItem('chart_of_accounts');
        if (cachedAccounts) {
          console.log('📦 Using cached Chart of Accounts from sessionStorage');
          setAccountCodes(JSON.parse(cachedAccounts));
          setAccountsLoading(false);
          return;
        }
        
        const accounts = await base44.entities.ChartOfAccount.list('account_code');
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          setAccountCodes(accounts);
          sessionStorage.setItem('chart_of_accounts', JSON.stringify(accounts));
          console.log('✅ Chart of Accounts loaded and cached');
        } else {
          setAccountCodes([]);
        }
      } catch (error) {
        console.error('Error loading account codes:', error);
        setAccountCodes([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    const loadSoaData = async () => {
      if (!caseId) return;

      // Check localStorage first for cached SoA data
      try {
        const cachedSoaKeys = Object.keys(localStorage).filter(key => key.startsWith(`soa_data_${caseId}_v`));
        if (cachedSoaKeys.length > 0) {
          // Get the highest version
          const versions = cachedSoaKeys.map(key => {
            const match = key.match(/soa_data_.*_v(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          const latestVersion = Math.max(...versions);
          const cachedData = localStorage.getItem(`soa_data_${caseId}_v${latestVersion}`);
          
          if (cachedData) {
            console.log('📦 Using cached Statement of Affairs from localStorage (v' + latestVersion + ')');
            const loadedData = JSON.parse(cachedData);
            setCurrentData(loadedData);
            setCurrentVersion(latestVersion);
            
            // Load account codes in background
            loadAccountCodes();
            
            // Load creditors and employees in background for calculations
            setTimeout(async () => {
              try {
                const [cred, emp, caseRes] = await Promise.all([
                  retryWithBackoff(() => base44.entities.Creditor.filter({ case_id: caseId })),
                  retryWithBackoff(() => base44.entities.Employee.filter({ case_id: caseId })),
                  retryWithBackoff(() => base44.entities.Case.filter({ id: caseId }).then(cases => cases?.[0] || null))
                ]);
                const processedCred = (cred || []).map(c => ({ ...c, creditor_address: formatAddress(c.address) }));
                const processedEmp = (emp || []).map(e => ({ ...e, total_claim: (parseNumber(e.total_preferential_claim) || 0) + (parseNumber(e.total_unsecured_claim) || 0), full_address: formatAddress(e.address) }));
                setCreditors(processedCred);
                setEmployees(processedEmp);
                setCaseData(caseRes);
              } catch (e) {
                console.error('Background data load error:', e);
              }
            }, 100);
            
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Failed to load from localStorage:', e);
      }

      setIsLoading(true);
      setError(null);
      
      // Load account codes first (uses cache if available)
      loadAccountCodes();
      
      try {
        console.log('Loading Statement of Affairs data for case:', caseId);
        
        // Check sessionStorage for case data first
        const cacheKey = `case_data_${caseId}`;
        const cachedCase = sessionStorage.getItem(cacheKey);
        let caseResponse = null;
        
        if (cachedCase) {
          console.log('📦 Using cached case data from sessionStorage');
          caseResponse = JSON.parse(cachedCase);
        }
        
        // Only fetch what we don't have cached
        const fetchPromises = [
          base44.entities.StatementOfAffairs.filter({ case_id: caseId }, '-version').catch(err => {
            console.error('Error loading SoA records:', err);
            return [];
          })
        ];
        
        // Only fetch case if not cached
        if (!caseResponse) {
          fetchPromises.push(
            base44.entities.Case.filter({ id: caseId }).then(cases => {
              const c = cases?.[0] || null;
              if (c) sessionStorage.setItem(cacheKey, JSON.stringify(c));
              return c;
            }).catch(err => {
              console.error('Error loading case:', err);
              return null;
            })
          );
        } else {
          fetchPromises.push(Promise.resolve(caseResponse));
        }
        
        // Fetch creditors and employees with increased delays to avoid rate limits
        fetchPromises.push(
          new Promise(resolve => setTimeout(async () => {
            try {
              const result = await retryWithBackoff(() => base44.entities.Creditor.filter({ case_id: caseId }));
              resolve(result);
            } catch (err) {
              console.error('Error loading creditors:', err);
              resolve([]);
            }
          }, 500))
        );
        
        fetchPromises.push(
          new Promise(resolve => setTimeout(async () => {
            try {
              const result = await retryWithBackoff(() => base44.entities.Employee.filter({ case_id: caseId }));
              resolve(result);
            } catch (err) {
              console.error('Error loading employees:', err);
              resolve([]);
            }
          }, 1000))
        );
        
        const [soaRecords, caseResponseFinal, allCreditorsResponse, allEmployeesResponse] = await Promise.all(fetchPromises);
        caseResponse = caseResponseFinal;

        console.log('=== ADM SOA DATA LOAD DEBUG ===');
        console.log('Total SoA versions found:', soaRecords?.length || 0);
        if (soaRecords && soaRecords.length > 0) {
          console.log('All versions:', soaRecords.map(s => ({ version: s.version, id: s.id })));
          console.log('Latest version (first record):', soaRecords[0]?.version);
          console.log('Latest version ID:', soaRecords[0]?.id);
          console.log('Latest version uncharged assets count:', soaRecords[0]?.data?.scheduleA?.globalAssets?.uncharged?.length || 0);
          console.log('Latest version uncharged assets DATA:', JSON.stringify(soaRecords[0]?.data?.scheduleA?.globalAssets?.uncharged || [], null, 2));
        }
        console.log('Case found:', !!caseResponse);
        console.log('Creditors loaded:', allCreditorsResponse?.length || 0);
        console.log('Employees loaded:', allEmployeesResponse?.length || 0);
        console.log('=========================');

        setSoaVersions((soaRecords || []).sort((a, b) => b.version - a.version));
        setCaseData(caseResponse);

        // Process all creditors to include a formatted address string for calculations and future use
        const processedAllCreditors = (allCreditorsResponse || []).map(c => {
          return { ...c, creditor_address: formatAddress(c.address) };
        });
        setCreditors(processedAllCreditors);

        // Process all employees to include a formatted address string for calculations and future use
        const processedAllEmployees = (allEmployeesResponse || []).map(emp => {
          const totalClaim = (parseNumber(emp.total_preferential_claim) || 0) + (parseNumber(emp.total_unsecured_claim) || 0);
          return { ...emp, total_claim: totalClaim, full_address: formatAddress(emp.address) };
        });
        setEmployees(processedAllEmployees);

        if (soaRecords.length > 0) {
          const latest = soaRecords[0];
          setCurrentVersion(latest.version);
          
          // Load the complete data structure from database
          const loadedData = latest.data || getEmptyDataStructure();
          
          // Ensure all required structures exist
          if (!loadedData.scheduleA) {
            loadedData.scheduleA = getEmptyDataStructure().scheduleA;
          }
          if (!loadedData.scheduleA.chargeHolderSections || loadedData.scheduleA.chargeHolderSections.length === 0) {
            loadedData.scheduleA.chargeHolderSections = getEmptyDataStructure().scheduleA.chargeHolderSections;
          }
          if (!loadedData.scheduleA.globalAssets) {
            loadedData.scheduleA.globalAssets = getEmptyDataStructure().scheduleA.globalAssets;
          }
          if (!loadedData.scheduleC) {
            loadedData.scheduleC = getEmptyDataStructure().scheduleC;
          }
          if (!loadedData.scheduleD) {
            loadedData.scheduleD = getEmptyDataStructure().scheduleD;
          }
          
          // Migrate old data: ensure all assets have unique IDs
          let idCounter = 0;
          loadedData.scheduleA.chargeHolderSections = loadedData.scheduleA.chargeHolderSections.map(section => ({
            ...section,
            assets: {
              ...section.assets,
              fixed: section.assets.fixed.map(asset => ({
                ...asset,
                id: asset.id || `fixed-${Date.now()}-${idCounter++}`
              }))
            }
          }));
          
          loadedData.scheduleA.globalAssets.floating = loadedData.scheduleA.globalAssets.floating.map(asset => ({
            ...asset,
            id: asset.id || `floating-${Date.now()}-${idCounter++}`
          }));
          
          loadedData.scheduleA.globalAssets.uncharged = loadedData.scheduleA.globalAssets.uncharged.map(asset => ({
            ...asset,
            id: asset.id || `uncharged-${Date.now()}-${idCounter++}`
          }));
          
          console.log('=== ADM SOA - VERSION LOADED ===');
          console.log('Version:', latest.version);
          console.log('Version ID:', latest.id);
          
          // localStorage caching removed due to serialization issues - using database data
          
          console.log('Fixed Assets Count:', loadedData.scheduleA?.chargeHolderSections?.[0]?.assets?.fixed?.length || 0);
          console.log('Floating Assets Count:', loadedData.scheduleA?.globalAssets?.floating?.length || 0);
          console.log('Uncharged Assets Count:', loadedData.scheduleA?.globalAssets?.uncharged?.length || 0);
          console.log('Uncharged Assets FULL DATA:', JSON.stringify(loadedData.scheduleA?.globalAssets?.uncharged || [], null, 2));
          console.log('================================');
          
          // Auto-populate shareholders from case data if SoA has none
          let shareholdersToUse = (loadedData.scheduleD?.shareholders || []);
          if (shareholdersToUse.length === 0 && caseResponse?.shareholders && caseResponse.shareholders.length > 0) {
            shareholdersToUse = caseResponse.shareholders.map(sh => ({
              name: sh.name || '',
              address: formatAddress(sh.address) || '',
              share_class: sh.share_type || sh.share_class || 'Ordinary',
              shares_held: parseNumber(sh.shares_held) || 0,
              nominal_value_per_share: parseNumber(sh.nominal_value) / 100 || 0,
              amount_paid: 0,
              amount_unpaid: 0
            }));
            loadedData.scheduleD.shareholders = shareholdersToUse;
          }
          
          console.log('✅ Loaded Statement of Affairs:', {
            version: latest.version,
            fixedAssets: loadedData.scheduleA?.chargeHolderSections?.[0]?.assets?.fixed?.length || 0,
            floatingAssets: loadedData.scheduleA?.globalAssets?.floating?.length || 0,
            unchargedAssets: loadedData.scheduleA?.globalAssets?.uncharged?.length || 0
          });
          
          // Save to localStorage for offline access
          try {
            localStorage.setItem(`soa_data_${caseId}_v${latest.version}`, JSON.stringify(loadedData));
            console.log('💾 Statement of Affairs cached in localStorage');
          } catch (e) {
            console.warn('Failed to cache SoA in localStorage:', e);
          }
          
          setCurrentData(loadedData);
        } else {
          // Initialize empty structure and populate with current data from related entities
          const emptyStructure = getEmptyDataStructure();

          // Populate Schedule C with current creditors
          const companyCreditorsInitial = processedAllCreditors.filter(c => c.creditor_type !== 'consumer').map(c => ({
            name: c.creditor_name || '',
            address: c.creditor_address || '', // Fix applied here using processed creditor data
            amount: c.balance_owed || 0,
            retention_of_title: c.retention_of_title || false, // Assuming field exists
            security_details: c.security_type || '', // Changed from c.security_details as per typical structure
            security_date: c.security_date_of_creation || '',
            security_value: c.security_value || 0
          }));

          const consumerCreditorsInitial = processedAllCreditors.filter(c => c.creditor_type === 'consumer').map(c => ({
            name: c.creditor_name || '',
            address: c.creditor_address || '', // Fix applied here using processed creditor data
            amount: c.balance_owed || 0,
            security_details: c.security_type || '', // Changed from c.security_details as per typical structure
            security_date: c.security_date_of_creation || '',
            security_value: c.security_value || 0
          }));

          const employeeCreditorsInitial = processedAllEmployees.map(emp => ({
            name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`,
            address: emp.full_address || '', // Fix applied here using processed employee data
            amount: emp.total_claim || 0
          }));

          emptyStructure.scheduleC = {
            companyCreditors: companyCreditorsInitial,
            consumerCreditors: consumerCreditorsInitial,
            employeeCreditors: employeeCreditorsInitial
          };

          // Populate Schedule D with shareholders - adapted to new structure
          emptyStructure.scheduleD.shareholders = (caseResponse?.shareholders || []).map(sh => ({
            name: sh.name || '',
            address: formatAddress(sh.address) || '', // Ensure address is a string
            share_class: sh.share_type || sh.share_class || 'Ordinary', // Use share_class
            shares_held: parseNumber(sh.shares_held) || 0,
            nominal_value_per_share: parseNumber(sh.nominal_value) / 100 || 0, // Convert pence to pounds
            amount_paid: 0, // Initialize new field
            amount_unpaid: 0 // Initialize new field
          }));

          setCurrentData(emptyStructure);
        }
      } catch (err) {
        console.error('Error loading SoA data:', err);
        setError('Failed to load Statement of Affairs data');
        setCurrentData(getEmptyDataStructure()); // Ensure currentData is initialized even on error
      } finally {
        setIsLoading(false);
      }
    };

    loadSoaData();
  }, [caseId, getEmptyDataStructure, parseNumber, formatAddress]); // Added formatAddress to dependencies

  // localStorage auto-save removed to prevent serialization issues
  // Data is saved to database on explicit save action

  // Handlers for modifying currentData
  const updateCurrentData = useCallback((path, value) => {
    setCurrentData(prev => {
      const newData = { ...prev };
      let current = newData;
      const parts = path.split('.');
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return newData;
    });
  }, []);

  const updateAsset = useCallback((sectionId, assetType, index, field, value) => {
    if (isLocked) return;
    
    setCurrentData(prev => {
      const newData = JSON.parse(JSON.stringify(prev)); // Deep clone to avoid mutation
      
      // Special handling for etr_value to allow "uncertain"
      let processedValue = value;
      if (field === 'book_value') {
        processedValue = parseNumber(value);
      } else if (field === 'etr_value') {
        // Allow any string that contains letters (for typing "uncertain")
        if (typeof value === 'string' && /[a-zA-Z]/.test(value)) {
          processedValue = value.toLowerCase();
        } else {
          processedValue = parseNumber(value);
        }
      }

      if (sectionId) { // Fixed charge assets
        const sectionIdx = newData.scheduleA.chargeHolderSections.findIndex(s => s.id === sectionId);
        if (sectionIdx !== -1 && newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index]) {
          newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index][field] = processedValue;
        }
      } else { // Global assets (floating/uncharged)
        if (newData.scheduleA.globalAssets[assetType][index]) {
          newData.scheduleA.globalAssets[assetType][index][field] = processedValue;
        }
      }
      
      // Save to localStorage after state update
      try {
        if (currentVersion) {
          localStorage.setItem(`soa_data_${caseId}_v${currentVersion}`, JSON.stringify(newData));
        }
      } catch (e) {
        console.warn('Failed to cache update:', e);
      }
      
      return newData;
    });
  }, [isLocked, parseNumber, caseId, currentVersion]);

  const handleAssetDescriptionChange = useCallback((sectionId, assetType, index, value) => {
    if (isLocked) return;
    updateAsset(sectionId, assetType, index, 'name', value);

    const suggestionKey = sectionId
      ? `${sectionId}-${assetType}-${index}`
      : `${assetType}-${index}`;

    setShowSuggestions(prev => ({
      ...prev,
      [suggestionKey]: value && value.length >= 1
    }));
  }, [isLocked, updateAsset]);

  const selectAccountFromSuggestion = useCallback((sectionId, assetType, index, account) => {
    if (isLocked) return;
    if (!account) return;

    setCurrentData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      
      if (sectionId) {
        const sectionIdx = newData.scheduleA.chargeHolderSections.findIndex(s => s.id === sectionId);
        if (sectionIdx !== -1 && newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index]) {
          newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index].name = account.account_name;
          newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index].account_code = account.account_code;
          newData.scheduleA.chargeHolderSections[sectionIdx].assets[assetType][index].description = account.account_name;
        }
      } else {
        if (newData.scheduleA.globalAssets[assetType][index]) {
          newData.scheduleA.globalAssets[assetType][index].name = account.account_name;
          newData.scheduleA.globalAssets[assetType][index].account_code = account.account_code;
          newData.scheduleA.globalAssets[assetType][index].description = account.account_name;
        }
      }
      return newData;
    });

    const suggestionKey = sectionId
      ? `${sectionId}-${assetType}-${index}`
      : `${assetType}-${index}`;

    setShowSuggestions(prev => ({
      ...prev,
      [suggestionKey]: false
    }));
  }, [isLocked, caseId]);

  const getAssetAccountSuggestions = useCallback((description, chargeType) => {
    if (accountsLoading) return [];

    const searchTerm = description ? description.toLowerCase().trim() : '';

    let relevantAccounts = accountCodes.filter(acc => {
      const group = (acc.account_group || '').toLowerCase();
      const name = (acc.account_name || '').toLowerCase();

      if (chargeType === 'fixed_charge') {
        // Show accounts with "Fixed Charge Realisations" (exact match)
        return group === 'fixed charge realisations' || 
               name.includes('fixed charge realisations');
      } else if (chargeType === 'floating_charge' || chargeType === 'uncharged') {
        // Show accounts with "Asset Realisations" (exact match) but NOT "Fixed Charge"
        const hasAssetRealisations = group === 'asset realisations' || name.includes('asset realisations');
        const hasFixedCharge = group.includes('fixed charge') || name.includes('fixed charge');
        return hasAssetRealisations && !hasFixedCharge;
      }

      return false;
    });

    if (searchTerm) {
      const matchingAccounts = relevantAccounts.filter(acc => {
        const name = (acc.account_name || '').toLowerCase();
        const code = (acc.account_code || '').toLowerCase();
        return name.includes(searchTerm) || code.includes(searchTerm);
      });

      return matchingAccounts.length > 0 ? matchingAccounts.slice(0, 15) : relevantAccounts.slice(0, 15);
    }

    return relevantAccounts.slice(0, 15);
  }, [accountCodes, accountsLoading]);

  // Derived totals for schedule C for display
  const companyCreditorsTotal = useMemo(() => companyCreditorsData.reduce((sum, c) => sum + (parseNumber(c.amount) || 0), 0), [companyCreditorsData, parseNumber]);
  const companySecurityTotal = useMemo(() => companyCreditorsData.reduce((sum, c) => sum + (parseNumber(c.security_value) || 0), 0), [companyCreditorsData, parseNumber]);
  const consumerCreditorsTotal = useMemo(() => consumerCreditorsData.reduce((sum, c) => sum + (parseNumber(c.amount) || 0), 0), [consumerCreditorsData, parseNumber]);
  const consumerSecurityTotal = useMemo(() => consumerCreditorsData.reduce((sum, c) => sum + (parseNumber(c.security_value) || 0), 0), [consumerCreditorsData, parseNumber]);
  const employeeCreditorsTotal = useMemo(() => employeeCreditorsData.reduce((sum, e) => sum + (parseNumber(e.amount) || 0), 0), [employeeCreditorsData, parseNumber]);


  // Asset calculations
  const totalFixedChargeAssetsBook = useMemo(() => {
    return chargeHolderSections.reduce((sectionSum, section) =>
      sectionSum + section.assets.fixed.reduce((assetSum, asset) =>
        assetSum + parseNumber(asset.book_value), 0
      ), 0
    );
  }, [chargeHolderSections, parseNumber]);

  const totalFixedChargeAssetsEtr = useMemo(() => {
    return chargeHolderSections.reduce((sectionSum, section) =>
      sectionSum + section.assets.fixed.reduce((assetSum, asset) =>
        assetSum + parseETRValue(asset.etr_value), 0
      ), 0
    );
  }, [chargeHolderSections, parseETRValue]);

  const totalFloatingChargeAssetsBook = useMemo(() => {
    return globalAssetsData.floating.reduce((sum, asset) =>
      sum + parseNumber(asset.book_value), 0
    );
  }, [globalAssetsData.floating, parseNumber]);

  const totalFloatingChargeAssetsEtr = useMemo(() => {
    return globalAssetsData.floating.reduce((sum, asset) =>
      sum + parseETRValue(asset.etr_value), 0
    );
  }, [globalAssetsData.floating, parseETRValue]);

  const totalUnchargedAssetsBook = useMemo(() => {
    return globalAssetsData.uncharged.reduce((sum, asset) =>
      sum + parseNumber(asset.book_value), 0
    );
  }, [globalAssetsData.uncharged, parseNumber]);

  const totalUnchargedAssetsEtr = useMemo(() => {
    return globalAssetsData.uncharged.reduce((sum, asset) =>
      sum + parseETRValue(asset.etr_value), 0
    );
  }, [globalAssetsData.uncharged, parseETRValue]);

  const calculatedTotalAssetsForPreferentialCreditors = useMemo(() => {
    const fixedSurplusSum = chargeHolderSections.reduce((sum, section) =>
        sum + (parseNumber(section.fixed_charge_surplus) || 0), 0
    );
    const floatingAssetsEtr = totalFloatingChargeAssetsEtr;
    const unchargedAssetsEtr = totalUnchargedAssetsEtr;

    return fixedSurplusSum + floatingAssetsEtr + unchargedAssetsEtr;
  }, [chargeHolderSections, totalFloatingChargeAssetsEtr, totalUnchargedAssetsEtr, parseNumber]);

  // NEW: Calculate unsecured amounts from fixed charge sections (creditors without proper security)
  const unsecuredFromFixedSections = useMemo(() => {
    let total = 0;
    
    chargeHolderSections.forEach(section => {
      section.creditors.fixed.forEach(creditor => {
        if (!creditor.name || creditor.amount === 0) return;
        
        // Find this creditor in the database
        const dbCreditor = creditors.find(c => 
          c.creditor_name && creditor.name &&
          c.creditor_name.toLowerCase().trim() === creditor.name.toLowerCase().trim()
        );
        
        if (dbCreditor) {
          const securityType = (dbCreditor.security_type || '').toLowerCase();
          const isSecured = dbCreditor.creditor_type === 'secured';
          const hasFixedCharge = securityType.includes('fixed');
          const hasFloatingCharge = securityType.includes('floating');
          
          // If creditor doesn't have fixed OR floating charge, treat as unsecured
          // The outline specified !isSecured || (!hasFixedCharge && !hasFloatingCharge)
          // Also, creditors are listed as positive amounts, so sum Math.abs()
          if (!isSecured || (!hasFixedCharge && !hasFloatingCharge)) {
            total += Math.abs(parseNumber(creditor.amount));
          }
        }
      });
    });
    
    return total;
  }, [chargeHolderSections, creditors, parseNumber]);

  // Creditor/Liability calculations (using the main `creditors` and `employees` states as source of truth for these calculations)
  const calculatedMoratoriumDebts = useMemo(() => {
    return creditors
      .filter(c => c.creditor_type === 'moratorium' && c.moratorium_debt === 'Post Moratorium Debt')
      .reduce((sum, c) => sum + (parseNumber(c.balance_owed) || 0), 0);
  }, [creditors, parseNumber]);

  const calculatedPriorityPreMoratoriumDebts = useMemo(() => {
    return creditors
      .filter(c => c.creditor_type === 'moratorium' && c.moratorium_debt === 'Pre Moratorium')
      .reduce((sum, c) => sum + (parseNumber(c.balance_owed) || 0), 0);
  }, [creditors, parseNumber]);

  const calculatedEmployeeClaimsPreferential = useMemo(() => {
    return employees.reduce((sum, emp) => sum + (parseNumber(emp.total_preferential_claim) || 0), 0);
  }, [employees, parseNumber]);

  const calculatedHmrcClaimsSecondaryPreferential = useMemo(() => {
    return creditors
      .filter(c => c.creditor_type === 'secondary_preferential')
      .reduce((sum, c) => sum + (parseNumber(c.balance_owed) || 0), 0);
  }, [creditors, parseNumber]);

  // UPDATED: Modified to exclude creditors already in fixed sections AND don't have floating charges
  const calculatedBankFloatingCharges = useMemo(() => {
    // Get all creditor names from fixed charge sections
    const fixedSectionCreditorNames = new Set();
    chargeHolderSections.forEach(section => {
      section.creditors.fixed.forEach(creditor => {
        if (creditor.name) {
          fixedSectionCreditorNames.add(creditor.name.toLowerCase().trim());
        }
      });
    });

    return creditors
      .filter(c => {
        const securityType = (c.security_type || '').toLowerCase();
        const hasFloatingCharge = c.creditor_type === 'secured' && (
          securityType.includes('floating') ||
          securityType.includes('fixed & floating')
        );
        
        // Exclude if this creditor is already listed in fixed sections
        const isInFixedSection = fixedSectionCreditorNames.has((c.creditor_name || '').toLowerCase().trim());
        
        return hasFloatingCharge && !isInFixedSection;
      })
      .reduce((sum, c) => sum + (parseNumber(c.balance_owed) || 0), 0);
  }, [creditors, chargeHolderSections, parseNumber]);

  const calculatedUnsecuredEmployeeClaims = useMemo(() => {
    return employees.reduce((sum, emp) => sum + (parseNumber(emp.total_unsecured_claim) || 0), 0);
  }, [employees, parseNumber]);

  const unsecuredCreditorsByType = useMemo(() => {
    const types = {};

    creditors
      .filter(c => c.creditor_type === 'unsecured' && c.unsecured_creditor_type)
      .forEach(creditor => {
        const type = creditor.unsecured_creditor_type;
        if (!types[type]) {
          types[type] = {
            total: 0,
            count: 0
          };
        }
        types[type].total += parseNumber(creditor.balance_owed) || 0;
        types[type].count += 1;
      });

    return types;
  }, [creditors, parseNumber]);

  const calculatedTradeExpenseCreditors = useMemo(() => {
    return unsecuredCreditorsByType.trade_expense?.total || 0;
  }, [unsecuredCreditorsByType]);

  const calculatedTradeCreditors = useMemo(() => {
    return unsecuredCreditorsByType.trade_expense?.total || 0;
  }, [unsecuredCreditorsByType]);

  const calculatedOtherUnsecuredCreditors = useMemo(() => {
    let sum = 0;
    for (const type in unsecuredCreditorsByType) {
      if (type !== 'trade_expense') {
        sum += unsecuredCreditorsByType[type].total;
      }
    }
    return sum;
  }, [unsecuredCreditorsByType]);

  const calculatedIssuedCalledUpCapital = useMemo(() => {
    const shareholders = currentData.scheduleD.shareholders;
    if (!shareholders || shareholders.length === 0) {
      return null;
    }

    const totalCapital = shareholders.reduce((sum, shareholder) => {
      const sharesHeld = parseNumber(shareholder.shares_held) || 0;
      const nominalValuePerShare = parseNumber(shareholder.nominal_value_per_share) || 0; // Now in pounds
      // Assuming amount_paid is the called up amount for now if it exists, otherwise use nominal value
      const amountPaid = parseNumber(shareholder.amount_paid) || 0;
      const amountUnpaid = parseNumber(shareholder.amount_unpaid) || 0;

      // If amount_paid and amount_unpaid are specified, use their sum, otherwise use sharesHeld * nominal_value_per_share
      if (amountPaid > 0 || amountUnpaid > 0) {
        return sum + amountPaid + amountUnpaid;
      } else {
        return sum + (sharesHeld * nominalValuePerShare);
      }
    }, 0);

    return totalCapital;
  }, [currentData.scheduleD.shareholders, parseNumber]);

  // Aggregated/Derived calculations (following the flow of the Statement of Affairs)
  const totalMoratoriumClaim = useMemo(() => {
    return calculatedMoratoriumDebts + calculatedPriorityPreMoratoriumDebts;
  }, [calculatedMoratoriumDebts, calculatedPriorityPreMoratoriumDebts]);

  const totalPreferentialClaim = useMemo(() => {
    return calculatedEmployeeClaimsPreferential;
  }, [calculatedEmployeeClaimsPreferential]);

  const totalSecondaryPreferentialCreditors = useMemo(() => {
    return calculatedHmrcClaimsSecondaryPreferential;
  }, [calculatedHmrcClaimsSecondaryPreferential]);

  const estimatedDeficiencySurplusPreferentialCreditors = useMemo(() => {
    return calculatedTotalAssetsForPreferentialCreditors - totalMoratoriumClaim;
  }, [calculatedTotalAssetsForPreferentialCreditors, totalMoratoriumClaim]);

  const estimatedDeficiencySurplusAsRegardsPreferentialCreditors = useMemo(() => {
    return estimatedDeficiencySurplusPreferentialCreditors - totalPreferentialClaim;
  }, [estimatedDeficiencySurplusPreferentialCreditors, totalPreferentialClaim]);

  const estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors = useMemo(() => {
    return estimatedDeficiencySurplusAsRegardsPreferentialCreditors - totalSecondaryPreferentialCreditors;
  }, [estimatedDeficiencySurplusAsRegardsPreferentialCreditors, totalSecondaryPreferentialCreditors]);

  const calculatePrescribedPart = useCallback((netProperty) => {
    const netPropertyValue = parseNumber(netProperty);

    if (netPropertyValue <= 0) {
      return 0;
    }

    if (netPropertyValue < 10000) {
      return null; // For values less than £10,000, prescribed part is not applicable or 0 depending on interpretation
    }

    let prescribedPart = 0;
    prescribedPart = 5000;

    const remainder = netPropertyValue - 10000;
    if (remainder > 0) {
      prescribedPart += remainder * 0.2;
    }
    prescribedPart = Math.min(prescribedPart, 800000);
    return prescribedPart;
  }, [parseNumber]);

  const estimatedPrescribedPartOfNetProperty = useMemo(() => {
    return calculatePrescribedPart(estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors);
  }, [estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors, calculatePrescribedPart]);

  const estimatedTotalAssetsAvailableForFloatingChargeHolders = useMemo(() => {
    const ppValue = estimatedPrescribedPartOfNetProperty === null ? 0 : estimatedPrescribedPartOfNetProperty;
    return estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors - ppValue;
  }, [estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors, estimatedPrescribedPartOfNetProperty]);

  const totalFloatingChargeClaims = useMemo(() => {
    return calculatedBankFloatingCharges;
  }, [calculatedBankFloatingCharges]);

  const estimatedPrescribedPartOfNetPropertyBroughtDown = useMemo(() => {
    return estimatedPrescribedPartOfNetProperty;
  }, [estimatedPrescribedPartOfNetProperty]);

  const estimatedDeficiencySurplusAfterFloatingCharges = useMemo(() => {
    return estimatedTotalAssetsAvailableForFloatingChargeHolders - totalFloatingChargeClaims;
  }, [estimatedTotalAssetsAvailableForFloatingChargeHolders, totalFloatingChargeClaims]);

  const estimatedDeficiencySurplusAsRegardsUnsecuredCreditors = useMemo(() => {
    const ppBroughtDownValue = estimatedPrescribedPartOfNetPropertyBroughtDown === null ? 0 : estimatedPrescribedPartOfNetPropertyBroughtDown;
    return estimatedDeficiencySurplusAfterFloatingCharges + ppBroughtDownValue;
  }, [estimatedDeficiencySurplusAfterFloatingCharges, estimatedPrescribedPartOfNetPropertyBroughtDown]);

  // UPDATED: Add unsecured amounts from fixed sections to total unsecured claims
  const totalUnsecuredNonPreferentialClaims = useMemo(() => {
    return calculatedUnsecuredEmployeeClaims + calculatedTradeExpenseCreditors + calculatedOtherUnsecuredCreditors + unsecuredFromFixedSections;
  }, [calculatedUnsecuredEmployeeClaims, calculatedTradeExpenseCreditors, calculatedOtherUnsecuredCreditors, unsecuredFromFixedSections]);

  const estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors = useMemo(() => {
    return estimatedDeficiencySurplusAsRegardsUnsecuredCreditors - totalUnsecuredNonPreferentialClaims;
  }, [estimatedDeficiencySurplusAsRegardsUnsecuredCreditors, totalUnsecuredNonPreferentialClaims]);

  const totalIssuedCalledUpCapital = useMemo(() => {
    return calculatedIssuedCalledUpCapital !== null ? calculatedIssuedCalledUpCapital : 0;
  }, [calculatedIssuedCalledUpCapital]);

  const estimatedTotalDeficiencySurplusAsRegardsMembers = useMemo(() => {
    return estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors - totalIssuedCalledUpCapital;
  }, [estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors, totalIssuedCalledUpCapital]);

  const formatCurrency = (amount) => {
    if (amount === null) return 'N/A';
    if (amount === undefined) return '';

    const num = parseFloat(amount);
    if (isNaN(num)) return '';

    const absAmount = Math.abs(num);
    const rounded = Math.ceil(absAmount);
    const formatted = rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    if (num < 0) {
      return `(${formatted})`;
    }
    return formatted;
  };

  const formatNumber = (value) => {
    if (!value && value !== 0) return '';
    const num = parseFloat(value.toString().replace(/,/g, ''));
    const rounded = Math.ceil(num);
    return isNaN(rounded) ? '' : rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // UPDATED: Display function for ETR values
  const displayETRValue = (value) => {
    if (value === 'uncertain' || (typeof value === 'string' && value.toLowerCase() === 'uncertain')) {
      return 'uncertain';
    }
    if (!value && value !== 0) return '';
    return formatNumber(value);
  };

  const addAsset = (sectionId, assetType) => {
    if (isLocked) return;
    const newAsset = { id: `${Date.now()}-${Math.random()}`, name: '', account_code: '', book_value: 0, etr_value: 0, description: '' };

    setCurrentData(prev => {
      const newData = { ...prev };
      if (sectionId) { // Fixed charge assets
        newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section =>
          section.id === sectionId
            ? {
                ...section,
                assets: {
                  ...section.assets,
                  [assetType]: [...section.assets[assetType], newAsset]
                }
              }
            : section
        );
      } else { // Global assets (floating/uncharged)
        newData.scheduleA.globalAssets = {
          ...newData.scheduleA.globalAssets,
          [assetType]: [...newData.scheduleA.globalAssets[assetType], newAsset]
        };
      }
      
      // Save to localStorage
      try {
        if (currentVersion) {
          localStorage.setItem(`soa_data_${caseId}_v${currentVersion}`, JSON.stringify(newData));
        }
      } catch (e) {
        console.warn('Failed to cache:', e);
      }
      
      return newData;
    });
  };

  const removeLastAsset = (sectionId, assetType) => {
    if (isLocked) return;

    setCurrentData(prev => {
      const newData = { ...prev };
      if (sectionId) {
        newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section => {
          if (section.id === sectionId) {
            const currentAssets = section.assets[assetType];
            if (currentAssets.length > 0) {
              return {
                ...section,
                assets: {
                  ...section.assets,
                  [assetType]: currentAssets.slice(0, -1)
                }
              };
            }
          }
          return section;
        });
      } else {
        const currentAssets = newData.scheduleA.globalAssets[assetType];
        if (currentAssets.length > 0) {
          newData.scheduleA.globalAssets = {
            ...newData.scheduleA.globalAssets,
            [assetType]: currentAssets.slice(0, -1)
          };
        }
      }
      
      // Save to localStorage
      try {
        if (currentVersion) {
          localStorage.setItem(`soa_data_${caseId}_v${currentVersion}`, JSON.stringify(newData));
        }
      } catch (e) {
        console.warn('Failed to cache:', e);
      }
      
      return newData;
    });
  };

  const updateChargeholder = useCallback((sectionId, creditorType, index, field, value) => {
    if (isLocked) return;
    const processedValue = (field === 'amount') ? parseNumber(value) : value;

    setCurrentData(prev => {
      const newData = { ...prev };
      newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              creditors: {
                ...section.creditors,
                [creditorType]: section.creditors[creditorType].map((creditor, i) =>
                  i === index ? { ...creditor, [field]: processedValue } : creditor
                )
              }
            }
          : section
      );
      return newData;
    });
  }, [isLocked, parseNumber]);

  const updateChargeHolderSection = useCallback((sectionId, field, value) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newData = { ...prev };
      newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section =>
        section.id === sectionId
          ? { ...section, [field]: value }
          : section
      );
      return newData;
    });
  }, [isLocked]);

  const addChargeholder = (sectionId, creditorType) => {
    if (isLocked) return;
    const newCreditor = { name: '', amount: 0 };
    setCurrentData(prev => {
      const newData = { ...prev };
      newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              creditors: {
                ...section.creditors,
                [creditorType]: [...section.creditors[creditorType], newCreditor]
              }
            }
          : section
        );
      return newData;
    });
  };

  const removeLastChargeholder = useCallback((sectionId, creditorType) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newData = { ...prev };
      newData.scheduleA.chargeHolderSections = newData.scheduleA.chargeHolderSections.map(section => {
        if (section.id === sectionId) {
          const currentCreditors = section.creditors[creditorType];
          if (currentCreditors && currentCreditors.length > 0) {
            return {
              ...section,
              creditors: {
                ...section.creditors,
                [creditorType]: currentCreditors.slice(0, -1)
              }
            };
          }
        }
        return section;
      });
      return newData;
    });
  }, [isLocked]);

  const addChargeHolderSection = useCallback(() => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newSection = {
        id: Date.now(),
        assets: {
          fixed: [{ id: `fixed-new-${Date.now()}`, name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }]
        },
        creditors: {
          fixed: [{ name: '', amount: 0 }]
        },
        fixed_charge_surplus: 0
      };
      return {
        ...prev,
        scheduleA: {
          ...prev.scheduleA,
          chargeHolderSections: [...prev.scheduleA.chargeHolderSections, newSection]
        }
      };
    });
  }, [isLocked]);

  const removeLastChargeHolderSection = useCallback(() => {
    if (isLocked) return;
    setCurrentData(prev => {
      if (prev.scheduleA.chargeHolderSections.length > 1) {
        return {
          ...prev,
          scheduleA: {
            ...prev.scheduleA,
            chargeHolderSections: prev.scheduleA.chargeHolderSections.slice(0, -1)
          }
        };
      }
      return prev;
    });
  }, [isLocked]);

  const deleteChargeHolderSection = (sectionId) => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev,
      scheduleA: {
        ...prev.scheduleA,
        chargeHolderSections: prev.scheduleA.chargeHolderSections.filter(section => section.id !== sectionId)
      }
    }));
  };

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Helper functions for updating Schedule C creditors
  const updateCompanyCreditor = useCallback((index, field, value) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const updatedCreditors = [...prev.scheduleC.companyCreditors];
      const newCreditor = { ...updatedCreditors[index], [field]: value };
      updatedCreditors[index] = newCreditor;
      return { ...prev, scheduleC: { ...prev.scheduleC, companyCreditors: updatedCreditors } };
    });
  }, [isLocked]);

  const addCompanyCreditor = useCallback(() => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev,
      scheduleC: {
        ...prev.scheduleC,
        companyCreditors: [...prev.scheduleC.companyCreditors, {
          name: '', address: '', amount: 0, retention_of_title: false, security_details: '', security_date: '', security_value: 0
        }]
      }
    }));
  }, [isLocked]);

  const removeCompanyCreditor = useCallback((index) => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev,
      scheduleC: {
        ...prev.scheduleC,
        companyCreditors: prev.scheduleC.companyCreditors.filter((_, i) => i !== index)
      }
    }));
  }, [isLocked]);

  const updateConsumerCreditor = useCallback((index, field, value) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const updatedCreditors = [...prev.scheduleC.consumerCreditors];
      const newCreditor = { ...updatedCreditors[index], [field]: value };
      updatedCreditors[index] = newCreditor;
      return { ...prev, scheduleC: { ...prev.scheduleC, consumerCreditors: updatedCreditors } };
    });
  }, [isLocked]);

  const addConsumerCreditor = useCallback(() => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev, // Corrected from prev.scheduleC
      scheduleC: {
        ...prev.scheduleC,
        consumerCreditors: [...prev.scheduleC.consumerCreditors, {
          name: '', address: '', amount: 0, security_details: '', security_date: '', security_value: 0
        }]
      }
    }));
  }, [isLocked]);

  const removeConsumerCreditor = useCallback((index) => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev,
      scheduleC: {
        ...prev.scheduleC,
        consumerCreditors: prev.scheduleC.consumerCreditors.filter((_, i) => i !== index)
      }
    }));
  }, [isLocked]);

  const updateEmployeeCreditor = useCallback((index, field, value) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const updatedCreditors = [...prev.scheduleC.employeeCreditors];
      const newCreditor = { ...updatedCreditors[index], [field]: value };
      updatedCreditors[index] = newCreditor;
      return { ...prev, scheduleC: { ...prev.scheduleC, employeeCreditors: updatedCreditors } };
    });
  }, [isLocked]);

  const addEmployeeCreditor = useCallback(() => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev, // Corrected from prev.scheduleC
      scheduleC: {
        ...prev.scheduleC,
        employeeCreditors: [...prev.scheduleC.employeeCreditors, {
          name: '', address: '', amount: 0
        }]
      }
    }));
  }, [isLocked]);

  const removeEmployeeCreditor = useCallback((index) => {
    if (isLocked) return;
    setCurrentData(prev => ({
      ...prev,
      scheduleC: {
        ...prev.scheduleC,
        employeeCreditors: prev.scheduleC.employeeCreditors.filter((_, i) => i !== index)
      }
    }));
  }, [isLocked]);

  // General handler for array field changes, useful for members
  const handleArrayFieldChange = useCallback((sectionKey, index, field, value) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newData = { ...prev };
      // This assumes sectionKey directly maps to a top-level property of scheduleC/scheduleD
      // Example: 'scheduleD.shareholders'
      const parts = sectionKey.split('.');
      const arrayName = parts.pop(); // e.g., 'shareholders'
      const parentObject = parts.reduce((acc, part) => acc[part], newData); // e.g., newData.scheduleD

      if (parentObject && parentObject[arrayName]) {
        const updatedArray = [...parentObject[arrayName]];
        updatedArray[index] = { ...updatedArray[index], [field]: value };
        parentObject[arrayName] = updatedArray;
      }
      return newData;
    });
  }, [isLocked]);

  // General handler for adding a row to an array field
  const handleArrayAddRow = useCallback((sectionKey, newRowData) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newData = { ...prev };
      const parts = sectionKey.split('.');
      const arrayName = parts.pop();
      const parentObject = parts.reduce((acc, part) => acc[part], newData);

      if (parentObject && parentObject[arrayName]) {
        parentObject[arrayName] = [...parentObject[arrayName], newRowData];
      }
      return newData;
    });
  }, [isLocked]);

  // General handler for removing a row from an array field
  const handleArrayRemoveRow = useCallback((sectionKey, index) => {
    if (isLocked) return;
    setCurrentData(prev => {
      const newData = { ...prev };
      const parts = sectionKey.split('.');
      const arrayName = parts.pop();
      const parentObject = parts.reduce((acc, part) => acc[part], newData);

      if (parentObject && parentObject[arrayName]) {
        parentObject[arrayName] = parentObject[arrayName].filter((_, i) => i !== index);
      }
      return newData;
    });
  }, [isLocked]);


  // Function to sync currentData.scheduleC with the latest `creditors` and `employees` fetched from base44
  const handleSyncFromCreditors = async () => {
    if (!caseId) {
      alert('Case ID is missing, cannot sync creditors.');
      return;
    }

    setIsLoading(true);
    try {
      // Sequential with delays to avoid rate limiting
      const allCreditorsResponse = await retryWithBackoff(() => 
        base44.entities.Creditor.filter({ case_id: caseId })
      );
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const allEmployeesResponse = await retryWithBackoff(() =>
        base44.entities.Employee.filter({ case_id: caseId })
      );

      console.log('=== CREDITOR SYNC DEBUG ===');
      console.log('Total raw creditors fetched:', allCreditorsResponse.length);

      // Log ALL fields of first raw creditor, as per outline's debug request
      if (allCreditorsResponse[0]) {
        console.log('First RAW creditor - ALL FIELDS:');
        console.log(JSON.stringify(allCreditorsResponse[0], null, 2));
      }

      // Process all creditors to include a formatted address string for calculations and future use
      const processedAllCreditors = (allCreditorsResponse || []).map(c => {
        let addressToUse = '';
        if (c.creditor_address) { // Check if a specific formatted address field exists
            addressToUse = c.creditor_address;
        } else if (c.address) { // Otherwise, use the address object and format it
            addressToUse = formatAddress(c.address);
        }
        console.log(`Creditor "${c.creditor_name}" processed address:`, addressToUse);
        return { ...c, creditor_address: addressToUse };
      });
      setCreditors(processedAllCreditors);

      // Process all employees to include a formatted address string for calculations and future use
      const processedAllEmployees = (allEmployeesResponse || []).map(emp => {
        const totalClaim = (parseNumber(emp.total_preferential_claim) || 0) + (parseNumber(emp.total_unsecured_claim) || 0);
        return { ...emp, total_claim: totalClaim, full_address: formatAddress(emp.address) };
      });
      setEmployees(processedAllEmployees);

      console.log('Total processed creditors:', processedAllCreditors.length);

      // Log first 3 creditors in detail (already existing, kept for completeness)
      processedAllCreditors.slice(0, 3).forEach((cred, idx) => {
        console.log(`Processed Creditor ${idx + 1}:`);
        console.log('  Name:', cred.creditor_name);
        console.log('  Address (raw from DB):', cred.address);
        console.log('  Formatted Address (creditor_address):', cred.creditor_address);
        console.log('  Formatted Address type:', typeof cred.creditor_address);
        console.log('  Formatted Address length:', cred.creditor_address?.length || 0);
      });
      console.log('--- End of detailed processed creditors log ---');


      // Now use these freshly processed and updated states to populate currentData.scheduleC
      const companyCreditorsSynced = processedAllCreditors.filter(c => c.creditor_type !== 'consumer').map(c => ({
        name: c.creditor_name || '',
        address: c.creditor_address || '',
        amount: c.balance_owed || 0,
        retention_of_title: c.retention_of_title || false,
        security_details: c.security_type || '',
        security_date: c.security_date_of_creation || '',
        security_value: c.security_value || 0
      }));

      const consumerCreditorsSynced = processedAllCreditors.filter(c => c.creditor_type === 'consumer').map(c => ({
        name: c.creditor_name || '',
        address: c.creditor_address || '',
        amount: c.balance_owed || 0,
        security_details: c.security_type || '',
        security_date: c.security_date_of_creation || '',
        security_value: c.security_value || 0
      }));

      const employeeCreditorsSynced = processedAllEmployees.map(emp => ({
        name: emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`,
        address: emp.full_address || '',
        amount: emp.total_claim || 0
      }));

      console.log('First company creditor synced address:', companyCreditorsSynced[0]?.address);
      console.log('First consumer creditor synced address:', consumerCreditorsSynced[0]?.address);
      console.log('First employee creditor synced address:', employeeCreditorsSynced[0]?.address);
      console.log('=== END CREDITOR SYNC DEBUG ===');

      const updatedScheduleC = {
        companyCreditors: companyCreditorsSynced,
        consumerCreditors: consumerCreditorsSynced,
        employeeCreditors: employeeCreditorsSynced
      };

      const newDataForSave = {
        ...currentData,
        scheduleC: updatedScheduleC
      };

      setCurrentData(newDataForSave);
      alert('Successfully synced creditors from database. Changes saved to localStorage.');

    } catch (error) {
      console.error('Error syncing creditors:', error);
      alert('Failed to sync creditors: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncFromMembers = async () => {
    if (!caseId) {
      alert('Case ID is missing, cannot sync shareholders.');
      return;
    }
    if (!caseData || !caseData.shareholders || caseData.shareholders.length === 0) {
      alert('No shareholder data found in case information to sync.');
      return;
    }

    setIsLoading(true);
    try {
      // Map caseData.shareholders to the new structure for scheduleD.shareholders
      const shareholdersSynced = (caseData.shareholders || []).map(sh => ({
        name: sh.name || '',
        address: formatAddress(sh.address) || '', // Ensure address is string
        share_class: sh.share_type || sh.share_class || 'Ordinary', // Use share_class
        shares_held: parseNumber(sh.shares_held) || 0,
        nominal_value_per_share: parseNumber(sh.nominal_value) / 100 || 0, // Convert pence to pounds
        amount_paid: 0, // Initialize new field
        amount_unpaid: 0 // Initialize new field
      }));

      const updatedScheduleD = {
        shareholders: shareholdersSynced
      };

      const newDataForSave = {
        ...currentData,
        scheduleD: updatedScheduleD
      };

      setCurrentData(newDataForSave);
      alert('Successfully synced shareholders from database. Changes saved to localStorage.');
    } catch (error) {
      console.error('Error syncing shareholders:', error);
      alert('Failed to sync shareholders: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionChange = async (versionNumber) => {
    // This function is present in the outline but without implementation details.
    // Given no specific changes, we assume it's for selecting a different version
    // of the SOA, but the outline does not provide its body.
    // If this were a new function, it would need implementation.
    // Since it's shown as part of the existing code structure,
    // and no new implementation for it is given, we keep the original intent
    // (which is to be used, if present, by a versions dropdown not currently shown).
    // For now, no direct changes are applied to this function body as per outline.
  };

  const numberInputClassName = "h-8 text-lg border border-slate-200 rounded-md px-2 bg-white text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  const generateAssetsHTML = useCallback(() => {
    return `
      ${chargeHolderSections.map((section, idx) => `
        <table>
          <thead>
            <tr class="gold-header">
              <th style="width: 50%">Assets Subject to a Fixed Charge</th>
              <th style="width: 25%" class="text-right">Book Value (£)</th>
              <th style="width: 25%" class="text-right">Estimated to Realise (£)</th>
            </tr>
          </thead>
          <tbody>
            ${section.assets.fixed.filter(asset => asset.description || asset.name || asset.book_value !== 0 || asset.etr_value !== 0).map(asset => `
              <tr>
                <td>${asset.description || asset.name || ''}</td>
                <td class="text-right">${formatCurrency(parseNumber(asset.book_value))}</td>
                <td class="text-right">${displayETRValue(asset.etr_value)}</td>
              </tr>
            `).join('')}
            <tr class="font-bold">
              <td>Total Fixed Assets</td>
              <td class="text-right">${formatCurrency(section.assets.fixed.reduce((sum, a) => sum + parseNumber(a.book_value), 0))}</td>
              <td class="text-right">${formatCurrency(section.assets.fixed.reduce((sum, a) => sum + parseETRValue(a.etr_value), 0))}</td>
            </tr>
            <tr>
              <td colspan="3" class="font-bold">Less Amounts due to</td>
            </tr>
            ${section.creditors.fixed.filter(creditor => creditor.name || creditor.amount !== 0).map(creditor => `
              <tr>
                <td>${creditor.name}</td>
                <td class="text-right"></td>
                <td class="text-right">${formatCurrency(parseNumber(creditor.amount))}</td>
              </tr>
            `).join('')}
            <tr class="font-bold">
              <td>Total Fixed Charges</td>
              <td class="text-right"></td>
              <td class="text-right">${formatCurrency(section.creditors.fixed.reduce((sum, c) => sum + parseNumber(c.amount), 0))}</td>
            </tr>
            <tr class="font-bold blue-shaded">
              <td>Fixed Charge Surplus (Deficiency)</td>
              <td class="text-right"></td>
              <td class="text-right">${formatCurrency(parseNumber(section.fixed_charge_surplus))}</td>
            </tr>
          </tbody>
        </table>
      `).join('')}

      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 50%">Assets Subject to a Floating Charge</th>
            <th style="width: 25%" class="text-right">Book Value (£)</th>
            <th style="width: 25%" class="text-right">Estimated to Realise (£)</th>
          </tr>
        </thead>
        <tbody>
          ${globalAssetsData.floating.filter(asset => asset.description || asset.name || asset.book_value !== 0 || asset.etr_value !== 0).map(asset => `
            <tr>
              <td>${asset.description || asset.name || ''}</td>
              <td class="text-right">${formatCurrency(parseNumber(asset.book_value))}</td>
              <td class="text-right">${displayETRValue(asset.etr_value)}</td>
              </tr>
          `).join('')}
          <tr class="font-bold blue-shaded">
            <td>Total Assets Subject to Floating Charge</td>
            <td class="text-right">${formatCurrency(totalFloatingChargeAssetsBook)}</td>
            <td class="text-right">${formatCurrency(totalFloatingChargeAssetsEtr)}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 50%">Uncharged Assets</th>
            <th style="width: 25%" class="text-right">Book Value (£)</th>
            <th style="width: 25%" class="text-right">Estimated to Realise (£)</th>
          </tr>
        </thead>
        <tbody>
          ${globalAssetsData.uncharged.filter(asset => asset.description || asset.name || asset.book_value !== 0 || asset.etr_value !== 0).map(asset => `
            <tr>
              <td>${asset.description || asset.name || ''}</td>
              <td class="text-right">${formatCurrency(parseNumber(asset.book_value))}</td>
              <td class="text-right">${displayETRValue(asset.etr_value)}</td>
            </tr>
          `).join('')}
          <tr class="font-bold blue-shaded">
            <td>Total Uncharged Assets</td>
            <td class="text-right">${formatCurrency(totalUnchargedAssetsBook)}</td>
            <td class="text-right">${formatCurrency(totalUnchargedAssetsEtr)}</td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr class="font-bold blue-shaded">
            <td style="width: 75%">Estimated total assets available for moratorium, priority pre-moratorium and preferential creditors (carried from page A)</td>
            <td style="width: 25%" class="text-right">${formatCurrency(calculatedTotalAssetsForPreferentialCreditors)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [chargeHolderSections, parseNumber, formatCurrency, displayETRValue, parseETRValue, globalAssetsData, totalFloatingChargeAssetsBook, totalFloatingChargeAssetsEtr, totalUnchargedAssetsBook, totalUnchargedAssetsEtr, calculatedTotalAssetsForPreferentialCreditors]);

  const generateLiabilitiesHTML = useCallback(() => {
    // Get creditors from fixed sections that should be unsecured
    const unsecuredFromFixed = [];
    chargeHolderSections.forEach(section => {
      section.creditors.fixed.forEach(creditor => {
        if (!creditor.name || creditor.amount === 0) return;
        
        const dbCreditor = creditors.find(c => 
          c.creditor_name && creditor.name &&
          c.creditor_name.toLowerCase().trim() === creditor.name.toLowerCase().trim()
        );
        
        if (dbCreditor) {
          const securityType = (dbCreditor.security_type || '').toLowerCase();
          const isSecured = dbCreditor.creditor_type === 'secured';
          const hasFixedCharge = securityType.includes('fixed');
          const hasFloatingCharge = securityType.includes('floating');
          
          if (!isSecured || (!hasFixedCharge && !hasFloatingCharge)) {
            unsecuredFromFixed.push({
              name: creditor.name,
              amount: Math.abs(parseNumber(creditor.amount))
            });
          }
        }
      });
    });

    // Get only floating charge holders not already in fixed sections
    const fixedSectionCreditorNames = new Set();
    chargeHolderSections.forEach(section => {
      section.creditors.fixed.forEach(creditor => {
        if (creditor.name) {
          fixedSectionCreditorNames.add(creditor.name.toLowerCase().trim());
        }
      });
    });

    const floatingChargeHolders = creditors.filter(c => {
      const securityType = (c.security_type || '').toLowerCase();
      const hasFloatingCharge = c.creditor_type === 'secured' && (
        securityType.includes('floating') ||
        securityType.includes('fixed & floating')
      );
      const isInFixedSection = fixedSectionCreditorNames.has((c.creditor_name || '').toLowerCase().trim());
      
      return hasFloatingCharge && !isInFixedSection;
    });

    return `
      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 75%"></th>
            <th style="width: 25%" class="text-right">Estimated to Realise (£)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Estimated total assets available for moratorium, priority pre-moratorium and preferential creditors (carried from page A)</td>
            <td class="text-right font-bold">${formatCurrency(calculatedTotalAssetsForPreferentialCreditors)}</td>
          </tr>
          <tr>
            <td colspan="2" class="font-bold">Liabilities</td>
          </tr>
          <tr>
            <td>Moratorium debts</td>
            <td class="text-right font-bold">${calculatedMoratoriumDebts === 0 ? 'NIL' : formatCurrency(-calculatedMoratoriumDebts)}</td>
          </tr>
          <tr>
            <td>Priority pre-Moratorium debts</td>
            <td class="text-right font-bold">${calculatedPriorityPreMoratoriumDebts === 0 ? 'NIL' : formatCurrency(-calculatedPriorityPreMoratoriumDebts)}</td>
          </tr>
          <tr>
            <td class="font-bold">Total Moratorium Claim</td>
            <td class="text-right font-bold">${formatCurrency(-totalMoratoriumClaim)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated deficiency/surplus available for preferential creditors</td>
            <td class="text-right font-bold">${formatCurrency(estimatedDeficiencySurplusPreferentialCreditors)}</td>
          </tr>
          <tr>
            <td>Preferential creditors:</td>
            <td></td>
          </tr>
          <tr>
            <td>Employee Claims</td>
            <td class="text-right font-bold">${calculatedEmployeeClaimsPreferential === 0 ? 'NIL' : formatCurrency(-calculatedEmployeeClaimsPreferential)}</td>
          </tr>
          <tr>
            <td class="font-bold">Total Preferential Claim</td>
            <td class="text-right font-bold">${formatCurrency(-totalPreferentialClaim)}</td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated deficiency/surplus as regards preferential creditors:</td>
            <td class="text-right font-bold">${formatCurrency(estimatedDeficiencySurplusAsRegardsPreferentialCreditors)}</td>
          </tr>
          <tr>
            <td>Secondary Preferential creditors:</td>
            <td></td>
          </tr>
          <tr>
            <td>HM Revenue & Customs</td>
            <td class="text-right font-bold">${calculatedHmrcClaimsSecondaryPreferential === 0 ? 'NIL' : formatCurrency(-calculatedHmrcClaimsSecondaryPreferential)}</td>
          </tr>
          <tr>
            <td class="font-bold">Total Secondary Preferential Creditors</td>
            <td class="text-right font-bold">${formatCurrency(-totalSecondaryPreferentialCreditors)}</td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated deficiency/surplus as regards secondary preferential creditors:</td>
            <td class="text-right font-bold">${formatCurrency(estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr>
            <td>Estimated prescribed part of net property where applicable (to carry forward)</td>
            <td class="text-right">${estimatedPrescribedPartOfNetProperty === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetProperty)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated total assets available for floating charge holders</td>
            <td class="text-right font-bold">${formatCurrency(estimatedTotalAssetsAvailableForFloatingChargeHolders)}</td>
          </tr>
          <tr>
            <td>Debts secured by floating charges</td>
            <td></td>
          </tr>
          ${floatingChargeHolders.length === 0 ? 
            `<tr><td>No floating charge holders</td><td class="text-right">NIL</td></tr>` :
            floatingChargeHolders.map(holder =>
              `<tr>
                <td>${holder.creditor_name}</td>
                <td class="text-right font-bold">${formatCurrency(-(parseNumber(holder.balance_owed) || 0))}</td>
              </tr>`
            ).join('')
          }
          <tr>
            <td class="font-bold">Total Floating Charge</td>
            <td class="text-right font-bold">${formatCurrency(-totalFloatingChargeClaims)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated deficiency/surplus after floating charges</td>
            <td class="text-right font-bold">${formatCurrency(estimatedDeficiencySurplusAfterFloatingCharges)}</td>
          </tr>
          <tr>
            <td>Estimated prescribed part of net property where applicable (brought down)</td>
            <td class="text-right">${estimatedPrescribedPartOfNetPropertyBroughtDown === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetPropertyBroughtDown)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="blue-shaded">
            <td class="font-bold">Estimated deficiency/surplus as regards unsecured creditors</td>
            <td class="text-right font-bold">${formatCurrency(estimatedDeficiencySurplusAsRegardsUnsecuredCreditors)}</td>
          </tr>
          <tr>
            <td>Unsecured non-preferential claims (excluding any shortfall to floating charge holders):</td>
            <td></td>
          </tr>
          <tr>
            <td>Unsecured Employees' Claims</td>
            <td class="text-right font-bold">${calculatedUnsecuredEmployeeClaims === 0 ? 'NIL' : formatCurrency(-calculatedUnsecuredEmployeeClaims)}</td>
          </tr>
          <tr>
            <td>Trade Creditors</td>
            <td class="text-right font-bold">${calculatedTradeCreditors === 0 ? 'NIL' : formatCurrency(-calculatedTradeCreditors)}</td>
          </tr>
          <tr>
            <td>Other Unsecured Creditors</td>
            <td class="text-right font-bold">${calculatedOtherUnsecuredCreditors === 0 ? 'NIL' : formatCurrency(-calculatedOtherUnsecuredCreditors)}</td>
          </tr>
          ${unsecuredFromFixed.length > 0 ? unsecuredFromFixed.map(cred =>
            `<tr>
              <td>Deficiency due to ${cred.name}</td>
              <td class="text-right font-bold">${formatCurrency(-cred.amount)}</td>
            </tr>`
          ).join('') : ''}
          <tr>
            <td class="font-bold">Total Unsecured Creditors</td>
            <td class="text-right font-bold">${formatCurrency(-totalUnsecuredNonPreferentialClaims)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="gold-header">
            <td class="font-bold">Estimated surplus/deficiency as regards unsecured creditors</td>
            <td class="text-right font-bold">${formatCurrency(estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr>
            <td>Issued and called up capital</td>
            <td></td>
          </tr>
          <tr>
            <td>Ordinary Shares</td>
            <td class="text-right font-bold">${calculatedIssuedCalledUpCapital === null ? 'TBC' : formatCurrency(-calculatedIssuedCalledUpCapital)}</td>
          </tr>
          <tr>
            <td class="font-bold">Total Issued Called Up Capital</td>
            <td class="text-right font-bold">${formatCurrency(-totalIssuedCalledUpCapital)}</td>
          </tr>
          <tr>
            <td colspan="2" style="height: 10px; border: none;"></td>
          </tr>
          <tr class="gold-header">
            <td class="font-bold">Estimated total deficiency/surplus as regards members</td>
            <td class="text-right font-bold">${formatCurrency(estimatedTotalDeficiencySurplusAsRegardsMembers)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [calculatedTotalAssetsForPreferentialCreditors, calculatedMoratoriumDebts, calculatedPriorityPreMoratoriumDebts, totalMoratoriumClaim, estimatedDeficiencySurplusPreferentialCreditors, calculatedEmployeeClaimsPreferential, totalPreferentialClaim, estimatedDeficiencySurplusAsRegardsPreferentialCreditors, calculatedHmrcClaimsSecondaryPreferential, totalSecondaryPreferentialCreditors, estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors, estimatedPrescribedPartOfNetProperty, estimatedTotalAssetsAvailableForFloatingChargeHolders, creditors, chargeHolderSections, totalFloatingChargeClaims, estimatedDeficiencySurplusAfterFloatingCharges, estimatedPrescribedPartOfNetPropertyBroughtDown, estimatedDeficiencySurplusAsRegardsUnsecuredCreditors, calculatedUnsecuredEmployeeClaims, calculatedTradeCreditors, calculatedOtherUnsecuredCreditors, totalUnsecuredNonPreferentialClaims, estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors, calculatedIssuedCalledUpCapital, totalIssuedCalledUpCapital, estimatedTotalDeficiencySurplusAsRegardsMembers, parseNumber, formatCurrency]);

  const generateCompanyCreditorsHTML = useCallback(() => {
    return `
      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 12%;">Creditor Name</th>
            <th style="width: 30%;">Address</th>
            <th style="width: 8%;" class="text-right">Amount of debt (£)</th>
            <th style="width: 13%;" class="text-center">Is the creditor claiming retention of title?</th>
            <th style="width: 17%;">Details of any security held by creditor</th>
            <th style="width: 10%;" class="text-center">Date security given</th>
            <th style="width: 10%;" class="text-right">Value of Security</th>
          </tr>
        </thead>
        <tbody>
          ${companyCreditorsData.length === 0 ? `<tr><td colspan="7">No company creditors recorded.</td></tr>` : companyCreditorsData.map(creditor => `
            <tr>
              <td style="width: 12%;">${creditor.name || ''}</td>
              <td style="width: 30%;">${creditor.address || ''}</td>
              <td style="width: 8%;" class="text-right">${formatCurrency(parseNumber(creditor.amount))}</td>
              <td style="width: 13%;" class="text-center">${creditor.retention_of_title ? 'Yes' : 'No'}</td>
              <td style="width: 17%;">${creditor.security_details || ''}</td>
              <td style="width: 10%;" class="text-center">${creditor.security_date ? formatDate(creditor.security_date) : ''}</td>
              <td style="width: 10%;" class="text-right">${creditor.security_value ? `£${formatNumber(creditor.security_value)}` : '£0.00'}</td>
            </tr>
          `).join('')}
          <tr class="blue-shaded">
            <td class="font-bold">Employee Claims</td>
            <td></td>
            <td class="text-right font-bold">£${formatNumber(employeeCreditorsTotal)}</td>
            <td colspan="4"></td>
          </tr>
          <tr class="font-bold gold-header">
            <td colspan="2">Total Company Creditors Amount:</td>
            <td class="text-right">£${formatNumber(companyCreditorsTotal + employeeCreditorsTotal)}</td>
            <td colspan="3"></td>
            <td class="text-right">Total Company Creditors Security Value:</td>
          </tr>
          <tr class="font-bold gold-header">
            <td colspan="6"></td>
            <td class="text-right">${formatCurrency(companySecurityTotal)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [companyCreditorsData, parseNumber, formatCurrency, formatNumber, companyCreditorsTotal, companySecurityTotal, formatDate, employeeCreditorsTotal]);

  const generateConsumerCreditorsHTML = useCallback(() => {
    return `
      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 15%;">Creditor Name</th>
            <th style="width: 35%;">Address</th>
            <th style="width: 12%;" class="text-right">Amount of debt (£)</th>
            <th style="width: 18%;">Details of any security held by creditor</th>
            <th style="width: 10%;" class="text-center">Date security given</th>
            <th style="width: 10%;" class="text-right">Value of Security</th>
          </tr>
        </thead>
        <tbody>
          ${consumerCreditorsData.length === 0 ? `<tr><td colspan="6">No consumer creditors recorded.</td></tr>` : consumerCreditorsData.map(creditor => `
            <tr>
              <td style="width: 15%;">${creditor.name || ''}</td>
              <td style="width: 35%;">${creditor.address || ''}</td>
              <td style="width: 12%;" class="text-right">${formatCurrency(parseNumber(creditor.amount))}</td>
              <td style="width: 18%;">${creditor.security_details || ''}</td>
              <td style="width: 10%;" class="text-center">${creditor.security_date ? formatDate(creditor.security_date) : ''}</td>
              <td style="width: 10%;" class="text-right">${creditor.security_value ? `£${formatNumber(creditor.security_value)}` : '£0.00'}</td>
            </tr>
          `).join('')}
          <tr class="font-bold gold-header">
            <td colspan="2">Total Consumer Creditors</td>
            <td class="text-right">${formatCurrency(consumerCreditorsTotal)}</td>
            <td colspan="2"></td>
            <td class="text-right">${formatCurrency(consumerSecurityTotal)}</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [consumerCreditorsData, parseNumber, formatCurrency, formatNumber, consumerCreditorsTotal, consumerSecurityTotal, formatDate]);

  const generateEmployeeCreditorsHTML = useCallback(() => {
    return `
      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 15%;">Name of employee</th>
            <th style="width: 35%;">Address</th>
            <th style="width: 12%;" class="text-right">Amount of debt (£)</th>
            <th style="width: 18%;">Details of any security held by creditor</th>
            <th style="width: 10%;" class="text-center">Date security given</th>
            <th style="width: 10%;" class="text-right">Value of Security</th>
          </tr>
        </thead>
        <tbody>
          ${employeeCreditorsData.length === 0 ? `<tr><td colspan="6">No employee creditors recorded.</td></tr>` : employeeCreditorsData.map(employee => `
            <tr>
              <td style="width: 15%;">${employee.name || ''}</td>
              <td style="width: 35%;">${employee.address || ''}</td>
              <td style="width: 12%;" class="text-right">${formatCurrency(parseNumber(employee.amount))}</td>
              <td style="width: 18%;"></td>
              <td style="width: 10%;" class="text-center"></td>
              <td style="width: 10%;" class="text-right">£0.00</td>
            </tr>
          `).join('')}
          <tr class="font-bold gold-header">
            <td colspan="2">Total Employee Creditors</td>
            <td class="text-right">${formatCurrency(employeeCreditorsTotal)}</td>
            <td colspan="2"></td>
            <td class="text-right">£0.00</td>
          </tr>
        </tbody>
      </table>
    `;
  }, [employeeCreditorsData, parseNumber, formatCurrency, employeeCreditorsTotal]);

  const generateShareholdersHTML = useCallback(() => {
    const shareholdersToDisplay = currentData.scheduleD.shareholders;
    if (!shareholdersToDisplay || shareholdersToDisplay.length === 0) {
      return `
        <table>
          <thead>
            <tr class="gold-header">
              <th style="width: 18%;">Name of Shareholder</th>
              <th style="width: 28%;">Address</th>
              <th style="width: 10%;" class="text-center">Type of shares held</th>
              <th style="width: 12%;" class="text-right">The nominal amount of shares held</th>
              <th style="width: 10%;" class="text-right">No. of shares held</th>
              <th style="width: 11%;" class="text-right">The amount per share called up</th>
              <th style="width: 11%;" class="text-right">The total amount called up</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="width: 18%;">None</td><td colspan="6"></td></tr>
          </tbody>
        </table>
      `;
    }
    return `
      <table>
        <thead>
          <tr class="gold-header">
            <th style="width: 18%;">Name of Shareholder</th>
            <th style="width: 28%;">Address</th>
            <th style="width: 10%;" class="text-center">Type of shares held</th>
            <th style="width: 12%;" class="text-right">The nominal amount of shares held</th>
            <th style="width: 10%;" class="text-right">No. of shares held</th>
            <th style="width: 11%;" class="text-right">The amount per share called up</th>
            <th style="width: 11%;" class="text-right">The total amount called up</th>
          </tr>
        </thead>
        <tbody>
          ${shareholdersToDisplay.map((shareholder, idx) => {
            const sharesHeld = parseNumber(shareholder.shares_held || 0);
            const nominalValuePerShare = parseNumber(shareholder.nominal_value_per_share || 0); // In pounds
            const amountPaid = parseNumber(shareholder.amount_paid || 0);
            const amountUnpaid = parseNumber(shareholder.amount_unpaid || 0);

            const totalNominalValue = sharesHeld * nominalValuePerShare;
            const totalCalledUp = amountPaid + amountUnpaid;

            return `
              <tr>
                <td style="width: 18%;">${shareholder.name || ''}</td>
                <td style="width: 28%;">${shareholder.address || ''}</td>
                <td style="width: 10%;" class="text-center">${shareholder.share_class || 'Ordinary'}</td>
                <td style="width: 12%;" class="text-right">£${formatNumber(totalNominalValue)}</td>
                <td style="width: 10%;" class="text-right">${formatNumber(sharesHeld)}</td>
                <td style="width: 11%;" class="text-right">£${formatNumber(nominalValuePerShare)}</td>
                <td style="width: 11%;" class="text-right">£${formatNumber(totalCalledUp)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }, [currentData.scheduleD.shareholders, parseNumber, formatNumber]);

  const exportToHTML = () => {
    const hasCreditors = companyCreditorsData.length > 0 || consumerCreditorsData.length > 0 || employeeCreditorsData.length > 0;
    const hasShareholders = currentData.scheduleD.shareholders && currentData.scheduleD.shareholders.length > 0;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Statement of Affairs - ${caseData?.company_name || 'Unknown'}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      color: #1e293b;
      font-size: 16px;
    }
    table {
      width: 100%;
      border-collapse: separate; /* Changed from collapse */
      border-spacing: 2px;     /* Added for white borders */
      margin-bottom: 30px;
      font-size: 16px;
      page-break-inside: avoid;
      table-layout: fixed;
      background-color: white; /* Ensures border-spacing appears white */
    }
    th, td {
      border: none; /* Removed individual cell borders to rely on border-spacing */
      padding: 8px 12px;
      text-align: left;
      vertical-align: middle;
      background-color: white; /* Default cell background */
    }
    th { /* All THs are gold in current styling */
      background-color: #A57C00;
      color: white;
      font-weight: bold;
      text-align: left;
      /* Removed: border: 2px solid white !important; */
    }
    .gold-header { /* Applied to TRs, ensures background/color for TD children */
      /* No direct background on TR when using border-separate; background should be on cells */
      color: white; /* Applies to text in gold-header cells */
      font-weight: bold;
    }
    .gold-header td { /* TDs within gold-header TRs */
      background-color: #A57C00; /* Gold background for these TDs */
      color: white;
      font-weight: bold;
      /* Removed: border: 2px solid white !important; */
    }
    .blue-shaded {
      background-color: #e0f2fe;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-bold { font-weight: bold; }
    .section-title {
      font-size: 24px;
      font-weight: bold;
      margin: 30px 0 15px 0;
      color: #A57C00;
      border-bottom: 2px solid #A57C00;
      padding-bottom: 10px;
    }
    h1 {
      text-align: center;
      color: #A57C00;
      font-size: 28px;
      margin-bottom: 30px;
    }
    h2 {
      font-size: 20px;
      font-weight: bold;
      margin: 20px 0 10px 0;
      color: #A57C00;
    }
    h3 {
        font-size: 18px;
        font-weight: bold;
        text-align: center;
        margin: 20px 0 10px 0;
    }
    .meta-info {
      margin-bottom: 20px;
      font-size: 16px;
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 5px;
    }
    .page-break {
      page-break-after: always;
    }
    .page-break-before {
        page-break-before: always;
    }
    @media print {
      body {
        margin: 10px;
      }
      .page-break {
        page-break-after: always;
      }
      .page-break-before {
          page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <h1>Statement of Affairs</h1>

  <div class="section-title">A - Summary of Assets</div>
  ${generateAssetsHTML()}

  <div class="page-break"></div>

  <div class="section-title">B - Summary of Liabilities</div>
  ${generateLiabilitiesHTML()}

  ${hasCreditors ? `
    <div class="page-break"></div>

    <div class="page-break-before">
      <div class="section-title">C - Schedule of Creditors</div>
      <h3>COMPANY CREDITORS (excluding employees and consumers)</h3>
      <div style="margin-bottom: 15px; font-size: 14px;">
        <strong>Note:</strong> You must include all creditors (excluding employees and certain consumers [see relevant page for definition of a consumer]) and indicate any creditors under hire-purchase, chattel leasing or conditional sale agreements and any creditors claiming retention of title over property in the company's possession.
      </div>
      ${generateCompanyCreditorsHTML()}
    </div>

    <div class="page-break-before">
      <h3>CONSUMER CREDITORS</h3>
      <div style="margin-bottom: 15px; font-size: 14px;">
        <strong>Note:</strong> You must include all creditors who are consumers (i.e., an individual acting for purposes that are wholly or mainly outside the individual's trade, business, craft or profession) claiming amounts paid in advance for the supply of goods or services (and indicate whether any are also creditors under hire-purchase, chattel leasing or conditional sale agreements and any claiming retention of title over property in the company's possession).
      </div>
      ${generateConsumerCreditorsHTML()}
    </div>

    <div class="page-break-before">
      <h3>EMPLOYEE CREDITORS</h3>
      <div style="margin-bottom: 15px; font-size: 14px;">
        <strong>Note:</strong> You must include all employees who are creditors of the company, showing their claims for wages, holiday pay, notice pay, redundancy and other employment-related debts.
      </div>
      ${generateEmployeeCreditorsHTML()}
    </div>
  ` : ''}

  ${hasShareholders ? `
    <div class="page-break"></div>

    <div class="page-break-before">
      <div class="section-title">D - Schedule of Members</div>
      <h3>COMPANY SHAREHOLDERS</h3>
      ${generateShareholdersHTML()}
    </div>
  ` : ''}

</body>
</html>
    `;

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert('Please allow pop-ups to view the Statement of Affairs');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
        <span className="text-slate-600">Loading Statement of Affairs...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="space-y-6 px-8">
      <style>{`
        @media print {
          .page-break-before {
            page-break-before: always;
          }
        }

        @page {
          size: A4;
          margin: 20mm;
        }
      `}</style>
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={async () => {
            try {
              await retryWithBackoff(async () => {
                const versionToSave = currentVersion === null ? 1 : currentVersion;
                const soaRecords = await base44.entities.StatementOfAffairs.filter({
                  case_id: caseId,
                  version: versionToSave
                });

                if (soaRecords.length > 0) {
                  await base44.entities.StatementOfAffairs.update(soaRecords[0].id, {
                    data: currentData,
                    as_at_date: new Date().toISOString().split('T')[0]
                  });
                } else {
                  await base44.entities.StatementOfAffairs.create({
                    case_id: caseId,
                    version: versionToSave,
                    as_at_date: new Date().toISOString().split('T')[0],
                    data: currentData
                  });
                }
              });
              alert('Statement of Affairs saved to database successfully!');
            } catch (error) {
              console.error('Error saving:', error);
              const is429 = error?.message?.includes('429') || error?.status === 429;
              alert(is429 ? 'Rate limit exceeded. Please wait a moment and try again.' : 'Failed to save to database: ' + error.message);
            }
          }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          <RefreshCw className="w-4 h-4" />
          Save to Database
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportToHTML}
          className="flex items-center gap-2"
        >
          <FileDown className="w-4 h-4" />
          Export to HTML
        </Button>
        <Button
          variant={isLocked ? "destructive" : "outline"}
          size="sm"
          onClick={() => setIsLocked(!isLocked)}
          className="flex items-center gap-2"
        >
          {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {isLocked ? 'Locked' : 'Unlock'}
        </Button>
      </div>

      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection('assets')}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            {sectionsExpanded.assets ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            A - Summary of Assets
          </CardTitle>
        </CardHeader>

        {sectionsExpanded.assets && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b font-medium text-lg text-white" style={{backgroundColor: '#A57C00'}}>
              <div className="col-span-6">Assets Subject to a Fixed Charge</div>
              <div className="col-span-3 text-right">Book Value (£)</div>
              <div className="col-span-3 text-right">Estimated to Realise (£)</div>
            </div>

            {chargeHolderSections.map((section, sectionIndex) => (
              <div key={section.id} className="relative space-y-2">
                {!isLocked && chargeHolderSections.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteChargeHolderSection(section.id)}
                    className="absolute top-0 right-0 h-8 px-3 text-red-500 hover:text-red-700 -mt-8"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Delete Section
                  </Button>
                )}

                {section.assets.fixed.map((asset, index) => {
                  const assetId = asset.id || `temp-fixed-${section.id}-${index}`;
                  const suggestionKey = `${section.id}-fixed-${assetId}`;
                  const shouldShowSuggestions = showSuggestions[suggestionKey];
                  const fixedChargeSuggestions = getAssetAccountSuggestions(asset.name, 'fixed_charge');

                  return (
                    <div key={assetId} className="px-4 py-2 border text-lg grid grid-cols-12 gap-4 items-center">
                      <div className="relative col-span-3">
                        <Input
                          value={asset.name || ''}
                          onChange={(e) => handleAssetDescriptionChange(section.id, 'fixed', index, e.target.value)}
                          onFocus={() => {
                            setShowSuggestions(prev => ({
                              ...prev,
                              [suggestionKey]: true
                            }));
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowSuggestions(prev => ({
                                ...prev,
                                [suggestionKey]: false
                              }));
                            }, 200);
                          }}
                          className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-white"
                          placeholder="Enter Description"
                          disabled={isLocked}
                        />

                        {shouldShowSuggestions && !isLocked && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto mt-1 z-50">
                            {accountsLoading ? (
                              <div className="px-3 py-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                Loading account codes...
                              </div>
                            ) : (
                              <>
                                {fixedChargeSuggestions.length === 0 ? (
                                  <div className="px-3 py-4">
                                    <div className="text-gray-600 text-lg mb-2">No matching fixed charge accounts found.</div>
                                    <div className="text-xs text-gray-500">Try a different search term or check Settings → Chart of Accounts</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="px-3 py-2 bg-blue-50 border-b text-xs font-semibold text-blue-900">
                                      Fixed Charge Asset Realisations ({fixedChargeSuggestions.length})
                                    </div>
                                    {fixedChargeSuggestions.map((account, idx) => (
                                      <div
                                        key={account.id || idx}
                                        className="px-3 py-3 hover:bg-blue-50 cursor-pointer text-lg border-b last:border-b-0"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          selectAccountFromSuggestion(section.id, 'fixed', index, account);
                                        }}
                                      >
                                        <div className="font-semibold text-blue-700">
                                          {account.account_code}
                                        </div>
                                        <div className="text-gray-600">
                                          {account.account_name}
                                        </div>
                                        {account.account_group && (
                                          <div className="text-xs text-gray-400 mt-1">
                                            {account.account_group}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <Input
                        value={asset.account_code || ''}
                        placeholder="Account Code"
                        readOnly
                        className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-gray-100 col-span-3"
                        disabled={isLocked}
                      />

                      <Input
                        type="text"
                        value={asset.book_value === 0 ? '' : formatNumber(asset.book_value)}
                        onChange={(e) => updateAsset(section.id, 'fixed', index, 'book_value', e.target.value)}
                        className={`${numberInputClassName} col-span-3`}
                        placeholder="0"
                        disabled={isLocked}
                      />
                      <Input
                        type="text"
                        value={displayETRValue(asset.etr_value)}
                        onChange={(e) => {
                          const val = e.target.value.trim().toLowerCase();
                          updateAsset(section.id, 'fixed', index, 'etr_value', val === 'u' ? 'uncertain' : e.target.value);
                        }}
                        className={`${numberInputClassName} ml-auto col-span-3`}
                        placeholder="0 or 'U'"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
                <div className="px-4 py-3 bg-gray-50 border-t">
                  <div className="flex justify-end gap-2">
                    {!isLocked && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addAsset(section.id, 'fixed')}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        disabled={isLocked}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Asset
                      </Button>
                    )}
                    {!isLocked && section.assets.fixed.length > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeLastAsset(section.id, 'fixed')}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        disabled={isLocked || section.assets.fixed.length === 0}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete Last
                      </Button>
                    )}
                  </div>
                </div>

                <div className="px-4 py-2 border-b text-lg">
                  <div className="text-lg font-medium text-gray-700 mb-2">Less Amounts due to</div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    {section.creditors.fixed.map((creditor, creditorIndex) => {
                      const creditorSuggestionKey = `${section.id}-creditor-${creditorIndex}`;
                      const shouldShowCreditorSuggestions = showSuggestions[creditorSuggestionKey];

                      // Updated to include finance companies
                      const securedCreditors = creditor.name && creditor.name.length > 0
                        ? creditors.filter(c =>
                            (c.creditor_type === 'secured' || c.is_finance_company === true) &&
                            (c.creditor_name || '').toLowerCase().includes((creditor.name || '').toLowerCase())
                          )
                        : creditors.filter(c => c.creditor_type === 'secured' || c.is_finance_company === true);

                      return (
                        <React.Fragment key={creditorIndex}>
                          <div className="relative">
                            <Input
                              type="text"
                              value={creditor.name || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                updateChargeholder(section.id, 'fixed', creditorIndex, 'name', value);
                                setShowSuggestions(prev => ({
                                  ...prev,
                                  [creditorSuggestionKey]: true
                                }));
                              }}
                              onFocus={() => {
                                setShowSuggestions(prev => ({
                                  ...prev,
                                  [creditorSuggestionKey]: true
                                }));
                              }}
                              onBlur={() => {
                                setTimeout(() => {
                                  setShowSuggestions(prev => ({
                                    ...prev,
                                    [creditorSuggestionKey]: false
                                  }));
                                }, 200);
                              }}
                              className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-white"
                              placeholder="Select Secured Chargeholder"
                              disabled={isLocked}
                            />

                            {shouldShowCreditorSuggestions && !isLocked && (
                              <div className="absolute top-full left-0 right-0 bg-white border-2 border-green-400 rounded-md shadow-xl max-h-80 overflow-y-auto mt-1 z-50">
                                {securedCreditors.length === 0 ? (
                                  <div className="px-3 py-4 text-center">
                                    <div className="text-gray-600 text-sm mb-2">No secured creditors or finance companies found</div>
                                    <div className="text-xs text-gray-500">
                                      {creditor.name
                                        ? `No matches for "${creditor.name}"`
                                        : 'Add secured creditors or mark creditors as Finance Company in the Creditors tab first'}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="px-3 py-2 bg-green-50 border-b text-xs font-semibold text-green-900 sticky top-0">
                                      📊 Secured Creditors & Finance Companies ({securedCreditors.length})
                                    </div>
                                    {securedCreditors.map((c, idx) => (
                                      <div
                                        key={c.id || idx}
                                        className="px-4 py-3 hover:bg-green-50 cursor-pointer text-sm border-b last:border-b-0 transition-colors"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          updateChargeholder(section.id, 'fixed', creditorIndex, 'name', c.creditor_name);
                                          updateChargeholder(section.id, 'fixed', creditorIndex, 'amount', -(parseNumber(c.balance_owed) || 0));
                                          setShowSuggestions(prev => ({
                                            ...prev,
                                            [creditorSuggestionKey]: false
                                          }));
                                        }}
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="font-semibold text-green-700 text-base flex items-center gap-2">
                                              {c.creditor_name}
                                              {c.is_finance_company && (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">Finance Co.</span>
                                              )}
                                            </div>
                                            <div className="text-gray-600 text-sm mt-1">
                                              Balance Owed: <span className="font-mono font-medium">{formatCurrency(c.balance_owed || 0)}</span>
                                            </div>
                                            {c.security_type && (
                                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                🔒 {c.security_type}
                                                {c.security_date_of_creation && (
                                                  <span className="ml-2">• Created: {formatDate(c.security_date_of_creation)}</span>
                                                )}
                                              </div>
                                            )}
                                            {c.account_number && (
                                              <div className="text-xs text-gray-400 mt-1">
                                                Account: {c.account_number}
                                              </div>
                                            )}
                                          </div>
                                          <div className="ml-3 text-xs text-green-600 whitespace-nowrap">
                                            Click to select
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <Input
                            type="text"
                            value={creditor.amount === 0 ? '' : `(${formatNumber(Math.abs(creditor.amount))})`}
                            onChange={(e) => {
                              const cleanValue = e.target.value.replace(/[(),]/g, '');
                              const numValue = parseNumber(cleanValue);
                              updateChargeholder(section.id, 'fixed', creditorIndex, 'amount', numValue === 0 ? 0 : -Math.abs(numValue));
                            }}
                            className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-white text-right text-red-600 font-semibold"
                            placeholder="(0)"
                            disabled={isLocked}
                          />
                        </React.Fragment>
                      );
                    })}

                    <div className="flex gap-2 justify-end col-span-2">
                      {!isLocked && (
                        <Button
                          variant="outline"
                          onClick={() => addChargeholder(section.id, 'fixed')}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50 h-6 px-2 text-xs"
                          disabled={isLocked}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Chargeholder
                        </Button>
                      )}
                      {!isLocked && section.creditors.fixed.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => removeLastChargeholder(section.id, 'fixed')}
                          className="text-red-600 border-red-300 hover:bg-red-50 h-6 px-2 text-xs"
                          disabled={isLocked || section.creditors.fixed.length === 0}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete Last
                        </Button>
                      )}
                    </div>

                    <div className="col-span-1">
                      <Label className="text-lg text-slate-700">
                        Fixed Charge Surplus (Deficiency) C/F
                      </Label>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Input
                        type="text"
                        value={section.fixed_charge_surplus === 0 ? '' : formatNumber(section.fixed_charge_surplus)}
                        onChange={(e) => {
                          updateChargeHolderSection(section.id, 'fixed_charge_surplus', parseNumber(e.target.value));
                        }}
                        className="h-8 text-lg text-right w-32"
                        placeholder="0"
                        disabled={isLocked}
                      />
                    </div>
                  </div>
                </div>

                {sectionIndex < chargeHolderSections.length - 1 && (
                  <div className="my-6 border-t-2 border-slate-300"></div>
                )}
              </div>
            ))}

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col items-start gap-2">
              {!isLocked && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addChargeHolderSection}
                        disabled={isLocked}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Another Chargeholder Section
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {!isLocked && chargeHolderSections.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={removeLastChargeHolderSection}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={isLocked || chargeHolderSections.length <= 1}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Last Section
                </Button>
              )}
            </div>

            <div className="mb-6 relative" style={{zIndex: 100}}>
              <div className="bg-white rounded-lg border border-gray-200" style={{overflow: 'visible'}}>
                <div className="px-4 py-2 text-lg font-medium grid grid-cols-12 gap-4 border-b" style={{backgroundColor: '#A57C00'}}>
                  <div className="col-span-6 text-lg font-medium text-white">Assets Subject to a Floating Charge</div>
                  <div className="col-span-3 text-lg font-medium text-white text-right">Book Value (£)</div>
                  <div className="col-span-3 text-lg font-medium text-white text-right">Estimated to Realise (£)</div>
                </div>
                {globalAssetsData.floating.map((asset, index) => {
                  const assetId = asset.id || `temp-floating-${index}`;
                  const floatingSuggestionKey = `floating-${assetId}`;
                  const shouldShowFloatingSuggestions = showSuggestions[floatingSuggestionKey];
                  const floatingChargeSuggestions = getAssetAccountSuggestions(asset.name, 'floating_charge');

                  return (
                    <div key={assetId} className="px-4 py-2 border-b text-lg grid grid-cols-12 gap-4 items-center" style={{position: 'relative', zIndex: shouldShowFloatingSuggestions ? 1000 : 1}}>
                      <div className="col-span-3" style={{position: 'relative'}}>
                        <Input
                          value={asset.name || ''}
                          onChange={(e) => handleAssetDescriptionChange(null, 'floating', index, e.target.value)}
                          onFocus={() => {
                            setShowSuggestions(prev => ({
                              ...prev,
                              [floatingSuggestionKey]: true
                            }));
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowSuggestions(prev => ({
                                ...prev,
                                [floatingSuggestionKey]: false
                              }));
                            }, 200);
                          }}
                          className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-white"
                          placeholder="Enter Description"
                          disabled={isLocked}
                        />

                        {shouldShowFloatingSuggestions && !isLocked && (
                          <div
                            className="absolute top-full left-0 bg-white border-2 border-blue-400 rounded-md shadow-2xl mt-1 min-w-[400px]"
                            style={{
                              zIndex: 999999,
                              maxHeight: '320px',
                              overflowY: 'auto',
                              position: 'absolute'
                            }}
                          >
                            {accountsLoading ? (
                              <div className="px-4 py-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                <div className="text-sm">Loading account codes...</div>
                              </div>
                            ) : (
                              <>
                                {floatingChargeSuggestions.length === 0 ? (
                                  <div className="px-4 py-4 text-center">
                                    <div className="text-gray-600 text-sm mb-2">No matching floating charge accounts found</div>
                                    <div className="text-xs text-gray-400">Try a different description or add accounts in Settings → Chart of Accounts</div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="px-4 py-2 bg-blue-50 border-b border-slate-200 text-sm font-semibold text-blue-900 sticky top-0">
                                      Floating Charge Asset Realisations ({floatingChargeSuggestions.length})
                                    </div>
                                    <div>
                                      {floatingChargeSuggestions.map((acc, accIdx) => (
                                        <div
                                          key={acc.id || accIdx}
                                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectAccountFromSuggestion(null, 'floating', index, acc);
                                          }}
                                        >
                                          <div className="font-bold text-blue-700 text-base mb-1">
                                            {acc.account_code}
                                          </div>
                                          <div className="text-gray-700 text-sm mb-1">
                                            {acc.account_name}
                                          </div>
                                          {acc.account_group && (
                                            <div className="text-xs text-gray-400">
                                              {acc.account_group}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <Input
                        value={asset.account_code || ''}
                        placeholder="Account Code"
                        readOnly
                        className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-gray-100 col-span-3"
                        disabled={isLocked}
                      />

                      <Input
                        type="text"
                        value={asset.book_value === 0 ? '' : formatNumber(asset.book_value)}
                        onChange={(e) => updateAsset(null, 'floating', index, 'book_value', e.target.value)}
                        className={`${numberInputClassName} col-span-3`}
                        placeholder="0"
                        disabled={isLocked}
                      />

                      <Input
                        type="text"
                        value={displayETRValue(asset.etr_value)}
                        onChange={(e) => {
                          const val = e.target.value.trim().toLowerCase();
                          updateAsset(null, 'floating', index, 'etr_value', val === 'u' ? 'uncertain' : e.target.value);
                        }}
                        className={`${numberInputClassName} ml-auto col-span-3`}
                        placeholder="0 or 'U'"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
                <div className="px-4 py-2 bg-blue-50 border-t border-b text-lg grid grid-cols-12 gap-4 font-bold items-center">
                    <div className="col-span-6">Total Assets Subject to Floating Charge</div>
                    <div className="col-span-3 text-right">{formatCurrency(totalFloatingChargeAssetsBook)}</div>
                    <div className="col-span-3 text-right">{formatCurrency(totalFloatingChargeAssetsEtr)}</div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t relative z-10">
                <div className="flex justify-end gap-2">
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addAsset(null, 'floating')}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      disabled={isLocked}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Asset
                    </Button>
                  )}
                  {!isLocked && globalAssetsData.floating.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLastAsset(null, 'floating')}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={isLocked || globalAssetsData.floating.length === 0}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Last
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-6 relative z-50">
              <div className="bg-white rounded-lg border border-gray-200 overflow-visible">
                <div className="px-4 py-2 text-lg font-medium grid grid-cols-12 gap-4 border-b" style={{backgroundColor: '#A57C00'}}>
                  <div className="col-span-6 text-lg font-medium text-white">Uncharged Assets</div>
                  <div className="col-span-3 text-lg font-medium text-white text-right">Book Value (£)</div>
                  <div className="col-span-3 text-lg font-medium text-white text-right">Estimated to Realise (£)</div>
                </div>
                {globalAssetsData.uncharged.map((asset, index) => {
                  const assetId = asset.id || `temp-uncharged-${index}`;
                  const unchargedSuggestionKey = `uncharged-${assetId}`;
                  const shouldShowUnchargedSuggestions = showSuggestions[unchargedSuggestionKey];

                  const unchargedAssetSuggestions = getAssetAccountSuggestions(asset.name, 'uncharged');

                  return (
                    <div key={assetId} className="px-4 py-2 border-b text-lg grid grid-cols-12 gap-4 items-center relative">
                      <div className="relative col-span-3">
                        <Input
                          value={asset.name || ''}
                          onChange={(e) => handleAssetDescriptionChange(null, 'uncharged', index, e.target.value)}
                          onFocus={() => {
                            setShowSuggestions(prev => ({
                                ...prev,
                                [unchargedSuggestionKey]: true
                            }));
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              setShowSuggestions(prev => ({
                                ...prev,
                                [unchargedSuggestionKey]: false
                              }));
                            }, 200);
                          }}
                          className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-white relative z-10"
                          placeholder="Enter description"
                          disabled={isLocked}
                        />

                        {shouldShowUnchargedSuggestions && !isLocked && (
                          <div
                            className="absolute top-full left-0 bg-white border border-slate-300 rounded-md shadow-xl max-h-80 overflow-y-auto mt-1 min-w-[320px]"
                            style={{
                              zIndex: 99999
                            }}
                          >
                            {accountsLoading ? (
                              <div className="px-4 py-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                <div className="text-sm">Loading account codes...</div>
                              </div>
                            ) : (
                              <>
                                {unchargedAssetSuggestions.length === 0 ? (
                                  <div className="px-4 py-4 text-center">
                                    <div className="text-gray-600 text-sm mb-2">No matching uncharged asset accounts found</div>
                                    <div className="text-xs text-gray-400">
                                      {asset.name
                                        ? `No matches for "${asset.name}"`
                                        : 'Add Uncharged Asset Realisation accounts in Settings → Chart of Accounts'}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="px-4 py-2 bg-blue-50 border-b border-slate-200 text-sm font-semibold text-blue-900">
                                      Uncharged Asset Realisations ({unchargedAssetSuggestions.length})
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                      {unchargedAssetSuggestions.map((acc, accIdx) => (
                                        <div
                                          key={acc.id || accIdx}
                                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors"
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectAccountFromSuggestion(null, 'uncharged', index, acc);
                                          }}
                                        >
                                          <div className="font-bold text-blue-700 text-base mb-1">
                                            {acc.account_code}
                                          </div>
                                          <div className="text-gray-700 text-sm mb-1">
                                            {acc.account_name}
                                          </div>
                                          {acc.account_group && (
                                            <div className="text-xs text-gray-400">
                                              {acc.account_group}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <Input
                        value={asset.account_code || ''}
                        placeholder="Account Code"
                        readOnly
                        className="h-8 text-lg border border-slate-200 rounded-md px-2 bg-gray-100 col-span-3"
                        disabled={isLocked}
                      />

                      <Input
                        type="text"
                        value={asset.book_value === 0 ? '' : formatNumber(asset.book_value)}
                        onChange={(e) => updateAsset(null, 'uncharged', index, 'book_value', e.target.value)}
                        className={`${numberInputClassName} col-span-3`}
                        placeholder="0"
                        disabled={isLocked}
                      />

                      <Input
                        type="text"
                        value={displayETRValue(asset.etr_value)}
                        onChange={(e) => {
                          const val = e.target.value.trim().toLowerCase();
                          updateAsset(null, 'uncharged', index, 'etr_value', val === 'u' ? 'uncertain' : e.target.value);
                        }}
                        className={`${numberInputClassName} ml-auto col-span-3`}
                        placeholder="0 or 'U'"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
                <div className="px-4 py-2 bg-blue-50 border-t border-b text-lg grid grid-cols-12 gap-4 font-bold items-center">
                    <div className="col-span-6">Total Uncharged Assets</div>
                    <div className="col-span-3 text-right">{formatCurrency(totalUnchargedAssetsBook)}</div>
                    <div className="col-span-3 text-right">{formatCurrency(totalUnchargedAssetsEtr)}</div>
                </div>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t relative z-10">
                <div className="flex justify-end gap-2">
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addAsset(null, 'uncharged')}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      disabled={isLocked}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Asset
                    </Button>
                  )}
                  {!isLocked && globalAssetsData.uncharged.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeLastAsset(null, 'uncharged')}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={isLocked || globalAssetsData.uncharged.length === 0}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Last
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="px-4 py-2 border font-bold text-lg grid grid-cols-2 gap-4">
                <div className="col-span-1 bg-slate-50 p-2 rounded">
                  <Label className="text-lg font-medium text-slate-700">
                    Estimated total assets available for moratorium, priority pre-moratorium and preferential creditors (carried from page A)
                  </Label>
                </div>
                <div className="col-span-1 bg-slate-50 p-2 rounded flex justify-end">
                  <Input
                    type="text"
                    value={formatCurrency(calculatedTotalAssetsForPreferentialCreditors)}
                    className="h-8 text-lg text-right w-32 bg-slate-100"
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection('liabilities')}
        >
          <CardTitle className="flex items-center gap-2 text-lg">
            {sectionsExpanded.liabilities ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            B - Summary of Liabilities
          </CardTitle>
        </CardHeader>

        {sectionsExpanded.liabilities && (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-lg border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-300" style={{backgroundColor: '#A57C00'}}>
                    <th className="px-4 py-1.5 text-left font-semibold text-white"></th>
                    <th className="px-4 py-1.5 text-right font-semibold text-white">Estimated to Realise (£)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">
                      Estimated total assets available for moratorium, priority pre-moratorium and preferential creditors (carried from page A)
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      {calculatedTotalAssetsForPreferentialCreditors === 0 ? 'NIL' : formatCurrency(calculatedTotalAssetsForPreferentialCreditors)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 font-semibold text-slate-900" colSpan="2">Liabilities</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Moratorium debts</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {calculatedMoratoriumDebts === 0 ? 'NIL' : formatCurrency(-calculatedMoratoriumDebts)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Priority pre-Moratorium debts</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {calculatedPriorityPreMoratoriumDebts === 0 ? 'NIL' : formatCurrency(-calculatedPriorityPreMoratoriumDebts)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Total Moratorium Claim</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalMoratoriumClaim === 0 ? 'NIL' : formatCurrency(-totalMoratoriumClaim)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border-b-2 border-transparent"></td>
                    <td className="px-4 py-2 text-right font-semibold"></td>
                  </tr>

                  <tr className="bg-blue-50 border-b border-slate-200">
                    <td className="px-4 py-2 font-semibold text-slate-900">
                      Estimated deficiency/surplus available for preferential creditors
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {estimatedDeficiencySurplusPreferentialCreditors === 0 ? 'NIL' : formatCurrency(estimatedDeficiencySurplusPreferentialCreditors)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Preferential creditors:</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Employee Claims</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedEmployeeClaimsPreferential === 0 ? 'NIL' : formatCurrency(-calculatedEmployeeClaimsPreferential)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Total Preferential Claim</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalPreferentialClaim === 0 ? 'NIL' : formatCurrency(-totalPreferentialClaim)}</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900 border-b-2 border-transparent">Estimated deficiency/surplus as regards preferential creditors:</td>
                    <td className="px-4 py-2 text-right font-semibold">{estimatedDeficiencySurplusAsRegardsPreferentialCreditors === 0 ? 'NIL' : formatCurrency(estimatedDeficiencySurplusAsRegardsPreferentialCreditors)}</td>
                  </tr>

                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Secondary Preferential creditors:</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">HM Revenue & Customs</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedHmrcClaimsSecondaryPreferential === 0 ? 'NIL' : formatCurrency(-calculatedHmrcClaimsSecondaryPreferential)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2 font-semibold text-slate-900">Total Secondary Preferential Creditors</td>
                    <td className="px-4 py-2 text-right font-semibold">{totalSecondaryPreferentialCreditors === 0 ? 'NIL' : formatCurrency(-totalSecondaryPreferentialCreditors)}</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900 border-b-2 border-transparent">Estimated deficiency/surplus as regards secondary preferential creditors:</td>
                    <td className="px-4 py-2 text-right font-semibold">{estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors === 0 ? 'NIL' : formatCurrency(estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Estimated prescribed part of net property where applicable (to carry forward)</td>
                    <td className="px-4 py-2 text-right">{estimatedPrescribedPartOfNetProperty === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetProperty)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated total assets available for floating charge holders</td>
                    <td className="px-4 py-2 text-right font-semibold">{estimatedTotalAssetsAvailableForFloatingChargeHolders === 0 ? 'NIL' : formatCurrency(estimatedTotalAssetsAvailableForFloatingChargeHolders)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Debts secured by floating charges</td>
                    <td className="px-4 py-2"></td>
                  </tr>

                  {(() => {
                    // Get creditors from fixed sections
                    const fixedSectionCreditorNames = new Set();
                    chargeHolderSections.forEach(section => {
                      section.creditors.fixed.forEach(creditor => {
                        if (creditor.name) {
                          fixedSectionCreditorNames.add(creditor.name.toLowerCase().trim());
                        }
                      });
                    });

                    // Filter to only include floating charge holders not in fixed sections
                    const floatingChargeHolders = creditors.filter(c => {
                      const securityType = (c.security_type || '').toLowerCase();
                      const hasFloatingCharge = c.creditor_type === 'secured' && (
                        securityType.includes('floating') ||
                        securityType.includes('fixed & floating')
                      );
                      const isInFixedSection = fixedSectionCreditorNames.has((c.creditor_name || '').toLowerCase().trim());
                      
                      return hasFloatingCharge && !isInFixedSection;
                    });

                    if (floatingChargeHolders.length === 0) {
                      return (
                        <tr className="border-b border-slate-200">
                          <td className="px-4 py-2 text-slate-700">No floating charge holders</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-900">NIL</td>
                        </tr>
                      );
                    }

                    return floatingChargeHolders.map((holder, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="px-4 py-2 text-slate-700">{holder.creditor_name}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-900">
                          {formatCurrency(-(parseNumber(holder.balance_owed) || 0))}
                        </td>
                      </tr>
                    ));
                  })()}

                  <tr>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right font-semibold">{totalFloatingChargeClaims === 0 ? 'NIL' : formatCurrency(-totalFloatingChargeClaims)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated deficiency/surplus of assets after floating charges</td>
                    <td className="px-4 py-2 text-right font-semibold">{estimatedDeficiencySurplusAfterFloatingCharges === 0 ? 'NIL' : formatCurrency(estimatedDeficiencySurplusAfterFloatingCharges)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Estimated prescribed part of net property where applicable (brought down)</td>
                    <td className="px-4 py-2 text-right">{estimatedPrescribedPartOfNetPropertyBroughtDown === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetPropertyBroughtDown)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated deficiency/surplus as regards unsecured creditors</td>
                    <td className="px-4 py-2 text-right font-semibold">{estimatedDeficiencySurplusAsRegardsUnsecuredCreditors === 0 ? 'NIL' : formatCurrency(estimatedDeficiencySurplusAsRegardsUnsecuredCreditors)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Unsecured non-preferential claims (excluding any shortfall to floating charge holders):</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Unsecured Employees' Claims</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedUnsecuredEmployeeClaims === 0 ? 'NIL' : formatCurrency(-calculatedUnsecuredEmployeeClaims)}
                    </td>
                  </tr>

                  <tr>
                    <td className="px-4 py-2 text-slate-700">Trade Creditors</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedTradeCreditors === 0 ? 'NIL' : formatCurrency(-calculatedTradeCreditors)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Other Unsecured Creditors</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedOtherUnsecuredCreditors === 0 ? 'NIL' : formatCurrency(-calculatedOtherUnsecuredCreditors)}
                    </td>
                  </tr>

                  {/* NEW: Show deficiency lines for each creditor from fixed charge sections */}
                  {(() => {
                    const deficiencies = [];
                    chargeHolderSections.forEach(section => {
                      section.creditors.fixed.forEach(creditor => {
                        if (!creditor.name || creditor.amount === 0) return;
                        
                        const dbCreditor = creditors.find(c => 
                          c.creditor_name && creditor.name &&
                          c.creditor_name.toLowerCase().trim() === creditor.name.toLowerCase().trim()
                        );
                        
                        if (dbCreditor) {
                          const securityType = (dbCreditor.security_type || '').toLowerCase();
                          const isSecured = dbCreditor.creditor_type === 'secured';
                          const hasFixedCharge = securityType.includes('fixed');
                          const hasFloatingCharge = securityType.includes('floating');
                          
                          if (!isSecured || (!hasFixedCharge && !hasFloatingCharge)) {
                            deficiencies.push({
                              name: creditor.name,
                              amount: Math.abs(parseNumber(creditor.amount))
                            });
                          }
                        }
                      });
                    });

                    return deficiencies.map((def, idx) => (
                      <tr key={`deficiency-${idx}`} className="border-b border-slate-200">
                        <td className="px-4 py-2 text-slate-700">Deficiency due to {def.name}</td>
                        <td className="px-4 py-2 text-right font-medium text-slate-900">
                          {formatCurrency(-def.amount)}
                        </td>
                      </tr>
                    ));
                  })()}

                  <tr>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right font-semibold">{totalUnsecuredNonPreferentialClaims === 0 ? 'NIL' : formatCurrency(-totalUnsecuredNonPreferentialClaims)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr style={{backgroundColor: '#A57C00'}}>
                    <td className="px-4 py-2 font-semibold text-white">Estimated surplus/deficiency as regards unsecured creditors</td>
                    <td className="px-4 py-2 text-right font-semibold text-white">{estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors === 0 ? 'NIL' : formatCurrency(estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Issued and called up capital</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Ordinary Shares</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-900">
                      {calculatedIssuedCalledUpCapital === null ? 'TBC' : formatCurrency(-calculatedIssuedCalledUpCapital)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right font-semibold">{totalIssuedCalledUpCapital === 0 ? 'NIL' : formatCurrency(-totalIssuedCalledUpCapital)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr style={{backgroundColor: '#A57C00'}}>
                    <td className="px-4 py-2 font-bold text-white">Estimated total deficiency/surplus as regards members</td>
                    <td className="px-4 py-2 text-right font-bold text-white">{estimatedTotalDeficiencySurplusAsRegardsMembers === 0 ? 'NIL' : formatCurrency(estimatedTotalDeficiencySurplusAsRegardsMembers)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* New Schedule of Creditors Section */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection('creditors')}
        >
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              {sectionsExpanded.creditors ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              C - Schedule of Creditors
            </div>
            <Button onClick={handleSyncFromCreditors} variant="outline" size="sm" className="flex items-center gap-2" disabled={isLocked}>
              <RefreshCw className="w-4 h-4" />
              Sync from Creditors
            </Button>
          </CardTitle>
        </CardHeader>

        {sectionsExpanded.creditors && (
          <CardContent className="p-6 space-y-8">
            {/* Company Creditors */}
            <div>
              <h3 className="text-xl font-bold mb-4 text-center">COMPANY CREDITORS (excluding employees and consumers)</h3>
              <div className="mb-4 text-sm">
                <strong>Note:</strong> You must include all creditors (excluding employees and certain consumers [see relevant page for definition of a consumer]) and indicate any creditors under hire-purchase, chattel leasing or conditional sale agreements and any creditors claiming retention of title over property in the company's possession.
              </div>

              <div className="border border-gray-300 rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#A57C00] text-white">
                      <TableHead className="font-bold text-white w-[12%]">Creditor Name</TableHead>
                      <TableHead className="font-bold text-white w-[25%]">Address</TableHead>
                      <TableHead className="font-bold text-white w-[8%] text-right">Amount of debt (£)</TableHead>
                      <TableHead className="font-bold text-white w-[13%] text-center">Retention of Title?</TableHead>
                      <TableHead className="font-bold text-white w-[15%]">Security Details</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-center">Date Security Given</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-right">Value of Security</TableHead>
                      <TableHead className="w-[7%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companyCreditorsData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-gray-500">
                          No company creditors recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {companyCreditorsData.map((creditor, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="align-top">
                              <Input
                                value={creditor.name || ''}
                                onChange={(e) => updateCompanyCreditor(idx, 'name', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={creditor.address || ''}
                                onChange={(e) => updateCompanyCreditor(idx, 'address', e.target.value)}
                                disabled={isLocked}
                                rows={2}
                                className="min-w-[150px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="text"
                                value={creditor.amount === 0 ? '' : formatNumber(creditor.amount)}
                                onChange={(e) => updateCompanyCreditor(idx, 'amount', parseNumber(e.target.value))}
                                disabled={isLocked}
                                className={numberInputClassName}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Select
                                value={creditor.retention_of_title ? 'Yes' : 'No'}
                                onValueChange={(value) => updateCompanyCreditor(idx, 'retention_of_title', value === 'Yes')}
                                disabled={isLocked}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Yes">Yes</SelectItem>
                                  <SelectItem value="No">No</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={creditor.security_details || ''}
                                onChange={(e) => updateCompanyCreditor(idx, 'security_details', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="date"
                                value={creditor.security_date || ''}
                                onChange={(e) => updateCompanyCreditor(idx, 'security_date', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="text"
                                value={creditor.security_value === 0 ? '' : formatNumber(creditor.security_value)}
                                onChange={(e) => updateCompanyCreditor(idx, 'security_value', parseNumber(e.target.value))}
                                disabled={isLocked}
                                className={numberInputClassName}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeCompanyCreditor(idx)}
                                disabled={isLocked}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Employee Claims Row */}
                        <TableRow className="bg-blue-50">
                          <TableCell className="font-semibold">Employee Claims</TableCell>
                          <TableCell></TableCell>
                          <TableCell className="text-right font-semibold">
                            £{formatNumber(employeeCreditorsTotal)}
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!isLocked && (
                <div className="flex justify-end mt-4">
                  <Button onClick={addCompanyCreditor} size="sm" disabled={isLocked}>
                    <Plus className="w-4 h-4 mr-2" /> Add Company Creditor
                  </Button>
                </div>
              )}
              {/* Totals for Company Creditors */}
              <div className="mt-4 p-3 bg-gray-50 border rounded-md">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Company Creditors Amount:</span>
                  <span>£{formatNumber(companyCreditorsTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold mt-1">
                  <span>Total Company Creditors Security Value:</span>
                  <span>£{formatNumber(companySecurityTotal)}</span>
                </div>
              </div>
            </div>

            {/* Consumer Creditors */}
            <div className="pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold mb-4 text-center">CONSUMER CREDITORS</h3>
              <div className="mb-4 text-sm">
                <strong>Note:</strong> You must include all creditors who are consumers (i.e., an individual acting for purposes that are wholly or mainly outside the individual's trade, business, craft or profession) claiming amounts paid in advance for the supply of goods or services (and indicate whether any are also creditors under hire-purchase, chattel leasing or conditional sale agreements and any claiming retention of title over property in the company's possession).
              </div>

              <div className="border border-gray-300 rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#A57C00] text-white">
                      <TableHead className="font-bold text-white w-[15%]">Creditor Name</TableHead>
                    <TableHead className="font-bold text-white w-[25%]">Address</TableHead>
                      <TableHead className="font-bold text-white w-[12%] text-right">Amount of debt (£)</TableHead>
                      <TableHead className="font-bold text-white w-[18%]">Security Details</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-center">Date Security Given</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-right">Value of Security</TableHead>
                      <TableHead className="w-[7%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumerCreditorsData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          No consumer creditors recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {consumerCreditorsData.map((creditor, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="align-top">
                              <Input
                                value={creditor.name || ''}
                                onChange={(e) => updateConsumerCreditor(idx, 'name', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={creditor.address || ''}
                                onChange={(e) => updateConsumerCreditor(idx, 'address', e.target.value)}
                                disabled={isLocked}
                                rows={2}
                                className="min-w-[150px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="text"
                                value={creditor.amount === 0 ? '' : formatNumber(creditor.amount)}
                                onChange={(e) => updateConsumerCreditor(idx, 'amount', parseNumber(e.target.value))}
                                disabled={isLocked}
                                className={numberInputClassName}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                value={creditor.security_details || ''}
                                onChange={(e) => updateConsumerCreditor(idx, 'security_details', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="date"
                                value={creditor.security_date || ''}
                                onChange={(e) => updateConsumerCreditor(idx, 'security_date', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[120px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="text"
                                value={creditor.security_value === 0 ? '' : formatNumber(creditor.security_value)}
                                onChange={(e) => updateConsumerCreditor(idx, 'security_value', parseNumber(e.target.value))}
                                disabled={isLocked}
                                className={numberInputClassName}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeConsumerCreditor(idx)}
                                disabled={isLocked}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!isLocked && (
                <div className="flex justify-end mt-4">
                  <Button onClick={addConsumerCreditor} size="sm" disabled={isLocked}>
                    <Plus className="w-4 h-4 mr-2" /> Add Consumer Creditor
                  </Button>
                </div>
              )}
              {/* Totals for Consumer Creditors */}
              <div className="mt-4 p-3 bg-gray-50 border rounded-md">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Consumer Creditors Amount:</span>
                  <span>£{formatNumber(consumerCreditorsTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-semibold mt-1">
                  <span>Total Consumer Creditors Security Value:</span>
                  <span>£{formatNumber(consumerSecurityTotal)}</span>
                </div>
              </div>
            </div>

            {/* Employee Creditors */}
            <div className="pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold mb-4 text-center">EMPLOYEE CREDITORS</h3>
              <div className="mb-4 text-sm">
                <strong>Note:</strong> You must include all employees who are creditors of the company, showing their claims for wages, holiday pay, notice pay, redundancy and other employment-related debts.
              </div>

              <div className="border border-gray-300 rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#A57C00] text-white">
                      <TableHead className="font-bold text-white w-[15%]">Name of Employee</TableHead>
                      <TableHead className="font-bold text-white w-[35%]">Address</TableHead>
                      <TableHead className="font-bold text-white w-[12%] text-right">Amount of debt (£)</TableHead>
                      <TableHead className="font-bold text-white w-[18%]">Details of any security held by creditor</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-center">Date Security Given</TableHead>
                      <TableHead className="font-bold text-white w-[10%] text-right">Value of Security</TableHead>
                      <TableHead className="w-[7%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeCreditorsData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          No employee creditors recorded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {employeeCreditorsData.map((employee, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="align-top">
                              <Input
                                value={employee.name || ''}
                                onChange={(e) => updateEmployeeCreditor(idx, 'name', e.target.value)}
                                disabled={isLocked}
                                className="min-w-[100px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Textarea
                                value={employee.address || ''}
                                onChange={(e) => updateEmployeeCreditor(idx, 'address', e.target.value)}
                                disabled={isLocked}
                                rows={2}
                                className="min-w-[150px]"
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input
                                type="text"
                                value={employee.amount === 0 ? '' : formatNumber(employee.amount)}
                                onChange={(e) => updateEmployeeCreditor(idx, 'amount', parseNumber(e.target.value))}
                                disabled={isLocked}
                                className={numberInputClassName}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              {/* Employee creditors don't typically have these fields in this context, so disable or remove inputs */}
                              <Input value="" disabled className="bg-gray-100 min-w-[100px]" />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input type="date" value="" disabled className="bg-gray-100 min-w-[120px]" />
                            </TableCell>
                            <TableCell className="align-top">
                              <Input type="text" value="£0.00" disabled className="bg-gray-100 min-w-[100px] text-right" />
                            </TableCell>
                            <TableCell className="align-top">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEmployeeCreditor(idx)}
                                disabled={isLocked}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>
              {!isLocked && (
                <div className="flex justify-end mt-4">
                  <Button onClick={addEmployeeCreditor} size="sm" disabled={isLocked}>
                    <Plus className="w-4 h-4 mr-2" /> Add Employee Creditor
                  </Button>
                </div>
              )}
              {/* Totals for Employee Creditors */}
              <div className="mt-4 p-3 bg-gray-50 border rounded-md">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Total Employee Creditors Amount:</span>
                  <span>£{formatNumber(employeeCreditorsTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* D: Schedule of Members */}
      <Card>
        <CardHeader
          className="cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => toggleSection('members')}
        >
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              {sectionsExpanded.members ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
              D - Schedule of Members
            </div>
            <Button onClick={handleSyncFromMembers} variant="outline" size="sm" className="flex items-center gap-2" disabled={isLocked}>
              <RefreshCw className="w-4 h-4" />
              Sync from Shareholders
            </Button>
          </CardTitle>
        </CardHeader>

        {sectionsExpanded.members && (
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-4 text-center">COMPANY SHAREHOLDERS</h3>
            <div className="border border-gray-300 rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#A57C00]">
                    <TableHead className="font-semibold text-white w-48">Name</TableHead>
                    <TableHead className="font-semibold text-white w-64">Address</TableHead>
                    <TableHead className="font-semibold text-white w-32">Share Class</TableHead>
                    <TableHead className="font-semibold text-white w-32 text-right">Shares Held</TableHead>
                    <TableHead className="font-semibold text-white w-32 text-right">Nominal Value/Share (£)</TableHead>
                    <TableHead className="font-semibold text-white w-32 text-right">Amount Paid (£)</TableHead>
                    <TableHead className="font-semibold text-white w-32 text-right">Amount Unpaid (£)</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentData.scheduleD.shareholders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-gray-500">
                        No shareholders recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {currentData.scheduleD.shareholders.map((member, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50">
                          <TableCell>
                            <Input
                              value={member.name || ''}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'name', e.target.value)}
                              placeholder="Member name"
                              className="w-full"
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={member.address || ''}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'address', e.target.value)}
                              placeholder="Address"
                              className="w-full"
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={member.share_class || ''}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'share_class', e.target.value)}
                              placeholder="e.g., Ordinary"
                              className="w-full"
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text" // Change to text to use formatNumber
                              value={member.shares_held === 0 ? '' : formatNumber(member.shares_held)}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'shares_held', parseNumber(e.target.value))}
                              placeholder="0"
                              className={`${numberInputClassName} w-full`}
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text" // Change to text to use formatNumber
                              value={member.nominal_value_per_share === 0 ? '' : formatNumber(member.nominal_value_per_share)}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'nominal_value_per_share', parseNumber(e.target.value))}
                              placeholder="0.00"
                              className={`${numberInputClassName} w-full`}
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text" // Change to text to use formatNumber
                              value={member.amount_paid === 0 ? '' : formatNumber(member.amount_paid)}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'amount_paid', parseNumber(e.target.value))}
                              placeholder="0.00"
                              className={`${numberInputClassName} w-full`}
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="text" // Change to text to use formatNumber
                              value={member.amount_unpaid === 0 ? '' : formatNumber(member.amount_unpaid)}
                              onChange={(e) => handleArrayFieldChange('scheduleD.shareholders', idx, 'amount_unpaid', parseNumber(e.target.value))}
                              placeholder="0.00"
                              className={`${numberInputClassName} w-full`}
                              disabled={isLocked}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleArrayRemoveRow('scheduleD.shareholders', idx)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={isLocked}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
            {!isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleArrayAddRow('scheduleD.shareholders', {
                  name: '',
                  address: '',
                  share_class: '',
                  shares_held: 0,
                  nominal_value_per_share: 0,
                  amount_paid: 0,
                  amount_unpaid: 0
                })}
                className="mt-4"
                disabled={isLocked}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}