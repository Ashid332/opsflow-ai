'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Legend
} from 'recharts';

interface MachineData {
  id: string;
  name: string;
  efficiency: number;
  status: string;
}

interface OrderData {
  id: string;
  name: string;
  quantity: number;
  targetQuantity: number;
  status: string;
}

interface ChartsProps {
  machines: MachineData[];
  orders: OrderData[];
}

export function MachineEfficiencyChart({ machines }: { machines: MachineData[] }) {
  // Format data for chart
  const data = machines.map(m => ({
    name: m.name.replace(/ \(.+\)/, '').replace(' Station', '').replace(' Robot', '').replace(' Scanner', ''), // Shorten names
    Efficiency: m.efficiency,
    status: m.status
  }));

  // Define custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-2.5 shadow-md text-xs">
          <p className="font-semibold text-white mb-1">{payload[0].name}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Efficiency:</span>
            <span className="text-blue-400 font-mono font-bold">{payload[0].value}%</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-gray-400">Status:</span>
            <span className={`font-semibold ${
              item.status === 'ACTIVE' ? 'text-emerald-400' :
              item.status === 'ERROR' ? 'text-rose-400' : 'text-amber-400'
            }`}>{item.status}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={10}
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <Bar 
            dataKey="Efficiency" 
            radius={[4, 4, 0, 0]}
            fill="#3b82f6"
          >
            {data.map((entry, index) => {
              let color = '#3b82f6'; // ACTIVE -> blue
              if (entry.status === 'ERROR') color = '#f43f5e'; // ERROR -> red
              if (entry.status === 'MAINTENANCE') color = '#f59e0b'; // MAINTENANCE -> amber
              if (entry.status === 'IDLE') color = '#6b7280'; // IDLE -> gray
              return <Cell key={`cell-${index}`} fill={color} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PlantProductionChart({ orders }: { orders: OrderData[] }) {
  // Take the last 6 orders (or all if fewer) and show production vs target
  const data = [...orders]
    .reverse()
    .slice(-6)
    .map(o => ({
      name: o.name.split('#')[1] ? `#${o.name.split('#')[1]}` : o.name.substring(0, 8),
      Produced: o.quantity,
      Target: o.targetQuantity,
    }));

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={10}
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={10} 
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', borderRadius: '8px' }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
          />
          <Area 
            type="monotone" 
            dataKey="Produced" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorProduced)" 
          />
          <Area 
            type="monotone" 
            dataKey="Target" 
            stroke="#3b82f6" 
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fillOpacity={1} 
            fill="url(#colorTarget)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
