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
  const [trendData, setTrendData] = useState<{ date: string; masuk: number; keluar: number }[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Load history list ───
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports');
      if (res.ok) setHistory(await res.json());

      const trendRes = await fetch('/api/reports/trend');
      if (trendRes.ok) setTrendData(await trendRes.json());
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="max-w-xl w-full relative z-10 flex flex-col gap-5"
        >
          {/* Main upload card */}
          <div className="bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/40 overflow-hidden group">
            <div className="h-2 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-400" />
            <div className="p-10 sm:p-12 text-center relative">
              {/* Decorative circles */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-3xl -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl translate-x-1/2 translate-y-1/2" />

              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  filter: ['drop-shadow(0 0 0px rgba(79,70,229,0))', 'drop-shadow(0 10px 15px rgba(79,70,229,0.2))', 'drop-shadow(0 0 0px rgba(79,70,229,0))']
                }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-indigo-200 relative z-10"
              >
                <div className="absolute inset-0 bg-white/20 rounded-[2rem] animate-pulse" />
                <Upload className="text-white relative z-10" size={40} strokeWidth={1.5} />
              </motion.div>

              <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tighter">
                Warehouse <span className="text-indigo-600">Intelligence</span>
              </h1>
              <p className="text-sm text-slate-500 mb-10 leading-relaxed max-w-xs mx-auto font-medium">
                Pusat pengolahan data inventaris otomatis. Unggah laporan <span className="text-indigo-600 font-bold">SAP Excel</span> Bapak untuk memulai analisis.
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
                className="w-full py-5 bg-indigo-600 hover:bg-slate-900 active:scale-[0.98] text-white rounded-[1.25rem] font-bold text-sm transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 disabled:opacity-60 relative overflow-hidden group/btn"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses Data…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="text-indigo-200" />
                    Pilih File SAP Excel
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-400 mt-5 font-bold uppercase tracking-[0.2em]">Supported Formats: .XLSX / .XLS</p>
            </div>
          </div>

          {/* History panel on landing */}
          {history.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl rounded-[2rem] shadow-xl border border-white/40 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100/50 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <History size={13} className="text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Arsip Laporan</span>
                </div>
                <input
                  type="month"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="text-[10px] font-bold text-slate-600 bg-white border border-slate-200/50 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-400 transition-all shadow-sm"
                />
              </div>
              <div className="divide-y divide-slate-100/20 max-h-60 overflow-y-auto custom-scrollbar">
                {filteredHistory.map(h => (
                  <button
                    key={h.id}
                    onClick={() => loadSession(h.id)}
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 hover:bg-white transition-all text-left group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:border-indigo-100 group-hover:bg-indigo-50 transition-all">
                        <Calendar size={16} className="text-slate-400 group-hover:text-indigo-500" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{h.label}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium italic truncate max-w-[120px]">{h.fileName ?? 'System Generated'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-600 tracking-wider uppercase">{h._count.movements} TRX</p>
                        <p className="text-[9px] text-slate-400 uppercase">Processed</p>
                      </div>
                      <div
                        onClick={e => deleteSession(h.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all flex-shrink-0 border border-transparent hover:border-rose-100"
                      >
                        <Trash2 size={14} />
                      </div>
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
    <main className="min-h-screen bg-slate-50/50">
      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] print:hidden">
        <div className="max-w-[1700px] mx-auto px-6 py-3 flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3.5 flex-shrink-0 min-w-0">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 border border-slate-800">
              <LayoutDashboard className="text-white" size={16} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex flex-col justify-center gap-0.5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-[15px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  SPINDO
                  <span className="text-slate-300 font-light">/</span>
                  <span className="font-semibold text-slate-600">Gudang 13</span>
                </h1>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-emerald-200/50 bg-emerald-50/50">
                  <div className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-700 tracking-widest uppercase">System Active</span>
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-500 truncate tracking-wide">
                Enterprise Inventory Platform
              </p>
            </div>
          </div>

          {/* Date Badge */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm flex-shrink-0">
            <Calendar size={13} className="text-slate-400 flex-shrink-0" />
            <span className="text-xs font-medium text-slate-600 capitalize whitespace-nowrap">{displayDate}</span>
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
              {(saving || saved) && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${
                    saving 
                      ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                      : 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  }`}
                >
                  {saving ? (
                    <div className="w-3 h-3 border-2 border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <Check size={12} strokeWidth={2.5} />
                  )}
                  {saving ? 'Saving…' : 'Saved'}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-5 w-[1px] bg-slate-200 mx-1.5 hidden sm:block" />

            <button
              onClick={() => { setShowHistory(h => !h); loadHistory(); }}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                showHistory
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <History size={14} strokeWidth={2} />
              <span className="hidden lg:inline">Arsip</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-all"
            >
              <FileUp size={14} strokeWidth={2} />
              <span className="hidden lg:inline">Upload</span>
            </button>

            <button
              onClick={() => setReportMode(!reportMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border ${
                reportMode
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {reportMode ? <LayoutDashboard size={14} strokeWidth={2} /> : <Layout size={14} strokeWidth={2} />}
              <span className="hidden lg:inline">{reportMode ? 'Dashboard' : 'Report'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white border border-slate-900 hover:bg-slate-800 rounded-lg font-semibold text-xs transition-all shadow-sm"
            >
              <Printer size={14} strokeWidth={2} />
              <span className="hidden lg:inline">Cetak</span>
            </button>

            <div className="h-5 w-[1px] bg-slate-200 mx-1.5" />

            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-1.5 bg-white text-slate-400 hover:text-slate-900 rounded-lg transition-all hover:bg-slate-100"
              title={`Sesi: ${session?.user?.name}`}
            >
              <LogOut size={16} strokeWidth={2} />
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
                <StatsCard title="Incoming" value={stats ? stats.totalIncoming.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="in" condensed delay={0.05} />
                <StatsCard title="Outgoing" value={stats ? stats.totalOutgoing.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="out" condensed delay={0.1} />
                <StatsCard title="Net Flow" value={(stats?.netMovement || 0).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" type={(stats?.netMovement || 0) >= 0 ? 'in' : 'out'} condensed delay={0.15} />
                <StatsCard title="Transactions" value={movements.length.toLocaleString()} unit="TRX" type="total" condensed delay={0.2} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="col-span-12 lg:col-span-6 xl:col-span-5 flex flex-col gap-4">
                  <WorkCenterBreakdown data={movements} condensed />
                  <StockReport data={stocks} condensed />
                </div>
                <div className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col gap-4">
                  <MovementChart data={movements} trendData={trendData} condensed />
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
                  <StatsCard title="Total Inbound" value={stats ? stats.totalIncoming.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${stats?.incomingCount.toLocaleString('id-ID')} transaksi masuk`} type="in" delay={0.05} />
                  <StatsCard title="Total Outbound" value={stats ? stats.totalOutgoing.toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${stats?.outgoingCount.toLocaleString('id-ID')} transaksi keluar`} type="out" delay={0.1} />
                  <StatsCard title="Net Flow" value={(stats?.netMovement || 0).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" subtitle="Selisih material masuk & keluar" type={(stats?.netMovement || 0) >= 0 ? 'in' : 'out'} delay={0.15} />
                  <StatsCard title="Total Transaksi" value={movements.length.toLocaleString()} unit="TRX" subtitle="Total row data dari SAP" type="total" delay={0.2} />
                </div>
              </section>

              <section>
                <SectionTitle>Analisis Pergerakan Material</SectionTitle>
                <MovementChart data={movements} trendData={trendData} />
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
