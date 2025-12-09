import React, { useState, useEffect } from 'react';
import DeficiencyAccount from '../investigations/DeficiencyAccount';
import BankStatementAnalysis from '../investigations/BankStatementAnalysis';
import SIP2FileNote from '../investigations/SIP2FileNote';

export default function InvestigationsTab({ caseId, onCaseUpdate }) {
  const [activeInvestigationSection, setActiveInvestigationSection] = useState('deficiency-account');

  useEffect(() => {
    setActiveInvestigationSection('deficiency-account');
  }, [caseId]);

  return (
    <div className="flex h-full">
      <div className="w-64 flex-shrink-0 border-r bg-slate-50 p-4">
        <h3 className="font-semibold text-slate-800 mb-4">Investigations</h3>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveInvestigationSection('deficiency-account')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeInvestigationSection === 'deficiency-account'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Deficiency Account
          </button>
          <button
            onClick={() => setActiveInvestigationSection('bank-statement-analysis')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeInvestigationSection === 'bank-statement-analysis'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Bank Statement Analysis
          </button>
          <button
            onClick={() => setActiveInvestigationSection('sip2-file-note')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeInvestigationSection === 'sip2-file-note'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            SIP2 File Note
          </button>
        </nav>
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        {activeInvestigationSection === 'deficiency-account' && (
          <DeficiencyAccount caseId={caseId} onUpdate={onCaseUpdate} />
        )}
        {activeInvestigationSection === 'bank-statement-analysis' && (
          <BankStatementAnalysis caseId={caseId} onUpdate={onCaseUpdate} />
        )}
        {activeInvestigationSection === 'sip2-file-note' && (
          <SIP2FileNote caseId={caseId} onUpdate={onCaseUpdate} />
        )}
      </div>
    </div>
  );
}