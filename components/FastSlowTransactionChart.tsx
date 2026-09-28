'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Zap } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface FastSlowTransactionChartProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

interface CategoryData {
  key: string;
  label: string;
  color: string;
  totalTon: number;
  totalTx: number;
  masukTon: number;
  keluarTon: number;
  mi: number;
  ki: number;
}

const CATEGORIES = [
  { key: 'Fast', label: 'Fast Moving', color: '#059669' },
  { key: 'Slow', label: 'Slow Moving', color: '#d97706' },
];

const fmtTon = (ton: number) =>
  ton.toLocaleString('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

export const FastSlowTransactionChart: React.FC<FastSlowTransactionChartProps> = ({
  data,
  condensed = false,
}) => {
  const [metric, setMetric] = useState<'tonnage' | 'tx'>('tonnage');

  const rows: CategoryData[] = useMemo(() => {
    const bucket: Record<string, { mi: number; ki: number; mt: number; kt: number }> = {
      Fast: { mi: 0, ki: 0, mt: 0, kt: 0 },
      Slow: { mi: 0, ki: 0, mt: 0, kt: 0 },
      U: { mi: 0, ki: 0, mt: 0, kt: 0 },
    };

    for (const m of data) {
      const k = m.movementStatus === 'Fast' || m.movementStatus === 'Slow' ? m.movementStatus : 'U';
      const w = Math.abs(m.quantity);
      if (m.group === 'Masuk') {
        bucket[k].mi++;
        bucket[k].mt += w;
      } else if (m.group === 'Keluar') {
        bucket[k].ki++;
        bucket[k].kt += w;
      }
    }

    const result: CategoryData[] = CATEGORIES.map(cat => {
      const b = bucket[cat.key];
      return {
        ...cat,
        totalTon: (b.mt + b.kt) / 1000,
        totalTx: b.mi + b.ki,
        masukTon: b.mt / 1000,
        keluarTon: b.kt / 1000,
        mi: b.mi,
        ki: b.ki,
      };
    }).filter(r => r.totalTx > 0);

    if (result.length > 0) {
      if (bucket.U.mi + bucket.U.ki > 0) {
        result.push({
          key: 'U',
          label: 'Unknown',
          color: '#64748b',
          totalTon: (bucket.U.mt + bucket.U.kt) / 1000,
          totalTx: bucket.U.mi + bucket.U.ki,
          masukTon: bucket.U.mt / 1000,
          keluarTon: bucket.U.kt / 1000,
          mi: bucket.U.mi,
          ki: bucket.U.ki,
        });
      }
      return result;
    }

    if (bucket.U.mi + bucket.U.ki > 0) {
      return [
        {
          key: 'U',
          label: 'Total Transaksi',
          color: '#2563eb',
          totalTon: (bucket.U.mt + bucket.U.kt) / 1000,
          totalTx: bucket.U.mi + bucket.U.ki,
          masukTon: bucket.U.mt / 1000,
          keluarTon: bucket.U.kt / 1000,
          mi: bucket.U.mi,
          ki: bucket.U.ki,
        },
      ];
    }

    return [];
  }, [data]);

  const grandTotalTon = useMemo(() => rows.reduce((acc, r) => acc + r.totalTon, 0), [rows]);
  const grandTotalTx = useMemo(() => rows.reduce((acc, r) => acc + r.totalTx, 0), [rows]);

  const chartData = useMemo(() => {
    return rows.map(r => {
      const rawVal = metric === 'tonnage' ? r.totalTon : r.totalTx;
      const base = metric === 'tonnage' ? grandTotalTon : grandTotalTx;
      const pct = base > 0 ? (rawVal / base) * 100 : 0;
      return {
        name: r.label,
        value: rawVal,
        color: r.color,
        pct,
        totalTon: r.totalTon,
        totalTx: r.totalTx,
      };
    });
  }, [rows, metric, grandTotalTon, grandTotalTx]);

  if (!rows.length) return null;

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white px-3 py-2 rounded-lg text-xs shadow-lg space-y-0.5">
          <div className="font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.name}: {d.pct.toFixed(1)}%
          </div>
          <div className="text-slate-300 text-[11px]">
            {fmtTon(d.totalTon)} TON · {d.totalTx.toLocaleString('id-ID')} tx
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`bg-white border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03)] overflow-hidden ${
        condensed ? 'rounded-xl' : 'rounded-2xl'
      }`}
    >
      {/* Header: Minimal & Clean */}
      <div
        className={`${
          condensed ? 'px-4 py-3' : 'px-5 py-3.5'
        } border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Zap size={13} strokeWidth={2.5} />
          </div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Transaksi Fast &amp; Slow Moving
          </h3>
        </div>

        {/* Minimal Unit Toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] font-semibold shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setMetric('tonnage')}
            className={`px-2 py-1 rounded-md transition-colors ${
              metric === 'tonnage'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tonase (TON)
          </button>
          <button
            type="button"
            onClick={() => setMetric('tx')}
            className={`px-2 py-1 rounded-md transition-colors ${
              metric === 'tx'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Transaksi (tx)
          </button>
        </div>
      </div>

      {/* Body: Donut Left + Minimal Rows Right */}
      <div
        className={`grid ${
          condensed
            ? 'grid-cols-1 sm:grid-cols-[160px_1fr] p-3.5 gap-4'
            : 'grid-cols-1 sm:grid-cols-[200px_1fr] p-5 gap-6'
        } items-center`}
      >
        {/* Left: Clean Donut */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-full h-[150px] max-w-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={condensed ? 46 : 52}
                  outerRadius={condensed ? 64 : 72}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={customTooltip} />
              </PieChart>
            </ResponsiveContainer>

            {/* Central Metric */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-lg font-black text-slate-900 tabular-nums leading-none">
                {metric === 'tonnage' ? fmtTon(grandTotalTon) : grandTotalTx.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                {metric === 'tonnage' ? 'TON' : 'tx'}
              </span>
            </div>
          </div>

          {/* Minimalist Legend */}
          <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-600">
            {chartData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.name.replace(' Moving', '')}</span>
                <span className="font-bold text-slate-800 tabular-nums">{d.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Clean Rows (No heavy boxes) */}
        <div className="space-y-4">
          {rows.map((r, i) => {
            const share =
              metric === 'tonnage'
                ? grandTotalTon > 0
                  ? (r.totalTon / grandTotalTon) * 100
                  : 0
                : grandTotalTx > 0
                ? (r.totalTx / grandTotalTx) * 100
                : 0;

            const masukPct = r.totalTon > 0 ? (r.masukTon / r.totalTon) * 100 : 0;
            const keluarPct = r.totalTon > 0 ? (r.keluarTon / r.totalTon) * 100 : 0;

            return (
              <div key={r.key} className={i > 0 ? 'pt-3 border-t border-slate-100' : ''}>
                {/* Row Header */}
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                    <span className="text-xs font-bold text-slate-800">{r.label}</span>
                    <span className="text-[11px] text-slate-400">· {r.totalTx.toLocaleString('id-ID')} tx</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 tabular-nums">{fmtTon(r.totalTon)} TON</span>
                    <span className="text-[11px] text-slate-400 tabular-nums ml-1.5">({share.toFixed(1)}%)</span>
                  </div>
                </div>

                {/* Sleek 6px Progress Bar */}
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex mb-1.5">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500"
                    style={{ width: `${masukPct}%` }}
                    title={`Masuk: ${masukPct.toFixed(0)}%`}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all duration-500"
                    style={{ width: `${keluarPct}%` }}
                    title={`Keluar: ${keluarPct.toFixed(0)}%`}
                  />
                </div>

                {/* Flow Values */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Masuk</span>
                    <span className="font-semibold text-slate-800">{fmtTon(r.masukTon)} TON</span>
                    <span className="text-slate-400">({r.mi} tx)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400">({r.ki} tx)</span>
                    <span className="font-semibold text-slate-800">{fmtTon(r.keluarTon)} TON</span>
                    <span>Keluar</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
