'use client';

import React from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Factory } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface WorkCenterBreakdownProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

const COLORS = [
  '#4f46e5', // indigo-600
  '#0891b2', // cyan-600
  '#059669', // emerald-600
  '#d97706', // amber-600
  '#e11d48', // rose-600
  '#7c3aed', // violet-600
  '#2563eb', // blue-600
  '#94a3b8', // slate-400
];

export const WorkCenterBreakdown: React.FC<WorkCenterBreakdownProps> = ({ data, condensed = false }) => {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const pieData = React.useMemo(() => {
    const map = new Map<string, { name: string, value: number, count: number }>();

    data.forEach(item => {
      const wc = item.workCenter || 'UNASSIGNED';
      if (!map.has(wc)) {
        map.set(wc, { name: wc, value: 0, count: 0 });
      }
      const entry = map.get(wc)!;
      entry.value += item.quantity;
      entry.count += 1;
    });

    const sorted = Array.from(map.values())
      .map(item => ({ ...item, value: Math.abs(item.value) }))
      .sort((a, b) => b.value - a.value);

    const topCount = condensed ? 8 : 16;
    if (sorted.length <= topCount) return sorted;

    const topN = sorted.slice(0, topCount);
    const othersValue = sorted.slice(topCount).reduce((acc, curr) => acc + curr.value, 0);
    const othersCount = sorted.slice(topCount).reduce((acc, curr) => acc + curr.count, 0);

    return [
      ...topN,
      { name: 'LAINNYA', value: othersValue, count: othersCount }
    ];
  }, [data, condensed]);

  const totalValue = React.useMemo(() =>
    pieData.reduce((acc, curr) => acc + curr.value, 0)
  , [pieData]);

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white/95 p-3 rounded-2xl shadow-2xl border border-slate-200 backdrop-blur-md min-w-[160px]">
          <p className="text-[11px] font-bold text-slate-400 mb-2 uppercase tracking-widest">{d.name}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-6">
              <span className="text-xs font-medium text-slate-500">Bobot:</span>
              <span className="text-sm font-black text-slate-900 tabular-nums">
                {d.value.toLocaleString(undefined, { minimumFractionDigits: 1 })} T
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="text-xs font-medium text-slate-500">Share:</span>
              <span className="text-sm font-black text-indigo-600 tabular-nums">
                {((d.value / totalValue) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (pieData.length === 0) return null;

  const chartSize = condensed ? 180 : 220;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white border border-slate-200 shadow-sm overflow-hidden hover:shadow-lg transition-all duration-300 ${condensed ? 'rounded-2xl' : 'rounded-3xl'}`}
    >
      {/* Header */}
      <div className={`${condensed ? 'px-5 py-3.5' : 'px-6 py-5'} border-b border-slate-100 flex items-center gap-3`}>
        <div className="p-2 bg-indigo-50 rounded-xl flex-shrink-0">
          <Factory className="text-indigo-600" size={18} />
        </div>
        <div>
          <h3 className={`${condensed ? 'text-xs' : 'text-sm'} font-bold text-slate-900 uppercase tracking-wider`}>
            Work Center Breakdown
          </h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
            Distribusi tonase per work center
          </p>
        </div>
      </div>

      {/* Body: grid [donut | list] — always side by side */}
      <div className={`grid divide-x divide-slate-100 ${condensed ? 'grid-cols-[140px_1fr]' : 'grid-cols-[220px_1fr]'}`}>

        {/* Donut Chart */}
        <div className="relative flex items-center justify-center bg-slate-50/20 py-6">
          <div style={{ width: condensed ? 180 : 200, height: condensed ? 180 : 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  onMouseEnter={(_, index) => setHoveredIdx(index)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={hoveredIdx === null || hoveredIdx === index ? 1 : 0.5}
                      style={{
                        filter: hoveredIdx === index ? `drop-shadow(0 0 10px ${COLORS[index % COLORS.length]}50)` : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={customTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total</p>
            <p className="text-lg font-black text-slate-900 tabular-nums leading-none">
              {Math.round(totalValue).toLocaleString()}
            </p>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">ton</p>
          </div>
        </div>

        {/* List — all items in one scrollable column */}
        <div
          className={`overflow-y-auto ${condensed ? 'max-h-[200px]' : 'max-h-[400px]'}`}
        >
          <div className={`${condensed ? 'p-3 space-y-1' : 'p-4 space-y-1'}`}>
            <AnimatePresence>
              {pieData.map((item, index) => {
                const pct = ((item.value / totalValue) * 100).toFixed(1);
                const color = COLORS[index % COLORS.length];
                const isHovered = hoveredIdx === index;
                return (
                  <motion.div
                    key={item.name}
                    initial={{ x: -8, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onMouseEnter={() => setHoveredIdx(index)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-default transition-all duration-150 border ${
                      isHovered ? 'bg-indigo-50 border-indigo-100 shadow-sm' : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    {/* Rank */}
                    <span className="text-[10px] font-black text-slate-300 w-4 text-right flex-shrink-0 tabular-nums">
                      {index + 1}
                    </span>
                    {/* Color dot */}
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {/* Name */}
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex-1 min-w-0">
                      {item.name}
                    </span>
                    {/* Progress bar */}
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    {/* Value */}
                    <span className="text-xs font-mono font-black text-slate-800 tabular-nums flex-shrink-0 w-20 text-right">
                      {item.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    {/* % Badge */}
                    <div
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums flex-shrink-0 min-w-[36px] text-center transition-colors ${
                        isHovered ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                      }`}
                    >
                      {pct}%
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

    </motion.div>
  );
};
