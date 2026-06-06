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
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Activity,
  Cpu,
  Hash,
  Hammer
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
  const [date, setDate] = useState('');
  const [shiftName, setShiftName] = useState('Morning Shift');
  const [employeeNumber, setEmployeeNumber] = useState('');
  const [operationCode, setOperationCode] = useState('');
  const [machineName, setMachineName] = useState('');
  const [workOrderNumber, setWorkOrderNumber] = useState('');
  const [targetQuantity, setTargetQuantity] = useState(0);
  const [timeTaken, setTimeTaken] = useState('');
  const [comments, setComments] = useState('');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewTab, setPreviewTab] = useState<'document' | 'ocr'>('document');
  const [previewFileAvailable, setPreviewFileAvailable] = useState<boolean | 'checking'>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scanMessages = [
    'Initializing Gemini Vision API connection...',
    'Performing OCR layout analysis & textual alignment...',
    'Extracting Date, Shift, Employee, Operation Code, Machine, WO#, Quantity & Time...',
    'Running plant-rules validation engine...'
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

    const stepInterval = setInterval(() => {
      setScanStep(prev => (prev >= 3 ? 3 : prev + 1));
    }, 900);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setTimeout(() => {
          setExtractedData(data.inspection);
          
          try {
            const meta = JSON.parse(data.inspection.notes);
            setDate(meta.date || '');
            setShiftName(meta.shift || 'Morning Shift');
            setEmployeeNumber(meta.employeeNumber || '');
            setOperationCode(meta.operationCode || '');
            setMachineName(meta.machineName || '');
            setWorkOrderNumber(meta.workOrderNumber || '');
            setTargetQuantity(meta.quantityProduced || 0);
            setTimeTaken(meta.timeTaken || '');

            if (meta.fileUrl) {
              setPreviewFileAvailable('checking');
              fetch(meta.fileUrl, { method: 'HEAD' })
                .then(res => setPreviewFileAvailable(res.ok))
                .catch(() => setPreviewFileAvailable(false));
            } else {
              setPreviewFileAvailable(false);
            }
          } catch (e) {
            setDate('');
            setShiftName('Morning Shift');
            setEmployeeNumber('');
            setOperationCode('');
            setMachineName('');
            setWorkOrderNumber('');
            setTargetQuantity(0);
            setTimeTaken('');
            setPreviewFileAvailable(false);
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
      alert('Please enter your Inspector Signature to commit release.');
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
          date,
          shift: shiftName,
          employeeNumber,
          operationCode,
          machineName,
          workOrderNumber,
          targetQuantity,
          timeTaken,
          comments,
        }),
      });

      if (response.ok) {
        alert(`Document verification successfully marked as ${status === 'APPROVED' ? 'SAVED' : 'DISCARDED'}.`);
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
    setDate('');
    setShiftName('Morning Shift');
    setEmployeeNumber('');
    setOperationCode('');
    setMachineName('');
    setWorkOrderNumber('');
    setTargetQuantity(0);
    setTimeTaken('');
    setComments('');
    setPreviewFileAvailable(true);
    setWorkflowState('upload');
  };

  // Parsing metadata for rendering confidence values
  let meta: {
    fileName: string;
    fileUrl?: string;
    fileType?: string;
    confidence: Record<string, number>;
    validationErrors: string[];
    originalText: string;
  } = {
    fileName: 'document.pdf',
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
    validationErrors: [],
    originalText: ''
  };

  if (extractedData?.notes) {
    try {
      meta = JSON.parse(extractedData.notes);
    } catch (e) {}
  }

  // Live client-side re-validation
  const liveErrors: string[] = [];
  if (targetQuantity > 1000) {
    liveErrors.push(`Blocker: Extracted quantity (${targetQuantity}) exceeds standard machine capacity of 1000 units.`);
  }
  if (!machineName.trim()) {
    liveErrors.push(`Blocker: Machine assignment field is empty.`);
  }
  if (!employeeNumber.trim()) {
    liveErrors.push(`Warning: Missing Employee Number.`);
  }
  if (!workOrderNumber.trim()) {
    liveErrors.push(`Warning: Work Order Number is empty.`);
  }

  // Low confidence flags warning (threshold 75%)
  const confidenceItems = [
    { name: 'Date', val: meta.confidence.date },
    { name: 'Shift', val: meta.confidence.shift },
    { name: 'Employee Number', val: meta.confidence.employeeNumber },
    { name: 'Operation Code', val: meta.confidence.operationCode },
    { name: 'Machine Number', val: meta.confidence.machineNumber ?? meta.confidence.machineName },
    { name: 'Work Order Number', val: meta.confidence.workOrderNumber },
    { name: 'Quantity Produced', val: meta.confidence.quantityProduced },
    { name: 'Time Taken', val: meta.confidence.timeTaken },
  ];

  confidenceItems.forEach(item => {
    if (item.val !== undefined && item.val < 0.75) {
      liveErrors.push(`Warning: Low OCR reading confidence (${Math.round(item.val * 100)}%) on '${item.name}'.`);
    }
  });

  const hasBlockers = liveErrors.some(e => e.startsWith('Blocker:'));

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return 'bg-emerald-500';
    if (score >= 0.70) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getConfidenceTextClass = (score: number) => {
    if (score >= 0.85) return 'text-emerald-400';
    if (score >= 0.70) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* 1. Upload View */}
      {workflowState === 'upload' && (
        <div className="max-w-xl mx-auto space-y-4 pt-8">
          <div className="text-center space-y-2 mb-6">
            <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
              <Sparkles className="text-blue-500 animate-pulse" />
              AI Document Processing Workspace
            </h2>
            <p className="text-xs text-gray-400">
              Upload manufacturing run sheets, logs, or CAD order forms to automatically extract job configurations using Gemini Vision OCR.
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
            <h4 className="text-sm font-bold text-gray-200">Drag & Drop file to start AI Vision Extraction</h4>
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
            <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">Running Gemini Vision OCR Pipeline</h3>
            
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
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <button
              onClick={resetWorkspace}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors back-btn"
            >
              <ArrowLeft size={14} />
              Back to Uploader
            </button>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-500">File: {file?.name || 'document.pdf'}</span>
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-ping" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left Panel: Original Document OCR Preview (2 Columns) */}
            <div className="lg:col-span-2 bg-gray-950 border border-gray-850 rounded-xl p-5 shadow-sm space-y-4 flex flex-col min-h-[640px]">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <Eye size={13} className="text-blue-400" />
                  Original Document OCR Preview
                </h3>
                {meta.fileUrl && (
                  <div className="flex bg-gray-900 border border-gray-800 rounded p-0.5 text-[8.5px]">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('document')}
                      className={`px-2 py-0.5 rounded font-sans font-semibold transition-colors ${
                        previewTab === 'document'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('ocr')}
                      className={`px-2 py-0.5 rounded font-sans font-semibold transition-colors ${
                        previewTab === 'ocr'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      OCR Map
                    </button>
                  </div>
                )}
              </div>

              {meta.fileUrl && previewTab === 'document' ? (
                <div className="flex-1 flex flex-col justify-center items-center bg-[#0c101b] border border-amber-900/10 rounded-lg p-2 overflow-hidden shadow-inner min-h-[500px]">
                  {previewFileAvailable === 'checking' ? (
                    <div className="flex flex-col justify-center items-center min-h-[450px] space-y-2">
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                      <span className="text-[10px] text-gray-500 font-sans">Verifying document preview availability...</span>
                    </div>
                  ) : previewFileAvailable === false ? (
                    <div className="flex flex-col justify-center items-center p-5 text-center min-h-[450px] space-y-4">
                      <div className="p-4 rounded-full bg-amber-950/40 text-amber-500 border border-amber-900/40">
                        <AlertCircle size={28} className="animate-pulse" />
                      </div>
                      <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">Preview File Unavailable</h4>
                      <p className="text-xs text-gray-500 max-w-[240px] leading-relaxed font-sans">
                        The original scanned PDF or image is no longer available in the ephemeral Vercel serverless storage.
                      </p>
                      <span className="px-2.5 py-0.5 rounded text-[9px] bg-blue-950 text-blue-400 font-sans border border-blue-900/50">
                        Structured OCR data is preserved
                      </span>
                    </div>
                  ) : meta.fileType?.includes('pdf') ? (
                    <iframe 
                      src={meta.fileUrl} 
                      className="w-full h-full min-h-[500px] border-none rounded bg-[#0c101b]"
                      title="Uploaded PDF Document"
                    />
                  ) : (
                    <img 
                      src={meta.fileUrl} 
                      alt="Uploaded Scanned Document" 
                      className="max-w-full max-h-[500px] object-contain rounded"
                      onError={() => setPreviewFileAvailable(false)}
                    />
                  )}
                </div>
              ) : (
                /* Rendered Mock Paper Invoice Sheet */
                <div className="relative border border-amber-900/30 bg-[#0c101b] rounded-lg p-5 font-mono text-[8.5px] text-gray-450 leading-normal space-y-4 min-h-[500px] select-none shadow-inner flex-1 flex flex-col justify-between">
                  <div>
                    <div className="border-b border-gray-900 pb-3 flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[9.5px] font-bold text-white block">SMART PLANT OPERATIONS RUN LOG</span>
                        <span className="text-gray-655 text-[7.5px]">AUTOMATED OCR METADATA RECOVERY</span>
                      </div>
                      <span className="text-gray-600">PAGE 1/1</span>
                    </div>

                    <div className="space-y-3 pt-2">
                      {/* Bounding box for WO */}
                      <div className="relative p-1.5 border border-blue-900/30 bg-blue-950/20 rounded">
                        <span className="absolute -top-1.5 left-1.5 px-0.5 bg-[#0c101b] text-blue-500 font-sans text-[6px] font-bold">1. WORK ORDER NUMBER</span>
                        <div className="text-[9px] font-semibold text-white tracking-wide">{workOrderNumber || 'WO-5121'}</div>
                      </div>

                      {/* Bounding box for Qty & Time */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative p-1.5 border border-emerald-900/30 bg-emerald-950/20 rounded">
                          <span className="absolute -top-1.5 left-1.5 px-0.5 bg-[#0c101b] text-emerald-500 font-sans text-[6px] font-bold">2. QUANTITY</span>
                          <div className="text-[9px] font-semibold text-white">{targetQuantity} units</div>
                        </div>
                        <div className="relative p-1.5 border border-indigo-900/30 bg-indigo-950/20 rounded">
                          <span className="absolute -top-1.5 left-1.5 px-0.5 bg-[#0c101b] text-indigo-500 font-sans text-[6px] font-bold">3. TIME TAKEN</span>
                          <div className="text-[9px] font-semibold text-white">{timeTaken || '4 hours'}</div>
                        </div>
                      </div>

                      {/* Bounding box for Machine & Operator */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative p-1.5 border border-purple-900/30 bg-purple-950/20 rounded">
                          <span className="absolute -top-1.5 left-1.5 px-0.5 bg-[#0c101b] text-purple-500 font-sans text-[6px] font-bold">4. MACHINE</span>
                          <div className="text-[9px] font-semibold text-white truncate">{machineName || 'Welding Robot B'}</div>
                        </div>
                        <div className="relative p-1.5 border border-pink-900/30 bg-pink-950/20 rounded">
                          <span className="absolute -top-1.5 left-1.5 px-0.5 bg-[#0c101b] text-pink-500 font-sans text-[6px] font-bold">5. OPERATOR ID</span>
                          <div className="text-[9px] font-semibold text-white truncate">{employeeNumber || 'EMP-712'}</div>
                        </div>
                      </div>

                      {/* Bounding box for Date, Shift, OpCode */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="relative p-1.5 border border-amber-900/30 bg-amber-950/20 rounded">
                          <span className="absolute -top-1.5 left-1 px-0.5 bg-[#0c101b] text-amber-500 font-sans text-[6.5px] font-bold">6. DATE</span>
                          <div className="text-[8.5px] font-semibold text-white truncate">{date}</div>
                        </div>
                        <div className="relative p-1.5 border border-teal-900/30 bg-teal-950/20 rounded">
                          <span className="absolute -top-1.5 left-1 px-0.5 bg-[#0c101b] text-teal-500 font-sans text-[6.5px] font-bold">7. SHIFT</span>
                          <div className="text-[8.5px] font-semibold text-white truncate">{shiftName}</div>
                        </div>
                        <div className="relative p-1.5 border border-gray-900 bg-gray-950/20 rounded">
                          <span className="absolute -top-1.5 left-1 px-0.5 bg-[#0c101b] text-gray-400 font-sans text-[6.5px] font-bold">8. OP CODE</span>
                          <div className="text-[8.5px] font-semibold text-white truncate">{operationCode}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-900 pt-4 space-y-1 text-gray-655 text-[8px] mt-4">
                    <div>[RAW GEMINI TEXT DE-SERIALIZATION]</div>
                    <div className="line-clamp-10 leading-relaxed font-sans">{meta.originalText}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel: Human Verification Form & Validation (3 Columns) */}
            <div className="lg:col-span-3 space-y-5">
              
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={14} className="text-blue-500" />
                  Gemini OCR Human Verification Panel
                </h3>

                {/* 8 Editable Fields Structured Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Field 1: Date */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Calendar size={11} />Date</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.date)}`}>
                        {Math.round(meta.confidence.date * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.date)}`} style={{ width: `${meta.confidence.date * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 2: Shift */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={11} />Shift</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.shift)}`}>
                        {Math.round(meta.confidence.shift * 100)}%
                      </span>
                    </div>
                    <select
                      value={shiftName}
                      onChange={(e) => setShiftName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    >
                      <option value="Morning Shift">Morning Shift</option>
                      <option value="Afternoon Shift">Afternoon Shift</option>
                      <option value="Night Shift">Night Shift</option>
                    </select>
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.shift)}`} style={{ width: `${meta.confidence.shift * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 3: Employee Number */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><User size={11} />Employee No</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.employeeNumber)}`}>
                        {Math.round(meta.confidence.employeeNumber * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.employeeNumber)}`} style={{ width: `${meta.confidence.employeeNumber * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 4: Operation Code */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Activity size={11} />Operation Code</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.operationCode)}`}>
                        {Math.round(meta.confidence.operationCode * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={operationCode}
                      onChange={(e) => setOperationCode(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.operationCode)}`} style={{ width: `${meta.confidence.operationCode * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 5: Machine Number */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Cpu size={11} />Machine Target</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.machineNumber ?? meta.confidence.machineName ?? 1.0)}`}>
                        {Math.round((meta.confidence.machineNumber ?? meta.confidence.machineName ?? 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={machineName}
                      onChange={(e) => setMachineName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.machineNumber ?? meta.confidence.machineName ?? 1.0)}`} style={{ width: `${(meta.confidence.machineNumber ?? meta.confidence.machineName ?? 1.0) * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 6: Work Order Number */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Hash size={11} />Work Order No</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.workOrderNumber)}`}>
                        {Math.round(meta.confidence.workOrderNumber * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={workOrderNumber}
                      onChange={(e) => setWorkOrderNumber(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.workOrderNumber)}`} style={{ width: `${meta.confidence.workOrderNumber * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 7: Quantity Produced */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Hammer size={11} />Qty Produced</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.quantityProduced)}`}>
                        {Math.round(meta.confidence.quantityProduced * 100)}%
                      </span>
                    </div>
                    <input
                      type="number"
                      value={targetQuantity}
                      onChange={(e) => setTargetQuantity(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.quantityProduced)}`} style={{ width: `${meta.confidence.quantityProduced * 100}%` }} />
                    </div>
                  </div>

                  {/* Field 8: Time Taken */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[10px] uppercase font-semibold text-gray-400">
                      <span className="flex items-center gap-1"><Clock size={11} />Time Taken</span>
                      <span className={`font-mono text-[9px] ${getConfidenceTextClass(meta.confidence.timeTaken)}`}>
                        {Math.round(meta.confidence.timeTaken * 100)}%
                      </span>
                    </div>
                    <input
                      type="text"
                      value={timeTaken}
                      onChange={(e) => setTimeTaken(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-gray-950 border border-gray-850 hover:border-gray-800 text-xs text-white focus:outline-none"
                    />
                    <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                      <div className={`h-full ${getConfidenceColor(meta.confidence.timeTaken)}`} style={{ width: `${meta.confidence.timeTaken * 100}%` }} />
                    </div>
                  </div>
                </div>

                {/* Supervisor Verification signature & Notes */}
                <div className="space-y-3 pt-3 border-t border-gray-850/80">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase font-semibold text-gray-400">
                        QA Supervisor Signature *
                      </label>
                      <input
                        type="text"
                        placeholder="Type signature name"
                        value={inspectorName}
                        onChange={(e) => setInspectorName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-gray-950 border border-blue-900/40 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase font-semibold text-gray-400">
                        Release Comments / Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cleared OCR errors manually"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-gray-950 border border-gray-850 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Rules Validation Panel */}
              <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-500" />
                    AI Rules Validation Panel
                  </h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    liveErrors.length > 0
                      ? hasBlockers 
                        ? 'bg-rose-950 text-rose-400 animate-pulse' 
                        : 'bg-amber-950 text-amber-400'
                      : 'bg-emerald-950 text-emerald-400'
                  }`}>
                    {liveErrors.length > 0 ? `${liveErrors.length} Issue(s) flagged` : 'All rules passed'}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[130px] overflow-y-auto pr-1">
                  {liveErrors.length === 0 ? (
                    <div className="text-xs text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 size={13} />
                      No blockers or warnings flagged. Ready to release.
                    </div>
                  ) : (
                    liveErrors.map((err, idx) => {
                      const isBlocker = err.startsWith('Blocker:');
                      return (
                        <div 
                          key={idx} 
                          className={`flex items-start gap-2 p-2 rounded-lg text-xs leading-normal ${
                            isBlocker 
                              ? 'bg-rose-950/20 border border-rose-900/30 text-rose-455 text-rose-400' 
                              : 'bg-amber-950/20 border border-amber-900/30 text-amber-455 text-amber-400'
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

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSubmitReview('REJECTED')}
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rose-950/40 border border-rose-900/60 hover:bg-rose-900/50 text-rose-400 disabled:opacity-40 text-xs font-bold active:scale-98 transition-all reject-btn"
                >
                  <XCircle size={15} />
                  Flag & Reject Document
                </button>
                
                <button
                  onClick={() => handleSubmitReview('APPROVED')}
                  disabled={submitting || hasBlockers}
                  className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 disabled:text-gray-400 text-white text-xs font-bold shadow-md shadow-blue-600/10 active:scale-98 transition-all release-btn"
                  title={hasBlockers ? 'Resolve all Blocker errors to release' : 'Verify and Save production order'}
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
