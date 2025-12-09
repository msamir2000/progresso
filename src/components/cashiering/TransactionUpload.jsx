import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Info, Download, FileText, ChevronDown, ChevronUp, Search, Paperclip, Send, Loader2, X, Eye } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";

export default function TransactionUpload({ onUploadComplete, className, cases = [] }) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [showChartOfAccounts, setShowChartOfAccounts] = useState(false);
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [uploadedTransactions, setUploadedTransactions] = useState([]);
  const [uploadingDocuments, setUploadingDocuments] = useState({});
  const [isPosting, setIsPosting] = useState(false);
  const [activeAccountGroup, setActiveAccountGroup] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (showChartOfAccounts && chartOfAccounts.length === 0) {
      loadChartOfAccounts();
    }
  }, [showChartOfAccounts]);

  const loadChartOfAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const accounts = await base44.entities.ChartOfAccount.list('account_code');
      setChartOfAccounts(accounts || []);
      
      // Set first group as active by default
      if (accounts && accounts.length > 0) {
        const groups = [...new Set(accounts.map(acc => acc.account_group || 'Ungrouped'))];
        const sortedGroups = groups.sort((a, b) => a.localeCompare(b));
        if (sortedGroups.length > 0) {
          setActiveAccountGroup(sortedGroups[0]);
        }
      }
    } catch (error) {
      console.error('Error loading chart of accounts:', error);
      setChartOfAccounts([]);
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const filteredAccounts = chartOfAccounts.filter(account => {
    if (!accountSearchTerm) return true;
    const searchLower = accountSearchTerm.toLowerCase();
    return (
      (account.account_code || '').toLowerCase().includes(searchLower) ||
      (account.account_name || '').toLowerCase().includes(searchLower) ||
      (account.account_type || '').toLowerCase().includes(searchLower) ||
      (account.account_group || '').toLowerCase().includes(searchLower)
    );
  });

  // Group accounts by account_group
  const groupedAccounts = filteredAccounts.reduce((acc, account) => {
    const group = account.account_group || 'Ungrouped';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(account);
    return acc;
  }, {});

  const sortedGroups = Object.keys(groupedAccounts).sort((a, b) => a.localeCompare(b));

  // Get accounts for the active group
  const activeGroupAccounts = activeAccountGroup ? (groupedAccounts[activeAccountGroup] || []) : [];

  const handleDownloadTemplate = () => {
    try {
      // Create HTML table that Excel can open - UPDATED to use case_reference
      const headers = [
        'case_reference',
        'transaction_date',
        'Chart of Accounts Code',
        'Chart of Accounts Descrip.',
        'Payee Name',
        'Payment or Receipt',
        'Net Amount',
        'VAT Amount',
        'VAT Irrecoverable',
        'Gross Amount',
        'Select Case Bank AC',
        'Date of invoice',
        'Invoice Number'
      ];

      const exampleRow = [
        'RC25',
        '2024-01-15',
        'ACC001',
        'Office supplies purchase',
        'Office Supplies Ltd',
        'payment',
        '200.00',
        '40.00',
        'no',
        '240.00',
        'primary',
        '2024-01-10',
        'INV-12345'
      ];

      // Create Excel-compatible HTML
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Transaction Template</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body>
          <table>
            <tr style="background-color: #f0f0f0; font-weight: bold;">
              <td colspan="13" style="padding: 10px; border: 1px solid #000; background-color: #ffeb3b;">
                <strong>INSTRUCTIONS:</strong> Fill in your transaction data below using CASE REFERENCE (not case ID). For "VAT Irrecoverable" column, enter "yes" or "no" (only applies to payments). When ready to upload, save this file as CSV format (File > Save As > CSV). Then upload the CSV file to the system.
              </td>
            </tr>
            <tr style="background-color: #4472C4; color: white; font-weight: bold;">
              ${headers.map(h => `<th style="border: 1px solid #000; padding: 8px;">${h}</th>`).join('')}
            </tr>
            <tr>
              ${exampleRow.map(cell => `<td style="border: 1px solid #ccc; padding: 8px;">${cell}</td>`).join('')}
            </tr>
            <tr>
              ${headers.map(() => `<td style="border: 1px solid #ccc; padding: 8px;"></td>`).join('')}
            </tr>
            <tr>
              ${headers.map(() => `<td style="border: 1px solid #ccc; padding: 8px;"></td>`).join('')}
            </tr>
            <tr>
              ${headers.map(() => `<td style="border: 1px solid #ccc; padding: 8px;"></td>`).join('')}
            </tr>
          </table>
        </body>
        </html>
      `;

      // Create blob and download as Excel file
      const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', 'transaction_upload_template.xls');
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      setUploadStatus('error');
      setUploadError('Failed to download template. Please try again.');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus(null);
    setUploadError(null);
    setUploadedTransactions([]);

    try {
      // Validate file type - only accept CSV for upload
      const isCSV = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
      
      if (!isCSV) {
        throw new Error('Please upload a CSV file. If you have an Excel file, save it as CSV first (File > Save As > CSV).');
      }

      // Upload file
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult?.file_url) {
        throw new Error('File upload failed - no URL returned');
      }

      const { file_url } = uploadResult;

      // Define JSON schema for extraction - UPDATED to use case_reference
      const jsonSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            case_reference: { type: "string" },
            transaction_date: { type: "string", format: "date" },
            chart_of_accounts_code: { type: "string" },
            chart_of_accounts_descrip: { type: "string" },
            payee_name: { type: "string" },
            payment_or_receipt: { type: "string", enum: ["receipt", "payment"] },
            net_amount: { type: "number" },
            vat_amount: { type: "number" },
            vat_irrecoverable: { type: "string", enum: ["yes", "no"] },
            gross_amount: { type: "number" },
            select_case_bank_ac: { type: "string", enum: ["primary", "secondary"] },
            date_of_invoice: { type: "string", format: "date" },
            invoice_number: { type: "string" }
          },
          required: ["case_reference", "transaction_date", "payment_or_receipt", "gross_amount"]
        }
      };

      // Extract data
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: jsonSchema
      });

      if (extractResult.status !== "success" || !extractResult.output) {
        const errorDetail = extractResult.details || "Could not extract data from file";
        throw new Error(errorDetail);
      }

      // Process extracted transactions
      let transactions = Array.isArray(extractResult.output) 
        ? extractResult.output 
        : [extractResult.output];
      
      // Filter valid transactions
      const validTransactions = transactions.filter(tx => {
        if (!tx.case_reference) return false;
        if (!tx.transaction_date || !tx.payment_or_receipt || !tx.gross_amount) return false;
        return true;
      });
      
      if (validTransactions.length === 0) {
        throw new Error(
          "No valid transactions found. Please ensure each row has: case_reference, transaction_date, Payment or Receipt, and Gross Amount."
        );
      }

      // Load all cases if not provided
      let allCases = cases;
      if (!allCases || allCases.length === 0) {
        allCases = await base44.entities.Case.list();
      }

      // Map case references to case IDs and create transactions
      const transactionsWithCaseIds = [];
      const missingReferences = [];

      for (const tx of validTransactions) {
        // Find the case by case_reference
        const matchingCase = allCases.find(c => 
          c.case_reference && c.case_reference.toLowerCase() === tx.case_reference.toLowerCase()
        );

        if (!matchingCase) {
          missingReferences.push(tx.case_reference);
          continue;
        }

        // Generate reference
        const caseCode = matchingCase.case_reference || '';
        const payee = (tx.payee_name || '').replace(/\s+/g, '').toUpperCase();
        
        let dateForReference = '';
        try {
          if (tx.transaction_date) {
            const txDate = new Date(tx.transaction_date);
            if (!isNaN(txDate.getTime())) {
              dateForReference = txDate.toISOString().split('T')[0].replace(/-/g, '');
            }
          }
        } catch (e) {
          console.warn("Invalid date format:", tx.transaction_date, e);
        }
        
        const generatedReference = (caseCode && payee && dateForReference) 
          ? `${caseCode}-${payee}-${dateForReference}` 
          : '';

        // Ensure numeric values are properly formatted
        const netAmount = parseFloat(tx.net_amount) || 0;
        const vatAmount = parseFloat(tx.vat_amount) || 0;
        const grossAmount = parseFloat(tx.gross_amount) || 0;
        
        // Check if VAT is irrecoverable (only for payments)
        const isVatIrrecoverable = tx.payment_or_receipt === 'payment' && 
                                    (tx.vat_irrecoverable || '').toLowerCase() === 'yes';
        
        // If VAT is irrecoverable, set account code to VIRC
        const accountCode = isVatIrrecoverable ? 'VIRC' : tx.chart_of_accounts_code;

        // Map to internal format with the correct case_id
        transactionsWithCaseIds.push({
          case_id: matchingCase.id, // Use the actual case UUID
          case_reference: matchingCase.case_reference, // Keep reference for display
          transaction_date: tx.transaction_date,
          account_code: accountCode,
          description: tx.chart_of_accounts_descrip || '',
          transaction_type: tx.payment_or_receipt,
          net_amount: netAmount,
          vat_amount: vatAmount,
          amount: grossAmount,
          account_type: 'case_account',
          target_account: tx.select_case_bank_ac || 'primary',
          payee_name: tx.payee_name,
          date_of_invoice: tx.date_of_invoice,
          invoice_number: tx.invoice_number,
          invoice_file_url: null,
          status: 'draft',
          reference: generatedReference
        });
      }

      // Show error if any case references couldn't be found
      if (missingReferences.length > 0) {
        throw new Error(
          `Could not find cases for the following references: ${missingReferences.join(', ')}. Please check your case references and try again.`
        );
      }

      if (transactionsWithCaseIds.length === 0) {
        throw new Error("No valid transactions with matching case references found.");
      }

      // Store transactions locally (not saved to DB yet)
      setUploadedTransactions(transactionsWithCaseIds);
      setUploadStatus('success');
      setUploadError(null);
      
    } catch (error) {
      console.error("Error uploading transactions:", error);
      const errorMessage = error.message || "An unexpected error occurred";
      setUploadStatus('error');
      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleDocumentUpload = async (index, file) => {
    if (!file) return;

    setUploadingDocuments(prev => ({ ...prev, [index]: true }));

    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      if (!uploadResult?.file_url) {
        throw new Error('Document upload failed');
      }

      // Update the transaction with the document URL
      const updatedTransactions = [...uploadedTransactions];
      updatedTransactions[index] = {
        ...updatedTransactions[index],
        invoice_file_url: uploadResult.file_url
      };
      setUploadedTransactions(updatedTransactions);

    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploadingDocuments(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleRemoveDocument = (index) => {
    const updatedTransactions = [...uploadedTransactions];
    updatedTransactions[index] = {
      ...updatedTransactions[index],
      invoice_file_url: null
    };
    setUploadedTransactions(updatedTransactions);
  };

  const handlePostForApproval = async () => {
    if (uploadedTransactions.length === 0) {
      alert('No transactions to post');
      return;
    }

    // Check if user has a signature
    if (!currentUser?.signature_image_url) {
      alert('You need to upload your signature in Settings → User Management before posting transactions.');
      return;
    }

    // Check if all transactions have backing documents
    const missingDocs = uploadedTransactions.filter(tx => !tx.invoice_file_url);
    if (missingDocs.length > 0) {
      const proceed = confirm(
        `${missingDocs.length} transaction(s) don't have backing documents. Do you want to proceed anyway?`
      );
      if (!proceed) return;
    }

    setIsPosting(true);

    try {
      // Get unique case IDs from uploaded transactions
      const caseIds = [...new Set(uploadedTransactions.map(tx => tx.case_id))];

      // Delete old draft, pending_approval, and rejected transactions for these cases
      // This prevents duplicate/old rejected transactions from appearing in "For Approval"
      for (const caseId of caseIds) {
        try {
          // Find and delete old transactions with these statuses
          const oldTransactions = await base44.entities.Transaction.filter({ 
            case_id: caseId
          });

          const transactionsToDelete = oldTransactions.filter(tx => 
            tx.status === 'draft' || 
            tx.status === 'pending_approval' || 
            tx.status === 'rejected'
          );

          // Delete each old transaction
          for (const oldTx of transactionsToDelete) {
            await base44.entities.Transaction.delete(oldTx.id);
          }

          console.log(`Cleaned up ${transactionsToDelete.length} old transactions for case ${caseId}`);
        } catch (error) {
          console.error(`Error cleaning up old transactions for case ${caseId}:`, error);
          // Continue with posting even if cleanup fails
        }
      }

      // Update status to pending_approval and save to database
      // Ensure all numeric values are properly formatted before saving
      const transactionsToCreate = uploadedTransactions.map(tx => {
        const netAmount = parseFloat(tx.net_amount);
        const vatAmount = parseFloat(tx.vat_amount);
        const amount = parseFloat(tx.amount);

        console.log('Creating transaction:', {
          description: tx.description,
          net_amount: netAmount,
          vat_amount: vatAmount,
          amount: amount,
          netIsValid: !isNaN(netAmount),
          vatIsValid: !isNaN(vatAmount),
          amountIsValid: !isNaN(amount)
        });

        return {
          case_id: tx.case_id,
          transaction_date: tx.transaction_date,
          account_code: tx.account_code,
          description: tx.description,
          transaction_type: tx.transaction_type,
          net_amount: !isNaN(netAmount) ? netAmount : null,
          vat_amount: !isNaN(vatAmount) ? vatAmount : null,
          amount: !isNaN(amount) ? amount : 0, // gross amount is required, default to 0 if invalid
          account_type: tx.account_type,
          target_account: tx.target_account,
          payee_name: tx.payee_name,
          date_of_invoice: tx.date_of_invoice,
          invoice_number: tx.invoice_number,
          invoice_file_url: tx.invoice_file_url,
          reference: tx.reference,
          status: 'pending_approval',
          signature_image_url: currentUser.signature_image_url,
          signed_by: currentUser.email,
          signed_date: new Date().toISOString(),
          office_holder_signature: currentUser.full_name,
          approver_grade: currentUser.grade
        };
      });

      await base44.entities.Transaction.bulkCreate(transactionsToCreate);

      alert(`Successfully posted ${uploadedTransactions.length} transaction(s) for approval!`);
      
      // Clear the uploaded transactions
      setUploadedTransactions([]);
      setUploadStatus(null);
      
      // Notify parent component to refresh
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Error posting transactions:', error);
      alert('Failed to post transactions for approval. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const triggerFileUpload = () => {
    const fileInput = document.getElementById('transaction-file-upload');
    if (fileInput && !isUploading) {
      fileInput.click();
    }
  };

  const triggerDocumentUpload = (index) => {
    const fileInput = document.getElementById(`document-upload-${index}`);
    if (fileInput) {
      fileInput.click();
    }
  };

  const formatCurrency = (amount) => {
    return (amount || 0).toLocaleString('en-GB', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  return (
    <div className={className || ''}>
      <Card className="border-slate-300">
        <CardHeader className="py-3 px-4 flex items-center">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-blue-700">
              <FileSpreadsheet className="w-4 h-4 text-blue-700" />
              Bulk Upload
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-400 hover:text-slate-600"
                  >
                    <Info className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-80 z-[999]" 
                  side="bottom" 
                  align="start"
                  onInteractOutside={(e) => e.preventDefault()}
                >
                  <div className="space-y-2">
                    <p className="font-semibold text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      ⚠️ Important: Upload files must be in CSV format
                    </p>
                    <p className="font-semibold text-sm">Expected column order:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600">
                      <li>case_reference: Must match an existing Case Reference (e.g., RC25)</li>
                      <li>transaction_date: YYYY-MM-DD</li>
                      <li>Chart of Accounts Code: Optional string</li>
                      <li>Chart of Accounts Descrip.: Description text</li>
                      <li>Payee Name: Name of payee</li>
                      <li>Payment or Receipt: "payment" or "receipt"</li>
                      <li>Net Amount: Numeric value</li>
                      <li>VAT Amount: Numeric value</li>
                      <li>VAT Irrecoverable: "yes" or "no" (payments only, sets code to VIRC)</li>
                      <li>Gross Amount: Total amount (required)</li>
                      <li>Select Case Bank AC: "primary" or "secondary"</li>
                      <li>Date of invoice: YYYY-MM-DD</li>
                      <li>Invoice Number: Optional string</li>
                    </ol>
                    <p className="text-xs text-slate-500 mt-2">
                      Note: Download the Excel template, fill it in with case references (not IDs), then save as CSV before uploading.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              <span className="text-xs font-normal text-slate-500">Info</span>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="h-8 text-xs"
                disabled={isUploading}
              >
                <Download className="w-3 h-3 mr-1" />
                Download Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={isUploading}
                onClick={() => setShowChartOfAccounts(!showChartOfAccounts)}
              >
                <FileText className="w-3 h-3 mr-1" />
                Chart of Accounts
                {showChartOfAccounts ? (
                  <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-1" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-blue-600 hover:bg-blue-50" 
                disabled={isUploading}
                onClick={triggerFileUpload}
              >
                <Upload className="w-4 h-4" />
              </Button>
              <Input
                id="transaction-file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-3 px-4">
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mb-2">
            📝 <strong>Instructions:</strong> Download the Excel template below, fill in your data using <strong>case references</strong> (e.g., RC25), then save as CSV (File → Save As → CSV) before uploading.
          </p>
          
          {/* Upload Status Messages */}
          {isUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center gap-2 mb-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="text-sm text-blue-900">Processing file...</p>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-900">Upload Successful</p>
                <p className="text-xs text-green-700 mt-1">
                  {uploadedTransactions.length} transaction(s) loaded. Add backing documents and click "Post for Approval" to submit.
                </p>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Upload Failed</p>
                <p className="text-xs text-red-700 mt-1">{uploadError}</p>
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Uploaded Transactions List */}
      {uploadedTransactions.length > 0 && (
        <Card className="border-slate-300 mt-4">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">
                Uploaded Transactions ({uploadedTransactions.length})
              </CardTitle>
              <Button
                onClick={handlePostForApproval}
                disabled={isPosting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post for Approval
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold text-xs">Date</TableHead>
                    <TableHead className="font-semibold text-xs">Type</TableHead>
                    <TableHead className="font-semibold text-xs">Case Ref</TableHead> {/* New column */}
                    <TableHead className="font-semibold text-xs">Account Code</TableHead>
                    <TableHead className="font-semibold text-xs">Description</TableHead>
                    <TableHead className="font-semibold text-xs">Payee</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Net</TableHead>
                    <TableHead className="font-semibold text-xs text-right">VAT</TableHead>
                    <TableHead className="font-semibold text-xs text-right">Gross</TableHead>
                    <TableHead className="font-semibold text-xs">Bank AC</TableHead>
                    <TableHead className="font-semibold text-xs">Documents</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadedTransactions.map((tx, idx) => {
                    const caseMatch = cases.find(c => c.id === tx.case_id);
                    const isUploadingDoc = uploadingDocuments[idx];
                    return (
                      <TableRow key={idx} className="hover:bg-slate-50">
                        <TableCell className="text-xs">{formatDate(tx.transaction_date)}</TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`text-xs font-semibold ${
                              tx.transaction_type === 'receipt' 
                                ? 'bg-green-100 text-green-800 border-green-300' 
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}
                          >
                            {tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-semibold">{tx.case_reference}</TableCell> {/* Display case reference */}
                        <TableCell className="font-mono text-xs">{tx.account_code || '—'}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate">{tx.description || '—'}</TableCell>
                        <TableCell className="text-xs">{tx.payee_name || '—'}</TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {tx.net_amount ? `£${formatCurrency(tx.net_amount)}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">
                          {tx.vat_amount ? `£${formatCurrency(tx.vat_amount)}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono font-semibold">
                          £{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell className="text-xs capitalize">{tx.target_account}</TableCell>
                        <TableCell>
                          {tx.invoice_file_url ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                <Paperclip className="w-3 h-3 mr-1" />
                                Attached
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => window.open(tx.invoice_file_url, '_blank')}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:text-red-700"
                                onClick={() => handleRemoveDocument(idx)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => triggerDocumentUpload(idx)}
                              disabled={isUploadingDoc}
                              className="h-7 text-xs"
                            >
                              {isUploadingDoc ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3 mr-1" />
                                  Add Document
                                </>
                              )}
                            </Button>
                          )}
                          <Input
                            id={`document-upload-${idx}`}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                            onChange={(e) => handleDocumentUpload(idx, e.target.files?.[0])}
                            className="hidden"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart of Accounts Panel with Side Menu */}
      {showChartOfAccounts && (
        <Card className="border-slate-300 mt-4">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-900">
                Chart of Accounts Reference
              </CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search accounts..."
                  value={accountSearchTerm}
                  onChange={(e) => setAccountSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingAccounts ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : chartOfAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No chart of accounts configured</p>
                <p className="text-xs mt-1">Add accounts in Settings to see them here</p>
              </div>
            ) : filteredAccounts.length === 0 && accountSearchTerm ? ( // Only show if search term is present and no results
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm">No accounts match your search</p>
              </div>
            ) : (
              <div className="flex h-full">
                {/* Left Side Menu */}
                <div className="w-56 flex-shrink-0 border-r bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-800 mb-4 text-sm">Account Groups</h3>
                  <nav className="space-y-1">
                    {sortedGroups.map((group) => (
                      <button
                        key={group}
                        onClick={() => setActiveAccountGroup(group)}
                        className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeAccountGroup === group
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Right Content Area */}
                <div className="flex-1 overflow-y-auto max-h-96">
                  {activeAccountGroup && activeGroupAccounts.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold text-xs h-8 py-1">Code</TableHead>
                          <TableHead className="font-semibold text-xs h-8 py-1">Name</TableHead>
                          <TableHead className="font-semibold text-xs h-8 py-1">Type</TableHead>
                          <TableHead className="font-semibold text-xs h-8 py-1">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeGroupAccounts.map((account) => (
                          <TableRow key={account.id} className="h-8 hover:bg-slate-50">
                            <TableCell className="font-mono font-semibold text-sm py-1">{account.account_code}</TableCell>
                            <TableCell className="font-medium text-sm py-1">{account.account_name}</TableCell>
                            <TableCell className="text-sm py-1">{account.account_type}</TableCell>
                            <TableCell className="text-xs text-slate-600 py-1">{account.description || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-slate-500">
                      <p className="text-sm">
                        {accountSearchTerm && filteredAccounts.length === 0 
                          ? `No accounts in '${activeAccountGroup}' match your search.`
                          : `Select a group from the left.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}