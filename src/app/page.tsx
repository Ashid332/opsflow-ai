'use client';

import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  FileSpreadsheet
} from 'lucide-react';

interface ExtractedData {
  id: string;
  orderId: string;
  inspectorName: string;
  status: string;
  defectCount: number;
  notes: string;
  order: {
    id: string;
    name: string;
    targetQuantity: number;
    status: string;
  };
}

export default function DocumentCenter() {
  // Workflow states: 'upload' | 'scanning' | 'review'
  const [workflowState, setWorkflowState] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [scanStep, setScanStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  
  // OCR Editable Fields
  const [inspectorName, setInspectorName] = useState('');
  const [orderName, setOrderName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [machineName, setMachineName] = useState('');
  const [shiftName, setShiftName] = useState('Morning Shift');
  const [comments, setComments] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scanMessages = [
    'Initializing OCR Document Scanner...',
    'Performing AI Text Line Detection & Bounding-Box Alignments...',
    'Extracting Entities (Batch Name, Machine ID, Quantity)...',
    'Running Validation Rules Engine...'
  ];

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndProcessFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const validateAndProcessFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (['json', 'csv', 'txt', 'pdf', 'png', 'jpg', 'jpeg'].includes(ext || '')) {
      setFile(selectedFile);
      setErrorMsg('');
      triggerScanningFlow(selectedFile);
    } else {
      setErrorMsg('Unsupported file type. Please upload a .pdf, .csv, .json, or image file.');
    }
  };

  const triggerScanningFlow = async (uploadFile: File) => {
    setWorkflowState('scanning');
    setScanStep(0);

    // Animate the OCR scanning steps
    const stepInterval = setInterval(() => {
      setScanStep(prev => {
        if (prev >= 3) {
          clearInterval(stepInterval);
          return 3;
        }
        return prev + 1;
      });
    }, 900);

    // Call API simultaneously
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        // Delay transition slightly to finish animation feel
        setTimeout(() => {
          setExtractedData(data.inspection);
          setOrderName(data.order.name);
          setTargetQuantity(data.order.targetQuantity);
          
          try {
            const meta = JSON.parse(data.inspection.notes);
            setMachineName(meta.machineName || 'Assembly Line A (CNC)');
            setShiftName(meta.shift || 'Morning Shift');
          } catch (e) {
            setMachineName('Assembly Line A (CNC)');
            setShiftName('Morning Shift');
          }

          setWorkflowState('review');
        }, 3600);
      } else {
        const errData = await response.json();
        clearInterval(stepInterval);
        setErrorMsg(errData.error || 'Failed to upload document.');
        setWorkflowState('upload');
      }
    } catch (err) {
      console.error(err);
      clearInterval(stepInterval);
      setErrorMsg('Connection error. Failed to scan document.');
      setWorkflowState('upload');
    }
  };

  // Submit decision
  const handleSubmitReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!extractedData) return;
    if (!inspectorName.trim()) {
      alert('Please enter your Inspector Signature before validation.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/review/${extractedData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          inspectorName,
          orderName,
          targetQuantity,
          machineName,
          shiftName,
          comments,
        }),
      });

      if (response.ok) {
        alert(`Document extraction successfully marked as ${status}.`);
        resetWorkspace();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to submit validation review.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to validate. Connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetWorkspace = () => {
    setFile(null);
    setExtractedData(null);
    setInspectorName('');
    setOrderName('');
    setTargetQuantity(0);
    setMachineName('');
    setShiftName('Morning Shift');
    setComments('');
    setWorkflowState('upload');
  };

  // Parsing metadata for rendering
  let meta = {
    fileName: 'document.pdf',
    confidence: { name: 1.0, targetQuantity: 1.0, machineName: 1.0, shift: 1.0 },
    validationErrors: [] as string[],
    originalText: ''
  };

  if (extractedData?.notes) {
    try {
      meta = JSON.parse(extractedData.notes);
    } catch (e) {
      // Use defaults
    }
  }

  // Live client-side re-validation preview
  const liveErrors: string[] = [];
  if (targetQuantity > 1000) {
    liveErrors.push(`Blocker: Target quantity (${targetQuantity}) exceeds standard machine batch capacity of 1000 units.`);
  }
  if (!machineName.trim()) {
    liveErrors.push(`Blocker: Machine assignment field is empty.`);
  }
  if (!/#\d+/.test(orderName)) {
    liveErrors.push(`Warning: Order name lacks a specific tracking identifier (e.g. #ID).`);
  }

  const hasBlockers = liveErrors.some(e => e.startsWith('Blocker:'));

  return (
    <div className="space-y-6">
      {/* 1. Upload View */}
      {workflowState === 'upload' && (
        <div className="max-w-xl mx-auto space-y-4 pt-8">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              <Sparkles className="text-blue-500 animate-pulse" />
              Document Processing Workspace
            </h2>
            <p className="text-xs text-gray-400">
              Upload manufacturing run sheets, logs, or CAD order forms to automatically extract job configurations.
            </p>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center ${
              dragActive 
                ? 'border-blue-500 bg-blue-950/20' 
                : 'border-gray-800 hover:border-gray-700 bg-[#111827]/40 hover:bg-[#111827]/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.csv,.json,.txt,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
            />
            <div className="p-4 rounded-full bg-blue-950/40 text-blue-400 mb-4 border border-blue-900/40">
              <UploadCloud size={32} className="animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
            <h4 className="text-sm font-bold text-gray-200">Drag & Drop file to start AI Extraction</h4>
            <p className="text-xs text-gray-400 mt-1">Supports PDF work instructions, CSV/JSON schedules, or images</p>
            <button className="mt-5 py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/10 transition-colors">
              Browse Local Files
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-lg text-xs leading-normal">
              <AlertCircle size={14} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* 2. OCR Scanning Loading View */}
      {workflowState === 'scanning' && (
        <div className="max-w-md mx-auto space-y-6 pt-16 text-center">
          <div className="relative inline-flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-4 border-blue-900/30 border-t-blue-500 animate-spin" />
            <Sparkles size={20} className="absolute text-blue-400 animate-pulse" />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">Running OCR Pipeline</h3>
            
            {/* Step animation list */}
            <div className="space-y-1.5 text-left bg-gray-950/80 border border-gray-850 p-4 rounded-lg font-mono text-[10.5px]">
              {scanMessages.map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  {scanStep > idx ? (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  ) : scanStep === idx ? (
                    <Loader2 size={12} className="text-blue-500 animate-spin" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-800 ml-1" />
                  )}
                  <span className={scanStep > idx ? 'text-gray-400' : scanStep === idx ? 'text-white font-semibold' : 'text-gray-650'}>
                    {msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Split-Screen Review & Validation Workspace */}
      {workflowState === 'review' && extractedData && (
        <div className="space-y-4">
          {/* Workspace Controls Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <button
              onClick={resetWorkspace}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Uploader
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500">File: {file?.name || 'document.pdf'}</span>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Panel: Mock Original Document OCR Bounding-Boxes (2 Columns) */}
            <div className="lg:col-span-2 bg-gray-950 border border-gray-850 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Eye size={13} className="text-blue-400" />
                Original Document OCR Preview
              </h3>

              {/* Rendered Mock Paper Invoice Sheet */}
              <div className="relative border border-amber-900/30 bg-[#0c101b] rounded-lg p-6 font-mono text-[9px] text-gray-400 leading-normal space-y-6 min-h-[460px] select-none shadow-inner">
                {/* Visual Bounding Box Highlighting Overlay */}
                <div className="border-b border-gray-900 pb-4 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-white block">WORK ORDER SHEET #509</span>
                    <span className="text-gray-600">FACTORY LOGISTICS DEPT</span>
                  </div>
                  <span className="text-gray-700">PAGE 1/1</span>
                </div>

                <div className="space-y-4">
                  {/* Extracted Name OCR box */}
                  <div className="relative p-2 border border-blue-900/30 bg-blue-950/20 rounded">
                    <span className="absolute -top-2 left-2 px-1 bg-[#0c101b] text-blue-500 font-sans text-[7px] font-bold">OCR DETECTED: BATCH NAME</span>
                    <div className="text-[10px] font-semibold text-white tracking-wide">{orderName || 'Auto-Chassis Batch #512'}</div>
                    <span className="absolute right-2 top-2 text-[8px] font-sans font-bold text-blue-400">{Math.round(meta.confidence.name * 100)}% Match</span>
                  </div>

                  {/* Extracted Quantity OCR box */}
                  <div className="relative p-2 border border-emerald-900/30 bg-emerald-950/20 rounded">
                    <span className="absolute -top-2 left-2 px-1 bg-[#0c101b] text-emerald-500 font-sans text-[7px] font-bold">OCR DETECTED: QUANTITY</span>
                    <div className="text-[10px] font-semibold text-white tracking-wide font-mono">{targetQuantity} units</div>
                    <span className="absolute right-2 top-2 text-[8px] font-sans font-bold text-emerald-400">{Math.round(meta.confidence.targetQuantity * 100)}% Match</span>
                  </div>

                  {/* Extracted Machine and Shift OCR boxes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative p-2 border border-purple-900/30 bg-purple-950/20 rounded">
                      <span className="absolute -top-2 left-2 px-1 bg-[#0c101b] text-purple-500 font-sans text-[7px] font-bold">OCR DETECTED: MACHINE</span>
                      <div className="text-[9.5px] font-semibold text-white truncate">{machineName || 'Assembly Line A'}</div>
                      <span className="absolute right-1 bottom-1 text-[7px] font-sans text-purple-400">{Math.round(meta.confidence.machineName * 100)}%</span>
                    </div>

                    <div className="relative p-2 border border-indigo-900/30 bg-indigo-950/20 rounded">
                      <span className="absolute -top-2 left-2 px-1 bg-[#0c101b] text-indigo-500 font-sans text-[7px] font-bold">OCR DETECTED: SHIFT</span>
                      <div className="text-[9.5px] font-semibold text-white truncate">{shiftName}</div>
                      <span className="absolute right-1 bottom-1 text-[7px] font-sans text-indigo-400">{Math.round(meta.confidence.shift * 100)}%</span>
                    </div>
                  </div>
                </div>

                {/* Styled raw text field */}
                <div className="border-t border-gray-900 pt-4 space-y-1 text-gray-650 text-[8.5px]">
                  <div>[OCR RAW DATA DUMP]</div>
                  <div className="line-clamp-6 leading-relaxed font-sans">{meta.originalText}</div>
                </div>
              </div>
            </div>

            {/* Right Panel: Human Verification Form & Validation (3 Columns) */}
            <div className="lg:col-span-3 space-y-5">
              
              {/* Form panel */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={14} className="text-blue-500" />
                  AI Extraction Review Panel
                </h3>

                <div className="space-y-3.5">
                  {/* Order/Batch Name Editable Field */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span>Batch/Order Name *</span>
                      <span className={`font-mono ${meta.confidence.name < 0.85 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        OCR Confidence: {Math.round(meta.confidence.name * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={orderName}
                      onChange={(e) => setOrderName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                    />
                    {/* Confidence Meter */}
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.confidence.name < 0.85 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${meta.confidence.name * 100}%` }} />
                    </div>
                  </div>

                  {/* Quantity Editable Field */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span>Target Quantity *</span>
                      <span className={`font-mono ${meta.confidence.targetQuantity < 0.80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        OCR Confidence: {Math.round(meta.confidence.targetQuantity * 100)}%
                      </span>
                    </div>
                    <input
                      type="number"
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${meta.confidence.targetQuantity < 0.80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${meta.confidence.targetQuantity * 100}%` }} />
                    </div>
                  </div>

                  {/* Machine & Shift Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                        <span>Machine Assignment *</span>
                        <span className="font-mono text-[9px] text-purple-400">{Math.round(meta.confidence.machineName * 100)}%</span>
                      </div>
                      <input
                        type="text"
                        value={machineName}
                        onChange={(e) => setMachineName(e.target.value)}
                        placeholder="e.g. Welding Robot B"
                        className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                        <span>Target Shift *</span>
                        <span className="font-mono text-[9px] text-indigo-400">{Math.round(meta.confidence.shift * 100)}%</span>
                      </div>
                      <select
                        value={shiftName}
                        onChange={(e) => setShiftName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                      >
                        <option value="Morning Shift">Morning Shift</option>
                        <option value="Afternoon Shift">Afternoon Shift</option>
                        <option value="Night Shift">Night Shift</option>
                      </select>
                    </div>
                  </div>

                  {/* Inspector signature */}
                  <div className="space-y-1.5 pt-2 border-t border-gray-800/80">
                    <label className="block text-[10px] uppercase font-semibold text-gray-400">
                      Inspector Verification Signature *
                    </label>
                    <input
                      type="text"
                      placeholder="Type your name to release order"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-blue-900/40 hover:border-blue-800/60 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Comments */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] uppercase font-semibold text-gray-400">
                      QA Release Comments / Notes
                    </label>
                    <textarea
                      placeholder="Write any comments regarding extraction corrections or releases."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Validation Warning Panel */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-500" />
                    AI Rules Validation Panel
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    liveErrors.length > 0
                      ? hasBlockers 
                        ? 'bg-rose-950 text-rose-400' 
                        : 'bg-amber-950 text-amber-400'
                      : 'bg-emerald-950 text-emerald-400'
                  }`}>
                    {liveErrors.length > 0 ? `${liveErrors.length} Issue(s) flagged` : 'All rules passed'}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
                  {liveErrors.length === 0 ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 size={13} />
                      No blockers or warnings flagged. Ready to commit.
                    </div>
                  ) : (
                    liveErrors.map((err, idx) => {
                      const isBlocker = err.startsWith('Blocker:');
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs leading-normal ${
                            isBlocker 
                              ? 'bg-rose-950/20 border border-rose-900/30 text-rose-400' 
                              : 'bg-amber-950/20 border border-amber-900/30 text-amber-400'
                          }`}
                        >
                          <AlertCircle size={13} className="shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Workspace Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSubmitReview('REJECTED')}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-400 disabled:opacity-40 text-xs font-bold active:scale-98 transition-all"
                >
                  <XCircle size={15} />
                  Flag & Reject Document
                </button>
                
                <button
                  onClick={() => handleSubmitReview('APPROVED')}
                  disabled={submitting || hasBlockers}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-gray-400 disabled:border-transparent text-white text-xs font-bold shadow-md shadow-blue-600/10 active:scale-98 transition-all"
                  title={hasBlockers ? 'Resolve all Blocker errors to release' : 'Save and Release production batch'}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Committing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      Verify, Validate & Save
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
