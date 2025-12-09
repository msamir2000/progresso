import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, FolderOpen, FileText } from 'lucide-react';
import { Templates } from '@/api/entities';

export default function DocumentsTab({ caseData }) {
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const loadTemplates = useCallback(async () => {
    if (!caseData.case_type) return;

    setIsLoadingTemplates(true);
    try {
      const allTemplates = await Templates.list();
      const caseTypeTemplates = allTemplates.filter(t => t.case_type === caseData.case_type);
      setTemplates(caseTypeTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [caseData.case_type]);

  useEffect(() => {
    if (caseData.case_type) {
      loadTemplates();
    }
  }, [caseData.case_type, loadTemplates]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Document Templates</h3>
          <p className="text-sm text-slate-600 mt-1">
            Available templates for {caseData.company_name}
          </p>
        </div>
        <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
          {caseData.case_type} Templates
        </Badge>
      </div>

      {isLoadingTemplates ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-600">Loading templates...</span>
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-slate-600 mb-2">No Templates Available</h4>
          <p className="text-slate-500 mb-4">
            No document templates have been configured for {caseData.case_type} cases.
          </p>
          <p className="text-sm text-slate-400">
            Templates can be added in Settings → Document Templates
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-slate-800">
                    {template.report_type}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {template.case_type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.template_text && (
                  <div>
                    <Label className="text-sm font-medium text-slate-600">Content Template</Label>
                    <div className="mt-1 p-3 bg-slate-50 rounded-md border">
                      <p className="text-sm text-slate-700 line-clamp-3">
                        {template.template_text.length > 200
                          ? `${template.template_text.substring(0, 200)}...`
                          : template.template_text
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    {template.template_file_url && (
                      <a
                        href={template.template_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <FileText className="w-4 h-4" />
                        View Formatting Template
                      </a>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    Use Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}