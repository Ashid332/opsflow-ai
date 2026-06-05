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

interface KeyQuantityData {
  name: string;
  Quantity: number;
}

interface QuantitySummaryData {
  name: string;
  Target: number;
  Produced: number;
}

export function ShiftSummaryChart({ data }: { data: KeyQuantityData[] }) {
  const colors = ['#3b82f6', '#10b981', '#6366f1']; // Blue, Green, Indigo

  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
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
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', borderRadius: '8px' }}
            itemStyle={{ fontSize: '12px', color: '#fff' }}
            labelStyle={{ fontSize: '11px', color: '#9ca3af' }}
          />
          <Bar dataKey="Quantity" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MachineQuantityChart({ data }: { data: KeyQuantityData[] }) {
  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
          <XAxis 
            type="number" 
            stroke="#9ca3af" 
            fontSize={9}
            tickLine={false}
          />
          <YAxis 
            type="category" 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={9.5} 
            tickLine={false}
            width={85}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', borderRadius: '8px' }}
            itemStyle={{ fontSize: '11px', color: '#fff' }}
          />
          <Bar dataKey="Quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DocumentQuantityChart({ data }: { data: QuantitySummaryData[] }) {
  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorProduced" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
          <XAxis 
            dataKey="name" 
            stroke="#9ca3af" 
            fontSize={9.5}
            tickLine={false}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={9.5} 
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#030712', borderColor: '#1f2937', borderRadius: '8px' }}
            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
            itemStyle={{ fontSize: '11px' }}
          />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }}
          />
          <Area 
            type="monotone" 
            dataKey="Target" 
            name="Target Order Quantity"
            stroke="#3b82f6" 
            strokeWidth={1.5}
            fillOpacity={1} 
            fill="url(#colorTarget)" 
          />
          <Area 
            type="monotone" 
            dataKey="Produced" 
            name="Actual Produced Quantity"
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorProduced)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
