
import React, { useState, useEffect, useCallback } from 'react';
import { Document } from '@/api/entities';
import { Reports } from '@/api/entities';
import { UploadFile, ExtractDataFromUploadedFile } from '@/api/integrations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Upload,
  Loader2,
  FileText,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileUp,
  Download,
  Eye,
  FileArchive,
  Wand2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DocumentManager({ caseId }) {
  const [documents, setDocuments] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [newDocType, setNewDocType] = useState('');
  const [fileToUpload, setFileToUpload] = useState(null);

  const [viewingDocument, setViewingDocument] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsResult, reportsResult] = await Promise.allSettled([
        Document.filter({ case_id: caseId }, '-created_date'),
        Reports.filter({ case_id: caseId }, '-created_date')
      ]);
      
      if (docsResult.status === 'fulfilled') {
        setDocuments(docsResult.value || []);
      } else {
        console.error("Failed to load documents:", docsResult.reason);
        // Only set primary error if documents fail, reports are secondary
        setError("Could not retrieve documents."); 
      }
      
      if (reportsResult.status === 'fulfilled') {
        setReports(reportsResult.value || []);
      } else {
        console.error("Failed to load reports:", reportsResult.reason);
        // Do not overwrite document error if it exists
        if (!error) setError("Could not retrieve reports.");
      }
    } catch (e) {
      console.error("Failed to load data:", e);
      setError("Could not retrieve documents or reports. Please try refreshing.");
    }
    setIsLoading(false);
  }, [caseId, error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFileToUpload(file);
      // Auto-populate document type from file name (without extension)
      const fileName = file.name.substring(0, file.name.lastIndexOf('.'));
      setNewDocType(fileName.replace(/[-_]/g, ' '));
    }
  };

  const handleUpload = async () => {
    if (!fileToUpload || !newDocType) {
      setError("Please select a file and provide a document type.");
      return;
    }

    setIsUploading(true);
    setError(null);
    let newDocumentId = null;

    try {
      setUploadProgress('Uploading file...');
      const { file_url } = await UploadFile({ file: fileToUpload });

      setUploadProgress('Creating document record...');
      const newDoc = await Document.create({
        case_id: caseId,
        file_url: file_url,
        doc_type: newDocType,
        raw_text: '', // Initially empty
      });
      newDocumentId = newDoc.id;

      // Refresh list immediately to show the new document
      await loadData();

      // If it's a PDF, start text extraction
      if (fileToUpload.type === 'application/pdf') {
        setUploadProgress('Extracting text from PDF...');
        const extractResult = await ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              text_content: {
                type: "string",
                description: "Extract the full, raw text content of the entire document. Preserve formatting like line breaks.",
              },
            },
            required: ["text_content"],
          },
        });

        if (extractResult.status === 'success' && extractResult.output.text_content) {
          setUploadProgress('Saving extracted text...');
          await Document.update(newDocumentId, { raw_text: extractResult.output.text_content });
        } else {
          throw new Error("Failed to extract text from PDF.");
        }
      }

      setUploadProgress('Done');
    } catch (err) {
      console.error("Upload process failed:", err);
      setError(`Upload failed: ${err.message}`);
      // If the document was created but text extraction failed, it remains in the list.
      // The user can attempt re-extraction later (feature to be added).
    } finally {
      setIsUploading(false);
      setFileToUpload(null);
      setNewDocType('');
      document.getElementById('file-upload-input').value = ''; // Reset file input
      await loadData(); // Final refresh
    }
  };
  
  const handleDelete = async (docId) => {
      if(window.confirm("Are you sure you want to delete this document? This cannot be undone.")){
          try {
              await Document.delete(docId);
              loadData();
          } catch(e) {
              setError("Failed to delete document.");
          }
      }
  }

  const handleDownloadReport = (report) => {
    // Attempt to parse missing_items as JSON if it's a string, otherwise use directly
    let missingItemsString = '';
    if (typeof report.missing_items === 'string') {
        try {
            const parsedMissingItems = JSON.parse(report.missing_items);
            if (Array.isArray(parsedMissingItems)) {
                missingItemsString = parsedMissingItems.length > 0 ? ` (${parsedMissingItems.join(', ')})` : '';
            }
        } catch (e) {
            // Not a valid JSON string, treat as plain text or ignore
            missingItemsString = report.missing_items ? ` (${report.missing_items})` : '';
        }
    } else if (Array.isArray(report.missing_items)) {
        missingItemsString = report.missing_items.length > 0 ? ` (${report.missing_items.join(', ')})` : '';
    }

    // Create HTML content with proper Word document structure
    const wordContent = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" 
      xmlns:w="urn:schemas-microsoft-com:office:word" 
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="utf-8">
    <title>${report.report_type} Report</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>90</w:Zoom>
            <w:DoNotPromptForConvert/>
            <w:DoNotShowInsertionsAndDeletions/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            margin: 1in;
            size: A4;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000000;
        }
        h1 { 
            font-size: 16pt; 
            font-weight: bold; 
            margin-bottom: 12pt;
            text-align: center;
        }
        h2 { 
            font-size: 14pt; 
            font-weight: bold; 
            margin-top: 16pt;
            margin-bottom: 8pt;
        }
        h3 { 
            font-size: 12pt; 
            font-weight: bold; 
            margin-top: 12pt;
            margin-bottom: 6pt;
        }
        p { 
            margin-bottom: 6pt;
            text-align: justify;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 6pt 0;
        }
        th, td {
            border: 1pt solid black;
            padding: 4pt;
            text-align: left;
        }
        th {
            background-color: #f0f0f0;
            font-weight: bold;
        }
        .header {
            text-align: center;
            margin-bottom: 20pt;
        }
        .footer {
            margin-top: 20pt;
            text-align: center;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    ${report.ai_draft}
    
    <div class="footer">
        <p>Generated by The Johnson AI on ${new Date(report.created_date).toLocaleDateString()}</p>
    </div>
</body>
</html>`;

    // Construct filename preserving existing parts and changing extension
    const filename = `${report.report_type.replace(/ /g, '_')}${missingItemsString.replace(/[^\w\s-]/g, '').replace(/ /g, '_')}_${new Date(report.created_date).toISOString().slice(0,10)}.doc`;

    const blob = new Blob([wordContent], { 
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStatus = (doc) => {
    if (doc.file_url && doc.file_url.toLowerCase().endsWith('.pdf')) {
      return doc.raw_text ? (
        <span className="flex items-center text-green-600 text-xs font-medium">
          <CheckCircle className="w-3.5 h-3.5 mr-1" />
          Text Extracted
        </span>
      ) : (
        <span className="flex items-center text-amber-600 text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          Extraction Pending
        </span>
      );
    }
    return <span className="text-slate-500 text-xs">-</span>;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-50 border-slate-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <FileUp className="w-5 h-5" />
            Upload New Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="file-upload-input" className="font-medium">File</Label>
              <Input id="file-upload-input" type="file" onChange={handleFileChange} className="mt-1 bg-white" />
            </div>
            <div>
              <Label htmlFor="doc-type" className="font-medium">Document Type</Label>
              <Input
                id="doc-type"
                placeholder="e.g., Bank Statement, Signed Proposal..."
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="mt-1 bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button onClick={handleUpload} disabled={isUploading || !fileToUpload || !newDocType}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadProgress || 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload and Process
                </>
              )}
            </Button>
            {error && <p className="text-sm text-red-600 flex items-center gap-2"><XCircle className="w-4 h-4" />{error}</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800">
            <FileArchive className="w-5 h-5" />
            Uploaded Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-600" /></div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="font-medium">No documents found for this case.</p>
              <p className="text-sm">Upload a document to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Date Added</TableHead>
                  <TableHead>Extraction Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium text-slate-700">{doc.doc_type}</TableCell>
                    <TableCell className="text-sm text-slate-600">{new Date(doc.created_date).toLocaleDateString()}</TableCell>
                    <TableCell>{renderStatus(doc)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {doc.raw_text && (
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewingDocument(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button asChild variant="outline" size="icon" className="h-8 w-8">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Wand2 className="w-5 h-5" />
            The Johnson's Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-600" /></div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p className="font-medium">No reports generated yet.</p>
              <p className="text-sm">Use the "The Johnson" tab to generate a report.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-black font-semibold">Report Type</TableHead>
                  <TableHead className="text-black font-semibold">Date Generated</TableHead>
                  <TableHead className="text-black font-semibold">Missing Items</TableHead>
                  <TableHead className="text-right text-black font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium text-slate-700">{report.report_type}</TableCell>
                    <TableCell className="text-sm text-slate-600">{new Date(report.created_date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {report.missing_items && (Array.isArray(report.missing_items) ? report.missing_items.length > 0 ? report.missing_items.join(', ') : 'None' : report.missing_items)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewingReport(report)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDownloadReport(report)}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {viewingDocument && (
        <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Extracted Text: {viewingDocument.doc_type}</DialogTitle>
                    <DialogDescription>
                        This is the raw text automatically extracted from the PDF.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] mt-4 p-4 border rounded-md bg-slate-50">
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">
                        {viewingDocument.raw_text}
                    </pre>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={() => setViewingDocument(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

      {viewingReport && (
        <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>AI Draft: {viewingReport.report_type}</DialogTitle>
                    <DialogDescription>
                        This is the AI-generated draft. Review and edit as necessary.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-grow mt-4 p-4 border rounded-md bg-slate-50">
                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans">
                        {viewingReport.ai_draft}
                    </pre>
                </ScrollArea>
                <DialogFooter>
                    <Button onClick={() => setViewingReport(null)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
