'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
} from 'recharts';
import { motion } from 'framer-motion';

import { getUserGudang, filterByGudang, removeInternalTfSloc, reclassify311 } from '@/lib/gudang';
import { PageHeader } from '@/components/PageHeader';
import {
  TrendingUp, Box, Warehouse, AlertTriangle, CheckCircle, Edit3, Save,
} from 'lucide-react';

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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const SLOC_TO_GUDANG: Record<string, string> = {
  '5A': 'Gudang 1',
  '5B': 'Gudang 2',
  '5C': 'Gudang 3',
  '5D': 'Gudang 4',
  '5E': 'Gudang 5',
  '5F': 'Gudang 6',
  '5G': 'Gudang 7',
  '5H': 'Gudang 8',
  '5I': 'Gudang 9',
  '5J': 'Gudang 10',
  '5K': 'Gudang 11',
  '5L': 'Gudang 12',
  '5M': 'Gudang 13',
  '5N': 'Gudang 14',
};

const gudangNameFromSloc = (sloc: string | null): string => {
  if (!sloc) return 'Unknown';
  const prefix = sloc.toUpperCase().slice(0, 2);
  return SLOC_TO_GUDANG[prefix] || sloc;
};

const DEFAULT_CAPACITIES: Record<string, number> = {
  'Gudang 1': 1095,
  'Gudang 2': 755,
  'Gudang 3': 580,
  'Gudang 4': 450,
  'Gudang 5': 450,
  'Gudang 6': 350,
  'Gudang 7': 350,
  'Gudang 8': 350,
  'Gudang 9': 350,
  'Gudang 10': 350,
  'Gudang 11': 860,
  'Gudang 12': 750,
  'Gudang 13': 354,
  'Gudang 14': 255,
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

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<{ reportSessionId: string; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [capacityMap, setCapacityMap] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');


  
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'admin' && session.user.gudangId) {
        setSelectedGudang(session.user.gudangId);
      }
    }
  }, [status, session]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(list => {
        setSessions(list);
        if (list.length > 0) setSelectedId(list[0].reportSessionId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    fetch(`/api/reports/${selectedId}`)
      .then(r => r.json())
      .then(d => {
        const stocks = (d.stocks || []).map((s: any) => {
          let t = s.tonnage ?? 0;
          if (typeof t !== 'number') t = parseFloat(t) || 0;
          // Base data is KG, convert to tons
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setCapacityMap(JSON.parse(saved));
  }, [selectedId]);

  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null);
  const activeGudang = selectedGudang;

  const enabledMovements = useMemo(() => {
    return data ? reclassify311(filterByGudang(removeInternalTfSloc(data.movements), activeGudang), activeGudang) : [];
  }, [data, activeGudang]);

  const enabledStocks = useMemo(() => {
    if (!data || !activeGudang) return data?.stocks || [];
    const prefix = '5' + String.fromCharCode(64 + activeGudang);
    return data.stocks.filter(s => (s.sloc || '').toUpperCase().startsWith(prefix));
  }, [data, activeGudang]);

  const gudangData = useMemo((): GudangData[] => {
    if (!data) return [];
    const map = new Map<string, { stock: number; items: number }>();

    (activeGudang ? enabledStocks : data.stocks).forEach(s => {
      const key = gudangNameFromSloc(s.sloc);
      const prev = map.get(key) || { stock: 0, items: 0 };
      const t = s.tonnage || 0;
      map.set(key, {
        stock: prev.stock + t,
        items: prev.items + 1,
      });
    });
    return Array.from(map.entries()).map(([name, val]) => {
      const cap = capacityMap[name] || DEFAULT_CAPACITIES[name] || Math.round(val.stock * 1.3);
      return {
        name,
        stock: val.stock,
        capacity: cap,
      utilization: cap > 0 ? Math.round((val.stock / cap) * 100) : 0,
      items: val.items,
      warning: val.stock > 50000,
    };
  }).sort((a, b) => {
    const aNum = parseInt(a.name.split(' ')[1]) || 0;
    const bNum = parseInt(b.name.split(' ')[1]) || 0;
    return aNum - bNum;
  });
  }, [data, capacityMap, activeGudang, enabledStocks]);

  const movementSummary = useMemo(() => {
    // Use PASM from stock cards if available
    if (data?.stockCards && data.stockCards.length > 0) {
      const total = data.stockCards.length;
      const fast = data.stockCards.filter(s => (s.pasm || '').toUpperCase() === 'FAST').length;
      const slow = data.stockCards.filter(s => (s.pasm || '').toUpperCase() === 'SLOW').length;
      return { fast, slow, total };
    }
    const total = enabledMovements.length;
    if (total === 0) return { fast: 0, slow: 0, total: 0 };
    const counts = new Map<string, number>();
    enabledMovements.forEach(m => {
      const key = m.workCenter || m.moveType;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const threshold = total / (counts.size || 1);
    let fast = 0;
    counts.forEach(c => { if (c >= threshold) fast += c; });
    return { fast, slow: total - fast, total };
  }, [enabledMovements, data?.stockCards]);

  const stockDistribution = useMemo(() => {
    if (!gudangData.length) return [];
    const total = gudangData.reduce((s, g) => s + g.stock, 0);
    return gudangData.map(g => ({
      name: g.name,
      value: Math.round(g.stock * 10) / 10,
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
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
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

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-indigo-200">
      <PageHeader icon={TrendingUp} title="Analytics" subtitle="Analisis kapasitas & utilisasi gudang">
        <span className="h-8 hidden sm:inline-flex items-center px-2.5 text-[11px] font-semibold text-indigo-600 bg-indigo-50 rounded-lg">
          {data?.label || '-'}
        </span>
        {session?.user?.role === 'admin' && (
          <select
            value={activeGudang ?? ''}
            onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
            className="h-8 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors cursor-pointer"
          >
            <option value="">Semua Gudang</option>
            {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
              <option key={n} value={n}>Gudang {n}{n === sessionGudang ? ' (saya)' : ''}</option>
            ))}
          </select>
        )}
        <select
          value={selectedId || ''}
          onChange={e => setSelectedId(e.target.value)}
          className="h-8 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-colors cursor-pointer"
        >
          {sessions.map(s => (
            <option key={s.reportSessionId} value={s.reportSessionId}>{s.label}</option>
          ))}
        </select>
      </PageHeader>

      <div className="max-w-[1700px] mx-auto px-5 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <div className="w-8 h-8 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
                  {
                    label: 'Total Gudang', numValue: gudangData.length, suffix: '', icon: Warehouse,
                    accent: 'indigo', desc: 'Warehouse terdaftar',
                    grad1: 'from-indigo-500/15', grad2: 'via-indigo-500/5',
                    dot: 'bg-indigo-400/20',
                  },
                  {
                    label: 'Total Stok', numValue: totalStok, suffix: 'T', icon: Box,
                    accent: 'emerald', desc: 'Total tonase tersimpan',
                    grad1: 'from-emerald-500/15', grad2: 'via-emerald-500/5',
                    dot: 'bg-emerald-400/20',
                  },
                  {
                    label: 'Rata-rata Utilisasi', numValue: avgUtil, suffix: '%', icon: TrendingUp,
                    accent: 'sky', desc: `${gudangData.filter(g => g.utilization > 75).length} gudang > 75%`,
                    grad1: 'from-sky-500/15', grad2: 'via-sky-500/5',
                    dot: 'bg-sky-400/20',
                  },
                  {
                    label: 'Slow Moving', numValue: slowPct, suffix: '%', icon: AlertTriangle,
                    accent: 'amber', desc: `${movementSummary.slow} dari ${movementSummary.total} item`,
                    grad1: 'from-amber-500/15', grad2: 'via-amber-500/5',
                    dot: 'bg-amber-400/20',
                  },
                ];

                const accentStyles: Record<string, { ring: string; text: string; iconBg: string; iconRing: string; borderGlow: string; via: string }> = {
                  indigo: { ring: 'hover:ring-indigo-400/25', text: 'text-indigo-600', iconBg: 'bg-indigo-500', iconRing: 'ring-indigo-400/30', borderGlow: 'shadow-indigo-500/10', via: 'via-indigo-400/40' },
                  emerald: { ring: 'hover:ring-emerald-400/25', text: 'text-emerald-600', iconBg: 'bg-emerald-500', iconRing: 'ring-emerald-400/30', borderGlow: 'shadow-emerald-500/10', via: 'via-emerald-400/40' },
                  sky: { ring: 'hover:ring-sky-400/25', text: 'text-sky-600', iconBg: 'bg-sky-500', iconRing: 'ring-sky-400/30', borderGlow: 'shadow-sky-500/10', via: 'via-sky-400/40' },
                  amber: { ring: 'hover:ring-amber-400/25', text: 'text-amber-600', iconBg: 'bg-amber-500', iconRing: 'ring-amber-400/30', borderGlow: 'shadow-amber-500/10', via: 'via-amber-400/40' },
                };

                return cards.map((item, i) => {
                  const s = accentStyles[item.accent];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 28, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.6, ease: easeOut }}
                      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.3, ease: easeOut } }}
                      className={`relative bg-white border border-slate-200/70 rounded-2xl overflow-hidden group cursor-default ${s.ring} hover:border-transparent hover:shadow-xl ${s.borderGlow} transition-all duration-300`}
                    >
                      {/* Gradient splash */}
                      <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${item.grad1} ${item.grad2} to-transparent blur-3xl pointer-events-none transition-all duration-700 group-hover:scale-150 group-hover:opacity-100`} />

                      {/* Dot pattern background */}
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
                        backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
                        backgroundSize: '16px 16px',
                        color: item.accent === 'indigo' ? '#6366f1' : item.accent === 'emerald' ? '#10b981' : item.accent === 'sky' ? '#0ea5e9' : '#f59e0b',
                      }} />

                      {/* Decorative ghost icon */}
                      <div className={`absolute -bottom-5 -right-5 opacity-[0.04] pointer-events-none transition-all duration-500 group-hover:opacity-[0.08] group-hover:scale-110`}>
                        <item.icon size={90} />
                      </div>

                      {/* Top accent glow bar */}
                      <div className={`absolute top-0 left-4 right-4 h-0.5 rounded-full bg-gradient-to-r from-transparent ${s.via} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                      <div className="relative p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.12em]">{item.label}</span>
                            <div className="flex items-baseline gap-1">
                              <span className={`text-3xl font-extrabold tracking-tight tabular-nums ${s.text}`}>
                                <AnimatedCounter value={item.numValue} suffix={item.suffix} />
                              </span>
                            </div>
                          </div>
                          <div className={`w-11 h-11 rounded-xl ${s.iconBg} flex items-center justify-center shadow-lg shadow-black/5 ring-1 ${s.iconRing} ring-inset transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-xl`}>
                            <item.icon size={18} className="text-white" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                          <p className="text-[11px] font-medium text-slate-400">{item.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                });
              })()}
            </div>

            {/* Capacity Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.55, ease: easeOut }}
              className="relative bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden group/section"
            >
              {/* Gradient splash */}
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/8 via-indigo-500/4 to-transparent blur-3xl pointer-events-none" />

              {/* Dot pattern */}
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }} />

              {/* Top accent glow */}
              <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Capacity Analysis</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Stock vs Kapasitas per Gudang</p>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 bg-slate-100/80 px-2.5 py-1 rounded-lg cursor-default">Klik kapasitas untuk edit</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gudang</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Items</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kapasitas</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilisasi</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progres</th>
                        <th className="text-right px-6 py-3.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gudangData.map((g, i) => {
                        const isHigh = g.utilization > 90;
                        const isMid = g.utilization > 75;
                        const barColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-emerald-500';
                        const dotColor = isHigh ? 'bg-red-500' : isMid ? 'bg-amber-500' : 'bg-emerald-500';
                        const textColor = isHigh ? 'text-red-600' : isMid ? 'text-amber-600' : 'text-emerald-600';
                        const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30';
                        return (
                          <motion.tr
                            key={g.name}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.25 + i * 0.04, duration: 0.4, ease: easeOut }}
                            className={`${rowBg} hover:bg-indigo-50/40 transition-colors duration-200 group/row`}
                          >
                            <td className="px-6 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`w-2 h-2 rounded-full ${dotColor} ring-2 ring-inset ring-white shadow-sm`} />
                                <span className="font-semibold text-slate-800 text-[13px]">{g.name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="text-slate-500 text-[13px] font-medium">{g.items}</span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className="font-semibold text-slate-700 text-[13px] tabular-nums">
                                {g.stock.toFixed(0)}
                                {g.warning && <span className="ml-1.5 text-[10px] text-red-400 font-bold" title="Nilai tonase tidak wajar">⚠</span>}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              {editing === g.name ? (
                                <form
                                  onSubmit={e => { e.preventDefault(); saveCapacity(g.name, parseFloat(editValue) || 0); setEditing(null); }}
                                  className="flex items-center justify-end gap-1"
                                >
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    autoFocus
                                    className="w-20 text-right text-xs font-semibold bg-white border border-indigo-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-200/60"
                                  />
                                  <button type="submit" className="p-1 text-indigo-600 hover:text-indigo-700 transition-colors">
                                    <Save size={14} />
                                  </button>
                                </form>
                              ) : (
                                <button
                                  onClick={() => { setEditing(g.name); setEditValue(String(g.capacity)); }}
                                  className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition-colors font-semibold text-[13px] group/cap"
                                >
                                  <span className="tabular-nums">{g.capacity.toFixed(0)}</span>
                                  <Edit3 size={11} className="text-slate-300 group-hover/cap:text-indigo-400 transition-colors" />
                                </button>
                              )}
                            </td>
                            <td className={`px-6 py-3.5 text-right font-bold text-[13px] tabular-nums ${textColor}`}>
                              {g.utilization}%
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(g.utilization, 100)}%` }}
                                    transition={{ delay: 0.35 + i * 0.04, duration: 0.8, ease: easeOut }}
                                    className={`h-full rounded-full ${barColor} transition-all`}
                                  />
                                </div>
                              </div>
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
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart - Stock vs Kapasitas */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.55, ease: easeOut }}
                className="relative bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden group/section"
              >
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-indigo-500/8 via-indigo-500/4 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                  backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`,
                  backgroundSize: '16px 16px',
                }} />
                <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />

                <div className="relative">
                  <div className="px-6 py-4 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stock vs Kapasitas</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Perbandingan stok aktual dengan kapasitas (ton)</p>
                  </div>
                  <div className="px-5 pt-5 pb-4">
                    <div style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gudangData} margin={{ top: 5, right: 20, left: -15, bottom: 5 }}>
                          <defs>
                            {['red', 'amber', 'emerald'].map(color => (
                              <linearGradient key={color} id={`stockGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#10b981'} stopOpacity={0.9} />
                                <stop offset="100%" stopColor={color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#10b981'} stopOpacity={0.55} />
                              </linearGradient>
                            ))}
                            <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#cbd5e1" stopOpacity={1} />
                              <stop offset="100%" stopColor="#e2e8f0" stopOpacity={0.8} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} interval={0} angle={-20} textAnchor="end" height={50} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 500 }} />
                          <Tooltip
                            content={({ active, payload }) => active && payload?.[0] ? (
                              <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-slate-200/70 text-xs min-w-[180px]">
                                <div className="flex items-center justify-between mb-2.5">
                                  <p className="font-bold text-slate-700 text-[13px]">{payload[0].payload.name}</p>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    payload[0].payload.utilization > 90 ? 'bg-red-50 text-red-600' :
                                    payload[0].payload.utilization > 75 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                  }`}>{payload[0].payload.utilization}%</span>
                                </div>
                                <div className="space-y-1.5">
                                  {payload.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between gap-6">
                                      <span className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                                        <span className="text-slate-500 font-medium">{p.name}</span>
                                      </span>
                                      <span className="font-bold text-slate-900 tabular-nums">{Number(p.value).toFixed(0)} T</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          />
                          <Bar dataKey="capacity" name="Kapasitas" radius={[4, 4, 0, 0]} barSize={22} fill="url(#capGrad)" fillOpacity={1} animationBegin={200} />
                          <Bar dataKey="stock" name="Stock" radius={[4, 4, 0, 0]} barSize={22} fillOpacity={0.9} animationBegin={400}>
                            {gudangData.map((entry, idx) => {
                              const barColor = entry.utilization > 90 ? 'red' : entry.utilization > 75 ? 'amber' : 'emerald';
                              return <Cell key={`cell-${idx}`} fill={`url(#stockGrad-${barColor})`} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-5 mt-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-emerald-500/85 ring-1 ring-emerald-500/20" />
                        <span className="text-[10px] font-semibold text-slate-500">Optimal</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-amber-500/85 ring-1 ring-amber-500/20" />
                        <span className="text-[10px] font-semibold text-slate-500">Warning</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-red-500/85 ring-1 ring-red-500/20" />
                        <span className="text-[10px] font-semibold text-slate-500">Critical</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-slate-200 ring-1 ring-slate-300/50" />
                        <span className="text-[10px] font-semibold text-slate-500">Kapasitas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Top 5 by Stock */}
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.35, duration: 0.55, ease: easeOut }}
                className="relative bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden group/section"
              >
                <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-500/8 via-amber-500/4 to-transparent blur-3xl pointer-events-none" />
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                  backgroundImage: `radial-gradient(circle, #f59e0b 1px, transparent 1px)`,
                  backgroundSize: '16px 16px',
                }} />
                <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />

                <div className="relative">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stok Tertinggi</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">Gudang dengan persentase stok terbesar</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100/80 px-2.5 py-1 rounded-lg">Tonase</span>
                  </div>
                  <div className="px-5 pt-4 pb-4">
                    {top5Utilization.length > 0 ? (
                      <div style={{ height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={top5Utilization} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                            <defs>
                              {['red', 'amber', 'emerald'].map(color => (
                                <linearGradient key={color} id={`topGrad-${color}`} x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor={color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#3b82f6'} stopOpacity={0.9} />
                                  <stop offset="100%" stopColor={color === 'red' ? '#ef4444' : color === 'amber' ? '#f59e0b' : '#3b82f6'} stopOpacity={0.5} />
                                </linearGradient>
                              ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} />
                            <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }} width={75} />
                            <Tooltip
                              content={({ active, payload }) => active && payload?.[0] ? (
                                <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-slate-200/70 text-xs min-w-[160px]">
                                  <div className="flex items-center justify-between mb-2.5">
                                    <p className="font-bold text-slate-700 text-[13px]">{payload[0].payload.name}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      payload[0].payload.utilization > 90 ? 'bg-red-50 text-red-600' :
                                      payload[0].payload.utilization > 75 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                                    }`}>{payload[0].payload.utilization}%</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-slate-500 font-medium">Stock</span>
                                      <span className="font-bold text-slate-900 tabular-nums">{Number(payload[0].value).toFixed(0)} T</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-slate-500 font-medium">Items</span>
                                      <span className="font-bold text-slate-900 tabular-nums">{payload[0].payload.items}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            />
                            <Bar dataKey="stock" radius={[0, 6, 6, 0]} barSize={22} fillOpacity={0.9} animationBegin={300}>
                              {top5Utilization.map((entry, idx) => {
                                const barColor = entry.utilization > 90 ? 'red' : entry.utilization > 75 ? 'amber' : 'emerald';
                                return <Cell key={`cell-${idx}`} fill={`url(#topGrad-${barColor})`} />;
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

            {/* Charts Row 2 - Donut Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ease: easeOut }}
                className="bg-white border border-slate-200/70 rounded-2xl shadow-sm"
              >
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Stock Distribution</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Proporsi stok per gudang</p>
                </div>
                <div className="px-5 pt-5 pb-4">
                  <div style={{ height: 300 }} className="relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stockDistribution}
                          cx="50%" cy="50%"
                          innerRadius={75} outerRadius={115}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {stockDistribution.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => active && payload?.[0] ? (
                            <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-slate-200/70 text-xs min-w-[150px]">
                              <p className="font-bold text-slate-700 mb-2 text-[13px]">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 font-medium">Stock</span>
                                  <span className="font-bold text-slate-900">{Number(payload[0].value).toFixed(0)} T</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 font-medium">Proporsi</span>
                                  <span className="font-bold text-slate-900">{payload[0].payload.pct}%</span>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        />
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

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, ease: easeOut }}
                className="bg-white border border-slate-200/70 rounded-2xl shadow-sm"
              >
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Movement Overview</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distribusi tipe pergerakan barang</p>
                </div>
                <div className="px-5 pt-5 pb-4">
                  <div style={{ height: 300 }} className="relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={movementTypeData}
                          cx="50%" cy="50%"
                          innerRadius={75} outerRadius={115}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {movementTypeData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => active && payload?.[0] ? (
                            <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-slate-200/70 text-xs min-w-[150px]">
                              <p className="font-bold text-slate-700 mb-2 text-[13px]">{payload[0].payload.name}</p>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 font-medium">Count</span>
                                  <span className="font-bold text-slate-900">{payload[0].value}x</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-slate-500 font-medium">Proporsi</span>
                                  <span className="font-bold text-slate-900">{payload[0].payload.pct}%</span>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        />
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
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.48, duration: 0.55, ease: easeOut }}
              className="relative bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden group/section"
            >
              <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-violet-500/8 via-violet-500/4 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, #8b5cf6 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
              }} />
              <div className="absolute top-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-violet-400/30 to-transparent opacity-0 group-hover/section:opacity-100 transition-opacity duration-500" />

              <div className="relative">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Top 5 Customer</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Customer dengan stok terbanyak</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100/80 px-2.5 py-1 rounded-lg">Tonase</span>
                </div>
                <div className="px-5 pt-4 pb-4">
                  {customerStockTop5.length > 0 ? (
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={customerStockTop5} layout="vertical" margin={{ top: 5, right: 35, left: 0, bottom: 5 }}>
                          <defs>
                            {COLORS.slice(0, 5).map((color, i) => (
                              <linearGradient key={`custGrad-${i}`} id={`custGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                                <stop offset="100%" stopColor={color} stopOpacity={0.5} />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1', fontWeight: 500 }} />
                          <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }} width={100} />
                          <Tooltip
                            content={({ active, payload }) => active && payload?.[0] ? (
                              <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-xl shadow-xl border border-slate-200/70 text-xs min-w-[160px]">
                                <div className="flex items-center justify-between mb-2.5">
                                  <p className="font-bold text-slate-700 text-[13px]">{payload[0].payload.name}</p>
                                  <span className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Customer</span>
                                </div>
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-slate-500 font-medium">Stock</span>
                                    <span className="font-bold text-slate-900 tabular-nums">{Number(payload[0].value).toFixed(1)} T</span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          />
                          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22} fillOpacity={0.9} animationBegin={300}>
                            {customerStockTop5.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={`url(#custGrad-${idx})`} />
                            ))}
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
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, ease: easeOut }}
              className="bg-white border border-slate-200/70 rounded-2xl shadow-sm"
            >
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recommendations</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Analisis dan saran tindak lanjut</p>
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
                                <p className="text-xs text-amber-600/80 leading-relaxed">
                                  Monitor ketat. Pertimbangkan rotasi stok untuk mengoptimalkan ruang penyimpanan.
                                </p>
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
                                <p className="text-xs text-emerald-600/80 leading-relaxed">
                                  Kapasitas tersedia. Dapat digunakan untuk konsolidasi stok dari gudang lain.
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">Ringkasan</p>
                        <ul className="space-y-2 text-xs text-slate-600">
                          <li className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            Total slow-moving: <strong>{Math.round((movementSummary.slow / movementSummary.total) * 100)}%</strong> dari seluruh transaksi
                          </li>
                          <li className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            Evaluasi item slow-moving untuk <strong>write-off</strong> atau promosi
                          </li>
                          <li className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            Optimalkan alokasi fast-moving items ke gudang dengan akses cepat
                          </li>
                          <li className="flex items-center gap-2.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
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
    </div>
  );
}
