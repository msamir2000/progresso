import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Custom hook to manage user permissions
 * Returns the current user, their permissions, and a function to check access
 */
export function usePermissions() {
  const [currentUser, setCurrentUser] = useState(null);
  const [gradePermissions, setGradePermissions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPermissionData();
  }, []);

  const loadPermissionData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load current user and permission configuration in parallel
      const [user, configs] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.PermissionConfiguration.list('', 1).catch(() => [])
      ]);

      setCurrentUser(user);

      // Set grade permissions from the configuration
      if (configs && configs.length > 0) {
        setGradePermissions(configs[0].grade_permissions || {});
      } else {
        // Fallback to default permissions if no config exists
        setGradePermissions({
          IP: ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_main', 'cashiering_case', 'approve_transactions', 'documents', 'reports', 'the_johnson', 'timesheets', 'approve_timesheets', 'practice_consul', 'settings', 'user_management'],
          Manager: ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_main', 'cashiering_case', 'approve_transactions', 'documents', 'reports', 'the_johnson', 'timesheets', 'approve_timesheets', 'practice_consul'],
          Admin: ['dashboard', 'cases', 'creditors', 'employees', 'cashiering_case', 'documents', 'reports', 'the_johnson', 'timesheets'],
          Cashier: ['dashboard', 'cases', 'cashiering_main', 'cashiering_case', 'documents', 'timesheets']
        });
      }
    } catch (err) {
      console.error('Error loading permission data:', err);
      setError(err.message || 'Failed to load permissions');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if the current user has access to a specific module
   * @param {string} moduleId - The module ID to check (e.g., 'dashboard', 'cases')
   * @returns {boolean} - True if user has access, false otherwise
   */
  const hasAccess = (moduleId) => {
    // If still loading or no user, deny access
    if (isLoading || !currentUser || !gradePermissions) {
      return false;
    }

    // If user has no grade, deny access (except to dashboard)
    if (!currentUser.grade) {
      return moduleId === 'dashboard';
    }

    // Check if the user's grade has permission for this module
    const userPermissions = gradePermissions[currentUser.grade] || [];
    return userPermissions.includes(moduleId);
  };

  /**
   * Check if the current user has a specific grade
   * @param {string|string[]} grades - Grade or array of grades to check
   * @returns {boolean} - True if user has one of the specified grades
   */
  const hasGrade = (grades) => {
    if (!currentUser || !currentUser.grade) return false;
    
    if (Array.isArray(grades)) {
      return grades.includes(currentUser.grade);
    }
    
    return currentUser.grade === grades;
  };

  return {
    currentUser,
    gradePermissions,
    isLoading,
    error,
    hasAccess,
    hasGrade,
    userGrade: currentUser?.grade || null
  };
}