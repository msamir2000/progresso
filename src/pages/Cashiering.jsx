
import React, { useState } from "react";
import CashieringSummary from "../components/cashiering/CashieringSummary";
import CaseDetailedCashiering from "../components/cashiering/CaseDetailedCashiering";
import ProtectedPage from "../components/utils/ProtectedPage";

export default function Cashiering() {
  const [selectedCase, setSelectedCase] = useState(null);

  const handleSelectCase = (case_) => {
    setSelectedCase(case_);
  };

  const handleGoBack = () => {
    setSelectedCase(null);
  };

  return (
    <ProtectedPage requiredPermission="cashiering_main" pageName="Cashiering">
      <div className="min-h-screen p-6 md:p-8">
        <div className="max-w-none mx-auto">
          {selectedCase ? (
            <CaseDetailedCashiering case_={selectedCase} onBack={handleGoBack} />
          ) : (
            <CashieringSummary onCaseSelect={handleSelectCase} />
          )}
        </div>
      </div>
    </ProtectedPage>
  );
}
