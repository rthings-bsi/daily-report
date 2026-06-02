'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowDownRight, Package, MapPin, Truck, X,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import type { ProcessedMovement, StockCardItem } from '@/lib/excel-parser';
import { getMovementInfo } from '@/lib/sap-mapping';
import { getUserGudang, filterByGudang, removeInternalTfSloc, reclassify311, classifyBatch } from '@/lib/gudang';

// ─── Types ───

interface DestinationEntry {
  moveType: string;
  moveDescription: string;
  destination: string;
  quantity: number;
  count: number;
  color: string;
}

interface MvtGroup {
  moveType: string;
  description: string;
  color: string;
  totalQuantity: number;
  totalCount: number;
  items: DestinationEntry[];
}

// ─── Destination Resolution ───

function computeOutboundBreakdown(
  movements: ProcessedMovement[],
  stockCards: StockCardItem[]
): { groups: MvtGroup[]; totalQuantity: number; totalCount: number; uniqueDestinations: number } {
  // Build index: batch → customer (first match wins)
  const batchToCustomer = new Map<string, string>();
  for (const sc of stockCards) {
    if (sc.batch && !batchToCustomer.has(sc.batch)) {
      batchToCustomer.set(sc.batch, sc.customer || '');
    }
  }

  // Helper: resolve destination for a movement
  const resolveDestination = (m: ProcessedMovement): string => {
    switch (m.moveType) {
      case '261': // GI Produksi → work center
        return m.workCenter || 'Unknown Work Center';
      case '601': { // GI Delivery → customer from stock card
        const customer = batchToCustomer.get(m.batch);
        return customer || 'Unknown Customer';
      }
      case '311': // TF Sloc Out → destination SLOC
      case '321': // TF Plant Out → destination SLOC
        return m.storageLocation || 'Unknown SLOC';
      case '551': // Scrap
        return 'Scrap';
      default:
        return 'Lainnya';
    }
  };

  // Aggregate: keyed by `${moveType}|${destination}|${moveDescription}`
  const detailMap = new Map<string, DestinationEntry>();
  let totalQty = 0;
  let totalCnt = 0;

  for (const m of movements) {
    const dest = resolveDestination(m);
    const qty = Math.abs(m.quantity);
    const mvtInfo = getMovementInfo(m.moveType);
    const key = `${m.moveType}|${dest}|${mvtInfo.description}`;

    totalQty += qty;
    totalCnt += 1;

    if (detailMap.has(key)) {
      const entry = detailMap.get(key)!;
      entry.quantity += qty;
      entry.count += 1;
    } else {
      detailMap.set(key, {
        moveType: m.moveType,
        moveDescription: mvtInfo.description,
        destination: dest,
        quantity: qty,
        count: 1,
        color: mvtInfo.color,
      });
    }
  }

  // Group by MVT type
  const groupMap = new Map<string, DestinationEntry[]>();
  const sortedItems = Array.from(detailMap.values()).sort((a, b) => {
    if (a.moveType !== b.moveType) return a.moveType.localeCompare(b.moveType);
    return b.quantity - a.quantity;
  });

  for (const item of sortedItems) {
    const key = item.moveType;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(item);
  }

  const groups: MvtGroup[] = [];
  for (const [moveType, items] of groupMap) {
    const info = getMovementInfo(moveType);
    const totalQ = items.reduce((s, i) => s + i.quantity, 0);
    const totalC = items.reduce((s, i) => s + i.count, 0);
    groups.push({
      moveType,
      description: info.description,
      color: info.color,
      totalQuantity: totalQ,
      totalCount: totalC,
      items,
    });
  }

  const uniqueDestinations = new Set(sortedItems.map(i => i.destination)).size;

  return { groups, totalQuantity: totalQty, totalCount: totalCnt, uniqueDestinations };
}

// ─── Color palette ───

const COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#e11d48', '#7c3aed', '#2563eb', '#94a3b8',
];

// ─── Mini Stat Card ───

function MiniStatCard({ label, value, suffix, icon: Icon, color }: {
  label: string; value: string; suffix: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden bg-white border border-slate-200 border-l-4 shadow-sm rounded-2xl p-4"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-900 tabular-nums tracking-tight">{value}</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase">{suffix}</span>
          </div>
        </div>
        <div
          className="p-2.5 rounded-xl flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={18} style={{ color }} strokeWidth={2.5} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───

export default function OutboundDestinationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read query params from dashboard
  const sessionId = searchParams.get('session');
  const initialGudang = searchParams.get('gudang');
  const initialStart = searchParams.get('start');
  const initialEnd = searchParams.get('end');

  // State
  const [movements, setMovements] = useState<ProcessedMovement[]>([]);
  const [stockCards, setStockCards] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(
    initialGudang ? Number(initialGudang) : null
  );
  const [startDate, setStartDate] = useState(initialStart || '');
  const [endDate, setEndDate] = useState(initialEnd || '');

  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);

  // Auth guard
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Fetch data
  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/reports/${sessionId}`)
      .then(r => r.json())
      .then((data: any) => {
        const movs: ProcessedMovement[] = (data.movements || []).map((m: any) => ({
          id: m.id || `move-${Math.random()}`,
          postingDate: new Date(m.postingDate),
          dateStr: m.dateStr,
          moveType: m.moveType,
          description: m.description,
          workCenter: m.workCenter || '',
          batch: m.batch || '',
          quantity: m.quantity || 0,
          unitQuantity: m.unitQuantity || 0,
          userName: m.userName || '',
          storageLocation: m.storageLocation || '',
          group: m.group || 'Transfer',
          color: m.color || '#94a3b8',
          movementStatus: classifyBatch(m.batch || ''),
        }));
        setMovements(movs);
        setStockCards(data.stockCards || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Apply gudang + date filters (matching dashboard logic exactly)
  const filteredMovements = useMemo(() => {
    let result = movements;
    if (selectedGudang) {
      result = reclassify311(
        filterByGudang(removeInternalTfSloc(result), selectedGudang),
        selectedGudang
      );
    }
    if (startDate) result = result.filter(m => m.dateStr >= startDate);
    if (endDate) result = result.filter(m => m.dateStr <= endDate);
    return result;
  }, [movements, selectedGudang, startDate, endDate]);

  // Filter to outbound only
  const outboundMovements = useMemo(() =>
    filteredMovements.filter(m => m.group === 'Keluar'),
    [filteredMovements]
  );

  // Compute breakdown
  const breakdown = useMemo(
    () => computeOutboundBreakdown(outboundMovements, stockCards),
    [outboundMovements, stockCards]
  );

  // Back to dashboard
  const goBack = useCallback(() => {
    const params = new URLSearchParams();
    if (sessionId) params.set('session', sessionId);
    router.push(`/?${params.toString()}`);
  }, [sessionId, router]);

  // ─── Render ───

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-400 animate-pulse">Memuat data destinasi...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  // Empty / no-data state
  if (!sessionId || (!loading && outboundMovements.length === 0)) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
            <MapPin size={28} className="text-slate-400" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 mb-1">Tidak Ada Data Outbound</h1>
            <p className="text-sm text-slate-500">
              {sessionId ? 'Tidak ada transaksi keluar untuk filter saat ini.' : 'Pilih laporan dari dashboard untuk melihat breakdown destinasi.'}
            </p>
          </div>
          <button
            onClick={goBack}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg"
          >
            <ArrowLeft size={15} />
            Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Data loaded ───
  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-indigo-200">
      <PageHeader
        icon={ArrowDownRight}
        iconBg="bg-gradient-to-br from-rose-600 to-rose-700"
        title="Outbound Destinations"
        subtitle="Breakdown tujuan material keluar"
      >
        {/* Back button */}
        <button
          onClick={goBack}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all duration-200"
          aria-label="Kembali ke dashboard"
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">Dashboard</span>
        </button>

        {/* Gudang filter */}
        <select
          value={selectedGudang ?? ''}
          onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
          className="h-8 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-colors cursor-pointer"
        >
          <option value="">Semua Gudang</option>
          {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>Gudang {n}{n === sessionGudang ? ' (saya)' : ''}</option>
          ))}
        </select>

        {/* Date filters */}
        <div className="flex items-center gap-1.5 h-8">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-full text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-24 sm:w-32 transition-colors"
          />
          <span className="text-[11px] text-slate-300 font-medium">—</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-full text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-2.5 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-24 sm:w-32 transition-colors"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="h-full px-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
              title="Reset filter tanggal"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </PageHeader>

      <div className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-5 lg:py-6 space-y-4 sm:space-y-6">
        {/* ─── Summary Row ─── */}
        <div className="grid grid-cols-3 gap-3 xl:gap-4">
          <MiniStatCard
            label="Total Outbound"
            value={breakdown.totalQuantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            suffix="TON"
            icon={ArrowDownRight}
            color="#f43f5e"
          />
          <MiniStatCard
            label="Total Transaksi"
            value={breakdown.totalCount.toLocaleString('id-ID')}
            suffix="TRX"
            icon={Package}
            color="#6366f1"
          />
          <MiniStatCard
            label="Destinasi Unik"
            value={breakdown.uniqueDestinations.toLocaleString('id-ID')}
            suffix="TUJUAN"
            icon={MapPin}
            color="#0ea5e9"
          />
        </div>

        {/* ─── Breakdown Groups ─── */}
        <AnimatePresence mode="wait">
          {breakdown.groups.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Truck size={24} className="text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Belum Ada Data Outbound</p>
              <p className="text-xs text-slate-400 mt-1">Tidak ada transaksi keluar untuk periode ini.</p>
            </motion.div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {breakdown.groups.map((group, groupIdx) => {
                const groupTotal = group.totalQuantity;
                return (
                  <motion.div
                    key={group.moveType}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: groupIdx * 0.08, type: 'spring', stiffness: 300, damping: 25 }}
                    className="bg-white border border-slate-200 shadow-sm overflow-hidden rounded-2xl sm:rounded-3xl hover:shadow-lg transition-all duration-300"
                  >
                    {/* Group header */}
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                          style={{ backgroundColor: group.color }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold text-white"
                              style={{ backgroundColor: group.color }}
                            >
                              {group.moveType}
                            </span>
                            <span className="text-sm font-bold text-slate-800 truncate">{group.description}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-400 uppercase">Total</span>
                          <span className="text-sm font-black text-slate-900 tabular-nums">
                            {groupTotal.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">TON</span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg tabular-nums">
                          {group.totalCount} TRX
                        </span>
                      </div>
                    </div>

                    {/* Destination rows */}
                    <div className="px-3 sm:px-6 py-3 sm:py-4">
                      <div className="space-y-1">
                        {group.items.map((item, itemIdx) => {
                          const pct = groupTotal > 0
                            ? ((item.quantity / groupTotal) * 100).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                            : '0.0';
                          const color = COLORS[itemIdx % COLORS.length];
                          return (
                            <motion.div
                              key={`${item.moveType}-${item.destination}`}
                              initial={{ x: -8, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: itemIdx * 0.03 }}
                              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 border border-transparent hover:bg-slate-50 hover:border-slate-100"
                            >
                              {/* Rank */}
                              <span className="text-[10px] font-black text-slate-300 w-4 text-right flex-shrink-0 tabular-nums">
                                {itemIdx + 1}
                              </span>

                              {/* Color dot */}
                              <div
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: color }}
                              />

                              {/* Destination name */}
                              <span className="text-xs font-bold text-slate-700 uppercase tracking-tight flex-1 min-w-0 truncate">
                                {item.destination}
                              </span>

                              {/* Progress bar */}

                              <div className="hidden sm:block w-16 lg:w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                              </div>

                              {/* Quantity */}
                              <span className="text-xs font-mono font-black text-slate-800 tabular-nums flex-shrink-0 w-14 sm:w-20 text-right">
                                {item.quantity.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </span>

                              {/* Count badge */}
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md flex-shrink-0 min-w-[32px] text-center tabular-nums">
                                {item.count}
                              </span>

                              {/* % Badge */}
                              <div
                                className="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums flex-shrink-0 min-w-[36px] text-center bg-indigo-50 text-indigo-600"
                              >
                                {pct}%
                              </div>
                            </motion.div>
                          );
                        })}
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
