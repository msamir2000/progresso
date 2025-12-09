import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { X, FileText, TrendingUp, TrendingDown, Landmark, Printer } from 'lucide-react';

const CaseDocumentModal = ({ 
  isOpen, 
  onClose, 
  case_, 
  documents, 
  onPrintDocument,
  formatCurrency,
  formatDate 
}) => {
  if (!isOpen || !case_) return null;

  const totalDocs = documents.receiptVouchers.length + documents.paymentVouchers.length + documents.bankRequests.length;

  return (
    <AnimatePresence>
      <div className="fixed top-48 left-0 right-0 bottom-0 bg-white z-30 shadow-2xl border-t border-slate-200">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="h-full flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{case_.company_name}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span className="font-mono">{case_.case_reference}</span>
                <Badge variant="outline" className="text-xs">{case_.case_type}</Badge>
                <span>Appointed: {formatDate(case_.appointment_date)}</span>
                <span className="text-slate-400">{totalDocs} document{totalDocs !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {totalDocs === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-600 mb-2">No Documents Generated</h3>
                <p>This case doesn't have any generated documents yet.</p>
              </div>
            ) : (
              <div className="space-y-8 max-w-7xl mx-auto">
                {/* Receipt Vouchers */}
                {documents.receiptVouchers.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-3 font-bold text-lg text-green-700 mb-4">
                      <TrendingUp className="w-5 h-5" />
                      Receipt Vouchers ({documents.receiptVouchers.length})
                    </h3>
                    <div className="grid gap-3">
                      {documents.receiptVouchers.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between bg-green-50 rounded-lg p-4 border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 mb-1">{transaction.description}</p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-slate-600">
                              <span className="flex items-center gap-1">
                                <strong>Date:</strong> {formatDate(transaction.transaction_date)}
                              </span>
                              <span className="flex items-center gap-1">
                                <strong>Amount:</strong> <span className="font-semibold text-green-700">£{formatCurrency(parseFloat(transaction.amount) || 0)}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <strong>From:</strong> {transaction.payee_name || 'N/A'}
                              </span>
                              {transaction.invoice_number && (
                                <span className="flex items-center gap-1">
                                  <strong>Ref:</strong> {transaction.invoice_number}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPrintDocument(transaction)}
                            className="text-slate-600 border-slate-300 hover:bg-slate-50 ml-4"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Print Voucher
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Vouchers - Table Format */}
                {documents.paymentVouchers.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-3 font-bold text-lg text-red-700 mb-4">
                      <TrendingDown className="w-5 h-5" />
                      Payment Vouchers ({documents.paymentVouchers.length})
                    </h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="font-semibold text-slate-700">Date of Transaction</TableHead>
                            <TableHead className="font-semibold text-slate-700">Payee Name</TableHead>
                            <TableHead className="font-semibold text-slate-700">Date of Invoice</TableHead>
                            <TableHead className="font-semibold text-slate-700">File Name</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Net (£)</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">VAT (£)</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Gross (£)</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {documents.paymentVouchers.map((transaction) => (
                            <TableRow key={transaction.id} className="hover:bg-slate-50">
                              <TableCell className="text-slate-700">
                                {formatDate(transaction.transaction_date)}
                              </TableCell>
                              <TableCell className="text-slate-700 font-medium">
                                {transaction.payee_name || 'N/A'}
                              </TableCell>
                              <TableCell className="text-slate-700">
                                {transaction.date_of_invoice ? formatDate(transaction.date_of_invoice) : 'N/A'}
                              </TableCell>
                              <TableCell className="text-slate-700">
                                {transaction.description || 'N/A'}
                              </TableCell>
                              <TableCell className="text-slate-700 text-right font-mono">
                                {formatCurrency(parseFloat(transaction.net_amount) || 0)}
                              </TableCell>
                              <TableCell className="text-slate-700 text-right font-mono">
                                {formatCurrency(parseFloat(transaction.vat_amount) || 0)}
                              </TableCell>
                              <TableCell className="text-red-700 text-right font-mono font-semibold">
                                {formatCurrency(parseFloat(transaction.amount) || 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onPrintDocument(transaction)}
                                  className="text-slate-600 border-slate-300 hover:bg-slate-50"
                                >
                                  <Printer className="w-4 h-4 mr-2" />
                                  Print
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Bank Requests */}
                {documents.bankRequests.length > 0 && (
                  <div>
                    <h3 className="flex items-center gap-3 font-bold text-lg text-blue-700 mb-4">
                      <Landmark className="w-5 h-5" />
                      Bank Requests ({documents.bankRequests.length})
                    </h3>
                    <div className="grid gap-3">
                      {documents.bankRequests.map((request, index) => (
                        <div key={index} className="flex items-center justify-between bg-blue-50 rounded-lg p-4 border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 mb-1">Bank Request #{index + 1}</p>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <span>Placeholder for bank request details</span>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-slate-600 border-slate-300 hover:bg-slate-50 ml-4"
                          >
                            <Printer className="w-4 h-4 mr-2" />
                            Print Request
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CaseDocumentModal;