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
  Area,
  ComposedChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import { GUDANG_LIST } from '@/lib/gudang';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { useTheme } from '@/components/ThemeProvider';
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

const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

const SectionTitle: React.FC<{
  title?: string;
  children?: React.ReactNode;
  badge?: string | number;
  action?: React.ReactNode;
}> = ({ title, children, badge, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-0.5">
    <div className="flex items-center gap-2.5">
      <div className="w-2.5 h-2.5 rounded-full neu-inset-sm flex items-center justify-center shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)]" />
      </div>
      <h2 className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
        {title || children}
      </h2>
      {badge !== undefined && <span className="neu-chip">{badge}</span>}
    </div>
    {action}
  </div>
);

export default function RepairPackingPage() {
  const { data: authSession, status } = useSession();
  const { isDark } = useTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [unitMode, setUnitMode] = useState<'TON' | 'PCS'>('TON');

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
  const isMerger = (authSession?.user as any)?.roleScope === 'merger';
  const mergerGudangIds: number[] = ((authSession?.user as any)?.mergerGudangIds as number[] | undefined) || [];
  const canFilterGudang = isAdmin || (authSession?.user as any)?.roleScope === 'global' || isMerger;
  const userPerms = authSession?.user?.permissions ?? [];
  const hasAccess = isAdmin || userPerms.includes('repair-packing');

  const gudangLabel = selectedGudang
    ? `Gudang ${selectedGudang}`
    : isMerger
    ? `Merger (${mergerGudangIds.join(', ')})`
    : authSession?.user?.gudangId
    ? `Gudang ${authSession.user.gudangId}`
    : 'Semua Gudang';

  const chartColors = useMemo(
    () =>
      isDark
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
          },
    [isDark]
  );

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && !hasAccess) {
      router.push('/');
    }
  }, [status, hasAccess, router]);

  useEffect(() => {
    if (authSession?.user && !isAdmin && !isMerger && authSession.user.gudangId) {
      setSelectedGudang(authSession.user.gudangId);
    }
  }, [authSession, isAdmin, isMerger]);

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

  const trendRangeStr = useMemo(() => {
    if (!dailyTrend.length) return '7 Hari Terakhir';
    const first = dailyTrend[0].date.split('-').reverse().join('/');
    const last = dailyTrend[dailyTrend.length - 1].date.split('-').reverse().join('/');
    return `${first} - ${last}`;
  }, [dailyTrend]);

  const isDefaultDate = datePreset === 'today';
  const activeFilterCount =
    (selectedGudang ? 1 : 0) +
    (!isDefaultDate ? 1 : 0) +
    (selectedShift !== null ? 1 : 0) +
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (workCenterFilter ? 1 : 0) +
    (moveTypeFilter ? 1 : 0);

  const resetAllFilters = () => {
    setSelectedGudang(null);
    applyPreset('today');
    setSelectedShift(null);
    setCategoryFilter('ALL');
    setWorkCenterFilter('');
    setMoveTypeFilter('');
  };

  const renderChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const formattedDate = typeof label === 'string' ? label.split('-').reverse().join('/') : '';
      return (
        <div className="neu-float px-3.5 py-2.5 rounded-2xl text-xs min-w-[190px]">
          <p className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] mb-1.5 pb-1 border-b border-[var(--neu-divider)]">
            {formattedDate || label}
          </p>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => {
              const isNet = entry.dataKey === 'net';
              const numericVal = Number(entry.value || 0);
              return (
                <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isNet ? chartColors.netLine : entry.color || entry.fill }}
                    />
                    <span className="font-medium text-[var(--neu-text-secondary)]">{entry.name}</span>
                  </div>
                  <span
                    className={cn(
                      'font-mono font-bold tabular-nums',
                      isNet
                        ? numericVal >= 0
                          ? 'text-[var(--neu-accent)]'
                          : 'text-[var(--neu-red)]'
                        : 'text-[var(--neu-text)]'
                    )}
                  >
                    {isNet && numericVal >= 0 ? '+' : ''}
                    {numericVal.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON
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

  if (status === 'authenticated' && !hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--neu-bg)] text-[var(--neu-text)] font-sans transition-colors duration-200">
      <PageHeader
        icon={Wrench}
        title="Repair & Packing"
        subtitle="Dashboard lini repair & packing SPINDO"
        className="print:hidden"
      >
        {/* ─── Collapsible Neumorphic Filter Control ─── */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className={cn(
              'h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl text-[12px] font-bold transition-neu cursor-pointer',
              activeFilterCount > 0 ? 'neu-btn-primary' : 'neu-btn text-[var(--neu-text-secondary)]'
            )}
            title="Filter Data"
          >
            <Filter size={13} strokeWidth={2.2} className="shrink-0" />
            <span className="hidden lg:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center font-mono text-[9.5px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-2.5 z-50 neu-float p-4 min-w-[310px] max-w-[350px] space-y-4">
                <p className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                  Filter Parameter
                </p>

                {canFilterGudang && (
                  <div>
                    <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                      Gudang
                    </label>
                    <select
                      value={selectedGudang || ''}
                      onChange={e => setSelectedGudang(e.target.value ? parseInt(e.target.value, 10) : null)}
                      className="neu-input w-full h-9.5 text-[12px] font-semibold rounded-xl px-3 cursor-pointer"
                    >
                      <option value="">{isMerger ? 'Semua Gudang Terhubung' : 'Semua Gudang'}</option>
                      {(isMerger
                        ? GUDANG_LIST.filter(g => mergerGudangIds.includes(g.gudangId))
                        : GUDANG_LIST
                      ).map(g => (
                        <option key={g.gudangId} value={g.gudangId}>
                          {g.name} ({g.prefix})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                    Kategori Lini
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 neu-inset-sm rounded-xl">
                    {(['ALL', 'PACKING', 'REPAIR'] as const).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          'h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer',
                          categoryFilter === cat
                            ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                            : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                        )}
                      >
                        {cat === 'ALL' ? 'Semua' : cat === 'PACKING' ? 'Packing' : 'Repair'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                    Preset Periode
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 neu-inset-sm rounded-xl">
                    {(['today', '7d', '30d', 'all'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={cn(
                          'h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer',
                          datePreset === p
                            ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                            : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                        )}
                      >
                        {p === 'today' ? 'Hari Ini' : p === '7d' ? '7 Hari' : p === '30d' ? '30 Hari' : 'Semua'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                    Rentang Tanggal
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        setDatePreset('all');
                      }}
                      className="neu-input flex-1 h-9.5 text-[11px] font-mono font-medium rounded-xl px-2.5"
                    />
                    <span className="text-xs text-[var(--neu-text-muted)] font-bold">-</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => {
                        setEndDate(e.target.value);
                        setDatePreset('all');
                      }}
                      className="neu-input flex-1 h-9.5 text-[11px] font-mono font-medium rounded-xl px-2.5"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] block">
                      Shift Kerja
                    </label>
                    <span className="font-mono text-[9.5px] text-[var(--neu-text-muted)]">Entered at (SAP)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 neu-inset-sm rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedShift(null)}
                      className={cn(
                        'h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer',
                        selectedShift === null
                          ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                          : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                      )}
                    >
                      Semua
                    </button>
                    {[1, 2, 3].map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedShift(s)}
                        className={cn(
                          'h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer',
                          selectedShift === s
                            ? 'neu-btn-primary'
                            : 'text-[var(--neu-text-secondary)] hover:text-[var(--neu-text)]'
                        )}
                      >
                        Shift {s}
                      </button>
                    ))}
                  </div>
                </div>

                {availableWorkCenters.length > 0 && (
                  <div>
                    <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                      Work Center
                    </label>
                    <select
                      value={workCenterFilter}
                      onChange={e => setWorkCenterFilter(e.target.value)}
                      className="neu-input w-full h-9.5 text-[12px] font-semibold rounded-xl px-3 cursor-pointer"
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

                <div>
                  <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">
                    Satuan Tampilan
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 neu-inset-sm rounded-xl font-mono">
                    {(['TON', 'PCS'] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnitMode(u)}
                        className={cn(
                          'h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer',
                          unitMode === u
                            ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                            : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      resetAllFilters();
                      setFilterOpen(false);
                    }}
                    className="w-full h-8.5 text-[11.5px] font-bold text-[var(--neu-red)] neu-btn rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X size={12} strokeWidth={2.5} /> Reset Filter
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── Header Action Buttons ─── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting}
            className="h-9 px-3.5 rounded-xl text-[12px] font-bold transition-neu flex items-center gap-1.5 neu-btn text-[var(--neu-green)] disabled:opacity-50 cursor-pointer"
            title="Download Excel"
          >
            <Download size={13} strokeWidth={2.2} />
            <span className="hidden sm:inline">{exporting ? '...' : 'Excel'}</span>
          </button>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="h-9 w-9 rounded-xl text-[12px] font-bold transition-neu flex items-center justify-center neu-btn text-[var(--neu-text-secondary)] disabled:opacity-50 cursor-pointer"
            title="Muat ulang data"
            aria-label="Muat ulang data"
          >
            <RefreshCw size={13} strokeWidth={2.2} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={handleCopyDashboard}
            disabled={copyStatus === 'loading'}
            className={cn(
              'h-9 px-3.5 rounded-xl text-[12px] font-bold transition-neu flex items-center gap-1.5 cursor-pointer',
              copyStatus === 'success'
                ? 'neu-inset-sm text-[var(--neu-green)]'
                : copyStatus === 'error'
                ? 'neu-inset-sm text-[var(--neu-red)]'
                : 'neu-btn-primary'
            )}
            title="Salin grafik dashboard ke clipboard (bisa langsung di-paste dengan Ctrl+V)"
          >
            {copyStatus === 'loading' ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span className="hidden md:inline">Mengambil...</span>
              </>
            ) : copyStatus === 'success' ? (
              <>
                <Check size={13} strokeWidth={2.5} />
                <span>Tersalin!</span>
              </>
            ) : copyStatus === 'error' ? (
              <>
                <AlertCircle size={13} />
                <span title={copyErrorMessage}>Gagal</span>
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={2.2} />
                <span className="hidden sm:inline">Salin Grafik</span>
              </>
            )}
          </button>
        </div>
      </PageHeader>

      {/* ─── Page Content ─── */}
      <div ref={contentRef} className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-7">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-6 pb-12"
        >
          {/* ─── Tactile Dashboard Banner ─── */}
          <header
            className="neu-card px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            data-purpose="dashboard-hero-header"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl neu-icon-inset text-[var(--neu-accent)] flex items-center justify-center font-mono font-extrabold text-sm shrink-0">
                {selectedGudang
                  ? `G${selectedGudang}`
                  : isMerger
                  ? 'MG'
                  : authSession?.user?.gudangId
                  ? `G${authSession.user.gudangId}`
                  : 'RP'}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight text-[var(--neu-text)] leading-tight">
                    Repair &amp; Packing Dashboard
                  </h1>
                  <span className="neu-chip">{gudangLabel.toUpperCase()}</span>
                </div>
                <p className="text-[12.5px] text-[var(--neu-text-muted)] mt-1">
                  Monitoring pergerakan material GI (261) dan GR (101) lini repair &amp; packing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full neu-inset-sm font-mono text-[11px] font-semibold text-[var(--neu-green)]">
                <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" />
                SAP Terhubung
              </span>
            </div>
          </header>

          {/* ─── Active Filter Chips Strip ─── */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap text-xs px-1">
              <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                Filter Aktif:
              </span>
              {selectedGudang && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  Gudang {selectedGudang}
                  <button
                    type="button"
                    onClick={() => setSelectedGudang(null)}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Hapus filter gudang"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              {selectedShift !== null && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  Shift {selectedShift}
                  <button
                    type="button"
                    onClick={() => setSelectedShift(null)}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Hapus filter shift"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              {categoryFilter !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  Lini: {categoryFilter === 'PACKING' ? 'Packing' : 'Repair'}
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Hapus filter lini"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              {workCenterFilter && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  WC: {workCenterFilter}
                  <button
                    type="button"
                    onClick={() => setWorkCenterFilter('')}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Hapus filter work center"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              {moveTypeFilter && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  MvT: {moveTypeFilter}
                  <button
                    type="button"
                    onClick={() => setMoveTypeFilter('')}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Hapus filter tipe mutasi"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              {!isDefaultDate && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full neu-inset-sm text-[11.5px] font-bold text-[var(--neu-accent)]">
                  {datePreset === '7d'
                    ? '7 Hari Terakhir'
                    : datePreset === '30d'
                    ? '30 Hari Terakhir'
                    : startDate || endDate
                    ? `${startDate || 'Awal'} s/d ${endDate || 'Akhir'}`
                    : 'Semua Periode'}
                  <button
                    type="button"
                    onClick={() => applyPreset('today')}
                    className="hover:text-[var(--neu-red)] transition-colors cursor-pointer"
                    aria-label="Reset periode"
                  >
                    <X size={11} strokeWidth={2.6} />
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={resetAllFilters}
                className="text-[11.5px] font-bold text-[var(--neu-red)] hover:underline ml-1 cursor-pointer"
              >
                Reset Semua ({activeFilterCount})
              </button>
            </div>
          )}

          {/* ─── Hero KPI Grid (Interactive Neumorphic Cards) ─── */}
          <section aria-label="Key Performance Indicators" data-purpose="hero-kpi-grid">
            <SectionTitle
              badge={moveTypeFilter ? `Filter Aktif: MvT ${moveTypeFilter}` : undefined}
              action={
                moveTypeFilter ? (
                  <button
                    type="button"
                    onClick={() => setMoveTypeFilter('')}
                    className="text-[11.5px] font-bold text-[var(--neu-red)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <X size={12} /> Hapus Filter MvT
                  </button>
                ) : undefined
              }
            >
              Key Performance Indicators
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <StatsCard
                title="Total Outbound (GI Input)"
                value={
                  unitMode === 'TON'
                    ? metrics.totalTonOut.toLocaleString('id-ID', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })
                    : metrics.totalPcsOut.toLocaleString('id-ID')
                }
                unit={unitMode}
                subtitle={
                  unitMode === 'TON'
                    ? `${metrics.totalPcsOut.toLocaleString('id-ID')} PCS bahan dikeluarkan ke lini`
                    : `${metrics.totalTonOut.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON berat material`
                }
                type="out"
                delay={0.03}
                active={moveTypeFilter === '261'}
                onClick={() => setMoveTypeFilter(moveTypeFilter === '261' ? '' : '261')}
              />
              <StatsCard
                title="Total Inbound (GR Output)"
                value={
                  unitMode === 'TON'
                    ? metrics.totalTonIn.toLocaleString('id-ID', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })
                    : metrics.totalPcsIn.toLocaleString('id-ID')
                }
                unit={unitMode}
                subtitle={
                  unitMode === 'TON'
                    ? `${metrics.totalPcsIn.toLocaleString('id-ID')} PCS hasil pipa jadi diterima`
                    : `${metrics.totalTonIn.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON berat material`
                }
                type="in"
                delay={0.06}
                active={moveTypeFilter === '101'}
                onClick={() => setMoveTypeFilter(moveTypeFilter === '101' ? '' : '101')}
              />
              <StatsCard
                title="Rasio GR / GI"
                value={metrics.ratioPct.toLocaleString('id-ID', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}
                unit="%"
                subtitle={`Net flow ${metrics.netTon >= 0 ? '+' : ''}${metrics.netTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON (${metrics.netPcs >= 0 ? '+' : ''}${metrics.netPcs.toLocaleString('id-ID')} PCS)`}
                type="net"
                delay={0.09}
              />
              <StatsCard
                title="Total Transaksi"
                value={metrics.totalRecords.toLocaleString('id-ID')}
                unit="TRX"
                subtitle="Total record SAP (MP* + Rep*)"
                type="total"
                delay={0.12}
                onClick={() => {
                  setMoveTypeFilter('');
                  setCategoryFilter('ALL');
                  setWorkCenterFilter('');
                }}
              />
            </div>
          </section>

          {/* ─── Secondary Stats: Ringkasan Lini & Status Mutasi (Matches Pipa NC 5-card Tactile Bar) ─── */}
          <section aria-label="Ringkasan Lini & Status Mutasi" data-purpose="secondary-stats-bar">
            <SectionTitle
              action={
                <span className="font-mono text-[10.5px] font-medium text-[var(--neu-text-muted)]">
                  Klik kartu untuk filter data
                </span>
              }
            >
              Ringkasan Lini &amp; Status Mutasi
            </SectionTitle>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  key: 'packing',
                  label: 'PACKING (MP*)',
                  value:
                    unitMode === 'TON'
                      ? secondaryStats.packingTon.toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : secondaryStats.packingPcs.toLocaleString('id-ID'),
                  desc:
                    unitMode === 'TON'
                      ? `${secondaryStats.packingPcs.toLocaleString('id-ID')} PCS`
                      : `${secondaryStats.packingTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`,
                  dot: 'var(--neu-accent)',
                  icon: Boxes,
                  color: 'text-[var(--neu-accent)]',
                  isActive: categoryFilter === 'PACKING',
                  onClick: () => setCategoryFilter(categoryFilter === 'PACKING' ? 'ALL' : 'PACKING'),
                },
                {
                  key: 'repair',
                  label: 'REPAIR (REP*)',
                  value:
                    unitMode === 'TON'
                      ? secondaryStats.repairTon.toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : secondaryStats.repairPcs.toLocaleString('id-ID'),
                  desc:
                    unitMode === 'TON'
                      ? `${secondaryStats.repairPcs.toLocaleString('id-ID')} PCS`
                      : `${secondaryStats.repairTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`,
                  dot: 'var(--neu-purple-bar)',
                  icon: Wrench,
                  color: 'text-[var(--neu-purple)]',
                  isActive: categoryFilter === 'REPAIR',
                  onClick: () => setCategoryFilter(categoryFilter === 'REPAIR' ? 'ALL' : 'REPAIR'),
                },
                {
                  key: 'gr101',
                  label: 'GR 101 (SELESAI)',
                  value:
                    unitMode === 'TON'
                      ? secondaryStats.gr101Ton.toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : secondaryStats.gr101Pcs.toLocaleString('id-ID'),
                  desc:
                    unitMode === 'TON'
                      ? `${secondaryStats.gr101Pcs.toLocaleString('id-ID')} PCS hasil jadi`
                      : `${secondaryStats.gr101Ton.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`,
                  dot: 'var(--neu-green-bar)',
                  icon: TrendingUp,
                  color: 'text-[var(--neu-green)]',
                  isActive: moveTypeFilter === '101',
                  onClick: () => setMoveTypeFilter(moveTypeFilter === '101' ? '' : '101'),
                },
                {
                  key: 'gi261',
                  label: 'GI 261 (BAHAN)',
                  value:
                    unitMode === 'TON'
                      ? secondaryStats.gi261Ton.toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : secondaryStats.gi261Pcs.toLocaleString('id-ID'),
                  desc:
                    unitMode === 'TON'
                      ? `${secondaryStats.gi261Pcs.toLocaleString('id-ID')} PCS masuk lini`
                      : `${secondaryStats.gi261Ton.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`,
                  dot: 'var(--neu-red-bar)',
                  icon: Box,
                  color: 'text-[var(--neu-red)]',
                  isActive: moveTypeFilter === '261',
                  onClick: () => setMoveTypeFilter(moveTypeFilter === '261' ? '' : '261'),
                },
                {
                  key: 'retur',
                  label: 'RETUR (262/102)',
                  value:
                    unitMode === 'TON'
                      ? secondaryStats.returnTon.toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : secondaryStats.returnPcs.toLocaleString('id-ID'),
                  desc:
                    unitMode === 'TON'
                      ? `${secondaryStats.returnPcs.toLocaleString('id-ID')} PCS retur`
                      : `${secondaryStats.returnTon.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`,
                  dot: 'var(--neu-amber-bar)',
                  icon: Package,
                  color: 'text-[var(--neu-amber)]',
                  isActive: moveTypeFilter === '262',
                  onClick: () => setMoveTypeFilter(moveTypeFilter === '262' ? '' : '262'),
                  span: 'col-span-2 md:col-span-1',
                },
              ].map(card => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  className={cn(
                    'p-4 rounded-2xl transition-neu cursor-pointer text-left flex flex-col justify-between group',
                    card.isActive
                      ? 'neu-inset border border-[var(--neu-accent-border)]'
                      : 'neu-card neu-card-interactive active:shadow-[var(--neu-shadow-inset-sm)]',
                    card.span
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider truncate">
                      {card.label}
                    </span>
                    <span
                      className={cn(
                        'w-7 h-7 rounded-xl neu-icon-inset flex items-center justify-center shrink-0',
                        card.color
                      )}
                    >
                      <card.icon size={12} strokeWidth={2.4} />
                    </span>
                  </div>

                  <div className="text-[24px] font-extrabold text-[var(--neu-text)] mt-2.5 tabular-nums leading-none">
                    {card.value}{' '}
                    <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">
                      {unitMode}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[var(--neu-divider)] flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[var(--neu-text-muted)] truncate flex items-center gap-1.5 font-medium">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: card.dot }}
                      />
                      {card.desc}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[10px] font-bold shrink-0',
                        card.isActive ? 'text-[var(--neu-accent)]' : 'text-[var(--neu-text-muted)] group-hover:text-[var(--neu-accent)]'
                      )}
                    >
                      {card.isActive ? 'Aktif' : 'Filter'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* ─── Analisis Pergerakan Material (Tren & Distribusi) ─── */}
          <section aria-label="Analisis Pergerakan Material">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Daily Trend Chart */}
              <motion.article
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className="lg:col-span-7 neu-card p-5 sm:p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Header & Recessed Legend Pill */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-[var(--neu-divider)]">
                    <div>
                      <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                        Tren Pergerakan Harian
                      </h2>
                      <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                        Bahan Masuk (GI) vs Selesai (GR) (TON), 7 Hari Terakhir
                      </p>
                    </div>
                    <div className="neu-inset-sm px-3 py-1.5 rounded-full flex items-center gap-3.5 text-[11.5px] font-semibold text-[var(--neu-text-secondary)] self-start">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.inBar }} />
                        Masuk (GR)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.outBar }} />
                        Keluar (GI)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: chartColors.netLine }} />
                        Net
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
                        +{trendTotals.totalMasuk.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                        <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
                      </span>
                    </div>
                    <div className="neu-inset-sm px-3.5 py-2.5 rounded-2xl flex flex-col">
                      <span className="font-mono text-[10px] text-[var(--neu-red)] font-semibold uppercase tracking-wider">
                        Total Keluar
                      </span>
                      <span className="text-[15px] sm:text-[16px] font-extrabold text-[var(--neu-text)] tabular-nums mt-0.5">
                        -{trendTotals.totalKeluar.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                        <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
                      </span>
                    </div>
                    <div className="neu-inset-sm px-3.5 py-2.5 rounded-2xl flex flex-col">
                      <span className="font-mono text-[10px] text-[var(--neu-accent)] font-semibold uppercase tracking-wider">
                        Net Movement
                      </span>
                      <span className="text-[15px] sm:text-[16px] font-extrabold text-[var(--neu-accent)] tabular-nums mt-0.5">
                        {trendTotals.net >= 0 ? '+' : ''}
                        {trendTotals.net.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                        <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
                      </span>
                    </div>
                  </div>

                  {/* Composed Chart */}
                  <div className="relative w-full h-56 pt-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={dailyTrend} margin={{ top: 8, right: 10, left: -14, bottom: 4 }} barGap={5}>
                        <CartesianGrid vertical={false} stroke={chartColors.grid} />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: chartColors.tick, fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: chartColors.axis }}
                          tickFormatter={val => val.split('-').slice(1).reverse().join('/')}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: chartColors.tick, fontWeight: 500 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={val => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${Number(val.toFixed(1))}T`)}
                        />
                        <Tooltip content={renderChartTooltip} cursor={{ fill: chartColors.cursor, radius: 6 }} />
                        <Bar
                          dataKey="masuk"
                          name="Masuk (GR)"
                          fill={chartColors.inBar}
                          radius={[5, 5, 0, 0]}
                          barSize={20}
                        />
                        <Bar
                          dataKey="keluar"
                          name="Keluar (GI)"
                          fill={chartColors.outBar}
                          radius={[5, 5, 0, 0]}
                          barSize={20}
                        />
                        <Area
                          type="monotone"
                          dataKey="net"
                          fill={chartColors.netLine}
                          fillOpacity={0.09}
                          stroke="none"
                        />
                        <Line
                          type="monotone"
                          dataKey="net"
                          name="Net Flow"
                          stroke={chartColors.netLine}
                          strokeWidth={2.6}
                          dot={{ r: 3.5, fill: chartColors.dotFill, strokeWidth: 2.4, stroke: chartColors.netLine }}
                          activeDot={{ r: 5.5, fill: chartColors.netLine, strokeWidth: 2, stroke: chartColors.dotFill }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--neu-divider)] flex items-center justify-between text-[11px] text-[var(--neu-text-muted)]">
                  <span>Rentang kalkulasi</span>
                  <span className="font-mono font-semibold text-[var(--neu-text-secondary)]">{trendRangeStr}</span>
                </div>
              </motion.article>

              {/* Work Center Distribution */}
              <motion.article
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06, duration: 0.25, ease: easeOut }}
                className="lg:col-span-5 neu-card p-5 sm:p-6 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 pb-4 border-b border-[var(--neu-divider)]">
                    <div>
                      <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                        Distribusi Work Center
                      </h2>
                      <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                        Proporsi aktivitas mutasi lini MP* &amp; Rep*
                      </p>
                    </div>
                    {workCenterFilter ? (
                      <button
                        type="button"
                        onClick={() => setWorkCenterFilter('')}
                        className="h-7.5 px-3 rounded-xl text-[11px] font-bold neu-btn text-[var(--neu-red)] cursor-pointer shrink-0"
                      >
                        Reset Filter
                      </button>
                    ) : (
                      <span className="neu-chip shrink-0">{Math.min(6, byWorkCenter.length)} Lini Utama</span>
                    )}
                  </div>

                  <div className="mt-4 space-y-3">
                    {byWorkCenter.slice(0, 6).map((wc, idx) => {
                      const totalTonWc = wc.tonIn + wc.tonOut;
                      const totalAll = metrics.totalTonIn + metrics.totalTonOut;
                      const pct = totalAll > 0 ? (totalTonWc / totalAll) * 100 : 0;
                      const isSelected = workCenterFilter === wc.workCenter;

                      return (
                        <button
                          key={wc.workCenter}
                          type="button"
                          onClick={() => setWorkCenterFilter(isSelected ? '' : wc.workCenter)}
                          className={cn(
                            'w-full p-3.5 rounded-2xl transition-neu cursor-pointer text-left',
                            isSelected
                              ? 'neu-inset border border-[var(--neu-accent-border)]'
                              : 'neu-card-sm neu-card-interactive'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-lg neu-icon-inset font-mono font-bold text-[10.5px] text-[var(--neu-accent)] flex items-center justify-center shrink-0">
                                {idx + 1}
                              </span>
                              <span className="font-mono font-bold text-[12.5px] text-[var(--neu-text)] truncate">
                                {wc.workCenter}
                              </span>
                              <span
                                className={cn(
                                  'font-mono px-1.5 py-0.5 rounded-md text-[9.5px] font-bold shrink-0',
                                  wc.category === 'REPAIR'
                                    ? 'bg-[var(--neu-purple-soft)] text-[var(--neu-purple)]'
                                    : 'bg-[var(--neu-accent-soft)] text-[var(--neu-accent)]'
                                )}
                              >
                                {wc.category}
                              </span>
                              {isSelected && <span className="neu-chip !py-0 !px-2 text-[9.5px]">Aktif</span>}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono font-bold text-[12px] text-[var(--neu-text)] tabular-nums">
                                {totalTonWc.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{' '}
                                <span className="text-[10px] font-medium text-[var(--neu-text-muted)]">T</span>
                              </span>
                              <span className="font-mono px-1.5 py-0.5 rounded-lg neu-inset-sm font-bold text-[10px] text-[var(--neu-accent)] tabular-nums">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          <div className="w-full h-2.5 rounded-full neu-inset-sm p-0.5 overflow-hidden flex">
                            <div
                              className="h-full rounded-l-full"
                              style={{
                                width: `${totalTonWc > 0 ? (wc.tonIn / totalTonWc) * 100 : 0}%`,
                                backgroundColor: 'var(--neu-green-bar)',
                              }}
                              title={`GR Masuk: ${wc.tonIn.toFixed(1)} T`}
                            />
                            <div
                              className="h-full rounded-r-full"
                              style={{
                                width: `${totalTonWc > 0 ? (wc.tonOut / totalTonWc) * 100 : 0}%`,
                                backgroundColor: 'var(--neu-red-bar)',
                              }}
                              title={`GI Keluar: ${wc.tonOut.toFixed(1)} T`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10.5px] mt-2 text-[var(--neu-text-muted)] font-medium">
                            <span>
                              In:{' '}
                              <strong className="font-mono text-[var(--neu-green)] font-bold">
                                {wc.tonIn.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}T
                              </strong>{' '}
                              &middot; Out:{' '}
                              <strong className="font-mono text-[var(--neu-red)] font-bold">
                                {wc.tonOut.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}T
                              </strong>
                            </span>
                            <span className="font-mono font-semibold text-[var(--neu-text-secondary)]">
                              {(wc.pcsIn + wc.pcsOut).toLocaleString('id-ID')} Pcs
                            </span>
                          </div>
                        </button>
                      );
                    })}

                    {byWorkCenter.length === 0 && (
                      <div className="neu-inset-sm rounded-2xl p-6 text-center space-y-2">
                        <p className="text-xs font-bold text-[var(--neu-text-secondary)]">
                          {loading ? 'Memuat data work center...' : 'Belum ada transaksi pada periode ini'}
                        </p>
                        {!loading && datePreset === 'today' && (
                          <button
                            type="button"
                            onClick={() => applyPreset('30d')}
                            className="h-8 px-3.5 rounded-xl text-[11px] font-bold neu-btn text-[var(--neu-accent)] cursor-pointer"
                          >
                            Lihat 30 Hari Terakhir
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--neu-divider)] flex items-center justify-between text-[11px] text-[var(--neu-text-muted)]">
                  <span>Klik work center untuk menyaring</span>
                  <span className="font-mono font-semibold text-[var(--neu-text-secondary)]">
                    {byWorkCenter.length} Work Center
                  </span>
                </div>
              </motion.article>
            </div>
          </section>

          {/* ─── Work Center & Analitik Transaksi ─── */}
          <section aria-label="Work Center & Analitik Transaksi">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Work Center Grid Detail */}
              <article className="lg:col-span-7 neu-card p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--neu-divider)] pb-4 mb-4">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                        Rincian Work Center Lini Produksi
                      </h3>
                      <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                        Perbandingan bahan keluar (GI) dan pipa selesai (GR) tiap mesin
                      </p>
                    </div>
                    <span className="neu-chip shrink-0">{byWorkCenter.length} Work Center</span>
                  </div>

                  {byWorkCenter.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {byWorkCenter.map(wc => {
                        const isSelected = workCenterFilter === wc.workCenter;
                        return (
                          <button
                            key={wc.workCenter}
                            type="button"
                            onClick={() => setWorkCenterFilter(isSelected ? '' : wc.workCenter)}
                            className={cn(
                              'p-4 rounded-2xl transition-neu cursor-pointer text-left',
                              isSelected
                                ? 'neu-inset border border-[var(--neu-accent-border)]'
                                : 'neu-card-sm neu-card-interactive'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono font-extrabold text-[13.5px] text-[var(--neu-text)] truncate">
                                  {wc.workCenter}
                                </span>
                                {isSelected && <span className="neu-chip !py-0 !px-2 text-[9.5px]">Terpilih</span>}
                              </div>
                              <span
                                className={cn(
                                  'font-mono px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0',
                                  wc.category === 'REPAIR'
                                    ? 'bg-[var(--neu-purple-soft)] text-[var(--neu-purple)]'
                                    : 'bg-[var(--neu-accent-soft)] text-[var(--neu-accent)]'
                                )}
                              >
                                {wc.category}
                              </span>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2.5">
                              <div className="neu-inset-sm rounded-xl px-2.5 py-2">
                                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider block text-[var(--neu-text-muted)]">
                                  GI (Keluar)
                                </span>
                                <span className="font-mono font-bold text-[12.5px] text-[var(--neu-red)] tabular-nums mt-0.5 block">
                                  {unitMode === 'TON'
                                    ? `${wc.tonOut.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} T`
                                    : `${wc.pcsOut.toLocaleString('id-ID')} Pcs`}
                                </span>
                              </div>
                              <div className="neu-inset-sm rounded-xl px-2.5 py-2">
                                <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider block text-[var(--neu-text-muted)]">
                                  GR (Masuk)
                                </span>
                                <span className="font-mono font-bold text-[12.5px] text-[var(--neu-green)] tabular-nums mt-0.5 block">
                                  {unitMode === 'TON'
                                    ? `${wc.tonIn.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} T`
                                    : `${wc.pcsIn.toLocaleString('id-ID')} Pcs`}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 pt-2.5 border-t border-[var(--neu-divider)] flex items-center justify-between text-[11px]">
                              <span className="text-[var(--neu-text-muted)] font-medium">
                                {wc.records.toLocaleString('id-ID')} transaksi
                              </span>
                              <span className="font-mono font-bold text-[var(--neu-text-secondary)] tabular-nums">
                                {(wc.pcsIn + wc.pcsOut).toLocaleString('id-ID')} Pcs
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="neu-inset-sm rounded-2xl p-8 text-center">
                      <p className="text-xs font-semibold text-[var(--neu-text-muted)]">
                        {loading ? 'Memuat rincian work center...' : 'Tidak ada rincian work center untuk filter aktif.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-[var(--neu-divider)] flex items-center justify-between text-xs text-[var(--neu-text-muted)]">
                  <span>Total record work center terdata</span>
                  <span className="neu-chip">{metrics.totalRecords.toLocaleString('id-ID')} Transaksi</span>
                </div>
              </article>

              {/* SAP Move Types Detail */}
              <article className="lg:col-span-5 neu-card p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--neu-divider)] pb-4 mb-4">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                        Tipe Mutasi SAP
                      </h3>
                      <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                        Ringkasan kode pergerakan material lini repair &amp; packing
                      </p>
                    </div>
                    {moveTypeFilter ? (
                      <button
                        type="button"
                        onClick={() => setMoveTypeFilter('')}
                        className="h-7.5 px-3 rounded-xl text-[11px] font-bold neu-btn text-[var(--neu-red)] cursor-pointer shrink-0"
                      >
                        Reset Filter
                      </button>
                    ) : (
                      <span className="neu-chip shrink-0">{byMoveType.length} Kode</span>
                    )}
                  </div>

                  {byMoveType.length > 0 ? (
                    <div className="space-y-2.5">
                      {byMoveType.map(mvt => {
                        const isSelected = moveTypeFilter === mvt.moveType;
                        const isMasuk = mvt.group === 'Masuk' || mvt.moveType === '101' || mvt.moveType === '262';
                        return (
                          <button
                            key={mvt.moveType}
                            type="button"
                            onClick={() => setMoveTypeFilter(isSelected ? '' : mvt.moveType)}
                            className={cn(
                              'w-full p-3.5 rounded-2xl transition-neu cursor-pointer text-left',
                              isSelected
                                ? 'neu-inset border border-[var(--neu-accent-border)]'
                                : 'neu-card-sm neu-card-interactive'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: mvt.color }}
                                />
                                <span className="font-mono font-bold text-[11.5px] px-2 py-0.5 rounded-lg neu-inset-sm text-[var(--neu-text)] shrink-0">
                                  {mvt.moveType}
                                </span>
                                <span
                                  className={cn(
                                    'font-mono px-1.5 py-0.5 rounded-md text-[9.5px] font-bold shrink-0',
                                    isMasuk
                                      ? 'bg-[var(--neu-green-soft)] text-[var(--neu-green)]'
                                      : 'bg-[var(--neu-red-soft)] text-[var(--neu-red)]'
                                  )}
                                >
                                  {isMasuk ? 'IN' : 'OUT'}
                                </span>
                                <span className="text-[12.5px] font-semibold truncate text-[var(--neu-text-secondary)]">
                                  {mvt.description}
                                </span>
                                {isSelected && <span className="neu-chip !py-0 !px-2 text-[9.5px]">Filter</span>}
                              </div>
                              <span className="font-mono text-[11px] font-bold text-[var(--neu-text-muted)] shrink-0 tabular-nums">
                                {mvt.records.toLocaleString('id-ID')} trx
                              </span>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-[var(--neu-divider)] flex items-center justify-between text-xs font-mono">
                              <span className="text-[var(--neu-text-muted)] tabular-nums">
                                {mvt.pcs.toLocaleString('id-ID')} Pcs
                              </span>
                              <span className="font-bold text-[var(--neu-text)] tabular-nums">
                                {mvt.ton.toLocaleString('id-ID', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                <span className="text-[10px] font-medium text-[var(--neu-text-muted)]">TON</span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="neu-inset-sm rounded-2xl p-8 text-center">
                      <p className="text-xs font-semibold text-[var(--neu-text-muted)]">
                        {loading ? 'Memuat tipe mutasi...' : 'Tidak ada tipe mutasi untuk filter aktif.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Aggregate Footer Bar */}
                <div className="mt-4 px-3.5 py-2.5 rounded-2xl neu-inset-sm flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                    Net Output
                  </span>
                  <span
                    className={cn(
                      'font-mono font-extrabold text-[13px] tabular-nums',
                      metrics.netTon >= 0 ? 'text-[var(--neu-green)]' : 'text-[var(--neu-red)]'
                    )}
                  >
                    {metrics.netTon >= 0 ? '+' : ''}
                    {metrics.netTon.toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    <span className="text-[10px] font-semibold text-[var(--neu-text-muted)]">TON</span>
                  </span>
                </div>
              </article>
            </div>
          </section>

          {/* ─── Neumorphic Footer ─── */}
          <footer className="neu-card-sm px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--neu-text-muted)] gap-3 mt-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" />
              <span className="font-mono text-[11px]">Operasional Repair &amp; Packing</span>
            </div>
            <div className="flex items-center">
              <span>&copy; 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
            </div>
          </footer>
        </motion.div>
      </div>

      {/* ─── Fallback Preview / Manual Copy Modal ─── */}
      <AnimatePresence>
        {previewModalOpen && capturedImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-[2px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="neu-float max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--neu-text)]">Pratinjau Gambar Dashboard</h3>
                  <p className="text-[11.5px] text-[var(--neu-text-muted)]">
                    Klik tombol di bawah atau klik kanan gambar lalu pilih &ldquo;Copy Image&rdquo;
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="p-2 rounded-xl neu-btn text-[var(--neu-text-muted)] cursor-pointer"
                  aria-label="Tutup pratinjau"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto max-h-[62vh] bg-[var(--neu-bg)] flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedImageUrl}
                  alt="Dashboard Preview"
                  className="rounded-xl border border-[var(--neu-border)] max-w-full h-auto object-contain cursor-pointer"
                  title="Klik kanan lalu pilih 'Salin Gambar' (Copy Image)"
                />
              </div>

              <div className="px-5 py-3.5 border-t border-[var(--neu-divider)] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleDownloadFromModal}
                  className="h-9 px-3.5 rounded-xl text-xs font-bold neu-btn flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={13} />
                  <span>Unduh PNG</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    className="h-9 px-3.5 rounded-xl text-xs font-bold text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] cursor-pointer"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyFromModal}
                    className={cn(
                      'h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer',
                      modalCopied ? 'neu-inset-sm text-[var(--neu-green)]' : 'neu-btn-primary'
                    )}
                  >
                    {modalCopied ? (
                      <>
                        <Check size={13} strokeWidth={2.5} />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} strokeWidth={2} />
                        <span>Salin ke Clipboard</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
