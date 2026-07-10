'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, Box, Warehouse, AlertTriangle, CheckCircle, Edit3, Save, BarChart as BarChartIcon } from 'lucide-react';

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

const COLORS = ['#1591DC', '#2C5EAD', '#4BB8FA', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#a855f7'];

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
        const r = await fetch(`/api/reports/${selectedId}`);
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

  return (
    <div className="space-y-6">
      {/* Session Selector */}
      <div className="flex items-center gap-3">
        <label className="text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Laporan:</label>
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="h-8 text-[11px] font-bold text-[#2C5EAD] bg-white border border-[#C4E2F5]/50 rounded-xl px-3 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 hover:border-[#4BB8FA]/50 cursor-pointer transition-all shadow-sm max-w-[240px] truncate"
        >
          {sessions.map(s => (
            <option key={s.reportSessionId} value={s.reportSessionId}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-28">
          <div className="w-8 h-8 border-[3px] border-[#C4E2F5]/50 border-t-[#1591DC] rounded-full animate-spin" />
        </div>
      ) : !data ? (
        <div className="text-center py-28">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Box size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">Belum Ada Data</p>
          <p className="text-xs text-slate-400 mt-1">Upload laporan untuk melihat analytics</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {(() => {
              const totalStok = gudangData.reduce((s, g) => s + g.stock, 0);
              const avgUtil = gudangData.length > 0 ? Math.round(gudangData.reduce((s, g) => s + g.utilization, 0) / gudangData.length) : 0;
              const slowPct = movementSummary.total > 0 ? Math.round((movementSummary.slow / movementSummary.total) * 100) : 0;

              const cards = [
                { label: 'Total Gudang', numValue: gudangData.length, suffix: '', icon: Warehouse, accent: 'brand', desc: 'Warehouse terdaftar' },
                { label: 'Total Stok', numValue: totalStok, suffix: 'T', icon: Box, accent: 'emerald', desc: 'Total tonase tersimpan' },
                { label: 'Rata-rata Utilisasi', numValue: avgUtil, suffix: '%', icon: TrendingUp, accent: 'brandAlt', desc: `${gudangData.filter(g => g.utilization > 75).length} gudang > 75%` },
                { label: 'Slow Moving', numValue: slowPct, suffix: '%', icon: AlertTriangle, accent: 'amber', desc: `${movementSummary.slow} dari ${movementSummary.total} item` },
              ];

              const accentStyles: Record<string, { text: string; iconBg: string; borderGlow: string }> = {
                brand: { text: 'text-[#1591DC]', iconBg: 'bg-gradient-to-br from-[#1591DC] to-[#2C5EAD]', borderGlow: 'shadow-[#1591DC]/10' },
                emerald: { text: 'text-emerald-600', iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', borderGlow: 'shadow-emerald-500/10' },
                brandAlt: { text: 'text-[#2C5EAD]', iconBg: 'bg-gradient-to-br from-[#2C5EAD] to-[#1591DC]', borderGlow: 'shadow-[#2C5EAD]/10' },
                amber: { text: 'text-amber-600', iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600', borderGlow: 'shadow-amber-500/10' },
              };

              return cards.map((item, i) => {
                const s = accentStyles[item.accent];
                return (
                  <motion.div key={i} initial={{ opacity: 0, y: 28, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: i * 0.1, duration: 0.6, ease: easeOut }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    className={`relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-2xl overflow-hidden group cursor-default hover:shadow-xl ${s.borderGlow} hover:border-[#4BB8FA]/50 transition-all duration-300`}
                  >
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`, backgroundSize: '16px 16px', color: item.accent === 'brand' ? '#1591DC' : item.accent === 'emerald' ? '#10b981' : item.accent === 'brandAlt' ? '#2C5EAD' : '#f59e0b' }} />
                    <div className="relative p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em]">{item.label}</span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${s.text}`}>
                              <AnimatedCounter value={item.numValue} suffix={item.suffix} />
                            </span>
                          </div>
                        </div>
                        <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center shadow-lg shadow-black/5 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                          <item.icon size={18} className="text-white" />
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400">{item.desc}</p>
                    </div>
                  </motion.div>
                );
              });
            })()}
          </div>

          {/* Data Pipa NC (Custom Cards from /pipa-nc) */}
          {data.stockCards && data.stockCards.some(sc => isPipaNC(sc.batch)) && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
              <div className="flex items-center justify-between mb-4 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-indigo-700 rounded-full shadow-sm shadow-indigo-500/20" />
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.1em]">Distribusi Pipa NC</h3>
                </div>
                <div className="px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Live Tracking</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 pb-2">
                {(() => {
                  const scData = data.stockCards || [];
                  const pipaNCData = scData.filter(sc => isPipaNC(sc.batch) && sc.ttlStokBom > 0);
                  const gradeCCount = pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('C')).length;
                  const gradeECount = pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('E')).length;
                  const totalItems = pipaNCData.length;
                  const totalQty = pipaNCData.reduce((sum, d) => sum + d.ttlStokBom, 0);
                  const totalTonase = pipaNCData.reduce((sum, d) => sum + d.ttlStokEom, 0);

                  const cards = [
                    { 
                      label: 'GRADE C', 
                      value: gradeCCount, 
                      suffix: 'Batch', 
                      bg: 'bg-gradient-to-br from-emerald-50 to-teal-50', 
                      border: 'border-emerald-100',
                      text: 'text-emerald-900', 
                      descText: 'text-emerald-600',
                      desc: `Pipa Akhiran C` 
                    },
                    { 
                      label: 'GRADE E', 
                      value: gradeECount, 
                      suffix: 'Batch', 
                      bg: 'bg-gradient-to-br from-rose-50 to-pink-50', 
                      border: 'border-rose-100',
                      text: 'text-rose-900', 
                      descText: 'text-rose-600',
                      desc: `Pipa Akhiran E` 
                    },
                    { 
                      label: 'Total Material', 
                      value: totalItems, 
                      suffix: 'Item', 
                      bg: 'bg-gradient-to-br from-indigo-50 to-blue-50', 
                      border: 'border-indigo-100',
                      text: 'text-indigo-900', 
                      descText: 'text-indigo-600',
                      desc: 'Total Pipa Terdata' 
                    },
                    { 
                      label: 'Total Kuantitas', 
                      value: totalQty, 
                      suffix: 'Pcs', 
                      bg: 'bg-white', 
                      border: 'border-slate-200',
                      text: 'text-slate-800', 
                      descText: 'text-slate-500',
                      desc: 'Berdasarkan BOM', 
                      format: 'number' 
                    },
                    { 
                      label: 'Total Berat', 
                      value: totalTonase, 
                      suffix: 'Ton', 
                      bg: 'bg-white', 
                      border: 'border-slate-200',
                      text: 'text-slate-800', 
                      descText: 'text-slate-500',
                      desc: 'Berdasarkan EOM', 
                      format: 'decimal' 
                    },
                  ];

                  return cards.map((item, i) => (
                    <div key={i} className={`relative overflow-hidden rounded-2xl ${item.bg} border ${item.border} p-4 sm:p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group`}>
                      <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/40 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                      <div className="relative z-10 flex flex-col h-full">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                          {item.label}
                        </span>
                        <div className="flex items-baseline gap-1.5 mb-1 sm:mb-2">
                          <span className={`text-2xl sm:text-3xl font-black tabular-nums tracking-tighter ${item.text}`}>
                            {item.format === 'decimal' ? item.value.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : item.value.toLocaleString('id-ID')}
                          </span>
                          <span className={`text-[10px] sm:text-xs font-bold ${item.descText} opacity-80 uppercase tracking-wider`}>
                            {item.suffix}
                          </span>
                        </div>
                        <div className="mt-auto pt-2 border-t border-black/5">
                          <span className={`text-[10px] sm:text-[11px] font-medium ${item.descText}`}>
                            {item.desc}
                          </span>
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </motion.div>
          )}

          {/* Capacity Analysis Table */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.55, ease: easeOut }}
            className="relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-[#1591DC]/10 via-[#4BB8FA]/5 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #1591DC 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
            <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#4BB8FA]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative">
              <div className="px-6 py-4 border-b border-[#C4E2F5]/40 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                <div>
                  <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Capacity Analysis</h3>
                  <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Stock vs Kapasitas per Gudang</p>
                </div>
                <span className="text-[10px] font-bold text-[#1591DC]/60 bg-[#C4E2F5]/30 px-2.5 py-1 rounded-lg border border-[#C4E2F5]/50">Klik kapasitas untuk edit</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead>
                    <tr className="border-b border-[#C4E2F5]/40 bg-[#C4E2F5]/10">
                      <th className="text-left px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Gudang</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Items</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Stock</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Kapasitas</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Utilisasi</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Progres</th>
                      <th className="text-right px-6 py-3.5 text-[10px] font-bold text-[#2C5EAD]/60 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gudangData.map((g, i) => {
                      const isHigh = g.utilization > 90;
                      const isMid = g.utilization > 75;
                      const barColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-emerald-500';
                      const dotColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-emerald-500';
                      const textColor = isHigh ? 'text-red-600' : isMid ? 'text-amber-600' : 'text-emerald-600';
                      const rowBg = i % 2 === 0 ? 'bg-white/60' : 'bg-[#C4E2F5]/5';
                      return (
                        <tr key={g.name} className={`${rowBg} hover:bg-[#C4E2F5]/20 transition-colors duration-200`}>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2 h-2 rounded-full ${dotColor} ring-2 ring-inset ring-white shadow-sm`} />
                              <span className="font-bold text-[#2C5EAD] text-[13px]">{g.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-right"><span className="text-[#1591DC]/70 text-[13px] font-bold">{g.items}</span></td>
                          <td className="px-6 py-3.5 text-right">
                            <span className="font-black text-[#2C5EAD] text-[13px] tabular-nums">
                              {g.stock.toFixed(0)}
                              {g.warning && <span className="ml-1.5 text-[10px] text-red-400 font-bold" title="Nilai tonase tidak wajar">⚠</span>}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            {editing === g.name ? (
                              <form onSubmit={e => { e.preventDefault(); saveCapacity(g.name, parseFloat(editValue) || 0); setEditing(null); }}
                                className="flex items-center justify-end gap-1">
                                <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                                  className="w-20 text-right text-xs font-bold bg-white border border-[#4BB8FA] rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-[#4BB8FA]/30" />
                                <button type="submit" className="p-1 text-[#1591DC] hover:text-[#2C5EAD] transition-colors"><Save size={14} /></button>
                              </form>
                            ) : (
                              <button onClick={() => { setEditing(g.name); setEditValue(String(g.capacity)); }}
                                className="inline-flex items-center gap-1.5 text-[#2C5EAD]/70 hover:text-[#1591DC] transition-colors font-bold text-[13px]">
                                <span className="tabular-nums">{g.capacity.toFixed(0)}</span>
                                <Edit3 size={11} className="text-[#C4E2F5] hover:text-[#1591DC] transition-colors" />
                              </button>
                            )}
                          </td>
                          <td className={`px-6 py-3.5 text-right font-black text-[13px] tabular-nums ${textColor}`}>{g.utilization}%</td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end"><div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(g.utilization, 100)}%` }} /></div></div>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            {isHigh ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider bg-red-50 px-2.5 py-1 rounded-full border border-red-100/50 shadow-sm">
                                <AlertTriangle size={10} /> Critical
                              </span>
                            ) : isMid ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-600 uppercase tracking-wider bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/50 shadow-sm">
                                Warning
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100/50 shadow-sm">
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
            </div>
          </motion.div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.55, ease: easeOut }}
              className="relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-[#1591DC]/10 via-[#4BB8FA]/5 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #1591DC 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
              <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#4BB8FA]/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="px-6 py-4 border-b border-[#C4E2F5]/40 bg-gradient-to-r from-white/40 to-transparent">
                  <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Stock vs Kapasitas</h3>
                  <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Perbandingan stok aktual dengan kapasitas (ton)</p>
                </div>
                <div className="px-5 pt-5 pb-4">
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gudangData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} />
                        <Tooltip />
                        <Bar dataKey="capacity" name="Kapasitas" radius={[4, 4, 0, 0]} barSize={22} fill="#cbd5e1" fillOpacity={1} />
                        <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]} barSize={22} fillOpacity={0.9}>
                          {gudangData.map((entry, idx) => {
                            const barColor = entry.utilization > 90 ? '#ef4444' : entry.utilization > 75 ? '#f59e0b' : '#1591DC';
                            return <Cell key={`cell-${idx}`} fill={barColor} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center justify-center gap-5 mt-3">
                    {[['#1591DC', 'Optimal'], ['#f59e0b', 'Warning'], ['#ef4444', 'Critical'], ['#cbd5e1', 'Kapasitas']].map(([c, l]) => (
                      <div key={l} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: c, opacity: c === '#cbd5e1' ? 0.6 : 0.8 }} />
                        <span className="text-[10px] font-semibold text-slate-500">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.55, ease: easeOut }}
              className="relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #f59e0b 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
              <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
              <div className="relative">
                <div className="px-6 py-4 border-b border-[#C4E2F5]/40 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                  <div>
                    <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Stok Tertinggi</h3>
                    <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Gudang dengan persentase stok terbesar</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#1591DC]/60 bg-[#C4E2F5]/30 px-2.5 py-1 rounded-lg border border-[#C4E2F5]/50">Tonase</span>
                </div>
                <div className="px-5 pt-4 pb-4">
                  {top5Utilization.length > 0 ? (
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={top5Utilization} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }} width={75} />
                          <Tooltip />
                          <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={22} fillOpacity={0.9}>
                            {top5Utilization.map((entry, idx) => {
                              const barColor = entry.utilization > 90 ? '#ef4444' : entry.utilization > 75 ? '#f59e0b' : '#1591DC';
                              return <Cell key={`cell-${idx}`} fill={barColor} />;
                            })}
                            <LabelList dataKey="utilization" position="right" fontSize={10} fontWeight={700} fill="#64748b" formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                        <TrendingUp size={18} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">Tidak Ada Data</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Donut Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease: easeOut }}
              className="bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
            >
              <div className="px-6 py-4 border-b border-[#C4E2F5]/40 bg-gradient-to-r from-white/40 to-transparent">
                <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Stock Distribution</h3>
                <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Proporsi stok per gudang</p>
              </div>
              <div className="px-5 pt-5 pb-4">
                <div style={{ height: 300 }} className="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockDistribution} cx="50%" cy="50%" innerRadius={75} outerRadius={115} paddingAngle={3} dataKey="value" stroke="none">
                        {stockDistribution.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center -mt-5">
                      <p className="text-lg font-bold text-slate-900 tracking-tight">{stockDistribution.reduce((s, d) => s + d.value, 0).toFixed(0)}</p>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Total Ton</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3">
                  {stockDistribution.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{d.name}</span>
                      <span className="text-[9px] font-bold text-slate-500 tabular-nums">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, ease: easeOut }}
              className="bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
            >
              <div className="px-6 py-4 border-b border-[#C4E2F5]/40 bg-gradient-to-r from-white/40 to-transparent">
                <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Movement Overview</h3>
                <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Distribusi tipe pergerakan barang</p>
              </div>
              <div className="px-5 pt-5 pb-4">
                <div style={{ height: 300 }} className="relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={movementTypeData} cx="50%" cy="50%" innerRadius={75} outerRadius={115} paddingAngle={3} dataKey="value" stroke="none">
                        {movementTypeData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center -mt-5">
                      <p className="text-lg font-bold text-slate-900 tracking-tight">{movementTypeData.reduce((s, d) => s + d.value, 0)}</p>
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-widest mt-0.5">Total</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3">
                  {movementTypeData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{d.name}</span>
                      <span className="text-[9px] font-bold text-slate-500 tabular-nums">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Top 5 Customers */}
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.48, duration: 0.55, ease: easeOut }}
            className="relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
          >
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-[#2C5EAD]/10 via-[#1591DC]/5 to-transparent blur-3xl pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: `radial-gradient(circle, #2C5EAD 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
            <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#4BB8FA]/30 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
            <div className="relative">
              <div className="px-6 py-4 border-b border-[#C4E2F5]/40 flex items-center justify-between bg-gradient-to-r from-white/40 to-transparent">
                <div>
                  <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Top 5 Customer</h3>
                  <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Customer dengan stok terbanyak</p>
                </div>
                <span className="text-[10px] font-bold text-[#1591DC]/60 bg-[#C4E2F5]/30 px-2.5 py-1 rounded-lg border border-[#C4E2F5]/50">Tonase</span>
              </div>
              <div className="px-5 pt-4 pb-4">
                {customerStockTop5.length > 0 ? (
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={customerStockTop5} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} fillOpacity={0.9}>
                          {customerStockTop5.map((_, idx) => (<Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />))}
                          <LabelList dataKey="value" position="right" fontSize={10} fontWeight={700} fill="#64748b" formatter={(v: any) => `${Number(v).toFixed(1)} T`} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <TrendingUp size={18} className="text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Tidak Ada Data Customer</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Recommendations */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ease: easeOut }}
            className="bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden hover:shadow-lg hover:shadow-[#1591DC]/15 hover:-translate-y-1 hover:border-[#4BB8FA]/40 transition-all duration-500"
          >
            <div className="px-6 py-4 border-b border-[#C4E2F5]/40 bg-gradient-to-r from-white/40 to-transparent">
              <h3 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Recommendations</h3>
              <p className="text-[11px] text-[#1591DC]/70 mt-0.5">Analisis dan saran tindak lanjut</p>
            </div>
            <div className="p-5 space-y-2.5">
              {(() => {
                const critical = gudangData.filter(g => g.utilization > 90);
                const warning = gudangData.filter(g => g.utilization > 75 && g.utilization <= 90);
                const optimal = gudangData.filter(g => g.utilization <= 75);
                return (
                  <>
                    {critical.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Critical — Segera Ditindak</span>
                        </div>
                        {critical.map(g => (
                          <div key={g.name} className="flex items-start gap-3 p-3.5 bg-red-50/80 rounded-xl border border-red-100/60">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-red-800">{g.name}</p>
                                <span className="text-[10px] font-bold text-red-600 bg-red-100/80 px-1.5 py-0.5 rounded-md">{g.utilization}%</span>
                              </div>
                              <p className="text-xs text-red-600/80 leading-relaxed">
                                Stock <strong>{g.stock.toFixed(0)} ton</strong> dari kapasitas <strong>{g.capacity.toFixed(0)} ton</strong>. Segera lakukan relokasi stok atau tambah kapasitas.
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {warning.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1 pt-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Warning — Perlu Monitoring</span>
                        </div>
                        {warning.map(g => (
                          <div key={g.name} className="flex items-start gap-3 p-3.5 bg-amber-50/80 rounded-xl border border-amber-100/60">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-amber-800">{g.name}</p>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded-md">{g.utilization}%</span>
                              </div>
                              <p className="text-xs text-amber-600/80 leading-relaxed">Monitor ketat. Pertimbangkan rotasi stok untuk mengoptimalkan ruang penyimpanan.</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {optimal.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 px-1 pt-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Optimal — Kapasitas Tersedia</span>
                        </div>
                        {optimal.map(g => (
                          <div key={g.name} className="flex items-start gap-3 p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-100/60">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-emerald-800">{g.name}</p>
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">{g.utilization}%</span>
                              </div>
                              <p className="text-xs text-emerald-600/80 leading-relaxed">Kapasitas tersedia. Dapat digunakan untuk konsolidasi stok dari gudang lain.</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 p-4 bg-[#C4E2F5]/10 rounded-xl border border-[#C4E2F5]/50">
                      <p className="text-[10px] font-bold text-[#2C5EAD] uppercase tracking-wider mb-2.5">Ringkasan</p>
                      <ul className="space-y-2 text-xs text-[#2C5EAD]/80">
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1591DC] shrink-0" />
                          Total slow-moving: <strong>{Math.round((movementSummary.slow / (movementSummary.total || 1)) * 100)}%</strong> dari seluruh transaksi
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1591DC] shrink-0" />
                          Evaluasi item slow-moving untuk <strong>write-off</strong> atau promosi
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1591DC] shrink-0" />
                          Optimalkan alokasi fast-moving items ke gudang dengan akses cepat
                        </li>
                        <li className="flex items-center gap-2.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1591DC] shrink-0" />
                          Lakukan review kapasitas secara periodik setiap bulan
                        </li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
