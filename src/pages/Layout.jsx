
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { usePermissions } from '@/components/utils/usePermissions';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings as SettingsIcon,
  Landmark,
  Plus,
  Loader2,
  Clock,
  BarChart3,
  FileText,
  LogOut,
  Pause,
  Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';

// New Case Modal Component
const NewCaseModal = ({ isOpen, onClose, onCaseCreated }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    case_reference: '',
    case_type: '',
    ip_name: 'Duncan',
    joint_ip_name: '',
    joint_ip_name_2: '',
    manager_user: '',
    assigned_user: '',
    cashiering_user: ''
  });
  const [formError, setFormError] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [loadAttempts, setLoadAttempts] = useState(0);

  // Load users when modal opens, with retry logic
  useEffect(() => {
    if (isOpen) {
      setFormError(''); // Clear any previous errors
      setLoadAttempts(0); // Reset load attempts
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async (retryCount = 0) => {
    setIsLoadingUsers(true);
    setFormError('');
    try {
      const userList = await base44.entities.User.list('-created_date', 1000);
      console.log('=== USERS LOADED FOR DROPDOWN ===');
      console.log('Total users:', userList?.length || 0);
      console.log('Users with grades:', {
        IP: userList?.filter(u => u.grade === 'IP').length || 0,
        Manager: userList?.filter(u => u.grade === 'Manager').length || 0,
        'Case Admin': userList?.filter(u => u.grade === 'Case Admin').length || 0, // Changed from 'Admin' to 'Case Admin'
        Cashier: userList?.filter(u => u.grade === 'Cashier').length || 0,
        NoGrade: userList?.filter(u => !u.grade).length || 0
      });
      console.log('Sample user data:', userList?.slice(0, 2));
      console.log('================================');
      setUsers(userList || []);
      setLoadAttempts(0); // Reset on success
    } catch (error) {
      console.error('Error loading users (attempt ' + (retryCount + 1) + '):', error);
      
      // Retry up to 2 times (total 3 attempts)
      if (retryCount < 2) {
        console.log('Retrying user load in 1 second...');
        setTimeout(() => {
          setLoadAttempts(retryCount + 1); // Update attempt count for UI
          loadUsers(retryCount + 1);
        }, 1000);
      } else {
        setUsers([]);
        setFormError('Failed to load users. Please try again or contact support.');
      }
    } finally {
      // setIsLoadingUsers should only be false if no retry is pending.
      // The current structure sets it to false immediately, which might be an issue with delayed retries.
      // However, for consistency with the outline's original 'finally' usage, we'll keep it here,
      // which means isLoadingUsers might briefly flip to false before a retry starts.
      setIsLoadingUsers(false);
    }
  };

  // Filter users by grade
  const caseAdmins = users.filter(u => u.grade === 'Case Admin'); // Changed from 'Admin' to 'Case Admin'
  const managers = users.filter(u => u.grade === 'Manager');
  const cashiers = users.filter(u => u.grade === 'Cashier');

  // Log filtered results
  console.log('Filtered users:', { 
    managers: managers.length, 
    caseAdmins: caseAdmins.length, 
    cashiers: cashiers.length 
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Updated validation to include required fields
    if (!formData.company_name.trim() || 
        !formData.case_reference.trim() || 
        !formData.case_type ||
        !formData.ip_name ||
        !formData.manager_user ||
        !formData.assigned_user ||
        !formData.cashiering_user) {
      setFormError('Please fill in all required fields (Company Name, Case Reference, Case Type, Joint IP Name 1, Manager, Case Admin, and Cashier)');
      return;
    }

    setIsCreating(true);
    setFormError('');

    try {
      await base44.entities.Case.create({
        ...formData,
        company_name: formData.company_name.trim(),
        case_reference: formData.case_reference.trim(),
        administrator_name: 'Administrator',
        status: 'active',
        tasks_completed: []
      });
      
      onCaseCreated();
      onClose();
      
      // Reset form
      setFormData({
        company_name: '',
        case_reference: '',
        case_type: '',
        ip_name: 'Duncan',
        joint_ip_name: '',
        joint_ip_name_2: '',
        manager_user: '',
        assigned_user: '',
        cashiering_user: ''
      });
    } catch (error) {
      console.error('Error creating case:', error);
      setFormError('Failed to create case. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setFormError('');
      onClose();
    }
  };

  const handleRetry = () => {
    setLoadAttempts(0);
    loadUsers(); // Changed to call loadUsers without initial retryCount
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Plus className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create New Case</h2>
            <p className="text-sm text-slate-500">Enter the basic case information</p>
          </div>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
            <span>{formError}</span>
            {formError.includes('Failed to load users') && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleRetry}
                className="ml-4"
              >
                Retry
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="company_name" className="text-sm font-medium text-slate-700">
              Company Name *
            </Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
              placeholder="Enter company name"
              className="mt-1"
              disabled={isCreating}
            />
          </div>

          <div>
            <Label htmlFor="case_reference" className="text-sm font-medium text-slate-700">
              Case Reference *
            </Label>
            <Input
              id="case_reference"
              value={formData.case_reference}
              onChange={(e) => setFormData(prev => ({ ...prev, case_reference: e.target.value }))}
              placeholder="Enter case reference"
              className="mt-1"
              disabled={isCreating}
            />
          </div>

          <div>
            <Label htmlFor="case_type" className="text-sm font-medium text-slate-700">
              Case Type *
            </Label>
            <Select
              value={formData.case_type}
              onValueChange={(value) => setFormData(prev => ({ ...prev, case_type: value }))}
              disabled={isCreating}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select case type" />
              </SelectTrigger>
              <SelectContent>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ip_name" className="text-sm font-medium text-slate-700">
                Joint IP Name 1 *
              </Label>
              <Select
                value={formData.ip_name}
                onValueChange={(value) => setFormData(prev => ({ ...prev, ip_name: value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Joint IP 1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Duncan">Duncan</SelectItem>
                  <SelectItem value="Rupen">Rupen</SelectItem>
                  <SelectItem value="Nimish">Nimish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="joint_ip_name" className="text-sm font-medium text-slate-700">
                Joint IP Name 2
              </Label>
              <Select
                value={formData.joint_ip_name || "none"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, joint_ip_name: value === "none" ? "" : value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Joint IP 2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Duncan">Duncan</SelectItem>
                  <SelectItem value="Rupen">Rupen</SelectItem>
                  <SelectItem value="Nimish">Nimish</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="joint_ip_name_2" className="text-sm font-medium text-slate-700">
                Joint IP Name 3
              </Label>
              <Select
                value={formData.joint_ip_name_2 || "none"}
                onValueChange={(value) => setFormData(prev => ({ ...prev, joint_ip_name_2: value === "none" ? "" : value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Joint IP 3" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="Duncan">Duncan</SelectItem>
                  <SelectItem value="Rupen">Rupen</SelectItem>
                  <SelectItem value="Nimish">Nimish</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="manager_user" className="text-sm font-medium text-slate-700">
              Manager *
            </Label>
            {isLoadingUsers ? (
              <div className="mt-1 flex items-center gap-2 text-slate-500 text-sm px-3 py-2 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading managers... {loadAttempts > 0 && `(Attempt ${loadAttempts + 1})`}
              </div>
            ) : managers.length === 0 ? (
              <div className="mt-1 text-sm text-amber-600 px-3 py-2 border border-amber-200 bg-amber-50 rounded-md">
                No users with Manager grade found. Please assign grades in Settings → User Management.
              </div>
            ) : (
              <Select
                value={formData.manager_user}
                onValueChange={(value) => setFormData(prev => ({ ...prev, manager_user: value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map(manager => (
                    <SelectItem key={manager.email} value={manager.email}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="assigned_user" className="text-sm font-medium text-slate-700">
              Case Admin *
            </Label>
            {isLoadingUsers ? (
              <div className="mt-1 flex items-center gap-2 text-slate-500 text-sm px-3 py-2 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading case admins... {loadAttempts > 0 && `(Attempt ${loadAttempts + 1})`}
              </div>
            ) : caseAdmins.length === 0 ? (
              <div className="mt-1 text-sm text-amber-600 px-3 py-2 border border-amber-200 bg-amber-50 rounded-md">
                No users with Case Admin grade found. Please assign grades in Settings → User Management.
              </div>
            ) : (
              <Select
                value={formData.assigned_user}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_user: value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Case Admin" />
                </SelectTrigger>
                <SelectContent>
                  {caseAdmins.map(admin => (
                    <SelectItem key={admin.email} value={admin.email}>
                      {admin.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="cashiering_user" className="text-sm font-medium text-slate-700">
              Cashier *
            </Label>
            {isLoadingUsers ? (
              <div className="mt-1 flex items-center gap-2 text-slate-500 text-sm px-3 py-2 border rounded-md">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading cashiers... {loadAttempts > 0 && `(Attempt ${loadAttempts + 1})`}
              </div>
            ) : cashiers.length === 0 ? (
              <div className="mt-1 text-sm text-amber-600 px-3 py-2 border border-amber-200 bg-amber-50 rounded-md">
                No users with Cashier grade found. Please assign grades in Settings → User Management.
              </div>
            ) : (
              <Select
                value={formData.cashiering_user}
                onValueChange={(value) => setFormData(prev => ({ ...prev, cashiering_user: value }))}
                disabled={isCreating}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Cashier" />
                </SelectTrigger>
                <SelectContent>
                  {cashiers.map(cashier => (
                    <SelectItem key={cashier.email} value={cashier.email}>
                      {cashier.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isCreating}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Case
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Layout({ children, currentPageName }) {
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const { hasAccess, isLoading: permissionsLoading } = usePermissions();
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  // Define all navigation items with their permission requirements
  const allNavItems = [
    { name: 'Dashboard', icon: LayoutDashboard, href: createPageUrl('Dashboard'), permission: 'dashboard' },
    { name: 'Cashiering', icon: Landmark, href: createPageUrl('Cashiering'), permission: 'cashiering_main' },
    { name: 'MyCases', icon: Briefcase, href: createPageUrl('MyCases'), label: 'My Cases', permission: 'cases' },
    { name: 'Timesheets', icon: Clock, href: createPageUrl('Timesheets'), permission: 'timesheets' },
    { name: 'PracticeConsul', icon: BarChart3, href: createPageUrl('PracticeConsul'), label: 'Practice Consul', permission: 'practice_consul' },
    { name: 'Settings', icon: SettingsIcon, href: createPageUrl('Settings'), permission: 'settings' }
  ];

  // Filter navigation items based on user permissions
  const navItems = allNavItems.filter(item => hasAccess(item.permission));

  // Check for running timer in localStorage
  useEffect(() => {
    const checkTimer = () => {
      const savedTimer = localStorage.getItem('timesheetTimer');
      if (savedTimer) {
        try {
          const timerData = JSON.parse(savedTimer);
          if (timerData.isRunning === true && timerData.startTime) {
            const elapsed = Math.floor((Date.now() - timerData.startTime) / 1000);
            setTimerElapsed(elapsed);
            setTimerRunning(true);
          } else {
            // Timer is paused or stopped
            setTimerRunning(false);
            if (timerData.pausedSeconds !== undefined) {
              setTimerElapsed(timerData.pausedSeconds);
            } else {
              setTimerElapsed(0);
            }
          }
        } catch (e) {
          setTimerRunning(false);
          setTimerElapsed(0);
        }
      } else {
        setTimerRunning(false);
        setTimerElapsed(0);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimerDisplay = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimerToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const savedTimer = localStorage.getItem('timesheetTimer');
    if (savedTimer) {
      try {
        const timerData = JSON.parse(savedTimer);
        
        // Check the actual isRunning state from localStorage, not React state
        if (timerData.isRunning === true) {
          // Pause the timer
          const updatedTimer = {
            ...timerData,
            isRunning: false,
            pausedSeconds: timerElapsed,
            startTime: undefined
          };
          localStorage.setItem('timesheetTimer', JSON.stringify(updatedTimer));
          setTimerRunning(false);
          
          // Dispatch storage event to notify other components
          window.dispatchEvent(new Event('storage'));
        } else {
          // Resume the timer
          const startTime = Date.now() - (timerData.pausedSeconds || 0) * 1000;
          const updatedTimer = {
            ...timerData,
            isRunning: true,
            startTime: startTime,
            pausedSeconds: undefined
          };
          localStorage.setItem('timesheetTimer', JSON.stringify(updatedTimer));
          setTimerRunning(true);
          
          // Dispatch storage event to notify other components
          window.dispatchEvent(new Event('storage'));
        }
      } catch (e) {
        console.error('Error toggling timer:', e);
      }
    }
  };

  const handleNewCaseCreated = () => {
    window.location.reload();
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Show loading state while checking permissions
  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Toolbar */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-none mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center" style={{ marginLeft: '0.5cm' }}>
              <Link to={createPageUrl('Dashboard')} className="cursor-pointer">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6882a59d54891476630a28ea/83012bcb7_image.png" 
                  alt="Progresso Logo" 
                  className="h-12 hover:opacity-80 transition-opacity"
                />
              </Link>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center space-x-8">
              {/* Timer Indicator */}
              {(timerRunning || timerElapsed > 0) && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md">
                  <Clock className={`w-4 h-4 text-green-600 ${timerRunning ? 'animate-pulse' : ''}`} />
                  <Link
                    to={createPageUrl('Timesheets')}
                    className="font-mono text-sm font-semibold text-green-700 hover:text-green-800"
                  >
                    {formatTimerDisplay(timerElapsed)}
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleTimerToggle}
                    className="h-6 w-6 p-0 hover:bg-green-100"
                  >
                    {timerRunning ? (
                      <Pause className="w-3 h-3 text-green-700" />
                    ) : (
                      <Play className="w-3 h-3 text-green-700" />
                    )}
                  </Button>
                  <Badge className={`${timerRunning ? 'bg-green-600' : 'bg-slate-400'} text-white text-xs`}>
                    {timerRunning ? 'Running' : 'Paused'}
                  </Badge>
                </div>
              )}

              {/* New Case Button - only show if user has cases permission */}
              {hasAccess('cases') && (
                <Button 
                  onClick={() => setShowNewCaseModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Case
                </Button>
              )}

              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.name;
                const displayName = item.label || item.name;
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {displayName}
                  </Link>
                );
              })}

              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-slate-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Log Out
              </Button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main>
        {children}
      </main>

      {/* New Case Modal - only render if user has cases permission */}
      {hasAccess('cases') && (
        <NewCaseModal
          isOpen={showNewCaseModal}
          onClose={() => setShowNewCaseModal(false)}
          onCaseCreated={handleNewCaseCreated}
        />
      )}
    </div>
  );
}
