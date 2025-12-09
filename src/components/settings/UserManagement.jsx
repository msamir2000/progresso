import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Shield, User, Search, Pencil, Save, X, Settings, Trash2, MoreVertical, AlertCircle, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown, Upload, Eye, Edit3 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import SignatureDrawDialog from './SignatureDrawDialog';


const GRADES = ['IP', 'Manager', 'Case Admin', 'Cashier'];

const ACCESS_MODULES = [
  { id: 'dashboard', name: 'Dashboard', description: 'View dashboard and case overview' },
  { id: 'cases', name: 'Cases', description: 'Create and manage cases' },
  { id: 'creditors', name: 'Creditors', description: 'Manage creditor information' },
  { id: 'employees', name: 'Employees', description: 'Manage employee data and RPS claims' },
  { id: 'cashiering_main', name: 'Cashiering (Main)', description: 'Access main cashiering summary view' },
  { id: 'cashiering_case', name: 'Cashiering (Case View)', description: 'Access cashiering within case details' },
  { id: 'approve_transactions', name: 'Approve Transactions', description: 'Approve cashiering transactions' },
  { id: 'documents', name: 'Documents', description: 'Upload and manage documents' },
  { id: 'reports', name: 'Reports', description: 'Generate reports (SIP 6, etc.)' },
  { id: 'the_johnson', name: 'The Johnson AI', description: 'Access AI assistant' },
  { id: 'timesheets', name: 'Timesheets', description: 'Submit and manage timesheets' },
  { id: 'approve_timesheets', name: 'Approve Timesheets', description: 'Approve team timesheets' },
  { id: 'practice_consul', name: 'Practice Consul', description: 'Access practice management tools' },
  { id: 'settings', name: 'Settings', description: 'Access and modify settings' },
  { id: 'user_management', name: 'User Management', description: 'Manage users and permissions' },
  { id: 'read_all_users', name: 'Read All Users', description: 'View all users in the system (enables dropdowns in forms)' },
];

// Default permissions for each grade
const DEFAULT_PERMISSIONS = {
  IP: ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_main', 'cashiering_case', 'approve_transactions', 'documents', 'reports', 'the_johnson', 'timesheets', 'approve_timesheets', 'practice_consul', 'settings', 'user_management', 'read_all_users'],
  Manager: ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_main', 'cashiering_case', 'approve_transactions', 'documents', 'reports', 'the_johnson', 'timesheets', 'approve_timesheets', 'practice_consul', 'read_all_users'],
  'Case Admin': ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_case', 'documents', 'reports', 'the_johnson', 'timesheets', 'read_all_users'],
  Cashier: ['dashboard', 'cases', 'cashiering_main', 'cashiering_case', 'documents', 'timesheets']
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUser, setEditingUser] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [gradeSortOrder, setGradeSortOrder] = useState(null); // null | 'asc' | 'desc'
  const [isUploadingSignature, setIsUploadingSignature] = useState(null); // userId being uploaded
  const [isApplyingGeneric, setIsApplyingGeneric] = useState(false);
  const [genericSignatureUrl, setGenericSignatureUrl] = useState(null);
  const [showDrawDialog, setShowDrawDialog] = useState(null); // userId or 'generic'

  // Permissions state
  const [gradePermissions, setGradePermissions] = useState(DEFAULT_PERMISSIONS);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [permissionConfigId, setPermissionConfigId] = useState(null);

  useEffect(() => {
    loadUsers();
    loadPermissions();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Simply load all users from the User entity
      const userList = await base44.entities.User.list('-created_date', 1000);
      
      console.log('=== USER LOADING ===');
      console.log('Total users loaded:', userList.length);
      console.log('Users by grade:', {
        IP: userList.filter(u => u.grade === 'IP').length,
        Manager: userList.filter(u => u.grade === 'Manager').length,
        'Case Admin': userList.filter(u => u.grade === 'Case Admin').length,
        Cashier: userList.filter(u => u.grade === 'Cashier').length
      });
      console.log('===================');
      
      setUsers(userList || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      // Load permissions from PermissionConfiguration entity
      const configs = await base44.entities.PermissionConfiguration.list('', 1);

      if (configs && configs.length > 0) {
        const config = configs[0];
        setPermissionConfigId(config.id);
        setGradePermissions(config.grade_permissions || DEFAULT_PERMISSIONS);
      } else {
        // No configuration exists yet, use defaults
        setGradePermissions(DEFAULT_PERMISSIONS);
      }
    } catch (err) {
      console.error('Error loading permissions:', err);
      // Fall back to defaults if error
      setGradePermissions(DEFAULT_PERMISSIONS);
    }
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setEditingUser({
      ...user, // Include the entire user object
      full_name: user.full_name,
      grade: user.grade || 'Case Admin',
      hourly_rate: user.hourly_rate || 0
    });
    setError(null);
  };

  const handleSaveEdit = async (userId) => {
    setIsSaving(true);
    setError(null);

    try {
      // Get the full user object from the users array
      const currentUserData = users.find(u => u.id === userId);

      if (!currentUserData) {
        throw new Error('User not found');
      }

      // Update with the full user data, only changing what was edited
      await base44.entities.User.update(userId, {
        ...currentUserData, // Include all existing user data
        full_name: editingUser.full_name.trim(),
        grade: editingUser.grade,
        hourly_rate: parseFloat(editingUser.hourly_rate) || 0
      });

      setSuccessMessage('User updated successfully');
      setTimeout(() => setSuccessMessage(''), 3000);

      setEditingUserId(null);
      setEditingUser({});
      await loadUsers();
    } catch (err) {
      console.error('Error updating user:', err);
      setError(`Failed to update user: ${err.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUser({});
    setError(null);
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await base44.entities.User.delete(user.id);
      setSuccessMessage(`User ${user.full_name} deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. Please try again.');
    }
  };

  const handleSignatureUpload = async (userId, file) => {
    if (!file) return;

    setIsUploadingSignature(userId);
    setError(null);

    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed');
      }

      const currentUserData = users.find(u => u.id === userId);
      if (!currentUserData) {
        throw new Error('User not found');
      }

      await base44.entities.User.update(userId, {
        ...currentUserData,
        signature_image_url: uploadResult.file_url
      });

      setSuccessMessage('Signature uploaded successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowDrawDialog(null);
      await loadUsers();
    } catch (err) {
      console.error('Error uploading signature:', err);
      setError('Failed to upload signature. Please try again.');
    } finally {
      setIsUploadingSignature(null);
    }
  };

  const handleRemoveSignature = async (userId) => {
    if (!confirm('Are you sure you want to remove this signature?')) {
      return;
    }

    try {
      const currentUserData = users.find(u => u.id === userId);
      if (!currentUserData) {
        throw new Error('User not found');
      }

      await base44.entities.User.update(userId, {
        ...currentUserData,
        signature_image_url: null
      });

      setSuccessMessage('Signature removed successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
      await loadUsers();
    } catch (err) {
      console.error('Error removing signature:', err);
      setError('Failed to remove signature. Please try again.');
    }
  };

  const handleGenericSignatureUpload = async (file) => {
    if (!file) return;

    setIsUploadingSignature('generic');
    setError(null);

    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed');
      }

      setGenericSignatureUrl(uploadResult.file_url);
      setSuccessMessage('Generic signature uploaded. Click "Apply" to assign it to all IPs and Cashiers.');
      setTimeout(() => setSuccessMessage(''), 5000);
      setShowDrawDialog(null);
    } catch (err) {
      console.error('Error uploading generic signature:', err);
      setError('Failed to upload generic signature. Please try again.');
    } finally {
      setIsUploadingSignature(null);
    }
  };

  const handleApplyGenericSignature = async () => {
    if (!genericSignatureUrl) {
      setError('Please upload a generic signature first.');
      return;
    }

    const targetUsers = users.filter(u => u.grade === 'IP' || u.grade === 'Cashier');

    if (targetUsers.length === 0) {
      setError('No IP or Cashier users found.');
      return;
    }

    if (!confirm(`This will update the signature for ${targetUsers.length} user(s) (IPs and Cashiers). Continue?`)) {
      return;
    }

    setIsApplyingGeneric(true);
    setError(null);

    try {
      for (const user of targetUsers) {
        await base44.entities.User.update(user.id, {
          ...user,
          signature_image_url: genericSignatureUrl
        });
      }

      setSuccessMessage(`Generic signature applied to ${targetUsers.length} user(s) successfully!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setGenericSignatureUrl(null);
      await loadUsers();
    } catch (err) {
      console.error('Error applying generic signature:', err);
      setError('Failed to apply generic signature to all users. Please try again.');
    } finally {
      setIsApplyingGeneric(false);
    }
  };

  const handleTogglePermission = (grade, moduleId) => {
    setGradePermissions(prev => {
      const currentPermissions = prev[grade] || [];
      const hasPermission = currentPermissions.includes(moduleId);

      return {
        ...prev,
        [grade]: hasPermission
          ? currentPermissions.filter(id => id !== moduleId)
          : [...currentPermissions, moduleId]
      };
    });
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    setError(null);

    try {
      const currentUser = await base44.auth.me();

      const permissionData = {
        config_name: 'Default',
        grade_permissions: gradePermissions,
        last_updated_by: currentUser.email,
        last_updated_date: new Date().toISOString()
      };

      if (permissionConfigId) {
        // Update existing configuration
        await base44.entities.PermissionConfiguration.update(permissionConfigId, permissionData);
      } else {
        // Create new configuration
        const newConfig = await base44.entities.PermissionConfiguration.create(permissionData);
        setPermissionConfigId(newConfig.id);
      }

      setSuccessMessage('Permissions saved successfully and are now active');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving permissions:', err);
      setError('Failed to save permissions. Please try again.');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const handleGradeSort = () => {
    if (gradeSortOrder === null || gradeSortOrder === 'desc') {
      setGradeSortOrder('asc');
    } else {
      setGradeSortOrder('desc');
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sort by grade if sort order is set
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (gradeSortOrder === null) return 0;
    
    // Define a custom order for grades
    const gradeOrder = { 'IP': 1, 'Manager': 2, 'Case Admin': 3, 'Cashier': 4 };
    const gradeA = gradeOrder[a.grade] || 999; // Assign a high value for undefined grades
    const gradeB = gradeOrder[b.grade] || 999;
    
    if (gradeSortOrder === 'asc') {
      return gradeA - gradeB;
    } else {
      return gradeB - gradeA;
    }
  });

  const getGradeBadgeColor = (grade) => {
    const colors = {
      IP: 'bg-purple-100 text-purple-800',
      Manager: 'bg-blue-100 text-blue-800',
      'Case Admin': 'bg-green-100 text-green-800',
      Cashier: 'bg-orange-100 text-orange-800'
    };
    return colors[grade] || 'bg-slate-100 text-slate-800';
  };

  const getUsersByGrade = (grade) => users.filter(u => u.grade === grade).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="permissions" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Grade Permissions
              </TabsTrigger>
            </TabsList>

            {/* Search Bar - Compact */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
          </div>

          {/* Grade Stats */}
          <div className="flex items-center gap-3">
            {GRADES.map((grade, index) => {
              const colors = [
                { bg: 'bg-purple-100', text: 'text-purple-600', icon: 'bg-purple-600' },
                { bg: 'bg-blue-100', text: 'text-blue-600', icon: 'bg-blue-600' },
                { bg: 'bg-green-100', text: 'text-green-600', icon: 'bg-green-600' },
                { bg: 'bg-orange-100', text: 'text-orange-600', icon: 'bg-orange-600' }
              ][index];

              return (
                <div key={grade} className={`${colors.bg} rounded-lg px-4 py-3 min-w-[80px]`}>
                  <div className="flex flex-col items-center">
                    <p className="text-xs text-slate-600 font-medium mb-1">{grade}</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {getUsersByGrade(grade)}
                    </p>
                    <Shield className={`w-5 h-5 ${colors.text} mt-1`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6 mt-6">
          {/* Success Message */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Information Box about Inviting Users */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-blue-900 mb-2">Inviting New Users</h4>
                  <p className="text-sm text-blue-800 mb-3">
                    To invite new users to the system, please use the base44 Dashboard. Users must be invited through the platform's secure invitation system.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <span className="font-medium">Steps:</span>
                    <span>Dashboard → Settings → Users → Invite User</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">
                    Once invited, users will appear in this table where you can manage their profiles, grades, and permissions.
                  </p>
                </div>
                <ExternalLink className="w-4 h-4 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          {/* Generic Signature Upload for IPs and Cashiers */}
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Upload className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-purple-900 mb-2">Generic Signature for IPs & Cashiers</h4>
                  <p className="text-sm text-purple-800 mb-3">
                    Upload a generic signature image to apply to all users with IP or Cashier grade.
                  </p>
                  <div className="flex items-center gap-3">
                    {genericSignatureUrl ? (
                      <>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                          <Upload className="w-3 h-3 mr-1" />
                          Signature Ready
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(genericSignatureUrl, '_blank')}
                          className="h-8"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button
                          onClick={handleApplyGenericSignature}
                          disabled={isApplyingGeneric}
                          className="h-8 bg-purple-600 hover:bg-purple-700"
                        >
                          {isApplyingGeneric ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            <>
                              Apply to All IPs & Cashiers
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGenericSignatureUrl(null)}
                          className="h-8"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setShowDrawDialog('generic')}
                          className="h-8"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Draw Signature
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('generic-signature-upload').click()}
                          className="h-8"
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Upload File
                        </Button>
                        <Input
                          id="generic-signature-upload"
                          type="file"
                          accept=".png,.jpg,.jpeg"
                          onChange={(e) => handleGenericSignatureUpload(e.target.files?.[0])}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {sortedUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <User className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-medium">No users found</p>
                  {searchTerm && (
                    <p className="text-sm">Try a different search term</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="font-semibold text-slate-700">Name</TableHead>
                        <TableHead className="font-semibold text-slate-700">Email</TableHead>
                        <TableHead className="font-semibold text-slate-700">
                          <button
                            onClick={handleGradeSort}
                            className="flex items-center gap-2 hover:text-slate-900 transition-colors"
                          >
                            Grade
                            {gradeSortOrder === null && <ArrowUpDown className="w-4 h-4" />}
                            {gradeSortOrder === 'asc' && <ArrowUp className="w-4 h-4" />}
                            {gradeSortOrder === 'desc' && <ArrowDown className="w-4 h-4" />}
                          </button>
                        </TableHead>
                        <TableHead className="font-semibold text-slate-700">Hourly Rate</TableHead>
                        <TableHead className="font-semibold text-slate-700">Signature</TableHead>
                        <TableHead className="font-semibold text-slate-700">Joined</TableHead>
                        <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedUsers.map((user) => (
                        <TableRow key={user.id || user.email} className="hover:bg-slate-50">
                          <TableCell>
                            {editingUserId === user.id ? (
                              <Input
                                value={editingUser.full_name}
                                onChange={(e) => setEditingUser(prev => ({ ...prev, full_name: e.target.value }))}
                                className="h-8"
                                disabled={isSaving}
                              />
                            ) : (
                              <span className="font-medium text-slate-900">{user.full_name}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">{user.email}</TableCell>
                          <TableCell>
                            {editingUserId === user.id ? (
                              <Select
                                value={editingUser.grade}
                                onValueChange={(value) => setEditingUser(prev => ({ ...prev, grade: value }))}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="h-8 w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {GRADES.map(grade => (
                                    <SelectItem key={grade} value={grade}>{grade}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge className={getGradeBadgeColor(user.grade)}>
                                {user.grade || 'Not Set'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingUserId === user.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-600">£</span>
                                <Input
                                  type="number"
                                  value={editingUser.hourly_rate}
                                  onChange={(e) => setEditingUser(prev => ({ ...prev, hourly_rate: e.target.value }))}
                                  className="h-8 w-24"
                                  disabled={isSaving}
                                  min="0"
                                  step="1"
                                />
                              </div>
                            ) : (
                              <span className="text-slate-700 font-medium">
                                {user.hourly_rate ? `£${user.hourly_rate.toFixed(0)}` : '—'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.signature_image_url ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                  <Upload className="w-3 h-3 mr-1" />
                                  Uploaded
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => window.open(user.signature_image_url, '_blank')}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-red-600 hover:text-red-700"
                                  onClick={() => handleRemoveSignature(user.id)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowDrawDialog(user.id)}
                                  disabled={isUploadingSignature === user.id}
                                  className="h-7 text-xs"
                                >
                                  <Edit3 className="w-3 h-3 mr-1" />
                                  Draw
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => document.getElementById(`signature-upload-${user.id}`).click()}
                                  disabled={isUploadingSignature === user.id}
                                  className="h-7 text-xs"
                                >
                                  <Upload className="w-3 h-3 mr-1" />
                                  Upload
                                </Button>
                                <Input
                                  id={`signature-upload-${user.id}`}
                                  type="file"
                                  accept=".png,.jpg,.jpeg"
                                  onChange={(e) => handleSignatureUpload(user.id, e.target.files?.[0])}
                                  className="hidden"
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {user.created_date ? new Date(user.created_date).toLocaleDateString('en-GB') : 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">
                            {editingUserId === user.id ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveEdit(user.id)}
                                  disabled={isSaving}
                                  className="h-8 px-2 bg-green-600 hover:bg-green-700"
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  disabled={isSaving}
                                  className="h-8 px-2"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {user.id && ( // Only allow editing if user has an ID (i.e., from User entity)
                                    <DropdownMenuItem onClick={() => handleEditUser(user)}>
                                      <Pencil className="w-4 h-4 mr-2" />
                                      Edit User
                                    </DropdownMenuItem>
                                  )}
                                  {user.id && <DropdownMenuSeparator />} {/* Separator only if editable */}
                                  {user.id && ( // Only allow deleting if user has an ID (i.e., from User entity)
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteUser(user)}
                                      className="text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Delete User
                                    </DropdownMenuItem>
                                  )}
                                  {!user.id && ( // Show a disabled item if not an editable user from User entity
                                     <DropdownMenuItem disabled>
                                      <AlertCircle className="w-4 h-4 mr-2 text-yellow-600" />
                                      Derived User (Cannot Edit)
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Grade Permissions</h2>
              <p className="text-sm text-slate-600 mt-1">
                Configure what each grade can access in the application. Changes are saved to the database and enforced across the app.
              </p>
            </div>
            <Button
              onClick={handleSavePermissions}
              disabled={isSavingPermissions}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSavingPermissions ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Permissions
                </>
              )}
            </Button>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-300">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700 text-sm">Access Module</th>
                      {GRADES.map(grade => (
                        <th key={grade} className="text-center py-2 px-3 font-semibold text-slate-700 text-sm w-24">
                          <Badge className={getGradeBadgeColor(grade)} variant="outline">{grade}</Badge>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ACCESS_MODULES.map((module) => (
                      <tr key={module.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 text-sm">{module.name}</span>
                            <span className="text-xs text-slate-500">• {module.description}</span>
                          </div>
                        </td>
                        {GRADES.map(grade => (
                          <td key={`${grade}-${module.id}`} className="text-center py-2 px-3">
                            <Checkbox
                                checked={gradePermissions[grade]?.includes(module.id)}
                                onCheckedChange={() => handleTogglePermission(grade, module.id)}
                              />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Signature Draw Dialog */}
      <SignatureDrawDialog
        isOpen={showDrawDialog !== null}
        onClose={() => setShowDrawDialog(null)}
        onSave={(file) => {
          if (showDrawDialog === 'generic') {
            handleGenericSignatureUpload(file);
          } else {
            handleSignatureUpload(showDrawDialog, file);
          }
        }}
        isUploading={isUploadingSignature !== null}
        userName={showDrawDialog && showDrawDialog !== 'generic' ? users.find(u => u.id === showDrawDialog)?.full_name : null}
      />
    </div>
  );
}