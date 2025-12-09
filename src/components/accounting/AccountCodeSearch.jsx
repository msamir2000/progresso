import React, { useState, useEffect, useMemo } from "react";
import { ChartOfAccount } from "@/api/entities";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function AccountCodeSearch({ 
  onSelect, 
  autoSuggestFromDescription = null,
  assetCategory = null,
  onClose
}) {
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChartOfAccounts = async () => {
      setIsLoading(true);
      try {
        const accounts = await ChartOfAccount.list();
        console.log("Loaded chart of accounts:", accounts); // Debug log
        setChartOfAccounts(accounts || []);
      } catch (error) {
        console.error("Error loading chart of accounts:", error);
        setChartOfAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadChartOfAccounts();
  }, []);

  const suggestedAccounts = useMemo(() => {
    console.log("AutoSuggestFromDescription:", autoSuggestFromDescription); // Debug log
    console.log("Chart of accounts length:", chartOfAccounts.length); // Debug log
    
    if (chartOfAccounts.length === 0) {
      return [];
    }

    let baseAccounts = chartOfAccounts;

    // Specific filtering for Statement of Affairs module
    if (assetCategory) {
        if (assetCategory.toLowerCase().includes('fixed')) {
            baseAccounts = chartOfAccounts.filter(acc => 
                acc.account_group && acc.account_group.toLowerCase().includes('fixed charge realisation')
            );
        } else if (assetCategory.toLowerCase().includes('floating')) {
            baseAccounts = chartOfAccounts.filter(acc => 
                acc.account_group && acc.account_group.toLowerCase().includes('floating charge realisation')
            );
        } else if (assetCategory.toLowerCase().includes('uncharged')) {
            baseAccounts = chartOfAccounts.filter(acc => 
                acc.account_group && acc.account_group.toLowerCase().includes('uncharged asset realisation')
            );
        }
    }
    
    // If no specific accounts were found, use all of them
    if (baseAccounts.length === 0) {
        baseAccounts = chartOfAccounts;
    }

    if (autoSuggestFromDescription && autoSuggestFromDescription.trim()) {
      const searchTerms = autoSuggestFromDescription.toLowerCase().split(/\s+/).filter(Boolean);
      console.log("Search terms:", searchTerms); // Debug log
      
      const scoredAccounts = baseAccounts.map(account => {
        let score = 0;
        const accountNameLower = (account.account_name || '').toLowerCase();
        const accountCodeLower = (account.account_code || '').toLowerCase();
        
        searchTerms.forEach(term => {
          // Exact matches in account name
          if (accountNameLower.includes(term)) {
            score += 3;
          }
          // Exact matches in account code
          if (accountCodeLower.includes(term)) {
            score += 2;
          }
          // Partial matches (first 3 characters)
          if (term.length >= 3 && accountNameLower.includes(term.substring(0, 3))) {
            score += 1;
          }
        });
        
        return { ...account, score };
      });

      const filteredAccounts = scoredAccounts
        .filter(account => account.score > 0)
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }
          return (a.account_name || '').localeCompare(b.account_name || '');
        });

      console.log("Filtered accounts:", filteredAccounts); // Debug log
      return filteredAccounts.slice(0, 10); // Limit to top 10 results
    }

    // If no search description, return all base accounts (limited)
    return baseAccounts
      .sort((a,b) => (a.account_name || '').localeCompare(b.account_name || ''))
      .slice(0, 20);
  }, [chartOfAccounts, assetCategory, autoSuggestFromDescription]);

  const handleSelectAccount = (account) => {
    console.log("Account selected:", account); // Debug log
    if (onSelect) {
      onSelect(account);
    }
    if (onClose) {
      onClose();
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border border-slate-200 bg-white">
        <CardContent className="p-4 text-center">
          <p className="text-sm text-slate-500">Loading accounts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border border-slate-200 bg-white">
      <CardContent className="p-0">
        <div className="bg-blue-50 border-b border-blue-200 p-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">
            {chartOfAccounts.length === 0 
              ? "No accounts available" 
              : `Suggested Accounts (${suggestedAccounts.length})`
            }
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {chartOfAccounts.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              <p>Account suggestions unavailable</p>
              <p className="text-xs mt-1">No chart of accounts loaded</p>
            </div>
          ) : suggestedAccounts.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              <p>No matching accounts found</p>
              <p className="text-xs mt-1">Try a different description</p>
            </div>
          ) : (
            suggestedAccounts.map((account) => (
              <div
                key={account.id}
                className="p-3 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                onClick={() => handleSelectAccount(account)}
              >
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-medium text-slate-800 ${account.score > 0 ? 'font-bold text-blue-700' : ''}`}>
                    {account.account_name}
                  </span>
                  <span className="font-mono text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-md">
                    {account.account_code}
                  </span>
                </div>
                {account.account_group && (
                  <div className="text-xs text-slate-500 mt-1">{account.account_group}</div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}