import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, ChevronDown, ChevronRight, Trash2, Lock, Unlock } from 'lucide-react';
import { ChartOfAccount } from '@/api/entities';
import { base44 } from '@/api/base44Client';

export default function DeclarationOfSolvencyManager({ caseId, onUpdate }) {
  const [sectionsExpanded, setSectionsExpanded] = useState({
    assets: true,
    liabilities: false
  });

  const [isLocked, setIsLocked] = useState(false);
  const [accountCodes, setAccountCodes] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState({});
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(null);

  const [chargeHolderSections, setChargeHolderSections] = useState([
    {
      id: Date.now(),
      // 'name' property for the section is removed as per inferred change,
      // 'chargeholder_name' is moved to the asset level and renamed to 'description'.
      assets: {
        fixed: [{ name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }] // Changed 'chargeholder_name' to 'description'
      },
      creditors: {
        fixed: [{ name: '', amount: 0 }]
      },
      fixed_charge_surplus: 0 // Added for the new row
    }
  ]);

  const [globalAssetsData, setGlobalAssetsData] = useState({
    floating: [
      { name: '', account_code: '', book_value: 0, etr_value: 0 }
    ],
    uncharged: [
      { name: '', account_code: '', book_value: 0, etr_value: 0 }
    ]
  });

  const [liabilitiesData, setLiabilitiesData] = useState({
    preferentialCreditors: 0,
    secondaryPreferentialCreditors: 0,
    prescribedPartNetProperty: 0,
    floatingChargeDebts: 0,
    tradeExpense: 0,
    unsecuredEmployeeClaims: 0,
    issuedCalledUpCapital: 0
  });

  // New states for creditors and employees data
  const [creditors, setCreditors] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [caseData, setCaseData] = useState(null);

  // Helper function for formatting addresses
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    if (typeof address === 'string') {
      return address;
    }
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.county,
      address.postcode
    ].filter(Boolean);
    return parts.join(', ');
  }, []);

  useEffect(() => {
    const loadAccountCodes = async () => {
      try {
        setAccountsLoading(true);
        const accounts = await ChartOfAccount.list();
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          setAccountCodes(accounts);
        } else {
            // Hardcoded asset accounts for demonstration or fallback
          const hardcodedAssetAccounts = [
            {"id": "1", "account_code": "GO", "account_name": "Goodwill", "account_type": "Assets", "account_group": "Intangible Assets"},
            {"id": "2", "account_code": "PP", "account_name": "Property, Plant & Equipment", "account_type": "AA", "account_group": "Asset Realisation - Fixed Charge"},
            {"id": "3", "account_code": "ST", "account_name": "Stock/Inventory", "account_type": "Assets", "account_group": "Current Assets"},
            {"id": "4", "account_code": "CA", "account_name": "Cash at Bank", "account_type": "AA", "account_group": "Asset Realisation - Cash"},
            {"id": "5", "account_code": "DR", "account_name": "Debtors", "account_type": "Assets", "account_group": "Current Assets"}
          ];
          setAccountCodes(hardcodedAssetAccounts);
        }
      } catch (error) {
        console.error('Error loading account codes:', error);
        setAccountsError('Failed to load account codes.');
        setAccountCodes([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    const loadCreditorsAndEmployees = async () => {
      if (!caseId) return;
      
      try {
        const [allCreditorsResponse, allEmployeesResponse, caseResponse] = await Promise.all([
          base44.entities.Creditor.filter({ case_id: caseId }),
          base44.entities.Employee.filter({ case_id: caseId }),
          base44.entities.Case.filter({ id: caseId }).then(cases => cases[0])
        ]);

        const processedAllCreditors = (allCreditorsResponse || []).map(c => ({
          ...c,
          creditor_address: formatAddress(c.address)
        }));
        setCreditors(processedAllCreditors);

        const processedAllEmployees = (allEmployeesResponse || []).map(emp => {
          const totalClaim = (parseNumber(emp.total_preferential_claim) || 0) + (parseNumber(emp.total_unsecured_claim) || 0);
          return { ...emp, total_claim: totalClaim, full_address: formatAddress(emp.address) };
        });
        setEmployees(processedAllEmployees);
        setCaseData(caseResponse);
      } catch (error) {
        console.error('Error loading creditors and employees:', error);
      }
    };
    
    loadAccountCodes();
    loadCreditorsAndEmployees();
  }, [caseId, formatAddress]);

  const parseNumber = useCallback((value) => {
    if (!value || value === '') return 0;
    // This function is generally used for parsing inputs where decimals might be expected,
    // e.g., creditor amounts. For asset book/ETR values, parseInt is used directly in onChange.
    const num = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? 0 : num;
  }, []);

  const updateAsset = useCallback((sectionId, assetType, index, field, value) => {
    if (isLocked && field !== 'name' && field !== 'account_code' && field !== 'description') { // Added 'description' to bypass lock check
      return;
    }
    // For book_value and etr_value, the value is already parsed to an integer in the onChange handler.
    // For 'amount' (used in creditors), parseNumber will be used.
    const processedValue = (field === 'amount') ? parseNumber(value) : value;

    if (sectionId) {
      setChargeHolderSections(prevSections =>
        prevSections.map(section =>
          section.id === sectionId
            ? {
                ...section,
                assets: {
                  ...section.assets,
                  [assetType]: section.assets[assetType].map((asset, i) =>
                    i === index ? { ...asset, [field]: processedValue } : asset
                  )
                }
              }
            : section
        )
      );
    } else {
      setGlobalAssetsData(prev => ({
        ...prev,
        [assetType]: prev[assetType].map((row, i) =>
          i === index ? { ...row, [field]: processedValue } : row
        )
      }));
    }
  }, [isLocked, parseNumber]);

  const getAssetAccountSuggestions = useCallback((searchTerm = '', sectionType = 'general') => {
    let filteredAccounts = [];
    
    if (sectionType === 'fixed_charge') {
      filteredAccounts = accountCodes.filter(account => {
        const group = (account.account_group || '').toLowerCase();
        const name = (account.account_name || '').toLowerCase();
        return group.includes('fixed charge') || 
               group.includes('fixed charge asset realisation') ||
               name.includes('fixed charge') ||
               (account.account_type === 'AA' && name.includes('fixed'));
      });
    } else if (sectionType === 'floating_charge') {
      filteredAccounts = accountCodes.filter(account => {
        const group = (account.account_group || '').toLowerCase();
        const name = (account.account_name || '').toLowerCase();
        return group.includes('floating charge') || 
               group.includes('floating charge asset realisation') ||
               name.includes('floating charge') ||
               (account.account_type === 'AA' && name.includes('floating'));
    
      });
    } else { // General assets (uncharged)
      filteredAccounts = accountCodes.filter(account => {
        const group = (account.account_group || '').toLowerCase();
        const name = (account.account_name || '').toLowerCase(); // Added name for general type filtering
        // Include assets that are generally for realization or not specifically fixed/floating charge
        return (group.includes('asset realisation') && !group.includes('fixed charge') && !group.includes('floating charge')) || 
               (group.includes('asset realisations') && !group.includes('fixed charge') && !group.includes('floating charge')) ||
               (account.account_type === 'AA' && !name.includes('fixed') && !name.includes('floating'));
      });
    }
    
    if (!searchTerm || searchTerm.length < 1) {
      return filteredAccounts.slice(0, 20);
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    const matchingAccounts = filteredAccounts.filter(account => {
      const name = (account.account_name || '').toLowerCase();
      const code = (account.account_code || '').toLowerCase();
      
      return name.includes(term) || code.includes(term);
    });
    
    return matchingAccounts.slice(0, 20);
  }, [accountCodes]);

  const formatNumber = (value) => {
    if (!value || value === '') return '';
    // This function is for display formatting, it can still show decimals even if
    // the stored number is an integer, making it consistent with other currency displays.
    const num = parseFloat(value.toString().replace(/,/g, ''));
    return isNaN(num) ? '' : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAssetDescriptionChange = useCallback((sectionId, assetType, index, value) => {
    // This function is now specifically for floating/uncharged assets where 'name' is the description field.
    // Fixed assets now handle 'description' directly via updateAsset.
    const fieldToUpdate = 'name'; // Always 'name' for non-fixed assets
    updateAsset(sectionId, assetType, index, fieldToUpdate, value);
    const suggestionKey = sectionId ? `${sectionId}-${assetType}-${index}` : `${assetType}-${index}`;
    setShowSuggestions(prev => ({
      ...prev,
      [suggestionKey]: value && value.length >= 1
    }));
  }, [updateAsset]);

  const selectAccountFromSuggestion = useCallback((sectionId, assetType, index, selectedAccount) => {
    if (!selectedAccount) return;
    updateAsset(sectionId, assetType, index, 'account_code', selectedAccount.account_code);
    // If it's a fixed asset in a section, update 'description' instead of 'name'
    if (sectionId && assetType === 'fixed') {
      updateAsset(sectionId, assetType, index, 'description', selectedAccount.account_name);
    } else {
      updateAsset(sectionId, assetType, index, 'name', selectedAccount.account_name);
    }
    const suggestionKey = sectionId ? `${sectionId}-${assetType}-${index}` : `${assetType}-${index}`;
    setShowSuggestions(prev => ({
      ...prev,
      [suggestionKey]: false
    }));
  }, [updateAsset]);

  const addAsset = (sectionId, assetType) => {
    if (isLocked) return;
    // Added 'description' for fixed assets, removed 'chargeholder_name'
    const newAsset = (assetType === 'fixed') 
      ? { name: '', account_code: '', book_value: 0, etr_value: 0, description: '' } 
      : { name: '', account_code: '', book_value: 0, etr_value: 0 };

    if (sectionId) {
      setChargeHolderSections(prevSections =>
        prevSections.map(section =>
          section.id === sectionId
            ? {
                ...section,
                assets: {
                  ...section.assets,
                  [assetType]: [...section.assets[assetType], newAsset]
                }
              }
            : section
        )
      );
    } else {
      setGlobalAssetsData(prev => ({
        ...prev,
        [assetType]: [...prev[assetType], newAsset]
      }));
    }
  };

  const removeLastAsset = (sectionId, assetType) => {
    if (isLocked) return;

    if (sectionId) {
      setChargeHolderSections(prevSections =>
        prevSections.map(section => {
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
            return section; // If no assets to remove, return original section
          }
          return section; // Return unchanged section if ID doesn't match
        })
      );
    } else {
      setGlobalAssetsData(prev => {
        const currentAssets = prev[assetType];
        if (currentAssets.length > 0) {
          return {
            ...prev,
            [assetType]: currentAssets.slice(0, -1)
          };
        }
        return prev;
      });
    }
  };

  const removeAsset = (sectionId, assetType, index) => {
    if (isLocked) return;
    if (sectionId) {
      setChargeHolderSections(prevSections =>
        prevSections.map(section =>
          section.id === sectionId
            ? {
                ...section,
                assets: {
                  ...section.assets,
                  [assetType]: section.assets[assetType].filter((_, i) => i !== index)
                }
              }
            : section
        )
      );
    } else {
      setGlobalAssetsData(prev => ({
        ...prev,
        [assetType]: prev[assetType].filter((_, i) => i !== index)
      }));
    }
  };

  // updateChargeHolderSectionName function removed as section 'name' is no longer used for chargeholder name
  // const updateChargeHolderSectionName = useCallback((sectionId, value) => {
  //   if (isLocked) return;
  //   setChargeHolderSections(prevSections =>
  //     prevSections.map(section =>
  //       section.id === sectionId
  //         ? { ...section, name: value }
  //         : section
  //     )
  //   );
  // }, [isLocked]);

  const updateChargeholder = (sectionId, creditorType, index, field, value) => {
    if (isLocked) return;
    const processedValue = (field === 'amount') ? parseNumber(value) : value;

    setChargeHolderSections(prevSections =>
      prevSections.map(section =>
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
      )
    );
  };

  const updateChargeHolderSection = useCallback((sectionId, field, value) => {
    if (isLocked) return;
    setChargeHolderSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? { ...section, [field]: value }
          : section
      )
    );
  }, [isLocked]);

  const addChargeholder = (sectionId, creditorType) => {
    if (isLocked) return;
    const newCreditor = { name: '', amount: 0 };
    setChargeHolderSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              creditors: {
                ...section.creditors,
                [creditorType]: [...section.creditors[creditorType], newCreditor]
              }
            }
          : section
      )
    );
  };

  const removeLastChargeholder = useCallback((sectionId, creditorType) => {
    if (isLocked) return;
    setChargeHolderSections(prevSections =>
      prevSections.map(section => {
        if (section.id === sectionId) {
          const currentCreditors = section.creditors[creditorType]; // Corrected from section.creditor
          if (currentCreditors.length > 0) {
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
      })
    );
  }, [isLocked]);

  const removeChargeholder = (sectionId, creditorType, index) => {
    if (isLocked) return;
    setChargeHolderSections(prevSections =>
      prevSections.map(section =>
        section.id === sectionId
          ? {
              ...section,
              creditors: {
                ...section.creditors,
                [creditorType]: section.creditors[creditorType].filter((_, i) => i !== index)
              }
            }
          : section
      )
    );
  };

  const addChargeHolderSection = useCallback(() => {
    if (isLocked) return;
    setChargeHolderSections(prevSections => {
      const newSection = {
        id: Date.now(),
        // 'name' property for the section is removed
        assets: {
          fixed: [{ name: '', account_code: '', book_value: 0, etr_value: 0, description: '' }] // Changed 'chargeholder_name' to 'description'
        },
        creditors: {
          fixed: [{ name: '', amount: 0 }]
        },
        fixed_charge_surplus: 0 // Added for the new row
      };
      return [...prevSections, newSection];
    });
  }, [isLocked]);

  const removeLastChargeHolderSection = useCallback(() => {
    if (isLocked) return;
    setChargeHolderSections(prevSections => {
      if (prevSections.length > 1) {
        return prevSections.slice(0, -1);
      }
      return prevSections;
    });
  }, [isLocked]);

  const deleteChargeHolderSection = (sectionId) => {
    if (isLocked) return;
    setChargeHolderSections(prevSections => prevSections.filter(section => section.id !== sectionId));
  };

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateLiability = (field, value) => {
    if (isLocked) return;
    setLiabilitiesData(prev => ({
      ...prev,
      [field]: parseNumber(value)
    }));
  };

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
        assetSum + parseNumber(asset.etr_value), 0
      ), 0
    );
  }, [chargeHolderSections, parseNumber]);

  const totalFixedChargeCreditorsAmount = useMemo(() => {
    return chargeHolderSections.reduce((sectionSum, section) =>
      sectionSum + section.creditors.fixed.reduce((creditorSum, creditor) =>
        creditorSum + parseNumber(creditor.amount), 0
      ), 0
    );
  }, [chargeHolderSections, parseNumber]);

  const totalFloatingChargeAssetsBook = useMemo(() => {
    return globalAssetsData.floating.reduce((sum, asset) =>
      sum + parseNumber(asset.book_value), 0
    );
  }, [globalAssetsData.floating, parseNumber]);

  const totalFloatingChargeAssetsEtr = useMemo(() => {
    return globalAssetsData.floating.reduce((sum, asset) =>
      sum + parseNumber(asset.etr_value), 0
    );
  }, [globalAssetsData.floating, parseNumber]);

  const totalUnchargedAssetsBook = useMemo(() => {
    return globalAssetsData.uncharged.reduce((sum, asset) =>
      sum + parseNumber(asset.book_value), 0
    );
  }, [globalAssetsData.uncharged, parseNumber]);

  const totalUnchargedAssetsEtr = useMemo(() => {
    return globalAssetsData.uncharged.reduce((sum, asset) =>
      sum + parseNumber(asset.etr_value), 0
    );
  }, [globalAssetsData.uncharged, parseNumber]);

  // This is the existing calculation for preferential creditors assets, used in liabilities summary
  const totalAssetsForPreferentialCreditors = useMemo(() => {
    return totalFixedChargeAssetsEtr + totalFloatingChargeAssetsEtr + totalUnchargedAssetsEtr;
  }, [totalFixedChargeAssetsEtr, totalFloatingChargeAssetsEtr, totalUnchargedAssetsEtr]);

  // NEW CALCULATED FIELD FOR ASSETS SUMMARY, using outline's specified calculation logic
  const calculatedTotalAssetsForPreferentialCreditors = useMemo(() => {
    // Sum of user-entered fixed_charge_surplus from each chargeHolderSection
    const fixedSurplusSum = chargeHolderSections.reduce((sum, section) =>
        sum + (parseNumber(section.fixed_charge_surplus) || 0), 0
    );
    // As per outline's implicit intention, and data structure, floating assets are from global data.
    const floatingAssetsEtr = totalFloatingChargeAssetsEtr; 
    const unchargedAssetsEtr = totalUnchargedAssetsEtr;

    return fixedSurplusSum + floatingAssetsEtr + unchargedAssetsEtr;
  }, [chargeHolderSections, totalFloatingChargeAssetsEtr, totalUnchargedAssetsEtr, parseNumber]);


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

  // Calculated liability fields from CVL Statement of Affairs
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

  const unsecuredFromFixedSections = useMemo(() => {
    let total = 0;
    
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
            total += Math.abs(parseNumber(creditor.amount));
          }
        }
      });
    });
    
    return total;
  }, [chargeHolderSections, creditors, parseNumber]);

  const calculatedBankFloatingCharges = useMemo(() => {
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
    const shareholders = caseData?.shareholders || [];
    if (shareholders.length === 0) return null;

    const totalCapital = shareholders.reduce((sum, shareholder) => {
      const sharesHeld = parseNumber(shareholder.shares_held) || 0;
      const nominalValuePerShare = parseNumber(shareholder.nominal_value) / 100 || 0;
      return sum + (sharesHeld * nominalValuePerShare);
    }, 0);

    return totalCapital;
  }, [caseData, parseNumber]);

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
      return null;
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

  const totalUnsecuredNonPreferentialClaims = useMemo(() => {
    return calculatedUnsecuredEmployeeClaims + calculatedTradeCreditors + calculatedOtherUnsecuredCreditors + unsecuredFromFixedSections;
  }, [calculatedUnsecuredEmployeeClaims, calculatedTradeCreditors, calculatedOtherUnsecuredCreditors, unsecuredFromFixedSections]);

  const estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors = useMemo(() => {
    return estimatedDeficiencySurplusAsRegardsUnsecuredCreditors - totalUnsecuredNonPreferentialClaims;
  }, [estimatedDeficiencySurplusAsRegardsUnsecuredCreditors, totalUnsecuredNonPreferentialClaims]);

  const totalIssuedCalledUpCapital = useMemo(() => {
    return calculatedIssuedCalledUpCapital !== null ? calculatedIssuedCalledUpCapital : 0;
  }, [calculatedIssuedCalledUpCapital]);

  const estimatedTotalDeficiencySurplusAsRegardsMembers = useMemo(() => {
    return estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors - totalIssuedCalledUpCapital;
  }, [estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors, totalIssuedCalledUpCapital]);

  useEffect(() => {
    const loadAccountCodes = async () => {
      try {
        setAccountsLoading(true);
        const accounts = await ChartOfAccount.list();
        if (accounts && Array.isArray(accounts) && accounts.length > 0) {
          setAccountCodes(accounts);
        } else {
            // Hardcoded asset accounts for demonstration or fallback
          const hardcodedAssetAccounts = [
            {"id": "1", "account_code": "GO", "account_name": "Goodwill", "account_type": "Assets", "account_group": "Intangible Assets"},
            {"id": "2", "account_code": "PP", "account_name": "Property, Plant & Equipment", "account_type": "AA", "account_group": "Asset Realisation - Fixed Charge"},
            {"id": "3", "account_code": "ST", "account_name": "Stock/Inventory", "account_type": "Assets", "account_group": "Current Assets"},
            {"id": "4", "account_code": "CA", "account_name": "Cash at Bank", "account_type": "AA", "account_group": "Asset Realisation - Cash"},
            {"id": "5", "account_code": "DR", "account_name": "Debtors", "account_type": "Assets", "account_group": "Current Assets"}
          ];
          setAccountCodes(hardcodedAssetAccounts);
        }
      } catch (error) {
        console.error('Error loading account codes:', error);
        setAccountsError('Failed to load account codes.');
        setAccountCodes([]);
      } finally {
        setAccountsLoading(false);
      }
    };

    const loadCreditorsAndEmployees = async () => {
      if (!caseId) return;
      
      try {
        const [allCreditorsResponse, allEmployeesResponse, caseResponse] = await Promise.all([
          base44.entities.Creditor.filter({ case_id: caseId }),
          base44.entities.Employee.filter({ case_id: caseId }),
          base44.entities.Case.filter({ id: caseId }).then(cases => cases[0])
        ]);

        const processedAllCreditors = (allCreditorsResponse || []).map(c => ({
          ...c,
          creditor_address: formatAddress(c.address)
        }));
        setCreditors(processedAllCreditors);

        const processedAllEmployees = (allEmployeesResponse || []).map(emp => {
          const totalClaim = (parseNumber(emp.total_preferential_claim) || 0) + (parseNumber(emp.total_unsecured_claim) || 0);
          return { ...emp, total_claim: totalClaim, full_address: formatAddress(emp.address) };
        });
        setEmployees(processedAllEmployees);
        setCaseData(caseResponse);
      } catch (error) {
        console.error('Error loading creditors and employees:', error);
      }
    };
    
    loadAccountCodes();
    loadCreditorsAndEmployees();
  }, [caseId, formatAddress]);

  const numberInputClassName = "h-8 text-sm border border-slate-200 rounded-md px-2 bg-white text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end"> {/* Changed to justify-end as title is removed */}
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
            <div className="space-y-6">
              {/* Updated fixed charge assets header row */}
              <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b font-medium text-sm text-white" style={{backgroundColor: '#A57C00'}}>
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
                    const suggestionKey = `${section.id}-fixed-${index}`;
                    const shouldShowSuggestions = showSuggestions[suggestionKey];

                    return (
                      <div key={index} className="px-4 py-2 border text-sm grid grid-cols-12 gap-4 items-center"> {/* Changed to grid-cols-12 */}
                        {/* Input for fixed asset description, using 'description' field */}
                        <Input
                          value={asset.description || ''}
                          onChange={(e) => updateAsset(section.id, 'fixed', index, 'description', e.target.value)}
                          className="col-span-3 h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                          placeholder="Enter Description" // Updated placeholder
                          disabled={isLocked}
                        />

                        <div className="relative col-span-3"> {/* Added col-span-3 */}
                          <Input
                            value={asset.account_code || ''}
                            placeholder="Click to see account codes"
                            readOnly
                            className="h-8 text-sm border border-slate-200 rounded-md px-2 bg-gray-100 cursor-pointer"
                            disabled={isLocked}
                            onClick={() => {
                              setShowSuggestions(prev => ({
                                ...prev,
                                [suggestionKey]: true
                              }));
                            }}
                          />

                          {shouldShowSuggestions && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto mt-1 z-50">
                              {accountsLoading ? (
                                <div className="px-3 py-4 text-center text-gray-500">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                  Loading account codes...
                                </div>
                              ) : (
                                <>
                                  {(() => {
                                    // Use asset.description for suggestions filter
                                    const suggestions = getAssetAccountSuggestions(asset.description, 'fixed_charge'); 
                                    
                                    if (suggestions.length === 0) {
                                      const allFixedChargeRealisations = accountCodes.filter(acc => {
                                        const group = (acc.account_group || '').toLowerCase();
                                        const name = (acc.account_name || '').toLowerCase();
                                        return group.includes('fixed charge') || 
                                               group.includes('fixed charge asset realisation') ||
                                               name.includes('fixed charge') ||
                                               (acc.account_type === 'AA' && name.includes('fixed'));
                                      });
                                      return (
                                        <div className="px-3 py-4">
                                          <div className="text-gray-600 text-sm mb-2">No matching fixed charge accounts found.</div>
                                          {allFixedChargeRealisations.length === 0 ? (
                                            <div className="text-gray-500 text-xs">No Fixed Charge Asset Realisation accounts available.</div>
                                          ) : (
                                            <>
                                              <div className="text-xs text-gray-500 mb-2">Fixed Charge Asset Realisation accounts:</div>
                                              {allFixedChargeRealisations.map((acc, idx) => (
                                                <div 
                                                  key={acc.id || idx} 
                                                  className="text-sm hover:bg-blue-50 cursor-pointer py-2 px-2 rounded border-b last:border-b-0"
                                                  onClick={() => {
                                                    selectAccountFromSuggestion(section.id, 'fixed', index, acc);
                                                  }}
                                                >
                                                  <div className="font-semibold text-blue-700">
                                                    {acc.account_code}
                                                  </div>
                                                  <div className="text-gray-600">
                                                    {acc.account_name}
                                                  </div>
                                                </div>
                                              ))}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div>
                                        {suggestions.map((account, idx) => (
                                          <div
                                            key={account.id || idx}
                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-b-0"
                                            onClick={() => {
                                              selectAccountFromSuggestion(section.id, 'fixed', index, account);
                                            }}
                                          >
                                            <div className="font-semibold text-blue-700">
                                              {account.account_code}
                                            </div>
                                            <div className="text-gray-600">
                                              {account.account_name}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        <Input
                          type="number"
                          value={asset.book_value === 0 ? '' : asset.book_value} // Display empty if 0 for better UX
                          onChange={(e) => updateAsset(section.id, 'fixed', index, 'book_value', parseInt(e.target.value) || 0)}
                          className={`${numberInputClassName} col-span-3`} // Added col-span-3
                          placeholder="0"
                          disabled={isLocked}
                        />
                        <Input
                          type="number"
                          value={asset.etr_value === 0 ? '' : asset.etr_value} // Display empty if 0 for better UX
                          onChange={(e) => updateAsset(section.id, 'fixed', index, 'etr_value', parseInt(e.target.value) || 0)}
                          className={`${numberInputClassName} ml-auto col-span-3`} // Applied ml-auto for right alignment of the input box, Added col-span-3
                          placeholder="0"
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
                          <Plus className="w-3 h-3 mr-1 text-blue-600" />
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

                  <div className="px-4 py-2 border-b text-sm">
                    <div className="text-sm font-medium text-gray-700 mb-2">Less Amounts due to</div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1"> {/* Modified to show name & amount */}
                      {/* Original Input for section.name (chargeholder name) removed as it's now handled per asset */}
                      {/* <Input
                        value={section.name || ''}
                        onChange={(e) => updateChargeHolderSectionName(section.id, e.target.value)}
                        className="h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                        placeholder="Chargeholder Name (e.g., Bank ABC)"
                        disabled={isLocked}
                      /> */}
                      {section.creditors.fixed.map((creditor, creditorIndex) => (
                        <React.Fragment key={creditorIndex}>
                          <Input
                            type="text"
                            value={creditor.name || ''}
                            onChange={(e) => updateChargeholder(section.id, 'fixed', creditorIndex, 'name', e.target.value)}
                            className="h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                            placeholder="Name of Chargeholder"
                            disabled={isLocked}
                          />
                          <Input
                            type="text"
                            value={creditor.amount === 0 ? '' : creditor.amount}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, ''); // Only allow numbers (digits)
                              updateChargeholder(section.id, 'fixed', creditorIndex, 'amount', parseInt(value) || 0); // Parse as integer
                            }}
                            className={numberInputClassName} // Use the robust class that handles alignment and spinners
                            placeholder="0" // Placeholder changed
                            disabled={isLocked}
                          />
                        </React.Fragment>
                      ))}
                      <div className="flex gap-2 justify-end col-span-2"> {/* Buttons span two columns */}
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

                      {/* Fixed Charge Surplus/Deficiency Row */}
                      <div className="col-span-1">
                        <Label className="text-sm text-slate-700">
                          Fixed Charge Surplus (Deficiency) C/F
                        </Label>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <Input
                          type="text"
                          value={section.fixed_charge_surplus || ''}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.-]/g, ''); // Allow numbers, period, and hyphen for negative
                            updateChargeHolderSection(section.id, 'fixed_charge_surplus', parseNumber(value)); // Use parseNumber for consistency
                          }}
                          className="h-8 text-sm text-right w-32"
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
            </div>

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

            <div className="mb-6">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Floating Charge Assets Header */}
                <div className="px-4 py-2 text-sm font-medium grid grid-cols-12 gap-4 border-b" style={{backgroundColor: '#A57C00'}}>
                  <div className="col-span-6 text-sm font-medium text-white">Assets Subject to a Floating Charge</div>
                  <div className="col-span-3 text-sm font-medium text-white text-right">Book Value (£)</div>
                  <div className="col-span-3 text-sm font-medium text-white text-right">Estimated to Realise (£)</div>
                </div>
                {globalAssetsData.floating.map((asset, index) => { 
                  const suggestionKey = `floating-${index}`; 
                  const shouldShowSuggestions = showSuggestions[suggestionKey];
                  
                  return (
                    <div key={index} className="px-4 py-2 border-b text-sm grid grid-cols-12 gap-4 items-center">
                      <Input
                        value={asset.name || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleAssetDescriptionChange(null, 'floating', index, value);
                        }}
                        className="col-span-3 h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                        placeholder="Enter description"
                        disabled={isLocked}
                      />
                      
                      <div className="relative col-span-3">
                        <Input
                          value={asset.account_code || ''}
                          placeholder="Click to see account codes"
                          readOnly
                          className="h-8 text-sm border border-slate-200 rounded-md px-2 bg-gray-100 cursor-pointer"
                          disabled={isLocked}
                          onClick={() => {
                            setShowSuggestions(prev => ({
                              ...prev,
                              [suggestionKey]: true
                            }));
                          }}
                        />

                        {shouldShowSuggestions && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto mt-1 z-50">
                            {accountsLoading ? (
                              <div className="px-3 py-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                Loading account codes...
                              </div>
                            ) : (
                                <>
                                  {(() => {
                                    const suggestions = getAssetAccountSuggestions(asset.name, 'floating_charge');
                                    
                                    if (suggestions.length === 0) {
                                      const allFloatingChargeRealisations = accountCodes.filter(acc => {
                                        const group = (acc.account_group || '').toLowerCase();
                                        const name = (acc.account_name || '').toLowerCase();
                                        return group.includes('floating charge') || 
                                               group.includes('floating charge asset realisation') ||
                                               name.includes('floating charge') ||
                                               (acc.account_type === 'AA' && name.includes('floating'));
                                      });
                                      return (
                                        <div className="px-3 py-4">
                                          <div className="text-gray-600 text-sm mb-2">No matching floating charge accounts found.</div>
                                          {allFloatingChargeRealisations.length === 0 ? (
                                            <div className="text-gray-500 text-xs">No Floating Charge Asset Realisation accounts available.</div>
                                          ) : (
                                            <>
                                              <div className="text-xs text-gray-500 mb-2">Floating Charge Asset Realisation accounts:</div>
                                              {allFloatingChargeRealisations.map((acc, idx) => (
                                                <div 
                                                  key={acc.id || idx} 
                                                  className="text-sm hover:bg-blue-50 cursor-pointer py-2 px-2 rounded border-b last:border-b-0"
                                                  onClick={() => {
                                                    selectAccountFromSuggestion(null, 'floating', index, acc);
                                                  }}
                                                >
                                                  <div className="font-semibold text-blue-700">
                                                    {acc.account_code}
                                                  </div>
                                                  <div className="text-gray-600">
                                                    {acc.account_name}
                                                  </div>
                                                </div>
                                              ))}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div>
                                        {suggestions.map((account, idx) => (
                                          <div
                                            key={account.id || idx}
                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-b-0"
                                            onClick={() => {
                                              selectAccountFromSuggestion(null, 'floating', index, account);
                                            }}
                                          >
                                            <div className="font-semibold text-blue-700">
                                              {account.account_code}
                                            </div>
                                            <div className="text-gray-600">
                                              {account.account_name}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Input
                        type="number"
                        value={asset.book_value === 0 ? '' : asset.book_value}
                        onChange={(e) => updateAsset(null, 'floating', index, 'book_value', parseInt(e.target.value) || 0)} 
                        className={`${numberInputClassName} col-span-3`}
                        placeholder="0"
                        disabled={isLocked}
                      />
                      <Input
                        type="number"
                        value={asset.etr_value === 0 ? '' : asset.etr_value}
                        onChange={(e) => updateAsset(null, 'floating', index, 'etr_value', parseInt(e.target.value) || 0)} 
                        className={`${numberInputClassName} ml-auto col-span-3`} // Applied ml-auto for right alignment of the input box, replacing ml-8
                        placeholder="0"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t">
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

            <div className="mb-6">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Uncharged Assets Header */}
                <div className="px-4 py-2 text-sm font-medium grid grid-cols-12 gap-4 border-b" style={{backgroundColor: '#A57C00'}}>
                  <div className="col-span-6 text-sm font-medium text-white">Uncharged Assets</div>
                  <div className="col-span-3 text-sm font-medium text-white text-right">Book Value (£)</div>
                  <div className="col-span-3 text-sm font-medium text-white text-right">Estimated to Realise (£)</div>
                </div>
                {globalAssetsData.uncharged.map((asset, index) => { 
                  const suggestionKey = `uncharged-${index}`; 
                  const shouldShowSuggestions = showSuggestions[suggestionKey];
                  
                  return (
                    <div key={index} className="px-4 py-2 border-b text-sm grid grid-cols-12 gap-4 items-center">
                      <Input
                        value={asset.name || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleAssetDescriptionChange(null, 'uncharged', index, value);
                        }}
                        className="col-span-3 h-8 text-sm border border-slate-200 rounded-md px-2 bg-white"
                        placeholder="Enter description"
                        disabled={isLocked}
                      />
                      
                      <div className="relative col-span-3">
                        <Input
                          value={asset.account_code || ''}
                          placeholder="Click to see account codes"
                          readOnly
                          className="h-8 text-sm border border-slate-200 rounded-md px-2 bg-gray-100 cursor-pointer"
                          disabled={isLocked}
                          onClick={() => {
                              setShowSuggestions(prev => ({
                                ...prev,
                                [suggestionKey]: true
                              }));
                          }}
                        />
                        
                        {shouldShowSuggestions && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg max-h-64 overflow-y-auto mt-1 z-50">
                            {accountsLoading ? (
                              <div className="px-3 py-4 text-center text-gray-500">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mx-auto mb-2"></div>
                                Loading account codes...
                              </div>
                            ) : (
                                <>
                                  {(() => {
                                    const suggestions = getAssetAccountSuggestions(asset.name, 'general');
                                    
                                    if (suggestions.length === 0) {
                                      const allAssetRealisations = accountCodes.filter(acc => {
                                        const group = (acc.account_group || '').toLowerCase();
                                        return group.includes('asset realisation') || 
                                               group.includes('asset realisations') ||
                                               acc.account_type === 'AA';
                                      });
                                      return (
                                        <div className="px-3 py-4">
                                          <div className="text-gray-600 text-sm mb-2">No matching accounts found.</div>
                                          {allAssetRealisations.length === 0 ? (
                                            <div className="text-gray-500 text-xs">No Asset Realisation accounts available.</div>
                                          ) : (
                                            <>
                                              <div className="text-xs text-gray-500 mb-2">Asset Realisation accounts:</div>
                                              {allAssetRealisations.map((acc, idx) => (
                                                <div 
                                                  key={acc.id || idx} 
                                                  className="text-sm hover:bg-blue-50 cursor-pointer py-2 px-2 rounded border-b last:border-b-0"
                                                  onClick={() => {
                                                    selectAccountFromSuggestion(null, 'uncharged', index, acc);
                                                  }}
                                                >
                                                  <div className="font-semibold text-blue-700">
                                                    {acc.account_code}
                                                  </div>
                                                  <div className="text-gray-600">
                                                    {acc.account_name}
                                                  </div>
                                                </div>
                                              ))}
                                            </>
                                          )}
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <div>
                                        {suggestions.map((account, idx) => (
                                          <div
                                            key={account.id || idx}
                                            className="px-3 py-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-b-0"
                                            onClick={() => {
                                              selectAccountFromSuggestion(null, 'uncharged', index, account);
                                            }}
                                          >
                                            <div className="font-semibold text-blue-700">
                                              {account.account_code}
                                            </div>
                                            <div className="text-gray-600">
                                              {account.account_name}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <Input
                        type="number"
                        value={asset.book_value === 0 ? '' : asset.book_value}
                        onChange={(e) => updateAsset(null, 'uncharged', index, 'book_value', parseInt(e.target.value) || 0)}
                        className={`${numberInputClassName} col-span-3`}
                        placeholder="0"
                        disabled={isLocked}
                      />
                      
                      <Input
                        type="number"
                        value={asset.etr_value === 0 ? '' : asset.etr_value}
                        onChange={(e) => updateAsset(null, 'uncharged', index, 'etr_value', parseInt(e.target.value) || 0)}
                        className={`${numberInputClassName} ml-auto col-span-3`} // Applied ml-auto for right alignment of the input box
                        placeholder="0"
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t">
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
              {/* Replaced existing total assets for preferential creditors row with the new calculated field and styling */}
              <div className="px-4 py-2 border font-bold text-sm grid grid-cols-2 gap-4">
                <div className="col-span-1 bg-slate-50 p-2 rounded">
                  <Label className="text-sm font-medium text-slate-700">
                    Estimated total assets available for preferential creditors
                  </Label>
                </div>
                <div className="col-span-1 bg-slate-50 p-2 rounded flex justify-end">
                  <Input
                    type="text"
                    value={formatNumber(calculatedTotalAssetsForPreferentialCreditors)}
                    className="h-8 text-sm text-right w-32 bg-slate-100"
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Only show C and D schedules for non-MVL cases */}
      {caseData?.case_type !== 'MVL' && (
        <>
          {/* C - Schedule of Creditors would go here if we had it */}
          {/* D - Schedule of Members would go here if we had it */}
        </>
      )}

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
                      {formatCurrency(calculatedTotalAssetsForPreferentialCreditors)}
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalMoratoriumClaim)}</td>
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
                      {formatCurrency(estimatedDeficiencySurplusPreferentialCreditors)}
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalPreferentialClaim)}</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900 border-b-2 border-transparent">Estimated deficiency/surplus as regards preferential creditors:</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(estimatedDeficiencySurplusAsRegardsPreferentialCreditors)}</td>
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalSecondaryPreferentialCreditors)}</td>
                  </tr>
                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900 border-b-2 border-transparent">Estimated deficiency/surplus as regards secondary preferential creditors:</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(estimatedDeficiencySurplusAsRegardsSecondaryPreferentialCreditors)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Estimated prescribed part of net property where applicable (to carry forward)</td>
                    <td className="px-4 py-2 text-right">{estimatedPrescribedPartOfNetProperty === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetProperty)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated total assets available for floating charge holders</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(estimatedTotalAssetsAvailableForFloatingChargeHolders)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Debts secured by floating charges</td>
                    <td className="px-4 py-2"></td>
                  </tr>

                  {(() => {
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalFloatingChargeClaims)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated deficiency/surplus of assets after floating charges</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(estimatedDeficiencySurplusAfterFloatingCharges)}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Estimated prescribed part of net property where applicable (brought down)</td>
                    <td className="px-4 py-2 text-right">{estimatedPrescribedPartOfNetPropertyBroughtDown === null ? 'N/A' : formatCurrency(estimatedPrescribedPartOfNetPropertyBroughtDown)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr className="bg-blue-50">
                    <td className="px-4 py-2 font-semibold text-slate-900">Estimated deficiency/surplus as regards unsecured creditors</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(estimatedDeficiencySurplusAsRegardsUnsecuredCreditors)}</td>
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalUnsecuredNonPreferentialClaims)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr style={{backgroundColor: '#A57C00'}}>
                    <td className="px-4 py-2 font-semibold text-white">Estimated surplus/deficiency as regards unsecured creditors</td>
                    <td className="px-4 py-2 text-right font-semibold text-white">{formatCurrency(estimatedSurplusDeficiencyAsRegardsUnsecuredCreditors)}</td>
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
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(-totalIssuedCalledUpCapital)}</td>
                  </tr>

                  <tr className="h-4"><td colSpan="2"></td></tr>

                  <tr style={{backgroundColor: '#A57C00'}}>
                    <td className="px-4 py-2 font-bold text-white">Estimated total deficiency/surplus as regards members</td>
                    <td className="px-4 py-2 text-right font-bold text-white">{formatCurrency(estimatedTotalDeficiencySurplusAsRegardsMembers)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}