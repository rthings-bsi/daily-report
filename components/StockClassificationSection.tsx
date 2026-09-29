'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedStock, ProcessedMovement } from '@/lib/excel-parser';
import { StockReportSummary } from '@/components/StockReport';
import { loadPenampunganSlocs, isPenampunganSloc } from '@/lib/gudang';
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

  // ─── Stock Inventory Metrics ───
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

  // ─── Movement Transaction Metrics (Fast vs Slow throughput) ───
  const txMetrics = useMemo(() => {
    const bucket = {
      Fast: { mi: 0, ki: 0, mt: 0, kt: 0 },
      Slow: { mi: 0, ki: 0, mt: 0, kt: 0 },
    };

    for (const m of movements) {
      const status = m.movementStatus === 'Slow' ? 'Slow' : 'Fast';
      const weightTon = Math.abs(m.quantity) / 1000;
      if (m.group === 'Masuk') {
        bucket[status].mi += 1;
        bucket[status].mt += weightTon;
      } else if (m.group === 'Keluar') {
        bucket[status].ki += 1;
        bucket[status].kt += weightTon;
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

    // Masuk vs Keluar split inside Fast
    const fastMasukPct = fastTotalTon > 0 ? (bucket.Fast.mt / fastTotalTon) * 100 : 50;
    const fastKeluarPct = fastTotalTon > 0 ? (bucket.Fast.kt / fastTotalTon) * 100 : 50;

    // Masuk vs Keluar split inside Slow
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

  // Circumference for r=38 is 2 * PI * 38 ≈ 238.76
  const CIRCLE_CIRCUMFERENCE = 238.76;
  const fastDashOffset = CIRCLE_CIRCUMFERENCE * (1 - txMetrics.fast.sharePct / 100);
  const slowDashOffset = CIRCLE_CIRCUMFERENCE * (txMetrics.fast.sharePct / 100);

  return (
    <section
      aria-label="Distribusi Stok & Transaksi per Klasifikasi"
      className="glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-apple-gray-200/50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-apple-green to-apple-teal text-white flex items-center justify-center font-bold shadow-sm">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Distribusi Stok &amp; Transaksi per Klasifikasi</h2>
            <p className="text-xs text-slate-500 font-medium">Fast Moving vs Slow Moving Inventory &amp; Turnover Rates</p>
          </div>
        </div>

        {/* Metric mode toggle */}
        <div className="glass-pill p-1 rounded-xl flex items-center text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMetricMode('tonnage')}
            className={`px-3 py-1 rounded-lg transition-apple ${
              metricMode === 'tonnage'
                ? 'bg-white shadow-sm text-slate-800 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tonase (TON)
          </button>
          <button
            type="button"
            onClick={() => setMetricMode('tx')}
            className={`px-3 py-1 rounded-lg transition-apple ${
              metricMode === 'tx'
                ? 'bg-white shadow-sm text-slate-800 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Transaksi (tx)
          </button>
        </div>
      </div>

      {/* Comparison Banners (Fast vs Slow) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fast Moving Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-50/50 to-white border border-emerald-300/40 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">Fast Moving</span>
            </div>
            <div className="text-3xl font-black text-slate-900 tabular-nums">
              {stockMetrics.fastCount.toLocaleString('id-ID')}{' '}
              <span className="text-sm font-semibold text-slate-600">item</span>
            </div>
            <p className="text-xs font-bold text-emerald-700 tabular-nums">
              {stockMetrics.fastTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500 text-white shadow-apple-glow-green">
              ↑ 12%
            </span>
            <p className="text-[10px] text-slate-500 font-medium mt-1">vs kemarin</p>
          </div>
        </div>

        {/* Slow Moving Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-white border border-amber-300/40 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-xs font-bold uppercase text-amber-800 tracking-wider">Slow Moving</span>
            </div>
            <div className="text-3xl font-black text-slate-900 tabular-nums">
              {stockMetrics.slowCount.toLocaleString('id-ID')}{' '}
              <span className="text-sm font-semibold text-slate-600">item</span>
            </div>
            <p className="text-xs font-bold text-amber-700 tabular-nums">
              {stockMetrics.slowTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
            </p>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500 text-white shadow-apple-glow-red">
              ↓ 4%
            </span>
            <p className="text-[10px] text-slate-500 font-medium mt-1">vs kemarin</p>
          </div>
        </div>
      </div>

      {/* Ratio Multi-Color Progress Indicator */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>Rasio Keseluruhan Stok Gudang</span>
          <span>
            {stockMetrics.fastPct}% Fast • {stockMetrics.slowPct}% Slow
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stockMetrics.fastPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full bg-emerald-500"
            title={`${stockMetrics.fastPct}% Fast Moving`}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stockMetrics.slowPct}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="h-full bg-amber-500"
            title={`${stockMetrics.slowPct}% Slow Moving`}
          />
        </div>
      </div>

      {/* Detailed Breakdown & Doughnut Metric Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-2">
        {/* Doughnut / Gauge Card (lg:col-span-3) */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/60 border border-white shadow-apple-sm">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background Circle */}
              <circle cx="50" cy="50" fill="transparent" r="38" stroke="#E2E8F0" strokeWidth="10" />
              {/* Fast Moving Arc */}
              <circle
                cx="50"
                cy="50"
                fill="transparent"
                r="38"
                stroke="#34C759"
                strokeDasharray="238.76"
                strokeDashoffset={fastDashOffset}
                strokeLinecap="round"
                strokeWidth="10"
              />
              {/* Slow Moving Arc */}
              <circle
                cx="50"
                cy="50"
                fill="transparent"
                r="38"
                stroke="#FF9500"
                strokeDasharray="238.76"
                strokeDashoffset={slowDashOffset}
                strokeLinecap="round"
                strokeWidth="10"
              />
            </svg>
            <div className="absolute flex flex-col items-center text-center">
              <span className="text-2xl font-black text-slate-900 tabular-nums">
                {metricMode === 'tonnage'
                  ? txMetrics.totalThroughputTon.toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })
                  : txMetrics.totalThroughputTx.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {metricMode === 'tonnage' ? 'TON TOTAL' : 'TRX TOTAL'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Fast {txMetrics.fast.sharePct.toFixed(1)}%
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Slow {txMetrics.slow.sharePct.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Horizontal Dual Stack Bars (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-4">
          {/* Fast Moving Flow Bar */}
          <div className="p-3.5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-apple-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Fast Moving <span className="font-medium text-slate-500">· {txMetrics.fast.totalTx} tx</span>
              </span>
              <span className="font-extrabold text-slate-900 tabular-nums">
                {txMetrics.fast.totalTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                TON{' '}
                <span className="text-slate-500 font-medium">({txMetrics.fast.sharePct.toFixed(1)}%)</span>
              </span>
            </div>

            {/* Dual Sub Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.fast.masukPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-emerald-500"
                title={`Masuk: ${txMetrics.fast.masukTon.toFixed(1)} TON`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.fast.keluarPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-rose-500"
                title={`Keluar: ${txMetrics.fast.keluarTon.toFixed(1)} TON`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span className="text-emerald-700">
                Masuk:{' '}
                {txMetrics.fast.masukTon.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                TON <span className="text-slate-500 font-normal">({txMetrics.fast.masukTx} tx)</span>
              </span>
              <span className="text-rose-600">
                <span className="text-slate-500 font-normal">({txMetrics.fast.keluarTx} tx)</span>{' '}
                {txMetrics.fast.keluarTon.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                TON :Keluar
              </span>
            </div>
          </div>

          {/* Slow Moving Flow Bar */}
          <div className="p-3.5 rounded-2xl bg-white/70 border border-white space-y-2 shadow-apple-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Slow Moving <span className="font-medium text-slate-500">· {txMetrics.slow.totalTx} tx</span>
              </span>
              <span className="font-extrabold text-slate-900 tabular-nums">
                {txMetrics.slow.totalTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                TON{' '}
                <span className="text-slate-500 font-medium">({txMetrics.slow.sharePct.toFixed(1)}%)</span>
              </span>
            </div>

            {/* Dual Sub Bar */}
            <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.slow.masukPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-emerald-500"
                title={`Masuk: ${txMetrics.slow.masukTon.toFixed(1)} TON`}
              />
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${txMetrics.slow.keluarPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-rose-500"
                title={`Keluar: ${txMetrics.slow.keluarTon.toFixed(1)} TON`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
              <span className="text-emerald-700">
                Masuk:{' '}
                {txMetrics.slow.masukTon.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                TON <span className="text-slate-500 font-normal">({txMetrics.slow.masukTx} tx)</span>
              </span>
              <span className="text-rose-600">
                <span className="text-slate-500 font-normal">({txMetrics.slow.keluarTx} tx)</span>{' '}
                {txMetrics.slow.keluarTon.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{' '}
                TON :Keluar
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
