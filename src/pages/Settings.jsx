import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Users, ListChecks, Calendar, Clock, Shield, DollarSign, FileText, MapPin, Calculator, PoundSterling, Briefcase, Archive } from 'lucide-react';
import TaskListManager from '../components/settings/TaskListManager';
import DiaryTemplateManager from '../components/settings/DiaryTemplateManager';
import UserManagement from '../components/settings/UserManagement';
import ProtectedPage from '../components/utils/ProtectedPage';
import { PermissionGate } from '../components/utils/PermissionGate';
import { base44 } from '@/api/base44Client';

// New imports for full management interfaces
import BondRatesManager from '../components/settings/BondRatesManager';
import RPSLimitsManager from '../components/settings/RPSLimitsManager';
import ChartOfAccountsManager from '../components/settings/ChartOfAccountsManager';
import DefaultAddressesManager from '../components/settings/DefaultAddressesManager';
import TimesheetTasksManager from '../components/settings/TimesheetTasksManager';
import FeeEstimateManager from '../components/settings/FeeEstimateManager';
import CaseManagementSettings from '../components/settings/CaseManagementSettings';
import ArchivedCasesManager from '../components/settings/ArchivedCasesManager';

export default function Settings() {
  return (
    <ProtectedPage requiredPermission="settings" pageName="Settings">
      <div className="min-h-screen p-6 md:p-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="w-8 h-8 text-blue-700" />
            <div>
              <h1 className="text-3xl font-bold font-display text-slate-900">Settings</h1>
              <p className="text-slate-600 text-lg">Configure your system preferences</p>
            </div>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="case_management" className="space-y-6">
            <TabsList className="bg-white p-1 shadow-sm flex-wrap h-auto">
              <TabsTrigger value="case_management" className="flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Case Management
              </TabsTrigger>
              <TabsTrigger value="archived_cases" className="flex items-center gap-2">
                <Archive className="w-4 h-4" />
                Archived Cases
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                Task Templates
              </TabsTrigger>
              <TabsTrigger value="diary" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Diary Templates
              </TabsTrigger>
              <TabsTrigger value="timesheet" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Timesheet Tasks
              </TabsTrigger>
              <TabsTrigger value="fee_estimates" className="flex items-center gap-2">
                <PoundSterling className="w-4 h-4" />
                Fee Estimates
              </TabsTrigger>
              <TabsTrigger value="bond_rates" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Bond Rates
              </TabsTrigger>
              <TabsTrigger value="rps_limits" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                RPS Limits
              </TabsTrigger>
              <TabsTrigger value="chart_of_accounts" className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Chart of Accounts
              </TabsTrigger>
              <TabsTrigger value="default_addresses" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Default Addresses
              </TabsTrigger>
              
              {/* Only show User Management tab if user has user_management permission */}
              <PermissionGate requiredPermission="user_management">
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  User Management
                </TabsTrigger>
              </PermissionGate>
            </TabsList>

            <TabsContent value="case_management">
              <CaseManagementSettings />
            </TabsContent>

            <TabsContent value="archived_cases">
              <ArchivedCasesManager />
            </TabsContent>

            <TabsContent value="tasks">
              <TaskListManager />
            </TabsContent>

            <TabsContent value="diary">
              <DiaryTemplateManager />
            </TabsContent>

            <TabsContent value="timesheet">
              <TimesheetTasksManager />
            </TabsContent>

            <TabsContent value="fee_estimates">
              <FeeEstimateManager />
            </TabsContent>

            <TabsContent value="bond_rates">
              <BondRatesManager />
            </TabsContent>

            <TabsContent value="rps_limits">
              <RPSLimitsManager />
            </TabsContent>

            <TabsContent value="chart_of_accounts">
              <ChartOfAccountsManager />
            </TabsContent>

            <TabsContent value="default_addresses">
              <DefaultAddressesManager />
            </TabsContent>

            <PermissionGate requiredPermission="user_management">
              <TabsContent value="users">
                <UserManagement />
              </TabsContent>
            </PermissionGate>
          </Tabs>
        </div>
      </div>
    </ProtectedPage>
  );
}