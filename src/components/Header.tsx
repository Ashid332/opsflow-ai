'use client';

import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Cpu, 
  AlertTriangle, 
  Clock 
} from 'lucide-react';

export default function Header() {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-gray-800 bg-[#090d16]/80 backdrop-blur-md px-6 lg:px-8">
      {/* Search / Title */}
      <div className="flex items-center gap-4">
        {/* Spacer for mobile menu toggle button */}
        <div className="w-10 lg:hidden" />
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Telemetry Dashboard</h2>
          <p className="text-xs text-gray-400 hidden sm:block">Real-time AI monitoring & workflow control</p>
        </div>
      </div>

      {/* Header Telemetry Items */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Time Widget */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-950/60 border border-gray-800/80 text-gray-300 text-xs font-mono">
          <Clock size={13} className="text-blue-500" />
          <span>{time || 'Loading...'}</span>
        </div>

        {/* Global OEE */}
        <div className="hidden sm:flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-right">
            <div className="text-xs font-semibold text-white">88.5% OEE</div>
            <div className="text-[10px] text-gray-400">Plant Performance</div>
          </div>
        </div>

        {/* Diagnostic Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-950/30 border border-blue-900/40 text-blue-400 text-xs font-medium">
          <Cpu size={14} className="animate-spin" style={{ animationDuration: '4s' }} />
          <span className="hidden xs:inline">AI Diagnostics</span>
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
