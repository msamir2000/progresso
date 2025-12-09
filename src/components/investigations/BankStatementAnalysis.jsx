
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Upload, Loader2, AlertCircle, CheckCircle, FileDown } from 'lucide-react';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';

/**
 * Formats a number as a currency string (e.g., "1,234.56").
 * @param {number} amount - The amount to format.
 * @returns {string} The formatted currency string.
 */
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  // Ensure the amount is absolute for display if it's a payment (-ve)
  return Math.abs(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Reusable table component for displaying transaction lists.
 * @param {object} props - Component props.
 * @param {Array<object>} props.transactions - An array of transaction objects.
 * @returns {JSX.Element} A table displaying transactions.
 */
const TransactionTable = ({ transactions }) => (
  <div className="border rounded-md overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Amount (£)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx, index) => (
          <TableRow key={index}>
            <TableCell>{tx.Date || 'N/A'}</TableCell>
            <TableCell>{tx.Description || 'N/A'}</TableCell>
            <TableCell className="text-right font-mono">{formatCurrency(tx.Amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

/**
 * Bank Statement Analysis component.
 * Allows users to upload a CSV bank statement and performs predefined analysis.
 * @param {object} props - Component props.
 * @param {string} props.caseId - The ID of the case associated with this analysis.
 * @returns {JSX.Element} The Bank Statement Analysis UI.
 */
export default function BankStatementAnalysis({ caseId }) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [fileName, setFileName] = useState('');

  /**
   * Handles the file upload and initiates data extraction and analysis.
   * @param {Event} event - The file input change event.
   */
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null); // Clear previous errors
    setSuccess(null); // Clear previous success messages
    setAnalysisResults(null); // Clear previous analysis results
    setFileName(file.name);

    try {
      const { file_url } = await UploadFile({ file });
      const extractResult = await ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              "Date": { type: "string" },
              "Description": { type: "string" },
              "Paid In": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
              "Paid Out": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
              "Amount": { "anyOf": [{ "type": "number" }, { "type": "string" }] },
              "Balance": { "anyOf": [{ "type": "number" }, { "type": "string" }] }
            }
          }
        }
      });

      if (extractResult.status === "success" && Array.isArray(extractResult.output)) {
        const transactions = extractResult.output.map(tx => {
          // Normalize string amounts by removing commas and converting to float
          const paidOutStr = String(tx['Paid Out'] || 0).replace(/,/g, '');
          const paidInStr = String(tx['Paid In'] || 0).replace(/,/g, '');
          const amountStr = String(tx.Amount || 0).replace(/,/g, '');

          const paidOut = parseFloat(paidOutStr);
          const paidIn = parseFloat(paidInStr);
          const extractedAmount = parseFloat(amountStr);

          let amount;
          let type;

          // Determine the transaction amount and type based on available columns
          if (!isNaN(paidOut) && paidOut > 0) {
            amount = -Math.abs(paidOut); // Payments are negative
            type = 'payment';
          } else if (!isNaN(paidIn) && paidIn > 0) {
            amount = Math.abs(paidIn); // Receipts are positive
            type = 'receipt';
          } else if (!isNaN(extractedAmount) && extractedAmount !== 0) {
            // Fallback to 'Amount' column if 'Paid In'/'Paid Out' are missing or zero
            amount = extractedAmount;
            type = extractedAmount < 0 ? 'payment' : 'receipt'; // Infer type from 'Amount' sign
          } else {
            amount = 0; // Default to 0 if no valid amount can be parsed
            type = 'unknown';
          }
          
          return {
            ...tx,
            Amount: amount, // The standardized transaction amount
            Type: type      // 'payment' or 'receipt'
          };
        });
        performAnalysis(transactions); // Proceed to analysis
      } else {
        // Set specific error message if data extraction fails or is empty/invalid
        setError(extractResult.details || "Failed to extract data from the uploaded file. Please ensure it's a valid CSV format with 'Date', 'Description', and 'Paid In'/'Paid Out' or 'Amount' columns.");
      }
    } catch (err) {
      console.error("Bank statement analysis file upload failed:", err);
      setError("Error processing file: " + (err.message || "Unknown error"));
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset file input value to allow re-uploading the same file
    }
  };

  /**
   * Performs the main analysis on the extracted transactions.
   * Categorizes transactions and calculates grouped payments.
   * @param {Array<object>} transactions - The array of parsed transaction objects.
   */
  const performAnalysis = (transactions) => {
    try {
      // Ensure transactions is an array, default to empty array if not
      const transactionArray = Array.isArray(transactions) ? transactions : [];
      
      if (transactionArray.length === 0) {
        setError("No valid transactions found in the uploaded file.");
        setAnalysisResults(null); // Clear previous results if no transactions
        setSuccess(null); // Clear previous success
        return;
      }

      // Initialize structures for analysis results
      const groupedPayments = {}; // Temporary object to group payments by payee
      const cashWithdrawals = [];
      const bounceBackLoans = [];
      const largePayments = [];
      const suspiciousPayments = [];

      // Define keywords for different categories
      const suspiciousKeywords = [
        'bet', 'casino', 'gambling', 'lottery', 'poker', 'paypal', 'transfer to personal',
        'director loan', 'dividend', 'crypto', 'bitcoin', 'unusual', 'suspicious'
      ];
      const cashKeywords = ['atm', 'cash withdrawal', 'cash machine', 'cashpoint'];
      const bblKeywords = ['bounce back', 'bbl', 'cbils', 'government loan', 'recovery loan'];

      // Iterate through each transaction to categorize and group
      transactionArray.forEach(tx => {
        const description = (tx.Description || '').toLowerCase();
        const amount = Math.abs(parseFloat(tx.Amount) || 0); // Use absolute amount for magnitude comparison

        if (tx.Type === 'payment' && amount > 0) {
          // Group payments by payee/description. Use original description as key.
          const payeeKey = tx.Description || 'Unknown Payee';
          if (!groupedPayments[payeeKey]) {
            groupedPayments[payeeKey] = { count: 0, total: 0, transactions: [] };
          }
          groupedPayments[payeeKey].count++;
          groupedPayments[payeeKey].total += amount;
          groupedPayments[payeeKey].transactions.push(tx); // Store original transaction for potential drill-down

          // Identify cash withdrawals
          if (cashKeywords.some(keyword => description.includes(keyword))) {
            cashWithdrawals.push({ ...tx, Amount: -amount }); // Keep negative for display consistency
          }

          // Identify large payments (payments over £1,000)
          if (amount > 1000) {
            largePayments.push({ ...tx, Amount: -amount }); // Keep negative for display consistency
          }

          // Identify potentially suspicious payments
          if (suspiciousKeywords.some(keyword => description.includes(keyword))) {
            suspiciousPayments.push({ ...tx, Amount: -amount }); // Keep negative for display consistency
          }
        }

        // Identify bounce back loan receipts (receipts)
        if (tx.Type === 'receipt' && bblKeywords.some(keyword => description.includes(keyword))) {
          bounceBackLoans.push({ ...tx, Amount: amount }); // Amount is already positive for receipts
        }
      });

      // Convert groupedPayments object into a sorted array for display
      const sortedGroupedPayments = Object.entries(groupedPayments)
        .map(([payee, data]) => ({
          payee,
          count: data.count,
          total: data.total,
          transactions: data.transactions
        }))
        .sort((a, b) => b.total - a.total); // Sort by total amount descending

      // Update state with all analysis results
      setAnalysisResults({
        totalTransactions: transactionArray.length,
        groupedPayments: sortedGroupedPayments,
        // Sort other lists for consistent display
        cashWithdrawals: cashWithdrawals.sort((a, b) => new Date(b.Date) - new Date(a.Date)),
        bounceBackLoans: bounceBackLoans.sort((a, b) => new Date(b.Date) - new Date(a.Date)),
        largePayments: largePayments.sort((a, b) => b.Amount - a.Amount), // Sort by amount (descending)
        suspiciousPayments: suspiciousPayments.sort((a, b) => b.Amount - a.Amount) // Sort by amount (descending)
      });

      setSuccess(`Analysis completed successfully. Processed ${transactionArray.length} transactions.`);
      setError(null); // Clear any previous errors
    } catch (analysisError) {
      console.error("Bank statement analysis error:", analysisError);
      setError("Error during analysis: " + (analysisError.message || "Unknown error"));
      setAnalysisResults(null); // Clear results on analysis error
      setSuccess(null); // Clear success on analysis error
    }
  };

  /**
   * Exports the analysis results to a CSV file.
   */
  const exportToCSV = () => {
    if (!analysisResults) return;

    const csvData = [];
    
    // Add report header information
    csvData.push(['Bank Statement Analysis Report']);
    csvData.push(['Generated:', new Date().toLocaleString('en-GB')]);
    csvData.push(['Source File:', fileName]);
    csvData.push([]); // Empty row for visual separation

    // Add Grouped Payments section
    csvData.push(['GROUPED PAYMENTS']);
    csvData.push(['Payee', 'Number of Payments', 'Total Amount']);
    (analysisResults.groupedPayments || []).forEach(group => {
      csvData.push([group.payee, group.count, formatCurrency(group.total)]);
    });
    csvData.push([]); // Empty row

    // Helper function to add a transaction list section to the CSV data
    const addTransactionSection = (title, transactions) => {
      csvData.push([title]);
      csvData.push(['Date', 'Description', 'Amount']);
      (transactions || []).forEach(tx => {
        // Raw values will be properly quoted and escaped in the final map step
        csvData.push([tx.Date || '', tx.Description || '', formatCurrency(tx.Amount)]);
      });
      csvData.push([]); // Empty row
    };

    // Add all categorized transaction sections
    addTransactionSection("CASH WITHDRAWALS", analysisResults.cashWithdrawals);
    addTransactionSection("LARGE PAYMENTS (>£1,000)", analysisResults.largePayments);
    addTransactionSection("BOUNCE BACK LOAN RECEIPTS", analysisResults.bounceBackLoans);
    addTransactionSection("POTENTIALLY SUSPICIOUS PAYMENTS", analysisResults.suspiciousPayments);

    // Convert the array of arrays into a CSV string, handling quoting and escaping
    const csvContent = csvData.map(row => 
      row.map(cell => {
        // Convert cell to string, escape any double quotes by doubling them, then wrap in quotes
        const stringCell = String(cell);
        return `"${stringCell.replace(/"/g, '""')}"`;
      }).join(',')
    ).join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bank_statement_analysis_${new Date().toISOString().split('T')[0]}_${caseId}.csv`;
    document.body.appendChild(link); // Required for Firefox
    link.click();
    document.body.removeChild(link); // Clean up
    URL.revokeObjectURL(url); // Release the object URL
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Bank Statement Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file containing bank transactions for analysis.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="csv-upload" className="text-sm font-medium sr-only">
              Upload Bank Statement (CSV)
            </Label>
            <div className="relative">
              <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {/* Display selected file name if available and not uploading */}
              {fileName && !isUploading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  {fileName.length > 30 ? `${fileName.substring(0, 27)}...` : fileName}
                </span>
              )}
            </div>
          </div>

          {/* Error message display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Success message display */}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-green-700">{success}</span>
            </div>
          )}

          {/* Uploading/Processing indicator */}
          {isUploading && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              <span className="text-sm text-blue-700">Processing bank statement...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results Card, shown only if results are available */}
      {analysisResults && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Analysis Results</CardTitle>
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <FileDown className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-slate-600 mb-4">
              Total transactions processed: <strong>{analysisResults.totalTransactions}</strong>
            </div>

            {/* Accordion for different analysis categories (type="single" allows only one open at a time) */}
            <Accordion type="single" collapsible className="w-full">
              
              {/* Grouped Payments section */}
              <AccordionItem value="grouped-payments">
                <AccordionTrigger>
                  Grouped Payments ({(analysisResults.groupedPayments || []).length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {(analysisResults.groupedPayments || []).slice(0, 20).map((group, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <div>
                          <div className="font-medium">{group.payee}</div>
                          <div className="text-sm text-slate-500">{group.count} payments</div>
                        </div>
                        <div className="font-mono font-semibold">£{formatCurrency(group.total)}</div>
                      </div>
                    ))}
                    {/* Message if more than 20 grouped payments */}
                    {(analysisResults.groupedPayments || []).length > 20 && (
                      <div className="text-sm text-slate-500 p-2">
                        ... and {(analysisResults.groupedPayments || []).length - 20} more (full list in CSV export)
                      </div>
                    )}
                    {/* Message if no grouped payments found */}
                    {(analysisResults.groupedPayments || []).length === 0 && (
                      <p className="text-sm text-gray-500 italic">No significant grouped payments found.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Cash Withdrawals section */}
              <AccordionItem value="cash-withdrawals">
                <AccordionTrigger>
                  Cash Withdrawals ({(analysisResults.cashWithdrawals || []).length})
                </AccordionTrigger>
                <AccordionContent>
                  <TransactionTable transactions={analysisResults.cashWithdrawals || []} />
                  {(analysisResults.cashWithdrawals || []).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No cash withdrawals found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
              
              {/* Bounce Back Loan Receipts section */}
              <AccordionItem value="bounce-back-loans">
                <AccordionTrigger>
                  Bounce Back Loan Receipts ({(analysisResults.bounceBackLoans || []).length})
                </AccordionTrigger>
                <AccordionContent>
                  <TransactionTable transactions={analysisResults.bounceBackLoans || []} />
                  {(analysisResults.bounceBackLoans || []).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No bounce back loan receipts found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Large Payments section */}
              <AccordionItem value="large-payments">
                <AccordionTrigger>
                  Large Payments &gt;£1,000 ({(analysisResults.largePayments || []).length})
                </AccordionTrigger>
                <AccordionContent>
                  <TransactionTable transactions={analysisResults.largePayments || []} />
                  {(analysisResults.largePayments || []).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No large payments found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

              {/* Potentially Suspicious Payments section */}
              <AccordionItem value="suspicious-payments">
                <AccordionTrigger>
                  Potentially Suspicious Payments ({(analysisResults.suspiciousPayments || []).length})
                </AccordionTrigger>
                <AccordionContent>
                  <TransactionTable transactions={analysisResults.suspiciousPayments || []} />
                  {(analysisResults.suspiciousPayments || []).length === 0 && (
                    <p className="text-sm text-gray-500 italic">No potentially suspicious payments found.</p>
                  )}
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
