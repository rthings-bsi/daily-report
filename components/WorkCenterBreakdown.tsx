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
  { text: 'text-[var(--neu-accent)]', bar: 'var(--neu-accent)' },
  { text: 'text-[var(--neu-purple)]', bar: 'var(--neu-purple-bar)' },
  { text: 'text-[var(--neu-green)]', bar: 'var(--neu-green-bar)' },
  { text: 'text-[var(--neu-amber)]', bar: 'var(--neu-amber-bar)' },
  { text: 'text-[var(--neu-red)]', bar: 'var(--neu-red-bar)' },
  { text: 'text-[var(--neu-text-secondary)]', bar: 'var(--neu-text-muted)' },
];

const DEFAULT_THEME = {
  text: 'text-[var(--neu-text-muted)]',
  bar: 'var(--neu-text-muted)',
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
      className="neu-card p-5 sm:p-6 flex flex-col justify-between h-full"
      data-purpose="work-center-card"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--neu-divider)] pb-4 mb-4">
          <div>
            <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
              Work Center Breakdown
            </h2>
            <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
              Peringkat pergerakan material tonase tertinggi
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="font-mono text-[10px] text-[var(--neu-text-muted)] uppercase font-semibold tracking-wider block">
              Total Throughput
            </span>
            <div className="text-[18px] font-extrabold text-[var(--neu-text)] tabular-nums leading-tight mt-0.5">
              {totalValue.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">TON</span>
            </div>
          </div>
        </div>

        {/* Ranking List */}
        <div className="space-y-3">
          {items.map((item, idx) => {
            const theme = idx < RANK_THEMES.length && !item.isOthers ? RANK_THEMES[idx] : DEFAULT_THEME;
            const sharePct = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

            return (
              <div
                key={item.name}
                className={`p-3.5 rounded-2xl transition-neu ${
                  item.isOthers ? 'neu-inset-sm' : 'neu-card-sm'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2.5 truncate mr-2">
                    <span
                      className={`w-7 h-7 rounded-xl neu-icon-inset font-mono font-bold flex items-center justify-center text-[11px] shrink-0 ${theme.text}`}
                    >
                      {item.isOthers ? '•' : idx + 1}
                    </span>
                    <span
                      className={`truncate text-[12.5px] ${
                        item.isOthers ? 'font-semibold text-[var(--neu-text-muted)]' : 'font-bold text-[var(--neu-text)]'
                      }`}
                    >
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-[var(--neu-text)] tabular-nums text-[12.5px]">
                      {item.value.toLocaleString('id-ID', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}{' '}
                      <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
                    </span>
                    <span className={`font-mono px-2 py-0.5 rounded-lg neu-inset-sm font-bold text-[10.5px] tabular-nums ${theme.text}`}>
                      {sharePct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-2.5 rounded-full neu-inset-sm p-0.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, sharePct)}%` }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.5,
                      delay: reduceMotion ? 0 : idx * 0.04,
                      ease: [0.23, 1, 0.32, 1],
                    }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: theme.bar }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3.5 border-t border-[var(--neu-divider)] flex items-center justify-between text-xs text-[var(--neu-text-muted)]">
        <span>
          Top 2 Work Center menyumbang{' '}
          <strong className="text-[var(--neu-text)] font-bold">{topTwoPct.toFixed(1)}%</strong> total arus
        </span>
        <span className="neu-chip">
          {totalCount.toLocaleString('id-ID')} Transaksi
        </span>
      </div>
    </article>
  );
};
