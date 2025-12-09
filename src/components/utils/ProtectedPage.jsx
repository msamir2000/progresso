import React from 'react';
import { usePermissions } from './usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

/**
 * Wrapper component that protects pages based on user permissions
 * @param {string} requiredPermission - The permission module ID required to view this page
 * @param {React.ReactNode} children - The page content to render if user has permission
 * @param {string} pageName - Optional name to display in unauthorized message
 */
export default function ProtectedPage({ requiredPermission, children, pageName = 'this page' }) {
  const { hasAccess, isLoading, currentUser } = usePermissions();

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has required permission
  if (!hasAccess(requiredPermission)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-red-200">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600 mb-4">
                You don't have permission to access {pageName}.
              </p>
              {currentUser?.grade ? (
                <p className="text-sm text-slate-500 mb-6">
                  Your current grade: <span className="font-semibold">{currentUser.grade}</span>
                </p>
              ) : (
                <p className="text-sm text-slate-500 mb-6">
                  No grade assigned to your account.
                </p>
              )}
              <Link 
                to={createPageUrl('Dashboard')}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has permission, render the page content
  return <>{children}</>;
}