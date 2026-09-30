'use client';

import React from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Area, ComposedChart,
} from 'recharts';
import { ProcessedMovement } from '@/lib/excel-parser';
import { motion } from 'framer-motion';

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
  startDate?: string;
  endDate?: string;
  selectedShift?: number | null;
}

const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MovementChart: React.FC<MovementChartProps> = ({
  data,
  condensed = false,
  useAllData = false,
  selectedGudang = null,
  startDate = '',
  endDate = '',
  selectedShift = null,
}) => {
  const [trendData, setTrendData] = React.useState<TrendItem[] | null>(null);

  React.useEffect(() => {
    if (!useAllData) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (selectedGudang) params.set('gudang', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (selectedShift !== null && selectedShift !== undefined) {
      params.set('shift', String(selectedShift));
    }
    fetch(`/api/reports/trend?${params}`)
      .then(r => r.json())
      .then(res => {
        if (cancelled) return;
        setTrendData(Array.isArray(res) && res.length > 0 ? res : null);
      })
      .catch(() => {
        if (!cancelled) setTrendData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [useAllData, selectedGudang, startDate, endDate, selectedShift]);

  const fullDailyData = React.useMemo(() => {
    if (useAllData && trendData) {
      if (!trendData.length) return [];
      const map = new Map(
        trendData.map(d => [
          d.date,
          {
            date: d.date,
            masuk: d.masuk / 1000,
            keluar: Math.abs(d.keluar) / 1000,
            net: (d.masuk - Math.abs(d.keluar)) / 1000,
          },
        ])
      );

      let minDateStr = '';
      let maxDateStr = '';
      trendData.forEach(d => {
        if (!minDateStr || d.date < minDateStr) minDateStr = d.date;
        if (!maxDateStr || d.date > maxDateStr) maxDateStr = d.date;
      });

      if (!minDateStr || !maxDateStr) return [];

      let sDate = new Date(`${minDateStr}T12:00:00Z`);
      let eDate = new Date(`${maxDateStr}T12:00:00Z`);

      if (minDateStr === maxDateStr) {
        const prev = new Date(sDate);
        prev.setDate(prev.getDate() - 1);
        sDate = prev;
        const next = new Date(eDate);
        next.setDate(next.getDate() + 1);
        eDate = next;
      }

      const result: { date: string; masuk: number; keluar: number; net: number }[] = [];
      for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
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
      if (item.group === 'Masuk') entry.masuk += item.quantity / 1000;
      if (item.group === 'Keluar') entry.keluar += Math.abs(item.quantity) / 1000;
      entry.net = entry.masuk - entry.keluar;
    });

    let minDateStr = '';
    let maxDateStr = '';
    data.forEach(item => {
      const date = item.dateStr;
      if (!minDateStr || date < minDateStr) minDateStr = date;
      if (!maxDateStr || date > maxDateStr) maxDateStr = date;
    });

    if (!minDateStr || !maxDateStr) return [];

    let sDate = new Date(`${minDateStr}T12:00:00Z`);
    let eDate = new Date(`${maxDateStr}T12:00:00Z`);

    if (minDateStr === maxDateStr) {
      const prev = new Date(sDate);
      prev.setDate(prev.getDate() - 1);
      sDate = prev;
      const next = new Date(eDate);
      next.setDate(next.getDate() + 1);
      eDate = next;
    }

    const result: { date: string; masuk: number; keluar: number; net: number }[] = [];
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const existing = map.get(key);
      result.push(existing || { date: key, masuk: 0, keluar: 0, net: 0 });
    }
    return result;
  }, [data, useAllData, trendData]);

  const chartDailyData = React.useMemo(() => {
    if (fullDailyData.length <= 7) return fullDailyData;
    return fullDailyData.slice(-7);
  }, [fullDailyData]);

  const typeData = React.useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string; group: string }>();
    data.forEach(item => {
      const key = `${item.moveType}-${item.group}`;
      if (!map.has(key)) {
        map.set(key, { name: item.moveType, value: 0, color: item.color, group: item.group });
      }
      map.get(key)!.value += Math.abs(item.quantity) / 1000;
    });
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [data]);

  const totals = React.useMemo(() => {
    const totalMasuk = fullDailyData.reduce((s, d) => s + d.masuk, 0);
    const totalKeluar = fullDailyData.reduce((s, d) => s + d.keluar, 0);
    const net = totalMasuk - totalKeluar;
    return { totalMasuk, totalKeluar, net };
  }, [fullDailyData]);

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card px-3.5 py-2.5 rounded-2xl shadow-apple-card border border-white/90 text-xs backdrop-blur-xl">
          <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">{label}</p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const isNet = entry.dataKey === 'net';
              const val = isNet ? entry.value : Math.abs(entry.value);
              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isNet ? '#007AFF' : entry.color || entry.fill }}
                    />
                    <span className="font-semibold text-slate-700">{entry.name}</span>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      isNet ? (entry.value >= 0 ? 'text-apple-blue' : 'text-apple-red') : 'text-slate-800'
                    }`}
                  >
                    {entry.value >= 0 ? '+' : ''}
                    {val.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
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

  const calcRangeStr = React.useMemo(() => {
    if (!fullDailyData.length) return '';
    const first = fullDailyData[0].date.split('-').reverse().join('/');
    const last = fullDailyData[fullDailyData.length - 1].date.split('-').reverse().join('/');
    return `${first} - ${last}`;
  }, [fullDailyData]);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${condensed ? 'mb-0' : 'mb-0'}`}>
      {/* ─── Daily Trend Chart (lg:col-span-7) ─── */}
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:col-span-7 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between"
      >
        <div>
          {/* Header & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Daily Movement Trend</h2>
              <p className="text-xs text-slate-500 font-medium">Inbound vs Outbound (TON) 7 Hari Terakhir</p>
            </div>
            {/* Legend Badges */}
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" /> Masuk
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-md bg-rose-500 shadow-sm" /> Keluar
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <span className="w-3 h-3 rounded-full bg-apple-blue ring-2 ring-blue-200 shadow-sm" /> Net
              </span>
            </div>
          </div>

          {/* Micro-Summary Badges */}
          <div className="grid grid-cols-3 gap-2.5 my-4">
            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/50 flex flex-col">
              <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Total Masuk</span>
              <span className="text-sm sm:text-base font-extrabold text-emerald-600 tabular-nums">
                +{totals.totalMasuk.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-emerald-500">TON</span>
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/50 flex flex-col">
              <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Total Keluar</span>
              <span className="text-sm sm:text-base font-extrabold text-rose-600 tabular-nums">
                -{totals.totalKeluar.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-rose-500">TON</span>
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/50 flex flex-col">
              <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Net Movement</span>
              <span className="text-sm sm:text-base font-extrabold text-apple-blue tabular-nums">
                {totals.net >= 0 ? '+' : ''}
                {totals.net.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="text-xs font-normal text-blue-500">TON</span>
              </span>
            </div>
          </div>

          {/* Composed Chart */}
          <div className="relative w-full h-56 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartDailyData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }} barGap={4}>
                <defs>
                  <linearGradient id="appleGradMasuk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34C759" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#34C759" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="appleGradKeluar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#FF3B30" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E8ED" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#86868B', fontWeight: 600 }}
                  tickFormatter={str => str.split('-').slice(1).reverse().join('/')}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#86868B', fontWeight: 600 }}
                  tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Number(v.toFixed(1))))}
                />
                <Tooltip content={customTooltip} cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }} />
                <Bar
                  dataKey="masuk"
                  fill="url(#appleGradMasuk)"
                  radius={[6, 6, 0, 0]}
                  name="Masuk"
                  barSize={condensed ? 14 : 18}
                />
                <Bar
                  dataKey="keluar"
                  fill="url(#appleGradKeluar)"
                  radius={[6, 6, 0, 0]}
                  name="Keluar"
                  barSize={condensed ? 14 : 18}
                />
                <Area type="monotone" dataKey="net" fill="#007AFF" fillOpacity={0.06} stroke="none" />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#007AFF"
                  strokeWidth={3}
                  dot={{ r: 3.5, fill: '#FFFFFF', strokeWidth: 2.5, stroke: '#007AFF' }}
                  activeDot={{ r: 5.5, fill: '#FFFFFF', strokeWidth: 3, stroke: '#007AFF' }}
                  name="Net"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer info line */}
        <p className="text-[11px] text-slate-500 font-medium mt-3 pt-2.5 border-t border-slate-200/80">
          <span>Rentang kalkulasi: {calcRangeStr || '7 Hari Terakhir'}</span>
        </p>
      </motion.article>

      {/* ─── Volume by Movement Type (lg:col-span-5) ─── */}
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="lg:col-span-5 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Volume by Movement Type</h2>
              <p className="text-xs text-slate-500 font-medium">Rasio Distribusi SAP Mvt Code</p>
            </div>
            {(() => {
              const total = typeData.reduce((s, d) => s + d.value, 0);
              if (total === 0) return null;
              const masukPct = Math.round(
                (typeData.filter(d => d.group === 'Masuk').reduce((s, d) => s + d.value, 0) / total) * 100
              );
              return (
                <div className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200/60">
                  {masukPct}% Masuk • {100 - masukPct}% Keluar
                </div>
              );
            })()}
          </div>

          {/* Progress Bars List */}
          <div className="space-y-3.5 mt-5">
            {(() => {
              const totalAll = typeData.reduce((s, d) => s + d.value, 0);
              const maxVal = typeData.reduce((max, x) => Math.max(max, x.value), 0);
              return typeData.slice(0, 6).map((d, i) => {
                const isMasuk = d.group === 'Masuk';
                const barPct = maxVal > 0 ? Math.round((d.value / maxVal) * 100) : 0;
                const sharePct = totalAll > 0 ? (d.value / totalAll) * 100 : 0;

                const getDotColor = () => {
                  if (d.name === '101') return 'bg-emerald-500';
                  if (d.name === '261') return 'bg-rose-500';
                  if (d.name === '311' && !isMasuk) return 'bg-purple-500';
                  if (d.name === '601') return 'bg-pink-500';
                  if (d.name === '311' && isMasuk) return 'bg-teal-500';
                  if (d.name === '262') return 'bg-blue-500';
                  return isMasuk ? 'bg-emerald-500' : 'bg-rose-500';
                };

                const getPillStyle = () => {
                  if (isMasuk) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                  return 'bg-rose-50 text-rose-700 border border-rose-200';
                };

                const getBarColor = () => {
                  if (d.name === '101') return 'bg-emerald-500';
                  if (d.name === '261') return 'bg-rose-500';
                  if (d.name === '311' && !isMasuk) return 'bg-purple-500';
                  if (d.name === '601') return 'bg-pink-500';
                  if (d.name === '311' && isMasuk) return 'bg-teal-500';
                  if (d.name === '262') return 'bg-blue-500';
                  return isMasuk ? 'bg-emerald-500' : 'bg-rose-500';
                };

                return (
                  <motion.div
                    key={`${d.name}-${d.group}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35, ease: easeOut }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${getDotColor()}`} />
                        <span className="font-bold text-slate-800">{d.name}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getPillStyle()}`}>
                          {isMasuk ? 'IN' : 'OUT'}
                        </span>
                        <span className="text-slate-500 font-medium truncate max-w-[140px]">
                          {d.name === '101'
                            ? 'GR Produksi'
                            : d.name === '261'
                            ? 'GI Pemakaian'
                            : d.name === '311' && !isMasuk
                            ? 'Transfer Sloc'
                            : d.name === '601'
                            ? 'Delivery Note'
                            : d.name === '311' && isMasuk
                            ? 'Transfer Masuk'
                            : d.name === '262'
                            ? 'Return Produksi'
                            : isMasuk
                            ? 'Penerimaan'
                            : 'Pengeluaran'}
                        </span>
                      </span>
                      <span className={`font-extrabold ${isMasuk ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {sharePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-200/80 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ delay: i * 0.05, duration: 0.6, ease: easeOut }}
                        className={`h-full rounded-full ${getBarColor()}`}
                      />
                    </div>
                  </motion.div>
                );
              });
            })()}
            {typeData.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-8">Tidak ada data movement</p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
          <span>Komposisi tipe transaksi terkonfirmasi</span>
          <span className="font-bold text-slate-700">{Math.min(6, typeData.length)} Kategori Utama</span>
        </div>
      </motion.article>
    </div>
  );
};
