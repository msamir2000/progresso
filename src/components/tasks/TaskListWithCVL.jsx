import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText } from 'lucide-react';
import CVLTaskList from './CVLTaskList';

// This component acts as a wrapper that can be integrated into the existing TaskList
// It will show the CVL template-based task list for CVL cases, and a message for other case types
export default function TaskListWithCVL({ caseData, onUpdate }) {
  // For CVL cases, show the new template-based task list
  if (caseData.case_type === 'CVL') {
    return <CVLTaskList caseData={caseData} onUpdate={onUpdate} />;
  }

  // For non-CVL cases, show a placeholder message
  return (
    <Alert className="border-blue-200 bg-blue-50">
      <FileText className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        Template-based task management is currently available for CVL cases only. 
        Task lists for other case types will be implemented in future updates.
      </AlertDescription>
    </Alert>
  );
}