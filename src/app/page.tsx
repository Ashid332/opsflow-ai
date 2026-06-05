'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { 
  Play, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Cpu, 
  RefreshCw,
  Clock,
  Terminal,
  ChevronRight
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { MachineEfficiencyChart, PlantProductionChart } from '@/components/Charts';

interface Metrics {
  avgEfficiency: number;
  defectRate: number;
  activeRuns: number;
  pendingRuns: number;
  completedRuns: number;
  alertCount: number;
}

interface Machine {
  id: string;
  name: string;
  status: 'ACTIVE' | 'IDLE' | 'MAINTENANCE' | 'ERROR';
  efficiency: number;
  temperature: number;
  uptime: number;
  lastMaintenance: string;
}

interface ProductOrder {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SUSPENDED';
  quantity: number;
  targetQuantity: number;
  startDate?: string;
  endDate?: string;
}

interface SystemLog {
  id: string;
  action: string;
  details: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  timestamp: string;
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics>({
    avgEfficiency: 0,
    defectRate: 0,
    activeRuns: 0,
    pendingRuns: 0,
    completedRuns: 0,
    alertCount: 0
  });
  const [machines, setMachines] = useState<Machine[]>([]);
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [autoSimulate, setAutoSimulate] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setMachines(data.machines);
        setOrders(data.orders);
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle telemetry step simulation
  const handleSimulateStep = async () => {
    if (simulating) return;
    setSimulating(true);
    try {
      const response = await fetch('/api/telemetry/simulate', { method: 'POST' });
      if (response.ok) {
        await fetchDashboardData();
      }
    } catch (err) {
      console.error('Error running telemetry simulation:', err);
    } finally {
      setSimulating(false);
    }
  };

  // Auto-simulate polling loop (ticks every 4 seconds when toggled)
  useEffect(() => {
    if (!autoSimulate) return;
    const interval = setInterval(() => {
      handleSimulateStep();
    }, 4000);
    return () => clearInterval(interval);
  }, [autoSimulate, simulating]);

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-400">Loading live plant data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Simulation Controls Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900/40 border border-gray-800 p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-950 flex items-center justify-center text-blue-400">
            <Cpu size={18} className={autoSimulate ? 'animate-spin' : ''} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Live Telemetry Control</h4>
            <p className="text-xs text-gray-400">Drive the simulator to update orders and machine states</p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setAutoSimulate(!autoSimulate)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg text-xs font-semibold border transition-all ${
              autoSimulate 
                ? 'bg-emerald-950 border-emerald-800 text-emerald-400' 
                : 'bg-gray-950 border-gray-800 text-gray-300 hover:bg-gray-900'
            }`}
          >
            <Activity size={14} className={autoSimulate ? 'animate-pulse' : ''} />
            {autoSimulate ? 'Sim: ACTIVE (4s)' : 'Start Auto-Sim'}
          </button>
          
          <button
            onClick={handleSimulateStep}
            disabled={simulating}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-xs font-semibold shadow-md shadow-blue-600/10 active:scale-95 transition-all"
          >
            <Play size={13} fill="currentColor" />
            {simulating ? 'Simulating...' : 'Simulate Telemetry Step'}
          </button>
          
          <button
            onClick={fetchDashboardData}
            className="p-1.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Plant OEE */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Plant OEE</span>
            <span className="p-1.5 rounded-lg bg-blue-950 text-blue-400"><Activity size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.avgEfficiency}%</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-bold">↑ 1.2%</span> vs last shift
            </div>
          </div>
        </div>

        {/* AI Quality Defect Rate */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">AI Defect Rate</span>
            <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400"><CheckCircle size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.defectRate}%</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-500 font-bold">↓ 0.08%</span> reject threshold 1.5%
            </div>
          </div>
        </div>

        {/* Active Runs */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Active Batches</span>
            <span className="p-1.5 rounded-lg bg-indigo-950 text-indigo-400"><Play size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.activeRuns}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              {metrics.pendingRuns} queued, {metrics.completedRuns} completed
            </div>
          </div>
        </div>

        {/* System Warnings */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Alarms / Alerts</span>
            <span className={`p-1.5 rounded-lg ${metrics.alertCount > 0 ? 'bg-rose-950/60 text-rose-400 animate-pulse' : 'bg-gray-950 text-gray-500'}`}><AlertTriangle size={14} /></span>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-white font-mono">{metrics.alertCount}</div>
            <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              {metrics.alertCount > 0 ? (
                <span className="text-rose-400 font-semibold">Active warning flags</span>
              ) : (
                <span className="text-emerald-400 font-semibold">All nodes nominal</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Machine Efficiency Overview
          </h3>
          <MachineEfficiencyChart machines={machines} />
        </div>

        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Production Run Rate (Actual vs Target)
          </h3>
          <PlantProductionChart orders={orders} />
        </div>
      </div>

      {/* Orders and Logs Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Production Queue (Columns 1 & 2) */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">Live Production Queue</h3>
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Database Sync</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="pb-3 font-semibold">Batch Name</th>
                  <th className="pb-3 font-semibold text-center">Status</th>
                  <th className="pb-3 font-semibold">Units Produced</th>
                  <th className="pb-3 font-semibold">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-500">
                      No production orders available. Import a schedule to start.
                    </td>
                  </tr>
                ) : (
                  orders.slice(0, 7).map((order) => {
                    const progress = Math.min((order.quantity / order.targetQuantity) * 100, 100);
                    return (
                      <tr key={order.id} className="text-gray-300 hover:bg-gray-800/10 transition-colors">
                        <td className="py-3.5 font-medium text-white">{order.name}</td>
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            order.status === 'RUNNING' ? 'bg-blue-950 text-blue-400 border border-blue-900/60' :
                            order.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/60' :
                            order.status === 'SUSPENDED' ? 'bg-rose-950 text-rose-400 border border-rose-900/60' :
                            'bg-gray-950 text-gray-400 border border-gray-900'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3.5 font-mono text-gray-400">
                          {order.quantity} <span className="text-[10px] text-gray-600">/ {order.targetQuantity}</span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 w-24 bg-gray-850 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${
                                  order.status === 'RUNNING' ? 'bg-blue-500' :
                                  order.status === 'COMPLETED' ? 'bg-emerald-500' :
                                  order.status === 'SUSPENDED' ? 'bg-rose-500' :
                                  'bg-gray-600'
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="font-mono text-[10px] text-gray-400 w-8 text-right">
                              {Math.round(progress)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload widget & Recent system logs (Column 3) */}
        <div className="space-y-6">
          <FileUpload onUploadSuccess={fetchDashboardData} />

          {/* Styled Terminal Log widget */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-5 shadow-sm flex flex-col h-[320px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal size={14} className="text-blue-400" />
                Live Audit Logs
              </h3>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] text-gray-500 font-medium font-mono">LIVE</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gray-950/70 border border-gray-850 rounded-lg p-3 font-mono text-[10.5px] leading-relaxed space-y-2.5">
              {logs.length === 0 ? (
                <div className="text-gray-600 text-center py-10">No system events logged.</div>
              ) : (
                logs.map((log) => {
                  const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={log.id} className="flex gap-2 items-start text-gray-300 border-b border-gray-900/40 pb-1.5">
                      <span className="text-gray-600 font-semibold shrink-0">{logTime}</span>
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
    </div>
  );
}
