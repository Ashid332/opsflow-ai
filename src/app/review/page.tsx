'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  User, 
  FileText,
  Sliders,
  RefreshCw,
  Eye
} from 'lucide-react';

interface ProductOrder {
  id: string;
  name: string;
  status: string;
  quantity: number;
  targetQuantity: number;
  createdAt: string;
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

export default function ReviewQueuePage() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  // Form states mapped by inspection ID
  const [formStates, setFormStates] = useState<Record<string, {
    inspectorName: string;
    orderName: string;
    targetQuantity: number;
    machineName: string;
    shiftName: string;
    comments: string;
  }>>({});

  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const fetchInspections = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/review');
      if (response.ok) {
        const data = await response.json();
        setInspections(data);

        // Initialize form states for pending items
        const initialFormStates: typeof formStates = {};
        data.forEach((ins: QualityInspection) => {
          let meta = { shift: 'Morning Shift', machineName: 'Assembly Line A (CNC)' };
          if (ins.notes) {
            try {
              meta = JSON.parse(ins.notes);
            } catch (e) {}
          }
          if (ins.status === 'PENDING') {
            initialFormStates[ins.id] = {
              inspectorName: ins.inspectorName !== 'AI Extraction Agent' ? ins.inspectorName : '',
              orderName: ins.order.name,
              targetQuantity: ins.order.targetQuantity,
              machineName: meta.machineName || 'Assembly Line A (CNC)',
              shiftName: meta.shift || 'Morning Shift',
              comments: '',
            };
          }
        });
        setFormStates(prev => ({ ...initialFormStates, ...prev }));
      }
    } catch (err) {
      console.error('Error fetching quality queue:', err);
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
    const state = formStates[id];
    if (!state) return;

    if (!state.inspectorName.trim()) {
      alert('Please enter your Inspector Signature.');
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
          orderName: state.orderName,
          targetQuantity: state.targetQuantity,
          machineName: state.machineName,
          shiftName: state.shiftName,
          comments: state.comments,
        }),
      });

      if (response.ok) {
        alert(`Document successfully ${status === 'APPROVED' ? 'Approved & Released' : 'Rejected'}.`);
        await fetchInspections();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to submit review.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to submit review. Connection error.');
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
        <p className="text-sm text-gray-400">Loading document reviews...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-blue-500" />
            Document Verification Queue
          </h2>
          <p className="text-xs text-gray-400">Resolve flagged OCR errors, override fields, and sign off on runs</p>
        </div>
        <button
          onClick={fetchInspections}
          className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Refresh review list"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-850">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'pending'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Awaiting Verification ({pendingItems.length})
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'completed'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          Verification Audit Trail ({completedItems.length})
        </button>
      </div>

      {/* Pending Items Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-6">
          {pendingItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-gray-800 bg-[#111827]/40 rounded-xl text-center">
              <CheckCircle2 size={36} className="text-emerald-500 mb-2.5" />
              <h4 className="text-xs font-bold text-gray-200">No Pending Verifications</h4>
              <p className="text-[10px] text-gray-500 mt-1 max-w-[280px]">
                All uploaded documents have been validated and released.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingItems.map((ins) => {
                const state = formStates[ins.id] || {
                  inspectorName: '',
                  orderName: ins.order.name,
                  targetQuantity: ins.order.targetQuantity,
                  machineName: '',
                  shiftName: 'Morning Shift',
                  comments: '',
                };

                let meta = {
                  fileName: 'file.pdf',
                  confidence: { name: 1.0, targetQuantity: 1.0, machineName: 1.0, shift: 1.0 },
                  validationErrors: [] as string[]
                };

                if (ins.notes) {
                  try {
                    meta = JSON.parse(ins.notes);
                  } catch (e) {}
                }

                // Live client validation indicators
                const liveErrors: string[] = [];
                if (state.targetQuantity > 1000) {
                  liveErrors.push(`Blocker: Target quantity (${state.targetQuantity}) exceeds machine limit of 1000.`);
                }
                if (!state.machineName.trim()) {
                  liveErrors.push(`Blocker: Unrecognized or empty machine assignment.`);
                }
                const hasBlockers = liveErrors.some(e => e.startsWith('Blocker:'));
                const isSubmitting = submittingId === ins.id;

                return (
                  <div key={ins.id} className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-800 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-white">{state.orderName}</h4>
                        <span className="text-[9px] font-mono text-gray-500">File: {meta.fileName}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        ins.order.status === 'SUSPENDED' 
                          ? 'bg-rose-950 text-rose-400 border border-rose-900/60' 
                          : 'bg-amber-950 text-amber-400 border border-amber-900/60 animate-pulse'
                      }`}>
                        {ins.order.status === 'SUSPENDED' ? 'BLOCKED' : 'PENDING REVIEW'}
                      </span>
                    </div>

                    {/* OCR Input Form fields */}
                    <div className="space-y-3">
                      {/* Name */}
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Order Name</label>
                        <input
                          type="text"
                          value={state.orderName}
                          onChange={(e) => handleFormChange(ins.id, 'orderName', e.target.value)}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Target Qty</label>
                        <input
                          type="number"
                          value={state.targetQuantity}
                          onChange={(e) => handleFormChange(ins.id, 'targetQuantity', parseInt(e.target.value, 10) || 0)}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Machine */}
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Machine</label>
                        <input
                          type="text"
                          value={state.machineName}
                          onChange={(e) => handleFormChange(ins.id, 'machineName', e.target.value)}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Shift */}
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Shift Target</label>
                        <select
                          value={state.shiftName}
                          onChange={(e) => handleFormChange(ins.id, 'shiftName', e.target.value)}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        >
                          <option value="Morning Shift">Morning Shift</option>
                          <option value="Afternoon Shift">Afternoon Shift</option>
                          <option value="Night Shift">Night Shift</option>
                        </select>
                      </div>

                      {/* Signature */}
                      <div className="grid grid-cols-3 gap-2 items-center border-t border-gray-800/80 pt-2.5">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Signature *</label>
                        <input
                          type="text"
                          placeholder="Your name"
                          value={state.inspectorName}
                          onChange={(e) => handleFormChange(ins.id, 'inspectorName', e.target.value)}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-blue-900/40 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Comments */}
                      <div className="grid grid-cols-3 gap-2 items-start">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase mt-1">QA Notes</label>
                        <textarea
                          placeholder="Release or reject notes"
                          value={state.comments}
                          onChange={(e) => handleFormChange(ins.id, 'comments', e.target.value)}
                          rows={2}
                          className="col-span-2 px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Rule validations block */}
                    {liveErrors.length > 0 && (
                      <div className="p-2.5 rounded bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[10px] space-y-1">
                        {liveErrors.map((err, i) => (
                          <div key={i} className="flex gap-1 items-start">
                            <AlertCircle size={10} className="shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => submitReview(ins.id, 'REJECTED')}
                        disabled={isSubmitting}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-rose-955/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-455 text-xs font-bold text-rose-400 disabled:opacity-40"
                      >
                        <XCircle size={12} />
                        Halt & Reject
                      </button>
                      <button
                        onClick={() => submitReview(ins.id, 'APPROVED')}
                        disabled={isSubmitting || hasBlockers}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-gray-400 text-white text-xs font-bold shadow shadow-blue-600/10"
                      >
                        <CheckCircle2 size={12} />
                        Validate & Release
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completed Items Tab */}
      {activeTab === 'completed' && (
        <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-gray-950/20">
                  <th className="p-4 font-semibold">Document / Batch</th>
                  <th className="p-4 font-semibold">Verifier</th>
                  <th className="p-4 text-center font-semibold">Decision</th>
                  <th className="p-4 text-center font-semibold">Validation Errors</th>
                  <th className="p-4 font-semibold">Auditor Notes</th>
                  <th className="p-4 font-semibold">Processed Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {completedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500 animate-pulse">
                      No documents verified yet.
                    </td>
                  </tr>
                ) : (
                  completedItems.map((ins) => {
                    let errorsCount = 0;
                    if (ins.notes) {
                      try {
                        const parsed = JSON.parse(ins.notes);
                        errorsCount = parsed.validationErrors?.length || 0;
                      } catch (e) {}
                    }
                    return (
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
                            {ins.status === 'APPROVED' ? 'SAVED' : 'DISCARDED'}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono text-gray-400">{errorsCount} errors</td>
                        <td className="p-4 text-gray-450 italic max-w-xs truncate" title={ins.notes || ''}>
                          {ins.notes?.includes('comments') ? JSON.parse(ins.notes).comments : 'Validated successfully.'}
                        </td>
                        <td className="p-4 text-gray-500">
                          {new Date(ins.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
