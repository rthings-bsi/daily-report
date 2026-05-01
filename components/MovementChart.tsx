'use client';

import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import { ProcessedMovement } from '@/lib/excel-parser';
import { motion } from 'framer-motion';

interface MovementChartProps {
  data: ProcessedMovement[];
  trendData?: { date: string; masuk: number; keluar: number }[];
  condensed?: boolean;
}

export const MovementChart: React.FC<MovementChartProps> = ({ data, trendData, condensed = false }) => {
  const dailyData = React.useMemo(() => {
    if (trendData && trendData.length > 0) {
      return trendData;
    }
    const map = new Map<string, { date: string, masuk: number, keluar: number }>();
    data.forEach(item => {
      const date = item.dateStr;
      if (!map.has(date)) map.set(date, { date, masuk: 0, keluar: 0 });
      const entry = map.get(date)!;
      if (item.group === 'Masuk') entry.masuk += item.quantity;
      if (item.group === 'Keluar') entry.keluar += item.quantity;
    });
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, trendData]);

  const typeData = React.useMemo(() => {
    const map = new Map<string, { name: string, value: number, color: string }>();
    data.forEach(item => {
      const key = `${item.moveType}-${item.group}`;
      if (!map.has(key)) {
        const displayName = item.moveType === '311' ? item.description : item.moveType;
        map.set(key, { name: displayName, value: 0, color: item.color });
      }
      map.get(key)!.value += Math.abs(item.quantity);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [data]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 dark:bg-slate-900/95 px-4 py-3 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-md">
          <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{label}</p>
          <div className="space-y-2">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                  <span className="text-xs font-medium text-slate-500">{entry.name}:</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                  {Math.abs(entry.value).toLocaleString('id-ID', { minimumFractionDigits: 1 })} T
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${condensed ? 'mb-0' : 'mb-0'}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white border border-slate-200 shadow-sm ${condensed ? 'rounded-2xl' : 'rounded-3xl'}`}
      >
        <div className={`flex items-center justify-between border-b border-slate-100 ${condensed ? 'px-5 py-3.5' : 'px-6 py-5'}`}>
          <div>
            <h3 className={`${condensed ? 'text-xs' : 'text-sm'} font-bold text-slate-900 uppercase tracking-wider`}>Daily Movement Trend</h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">Volume Inbound vs Outbound (Ton)</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500" />
              <span className="text-xs font-bold text-slate-500">Masuk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-500" />
              <span className="text-xs font-bold text-slate-500">Keluar</span>
            </div>
          </div>
        </div>
        <div className={condensed ? 'px-4 pt-4 pb-2' : 'px-6 pt-6 pb-4'}>
          <div style={{ height: condensed ? 220 : 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(str) => str.split('-').slice(1).reverse().join('/')}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <Tooltip content={customTooltip} cursor={{ fill: '#f8fafc', radius: 4 }} />
                <Bar dataKey="masuk" fill="#10b981" radius={[5, 5, 0, 0]} name="Masuk" barSize={condensed ? 14 : 28} />
                <Bar dataKey="keluar" fill="#f43f5e" radius={[5, 5, 0, 0]} name="Keluar" barSize={condensed ? 14 : 28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`bg-white border border-slate-200 shadow-sm ${condensed ? 'rounded-2xl' : 'rounded-3xl'}`}
      >
        <div className={`border-b border-slate-100 ${condensed ? 'px-5 py-3.5' : 'px-6 py-5'}`}>
          <h3 className={`${condensed ? 'text-xs' : 'text-sm'} font-bold text-slate-900 uppercase tracking-wider`}>Volume by Movement Type</h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Distribusi berat per tipe movement</p>
        </div>
        <div className={condensed ? 'px-4 pt-4 pb-2' : 'px-6 pt-6 pb-4'}>
          <div style={{ height: condensed ? 220 : 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={42}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }}
                />
                <Tooltip content={customTooltip} cursor={{ fill: '#f8fafc', radius: 4 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={condensed ? 12 : 22}>
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
