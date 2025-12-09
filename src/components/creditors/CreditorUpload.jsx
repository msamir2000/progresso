import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function CreditorUpload({ caseId, onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type before uploading
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension !== 'csv') {
      setUploadStatus({
        type: 'error',
        message: 'Only CSV files are supported. Please save your Excel file as CSV format before uploading.'
      });
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);
    setUploadedFileName(file.name);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const jsonSchema = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            creditor_name: { type: 'string' },
            creditor_address: { type: 'string' },
            account_number: { type: 'string' },
            balance_owed: { type: 'number' },
            balance_submitted: { type: 'number' },
            date_submitted: { type: 'string' },
            date_admitted: { type: 'string' },
            creditor_type: { type: 'string' },
            unsecured_creditor_type: { type: 'string' },
            contact_name: { type: 'string' },
            email_address: { type: 'string' },
            telephone_number: { type: 'string' },
            mobile_number: { type: 'string' },
            security_type: { type: 'string' },
            security_date_of_creation: { type: 'string' },
            security_date_of_registration: { type: 'string' },
            moratorium_debt: { type: 'string' }
          },
          required: ['creditor_name']
        }
      };

      const extractionResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: jsonSchema
      });

      if (extractionResult.status === 'error') {
        const errorMsg = extractionResult.details || 'Failed to extract data from file';
        setUploadStatus({ 
          type: 'error', 
          message: `Upload Error: ${errorMsg}. Please ensure your CSV file has the correct columns. Download the sample template for reference.`
        });
        setIsUploading(false);
        return;
      }

      const creditorsData = extractionResult.output;

      if (!Array.isArray(creditorsData) || creditorsData.length === 0) {
        setUploadStatus({ 
          type: 'error', 
          message: 'No creditor data found in the file. Please check that your CSV file has data rows and matches the template format.' 
        });
        setIsUploading(false);
        return;
      }

      // Validate and map creditor types
      const validCreditorTypes = ['secured', 'moratorium', 'preferential', 'secondary_preferential', 'unsecured'];
      
      const creditorsToInsert = creditorsData.map(creditor => {
        // Normalize creditor type
        let creditorType = 'unsecured'; // default
        if (creditor.creditor_type) {
          const normalizedType = creditor.creditor_type.toLowerCase().trim();
          if (validCreditorTypes.includes(normalizedType)) {
            creditorType = normalizedType;
          } else if (normalizedType.includes('secured') && !normalizedType.includes('unsecured')) {
            creditorType = 'secured';
          } else if (normalizedType.includes('preferential')) {
            creditorType = normalizedType.includes('secondary') ? 'secondary_preferential' : 'preferential';
          } else if (normalizedType.includes('moratorium')) {
            creditorType = 'moratorium';
          }
        }

        return {
          case_id: caseId,
          creditor_name: creditor.creditor_name || '',
          creditor_address: creditor.creditor_address || '',
          account_number: creditor.account_number || '',
          balance_owed: parseFloat(creditor.balance_owed) || 0,
          balance_submitted: parseFloat(creditor.balance_submitted) || 0,
          date_submitted: creditor.date_submitted || null,
          date_admitted: creditor.date_admitted || null,
          creditor_type: creditorType,
          unsecured_creditor_type: creditor.unsecured_creditor_type || null,
          contact_name: creditor.contact_name || '',
          email_address: creditor.email_address || '',
          telephone_number: creditor.telephone_number || '',
          mobile_number: creditor.mobile_number || '',
          on_mail_hold: false,
          email_only: false,
          opted_out: false,
          security_type: creditor.security_type || null,
          security_date_of_creation: creditor.security_date_of_creation || null,
          security_date_of_registration: creditor.security_date_of_registration || null,
          moratorium_debt: creditor.moratorium_debt || 'N/A'
        };
      });

      await base44.entities.Creditor.bulkCreate(creditorsToInsert);

      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${creditorsToInsert.length} creditor(s)`
      });

      if (onUploadComplete) {
        onUploadComplete();
      }

      e.target.value = '';
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: `Upload failed: ${error.message || 'Unknown error'}. Please check your file format and try again.`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const headers = [
      'Creditor Name',
      'Creditor Address',
      'Account Number',
      'Balance Owed',
      'Balance Submitted',
      'Date Submitted',
      'Date Admitted',
      'Creditor Type',
      'Unsecured Creditor Type',
      'Contact Name',
      'Email Address',
      'Telephone Number',
      'Mobile Number'
    ];

    const sampleRow = [
      'HMRC',
      '123 Tax Street, London, SW1A 1AA',
      'ACC12345',
      '5000',
      '5000',
      '2024-01-15',
      '2024-01-20',
      'preferential',
      '',
      'John Smith',
      'john.smith@hmrc.gov.uk',
      '020 1234 5678',
      '07700 900000'
    ];

    const csvContent = [headers.join(','), sampleRow.join(',')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'creditor_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-slate-900 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            Bulk Upload Creditors
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadSampleTemplate}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Sample Template
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <label htmlFor="creditor-file-upload">
            <Button
              variant="outline"
              disabled={isUploading}
              className="cursor-pointer"
              asChild
            >
              <span>
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Choose File
                  </>
                )}
              </span>
            </Button>
          </label>
          <Input
            id="creditor-file-upload"
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          {uploadedFileName && (
            <span className="text-sm text-slate-600">{uploadedFileName}</span>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">File Format Requirements:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>File Type:</strong> CSV files only (.csv)</li>
            <li>• <strong>Convert Excel files:</strong> Open your .xlsx file and save as CSV format</li>
            <li>• <strong>Required Column:</strong> Creditor Name</li>
            <li>• <strong>Balance fields:</strong> Use numbers only, no currency symbols</li>
            <li>• <strong>Creditor Type:</strong> secured, preferential, secondary_preferential, unsecured, or moratorium</li>
          </ul>
          <p className="text-xs text-blue-700 mt-3">
            Download the sample template above to see the full column structure and example data.
          </p>
        </div>

        {uploadStatus && (
          <Alert className={uploadStatus.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600" />
            )}
            <AlertDescription className={uploadStatus.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {uploadStatus.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}