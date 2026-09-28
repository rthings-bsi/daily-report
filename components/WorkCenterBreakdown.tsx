'use client';

import React from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Factory } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

interface WorkCenterBreakdownProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

interface WorkCenterItem {
  name: string;
  value: number;
  count: number;
  isOthers?: boolean;
}

const RANK_THEMES = [
  {
    rankBg: 'bg-blue-50 text-blue-800 border-blue-100',
    barGradient: 'from-blue-600 to-blue-500',
    badgeBg: 'bg-blue-50 text-blue-800 border border-blue-100',
  },
  {
    rankBg: 'bg-teal-50 text-teal-800 border-teal-100',
    barGradient: 'from-teal-600 to-teal-500',
    badgeBg: 'bg-teal-50 text-teal-800 border border-teal-100',
  },
  {
    rankBg: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    barGradient: 'from-emerald-600 to-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-100',
  },
  {
    rankBg: 'bg-amber-50 text-amber-800 border-amber-100',
    barGradient: 'from-amber-600 to-amber-500',
    badgeBg: 'bg-amber-50 text-amber-800 border border-amber-100',
  },
  {
    rankBg: 'bg-rose-50 text-rose-800 border-rose-100',
    barGradient: 'from-rose-600 to-rose-500',
    badgeBg: 'bg-rose-50 text-rose-800 border border-rose-100',
  },
];

const DEFAULT_THEME = {
  rankBg: 'bg-slate-100 text-slate-600 border-slate-200',
  barGradient: 'from-slate-500 to-slate-400',
  badgeBg: 'bg-slate-100 text-slate-600 border border-slate-200/80',
};

export const WorkCenterBreakdown: React.FC<WorkCenterBreakdownProps> = ({ data, condensed = false }) => {
  const reduceMotion = useReducedMotion();

  const { items, totalValue, maxItemValue, topTwoShare } = React.useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();

    data.forEach(item => {
      const key = item.workCenter || item.description || 'UNASSIGNED';
      if (!map.has(key)) {
        map.set(key, { name: key, value: 0, count: 0 });
      }
      const entry = map.get(key)!;
      // Konversi KG dari data SAP ke satuan TON (/ 1000)
      entry.value += Math.abs(item.quantity) / 1000;
      entry.count += 1;
    });

    const sorted = Array.from(map.values())
      .map(item => ({ ...item, value: Math.abs(item.value) }))
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((acc, curr) => acc + curr.value, 0);

    const topLimit = condensed ? 5 : 6;

    let finalItems: WorkCenterItem[] = [];
    if (sorted.length <= topLimit) {
      finalItems = sorted;
    } else {
      const topN = sorted.slice(0, topLimit);
      const othersVal = sorted.slice(topLimit).reduce((acc, curr) => acc + curr.value, 0);
      const othersCnt = sorted.slice(topLimit).reduce((acc, curr) => acc + curr.count, 0);
      finalItems = [
        ...topN,
        {
          name: 'LAINNYA (SISA MESIN)',
          value: othersVal,
          count: othersCnt,
          isOthers: true,
        },
      ];
    }

    const maxVal = finalItems.length > 0 ? Math.max(...finalItems.map(i => i.value)) : 1;

    const topTwoVal = sorted.slice(0, 2).reduce((acc, c) => acc + c.value, 0);
    const topTwoPct = total > 0 ? (topTwoVal / total) * 100 : 0;

    return {
      items: finalItems,
      totalValue: total,
      maxItemValue: maxVal,
      topTwoShare: topTwoPct,
    };
  }, [data, condensed]);

  if (items.length === 0) return null;

  return (
    <div
      className={`bg-white border border-slate-200/80 shadow-[0_1px_3px_0_rgba(0,0,0,0.03),0_4px_14px_-2px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300 ${
        condensed ? 'rounded-xl' : 'rounded-2xl'
      }`}
    >
      {/* Header */}
      <div
        className={`${
          condensed ? 'px-4 py-3' : 'px-5 py-3.5'
        } border-b border-slate-100 flex items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100/90 flex items-center justify-center text-slate-600 shrink-0">
            <Factory size={15} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider leading-tight">
              Work Center Breakdown
            </h3>
            {!condensed && (
              <p className="text-[11px] font-medium text-slate-400 mt-0.5 leading-tight">
                Peringkat pergerakan material berdasarkan tonase tertinggi
              </p>
            )}
          </div>
        </div>

        {/* Total Throughput Badge */}
        <div className="text-right shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Total Throughput
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 tabular-nums leading-none mt-0.5">
            {totalValue.toLocaleString('id-ID', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{' '}
            <span className="text-[10px] font-bold text-slate-500">TON</span>
          </div>
        </div>
      </div>

      {/* Body: Horizontal Ranked Bar Rows */}
      <div className={`${condensed ? 'p-3.5 space-y-2.5' : 'p-4 sm:p-5 space-y-3'}`}>
        {items.map((item, idx) => {
          const theme = idx < RANK_THEMES.length && !item.isOthers ? RANK_THEMES[idx] : DEFAULT_THEME;
          const sharePct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
          // Scale bar relative to maximum value in list, so top item fills ~90% and others scale accordingly
          const barWidth = maxItemValue > 0 ? (item.value / maxItemValue) * 92 : 0;

          return (
            <div
              key={item.name}
              className="group flex items-center gap-2 sm:gap-3 py-1 px-1.5 rounded-xl hover:bg-slate-50/70 transition-colors"
            >
              {/* Rank Badge */}
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border ${theme.rankBg}`}
              >
                {item.isOthers ? '•' : idx + 1}
              </div>

              {/* Machine / Work Center Label */}
              <div className="w-28 sm:w-36 shrink-0 truncate">
                <span
                  className={`text-xs ${
                    item.isOthers ? 'font-semibold text-slate-500' : 'font-bold text-slate-800'
                  } uppercase tracking-tight truncate block`}
                  title={item.name}
                >
                  {item.name}
                </span>
                <span className="text-[10px] text-slate-400 font-medium block -mt-0.5 sm:hidden">
                  {item.count.toLocaleString('id-ID')} tx
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="flex-1 h-3 sm:h-3.5 bg-slate-100 rounded-full overflow-hidden relative mx-1">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          delay: 0.05 + idx * 0.04,
                          duration: 0.6,
                          ease: [0.16, 1, 0.3, 1],
                        }
                  }
                  className={`h-full rounded-full bg-gradient-to-r ${theme.barGradient}`}
                />
              </div>

              {/* Tonase Value */}
              <div className="text-right shrink-0 min-w-[70px] sm:min-w-[90px]">
                <span className="text-xs sm:text-sm font-black text-slate-900 tabular-nums">
                  {item.value.toLocaleString('id-ID', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
                <span className="text-[10px] font-semibold text-slate-500 ml-1">TON</span>
              </div>

              {/* Share Percentage Badge */}
              <div
                className={`px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold tabular-nums text-center shrink-0 min-w-[46px] sm:min-w-[50px] ${theme.badgeBg}`}
              >
                {sharePct.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                %
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Summary Insight */}
      {!condensed && items.length > 2 && (
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
          <div className="text-slate-500 font-medium truncate">
            Top 2 Work Center menyumbang{' '}
            <span className="font-black text-slate-900">
              {topTwoShare.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %
            </span>{' '}
            dari total arus pergerakan pabrik.
          </div>
          <div className="text-slate-400 font-semibold shrink-0">
            {items.reduce((acc, curr) => acc + curr.count, 0).toLocaleString('id-ID')} transaksi
          </div>
        </div>
      )}
    </div>
  );
};
