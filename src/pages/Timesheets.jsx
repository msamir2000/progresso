import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { base44 } from '@/api/base44Client';
import {
  Clock,
  Play,
  Pause,
  Square,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  Save,
  X,
  BookOpen
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

// Category display name mapping
const CATEGORY_DISPLAY_NAMES = {
  'statutory': 'STATUTORY AND ADMINISTRATIVE TASKS',
  'realisation': 'REALISATION OF ASSETS',
  'investigations': 'INVESTIGATIONS',
  'creditors': 'CREDITORS',
  'employees': 'EMPLOYEES',
  'trading': 'TRADING',
  'pre_appointment': 'PRE APPOINTMENT'
};

export default function Timesheets() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTask, setTimerTask] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerNarrative, setTimerNarrative] = useState('');
  const [timerActivity, setTimerActivity] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);

  // Separate states for case search for each context (timer, add entry, edit entry)
  const [timerCaseSearchTerm, setTimerCaseSearchTerm] = useState('');
  const [showTimerCaseSuggestions, setShowTimerCaseSuggestions] = useState(false);
  const timerCaseSearchRef = useRef(null);

  const [addEntryCaseSearchTerm, setAddEntryCaseSearchTerm] = useState('');
  const [showAddEntryCaseSuggestions, setShowAddEntryCaseSuggestions] = useState(false);
  const addEntryCaseSearchRef = useRef(null);

  const [editEntryCaseSearchTerm, setEditEntryCaseSearchTerm] = useState('');
  const [showEditEntryCaseSuggestions, setShowEditEntryCaseSuggestions] = useState(false);
  const editEntryCaseSearchRef = useRef(null);

  const [manualTime, setManualTime] = useState('');

  const [cases, setCases] = useState([]);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  // `filteredCases` state is no longer needed as filtering is done locally for each dropdown

  const [timesheetTasks, setTimesheetTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [timeEntries, setTimeEntries] = useState([]);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHistorySection, setShowHistorySection] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedGuideCategory, setSelectedGuideCategory] = useState('');
  const [newEntry, setNewEntry] = useState({
    project: '',
    task: '',
    activity: '',
    narrative: '',
    hours: '',
    minutes: '',
    billable: true
  });

  const timerInterval = useRef(null);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  // Load cases on mount
  useEffect(() => {
    const loadCases = async () => {
      setIsLoadingCases(true);
      try {
        const allCases = await base44.entities.Case.list('-updated_date', 200);
        const activeOrPipelineCases = allCases.filter(c =>
          c.status === 'active' || !c.appointment_date
        );
        // Sort cases alphabetically by company name for initial list
        const sortedCases = [...activeOrPipelineCases].sort((a, b) => {
          const nameA = (a.company_name || '').toLowerCase();
          const nameB = (b.company_name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setCases(sortedCases);
      } catch (error) {
        console.error('Failed to load cases:', error);
      } finally {
        setIsLoadingCases(false);
      }
    };
    loadCases();
  }, []);

  // Helper function to filter and sort cases based on a search term
  const getFilteredCases = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
      return cases; // Return all cases if search term is empty
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = cases.filter(c =>
      c.company_name?.toLowerCase().includes(searchLower) ||
      c.case_reference?.toLowerCase().includes(searchLower)
    );

    const sortedFiltered = filtered.sort((a, b) => {
      const nameA = (a.company_name || '').toLowerCase();
      const nameB = (b.company_name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return sortedFiltered;
  };

  // Handle clicks outside the timer's case search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timerCaseSearchRef.current && !timerCaseSearchRef.current.contains(event.target)) {
        setShowTimerCaseSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [timerCaseSearchRef]);

  // Handle clicks outside the add entry's case search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addEntryCaseSearchRef.current && !addEntryCaseSearchRef.current.contains(event.target)) {
        setShowAddEntryCaseSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [addEntryCaseSearchRef]);

  // Handle clicks outside the edit entry's case search dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editEntryCaseSearchRef.current && !editEntryCaseSearchRef.current.contains(event.target)) {
        setShowEditEntryCaseSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editEntryCaseSearchRef]);

  // Load timesheet tasks on mount
  useEffect(() => {
    const loadTimesheetTasks = async () => {
      setIsLoadingTasks(true);
      try {
        const tasks = await base44.entities.TimesheetTask.list();

        if (tasks && tasks.length > 0) {
        } else {
          console.warn('⚠️ NO TASKS FOUND IN DATABASE');
        }

        setTimesheetTasks(tasks || []);
      } catch (error) {
        console.error('❌ ERROR loading timesheet tasks:', error);
        console.error('Error details:', error.message);
        setTimesheetTasks([]);
      } finally {
        setIsLoadingTasks(false);
      }
    };
    loadTimesheetTasks();
  }, []);

  // Load timesheet entries for current user
  useEffect(() => {
    const loadTimeEntries = async () => {
      if (!currentUser) return;

      try {
        const entries = await base44.entities.TimesheetEntry.filter({
          user_email: currentUser.email
        });

        // Convert database entries to component format
        const formattedEntries = entries.map(entry => ({
          id: entry.id,
          date: entry.date,
          project: entry.case_reference,
          task: entry.task_description,
          description: entry.activity,
          activity: entry.activity,
          duration: entry.duration_seconds,
          billable: entry.billable,
          narrative: entry.narrative,
          status: entry.status
        }));

        setTimeEntries(formattedEntries);
      } catch (error) {
        console.error('Error loading time entries:', error);
      }
    };

    loadTimeEntries();
  }, [currentUser]);

  // Get unique task categories
  const uniqueTaskCategories = React.useMemo(() => {
    if (!timesheetTasks || timesheetTasks.length === 0) {
      return [];
    }

    const categories = [...new Set(timesheetTasks.map(t => t.category).filter(Boolean))];
    return categories;
  }, [timesheetTasks]);

  // Get activities for selected task
  const getActivitiesForTask = (taskCategory) => {
    if (!taskCategory) {
      return [];
    }
    const activities = timesheetTasks.filter(t => t.category === taskCategory);
    return activities;
  };

  // Helper to get display name for category
  const getCategoryDisplayName = (category) => {
    return CATEGORY_DISPLAY_NAMES[category] || category.toUpperCase();
  };

  // Helper to get filtered task categories based on project and date
  const getFilteredTaskCategories = (project, dateToCheck = null) => {
    if (project === "Non Chargeable") {
      // For non-chargeable, only show categories that are specifically non-chargeable
      return uniqueTaskCategories.filter(cat => 
        cat?.toLowerCase().includes('non chargeable') ||
        cat?.toLowerCase().includes('non-chargeable') ||
        cat === 'Non Chargeable'
      );
    }
    
    // For case references, check if we should filter out pre_appointment
    const caseData = cases.find(c => c.case_reference === project);
    if (caseData && caseData.appointment_date) {
      const appointmentDate = new Date(caseData.appointment_date);
      appointmentDate.setHours(0, 0, 0, 0);
      
      const checkDate = dateToCheck ? new Date(dateToCheck) : selectedDate;
      checkDate.setHours(0, 0, 0, 0);
      
      // If the selected date is on or after appointment date, exclude pre_appointment
      if (checkDate >= appointmentDate) {
        return uniqueTaskCategories.filter(cat => cat !== 'pre_appointment');
      }
    }
    
    // For all other cases, show all categories
    return uniqueTaskCategories;
  };

  // Load timer state from localStorage on mount
  useEffect(() => {
    const savedTimer = localStorage.getItem('timesheetTimer');
    if (savedTimer) {
      const timerData = JSON.parse(savedTimer);
      setTimerProject(timerData.project || '');
      setTimerTask(timerData.task || '');
      setTimerActivity(timerData.activity || '');
      setTimerNarrative(timerData.narrative || '');
      setTimerBillable(timerData.billable !== undefined ? timerData.billable : true);

      // Set the initial value for timerCaseSearchTerm based on loaded timerProject
      if (timerData.project === "Non Chargeable") {
        setTimerCaseSearchTerm("Non Chargeable");
      } else if (timerData.project) {
        // Find the case by reference to display its full name
        const selectedCase = cases.find(c => c.case_reference === timerData.project);
        if (selectedCase) {
          setTimerCaseSearchTerm(`${selectedCase.case_reference} - ${selectedCase.company_name}`);
        } else {
          setTimerCaseSearchTerm(timerData.project); // Fallback if case not found
        }
      } else {
        setTimerCaseSearchTerm('');
      }

      if (timerData.isRunning && timerData.startTime) {
        const elapsed = Math.floor((Date.now() - timerData.startTime) / 1000);
        setTimerSeconds(elapsed);
        setIsTimerRunning(true);
      } else if (timerData.pausedSeconds !== undefined) {
        setTimerSeconds(timerData.pausedSeconds);
        setIsTimerRunning(false);
      }
    }
  }, [cases]); // Depend on cases to ensure case names are available for timerCaseSearchTerm display

  // Save timer state to localStorage whenever it changes
  useEffect(() => {
    if (isTimerRunning) {
      const startTime = Date.now() - (timerSeconds * 1000);
      localStorage.setItem('timesheetTimer', JSON.stringify({
        isRunning: true,
        startTime: startTime,
        project: timerProject,
        task: timerTask,
        activity: timerActivity,
        narrative: timerNarrative,
        billable: timerBillable
      }));
    } else if (timerSeconds > 0) {
      localStorage.setItem('timesheetTimer', JSON.stringify({
        isRunning: false,
        pausedSeconds: timerSeconds,
        project: timerProject,
        task: timerTask,
        activity: timerActivity,
        narrative: timerNarrative,
        billable: timerBillable
      }));
    }
  }, [isTimerRunning, timerSeconds, timerProject, timerTask, timerActivity, timerNarrative, timerBillable]);

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer logic
  useEffect(() => {
    if (isTimerRunning) {
      timerInterval.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current);
      }
    };
  }, [isTimerRunning]);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const calculateEntryCost = (entry) => {
    // If not billable, cost is 0
    if (!entry.billable) {
      return 0;
    }

    // Use the hourly rate from the current user's profile
    const hourlyRate = currentUser?.hourly_rate || 0;
    const hours = entry.duration / 3600;
    return hours * hourlyRate;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const secondsToInterval = (seconds) => {
    return (seconds / 3600).toFixed(1);
  };

  const intervalToSeconds = (interval) => {
    return Math.round(parseFloat(interval) * 3600);
  };

  const roundToInterval = (seconds) => {
    if (seconds === 0) return 0;
    if (seconds < 360) return 360;
    const intervals = Math.round(seconds / 360);
    return intervals * 360;
  };

  const startTimer = () => {
    setIsTimerRunning(true);
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
  };

  const stopTimer = () => {
    setIsTimerRunning(false);
  };

  const validateNarrative = (narrative) => {
    // IPs don't need minimum word count
    if (currentUser?.grade === 'IP') {
      return narrative && narrative.trim().length > 0;
    }
    // All other users need minimum 10 words
    if (!narrative || narrative.trim().length === 0) return false;
    const wordCount = narrative.trim().split(/\s+/).filter(word => word.length > 0).length;
    return wordCount >= 10;
  };

  const handleManualTimeSubmit = async () => {
    if (!currentUser) {
      alert('Please log in to submit time entries');
      return;
    }

    let secondsToSubmit = 0;

    if (!isTimerRunning && timerSeconds > 0) {
      secondsToSubmit = roundToInterval(timerSeconds);
    } else if (manualTime) {
      const parsedManualTime = parseFloat(manualTime);
      if (!isNaN(parsedManualTime) && parsedManualTime > 0) {
        secondsToSubmit = intervalToSeconds(parsedManualTime.toString());
      }
    }

    if (secondsToSubmit > 0 && timerProject && timerTask && timerActivity && validateNarrative(timerNarrative)) {
      try {
        // Use the currently selected date for the entry
        const entryDate = selectedDate.toISOString().split('T')[0];

        // Save to database
        const newDbEntry = await base44.entities.TimesheetEntry.create({
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          date: entryDate,
          case_reference: timerProject,
          task_description: timerTask,
          activity: timerActivity,
          narrative: timerNarrative,
          duration_seconds: secondsToSubmit,
          billable: timerBillable,
          status: 'draft'
        });

        // Add to local state (map from DB fields back to local state structure)
        const newEntryData = {
          id: newDbEntry.id,
          date: newDbEntry.date,
          project: newDbEntry.case_reference,
          task: newDbEntry.task_description,
          description: newDbEntry.activity,
          activity: newDbEntry.activity,
          duration: newDbEntry.duration_seconds,
          billable: newDbEntry.billable,
          narrative: newDbEntry.narrative,
          status: newDbEntry.status
        };

        setTimeEntries([newEntryData, ...timeEntries]);

        setTimerSeconds(0);
        setTimerProject('');
        setTimerTask('');
        setTimerActivity('');
        setTimerNarrative('');
        setTimerBillable(true);
        setManualTime('');
        setIsTimerRunning(false);
        setTimerCaseSearchTerm(''); // Clear specific search term
        setShowTimerCaseSuggestions(false); // Hide specific suggestions

        localStorage.removeItem('timesheetTimer');
      } catch (error) {
        console.error('Error saving time entry:', error);
        alert('Failed to save time entry');
      }
    }
  };

  const handleAddManualEntry = async () => {
    if (!currentUser) {
      alert('Please log in to add time entries');
      return;
    }

    const totalSeconds = (parseInt(newEntry.hours) || 0) * 3600 + (parseInt(newEntry.minutes) || 0) * 60;
    if (totalSeconds > 0 && newEntry.project && newEntry.task && newEntry.activity && validateNarrative(newEntry.narrative)) {
      try {
        // Save to database
        const newDbEntry = await base44.entities.TimesheetEntry.create({
          user_email: currentUser.email,
          user_name: currentUser.full_name,
          date: selectedDate.toISOString().split('T')[0],
          case_reference: newEntry.project,
          task_description: newEntry.task,
          activity: newEntry.activity,
          narrative: newEntry.narrative,
          duration_seconds: totalSeconds,
          billable: newEntry.billable,
          status: 'draft'
        });

        // Add to local state
        const entryData = {
          id: newDbEntry.id,
          date: newDbEntry.date,
          project: newDbEntry.case_reference,
          task: newDbEntry.task_description,
          description: newDbEntry.activity,
          activity: newDbEntry.activity,
          duration: totalSeconds,
          billable: newDbEntry.billable,
          narrative: newDbEntry.narrative,
          status: newDbEntry.status
        };

        setTimeEntries([entryData, ...timeEntries]);
        setNewEntry({ project: '', task: '', activity: '', narrative: '', hours: '', minutes: '', billable: true });
        setShowAddEntry(false);
        setAddEntryCaseSearchTerm(''); // Clear specific search term
        setShowAddEntryCaseSuggestions(false); // Hide specific suggestions
      } catch (error) {
        console.error('Error saving time entry:', error);
        alert('Failed to save time entry');
      }
    }
  };

  const handleDeleteEntry = async (id) => {
    try {
      await base44.entities.TimesheetEntry.delete(id);
      setTimeEntries(timeEntries.filter(entry => entry.id !== id));
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry.id);
    setNewEntry({
      project: entry.project,
      task: entry.task || '',
      activity: entry.activity || '',
      narrative: entry.narrative || '',
      hours: Math.floor(entry.duration / 3600).toString(),
      minutes: Math.floor((entry.duration % 3600) / 60).toString(),
      billable: entry.billable
    });
    // Set case search term for editing form
    if (entry.project === "Non Chargeable") {
      setEditEntryCaseSearchTerm("Non Chargeable");
    } else if (entry.project) {
      const selectedCase = cases.find(c => c.case_reference === entry.project);
      if (selectedCase) {
        setEditEntryCaseSearchTerm(`${selectedCase.case_reference} - ${selectedCase.company_name}`);
      } else {
        setEditEntryCaseSearchTerm(entry.project);
      }
    } else {
      setEditEntryCaseSearchTerm('');
    }
    // Ensure other search suggestions are hidden
    setShowAddEntryCaseSuggestions(false);
    setShowTimerCaseSuggestions(false);
  };

  const handleSaveEdit = async (id) => {
    const totalSeconds = (parseInt(newEntry.hours) || 0) * 3600 + (parseInt(newEntry.minutes) || 0) * 60;
    if (totalSeconds > 0 && newEntry.project && newEntry.task && newEntry.activity && validateNarrative(newEntry.narrative)) {
      try {
        await base44.entities.TimesheetEntry.update(id, {
          case_reference: newEntry.project,
          task_description: newEntry.task,
          activity: newEntry.activity,
          narrative: newEntry.narrative,
          duration_seconds: totalSeconds,
          billable: newEntry.billable
        });

        setTimeEntries(timeEntries.map(entry =>
          entry.id === id
            ? {
              ...entry,
              project: newEntry.project,
              task: newEntry.task,
              description: newEntry.activity,
              activity: newEntry.activity,
              narrative: newEntry.narrative,
              duration: totalSeconds,
              billable: newEntry.billable
            }
            : entry
        ));
        setEditingEntry(null);
        setNewEntry({ project: '', task: '', activity: '', narrative: '', hours: '', minutes: '', billable: true });
        setEditEntryCaseSearchTerm(''); // Clear specific search term
        setShowEditEntryCaseSuggestions(false); // Hide specific suggestions
      } catch (error) {
        console.error('Error updating entry:', error);
        alert('Failed to update entry');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingEntry(null);
    setNewEntry({ project: '', task: '', activity: '', narrative: '', hours: '', minutes: '', billable: true });
    setEditEntryCaseSearchTerm(''); // Clear specific search term
    setShowEditEntryCaseSuggestions(false); // Hide specific suggestions
  };

  const handleSubmitForApproval = async () => {
    // Get the start and end of the current week (Monday to Sunday)
    const startOfWeek = new Date(selectedDate);
    const currentDay = startOfWeek.getDay() === 0 ? 7 : startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - currentDay + 1);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get all draft entries for the entire week (Monday to Sunday)
    const draftEntries = timeEntries.filter(entry => {
      if (entry.status !== 'draft') return false;
      const entryDate = new Date(entry.date + 'T12:00:00');
      return entryDate >= startOfWeek && entryDate <= endOfWeek;
    });

    if (draftEntries.length === 0) {
      alert('No draft entries to submit for this week.');
      return;
    }

    // Check hours for Monday to Friday using same logic as UI display
    const weekdayHours = [];
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 5; i++) {
      // Use same date calculation as UI to ensure consistency - work in local date strings
      const dayDate = new Date(selectedDate);
      const currentDayOfWeekNormalized = dayDate.getDay() === 0 ? 7 : dayDate.getDay();
      const targetDayOfWeek = i + 1; // Monday = 1, Friday = 5
      const diffDays = targetDayOfWeek - currentDayOfWeekNormalized;
      dayDate.setDate(dayDate.getDate() + diffDays);
      dayDate.setHours(0, 0, 0, 0);

      // Only validate for past and current weekdays
      if (dayDate <= today) {
        // Create date string in local timezone to match stored entries
        const yearDay = dayDate.getFullYear();
        const monthDay = String(dayDate.getMonth() + 1).padStart(2, '0');
        const dayDay = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${yearDay}-${monthDay}-${dayDay}`;

        const dayEntries = timeEntries.filter(entry => entry.date === dateStr);
        const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.duration, 0);
        // Use same rounding logic as display for consistent validation
        const dayHours = Math.floor((dayTotal / 3600) * 100) / 100;

        weekdayHours.push({
          day: daysOfWeek[i],
          date: dayDate,
          hours: dayHours
        });
      }
    }

    // IP grades have no daily/weekly time requirements
    if (currentUser?.grade === 'IP') {
      // No validation for IPs - they can submit any amount of time
    } else if (currentUser?.grade === 'Case Admin' || currentUser?.grade === 'Manager') {
      // For Case Admin and Manager users, require exactly 7.00 hours or more per day
      const incompleteDays = weekdayHours.filter(day => day.hours < 7.0);

      // Check total hours for the week
      const totalWeekdayHours = weekdayHours.reduce((sum, day) => sum + day.hours, 0);

      if (incompleteDays.length > 0) {
        console.log('=== VALIDATION DEBUG ===');
        console.log('Weekday hours:', weekdayHours);
        console.log('Incomplete days:', incompleteDays);
        console.log('All time entries:', timeEntries);
        console.log('Selected date:', selectedDate);
        console.log('========================');

        const daysList = incompleteDays
          .map(day => `${day.day} (${day.hours.toFixed(1)}h)`)
          .join('\n');

        alert(
          `Cannot submit timesheet.\n\n` +
          `You must complete at least 7 hours for each weekday (Monday-Friday) that has passed or is current.\n\n` +
          `The following days have less than 7 hours:\n${daysList}`
        );
        return;
      }
      
      if (totalWeekdayHours < 35) {
        alert(
          `Cannot submit timesheet.\n\n` +
          `You must complete at least 35 hours in total for the week (Monday-Friday) before submitting.\n\n` +
          `Current total: ${totalWeekdayHours.toFixed(2)} hours`
        );
        return;
      }
    } else {
      // For other users, require exactly 7.00 hours or more per day
      const incompleteDays = weekdayHours.filter(day => day.hours < 7.0);

      if (incompleteDays.length > 0) {
        const daysList = incompleteDays
          .map(day => `${day.day} (${day.hours.toFixed(1)}h)`)
          .join('\n');
        
        alert(
          `Cannot submit timesheet.\n\n` +
          `You must complete at least 7 hours for each weekday (Monday-Friday) that has passed or is current.\n\n` +
          `The following days have less than 7 hours:\n${daysList}`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      for (const entry of draftEntries) {
        await base44.entities.TimesheetEntry.update(entry.id, {
          status: 'submitted',
          submitted_date: new Date().toISOString()
        });
      }

      setTimeEntries(prevEntries => prevEntries.map(entry =>
        draftEntries.some(draft => draft.id === entry.id)
          ? { ...entry, status: 'submitted' }
          : entry
      ));

      alert(`Successfully submitted ${draftEntries.length} timesheet ${draftEntries.length === 1 ? 'entry' : 'entries'} for the week.`);
    } catch (error) {
      console.error('Error submitting timesheets:', error);
      alert('Failed to submit timesheets for approval.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const changeWeek = (weeks) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (weeks * 7));
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const getTotalHours = () => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const total = timeEntries
      .filter(entry => entry.date === selectedDateStr)
      .reduce((sum, entry) => sum + entry.duration, 0);
    return (total / 3600).toFixed(2);
  };

  const formatSelectedDate = () => {
    const today = new Date().toDateString();
    const selected = selectedDate.toDateString();
    if (today === selected) return 'Today';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday.toDateString() === selected) return 'Yesterday';

    return selectedDate.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Handlers for the searchable case selector
  const handleTimerCaseSelect = (caseRef) => {
    setTimerProject(caseRef);
    setTimerBillable(caseRef !== "Non Chargeable");
    setTimerCaseSearchTerm(caseRef === "Non Chargeable" ? "Non Chargeable" : (cases.find(c => c.case_reference === caseRef)?.company_name ? `${caseRef} - ${cases.find(c => c.case_reference === caseRef).company_name}` : caseRef));
    setShowTimerCaseSuggestions(false);
  };

  const handleAddEntryCaseSelect = (caseRef) => {
    setNewEntry(prev => ({
      ...prev,
      project: caseRef,
      billable: caseRef !== "Non Chargeable"
    }));
    setAddEntryCaseSearchTerm(caseRef === "Non Chargeable" ? "Non Chargeable" : (cases.find(c => c.case_reference === caseRef)?.company_name ? `${caseRef} - ${cases.find(c => c.case_reference === caseRef).company_name}` : caseRef));
    setShowAddEntryCaseSuggestions(false);
  };

  const handleEditEntryCaseSelect = (caseRef) => {
    setNewEntry(prev => ({
      ...prev,
      project: caseRef,
      billable: caseRef !== "Non Chargeable"
    }));
    setEditEntryCaseSearchTerm(caseRef === "Non Chargeable" ? "Non Chargeable" : (cases.find(c => c.case_reference === caseRef)?.company_name ? `${caseRef} - ${cases.find(c => c.case_reference === caseRef).company_name}` : caseRef));
    setShowEditEntryCaseSuggestions(false);
  };


  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const todayEntries = timeEntries.filter(entry => entry.date === selectedDateStr);

  // Calculate submitted entries for the current week
  const getWeekSubmittedEntries = () => {
    const startOfWeek = new Date(selectedDate);
    const currentDay = startOfWeek.getDay() === 0 ? 7 : startOfWeek.getDay(); // Adjust Sunday to be 7th day
    startOfWeek.setDate(startOfWeek.getDate() - currentDay + 1); // Go to Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // Go to Sunday of the same week
    endOfWeek.setHours(23, 59, 59, 999);

    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date + 'T12:00:00');
      return entry.status === 'submitted' && entryDate >= startOfWeek && entryDate <= endOfWeek;
    });
  };

  // Get all submitted timesheets grouped by week
  const getAllSubmittedByWeek = () => {
    const submitted = timeEntries.filter(entry => entry.status === 'submitted' || entry.status === 'approved' || entry.status === 'rejected');
    const weeklyGroups = {};

    submitted.forEach(entry => {
      const entryDate = new Date(entry.date + 'T12:00:00');
      const day = entryDate.getDay() === 0 ? 7 : entryDate.getDay();
      const monday = new Date(entryDate);
      monday.setDate(entryDate.getDate() - day + 1);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const weekKey = monday.toISOString().split('T')[0];
      
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = {
          startDate: monday,
          endDate: sunday,
          entries: [],
          totalHours: 0,
          billableHours: 0
        };
      }
      
      weeklyGroups[weekKey].entries.push(entry);
      const hours = entry.duration / 3600;
      weeklyGroups[weekKey].totalHours += hours;
      if (entry.billable) {
        weeklyGroups[weekKey].billableHours += hours;
      }
    });

    // Sort by week start date descending (most recent first)
    return Object.entries(weeklyGroups).sort((a, b) => 
      new Date(b[0]) - new Date(a[0])
    );
  };

  const weekSubmittedEntries = getWeekSubmittedEntries();
  const weekSubmittedHours = weekSubmittedEntries.reduce((sum, entry) => sum + entry.duration, 0) / 3600;

  return (
    <div className="min-h-screen p-6 md:p-8 bg-slate-50">
      <div className="max-w-none mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-700" />
            <div>
              <h1 className="text-3xl font-bold font-display text-slate-900">Timesheets</h1>
              <p className="text-xs text-slate-500 mt-1">
                Time is recorded in 6 min intervals / Task narrative must be completed
              </p>
              {timesheetTasks.length === 0 && !isLoadingTasks && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ No tasks configured. Please save tasks in Settings → Timesheet Settings.
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Current Time</p>
            <p className="text-2xl font-mono font-bold text-slate-900">
              {currentTime.toLocaleTimeString('en-GB')}
            </p>
          </div>
        </div>

        {/* Date Navigation */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => changeDate(-1)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => changeDate(1)}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <span className="text-xl font-semibold text-slate-900">
                  {formatSelectedDate() === 'Today' ? 'Today: ' : ''}
                  {selectedDate.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short'
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="h-8"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Today
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowGuide(true)}
                  className="h-8 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Guide
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => changeWeek(-1)}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium text-slate-600 px-2">Week</span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => changeWeek(1)}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Week Summary Row */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex gap-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                  const dayDate = new Date(selectedDate);
                  const currentDayOfWeekNormalized = dayDate.getDay() === 0 ? 7 : dayDate.getDay();
                  const targetDayOfWeek = index + 1;
                  const diffDays = targetDayOfWeek - currentDayOfWeekNormalized;
                  dayDate.setDate(dayDate.getDate() + diffDays);

                  const dayEntries = timeEntries.filter(
                    entry => entry.date === dayDate.toISOString().split('T')[0]
                  );
                  const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.duration, 0);
                  const dayHours = (Math.floor((dayTotal / 3600) * 100) / 100).toFixed(2);
                  const isToday = dayDate.toDateString() === new Date().toDateString();
                  const isSelectedDay = dayDate.toDateString() === selectedDate.toDateString();

                  const isWeekday = index < 5;
                  let hoursColor = 'text-slate-900';
                  if (isWeekday) {
                    if (parseFloat(dayHours) >= 7.0) {
                      hoursColor = 'text-green-600';
                    } else if (parseFloat(dayHours) > 0 && parseFloat(dayHours) < 7.0) {
                      hoursColor = 'text-red-600';
                    }
                  }

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(dayDate)}
                      className={`text-center rounded-lg min-w-[70px] px-4 py-3 transition-all cursor-pointer hover:bg-blue-50 ${
                        index >= 5 ? 'bg-orange-50' : ''
                      } ${isSelectedDay ? 'border-4 border-black shadow-lg' : 'border border-transparent'}`}
                    >
                      <div className="text-base font-medium text-blue-600">
                        {day} {dayDate.getDate()}
                      </div>
                      <div className={`text-lg font-semibold ${isToday && !isWeekday ? 'text-blue-700' : hoursColor}`}>
                        {dayHours}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="text-right">
                <div className="text-center">
                  <div className="text-base font-medium text-slate-600">Week total</div>
                  <div className="text-xl font-semibold text-slate-900">
                    {(() => {
                      const startOfWeek = new Date(selectedDate);
                      const currentDay = startOfWeek.getDay() === 0 ? 7 : startOfWeek.getDay();
                      startOfWeek.setDate(startOfWeek.getDate() - currentDay + 1);

                      let weekTotal = 0;
                      for (let i = 0; i < 7; i++) {
                        const checkDate = new Date(startOfWeek);
                        checkDate.setDate(checkDate.getDate() + i);
                        const dateStr = checkDate.toISOString().split('T')[0];
                        const dayEntries = timeEntries.filter(entry => entry.date === dateStr);
                        weekTotal += dayEntries.reduce((sum, entry) => sum + entry.duration, 0);
                      }
                      return (Math.floor((weekTotal / 3600) * 100) / 100).toFixed(2);
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* NEW HISTORY BUTTON */}
                <Button
                  variant="outline"
                  className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100 hover:border-purple-300"
                  onClick={() => setShowHistorySection(!showHistorySection)}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  History
                  {weekSubmittedEntries.length > 0 && (
                    <Badge className="ml-2 bg-purple-600 text-white">
                      {weekSubmittedEntries.length}
                    </Badge>
                  )}
                </Button>

                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmitForApproval}
                  disabled={isSubmitting || (() => {
                    // Check if there are any draft entries for the current week
                    const startOfWeek = new Date(selectedDate);
                    const currentDay = startOfWeek.getDay() === 0 ? 7 : startOfWeek.getDay();
                    startOfWeek.setDate(startOfWeek.getDate() - currentDay + 1);
                    startOfWeek.setHours(0, 0, 0, 0);

                    const endOfWeek = new Date(startOfWeek);
                    endOfWeek.setDate(endOfWeek.getDate() + 6);
                    endOfWeek.setHours(23, 59, 59, 999);

                    const weekDraftEntries = timeEntries.filter(entry => {
                      if (entry.status !== 'draft') return false;
                      const entryDate = new Date(entry.date + 'T12:00:00');
                      return entryDate >= startOfWeek && entryDate <= endOfWeek;
                    });

                    return weekDraftEntries.length === 0;
                  })()}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Week for Approval'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Conditionally render Timer Card and Manual Entry Form */}
        {!showHistorySection && (
          <>
            {/* Timer Card - Restructured */}
            <Card className="mb-6 border-2 border-blue-200 shadow-lg">
              <CardContent className="p-6">
                {/* Row 1: Timer Display and Controls */}
                <div className="flex items-center justify-center gap-8 mb-6 pb-6 border-b border-slate-200">
                  {/* Timer Display */}
                  <div className="text-center">
                    <p className="text-4xl font-mono font-bold text-slate-900 min-w-[160px]">
                      {formatTime(timerSeconds)}
                    </p>
                  </div>

                  {/* Timer Controls */}
                  <div className="flex gap-2">
                    {!isTimerRunning ? (
                      <Button
                        onClick={startTimer}
                        className="bg-green-600 hover:bg-green-700"
                        size="lg"
                        disabled={!timerProject || !timerTask || !timerActivity}
                      >
                        <Play className="w-5 h-5" />
                      </Button>
                    ) : (
                      <Button
                        onClick={pauseTimer}
                        className="bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        <Pause className="w-5 h-5" />
                      </Button>
                    )}

                    <Button
                      onClick={stopTimer}
                      variant="destructive"
                      size="lg"
                      disabled={timerSeconds === 0 || !isTimerRunning}
                    >
                      <Square className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Manual Time Entry and Submission */}
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      value={manualTime}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setManualTime('');
                          return;
                        }
                        if (value.startsWith('-') || parseFloat(value) < 0) {
                          return;
                        }
                        const decimalParts = value.split('.');
                        if (decimalParts.length === 2 && decimalParts[1] !== undefined && decimalParts[1].length > 1) {
                          return;
                        }
                        if (decimalParts.length > 2) {
                          return;
                        }
                        setManualTime(value);
                      }}
                      className="w-28 text-center text-2xl font-semibold"
                      disabled={isTimerRunning}
                      min="0"
                    />
                    <span className="text-sm text-slate-500">hours</span>
                    <Button
                      onClick={handleManualTimeSubmit}
                      disabled={
                        isTimerRunning ||
                        (!manualTime && timerSeconds === 0) ||
                        !timerProject ||
                        !timerTask ||
                        !timerActivity ||
                        !validateNarrative(timerNarrative)
                      }
                      className="bg-blue-600 hover:bg-blue-700"
                      size="sm"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Row 2: Task Details */}
                <div className="space-y-3">
                  {/* Dropdowns Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Case Dropdown - Searchable */}
                    <div className="relative" ref={timerCaseSearchRef}>
                      <Input
                        placeholder={isLoadingCases ? "Loading cases..." : "Search case..."}
                        value={timerCaseSearchTerm}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTimerCaseSearchTerm(value);
                          if (!value) {
                            setTimerProject('');
                            setTimerBillable(true);
                          }
                        }}
                        onFocus={() => setShowTimerCaseSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowTimerCaseSuggestions(false), 100)}
                        disabled={isTimerRunning || isLoadingCases}
                        className={`w-full ${timerProject ? 'text-blue-600 font-medium' : ''}`}
                      />

                      {showTimerCaseSuggestions && !isTimerRunning && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                          <div
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-200"
                            onMouseDown={() => handleTimerCaseSelect("Non Chargeable")}
                          >
                            <span className="font-semibold">Non Chargeable</span>
                          </div>
                          {getFilteredCases(timerCaseSearchTerm).map((case_) => (
                            <div
                              key={case_.id}
                              className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                              onMouseDown={() => handleTimerCaseSelect(case_.case_reference)}
                            >
                              <div className="font-medium text-slate-900">{case_.case_reference}</div>
                              <div className="text-sm text-slate-600">{case_.company_name}</div>
                              {!case_.appointment_date && (
                                <span className="ml-2 text-xs text-amber-600">(Pipeline)</span>
                              )}
                            </div>
                          ))}
                          {getFilteredCases(timerCaseSearchTerm).length === 0 && timerCaseSearchTerm.trim() !== '' && (
                            <div className="px-4 py-2 text-sm text-slate-500">
                              No cases found matching "{timerCaseSearchTerm}"
                            </div>
                          )}
                          {getFilteredCases(timerCaseSearchTerm).length === 0 && timerCaseSearchTerm.trim() === '' && (
                            <div className="px-4 py-2 text-sm text-slate-500">
                              Start typing to search cases
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Task Dropdown */}
                    <Select
                      value={timerTask}
                      onValueChange={(value) => {
                        setTimerTask(value);
                        setTimerActivity('');
                      }}
                      disabled={isTimerRunning || isLoadingTasks}
                    >
                      <SelectTrigger className={`whitespace-normal text-left ${timerTask ? 'text-blue-600 font-medium' : ''}`}>
                        <SelectValue placeholder={isLoadingTasks ? "Loading..." : "Task"} />
                      </SelectTrigger>
                      <SelectContent className="max-w-md">
                        {isLoadingTasks ? (
                          <div className="p-2 text-xs text-slate-500">Loading tasks...</div>
                        ) : getFilteredTaskCategories(timerProject, selectedDate).length === 0 ? (
                          <div className="p-2 text-xs text-red-600">
                            No tasks available for this case and date.
                          </div>
                        ) : (
                          getFilteredTaskCategories(timerProject, selectedDate).map((category) => (
                            <SelectItem key={category} value={category} className="whitespace-normal">
                              {getCategoryDisplayName(category)}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Activity Dropdown */}
                    <Select
                      value={timerActivity}
                      onValueChange={(value) => {
                        setTimerActivity(value);
                      }}
                      disabled={isTimerRunning || !timerTask || isLoadingTasks}
                    >
                      <SelectTrigger className={`whitespace-normal text-left ${timerActivity ? 'text-blue-600 font-medium' : ''}`}>
                        <SelectValue placeholder="Activity" />
                      </SelectTrigger>
                      <SelectContent className="max-w-md">
                        {!timerTask ? (
                          <div className="p-2 text-xs text-slate-500">
                            Please select a task first
                          </div>
                        ) : getActivitiesForTask(timerTask).length === 0 ? (
                          <div className="p-2 text-xs text-slate-500">
                            No activities for this task
                          </div>
                        ) : (
                          getActivitiesForTask(timerTask).map((task) => (
                            <SelectItem key={task.id} value={task.activity} className="whitespace-normal">
                              {task.activity}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Narrative Row */}
                  <Textarea
                    placeholder="Narrative (minimum 10 words)"
                    value={timerNarrative}
                    onChange={(e) => setTimerNarrative(e.target.value)}
                    disabled={isTimerRunning}
                    className="resize-none h-8 text-lg"
                    rows={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Manual Entry Form */}
            {showAddEntry && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <Card className="w-full max-w-2xl">
                  <CardHeader>
                    <CardTitle>Add Time Entry</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Case Dropdown - Now Searchable */}
                        <div className="relative" ref={addEntryCaseSearchRef}>
                          <Input
                            placeholder={isLoadingCases ? "Loading cases..." : "Search case..."}
                            value={addEntryCaseSearchTerm}
                            onChange={(e) => {
                              const value = e.target.value;
                              setAddEntryCaseSearchTerm(value);
                              if (!value) {
                                setNewEntry(prev => ({ ...prev, project: '', billable: true }));
                              }
                            }}
                            onFocus={() => setShowAddEntryCaseSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowAddEntryCaseSuggestions(false), 100)}
                            disabled={isLoadingCases}
                            className="w-full"
                          />

                          {showAddEntryCaseSuggestions && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                              <div
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-200"
                                onMouseDown={() => handleAddEntryCaseSelect("Non Chargeable")}
                              >
                                <span className="font-semibold">Non Chargeable</span>
                              </div>
                              {getFilteredCases(addEntryCaseSearchTerm).map((case_) => (
                                <div
                                  key={case_.id}
                                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                                  onMouseDown={() => handleAddEntryCaseSelect(case_.case_reference)}
                                >
                                  <div className="font-medium text-slate-900">{case_.case_reference}</div>
                                  <div className="text-sm text-slate-600">{case_.company_name}</div>
                                  {!case_.appointment_date && (
                                    <span className="ml-2 text-xs text-amber-600">(Pipeline)</span>
                                  )}
                                </div>
                              ))}
                              {getFilteredCases(addEntryCaseSearchTerm).length === 0 && addEntryCaseSearchTerm.trim() !== '' && (
                                <div className="px-4 py-2 text-sm text-slate-500">
                                  No cases found matching "{addEntryCaseSearchTerm}"
                                </div>
                              )}
                              {getFilteredCases(addEntryCaseSearchTerm).length === 0 && addEntryCaseSearchTerm.trim() === '' && (
                                <div className="px-4 py-2 text-sm text-slate-500">
                                  Start typing to search cases
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Task Dropdown */}
                        <Select
                          value={newEntry.task}
                          onValueChange={(value) => {
                            setNewEntry({...newEntry, task: value, activity: ''});
                          }}
                          disabled={isLoadingTasks}
                        >
                          <SelectTrigger className="whitespace-normal text-left">
                            <SelectValue placeholder={isLoadingTasks ? "Loading..." : "Task"} />
                          </SelectTrigger>
                          <SelectContent className="max-w-md">
                            {isLoadingTasks ? (
                              <div className="p-2 text-xs text-slate-500">Loading tasks...</div>
                            ) : getFilteredTaskCategories(newEntry.project, selectedDate).length === 0 ? (
                              <div className="p-2 text-xs text-slate-500">
                                No tasks available for this case and date.
                              </div>
                            ) : (
                              getFilteredTaskCategories(newEntry.project, selectedDate).map((category) => (
                                <SelectItem key={category} value={category} className="whitespace-normal">
                                  {getCategoryDisplayName(category)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        {/* Activity Dropdown */}
                        <Select
                          value={newEntry.activity}
                          onValueChange={(value) => setNewEntry({...newEntry, activity: value})}
                          disabled={!newEntry.task || isLoadingTasks}
                        >
                          <SelectTrigger className="whitespace-normal text-left">
                            <SelectValue placeholder="Activity" />
                          </SelectTrigger>
                          <SelectContent className="max-w-md">
                            {!newEntry.task ? (
                              <div className="p-2 text-xs text-slate-500">
                                Please select a task first
                              </div>
                            ) : getActivitiesForTask(newEntry.task).length === 0 ? (
                              <div className="p-2 text-xs text-slate-500">
                                No activities for this task
                              </div>
                            ) : (
                              getActivitiesForTask(newEntry.task).map((task) => (
                                <SelectItem key={task.id} value={task.activity} className="whitespace-normal">
                                  {task.activity}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        {/* Time Inputs */}
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            placeholder="Hours"
                            value={newEntry.hours}
                            onChange={(e) => setNewEntry({...newEntry, hours: e.target.value})}
                            min="0"
                            className="w-20"
                          />
                          <span className="flex items-center text-slate-500">:</span>
                          <Input
                            type="number"
                            placeholder="Min"
                            value={newEntry.minutes}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || (parseInt(value) % 6 === 0 && parseInt(value) >= 0 && parseInt(value) <= 54)) {
                                setNewEntry({...newEntry, minutes: value});
                              }
                            }}
                            min="0"
                            max="54"
                            step="6"
                            className="w-20"
                          />
                        </div>
                      </div>

                      {/* Narrative - Full Width Below */}
                      <Textarea
                        placeholder="Narrative (minimum 10 words)"
                        value={newEntry.narrative}
                        onChange={(e) => setNewEntry({...newEntry, narrative: e.target.value})}
                        className="resize-none"
                        rows={3}
                      />

                      <div className="flex justify-end gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddEntry(false);
                            setNewEntry({ project: '', task: '', activity: '', narrative: '', hours: '', minutes: '', billable: true });
                            setAddEntryCaseSearchTerm(''); // Clear specific search term
                            setShowAddEntryCaseSuggestions(false); // Hide specific suggestions
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddManualEntry}
                          className="bg-blue-600 hover:bg-blue-700"
                          disabled={
                            !newEntry.project ||
                            !newEntry.task ||
                            !newEntry.activity ||
                            !validateNarrative(newEntry.narrative) ||
                            (!newEntry.hours && !newEntry.minutes) ||
                            (parseFloat(newEntry.hours) === 0 && parseFloat(newEntry.minutes) === 0)
                          }
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Entry
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {/* Conditionally render either History or Time Entries */}
        {showHistorySection ? (
          /* Submitted Timesheets History Section */
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Submitted Timesheets History</CardTitle>
                  <p className="text-sm text-slate-500 mt-1">All weeks with submitted timesheets</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowHistorySection(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Close History
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {getAllSubmittedByWeek().length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No submitted timesheets</h3>
                  <p className="text-slate-500">Submitted timesheets will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getAllSubmittedByWeek().map(([weekKey, weekData]) => (
                    <div key={weekKey} className="p-4 border border-slate-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-slate-900 text-base">
                            {weekData.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {weekData.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          <div className="text-sm text-slate-600 mt-1">
                            {weekData.entries.length} {weekData.entries.length === 1 ? 'entry' : 'entries'} submitted
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-purple-700">
                            {weekData.totalHours.toFixed(1)}h
                          </div>
                          <div className="flex gap-2 text-xs mt-1">
                            <Badge className="bg-green-100 text-green-800">
                              Billable: {weekData.billableHours.toFixed(1)}h
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Non-bill: {(weekData.totalHours - weekData.billableHours).toFixed(1)}h
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      {/* Entry Details */}
                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-200">
                        {weekData.entries.map(entry => {
                          const caseData = cases.find(c => c.case_reference === entry.project);
                          const caseName = entry.project === "Non Chargeable" ? "Non Chargeable" : (caseData?.company_name || entry.project);
                          
                          return (
                            <div key={entry.id} className="flex items-start gap-3 text-sm bg-slate-50 p-3 rounded border border-slate-100">
                              <div className="text-slate-500 min-w-[70px] font-medium">
                                {new Date(entry.date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                              </div>
                              <div className="flex-1">
                                <div className="font-semibold text-slate-900">{caseName}</div>
                                <div className="text-slate-600 text-xs mt-0.5">{entry.activity}</div>
                              </div>
                              <div className="text-right min-w-[80px]">
                                <div className="font-mono font-semibold text-slate-900">
                                  {formatDuration(entry.duration)}
                                </div>
                                {entry.billable && (
                                  <Badge className="bg-green-100 text-green-700 text-[10px] mt-1">Billable</Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Time Entries List */
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {todayEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-600 mb-2">No time entries</h3>
                  <p className="text-slate-500">Start the timer or add a time entry to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-blue-50 hover:bg-blue-50">
                        <TableHead className="font-semibold w-[110px] text-indigo-700">Case Ref</TableHead>
                        <TableHead className="font-semibold w-[180px] text-indigo-700">Case Name</TableHead>
                        <TableHead className="font-semibold w-[340px] text-indigo-700">Task</TableHead>
                        <TableHead className="font-semibold w-[180px] text-indigo-700">Activity</TableHead>
                        <TableHead className="font-semibold text-indigo-700">Narrative</TableHead>
                        <TableHead className="font-semibold text-right w-[90px] text-indigo-700">Time</TableHead>
                        <TableHead className="font-semibold text-right w-[110px] text-indigo-700">Cost</TableHead>
                        <TableHead className="font-semibold text-center w-[140px] text-indigo-700">Status</TableHead>
                        <TableHead className="font-semibold text-center w-[100px] text-indigo-700">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayEntries.map((entry) => {
                        const caseData = cases.find(c => c.case_reference === entry.project);
                        const caseName = entry.project === "Non Chargeable" ? "—" : (caseData?.company_name || '—');

                        return editingEntry === entry.id ? (
                          <TableRow key={entry.id}>
                            <TableCell colSpan={9} className="p-4 bg-slate-50">
                              <div className="space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                  {/* Case Dropdown (Edit Mode) - Now Searchable */}
                                  <div className="relative" ref={editEntryCaseSearchRef}>
                                    <Input
                                      placeholder={isLoadingCases ? "Loading cases..." : "Search case..."}
                                      value={editEntryCaseSearchTerm}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setEditEntryCaseSearchTerm(value);
                                        if (!value) {
                                          setNewEntry(prev => ({ ...prev, project: '', billable: true }));
                                        }
                                      }}
                                      onFocus={() => setShowEditEntryCaseSuggestions(true)}
                                      onBlur={() => setTimeout(() => setShowEditEntryCaseSuggestions(false), 100)}
                                      disabled={isLoadingCases}
                                      className="w-full"
                                    />

                                    {showEditEntryCaseSuggestions && (
                                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                        <div
                                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b border-slate-200"
                                          onMouseDown={() => handleEditEntryCaseSelect("Non Chargeable")}
                                        >
                                          <span className="font-semibold">Non Chargeable</span>
                                        </div>
                                        {getFilteredCases(editEntryCaseSearchTerm).map((case_) => (
                                          <div
                                            key={case_.id}
                                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                                            onMouseDown={() => handleEditEntryCaseSelect(case_.case_reference)}
                                          >
                                            <div className="font-medium text-slate-900">{case_.case_reference}</div>
                                            <div className="text-sm text-slate-600">{case_.company_name}</div>
                                            {!case_.appointment_date && (
                                              <span className="ml-2 text-xs text-amber-600">(Pipeline)</span>
                                            )}
                                          </div>
                                        ))}
                                        {getFilteredCases(editEntryCaseSearchTerm).length === 0 && editEntryCaseSearchTerm.trim() !== '' && (
                                          <div className="px-4 py-2 text-sm text-slate-500">
                                            No cases found matching "{editEntryCaseSearchTerm}"
                                          </div>
                                        )}
                                        {getFilteredCases(editEntryCaseSearchTerm).length === 0 && editEntryCaseSearchTerm.trim() === '' && (
                                          <div className="px-4 py-2 text-sm text-slate-500">
                                            Start typing to search cases
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <Select
                                    value={newEntry.task}
                                    onValueChange={(value) => {
                                      setNewEntry({...newEntry, task: value, activity: ''});
                                    }}
                                    disabled={isLoadingTasks}
                                  >
                                    <SelectTrigger className="whitespace-normal text-left">
                                      <SelectValue placeholder={isLoadingTasks ? "Loading..." : "Task"} />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-md">
                                      {isLoadingTasks ? (
                                        <div className="p-2 text-xs text-slate-500">Loading tasks...</div>
                                      ) : getFilteredTaskCategories(newEntry.project, selectedDate).length === 0 ? (
                                        <div className="p-2 text-xs text-slate-500">
                                          No tasks available for this case and date.
                                        </div>
                                      ) : (
                                        getFilteredTaskCategories(newEntry.project, selectedDate).map((category) => (
                                          <SelectItem key={category} value={category} className="whitespace-normal">
                                            {getCategoryDisplayName(category)}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>

                                  <Select
                                    value={newEntry.activity}
                                    onValueChange={(value) => setNewEntry({...newEntry, activity: value})}
                                    disabled={!newEntry.task || isLoadingTasks}
                                  >
                                    <SelectTrigger className="whitespace-normal text-left">
                                      <SelectValue placeholder="Activity" />
                                    </SelectTrigger>
                                    <SelectContent className="max-w-md">
                                      {!newEntry.task ? (
                                        <div className="p-2 text-xs text-slate-500">
                                          Please select a task first
                                        </div>
                                      ) : getActivitiesForTask(newEntry.task).length === 0 ? (
                                        <div className="p-2 text-xs text-slate-500">
                                          No activities for this task
                                        </div>
                                      ) : (
                                        getActivitiesForTask(newEntry.task).map((task) => (
                                          <SelectItem key={task.id} value={task.activity} className="whitespace-normal">
                                            {task.activity}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>

                                  <div className="flex gap-2">
                                    <Input
                                      type="number"
                                      placeholder="Hours"
                                      value={newEntry.hours}
                                      onChange={(e) => setNewEntry({...newEntry, hours: e.target.value})}
                                      min="0"
                                      className="w-20"
                                    />
                                    <span className="flex items-center text-slate-500">:</span>
                                    <Input
                                      type="number"
                                      placeholder="Min"
                                      value={newEntry.minutes}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '' || (parseInt(value) % 6 === 0 && parseInt(value) >= 0 && parseInt(value) <= 54)) {
                                          setNewEntry({...newEntry, minutes: value});
                                        }
                                      }}
                                      min="0"
                                      max="54"
                                      step="6"
                                      className="w-20"
                                    />
                                  </div>

                                  <div className="flex gap-2 items-center justify-end">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={() => handleSaveEdit(entry.id)}
                                      className="bg-green-600 hover:bg-green-700"
                                      disabled={
                                        !newEntry.project ||
                                        !newEntry.task ||
                                        !newEntry.activity ||
                                        !validateNarrative(newEntry.narrative) ||
                                        (!newEntry.hours && !newEntry.minutes) ||
                                        (parseFloat(newEntry.hours) === 0 && parseFloat(newEntry.minutes) === 0)
                                      }
                                    >
                                      <Save className="w-4 h-4 mr-2" />
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="w-4 h-4 mr-2" />
                                      Cancel
                                    </Button>
                                  </div>
                                </div>

                                <Textarea
                                  placeholder="Narrative (minimum 10 words)"
                                  value={newEntry.narrative}
                                  onChange={(e) => setNewEntry({...newEntry, narrative: e.target.value})}
                                  className="resize-none"
                                  rows={2}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          <TableRow key={entry.id} className="hover:bg-slate-50 border-b border-slate-200">
                            <TableCell className="font-mono text-sm font-semibold text-blue-700 py-3">
                              {entry.project}
                            </TableCell>
                            <TableCell className="text-sm font-medium text-slate-900 py-3">
                              {caseName}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700 py-3">
                              {getCategoryDisplayName(entry.task)}
                            </TableCell>
                            <TableCell className="text-sm text-slate-700 py-3">
                              {entry.activity}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600 py-3">
                              {entry.narrative || '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-semibold text-slate-900 py-3">
                              {formatDuration(entry.duration)}
                            </TableCell>
                            <TableCell className="text-right text-sm font-bold text-green-700 py-3">
                              {currentUser && formatCurrency(calculateEntryCost(entry))}
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex gap-1 items-center justify-start">
                                {entry.billable && (
                                  <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-2 py-0.5">
                                    Billable
                                  </Badge>
                                )}
                                {entry.status === 'draft' && (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs px-2 py-0.5">
                                    Draft
                                  </Badge>
                                )}
                                {entry.status === 'submitted' && (
                                  <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-xs px-2 py-0.5">
                                    Submitted
                                  </Badge>
                                )}
                                {entry.status === 'approved' && (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs px-2 py-0.5">
                                    Approved
                                  </Badge>
                                )}
                                {!entry.billable && entry.project === "Non Chargeable" && (
                                  <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-xs px-2 py-0.5">
                                    Non-Billable
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex gap-1 items-center justify-center">
                                {entry.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditEntry(entry)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                                {entry.status === 'draft' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteEntry(entry.id)}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                                {entry.status !== 'draft' && (
                                  <span className="text-xs text-slate-400 px-2">—</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Guide Modal */}
        <Dialog open={showGuide} onOpenChange={(open) => {
          setShowGuide(open);
          if (open && uniqueTaskCategories.length > 0 && !selectedGuideCategory) {
            setSelectedGuideCategory(uniqueTaskCategories[0]);
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[85vh] p-0">
            {uniqueTaskCategories.length === 0 ? (
              <div className="text-center py-12 text-slate-500 px-6">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-600 mb-2">No tasks configured</h3>
                <p className="text-slate-500">Please configure tasks in Settings → Timesheet Settings</p>
              </div>
            ) : (
              <div className="flex h-[85vh]">
                {/* Left Sidebar - Task Categories */}
                <div className="w-80 border-r border-slate-200 bg-slate-50">
                  <div className="px-4 py-3 border-b border-slate-300 bg-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Task</h3>
                  </div>
                  <ScrollArea className="h-[calc(100%-57px)]">
                    <div className="p-2">
                      {uniqueTaskCategories.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedGuideCategory(category)}
                          className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-colors ${
                            selectedGuideCategory === category
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {getCategoryDisplayName(category)}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Right Pane - Activities */}
                <div className="flex-1">
                  <div className="px-6 py-3 border-b border-slate-300 bg-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Activity</h3>
                  </div>
                  <ScrollArea className="h-[calc(100%-57px)]">
                    <div className="p-6">
                      {selectedGuideCategory && (
                        <>
                          {(() => {
                            const activities = getActivitiesForTask(selectedGuideCategory);
                            return activities.length === 0 ? (
                              <p className="text-sm text-slate-500 italic">No activities configured for this task</p>
                            ) : (
                              <ul className="space-y-3">
                                {activities.map((task, index) => (
                                  <li key={task.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-b-0">
                                    <span className="font-mono text-sm text-blue-600 font-semibold mt-0.5">
                                      {(index + 1).toString().padStart(2, '0')}
                                    </span>
                                    <span className="text-slate-700 flex-1">{task.activity}</span>
                                  </li>
                                ))}
                              </ul>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}