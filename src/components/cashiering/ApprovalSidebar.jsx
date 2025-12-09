import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle } from 'lucide-react';

export default function ApprovalSidebar({ 
  activeView, 
  onViewChange, 
  awaitingCount = 0, 
  postedCount = 0 
}) {
  return (
    <div className="w-64 flex-shrink-0 space-y-1">
      {/* Vouchers Section */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">
          Vouchers
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => onViewChange('vouchers_awaiting')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center justify-between ${
              activeView === 'vouchers_awaiting'
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm">Awaiting Approval</span>
            </div>
            {awaitingCount > 0 && (
              <Badge className="bg-blue-600 text-white text-xs">
                {awaitingCount}
              </Badge>
            )}
          </button>

          <button
            onClick={() => onViewChange('vouchers_posted')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center justify-between ${
              activeView === 'vouchers_posted'
                ? 'bg-green-100 text-green-800 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Posted</span>
            </div>
            {postedCount > 0 && (
              <Badge className="bg-green-600 text-white text-xs">
                {postedCount}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Bank Reconciliations Section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 py-2">
          Bank Reconciliations
        </h3>
        <div className="space-y-1">
          <button
            onClick={() => onViewChange('bank_rec_awaiting')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center justify-between ${
              activeView === 'bank_rec_awaiting'
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              <span className="text-sm">Awaiting Approval</span>
            </div>
          </button>

          <button
            onClick={() => onViewChange('bank_rec_posted')}
            className={`w-full text-left px-4 py-2 rounded-lg transition-colors flex items-center justify-between ${
              activeView === 'bank_rec_posted'
                ? 'bg-green-100 text-green-800 font-medium'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Posted</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}