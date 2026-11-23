'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedStock, ProcessedMovement } from '@/lib/excel-parser';
import { StockReportSummary } from '@/components/StockReport';
import { loadPenampunganSlocs, isPenampunganSloc, classifyBatch } from '@/lib/gudang';
import { motion } from 'framer-motion';

interface StockClassificationSectionProps {
  stocks: ProcessedStock[];
  stockSummary?: StockReportSummary;
  movements: ProcessedMovement[];
}

export const StockClassificationSection: React.FC<StockClassificationSectionProps> = ({
  stocks,
  stockSummary: summaryProp,
  movements,
}) => {
  const [metricMode, setMetricMode] = useState<'tonnage' | 'tx'>('tonnage');
  const penampunganList = useMemo(() => loadPenampunganSlocs(), []);

  const stockMetrics = useMemo(() => {
    if (stocks.length > 0) {
      const nonPenampungan = stocks.filter(
        s => !(s.status === 'Sloc Penampungan' || (penampunganList.length > 0 && isPenampunganSloc(s.sloc)))
      );
      const fast = nonPenampungan.filter(s => s.status === 'Fast Moving');
      const slow = nonPenampungan.filter(s => s.status === 'Slow Moving');

      const fastCount = fast.length;
      const fastTon = fast.reduce((sum, s) => sum + (s.tonnage || 0) / 1000, 0);

      const slowCount = slow.length;
      const slowTon = slow.reduce((sum, s) => sum + (s.tonnage || 0) / 1000, 0);

      const totalItems = fastCount + slowCount;
      const fastPct = totalItems > 0 ? Math.round((fastCount / totalItems) * 100) : 0;
      const slowPct = totalItems > 0 ? 100 - fastPct : 0;

      return { fastCount, fastTon, slowCount, slowTon, totalItems, fastPct, slowPct };
    }

    if (summaryProp) {
      const fastCount = summaryProp.fast.count;
      const fastTon = summaryProp.fast.totalTon;
      const slowCount = summaryProp.slow.count;
      const slowTon = summaryProp.slow.totalTon;
      const totalItems = fastCount + slowCount;
      const fastPct = totalItems > 0 ? Math.round((fastCount / totalItems) * 100) : 0;
      const slowPct = totalItems > 0 ? 100 - fastPct : 0;
      return { fastCount, fastTon, slowCount, slowTon, totalItems, fastPct, slowPct };
    }

    return { fastCount: 0, fastTon: 0, slowCount: 0, slowTon: 0, totalItems: 0, fastPct: 0, slowPct: 0 };
  }, [stocks, summaryProp, penampunganList]);

  const txMetrics = useMemo(() => {
    const bucket = {
      Fast: { mi: 0, ki: 0, mt: 0, kt: 0 },
      Slow: { mi: 0, ki: 0, mt: 0, kt: 0 },
    };

    for (const m of movements) {
      const hasPrecomputed = m.fastWeight !== undefined || m.fastCount !== undefined;
      if (hasPrecomputed) {
        const fTon = (m.fastWeight || 0) / 1000;
        const sTon = (m.slowWeight || 0) / 1000;
        const fCount = m.fastCount || 0;
        const sCount = m.slowCount || 0;
        if (m.group === 'Masuk') {
          bucket.Fast.mi += fCount;
          bucket.Fast.mt += fTon;
          bucket.Slow.mi += sCount;
          bucket.Slow.mt += sTon;
        } else if (m.group === 'Keluar') {
          bucket.Fast.ki += fCount;
          bucket.Fast.kt += fTon;
          bucket.Slow.ki += sCount;
          bucket.Slow.kt += sTon;
        }
      } else {
        const status =
          m.movementStatus === 'Slow' || (!m.movementStatus && classifyBatch(m.batch || '') === 'Slow')
            ? 'Slow'
            : 'Fast';
        const weightTon = Math.abs(m.quantity) / 1000;
        if (m.group === 'Masuk') {
          bucket[status].mi += 1;
          bucket[status].mt += weightTon;
        } else if (m.group === 'Keluar') {
          bucket[status].ki += 1;
          bucket[status].kt += weightTon;
        }
      }
    }

    const fastTotalTon = bucket.Fast.mt + bucket.Fast.kt;
    const fastTotalTx = bucket.Fast.mi + bucket.Fast.ki;
    const slowTotalTon = bucket.Slow.mt + bucket.Slow.kt;
    const slowTotalTx = bucket.Slow.mi + bucket.Slow.ki;

    const totalThroughputTon = fastTotalTon + slowTotalTon;
    const totalThroughputTx = fastTotalTx + slowTotalTx;

    const fastSharePct = totalThroughputTon > 0 ? (fastTotalTon / totalThroughputTon) * 100 : 0;
    const slowSharePct = totalThroughputTon > 0 ? (slowTotalTon / totalThroughputTon) * 100 : 0;

    const fastMasukPct = fastTotalTon > 0 ? (bucket.Fast.mt / fastTotalTon) * 100 : 50;
    const fastKeluarPct = fastTotalTon > 0 ? (bucket.Fast.kt / fastTotalTon) * 100 : 50;

    const slowMasukPct = slowTotalTon > 0 ? (bucket.Slow.mt / slowTotalTon) * 100 : 50;
    const slowKeluarPct = slowTotalTon > 0 ? (bucket.Slow.kt / slowTotalTon) * 100 : 50;

    return {
      fast: {
        totalTon: fastTotalTon,
        totalTx: fastTotalTx,
        masukTon: bucket.Fast.mt,
        masukTx: bucket.Fast.mi,
        keluarTon: bucket.Fast.kt,
        keluarTx: bucket.Fast.ki,
        masukPct: fastMasukPct,
        keluarPct: fastKeluarPct,
        sharePct: fastSharePct,
      },
      slow: {
        totalTon: slowTotalTon,
        totalTx: slowTotalTx,
        masukTon: bucket.Slow.mt,
        masukTx: bucket.Slow.mi,
        keluarTon: bucket.Slow.kt,
        keluarTx: bucket.Slow.ki,
        masukPct: slowMasukPct,
        keluarPct: slowKeluarPct,
        sharePct: slowSharePct,
      },
      totalThroughputTon,
      totalThroughputTx,
    };
  }, [movements]);

  const CIRCLE_CIRCUMFERENCE = 238.76;
  const fastArcLen = (txMetrics.fast.sharePct / 100) * CIRCLE_CIRCUMFERENCE;
  const slowArcLen = (txMetrics.slow.sharePct / 100) * CIRCLE_CIRCUMFERENCE;

  return (
    <section
      aria-label="Distribusi Stok & Transaksi per Klasifikasi"
      className="neu-card p-5 sm:p-6 space-y-5"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--neu-divider)] pb-4">
        <div>
          <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
            Distribusi Stok &amp; Transaksi per Klasifikasi
          </h2>
          <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
            Perbandingan Fast Moving dan Slow Moving pada inventori dan pergerakan
          </p>
        </div>

        {/* Tactile Neumorphic Segmented Toggle */}
        <div className="neu-inset-sm p-1 rounded-xl inline-flex items-center text-xs font-bold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMetricMode('tonnage')}
            className={`px-3.5 py-1.5 rounded-lg transition-neu cursor-pointer ${
              metricMode === 'tonnage'
                ? 'bg-[var(--neu-surface)] shadow-[var(--neu-shadow-xs)] text-[var(--neu-accent)]'
                : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
            }`}
          >
            Tonase (TON)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('tx')}
            className={`px-3.5 py-1.5 rounded-lg transition-neu cursor-pointer ${
              metricMode === 'tx'
                ? 'bg-[var(--neu-surface)] shadow-[var(--neu-shadow-xs)] text-[var(--neu-accent)]'
                : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
            }`}
          >
            Transaksi (tx)
          </button>
        </div>
      </div>

      {/* Comparison Wells (Fast vs Slow) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fast Moving */}
        <div className="neu-inset-sm p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-green-bar)]" />
              <span className="font-mono text-[11px] font-semibold uppercase text-[var(--neu-green)] tracking-wider">
                Fast Moving
              </span>
            </div>
            <div className="text-[28px] font-extrabold text-[var(--neu-text)] tabular-nums leading-tight">
              {stockMetrics.fastCount.toLocaleString('id-ID')}{' '}
              <span className="font-mono text-xs font-medium text-[var(--neu-text-muted)]">ITEM</span>
            </div>
            <p className="font-mono text-xs font-bold text-[var(--neu-green)] tabular-nums">
              {stockMetrics.fastTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-xl neu-card-sm font-mono text-xs font-extrabold text-[var(--neu-green)]">
              {stockMetrics.fastPct}%
            </span>
            <p className="text-[11px] text-[var(--neu-text-muted)] mt-1.5">porsi stok</p>
          </div>
        </div>

        {/* Slow Moving */}
        <div className="neu-inset-sm p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-amber-bar)]" />
              <span className="font-mono text-[11px] font-semibold uppercase text-[var(--neu-amber)] tracking-wider">
                Slow Moving
              </span>
            </div>
            <div className="text-[28px] font-extrabold text-[var(--neu-text)] tabular-nums leading-tight">
              {stockMetrics.slowCount.toLocaleString('id-ID')}{' '}
              <span className="font-mono text-xs font-medium text-[var(--neu-text-muted)]">ITEM</span>
            </div>
            <p className="font-mono text-xs font-bold text-[var(--neu-amber)] tabular-nums">
              {stockMetrics.slowTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-xl neu-card-sm font-mono text-xs font-extrabold text-[var(--neu-amber)]">
              {stockMetrics.slowPct}%
            </span>
            <p className="text-[11px] text-[var(--neu-text-muted)] mt-1.5">porsi stok</p>
          </div>
        </div>
      </div>

      {/* Recessed Ratio Trough */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[var(--neu-text-secondary)]">
          <span>Rasio Keseluruhan Stok Gudang</span>
          <span className="font-mono text-[11px] font-bold text-[var(--neu-text)]">
            {stockMetrics.fastPct}% Fast / {stockMetrics.slowPct}% Slow
          </span>
        </div>
        <div className="w-full h-3.5 rounded-full neu-inset-sm p-0.5 overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stockMetrics.fastPct}%` }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="h-full bg-[var(--neu-green-bar)] rounded-l-full"
            title={`${stockMetrics.fastPct}% Fast Moving`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stockMetrics.slowPct}%` }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
            className="h-full bg-[var(--neu-amber-bar)] rounded-r-full"
            title={`${stockMetrics.slowPct}% Slow Moving`}
          />
        </div>
      </div>

      {/* Sculpted Gauge Dial + Dual Flow Channels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center pt-1">
        {/* Hardware-Inspired Neumorphic Ring Dial */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-5 rounded-2xl neu-inset-sm">
          <div className="relative w-36 h-36 rounded-full neu-card-sm flex items-center justify-center p-1.5">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="transparent" r="38" stroke="var(--neu-track)" strokeWidth="9" />
              <circle
                cx="50"
                cy="50"
                fill="transparent"
                r="38"
                stroke="var(--neu-green-bar)"
                strokeDasharray={`${fastArcLen} ${CIRCLE_CIRCUMFERENCE}`}
                strokeDashoffset={0}
                strokeWidth="9"
              />
              <circle
                cx="50"
                cy="50"
                fill="transparent"
                r="38"
                stroke="var(--neu-amber-bar)"
                strokeDasharray={`${slowArcLen} ${CIRCLE_CIRCUMFERENCE}`}
                strokeDashoffset={-fastArcLen}
                strokeWidth="9"
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-[20px] font-extrabold text-[var(--neu-text)] tabular-nums leading-none">
                {metricMode === 'tonnage'
                  ? txMetrics.totalThroughputTon.toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })
                  : txMetrics.totalThroughputTx.toLocaleString('id-ID')}
              </span>
              <span className="font-mono text-[9.5px] uppercase font-semibold text-[var(--neu-text-muted)] tracking-wider mt-1">
                {metricMode === 'tonnage' ? 'TON TOTAL' : 'TRX TOTAL'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3.5 text-[11.5px] font-bold">
            <span className="flex items-center gap-1.5 text-[var(--neu-green)]">
              <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" /> Fast {txMetrics.fast.sharePct.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-[var(--neu-amber)]">
              <span className="w-2 h-2 rounded-full bg-[var(--neu-amber-bar)]" /> Slow {txMetrics.slow.sharePct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Horizontal Dual Stack Bars */}
        <div className="lg:col-span-9 space-y-4">
          {/* Fast Moving Flow */}
          <div className="p-4 rounded-2xl neu-card-sm space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--neu-text)] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-green-bar)]" />
                Fast Moving
                <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">
                  ({txMetrics.fast.totalTx.toLocaleString('id-ID')} tx)
                </span>
              </span>
              <span className="font-extrabold text-[var(--neu-text)] tabular-nums">
                {txMetrics.fast.totalTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="font-mono text-[11px] text-[var(--neu-text-muted)]">TON</span>{' '}
                <span className="font-mono text-[11px] text-[var(--neu-text-muted)] font-medium">
                  ({txMetrics.fast.sharePct.toFixed(1)}%)
                </span>
              </span>
            </div>

            <div className="w-full h-3 rounded-full neu-inset-sm p-0.5 flex overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.fast.masukPct}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full bg-[var(--neu-green-bar)] rounded-l-full"
                title={`Masuk: ${txMetrics.fast.masukTon.toFixed(1)} TON`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.fast.keluarPct}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full bg-[var(--neu-red-bar)] rounded-r-full"
                title={`Keluar: ${txMetrics.fast.keluarTon.toFixed(1)} TON`}
              />
            </div>

            <div className="flex items-center justify-between text-[11.5px] font-semibold">
              <span className="text-[var(--neu-green)] tabular-nums">
                Masuk: {txMetrics.fast.masukTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON{' '}
                <span className="font-mono text-[10.5px] text-[var(--neu-text-muted)] font-normal">({txMetrics.fast.masukTx} tx)</span>
              </span>
              <span className="text-[var(--neu-red)] tabular-nums">
                <span className="font-mono text-[10.5px] text-[var(--neu-text-muted)] font-normal">({txMetrics.fast.keluarTx} tx)</span>{' '}
                {txMetrics.fast.keluarTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON :Keluar
              </span>
            </div>
          </div>

          {/* Slow Moving Flow */}
          <div className="p-4 rounded-2xl neu-card-sm space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--neu-text)] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-amber-bar)]" />
                Slow Moving
                <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">
                  ({txMetrics.slow.totalTx.toLocaleString('id-ID')} tx)
                </span>
              </span>
              <span className="font-extrabold text-[var(--neu-text)] tabular-nums">
                {txMetrics.slow.totalTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="font-mono text-[11px] text-[var(--neu-text-muted)]">TON</span>{' '}
                <span className="font-mono text-[11px] text-[var(--neu-text-muted)] font-medium">
                  ({txMetrics.slow.sharePct.toFixed(1)}%)
                </span>
              </span>
            </div>

            <div className="w-full h-3 rounded-full neu-inset-sm p-0.5 flex overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.slow.masukPct}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full bg-[var(--neu-green-bar)] rounded-l-full"
                title={`Masuk: ${txMetrics.slow.masukTon.toFixed(1)} TON`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.slow.keluarPct}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="h-full bg-[var(--neu-red-bar)] rounded-r-full"
                title={`Keluar: ${txMetrics.slow.keluarTon.toFixed(1)} TON`}
              />
            </div>

            <div className="flex items-center justify-between text-[11.5px] font-semibold">
              <span className="text-[var(--neu-green)] tabular-nums">
                Masuk: {txMetrics.slow.masukTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON{' '}
                <span className="font-mono text-[10.5px] text-[var(--neu-text-muted)] font-normal">({txMetrics.slow.masukTx} tx)</span>
              </span>
              <span className="text-[var(--neu-red)] tabular-nums">
                <span className="font-mono text-[10.5px] text-[var(--neu-text-muted)] font-normal">({txMetrics.slow.keluarTx} tx)</span>{' '}
                {txMetrics.slow.keluarTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON :Keluar
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
