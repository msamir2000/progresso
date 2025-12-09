import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Loader2,
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Edit2,
  Trash2,
  FileEdit, // Added FileEdit icon
  ChevronLeft // Added ChevronLeft icon
} from 'lucide-react';

const formatDuration = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

// Helper function to get day name from date string (avoids timezone issues)
const getDayNameFromDate = (dateString) => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const date = new Date(dateString + 'T12:00:00'); // Add time to avoid timezone shifts
  return dayNames[date.getDay()];
};

export default function TimesheetApproval({ activeTab: externalActiveTab, onTabChange }) {
  const [timesheets, setTimesheets] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectingWeek, setRejectingWeek] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedWeeks, setExpandedWeeks] = useState({});
  const [editingEntry, setEditingEntry] = useState(null);
  // Modified state to include user and week context for selected day entries
  const [selectedDayEntries, setSelectedDayEntries] = useState(null); // { date: string, dayName: string, entries: [], userEmail: string, weekKey: string }
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [draftWeekOffset, setDraftWeekOffset] = useState(0); // New state for draft week navigation
  const [pendingWeekOffset, setPendingWeekOffset] = useState(0);
  const [approvedWeekOffset, setApprovedWeekOffset] = useState(0);

  const activeTab = externalActiveTab || 'pending';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [timesheetData, userData, currentUserData] = await Promise.all([
        base44.entities.TimesheetEntry.list('-submitted_date'),
        base44.entities.User.list().catch((error) => {
          console.warn('User.list() failed:', error);
          return [];
        }),
        base44.auth.me().catch(() => null)
      ]);
      
      setTimesheets(timesheetData || []);
      setCurrentUser(currentUserData);
      
      let finalUsers = userData || [];
      console.log('User.list() returned:', finalUsers.length, 'users');
      
      if (finalUsers.length === 0 && timesheetData && timesheetData.length > 0) {
        console.log('Extracting users from timesheet entries as fallback');
        const userEmailsMap = new Map();
        
        timesheetData.forEach(entry => {
          if (entry.user_email && !userEmailsMap.has(entry.user_email)) {
            userEmailsMap.set(entry.user_email, {
              email: entry.user_email,
              full_name: entry.user_name || entry.user_email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              grade: 'Admin'
            });
          }
        });
        
        finalUsers = Array.from(userEmailsMap.values());
        console.log('After extracting from timesheets, total users:', finalUsers.length);
      }
      
      setUsers(finalUsers);
      
      if (finalUsers.length > 0 && !selectedUser) {
        setSelectedUser(finalUsers[0].email);
      }
    } catch (error) {
      console.error('Error loading timesheet data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getWeekRange = (dateString) => {
    const d = new Date(dateString);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    monday.setHours(0,0,0,0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23,59,59,999);

    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
      display: `${monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    };
  };

  const handleApproveWeek = async (userEmail, weekStartDate, entries) => {
    if (!entries || entries.length === 0) {
      alert('No entries to approve');
      return;
    }

    // Filter entries that can be approved
    const entriesToApprove = entries.filter(entry => entry.id && entry.status === 'submitted');
    
    if (entriesToApprove.length === 0) {
      alert('No submitted entries found to approve');
      return;
    }

    try {
      const currentUser = await base44.auth.me();
      
      for (const entry of entriesToApprove) {
        try {
          await base44.entities.TimesheetEntry.update(entry.id, {
            status: 'approved',
            approved_by: currentUser.email,
            approved_date: new Date().toISOString()
          });
        } catch (entryError) {
          console.error(`Failed to approve entry ${entry.id}:`, entryError);
          throw new Error(`Failed to approve timesheet entry: ${entryError.message || 'Update failed'}`);
        }
      }
      
      await loadData();
    } catch (error) {
      console.error('Error approving week:', error);
      alert(`Failed to approve week: ${error.message || 'Unknown error'}`);
    }
  };

  const handleRejectWeek = async () => {
    if (!rejectingWeek || !rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      const currentUser = await base44.auth.me();
      
      for (const entry of rejectingWeek.entries) {
        await base44.entities.TimesheetEntry.update(entry.id, {
          status: 'rejected',
          approved_by: currentUser.email,
          approved_date: new Date().toISOString(),
          rejection_reason: rejectionReason
        });
      }
      
      setRejectingWeek(null);
      setRejectionReason('');
      await loadData();
    } catch (error) {
      console.error('Error rejecting week:', error);
      alert('Failed to reject week');
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (!confirm('Are you sure you want to delete this timesheet entry? This action cannot be undone.')) {
      return;
    }

    try {
      await base44.entities.TimesheetEntry.delete(entryId);
      setEditingEntry(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting timesheet entry:', error);
      alert('Failed to delete timesheet entry');
    }
  };

  const getUserTimesheetsByMonth = () => {
    if (!selectedUser || !selectedMonth) return {};

    const userTimesheets = timesheets.filter(t =>
      t.user_email === selectedUser &&
      t.date.startsWith(selectedMonth)
    );

    const weeklyData = {};
    userTimesheets.forEach(entry => {
      const weekRange = getWeekRange(entry.date);
      const weekKey = weekRange.start;

      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          weekRange: weekRange.display,
          entries: [],
          totalHours: 0,
          billableHours: 0,
          nonBillableHours: 0,
          daysWorked: new Set()
        };
      }

      weeklyData[weekKey].entries.push(entry);
      const hours = entry.duration_seconds / 3600;
      weeklyData[weekKey].totalHours += hours;
      if (entry.billable) {
        weeklyData[weekKey].billableHours += hours;
      } else {
        weeklyData[weekKey].nonBillableHours += hours;
      }
      weeklyData[weekKey].daysWorked.add(entry.date);
    });

    return weeklyData;
  };

  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const value = date.toISOString().slice(0, 7);
      const label = date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  const toggleWeekExpansion = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  // Handle day click to show entries for that specific date, now including user and week context
  const handleDayClick = (dateString, dayEntries, dayName, userEmail, weekKey) => {
    // If the same day for the same user/week is clicked again, close the detail view
    if (selectedDayEntries && 
        selectedDayEntries.date === dateString && 
        selectedDayEntries.userEmail === userEmail &&
        selectedDayEntries.weekKey === weekKey) {
      setSelectedDayEntries(null);
    } else {
      setSelectedDayEntries({
        date: dateString,
        dayName: dayName,
        entries: dayEntries,
        userEmail: userEmail, // Store user email
        weekKey: weekKey // Store week key
      });
      setExpandedCategories(new Set()); // Reset expanded categories when changing day
    }
  };

  // Toggle category expansion
  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName);
      } else {
        newSet.add(categoryName);
      }
      return newSet;
    });
  };

  // Group entries by task category
  const groupEntriesByCategory = (entries) => {
    const grouped = {};
    entries.forEach(entry => {
      const category = entry.task_description || 'Uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(entry);
    });
    return grouped;
  };

  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted');
  const approvedTimesheets = timesheets.filter(t => t.status === 'approved');
  const rejectedTimesheets = timesheets.filter(t => t.status === 'rejected');
  const draftTimesheets = timesheets.filter(t => t.status === 'draft'); // Filter draft timesheets

  // Group draft timesheets by employee and week
  const groupedDraftByEmployee = draftTimesheets.reduce((acc, entry) => {
    if (!acc[entry.user_email]) {
      acc[entry.user_email] = {
        user_name: entry.user_name,
        user_email: entry.user_email,
        weeks: {}
      };
    }

    const weekRange = getWeekRange(entry.date);
    const weekKey = weekRange.start;

    if (!acc[entry.user_email].weeks[weekKey]) {
      acc[entry.user_email].weeks[weekKey] = {
        weekRange: weekRange.display,
        weekKey: weekKey,
        entries: [],
        dailyBreakdown: {
          Monday: { billable: 0, nonBillable: 0 },
          Tuesday: { billable: 0, nonBillable: 0 },
          Wednesday: { billable: 0, nonBillable: 0 },
          Thursday: { billable: 0, nonBillable: 0 },
          Friday: { billable: 0, nonBillable: 0 },
          Saturday: { billable: 0, nonBillable: 0 },
          Sunday: { billable: 0, nonBillable: 0 }
        }
      };
    }

    acc[entry.user_email].weeks[weekKey].entries.push(entry);

    const dayName = getDayNameFromDate(entry.date);
    const hours = entry.duration_seconds / 3600;
    
    if (acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName]) {
      if (entry.billable) {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].billable += hours;
      } else {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].nonBillable += hours;
      }
    }

    return acc;
  }, {});

  // Get the target week based on offset
  const getTargetWeekStart = () => {
    const today = new Date();
    const currentDay = today.getDay(); // Sunday - 0, Monday - 1
    // Adjust to make Monday the start of the week (if currentDay is 0 (Sunday), diff should be -6 to get previous Monday)
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff + (draftWeekOffset * 7));
    monday.setHours(0, 0, 0, 0); // Normalize to start of day
    return monday.toISOString().split('T')[0];
  };

  const targetWeekStart = getTargetWeekStart();
  const targetWeekRange = getWeekRange(targetWeekStart);

  // Get pending week start
  const getPendingWeekStart = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff + (pendingWeekOffset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  };

  const pendingWeekStart = getPendingWeekStart();
  const pendingWeekRange = getWeekRange(pendingWeekStart);

  // Get approved week start
  const getApprovedWeekStart = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff + (approvedWeekOffset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString().split('T')[0];
  };

  const approvedWeekStart = getApprovedWeekStart();
  const approvedWeekRange = getWeekRange(approvedWeekStart);

  // Get users for draft view - Case Admins + current user if they're a Manager
  const adminAndManagerUsers = users.filter(user => {
    if (user.email === 'df.coutts' || user.email.includes('df.coutts')) return false;
    if (user.email === 'base44.mv6e4' || user.email.includes('base44.mv6e4')) return false;
    if (user.email && user.email.toLowerCase().includes('lavina')) return false;
    
    // Always show Case Admins
    if (user.grade === 'Case Admin' || user.grade === 'Admin') return true;
    
    // If current user is a Manager, show only their own timesheets
    if (currentUser?.grade === 'Manager' && user.email === currentUser.email) return true;
    
    return false;
  });

  // Create display data for filtered users
  const allUsersForDisplay = adminAndManagerUsers.map(user => {
    const userDraftData = groupedDraftByEmployee[user.email];
    const weekData = userDraftData?.weeks[targetWeekStart];

    if (weekData) {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: true,
        week: weekData
      };
    } else {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: false,
        week: { // Provide a default empty week structure for display
          weekRange: targetWeekRange.display,
          weekKey: targetWeekStart,
          entries: [],
          dailyBreakdown: {
            Monday: { billable: 0, nonBillable: 0 },
            Tuesday: { billable: 0, nonBillable: 0 },
            Wednesday: { billable: 0, nonBillable: 0 },
            Thursday: { billable: 0, nonBillable: 0 },
            Friday: { billable: 0, nonBillable: 0 },
            Saturday: { billable: 0, nonBillable: 0 },
            Sunday: { billable: 0, nonBillable: 0 }
          }
        }
      };
    }
  });

  // Group pending timesheets by employee and week, filtered by target week
  const groupedPendingByEmployee = pendingTimesheets.reduce((acc, entry) => {
    const weekRange = getWeekRange(entry.date);
    const weekKey = weekRange.start;
    
    // Only include entries for the selected week
    if (weekKey !== pendingWeekStart) {
      return acc;
    }

    if (!acc[entry.user_email]) {
      acc[entry.user_email] = {
        user_name: entry.user_name,
        user_email: entry.user_email,
        weeks: {}
      };
    }

    if (!acc[entry.user_email].weeks[weekKey]) {
      acc[entry.user_email].weeks[weekKey] = {
        weekRange: weekRange.display,
        weekKey: weekKey,
        entries: [],
        dailyBreakdown: {
          Monday: { billable: 0, nonBillable: 0 },
          Tuesday: { billable: 0, nonBillable: 0 },
          Wednesday: { billable: 0, nonBillable: 0 },
          Thursday: { billable: 0, nonBillable: 0 },
          Friday: { billable: 0, nonBillable: 0 },
          Saturday: { billable: 0, nonBillable: 0 },
          Sunday: { billable: 0, nonBillable: 0 }
        }
      };
    }

    acc[entry.user_email].weeks[weekKey].entries.push(entry);

    // Calculate daily breakdown - FIXED: Use timezone-safe day name calculation
    const dayName = getDayNameFromDate(entry.date);
    const hours = entry.duration_seconds / 3600;
    
    if (acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName]) {
      if (entry.billable) {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].billable += hours;
      } else {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].nonBillable += hours;
      }
    }

    return acc;
  }, {});

  // Get users for pending view - Case Admins + Managers (own only) + IP grade (all users)
  const adminAndManagerUsersForPending = users.filter(user => {
    if (user.email === 'df.coutts' || user.email.includes('df.coutts')) return false;
    if (user.email === 'base44.mv6e4' || user.email.includes('base44.mv6e4')) return false;
    if (user.email && user.email.toLowerCase().includes('lavina')) return false;
    
    // If current user is IP grade, show all users
    if (currentUser?.grade === 'IP') return true;
    
    // Always show Case Admins
    if (user.grade === 'Case Admin' || user.grade === 'Admin') return true;
    
    // If current user is a Manager, show only their own timesheets
    if (currentUser?.grade === 'Manager' && user.email === currentUser.email) return true;
    
    return false;
  });

  // Get users for approved view - Case Admins + Managers (own only) + IP grade (all users) + base44 (all IPs)
  const adminAndManagerUsersForApproved = users.filter(user => {
    if (user.email === 'df.coutts' || user.email.includes('df.coutts')) return false;
    if (user.email === 'base44.mv6e4' || user.email.includes('base44.mv6e4')) return false;
    if (user.email && user.email.toLowerCase().includes('lavina')) return false;
    
    // If current user is IP grade, show all users
    if (currentUser?.grade === 'IP') return true;
    
    // Always show Case Admins
    if (user.grade === 'Case Admin' || user.grade === 'Admin') return true;
    
    // If current user is a Manager, show only their own timesheets
    if (currentUser?.grade === 'Manager' && user.email === currentUser.email) return true;
    
    // If current user is base44 account, show all IP grade users
    const isBase44Account = currentUser?.email && (currentUser.email.includes('base44') || currentUser.email === 'base44');
    if (isBase44Account && user.grade === 'IP') return true;
    
    return false;
  });

  // Create display data for filtered pending users
  const allPendingUsersForDisplayWithAll = adminAndManagerUsersForPending.map(user => {
    const userPendingData = groupedPendingByEmployee[user.email];
    const weekData = userPendingData?.weeks[pendingWeekStart];

    if (weekData) {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: true,
        week: weekData
      };
    } else {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: false,
        week: { // Provide a default empty week structure for display
          weekRange: pendingWeekRange.display,
          weekKey: pendingWeekStart,
          entries: [],
          dailyBreakdown: {
            Monday: { billable: 0, nonBillable: 0 },
            Tuesday: { billable: 0, nonBillable: 0 },
            Wednesday: { billable: 0, nonBillable: 0 },
            Thursday: { billable: 0, nonBillable: 0 },
            Friday: { billable: 0, nonBillable: 0 },
            Saturday: { billable: 0, nonBillable: 0 },
            Sunday: { billable: 0, nonBillable: 0 }
          }
        }
      };
    }
  });

  // Group approved timesheets by employee and week, filtered by target week
  const groupedApprovedByEmployee = approvedTimesheets.reduce((acc, entry) => {
    const weekRange = getWeekRange(entry.date);
    const weekKey = weekRange.start;
    
    // Only include entries for the selected week
    if (weekKey !== approvedWeekStart) {
      return acc;
    }

    if (!acc[entry.user_email]) {
      acc[entry.user_email] = {
        user_name: entry.user_name,
        user_email: entry.user_email,
        weeks: {}
      };
    }

    if (!acc[entry.user_email].weeks[weekKey]) {
      acc[entry.user_email].weeks[weekKey] = {
        weekRange: weekRange.display,
        weekKey: weekKey,
        entries: [],
        dailyBreakdown: {
          Monday: { billable: 0, nonBillable: 0 },
          Tuesday: { billable: 0, nonBillable: 0 },
          Wednesday: { billable: 0, nonBillable: 0 },
          Thursday: { billable: 0, nonBillable: 0 },
          Friday: { billable: 0, nonBillable: 0 },
          Saturday: { billable: 0, nonBillable: 0 },
          Sunday: { billable: 0, nonBillable: 0 }
        }
      };
    }

    acc[entry.user_email].weeks[weekKey].entries.push(entry);

    const dayName = getDayNameFromDate(entry.date);
    const hours = entry.duration_seconds / 3600;
    
    if (acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName]) {
      if (entry.billable) {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].billable += hours;
      } else {
        acc[entry.user_email].weeks[weekKey].dailyBreakdown[dayName].nonBillable += hours;
      }
    }

    return acc;
  }, {});

  // Create display data for approved users
  const allApprovedUsersForDisplay = adminAndManagerUsersForApproved.map(user => {
    const userApprovedData = groupedApprovedByEmployee[user.email];
    const weekData = userApprovedData?.weeks[approvedWeekStart];

    if (weekData) {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: true,
        week: weekData
      };
    } else {
      return {
        user_name: user.full_name,
        user_email: user.email,
        hasData: false,
        week: {
          weekRange: approvedWeekRange.display,
          weekKey: approvedWeekStart,
          entries: [],
          dailyBreakdown: {
            Monday: { billable: 0, nonBillable: 0 },
            Tuesday: { billable: 0, nonBillable: 0 },
            Wednesday: { billable: 0, nonBillable: 0 },
            Thursday: { billable: 0, nonBillable: 0 },
            Friday: { billable: 0, nonBillable: 0 },
            Saturday: { billable: 0, nonBillable: 0 },
            Sunday: { billable: 0, nonBillable: 0 }
          }
        }
      };
    }
  });


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const weeklyData = getUserTimesheetsByMonth();

  return (
    <div className="space-y-6" style={{ marginLeft: '-2cm', marginRight: '-2cm' }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Timesheet Approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="min-h-[600px]">
          {activeTab === 'user_timesheets' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-select">Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger id="user-select">
                      <SelectValue placeholder="Choose a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.email} value={user.email}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="month-select">Select Month</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!selectedUser ? (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">Select a user to view their timesheets</p>
                </div>
              ) : Object.keys(weeklyData).length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">No timesheets found for this period</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(weeklyData)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .map(([weekStart, data]) => {
                      const dailyHours = {};
                      const weekStartDate = new Date(weekStart + 'T12:00:00');
                      
                      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((day, index) => {
                        const currentDate = new Date(weekStartDate);
                        currentDate.setDate(weekStartDate.getDate() + index);
                        const dateStr = currentDate.toISOString().split('T')[0];
                        dailyHours[day] = {
                          hours: 0,
                          date: dateStr
                        };
                      });
                      
                      data.entries.forEach(entry => {
                        const dayName = getDayNameFromDate(entry.date);
                        if (dailyHours[dayName]) {
                          dailyHours[dayName].hours += entry.duration_seconds / 3600;
                        }
                      });

                      return (
                        <Card key={weekStart} className="border-2">
                          <CardHeader className="bg-slate-50 pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base font-semibold">
                                  Week: {data.weekRange}
                                </CardTitle>
                                <p className="text-sm text-slate-500 mt-1">
                                  {data.daysWorked.size} day(s) worked
                                </p>
                              </div>
                              <div className="text-right space-y-1">
                                <Badge variant="outline" className="text-base">
                                  Total: {data.totalHours.toFixed(2)}h
                                </Badge>
                                <div className="flex gap-2 justify-end">
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    Billable: {data.billableHours.toFixed(2)}h
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Non-billable: {data.nonBillableHours.toFixed(2)}h
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-4 pt-4 border-t border-slate-200">
                              <p className="text-xs font-semibold text-slate-600 mb-2">Daily Breakdown:</p>
                              <div className="grid grid-cols-7 gap-2">
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                                  const dayData = dailyHours[day];
                                  const hasHours = dayData.hours > 0;
                                  const isWeekend = day === 'Saturday' || day === 'Sunday';
                                  const dayNumber = new Date(dayData.date).getDate();
                                  
                                  return (
                                    <div 
                                      key={day} 
                                      className={`text-center p-2 rounded-lg border ${
                                        hasHours 
                                          ? 'bg-blue-50 border-blue-200' 
                                          : isWeekend 
                                            ? 'bg-slate-50 border-slate-100' 
                                            : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <div className="text-xs font-medium text-slate-600 mb-1">
                                        {day.substring(0, 3)} {dayNumber}
                                      </div>
                                      <div className={`text-sm font-bold ${
                                        hasHours ? 'text-blue-700' : 'text-slate-400'
                                      }`}>
                                        {hasHours ? `${dayData.hours.toFixed(1)}h` : '—'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {data.daysWorked.size < 5 && (
                              <div className="mt-2 flex items-center gap-2 text-amber-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                <span>Incomplete week - only {data.daysWorked.size} day(s) logged</span>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Date</TableHead>
                                  <TableHead>Case/Project</TableHead>
                                  <TableHead>Task</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Billable</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {data.entries
                                  .sort((a, b) => b.date.localeCompare(a.date))
                                  .map(entry => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{new Date(entry.date).toLocaleDateString('en-GB')}</TableCell>
                                      <TableCell className="font-medium">{entry.case_reference}</TableCell>
                                      <TableCell>
                                        <div>
                                          <div className="font-medium">{entry.task_description}</div>
                                          {entry.narrative && (
                                            <div className="text-sm text-slate-600 mt-1">{entry.narrative}</div>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>{formatDuration(entry.duration_seconds)}</TableCell>
                                      <TableCell>
                                        {entry.billable ? (
                                          <Badge className="bg-green-100 text-green-800">Yes</Badge>
                                        ) : (
                                          <Badge variant="outline">No</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={
                                            entry.status === 'approved' ? 'default' :
                                            entry.status === 'rejected' ? 'destructive' :
                                            'outline'
                                          }
                                          className="capitalize"
                                        >
                                          {entry.status}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setEditingEntry(entry)}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              )}
            </div>
          ) : activeTab === 'draft' ? (
            <div className="mt-6">
              {/* Week Navigation */}
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftWeekOffset(draftWeekOffset - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous Week
                </Button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-slate-900">
                    Week: {targetWeekRange.display}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraftWeekOffset(draftWeekOffset + 1)}
                >
                  Next Week
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {allUsersForDisplay.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileEdit className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">No Admin or Manager users found</p>
                  <p className="text-sm">Users with Admin or Manager grades will appear here</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableBody>
                      <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                        <TableHead className="font-semibold">Employee</TableHead>
                        <TableHead className="font-semibold">Week</TableHead>
                        <TableHead className="text-center font-semibold bg-green-50">
                          Mon {new Date(targetWeekStart + 'T12:00:00').getDate()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-green-50">
                          Tue {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-green-50">
                          Wed {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 2); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-green-50">
                          Thu {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 3); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-green-50">
                          Fri {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 4); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-slate-100">
                          Sat {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 5); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold bg-slate-100">
                          Sun {(() => { const d = new Date(targetWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.getDate(); })()}
                        </TableHead>
                        <TableHead className="text-center font-semibold">Total</TableHead>
                      </TableRow>

                      {allUsersForDisplay.map((userDisplay) => {
                        const week = userDisplay.week;
                        const totalBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.billable, 0);
                        const totalNonBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.nonBillable, 0);
                        const totalHours = totalBillable + totalNonBillable;
                        
                        // Calculate dates for the current week's days to pass to handleDayClick
                        const weekStartDateForDayClick = new Date(week.weekKey + 'T12:00:00');
                        
                        return (
                          <React.Fragment key={userDisplay.user_email}>
                            <TableRow className="hover:bg-slate-50">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-blue-600" />
                                  {userDisplay.user_name}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-slate-600">
                                {week.weekRange}
                              </TableCell>
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                                const dayData = week.dailyBreakdown[day];
                                const totalDayHours = dayData ? dayData.billable + dayData.nonBillable : 0;
                                const isWeekend = day === 'Saturday' || day === 'Sunday';

                                const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
                                const currentDate = new Date(weekStartDateForDayClick);
                                currentDate.setDate(weekStartDateForDayClick.getDate() + dayIndex);
                                const dateStr = currentDate.toISOString().split('T')[0];
                                
                                // Get entries for this specific day (only if userDisplay.hasData is true)
                                const dayEntries = userDisplay.hasData ? week.entries.filter(entry => entry.date === dateStr) : [];

                                return (
                                  <TableCell 
                                    key={day} 
                                    className={`text-center ${isWeekend ? 'bg-slate-50' : ''} ${totalDayHours > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                                    onClick={() => totalDayHours > 0 && handleDayClick(dateStr, dayEntries, day, userDisplay.user_email, week.weekKey)}
                                  >
                                    {totalDayHours > 0 ? (
                                      <div className="space-y-1">
                                        <div className="flex gap-1 justify-center">
                                          {dayData.billable > 0 && (
                                            <div className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                              {dayData.billable.toFixed(1)}h
                                            </div>
                                          )}
                                          {dayData.nonBillable > 0 && (
                                            <div className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                                              {dayData.nonBillable.toFixed(1)}h
                                            </div>
                                          )}
                                        </div>
                                        <div className="text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                                          {totalDayHours.toFixed(1)}h
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-center">
                                {totalHours > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-sm font-bold text-slate-900">
                                      {totalHours.toFixed(1)}h
                                    </div>
                                    <div className="flex gap-1 justify-center">
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      {totalBillable.toFixed(1)}h
                                    </Badge>
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                      {totalNonBillable.toFixed(1)}h
                                    </Badge>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </TableCell>
                          </TableRow>

                            {/* Time Entries Detail Row - Shows when a day is clicked with GROUPED categories */}
                            {selectedDayEntries && 
                             selectedDayEntries.userEmail === userDisplay.user_email &&
                             selectedDayEntries.weekKey === week.weekKey && (
                              <TableRow>
                                <TableCell colSpan={10} className="p-0 bg-blue-50 border-t-2 border-blue-200">
                                  <div className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-600" />
                                        Time Entries for {selectedDayEntries.dayName}, {new Date(selectedDayEntries.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </h3>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedDayEntries(null)}
                                      >
                                        Close
                                      </Button>
                                    </div>
                                    
                                    <div className="bg-white rounded-lg border border-slate-200">
                                      {/* Group entries by task category */}
                                      {Object.entries(groupEntriesByCategory(selectedDayEntries.entries)).map(([category, categoryEntries]) => {
                                        const isExpanded = expandedCategories.has(category);
                                        const categoryTotal = categoryEntries.reduce((sum, e) => sum + e.duration_seconds, 0);
                                        const categoryBillable = categoryEntries.filter(e => e.billable).reduce((sum, e) => sum + e.duration_seconds, 0);
                                        
                                        return (
                                          <div key={category} className="border-b border-slate-200 last:border-b-0">
                                            {/* Category Header - Clickable */}
                                            <div 
                                              className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                              onClick={() => toggleCategory(category)}
                                            >
                                              <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                  <ChevronDown className="w-4 h-4 text-slate-600" />
                                                ) : (
                                                  <ChevronRight className="w-4 h-4 text-slate-600" />
                                                )}
                                                <span className="font-semibold text-slate-900">{category}</span>
                                                <Badge variant="outline" className="text-xs">
                                                  {categoryEntries.length} {categoryEntries.length === 1 ? 'entry' : 'entries'}
                                                </Badge>
                                              </div>
                                              <div className="flex items-center gap-3">
                                                <div className="text-sm font-mono font-semibold text-slate-900">
                                                  {formatDuration(categoryTotal)}
                                                </div>
                                                {categoryBillable > 0 && (
                                                  <Badge className="bg-green-100 text-green-700 text-xs">
                                                    Billable: {formatDuration(categoryBillable)}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                            
                                            {/* Category Entries - Shown when expanded */}
                                            {isExpanded && (
                                              <div className="p-0">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow className="bg-white">
                                                      <TableHead className="font-semibold text-xs">Case Reference</TableHead>
                                                      <TableHead className="font-semibold text-xs">Activity</TableHead>
                                                      <TableHead className="font-semibold text-xs">Narrative</TableHead>
                                                      <TableHead className="text-center font-semibold text-xs">Duration</TableHead>
                                                      <TableHead className="text-center font-semibold text-xs">Billable</TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {categoryEntries.map((entry) => (
                                                      <TableRow key={entry.id} className="hover:bg-slate-50">
                                                        <TableCell className="font-medium text-blue-600 text-sm">{entry.case_reference}</TableCell>
                                                        <TableCell className="text-sm">{entry.activity}</TableCell>
                                                        <TableCell className="text-sm text-slate-700 max-w-md">{entry.narrative}</TableCell>
                                                        <TableCell className="text-center font-mono font-semibold text-sm">{formatDuration(entry.duration_seconds)}</TableCell>
                                                        <TableCell className="text-center">
                                                          {entry.billable ? (
                                                            <Badge className="bg-green-100 text-green-800 text-xs">Yes</Badge>
                                                          ) : (
                                                            <Badge variant="outline" className="text-xs">No</Badge>
                                                          )}
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={onTabChange}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pending">
                  Pending ({pendingTimesheets.length})
                </TabsTrigger>
                <TabsTrigger value="approved">
                  Approved ({approvedTimesheets.length})
                </TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({rejectedTimesheets.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pending" className="mt-6">
                {/* Week Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingWeekOffset(pendingWeekOffset - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous Week
                  </Button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      Week: {pendingWeekRange.display}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPendingWeekOffset(pendingWeekOffset + 1)}
                  >
                    Next Week
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {allPendingUsersForDisplayWithAll.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="font-medium">No Admin or Manager users found</p>
                    <p className="text-sm">Users with Admin or Manager grades will appear here</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableBody>
                        {/* Single Header Row */}
                        <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                          <TableHead className="font-semibold">Employee</TableHead>
                          <TableHead className="font-semibold">Week</TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Mon {new Date(pendingWeekStart + 'T12:00:00').getDate()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Tue {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Wed {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 2); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Thu {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 3); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Fri {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 4); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-slate-100">
                            Sat {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 5); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-slate-100">
                            Sun {(() => { const d = new Date(pendingWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold">Total</TableHead>
                          <TableHead className="text-center font-semibold">Actions</TableHead>
                        </TableRow>

                        {/* User Rows */}
                        {allPendingUsersForDisplayWithAll.map((userDisplay) => {
                          const week = userDisplay.week;
                          const totalBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.billable, 0);
                          const totalNonBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.nonBillable, 0);
                          const totalHours = totalBillable + totalNonBillable;
                          const weekStartDate = new Date(week.weekKey + 'T12:00:00');
                          
                          return (
                            <React.Fragment key={`${userDisplay.user_email}-${week.weekKey}`}>
                              <TableRow className="hover:bg-slate-50">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-600" />
                                    {userDisplay.user_name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {week.weekRange}
                                </TableCell>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                                  const dayData = week.dailyBreakdown[day];
                                  const totalDayHours = dayData ? dayData.billable + dayData.nonBillable : 0;
                                  const isWeekend = day === 'Saturday' || day === 'Sunday';
                                  
                                  // Get actual date for this day
                                  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
                                  const currentDate = new Date(weekStartDate);
                                  currentDate.setDate(weekStartDate.getDate() + dayIndex);
                                  const dateStr = currentDate.toISOString().split('T')[0];
                                  
                                  // Get entries for this specific day
                                  const dayEntries = week.entries.filter(entry => entry.date === dateStr);
                                  
                                  return (
                                    <TableCell 
                                      key={day} 
                                      className={`text-center ${isWeekend ? 'bg-slate-50' : ''} ${totalDayHours > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                                      onClick={() => totalDayHours > 0 && handleDayClick(dateStr, dayEntries, day, userDisplay.user_email, week.weekKey)}
                                    >
                                      {totalDayHours > 0 ? (
                                        <div className="space-y-1">
                                          <div className="flex gap-1 justify-center">
                                            {dayData.billable > 0 && (
                                              <div className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                                {dayData.billable.toFixed(1)}h
                                              </div>
                                            )}
                                            {dayData.nonBillable > 0 && (
                                              <div className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                                                {dayData.nonBillable.toFixed(1)}h
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                                            {totalDayHours.toFixed(1)}h
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center">
                                  <div className="space-y-1">
                                    <div className="text-sm font-bold text-slate-900">
                                      {totalHours.toFixed(1)}h
                                    </div>
                                    <div className="flex gap-1 justify-center">
                                      <Badge className="bg-green-100 text-green-800 text-xs">
                                        {totalBillable.toFixed(1)}h
                                      </Badge>
                                      <Badge className="bg-red-100 text-red-800 text-xs">
                                        {totalNonBillable.toFixed(1)}h
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {userDisplay.hasData && totalHours > 0 ? (
                                    <div className="flex gap-2 justify-center">
                                      <Button
                                        size="sm"
                                        onClick={() => handleApproveWeek(userDisplay.user_email, week.weekKey, week.entries)}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setRejectingWeek({
                                          user: userDisplay.user_name,
                                          week: week.weekRange,
                                          entries: week.entries
                                        })}
                                      >
                                        <XCircle className="w-4 h-4 mr-1" />
                                        Reject
                                      </Button>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-400">—</span>
                                  )}
                                </TableCell>
                              </TableRow>

                              {selectedDayEntries && 
                               selectedDayEntries.userEmail === userDisplay.user_email &&
                               selectedDayEntries.weekKey === week.weekKey && (
                                <TableRow>
                                  <TableCell colSpan={11} className="p-0 bg-blue-50 border-t-2 border-blue-200">
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <Calendar className="w-4 h-4 text-blue-600" />
                                          Time Entries for {selectedDayEntries.dayName}, {new Date(selectedDayEntries.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </h3>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedDayEntries(null)}
                                        >
                                          Close
                                        </Button>
                                      </div>
                                      
                                      <div className="bg-white rounded-lg border border-slate-200">
                                        {Object.entries(groupEntriesByCategory(selectedDayEntries.entries)).map(([category, categoryEntries]) => {
                                          const isExpanded = expandedCategories.has(category);
                                          const categoryTotal = categoryEntries.reduce((sum, e) => sum + e.duration_seconds, 0);
                                          const categoryBillable = categoryEntries.filter(e => e.billable).reduce((sum, e) => sum + e.duration_seconds, 0);
                                          
                                          return (
                                            <div key={category} className="border-b border-slate-200 last:border-b-0">
                                              <div 
                                                className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => toggleCategory(category)}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                                  ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                                  )}
                                                  <span className="font-semibold text-slate-900">{category}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {categoryEntries.length} {categoryEntries.length === 1 ? 'entry' : 'entries'}
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className="text-sm font-mono font-semibold text-slate-900">
                                                    {formatDuration(categoryTotal)}
                                                  </div>
                                                  {categoryBillable > 0 && (
                                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                                      Billable: {formatDuration(categoryBillable)}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {isExpanded && (
                                                <div className="p-0">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow className="bg-white">
                                                        <TableHead className="font-semibold text-xs">Case Reference</TableHead>
                                                        <TableHead className="font-semibold text-xs">Activity</TableHead>
                                                        <TableHead className="font-semibold text-xs">Narrative</TableHead>
                                                        <TableHead className="text-center font-semibold text-xs">Duration</TableHead>
                                                        <TableHead className="text-center font-semibold text-xs">Billable</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {categoryEntries.map((entry) => (
                                                        <TableRow key={entry.id} className="hover:bg-slate-50">
                                                          <TableCell className="font-medium text-blue-600 text-sm">{entry.case_reference}</TableCell>
                                                          <TableCell className="text-sm">{entry.activity}</TableCell>
                                                          <TableCell className="text-sm text-slate-700 max-w-md">{entry.narrative}</TableCell>
                                                          <TableCell className="text-center font-mono font-semibold text-sm">{formatDuration(entry.duration_seconds)}</TableCell>
                                                          <TableCell className="text-center">
                                                            {entry.billable ? (
                                                              <Badge className="bg-green-100 text-green-800 text-xs">Yes</Badge>
                                                            ) : (
                                                              <Badge variant="outline" className="text-xs">No</Badge>
                                                            )}
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="approved" className="mt-6">
                {/* Week Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovedWeekOffset(approvedWeekOffset - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous Week
                  </Button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-900">
                      Week: {approvedWeekRange.display}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setApprovedWeekOffset(approvedWeekOffset + 1)}
                  >
                    Next Week
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>

                {allApprovedUsersForDisplay.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="font-medium">No users found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableBody>
                        <TableRow className="bg-slate-100 border-t-2 border-slate-300">
                          <TableHead className="font-semibold">Employee</TableHead>
                          <TableHead className="font-semibold">Week</TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Mon {new Date(approvedWeekStart + 'T12:00:00').getDate()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Tue {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Wed {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 2); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Thu {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 3); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-green-50">
                            Fri {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 4); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-slate-100">
                            Sat {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 5); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold bg-slate-100">
                            Sun {(() => { const d = new Date(approvedWeekStart + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.getDate(); })()}
                          </TableHead>
                          <TableHead className="text-center font-semibold">Total</TableHead>
                        </TableRow>

                        {allApprovedUsersForDisplay.map((userDisplay) => {
                          const week = userDisplay.week;
                          const totalBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.billable, 0);
                          const totalNonBillable = Object.values(week.dailyBreakdown).reduce((sum, day) => sum + day.nonBillable, 0);
                          const totalHours = totalBillable + totalNonBillable;
                          const weekStartDate = new Date(week.weekKey + 'T12:00:00');
                          
                          return (
                            <React.Fragment key={`${userDisplay.user_email}-${week.weekKey}`}>
                              <TableRow className="hover:bg-slate-50">
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-blue-600" />
                                    {userDisplay.user_name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-slate-600">
                                  {week.weekRange}
                                </TableCell>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                                  const dayData = week.dailyBreakdown[day];
                                  const totalDayHours = dayData ? dayData.billable + dayData.nonBillable : 0;
                                  const isWeekend = day === 'Saturday' || day === 'Sunday';
                                  
                                  const dayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(day);
                                  const currentDate = new Date(weekStartDate);
                                  currentDate.setDate(weekStartDate.getDate() + dayIndex);
                                  const dateStr = currentDate.toISOString().split('T')[0];
                                  
                                  const dayEntries = week.entries.filter(entry => entry.date === dateStr);
                                  
                                  return (
                                    <TableCell 
                                      key={day} 
                                      className={`text-center ${isWeekend ? 'bg-slate-50' : ''} ${totalDayHours > 0 ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                                      onClick={() => totalDayHours > 0 && handleDayClick(dateStr, dayEntries, day, userDisplay.user_email, week.weekKey)}
                                    >
                                      {totalDayHours > 0 ? (
                                        <div className="space-y-1">
                                          <div className="flex gap-1 justify-center">
                                            {dayData.billable > 0 && (
                                              <div className="text-sm font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
                                                {dayData.billable.toFixed(1)}h
                                              </div>
                                            )}
                                            {dayData.nonBillable > 0 && (
                                              <div className="text-sm font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">
                                                {dayData.nonBillable.toFixed(1)}h
                                              </div>
                                            )}
                                          </div>
                                          <div className="text-xs font-bold text-slate-900 pt-1 border-t border-slate-200">
                                            {totalDayHours.toFixed(1)}h
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center">
                                  <div className="space-y-1">
                                    <div className="text-sm font-bold text-slate-900">
                                      {totalHours.toFixed(1)}h
                                    </div>
                                    <div className="flex gap-1 justify-center">
                                      <Badge className="bg-green-100 text-green-800 text-xs">
                                        {totalBillable.toFixed(1)}h
                                      </Badge>
                                      <Badge className="bg-red-100 text-red-800 text-xs">
                                        {totalNonBillable.toFixed(1)}h
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {selectedDayEntries && 
                               selectedDayEntries.userEmail === userDisplay.user_email &&
                               selectedDayEntries.weekKey === week.weekKey && (
                                <TableRow>
                                  <TableCell colSpan={10} className="p-0 bg-blue-50 border-t-2 border-blue-200">
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <Calendar className="w-4 h-4 text-blue-600" />
                                          Time Entries for {selectedDayEntries.dayName}, {new Date(selectedDayEntries.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </h3>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedDayEntries(null)}
                                        >
                                          Close
                                        </Button>
                                      </div>
                                      
                                      <div className="bg-white rounded-lg border border-slate-200">
                                        {Object.entries(groupEntriesByCategory(selectedDayEntries.entries)).map(([category, categoryEntries]) => {
                                          const isExpanded = expandedCategories.has(category);
                                          const categoryTotal = categoryEntries.reduce((sum, e) => sum + e.duration_seconds, 0);
                                          const categoryBillable = categoryEntries.filter(e => e.billable).reduce((sum, e) => sum + e.duration_seconds, 0);
                                          
                                          return (
                                            <div key={category} className="border-b border-slate-200 last:border-b-0">
                                              <div 
                                                className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={() => toggleCategory(category)}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4 text-slate-600" />
                                                  ) : (
                                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                                  )}
                                                  <span className="font-semibold text-slate-900">{category}</span>
                                                  <Badge variant="outline" className="text-xs">
                                                    {categoryEntries.length} {categoryEntries.length === 1 ? 'entry' : 'entries'}
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <div className="text-sm font-mono font-semibold text-slate-900">
                                                    {formatDuration(categoryTotal)}
                                                  </div>
                                                  {categoryBillable > 0 && (
                                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                                      Billable: {formatDuration(categoryBillable)}
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                              
                                              {isExpanded && (
                                                <div className="p-0">
                                                  <Table>
                                                    <TableHeader>
                                                      <TableRow className="bg-white">
                                                        <TableHead className="font-semibold text-xs">Case Reference</TableHead>
                                                        <TableHead className="font-semibold text-xs">Activity</TableHead>
                                                        <TableHead className="font-semibold text-xs">Narrative</TableHead>
                                                        <TableHead className="text-center font-semibold text-xs">Duration</TableHead>
                                                        <TableHead className="text-center font-semibold text-xs">Billable</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                      {categoryEntries.map((entry) => (
                                                        <TableRow key={entry.id} className="hover:bg-slate-50">
                                                          <TableCell className="font-medium text-blue-600 text-sm">{entry.case_reference}</TableCell>
                                                          <TableCell className="text-sm">{entry.activity}</TableCell>
                                                          <TableCell className="text-sm text-slate-700 max-w-md">{entry.narrative}</TableCell>
                                                          <TableCell className="text-center font-mono font-semibold text-sm">{formatDuration(entry.duration_seconds)}</TableCell>
                                                          <TableCell className="text-center">
                                                            {entry.billable ? (
                                                              <Badge className="bg-green-100 text-green-800 text-xs">Yes</Badge>
                                                            ) : (
                                                              <Badge variant="outline" className="text-xs">No</Badge>
                                                            )}
                                                          </TableCell>
                                                        </TableRow>
                                                      ))}
                                                    </TableBody>
                                                  </Table>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rejected" className="mt-6">
                {rejectedTimesheets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <XCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="font-medium">No rejected timesheets</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Case/Project</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Rejected By</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejectedTimesheets.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.user_name}</TableCell>
                          <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                          <TableCell>{entry.case_reference}</TableCell>
                          <TableCell>{entry.task_description}</TableCell>
                          <TableCell>{formatDuration(entry.duration_seconds)}</TableCell>
                          <TableCell className="text-red-600">{entry.rejection_reason}</TableCell>
                          <TableCell>{entry.approved_by}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingEntry(entry)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejectingWeek} onOpenChange={() => setRejectingWeek(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Week</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {rejectingWeek && (
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">Rejecting week for:</p>
                <p className="font-semibold">{rejectingWeek.user}</p>
                <p className="text-sm text-slate-600">{rejectingWeek.week}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {rejectingWeek.entries.length} {rejectingWeek.entries.length === 1 ? 'entry' : 'entries'} will be rejected
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="rejection-reason">Reason for Rejection</Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a reason for rejecting this week's timesheets..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setRejectingWeek(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRejectWeek}>
                Reject Week
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Timesheet Entry Details</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <Label className="text-xs text-slate-500">User</Label>
                  <p className="font-medium">{editingEntry.user_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Date</Label>
                  <p className="font-medium">{new Date(editingEntry.date).toLocaleDateString('en-GB')}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Case Reference</Label>
                  <p className="font-medium">{editingEntry.case_reference}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Duration</Label>
                  <p className="font-medium">{formatDuration(editingEntry.duration_seconds)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Task</Label>
                  <p className="font-medium">{editingEntry.task_description}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Status</Label>
                  <Badge
                    variant={
                      editingEntry.status === 'approved' ? 'default' :
                      editingEntry.status === 'rejected' ? 'destructive' :
                      'outline'
                    }
                    className="capitalize"
                  >
                    {editingEntry.status}
                  </Badge>
                </div>
                {editingEntry.activity && (
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Activity</Label>
                    <p className="font-medium">{editingEntry.activity}</p>
                  </div>
                )}
                {editingEntry.narrative && (
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Narrative</Label>
                    <p className="text-sm text-slate-700 mt-1">{editingEntry.narrative}</p>
                  </div>
                )}
                {editingEntry.approved_by && (
                  <div>
                    <Label className="text-xs text-slate-500">
                      {editingEntry.status === 'rejected' ? 'Rejected By' : 'Approved By'}
                    </Label>
                    <p className="font-medium">{editingEntry.approved_by}</p>
                  </div>
                )}
                {editingEntry.approved_date && (
                  <div>
                    <Label className="text-xs text-slate-500">
                      {editingEntry.status === 'rejected' ? 'Rejected Date' : 'Approved Date'}
                    </Label>
                    <p className="font-medium">{new Date(editingEntry.approved_date).toLocaleDateString('en-GB')}</p>
                  </div>
                )}
                {editingEntry.rejection_reason && (
                  <div className="col-span-2">
                    <Label className="text-xs text-slate-500">Rejection Reason</Label>
                    <p className="text-sm text-red-600 mt-1">{editingEntry.rejection_reason}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteEntry(editingEntry.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Entry
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditingEntry(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}