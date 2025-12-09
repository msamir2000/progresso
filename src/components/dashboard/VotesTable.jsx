import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Trash2, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export default function VotesTable({ caseId, resolutions, onResolutionsChange, isLocked }) {
  const [creditorRows, setCreditorRows] = useState([
    { id: 'row_1', creditor: '', claim: '' }
  ]);

  const handleAddCreditorRow = () => {
    setCreditorRows([...creditorRows, { id: `row_${Date.now()}`, creditor: '', claim: '' }]);
  };

  const handleRemoveCreditorRow = (rowId) => {
    setCreditorRows(creditorRows.filter(row => row.id !== rowId));
    
    const updatedResolutions = resolutions.map(res => ({
      ...res,
      votes: Object.fromEntries(
        Object.entries(res.votes || {}).filter(([rId]) => rId !== rowId)
      )
    }));
    onResolutionsChange(updatedResolutions);
  };

  const handleCreditorChange = (rowId, field, value) => {
    setCreditorRows(creditorRows.map(row => 
      row.id === rowId ? { ...row, [field]: value } : row
    ));
  };

  const handleVoteChange = (resolutionId, rowId, voteType) => {
    const updatedResolutions = resolutions.map(res => {
      if (res.id === resolutionId) {
        return {
          ...res,
          votes: {
            ...res.votes,
            [rowId]: voteType
          }
        };
      }
      return res;
    });
    onResolutionsChange(updatedResolutions);
  };

  const handleResolutionNameChange = (resolutionId, newName) => {
    const updatedResolutions = resolutions.map(res => 
      res.id === resolutionId ? { ...res, name: newName } : res
    );
    onResolutionsChange(updatedResolutions);
  };

  const handleRemoveResolution = (resolutionId) => {
    onResolutionsChange(resolutions.filter(res => res.id !== resolutionId));
  };

  const calculateResolutionStats = (resolution) => {
    const votes = resolution.votes || {};
    let totalFor = 0;
    let totalAgainst = 0;
    let totalClaim = 0;

    creditorRows.forEach(row => {
      const claim = parseFloat(row.claim) || 0;
      totalClaim += claim;
      
      const vote = votes[row.id];
      if (vote === 'for') totalFor += claim;
      else if (vote === 'against') totalAgainst += claim;
    });

    const percentFor = totalClaim > 0 ? (totalFor / totalClaim) * 100 : 0;
    const percentAgainst = totalClaim > 0 ? (totalAgainst / totalClaim) * 100 : 0;

    return {
      totalFor,
      totalAgainst,
      totalClaim,
      percentFor,
      percentAgainst
    };
  };

  const formatCurrency = (amount) => {
    return `£${(amount || 0).toLocaleString('en-GB', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  if (resolutions.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <p className="text-slate-600 mb-2">No resolutions added yet</p>
          <p className="text-sm text-slate-500">Click "Add Resolution" to create your first resolution</p>
        </div>
      </Card>
    );
  }

  return (
    <React.Fragment>
      <Card className="border-slate-200">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b-2 border-slate-300">
                <TableHead className="font-bold text-slate-900 w-[180px] py-2">Creditor</TableHead>
                <TableHead className="font-bold text-slate-900 text-right w-[80px] py-2">Balance Submitted (£)</TableHead>
                <TableHead className="w-[30px] py-2"></TableHead>
                {resolutions.map((resolution, index) => (
                  <React.Fragment key={resolution.id}>
                    <TableHead className="font-bold text-slate-900 text-center py-2 bg-blue-50 min-w-[180px]" colSpan={2}>
                      <div className="flex items-center justify-between gap-1">
                        <Input
                          value={resolution.name}
                          onChange={(e) => handleResolutionNameChange(resolution.id, e.target.value)}
                          className="text-center font-bold bg-white border-slate-300 h-7 text-xs px-2"
                          disabled={isLocked}
                        />
                        {!isLocked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveResolution(resolution.id)}
                            className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableHead>
                    {index < resolutions.length - 1 && (
                      <TableHead className="w-[20px] py-2 bg-slate-50"></TableHead>
                    )}
                  </React.Fragment>
                ))}
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
              <TableRow className="bg-slate-100 border-b border-slate-300">
                <TableHead className="py-1"></TableHead>
                <TableHead className="py-1"></TableHead>
                <TableHead className="py-1"></TableHead>
                {resolutions.map((resolution, index) => (
                  <React.Fragment key={resolution.id}>
                    <TableHead className="text-center font-semibold text-green-700 bg-green-50 border-r border-white py-1 text-xs w-[90px]">
                      In Favour
                    </TableHead>
                    <TableHead className="text-center font-semibold text-red-700 bg-red-50 py-1 text-xs w-[90px]">
                      Against
                    </TableHead>
                    {index < resolutions.length - 1 && (
                      <TableHead className="py-1 bg-slate-100"></TableHead>
                    )}
                  </React.Fragment>
                ))}
                <TableHead className="py-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditorRows.map((row, index) => (
                <TableRow key={row.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <TableCell className="py-1">
                    <Input
                      value={row.creditor}
                      onChange={(e) => handleCreditorChange(row.id, 'creditor', e.target.value)}
                      placeholder="Enter creditor name"
                      className="bg-white border-slate-200 h-7 text-xs px-2"
                      disabled={isLocked}
                    />
                  </TableCell>
                  <TableCell className="py-1">
                    <Input
                      type="number"
                      value={row.claim}
                      onChange={(e) => handleCreditorChange(row.id, 'claim', e.target.value)}
                      placeholder="0.00"
                      className="text-right bg-white border-slate-200 h-7 text-xs px-2"
                      step="0.01"
                      disabled={isLocked}
                    />
                  </TableCell>
                  <TableCell className="py-1"></TableCell>
                  {resolutions.map((resolution, resIndex) => {
                    const vote = resolution.votes?.[row.id] || '';
                    return (
                      <React.Fragment key={resolution.id}>
                        <TableCell className="text-center bg-green-50/30 border-r border-white py-1">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={vote === 'for'}
                              onCheckedChange={(checked) => 
                                handleVoteChange(resolution.id, row.id, checked ? 'for' : '')
                              }
                              className="h-3.5 w-3.5"
                              disabled={isLocked}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center bg-red-50/30 py-1">
                          <div className="flex items-center justify-center">
                            <Checkbox
                              checked={vote === 'against'}
                              onCheckedChange={(checked) => 
                                handleVoteChange(resolution.id, row.id, checked ? 'against' : '')
                              }
                              className="h-3.5 w-3.5"
                              disabled={isLocked}
                            />
                          </div>
                        </TableCell>
                        {resIndex < resolutions.length - 1 && (
                          <TableCell className="py-1 bg-slate-100"></TableCell>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <TableCell className="py-1">
                    {!isLocked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveCreditorRow(row.id)}
                        className="h-6 w-6 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        disabled={creditorRows.length === 1}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {/* Add Creditor Button Row */}
              {!isLocked && (
                <TableRow className="bg-blue-50/50 border-t border-slate-200">
                  <TableCell colSpan={3 + (resolutions.length * 2) + (resolutions.length - 1) + 1} className="py-1.5">
                    <Button
                      onClick={handleAddCreditorRow}
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed border-blue-300 text-blue-700 hover:bg-blue-100 h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Creditor
                    </Button>
                  </TableCell>
                </TableRow>
              )}

              {/* Summary Row */}
              <TableRow className="bg-slate-100 border-t-2 border-slate-400 font-semibold">
                <TableCell className="text-slate-900 py-2 font-bold text-sm">Total</TableCell>
                <TableCell className="text-right font-mono text-slate-900 py-2 font-bold text-sm">
                  {formatCurrency(creditorRows.reduce((sum, row) => sum + (parseFloat(row.claim) || 0), 0))}
                </TableCell>
                <TableCell className="py-2"></TableCell>
                {resolutions.map((resolution, resIndex) => {
                  const stats = calculateResolutionStats(resolution);
                  return (
                    <React.Fragment key={resolution.id}>
                      <TableCell className="text-center bg-green-100 border-r border-white py-2">
                        <div className="space-y-0.5">
                          <div className="text-xs text-green-700 font-semibold">
                            {formatCurrency(stats.totalFor)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center bg-red-100 py-2">
                        <div className="space-y-0.5">
                          <div className="text-xs text-red-700 font-semibold">
                            {formatCurrency(stats.totalAgainst)}
                          </div>
                        </div>
                      </TableCell>
                      {resIndex < resolutions.length - 1 && (
                        <TableCell className="py-2 bg-slate-100"></TableCell>
                      )}
                    </React.Fragment>
                  );
                })}
                <TableCell className="py-2"></TableCell>
              </TableRow>

              {/* Status Row */}
              <TableRow className="bg-white border-t border-slate-300">
                <TableCell colSpan={3}></TableCell>
                {resolutions.map((resolution, resIndex) => {
                  const stats = calculateResolutionStats(resolution);
                  const isPassed = stats.percentFor > 50;
                  return (
                    <React.Fragment key={resolution.id}>
                      <TableCell colSpan={2} className="text-center py-3">
                        <span className={`font-bold text-lg ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
                          {isPassed ? 'Passed' : 'Rejected'}
                        </span>
                      </TableCell>
                      {resIndex < resolutions.length - 1 && (
                        <TableCell className="py-3"></TableCell>
                      )}
                    </React.Fragment>
                  );
                })}
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Resolution Key */}
      <div className="space-y-3 mt-6">
        {resolutions.map((resolution) => (
          <div key={resolution.id} className="flex items-center gap-4">
            <div className="font-semibold text-slate-700 min-w-[120px] h-7 flex items-center text-xs">
              {resolution.name}
            </div>
            <Input
              value={resolution.full_text || ''}
              onChange={(e) => {
                const updatedResolutions = resolutions.map(r =>
                  r.id === resolution.id ? { ...r, full_text: e.target.value } : r
                );
                onResolutionsChange(updatedResolutions);
              }}
              placeholder="Enter full resolution text..."
              className="flex-1 border-slate-300 h-7 text-xs px-2"
              disabled={isLocked}
            />
          </div>
        ))}
      </div>
    </React.Fragment>
  );
}