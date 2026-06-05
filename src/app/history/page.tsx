'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  History, 
  Search, 
  AlertTriangle, 
  Info, 
  XCircle, 
  RefreshCw,
  SlidersHorizontal,
  FileSpreadsheet
} from 'lucide-react';

interface SystemLog {
  id: string;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  timestamp: string;
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (search) queryParams.append('search', search);
      if (severity !== 'ALL') queryParams.append('severity', severity);
      if (actionFilter !== 'ALL') queryParams.append('action', actionFilter);

      const response = await fetch(`/api/history?${queryParams.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs);
        setActions(data.actions);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, severity, actionFilter]);

  // Refetch logs when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLogs();
    }, 300); // 300ms debounce for search query
    return () => clearTimeout(timer);
  }, [search, severity, actionFilter, fetchLogs]);

  // Calculate stats of current matching logs
  const errorCount = logs.filter(l => l.severity === 'ERROR').length;
  const warningCount = logs.filter(l => l.severity === 'WARNING').length;
  const infoCount = logs.filter(l => l.severity === 'INFO').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <History className="text-blue-500" />
            Audit History Explorer
          </h2>
          <p className="text-xs text-gray-400">Search, filter, and inspect previous document extraction and validation logs</p>
        </div>
        <button
          onClick={fetchLogs}
          className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Refresh audit history"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
          <SlidersHorizontal size={14} className="text-blue-400" />
          <span>Filters & Constraints</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Keyword Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Search details or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none placeholder-gray-650 transition-colors"
            />
          </div>

          {/* Severity Dropdown */}
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>

          {/* Action Code Dropdown */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-850 hover:border-gray-800 focus:border-blue-500 text-xs text-white focus:outline-none transition-colors"
          >
            <option value="ALL">All Action Events</option>
            {actions.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Aggregate stats based on current view */}
      <div className="grid grid-cols-3 gap-4 bg-gray-900/20 border border-gray-850 p-3.5 rounded-xl">
        <div className="text-center">
          <span className="text-[10px] uppercase text-gray-500 font-bold block">Info Logs</span>
          <span className="text-sm font-bold text-blue-400 font-mono mt-0.5 block">{infoCount}</span>
        </div>
        <div className="text-center border-x border-gray-850/60">
          <span className="text-[10px] uppercase text-gray-500 font-bold block">Warnings</span>
          <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">{warningCount}</span>
        </div>
        <div className="text-center">
          <span className="text-[10px] uppercase text-gray-500 font-bold block">Errors</span>
          <span className="text-sm font-bold text-rose-400 font-mono mt-0.5 block">{errorCount}</span>
        </div>
      </div>

      {/* Audit Trail List */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 bg-gray-950/20">
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold text-center">Severity</th>
                <th className="p-4 font-semibold">Action Event</th>
                <th className="p-4 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 font-mono text-[11px]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 text-blue-500 animate-spin mx-auto mb-2" />
                    Fetching matching history records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No matching log entries found for current filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="text-gray-300 hover:bg-gray-850/20 transition-colors">
                    <td className="p-4 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                        log.severity === 'ERROR' ? 'bg-rose-950 text-rose-400 border border-rose-900/50' :
                        log.severity === 'WARNING' ? 'bg-amber-950 text-amber-400 border border-amber-900/50' :
                        'bg-blue-950 text-blue-400 border border-blue-900/50'
                      }`}>
                        {log.severity === 'ERROR' ? <XCircle size={10} /> : 
                         log.severity === 'WARNING' ? <AlertTriangle size={10} /> : 
                         <Info size={10} />}
                        {log.severity}
                      </span>
                    </td>
                    <td className="p-4 font-semibold text-white whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="p-4 text-gray-400 font-sans leading-relaxed max-w-lg">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
