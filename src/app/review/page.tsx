'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Calendar,
  Clock,
  User,
  Activity,
  Cpu,
  Hash,
  Hammer
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
    date: string;
    shiftName: string;
    employeeNumber: string;
    operationCode: string;
    machineName: string;
    workOrderNumber: string;
    targetQuantity: number;
    timeTaken: string;
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
          let meta = { 
            date: '',
            shift: 'Morning Shift', 
            employeeNumber: '',
            operationCode: '',
            machineName: 'Assembly Line A (CNC)', 
            workOrderNumber: '',
            quantityProduced: ins.order.targetQuantity,
            timeTaken: ''
          };
          
          if (ins.notes) {
            try {
              meta = JSON.parse(ins.notes);
            } catch (e) {}
          }
          
          if (ins.status === 'PENDING') {
            initialFormStates[ins.id] = {
              inspectorName: ins.inspectorName !== 'AI OCR Agent' && ins.inspectorName !== 'AI Extraction Agent' ? ins.inspectorName : '',
              date: meta.date || new Date().toISOString().split('T')[0],
              shiftName: meta.shift || 'Morning Shift',
              employeeNumber: meta.employeeNumber || ins.inspectorName || '',
              operationCode: meta.operationCode || '',
              machineName: meta.machineName || 'Assembly Line A (CNC)',
              workOrderNumber: meta.workOrderNumber || ins.order.name,
              targetQuantity: meta.quantityProduced !== undefined ? meta.quantityProduced : ins.order.targetQuantity,
              timeTaken: meta.timeTaken || '',
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
          date: state.date,
          shift: state.shiftName,
          employeeNumber: state.employeeNumber,
          operationCode: state.operationCode,
          machineName: state.machineName,
          workOrderNumber: state.workOrderNumber,
          targetQuantity: state.targetQuantity,
          timeTaken: state.timeTaken,
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
                  date: '',
                  shiftName: 'Morning Shift',
                  employeeNumber: '',
                  operationCode: '',
                  machineName: '',
                  workOrderNumber: '',
                  targetQuantity: 0,
                  timeTaken: '',
                  comments: '',
                };

                let meta = {
                  fileName: 'file.pdf',
                  confidence: {
                    date: 1.0,
                    shift: 1.0,
                    employeeNumber: 1.0,
                    operationCode: 1.0,
                    machineName: 1.0,
                    workOrderNumber: 1.0,
                    quantityProduced: 1.0,
                    timeTaken: 1.0
                  },
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
                  liveErrors.push(`Blocker: Quantity (${state.targetQuantity}) exceeds standard limit of 1000.`);
                }
                if (!state.machineName.trim()) {
                  liveErrors.push(`Blocker: Empty machine assignment field.`);
                }
                if (!state.employeeNumber.trim()) {
                  liveErrors.push(`Warning: Empty Employee Number.`);
                }

                const hasBlockers = liveErrors.some(e => e.startsWith('Blocker:'));
                const isSubmitting = submittingId === ins.id;

                return (
                  <div key={ins.id} className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start border-b border-gray-800 pb-3">
                      <div>
                        <h4 className="font-bold text-sm text-white">{state.workOrderNumber || ins.order.name}</h4>
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

                    {/* 8 OCR Input Form fields grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      
                      {/* Date */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Calendar size={11} /> Date
                        </label>
                        <input
                          type="text"
                          value={state.date}
                          onChange={(e) => handleFormChange(ins.id, 'date', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Shift */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Clock size={11} /> Shift
                        </label>
                        <select
                          value={state.shiftName}
                          onChange={(e) => handleFormChange(ins.id, 'shiftName', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        >
                          <option value="Morning Shift">Morning Shift</option>
                          <option value="Afternoon Shift">Afternoon Shift</option>
                          <option value="Night Shift">Night Shift</option>
                        </select>
                      </div>

                      {/* Employee Number */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <User size={11} /> Operator No
                        </label>
                        <input
                          type="text"
                          value={state.employeeNumber}
                          onChange={(e) => handleFormChange(ins.id, 'employeeNumber', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Operation Code */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Activity size={11} /> Op Code
                        </label>
                        <input
                          type="text"
                          value={state.operationCode}
                          onChange={(e) => handleFormChange(ins.id, 'operationCode', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Machine */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Cpu size={11} /> Machine
                        </label>
                        <input
                          type="text"
                          value={state.machineName}
                          onChange={(e) => handleFormChange(ins.id, 'machineName', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Work Order */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Hash size={11} /> Work Order No
                        </label>
                        <input
                          type="text"
                          value={state.workOrderNumber}
                          onChange={(e) => handleFormChange(ins.id, 'workOrderNumber', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Hammer size={11} /> Qty Produced
                        </label>
                        <input
                          type="number"
                          value={state.targetQuantity}
                          onChange={(e) => handleFormChange(ins.id, 'targetQuantity', parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Time Taken */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase flex items-center gap-1">
                          <Clock size={11} /> Time Taken
                        </label>
                        <input
                          type="text"
                          value={state.timeTaken}
                          onChange={(e) => handleFormChange(ins.id, 'timeTaken', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                        />
                      </div>

                    </div>

                    {/* Signature and Comments */}
                    <div className="space-y-2 border-t border-gray-850/60 pt-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Supervisor Signature *</label>
                        <input
                          type="text"
                          placeholder="Your verification name"
                          value={state.inspectorName}
                          onChange={(e) => handleFormChange(ins.id, 'inspectorName', e.target.value)}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-blue-900/40 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase">Supervisor Release Notes</label>
                        <textarea
                          placeholder="Review comments"
                          value={state.comments}
                          onChange={(e) => handleFormChange(ins.id, 'comments', e.target.value)}
                          rows={1}
                          className="w-full px-2.5 py-1 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none resize-none"
                        />
                      </div>
                    </div>

                    {/* Rule validations block */}
                    {liveErrors.length > 0 && (
                      <div className="p-2.5 rounded bg-rose-955/20 border border-rose-900/30 text-rose-455 text-[10px] text-rose-400 space-y-1">
                        {liveErrors.map((err, i) => (
                          <div key={i} className="flex gap-1 items-start">
                            <AlertCircle size={10} className="shrink-0 mt-0.5" />
                            <span>{err}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-850/40">
                      <button
                        onClick={() => submitReview(ins.id, 'REJECTED')}
                        disabled={isSubmitting}
                        className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-400 disabled:opacity-40 text-xs font-bold"
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
                  <th className="p-4 font-semibold">Work Order No</th>
                  <th className="p-4 font-semibold">Date</th>
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
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No documents verified yet.
                    </td>
                  </tr>
                ) : (
                  completedItems.map((ins) => {
                    let errorsCount = 0;
                    let dateVal = '';
                    let woNum = ins.order.name;
                    
                    if (ins.notes) {
                      try {
                        const parsed = JSON.parse(ins.notes);
                        errorsCount = parsed.validationErrors?.length || 0;
                        dateVal = parsed.date || '';
                        woNum = parsed.workOrderNumber || woNum;
                      } catch (e) {}
                    }
                    
                    return (
                      <tr key={ins.id} className="text-gray-300 hover:bg-gray-800/5 transition-colors">
                        <td className="p-4 font-medium text-white font-mono">{woNum}</td>
                        <td className="p-4 font-mono">{dateVal || 'N/A'}</td>
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
