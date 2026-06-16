'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  FileUp, Printer, LayoutDashboard, Layout,
  Upload, Check, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseSapExcel, ProcessedMovement, MovementStats, calculateStats, ProcessedStock } from '@/lib/excel-parser';
import { getUserGudang, filterByGudang, getGudangPrefix, gudangFromSloc, reclassify311, removeInternalTfSloc, classifyBatch } from '@/lib/gudang';
import { StatsCard } from '@/components/StatsCard';
import { MovementTable } from '@/components/MovementTable';
import { MovementChart } from '@/components/MovementChart';
import { WorkCenterBreakdown } from '@/components/WorkCenterBreakdown';
import { StockReport, StockReportSummary } from '@/components/StockReport';
import { FastSlowTransactionChart } from '@/components/FastSlowTransactionChart';
import { SortableGrid, SortableItem } from '@/components/SortableGrid';
import { PageHeader } from '@/components/PageHeader';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';

// ─── Types ───
interface HistorySession {
  reportSessionId: string;
  label: string;
  dateStr: string;
  fileName?: string;
  createdAt: string;
  totalCount: number;
}

interface MovementSummaryItem {
  movementSummaryId: string;
  dateStr: string;
  moveType: string;
  description: string;
  workCenter: string | null;
  group: string;
  color: string;
  totalQuantity: number;
  totalCount: number;
}

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [movements, setMovements] = useState<ProcessedMovement[]>([]);
  const [movementSummaries, setMovementSummaries] = useState<MovementSummaryItem[] | null>(null);
  const [stocks, setStocks] = useState<ProcessedStock[]>([]);
  const [stockSummary, setStockSummary] = useState<StockReportSummary | undefined>(undefined);
  const [stats, setStats] = useState<MovementStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportMode, setReportMode] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [history, setHistory] = useState<HistorySession[]>([]);
  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ─── Drag & drop layout order (report mode) ───
  const [leftOrder, setLeftOrder] = useState<string[]>(['workcenter', 'stock']);
  const [rightOrder, setRightOrder] = useState<string[]>(['movement-chart', 'movement-table', 'fastslow']);
  useEffect(() => {
    try {
      const l = localStorage.getItem('report-layout-left');
      if (l) setLeftOrder(JSON.parse(l));
      const r = localStorage.getItem('report-layout-right');
      if (r) setRightOrder(JSON.parse(r));
    } catch { /* ignore */ }
  }, []);

  // ─── Load history list ───
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) setHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  const gudangFiltered = useMemo(() => {
    if (!selectedGudang) return movements;
    return reclassify311(
      filterByGudang(
        removeInternalTfSloc(movements),
        selectedGudang
      ),
      selectedGudang
    );
  }, [movements, selectedGudang]);

  const filteredMovements = useMemo(() => {
    let result = gudangFiltered;
    if (startDate) result = result.filter(m => m.dateStr >= startDate);
    if (endDate) result = result.filter(m => m.dateStr <= endDate);
    return result;
  }, [gudangFiltered, startDate, endDate]);

  const filteredStocks = useMemo(() => {
    if (!selectedGudang || !stocks.length) return stocks;
    const prefix = getGudangPrefix(selectedGudang);
    if (!prefix) return stocks;
    return stocks.filter(s => (s.sloc || '').toUpperCase().startsWith(prefix));
  }, [stocks, selectedGudang]);

  const filteredStats = useMemo(() => {
    if (!filteredMovements.length) return null;
    if (!selectedGudang && !startDate && !endDate && stats) return stats;
    return calculateStats(filteredMovements);
  }, [filteredMovements, selectedGudang, startDate, endDate, stats]);

  // ─── Navigate to outbound destination breakdown ───
  const handleOutboundClick = useCallback(() => {
    const params = new URLSearchParams();
    if (activeSessionId) params.set('reportSessionId', activeSessionId);
    if (selectedGudang) params.set('gudang', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/outbound-destination?${params.toString()}`);
  }, [activeSessionId, selectedGudang, startDate, endDate, router]);

  // ─── Aggregated chart data: use MovementSummary when no filter ───
  const chartMovements = useMemo((): ProcessedMovement[] => {
    if (!selectedGudang && !startDate && !endDate && movementSummaries && movementSummaries.length > 0) {
      return movementSummaries.map(s => ({
        movementId: s.movementSummaryId,
        postingDate: new Date(s.dateStr),
        dateStr: s.dateStr,
        moveType: s.moveType,
        description: s.description,
        group: s.group as ProcessedMovement['group'],
        workCenter: s.workCenter || '',
        batch: '',
        quantity: s.totalQuantity,
        unitQuantity: 0,
        userName: '',
        storageLocation: '',
        color: s.color,
        movementStatus: 'Unknown' as const,
      }));
    }
    return filteredMovements;
  }, [filteredMovements, movementSummaries, selectedGudang, startDate, endDate]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadGen = useRef(0);

  // ─── Load a saved session ───
  const loadSession = async (id: string) => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) return;
      if (gen !== loadGen.current) return; // superseded by newer operation
      const data = await res.json();

      // ── New session: pre-calculated stats + aggregated summaries ──
      if (data.stats) {
        setStats(data.stats);
        setMovementSummaries(data.movementSummaries || null);
      }

      // ── Raw movements for detail table & gudang filtering ──
      const movs: ProcessedMovement[] = data.movements.map((m: any) => ({
        movementId: m.movementId || `move-${Math.random()}`,
        postingDate: new Date(m.postingDate),
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        workCenter: m.workCenter || '',
        batch: m.batch || '',
        quantity: m.quantity,
        unitQuantity: m.unitQuantity || 0,
        userName: m.userName || '',
        storageLocation: m.storageLocation || '',
        group: m.group || 'Transfer',
        color: m.color || '#94a3b8',
        movementStatus: classifyBatch(m.batch || ''),
      }));
      // Fallback: if no stats, calculate from raw movements (legacy)
      if (!data.stats) {
        setStats(calculateStats(movs));
        setMovementSummaries(null);
      }

      let stks: ProcessedStock[] = data.stocks;
      if (stks.length === 0 && data.stockCards?.length > 0) {
        stks = data.stockCards.map((sc: any) => ({
          status: (sc.pasm || '').toUpperCase() === 'FAST' ? 'Fast Moving'
                : (sc.pasm || '').toUpperCase() === 'SLOW' ? 'Slow Moving'
                : 'Unknown',
          sloc: sc.sloc || '',
          quantity: sc.ttlStokEom || 0,
          tonnage: sc.ttlStokEom || 0,
        }));
      }

      setMovements(movs);
      setStocks(stks);

      // ── Build pre-aggregated stock summary from server-side StockSummary rows ──
      // Falls back to undefined (client-side aggregation) for legacy sessions
      // that don't have StockSummary rows yet.
      if (Array.isArray(data.stockSummaries) && data.stockSummaries.length > 0) {
        const bucket = (): { count: number; totalTon: number } => ({ count: 0, totalTon: 0 });
        const next: StockReportSummary = { fast: bucket(), slow: bucket(), penampungan: bucket() };
        for (const r of data.stockSummaries) {
          const ton = (r.totalWeight || 0) / 1000;
          if (r.status === 'Fast Moving') {
            next.fast.count += r.itemCount || 0;
            next.fast.totalTon += ton;
          } else if (r.status === 'Slow Moving') {
            next.slow.count += r.itemCount || 0;
            next.slow.totalTon += ton;
          } else if (r.status === 'Sloc Penampungan') {
            next.penampungan.count += r.itemCount || 0;
            next.penampungan.totalTon += ton;
          }
        }
        setStockSummary(next);
      } else {
        setStockSummary(undefined);
      }

      setActiveSessionId(id);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load latest session when page opens with no data
  useEffect(() => {
    if (!movements.length && !stocks.length && history.length > 0 && !loading) {
      loadSession(history[0].reportSessionId);
    }
  }, [history, movements, stocks, loading]);

  
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'admin' && session.user.gudangId) {
        setSelectedGudang(session.user.gudangId);
      }
    }
  }, [status, session]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // ─── Protected Routes Handling ───
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  // ─── Save to DB ───
  const saveToDb = async (movs: ProcessedMovement[], stks: ProcessedStock[], fileName: string, stockCards?: any[]) => {
    setSaving(true);
    try {
      // Robust date extraction: find the most frequent dateStr in the movements
      const dateCounts: Record<string, number> = {};
      movs.forEach(m => { dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1; });
      const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);
      
      let dateStr = '';
      if (sortedDates.length > 0) {
        dateStr = sortedDates[0][0];
      } else {
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }

      // Find a movement sample with this date to get the label
      const sampleMov = movs.find(m => m.dateStr === dateStr) || movs[0];

      // Use manual string parsing for the label to be 100% sure
      let label = dateStr;
      if (sampleMov?.dateStr) {
        const parts = sampleMov.dateStr.split('-');
        if (parts.length === 3) {
          const y = parts[0];
          const m = parseInt(parts[1]);
          const d = parts[2];
          const monthsNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          label = `${d.padStart(2, '0')} ${monthsNames[m - 1]} ${y}`;
        }
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          dateStr,
          fileName,
          movements: movs.map(m => ({
            ...m,
            postingDate: m.dateStr, // Send YYYY-MM-DD string to avoid UTC shift
          })),
          stocks: stks,
          stockCards: stockCards || undefined,
        }),
      });

      if (res.ok) {
        const { reportSessionId } = await res.json();
        setActiveSessionId(reportSessionId);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        await loadHistory();
      }
    } finally {
      setSaving(false);
    }
  };

  // ─── Upload handler ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    loadGen.current++; // bump to cancel any in-flight loadSession

    setLoading(true);
    setActiveSessionId(null);
    setSaved(false);
    try {
      const result = await parseSapExcel(file);
      const calculatedStats = calculateStats(result.movements);
      setMovements(result.movements);
      setStocks(result.stocks);
      setStats(calculatedStats);
      // Auto-save
      await saveToDb(result.movements, result.stocks, file.name, result.stockCards);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Gagal memproses file. Pastikan format file SAP Excel benar.');
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const resetData = () => {
    setMovements([]);
    setStocks([]);
    setStats(null);
    setActiveSessionId(null);
    setSaved(false);
  };

  // ─── Loading state (auto-load in progress) ───
  if (!movements.length && !stocks.length && loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#C4E2F5]/20 via-white to-[#C4E2F5]/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-[#4BB8FA]/20 border-t-[#1591DC] rounded-full animate-spin" />
          <p className="text-xs font-medium text-[#1591DC]/60 animate-pulse">Memuat data terbaru...</p>
        </div>
      </main>
    );
  }

  // ─── First-time: no data & no history → show upload prompt inline ───
  if (!movements.length && !stocks.length && history.length === 0) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#C4E2F5]/20 via-white to-[#C4E2F5]/20 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C4E2F5]/50 to-[#4BB8FA]/20 flex items-center justify-center border border-[#C4E2F5]/50">
            <Upload size={28} className="text-[#1591DC]" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#2C5EAD] mb-1">Warehouse Intelligence</h1>
            <p className="text-sm text-[#1591DC]/70">Unggah laporan SAP Excel untuk memulai.</p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] hover:from-[#4BB8FA] hover:to-[#1591DC] text-white rounded-xl text-sm font-semibold shadow-lg shadow-[#1591DC]/25 transition-all"
          >
            Pilih File SAP Excel
          </motion.button>
        </div>
      </main>
    );
  }

  // ─── Dashboard / Report ───
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#C4E2F5]/20 via-white to-[#C4E2F5]/20 selection:bg-[#4BB8FA]/25 selection:text-[#2C5EAD]">
      <PageHeader icon={LayoutDashboard} title="Warehouse" subtitle="Dashboard gudang SPINDO" className="print:hidden">

        {/* ─── Gudang Select (admin can switch; non-admin locked to own) ─── */}
        {session?.user?.role === 'admin' && (
          <select
            value={selectedGudang ?? ''}
            onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
          className="h-8 text-[11px] font-semibold text-[#2C5EAD] bg-white/70 border border-[#C4E2F5]/50 rounded-xl px-2.5 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/25 cursor-pointer hover:bg-white transition-all"
        >
          <option value="">🌐 Semua Gudang</option>
          {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
            <option key={n} value={n}>📍 Gudang {n}{n === sessionGudang ? ' ★' : ''}</option>
          ))}
        </select>
        )}

        {/* ─── Date Filter ─── */}
        <div className="flex items-center gap-1 h-8 bg-white/70 border border-[#C4E2F5]/50 rounded-xl px-2">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="h-full text-[10px] font-medium text-[#2C5EAD] bg-transparent border-none outline-none w-24 lg:w-28 cursor-pointer [color-scheme:light]"
          />
          <span className="text-[9px] text-[#4BB8FA] font-semibold">→</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="h-full text-[10px] font-medium text-[#2C5EAD] bg-transparent border-none outline-none w-24 lg:w-28 cursor-pointer [color-scheme:light]"
          />
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="p-1 text-[#1591DC] hover:text-[#2C5EAD] rounded-md hover:bg-white/60 transition-all"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept=".xlsx, .xls"
          className="hidden"
        />

        {/* ─── Saving / Saved indicator ─── */}
        <AnimatePresence>
          {(saving || saved) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-1 px-2.5 h-8 rounded-xl text-[10px] font-bold ${
                saving
                  ? 'text-[#1591DC] bg-[#C4E2F5]/40'
                  : 'text-emerald-600 bg-emerald-50'
              }`}
            >
              {saving ? (
                <div className="w-3 h-3 border-[2px] border-[#4BB8FA]/30 border-t-[#1591DC] rounded-full animate-spin" />
              ) : (
                <Check size={12} strokeWidth={2.5} />
              )}
              {saving ? 'Menyimpan...' : 'Tersimpan'}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-px h-5 bg-[#C4E2F5]/50" />

        {/* ─── Buttons ─── */}
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-[11px] font-semibold text-[#1591DC] bg-white/70 border border-[#C4E2F5]/50 rounded-xl hover:bg-white hover:border-[#4BB8FA]/40 transition-all"
        >
          <FileUp size={13} strokeWidth={2} />
          <span className="hidden sm:inline">Upload</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
          onClick={() => setReportMode(!reportMode)}
          className={`h-8 inline-flex items-center gap-1.5 px-3 text-[11px] font-semibold rounded-xl transition-all duration-200 ${
            reportMode
              ? 'bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] text-white shadow-sm shadow-[#1591DC]/20'
              : 'text-[#1591DC] bg-white/70 border border-[#C4E2F5]/50 hover:bg-white hover:border-[#4BB8FA]/40'
          }`}
        >
          {reportMode ? <LayoutDashboard size={13} strokeWidth={2} /> : <Layout size={13} strokeWidth={2} />}
          <span className="hidden sm:inline">{reportMode ? 'Dashboard' : 'Report'}</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.95 }}
          onClick={() => window.print()}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-[11px] font-semibold text-white bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] rounded-xl hover:from-[#4BB8FA] hover:to-[#1591DC] shadow-sm shadow-[#1591DC]/20 transition-all"
        >
          <Printer size={13} strokeWidth={2} />
          <span className="hidden sm:inline">Cetak</span>
        </motion.button>
      </PageHeader>

      {/* ─── Page Content ─── */}
      <div ref={contentRef} className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-5 lg:py-6">
        <AnimatePresence mode="wait">

          {/* ═══════════ COMPACT / PRESENTER MODE ═══════════ */}
          {reportMode ? (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:gap-4">
                <StatsCard title="Incoming" value={filteredStats ? filteredStats.totalIncoming.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="in" condensed delay={0.05} />
                <StatsCard title="Outgoing" value={filteredStats ? filteredStats.totalOutgoing.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="out" condensed delay={0.1} onClick={handleOutboundClick} />
                <StatsCard title="Net Flow" value={(filteredStats?.netMovement || 0).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" type={(filteredStats?.netMovement || 0) >= 0 ? 'in' : 'out'} condensed delay={0.15} />
                <StatsCard title="Transactions" value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString()} unit="TRX" type="total" condensed delay={0.2} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 xl:gap-4">
                <div className="md:col-span-12 lg:col-span-5">
                  <SortableGrid
                    items={leftOrder}
                    onReorder={items => { setLeftOrder(items); localStorage.setItem('report-layout-left', JSON.stringify(items)); }}
                    className="flex flex-col gap-4"
                  >
                    {leftOrder.map(id => {
                      if (id === 'workcenter') return <SortableItem key="workcenter" id="workcenter"><WorkCenterBreakdown data={chartMovements} condensed /></SortableItem>;
                      if (id === 'stock') return <SortableItem key="stock" id="stock"><StockReport data={filteredStocks} summary={stockSummary} condensed /></SortableItem>;
                      return null;
                    })}
                  </SortableGrid>
                </div>
                <div className="md:col-span-12 lg:col-span-7">
                  <SortableGrid
                    items={rightOrder}
                    onReorder={items => { setRightOrder(items); localStorage.setItem('report-layout-right', JSON.stringify(items)); }}
                    className="flex flex-col gap-4"
                  >
                    {rightOrder.map(id => {
                      if (id === 'movement-chart') return <SortableItem key="movement-chart" id="movement-chart"><MovementChart data={chartMovements} condensed useAllData selectedGudang={selectedGudang} /></SortableItem>;
                      if (id === 'movement-table') return <SortableItem key="movement-table" id="movement-table"><MovementTable data={filteredMovements} condensed /></SortableItem>;
                      if (id === 'fastslow') return <SortableItem key="fastslow" id="fastslow"><FastSlowTransactionChart data={filteredMovements} condensed /></SortableItem>;
                      return null;
                    })}
                  </SortableGrid>
                </div>
              </div>
            </motion.div>

          ) : (

          /* ═══════════ FULL DASHBOARD MODE ═══════════ */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-7 pb-12"
            >
              <section>
                <SectionTitle>Key Performance Indicators</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                  <StatsCard title="Total Inbound" value={filteredStats ? filteredStats.totalIncoming.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${filteredStats?.incomingCount.toLocaleString('id-ID') || '0'} transaksi masuk`} type="in" delay={0.05} />
                  <StatsCard title="Total Outbound" value={filteredStats ? filteredStats.totalOutgoing.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${filteredStats?.outgoingCount.toLocaleString('id-ID') || '0'} transaksi keluar`} type="out" delay={0.1} onClick={handleOutboundClick} />
                  <StatsCard title="Net Flow" value={(filteredStats?.netMovement || 0).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" subtitle="Selisih material masuk & keluar" type={(filteredStats?.netMovement || 0) >= 0 ? 'in' : 'out'} delay={0.15} />
                  <StatsCard title="Total Transaksi" value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString()} unit="TRX" subtitle="Total row data dari SAP" type="total" delay={0.2} />
                </div>
              </section>

              <section>
                <SectionTitle>Analisis Pergerakan Material</SectionTitle>
                <MovementChart data={chartMovements} useAllData selectedGudang={selectedGudang} />
              </section>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <section>
                <SectionTitle>Distribusi Stok &amp; Transaksi per Klasifikasi</SectionTitle>
                <div className="flex flex-col gap-5">
                  <StockReport data={filteredStocks} summary={stockSummary} />
                  <FastSlowTransactionChart data={filteredMovements} />
                </div>
              </section>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <section>
                <SectionTitle>Work Center & Analitik Transaksi</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7">
                    <WorkCenterBreakdown data={chartMovements} />
                  </div>
                  <div className="lg:col-span-5">
                    <MovementTable data={filteredMovements} />
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-1 h-5 bg-gradient-to-b from-indigo-600 to-indigo-400 rounded-full" />
      <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">{children}</h2>
    </div>
  );
}
