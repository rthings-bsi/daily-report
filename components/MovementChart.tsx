'use client';

import React from 'react';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Line, Area, ComposedChart,
} from 'recharts';
import { ProcessedMovement } from '@/lib/excel-parser';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeProvider';

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

const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const MovementChart: React.FC<MovementChartProps> = ({
  data,
  condensed = false,
  useAllData = false,
  selectedGudang = null,
  startDate = '',
  endDate = '',
  selectedShift = null,
}) => {
  const { isDark } = useTheme();
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

  const colors = isDark
    ? {
        inBar: '#34d399',
        outBar: '#fb7185',
        netLine: '#60a5fa',
        grid: 'rgba(255, 255, 255, 0.08)',
        axis: 'rgba(255, 255, 255, 0.14)',
        tick: '#8a99b2',
        dotFill: '#212630',
        cursor: 'rgba(96, 165, 250, 0.09)',
      }
    : {
        inBar: '#22c55e',
        outBar: '#ef4444',
        netLine: '#2563eb',
        grid: 'rgba(148, 163, 184, 0.25)',
        axis: 'rgba(148, 163, 184, 0.4)',
        tick: '#5a6982',
        dotFill: '#eaf0f7',
        cursor: 'rgba(37, 99, 235, 0.06)',
      };

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="neu-float px-3.5 py-2.5 rounded-2xl text-xs">
          <p className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] mb-1.5 pb-1 border-b border-[var(--neu-divider)]">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const isNet = entry.dataKey === 'net';
              const val = isNet ? entry.value : Math.abs(entry.value);
              return (
                <div key={index} className="flex items-center justify-between gap-5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isNet ? colors.netLine : entry.color || entry.fill }}
                    />
                    <span className="font-medium text-[var(--neu-text-secondary)]">{entry.name}</span>
                  </div>
                  <span
                    className={`font-bold tabular-nums ${
                      isNet
                        ? entry.value >= 0
                          ? 'text-[var(--neu-accent)]'
                          : 'text-[var(--neu-red)]'
                        : 'text-[var(--neu-text)]'
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ─── Daily Trend Chart (lg:col-span-7) ─── */}
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: easeOut }}
        className="lg:col-span-7 neu-card p-5 sm:p-6 flex flex-col justify-between"
      >
        <div>
          {/* Header & Legend */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-[var(--neu-divider)]">
            <div>
              <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                Tren Pergerakan Harian
              </h2>
              <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                Perbandingan Inbound &amp; Outbound (TON), 7 Hari Terakhir
              </p>
            </div>
            <div className="neu-inset-sm px-3 py-1.5 rounded-full flex items-center gap-3.5 text-[11.5px] font-semibold text-[var(--neu-text-secondary)] self-start">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.inBar }} /> Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.outBar }} /> Keluar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.netLine }} /> Net
              </span>
            </div>
          </div>

          {/* Recessed Digital Meter Readouts */}
          <div className="grid grid-cols-3 gap-3 my-4">
            <div className="neu-inset-sm px-3.5 py-2.5 rounded-2xl flex flex-col">
              <span className="font-mono text-[10px] text-[var(--neu-green)] font-semibold uppercase tracking-wider">
                Total Masuk
              </span>
              <span className="text-[15px] sm:text-[16px] font-extrabold text-[var(--neu-text)] tabular-nums mt-0.5">
                +{totals.totalMasuk.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
              </span>
            </div>
            <div className="neu-inset-sm px-3.5 py-2.5 rounded-2xl flex flex-col">
              <span className="font-mono text-[10px] text-[var(--neu-red)] font-semibold uppercase tracking-wider">
                Total Keluar
              </span>
              <span className="text-[15px] sm:text-[16px] font-extrabold text-[var(--neu-text)] tabular-nums mt-0.5">
                -{totals.totalKeluar.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
              </span>
            </div>
            <div className="neu-inset-sm px-3.5 py-2.5 rounded-2xl flex flex-col">
              <span className="font-mono text-[10px] text-[var(--neu-accent)] font-semibold uppercase tracking-wider">
                Net Movement
              </span>
              <span className="text-[15px] sm:text-[16px] font-extrabold text-[var(--neu-accent)] tabular-nums mt-0.5">
                {totals.net >= 0 ? '+' : ''}
                {totals.net.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
              </span>
            </div>
          </div>

          {/* Composed Chart */}
          <div className="relative w-full h-56 pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartDailyData} margin={{ top: 8, right: 10, left: -14, bottom: 4 }} barGap={5}>
                <CartesianGrid vertical={false} stroke={colors.grid} />
                <XAxis
                  dataKey="date"
                  axisLine={{ stroke: colors.axis }}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: colors.tick, fontWeight: 600 }}
                  tickFormatter={str => str.split('-').slice(1).reverse().join('/')}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: colors.tick, fontWeight: 500 }}
                  tickFormatter={v => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Number(v.toFixed(1))))}
                />
                <Tooltip content={customTooltip} cursor={{ fill: colors.cursor, radius: 6 }} />
                <Bar
                  dataKey="masuk"
                  fill={colors.inBar}
                  radius={[5, 5, 0, 0]}
                  name="Masuk"
                  barSize={condensed ? 15 : 20}
                />
                <Bar
                  dataKey="keluar"
                  fill={colors.outBar}
                  radius={[5, 5, 0, 0]}
                  name="Keluar"
                  barSize={condensed ? 15 : 20}
                />
                <Area type="monotone" dataKey="net" fill={colors.netLine} fillOpacity={0.09} stroke="none" />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke={colors.netLine}
                  strokeWidth={2.6}
                  dot={{ r: 3.5, fill: colors.dotFill, strokeWidth: 2.4, stroke: colors.netLine }}
                  activeDot={{ r: 5.5, fill: colors.netLine, strokeWidth: 2, stroke: colors.dotFill }}
                  name="Net"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-[var(--neu-divider)] flex items-center justify-between text-[11px] text-[var(--neu-text-muted)]">
          <span>Rentang kalkulasi</span>
          <span className="font-mono font-semibold text-[var(--neu-text-secondary)]">
            {calcRangeStr || '7 Hari Terakhir'}
          </span>
        </div>
      </motion.article>

      {/* ─── Volume by Movement Type (lg:col-span-5) ─── */}
      <motion.article
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.25, ease: easeOut }}
        className="lg:col-span-5 neu-card p-5 sm:p-6 flex flex-col justify-between"
      >
        <div>
          {/* Header */}
          <div className="flex items-start justify-between gap-2 pb-4 border-b border-[var(--neu-divider)]">
            <div>
              <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                Volume per Tipe Pergerakan
              </h2>
              <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                Rasio Distribusi SAP Mvt Code
              </p>
            </div>
            {(() => {
              const total = typeData.reduce((s, d) => s + d.value, 0);
              if (total === 0) return null;
              const masukPct = Math.round(
                (typeData.filter(d => d.group === 'Masuk').reduce((s, d) => s + d.value, 0) / total) * 100
              );
              return (
                <span className="neu-chip shrink-0">
                  {masukPct}% IN / {100 - masukPct}% OUT
                </span>
              );
            })()}
          </div>

          {/* Tactile Recessed Channel Meter Bars */}
          <div className="space-y-4 mt-4">
            {(() => {
              const totalAll = typeData.reduce((s, d) => s + d.value, 0);
              const maxVal = typeData.reduce((max, x) => Math.max(max, x.value), 0);
              return typeData.slice(0, 6).map((d, i) => {
                const isMasuk = d.group === 'Masuk';
                const barPct = maxVal > 0 ? Math.round((d.value / maxVal) * 100) : 0;
                const sharePct = totalAll > 0 ? (d.value / totalAll) * 100 : 0;

                const getSeriesHex = () => {
                  if (d.name === '101') return colors.inBar;
                  if (d.name === '261') return colors.outBar;
                  if (d.name === '311' && !isMasuk) return isDark ? '#a78bfa' : '#7c3aed';
                  if (d.name === '601') return isDark ? '#fbbf24' : '#f59e0b';
                  if (d.name === '311' && isMasuk) return colors.netLine;
                  if (d.name === '262') return '#0ea5e9';
                  return isMasuk ? colors.inBar : colors.outBar;
                };
                const hex = getSeriesHex();

                return (
                  <motion.div
                    key={`${d.name}-${d.group}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.25, ease: easeOut }}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                        <span className="font-mono font-bold text-[var(--neu-text)]">{d.name}</span>
                        <span
                          className={`font-mono px-1.5 py-0.5 rounded-md text-[9.5px] font-bold ${
                            isMasuk
                              ? 'bg-[var(--neu-green-soft)] text-[var(--neu-green)]'
                              : 'bg-[var(--neu-red-soft)] text-[var(--neu-red)]'
                          }`}
                        >
                          {isMasuk ? 'IN' : 'OUT'}
                        </span>
                        <span className="text-[var(--neu-text-secondary)] font-medium truncate">
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
                      <span className="font-mono font-bold text-[var(--neu-text)] tabular-nums shrink-0 ml-2">
                        {sharePct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full neu-inset-sm p-0.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ delay: i * 0.04, duration: 0.5, ease: easeOut }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: hex }}
                      />
                    </div>
                  </motion.div>
                );
              });
            })()}
            {typeData.length === 0 && (
              <p className="text-xs text-[var(--neu-text-muted)] text-center py-8">
                Tidak ada data pergerakan untuk filter ini.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--neu-divider)] flex items-center justify-between text-[11px] text-[var(--neu-text-muted)]">
          <span>Komposisi tipe transaksi terkonfirmasi</span>
          <span className="font-mono font-semibold text-[var(--neu-text-secondary)]">
            {Math.min(6, typeData.length)} Kategori Utama
          </span>
        </div>
      </motion.article>
    </div>
  );
};
