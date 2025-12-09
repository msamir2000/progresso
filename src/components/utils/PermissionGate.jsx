import React from 'react';
import { usePermissions } from './usePermissions';

/**
 * Component that conditionally renders children based on permissions
 * Use this to hide buttons, sections, or any UI elements
 * 
 * @param {string} requiredPermission - The permission module ID required
 * @param {React.ReactNode} children - Content to render if permission granted
 * @param {React.ReactNode} fallback - Optional content to render if permission denied
 */
export function PermissionGate({ requiredPermission, children, fallback = null }) {
  const { hasAccess } = usePermissions();

  if (!hasAccess(requiredPermission)) {
    return fallback;
  }

  return <>{children}</>;
}

/**
 * Component that conditionally renders based on user grade
 * 
 * @param {string|string[]} allowedGrades - Grade or array of grades allowed to see content
 * @param {React.ReactNode} children - Content to render if grade matches
 * @param {React.ReactNode} fallback - Optional content to render if grade doesn't match
 */
export function GradeGate({ allowedGrades, children, fallback = null }) {
  const { hasGrade } = usePermissions();

  if (!hasGrade(allowedGrades)) {
    return fallback;
  }

  return <>{children}</>;
}