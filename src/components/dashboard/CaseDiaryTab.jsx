import React, { useState, useEffect } from 'react';
import CaseDiaryManager from '../case_diary/CaseDiaryManager';

export default function CaseDiaryTab({ caseId, caseData, onCaseUpdate }) {
  const [activeDiarySection, setActiveDiarySection] = useState('pre-appointment');

  useEffect(() => {
    setActiveDiarySection('pre-appointment');
  }, [caseId]);

  return (
    <div className="flex h-full">
      {/* Left Side Menu */}
      <div className="w-48 flex-shrink-0 border-r bg-slate-50 p-3">
        <h3 className="font-semibold text-slate-800 mb-4">Diary Sections</h3>
        <nav className="space-y-1">
          <button
            onClick={() => setActiveDiarySection('pre-appointment')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeDiarySection === 'pre-appointment'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Pre-appointment
          </button>
          <button
            onClick={() => setActiveDiarySection('post-appointment')}
            className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeDiarySection === 'post-appointment'
                ? 'bg-blue-100 text-blue-700'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Post-appointment
          </button>
        </nav>
      </div>

      {/* Right Side Content */}
      <div className="flex-1 overflow-y-auto">
        {activeDiarySection === 'pre-appointment' && caseId && (
          <CaseDiaryManager
            key={`pre-${caseId}-${caseData.appointment_date || 'no-date'}`}
            caseId={caseId}
            caseData={caseData}
            filterType="pre-appointment"
            onUpdate={onCaseUpdate}
          />
        )}
        {activeDiarySection === 'post-appointment' && caseId && (
          <CaseDiaryManager
            key={`post-${caseId}-${caseData.appointment_date || 'no-date'}`}
            caseId={caseId}
            caseData={caseData}
            filterType="post-appointment"
            onUpdate={onCaseUpdate}
          />
        )}
      </div>
    </div>
  );
}