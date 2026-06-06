'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Cpu, 
  Clock,
  Sparkles
} from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState<string>('');
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [avgConfidence, setAvgConfidence] = useState<number>(94.2);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timeInterval = setInterval(updateTime, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok) {
          const data = await res.json();
          if (data.metrics) {
            setProcessedCount(data.metrics.totalUploads || 0);
            setAvgConfidence(data.metrics.avgConfidence || 94.2);
          }
        }
      } catch (err) {
        console.error('Error fetching header metrics:', err);
      }
    };
    fetchStats();
    const statsInterval = setInterval(fetchStats, 15000); // refresh every 15s
    return () => clearInterval(statsInterval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-800 bg-[#090d16]/80 backdrop-blur-md px-6 lg:px-8">
      {/* Search / Title */}
      <div className="flex items-center gap-4">
        <div className="w-10 lg:hidden" />
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500 animate-pulse" />
            AI Document Processing Console
          </h2>
          <p className="text-xs text-gray-400 hidden sm:block">Intelligent extraction, validation, & release</p>
        </div>
      </div>

      {/* Header Telemetry / Document Metrics */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* 1. 88.5% OEE - Plant Performance */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-950/20 border border-indigo-900/40 text-indigo-400 text-xs font-semibold">
          <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          <div className="text-left">
            <span className="text-white font-mono font-bold block leading-none">88.5% OEE</span>
            <span className="text-[8px] text-gray-400 block mt-0.5">Plant Performance</span>
          </div>
        </div>

        {/* 2. Documents Processed Today */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-blue-950/20 border border-blue-900/40 text-blue-400 text-xs font-semibold">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <div className="text-left">
            <span className="text-white font-mono font-bold block leading-none">{processedCount} Run Sheets</span>
            <span className="text-[8px] text-gray-400 block mt-0.5">Processed Today</span>
          </div>
        </div>

        {/* 3. Average OCR Confidence */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 text-xs font-semibold">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-left">
            <span className="text-white font-mono font-bold block leading-none">{avgConfidence}% Avg OCR</span>
            <span className="text-[8px] text-gray-400 block mt-0.5">Average OCR Confidence</span>
          </div>
        </div>

        {/* Notifications Icon */}
        <button className="relative p-2 rounded-lg border border-gray-800 bg-gray-900/50 text-gray-400 hover:text-white transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
        </button>
      </div>
    </header>
  );
}
