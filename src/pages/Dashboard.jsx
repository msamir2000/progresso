import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Briefcase,
  Activity,
  BadgeCheck,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

import ProgressCard from "../components/dashboard/ProgressCard";
import CaseDetailModal from "../components/dashboard/CaseDetailModal";
import CaseTypeDetailModal from "../components/dashboard/CaseTypeDetailModal";

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-3xl font-display text-slate-900 mt-1">{value}</p>
      </div>
      <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [selectedCaseType, setSelectedCaseType] = useState(null);
  const [showCaseTypeModal, setShowCaseTypeModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [retryCount, setRetryCount] = useState(0);
  const isMountedRef = useRef(true);

  const loadData = useCallback(async (attempt = 0) => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    let willRetry = false;
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      // PRIORITY 1: Load user first
      const userData = await Promise.race([
        base44.auth.me().catch(() => null),
        timeoutPromise
      ]);
      
      if (isMountedRef.current) {
        setCurrentUser(userData);
      }

      // Delay 400ms before next request
      await new Promise(resolve => setTimeout(resolve, 400));

      // PRIORITY 2: Load user's assigned cases first (most important for immediate display)
      let userCases = [];
      if (userData && userData.email) {
        userCases = await base44.entities.Case.filter(
          { assigned_user: userData.email }, 
          '-updated_date', 
          100
        );
        
        if (isMountedRef.current) {
          setCases(userCases);
        }
      }

      // Delay 400ms before next request
      await new Promise(resolve => setTimeout(resolve, 400));

      // PRIORITY 3: Load users (needed for dropdowns)
      const usersData = await base44.entities.User.list('-created_date', 1000).catch(() => []);
      
      if (isMountedRef.current) {
        setAllUsers(usersData || []);
      }

      // Delay 400ms before final request
      await new Promise(resolve => setTimeout(resolve, 400));

      // PRIORITY 4: Load remaining cases (less urgent)
      const allCases = await base44.entities.Case.list('-updated_date', 200);
      
      if (isMountedRef.current) {
        const userCaseIds = new Set(userCases.map(c => c.id));
        const otherCases = allCases.filter(c => !userCaseIds.has(c.id));
        setCases([...userCases, ...otherCases]);
        setRetryCount(0);
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Error loading data:", error);
        const errorMessage = error.message || "Failed to load data";
        setError(errorMessage);
        setRetryCount(attempt);

        if (attempt < 3) {
          willRetry = true;
          const delay = Math.min(2000 * Math.pow(2, attempt), 8000);
          setTimeout(() => {
            if (isMountedRef.current) {
              loadData(attempt + 1);
            }
          }, delay);
        }
      }
    } finally {
      if (isMountedRef.current && !willRetry) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadData]);

  useEffect(() => {
    if (selectedCase) {
      const updatedSelectedCase = cases.find(c => c.id === selectedCase.id);
      if (updatedSelectedCase && JSON.stringify(updatedSelectedCase) !== JSON.stringify(selectedCase)) {
        setSelectedCase(updatedSelectedCase);
      }
    }
  }, [cases, selectedCase]);

  const groupedCases = useMemo(() => {
    const grouped = {
      Administration: [],
      CVL: [],
      MVL: [],
      CWU: [],
      Moratoriums: [],
      Receiverships: [],
      CVA: [],
      IVA: [],
      BKR: [],
      Advisory: []
    };

    cases.forEach(case_ => {
      if (grouped[case_.case_type]) {
        grouped[case_.case_type].push(case_);
      }
    });

    return grouped;
  }, [cases]);

  const fundsByCaseType = useMemo(() => {
    const fundsMap = {
      Administration: { held: 0, distributed: 0 },
      CVL: { held: 0, distributed: 0 },
      MVL: { held: 0, distributed: 0 },
      CWU: { held: 0, distributed: 0 },
      Moratoriums: { held: 0, distributed: 0 },
      Receiverships: { held: 0, distributed: 0 },
      CVA: { held: 0, distributed: 0 },
      IVA: { held: 0, distributed: 0 },
      BKR: { held: 0, distributed: 0 },
      Advisory: { held: 0, distributed: 0 }
    };

    cases.forEach(case_ => {
      const caseType = case_.case_type;
      if (!fundsMap[caseType]) return;

      fundsMap[caseType].held += parseFloat(case_.total_funds_held) || 0;
      fundsMap[caseType].distributed += parseFloat(case_.total_funds_distributed) || 0;
    });

    return fundsMap;
  }, [cases]);

  const calculateProgress = useCallback((caseData) => {
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
  }, []);

  const stats = useMemo(() => {
    const totalCases = cases.length;
    const activeCases = cases.filter(c => c.status === 'active' && c.appointment_date && c.appointment_date !== '').length;
    const completedCases = cases.filter(c => c.status === 'completed').length;
    const averageProgress = cases.length > 0
      ? Math.round(cases.reduce((acc, case_) => {
          const progress = calculateProgress(case_);
          return acc + progress;
        }, 0) / cases.length)
      : 0;

    const pipelineCases = cases.filter(c => !c.appointment_date || c.appointment_date === '').length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const closedThisMonth = cases.filter(c => {
      if (!c.closure_date) return false;
      const closureDate = new Date(c.closure_date);
      return closureDate >= startOfMonth && closureDate <= endOfMonth;
    }).length;

    return { totalCases, activeCases, completedCases, averageProgress, pipelineCases, closedThisMonth };
  }, [cases, calculateProgress]);

  const handleCaseClick = (case_) => {
    setSelectedCase(case_);
  };

  const handleCaseTypeClick = (caseType) => {
    setSelectedCaseType(caseType);
    setShowCaseTypeModal(true);
  };

  const handleCloseCaseTypeModal = () => {
    setShowCaseTypeModal(false);
    setSelectedCaseType(null);
  };

  const handleCaseUpdate = async () => {
    await loadData();
    // Refresh selected case with fresh data
    if (selectedCase) {
      const refreshedCases = await base44.entities.Case.filter({ id: selectedCase.id });
      if (refreshedCases && refreshedCases.length > 0) {
        setSelectedCase(refreshedCases[0]);
      }
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    loadData();
  };

  if (isLoading && cases.length === 0) {
    return (
      <div className="min-h-screen p-6 md:p-8 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading dashboard...</p>
          {retryCount > 0 && (
            <p className="text-slate-500 text-sm mt-2">
              Retry attempt {retryCount} of 3...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (error && cases.length === 0) {
    return (
      <div className="min-h-screen p-6 md:p-8 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Error</h3>
          <p className="text-slate-600 mb-2">Unable to load dashboard data.</p>
          <p className="text-sm text-slate-500 mb-6">
            {error && error.includes && error.includes('timeout') 
              ? 'The request is taking longer than expected. Please check your internet connection and try again.'
              : 'There may be a temporary issue with the service. Please try again in a moment.'
            }
          </p>
          <div className="space-y-3">
            <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700 w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <p className="text-xs text-slate-400">
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-none mx-auto px-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          <StatCard title="Total Cases" value={stats.totalCases} icon={Briefcase} color="bg-blue-500" delay={0.1} />
          <StatCard title="Active Cases" value={stats.activeCases} icon={Activity} color="bg-blue-500" delay={0.2} />
          <StatCard title="Completed" value={stats.closedThisMonth} icon={BadgeCheck} color="bg-emerald-500" delay={0.3} />
          <StatCard title="Avg Progress" value={`${stats.averageProgress}%`} icon={TrendingUp} color="bg-violet-500" delay={0.4} />
          <StatCard title="Pipeline" value={stats.pipelineCases} icon={AlertCircle} color="bg-amber-500" delay={0.5} />
          <StatCard title="Closed This Month" value={stats.closedThisMonth} icon={BadgeCheck} color="bg-slate-500" delay={0.6} />
        </div>

        {/* Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {['Administration', 'CVL', 'MVL', 'CWU', 'Receiverships', 'Moratoriums', 'CVA', 'IVA', 'BKR', 'Advisory'].map((type, index) => (
            <motion.div
              key={type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <ProgressCard
                title={type}
                cases={groupedCases[type] || []}
                onCaseClick={handleCaseClick}
                onTitleClick={handleCaseTypeClick}
                fundsHeld={fundsByCaseType[type]?.held || 0}
                fundsDistributed={fundsByCaseType[type]?.distributed || 0}
              />
            </motion.div>
          ))}
        </div>

        {/* Case Detail Modal */}
        <CaseDetailModal
          case_={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdate={handleCaseUpdate}
          users={allUsers}
        />

        {/* Case Type Detail Modal */}
        <CaseTypeDetailModal
          isOpen={showCaseTypeModal}
          onClose={handleCloseCaseTypeModal}
          caseType={selectedCaseType}
          cases={cases}
          onCaseClick={handleCaseClick}
        />
      </div>
    </div>
  );
}