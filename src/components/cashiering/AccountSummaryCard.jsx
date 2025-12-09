import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function AccountSummaryCard({ title, balance, type }) {
  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }
    return Math.abs(amount).toLocaleString('en-GB', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  const getBalanceColor = () => {
    if (type === 'vat') {
      // VAT Control Account: positive = refund due, negative = payment due
      if (balance > 0) return 'text-blue-600'; // Refund due (positive for business)
      if (balance < 0) return 'text-orange-600'; // Payment due (negative for business)
      return 'text-slate-600';
    } else {
      // Case Account: positive = funds available, negative = overdrawn
      if (balance > 0) return 'text-green-600';
      if (balance < 0) return 'text-red-600';
      return 'text-slate-600';
    }
  };

  const getIcon = () => {
    if (balance > 0) return <TrendingUp className="w-5 h-5" />;
    if (balance < 0) return <TrendingDown className="w-5 h-5" />;
    return null;
  };

  const getBalanceLabel = () => {
    if (type === 'vat') {
      if (balance > 0) return 'VAT Refund Due';
      if (balance < 0) return 'VAT Payment Due';
      return 'VAT Neutral';
    } else {
      if (balance > 0) return 'Funds Available';
      if (balance < 0) return 'Overdrawn';
      return 'Zero Balance';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-2xl font-bold ${getBalanceColor()}`}>
              £{formatCurrency(balance)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {getBalanceLabel()}
            </p>
          </div>
          <div className={getBalanceColor()}>
            {getIcon()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}