import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Save,
  Check,
  RefreshCw,
  Printer,
  Info,
  Lock
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatDate = (dateString) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return '—';
  }
};

export default function CaseDiaryManager({ caseId, caseData, onUpdate, filterType = 'post-appointment' }) {
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const hasLoadedRef = useRef(false);

  const getReferencePointValue = useCallback((referencePoint) => {
    if (!caseData || !referencePoint) {
      return null;
    }

    const normalized = referencePoint.trim().toLowerCase();

    const referenceMap = {
      'date of appointment': 'appointment_date',
      'board meeting': 'board_meeting_date',
      'board meeting date': 'board_meeting_date',
      'board resolution passed': 'board_resolution_passed_date',
      'date board resolution passed': 'board_resolution_passed_date',
      'members meeting': 'members_meeting_date',
      'members meeting date': 'members_meeting_date',
      'date of members\' resolutions': 'date_of_members_resolutions',
      'date of members resolutions': 'date_of_members_resolutions',
      'date of members resolution': 'date_of_members_resolutions',
      'members resolution': 'date_of_members_resolutions',
      'members resolution date': 'date_of_members_resolutions',
      'date members resolution passed': 'date_of_members_resolutions',
      'creditors meeting': 'creditors_decisions_date',
      'creditors decisions date': 'creditors_decisions_date',
      'creditors decision date': 'creditors_decision_passed_date',
      'creditors decision passed date': 'creditors_decision_passed_date',
      'subsequent creditors decision date': 'subsequent_decision_passed_date'
    };

    const fieldName = referenceMap[normalized];
    if (fieldName && caseData[fieldName]) {
      return caseData[fieldName];
    }

    if (normalized.includes('appointment')) {
      return caseData.appointment_date || null;
    }
    if (normalized.includes('board') && normalized.includes('resolution')) {
      return caseData.board_resolution_passed_date || caseData.board_meeting_date || null;
    }
    if (normalized.includes('board') && normalized.includes('meeting')) {
      return caseData.board_meeting_date || caseData.board_resolution_passed_date || null;
    }
    if (normalized.includes('members') && (normalized.includes('resolution') || normalized.includes('winding up'))) {
      return caseData.date_of_members_resolutions || caseData.members_resolution_date || caseData.members_meeting_date || null;
    }
    if (normalized.includes('members') && normalized.includes('meeting')) {
      return caseData.members_meeting_date || caseData.date_of_members_resolutions || null;
    }
    if (normalized.includes('creditor')) {
      return caseData.creditors_decisions_date || caseData.creditors_decision_passed_date || null;
    }

    return null;
  }, [caseData]);

  const addWorkingDays = useCallback((startDate, days) => {
    const date = new Date(startDate);
    let remainingDays = Math.abs(days);
    const direction = days < 0 ? -1 : 1;

    while (remainingDays > 0) {
      date.setDate(date.getDate() + direction);

      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remainingDays--;
      }
    }

    return date;
  }, []);

  const calculateDeadlineDate = useCallback((entry) => {
    if (!entry.reference_point || !entry.time_offset) {
      return null;
    }

    const referenceDateValue = getReferencePointValue(entry.reference_point);

    if (!referenceDateValue) {
      return null;
    }

    try {
      const baseDate = new Date(referenceDateValue);
      if (isNaN(baseDate.getTime())) {
        return null;
      }

      const offsetMatch = entry.time_offset.match(/([+-]?)\s*(\d+)\s*(Day|Working Day|Business Day|Month|Year)/i);
      if (!offsetMatch) {
        return baseDate.toISOString().split('T')[0];
      }

      const [, sign, amount, unit] = offsetMatch;
      const value = parseInt(amount, 10) * (sign === '-' ? -1 : 1);

      const resultDate = new Date(baseDate);

      if (unit.toLowerCase().includes('month')) {
        resultDate.setMonth(resultDate.getMonth() + value);
      } else if (unit.toLowerCase().includes('year')) {
        resultDate.setFullYear(resultDate.getFullYear() + value);
      } else if (unit.toLowerCase().includes('working day') || unit.toLowerCase().includes('business day')) {
        const workingDate = addWorkingDays(baseDate, value);
        return workingDate.toISOString().split('T')[0];
      } else if (unit.toLowerCase().includes('day')) {
        resultDate.setDate(resultDate.getDate() + value);
      }

      return resultDate.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error calculating deadline date:', error);
      return null;
    }
  }, [getReferencePointValue, addWorkingDays]);

  const calculateStatus = useCallback((deadlineDate, completedDate, referencePoint) => {
    const hasReference = getReferencePointValue(referencePoint);

    if (!hasReference || !deadlineDate) {
      return 'awaiting_reference';
    }

    const deadline = new Date(deadlineDate);
    deadline.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (completedDate) {
      const completed = new Date(completedDate);
      completed.setHours(0, 0, 0, 0);
      return completed <= deadline ? 'completed_on_time' : 'completed_late';
    }

    return today > deadline ? 'overdue' : 'pending';
  }, [getReferencePointValue]);

  const generateDiaryEntriesFromTemplate = useCallback(async () => {
    if (!caseData?.case_type) {
      console.error('No case type found for case data:', caseData);
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const templates = await base44.entities.DiaryTemplate.list();
      const defaultTemplate = templates.find(t =>
        t.case_type === caseData.case_type && t.is_default
      );

      if (!defaultTemplate) {
        console.warn(`No default diary template found for case type: ${caseData.case_type}. Auto-generation skipped.`);
        return;
      }

      const entriesToCreate = defaultTemplate.diary_entries.map(entry => ({
        case_id: caseId,
        entry_id: entry.id,
        category: entry.category,
        title: entry.title,
        description: entry.description || '',
        reference_point: entry.reference_point,
        time_offset: entry.time,
        deadline_date: null,
        status: 'pending',
        notes: '',
        order: entry.order
      }));

      if (entriesToCreate.length > 0) {
        await base44.entities.CaseDiaryEntry.bulkCreate(entriesToCreate);
        console.log(`Generated ${entriesToCreate.length} diary entries from template for case_id: ${caseId}`);
      }
    } catch (error) {
      console.error('Error generating diary entries from template:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [caseId, caseData?.case_type]);

  // FIXED: Load entries only once on mount
  useEffect(() => {
    const loadEntries = async () => {
      if (!caseId || hasLoadedRef.current) return;

      hasLoadedRef.current = true;
      setIsLoading(true);
      setError(null);

      try {
        // Check if diary is already locked
        const isDiaryLocked = caseData?.diary_locked || false;
        setIsLocked(isDiaryLocked);

        // Single API call to get all entries
        let allEntries = await base44.entities.CaseDiaryEntry.filter({ case_id: caseId });

        // Only generate from template if NOT locked and no entries exist
        if (!isDiaryLocked && allEntries.length === 0) {
          console.log('No diary entries found, attempting to generate from template...');
          await generateDiaryEntriesFromTemplate();
          allEntries = await base44.entities.CaseDiaryEntry.filter({ case_id: caseId });
          
          // Lock the diary after initial generation
          if (allEntries.length > 0) {
            await base44.entities.Case.update(caseId, { diary_locked: true });
            setIsLocked(true);
          }
        }

        // Remove duplicates
        const uniqueEntriesMap = new Map();
        allEntries.forEach(entry => {
          const key = entry.entry_id;
          const existing = uniqueEntriesMap.get(key);
          if (!existing || new Date(entry.created_date) > new Date(existing.created_date)) {
            uniqueEntriesMap.set(key, entry);
          }
        });
        allEntries = Array.from(uniqueEntriesMap.values());

        // Filter based on type
        const filtered = allEntries.filter(entry => {
          if (filterType === 'pre-appointment') {
            return entry.time_offset && entry.time_offset.includes('-');
          } else {
            const hasNegativeOffset = entry.time_offset && entry.time_offset.includes('-');
            if (hasNegativeOffset) return false;

            const isPreAppCategoryButNotCompleted =
              entry.category?.toLowerCase() === 'pre appointment' &&
              !entry.title?.toLowerCase().includes('pre app tasks all completed');

            if (isPreAppCategoryButNotCompleted) return false;
            return true;
          }
        });

        // Process entries
        const processedEntries = filtered.map(entry => {
          if (filterType === 'post-appointment' && entry.title?.toLowerCase().includes('pre app tasks all completed')) {
            return { ...entry, category: 'Post Appointment' };
          }
          return entry;
        });

        // Calculate deadlines and status
        const entriesWithCalculatedData = processedEntries.map(entry => {
          const calculatedDeadline = calculateDeadlineDate(entry);
          const finalDeadline = entry.deadline_date || calculatedDeadline;
          const currentStatus = calculateStatus(finalDeadline, entry.completed_date, entry.reference_point);
          return {
            ...entry,
            deadline_date: finalDeadline,
            status: currentStatus
          };
        });

        // Sort
        const sorted = entriesWithCalculatedData.sort((a, b) => {
          if (filterType === 'post-appointment') {
            const aIsPreAppComplete = a.title?.toLowerCase().includes('pre app tasks all completed');
            const bIsPreAppComplete = b.title?.toLowerCase().includes('pre app tasks all completed');
            if (aIsPreAppComplete && !bIsPreAppComplete) return -1;
            if (!aIsPreAppComplete && bIsPreAppComplete) return 1;
          }

          const orderA = a.order !== undefined ? a.order : 999999;
          const orderB = b.order !== undefined ? b.order : 999999;
          if (orderA !== orderB) return orderA - orderB;

          const dateA = a.deadline_date ? new Date(a.deadline_date).getTime() : Infinity;
          const dateB = b.deadline_date ? new Date(b.deadline_date).getTime() : Infinity;
          return dateA - dateB;
        });

        setDiaryEntries(sorted);
      } catch (error) {
        console.error('Failed to load diary entries:', error);
        setError(error.message || 'Failed to load diary entries');
        setDiaryEntries([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadEntries();
  }, [caseId, filterType, generateDiaryEntriesFromTemplate, calculateDeadlineDate, calculateStatus]); // Added all necessary function dependencies for correctness.

  // Manual refresh function
  const handleRefresh = async () => {
    setIsLoading(true);

    try {
      // Re-fetch, filter, process, and sort existing entries. Do NOT generate from template here.
      const allEntries = await base44.entities.CaseDiaryEntry.filter({ case_id: caseId });

      const uniqueEntriesMap = new Map();
      allEntries.forEach(entry => {
        const key = entry.entry_id;
        const existing = uniqueEntriesMap.get(key);
        if (!existing || new Date(entry.created_date) > new Date(existing.created_date)) {
          uniqueEntriesMap.set(key, entry);
        }
      });

      const filtered = Array.from(uniqueEntriesMap.values()).filter(entry => {
        if (filterType === 'pre-appointment') {
          return entry.time_offset && entry.time_offset.includes('-');
        } else {
          const hasNegativeOffset = entry.time_offset && entry.time_offset.includes('-');
          if (hasNegativeOffset) return false;
          const isPreAppCategoryButNotCompleted =
            entry.category?.toLowerCase() === 'pre appointment' &&
            !entry.title?.toLowerCase().includes('pre app tasks all completed');
          if (isPreAppCategoryButNotCompleted) return false;
          return true;
        }
      });

      const processed = filtered.map(entry => {
        if (filterType === 'post-appointment' && entry.title?.toLowerCase().includes('pre app tasks all completed')) {
          return { ...entry, category: 'Post Appointment' };
        }
        return entry;
      });

      const entriesWithData = processed.map(entry => {
        const calculatedDeadline = calculateDeadlineDate(entry);
        const finalDeadline = entry.deadline_date || calculatedDeadline;
        const currentStatus = calculateStatus(finalDeadline, entry.completed_date, entry.reference_point);
        return { ...entry, deadline_date: finalDeadline, status: currentStatus };
      });

      const sorted = entriesWithData.sort((a, b) => {
        if (filterType === 'post-appointment') {
          const aIsPreAppComplete = a.title?.toLowerCase().includes('pre app tasks all completed');
          const bIsPreAppComplete = b.title?.toLowerCase().includes('pre app tasks all completed');
          if (aIsPreAppComplete && !bIsPreAppComplete) return -1;
          if (!aIsPreAppComplete && bIsPreAppComplete) return 1;
        }
        const orderA = a.order !== undefined ? a.order : 999999;
        const orderB = b.order !== undefined ? b.order : 999999;
        if (orderA !== orderB) return orderA - orderB;
        const dateA = a.deadline_date ? new Date(a.deadline_date).getTime() : Infinity;
        const dateB = b.deadline_date ? new Date(b.deadline_date).getTime() : Infinity;
        return dateA - dateB;
      });

      setDiaryEntries(sorted);
    } catch (error) {
      console.error('Failed to refresh diary entries:', error);
      setError(error.message || 'Failed to refresh diary entries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // This effect ensures that if selectedEntry is open and diaryEntries update (e.g., via refresh),
    // the dialog displays the most current data for the selected entry.
    if (selectedEntry) {
      const updatedSelectedEntry = diaryEntries.find(c => c.id === selectedEntry.id);
      if (updatedSelectedEntry && JSON.stringify(updatedSelectedEntry) !== JSON.stringify(selectedEntry)) {
        setSelectedEntry(updatedSelectedEntry);
      }
    }
  }, [diaryEntries, selectedEntry]);

  const groupedEntries = diaryEntries.reduce((acc, entry) => {
    const category = entry.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(entry);
    return acc;
  }, {});

  const handleViewEntry = (entry) => {
    const entryWithDate = {
      ...entry,
      completed_date: entry.completed_date ? (entry.completed_date.includes('T') ? entry.completed_date.split('T')[0] : entry.completed_date) : ''
    };
    setSelectedEntry(entryWithDate);
    setNotes(entry.notes || '');
    setIsDialogOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!selectedEntry) return;

    try {
      const completedDate = selectedEntry.completed_date || null;
      const updatedStatus = completedDate 
        ? calculateStatus(selectedEntry.deadline_date, completedDate, selectedEntry.reference_point)
        : 'pending';

      await base44.entities.CaseDiaryEntry.update(selectedEntry.id, {
        notes: notes,
        completed_date: completedDate,
        status: updatedStatus
      });

      setIsDialogOpen(false);
      await handleRefresh();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to save notes:', error);
      alert('Failed to save notes. Please try again.');
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedEntry) return;

    const todayISO = new Date().toISOString().split('T')[0];
    const updatedStatus = calculateStatus(selectedEntry.deadline_date, todayISO, selectedEntry.reference_point);

    try {
      await base44.entities.CaseDiaryEntry.update(selectedEntry.id, {
        status: updatedStatus,
        completed_date: todayISO,
        notes: notes
      });

      // Refresh data after marking complete
      await handleRefresh();
      // Find the newly updated entry to set as selected, or clear if it might have been filtered out
      const newlyUpdatedEntry = diaryEntries.find(entry => entry.id === selectedEntry.id);
      setSelectedEntry(newlyUpdatedEntry || null);

      setIsDialogOpen(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Failed to mark as complete:', error);
      alert('Failed to mark as complete. Please try again.');
    }
  };

  const handleExport = () => {
    const diaryContent = document.querySelector('.diary-print-container');
    if (!diaryContent) {
      alert('No diary content found to export');
      return;
    }

    const cssStyles = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.6;
        color: #1e293b;
        padding: 20px;
        max-width: 1400px;
        margin: 0 auto;
        background: white;
      }
      h1 {
        font-size: 24px;
        color: #1e40af;
        border-bottom: 2px solid #3b82f6;
        padding-bottom: 8px;
        margin-bottom: 20px;
        font-weight: bold;
      }
      h2 {
        font-size: 18px;
        color: #1e40af;
        margin-top: 20px;
        font-weight: 600;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
      }
      thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
      }
      th {
        background-color: #f0f0f0 !important;
        border: 1px solid #000 !important;
        padding: 8px !important;
        text-align: left !important;
        font-weight: bold !important;
        font-size: 10pt !important;
        color: #000 !important;
      }
      td {
        border: 1px solid #000 !important;
        padding: 8px !important;
        font-size: 9pt !important;
        color: #000 !important;
      }
      .diary-print-card {
        page-break-inside: avoid;
        margin-bottom: 15px !important;
        border: none !important;
      }
      .diary-card-title {
        font-size: 12pt !important;
        font-weight: bold !important;
        padding: 8px 0 !important;
        background-color: transparent !important;
        border-bottom: none !important;
        color: #000 !important;
        border: none !important;
      }
      .status-badge {
        border: 1px solid #000 !important;
        padding: 2px 8px !important;
        border-radius: 4px !important;
        font-size: 8pt !important;
        display: inline-block !important;
        color: #000 !important;
        background-color: #fff !important;
      }
      button {
        display: none !important;
      }
      .no-print {
        display: none !important;
      }
      .print-header {
        display: block !important;
      }
      @media print {
        body { padding: 10px; }
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    `;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${filterType === 'pre-appointment' ? 'Pre-Appointment' : 'Post-Appointment'} Diary - ${caseData?.company_name || '—'}</title>
  <style>${cssStyles}</style>
</head>
<body>
  ${diaryContent.innerHTML}
</body>
</html>`;

    const newTab = window.open('', '_blank');
    if (newTab) {
      newTab.document.write(htmlContent);
      newTab.document.close();
    } else {
      alert('Please allow popups to export the diary');
    }
  };

  const getStatusBadgeColor = (status, isEntryOverdue) => {
    if (status === 'completed_on_time') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'completed_late') return 'bg-amber-100 text-amber-800 border-amber-200';
    if (status === 'awaiting_reference') return 'bg-slate-100 text-slate-600 border-slate-200';
    if (isEntryOverdue) return 'bg-red-100 text-red-800 border-red-200';
    if (status === 'overdue') return 'bg-red-100 text-red-800 border-red-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (error && !isLoading) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Diary</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <style>{`
        @media screen {
          .print-header {
            display: none;
          }
        }

        @media print {
          body * {
            visibility: hidden;
            overflow: hidden;
          }

          .diary-print-container,
          .diary-print-container * {
            visibility: visible;
          }

          .diary-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
          }

          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          .print-header {
            display: block !important;
            visibility: visible !important;
          }

          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
          }

          th {
            background-color: #f0f0f0 !important;
            border: 1px solid #000 !important;
            padding: 8px !important;
            text-align: left !important;
            font-weight: bold !important;
            font-size: 10pt !important;
            color: #000 !important;
          }

          td {
            border: 1px solid #000 !important;
            padding: 8px !important;
            font-size: 9pt !important;
            color: #000 !important;
          }

          .diary-print-card {
            page-break-inside: avoid;
            margin-bottom: 15px !important;
            border: none !important;
          }

          .diary-card-title {
            font-size: 12pt !important;
            font-weight: bold !important;
            padding: 8px 0 !important;
            background-color: transparent !important;
            border-bottom: none !important;
            color: #000 !important;
            border: none !important;
          }

          .status-badge {
            border: 1px solid #000 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            font-size: 8pt !important;
            display: inline-block !important;
            color: #000 !important;
            background-color: #fff !important;
          }

          .bg-red-50 {
            background-color: #fee2e2 !important;
          }

          button {
            display: none !important;
          }

          .no-print {
            display: none !important;
          }

          .print-header {
            display: block !important;
          }

          * {
            color: #000 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }
      `}</style>

      <div className="diary-print-container">
        <div className="print-header" style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '2px solid #000' }}>
          <h1 style={{ fontSize: '18pt', fontWeight: 'bold', marginBottom: '8px' }}>
            {filterType === 'pre-appointment' ? 'Pre-Appointment' : 'Post-Appointment'} Diary
          </h1>
          <p style={{ fontSize: '10pt', marginBottom: '4px' }}>
            <strong>Case:</strong> {caseData?.company_name || '—'} ({caseData?.case_reference || '—'})
          </p>
          <p style={{ fontSize: '10pt', marginBottom: '4px' }}>
            <strong>Case Type:</strong> {caseData?.case_type || '—'}
          </p>
        </div>

        <Card className="border-slate-200 mb-4 no-print">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl font-bold text-slate-900">
                    {filterType === 'pre-appointment' ? 'Pre-Appointment' : 'Post-Appointment'} Diary
                  </CardTitle>
                  {isLocked && (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1.5 px-2 py-1">
                      <Lock className="w-3.5 h-3.5" />
                      Locked
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  Case diary entries for {caseData?.company_name || 'this case'}
                  {isLocked && <span className="text-slate-500"> • Diary structure is locked and cannot be regenerated</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExport}
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Export
                </Button>
                <Button
                  onClick={handleRefresh}
                  variant="outline"
                  size="sm"
                  disabled={isLoading || isGenerating}
                >
                  {isLoading || isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {(isLoading || isGenerating) ? (
          <div className="flex items-center justify-center py-12 no-print">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-600">
              {isGenerating ? 'Generating diary entries...' : 'Loading diary entries...'}
            </span>
          </div>
        ) : diaryEntries.length === 0 ? (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-md flex items-center gap-2 no-print">
            <AlertCircle className="h-4 w-4" />
            <span>No diary entries found for this case. This might happen if no default diary template is available for the case type, or if a template exists but has no entries.</span>
          </div>
        ) : (
          Object.entries(groupedEntries).map(([category, entries]) => (
            <Card key={category} className="border-slate-200 mb-4 diary-print-card">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base font-semibold text-slate-900 diary-card-title">{category}</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 border-b">
                        <TableHead className="text-slate-700 font-semibold text-xs">Title</TableHead>
                        <TableHead className="text-slate-700 font-semibold text-xs">Deadline Date</TableHead>
                        <TableHead className="text-slate-700 font-semibold text-xs">Completed Date</TableHead>
                        <TableHead className="text-slate-700 font-semibold text-xs">Status</TableHead>
                        <TableHead className="text-slate-700 font-semibold text-xs no-print">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((entry) => {
                        const isEntryOverdue = entry.status === 'overdue';
                        const isAwaitingReference = entry.status === 'awaiting_reference';
                        const statusText = entry.status === 'completed_on_time' ? 'Completed On Time' :
                                          entry.status === 'completed_late' ? 'Completed Late' :
                                          isAwaitingReference ? `Awaiting ${entry.reference_point}` :
                                          isEntryOverdue ? 'Overdue' : 'Pending';

                        return (
                          <TableRow key={entry.id} className={isEntryOverdue ? 'bg-red-50' : ''}>
                            <TableCell className="text-slate-900 text-sm leading-tight py-2">{entry.title}</TableCell>
                            <TableCell className="text-slate-800 font-medium text-xs py-2">
                              {entry.deadline_date ? (
                                <div className={isEntryOverdue ? 'text-red-700 font-semibold flex items-center gap-1.5' : 'text-slate-700 flex items-center gap-1.5'}>
                                  <Calendar className="w-3.5 h-3.5 text-slate-500 no-print" />
                                  {formatDate(entry.deadline_date)}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Info className="w-3.5 h-3.5 no-print" />
                                  <span className="text-xs italic">Awaiting {entry.reference_point}</span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-slate-600 text-xs py-2">
                              {entry.completed_date ? formatDate(entry.completed_date) : '—'}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge className={`${getStatusBadgeColor(entry.status, isEntryOverdue)} text-[10px] px-1.5 py-0 status-badge`}>
                                {statusText}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center py-2 no-print">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewEntry(entry)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-6 px-2 text-xs"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl no-print">
          <DialogHeader>
            <DialogTitle>{selectedEntry?.title}</DialogTitle>
            <DialogDescription>
              {selectedEntry?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Deadline Date</Label>
              <p className="text-sm text-slate-600 mt-1">
                {selectedEntry?.deadline_date
                  ? formatDate(selectedEntry.deadline_date)
                  : `Awaiting ${selectedEntry?.reference_point || 'reference date'}`}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <p className="text-sm text-slate-600 mt-1">
                <Badge className={`${getStatusBadgeColor(selectedEntry?.status, selectedEntry?.status === 'overdue')} status-badge`}>
                  {selectedEntry?.status === 'completed_on_time' ? 'Completed On Time' :
                   selectedEntry?.status === 'completed_late' ? 'Completed Late' :
                   selectedEntry?.status === 'awaiting_reference' ? `Awaiting ${selectedEntry?.reference_point}` :
                   selectedEntry?.status === 'overdue' ? 'Overdue' : 'Pending'}
                </Badge>
                {selectedEntry?.completed_date && selectedEntry?.status !== 'pending' && (
                  <span className="text-xs text-slate-500 ml-2">
                    {`on ${formatDate(selectedEntry.completed_date)}`}
                  </span>
                )}
              </p>
            </div>
            <div>
              <Label htmlFor="completed_date" className="text-sm font-medium">Completed Date</Label>
              <input
                id="completed_date"
                type="date"
                value={selectedEntry?.completed_date || ''}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setSelectedEntry({...selectedEntry, completed_date: newDate});
                }}
                className="mt-1 flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div>
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this diary entry..."
                className="mt-1 min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            {selectedEntry?.status === 'pending' && (
              <Button onClick={handleMarkComplete} className="bg-green-600 hover:bg-green-700">
                <Check className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            )}
            <Button onClick={handleSaveNotes} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}