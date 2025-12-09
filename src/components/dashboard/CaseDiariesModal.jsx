import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const formatDate = (dateString) => {
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (e) {
    return 'Invalid date';
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'completed_on_time':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'completed_late':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'overdue':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'pending':
    default:
      return 'bg-blue-100 text-blue-800 border-blue-200';
  }
};

export default function CaseDiariesModal({ isOpen, onClose, userCases }) {
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [cases, setCases] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDiaries = async () => {
      if (!isOpen || !userCases || userCases.length === 0) {
        setDiaryEntries([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const caseIds = userCases.map(c => c.id);
        
        // Load all diary entries for user's cases
        const allDiaries = await base44.entities.CaseDiaryEntry.list('-deadline_date', 500);
        
        // Filter to only entries for user's cases
        const userDiaries = allDiaries.filter(entry => 
          caseIds.includes(entry.case_id)
        );

        setDiaryEntries(userDiaries);

        // Create a map of case IDs to case data for quick lookup
        const casesMap = {};
        userCases.forEach(c => {
          casesMap[c.id] = c;
        });
        setCases(casesMap);

      } catch (error) {
        console.error('Error loading diary entries:', error);
        setDiaryEntries([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadDiaries();
  }, [isOpen, userCases]);

  // Calculate dates for filtering
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const threeMonthsFromNow = new Date();
  threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
  threeMonthsFromNow.setHours(23, 59, 59, 999);

  // Filter for upcoming diaries (next 3 months, not completed)
  const upcomingDiaries = diaryEntries.filter(entry => {
    if (entry.status === 'completed_on_time' || entry.status === 'completed_late') {
      return false;
    }
    if (!entry.deadline_date) return false;
    
    const deadlineDate = new Date(entry.deadline_date);
    return deadlineDate >= today && deadlineDate <= threeMonthsFromNow;
  }).sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date));

  // Filter for overdue diaries
  const overdueDiaries = diaryEntries.filter(entry => {
    if (!entry.deadline_date) return false;
    if (entry.status === 'completed_on_time' || entry.status === 'completed_late') {
      return false;
    }
    
    const deadlineDate = new Date(entry.deadline_date);
    return deadlineDate < today;
  }).sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date));

  const DiaryCard = ({ entry }) => {
    const caseData = cases[entry.case_id];
    const isOverdue = entry.status === 'overdue' || 
      (entry.deadline_date && new Date(entry.deadline_date) < today && 
       entry.status !== 'completed_on_time' && entry.status !== 'completed_late');

    return (
      <Card className={`mb-3 ${isOverdue ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {caseData?.case_reference || 'Unknown Case'}
                </Badge>
                <Badge className={getStatusColor(entry.status)}>
                  {entry.status === 'pending' ? 'Pending' : 
                   entry.status === 'completed_on_time' ? 'Completed' :
                   entry.status === 'completed_late' ? 'Late' : 'Overdue'}
                </Badge>
                {entry.category && (
                  <Badge variant="outline" className="text-xs">
                    {entry.category}
                  </Badge>
                )}
              </div>
              
              <h4 className="font-semibold text-slate-900 mb-1">{entry.title}</h4>
              
              {caseData && (
                <p className="text-sm text-slate-600 mb-2">{caseData.company_name}</p>
              )}
              
              {entry.description && (
                <p className="text-sm text-slate-600 mb-2">{entry.description}</p>
              )}
              
              {entry.notes && (
                <p className="text-xs text-slate-500 italic">Note: {entry.notes}</p>
              )}
            </div>
            
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar className="w-4 h-4" />
                <span className={isOverdue ? 'text-red-700 font-semibold' : ''}>
                  {formatDate(entry.deadline_date)}
                </span>
              </div>
              {entry.completed_date && (
                <div className="flex items-center gap-2 text-xs text-green-700 mt-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Done: {formatDate(entry.completed_date)}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600" />
            Case Diaries
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Loading diary entries...</p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Due Next 3 Months
                {upcomingDiaries.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {upcomingDiaries.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="overdue" className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Overdue
                {overdueDiaries.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {overdueDiaries.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="flex-1 overflow-y-auto mt-4">
              {upcomingDiaries.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">No Upcoming Diaries</h3>
                  <p className="text-slate-500">
                    You have no diary entries due in the next 3 months.
                  </p>
                </div>
              ) : (
                <div>
                  {upcomingDiaries.map(entry => (
                    <DiaryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="overdue" className="flex-1 overflow-y-auto mt-4">
              {overdueDiaries.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
                  <h3 className="font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                  <p className="text-slate-500">
                    You have no overdue diary entries.
                  </p>
                </div>
              ) : (
                <div>
                  {overdueDiaries.map(entry => (
                    <DiaryCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}