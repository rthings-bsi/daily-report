'use client';

import React from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
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
    rankBg: 'bg-blue-100 text-apple-blue',
    barColor: 'bg-apple-blue',
    badgeStyle: 'bg-blue-50 text-apple-blue border-blue-200',
  },
  {
    rankBg: 'bg-emerald-100 text-emerald-700',
    barColor: 'bg-emerald-500',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    rankBg: 'bg-teal-100 text-teal-700',
    barColor: 'bg-teal-500',
    badgeStyle: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    rankBg: 'bg-amber-100 text-amber-700',
    barColor: 'bg-amber-500',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    rankBg: 'bg-rose-100 text-rose-700',
    barColor: 'bg-rose-500',
    badgeStyle: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    rankBg: 'bg-slate-200 text-slate-800 font-bold',
    barColor: 'bg-slate-600',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-300',
  },
];

const DEFAULT_THEME = {
  rankBg: 'bg-slate-100 text-slate-700 font-bold',
  barColor: 'bg-slate-400',
  badgeStyle: 'bg-slate-100 text-slate-700 font-semibold border-slate-200',
};

export const WorkCenterBreakdown: React.FC<WorkCenterBreakdownProps> = ({ data, condensed = false }) => {
  const reduceMotion = useReducedMotion();

  const { items, totalValue, totalCount, topTwoPct } = React.useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();

    data.forEach(item => {
      const key = item.workCenter || item.description || 'UNASSIGNED';
      if (!map.has(key)) {
        map.set(key, { name: key, value: 0, count: 0 });
      }
      const entry = map.get(key)!;
      entry.value += Math.abs(item.quantity) / 1000;
      entry.count += 1;
    });

    const sorted = Array.from(map.values())
      .map(item => ({ ...item, value: Math.abs(item.value) }))
      .sort((a, b) => b.value - a.value);

    const total = sorted.reduce((acc, curr) => acc + curr.value, 0);
    const countTotal = sorted.reduce((acc, curr) => acc + curr.count, 0);

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

    const topTwoVal = sorted.slice(0, 2).reduce((acc, c) => acc + c.value, 0);
    const topTwoShare = total > 0 ? (topTwoVal / total) * 100 : 0;

    return {
      items: finalItems,
      totalValue: total,
      totalCount: countTotal,
      topTwoPct: topTwoShare,
    };
  }, [data, condensed]);

  if (items.length === 0) return null;

  return (
    <article
      className="glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between h-full"
      data-purpose="work-center-card"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-apple-gray-200/50 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-apple-blue flex items-center justify-center font-bold">
              <svg
                className="w-4.5 h-4.5 text-apple-blue"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <path d="M17 18h1" />
                <path d="M12 18h1" />
                <path d="M7 18h1" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Work Center Breakdown</h2>
              <p className="text-xs text-slate-500 font-medium">Peringkat pergerakan material tonase tertinggi</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Throughput</span>
            <div className="text-lg font-black text-slate-900 tabular-nums">
              {totalValue.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              <span className="text-xs font-semibold text-slate-600">TON</span>
            </div>
          </div>
        </div>

        {/* Ranking List with Meter Bars */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const theme = idx < RANK_THEMES.length && !item.isOthers ? RANK_THEMES[idx] : DEFAULT_THEME;
            const sharePct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

            return (
              <div
                key={item.name}
                className={`p-2.5 rounded-2xl border transition-apple shadow-apple-sm ${
                  item.isOthers
                    ? 'bg-white/40 border-white/60 hover:bg-white'
                    : 'bg-white/70 border-white/90 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <span
                      className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 ${theme.rankBg}`}
                    >
                      {item.isOthers ? '•' : idx + 1}
                    </span>
                    <span
                      className={`truncate ${
                        item.isOthers ? 'font-semibold text-slate-600' : 'font-bold text-slate-900'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-extrabold text-slate-900 tabular-nums">
                      {item.value.toLocaleString('id-ID', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      <span className="text-[10px] font-semibold text-slate-600">TON</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${theme.badgeStyle}`}>
                      {sharePct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, sharePct)}%` }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.6,
                      delay: reduceMotion ? 0 : idx * 0.05,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`h-full rounded-full ${theme.barColor}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Summary */}
      <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600">
        <span className="font-medium">
          Top 2 Work Center menyumbang{' '}
          <strong className="text-slate-900 font-bold">{topTwoPct.toFixed(1)}%</strong> total arus
        </span>
        <span className="px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-800 border border-slate-200/70">
          {totalCount.toLocaleString('id-ID')} Transaksi
        </span>
      </div>
    </article>
  );
};
