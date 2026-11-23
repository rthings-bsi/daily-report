'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Box, Warehouse, AlertTriangle, CheckCircle, Edit3, Save } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface StockItem {
  sloc: string | null;
  quantity: number;
  tonnage: number;
  status: string;
}

interface MovementItem {
  moveType: string;
  description: string;
  group: string;
  quantity: number;
  workCenter: string | null;
  dateStr: string;
  storageLocation?: string;
  userName?: string;
}

interface StockCardDisplay {
  sloc: string;
  customer: string;
  materialNumber: string;
  diam: string;
  lengthSide: string;
  widthSide: string;
  diamMm: string;
  tebal: string;
  panjang: string;
  ttlStokBom: number;
  ttlStokEom: number;
  batch: string;
  nomorSo: string;
  itemSo: string;
  class: string;
  description: string;
  custRemark: string;
  jenisMaterial: string;
  kelompok: string;
  pasm: string;
}

interface SessionData {
  reportSessionId: string;
  label: string;
  stocks: StockItem[];
  movements: MovementItem[];
  stockCards?: StockCardDisplay[];
}

interface GudangData {
  name: string;
  stock: number;
  capacity: number;
  utilization: number;
  items: number;
  warning?: boolean;
}

const COLORS = ['#509EE3', '#7172AD', '#80B946', '#F2A86F', '#EF8C8C', '#F9D45C', '#227FD2', '#87BCEC'];

const SLOC_TO_GUDANG: Record<string, string> = {
  '5A': 'Gudang 1', '5B': 'Gudang 2', '5C': 'Gudang 3', '5D': 'Gudang 4',
  '5E': 'Gudang 5', '5F': 'Gudang 6', '5G': 'Gudang 7', '5H': 'Gudang 8',
  '5I': 'Gudang 9', '5J': 'Gudang 10', '5K': 'Gudang 11', '5L': 'Gudang 12',
  '5M': 'Gudang 13', '5N': 'Gudang 14',
};

const gudangNameFromSloc = (sloc: string | null): string => {
  if (!sloc) return 'Unknown';
  const prefix = sloc.toUpperCase().slice(0, 2);
  return SLOC_TO_GUDANG[prefix] || `Gudang ${prefix}`;
};

const isPipaNC = (batch: string): boolean => {
  if (!batch) return false;
  const trimmed = batch.trim().toUpperCase();
  return trimmed.endsWith('C') || trimmed.endsWith('E');
};

const DEFAULT_CAPACITIES: Record<string, number> = {
  'Gudang 1': 1095, 'Gudang 2': 755, 'Gudang 3': 580, 'Gudang 4': 450,
  'Gudang 5': 450, 'Gudang 6': 350, 'Gudang 7': 350, 'Gudang 8': 350,
  'Gudang 9': 350, 'Gudang 10': 350, 'Gudang 11': 860, 'Gudang 12': 750,
  'Gudang 13': 354, 'Gudang 14': 255,
};

const STORAGE_KEY = 'analytics_capacity';

const easeOut = [0.16, 1, 0.3, 1] as const;

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let startTime: number | null = null;
    const duration = 1200;
    const frame = (t: number) => {
      if (!startTime) startTime = t;
      const elapsed = t - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [value]);
  return <>{count.toLocaleString()}{suffix}</>;
}

export default function AnalyticsDashboard() {
  const { isDark } = useTheme();
  const [sessions, setSessions] = useState<{ reportSessionId: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacityMap, setCapacityMap] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(list => {
        setSessions(list);
        if (list.length > 0) setSelectedId(list[0].reportSessionId);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;

    if (!selectedId) return;

    Promise.resolve().then(() => setLoading(true));

    // Create a local function inside useEffect
    const fetchSessionData = async () => {
      try {
        const r = await fetch(`/api/reports/${selectedId}?detail=true`);
        const d = await r.json();

        if (!active) return;
        const stocks = (d.stocks || []).map((s: any) => {
          let t = s.tonnage ?? 0;
          if (typeof t !== 'number') t = parseFloat(t) || 0;
          t = t / 1000;
          return { ...s, tonnage: t };
        });

        setData({
          reportSessionId: d.reportSessionId,
          label: d.label,
          stocks: stocks,
          movements: (d.movements || []).map((m: any) => ({
            ...m,
            quantity: m.quantity || 0,
          })),
          stockCards: d.stockCards || [],
        });
      } catch {
        // error handling
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSessionData();

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCapacityMap(JSON.parse(saved));

    return () => { active = false; };
  }, [selectedId]);

  const enabledStocks = useMemo(() => {
    if (!data) return [];
    return data.stocks;
  }, [data]);

  const enabledMovements = useMemo(() => {
    return data?.movements || [];
  }, [data]);

  const gudangData = useMemo((): GudangData[] => {
    if (!data) return [];
    const map = new Map<string, { stock: number; items: number }>();

    data.stocks.forEach(s => {
      const key = gudangNameFromSloc(s.sloc);
      const prev = map.get(key) || { stock: 0, items: 0 };
      const t = s.tonnage || 0;
      map.set(key, { stock: prev.stock + t, items: prev.items + 1 });
    });
    return Array.from(map.entries()).map(([name, val]) => {
      const cap = capacityMap[name] || DEFAULT_CAPACITIES[name] || Math.round(val.stock * 1.3);
      return {
        name, stock: val.stock, capacity: cap,
        utilization: cap > 0 ? Math.round((val.stock / cap) * 100) : 0,
        items: val.items, warning: val.stock > 50000,
      };
    }).sort((a, b) => {
      const aNum = parseInt(a.name.split(' ')[1]) || 0;
      const bNum = parseInt(b.name.split(' ')[1]) || 0;
      return aNum - bNum;
    });
  }, [data, capacityMap]);

  const movementSummary = useMemo(() => {
    if (data?.stockCards && data.stockCards.length > 0) {
      const total = data.stockCards.length;
      const fast = data.stockCards.filter(s => (s.pasm || '').toUpperCase() === 'FAST').length;
      const slow = data.stockCards.filter(s => (s.pasm || '').toUpperCase() === 'SLOW').length;
      return { fast, slow, total };
    }
    return { fast: 0, slow: 0, total: 0 };
  }, [data?.stockCards]);

  const stockDistribution = useMemo(() => {
    if (!gudangData.length) return [];
    const total = gudangData.reduce((s, g) => s + g.stock, 0);
    return gudangData.map(g => ({
      name: g.name, value: Math.round(g.stock * 10) / 10,
      pct: total > 0 ? Math.round((g.stock / total) * 100) : 0,
    })).sort((a, b) => b.value - a.value);
  }, [gudangData]);

  const top5Utilization = useMemo(() => {
    return [...gudangData].sort((a, b) => b.utilization - a.utilization).slice(0, 5);
  }, [gudangData]);

  const movementTypeData = useMemo(() => {
    const total = enabledMovements.length;
    if (total === 0) return [];
    const map = new Map<string, number>();
    enabledMovements.forEach(m => {
      const key = m.group || m.moveType || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [enabledMovements]);

  const customerStockTop5 = useMemo(() => {
    if (!data?.stockCards?.length) return [];
    const grouped: Record<string, number> = {};
    for (const sc of data.stockCards) {
      const customer = sc.customer || 'Unknown';
      grouped[customer] = (grouped[customer] || 0) + (sc.ttlStokEom || 0);
    }
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value: Math.round(value / 100) / 10 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [data?.stockCards]);

  const saveCapacity = (name: string, val: number) => {
    const next = { ...capacityMap, [name]: val };
    setCapacityMap(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const chartTheme = isDark
    ? {
        grid: 'rgba(255,255,255,0.07)',
        axis: 'rgba(255,255,255,0.14)',
        tick: '#8a99b2',
        label: '#eef3fb',
        capBar: '#2d3444',
        okBar: '#60a5fa',
        warnBar: '#fbbf24',
        critBar: '#fb7185',
        pieStroke: '#212630',
        tooltipBg: '#212630',
        tooltipBorder: 'rgba(255,255,255,0.08)',
        tooltipColor: '#eef3fb',
      }
    : {
        grid: 'rgba(148,163,184,0.24)',
        axis: 'rgba(148,163,184,0.4)',
        tick: '#5a6982',
        label: '#182132',
        capBar: '#d2dbe8',
        okBar: '#3b82f6',
        warnBar: '#f59e0b',
        critBar: '#ef4444',
        pieStroke: '#eaf0f7',
        tooltipBg: '#eaf0f7',
        tooltipBorder: 'rgba(255,255,255,0.7)',
        tooltipColor: '#182132',
      };

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: '14px',
    color: chartTheme.tooltipColor,
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      {/* Session Selector */}
      <div className="flex items-center gap-3">
        <label className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
          Laporan:
        </label>
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="neu-input h-9.5 text-xs font-bold rounded-xl px-3.5 cursor-pointer max-w-[260px] truncate"
        >
          {sessions.map(s => (
            <option key={s.reportSessionId} value={s.reportSessionId}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <div className="w-12 h-12 rounded-2xl neu-card-sm flex items-center justify-center">
            <div className="w-6 h-6 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
          </div>
        </div>
      ) : !data ? (
        <div className="text-center py-24 neu-card">
          <div className="w-12 h-12 neu-icon-inset rounded-2xl flex items-center justify-center mx-auto mb-3 text-[var(--neu-text-muted)]">
            <Box size={22} />
          </div>
          <p className="text-sm font-bold text-[var(--neu-text)]">Belum Ada Data</p>
          <p className="text-xs text-[var(--neu-text-muted)] mt-1">Upload laporan untuk melihat analytics</p>
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {(() => {
              const totalStok = gudangData.reduce((s, g) => s + g.stock, 0);
              const avgUtil = gudangData.length > 0 ? Math.round(gudangData.reduce((s, g) => s + g.utilization, 0) / gudangData.length) : 0;
              const slowPct = movementSummary.total > 0 ? Math.round((movementSummary.slow / movementSummary.total) * 100) : 0;

              const cards = [
                { label: 'Total Gudang', numValue: gudangData.length, suffix: '', icon: Warehouse, dot: 'var(--neu-accent)', iconColor: 'text-[var(--neu-accent)]', desc: 'Warehouse terdaftar' },
                { label: 'Total Stok', numValue: totalStok, suffix: 'T', icon: Box, dot: 'var(--neu-green-bar)', iconColor: 'text-[var(--neu-green)]', desc: 'Total tonase tersimpan' },
                { label: 'Rata-rata Utilisasi', numValue: avgUtil, suffix: '%', icon: TrendingUp, dot: 'var(--neu-purple-bar)', iconColor: 'text-[var(--neu-purple)]', desc: `${gudangData.filter(g => g.utilization > 75).length} gudang > 75%` },
                { label: 'Slow Moving', numValue: slowPct, suffix: '%', icon: AlertTriangle, dot: 'var(--neu-amber-bar)', iconColor: 'text-[var(--neu-amber)]', desc: `${movementSummary.slow} dari ${movementSummary.total} item` },
              ];

              return cards.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25, ease: easeOut }}
                  className="neu-card p-5"
                >
                  <div className="flex items-center justify-between mb-3.5">
                    <span className="text-[12.5px] font-bold text-[var(--neu-text-secondary)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.dot }} />
                      {item.label}
                    </span>
                    <div className={`w-9 h-9 rounded-xl neu-icon-inset flex items-center justify-center ${item.iconColor}`}>
                      <item.icon size={15} strokeWidth={2.2} />
                    </div>
                  </div>
                  <div className="text-[30px] font-extrabold text-[var(--neu-text)] tracking-tight tabular-nums leading-none">
                    <AnimatedCounter value={item.numValue} suffix={item.suffix} />
                  </div>
                  <p className="text-[11.5px] text-[var(--neu-text-muted)] mt-3 pt-2.5 border-t border-[var(--neu-divider)]">
                    {item.desc}
                  </p>
                </motion.div>
              ));
            })()}
          </div>

          {/* Data Pipa NC */}
          {data.stockCards && data.stockCards.some(sc => isPipaNC(sc.batch)) && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.25 }}>
              <div className="flex items-center justify-between mb-3 mt-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full neu-inset-sm flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)]" />
                  </div>
                  <h3 className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                    Distribusi Pipa NC
                  </h3>
                </div>
                <span className="neu-chip">Live Data</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {(() => {
                  const scData = data.stockCards || [];
                  const pipaNCData = scData.filter(sc => isPipaNC(sc.batch) && sc.ttlStokBom > 0);
                  const gradeCCount = pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('C')).length;
                  const gradeECount = pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('E')).length;
                  const totalItems = pipaNCData.length;
                  const totalQty = pipaNCData.reduce((sum, d) => sum + d.ttlStokBom, 0);
                  const totalTonase = pipaNCData.reduce((sum, d) => sum + d.ttlStokEom, 0);

                  const cards = [
                    { label: 'GRADE C', value: gradeCCount, suffix: 'Batch', dot: 'var(--neu-amber-bar)', desc: 'Pipa Akhiran C' },
                    { label: 'GRADE E', value: gradeECount, suffix: 'Batch', dot: 'var(--neu-red-bar)', desc: 'Pipa Akhiran E' },
                    { label: 'Total Material', value: totalItems, suffix: 'Item', dot: 'var(--neu-accent)', desc: 'Total Pipa Terdata' },
                    { label: 'Total Kuantitas', value: totalQty, suffix: 'Pcs', dot: 'var(--neu-purple-bar)', desc: 'Berdasarkan BOM', format: 'number' },
                    { label: 'Total Berat', value: totalTonase, suffix: 'Ton', dot: 'var(--neu-green-bar)', desc: 'Berdasarkan EOM', format: 'decimal' },
                  ];

                  return cards.map((item, i) => (
                    <div key={i} className="neu-card-sm p-4 flex flex-col justify-between">
                      <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.dot }} />
                        {item.label}
                      </span>
                      <div className="flex items-baseline gap-1.5 my-2.5">
                        <span className="text-[24px] font-extrabold tabular-nums tracking-tight text-[var(--neu-text)]">
                          {item.format === 'decimal' ? item.value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : item.value.toLocaleString('id-ID')}
                        </span>
                        <span className="font-mono text-[10.5px] font-medium text-[var(--neu-text-muted)] uppercase">{item.suffix}</span>
                      </div>
                      <span className="text-[11px] text-[var(--neu-text-muted)] pt-2 border-t border-[var(--neu-divider)]">{item.desc}</span>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          )}

          {/* Capacity Analysis Table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.25, ease: easeOut }}
            className="neu-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Capacity Analysis</h3>
                <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Stock vs Kapasitas per Gudang</p>
              </div>
              <span className="neu-chip">Klik kapasitas untuk edit</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead>
                  <tr className="border-b border-[var(--neu-divider)]">
                    <th className="text-left px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Gudang</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Items</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Stock</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Kapasitas</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Utilisasi</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Progres</th>
                    <th className="text-right px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--neu-divider)]">
                  {gudangData.map((g) => {
                    const isHigh = g.utilization > 90;
                    const isMid = g.utilization > 75;
                    const barVar = isHigh ? 'var(--neu-red-bar)' : isMid ? 'var(--neu-amber-bar)' : 'var(--neu-green-bar)';
                    const textColor = isHigh ? 'text-[var(--neu-red)]' : isMid ? 'text-[var(--neu-amber)]' : 'text-[var(--neu-green)]';
                    return (
                      <tr key={g.name} className="hover:bg-[var(--neu-row-hover)] transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: barVar }} />
                            <span className="font-bold text-[var(--neu-text)] text-[13px]">{g.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-[var(--neu-text-muted)] text-xs font-medium">{g.items}</td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-bold text-[var(--neu-text)] text-[13px] tabular-nums">
                            {g.stock.toFixed(0)}
                            {g.warning && <span className="ml-1.5 text-[10px] text-[var(--neu-red)] font-bold" title="Nilai tonase tidak wajar">!</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {editing === g.name ? (
                            <form onSubmit={e => { e.preventDefault(); saveCapacity(g.name, parseFloat(editValue) || 0); setEditing(null); }}
                              className="flex items-center justify-end gap-1">
                              <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                className="neu-input w-20 text-right font-mono text-xs font-bold rounded-lg px-2 py-1" />
                              <button type="submit" className="p-1.5 neu-btn rounded-lg text-[var(--neu-accent)] cursor-pointer"><Save size={13} /></button>
                            </form>
                          ) : (
                            <button type="button" onClick={() => { setEditing(g.name); setEditValue(String(g.capacity)); }}
                              className="inline-flex items-center gap-1.5 text-[var(--neu-text-secondary)] hover:text-[var(--neu-accent)] transition-colors font-mono font-semibold text-xs cursor-pointer">
                              <span className="tabular-nums">{g.capacity.toFixed(0)}</span>
                              <Edit3 size={11} className="text-[var(--neu-text-muted)]" />
                            </button>
                          )}
                        </td>
                        <td className={`px-5 py-3 text-right font-mono font-bold text-xs tabular-nums ${textColor}`}>{g.utilization}%</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end">
                            <div className="w-24 h-2.5 neu-inset-sm rounded-full p-0.5 overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(g.utilization, 100)}%`, backgroundColor: barVar }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isHigh ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[var(--neu-red)] uppercase bg-[var(--neu-red-soft)] px-2.5 py-0.5 rounded-full">
                              <AlertTriangle size={10} /> Critical
                            </span>
                          ) : isMid ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[var(--neu-amber)] uppercase bg-[var(--neu-amber-soft)] px-2.5 py-0.5 rounded-full">
                              Warning
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[var(--neu-green)] uppercase bg-[var(--neu-green-soft)] px-2.5 py-0.5 rounded-full">
                              <CheckCircle size={10} /> Optimal
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="neu-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--neu-divider)]">
                <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Stock vs Kapasitas</h3>
                <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Perbandingan stok aktual dengan kapasitas (ton)</p>
              </div>
              <div className="p-5">
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gudangData} margin={{ top: 5, right: 16, left: -15, bottom: 5 }}>
                      <CartesianGrid vertical={false} stroke={chartTheme.grid} />
                      <XAxis dataKey="name" axisLine={{ stroke: chartTheme.axis }} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 500 }} interval={0} angle={-20} textAnchor="end" height={50} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 500 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="capacity" name="Kapasitas" radius={[4, 4, 0, 0]} barSize={20} fill={chartTheme.capBar} />
                      <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]} barSize={20}>
                        {gudangData.map((entry, idx) => {
                          const barColor = entry.utilization > 90 ? chartTheme.critBar : entry.utilization > 75 ? chartTheme.warnBar : chartTheme.okBar;
                          return <Cell key={`cell-${idx}`} fill={barColor} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-5 mt-3">
                  {[[chartTheme.okBar, 'Optimal'], [chartTheme.warnBar, 'Warning'], [chartTheme.critBar, 'Critical'], [chartTheme.capBar, 'Kapasitas']].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                      <span className="text-[11px] font-semibold text-[var(--neu-text-secondary)]">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="neu-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Stok Tertinggi</h3>
                  <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Gudang dengan persentase stok terbesar</p>
                </div>
                <span className="neu-chip">TONASE</span>
              </div>
              <div className="p-5">
                {top5Utilization.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={top5Utilization} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                        <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 500 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: chartTheme.label, fontWeight: 700 }} width={75} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={20}>
                          {top5Utilization.map((entry, idx) => {
                            const barColor = entry.utilization > 90 ? chartTheme.critBar : entry.utilization > 75 ? chartTheme.warnBar : chartTheme.okBar;
                            return <Cell key={`cell-${idx}`} fill={barColor} />;
                          })}
                          <LabelList dataKey="utilization" position="right" fontSize={11} fontWeight={700} fill={chartTheme.tick} formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="w-10 h-10 neu-icon-inset rounded-xl flex items-center justify-center mx-auto mb-2 text-[var(--neu-text-muted)]">
                      <TrendingUp size={18} />
                    </div>
                    <p className="text-sm font-semibold text-[var(--neu-text-muted)]">Tidak Ada Data</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Donut Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="neu-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--neu-divider)]">
                <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Stock Distribution</h3>
                <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Proporsi stok per gudang</p>
              </div>
              <div className="p-5">
                <div style={{ height: 280 }} className="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockDistribution} cx="50%" cy="50%" innerRadius={72} outerRadius={108} paddingAngle={2} dataKey="value" stroke={chartTheme.pieStroke} strokeWidth={2}>
                        {stockDistribution.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-[var(--neu-text)] tabular-nums">{stockDistribution.reduce((s, d) => s + d.value, 0).toFixed(0)}</p>
                      <p className="font-mono text-[10px] text-[var(--neu-text-muted)] uppercase tracking-wider mt-0.5">Total Ton</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                  {stockDistribution.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] font-medium text-[var(--neu-text-secondary)]">{d.name}</span>
                      <span className="font-mono text-[10.5px] font-bold text-[var(--neu-text)] tabular-nums">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="neu-card overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--neu-divider)]">
                <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Movement Overview</h3>
                <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Distribusi tipe pergerakan barang</p>
              </div>
              <div className="p-5">
                <div style={{ height: 280 }} className="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={movementTypeData} cx="50%" cy="50%" innerRadius={72} outerRadius={108} paddingAngle={2} dataKey="value" stroke={chartTheme.pieStroke} strokeWidth={2}>
                        {movementTypeData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                      <p className="text-xl font-extrabold text-[var(--neu-text)] tabular-nums">{movementTypeData.reduce((s, d) => s + d.value, 0)}</p>
                      <p className="font-mono text-[10px] text-[var(--neu-text-muted)] uppercase tracking-wider mt-0.5">Total</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
                  {movementTypeData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] font-medium text-[var(--neu-text-secondary)]">{d.name}</span>
                      <span className="font-mono text-[10.5px] font-bold text-[var(--neu-text)] tabular-nums">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Customers */}
          <div className="neu-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Top 5 Customer</h3>
                <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Customer dengan stok terbanyak</p>
              </div>
              <span className="neu-chip">TONASE</span>
            </div>
            <div className="p-5">
              {customerStockTop5.length > 0 ? (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={customerStockTop5} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                      <CartesianGrid horizontal={false} stroke={chartTheme.grid} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: chartTheme.tick, fontWeight: 500 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11.5, fill: chartTheme.label, fontWeight: 700 }} width={100} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                        {customerStockTop5.map((_, idx) => (<Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                        <LabelList dataKey="value" position="right" fontSize={11} fontWeight={700} fill={chartTheme.tick} formatter={(v: any) => `${Number(v).toFixed(1)} T`} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="w-10 h-10 neu-icon-inset rounded-xl flex items-center justify-center mx-auto mb-2 text-[var(--neu-text-muted)]">
                    <TrendingUp size={18} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--neu-text-muted)]">Tidak Ada Data Customer</p>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div className="neu-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--neu-divider)]">
              <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">Recommendations</h3>
              <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">Analisis dan saran tindak lanjut berbasis kapasitas</p>
            </div>
            <div className="p-5 space-y-3.5">
              {(() => {
                const critical = gudangData.filter(g => g.utilization > 90);
                const warning = gudangData.filter(g => g.utilization > 75 && g.utilization <= 90);
                const optimal = gudangData.filter(g => g.utilization <= 75);
                return (
                  <>
                    {critical.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className="w-2 h-2 rounded-full bg-[var(--neu-red-bar)]" />
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-red)] uppercase tracking-wider">
                            Critical: Segera Ditindak
                          </span>
                        </div>
                        {critical.map(g => (
                          <div key={g.name} className="p-3.5 neu-inset-sm rounded-2xl border border-[var(--neu-red)]/25">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13.5px] font-bold text-[var(--neu-text)]">{g.name}</p>
                              <span className="font-mono text-[10.5px] font-bold text-[var(--neu-red)] bg-[var(--neu-red-soft)] px-2 py-0.5 rounded-full">{g.utilization}%</span>
                            </div>
                            <p className="text-xs text-[var(--neu-text-secondary)] leading-relaxed">
                              Stock <strong className="text-[var(--neu-text)]">{g.stock.toFixed(0)} ton</strong> dari kapasitas <strong className="text-[var(--neu-text)]">{g.capacity.toFixed(0)} ton</strong>. Segera lakukan relokasi stok atau tambah kapasitas.
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {warning.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1 pt-1">
                          <span className="w-2 h-2 rounded-full bg-[var(--neu-amber-bar)]" />
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-amber)] uppercase tracking-wider">
                            Warning: Perlu Monitoring
                          </span>
                        </div>
                        {warning.map(g => (
                          <div key={g.name} className="p-3.5 neu-inset-sm rounded-2xl border border-[var(--neu-amber)]/25">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13.5px] font-bold text-[var(--neu-text)]">{g.name}</p>
                              <span className="font-mono text-[10.5px] font-bold text-[var(--neu-amber)] bg-[var(--neu-amber-soft)] px-2 py-0.5 rounded-full">{g.utilization}%</span>
                            </div>
                            <p className="text-xs text-[var(--neu-text-secondary)] leading-relaxed">
                              Monitor ketat. Pertimbangkan rotasi stok untuk mengoptimalkan ruang penyimpanan.
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {optimal.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1 pt-1">
                          <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" />
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-green)] uppercase tracking-wider">
                            Optimal: Kapasitas Tersedia
                          </span>
                        </div>
                        {optimal.map(g => (
                          <div key={g.name} className="p-3.5 neu-inset-sm rounded-2xl border border-[var(--neu-green)]/20">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[13.5px] font-bold text-[var(--neu-text)]">{g.name}</p>
                              <span className="font-mono text-[10.5px] font-bold text-[var(--neu-green)] bg-[var(--neu-green-soft)] px-2 py-0.5 rounded-full">{g.utilization}%</span>
                            </div>
                            <p className="text-xs text-[var(--neu-text-secondary)] leading-relaxed">
                              Kapasitas tersedia. Dapat digunakan untuk konsolidasi stok dari gudang lain.
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 p-4 neu-inset-sm rounded-2xl">
                      <p className="font-mono text-[10.5px] font-semibold text-[var(--neu-accent)] uppercase tracking-wider mb-2.5">
                        Ringkasan Analitik
                      </p>
                      <ul className="space-y-2 text-xs text-[var(--neu-text-secondary)]">
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)] shrink-0" />
                          Total slow-moving: <strong className="text-[var(--neu-text)]">{Math.round((movementSummary.slow / (movementSummary.total || 1)) * 100)}%</strong> dari seluruh transaksi
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)] shrink-0" />
                          Evaluasi item slow-moving untuk <strong className="text-[var(--neu-text)]">write-off</strong> atau promosi
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)] shrink-0" />
                          Optimalkan alokasi fast-moving items ke gudang dengan akses cepat
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)] shrink-0" />
                          Lakukan review kapasitas secara periodik setiap bulan
                        </li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
