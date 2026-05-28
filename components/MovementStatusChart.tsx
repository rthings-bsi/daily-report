'use client';

import React from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { classifyBatch } from '@/lib/gudang';
import { motion } from 'framer-motion';
import { Zap, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface StatusChartProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

export const MovementStatusChart: React.FC<StatusChartProps> = ({ data, condensed = false }) => {
  const categories = React.useMemo(() => {
    const buckets = [
      { key: 'fast', label: 'Fast Moving', icon: Zap, masuk: 0, keluar: 0, count: 0, color: '#059669', light: '#ecfdf5', dark: 'bg-emerald-950/30' },
      { key: 'slow', label: 'Slow Moving', icon: Clock, masuk: 0, keluar: 0, count: 0, color: '#d97706', light: '#fffbeb', dark: 'bg-amber-950/30' },
    ];
    data.forEach(m => {
      const status = m.movementStatus || classifyBatch(m.batch);
      const b = status === 'Fast' ? buckets[0] : buckets[1];
      b.count++;
      if (m.group === 'Masuk') b.masuk += m.quantity;
      else if (m.group === 'Keluar') b.keluar += Math.abs(m.quantity);
    });
    return buckets.filter(b => b.count > 0);
  }, [data]);

  const total = categories.reduce((s, c) => s + c.masuk + c.keluar, 0);

  if (!categories.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-xl transition-all duration-500 ${condensed ? 'rounded-2xl' : 'rounded-3xl'}`}
    >
      <div className={`border-b border-slate-100 dark:border-slate-800 ${condensed ? 'px-5 py-3.5' : 'px-6 py-5'}`}>
        <h3 className={`${condensed ? 'text-xs' : 'text-sm'} font-bold text-slate-900 dark:text-white uppercase tracking-wider`}>
          Movement by Batch Status
        </h3>
        <p className="text-[11px] text-slate-400 font-medium mt-0.5">
          Transaksi Fast vs Slow Moving
        </p>
      </div>

      <div className={`${condensed ? 'p-3' : 'p-5'} space-y-2`}>
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          const catTotal = cat.masuk + cat.keluar;
          const pct = total > 0 ? (catTotal / total * 100) : 0;

          return (
            <motion.div
              key={cat.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <div className={`rounded-xl px-4 py-3 ${condensed ? 'px-3 py-2.5' : 'px-4 py-3'} flex items-center justify-between`}
                style={{ backgroundColor: cat.light }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg" style={{ backgroundColor: cat.color + '20' }}>
                    <Icon size={condensed ? 14 : 16} style={{ color: cat.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">{cat.label}</span>
                      <span className="text-[10px] font-medium text-slate-400 tabular-nums">{cat.count} tx</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <div className="flex items-center gap-1">
                        <TrendingUp size={10} className="text-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{cat.masuk.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</span>
                        <span className="text-[9px] text-slate-400">T</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingDown size={10} className="text-rose-500" />
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">{cat.keluar.toLocaleString('id-ID', { minimumFractionDigits: 1 })}</span>
                        <span className="text-[9px] text-slate-400">T</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-black tabular-nums" style={{ color: cat.color }}>
                    {catTotal.toLocaleString('id-ID', { minimumFractionDigits: 1 })}
                  </div>
                  <div className="text-[9px] font-medium text-slate-400 -mt-0.5">{pct.toFixed(0)}% dari total</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className={`${condensed ? 'px-4 pb-4' : 'px-6 pb-5'} flex gap-0.5 h-1.5 rounded-full overflow-hidden`}>
        {categories.map(c => (
          <div
            key={c.key}
            className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-700"
            style={{ width: `${(c.masuk + c.keluar) / total * 100}%`, backgroundColor: c.color }}
          />
        ))}
      </div>
    </motion.div>
  );
};