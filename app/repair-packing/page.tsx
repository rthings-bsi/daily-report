'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import {
  Wrench,
  Boxes,
  Filter,
  RefreshCw,
  Check,
  X,
  Copy,
  Loader2,
  AlertCircle,
  Download,
  TrendingUp,
  Box,
  Package,
} from 'lucide-react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { GUDANG_LIST } from '@/lib/gudang';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { copyDashboardToClipboard } from '@/lib/clipboard-capture';
import {
  RepairPackingItem,
  RepairPackingMetrics,
  WorkCenterBreakdownItem,
  MoveTypeBreakdownItem,
  DailyTrendItem,
  calculateRepairPackingMetrics,
} from '@/lib/repair-packing';

const getTodayIso = () => new Date().toLocaleDateString('en-CA');

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

const EMPTY_METRICS: RepairPackingMetrics = {
  totalRecords: 0,
  totalPcsIn: 0,
  totalKgIn: 0,
  totalTonIn: 0,
  totalPcsOut: 0,
  totalKgOut: 0,
  totalTonOut: 0,
  netPcs: 0,
  netTon: 0,
  ratioPct: 0,
};

const CustomChartTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: readonly { name?: string; value?: number | string; color?: string }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    const formattedDate = label ? label.split('-').reverse().join('/') : '';
    return (
      <div className="glass-card rounded-2xl p-3 shadow-apple-card border border-white/90 text-xs">
        <p className="font-bold text-slate-800 mb-1">{formattedDate || label}</p>
        <div className="space-y-1">
          {payload.map(entry => (
            <div key={entry.name} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}:
              </span>
              <span className="font-mono font-bold text-slate-900">
                {Number(entry.value).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 mb-3 px-1">
    <div className="w-1.5 h-4 bg-apple-blue rounded-full" />
    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{children}</h2>
  </div>
);

export default function RepairPackingPage() {
  const { data: authSession, status } = useSession();
  const contentRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [rawItems, setRawItems] = useState<RepairPackingItem[]>([]);
  const [trendRawItems, setTrendRawItems] = useState<RepairPackingItem[]>([]);
  const [serverWorkCenters, setServerWorkCenters] = useState<string[]>([]);

  const [selectedGudang, setSelectedGudang] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<string>(() => getTodayIso());
  const [endDate, setEndDate] = useState<string>(() => getTodayIso());
  const [datePreset, setDatePreset] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'PACKING' | 'REPAIR'>('ALL');
  const [workCenterFilter, setWorkCenterFilter] = useState<string>('');
  const [moveTypeFilter, setMoveTypeFilter] = useState<string>('');

  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [copyErrorMessage, setCopyErrorMessage] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

  const router = useRouter();
  const isAdmin = authSession?.user?.role === 'admin';
  const userPerms = authSession?.user?.permissions ?? [];
  const hasAccess = isAdmin || userPerms.includes('repair-packing');

  const gudangLabel = selectedGudang
    ? `Gudang ${selectedGudang}`
    : (authSession?.user?.gudangId ? `Gudang ${authSession.user.gudangId}` : 'Semua Gudang');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !hasAccess) {
      router.push('/');
    }
  }, [status, hasAccess, router]);

  useEffect(() => {
    if (authSession?.user && !isAdmin && authSession.user.gudangId) {
      setSelectedGudang(authSession.user.gudangId);
    }
  }, [authSession, isAdmin]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterOpen(false);
      }
    };
    if (filterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [filterOpen]);

  const applyPreset = (preset: 'today' | '7d' | '30d' | 'all') => {
    setDatePreset(preset);
    const now = new Date();
    const toIso = (d: Date) => d.toLocaleDateString('en-CA');

    if (preset === 'today') {
      const today = toIso(now);
      setStartDate(today);
      setEndDate(today);
    } else if (preset === '7d') {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      setStartDate(toIso(past));
      setEndDate(toIso(now));
    } else if (preset === '30d') {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      setStartDate(toIso(past));
      setEndDate(toIso(now));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGudang) params.set('gudangId', String(selectedGudang));
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      params.set('includeItems', 'true');

      const res = await fetch(`/api/reports/repair-packing?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil data transaksi repair & packing');

      const data = await res.json();
      setRawItems(data.items || []);
      setTrendRawItems(data.trendItems || []);
      if (Array.isArray(data.availableWorkCenters)) {
        setServerWorkCenters(data.availableWorkCenters);
      }
    } catch {
      // silent fail or fallback
    } finally {
      setLoading(false);
    }
  }, [selectedGudang, startDate, endDate]);

  const { filteredItems, metrics, byWorkCenter, byMoveType, dailyTrend, trendTotals, availableWorkCenters } = useMemo(() => {
    if (!rawItems.length && !trendRawItems.length) {
      return {
        filteredItems: [] as RepairPackingItem[],
        metrics: EMPTY_METRICS,
        byWorkCenter: [] as WorkCenterBreakdownItem[],
        byMoveType: [] as MoveTypeBreakdownItem[],
        dailyTrend: [] as DailyTrendItem[],
        trendTotals: { totalMasuk: 0, totalKeluar: 0, net: 0 },
        availableWorkCenters: serverWorkCenters,
      };
    }

    const filtered = rawItems.filter(item => {
      if (selectedShift !== null && item.shift !== selectedShift) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (workCenterFilter && item.workCenter.toLowerCase() !== workCenterFilter.toLowerCase()) return false;
      if (moveTypeFilter && item.moveType !== moveTypeFilter) return false;
      return true;
    });

    const calculated = calculateRepairPackingMetrics(filtered);

    // Client-side filtering for 7-day trend
    const trendFiltered = trendRawItems.filter(item => {
      if (selectedShift !== null && item.shift !== selectedShift) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (workCenterFilter && item.workCenter.toLowerCase() !== workCenterFilter.toLowerCase()) return false;
      if (moveTypeFilter && item.moveType !== moveTypeFilter) return false;
      return true;
    });

    const todayStr = getTodayIso();
    const refEnd = endDate || (
      trendRawItems.length > 0
        ? (trendRawItems[0].operationalDate > todayStr || trendRawItems[0].operationalDate < addDays(todayStr, -7)
            ? trendRawItems[0].operationalDate
            : todayStr)
        : todayStr
    );
    const refStart = addDays(refEnd, -6);

    const trendCalc = calculateRepairPackingMetrics(trendFiltered);
    const trendMap = new Map(trendCalc.dailyTrend.map(d => [d.date, d]));
    const fullDailyTrend: DailyTrendItem[] = [];
    for (let i = 0; i < 7; i++) {
      const dStr = addDays(refStart, i);
      fullDailyTrend.push(trendMap.get(dStr) || { date: dStr, masuk: 0, keluar: 0, net: 0 });
    }

    const totalMasuk = fullDailyTrend.reduce((sum, d) => sum + d.masuk, 0);
    const totalKeluar = fullDailyTrend.reduce((sum, d) => sum + d.keluar, 0);
    const net = totalMasuk - totalKeluar;

    const wcSet = new Set<string>(serverWorkCenters);
    rawItems.forEach(i => {
      if (i.workCenter) wcSet.add(i.workCenter);
    });
    trendRawItems.forEach(i => {
      if (i.workCenter) wcSet.add(i.workCenter);
    });

    return {
      filteredItems: filtered,
      metrics: calculated.metrics,
      byWorkCenter: calculated.byWorkCenter,
      byMoveType: calculated.byMoveType,
      dailyTrend: fullDailyTrend,
      trendTotals: { totalMasuk, totalKeluar, net },
      availableWorkCenters: Array.from(wcSet).sort(),
    };
  }, [rawItems, trendRawItems, selectedShift, categoryFilter, workCenterFilter, moveTypeFilter, serverWorkCenters, endDate]);

  useEffect(() => {
    if (status === 'authenticated' && hasAccess) {
      fetchData();
    }
  }, [status, hasAccess, fetchData]);

  const handleCopyDashboard = async () => {
    if (!contentRef.current || copyStatus === 'loading') return;
    setCopyStatus('loading');
    setCopyErrorMessage('');

    const dateRangeLabel = startDate || endDate
      ? `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Akhir'}`
      : 'Data Pergerakan Terkini';

    const res = await copyDashboardToClipboard(contentRef.current, {
      headerTitle: `Repair & Packing Dashboard - ${gudangLabel}`,
      headerSubtitle: dateRangeLabel,
    });

    if (res.success) {
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2500);
    } else {
      if (res.dataUrl) {
        setCapturedImageUrl(res.dataUrl);
        setPreviewModalOpen(true);
        setCopyStatus('idle');
      } else {
        setCopyStatus('error');
        setCopyErrorMessage(res.error || 'Gagal menyalin');
        setTimeout(() => setCopyStatus('idle'), 3500);
      }
    }
  };

  const handleCopyFromModal = async () => {
    if (!capturedImageUrl) return;
    try {
      const res = await fetch(capturedImageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setModalCopied(true);
      setTimeout(() => {
        setModalCopied(false);
        setPreviewModalOpen(false);
        setCopyStatus('success');
        setTimeout(() => setCopyStatus('idle'), 2500);
      }, 1000);
    } catch {
      alert('Izin clipboard browser ditolak. Silakan klik kanan pada gambar lalu pilih "Salin Gambar" (Copy Image).');
    }
  };

  const handleDownloadFromModal = () => {
    if (!capturedImageUrl) return;
    const a = document.createElement('a');
    a.href = capturedImageUrl;
    const dateStr = new Date().toISOString().split('T')[0];
    a.download = `repair-packing-dashboard-${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data transaksi yang dapat diekspor');
      return;
    }
    setExporting(true);
    try {
      const rows = filteredItems.map((item, idx) => ({
        No: idx + 1,
        'Tanggal Operasional': item.operationalDate,
        'Tanggal Entry': item.entryDate || '',
        'Jam Entry': item.entryTime || '',
        Shift: item.shift ? `Shift ${item.shift}` : '',
        Kategori: item.category,
        'Work Center': item.workCenter,
        'Mvt Type': item.moveType,
        'Deskripsi Mutasi': item.description,
        Grup: item.group,
        Material: item.material,
        Batch: item.batch,
        SLoc: item.storageLocation,
        'Qty (PCS)': item.unitQuantity,
        'Berat (KG)': item.quantity,
        'Tonase (Ton)': parseFloat((Math.abs(item.quantity) / 1000).toFixed(3)),
        Operator: item.userName,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Repair & Packing');

      const dateTag = startDate && endDate ? `${startDate}_sd_${endDate}` : 'all';
      const fileName = `Report_Repair_Packing_${dateTag}_${Date.now()}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengekspor Excel';
      alert(msg);
    } finally {
      setExporting(false);
    }
  };

  const secondaryStats = useMemo(() => {
    const packing = byWorkCenter.filter(wc => wc.category === 'PACKING');
    const packingTon = packing.reduce((s, wc) => s + wc.tonIn + wc.tonOut, 0);
    const packingPcs = packing.reduce((s, wc) => s + wc.pcsIn + wc.pcsOut, 0);

    const repair = byWorkCenter.filter(wc => wc.category === 'REPAIR');
    const repairTon = repair.reduce((s, wc) => s + wc.tonIn + wc.tonOut, 0);
    const repairPcs = repair.reduce((s, wc) => s + wc.pcsIn + wc.pcsOut, 0);

    const mvt101 = byMoveType.find(m => m.moveType === '101');
    const gr101Ton = mvt101?.ton || 0;
    const gr101Pcs = mvt101?.pcs || 0;

    const mvt261 = byMoveType.find(m => m.moveType === '261');
    const gi261Ton = mvt261?.ton || 0;
    const gi261Pcs = mvt261?.pcs || 0;

    const returnMvts = byMoveType.filter(m => m.moveType === '262' || m.moveType === '102');
    const returnTon = returnMvts.reduce((s, m) => s + m.ton, 0);
    const returnPcs = returnMvts.reduce((s, m) => s + m.pcs, 0);

    return {
      packingTon,
      packingPcs,
      repairTon,
      repairPcs,
      gr101Ton,
      gr101Pcs,
      gi261Ton,
      gi261Pcs,
      returnTon,
      returnPcs,
    };
  }, [byWorkCenter, byMoveType]);

  const activeFilterCount =
    (selectedGudang ? 1 : 0) +
    ((startDate || endDate) ? 1 : 0) +
    (selectedShift !== null ? 1 : 0) +
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (workCenterFilter ? 1 : 0) +
    (moveTypeFilter ? 1 : 0);

  if (status === 'authenticated' && !hasAccess) {
    return null;
  }

  return (
    <main className="min-h-screen dashboard-apple-bg selection:bg-apple-blue/20 selection:text-apple-blue font-sans">
      <PageHeader
        icon={Wrench}
        iconBg="bg-amber-500/10 text-amber-600 border border-amber-500/20"
        title="Repair & Packing"
        className="print:hidden"
      >
        <div ref={filterRef} className="relative mr-1 sm:mr-2">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[10px] font-bold border transition-all shadow-sm ${
              activeFilterCount > 0
                ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                : 'text-slate-700 bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
            }`}
            title="Filter Data"
          >
            <Filter size={12} strokeWidth={2.5} className="shrink-0" />
            <span className="hidden lg:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl p-4 min-w-[310px] max-w-[340px] space-y-3.5">
              {isAdmin && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Gudang
                  </label>
                  <select
                    value={selectedGudang || ''}
                    onChange={e => setSelectedGudang(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="">Semua Gudang</option>
                    {GUDANG_LIST.map(g => (
                      <option key={g.gudangId} value={g.gudangId}>
                        {g.name} ({g.prefix})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Kategori Lini
                </label>
                <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100 rounded-xl">
                  {(['ALL', 'PACKING', 'REPAIR'] as const).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`h-6 rounded-lg text-[10px] font-bold transition-all ${
                        categoryFilter === cat ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {cat === 'ALL' ? 'Semua' : cat === 'PACKING' ? 'Packing' : 'Repair'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Preset Periode
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {(['today', '7d', '30d', 'all'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`h-6 rounded-lg text-[10px] font-bold transition-all ${
                        datePreset === p
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {p === 'today' ? 'Hari Ini' : p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : 'Semua'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 block mb-0.5">Dari:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setDatePreset('all');
                    }}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-400 block mb-0.5">Sampai:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      setDatePreset('all');
                    }}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Shift Kerja
                </label>
                <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedShift(null)}
                    className={`h-6 rounded-lg text-[10px] font-bold transition-all ${
                      selectedShift === null ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    Semua
                  </button>
                  {[1, 2, 3].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedShift(s)}
                      className={`h-6 rounded-lg text-[10px] font-bold transition-all ${
                        selectedShift === s ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Shift {s}
                    </button>
                  ))}
                </div>
              </div>

              {availableWorkCenters.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Work Center
                  </label>
                  <select
                    value={workCenterFilter}
                    onChange={e => setWorkCenterFilter(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                  >
                    <option value="">Semua Work Center</option>
                    {availableWorkCenters.map(wc => (
                      <option key={wc} value={wc}>
                        {wc}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGudang(null);
                    applyPreset('today');
                    setSelectedShift(null);
                    setCategoryFilter('ALL');
                    setWorkCenterFilter('');
                    setMoveTypeFilter('');
                    setFilterOpen(false);
                  }}
                  className="w-full h-7 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <X size={12} strokeWidth={3} /> Reset Filter
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleCopyDashboard}
            disabled={copyStatus === 'loading'}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm border ${
              copyStatus === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : copyStatus === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title="Salin grafik dashboard ke clipboard"
          >
            {copyStatus === 'loading' ? (
              <>
                <Loader2 size={13} className="animate-spin text-slate-500" />
                <span className="hidden md:inline">Mengambil gambar...</span>
              </>
            ) : copyStatus === 'success' ? (
              <>
                <Check size={13} strokeWidth={2.5} className="text-emerald-600" />
                <span className="text-emerald-700">Tersalin ke Clipboard!</span>
              </>
            ) : copyStatus === 'error' ? (
              <>
                <AlertCircle size={13} className="text-rose-600" />
                <span className="text-rose-700">{copyErrorMessage || 'Gagal'}</span>
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={2} className="text-slate-500" />
                <span className="hidden sm:inline">Salin Grafik</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting}
            className="h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
            title="Download Excel"
          >
            <Download size={13} />
            <span className="hidden sm:inline">{exporting ? '...' : 'Excel'}</span>
          </button>

          <button
            onClick={fetchData}
            disabled={loading}
            className="h-7 w-7 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 disabled:opacity-50"
            title="Muat ulang data"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </PageHeader>

      <div ref={contentRef} className="max-w-[1700px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        <header
          className="glass-pill rounded-3xl p-5 md:p-6 shadow-apple-card flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-white/80"
          data-purpose="dashboard-hero-header"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 text-white flex items-center justify-center font-black text-xl shadow-apple-glow-blue shrink-0">
              {selectedGudang || authSession?.user?.gudangId || 'MP'}
            </div>
            <div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
                  Repair &amp; Packing Dashboard{' '}
                  <span className="text-amber-600 font-black">
                    – {gudangLabel}
                  </span>
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/60 border border-white/70 shadow-apple-sm text-xs font-medium text-slate-700">
              {selectedShift !== null && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Shift {selectedShift}
                </div>
              )}
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Periode Data</span>
                <span className="font-bold text-slate-800">
                  {startDate && endDate
                    ? `${startDate} - ${endDate}`
                    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </header>

        <section aria-label="Key Performance Indicators" data-purpose="hero-kpi-grid">
          <SectionTitle>Key Performance Indicators</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
            <StatsCard
              title="Total Outbound (GI Input)"
              value={metrics.totalTonOut.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              unit="TON"
              subtitle={`${metrics.totalPcsOut.toLocaleString('id-ID')} PCS bahan dikeluarkan ke lini`}
              type="out"
              delay={0.05}
            />
            <StatsCard
              title="Total Inbound (GR Output)"
              value={metrics.totalTonIn.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              unit="TON"
              subtitle={`${metrics.totalPcsIn.toLocaleString('id-ID')} PCS hasil pipa jadi diterima`}
              type="in"
              delay={0.1}
            />
            <StatsCard
              title="Rasio GR / GI"
              value={metrics.ratioPct.toFixed(1)}
              unit="%"
              subtitle={`Net flow ${metrics.netTon >= 0 ? '+' : ''}${metrics.netTon.toFixed(1)} TON (${metrics.netPcs >= 0 ? '+' : ''}${metrics.netPcs.toLocaleString('id-ID')} PCS)`}
              type="net"
              delay={0.15}
            />
            <StatsCard
              title="Total Transaksi"
              value={metrics.totalRecords.toLocaleString('id-ID')}
              unit="TRX"
              subtitle="Total record SAP (MP* + Rep*)"
              type="total"
              delay={0.2}
            />
          </div>
        </section>

        <section aria-label="Ringkasan Lini & Status Mutasi" data-purpose="secondary-stats-bar">
          <div className="glass-card rounded-2xl p-4 shadow-apple-sm border border-white/80">
            <div className="flex items-center justify-between px-1 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Ringkasan Lini &amp; Status Mutasi
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    categoryFilter === 'ALL' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Semua
                </button>
                <button
                  onClick={() => setCategoryFilter('PACKING')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    categoryFilter === 'PACKING' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Packing (MP*)
                </button>
                <button
                  onClick={() => setCategoryFilter('REPAIR')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    categoryFilter === 'REPAIR' ? 'bg-slate-900 text-white font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Repair (Rep*)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
              <div
                onClick={() => setCategoryFilter(categoryFilter === 'PACKING' ? 'ALL' : 'PACKING')}
                className={`p-3.5 rounded-2xl border transition-apple shadow-apple-sm cursor-pointer group ${
                  categoryFilter === 'PACKING'
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">PACKING (MP*)</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200/60 text-xs">
                    <Boxes size={12} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {secondaryStats.packingTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  <span className="text-xs font-semibold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {secondaryStats.packingPcs.toLocaleString('id-ID')} PCS mutasi
                </p>
              </div>

              <div
                onClick={() => setCategoryFilter(categoryFilter === 'REPAIR' ? 'ALL' : 'REPAIR')}
                className={`p-3.5 rounded-2xl border transition-apple shadow-apple-sm cursor-pointer group ${
                  categoryFilter === 'REPAIR'
                    ? 'bg-indigo-50/80 border-indigo-300'
                    : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">REPAIR (REP*)</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-200/60 text-xs">
                    <Wrench size={12} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {secondaryStats.repairTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  <span className="text-xs font-semibold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  {secondaryStats.repairPcs.toLocaleString('id-ID')} PCS mutasi
                </p>
              </div>

              <div
                onClick={() => setMoveTypeFilter(moveTypeFilter === '101' ? '' : '101')}
                className={`p-3.5 rounded-2xl border transition-apple shadow-apple-sm cursor-pointer group ${
                  moveTypeFilter === '101'
                    ? 'bg-emerald-50/80 border-emerald-300'
                    : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">GR 101 (SELESAI)</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-200/60 text-xs">
                    <TrendingUp size={12} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {secondaryStats.gr101Ton.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  <span className="text-xs font-semibold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {secondaryStats.gr101Pcs.toLocaleString('id-ID')} PCS hasil jadi
                </p>
              </div>

              <div
                onClick={() => setMoveTypeFilter(moveTypeFilter === '261' ? '' : '261')}
                className={`p-3.5 rounded-2xl border transition-apple shadow-apple-sm cursor-pointer group ${
                  moveTypeFilter === '261'
                    ? 'bg-orange-50/80 border-orange-300'
                    : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">GI 261 (BAHAN)</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-orange-50 text-orange-600 border border-orange-200/60 text-xs">
                    <Box size={12} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {secondaryStats.gi261Ton.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  <span className="text-xs font-semibold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-orange-700 font-semibold mt-1 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                  {secondaryStats.gi261Pcs.toLocaleString('id-ID')} PCS masuk lini
                </p>
              </div>

              <div
                onClick={() => setMoveTypeFilter(moveTypeFilter === '262' ? '' : '262')}
                className={`p-3.5 rounded-2xl border transition-apple shadow-apple-sm cursor-pointer group col-span-2 md:col-span-1 ${
                  moveTypeFilter === '262'
                    ? 'bg-blue-50/80 border-blue-300'
                    : 'bg-white/70 border-white hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">RETUR (262/102)</span>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-blue-50 text-apple-blue border border-blue-200/60 text-xs">
                    <Package size={12} strokeWidth={2.5} />
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                  {secondaryStats.returnTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                  <span className="text-xs font-semibold text-slate-500">TON</span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  {secondaryStats.returnPcs.toLocaleString('id-ID')} PCS retur
                </p>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Analisis Pergerakan Material">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <motion.article
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-7 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Tren Pergerakan Harian</h2>
                    <p className="text-xs text-slate-500 font-medium">Bahan Masuk (GI) vs Selesai (GR) (TON) • 7 Hari Terakhir</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-md bg-emerald-500 shadow-sm" /> Masuk (GR)
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-md bg-rose-500 shadow-sm" /> Keluar (GI)
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-full bg-apple-blue ring-2 ring-blue-200 shadow-sm" /> Net
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 my-4">
                  <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/50 flex flex-col">
                    <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Total Masuk</span>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-600 tabular-nums">
                      +{trendTotals.totalMasuk.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      <span className="text-xs font-normal text-emerald-500">TON</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200/50 flex flex-col">
                    <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">Total Keluar</span>
                    <span className="text-sm sm:text-base font-extrabold text-rose-600 tabular-nums">
                      -{trendTotals.totalKeluar.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      <span className="text-xs font-normal text-rose-500">TON</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/50 flex flex-col">
                    <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Net Movement</span>
                    <span className="text-sm sm:text-base font-extrabold text-apple-blue tabular-nums">
                      {trendTotals.net >= 0 ? '+' : ''}
                      {trendTotals.net.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                      <span className="text-xs font-normal text-blue-500">TON</span>
                    </span>
                  </div>
                </div>

                <div className="relative w-full h-56 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={dailyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 5 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E8ED" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E8E8ED' }}
                        tickFormatter={val => val.split('-').slice(1).reverse().join('/')}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={val => `${val}T`}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar dataKey="masuk" name="Masuk (GR)" fill="#34C759" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="keluar" name="Keluar (GI)" fill="#FF3B30" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Line type="monotone" dataKey="net" name="Net Flow" stroke="#007AFF" strokeWidth={2.5} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-5 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800">Distribusi Work Center</h2>
                    <p className="text-xs text-slate-500 font-medium">Proporsi aktivitas mutasi lini MP* &amp; Rep*</p>
                  </div>
                  {workCenterFilter && (
                    <button
                      onClick={() => setWorkCenterFilter('')}
                      className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-amber-100"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {byWorkCenter.slice(0, 6).map(wc => {
                    const totalTonWc = wc.tonIn + wc.tonOut;
                    const pct = metrics.totalTonIn + metrics.totalTonOut > 0
                      ? (totalTonWc / (metrics.totalTonIn + metrics.totalTonOut)) * 100
                      : 0;
                    const isSelected = workCenterFilter === wc.workCenter;

                    return (
                      <div
                        key={wc.workCenter}
                        onClick={() => setWorkCenterFilter(isSelected ? '' : wc.workCenter)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                            : 'bg-white/60 border-slate-200/80 hover:bg-white text-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{wc.workCenter}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                                isSelected
                                  ? 'bg-slate-800 text-slate-200'
                                  : wc.category === 'REPAIR'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {wc.category}
                            </span>
                          </div>
                          <span className="font-mono tabular-nums">
                            {totalTonWc.toFixed(1)} Ton ({pct.toFixed(0)}%)
                          </span>
                        </div>

                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${totalTonWc > 0 ? (wc.tonIn / totalTonWc) * 100 : 0}%` }}
                            title={`GR Masuk: ${wc.tonIn.toFixed(1)} T`}
                          />
                          <div
                            className="bg-rose-500 h-full"
                            style={{ width: `${totalTonWc > 0 ? (wc.tonOut / totalTonWc) * 100 : 0}%` }}
                            title={`GI Keluar: ${wc.tonOut.toFixed(1)} T`}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] mt-1.5 text-slate-500 font-medium">
                          <span className={isSelected ? 'text-slate-300' : ''}>
                            In: <strong className="text-emerald-500">{wc.tonIn.toFixed(1)}T</strong> • Out:{' '}
                            <strong className="text-rose-500">{wc.tonOut.toFixed(1)}T</strong>
                          </span>
                          <span className={isSelected ? 'text-slate-300' : ''}>
                            {(wc.pcsIn + wc.pcsOut).toLocaleString('id-ID')} Pcs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.article>
          </div>
        </section>

        <section aria-label="Work Center & Analitik Transaksi">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-7 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-apple-blue" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Rincian Work Center Lini Produksi
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {byWorkCenter.length} Work Center Terdata
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {byWorkCenter.map(wc => {
                    const isSelected = workCenterFilter === wc.workCenter;
                    return (
                      <div
                        key={wc.workCenter}
                        onClick={() => setWorkCenterFilter(isSelected ? '' : wc.workCenter)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                            : 'bg-white/70 border-white hover:bg-white text-slate-900 shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-sm">{wc.workCenter}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isSelected
                                ? 'bg-slate-800 text-slate-200'
                                : wc.category === 'REPAIR'
                                ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                                : 'bg-amber-50 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {wc.category}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className={`text-[10px] block ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                              GI (Keluar)
                            </span>
                            <span className="font-mono font-bold text-rose-500">
                              {wc.tonOut.toFixed(1)} Ton
                            </span>
                          </div>
                          <div>
                            <span className={`text-[10px] block ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                              GR (Masuk)
                            </span>
                            <span className="font-mono font-bold text-emerald-500">
                              {wc.tonIn.toFixed(1)} Ton
                            </span>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px]">
                          <span className={isSelected ? 'text-slate-300' : 'text-slate-600'}>
                            {wc.records} transaksi
                          </span>
                          <span className={`font-mono font-bold ${isSelected ? 'text-slate-200' : 'text-slate-800'}`}>
                            {(wc.pcsIn + wc.pcsOut).toLocaleString('id-ID')} Pcs
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 glass-card rounded-3xl p-5 md:p-6 shadow-apple-card border border-white/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-apple-blue" />
                    <h3 className="text-sm font-bold text-slate-800">
                      Tipe Mutasi SAP
                    </h3>
                  </div>
                  {moveTypeFilter && (
                    <button
                      onClick={() => setMoveTypeFilter('')}
                      className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 hover:bg-amber-100"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {byMoveType.map(mvt => {
                    const isSelected = moveTypeFilter === mvt.moveType;
                    return (
                      <div
                        key={mvt.moveType}
                        onClick={() => setMoveTypeFilter(isSelected ? '' : mvt.moveType)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-400'
                            : 'bg-white/70 border-white hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: mvt.color }}
                            />
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {mvt.moveType}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 truncate max-w-[140px]">
                              {mvt.description}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">
                            {mvt.records} trx
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs font-mono">
                          <span className="text-slate-600">
                            {mvt.pcs.toLocaleString('id-ID')} Pcs
                          </span>
                          <span className="font-bold text-slate-900">
                            {mvt.ton.toFixed(2)} Ton
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="glass-pill rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-medium gap-3 border border-white/60 mt-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Created By Ricky</span>
          </div>
          <div className="flex items-center">
            <span>© 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {previewModalOpen && capturedImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Pratinjau Gambar Dashboard</h3>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol di bawah atau klik kanan gambar lalu pilih &ldquo;Copy Image&rdquo;
                  </p>
                </div>
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[62vh] bg-slate-50/50 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImageUrl}
                  alt="Dashboard Preview"
                  className="rounded-xl border border-slate-200/80 shadow-sm max-w-full h-auto object-contain cursor-pointer"
                  title="Klik kanan lalu pilih 'Salin Gambar' (Copy Image)"
                />
              </div>

              <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500">
                  {modalCopied ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                      <Check size={13} /> Berhasil disalin ke clipboard!
                    </span>
                  ) : (
                    <span>Siap disalin atau diunduh</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadFromModal}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Download size={13} /> Unduh PNG
                  </button>

                  <button
                    onClick={handleCopyFromModal}
                    className="px-4 py-1.5 rounded-xl bg-apple-blue hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
                  >
                    <Copy size={13} /> {modalCopied ? 'Tersalin!' : 'Salin ke Clipboard'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
