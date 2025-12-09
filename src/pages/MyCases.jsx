import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Plus,
  Search,
  Filter,
  Building,
  Calendar,
  User as UserIcon,
  FileText,
  Eye,
  TrendingUp,
  Clock,
  CheckCircle,
  Briefcase,
  BarChart,
  AlertCircle,
  RefreshCw,
  BookOpen,
  X,
  Trash2,
  Paperclip,
  Download,
  ExternalLink,
  Undo2,
  ArrowUp,
  ArrowDown,
  Upload,
  Link2,
  Flag,
  Loader2,
  FolderOpen,
  Send,
  Save
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

import CaseDetailModal from "../components/dashboard/CaseDetailModal";

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80"
  >
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </motion.div>
);

// Task Detail Modal Component
function TaskDetailModal({ task, isOpen, onClose, onToggleComplete, onDelete }) {
  if (!task) return null;

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${task.completed ? 'bg-green-500' : 'bg-blue-500'}`}></div>
            Task Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Task Title */}
          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Title</label>
            <p className={`text-xl font-semibold mt-1 ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
              {task.task_title}
            </p>
          </div>

          {/* Task Description */}
          {task.task_description && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Description</label>
              <p className="text-slate-700 mt-1 whitespace-pre-wrap">{task.task_description}</p>
            </div>
          )}

          {/* Date and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Date</label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-slate-500" />
                <p className="text-slate-700">{formatDate(task.date)}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Priority</label>
              <div className="mt-1">
                <Badge className={`${getPriorityColor(task.priority)} capitalize border`}>
                  {task.priority}
                </Badge>
              </div>
            </div>
          </div>

          {/* Attachment */}
          {task.attachment_url && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Attachment</label>
              <a
                href={task.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 mt-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                <Paperclip className="w-4 h-4" />
                View PDF Document
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Status</label>
            <div className="mt-1">
              <Badge className={task.completed ? 'bg-green-100 text-green-800 border-green-300' : 'bg-slate-100 text-slate-800 border-slate-300'}>
                {task.completed ? 'Completed' : 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              onClick={() => {
                onToggleComplete(task.id, task.completed);
                onClose();
              }}
              className={`flex-1 ${
                task.completed
                  ? 'bg-slate-600 hover:bg-slate-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {task.completed ? 'Mark as Pending' : 'Mark as Complete'}
            </Button>

            <Button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                  onClose();
                }
              }}
              variant="destructive"
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MyCases() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const isMountedRef = useRef(true);
  const [showDiariesPanel, setShowDiariesPanel] = useState(false);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [isLoadingDiaries, setIsLoadingDiaries] = useState(false);
  const [activeDiaryTab, setActiveDiaryTab] = useState('upcoming');

  // New state for user selection
  const [selectedUserEmail, setSelectedUserEmail] = useState('');

  // New state for To Do List
  const [showToDoPanel, setShowToDoPanel] = useState(false);
  const [toDoTasks, setToDoTasks] = useState([]);
  const [isLoadingToDos, setIsLoadingToDos] = useState(false);
  const [selectedWeekStart, setSelectedWeekStart] = useState(null);
  const [toDoViewMode, setToDoViewMode] = useState('week'); // 'day', 'week' or 'month'
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedWeekDay, setSelectedWeekDay] = useState(null);
  const [selectedDay, setSelectedDay] = useState(new Date());

  // New state for Intray
  const [showIntrayPanel, setShowIntrayPanel] = useState(false);
  const [intrayTasks, setIntrayTasks] = useState([]);
  const [isLoadingIntray, setIsLoadingIntray] = useState(false);
  const [activeIntrayTab, setActiveIntrayTab] = useState('post_to_action');
  const [showAddIntrayForm, setShowAddIntrayForm] = useState(false);

  // New state for Post Tray
  const [showPostTrayPanel, setShowPostTrayPanel] = useState(false);
  const [selectedAdminFilter, setSelectedAdminFilter] = useState(null);

  // New state to track if cases view is shown
  const [showCasesView, setShowCasesView] = useState(true);

  // State for sorting - default to company name alphabetically
  const [sortBy, setSortBy] = useState('company_name');
  const [sortDirection, setSortDirection] = useState('asc');

  // New state for task detail modal
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);

  // New state for undo delete functionality
  const [deletedTask, setDeletedTask] = useState(null);
  const [deleteTimeout, setDeleteTimeout] = useState(null);

  // Check if user can select other users - using currentUser from local state
  const canSelectUsers = currentUser && (currentUser.grade === 'IP' || currentUser.grade === 'Manager');

  // Calculate intray statistics - for selected user's tasks
  const myIntrayStats = useMemo(() => {
    if (!currentUser) return { postToAction: 0, completed: 0, archived: 0 };
    
    const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;
    
    const myTasks = intrayTasks.filter(task => 
      task.user_email === targetEmail || task.assigned_to === targetEmail
    );
    
    const postToAction = myTasks.filter(task => task.status === 'post_to_action').length;
    const completed = myTasks.filter(task => task.status === 'completed').length;
    const archived = myTasks.filter(task => task.status === 'archived').length;
    
    return { postToAction, completed, archived };
  }, [intrayTasks, currentUser, canSelectUsers, selectedUserEmail]);

  // Calculate post tray statistics - ALL post_to_action tasks
  const postTrayStats = useMemo(() => {
    const postToAction = intrayTasks.filter(task => task.status === 'post_to_action').length;
    const archived = intrayTasks.filter(task => task.status === 'archived').length;
    return { postToAction, archived };
  }, [intrayTasks]);

  const loadData = useCallback(async (attempt = 0) => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    let willRetry = false;

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 30000)
      );

      const [casesData, userData, usersData] = await Promise.race([
        Promise.all([
          base44.entities.Case.list('-updated_date', 1000),
          base44.auth.me().catch(() => null),
          base44.entities.User.list().catch((error) => {
            console.warn('User.list() failed:', error);
            return [];
          })
        ]),
        timeoutPromise
      ]);

      if (isMountedRef.current) {
        setCases(casesData || []);
        setCurrentUser(userData);
        
        const userEmailsMap = new Map();
        
        if (userData) {
          userEmailsMap.set(userData.email, {
            email: userData.email,
            full_name: userData.full_name || userData.email,
            grade: userData.grade || 'Admin'
          });
        }

        if (casesData && casesData.length > 0) {
          console.log('Extracting users from case assignments...');
          
          casesData.forEach(case_ => {
            if (case_.assigned_user) {
              if (!userEmailsMap.has(case_.assigned_user)) {
                userEmailsMap.set(case_.assigned_user, {
                  email: case_.assigned_user,
                  full_name: case_.assigned_user.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  grade: 'Admin'
                });
              }
            }
            
            if (case_.manager_user) {
              if (!userEmailsMap.has(case_.manager_user)) {
                userEmailsMap.set(case_.manager_user, {
                  email: case_.manager_user,
                  full_name: case_.manager_user.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  grade: 'Manager'
                });
              }
            }
            
            if (case_.cashiering_user) {
              if (!userEmailsMap.has(case_.cashiering_user)) {
                userEmailsMap.set(case_.cashiering_user, {
                  email: case_.cashiering_user,
                  full_name: case_.cashiering_user.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  grade: 'Cashier'
                });
              }
            }
          });
        }

        if (usersData && usersData.length > 0) {
          console.log('Merging with User.list() data:', usersData.length, 'users');
          usersData.forEach(user => {
            if (user.email) {
              const existingUser = userEmailsMap.get(user.email);
              if (!existingUser || (user.full_name && existingUser.full_name.includes('@'))) {
                userEmailsMap.set(user.email, {
                  email: user.email,
                  full_name: user.full_name || user.email,
                  grade: user.grade || existingUser?.grade || 'Admin'
                });
              }
            }
          });
        }

        const finalUsers = Array.from(userEmailsMap.values());
        console.log('Final users list:', finalUsers.length, 'users');
        console.log('Users:', finalUsers.map(u => `${u.full_name} (${u.email}) - ${u.grade}`));
        
        setAllUsers(finalUsers);
        setRetryCount(0);
        
        if (!selectedUserEmail && userData) {
          setSelectedUserEmail(userData.email);
        }

        console.log('=== MY CASES DEBUG ===');
        console.log('Current user email:', userData?.email);
        console.log('Current user name:', userData?.full_name);
        console.log('Current user grade:', userData?.grade);
        console.log('Total cases loaded:', casesData?.length || 0);
        console.log('Total users available:', finalUsers.length);

        const assignedToCurrentUser = casesData?.filter(c => c.assigned_user === userData?.email) || [];
        console.log('Cases assigned to current user:', assignedToCurrentUser.length);

        if (assignedToCurrentUser.length > 0) {
          console.log('Assigned cases:', assignedToCurrentUser.map(c => ({
            company: c.company_name,
            reference: c.case_reference,
            assigned_user: c.assigned_user
          })));
        } else {
          console.log('Sample cases:', casesData?.slice(0, 3).map(c => ({
            company: c.company_name,
            reference: c.case_reference,
            assigned_user: c.assigned_user || 'NOT SET',
            manager_user: c.manager_user || 'NOT SET',
            cashiering_user: c.cashiering_user || 'NOT SET'
          })));
        }
        console.log('=== END DEBUG ===');
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error("Error loading data:", error);
        const errorMessage = error.message || "Failed to load data";
        setError(errorMessage);
        setRetryCount(attempt);

        if (attempt < 3) {
          willRetry = true;
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          setTimeout(() => {
            loadData(attempt + 1);
          }, delay);
        }
      }
    } finally {
      if (isMountedRef.current && !willRetry) {
        setIsLoading(false);
      }
    }
  }, [selectedUserEmail]);

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
        setSelectedCase(prev => ({ ...updatedSelectedCase, showDiary: prev?.showDiary }));
      }
    }
  }, [cases, selectedCase]);

  // Initialize selected week to current week
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setSelectedWeekStart(monday);
  }, []);

  // Load to-do tasks when component mounts or selected user changes
  useEffect(() => {
    const loadToDoTasks = async () => {
      if (!currentUser) {
        setToDoTasks([]);
        return;
      }

      setIsLoadingToDos(true);
      try {
        const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;
        const allTasks = await base44.entities.ToDoTask.list('-date', 500);
        const userTasks = allTasks.filter(task => task.user_email === targetEmail);

        setToDoTasks(userTasks);
      } catch (error) {
              console.error('Error loading to-do tasks:', error);
        setToDoTasks([]);
      } finally {
        setIsLoadingToDos(false);
      }
    };

    loadToDoTasks();
  }, [currentUser, selectedUserEmail, canSelectUsers]);

  // Load intray tasks when component mounts or selected user changes
  useEffect(() => {
    const loadIntrayTasks = async () => {
      if (!currentUser) {
        setIntrayTasks([]);
        return;
      }

      setIsLoadingIntray(true);
      try {
        const allTasks = await base44.entities.IntrayTask.list('-created_date', 500);
        
        // Always load all tasks, filtering will be done in the stats calculations
        setIntrayTasks(allTasks);
      } catch (error) {
        console.error('Error loading intray tasks:', error);
        setIntrayTasks([]);
      } finally {
        setIsLoadingIntray(false);
      }
    };

    loadIntrayTasks();
  }, [currentUser, selectedUserEmail, canSelectUsers, showPostTrayPanel]);

  // Modified myCases to use selected user
  const myCases = useMemo(() => {
    if (!currentUser) return [];

    const targetUserEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return cases.filter(case_ => {
      // Check if user is currently assigned to any primary role
      const isPrimaryRoleActive = 
        case_.assigned_user === targetUserEmail ||
        case_.manager_user === targetUserEmail ||
        case_.cashiering_user === targetUserEmail;
      
      if (isPrimaryRoleActive) return true;
      
      // Check if user is in additional_staff with active assignment
      if (case_.additional_staff && Array.isArray(case_.additional_staff)) {
        const isAdditionalStaff = case_.additional_staff.some(staff => {
          if (staff.email !== targetUserEmail) return false;
          
          // Check if assignment is active (no inactive_date or inactive_date is in the future)
          if (!staff.inactive_date) return true;
          
          const inactiveDate = new Date(staff.inactive_date);
          return inactiveDate > today;
        });
        
        if (isAdditionalStaff) return true;
      }
      
      return false;
    });
  }, [cases, currentUser, selectedUserEmail, canSelectUsers]);

  // Get selected user details for display
  const selectedUserDetails = useMemo(() => {
    if (!selectedUserEmail || !canSelectUsers) return null;
    return allUsers.find(u => u.email === selectedUserEmail);
  }, [selectedUserEmail, allUsers, canSelectUsers]);


  // Load diary entries when panel is opened
  useEffect(() => {
    const loadDiaries = async () => {
      if (!showDiariesPanel || myCases.length === 0) {
        setDiaryEntries([]);
        return;
      }

      setIsLoadingDiaries(true);
      try {
        const caseIds = myCases.map(c => c.id);
        const allDiaries = await base44.entities.CaseDiaryEntry.list('-deadline_date', 500);
        const userDiaries = allDiaries.filter(entry => caseIds.includes(entry.case_id));
        setDiaryEntries(userDiaries);
      } catch (error) {
        console.error('Error loading diary entries:', error);
        setDiaryEntries([]);
      } finally {
        setIsLoadingDiaries(false);
      }
    };

    loadDiaries();
  }, [showDiariesPanel, myCases]);

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

  const statistics = useMemo(() => {
    const totalCases = myCases.length;
    const completedCases = myCases.filter(c => c.status === 'completed').length;

    const averageProgress = myCases.length > 0
      ? Math.round(myCases.reduce((acc, case_) => {
        const progress = calculateProgress(case_);
        return acc + progress;
      }, 0) / myCases.length)
      : 0;

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    twoMonthsAgo.setHours(0,0,0,0);
    const recentCases = myCases.filter(c => c.appointment_date && new Date(c.appointment_date) >= twoMonthsAgo);

    const avg2MonthProgress = recentCases.length > 0
      ? Math.round(recentCases.reduce((acc, case_) => {
        const progress = calculateProgress(case_);
        return acc + progress;
      }, 0) / recentCases.length)
      : 0;

    const completedCasesWithDates = myCases.filter(c =>
      c.status === 'completed' && c.appointment_date && c.closure_date
    );

    const averageClosureTime = completedCasesWithDates.length > 0
      ? Math.round(completedCasesWithDates.reduce((acc, case_) => {
        const appointmentDate = new Date(case_.appointment_date);
        const closureDate = new Date(case_.closure_date);
        const diffInMonths = (closureDate.getFullYear() - appointmentDate.getFullYear()) * 12 +
          (closureDate.getMonth() - appointmentDate.getMonth());
        return acc + Math.max(0, diffInMonths);
      }, 0) / completedCasesWithDates.length)
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pendingDiaries = diaryEntries.filter(entry => {
      if (entry.status === 'completed_on_time' || entry.status === 'completed_late') {
        return false;
      }
      return entry.deadline_date !== null;
    }).length;

    const incompleteTasks = toDoTasks.filter(task => !task.completed).length;

    return {
      totalCases,
      completedCases,
      averageProgress,
      avg2MonthProgress,
      averageClosureTime: averageClosureTime > 0 ? `${averageClosureTime}mo` : 'N/A',
      pendingDiaries,
      incompleteTasks
    };
  }, [myCases, diaryEntries, toDoTasks, calculateProgress]);

  // Calculate diary filters
  const diaryData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    threeMonthsFromNow.setHours(23, 59, 59, 999);

    const upcomingDiaries = diaryEntries.filter(entry => {
      if (entry.status === 'completed_on_time' || entry.status === 'completed_late') {
        return false;
      }
      if (!entry.deadline_date) return false;

      const deadlineDate = new Date(entry.deadline_date);
      return deadlineDate >= today && deadlineDate <= threeMonthsFromNow;
    }).sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());

    const overdueDiaries = diaryEntries.filter(entry => {
      if (!entry.deadline_date) return false;
      if (entry.status === 'completed_on_time' || entry.status === 'completed_late') {
        return false;
      }

      const deadlineDate = new Date(entry.deadline_date);
      return deadlineDate < today;
    }).sort((a, b) => new Date(a.deadline_date).getTime() - new Date(b.deadline_date).getTime());

    return { upcomingDiaries, overdueDiaries };
  }, [diaryEntries]);

  const filteredCases = useMemo(() => {
    let filtered = myCases;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(case_ =>
        case_.company_name.toLowerCase().includes(searchLower) ||
        case_.case_reference.toLowerCase().includes(searchLower) ||
        case_.administrator_name.toLowerCase().includes(searchLower)
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter(case_ => case_.case_type === filterType);
    }

    if (filterStatus !== "all") {
      if (filterStatus === "pipeline") {
        filtered = filtered.filter(case_ => !case_.appointment_date || case_.appointment_date === '');
      } else if (filterStatus === "active") {
        filtered = filtered.filter(case_ => case_.appointment_date && case_.appointment_date !== '');
      } else {
        filtered = filtered.filter(case_ => case_.status === filterStatus);
      }
    }

    return filtered.sort((a, b) => {
      if (sortBy === 'progress') {
        const progressA = calculateProgress(a);
        const progressB = calculateProgress(b);
        return sortDirection === 'asc' ? progressA - progressB : progressB - progressA;
      } else if (sortBy === 'appointment_date') {
        const dateA = a.appointment_date ? new Date(a.appointment_date).getTime() : 0;
        const dateB = b.appointment_date ? new Date(b.appointment_date).getTime() : 0;
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'company_name') {
        const nameA = a.company_name.toLowerCase();
        const nameB = b.company_name.toLowerCase();
        if (sortDirection === 'asc') {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(a.company_name);
        }
      } else if (sortBy === 'case_type') {
        const typeA = (a.case_type || '').toLowerCase();
        const typeB = (b.case_type || '').toLowerCase();
        if (sortDirection === 'asc') {
          return typeA.localeCompare(typeB);
        } else {
          return typeB.localeCompare(a.case_type);
        }
      } else if (sortBy === 'status') {
        const statusOrder = { 'green': 1, 'amber': 2, 'red': 3, '': 4 };
        const statusA = statusOrder[a.action_points_status || ''] || 4;
        const statusB = statusOrder[b.action_points_status || ''] || 4;
        return sortDirection === 'asc' ? statusA - statusB : statusB - statusA;
      }
      return 0;
    });
  }, [myCases, searchTerm, filterType, filterStatus, calculateProgress, sortBy, sortDirection]);

  const getProgressColor = useCallback((progress) => {
    if (progress < 25) return "text-red-600 bg-red-50 border-red-200";
    if (progress < 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-emerald-600 bg-emerald-50 border-emerald-200";
  }, []);

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


  const handleCaseClick = useCallback((case_) => {
    setSelectedCase(case_);
  }, []);

  const handleCaseUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    loadData();
  }, [loadData]);

  const handleAddToDoTask = async (date, taskTitle, taskDescription, priority, attachmentFile, time = '') => {
    if (!currentUser || !taskTitle.trim()) return;

    try {
      const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;

      let attachmentUrl = null;
      if (attachmentFile) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file: attachmentFile });
        attachmentUrl = uploadResult.file_url;
      }

      const newTask = await base44.entities.ToDoTask.create({
        user_email: targetEmail,
        date: date,
        task_title: taskTitle.trim(),
        task_description: taskDescription?.trim() || '',
        completed: false,
        priority: priority || 'medium',
        time: time || null,
        attachment_url: attachmentUrl,
        created_by_grade: currentUser.grade || 'Admin'
      });

      setToDoTasks(prev => [...prev, newTask]);
    } catch (error) {
      console.error('Error creating to-do task:', error);
      alert('Failed to create task');
    }
  };

  const handleToggleTaskComplete = async (taskId, currentStatus) => {
    try {
      await base44.entities.ToDoTask.update(taskId, {
        completed: !currentStatus
      });

      setToDoTasks(toDoTasks.map(task =>
        task.id === taskId ? { ...task, completed: !currentStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task');
    }
  };

  const handleDeleteToDoTask = async (taskId) => {
    const taskToDelete = toDoTasks.find(task => task.id === taskId);
    if (!taskToDelete) return;

    if (deleteTimeout) {
      clearTimeout(deleteTimeout);
    }

    setToDoTasks(toDoTasks.filter(task => task.id !== taskId));
    setDeletedTask(taskToDelete);

    const timeout = setTimeout(async () => {
      try {
        await base44.entities.ToDoTask.delete(taskId);
        setDeletedTask(null);
      } catch (error) {
        console.error('Error deleting task:', error);
        setToDoTasks(prev => [...prev, taskToDelete]);
        alert('Failed to delete task');
      }
    }, 5000);

    setDeleteTimeout(timeout);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newDate = result.destination.droppableId;
    
    try {
      await base44.entities.ToDoTask.update(taskId, { date: newDate });
      setToDoTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, date: newDate } : task
      ));
    } catch (error) {
      console.error('Error updating task date:', error);
    }
  };

  const handleUndoDelete = () => {
    if (!deletedTask) return;

    if (deleteTimeout) {
      clearTimeout(deleteTimeout);
      setDeleteTimeout(null);
    }

    setToDoTasks(prev => [...prev, deletedTask]);
    setDeletedTask(null);
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskDetailModal(true);
  };

  const changeWeek = (direction) => {
    if (!selectedWeekStart) return;
    const newWeekStart = new Date(selectedWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + (direction * 7));
    newWeekStart.setHours(0,0,0,0);
    setSelectedWeekStart(newWeekStart);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setSelectedWeekStart(monday);
  };

  const changeMonth = (direction) => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + direction);
    setSelectedMonth(newMonth);
  };

  const goToCurrentMonth = () => {
    setSelectedMonth(new Date());
  };

  const handleSortByProgress = () => {
    if (sortBy === 'progress') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('progress');
      setSortDirection('asc');
    }
  };

  const handleSortByAppointmentDate = () => {
    if (sortBy === 'appointment_date') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('appointment_date');
      setSortDirection('desc');
    }
  };

  const handleSortByCompanyName = () => {
    if (sortBy === 'company_name') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('company_name');
      setSortDirection('asc');
    }
  };

  const handleSortByCaseType = () => {
    if (sortBy === 'case_type') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('case_type');
      setSortDirection('asc');
    }
  };

  const handleSortByStatus = () => {
    if (sortBy === 'status') {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy('status');
      setSortDirection('asc');
    }
  };

  if (isLoading && cases.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading your cases...</p>
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-red-500 mb-4">
            <AlertCircle className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Connection Error</h3>
          <p className="text-slate-600 mb-2">Unable to load your cases.</p>
          <p className="text-sm text-slate-500 mb-6">
            {error.includes('timeout')
              ? 'The request is taking longer than expected. Please check your internet connection.'
              : 'There may be a temporary issue with the service.'
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
    <div className="min-h-screen">
      <div className="max-w-none mx-auto px-6 md:px-8 py-6">
        {/* User Selection for IP and Manager grades */}
        {canSelectUsers && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="shadow-sm border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <UserIcon className="w-5 h-5 text-blue-700" />
                    <span className="font-semibold text-slate-900">View Cases For:</span>
                  </div>
                  <div className="flex-1 max-w-sm">
                    <Select
                      value={selectedUserEmail}
                      onValueChange={setSelectedUserEmail}
                    >
                      <SelectTrigger className="bg-white border-blue-300">
                        <SelectValue placeholder="Select user...">
                          {selectedUserEmail === currentUser?.email
                            ? `${currentUser?.full_name || 'My Cases'} (Me)`
                            : selectedUserDetails?.full_name || selectedUserEmail || "Select user..."}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {currentUser && (
                          <SelectItem value={currentUser.email}>
                            {currentUser.full_name || 'My Cases'} (Me)
                          </SelectItem>
                        )}
                        {allUsers
                          .filter(u => u.email !== currentUser?.email)
                          .map(user => (
                            <SelectItem key={user.email} value={user.email}>
                              {user.full_name || user.email}
                              {user.grade && ` (${user.grade})`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedUserDetails && selectedUserDetails.email !== currentUser?.email && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="bg-white">
                        {selectedUserDetails.grade || 'No Grade'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedUserEmail(currentUser?.email || '')}
                        className="text-blue-700 hover:text-blue-900"
                      >
                        Reset to My Cases
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Statistics Toolbar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            title="Total Cases"
            value={statistics.totalCases}
            icon={Briefcase}
            color="bg-blue-500"
            delay={0.1}
          />
          <StatCard
            title="Completed"
            value={statistics.completedCases}
            icon={CheckCircle}
            color="bg-emerald-500"
            delay={0.2}
          />
          <StatCard
            title="Avg 2 Month Progress"
            value={`${statistics.avg2MonthProgress}%`}
            icon={BarChart}
            color="bg-cyan-500"
            delay={0.3}
          />
          <StatCard
            title="Avg Progress"
            value={`${statistics.averageProgress}%`}
            icon={TrendingUp}
            color="bg-violet-500"
            delay={0.4}
          />
          <StatCard
            title="Avg Closure"
            value={statistics.averageClosureTime}
            icon={Clock}
            color="bg-amber-500"
            delay={0.5}
          />
        </div>

        {/* New Toolbar Below Statistics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mb-6"
        >
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-3">
              <div className="flex items-center justify-center gap-3">
                {/* My Cases */}
                <button
                  onClick={() => {
                    setShowCasesView(true);
                    setShowIntrayPanel(false);
                    setShowPostTrayPanel(false);
                    setShowToDoPanel(false);
                    setShowDiariesPanel(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    showCasesView
                      ? 'bg-blue-100 text-blue-700 border-2 border-blue-300 shadow-md'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-transparent'
                  }`}
                >
                  <Briefcase className="w-4 h-4" />
                  <span className="text-sm font-medium">My Cases</span>
                  <Badge className="bg-blue-600 text-white ml-1">
                    {statistics.totalCases}
                  </Badge>
                </button>

                {/* Intray */}
                <button
                  onClick={() => {
                    setShowIntrayPanel(true);
                    setShowPostTrayPanel(false);
                    setShowToDoPanel(false);
                    setShowDiariesPanel(false);
                    setShowCasesView(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    showIntrayPanel
                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 shadow-md'
                      : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-2 border-transparent'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm font-medium">Intray</span>
                  <Badge className="bg-purple-600 text-white ml-1">
                    {myIntrayStats.postToAction}
                  </Badge>
                </button>

                {/* Post Tray - Only for Manager and IP */}
                {canSelectUsers && (
                  <button
                    onClick={() => {
                      setShowPostTrayPanel(true);
                      setShowIntrayPanel(false);
                      setShowToDoPanel(false);
                      setShowDiariesPanel(false);
                      setShowCasesView(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      showPostTrayPanel
                        ? 'bg-teal-100 text-teal-700 border-2 border-teal-300 shadow-md'
                        : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border-2 border-transparent'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Post Tray</span>
                    <Badge className="bg-teal-600 text-white ml-1">
                      {postTrayStats.postToAction}
                    </Badge>
                  </button>
                )}

                {/* To Do List */}
                <button
                  onClick={() => {
                    setShowToDoPanel(true);
                    setShowIntrayPanel(false);
                    setShowPostTrayPanel(false);
                    setShowDiariesPanel(false);
                    setShowCasesView(false);
                    // Set monthly view to current month when opening To Do panel
                    setSelectedMonth(new Date());
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    showToDoPanel
                      ? 'bg-rose-100 text-rose-700 border-2 border-rose-300 shadow-md'
                      : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-2 border-transparent'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">To Do List</span>
                  <Badge className="bg-rose-600 text-white ml-1">
                    {statistics.incompleteTasks}
                  </Badge>
                </button>

                {/* Case Diaries */}
                <button
                  onClick={() => {
                    setShowDiariesPanel(true);
                    setShowIntrayPanel(false);
                    setShowPostTrayPanel(false);
                    setShowToDoPanel(false);
                    setShowCasesView(false);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    showDiariesPanel
                      ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300 shadow-md'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-2 border-transparent'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="text-sm font-medium">Case Diaries</span>
                  <Badge className="bg-indigo-600 text-white ml-1">
                    {statistics.pendingDiaries}
                  </Badge>
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Intray Panel */}
        {showIntrayPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="min-h-[calc(100vh-300px)]">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <FileText className="w-6 h-6 text-purple-600" />
                  Intray
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {isLoadingIntray ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                      <p className="text-slate-600">Loading intray tasks...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-6 min-h-[500px]">
                    {/* Left Sidebar */}
                    <div className="w-64 flex-shrink-0 space-y-2">
                      <button
                        onClick={() => {
                          setActiveIntrayTab('post_to_action');
                          setShowAddIntrayForm(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                          activeIntrayTab === 'post_to_action'
                            ? 'bg-purple-100 text-purple-700 border-2 border-purple-300 shadow-sm'
                            : 'bg-purple-50 text-purple-600 hover:bg-purple-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">Post to Action</span>
                        </div>
                        <Badge className="bg-purple-600 text-white">
                          {myIntrayStats.postToAction}
                        </Badge>
                      </button>

                      <button
                        onClick={() => {
                          setActiveIntrayTab('completed');
                          setShowAddIntrayForm(false);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                          activeIntrayTab === 'completed'
                            ? 'bg-green-100 text-green-700 border-2 border-green-300 shadow-sm'
                            : 'bg-green-50 text-green-600 hover:bg-green-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">Completed</span>
                        </div>
                        <Badge className="bg-green-600 text-white">
                          {myIntrayStats.completed}
                        </Badge>
                      </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1">
                      <IntrayContent
                        tasks={intrayTasks}
                        activeTab={activeIntrayTab}
                        showAddForm={showAddIntrayForm}
                        onCloseAddForm={() => setShowAddIntrayForm(false)}
                        onTaskUpdate={async () => {
                          const allTasks = await base44.entities.IntrayTask.list('-created_date', 500);
                          setIntrayTasks(allTasks);
                          setShowAddIntrayForm(false);
                        }}
                        currentUser={currentUser}
                        selectedUserEmail={selectedUserEmail}
                        canSelectUsers={canSelectUsers}
                        allUsers={allUsers}
                        myCases={myCases}
                        allCases={cases}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Post Tray Panel - Only for Manager and IP */}
        {showPostTrayPanel && canSelectUsers && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="min-h-[calc(100vh-300px)]">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                    <FileText className="w-6 h-6 text-teal-600" />
                    Post Tray - All Team Tasks
                  </CardTitle>
                  <Button
                    onClick={() => setShowAddIntrayForm(true)}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 sm:p-6">
                {isLoadingIntray ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 animate-spin text-teal-600 mx-auto mb-4" />
                      <p className="text-slate-600">Loading post tray tasks...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-6 min-h-[500px]">
                    {/* Left Sidebar */}
                    <div className="w-64 flex-shrink-0 space-y-2">
                      <button
                        onClick={() => {
                          setActiveIntrayTab('post_to_action');
                          setShowAddIntrayForm(false);
                          setSelectedAdminFilter(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                          activeIntrayTab === 'post_to_action'
                            ? 'bg-teal-100 text-teal-700 border-2 border-teal-300 shadow-sm'
                            : 'bg-teal-50 text-teal-600 hover:bg-teal-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          <span className="font-medium">Post to Action</span>
                        </div>
                        <Badge className="bg-teal-600 text-white">
                          {postTrayStats.postToAction}
                        </Badge>
                      </button>

                      {/* Case Admin Breakdown */}
                      {activeIntrayTab === 'post_to_action' && (() => {
                        const postToActionTasks = intrayTasks.filter(t => t.status === 'post_to_action');
                        const tasksByAdmin = {};
                        
                        postToActionTasks.forEach(task => {
                          const assignedTo = task.assigned_to || 'Unassigned';
                          if (!tasksByAdmin[assignedTo]) {
                            tasksByAdmin[assignedTo] = [];
                          }
                          tasksByAdmin[assignedTo].push(task);
                        });

                        const allowedEmails = [
                          'emon@cootsandboots.com',
                          'shikha@cootsandboots.com',
                          'rashmi@cootsandboots.com',
                          'prachi@cootsandboots.com',
                          'krunal@cootsandboots.com',
                          'ajilesh@cootsandboots.com',
                          'rahul@cootsandboots.com',
                          'seen@cootsandboots.com',
                          'cindy@cootsandboots.com'
                        ];

                        const caseAdmins = allUsers.filter(u => allowedEmails.includes(u.email));
                        
                        return (
                          <div className="mt-4 space-y-1">
                            <div className="px-2 py-1 text-xs font-semibold text-teal-700 uppercase tracking-wide">
                              Case Admins
                            </div>
                            {caseAdmins.map(admin => {
                              const adminTasks = tasksByAdmin[admin.email] || [];
                              const isSelected = selectedAdminFilter === admin.email;
                              return (
                                <button
                                  key={admin.email}
                                  onClick={() => setSelectedAdminFilter(isSelected ? null : admin.email)}
                                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-all ${
                                    isSelected 
                                      ? 'bg-teal-100 border-teal-300 shadow-sm' 
                                      : 'bg-white border-teal-200 hover:bg-teal-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`font-medium truncate ${
                                      isSelected ? 'text-teal-900' : 'text-slate-700'
                                    }`}>
                                      {admin.full_name || admin.email}
                                    </span>
                                    <Badge className={`text-xs ${
                                      isSelected 
                                        ? 'bg-teal-600 text-white' 
                                        : 'bg-teal-100 text-teal-700'
                                    }`}>
                                      {adminTasks.length}
                                    </Badge>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}

                      <button
                        onClick={() => {
                          setActiveIntrayTab('completed');
                          setShowAddIntrayForm(false);
                          setSelectedAdminFilter(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                          activeIntrayTab === 'completed'
                            ? 'bg-green-100 text-green-700 border-2 border-green-300 shadow-sm'
                            : 'bg-green-50 text-green-600 hover:bg-green-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          <span className="font-medium">Completed</span>
                        </div>
                        <Badge className="bg-green-600 text-white">
                          {intrayTasks.filter(t => t.status === 'completed').length}
                        </Badge>
                      </button>

                      <button
                        onClick={() => {
                          setActiveIntrayTab('archived');
                          setShowAddIntrayForm(false);
                          setSelectedAdminFilter(null);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between ${
                          activeIntrayTab === 'archived'
                            ? 'bg-slate-100 text-slate-700 border-2 border-slate-300 shadow-sm'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4" />
                          <span className="font-medium">Archive</span>
                        </div>
                        <Badge className="bg-slate-600 text-white">
                          {postTrayStats.archived}
                        </Badge>
                      </button>

                      {/* Case Admin Breakdown for Completed */}
                      {activeIntrayTab === 'completed' && (() => {
                        const completedTasks = intrayTasks.filter(t => t.status === 'completed');
                        const tasksByAdmin = {};
                        
                        completedTasks.forEach(task => {
                          const assignedTo = task.assigned_to || 'Unassigned';
                          if (!tasksByAdmin[assignedTo]) {
                            tasksByAdmin[assignedTo] = [];
                          }
                          tasksByAdmin[assignedTo].push(task);
                        });

                        const allowedEmails = [
                          'emon@cootsandboots.com',
                          'shikha@cootsandboots.com',
                          'rashmi@cootsandboots.com',
                          'prachi@cootsandboots.com',
                          'krunal@cootsandboots.com',
                          'ajilesh@cootsandboots.com',
                          'rahul@cootsandboots.com',
                          'seen@cootsandboots.com',
                          'cindy@cootsandboots.com'
                        ];

                        const caseAdmins = allUsers.filter(u => allowedEmails.includes(u.email));
                        
                        return (
                          <div className="mt-4 space-y-1">
                            <div className="px-2 py-1 text-xs font-semibold text-green-700 uppercase tracking-wide">
                              Case Admins
                            </div>
                            {caseAdmins.map(admin => {
                              const adminTasks = tasksByAdmin[admin.email] || [];
                              const isSelected = selectedAdminFilter === admin.email;
                              return (
                                <button
                                  key={admin.email}
                                  onClick={() => setSelectedAdminFilter(isSelected ? null : admin.email)}
                                  className={`w-full px-3 py-2 rounded-lg border text-sm transition-all ${
                                    isSelected 
                                      ? 'bg-green-100 border-green-300 shadow-sm' 
                                      : 'bg-white border-green-200 hover:bg-green-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`font-medium truncate ${
                                      isSelected ? 'text-green-900' : 'text-slate-700'
                                    }`}>
                                      {admin.full_name || admin.email}
                                    </span>
                                    <Badge className={`text-xs ${
                                      isSelected 
                                        ? 'bg-green-600 text-white' 
                                        : 'bg-green-100 text-green-700'
                                    }`}>
                                      {adminTasks.length}
                                    </Badge>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1">
                      <IntrayContent
                        tasks={intrayTasks}
                        activeTab={activeIntrayTab}
                        showAddForm={showAddIntrayForm}
                        onCloseAddForm={() => setShowAddIntrayForm(false)}
                        onTaskUpdate={async () => {
                          const allTasks = await base44.entities.IntrayTask.list('-created_date', 500);
                          setIntrayTasks(allTasks);
                          setShowAddIntrayForm(false);
                        }}
                        currentUser={currentUser}
                        selectedUserEmail={selectedUserEmail}
                        canSelectUsers={canSelectUsers}
                        allUsers={allUsers}
                        myCases={myCases}
                        allCases={cases}
                        isPostTray={true}
                        selectedAdminFilter={selectedAdminFilter}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
        
        {/* To Do List Panel */}
        {showToDoPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="min-h-[calc(100vh-300px)]">
              <CardHeader className="p-4 sm:p-6 pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                    <CheckCircle className="w-6 h-6 text-rose-600" />
                    My To Do List
                  </CardTitle>
                  
                  {/* View Mode Selector - Centered */}
                  <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1 bg-white">
                      <Button
                        variant={toDoViewMode === 'day' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setToDoViewMode('day');
                          setSelectedDay(new Date());
                        }}
                        className="h-7 px-3 text-xs"
                      >
                        Day
                      </Button>
                      <Button
                        variant={toDoViewMode === 'week' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setToDoViewMode('week')}
                        className="h-7 px-3 text-xs"
                      >
                        Week
                      </Button>
                      <Button
                        variant={toDoViewMode === 'month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => {
                          setToDoViewMode('month');
                          // When switching to month view, go to current month or the month of selected week
                          if (selectedWeekStart) {
                            setSelectedMonth(new Date(selectedWeekStart));
                          } else {
                            setSelectedMonth(new Date());
                          }
                        }}
                        className="h-7 px-3 text-xs"
                      >
                        Month
                      </Button>
                    </div>

                  {/* Navigation Controls */}
                  <div className="flex items-center gap-2">
                    {toDoViewMode === 'day' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newDay = new Date(selectedDay);
                            newDay.setDate(newDay.getDate() - 1);
                            setSelectedDay(newDay);
                          }}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Previous Day
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDay(new Date())}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Today
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newDay = new Date(selectedDay);
                            newDay.setDate(newDay.getDate() + 1);
                            setSelectedDay(newDay);
                          }}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Next Day
                        </Button>
                      </>
                    ) : toDoViewMode === 'week' ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => changeWeek(-1)}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Previous Week
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToCurrentWeek}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Current Week
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => changeWeek(1)}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Next Week
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => changeMonth(-1)}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Previous Month
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={goToCurrentMonth}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Current Month
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => changeMonth(1)}
                          className="px-3 py-1 text-sm h-auto"
                        >
                          Next Month
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                
                {/* Date Display */}
                {toDoViewMode === 'day' && (
                  <p className="text-sm text-slate-600 mt-2 ml-9">
                    {selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {toDoViewMode === 'week' && selectedWeekStart && (
                  <p className="text-sm text-slate-600 mt-2 ml-9">
                    Week of {selectedWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
                {toDoViewMode === 'month' && (
                  <p className="text-sm text-slate-600 mt-2 ml-9">
                    {selectedMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                  </p>
                )}
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {/* Undo Delete Banner */}
                <AnimatePresence>
                  {deletedTask && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 bg-slate-800 text-white px-4 py-3 rounded-lg flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Task deleted</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndoDelete}
                        className="text-white hover:text-white hover:bg-slate-700 h-8"
                      >
                        <Undo2 className="w-4 h-4 mr-2" />
                        Undo
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isLoadingToDos ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading tasks...</p>
                    </div>
                  </div>
                ) : toDoViewMode === 'day' ? (
                  <DayTimelineView
                    date={selectedDay}
                    tasks={toDoTasks.filter(task => task.date === selectedDay.toISOString().split('T')[0])}
                    onAddTask={handleAddToDoTask}
                    onToggleComplete={handleToggleTaskComplete}
                    onDeleteTask={handleDeleteToDoTask}
                    onTaskClick={handleTaskClick}
                  />
                ) : toDoViewMode === 'week' ? (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {selectedWeekStart && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, index) => {
                        const currentDate = new Date(selectedWeekStart);
                        currentDate.setDate(currentDate.getDate() + index);
                        const dateStr = currentDate.toISOString().split('T')[0];
                        const dayTasks = toDoTasks.filter(task => task.date === dateStr);
                        const isToday = new Date().toDateString() === currentDate.toDateString();

                        return (
                          <DayColumn
                            key={day}
                            day={day}
                            date={currentDate}
                            isToday={isToday}
                            tasks={dayTasks}
                            onAddTask={handleAddToDoTask}
                            onToggleComplete={handleToggleTaskComplete}
                            onDeleteTask={handleDeleteToDoTask}
                            onTaskClick={handleTaskClick}
                            isSelected={selectedWeekDay === dateStr}
                            onSelectDay={() => setSelectedWeekDay(dateStr)}
                          />
                        );
                      })}
                    </div>
                  </DragDropContext>
                ) : (
                  <MonthView
                    month={selectedMonth}
                    tasks={toDoTasks}
                    onAddTask={handleAddToDoTask}
                    onToggleComplete={handleToggleTaskComplete}
                    onDeleteTask={handleDeleteToDoTask}
                    onTaskClick={handleTaskClick}
                    onTaskUpdate={async () => {
                      const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;
                      const allTasks = await base44.entities.ToDoTask.list('-date', 500);
                      const userTasks = allTasks.filter(task => task.user_email === targetEmail);
                      setToDoTasks(userTasks);
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Case Diaries Panel */}
        {showDiariesPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="min-h-[calc(100vh-300px)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-indigo-600" />
                  Case Diaries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 flex flex-col min-h-[calc(100vh-400px)]">
                {isLoadingDiaries ? (
                  <div className="flex-1 flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-slate-600">Loading diary entries...</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Tabs */}
                    <div className="flex gap-2 mb-4 border-b border-slate-200 px-6 sm:px-0 flex-shrink-0">
                      <button
                        onClick={() => setActiveDiaryTab('upcoming')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                          activeDiaryTab === 'upcoming'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Due Next 3 Months
                          {diaryData.upcomingDiaries.length > 0 && (
                            <Badge variant="secondary" className="ml-1">{diaryData.upcomingDiaries.length}</Badge>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveDiaryTab('overdue')}
                        className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                          activeDiaryTab === 'overdue'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          Overdue
                          {diaryData.overdueDiaries.length > 0 && (
                            <Badge variant="destructive" className="ml-1">{diaryData.overdueDiaries.length}</Badge>
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Tab Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto space-y-3 p-4 sm:p-0">
                      {activeDiaryTab === 'upcoming' && (
                        <>
                          {diaryData.upcomingDiaries.length === 0 ? (
                            <div className="text-center py-12">
                              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                              <h3 className="font-semibold text-slate-900 mb-2">No Upcoming Diaries</h3>
                              <p className="text-slate-500">
                                You have no diary entries due in the next 3 months.
                              </p>
                            </div>
                          ) : (
                            diaryData.upcomingDiaries.map(entry => {
                              const caseData = myCases.find(c => c.id === entry.case_id);
                              return (
                                <Card key={entry.id} className="border-slate-200">
                                  <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                          <Badge variant="outline" className="font-mono text-xs">
                                            {caseData?.case_reference || 'Unknown Case'}
                                          </Badge>
                                          <Badge className={getStatusColor('pending')}>
                                            Pending
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

                                      <div className="text-right flex-shrink-0">
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                          <Calendar className="w-4 h-4" />
                                          <span>{formatDate(entry.deadline_date)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                  </Card>
                              );
                            })
                          )}
                        </>
                      )}

                      {activeDiaryTab === 'overdue' && (
                        <>
                          {diaryData.overdueDiaries.length === 0 ? (
                            <div className="text-center py-12">
                              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                              <h3 className="font-semibold text-slate-900 mb-2">All Caught Up!</h3>
                              <p className="text-slate-500">
                                You have no overdue diary entries.
                              </p>
                            </div>
                          ) : (
                            diaryData.overdueDiaries.map(entry => {
                              const caseData = myCases.find(c => c.id === entry.case_id);
                              return (
                                <Card key={entry.id} className="border-red-300 bg-red-50">
                                  <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                      <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                          <Badge variant="outline" className="font-mono text-xs">
                                            {caseData?.case_reference || 'Unknown Case'}
                                          </Badge>
                                          <Badge className={getStatusColor('overdue')}>
                                            Overdue
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

                                      <div className="text-right flex-shrink-0">
                                        <div className="flex items-center gap-2 text-sm text-red-700 font-semibold">
                                          <Calendar className="w-4 h-4" />
                                          <span>{formatDate(entry.deadline_date)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Cases Table */}
        {showCasesView && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <CardTitle className="font-display font-bold text-xl text-slate-900 flex items-center gap-2 flex-shrink-0">
                    <FileText className="w-5 h-5 text-blue-700" />
                    {selectedUserDetails && selectedUserEmail !== currentUser?.email
                      ? `Cases for ${selectedUserDetails.full_name} (${filteredCases.length})`
                      : `Cases (${filteredCases.length})`
                    }
                  </CardTitle>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 justify-center">
                    <div className="relative w-full sm:w-80">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        placeholder="Search cases by company name, reference, or administrator..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white border-slate-300"
                      />
                    </div>
                    
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-full sm:w-40 bg-white border-slate-300">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="Administration">Administration</SelectItem>
                        <SelectItem value="CVL">CVL</SelectItem>
                        <SelectItem value="MVL">MVL</SelectItem>
                        <SelectItem value="CWU">CWU</SelectItem>
                        <SelectItem value="Moratoriums">Moratoriums</SelectItem>
                        <SelectItem value="Receiverships">Receiverships</SelectItem>
                        <SelectItem value="CVA">CVA</SelectItem>
                        <SelectItem value="IVA">IVA</SelectItem>
                        <SelectItem value="BKR">BKR</SelectItem>
                        <SelectItem value="Advisory">Advisory</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-full sm:w-40 bg-white border-slate-300">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pipeline">Pipeline</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredCases.length === 0 ? (
                  <div className="text-center py-12">
                    <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-semibold text-slate-900 mb-2">No cases found</h3>
                    <p className="text-slate-500 mb-4">
                      {searchTerm || filterType !== "all" || filterStatus !== "all"
                        ? "Try adjusting your filters"
                        : (selectedUserDetails && selectedUserEmail !== currentUser?.email)
                          ? `${selectedUserDetails.full_name} doesn't have any assigned cases yet`
                          : "You don't have any assigned cases yet"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead
                            className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={handleSortByCompanyName}
                          >
                            <div className="flex items-center gap-2">
                              Company
                              {sortBy === 'company_name' && sortDirection === 'asc' ? (
                                <ArrowUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={handleSortByCaseType}
                          >
                            <div className="flex items-center gap-2">
                              Type
                              {sortBy === 'case_type' && sortDirection === 'asc' ? (
                                <ArrowUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700">Reference</TableHead>
                          <TableHead
                            className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={handleSortByProgress}
                          >
                            <div className="flex items-center gap-2">
                              Progress
                              {sortBy === 'progress' && sortDirection === 'asc' ? (
                                <ArrowUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={handleSortByStatus}
                          >
                            <div className="flex items-center gap-2">
                              Status
                              {sortBy === 'status' && (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ArrowDown className="w-4 h-4 text-blue-600" />
                                )
                              )}
                            </div>
                          </TableHead>
                          <TableHead
                            className="font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={handleSortByAppointmentDate}
                          >
                            <div className="flex items-center gap-2">
                              Date of Appointment
                              {sortBy === 'appointment_date' && sortDirection === 'asc' ? (
                                <ArrowUp className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ArrowDown className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-slate-700">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.map((case_, index) => {
                          const progress = calculateProgress(case_);
                          return (
                            <TableRow
                              key={case_.id}
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={() => handleCaseClick(case_)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                    <Building className="w-5 h-5 text-blue-700" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900">{case_.company_name}</div>
                                    <div className="text-sm text-slate-500">{case_.administrator_name}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-slate-300">
                                  {case_.case_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{case_.case_reference}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge className={`${getProgressColor(progress)} border font-semibold`}>
                                    {progress}%
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center">
                                  {case_.action_points_status === 'red' && (
                                    <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-red-700 flex items-center justify-center">
                                      <span className="text-xs font-bold text-white">R</span>
                                    </div>
                                  )}
                                  {case_.action_points_status === 'amber' && (
                                    <div className="w-8 h-8 rounded-full bg-amber-400 border-2 border-amber-600 flex items-center justify-center">
                                      <span className="text-xs font-bold text-white">A</span>
                                    </div>
                                  )}
                                  {case_.action_points_status === 'green' && (
                                    <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-green-700 flex items-center justify-center">
                                      <span className="text-xs font-bold text-white">G</span>
                                    </div>
                                  )}
                                  {!case_.action_points_status && (
                                    <span className="text-sm text-slate-400">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600">
                                {case_.appointment_date 
                                  ? new Date(case_.appointment_date).toLocaleDateString('en-GB', {
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric'
                                    })
                                  : 'Not set'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCaseClick(case_);
                                  }}
                                  className="hover:bg-blue-50"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
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
          </motion.div>
        )}

        {/* Case Detail Modal */}
        <CaseDetailModal
          case_={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onUpdate={handleCaseUpdate}
          users={allUsers}
        />

        {/* Task Detail Modal */}
        <TaskDetailModal
          task={selectedTask}
          isOpen={showTaskDetailModal}
          onClose={() => {
            setShowTaskDetailModal(false);
            setSelectedTask(null);
          }}
          onToggleComplete={handleToggleTaskComplete}
          onDelete={handleDeleteToDoTask}
        />
        </div>
        </div>
        );
        }

// Intray Content Component
function IntrayContent({ tasks, activeTab, showAddForm, onCloseAddForm, onTaskUpdate, currentUser, selectedUserEmail, canSelectUsers, allUsers, myCases, allCases = [], isPostTray = false, selectedAdminFilter = null }) {
  const [selectedTask, setSelectedTask] = useState(null);

  // Filter tasks based on activeTab and current user
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => task.status === activeTab);
    
    // For Intray (not Post Tray), only show tasks assigned to selected user or current user
    if (!isPostTray && currentUser) {
      const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;
      filtered = filtered.filter(task => 
        task.user_email === targetEmail || task.assigned_to === targetEmail
      );
    }
    
    // Apply admin filter if selected
    if (selectedAdminFilter) {
      filtered = filtered.filter(task => task.assigned_to === selectedAdminFilter);
    }
    
    return filtered;
  }, [tasks, activeTab, selectedAdminFilter, isPostTray, currentUser, canSelectUsers, selectedUserEmail]);

  if (showAddForm && activeTab === 'post_to_action') {
    return (
      <AddIntrayTaskForm
        onClose={onCloseAddForm}
        currentUser={currentUser}
        selectedUserEmail={selectedUserEmail}
        canSelectUsers={canSelectUsers}
        allUsers={allUsers}
        myCases={myCases}
        allCases={allCases}
        onTaskAdded={onTaskUpdate}
      />
    );
  }

  const handleMarkComplete = async (taskId) => {
    try {
      await base44.entities.IntrayTask.update(taskId, {
        status: 'completed',
        completed_date: new Date().toISOString()
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Error marking task as complete:', error);
      alert('Failed to update task');
    }
  };

  const handleMarkPostToAction = async (taskId) => {
    try {
      await base44.entities.IntrayTask.update(taskId, {
        status: 'post_to_action',
        completed_date: null,
        archived_date: null
      });
      await onTaskUpdate();
    } catch (error) {
      console.error('Error marking task as post to action:', error);
      alert('Failed to update task');
    }
  };

  const handleArchiveTask = async (taskId) => {
    try {
      await base44.entities.IntrayTask.update(taskId, {
        status: 'archived',
        archived_date: new Date().toISOString()
      });
      onTaskUpdate();
    } catch (error) {
      console.error('Error archiving task:', error);
      alert('Failed to archive task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this intray task?')) return;

    try {
      await base44.entities.IntrayTask.delete(taskId);
      onTaskUpdate();
      setSelectedTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  const canDelete = isPostTray && (currentUser?.grade === 'IP' || currentUser?.grade === 'Manager');

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-600 text-white border-red-700';
      case 'high': return 'bg-orange-500 text-white border-orange-600';
      case 'medium': return 'bg-amber-500 text-white border-amber-600';
      case 'low': return 'bg-blue-500 text-white border-blue-600';
      default: return 'bg-slate-400 text-white border-slate-500';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      {filteredTasks.length === 0 && !showAddForm ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="font-semibold text-slate-900 mb-2">
            {activeTab === 'post_to_action' ? 'No Tasks to Action' : 'No Completed Tasks'}
          </h3>
          <p className="text-slate-500">
            {activeTab === 'post_to_action' 
              ? 'Click "Add Task" to create a new intray item'
              : 'Completed tasks will appear here'}
          </p>
        </div>
      ) : (
        filteredTasks.map(task => {
          const caseData = allCases.find(c => c.id === task.case_id);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const deadlineDate = new Date(task.deadline);
          deadlineDate.setHours(0, 0, 0, 0);
          const isOverdue = deadlineDate < today && task.status === 'post_to_action';
          
          return (
            <Card 
              key={task.id} 
              className={`border-l-4 ${
                isOverdue 
                  ? 'border-red-500 bg-red-50/30' 
                  : activeTab === 'completed' || activeTab === 'post_to_action'
                    ? 'border-green-500' 
                    : 'border-purple-500'
              } hover:shadow-md transition-shadow cursor-pointer`}
              onClick={() => setSelectedTask(task)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {caseData && (
                      <div className="mb-3 text-center">
                        <p className="text-sm font-semibold text-blue-700">
                          Case Name: {caseData.case_reference} - {caseData.company_name}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Badge className={`${getPriorityColor(task.priority)} text-xs font-semibold`}>
                          {task.priority}
                        </Badge>
                        {caseData && (
                          <Badge variant="outline" className="text-xs">
                            {caseData.case_reference}
                          </Badge>
                        )}
                        {isOverdue && (
                          <Badge className="bg-red-600 text-white text-xs">
                            Overdue
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-bold text-blue-900 text-base flex-1 text-center">{task.task_title}</h4>
                    </div>

                    {task.instructions && (
                      <div className="mb-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Instructions</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.instructions}</p>
                      </div>
                    )}

                    <div className="mb-3 flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Deadline</p>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                            {formatDate(task.deadline)}
                          </span>
                        </div>
                      </div>

                      {task.document_urls && task.document_urls.length > 0 && (
                        <div className="flex-shrink-0">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Documents Attached</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {task.document_urls.map((url, idx) => (
                              <a
                                key={idx}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                              >
                                <Paperclip className="w-4 h-4" />
                                <span>Document {idx + 1}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {task.comments && Array.isArray(task.comments) && task.comments.length > 0 && (
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Comments</p>
                          <p className="text-sm text-slate-700 line-clamp-2">{task.comments[task.comments.length - 1]?.comment_text || ''}</p>
                        </div>
                      )}
                    </div>

                    {task.sharepoint_links && task.sharepoint_links.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">SharePoint Links</p>
                        <div className="space-y-1">
                          {task.sharepoint_links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              <Link2 className="w-4 h-4" />
                              <span>{link.description || `Link ${idx + 1}`}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {task.comments && Array.isArray(task.comments) && task.comments.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Latest Comment</p>
                        <p className="text-sm text-slate-700 line-clamp-2">{task.comments[task.comments.length - 1]?.comment_text || ''}</p>
                      </div>
                    )}
                    </div>

                    <div className="flex gap-2 ml-4 flex-shrink-0">
                    {activeTab === 'post_to_action' ? (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(task.id);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                    ) : activeTab === 'completed' && isPostTray ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkPostToAction(task.id);
                          }}
                          className="text-purple-600 border-purple-300 hover:bg-purple-50"
                        >
                          <Undo2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveTask(task.id);
                          }}
                          className="bg-slate-600 hover:bg-slate-700"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </Button>
                      </>
                    ) : activeTab === 'archived' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkPostToAction(task.id);
                        }}
                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkPostToAction(task.id);
                        }}
                        className="text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <Undo2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {selectedTask && (
        <IntrayTaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onMarkComplete={handleMarkComplete}
          onMarkPostToAction={handleMarkPostToAction}
          onArchive={isPostTray ? handleArchiveTask : null}
          onDelete={canDelete ? handleDeleteTask : null}
          caseData={allCases.find(c => c.id === selectedTask.case_id)}
        />
      )}
    </div>
  );
}

// Intray Task Detail Modal
function IntrayTaskDetailModal({ task, isOpen, onClose, onMarkComplete, onMarkPostToAction, onArchive = null, onDelete = null, caseData }) {
  const [newCommentText, setNewCommentText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [localTask, setLocalTask] = useState(task);
  const [editedInstructions, setEditedInstructions] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setLocalTask(task);
      setEditedInstructions(task.instructions || '');
      setHasUnsavedChanges(false);
    }
  }, [task]);

  if (!localTask) return null;

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;

    setIsAddingComment(true);
    try {
      const currentUser = await base44.auth.me();
      const comment = {
        user_name: currentUser.full_name || currentUser.email,
        user_email: currentUser.email,
        timestamp: new Date().toISOString(),
        comment_text: newCommentText.trim()
      };
      const updatedComments = [...(localTask.comments || []), comment];

      await base44.entities.IntrayTask.update(localTask.id, { comments: updatedComments });
      setLocalTask(prev => ({ ...prev, comments: updatedComments }));
      setNewCommentText('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {};
      
      // Save instructions if changed
      if (editedInstructions !== localTask.instructions) {
        updates.instructions = editedInstructions;
      }

      // Save pending comment if exists
      if (newCommentText.trim()) {
        const currentUser = await base44.auth.me();
        const comment = {
          user_name: currentUser.full_name || currentUser.email,
          user_email: currentUser.email,
          timestamp: new Date().toISOString(),
          comment_text: newCommentText.trim()
        };
        updates.comments = [...(localTask.comments || []), comment];
      }

      if (Object.keys(updates).length > 0) {
        await base44.entities.IntrayTask.update(localTask.id, updates);
        setLocalTask(prev => ({ ...prev, ...updates }));
        setNewCommentText('');
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    // Auto-save on close if there are unsaved changes
    if (hasUnsavedChanges || newCommentText.trim()) {
      await handleSave();
    }
    onClose();
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(task.deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const isOverdue = deadlineDate < today && task.status === 'post_to_action';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-6 h-6 text-purple-600" />
              Intray Task Details
            </div>
            {caseData && (
              <p className="text-base font-semibold text-blue-700 mt-1 text-center">
                Case Name: {caseData.case_reference} - {caseData.company_name}
              </p>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Title</label>
            <p className="text-xl font-semibold mt-1 text-slate-900 text-center">{task.task_title}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Instructions</label>
            <Textarea
              value={editedInstructions}
              onChange={(e) => {
                setEditedInstructions(e.target.value);
                setHasUnsavedChanges(true);
              }}
              placeholder="Add instructions for this task..."
              className="mt-1 min-h-[100px] bg-white"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Priority</label>
              <div className="mt-1">
                <Badge className={`${getPriorityColor(task.priority)} capitalize border text-sm`}>
                  {task.priority}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Deadline</label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4 text-slate-500" />
                <p className={`text-slate-700 ${isOverdue ? 'text-red-600 font-semibold' : ''}`}>
                  {formatDate(task.deadline)}
                  {isOverdue && ' (Overdue)'}
                </p>
              </div>
            </div>
          </div>

          {caseData && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Related Case</label>
              <div className="mt-1">
                <Badge variant="outline" className="text-sm">
                  {caseData.case_reference} - {caseData.company_name}
                </Badge>
              </div>
            </div>
          )}

          {task.assigned_to && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Assigned To</label>
              <p className="text-slate-700 mt-1">{task.assigned_to}</p>
            </div>
          )}

          {task.document_urls && task.document_urls.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Documents</label>
              <div className="mt-2 space-y-2">
                {task.document_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700 flex-1 text-left">Document {index + 1}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {task.sharepoint_links && task.sharepoint_links.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">SharePoint Links</label>
              <div className="mt-2 space-y-2">
                {task.sharepoint_links.map((link, index) => (
                  <a
                    key={index}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Link2 className="w-4 h-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm text-slate-900 font-medium">{link.description || 'SharePoint Document'}</p>
                      <p className="text-xs text-slate-500 truncate">{link.url}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-2 block">Comments</label>
            <div className="space-y-3 mb-3">
              {(localTask.comments && localTask.comments.length > 0) ? (
                localTask.comments.map((comment, index) => (
                  <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <p className="text-sm text-slate-800 mb-1">{comment.comment_text}</p>
                    <p className="text-xs text-slate-500">
                      {comment.user_name} • {new Date(comment.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(comment.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 italic">No comments yet</p>
              )}
            </div>
            <div className="space-y-2">
              <Textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Type your comment here..."
                className="bg-white min-h-[80px]"
                disabled={isAddingComment}
              />
              <Button 
                onClick={handleAddComment} 
                disabled={!newCommentText.trim() || isAddingComment}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isAddingComment ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving Comment...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Comment
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Status</label>
            <div className="mt-1">
              <Badge className={localTask.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-purple-100 text-purple-800 border-purple-300'}>
                {localTask.status === 'completed' ? 'Completed' : 'Post to Action'}
              </Badge>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              onClick={handleSave}
              disabled={isSaving || (!hasUnsavedChanges && !newCommentText.trim())}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>

            {localTask.status === 'post_to_action' ? (
              <Button
                onClick={() => {
                  onMarkComplete(localTask.id);
                  handleClose();
                }}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </Button>
            ) : localTask.status === 'completed' && onArchive ? (
              <>
                <Button
                  onClick={() => {
                    onMarkPostToAction(localTask.id);
                    handleClose();
                  }}
                  variant="outline"
                  className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <Undo2 className="w-4 h-4 mr-2" />
                  Move to Action
                </Button>
                <Button
                  onClick={() => {
                    onArchive(localTask.id);
                    handleClose();
                  }}
                  className="flex-1 bg-slate-600 hover:bg-slate-700"
                >
                  <FolderOpen className="w-4 h-4 mr-2" />
                  Archive
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  onMarkPostToAction(localTask.id);
                  handleClose();
                }}
                variant="outline"
                className="flex-1 text-purple-600 border-purple-300 hover:bg-purple-50"
              >
                <Undo2 className="w-4 h-4 mr-2" />
                Move to Action
              </Button>
            )}
            
            {onDelete && localTask.status !== 'completed' && (
              <Button
                onClick={() => {
                  onDelete(localTask.id);
                }}
                variant="destructive"
                className="flex-1"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Add Intray Task Form (Inline)
function AddIntrayTaskForm({ onClose, currentUser, selectedUserEmail, canSelectUsers, allUsers, myCases, allCases = [], onTaskAdded }) {
  const [formData, setFormData] = useState({
    task_title: '',
    instructions: '',
    priority: 'medium',
    deadline: '',
    case_id: '',
    assigned_to: '',
    sharepoint_links: []
  });
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newSharePointUrl, setNewSharePointUrl] = useState('');
  const [newSharePointDesc, setNewSharePointDesc] = useState('');
  const [caseSearchTerm, setCaseSearchTerm] = useState('');

  const handleAddSharePointLink = () => {
    if (!newSharePointUrl.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      sharepoint_links: [
        ...prev.sharepoint_links,
        { url: newSharePointUrl.trim(), description: newSharePointDesc.trim() || 'SharePoint Document' }
      ]
    }));
    
    setNewSharePointUrl('');
    setNewSharePointDesc('');
  };

  const handleRemoveSharePointLink = (index) => {
    setFormData(prev => ({
      ...prev,
      sharepoint_links: prev.sharepoint_links.filter((_, i) => i !== index)
    }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check file sizes (max 10MB per file)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      alert(`Some files are too large (max 10MB). Please reduce file size or compress: ${oversizedFiles.map(f => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      
      setUploadedDocuments(prev => [...prev, ...urls]);
    } catch (error) {
      console.error('Error uploading files:', error);
      const errorMessage = error.message || 'Unknown error';
      alert(`Failed to upload files: ${errorMessage}. Please try again with smaller files or different format.`);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveDocument = (index) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!formData.task_title.trim() || !formData.deadline || !formData.case_id || !formData.assigned_to.trim()) {
      alert('Please fill in all required fields (Task Title, Deadline, Case, and Assign To)');
      return;
    }

    setIsSaving(true);
    try {
      const targetEmail = (canSelectUsers && selectedUserEmail) ? selectedUserEmail : currentUser.email;

      await base44.entities.IntrayTask.create({
        user_email: formData.assigned_to || targetEmail,
        task_title: formData.task_title.trim(),
        instructions: formData.instructions.trim(),
        priority: formData.priority,
        deadline: formData.deadline,
        case_id: formData.case_id || null,
        assigned_to: formData.assigned_to || null,
        document_urls: uploadedDocuments,
        sharepoint_links: formData.sharepoint_links,
        status: 'post_to_action',
        created_by_name: currentUser?.full_name || currentUser?.email
      });

      onTaskAdded();
    } catch (error) {
      console.error('Error creating intray task:', error);
      alert('Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-2 border-purple-300 bg-purple-50/30">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-600" />
            New Intray Task
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="task_title">Task Title *</Label>
          <Input
            id="task_title"
            value={formData.task_title}
            onChange={(e) => setFormData(prev => ({ ...prev, task_title: e.target.value }))}
            placeholder="Enter task title"
            className="mt-1 bg-white"
          />
        </div>

        <div>
          <Label htmlFor="instructions">Instructions</Label>
          <Textarea
            id="instructions"
            value={formData.instructions}
            onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
            placeholder="Enter detailed instructions for this task"
            className="mt-1 h-32 bg-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="priority">Priority *</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger className="mt-1 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="deadline">Deadline *</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
              className="mt-1 bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="case_search">Case *</Label>
            <div className="relative mt-1">
              {formData.case_id ? (
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex-1">
                    <div className="font-medium text-green-900 text-sm">
                      {allCases.find(c => c.id === formData.case_id)?.case_reference || 'Selected'}
                    </div>
                    <div className="text-xs text-green-700">
                      {allCases.find(c => c.id === formData.case_id)?.company_name || ''}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, case_id: '' }));
                      setCaseSearchTerm('');
                    }}
                    className="h-6 w-6 p-0 hover:bg-green-100"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      id="case_search"
                      value={caseSearchTerm}
                      onChange={(e) => {
                        setCaseSearchTerm(e.target.value);
                      }}
                      placeholder="Search cases..."
                      className="pl-9 bg-white"
                    />
                  </div>
                  
                  {caseSearchTerm && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                      {allCases
                        .filter(case_ => 
                          case_.company_name?.toLowerCase().includes(caseSearchTerm.toLowerCase()) ||
                          case_.case_reference?.toLowerCase().includes(caseSearchTerm.toLowerCase())
                        )
                        .slice(0, 50)
                        .map(case_ => (
                          <button
                            key={case_.id}
                            onClick={() => {
                              setFormData(prev => ({ 
                                ...prev, 
                                case_id: case_.id,
                                assigned_to: case_.assigned_user || ''
                              }));
                              setCaseSearchTerm('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors text-sm border-b border-slate-100 last:border-0"
                          >
                            <div className="font-medium text-slate-900">{case_.case_reference}</div>
                            <div className="text-xs text-slate-500">{case_.company_name}</div>
                          </button>
                        ))
                      }
                      {allCases.filter(case_ => 
                        case_.company_name?.toLowerCase().includes(caseSearchTerm.toLowerCase()) ||
                        case_.case_reference?.toLowerCase().includes(caseSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="p-3 text-center text-slate-500 text-sm">
                          No cases found
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="assigned_to">Assign To *</Label>
            <Input
              id="assigned_to"
              value={formData.assigned_to}
              onChange={(e) => setFormData(prev => ({ ...prev, assigned_to: e.target.value }))}
              placeholder="Email or name"
              className="mt-1 bg-white"
            />
          </div>
        </div>

        <div>
          <Label>Upload Documents</Label>
          <div className="mt-2">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="intray-file-upload"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('intray-file-upload').click()}
              disabled={isUploading}
              className="w-full bg-white"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Documents
                </>
              )}
            </Button>
            
            {uploadedDocuments.length > 0 && (
              <div className="mt-2 space-y-2">
                {uploadedDocuments.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200">
                    <Paperclip className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-700 flex-1">Document {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDocument(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <Label>SharePoint Links</Label>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <Input
                value={newSharePointUrl}
                onChange={(e) => setNewSharePointUrl(e.target.value)}
                placeholder="SharePoint URL"
                className="flex-1 bg-white"
              />
              <Input
                value={newSharePointDesc}
                onChange={(e) => setNewSharePointDesc(e.target.value)}
                placeholder="Description (optional)"
                className="flex-1 bg-white"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSharePointLink}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {formData.sharepoint_links.length > 0 && (
              <div className="space-y-2">
                {formData.sharepoint_links.map((link, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <Link2 className="w-4 h-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{link.description}</p>
                      <p className="text-xs text-slate-500 truncate">{link.url}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSharePointLink(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !formData.task_title.trim() || !formData.deadline || !formData.case_id || !formData.assigned_to.trim()}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Month View Component
function MonthView({ month, tasks, onAddTask, onToggleComplete, onDeleteTask, onTaskClick, onTaskUpdate }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const sourceDate = result.source.droppableId;
    const destDate = result.destination.droppableId;

    if (sourceDate === destDate) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task || task.completed) return;

    try {
      await base44.entities.ToDoTask.update(taskId, { date: destDate });
      // Trigger update to refresh tasks
      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error moving task:', error);
      alert('Failed to move task');
    }
  };

  // Get first day of month and total days
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Adjust so Monday is first (0), Sunday is last (6)
  const startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  // Generate calendar days with date strings for droppable IDs
  const calendarDays = [];
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startOffset; i++) {
    calendarDays.push(null);
  }
  
  // Add actual days
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const getDateString = (day) => {
    return new Date(month.getFullYear(), month.getMonth(), day).toISOString().split('T')[0];
  };

  const getTasksForDate = (day) => {
    if (!day) return [];
    const dateStr = getDateString(day);
    return tasks.filter(task => task.date === dateStr);
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month.getMonth() && 
           today.getFullYear() === month.getFullYear();
  };

  const getPriorityColor = (priority, createdByGrade) => {
    const isManagerOrIP = createdByGrade === 'IP' || createdByGrade === 'Manager';
    
    if (isManagerOrIP) {
      switch (priority) {
        case 'high': return 'bg-purple-600';
        case 'medium': return 'bg-indigo-500';
        case 'low': return 'bg-purple-400';
        default: return 'bg-indigo-300';
      }
    } else {
      switch (priority) {
        case 'high': return 'bg-red-500';
        case 'medium': return 'bg-amber-500';
        case 'low': return 'bg-blue-500';
        default: return 'bg-slate-400';
      }
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center font-semibold text-slate-700 text-sm py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }

          const dayTasks = getTasksForDate(day);
          const completedTasks = dayTasks.filter(t => t.completed).length;
          const totalTasks = dayTasks.length;
          const isCurrentDay = isToday(day);
          const isSelectedDay = day === selectedDay;
          
          // Determine if this day is a weekend
          const dayOfWeek = new Date(month.getFullYear(), month.getMonth(), day).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

          return (
            <Droppable droppableId={getDateString(day)} key={day}>
              {(provided, snapshot) => (
                <Card
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  onClick={() => setSelectedDay(day)}
                  className={`aspect-square cursor-pointer ${
                    isSelectedDay ? 'border-2 border-rose-500 bg-rose-50' : 
                    isWeekend ? 'border-slate-200 bg-blue-50' : 
                    'border-slate-200'
                  } ${snapshot.isDraggingOver ? 'bg-rose-100 border-rose-400' : ''} hover:shadow-md transition-shadow`}
                >
                  <CardContent className="p-2 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-1">
                      <span className={`text-sm font-semibold ${isSelectedDay ? 'text-rose-700' : 'text-slate-700'}`}>
                        {day}
                      </span>
                      {totalTasks > 0 && (
                        <Badge className="h-5 px-1.5 text-xs bg-rose-600 text-white">
                          {completedTasks}/{totalTasks}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {(expandedDays.has(day) ? dayTasks : dayTasks.slice(0, 3)).map((task, taskIndex) => (
                        <Draggable 
                          key={task.id} 
                          draggableId={task.id} 
                          index={taskIndex}
                          isDragDisabled={task.completed}
                        >
                          {(provided, snapshot) => {
                            const isManagerOrIP = task.created_by_grade === 'IP' || task.created_by_grade === 'Manager';
                            const bgColor = isManagerOrIP
                              ? (task.priority === 'high' ? 'bg-purple-100' :
                                 task.priority === 'medium' ? 'bg-indigo-100' :
                                 task.priority === 'low' ? 'bg-purple-50' : 'bg-indigo-50')
                              : (task.priority === 'high' ? 'bg-red-50' :
                                 task.priority === 'medium' ? 'bg-amber-50' :
                                 task.priority === 'low' ? 'bg-blue-50' : 'bg-slate-50');
                            
                            const borderColor = isManagerOrIP
                              ? (task.priority === 'high' ? 'border-purple-600' :
                                 task.priority === 'medium' ? 'border-indigo-500' :
                                 task.priority === 'low' ? 'border-purple-400' : 'border-indigo-300')
                              : (task.priority === 'high' ? 'border-red-500' :
                                 task.priority === 'medium' ? 'border-amber-500' :
                                 task.priority === 'low' ? 'border-blue-500' : 'border-slate-300');
                            
                            return (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => !snapshot.isDragging && onTaskClick(task)}
                              className={`p-1 rounded text-xs border-l-4 ${borderColor} ${bgColor} ${task.completed ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'} ${snapshot.isDragging ? 'shadow-lg' : ''}`}
                              style={provided.draggableProps.style}
                            >
                              <div className="flex items-start gap-1">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleComplete(task.id, task.completed);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-0.5 cursor-pointer accent-rose-600 flex-shrink-0"
                                />
                                <span className={`${task.completed ? 'line-through text-slate-500' : 'text-slate-900'} line-clamp-2 break-words`}>
                                  {task.task_title}
                                </span>
                              </div>
                            </div>
                            );
                          }}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {dayTasks.length > 3 && !expandedDays.has(day) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDays(prev => new Set([...prev, day]));
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium text-center w-full py-1 hover:underline"
                        >
                          +{dayTasks.length - 3} more
                        </button>
                      )}
                      {expandedDays.has(day) && dayTasks.length > 3 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedDays(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(day);
                              return newSet;
                            });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium text-center w-full py-1 hover:underline"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </Droppable>
          );
        })}
        </div>
      </div>
    </DragDropContext>
  );
}

// Timeline Day View Component
function DayTimelineView({ date, tasks, onAddTask, onToggleComplete, onDeleteTask, onTaskClick }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [selectedTime, setSelectedTime] = useState('');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartHour, setDragStartHour] = useState(null);
  const [dragEndHour, setDragEndHour] = useState(null);

  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // 7 AM to 10 PM

  const formatHour = (hour) => {
    if (hour === 12) return '12 PM';
    if (hour === 0) return '12 AM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  const handleAdd = async () => {
    if (!newTaskTitle.trim()) return;

    setIsUploading(true);
    const dateStr = date.toISOString().split('T')[0];
    await onAddTask(dateStr, newTaskTitle, newTaskDescription, newTaskPriority, attachmentFile, selectedTime);

    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setSelectedTime('');
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAddForm(false);
    setIsUploading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setAttachmentFile(file);
      } else {
        alert('Please select a PDF file');
        e.target.value = '';
      }
    }
  };

  const getPriorityColor = (priority, createdByGrade) => {
    const isManagerOrIP = createdByGrade === 'IP' || createdByGrade === 'Manager';
    
    if (isManagerOrIP) {
      switch (priority) {
        case 'high': return 'border-l-4 border-purple-600 bg-purple-100';
        case 'medium': return 'border-l-4 border-indigo-500 bg-indigo-100';
        case 'low': return 'border-l-4 border-purple-400 bg-purple-50';
        default: return 'border-l-4 border-indigo-300 bg-indigo-50';
      }
    } else {
      switch (priority) {
        case 'high': return 'border-l-4 border-red-500 bg-red-50';
        case 'medium': return 'border-l-4 border-amber-500 bg-amber-50';
        case 'low': return 'border-l-4 border-blue-500 bg-blue-50';
        default: return 'border-l-4 border-slate-300';
      }
    }
  };

  const getPriorityBadgeColor = (priority, createdByGrade) => {
    const isManagerOrIP = createdByGrade === 'IP' || createdByGrade === 'Manager';
    
    if (isManagerOrIP) {
      switch (priority) {
        case 'high': return 'bg-purple-600 text-white border-purple-700';
        case 'medium': return 'bg-indigo-500 text-white border-indigo-600';
        case 'low': return 'bg-purple-400 text-white border-purple-500';
        default: return 'bg-indigo-300 text-white border-indigo-400';
      }
    } else {
      switch (priority) {
        case 'high': return 'bg-red-600 text-white border-red-700';
        case 'medium': return 'bg-amber-500 text-white border-amber-600';
        case 'low': return 'bg-blue-500 text-white border-blue-600';
        default: return 'bg-slate-400 text-white border-slate-500';
      }
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Med';
      case 'low': return 'Low';
      default: return 'Med';
    }
  };

  const handleMouseDown = (hour) => {
    setIsDragging(true);
    setDragStartHour(hour);
    setDragEndHour(hour);
  };

  const handleMouseEnter = (hour) => {
    if (isDragging) {
      setDragEndHour(hour);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStartHour !== null) {
      const startHour = Math.min(dragStartHour, dragEndHour);
      const endHour = Math.max(dragStartHour, dragEndHour);
      
      setSelectedTime(`${startHour}:00`);
      setShowAddForm(true);
      
      setIsDragging(false);
      setDragStartHour(null);
      setDragEndHour(null);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleMouseUp();
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging, dragStartHour, dragEndHour]);

  const isInDragRange = (hour) => {
    if (!isDragging || dragStartHour === null || dragEndHour === null) return false;
    const min = Math.min(dragStartHour, dragEndHour);
    const max = Math.max(dragStartHour, dragEndHour);
    return hour >= min && hour <= max;
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header with Add Button */}
      <div className="border-b border-slate-200 p-4 flex items-center justify-between bg-slate-50">
        <h3 className="font-semibold text-slate-900">
          {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-white"
          disabled={isUploading}
        >
          {showAddForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          {showAddForm ? 'Cancel' : 'Add Task'}
        </Button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="bg-blue-50 p-4 border-b border-slate-200 space-y-3">
          <Input
            placeholder="Task title"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="bg-white"
            disabled={isUploading}
          />
          <Input
            placeholder="Description (optional)"
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            className="bg-white"
            disabled={isUploading}
          />
          <div className="flex gap-2">
            <Select value={newTaskPriority} onValueChange={setNewTaskPriority} disabled={isUploading}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTime} onValueChange={setSelectedTime} disabled={isUploading}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Time (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Day</SelectItem>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={`${hour}:00`}>
                    {formatHour(hour)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="day-timeline-file-input"
                disabled={isUploading}
              />
              <label
                htmlFor="day-timeline-file-input"
                className={`flex items-center justify-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm cursor-pointer hover:bg-slate-100 transition-colors h-10 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Paperclip className="w-4 h-4" />
                {attachmentFile ? attachmentFile.name : 'Attach PDF'}
              </label>
            </div>
          </div>
          <Button
            onClick={handleAdd}
            className="w-full bg-rose-600 hover:bg-rose-700"
            disabled={isUploading || !newTaskTitle.trim()}
          >
            {isUploading ? 'Adding...' : 'Add Task'}
          </Button>
        </div>
      )}

      {/* Timeline Grid */}
      <div className="grid grid-cols-[100px_1fr]">
        {/* Time slots */}
        {hours.map((hour) => {
          const hourTasks = tasks.filter(task => task.time === `${hour}:00`);
          
          return (
            <React.Fragment key={hour}>
              {/* Time label */}
              <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 bg-slate-50">
                {formatHour(hour)}
              </div>
              
              {/* Task area */}
              <div 
                className={`border-b border-l border-slate-200 p-2 min-h-[60px] transition-colors cursor-pointer select-none ${
                  isInDragRange(hour) ? 'bg-rose-200 border-rose-400' : 'bg-white hover:bg-rose-50'
                }`}
                onMouseDown={() => handleMouseDown(hour)}
                onMouseEnter={() => handleMouseEnter(hour)}
              >
                {hourTasks.length > 0 && (
                  <div className="space-y-2">
                    {hourTasks.map((task) => {
                      const isManagerOrIP = task.created_by_grade === 'IP' || task.created_by_grade === 'Manager';
                      
                      return (
                        <div
                          key={task.id}
                          className={`p-2 rounded-lg ${getPriorityColor(task.priority, task.created_by_grade)} ${
                            task.completed ? 'opacity-60' : ''
                          } cursor-pointer hover:shadow-md transition-shadow relative`}
                          onClick={() => onTaskClick(task)}
                        >
                          {/* Top right badges */}
                          <div className="absolute top-1 right-1 flex items-center gap-1">
                            <Badge className={`${getPriorityBadgeColor(task.priority, task.created_by_grade)} text-xs px-1.5 py-0 h-4 font-bold border`}>
                              {getPriorityLabel(task.priority)}
                            </Badge>
                            {isManagerOrIP && (
                              <Badge className="bg-purple-700 text-white text-xs px-1.5 py-0 h-4 border border-purple-800">
                                {task.created_by_grade}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-start gap-2 pr-20">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleComplete(task.id, task.completed);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-0.5 cursor-pointer accent-rose-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                {task.task_title}
                              </p>
                              {task.task_description && (
                                <p className="text-xs text-slate-600 mt-0.5">{task.task_description}</p>
                              )}
                              {task.attachment_url && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                                  <Paperclip className="w-3 h-3" />
                                  <span>Has attachment</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* All Day Tasks Section */}
      <div className="border-t-2 border-slate-300 bg-slate-50">
        <div className="grid grid-cols-[100px_1fr]">
          <div className="px-4 py-3 text-sm font-semibold text-slate-700 bg-slate-100">
            All Day
          </div>
          <div className="border-l border-slate-300 p-3 space-y-2">
            {tasks.filter(task => !task.time).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No all-day tasks</p>
            ) : (
              tasks.filter(task => !task.time).map((task) => {
                const isManagerOrIP = task.created_by_grade === 'IP' || task.created_by_grade === 'Manager';
                
                return (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg ${getPriorityColor(task.priority, task.created_by_grade)} ${
                      task.completed ? 'opacity-60' : ''
                    } cursor-pointer hover:shadow-md transition-shadow relative`}
                    onClick={() => onTaskClick(task)}
                  >
                    {/* Top right badges */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      <Badge className={`${getPriorityBadgeColor(task.priority, task.created_by_grade)} text-xs px-2 py-0 h-5 font-bold border`}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
                      {isManagerOrIP && (
                        <Badge className="bg-purple-700 text-white text-xs px-2 py-0 h-5 border border-purple-800">
                          {task.created_by_grade}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-3 pr-24">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task.id, task.completed);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 cursor-pointer accent-rose-600 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.task_title}
                        </p>
                        {task.task_description && (
                          <p className="text-xs text-slate-600 mt-1">{task.task_description}</p>
                        )}
                        {task.attachment_url && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 mt-2">
                            <Paperclip className="w-3 h-3" />
                            <span>Has attachment</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// New component for day column in To Do List (used in week view)
function DayColumn({ day, date, isToday, tasks, onAddTask, onToggleComplete, onDeleteTask, onTaskClick, isSelected, onSelectDay }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAdd = async () => {
    if (!newTaskTitle.trim()) return;

    setIsUploading(true);
    const dateStr = date.toISOString().split('T')[0];
    await onAddTask(dateStr, newTaskTitle, newTaskDescription, newTaskPriority, attachmentFile);

    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setAttachmentFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setShowAddForm(false);
    setIsUploading(false);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setAttachmentFile(file);
      } else {
        alert('Please select a PDF file');
        e.target.value = '';
      }
    }
  };

  const getPriorityColor = (priority, createdByGrade) => {
    // Check if task was created by IP or Manager
    const isManagerOrIP = createdByGrade === 'IP' || createdByGrade === 'Manager';
    
    if (isManagerOrIP) {
      // Purple/indigo theme for manager/IP created tasks
      switch (priority) {
        case 'high': return 'border-l-4 border-purple-600 bg-purple-100';
        case 'medium': return 'border-l-4 border-indigo-500 bg-indigo-100';
        case 'low': return 'border-l-4 border-purple-400 bg-purple-50';
        default: return 'border-l-4 border-indigo-300 bg-indigo-50';
      }
    } else {
      // Original color scheme for regular users
      switch (priority) {
        case 'high': return 'border-l-4 border-red-500 bg-red-50';
        case 'medium': return 'border-l-4 border-amber-500 bg-amber-50';
        case 'low': return 'border-l-4 border-blue-500 bg-blue-50';
        default: return 'border-l-4 border-slate-300';
      }
    }
  };

  const getPriorityBadgeColor = (priority, createdByGrade) => {
    const isManagerOrIP = createdByGrade === 'IP' || createdByGrade === 'Manager';
    
    if (isManagerOrIP) {
      // Purple theme for manager/IP tasks
      switch (priority) {
        case 'high': return 'bg-purple-600 text-white border-purple-700';
        case 'medium': return 'bg-indigo-500 text-white border-indigo-600';
        case 'low': return 'bg-purple-400 text-white border-purple-500';
        default: return 'bg-indigo-300 text-white border-indigo-400';
      }
    } else {
      // Original color scheme
      switch (priority) {
        case 'high': return 'bg-red-600 text-white border-red-700';
        case 'medium': return 'bg-amber-500 text-white border-amber-600';
        case 'low': return 'bg-blue-500 text-white border-blue-600';
        default: return 'bg-slate-400 text-white border-slate-500';
      }
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'high': return 'High';
      case 'medium': return 'Med';
      case 'low': return 'Low';
      default: return 'Med';
    }
  };

  const dateStr = date.toISOString().split('T')[0];

  return (
    <Card 
      onClick={onSelectDay}
      className={`${isSelected ? 'border-2 border-rose-500' : 'border-slate-200'} flex flex-col h-full cursor-pointer hover:shadow-lg transition-shadow`}
    >
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">
              {day} {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setShowAddForm(!showAddForm);
            }}
            className="h-8 w-8 p-0"
            disabled={isUploading}
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <Droppable droppableId={dateStr}>
        {(provided, snapshot) => (
          <CardContent 
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 space-y-2 overflow-y-auto px-4 py-3 ${snapshot.isDraggingOver ? 'bg-rose-50' : ''}`}
          >
        {showAddForm && (
          <div className="bg-slate-50 p-3 rounded-lg space-y-2 mb-3 shadow-inner">
            <Input
              placeholder="Task title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="h-8 text-sm"
              disabled={isUploading}
            />
            <Input
              placeholder="Description (optional)"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              className="h-8 text-sm"
              disabled={isUploading}
            />
            <Select value={newTaskPriority} onValueChange={setNewTaskPriority} disabled={isUploading}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Priority</SelectItem>
                <SelectItem value="medium">Medium Priority</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id={`file-input-${day}`}
                disabled={isUploading}
              />
              <label
                htmlFor={`file-input-${day}`}
                className={`flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-md text-sm cursor-pointer hover:bg-slate-100 transition-colors ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Paperclip className="w-4 h-4" />
                {attachmentFile ? attachmentFile.name : 'Attach PDF (optional)'}
              </label>
            </div>
            <Button
              onClick={handleAdd}
              size="sm"
              className="w-full bg-rose-600 hover:bg-rose-700 h-8"
              disabled={isUploading}
            >
              {isUploading ? 'Adding...' : 'Add Task'}
            </Button>
          </div>
        )}

        {tasks.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No tasks</p>
        ) : (
          tasks.map((task, index) => {
            const isManagerOrIP = task.created_by_grade === 'IP' || task.created_by_grade === 'Manager';
            
            return (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`p-2 rounded ${getPriorityColor(task.priority, task.created_by_grade)} ${
                      task.completed ? 'opacity-60' : ''
                    } cursor-pointer hover:shadow-md transition-shadow relative ${
                      snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskClick(task);
                    }}
                  >
                    {/* Top right badges: Priority and Grade */}
                    <div className="absolute top-1 right-1 flex items-center gap-1">
                      {/* Priority Badge */}
                      <Badge className={`${getPriorityBadgeColor(task.priority, task.created_by_grade)} text-[10px] px-1.5 py-0 h-4 font-bold border`}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
                      
                      {/* Badge indicator for Manager/IP tasks */}
                      {isManagerOrIP && (
                        <Badge className="bg-purple-700 text-white text-[10px] px-1.5 py-0 h-4 border border-purple-800">
                          {task.created_by_grade}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-start gap-2 pr-16">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task.id, task.completed);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 cursor-pointer accent-rose-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${task.completed ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {task.task_title}
                        </p>
                        {task.task_description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{task.task_description}</p>
                        )}
                        {task.attachment_url && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                            <Paperclip className="w-3 h-3" />
                            <span>Has attachment</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            );
          })
        )}
        {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
}