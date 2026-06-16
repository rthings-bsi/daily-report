'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowDownRight, MapPin, Truck, X,
  Hash, Factory, Building2,
  Loader2, ChevronDown, Circle,
  Zap, Compass, Route,
  Dot, Radio,
  Package, Bolt,
  FileSearch, Award,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import type { ProcessedMovement, StockCardItem } from '@/lib/excel-parser';
import { getMovementInfo } from '@/lib/sap-mapping';
import { getUserGudang, filterByGudang, removeInternalTfSloc, reclassify311, classifyBatch } from '@/lib/gudang';

/* ══════════════════════════════════════════
   PALETTE Gen Z: #2C5EAD · #1591DC · #4BB8FA · #C4E2F5
   ══════════════════════════════════════════ */
const C = {
  deep: '#2C5EAD',
  bold: '#1591DC',
  light: '#4BB8FA',
  soft: '#C4E2F5',
} as const;

const tw = {
  bg: 'bg-[#C4E2F5]/30',
  card: 'bg-white/85 backdrop-blur-xl',
  border: 'border-[#C4E2F5]/50',
  borderHover: 'hover:border-[#4BB8FA]/40',
  text: 'text-[#2C5EAD]',
  textBody: 'text-[#1a3a6e]',
  textMuted: 'text-[#1591DC]/70',
  textLight: 'text-[#4BB8FA]',
  gradient: 'from-[#1591DC] to-[#2C5EAD]',
  gradientReversed: 'from-[#2C5EAD] to-[#1591DC]',
  gradientLight: 'from-[#4BB8FA] to-[#1591DC]',
  gradientBg: 'from-[#C4E2F5]/40 via-white to-[#C4E2F5]/30',
  glow: 'shadow-[#1591DC]/20',
  glowIntense: 'shadow-[#1591DC]/35',
  ring: 'ring-[#4BB8FA]/40',
  badge: 'bg-[#1591DC]/10 text-[#1591DC] border-[#4BB8FA]/20',
};

// ─── Types ───
interface MaterialItem {
  materialNumber?: string;
  batch: string;
  quantity: number;
  unitQuantity: number;
  workCenter: string;
  movementStatus: string;
  storageLocation?: string;
}
interface DestinationEntry {
  moveType: string;
  moveDescription: string;
  destination: string;
  quantity: number;
  count: number;
  color: string;
  materials: MaterialItem[];
}
interface MvtGroup {
  moveType: string;
  description: string;
  color: string;
  totalQuantity: number;
  totalCount: number;
  items: DestinationEntry[];
}

// ─── Compute ───
function computeOutboundBreakdown(
  movements: ProcessedMovement[],
  stockCards: StockCardItem[]
): { groups: MvtGroup[]; totalQuantity: number; totalCount: number; uniqueDestinations: number } {
  const b2c = new Map<string, string>();
  for (const sc of stockCards) { if (sc.batch && !b2c.has(sc.batch)) b2c.set(sc.batch, sc.customer || ''); }
  const resolve = (m: ProcessedMovement): string => {
    switch (m.moveType) {
      case '261': return m.workCenter || 'Unknown WC';
      case '601': return b2c.get(m.batch) || 'Unknown Customer';
      case '311': case '321': return m.storageLocation || 'Unknown SLOC';
      case '551': return 'Scrap'; default: return 'Lainnya';
    }
  };
  const dm = new Map<string, DestinationEntry>();
  let tq = 0, tc = 0;
  for (const m of movements) {
    const dest = resolve(m); const q = Math.abs(m.quantity); const info = getMovementInfo(m.moveType);
    const key = `${m.moveType}|${dest}|${info.description}`; tq += q; tc += 1;
    const mat: MaterialItem = { materialNumber: m.material, batch: m.batch, quantity: q, unitQuantity: m.unitQuantity, workCenter: m.workCenter, movementStatus: m.movementStatus, storageLocation: m.storageLocation };
    if (dm.has(key)) { const e = dm.get(key)!; e.quantity += q; e.count += 1; e.materials.push(mat); }
    else dm.set(key, { moveType: m.moveType, moveDescription: info.description, destination: dest, quantity: q, count: 1, color: info.color, materials: [mat] });
  }
  const gm = new Map<string, DestinationEntry[]>();
  const si = Array.from(dm.values()).sort((a, b) => a.moveType !== b.moveType ? a.moveType.localeCompare(b.moveType) : b.quantity - a.quantity);
  for (const i of si) { if (!gm.has(i.moveType)) gm.set(i.moveType, []); gm.get(i.moveType)!.push(i); }
  return {
    groups: Array.from(gm.entries()).map(([mt, items]) => { const info = getMovementInfo(mt); return { moveType: mt, description: info.description, color: info.color, totalQuantity: items.reduce((s, i) => s + i.quantity, 0), totalCount: items.reduce((s, i) => s + i.count, 0), items }; }),
    totalQuantity: tq, totalCount: tc, uniqueDestinations: new Set(si.map(i => i.destination)).size,
  };
}

const MVT_ICONS: Record<string, React.ReactNode> = {
  '261': <Factory size={14} />, '601': <Building2 size={14} />,
  '311': <Route size={14} />, '321': <Route size={14} />, '551': <Zap size={14} />,
};

const spring = { type: 'spring' as const, stiffness: 200, damping: 22, mass: 0.8 };
const springBouncy = { type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.7 };
const springGentle = { type: 'spring' as const, stiffness: 140, damping: 20, mass: 0.95 };
export const dynamic = 'force-dynamic';

// ─── Page ───
function OutboundDestinationContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('reportSessionId');
  const initialGudang = searchParams.get('gudang');
  const initialStart = searchParams.get('start');
  const initialEnd = searchParams.get('end');

  const [movements, setMovements] = useState<ProcessedMovement[]>([]);
  const [stockCards, setStockCards] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(initialGudang ? Number(initialGudang) : null);
  const [startDate, setStartDate] = useState(initialStart || '');
  const [endDate, setEndDate] = useState(initialEnd || '');
  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (t: string) => setCollapsedGroups(p => { const n = new Set(p); n.has(t) ? n.delete(t) : n.add(t); return n; });
  const [expandedDest, setExpandedDest] = useState<Set<string>>(new Set());
  const toggleDest = (k: string) => setExpandedDest(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'admin' && session.user.gudangId) {
        setSelectedGudang(session.user.gudangId);
      }
    }
  }, [status, session]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login'); }, [status, router]);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/reports/${sessionId}`)
      .then(r => r.json())
      .then((data: any) => {
        setMovements((data.movements || []).map((m: any) => ({
          movementId: m.movementId || `m-${Math.random()}`,
          postingDate: new Date(m.postingDate), dateStr: m.dateStr,
          moveType: m.moveType, description: m.description,
          material: m.material || undefined, workCenter: m.workCenter || '',
          batch: m.batch || '', quantity: m.quantity || 0,
          unitQuantity: m.unitQuantity || 0, userName: m.userName || '',
          storageLocation: m.storageLocation || '', group: m.group || 'Transfer',
          color: m.color || '#94a3b8', movementStatus: classifyBatch(m.batch || ''),
        })));
        setStockCards(data.stockCards || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  const filteredMovements = useMemo(() => {
    let r = movements;
    if (selectedGudang) r = reclassify311(filterByGudang(removeInternalTfSloc(r), selectedGudang), selectedGudang);
    if (startDate) r = r.filter(m => m.dateStr >= startDate);
    if (endDate) r = r.filter(m => m.dateStr <= endDate);
    return r;
  }, [movements, selectedGudang, startDate, endDate]);

  const outboundMovements = useMemo(() => filteredMovements.filter(m => m.group === 'Keluar'), [filteredMovements]);
  const breakdown = useMemo(() => computeOutboundBreakdown(outboundMovements, stockCards), [outboundMovements, stockCards]);

  const goBack = useCallback(() => {
    const p = new URLSearchParams();
    if (sessionId) p.set('reportSessionId', sessionId);
    router.push(`/?${p.toString()}`);
  }, [sessionId, router]);

  // ── LOADING ──
  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} flex items-center justify-center`}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="flex flex-col items-center gap-6">
          <div className="relative">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4BB8FA] to-[#2C5EAD] flex items-center justify-center shadow-xl shadow-[#1591DC]/30">
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
              <Loader2 size={26} className="text-white animate-spin" strokeWidth={2} />
            </motion.div>
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -inset-2 rounded-2xl bg-[#4BB8FA]/25 blur-xl -z-10" />
          </div>
          <div className="text-center">
            <motion.p animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
              className="text-sm font-bold text-[#2C5EAD]">Loading Destinasi</motion.p>
            <p className="text-xs text-[#1591DC]/60 mt-1">Mengambil data outbound • • •</p>
          </div>
        </motion.div>
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  // ── EMPTY ──
  if (!sessionId || (!loading && outboundMovements.length === 0)) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} flex items-center justify-center p-6`}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={springBouncy} className="relative max-w-sm w-full">
          <div className="absolute -inset-4 bg-gradient-to-r from-[#4BB8FA]/15 to-[#1591DC]/15 rounded-3xl blur-3xl" />
          <div className="relative bg-white/80 backdrop-blur-xl border border-[#C4E2F5]/50 rounded-3xl p-8 text-center shadow-xl shadow-[#1591DC]/10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.15 }} className="relative mx-auto mb-5 w-fit">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20 flex items-center justify-center border border-[#C4E2F5]/50">
                <Compass size={34} className="text-[#1591DC]" strokeWidth={1.5} />
              </div>
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-[#1591DC] rounded-full flex items-center justify-center text-[10px] font-bold text-white">!</motion.span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h2 className="text-lg font-bold text-[#2C5EAD] mb-1">No Outbound Data</h2>
              <p className="text-sm text-[#1591DC]/70 leading-relaxed flex items-center gap-1.5">
                <FileSearch size={14} className="shrink-0 text-[#4BB8FA]" strokeWidth={2} />
                {sessionId ? 'Belum ada transaksi keluar buat filter ini. Coba ganti gudang atau tanggalnya~' : 'Pilih laporan dari dashboard buat lihat breakdown destinasi keluar.'}
              </p>
            </motion.div>
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(21,145,220,0.35)' }} whileTap={{ scale: 0.97 }}
              onClick={goBack}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] hover:from-[#4BB8FA] hover:to-[#1591DC] text-white rounded-xl text-sm font-semibold shadow-lg shadow-[#1591DC]/25 active:scale-[0.97] transition-all">
              <ArrowLeft size={14} strokeWidth={2.5} />
              Kembali ke Dashboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── DATA ──
  return (
    <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} selection:bg-[#4BB8FA]/25 selection:text-[#2C5EAD]`}>

      {/* ═══════ HEADER ═══════ */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={springGentle}
        className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-[#C4E2F5]/60 shadow-sm shadow-[#1591DC]/8">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">

            <div className="flex items-center gap-3 min-w-0">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                onClick={goBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/70 border border-[#C4E2F5]/50 text-[#1591DC] hover:text-[#2C5EAD] hover:border-[#4BB8FA]/40 hover:shadow-sm hover:shadow-[#1591DC]/10 transition-all shrink-0">
                <ArrowLeft size={15} strokeWidth={2.5} />
              </motion.button>
              <div className="flex items-center gap-3 min-w-0">
                <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={springBouncy}
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4BB8FA] to-[#2C5EAD] flex items-center justify-center shadow-lg shadow-[#1591DC]/25 shrink-0 relative">
                  <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                  <ArrowDownRight size={16} className="text-white relative" strokeWidth={2.5} />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-bold text-[#2C5EAD] truncate">Outbound Destination</h1>
                  </div>
                  <p className="text-[10px] text-[#1591DC]/60 font-medium leading-tight flex items-center gap-1">
                    <Dot size={8} className="text-[#4BB8FA]" />
                    Breakdown tujuan material keluar
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {session?.user?.role === 'admin' && (
                <motion.select whileFocus={{ scale: 1.02 }}
                  value={selectedGudang ?? ''}
                  onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-[11px] font-semibold text-[#2C5EAD] bg-white/70 border border-[#C4E2F5]/50 rounded-xl px-2.5 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/25 cursor-pointer hover:bg-white transition-all">
                  <option value="">🌐 Semua Gudang</option>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>📍 Gudang {n}{n === sessionGudang ? ' ★' : ''}</option>
                  ))}
                </motion.select>
              )}

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-white/70 border border-[#C4E2F5]/50 rounded-xl px-2 py-0.5 gap-1">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="h-7 text-[10px] font-medium text-[#2C5EAD] bg-transparent border-none outline-none w-24 lg:w-28 cursor-pointer [color-scheme:light]" />
                  <span className="text-[9px] text-[#4BB8FA] font-semibold">→</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="h-7 text-[10px] font-medium text-[#2C5EAD] bg-transparent border-none outline-none w-24 lg:w-28 cursor-pointer [color-scheme:light]" />
                </div>
                {(startDate || endDate) && (
                  <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.85 }}
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-[#1591DC] hover:text-[#2C5EAD] hover:bg-white/60 transition-all">
                    <X size={12} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ═══════ MAIN ═══════ */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ─── Bento Stats ─── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="grid grid-cols-3 gap-3 sm:gap-4">
          {([
            { title: 'Total Outbound', val: breakdown.totalQuantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unit: 'TON', sub: `${breakdown.totalCount} transaksi keluar`, type: 'out' as const, hue: '#2C5EAD' },
            { title: 'Total Transaksi', val: breakdown.totalCount.toLocaleString('id-ID'), unit: 'TRX', sub: 'Total transaksi outbound', type: 'total' as const, hue: '#1591DC' },
            { title: 'Destinasi Unik', val: breakdown.uniqueDestinations.toLocaleString('id-ID'), unit: 'TUJUAN', sub: 'Destinasi pengiriman unik', type: 'in' as const, hue: '#4BB8FA' },
          ]).map((card, i) => (
            <motion.div key={card.title} whileHover={{ y: -3, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="relative group">
              <div className="absolute -inset-1 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(135deg, ${card.hue}20, transparent 60%)` }} />
              <StatsCard title={card.title} value={card.val} unit={card.unit} subtitle={card.sub} type={card.type} delay={0.05 + i * 0.05} condensed />
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Breakdown ─── */}
        <AnimatePresence mode="wait">
          {breakdown.groups.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-[#C4E2F5]/50 shadow-sm flex items-center justify-center">
                <MapPin size={28} className="text-[#4BB8FA]/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-[#2C5EAD]">No Data</p>
              <p className="text-xs text-[#1591DC]/60 mt-0.5">Coba ubah filter gudang atau tanggalnya~</p>
            </motion.div>
          ) : (
            <div className="space-y-3">

              {/* Section flair */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-[#C4E2F5]/50 shadow-sm">
                  <Radio size={10} className="text-[#1591DC]" strokeWidth={2.5} />
                  <span className="text-[9px] font-bold text-[#2C5EAD] uppercase tracking-widest">Breakdown per Movement</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-[#4BB8FA]/30 via-[#1591DC]/15 to-transparent" />
                <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={springBouncy}
                  className="text-[9px] font-bold text-[#1591DC] bg-white/70 px-2 py-0.5 rounded-full border border-[#C4E2F5]/50 tabular-nums shadow-sm">
                  {breakdown.groups.length} grup
                </motion.span>
              </motion.div>

              {breakdown.groups.map((group, groupIdx) => {
                const GroupIcon = MVT_ICONS[group.moveType] || <Truck size={14} />;
                return (
                  <motion.div key={group.moveType}
                    initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: groupIdx * 0.07, ...spring }}>
                    <div className="relative group/card">
                      <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 blur-lg"
                        style={{ background: `linear-gradient(135deg, ${group.color}15, transparent 60%)` }} />

                      <div className="relative bg-white/85 backdrop-blur-xl rounded-2xl border border-[#C4E2F5]/50 shadow-md shadow-[#1591DC]/5 hover:shadow-xl hover:shadow-[#1591DC]/10 transition-all duration-300 overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

                        {/* ─── Group Header ─── */}
                        <button onClick={() => toggleGroup(group.moveType)}
                          className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 relative">
                          <div className="flex items-center gap-3 min-w-0">
                            <motion.div whileHover={{ scale: 1.1, rotate: -5 }}
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-[#C4E2F5]/30"
                              style={{ background: `linear-gradient(135deg, ${group.color}15, ${group.color}05)` }}>
                              <motion.div animate={collapsedGroups.has(group.moveType) ? {} : { y: [0, -2, 0] }}
                                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }} style={{ color: group.color }}>
                                {GroupIcon}
                              </motion.div>
                            </motion.div>
                            <div className="text-left min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <motion.span whileHover={{ scale: 1.05 }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold leading-none shadow-sm text-white"
                                  style={{ background: `linear-gradient(135deg, ${group.color}, ${group.color}dd)` }}>
                                  {group.moveType}
                                </motion.span>
                                <span className="text-[13px] font-bold text-[#2C5EAD] truncate tracking-tight">{group.description}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 h-1 rounded-full bg-[#C4E2F5]/40 overflow-hidden max-w-[120px]">
                                  <motion.div initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (group.items.length / Math.max(...breakdown.groups.map(g => g.items.length))) * 100)}%` }}
                                    transition={{ delay: groupIdx * 0.1, duration: 0.6 }}
                                    className="h-full rounded-full opacity-60" style={{ backgroundColor: group.color }} />
                                </div>
                                <span className="text-[8px] font-semibold text-[#1591DC]/60">{group.items.length} tujuan</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="hidden sm:flex items-center gap-1.5">
                              <span className="text-[11px] font-black text-[#2C5EAD] tabular-nums">
                                {group.totalQuantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>
                              <span className="text-[9px] font-semibold text-[#1591DC]/60">TON</span>
                            </div>
                            <div className="hidden sm:block w-px h-5 bg-[#C4E2F5]/50" />
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#1591DC] bg-[#C4E2F5]/20 px-2 py-0.5 rounded-lg tabular-nums border border-[#C4E2F5]/50">
                              <Hash size={9} className="text-[#4BB8FA]" strokeWidth={2.5} />
                              {group.totalCount}
                            </span>
                            <motion.div animate={{ rotate: collapsedGroups.has(group.moveType) ? 0 : 180 }}
                              transition={{ duration: 0.3, ease: 'easeInOut' }}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-[#C4E2F5]/20 text-[#1591DC]">
                              <ChevronDown size={12} strokeWidth={2.5} />
                            </motion.div>
                          </div>
                        </button>

                        {/* ─── Destination Rows ─── */}
                        <AnimatePresence>
                          {!collapsedGroups.has(group.moveType) && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                              <div className="border-t border-[#C4E2F5]/40 mx-4 sm:mx-5" />
                              {group.items.length === 0 ? (
                                <div className="px-5 py-8 text-center"><p className="text-xs text-[#1591DC]/60">Belum ada destinasi buat grup ini.</p></div>
                              ) : (
                                <div className="py-1">
                                  {group.items.map((item, itemIdx) => {
                                    const destKey = `${group.moveType}|${item.destination}`;
                                    const isExpanded = expandedDest.has(destKey);
                                    const pct = group.totalQuantity > 0 ? ((item.quantity / group.totalQuantity) * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0.0';
                                    const isTop3 = itemIdx < 3;
                                    const ranks = [
                                      <Award size={11} className="text-amber-500" fill="#f59e0b" strokeWidth={1.5} />,
                                      <Award size={11} className="text-slate-400" fill="#94a3b8" strokeWidth={1.5} />,
                                      <Award size={11} className="text-amber-700" fill="#d97706" strokeWidth={1.5} />,
                                    ];
                                    return (
                                      <motion.div key={destKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: itemIdx * 0.02 }}>
                                        <motion.button whileTap={{ scale: 0.99 }}
                                          onClick={() => toggleDest(destKey)}
                                          className="w-full flex items-center gap-2.5 px-4 sm:px-5 py-3 hover:bg-gradient-to-r hover:from-[#C4E2F5]/30 hover:to-[#4BB8FA]/10 transition-all duration-150 group/row text-left relative">
                                          <span className="w-6 text-center shrink-0 tabular-nums">
                                            {isTop3 ? <span className="inline-flex items-center justify-center w-5 h-5">{ranks[itemIdx]}</span> : <span className="text-[9px] font-bold text-[#4BB8FA]">{itemIdx + 1}</span>}
                                          </span>
                                          <div className="relative shrink-0">
                                            <Circle size={8} fill={group.color} className="text-transparent" strokeWidth={0} />
                                            <span className="absolute inset-0 rounded-full animate-ping opacity-25" style={{ backgroundColor: group.color }} />
                                          </div>
                                          <span className="text-[12px] font-bold text-[#1a3a6e] flex-1 min-w-0 truncate leading-tight group-hover/row:text-[#2C5EAD] transition-colors">
                                            {item.destination}
                                          </span>
                                          <div className="hidden sm:block w-16 lg:w-24 h-1.5 rounded-full overflow-hidden shrink-0 bg-[#C4E2F5]/40">
                                            <motion.div initial={{ width: 0 }}
                                              animate={{ width: `${Math.min(100, parseFloat(pct.replace(',', '.')))}%` }}
                                              transition={{ delay: itemIdx * 0.03, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                              className="h-full rounded-full" style={{ backgroundColor: group.color }} />
                                          </div>
                                          <span className="text-[11px] font-black text-[#2C5EAD] tabular-nums shrink-0 w-16 text-right">
                                            {item.quantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                          </span>
                                          <motion.span whileHover={{ scale: 1.15 }}
                                            className="text-[8px] font-bold shrink-0 px-1.5 py-0.5 rounded-lg tabular-nums min-w-[24px] text-center border"
                                            style={{ backgroundColor: `${group.color}10`, color: group.color, borderColor: `${group.color}20` }}>
                                            {item.count}x
                                          </motion.span>
                                          <span className="text-[10px] font-bold tabular-nums shrink-0 min-w-[36px] text-right px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: isTop3 ? `${group.color}12` : `${group.color}06`, color: group.color }}>
                                            {pct}%
                                          </span>
                                          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                            <ChevronDown size={10} strokeWidth={2.5} className="text-[#4BB8FA]" />
                                          </motion.div>
                                        </motion.button>

                                        <AnimatePresence>
                                          {isExpanded && item.materials.length > 0 && (
                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
                                              <div className="mx-4 sm:mx-6 bg-gradient-to-br from-[#C4E2F5]/30 via-white to-[#4BB8FA]/10 rounded-xl border border-[#C4E2F5]/40 mb-2">
                                                <div className="px-4 py-3">
                                                  <div className="grid grid-cols-5 gap-2 text-[8px] font-bold text-[#1591DC] uppercase tracking-widest mb-2 px-1">
                                                    <span>Kode</span><span>Batch</span><span className="text-right">Qty</span><span className="text-right">Ton</span><span className="text-right">Status</span>
                                                  </div>
                                                  <div className="space-y-1">
                                                    {item.materials.map((mat, mi) => (
                                                      <motion.div key={mi} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: mi * 0.03 }}
                                                        className="grid grid-cols-5 gap-2 items-center px-2 py-1.5 rounded-lg text-[11px] hover:bg-white/60 transition-colors">
                                                        <span className="font-mono font-bold text-[#2C5EAD] truncate text-[10px]" title={mat.materialNumber}>{mat.materialNumber || '—'}</span>
                                                        <span className="font-mono font-medium text-[#1591DC]/70 truncate text-[10px]">{mat.batch || '—'}</span>
                                                        <span className="text-right font-semibold text-[#2C5EAD] tabular-nums text-[10px]">{mat.unitQuantity.toLocaleString('id-ID')}</span>
                                                        <span className="text-right font-bold text-[#2C5EAD] tabular-nums text-[10px]">{mat.quantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                                        <span className="text-right">
                                                          <span className={`inline-flex items-center justify-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full min-w-[36px] border ${
                                                            mat.movementStatus === 'Fast'
                                                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200/50'
                                                              : mat.movementStatus === 'Slow'
                                                              ? 'bg-amber-50 text-amber-600 border-amber-200/50'
                                                              : 'bg-slate-100 text-slate-500 border-slate-200/50'
                                                          }`}>
                                                            {mat.movementStatus === 'Fast' && <Bolt size={9} strokeWidth={2.5} />}
                                                            {mat.movementStatus === 'Slow' && <Package size={9} strokeWidth={2.5} />}
                                                            {mat.movementStatus || '—'}
                                                          </span>
                                                        </span>
                                                      </motion.div>
                                                    ))}
                                                  </div>
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function OutboundDestinationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#C4E2F5]/40 via-white to-[#C4E2F5]/30 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
          <Loader2 size={26} className="text-[#1591DC]" strokeWidth={2} />
        </motion.div>
      </div>
    }>
      <OutboundDestinationContent />
    </Suspense>
  );
}
