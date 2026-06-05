'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  User, 
  FileText,
  Hammer,
  RefreshCw
} from 'lucide-react';

interface ProductOrder {
  id: string;
  name: string;
  status: string;
  quantity: number;
  targetQuantity: number;
  endDate?: string;
}

interface QualityInspection {
  id: string;
  orderId: string;
  inspectorName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  defectCount: number;
  notes: string | null;
  createdAt: string;
  order: ProductOrder;
}

export default function ReviewPage() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form state indexed by inspection ID
  const [formStates, setFormStates] = useState<Record<string, {
    inspectorName: string;
    defectCount: number;
    notes: string;
  }>>({});
  
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchInspections = useCallback(async () => {
    try {
      const response = await fetch('/api/review');
      if (response.ok) {
        const data = await response.json();
        setInspections(data);
        
        // Initialize form states for pending items
        const initialFormStates: typeof formStates = {};
        data.forEach((ins: QualityInspection) => {
          if (ins.status === 'PENDING') {
            initialFormStates[ins.id] = {
              inspectorName: ins.inspectorName || '',
              defectCount: ins.defectCount || 0,
              notes: ins.notes || '',
            };
          }
        });
        setFormStates(prev => ({ ...initialFormStates, ...prev }));
      }
    } catch (err) {
      console.error('Error loading inspections:', err);
    } finally {
      setLoading(false);
    }
  }, [formStates]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const handleFormChange = (id: string, field: string, value: any) => {
    setFormStates(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const submitReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const state = formStates[id] || { inspectorName: 'System Inspector', defectCount: 0, notes: '' };
    
    if (!state.inspectorName.trim()) {
      alert('Please provide an inspector name.');
      return;
    }

    setSubmittingId(id);
    try {
      const response = await fetch(`/api/review/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          inspectorName: state.inspectorName,
          defectCount: state.defectCount,
          notes: state.notes,
        }),
      });

      if (response.ok) {
        await fetchInspections();
      } else {
        const errData = await response.json();
        alert(errData.error || 'Failed to submit review.');
      }
    } catch (err) {
      console.error('Error submitting review:', err);
      alert('Connection error. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  const pendingItems = inspections.filter(i => i.status === 'PENDING');
  const completedItems = inspections.filter(i => i.status !== 'PENDING');

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading quality workflows...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-blue-500" />
            Quality Assurance Workflows
          </h2>
          <p className="text-xs text-gray-400">Review completed batches, sign off, or reject anomalies to halt lines</p>
        </div>
        <button
          onClick={fetchInspections}
          className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Refresh quality audits"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Awaiting Review Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Awaiting Review ({pendingItems.length})
        </h3>

        {pendingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-gray-800 bg-[#111827]/40 text-center">
            <CheckCircle2 size={36} className="text-emerald-500 mb-2.5" />
            <p className="text-xs font-semibold text-gray-200">Quality Queue Clear</p>
            <p className="text-[10px] text-gray-500 mt-1 max-w-[280px]">
              All completed batches have been approved. New runs will appear here once finished.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingItems.map((ins) => {
              const state = formStates[ins.id] || { inspectorName: '', defectCount: 0, notes: '' };
              const isSubmitting = submittingId === ins.id;

              return (
                <div key={ins.id} className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                  {/* Order Summary Header */}
                  <div className="flex justify-between items-start border-b border-gray-800/80 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-white">{ins.order.name}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Completed: {ins.order.endDate ? new Date(ins.order.endDate).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950 text-amber-400 border border-amber-900/60 animate-pulse">
                      Awaiting Sign-off
                    </span>
                  </div>

                  {/* Telemetry info */}
                  <div className="grid grid-cols-2 gap-3 text-xs bg-gray-950/40 p-3 rounded-lg border border-gray-850">
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">Yield Produced</span>
                      <span className="text-gray-200 font-semibold font-mono">{ins.order.quantity} units</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase">AI Scanner Flags</span>
                      <span className={`font-semibold font-mono ${ins.defectCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {ins.defectCount} defects
                      </span>
                    </div>
                  </div>

                  {/* QA Input Form */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                        Inspector Signature *
                      </label>
                      <div className="relative">
                        <User size={12} className="absolute left-3 top-2.5 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Enter your name"
                          value={state.inspectorName}
                          onChange={(e) => handleFormChange(ins.id, 'inspectorName', e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-blue-500 text-xs text-white focus:outline-none placeholder-gray-600 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                        Verified Defect Count
                      </label>
                      <div className="relative">
                        <Hammer size={12} className="absolute left-3 top-2.5 text-gray-500" />
                        <input
                          type="number"
                          min={0}
                          value={state.defectCount}
                          onChange={(e) => handleFormChange(ins.id, 'defectCount', parseInt(e.target.value, 10) || 0)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">
                        QA Comments & Analysis
                      </label>
                      <div className="relative">
                        <FileText size={12} className="absolute left-3 top-2.5 text-gray-500" />
                        <textarea
                          placeholder="e.g. Dimensions check out. Fitment within tolerance."
                          value={state.notes}
                          onChange={(e) => handleFormChange(ins.id, 'notes', e.target.value)}
                          rows={2}
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Submission buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => submitReview(ins.id, 'REJECTED')}
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-400 disabled:opacity-40 text-xs font-semibold active:scale-95 transition-all"
                    >
                      <XCircle size={14} />
                      Reject Run
                    </button>
                    <button
                      onClick={() => submitReview(ins.id, 'APPROVED')}
                      disabled={isSubmitting}
                      className="flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white text-xs font-semibold shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                      <CheckCircle2 size={14} />
                      Approve Release
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision Audit Trail Section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gray-650" />
          Inspection Audit Trail ({completedItems.length})
        </h3>

        <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-gray-950/20">
                  <th className="p-4 font-semibold">Batch Name</th>
                  <th className="p-4 font-semibold">Inspector</th>
                  <th className="p-4 font-semibold text-center">Decision</th>
                  <th className="p-4 font-semibold text-center">Verified Defects</th>
                  <th className="p-4 font-semibold">Comments</th>
                  <th className="p-4 font-semibold">Date Reviewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {completedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No inspections have been approved or rejected yet.
                    </td>
                  </tr>
                ) : (
                  completedItems.map((ins) => (
                    <tr key={ins.id} className="text-gray-300 hover:bg-gray-800/5 transition-colors">
                      <td className="p-4 font-medium text-white">{ins.order.name}</td>
                      <td className="p-4">{ins.inspectorName}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          ins.status === 'APPROVED' 
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' 
                            : 'bg-rose-950 text-rose-400 border border-rose-900/60'
                        }`}>
                          {ins.status === 'APPROVED' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                          {ins.status}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono">{ins.defectCount}</td>
                      <td className="p-4 text-gray-400 italic max-w-xs truncate" title={ins.notes || ''}>
                        {ins.notes || 'No comments left.'}
                      </td>
                      <td className="p-4 text-gray-500">
                        {new Date(ins.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
