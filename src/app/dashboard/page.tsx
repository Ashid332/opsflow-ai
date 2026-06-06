'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  RefreshCw,
  Clock,
  Terminal,
  ChevronRight,
  TrendingUp,
  Percent,
  Server
} from 'lucide-react';
import { 
  ShiftSummaryChart, 
  MachineQuantityChart, 
  DocumentQuantityChart 
} from '@/components/Charts';

interface Metrics {
  totalUploads: number;
  validationFailures: number;
  avgConfidence: number;
  alerts: number;
}

interface ProductOrder {
  id: string;
  name: string;
  status: string;
  quantity: number;
  targetQuantity: number;
  createdAt: string;
  endDate?: string;
}

interface SystemLog {
  id: string;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  timestamp: string;
}

export default function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<Metrics>({
    totalUploads: 0,
    validationFailures: 0,
    avgConfidence: 0,
    alerts: 0
  });
  
  const [shiftSummary, setShiftSummary] = useState([]);
  const [machineSummary, setMachineSummary] = useState([]);
  const [quantitySummary, setQuantitySummary] = useState([]);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

    try {
      const response = await fetch('/api/dashboard', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setShiftSummary(data.shiftSummary);
        setMachineSummary(data.machineSummary);
        setQuantitySummary(data.quantitySummary);
        setOrders(data.orders);
        setLogs(data.logs);
      } else {
        const errText = await response.text();
        setError(`Failed to retrieve analytics data: Server returned status ${response.status} (${errText || response.statusText})`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Error fetching dashboard data:', err);
      if (err.name === 'AbortError') {
        setError('Request timed out. The database connection is taking too long to respond. Please check your network or try again.');
      } else {
        setError(`Failed to connect to analytics API: ${err.message || String(err)}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading plant analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 max-w-md mx-auto text-center px-4">
        <div className="p-4 rounded-full bg-rose-950/30 border border-rose-900/45 text-rose-400">
          <AlertTriangle size={32} className="animate-bounce" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Analytics Load Failed</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">{error}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="mt-2 py-2 px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/10 transition-all flex items-center gap-2"
        >
          <RefreshCw size={12} />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex justify-between items-center bg-gray-900/20 border border-gray-850 p-4 rounded-xl">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-500" />
            Extracted Operations Dashboard
          </h4>
          <p className="text-xs text-gray-400">Shift volumes, machine allocations, and validation failure analytics</p>
        </div>
        <button
          onClick={fetchDashboardData}
          className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
          title="Refresh analytics data"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Uploads */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Total Uploads</span>
            <span className="p-1.5 rounded-lg bg-blue-950 text-blue-400"><FileText size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.totalUploads}</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-bold">Processed</span> sheets in DB
            </div>
          </div>
        </div>

        {/* Validation Failures */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Validation Failures</span>
            <span className={`p-1.5 rounded-lg ${metrics.validationFailures > 0 ? 'bg-rose-950/60 text-rose-400 animate-pulse' : 'bg-gray-950 text-gray-500'}`}><AlertTriangle size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.validationFailures}</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              {metrics.validationFailures > 0 ? (
                <span className="text-rose-400 font-semibold">Flagged blocker items</span>
              ) : (
                <span className="text-emerald-400 font-semibold">0 failed extractions</span>
              )}
            </div>
          </div>
        </div>

        {/* OCR Confidence */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Avg AI Confidence</span>
            <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400"><Percent size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.avgConfidence}%</div>
            <div className="text-[10px] text-gray-500 mt-1">
              Accuracy target: &gt;90%
            </div>
          </div>
        </div>

        {/* Alarm warnings */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Active Warnings</span>
            <span className="p-1.5 rounded-lg bg-purple-950 text-purple-400"><Server size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.alerts}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              Errors needing correction
            </div>
          </div>
        </div>
      </div>

      {/* Shift and Machine Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Shift Summaries (Document Load Volumes)
          </h3>
          <ShiftSummaryChart data={shiftSummary} />
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Machine Summaries (Total Capacity Allocations)
          </h3>
          <MachineQuantityChart data={machineSummary} />
        </div>
      </div>

      {/* Quantity Summaries (Large Chart) */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
          Batch Quantity Summaries (Target Orders vs Actual Produced)
        </h3>
        <DocumentQuantityChart data={quantitySummary} />
      </div>

      {/* Processed Batches and Terminal Logs Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Processed List (Columns 1 & 2) */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">Recently Extracted Jobs</h3>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest font-mono">SQLite State</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 font-semibold">Batch Name</th>
                  <th className="pb-3 font-semibold text-center">Status</th>
                  <th className="pb-3 font-semibold">Target Units</th>
                  <th className="pb-3 font-semibold">Date Uploaded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      No document records available. Upload a sheet in Document Center to start.
                    </td>
                  </tr>
                ) : (
                  orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="text-gray-300 hover:bg-gray-800/10 transition-colors">
                      <td className="py-3.5 font-medium text-white">{order.name}</td>
                      <td className="py-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          order.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' :
                          order.status === 'SUSPENDED' ? 'bg-rose-950 text-rose-400 border border-rose-900/60' :
                          'bg-gray-950 text-gray-400 border border-gray-900'
                        }`}>
                          {order.status === 'COMPLETED' ? 'SAVED' : order.status}
                        </span>
                      </td>
                      <td className="py-3.5 font-mono text-gray-400">{order.targetQuantity} units</td>
                      <td className="py-3.5 text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Logs Terminal (Column 3) */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col h-[280px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal size={14} className="text-blue-400" />
              Extraction Audit Logs
            </h3>
            <span className="text-[10px] text-gray-500 font-mono font-medium">NOMINAL</span>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-gray-950/70 border border-gray-850 rounded-lg p-3 font-mono text-[10.5px] leading-relaxed space-y-2.5">
            {logs.length === 0 ? (
              <div className="text-gray-650 text-center py-10">No extraction actions logged.</div>
            ) : (
              logs.map((log) => {
                const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div key={log.id} className="flex gap-2 items-start text-gray-300 border-b border-gray-900/40 pb-1.5">
                    <span className="text-gray-650 shrink-0">{logTime}</span>
                    <span className={`shrink-0 font-bold ${
                      log.severity === 'ERROR' ? 'text-rose-500' :
                      log.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-500'
                    }`}>
                      [{log.action}]
                    </span>
                    <span className="text-gray-400">{log.details}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
