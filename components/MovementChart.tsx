'use client';

import React from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Area, ComposedChart,
} from 'recharts';
import { ProcessedMovement } from '@/lib/excel-parser';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TrendItem {
  date: string;
  masuk: number;
  keluar: number;
}

interface MovementChartProps {
  data: ProcessedMovement[];
  condensed?: boolean;
  useAllData?: boolean;
  selectedGudang?: number | null;
}

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MovementChart: React.FC<MovementChartProps> = ({ data, condensed = false, useAllData = false, selectedGudang = null }) => {
  const [trendData, setTrendData] = React.useState<TrendItem[] | null>(null);

  React.useEffect(() => {
    if (!useAllData) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedGudang) params.set('gudang', String(selectedGudang));
    fetch(`/api/reports/trend?${params}`)
      .then(r => r.json())
      .then(res => { if (!cancelled) setTrendData(res); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [useAllData, selectedGudang]);

  const dailyData = React.useMemo(() => {
    if (useAllData && trendData) {
      if (!trendData.length) return [];
      const map = new Map(trendData.map(d => [d.date, { date: d.date, masuk: d.masuk, keluar: Math.abs(d.keluar), net: d.masuk - Math.abs(d.keluar) }]));
      
      let minDateStr = '';
      let maxDateStr = '';
      trendData.forEach(d => {
        if (!minDateStr || d.date < minDateStr) minDateStr = d.date;
        if (!maxDateStr || d.date > maxDateStr) maxDateStr = d.date;
      });

      if (!minDateStr || !maxDateStr) return [];

      let startDate = new Date(`${minDateStr}T12:00:00Z`);
      let endDate = new Date(`${maxDateStr}T12:00:00Z`);

      const MAX_DAYS = 5;
      const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
      if (spanDays > MAX_DAYS) {
        const newStart = new Date(endDate);
        newStart.setDate(newStart.getDate() - (MAX_DAYS - 1));
        startDate = newStart;
      }

      if (minDateStr === maxDateStr) {
        const prev = new Date(startDate);
        prev.setDate(prev.getDate() - 1);
        startDate = prev;
        const next = new Date(endDate);
        next.setDate(next.getDate() + 1);
        endDate = next;
      }

      const result: { date: string; masuk: number; keluar: number; net: number }[] = [];

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().split('T')[0];
        const existing = map.get(key);
        result.push(existing || { date: key, masuk: 0, keluar: 0, net: 0 });
      }
      return result;
    }
      const map = new Map<string, { date: string; masuk: number; keluar: number; net: number }>();
      let latestDate = '';
      data.forEach(item => {
        const date = item.dateStr;
        if (date > latestDate) latestDate = date;
        if (!map.has(date)) map.set(date, { date, masuk: 0, keluar: 0, net: 0 });
        const entry = map.get(date)!;
        if (item.group === 'Masuk') entry.masuk += item.quantity;
        if (item.group === 'Keluar') entry.keluar += Math.abs(item.quantity);
        entry.net = entry.masuk - entry.keluar;
      });
    // Dapatkan rentang tanggal dari data yang tersedia
    let minDateStr = '';
    let maxDateStr = '';
    
    data.forEach(item => {
      const date = item.dateStr;
      if (!minDateStr || date < minDateStr) minDateStr = date;
      if (!maxDateStr || date > maxDateStr) maxDateStr = date;
    });

    if (!minDateStr || !maxDateStr) return [];

    // Konversi string ke objek Date untuk looping (set ke tengah hari untuk hindari masalah timezone)
    let startDate = new Date(`${minDateStr}T12:00:00Z`);
    let endDate = new Date(`${maxDateStr}T12:00:00Z`);

    // BATASI: tampilkan maksimal 5 hari (window terdekat) agar grafik
    // tidak terlalu padat saat filter tanggal dipilih. Ambil 5 hari terakhir
    // dari rentang yang tersedia.
    const MAX_DAYS = 5;
    const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (spanDays > MAX_DAYS) {
      const newStart = new Date(endDate);
      newStart.setDate(newStart.getDate() - (MAX_DAYS - 1));
      startDate = newStart;
    }

    // UX: Bila hanya ada 1 tanggal (filter tunggal), pad dengan H-1 & H+1
    // agar Recharts bisa me-render Line/Area (butuh min. 2 titik) dan bar tidak
    // kelihatan terisolasi. Titik H-1/H+1 diisi 0, titik tengah tetap bernilai.
    if (minDateStr === maxDateStr) {
      const prev = new Date(startDate);
      prev.setDate(prev.getDate() - 1);
      startDate = prev;
      const next = new Date(endDate);
      next.setDate(next.getDate() + 1);
      endDate = next;
    }

    const result: { date: string; masuk: number; keluar: number; net: number }[] = [];
    
    // Looping setiap hari dari minDate sampai maxDate
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const existing = map.get(key);
      result.push(existing || { date: key, masuk: 0, keluar: 0, net: 0 });
    }
    
    // Pastikan selalu tampil dari kiri ke kanan (tanggal lama ke tanggal baru)
    return result;
  }, [data, useAllData, trendData]);

  const typeData = React.useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string; group: string }>();
    data.forEach(item => {
      const key = `${item.moveType}-${item.group}`;
      if (!map.has(key)) {
        const displayName = item.moveType;
        map.set(key, { name: displayName, value: 0, color: item.color, group: item.group });
      }
      map.get(key)!.value += Math.abs(item.quantity);
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data]);

  const totals = React.useMemo(() => {
    const totalMasuk = dailyData.reduce((s, d) => s + d.masuk, 0);
    const totalKeluar = dailyData.reduce((s, d) => s + d.keluar, 0);
    const net = totalMasuk - totalKeluar;
    return { totalMasuk, totalKeluar, net };
  }, [dailyData]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 px-3 py-2.5 rounded-xl shadow-lg border border-slate-200 text-xs">
          <p className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const isNet = entry.dataKey === 'net';
              const val = isNet ? entry.value : Math.abs(entry.value);
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isNet ? '#6366f1' : entry.color || entry.fill }} />
                    <span className="font-medium text-slate-500">{entry.name}</span>
                  </div>
                  <span className={`font-bold tabular-nums ${isNet ? (entry.value >= 0 ? 'text-indigo-600' : 'text-rose-600') : 'text-slate-900'}`}>
                    {entry.value >= 0 ? '+' : ''}{Math.round(val).toLocaleString()} T
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  const renderSummary = () => (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 sm:px-5 pt-3 sm:pt-4 pb-1">
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100/50 px-2.5 py-1 rounded-lg">
        <TrendingUp size={12} className="text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-700 tabular-nums">
          {Math.round(totals.totalMasuk).toLocaleString()} T
        </span>
        <span className="text-[9px] text-emerald-500 font-medium">Masuk</span>
      </div>
      <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100/50 px-2.5 py-1 rounded-lg">
        <TrendingDown size={12} className="text-rose-600" />
        <span className="text-xs font-semibold text-rose-700 tabular-nums">
          {Math.round(totals.totalKeluar).toLocaleString()} T
        </span>
        <span className="text-[9px] text-rose-500 font-medium">Keluar</span>
      </div>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
        totals.net >= 0
          ? 'bg-indigo-50 border-indigo-100/50'
          : 'bg-rose-50 border-rose-100/50'
      }`}>
        {totals.net >= 0 ? (
          <ArrowUpRight size={12} className="text-indigo-600" />
        ) : (
          <ArrowDownRight size={12} className="text-rose-600" />
        )}
        <span className={`text-xs font-semibold tabular-nums ${totals.net >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
          {totals.net >= 0 ? '+' : ''}{Math.round(totals.net).toLocaleString()} T
        </span>
        <span className="text-[9px] text-slate-400 font-medium">Net</span>
      </div>
    </div>
  );

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${condensed ? 'mb-0' : 'mb-0'}`}>
      {/* ─── Daily Trend ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-white border border-slate-200 shadow-sm ${condensed ? 'rounded-xl' : 'rounded-2xl'}`}
      >
        <div className={`flex items-center justify-between border-b border-slate-100 ${condensed ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <div>
            <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Daily Movement Trend</h3>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Inbound vs Outbound (Ton)</p>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-semibold text-slate-600">Masuk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="text-[10px] font-semibold text-slate-600">Keluar</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] font-semibold text-slate-600">Net</span>
            </div>
          </div>
        </div>
        {!condensed && renderSummary()}
        <div className={condensed ? 'px-2 sm:px-4 pt-3 sm:pt-4 pb-2' : 'px-3 sm:px-6 pt-3 sm:pt-4 pb-3 sm:pb-4'}>
          <div className={condensed ? 'h-[180px] sm:h-[220px]' : 'h-[220px] sm:h-[280px]'}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }} barGap={4}>
                <defs>
                  <linearGradient id="gradMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.45} />
                  </linearGradient>
                  <linearGradient id="gradKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.45} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(str) => str.split('-').slice(1).reverse().join('/')}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={customTooltip} cursor={{ fill: '#f8fafc', radius: 4 }} />
                <Bar dataKey="masuk" fill="url(#gradMasuk)" radius={[5, 5, 0, 0]} name="Masuk" barSize={condensed ? 14 : 28} />
                <Bar dataKey="keluar" fill="url(#gradKeluar)" radius={[5, 5, 0, 0]} name="Keluar" barSize={condensed ? 14 : 28} />
                <Area type="monotone" dataKey="net" fill="#6366f1" fillOpacity={0.08} stroke="none" />
                <Line type="monotone" dataKey="net" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1', strokeWidth: 1.5, stroke: '#fff' }} activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} name="Net" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* ─── By Movement Type ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`bg-white border border-slate-200 shadow-sm ${condensed ? 'rounded-xl' : 'rounded-2xl'}`}
      >
        <div className={`border-b border-slate-100 ${condensed ? 'px-4 py-3' : 'px-5 py-4'}`}>
          <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Volume by Movement Type</h3>
          {(() => {
            const total = typeData.reduce((s, d) => s + d.value, 0);
            if (total === 0) return null;
            const masukPct = Math.round(typeData.filter(d => d.group === 'Masuk').reduce((s, d) => s + d.value, 0) / total * 100);
            return <p className="text-[10px] text-slate-500 font-medium mt-0.5">{masukPct}% Masuk · {100 - masukPct}% Keluar</p>;
          })()}
        </div>
        <div className={`${condensed ? 'px-2 sm:px-4 pt-3 sm:pt-4 pb-2' : 'px-3 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4'}`}>
          <div className="space-y-2.5">
            {(() => {
              const totalAll = typeData.reduce((s, d) => s + d.value, 0);
              const maxVal = typeData.reduce((max, x) => Math.max(max, x.value), 0);
              return typeData.map((d, i) => {
                const isMasuk = d.group === 'Masuk';
                const barPct = maxVal > 0 ? Math.round((d.value / maxVal) * 100) : 0;
                const sharePct = totalAll > 0 ? (d.value / totalAll) * 100 : 0;
                return (
                  <motion.div
                    key={`${d.name}-${d.group}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4, ease: easeOut }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-semibold text-slate-700 truncate">{d.name}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isMasuk ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {isMasuk ? 'IN' : 'OUT'}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-indigo-600 tabular-nums flex-shrink-0 ml-2">
                          {sharePct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ delay: i * 0.05, duration: 0.6, ease: easeOut }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: d.color, opacity: 0.85 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>
          {typeData.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">Tidak ada data movement</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};
