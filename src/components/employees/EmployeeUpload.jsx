
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle, XCircle, Loader2, Download, ArrowLeft } from 'lucide-react';
import { Employee } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { ExtractDataFromUploadedFile } from '@/api/integrations';

export default function EmployeeUpload({ caseId, onUploadComplete, onBack }) {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);

  const handleBack = () => {
    if (onBack) {
      onBack();
    }
  };

  const downloadSampleTemplate = () => {
    const headers = [
      'Title',
      'First Name',
      'Last Name',
      'Address Line 1',
      'Address Line 2',
      'City',
      'County',
      'Postcode',
      'Email Address',
      'Phone Number',
      'Date of Birth',
      'National Insurance Number',
      'Start Date',
      'End Date',
      'Yearly Salary',
      'Holiday Entitlement',
      'Days Taken',
      'Days Carried Forward',
      'Work Days Per Week',
      'Date Last Paid',
      'Holiday Year Start Date',
      'Employer Pension %',
      'Employee Pension %',
      'Pension Opted In'
    ];

    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Employees</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
          <![endif]-->
        </head>
        <body>
          <table>
            <tr>
              ${headers.map(header => `<th style="background-color: #4472C4; color: white; font-weight: bold; padding: 10px; border: 1px solid #ccc;">${header}</th>`).join('')}
            </tr>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'employee_upload_template.xls');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const { file_url } = await UploadFile({ file });

      const employeeSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            first_name: { type: "string" },
            last_name: { type: "string" },
            address_line1: { type: "string" },
            address_line2: { type: "string" },
            city: { type: "string" },
            county: { type: "string" },
            postcode: { type: "string" },
            email_address: { type: "string" },
            phone_number: { type: "string" },
            date_of_birth: { type: "string" },
            national_insurance_number: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            yearly_salary: { type: "number" },
            holiday_entitlement: { type: "number" },
            days_taken: { type: "number" },
            days_carried_forward: { type: "number" },
            work_days_per_week: { type: "number" },
            date_last_paid: { type: "string" },
            holiday_year_start_date: { type: "string" },
            employer_pension_percent: { type: "number" },
            employee_pension_percent: { type: "number" },
            pension_opted_in: { type: "string" }
          }
        }
      };

      const result = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: employeeSchema
      });

      if (result.status === 'success' && result.output) {
        const employees = Array.isArray(result.output) ? result.output : [result.output];
        
        for (const emp of employees) {
          await Employee.create({
            case_id: caseId,
            title: emp.title,
            first_name: emp.first_name,
            last_name: emp.last_name,
            address: {
              line1: emp.address_line1 || '',
              line2: emp.address_line2 || '',
              city: emp.city || '',
              county: emp.county || '',
              postcode: emp.postcode || ''
            },
            email_address: emp.email_address,
            phone_number: emp.phone_number,
            date_of_birth: emp.date_of_birth,
            national_insurance_number: emp.national_insurance_number,
            start_date: emp.start_date,
            end_date: emp.end_date,
            yearly_salary: parseFloat(emp.yearly_salary) || 0,
            holiday_entitlement: parseFloat(emp.holiday_entitlement) || 0,
            days_taken: parseFloat(emp.days_taken) || 0,
            days_carried_forward: parseFloat(emp.days_carried_forward) || 0,
            work_days_per_week: parseFloat(emp.work_days_per_week) || 5,
            date_last_paid: emp.date_last_paid,
            holiday_year_start_date: emp.holiday_year_start_date,
            employer_pension_percent: parseFloat(emp.employer_pension_percent) || 0,
            employee_pension_percent: parseFloat(emp.employee_pension_percent) || 0,
            pension_opted_in: emp.pension_opted_in || 'yes'
          });
        }

        setUploadStatus({
          type: 'success',
          message: `Successfully uploaded ${employees.length} employee(s)`
        });
        setFile(null);
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        setUploadStatus({
          type: 'error',
          message: result.details || 'Failed to extract employee data from file'
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error.message || 'An error occurred during upload'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="space-y-4">
        <Button
          variant="outline"
          onClick={handleBack}
          className="w-fit border-slate-300 hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Employees
        </Button>
        
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bulk Upload Employees
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSampleTemplate}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Sample Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Upload your employee data in Excel format (.xlsx, .xls) or CSV format
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100"
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-md">
              <span className="text-sm text-slate-700">{file.name}</span>
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Employees
                  </>
                )}
              </Button>
            </div>
          )}

          {uploadStatus && (
            <Alert className={uploadStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              {uploadStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={uploadStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {uploadStatus.message}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
