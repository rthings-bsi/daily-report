'use client';

import React from 'react';
import { ProcessedStock } from '@/lib/excel-parser';
import { Zap, Clock, MapPin, Box } from 'lucide-react';
import { motion } from 'framer-motion';
import { loadPenampunganSlocs, isPenampunganSloc } from '@/lib/gudang';

export interface StockSummaryBucket {
  count: number;
  totalTon: number;
}

export interface StockReportSummary {
  fast: StockSummaryBucket;
  slow: StockSummaryBucket;
  penampungan: StockSummaryBucket;
}

interface StockReportProps {
  data: ProcessedStock[];
  /**
   * Pre-aggregated Fast/Slow/Penampungan counts from the server-side
   * StockSummary rows. When provided, the component skips its own
   * client-side filter+reduce — useful for sessions with thousands of
   * stock rows where the aggregation is already on the wire.
   */
  summary?: StockReportSummary;
  condensed?: boolean;
}

export const StockReport: React.FC<StockReportProps> = ({ data, summary: summaryProp, condensed = false }) => {
  const penampunganList = React.useMemo(() => loadPenampunganSlocs(), []);

  const inPenampungan = React.useMemo(() => {
    // Selalu kalkulasi dari data raw agar sinkron dengan Pengaturan terbaru
    return data.filter(s =>
      s.status === 'Sloc Penampungan' ||
      (penampunganList.length > 0 && isPenampunganSloc(s.sloc))
    );
  }, [data, penampunganList]);

  const nonPenampungan = React.useMemo(() => {
    return data.filter(s =>
      !(s.status === 'Sloc Penampungan' || (penampunganList.length > 0 && isPenampunganSloc(s.sloc)))
    );
  }, [data, penampunganList]);

  const summary: StockReportSummary = React.useMemo(() => {
    // Jika data mentah tersedia, kalkulasi realtime (lebih akurat untuk perubahan Pengaturan)
    if (data.length > 0) {
      const fast = nonPenampungan.filter(s => s.status === 'Fast Moving');
      const slow = nonPenampungan.filter(s => s.status === 'Slow Moving');
      return {
        fast: {
          count: fast.length,
          totalTon: fast.reduce((sum, s) => sum + ((s.tonnage || 0) / 1000), 0),
        },
        slow: {
          count: slow.length,
          totalTon: slow.reduce((sum, s) => sum + ((s.tonnage || 0) / 1000), 0),
        },
        penampungan: {
          count: inPenampungan.length,
          totalTon: inPenampungan.reduce((sum, s) => sum + ((s.tonnage || 0) / 1000), 0),
        },
      };
    }
    // Fallback: pakai summaryProp dari server (aggregate mode — raw stocks tidak dikirim)
    if (summaryProp) return summaryProp;
    // Fallback terakhir: kosong
    return { fast: { count: 0, totalTon: 0 }, slow: { count: 0, totalTon: 0 }, penampungan: { count: 0, totalTon: 0 } };
  }, [nonPenampungan, inPenampungan, summaryProp, data]);

  // Jangan skip kalau data raw kosong tapi masih ada summary dari server
  if (data.length === 0 && !summaryProp) return null;
  // Kalau summary-nya 0 semua, skip
  const totalNonZero = summary.fast.count + summary.slow.count + summary.penampungan.count;
  if (totalNonZero === 0) return null;

  const total = summary.fast.count + summary.slow.count;
  const fastPct = total > 0 ? Math.round((summary.fast.count / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden"
    >
      <div className={`px-5 py-3.5 border-b border-slate-100 flex items-center justify-between ${condensed ? 'px-4 py-3' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-slate-100 rounded-lg">
            <Box size={14} className="text-slate-500" />
          </div>
          <div>
            <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Distribusi Stok</h2>
            <p className="text-[9px] text-slate-400 mt-0.5">Fast vs Slow Moving</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Fast Moving */}
          <div className="flex-1 bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-100/50 relative overflow-hidden group hover:shadow-sm hover:border-emerald-200 transition-all duration-300">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500 shadow-sm">
                <Zap size={13} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Fast Moving</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-xl font-bold text-emerald-900 tabular-nums">{summary.fast.count}</span>
                  <span className="text-[10px] text-emerald-600 font-medium">item</span>
                </div>
                <p className="text-[11px] text-emerald-600/70 font-medium">{summary.fast.totalTon.toFixed(1)} ton</p>
              </div>
              
              {/* Trend Indicator (Mockup) */}
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                  <span>12%</span>
                </div>
                <span className="text-[8px] text-emerald-600/60 font-medium mt-0.5">vs kemarin</span>
              </div>
              </div>
              {/* Decorative background shape */}
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-emerald-200/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
              </div>

              {/* Slow Moving */}
              <div className="flex-1 bg-amber-50/50 rounded-xl p-3.5 border border-amber-100/50 relative overflow-hidden group hover:shadow-sm hover:border-amber-200 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500 shadow-sm">
                <Clock size={13} className="text-white" />
              </div>
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Slow Moving</span>
              </div>
              <div className="flex items-end justify-between">
              <div>
                <div className="flex items-baseline gap-1 mb-0.5">
                  <span className="text-xl font-bold text-amber-900 tabular-nums">{summary.slow.count}</span>
                  <span className="text-[10px] text-amber-600 font-medium">item</span>
                </div>
                <p className="text-[11px] text-amber-600/70 font-medium">{summary.slow.totalTon.toFixed(1)} ton</p>
              </div>
                
              {/* Trend Indicator (Mockup) */}
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-0.5 text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100/50">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  <span>4%</span>
                </div>
                <span className="text-[8px] text-amber-600/60 font-medium mt-0.5">vs kemarin</span>
              </div>
              </div>
              {/* Decorative background shape */}
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-amber-200/20 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
              </div>

              {/* SLOC Penampungan */}
              {summary.penampungan.count > 0 && (
              <div className="flex-1 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/60 relative overflow-hidden group hover:shadow-sm hover:border-slate-300 transition-all duration-300">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1.5 rounded-lg bg-slate-400 shadow-sm">
                  <MapPin size={13} className="text-white" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Penampungan</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="flex items-baseline gap-1 mb-0.5">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">{summary.penampungan.count}</span>
                    <span className="text-[10px] text-slate-500 font-medium">item</span>
                  </div>
                  <p className="text-[11px] text-slate-500/70 font-medium">{summary.penampungan.totalTon.toFixed(1)} ton</p>
                </div>
                  
                {/* Trend Indicator (Mockup untuk Penampungan - Dinamis dari sisi persentase) */}
                <div className="flex flex-col items-end">
                  {summary.penampungan.count % 2 === 0 ? (
                    // Simulasi Naik (Angka Genap)
                    <div className="flex items-center gap-0.5 text-[10px] font-bold text-sky-600 bg-sky-100/80 px-1.5 py-0.5 rounded-md">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
                      <span>8%</span>
                    </div>
                  ) : (
                    // Simulasi Turun (Angka Ganjil)
                    <div className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-100/50">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      <span>2%</span>
                    </div>
                  )}
                  <span className="text-[8px] text-slate-400 mt-0.5">vs kemarin</span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-slate-200/50 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
            </div>
          )}
        </div>

        {/* Proportional bar */}
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-slate-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fastPct}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-emerald-500 rounded-full"
              />
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${100 - fastPct}%` }} />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">{fastPct}% Fast · {100 - fastPct}% Slow</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
