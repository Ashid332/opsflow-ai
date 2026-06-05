'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: () => void;
}

export default function FileUpload({ onUploadSuccess }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      validateAndSetFile(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'json' || ext === 'csv' || ext === 'txt') {
      setFile(selectedFile);
      setMessage(null);
    } else {
      setFile(null);
      setMessage({
        type: 'error',
        text: 'Unsupported file type. Please upload a .csv or .json file.'
      });
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/orders/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || 'File uploaded and parsed successfully!'
        });
        setFile(null);
        onUploadSuccess();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to process file.'
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      setMessage({
        type: 'error',
        text: 'An error occurred during upload. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-[#111827] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-white mb-1.5">Import Orders</h3>
      <p className="text-xs text-gray-400 mb-4">Upload a .csv or .json file to batch import production runs</p>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={onButtonClick}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
          dragActive 
            ? 'border-blue-500 bg-blue-950/20' 
            : 'border-gray-800 hover:border-gray-700 bg-gray-950/20'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.json,.txt"
          onChange={handleChange}
        />
        
        {file ? (
          <FileSpreadsheet size={32} className="text-blue-500 mb-2.5" />
        ) : (
          <Upload size={32} className="text-gray-500 mb-2.5 hover:scale-105 transition-transform" />
        )}

        <p className="text-xs font-semibold text-gray-200">
          {file ? file.name : 'Drag & drop file here, or click to browse'}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">Supports JSON (name, targetQuantity) or CSV</p>
      </div>

      {message && (
        <div className={`mt-3 flex items-start gap-2 p-2.5 rounded-lg text-xs leading-normal ${
          message.type === 'success' 
            ? 'bg-emerald-950/30 border border-emerald-900/50 text-emerald-400' 
            : 'bg-rose-950/30 border border-rose-900/50 text-rose-400'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {file && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUpload();
          }}
          disabled={loading}
          className="w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800/40 text-white font-medium text-xs shadow-md shadow-blue-600/10 active:scale-[0.98] transition-all"
        >
          {loading ? 'Processing...' : 'Upload and Queue'}
        </button>
      )}
    </div>
  );
}
