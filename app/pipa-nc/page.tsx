'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Package, X, Hash,
  Loader2, ChevronDown, Circle,
  Dot, Radio,
  FileSearch, Award,
  GripVertical,
} from 'lucide-react';
import { StatsCard } from '@/components/StatsCard';
import type { StockCardItem } from '@/lib/excel-parser';

/* ══════════════════════════════════════════
   PALETTE Pipa NC: Indigo / Violet
   ══════════════════════════════════════════ */
const tw = {
  bg: 'bg-indigo-50/40',
  card: 'bg-white/85 backdrop-blur-xl',
  border: 'border-indigo-200/50',
  borderHover: 'hover:border-indigo-400/40',
  text: 'text-indigo-800',
  textBody: 'text-[#3730a3]',
  textMuted: 'text-indigo-600/70',
  textLight: 'text-indigo-400',
  gradient: 'from-indigo-500 to-indigo-700',
  gradientReversed: 'from-indigo-700 to-indigo-500',
  gradientLight: 'from-indigo-400 to-indigo-500',
  gradientBg: 'from-indigo-50/60 via-white to-indigo-50/40',
  glow: 'shadow-indigo-500/20',
  glowIntense: 'shadow-indigo-500/35',
  ring: 'ring-indigo-400/40',
  badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-300/20',
};

const spring = { type: 'spring' as const, stiffness: 200, damping: 22, mass: 0.8 };
const springBouncy = { type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.7 };
const springGentle = { type: 'spring' as const, stiffness: 140, damping: 20, mass: 0.95 };
export const dynamic = 'force-dynamic';

// ─── Filter: batch ending with C or E ───
function isPipaNC(batch: string): boolean {
  const trimmed = batch.trim().toUpperCase();
  return trimmed.endsWith('C') || trimmed.endsWith('E');
}

// ─── Split No NC → No NC (angka/romawi/digit/tahun) + Keterangan NC (sisanya) ───
function splitNoNC(custRemark: string): { noNC: string; keterangan: string } {
  const trimmed = custRemark.trim();
  // Format: angka/(kode)/bulan(romawi|digit)(/tahun?) — separator boleh / atau - dengan spasi opsional
  // Contoh: 185/NCR-SKF/V/2026, 92/RCR-SKF/1-2026, 198 / NCR-SKF / I / 2024
  const match =
    // Format 1 (ada kode tambahan): 185/NCR-SKF/V/2026, 198 / NCR-SKF / I / 2024
    trimmed.match(/^(\d+\s*\/\s*[A-Za-z0-9\-\s.]+\s*\/\s*[IVXLCDM\d]+\s*(?:[\/-]\s*\d{4}|$))\s*(.*)$/i) ||
    // Format 2 (minimal): 237/IV/2026, 199/III/2026
    trimmed.match(/^(\d+\s*\/\s*[IVXLCDM\d]+\s*(?:[\/-]\s*\d{4}|$))\s*(.*)$/i);
  if (match) {
    let noNC = match[1].replace(/\s*\/\s*/g, '/').replace(/\./g, '-');
    // Kalau format minimal (angka/romawi/tahun tanpa kode), tambahkan NCR-SKF/
    if (/^\d+\/(?:[IVXLCDM\d]+)/.test(noNC)) {
      noNC = noNC.replace(/^(\d+)\//, '$1/NCR-SKF/');
    }
    return { noNC, keterangan: (match[2] || '').trim().replace(/^[\/\-_]\s*/, '') };
  }
  // Kalau gak cocok, seluruhnya masuk keterangan
  return { noNC: '', keterangan: trimmed };
}

function PipaNCContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGudang = searchParams.get('gudangId') || searchParams.get('gudang');

  const [stockCards, setStockCards] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(initialGudang ? Number(initialGudang) : null);
  const sessionGudang = useMemo(() => {
    if (!session?.user?.name) return null;
    const g = session.user.name.match(/GUDANG\s*(\d+)/i);
    return g ? parseInt(g[1], 10) : null;
  }, [session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'admin' && session.user.gudangId && selectedGudang === null) {
        Promise.resolve().then(() => setSelectedGudang(session.user.gudangId!));
      }
    }
  }, [status, session, selectedGudang]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    let active = true;
    if (status !== 'authenticated') return;

    if (!loading) {
      Promise.resolve().then(() => setLoading(true));
    }

    const params = new URLSearchParams();
    if (selectedGudang) params.set('gudangId', String(selectedGudang));
    const url = `/api/reports/aggregate?${params.toString()}`;

    let cancelled = false;

    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to fetch data');
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          throw new Error('Parse error');
        }
      })
      .then((data: any) => {
        if (cancelled || !active) return;
        setStockCards(data.stockCards || []);
      })
      .catch((err) => {
        if (cancelled || !active) return;
        console.error("Fetch error:", err);
      })
      .finally(() => {
        if (!cancelled && active) setLoading(false);
      });

    return () => {
      cancelled = true;
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGudang, status]);

  // ─── Filter: batch C/E ───
  const pipaNCData = useMemo(() => {
    return stockCards
      .filter(sc => isPipaNC(sc.batch) && sc.ttlStokBom > 0)
      .sort((a, b) => {
        // Sort by SLOC then batch
        if (a.sloc !== b.sloc) return a.sloc.localeCompare(b.sloc);
        return a.batch.localeCompare(b.batch);
      });
  }, [stockCards]);

  const totalItems = pipaNCData.length;
  const gradeCCount = useMemo(() => pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('C')).length, [pipaNCData]);
  const gradeECount = useMemo(() => pipaNCData.filter(d => d.batch.trim().toUpperCase().endsWith('E')).length, [pipaNCData]);
  const totalQty = useMemo(() => pipaNCData.reduce((sum, d) => sum + d.ttlStokBom, 0), [pipaNCData]);
  const totalTonase = useMemo(() => pipaNCData.reduce((sum, d) => sum + d.ttlStokEom, 0), [pipaNCData]);

  // Group by SLOC (must be before conditional returns — React hooks rule)
  const groups = useMemo(() => {
    const map = new Map<string, StockCardItem[]>();
    for (const item of pipaNCData) {
      const key = item.sloc || 'Unknown SLOC';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [pipaNCData]);

  const goBack = useCallback(() => {
    router.push('/');
  }, [router]);

  // ── LOADING ──
  if (status === 'loading' || loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} flex items-center justify-center`}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} className="flex flex-col items-center gap-6">
          <div className="relative">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/30">
              <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
              <Loader2 size={26} className="text-white animate-spin" strokeWidth={2} />
            </motion.div>
            <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }} transition={{ repeat: Infinity, duration: 2 }}
              className="absolute -inset-2 rounded-2xl bg-indigo-400/25 blur-xl -z-10" />
          </div>
          <div className="text-center">
            <motion.p animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.5 }}
              className="text-sm font-bold text-indigo-700">Loading Data Pipa NC</motion.p>
            <p className="text-xs text-indigo-600/60 mt-1">Mengambil data stock • • •</p>
          </div>
        </motion.div>
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  // ── EMPTY ──
  if (!loading && pipaNCData.length === 0) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} flex items-center justify-center p-6`}>
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={springBouncy} className="relative max-w-sm w-full">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-400/15 to-indigo-600/15 rounded-3xl blur-3xl" />
          <div className="relative bg-white/80 backdrop-blur-xl border border-indigo-200/50 rounded-3xl p-8 text-center shadow-xl shadow-indigo-500/10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...springBouncy, delay: 0.15 }} className="relative mx-auto mb-5 w-fit">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100/50 to-indigo-400/20 flex items-center justify-center border border-indigo-200/50">
                <Package size={34} className="text-indigo-600" strokeWidth={1.5} />
              </div>
              <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">!</motion.span>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <h2 className="text-lg font-bold text-indigo-700 mb-1">Tidak Ada Data Pipa NC</h2>
              <p className="text-sm text-indigo-600/70 leading-relaxed flex items-center gap-1.5 justify-center">
                <FileSearch size={14} className="shrink-0 text-indigo-400" strokeWidth={2} />
                Belum ada data stock dengan batch berakhiran C atau E.
              </p>
            </motion.div>
            <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              whileHover={{ scale: 1.02, boxShadow: '0 8px 30px rgba(99,102,241,0.35)' }} whileTap={{ scale: 0.97 }}
              onClick={goBack}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/25 active:scale-[0.97] transition-all">
              <ArrowLeft size={14} strokeWidth={2.5} />
              Kembali ke Dashboard
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${tw.gradientBg} selection:bg-indigo-200/40 selection:text-indigo-800`}>

      {/* ═══════ HEADER ═══════ */}
      <motion.header initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={springGentle}
        className="sticky top-0 z-30 bg-white/70 backdrop-blur-2xl border-b border-indigo-200/60 shadow-sm shadow-indigo-500/8">
        <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">

            <div className="flex items-center gap-3 min-w-0">
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                onClick={goBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/70 border border-indigo-200/50 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400/40 hover:shadow-sm hover:shadow-indigo-500/10 transition-all shrink-0">
                <ArrowLeft size={15} strokeWidth={2.5} />
              </motion.button>
              <div className="flex items-center gap-3 min-w-0">
                <motion.div initial={{ rotate: -10, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={springBouncy}
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 relative">
                  <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)]" />
                  <Package size={16} className="text-white relative" strokeWidth={2.5} />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-bold text-indigo-700 truncate">Data Pipa NC</h1>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-indigo-100 text-indigo-600 border border-indigo-200/50">
                      Batch C/E
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-600/60 font-medium leading-tight flex items-center gap-1">
                    <Dot size={8} className="text-indigo-400" />
                    Stock dengan No NC di customer remark
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {session?.user?.role === 'admin' && (
                <motion.select whileFocus={{ scale: 1.02 }}
                  value={selectedGudang ?? ''}
                  onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
                  className="h-8 text-[11px] font-semibold text-indigo-700 bg-white/70 border border-indigo-200/50 rounded-xl px-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25 cursor-pointer hover:bg-white transition-all">
                  <option value="">🌐 Semua Gudang</option>
                  {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>📍 Gudang {n}{n === sessionGudang ? ' ★' : ''}</option>
                  ))}
                </motion.select>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* ═══════ MAIN ═══════ */}
      <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ─── Stats Bar ─── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="grid grid-cols-1 sm:grid-cols-5 gap-3 sm:gap-4">
          {([
            { title: 'Grade C', val: gradeCCount.toLocaleString('id-ID'), unit: 'ITEM', sub: `${gradeCCount} batch akhiran C`, type: 'in' as const, hue: '#06b6d4' },
            { title: 'Grade E', val: gradeECount.toLocaleString('id-ID'), unit: 'ITEM', sub: `${gradeECount} batch akhiran E`, type: 'out' as const, hue: '#f59e0b' },
            { title: 'Total Item', val: totalItems.toLocaleString('id-ID'), unit: 'ITEM', sub: `${pipaNCData.length} total pipa NC`, type: 'total' as const, hue: '#6366f1' },
            { title: 'Total Qty', val: totalQty.toLocaleString('id-ID'), unit: 'PC', sub: `Total stok BOM`, type: 'in' as const, hue: '#10b981' },
            { title: 'Total Tonase', val: totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unit: 'TON', sub: `Total stok EOM`, type: 'out' as const, hue: '#8b5cf6' },
          ]).map((card, i) => (
            <motion.div key={card.title} whileHover={{ y: -3, scale: 1.02 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="relative group">
              <div className="absolute -inset-1 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(135deg, ${card.hue}20, transparent 60%)` }} />
              <StatsCard title={card.title} value={card.val} unit={card.unit} subtitle={card.sub} type={card.type} delay={0.05 + i * 0.05} condensed />
            </motion.div>
          ))}
        </motion.div>

        {/* ─── Data Groups ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-1">
          <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-indigo-200/50 shadow-sm">
            <Radio size={10} className="text-indigo-500" strokeWidth={2.5} />
            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-widest">Per SLOC</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-indigo-400/30 via-indigo-500/15 to-transparent" />
          <motion.span initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={springBouncy}
            className="text-[9px] font-bold text-indigo-600 bg-white/70 px-2 py-0.5 rounded-full border border-indigo-200/50 tabular-nums shadow-sm">
            {groups.length} grup
          </motion.span>
        </motion.div>

        <AnimatePresence mode="wait">
          {groups.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/70 backdrop-blur-sm border border-indigo-200/50 shadow-sm flex items-center justify-center">
                <Package size={28} className="text-indigo-400/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-indigo-700">No Data</p>
              <p className="text-xs text-indigo-600/60 mt-0.5">Coba ubah filter gudang~</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {groups.map(([sloc, items], groupIdx) => (
                <motion.div key={sloc}
                  initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: groupIdx * 0.07, ...spring }}>
                  <div className="relative group/card">
                    <div className="absolute -inset-1 rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 blur-lg"
                      style={{ background: `linear-gradient(135deg, #6366f115, transparent 60%)` }} />

                    <div className="relative bg-white/85 backdrop-blur-xl rounded-2xl border border-indigo-200/50 shadow-md shadow-indigo-500/5 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />

                      {/* ─── SLOC Header ─── */}
                      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-gradient-to-r from-indigo-50/60 to-white border-b border-indigo-100/50">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-indigo-200/30 bg-gradient-to-br from-indigo-100 to-indigo-50">
                            <GripVertical size={16} className="text-indigo-500" strokeWidth={2} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-bold text-indigo-800">{sloc}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-medium text-indigo-600/70">{items.length} item</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-black text-indigo-700 tabular-nums">
                            {items.length}
                          </span>
                          <span className="text-[9px] font-semibold text-indigo-500/70">item</span>
                        </div>
                      </div>

                      {/* ─── Items Table ─── */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="border-b border-indigo-100/50 bg-indigo-50/30">
                              <th className="text-left px-4 sm:px-5 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Material</th>
                              <th className="text-left px-3 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Batch</th>
                              <th className="text-left px-3 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">No NC</th>
                              <th className="text-left px-3 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Ket. NC</th>
                              <th className="text-left px-3 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Deskripsi</th>
                              <th className="text-right px-3 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Stok BOM</th>
                              <th className="text-right px-4 sm:px-5 py-2.5 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">Stok EOM</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <motion.tr key={`${item.batch}-${item.materialNumber}-${idx}`}
                                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                className="border-b border-indigo-100/30 hover:bg-indigo-50/40 transition-colors">
                                <td className="px-4 sm:px-5 py-2.5">
                                  <span className="font-mono font-bold text-indigo-900 text-[10px]">{item.materialNumber || '—'}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-indigo-700 bg-indigo-100/60 px-1.5 py-0.5 rounded-md text-[10px] border border-indigo-200/30">
                                    {item.batch}
                                    <span className={`text-[8px] font-bold ${item.batch.toUpperCase().endsWith('C') ? 'text-cyan-500' : 'text-amber-500'}`}>
                                      {item.batch.toUpperCase().endsWith('C') ? 'C' : 'E'}
                                    </span>
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="font-mono font-bold text-violet-700 bg-violet-100/50 px-1.5 py-0.5 rounded-md text-[10px] border border-violet-200/30">
                                    {splitNoNC(item.custRemark).noNC || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-indigo-600 text-[10px] italic">
                                    {splitNoNC(item.custRemark).keterangan || '—'}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span className="text-indigo-700 text-[10px] line-clamp-2">{item.description || '—'}</span>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  <span className="font-bold text-indigo-800 tabular-nums text-[11px]">
                                    {item.ttlStokBom.toLocaleString('id-ID')}
                                  </span>
                                </td>
                                <td className="px-4 sm:px-5 py-2.5 text-right">
                                  <span className="font-bold text-indigo-800 tabular-nums text-[11px]">
                                    {item.ttlStokEom.toLocaleString('id-ID')}
                                  </span>
                                </td>
                              </motion.tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* ─── Legend ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-indigo-50/40 border border-indigo-200/50 rounded-xl p-4 flex items-center gap-4 text-indigo-700 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-400/60" />
            <span className="text-[10px] font-semibold">Akhiran C</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400/60" />
            <span className="text-[10px] font-semibold">Akhiran E</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700 text-[9px] font-bold border border-violet-200/30">No NC</span>
            <span className="text-[10px] text-indigo-600/70">= format 185/NCR-SKF/V/2026 atau 237/IV/2026</span>
            <span className="text-[10px] text-indigo-400">|</span>
            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold border border-indigo-200/30">Ket. NC</span>
            <span className="text-[10px] text-indigo-600/70">= sisanya</span>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default function PipaNCPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/60 via-white to-indigo-50/40 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
          <Loader2 size={26} className="text-indigo-500" strokeWidth={2} />
        </motion.div>
      </div>
    }>
      <PipaNCContent />
    </Suspense>
  );
}
