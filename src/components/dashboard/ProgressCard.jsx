import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

export default function ProgressCard({ 
  title, 
  cases, 
  onCaseClick,
  onTitleClick,
  fundsHeld = 0,
  fundsDistributed = 0
}) {
  const calculateProgress = (caseData) => {
    const completedOrN_A_Tasks = (caseData.tasks_progress || []).filter(
      t => t.status === 'completed' || (t.status === 'not_applicable' && t.na_reason?.trim())
    ).length;

    const getTotalTasksForCase = (type) => {
      if (type === 'CVL') {
        return 81;
      } else if (type === 'MVL') {
        return 74;
      } else if (type === 'Administration') {
        return 74;
      }
      return 74;
    };

    const totalTasksForProgress = getTotalTasksForCase(caseData.case_type);
    const progressRatio = totalTasksForProgress > 0 ? completedOrN_A_Tasks / totalTasksForProgress : 0;
    const progress = Math.round(progressRatio * 100);
    
    return Math.min(progress, 100);
  };

  // Separate pipeline and active cases
  const pipelineCases = cases.filter(c => !c.appointment_date);
  const activeCases = cases.filter(c => c.appointment_date);

  // Calculate average progress only for active cases
  const averageProgress = activeCases.length > 0
    ? Math.round(activeCases.reduce((acc, case_) => {
        const progress = calculateProgress(case_);
        return acc + progress;
      }, 0) / activeCases.length)
    : 0;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Create SVG pie chart
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (averageProgress / 100) * circumference;

  return (
    <Card className="overflow-hidden shadow-sm border border-slate-200/80 bg-white rounded-2xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-center">
          <button
            onClick={() => onTitleClick && onTitleClick(title)}
            className="font-display text-blue-600 text-xl font-bold hover:text-blue-700 transition-colors flex items-center gap-2 group"
          >
            {title}
            <ExternalLink className="w-4 h-4 transition-opacity" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {cases.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="font-medium">No cases of this type yet</p>
            <p className="text-sm">Create a new case to get started</p>
          </div>
        ) : (
          <>
            {/* Top Row: Pipeline, Active Cases, and Pie Chart */}
            <div className="grid grid-cols-3 gap-4">
              {/* Pipeline Cases */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center border-2 border-red-200">
                  <span className="text-2xl font-bold text-red-600">{pipelineCases.length}</span>
                </div>
                <span className="text-xs text-slate-500 mt-1">Pipeline</span>
              </div>

              {/* Active Cases (middle position) */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center border-2 border-blue-200">
                  <span className="text-2xl font-bold text-blue-700">{activeCases.length}</span>
                </div>
                <span className="text-xs text-slate-500 mt-1">Active</span>
              </div>

              {/* Average Completion Pie Chart */}
              <div className="flex flex-col items-center">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 80 80">
                    {/* Background circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="rgb(226, 232, 240)"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    {/* Progress circle */}
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke={averageProgress < 33 ? "rgb(239, 68, 68)" : averageProgress < 66 ? "rgb(245, 158, 11)" : "rgb(34, 197, 94)"}
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                  {/* Percentage in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-700">{averageProgress}%</span>
                  </div>
                </div>
                <span className="text-xs text-slate-500 mt-1">Avg Progress</span>
              </div>
            </div>

            {/* Bottom Row: Financial Information */}
            <div className="grid grid-cols-2 gap-4">
              {/* Funds Held */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-sm font-medium text-emerald-700">Funds Held</span>
                </div>
                <div className="text-xl font-bold text-emerald-800">
                  {formatCurrency(fundsHeld)}
                </div>
              </div>

              {/* Funds Distributed */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-sm font-medium text-blue-700">Distributed</span>
                </div>
                <div className="text-xl font-bold text-blue-800">
                  {formatCurrency(fundsDistributed)}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}