'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileUp, Printer, LayoutDashboard, Layout, Settings,
  Sparkles, Calendar, Upload, History, X, Trash2, LogOut, Check,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseSapExcel, ProcessedMovement, MovementStats, calculateStats, ProcessedStock } from '@/lib/excel-parser';
import { StatsCard } from '@/components/StatsCard';
import { MovementTable } from '@/components/MovementTable';
import { MovementChart } from '@/components/MovementChart';
import { WorkCenterBreakdown } from '@/components/WorkCenterBreakdown';
import { StockReport } from '@/components/StockReport';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from 'next-auth/react';

// ─── Types ───
interface HistorySession {
  id: string;
  label: string;
  dateStr: string;
  fileName?: string;
  createdAt: string;
  _count: { movements: number };
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [movements, setMovements] = useState<ProcessedMovement[]>([]);
  const [stocks, setStocks] = useState<ProcessedStock[]>([]);
  const [stats, setStats] = useState<MovementStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportMode, setReportMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load history list ───
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) setHistory(await res.json());
    } catch { /* silent */ }
  }, []);

  // ─── Display date from current data ───
  const displayDate = React.useMemo(() => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    if (movements.length > 0 && movements[0].dateStr) {
      const parts = movements[0].dateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0]);
        const m = parseInt(parts[1]); // 1-indexed
        const d = parseInt(parts[2]);
        
        // Use Date.UTC only to find the weekday name
        const dateObj = new Date(Date.UTC(y, m - 1, d));
        const weekday = dateObj.getUTCDay();

        return `${days[weekday]}, ${String(d).padStart(2, '0')} ${months[m - 1]} ${y}`;
      }
    }
    const now = new Date();
    return `${days[now.getUTCDay()]}, ${String(now.getUTCDate()).padStart(2, '0')} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
  }, [movements]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
  const saveToDb = async (movs: ProcessedMovement[], stks: ProcessedStock[], fileName: string) => {
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
        }),
      });

      if (res.ok) {
        const { id } = await res.json();
        setActiveSessionId(id);
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
      await saveToDb(result.movements, result.stocks, file.name);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Gagal memproses file. Pastikan format file SAP Excel benar.');
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // ─── Load a saved session ───
  const loadSession = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) return;
      const data = await res.json();

      const movs: ProcessedMovement[] = data.movements.map((m: any) => ({
        ...m,
        postingDate: new Date(m.postingDate),
      }));
      const stks: ProcessedStock[] = data.stocks;

      setMovements(movs);
      setStocks(stks);
      setStats(calculateStats(movs));
      setActiveSessionId(id);
      setShowHistory(false);
    } finally {
      setLoading(false);
    }
  };

  // ─── Delete a session ───
  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus laporan ini?')) return;
    await fetch(`/api/reports/${id}`, { method: 'DELETE' });
    if (activeSessionId === id) resetData();
    await loadHistory();
  };

  const resetData = () => {
    setMovements([]);
    setStocks([]);
    setStats(null);
    setActiveSessionId(null);
    setSaved(false);
  };

  // ─── Filtered history ───
  const filteredHistory = dateFilter
    ? history.filter(h => h.dateStr.startsWith(dateFilter))
    : history;

  // ─── Upload / Landing Page ───
  if (!movements.length && !stocks.length) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 relative flex items-center justify-center p-6 overflow-hidden">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 22 }}
          className="max-w-lg w-full relative z-10 flex flex-col gap-4"
        >
          {/* Main upload card */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-indigo-400 to-emerald-400" />
            <div className="p-8 sm:p-10 text-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-20 h-20 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200"
              >
                <Upload className="text-white" size={34} />
              </motion.div>

              <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Warehouse Intelligence</h1>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
                Upload export SAP Excel untuk menghasilkan laporan{' '}
                <span className="text-indigo-600 font-bold">IN-OUT Gudang</span> secara otomatis.
              </p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses File…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Pilih File Excel SAP
                  </>
                )}
              </button>
              <p className="text-xs text-slate-400 mt-4 font-medium">Mendukung .xlsx dan .xls</p>
            </div>
          </div>

          {/* History panel on landing */}
          {history.length > 0 && (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow border border-slate-200/80 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Laporan Tersimpan</span>
                </div>
                <input
                  type="month"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-300"
                />
              </div>
              <div className="divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {filteredHistory.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadSession(h.id)}
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-indigo-50 transition-colors text-left group"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{h.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{h._count.movements} baris · {h.fileName ?? 'SAP Export'}</p>
                    </div>
                    <div
                      onClick={e => deleteSession(h.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all flex-shrink-0"
                    >
                      <Trash2 size={13} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logout at bottom of landing */}
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 self-center py-1 transition-colors"
          >
            <LogOut size={12} />
            Keluar ({session?.user?.name ?? 'user'})
          </button>
        </motion.div>
      </main>
    );
  }

  // ─── Dashboard / Report ───
  return (
    <main className="min-h-screen bg-slate-50">
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm print:hidden">
        <div className="max-w-[1600px] mx-auto px-5 py-2.5 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
              <LayoutDashboard className="text-white" size={17} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none flex items-center gap-2 flex-wrap">
                SPINDO{' '}
                <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent italic">
                  GUDANG 13
                </span>
                <span className="px-2 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-600 rounded-full border border-emerald-100 flex items-center gap-1 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  LIVE
                </span>
              </h1>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5 truncate">
                Laporan Mutasi Stok Gudang
              </p>
            </div>
          </div>

          {/* Date Badge */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl flex-shrink-0">
            <Calendar size={13} className="text-indigo-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-600 capitalize whitespace-nowrap">{displayDate}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />

            {/* Save indicator */}
            <AnimatePresence>
              {saving && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-[11px] text-indigo-500 font-bold flex items-center gap-1"
                >
                  <div className="w-3 h-3 border border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
                  Menyimpan…
                </motion.span>
              )}
              {saved && !saving && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-[11px] text-emerald-600 font-bold flex items-center gap-1"
                >
                  <Check size={12} />
                  Tersimpan
                </motion.span>
              )}
            </AnimatePresence>

            <button
              onClick={() => { setShowHistory(h => !h); loadHistory(); }}
              title="Riwayat laporan"
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all border ${
                showHistory
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'text-slate-600 bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              <History size={14} />
              <span className="hidden sm:inline">Riwayat</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload file baru"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-all"
            >
              <FileUp size={14} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <button
              onClick={() => setReportMode(!reportMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all border ${
                reportMode
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600'
              }`}
            >
              {reportMode ? <LayoutDashboard size={14} /> : <Layout size={14} />}
              <span className="hidden sm:inline">{reportMode ? 'Dashboard' : 'Compact'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 rounded-xl font-bold text-xs transition-all"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={resetData}
              className="p-2 bg-white text-slate-400 border border-slate-200 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 rounded-xl transition-all"
              title="Upload ulang"
            >
              <Settings size={15} />
            </button>

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 bg-white text-slate-400 border border-slate-200 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              title={`Logout (${session?.user?.name})`}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── History Drawer ─── */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="sticky top-[57px] z-40 bg-white border-b border-slate-200 shadow-md print:hidden"
          >
            <div className="max-w-[1600px] mx-auto px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History size={14} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Laporan Tersimpan</span>
                  <span className="text-[11px] text-slate-400">({filteredHistory.length} laporan)</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="month"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  />
                  {dateFilter && (
                    <button
                      onClick={() => setDateFilter('')}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap max-h-36 overflow-y-auto">
                {filteredHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">Tidak ada laporan untuk periode ini.</p>
                ) : (
                  filteredHistory.map(h => (
                    <div
                      key={h.id}
                      className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl border text-left cursor-pointer transition-all hover:shadow-md ${
                        activeSessionId === h.id
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                          : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                      onClick={() => loadSession(h.id)}
                    >
                      <Calendar size={13} className={activeSessionId === h.id ? 'text-indigo-200' : 'text-indigo-400'} />
                      <div>
                        <p className={`text-xs font-bold leading-tight ${activeSessionId === h.id ? 'text-white' : 'text-slate-700'}`}>{h.label}</p>
                        <p className={`text-[10px] ${activeSessionId === h.id ? 'text-indigo-200' : 'text-slate-400'}`}>{h._count.movements} rows</p>
                      </div>
                      <button
                        onClick={e => deleteSession(h.id, e)}
                        className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all ml-1 ${
                          activeSessionId === h.id
                            ? 'hover:bg-indigo-500 text-indigo-200'
                            : 'hover:bg-rose-100 text-slate-400 hover:text-rose-500'
                        }`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Page Content ─── */}
      <div className="max-w-[1600px] mx-auto px-5 py-5">
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
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatsCard title="Incoming" value={stats?.totalIncoming.toFixed(1) || '0'} unit="TON" type="in" condensed delay={0.05} />
                <StatsCard title="Outgoing" value={stats?.totalOutgoing.toFixed(1) || '0'} unit="TON" type="out" condensed delay={0.1} />
                <StatsCard title="Net Flow" value={(stats?.netMovement || 0).toFixed(1)} unit="TON" type={(stats?.netMovement || 0) >= 0 ? 'in' : 'out'} condensed delay={0.15} />
                <StatsCard title="Transactions" value={movements.length.toLocaleString()} unit="TRX" type="total" condensed delay={0.2} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
                  <WorkCenterBreakdown data={movements} condensed />
                  <StockReport data={stocks} condensed />
                </div>
                <div className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
                  <MovementChart data={movements} condensed />
                  <MovementTable data={movements} condensed />
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
                  <StatsCard title="Total Inbound" value={stats?.totalIncoming.toFixed(1) || '0'} unit="TON" subtitle={`${stats?.incomingCount.toLocaleString()} transaksi masuk`} type="in" delay={0.05} />
                  <StatsCard title="Total Outbound" value={stats?.totalOutgoing.toFixed(1) || '0'} unit="TON" subtitle={`${stats?.outgoingCount.toLocaleString()} transaksi keluar`} type="out" delay={0.1} />
                  <StatsCard title="Net Flow" value={(stats?.netMovement || 0).toFixed(1)} unit="TON" subtitle="Selisih material masuk & keluar" type={(stats?.netMovement || 0) >= 0 ? 'in' : 'out'} delay={0.15} />
                  <StatsCard title="Total Transaksi" value={movements.length.toLocaleString()} unit="TRX" subtitle="Total row data dari SAP" type="total" delay={0.2} />
                </div>
              </section>

              <section>
                <SectionTitle>Analisis Pergerakan Material</SectionTitle>
                <MovementChart data={movements} />
              </section>

              <section>
                <SectionTitle>Distribusi Stok</SectionTitle>
                <StockReport data={stocks} />
              </section>

              <section>
                <SectionTitle>Work Center & Analitik Transaksi</SectionTitle>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-7">
                    <WorkCenterBreakdown data={movements} />
                  </div>
                  <div className="lg:col-span-5">
                    <MovementTable data={movements} />
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
