'use client';

import React from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Zap, Clock } from 'lucide-react';

interface FastSlowTransactionChartProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

const STATUS = [
  { key: 'Fast', label: 'Fast Moving', color: '#059669', icon: Zap },
  { key: 'Slow', label: 'Slow Moving', color: '#d97706', icon: Clock },
] as const;

export const FastSlowTransactionChart: React.FC<FastSlowTransactionChartProps> = ({ data, condensed = false }) => {
  const rows = React.useMemo(() => {
    const b: Record<string, { mi: number; ki: number; mt: number; kt: number }> = {};
    for (const s of STATUS) b[s.key] = { mi: 0, ki: 0, mt: 0, kt: 0 };
    b.U = { mi: 0, ki: 0, mt: 0, kt: 0 };
    for (const m of data) {
      const k = m.movementStatus === 'Fast' || m.movementStatus === 'Slow' ? m.movementStatus : 'U';
      const w = Math.abs(m.quantity);
      if (m.group === 'Masuk') { b[k].mi++; b[k].mt += w; }
      else if (m.group === 'Keluar') { b[k].ki++; b[k].kt += w; }
    }
    return STATUS.map(s => ({ ...s, ...b[s.key] })).filter(r => r.mi + r.ki > 0);
  }, [data]);

  if (!rows.length) return null;

  const maxTotal = Math.max(...rows.map(r => r.mt + r.kt), 1);

  return (
    <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
      <div className={`border-b border-slate-100 ${condensed ? 'px-3 py-2' : 'px-5 py-3.5'}`}>
        <h2 className={`${condensed ? 'text-[9px]' : 'text-[11px]'} font-bold text-slate-700 uppercase tracking-wider`}>
          Transaksi Fast & Slow Moving
        </h2>
      </div>

      <div className={`${condensed ? 'p-3 space-y-4' : 'p-5 space-y-5'}`}>
        {rows.map(r => {
          const Icon = r.icon;
          const totalTon = Math.round(r.mt + r.kt);
          const masukTon = Math.round(r.mt);
          const keluarTon = Math.round(r.kt);
          const masukPct = (r.mt / maxTotal) * 100;
          const keluarPct = (r.kt / maxTotal) * 100;

          return (
            <div key={r.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon size={12} style={{ color: r.color }} />
                  <span className={`${condensed ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-700`}>
                    {r.label}
                  </span>
                </div>
                <span className={`${condensed ? 'text-[10px]' : 'text-xs'} font-semibold text-slate-800 tabular-nums`}>
                  {totalTon.toLocaleString()}
                  <span className="text-[9px] text-slate-400 ml-0.5">T</span>
                </span>
              </div>

              <div className={`relative rounded-full overflow-hidden bg-slate-100 ${condensed ? 'h-2' : 'h-2.5'}`}>
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-emerald-400"
                  style={{ width: `${masukPct}%` }}
                />
                {r.kt > 0 && (
                  <div
                    className="absolute top-0 h-full rounded-full bg-rose-400"
                    style={{ left: `${masukPct}%`, width: `${keluarPct}%` }}
                  />
                )}
              </div>

              <div className={`flex flex-wrap justify-between gap-y-0.5 mt-1 ${condensed ? 'text-[9px]' : 'text-[10px]'} text-slate-400`}>
                <span>
                  <span className="font-medium text-slate-600">{masukTon.toLocaleString()} T</span>
                  <span className="mx-1">·</span>
                  <span>{r.mi} tx masuk</span>
                </span>
                <span>
                  <span>{r.ki} tx keluar</span>
                  <span className="mx-1">·</span>
                  <span className="font-medium text-slate-600">{keluarTon.toLocaleString()} T</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
