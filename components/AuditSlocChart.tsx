'use client';

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from 'recharts';
import {
  MapPin,
  PieChart as PieChartIcon,
  Building2,
  Maximize2,
  Minimize2,
  ChevronDown,
  X,
  Filter,
} from 'lucide-react';
import { GUDANG_LIST } from '@/lib/gudang';

export interface SlocStatItem {
  sloc: string;
  totalItems: number;
  matchCount: number;
  deficitCount: number;
  surplusCount: number;
  accuracyPct: number;
  sapQty: number;
  qtyAudit: number;
  diffQty: number;
  sapKg: number;
  kgAudit: number;
  diffKg: number;
  tonAudit: number;
  tonSap: number;
  tonDiff: number;
}

export interface OverallBreakdownData {
  totalItems: number;
  matchCount: number;
  deficitCount: number;
  surplusCount: number;
  accuracyPct: number;
}

interface AuditSlocChartProps {
  slocStats: SlocStatItem[];
  overall: OverallBreakdownData;
  gudangId?: number | null;
  onSelectGudang?: (gudangId: number | null) => void;
  selectedSloc?: string;
  onSelectSloc?: (sloc: string) => void;
  selectedStatus?: string;
  onSelectStatus?: (status: string) => void;
  gudangNameDisplay?: string;
}

type MetricViewType = 'tonnage' | 'qty' | 'accuracy';

export const AuditSlocChart: React.FC<AuditSlocChartProps> = ({
  slocStats = [],
  overall = {
    totalItems: 0,
    matchCount: 0,
    deficitCount: 0,
    surplusCount: 0,
    accuracyPct: 0,
  },
  gudangId = null,
  onSelectGudang,
  selectedSloc = '',
  onSelectSloc,
  selectedStatus = 'ALL',
  onSelectStatus,
  gudangNameDisplay,
}) => {
  const [metricView, setMetricView] = useState<MetricViewType>('accuracy');
  const [expandedCard, setExpandedCard] = useState<'sloc' | 'all' | null>(null);

  // Derive active warehouse label (e.g. Gd.13)
  const activeGudangLabel = useMemo(() => {
    if (gudangNameDisplay) return gudangNameDisplay;
    if (gudangId) {
      return `Gd.${gudangId}`;
    }
    if (slocStats.length > 0) {
      const firstSloc = slocStats[0].sloc.toUpperCase();
      const match = firstSloc.match(/^5([A-Z])/);
      if (match) {
        const charCode = match[1].charCodeAt(0) - 64; // A=1, M=13
        if (charCode >= 1 && charCode <= 14) {
          return `Gd.${charCode}`;
        }
      }
    }
    return 'Gd.13';
  }, [gudangNameDisplay, gudangId, slocStats]);

  // Color generator for accuracy threshold
  const getAccuracyColor = (pct: number) => {
    if (pct >= 95) return '#10b981'; // emerald-500
    if (pct >= 85) return '#f59e0b'; // amber-500
    return '#ef4444'; // rose-500
  };

  // Prepare Bar chart data according to active metric
  const barChartData = useMemo(() => {
    return slocStats.map(s => {
      let rawVal = 0;
      let displayLabel = '';

      if (metricView === 'accuracy') {
        rawVal = Number(s.accuracyPct.toFixed(1));
        displayLabel = `${rawVal.toFixed(1)}%`;
      } else if (metricView === 'tonnage') {
        rawVal = Number(s.tonAudit.toFixed(1));
        displayLabel = `${rawVal.toLocaleString('id-ID', { maximumFractionDigits: 1 })} T`;
      } else {
        rawVal = Math.round(s.qtyAudit);
        displayLabel = `${rawVal.toLocaleString('id-ID')}`;
      }

      const color =
        metricView === 'accuracy'
          ? getAccuracyColor(s.accuracyPct)
          : metricView === 'tonnage'
            ? '#0284c7' // sky-600
            : '#6366f1'; // indigo-500

      const isSelected = selectedSloc ? s.sloc === selectedSloc : true;

      return {
        sloc: s.sloc,
        value: rawVal,
        displayLabel,
        color,
        isSelected,
        raw: s,
      };
    });
  }, [slocStats, metricView, selectedSloc]);

  // Donut chart data for HASIL STO ALL
  const donutChartData = useMemo(() => {
    return [
      {
        name: 'Match',
        value: overall.matchCount,
        color: '#10b981',
        statusKey: 'MATCH',
      },
      {
        name: 'Minus (-)',
        value: overall.deficitCount,
        color: '#f43f5e',
        statusKey: 'DEFICIT',
      },
      {
        name: 'Plus (+)',
        value: overall.surplusCount,
        color: '#f59e0b',
        statusKey: 'SURPLUS',
      },
    ];
  }, [overall]);

  // Custom Bar top label
  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, value } = props;
    if (value === undefined || value === null) return null;

    const numVal = typeof value === 'number' ? value : Number(value) || 0;

    let displayLabel = '';
    if (metricView === 'accuracy') {
      displayLabel = `${numVal.toFixed(1)}%`;
    } else if (metricView === 'tonnage') {
      displayLabel = `${numVal.toLocaleString('id-ID', { maximumFractionDigits: 1 })} T`;
    } else {
      displayLabel = `${Math.round(numVal).toLocaleString('id-ID')}`;
    }

    const labelColor =
      metricView === 'accuracy'
        ? numVal >= 95
          ? '#10b981'
          : numVal >= 85
            ? '#f59e0b'
            : '#ef4444'
        : '#475569';

    // When value is 0, render label slightly above baseline
    const posY = numVal === 0 ? y - 6 : Math.max(16, y - 8);

    return (
      <text
        x={x + width / 2}
        y={posY}
        fill={labelColor}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        className="font-sans tabular-nums select-none"
      >
        {displayLabel}
      </text>
    );
  };

  // Custom tooltip for SLoc bar chart
  const SlocTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const s: SlocStatItem = data.raw;

    return (
      <div className="bg-white/95 backdrop-blur-xl border border-white/90 rounded-2xl p-4 shadow-xl text-xs space-y-2 z-50 min-w-[210px] shadow-apple-card">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
            <div className="w-5 h-5 rounded-md bg-blue-50 text-[#007AFF] flex items-center justify-center">
              <MapPin size={12} strokeWidth={2.5} />
            </div>
            <span>SLoc {s.sloc}</span>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider shadow-xs"
            style={{ backgroundColor: getAccuracyColor(s.accuracyPct) }}
          >
            {s.accuracyPct >= 95 ? 'Tinggi' : s.accuracyPct >= 85 ? 'Sedang' : 'Kritis'}
          </span>
        </div>

        <div className="space-y-1.5 text-slate-600 font-medium">
          <div className="flex justify-between items-center">
            <span>Akurasi Fisik:</span>
            <span
              className="font-bold font-mono tabular-nums"
              style={{ color: getAccuracyColor(s.accuracyPct) }}
            >
              {s.accuracyPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Total Item Baris:</span>
            <span className="font-bold text-slate-800 font-mono tabular-nums">
              {s.totalItems.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="flex justify-between items-center text-emerald-700">
            <span>Match:</span>
            <span className="font-bold font-mono tabular-nums">{s.matchCount.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-rose-600">
            <span>Minus (-):</span>
            <span className="font-bold font-mono tabular-nums">{s.deficitCount.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between items-center text-amber-600">
            <span>Plus (+):</span>
            <span className="font-bold font-mono tabular-nums">{s.surplusCount.toLocaleString('id-ID')}</span>
          </div>
          <div className="border-t border-slate-100 pt-1.5 mt-1 flex justify-between items-center">
            <span>Fisik Audit:</span>
            <span className="font-bold text-slate-900 font-mono tabular-nums">
              {s.tonAudit.toFixed(2)} TON ({s.qtyAudit.toLocaleString('id-ID')} PCS)
            </span>
          </div>
        </div>

        <div className="pt-1 text-[10px] text-slate-400 font-semibold text-center italic">
          Klik bar untuk filter tabel ke SLoc ini
        </div>
      </div>
    );
  };

  // Custom tooltip for Donut chart
  const DonutTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    const pct = overall.totalItems > 0 ? (data.value / overall.totalItems) * 100 : 0;

    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
        <div className="flex items-center gap-2 font-bold text-slate-900">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
          <span>{data.name}</span>
        </div>
        <div className="text-slate-600 font-medium">
          Jumlah: <span className="font-bold text-slate-900 font-mono">{data.value.toLocaleString('id-ID')}</span> baris
        </div>
        <div className="text-slate-500 font-medium">
          Proporsi: <span className="font-bold text-slate-800 font-mono">{pct.toFixed(1)}%</span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ─── CARD 1: HASIL STO PER SLOC (Left Column) ─── */}
      <div className="lg:col-span-8 glass-card rounded-[28px] p-5 sm:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple relative overflow-hidden group min-w-0">
        <div>
          {/* Card Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/50">
            {/* Title & Subtitle */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50/80 text-[#007AFF] border border-blue-200/50 flex items-center justify-center shrink-0">
                <MapPin size={16} strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Audit Per Sloc
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeGudangLabel} • {slocStats.length} SLoc terdata
                </p>
              </div>
            </div>

            {/* Right Controls: Warehouse Selector, Segmented Control, Expand */}
            <div className="flex items-center gap-2">
              {/* Warehouse Dropdown Switcher (minimal pill, no duplicate static badge) */}
              {onSelectGudang && (
                <div className="relative">
                  <select
                    value={gudangId ?? ''}
                    onChange={e => {
                      const val = e.target.value ? parseInt(e.target.value, 10) : null;
                      onSelectGudang(val);
                    }}
                    className="h-7 pl-2.5 pr-6 rounded-lg bg-slate-100/80 hover:bg-slate-200/60 border border-slate-200/60 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer appearance-none transition-apple"
                  >
                    <option value="">Semua Gudang</option>
                    {GUDANG_LIST.map(g => (
                      <option key={g.gudangId} value={g.gudangId}>
                        Gd.{g.gudangId} ({g.prefix})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              {/* iOS Segmented Metric Switcher: Tonase | Qty | Akurasi */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setMetricView('tonnage')}
                  className={`px-2.5 py-1 text-[11px] transition-apple cursor-pointer ${
                    metricView === 'tonnage'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold rounded-[6px]'
                      : 'text-slate-500 hover:text-slate-900 font-medium'
                  }`}
                >
                  Tonase
                </button>
                <button
                  type="button"
                  onClick={() => setMetricView('qty')}
                  className={`px-2.5 py-1 text-[11px] transition-apple cursor-pointer ${
                    metricView === 'qty'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold rounded-[6px]'
                      : 'text-slate-500 hover:text-slate-900 font-medium'
                  }`}
                >
                  Qty
                </button>
                <button
                  type="button"
                  onClick={() => setMetricView('accuracy')}
                  className={`px-2.5 py-1 text-[11px] transition-apple cursor-pointer ${
                    metricView === 'accuracy'
                      ? 'bg-white text-[#34C759] shadow-xs font-bold rounded-[6px]'
                      : 'text-slate-500 hover:text-slate-900 font-medium'
                  }`}
                >
                  Akurasi
                </button>
              </div>

              {/* Expand Button */}
              <button
                type="button"
                onClick={() => setExpandedCard(expandedCard === 'sloc' ? null : 'sloc')}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 flex items-center justify-center transition-apple cursor-pointer shrink-0"
                title="Perbesar Grafik"
              >
                <Maximize2 size={13} strokeWidth={2.2} />
              </button>
            </div>
          </div>

          {/* Legend & Filter Sub-row */}
          <div className="flex items-center justify-between gap-3 mt-2.5 mb-1.5 flex-wrap">
            {/* Color indicators */}
            <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                <span>Tinggi (≥ 95%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
                <span>Sedang (85 - 94%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
                <span>Kritis (&lt; 85%)</span>
              </div>
            </div>

            {/* SLoc Filter indicator Pill */}
            {selectedSloc ? (
              <button
                type="button"
                onClick={() => onSelectSloc && onSelectSloc('')}
                className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#007AFF] border border-blue-200/80 hover:bg-blue-100/80 transition-apple cursor-pointer"
              >
                <span>SLoc: {selectedSloc}</span>
                <X size={11} strokeWidth={2.5} />
              </button>
            ) : (
              <span className="text-[11px] font-medium text-slate-400">
                {slocStats.length} SLoc
              </span>
            )}
          </div>

          {/* Main Bar Chart Canvas */}
          <div className="w-full mt-4 h-[280px] sm:h-[310px] min-w-0">
            {barChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-semibold">
                Tidak ada data SLoc untuk sesi audit ini
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={barChartData}
                  margin={{ top: 22, right: 8, left: -20, bottom: 6 }}
                  onClick={(state: any) => {
                    if (state?.activePayload?.length) {
                      const clickedSloc = state.activePayload[0]?.payload?.sloc;
                      if (clickedSloc && onSelectSloc) {
                        onSelectSloc(selectedSloc === clickedSloc ? '' : clickedSloc);
                      }
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.6)" />
                  <XAxis
                    dataKey="sloc"
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                  />
                  <YAxis
                    domain={metricView === 'accuracy' ? [0, 100] : [0, 'auto']}
                    ticks={metricView === 'accuracy' ? [0, 25, 50, 75, 100] : undefined}
                    tickFormatter={v => (metricView === 'accuracy' ? `${v}%` : `${v}`)}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                  />
                  <Tooltip content={<SlocTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                  <Bar
                    dataKey="value"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={38}
                    className="cursor-pointer transition-all duration-300"
                  >
                    {barChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        fillOpacity={entry.isSelected ? 1 : 0.25}
                        stroke={selectedSloc === entry.sloc ? '#0f172a' : 'transparent'}
                        strokeWidth={selectedSloc === entry.sloc ? 2 : 0}
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      content={renderCustomBarLabel}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ─── CARD 2: HASIL STO ALL (Right Column) ─── */}
      <div className="lg:col-span-4 glass-card rounded-[28px] p-5 sm:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple relative overflow-hidden group min-w-0">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50/80 text-[#AF52DE] border border-purple-200/50 flex items-center justify-center shrink-0">
                <PieChartIcon size={16} strokeWidth={2.4} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Akurasi Audit
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Distribusi kecocokan fisik vs SAP
                </p>
              </div>
            </div>

            {/* Expand icon */}
            <button
              type="button"
              onClick={() => setExpandedCard(expandedCard === 'all' ? null : 'all')}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 flex items-center justify-center transition-apple cursor-pointer shrink-0"
              title="Perbesar Donut Chart"
            >
              <Maximize2 size={13} strokeWidth={2.2} />
            </button>
          </div>

          {/* Donut Chart Canvas with Centered Percentage Label */}
          <div className="relative w-full h-[220px] sm:h-[235px] flex items-center justify-center mt-2 min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                {/* Background track circle */}
                <Pie
                  data={[{ value: 1 }]}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={95}
                  fill="#F1F5F9"
                  isAnimationActive={false}
                  stroke="none"
                />
                <Pie
                  data={donutChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={95}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={donutChartData.filter(d => d.value > 0).length > 1 ? 2.5 : 0}
                  cornerRadius={6}
                  className="cursor-pointer"
                  onClick={(entry: any) => {
                    const statusKey = entry?.statusKey || entry?.payload?.statusKey;
                    if (statusKey && onSelectStatus) {
                      const nextStatus = selectedStatus === statusKey ? 'ALL' : statusKey;
                      onSelectStatus(nextStatus);
                    }
                  }}
                >
                  {donutChartData.map((entry, index) => (
                    <Cell
                      key={`donut-${index}`}
                      fill={entry.color}
                      stroke={selectedStatus === entry.statusKey ? '#0f172a' : 'transparent'}
                      strokeWidth={selectedStatus === entry.statusKey ? 2 : 0}
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label (Percentage + Akurasi Fisik) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight tabular-nums">
                {overall.accuracyPct.toFixed(1)}%
              </span>
              <span className="text-xs font-semibold text-slate-400 mt-0.5">
                Akurasi Fisik
              </span>
            </div>
          </div>
        </div>

        {/* Bottom 3 Summary Status Cards: Match | Minus (-) | Plus (+) */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-200/50 mt-2">
          {/* 1. Sesuai */}
          <button
            type="button"
            onClick={() => onSelectStatus && onSelectStatus(selectedStatus === 'MATCH' ? 'ALL' : 'MATCH')}
            className={`p-2.5 rounded-xl text-center transition-apple cursor-pointer ${
              selectedStatus === 'MATCH'
                ? 'bg-emerald-50/90 border border-emerald-300 ring-2 ring-emerald-500/20 shadow-apple-xs'
                : 'bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] shrink-0" />
              <span>Match</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
              {overall.matchCount.toLocaleString('id-ID')}
            </div>
          </button>

          {/* 2. Minus (-) */}
          <button
            type="button"
            onClick={() => onSelectStatus && onSelectStatus(selectedStatus === 'DEFICIT' ? 'ALL' : 'DEFICIT')}
            className={`p-2.5 rounded-xl text-center transition-apple cursor-pointer ${
              selectedStatus === 'DEFICIT'
                ? 'bg-rose-50/90 border border-rose-300 ring-2 ring-rose-500/20 shadow-apple-xs'
                : 'bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shrink-0" />
              <span>Minus (-)</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
              {overall.deficitCount.toLocaleString('id-ID')}
            </div>
          </button>

          {/* 3. Plus (+) */}
          <button
            type="button"
            onClick={() => onSelectStatus && onSelectStatus(selectedStatus === 'SURPLUS' ? 'ALL' : 'SURPLUS')}
            className={`p-2.5 rounded-xl text-center transition-apple cursor-pointer ${
              selectedStatus === 'SURPLUS'
                ? 'bg-amber-50/90 border border-amber-300 ring-2 ring-amber-500/20 shadow-apple-xs'
                : 'bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] shrink-0" />
              <span>Plus (+)</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
              {overall.surplusCount.toLocaleString('id-ID')}
            </div>
          </button>
        </div>
      </div>

      {/* ─── EXPANDED MODAL (Fullscreen inspection) ─── */}
      {expandedCard && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl border border-white/90 rounded-[28px] p-6 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-slate-900/15">
            <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white shadow-apple-xs border border-slate-200/70 flex items-center justify-center text-slate-800">
                  {expandedCard === 'sloc' ? <MapPin size={20} className="text-[#007AFF]" /> : <PieChartIcon size={20} className="text-[#AF52DE]" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase">
                    {expandedCard === 'sloc' ? 'AUDIT PER SLOC (DETAIL)' : 'AKURASI AUDIT (DETAIL)'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {expandedCard === 'sloc'
                      ? `Grafik deviasi per storage location di ${activeGudangLabel}`
                      : 'Distribusi akurasi dan status selisih audit'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpandedCard(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-apple cursor-pointer"
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>

            {/* Modal chart body */}
            {expandedCard === 'sloc' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-semibold">
                  <div className="flex items-center gap-4 text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Tinggi (≥ 95%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Sedang (85 - 94%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Kritis (&lt; 85%)</span>
                  </div>
                  <div className="flex items-center p-0.5 rounded-xl bg-slate-100">
                    <button
                      onClick={() => setMetricView('tonnage')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${metricView === 'tonnage' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600'}`}
                    >
                      Tonase
                    </button>
                    <button
                      onClick={() => setMetricView('qty')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${metricView === 'qty' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
                    >
                      Qty Pcs
                    </button>
                    <button
                      onClick={() => setMetricView('accuracy')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${metricView === 'accuracy' ? 'bg-white text-emerald-700 border border-emerald-300 shadow-xs' : 'text-slate-600'}`}
                    >
                      Akurasi (%)
                    </button>
                  </div>
                </div>

                <div className="w-full h-[450px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <BarChart data={barChartData} margin={{ top: 25, right: 10, left: -10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="sloc" tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
                      <YAxis
                        domain={metricView === 'accuracy' ? [0, 100] : [0, 'auto']}
                        ticks={metricView === 'accuracy' ? [0, 25, 50, 75, 100] : undefined}
                        tickFormatter={v => (metricView === 'accuracy' ? `${v}%` : `${v}`)}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip content={<SlocTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {barChartData.map((entry, index) => (
                          <Cell key={`modal-cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="value" position="top" content={renderCustomBarLabel} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 space-y-6">
                <div className="relative w-[320px] h-[320px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <PieChart>
                      <Pie
                        data={donutChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={135}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={3}
                        cornerRadius={6}
                      >
                        {donutChartData.map((entry, index) => (
                          <Cell key={`modal-donut-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DonutTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                    <span className="text-5xl font-black text-slate-900 tracking-tight tabular-nums font-mono">
                      {overall.accuracyPct.toFixed(1)}%
                    </span>
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                      AKURASI
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <div className="text-xs font-bold text-emerald-800">Match</div>
                    <div className="text-2xl font-black text-emerald-800 mt-1 font-mono">
                      {overall.matchCount.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center">
                    <div className="text-xs font-bold text-rose-800">Minus (-)</div>
                    <div className="text-2xl font-black text-rose-800 mt-1 font-mono">
                      {overall.deficitCount.toLocaleString('id-ID')}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
                    <div className="text-xs font-bold text-amber-800">Plus (+)</div>
                    <div className="text-2xl font-black text-amber-800 mt-1 font-mono">
                      {overall.surplusCount.toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
