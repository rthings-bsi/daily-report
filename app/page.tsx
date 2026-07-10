'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileUp, LayoutDashboard, Layout, TrendingUp, Upload, Check, X, Filter, Package, ArrowLeftRight, Box, BarChartIcon, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseSapExcel, ProcessedMovement, MovementStats, calculateStats, ProcessedStock } from '@/lib/excel-parser';
import { getUserGudang, filterByGudang, getGudangPrefix, gudangFromSloc, reclassify311, removeInternalTfSloc, classifyBatch, isPenampunganSloc } from '@/lib/gudang';
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
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

// ─── Types ───
interface HistorySession {
  reportSessionId: string;
  label: string;
  dateStr: string;
  fileName?: string;
  createdAt: string;
  totalCount: number;
  gudangId?: number | null;
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

import { adjustStockSummaryWithMovements } from '@/lib/stock-adjustment';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [movements, setMovements] = useState<ProcessedMovement[]>([]);
  const [movementSummaries, setMovementSummaries] = useState<MovementSummaryItem[] | null>(null);
  const [stocks, setStocks] = useState<ProcessedStock[]>([]);
  const [stockCards, setStockCards] = useState<any[]>([]);
  const [stockSummary, setStockSummary] = useState<StockReportSummary | undefined>(undefined);
  const [stats, setStats] = useState<MovementStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'report' | 'analytics'>('dashboard');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [history, setHistory] = useState<HistorySession[]>([]);
  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // ─── Drag & drop layout order (report mode) ───
  const [leftOrder, setLeftOrder] = useState<string[]>(['workcenter', 'stock', 'pipa-nc']);
  const [rightOrder, setRightOrder] = useState<string[]>(['movement-chart', 'movement-table', 'fastslow']);
  
  useEffect(() => {
    try {
      let l = ['workcenter', 'stock', 'pipa-nc'];
      let r = ['movement-chart', 'movement-table', 'fastslow'];
      
      const storedL = localStorage.getItem('report-layout-left');
      if (storedL) l = JSON.parse(storedL);
      
      const storedR = localStorage.getItem('report-layout-right');
      if (storedR) r = JSON.parse(storedR);

      // Pastikan pipa-nc selalu ada (jika user punya layout lama)
      if (!l.includes('pipa-nc') && !r.includes('pipa-nc')) {
        l.push('pipa-nc'); // Default ke kolom kiri bawah
        localStorage.setItem('report-layout-left', JSON.stringify(l));
      }

      setLeftOrder(l);
      setRightOrder(r);
    } catch { /* ignore */ }
  }, []);

  const moveToLeft = (id: string) => {
    if (leftOrder.includes(id)) return;
    const newR = rightOrder.filter(item => item !== id);
    const newL = [...leftOrder, id];
    setRightOrder(newR);
    setLeftOrder(newL);
    localStorage.setItem('report-layout-right', JSON.stringify(newR));
    localStorage.setItem('report-layout-left', JSON.stringify(newL));
  };

  const moveToRight = (id: string) => {
    if (rightOrder.includes(id)) return;
    const newL = leftOrder.filter(item => item !== id);
    const newR = [...rightOrder, id];
    setLeftOrder(newL);
    setRightOrder(newR);
    localStorage.setItem('report-layout-left', JSON.stringify(newL));
    localStorage.setItem('report-layout-right', JSON.stringify(newR));
  };

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
    if (startDate) result = result.filter(m => {
        const mDate = m.dateStr?.split('T')[0];
        return mDate ? mDate >= startDate : true;
    });
    if (endDate) result = result.filter(m => {
        const mDate = m.dateStr?.split('T')[0];
        return mDate ? mDate <= endDate : true;
    });
    return result;
  }, [gudangFiltered, startDate, endDate]);

  const filteredStocks = useMemo(() => {
    if (!selectedGudang || !stocks.length) return stocks;
    const prefix = getGudangPrefix(selectedGudang);
    if (!prefix) return stocks;
    return stocks.filter(s => {
      const sloc = (s.sloc || '').toUpperCase();
      return sloc.startsWith(prefix) || s.status === 'Sloc Penampungan';
    });
  }, [stocks, selectedGudang]);

  const adjustedStockSummary = useMemo(() => {
    return adjustStockSummaryWithMovements(stockSummary, filteredStocks, filteredMovements);
  }, [stockSummary, filteredStocks, filteredMovements]);

  const filteredStats = useMemo(() => {
    // Kalau ada filter gudang/tanggal ATAU kalau movements ada isinya (hasil filter client-side), hitung manual
    if (selectedGudang || startDate || endDate || filteredMovements.length > 0) {
      // PERBAIKAN: Jika filteredMovements kosong, tapi ada movementSummaries, hitung stats dari movementSummaries
      if (filteredMovements.length === 0 && movementSummaries && movementSummaries.length > 0) {
          let incoming = 0, outgoing = 0, incCount = 0, outCount = 0;
          movementSummaries.forEach(m => {
              if (m.group === 'Masuk') {
                  incoming += m.totalQuantity;
                  incCount += m.totalCount;
              } else if (m.group === 'Keluar') {
                  outgoing += Math.abs(m.totalQuantity);
                  outCount += m.totalCount;
              }
          });
          return {
              totalIncoming: incoming,
              totalOutgoing: outgoing,
              netMovement: incoming - outgoing,
              incomingCount: incCount,
              outgoingCount: outCount,
              totalCount: incCount + outCount // perkiraan kasar, karena yg lain masuk 'Transfer'
          };
      }
      return calculateStats(filteredMovements);
    }
    // Kalau nggak ada filter, panggil stats bawaan server
    return stats;
  }, [filteredMovements, movementSummaries, selectedGudang, startDate, endDate, stats]);

  // ─── Pipa NC stats ───
  const pipaNCStats = useMemo(() => {
    const isPipaNC = (batch: string) => {
      const t = batch.trim().toUpperCase();
      return t.endsWith('C') || t.endsWith('E');
    };
    const filtered = stockCards.filter((sc: any) => isPipaNC(sc.batch || '') && (sc.ttlStokBom || 0) > 0);
    return {
      gradeC: filtered.filter((sc: any) => (sc.batch || '').trim().toUpperCase().endsWith('C')).length,
      gradeE: filtered.filter((sc: any) => (sc.batch || '').trim().toUpperCase().endsWith('E')).length,
      totalItem: filtered.length,
      totalQty: filtered.reduce((s: number, sc: any) => s + (sc.ttlStokBom || 0), 0),
      totalTonase: filtered.reduce((s: number, sc: any) => s + (sc.ttlStokEom || 0), 0),
    };
  }, [stockCards]);

  // ─── Navigate to outbound destination breakdown ───
  const handleOutboundClick = useCallback(() => {
    const params = new URLSearchParams();
    // Jangan kirim reportSessionId kalo aggregate — biar destination page pake API aggregate
    if (activeSessionId && !activeSessionId.startsWith('aggregate')) params.set('reportSessionId', activeSessionId);
    if (selectedGudang) params.set('gudang', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/outbound-destination?${params.toString()}`);
  }, [activeSessionId, selectedGudang, startDate, endDate, router]);

  // ─── Navigate to inbound destination breakdown ───
  const handleInboundClick = useCallback(() => {
    const params = new URLSearchParams();
    // Jangan kirim reportSessionId kalo aggregate — biar destination page pake API aggregate
    if (activeSessionId && !activeSessionId.startsWith('aggregate')) params.set('reportSessionId', activeSessionId);
    if (selectedGudang) params.set('gudang', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    router.push(`/inbound-destination?${params.toString()}`);
  }, [activeSessionId, selectedGudang, startDate, endDate, router]);

  // ─── Aggregated chart data: use MovementSummary when no filter ───
  const chartMovements = useMemo((): ProcessedMovement[] => {
    // Kalo movements (detail) nya kosong, tapi ada movementSummaries, PAKE SUMMARY
    // Ini terjadi waktu aggregate (no date filter) jalan, karena kita ga select rawMovements lagi dari DB untuk hemat memory.
    if ((filteredMovements.length === 0 || (!selectedGudang && !startDate && !endDate)) && movementSummaries && movementSummaries.length > 0) {
      return movementSummaries.map((s, idx) => ({
        movementId: s.movementSummaryId || `ms-${idx}`,
        postingDate: s.dateStr as any,
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
      if (!res.ok) {
        if (res.status === 401) {
            router.push('/login');
        }
        return;
      }
      if (gen !== loadGen.current) return; // superseded by newer operation
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Unauthorized or session expired');
      }

      // ── New session: pre-calculated stats + aggregated summaries ──
      if (data.stats) {
        setStats(data.stats);
        setMovementSummaries(data.movementSummaries || null);
      } else if (data.movementSummaries && data.movementSummaries.length > 0) {
        let incoming = 0, outgoing = 0, incCount = 0, outCount = 0, totalCount = 0;
        data.movementSummaries.forEach((m: any) => {
          if (m.group === 'Masuk') {
              incoming += m.totalQuantity;
              incCount += m.totalCount;
          } else if (m.group === 'Keluar') {
              outgoing += Math.abs(m.totalQuantity);
              outCount += m.totalCount;
          }
          totalCount += m.totalCount;
        });
        setStats({
            totalIncoming: incoming,
            totalOutgoing: outgoing,
            netMovement: incoming - outgoing,
            incomingCount: incCount,
            outgoingCount: outCount,
            totalCount: totalCount
        });
        setMovementSummaries(data.movementSummaries);
      } else {
        setStats(null);
        setMovementSummaries(null);
      }

      // ── Raw movements for detail table & gudang filtering ──
      const movs: ProcessedMovement[] = data.movements && data.movements.length > 0 ? data.movements.map((m: any) => ({
        movementId: m.movementId || `move-${Math.random()}`,
        postingDate: m.dateStr,
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        material: m.material || undefined,
        workCenter: m.workCenter || '',
        batch: m.batch || '',
        quantity: m.quantity,
        unitQuantity: m.unitQuantity || 0,
        userName: m.userName || '',
        storageLocation: m.storageLocation || '',
        group: m.group || 'Transfer',
        color: m.color || '#94a3b8',
        movementStatus: classifyBatch(m.batch || ''),
      })) : [];
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
      setStockCards(data.stockCards || []);
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
      if (gen === loadGen.current) {
        setLoading(false);
      }
    }
  };

  // ─── Load aggregated data across multiple sessions ───
  const lastAggregateQs = useRef<string | null>(null);

  const loadAggregate = useCallback(async (params: URLSearchParams) => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const qs = params.toString();
      const res = await fetch(`/api/reports/aggregate${qs ? `?${qs}` : ''}`);
      if (!res.ok) {
        if (res.status === 401) {
            router.push('/login');
        }
        return;
      }
      if (gen !== loadGen.current) return;
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("JSON parse error from /api/reports/aggregate", e, text.substring(0, 100));
        throw new Error('Unauthorized or session expired');
      }

      if (data.stats) {
        setStats(data.stats);
        setMovementSummaries(data.movementSummaries || null);
      } else if (data.movementSummaries && data.movementSummaries.length > 0) {
        let incoming = 0, outgoing = 0, incCount = 0, outCount = 0, totalCount = 0;
        data.movementSummaries.forEach((m: any) => {
          if (m.group === 'Masuk') {
              incoming += m.totalQuantity;
              incCount += m.totalCount;
          } else if (m.group === 'Keluar') {
              outgoing += Math.abs(m.totalQuantity);
              outCount += m.totalCount;
          }
          totalCount += m.totalCount;
        });
        setStats({
            totalIncoming: incoming,
            totalOutgoing: outgoing,
            netMovement: incoming - outgoing,
            incomingCount: incCount,
            outgoingCount: outCount,
            totalCount: totalCount
        });
        setMovementSummaries(data.movementSummaries);
      } else {
        setStats(null);
        setMovementSummaries(null);
      }

      const movs: ProcessedMovement[] = data.movements && data.movements.length > 0 ? data.movements.map((m: any) => ({
        movementId: m.movementId || `agg-${Math.random()}`,
        postingDate: m.dateStr,
        dateStr: m.dateStr,
        moveType: m.moveType,
        description: m.description,
        material: m.material || undefined,
        workCenter: m.workCenter || '',
        batch: m.batch || '',
        quantity: m.quantity,
        unitQuantity: m.unitQuantity || 0,
        userName: m.userName || '',
        storageLocation: m.storageLocation || '',
        group: m.group || 'Transfer',
        color: m.color || '#94a3b8',
        movementStatus: classifyBatch(m.batch || ''),
      })) : [];

      if (!data.stats) {
        setStats(calculateStats(movs));
        setMovementSummaries(null);
      }

      let stks: ProcessedStock[] = data.stocks || [];
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

      // ── Hanya update movements jika:
      //    - Server balikin data (movs.length > 0), ATAU
      //    - Lagi tanpa filter (qs === '') — loading semua data
      //    Biar data gak ilang pas filter gudang/tanggal aktif tapi
      //    server gak nemu session dengan gudangId yg cocok.
      if (movs.length > 0 || qs === '') {
        setMovements(movs);
        if (data.stockCards) setStockCards(data.stockCards);
      }
      setStocks(stks);

      // Build pre-aggregated stock summary
      if (Array.isArray(data.stockSummaries) && data.stockSummaries.length > 0) {
        const bucket = (): { count: number; totalTon: number } => ({ count: 0, totalTon: 0 });
        const next: StockReportSummary = { fast: bucket(), slow: bucket(), penampungan: bucket() };
        for (const r of data.stockSummaries) {
          const ton = (r.totalWeight || 0) / 1000;
          // Cek client-side penampungan SLOC (walau di DB statusnya Fast/Slow Moving)
          const isPenampungan = isPenampunganSloc(r.sloc);
          if (isPenampungan) {
            next.penampungan.count += r.itemCount || 0;
            next.penampungan.totalTon += ton;
          } else if (r.status === 'Fast Moving') {
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

      setActiveSessionId(`aggregate-${qs || 'all'}`);
    } finally {
      if (gen === loadGen.current) {
        setLoading(false);
      }
    }
  }, [history.length]);

  // Load aggregated data whenever filters change
  useEffect(() => {
    if (!history.length) return;

    const params = new URLSearchParams();
    if (selectedGudang) params.set('gudangId', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);

    const qs = params.toString();
    if (qs === lastAggregateQs.current) return;
    lastAggregateQs.current = qs;

    loadAggregate(params);
  }, [startDate, endDate, selectedGudang, history, loadAggregate]);

  
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

        {/* ─── Collapsible Filters ─── */}
        <div className="relative mr-1 sm:mr-2">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className={`h-7 px-2.5 inline-flex items-center gap-1.5 rounded-lg text-[10px] font-bold border transition-all shadow-sm ${
              selectedGudang || startDate || endDate
                ? 'bg-[#1591DC] text-white border-[#1591DC] hover:bg-[#2C5EAD]'
                : 'text-[#1591DC] bg-white/80 border-[#C4E2F5]/60 hover:bg-white hover:border-[#4BB8FA]/50'
            }`}
            title="Filter"
          >
            <Filter size={12} strokeWidth={2.5} className="shrink-0" />
            <span className="hidden lg:inline">Filter</span>
            {(selectedGudang || startDate || endDate) && (
              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-black">
                {(selectedGudang ? 1 : 0) + ((startDate || endDate) ? 1 : 0)}
              </span>
            )}
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-white/95 backdrop-blur-xl border border-[#C4E2F5]/60 rounded-2xl shadow-xl shadow-[#1591DC]/10 p-4 min-w-[260px] space-y-3">
                <p className="text-[9px] font-bold text-[#2C5EAD]/50 uppercase tracking-widest">Filter Data</p>

                {session?.user?.role === 'admin' && (
                  <div>
                    <label className="text-[10px] font-semibold text-[#2C5EAD]/70 mb-1 block">Gudang</label>
                    <select
                      value={selectedGudang ?? ''}
                      onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
                      className="w-full h-8 text-[11px] font-bold text-[#2C5EAD] bg-white border border-[#C4E2F5]/50 rounded-xl px-3 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 hover:border-[#4BB8FA]/50 cursor-pointer transition-all shadow-sm"
                    >
                      <option value="">Semua Gudang</option>
                      {Array.from({ length: 14 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>Gudang {n}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-semibold text-[#2C5EAD]/70 mb-1 block">Rentang Tanggal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="flex-1 h-8 text-[10px] font-bold text-[#2C5EAD] bg-white border border-[#C4E2F5]/50 rounded-xl px-2.5 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 shadow-sm"
                    />
                    <span className="text-[10px] text-[#1591DC]/30 font-bold">–</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="flex-1 h-8 text-[10px] font-bold text-[#2C5EAD] bg-white border border-[#C4E2F5]/50 rounded-xl px-2.5 outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 shadow-sm"
                    />
                  </div>
                </div>

                {(selectedGudang || startDate || endDate) && (
                  <button
                    onClick={() => { setSelectedGudang(null); setStartDate(''); setEndDate(''); setFilterOpen(false); }}
                    className="w-full h-7 text-[10px] font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <X size={12} strokeWidth={3} /> Reset Filter
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-5 bg-[#C4E2F5]/50 mx-1 hidden sm:block" />

        {/* ─── Actions Group ─── */}
        <div className="flex items-center gap-2 p-1 bg-white/40 border border-[#C4E2F5]/60 rounded-xl">

          <div className="flex bg-white border border-[#C4E2F5]/50 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`h-6 px-3 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'dashboard'
                  ? 'bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] text-white shadow-sm shadow-[#1591DC]/20'
                  : 'text-[#1591DC] hover:bg-[#C4E2F5]/20'
              }`}
            >
              <LayoutDashboard size={12} strokeWidth={viewMode === 'dashboard' ? 2.5 : 2} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`h-6 px-3 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'report'
                  ? 'bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] text-white shadow-sm shadow-[#1591DC]/20'
                  : 'text-[#1591DC] hover:bg-[#C4E2F5]/20'
              }`}
            >
              <Layout size={12} strokeWidth={viewMode === 'report' ? 2.5 : 2} />
              <span className="hidden sm:inline">Report</span>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`h-6 px-3 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'analytics'
                  ? 'bg-gradient-to-r from-[#1591DC] to-[#2C5EAD] text-white shadow-sm shadow-[#1591DC]/20'
                  : 'text-[#1591DC] hover:bg-[#C4E2F5]/20'
              }`}
            >
              <TrendingUp size={12} strokeWidth={viewMode === 'analytics' ? 2.5 : 2} />
              <span className="hidden sm:inline">Analytics</span>
            </button>
          </div>
        </div>
      </PageHeader>

      {/* ─── Page Content ─── */}
      <div ref={contentRef} className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-5 lg:py-6">
        <AnimatePresence mode="wait">

          {/* ═══════════ ANALYTICS MODE ═══════════ */}
          {viewMode === 'analytics' ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <AnalyticsDashboard />
            </motion.div>
          ) : viewMode === 'report' ? (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 xl:gap-4">
                <StatsCard title="Incoming" value={filteredStats ? (filteredStats.totalIncoming).toString() : '0'} unit="TON" type="in" condensed delay={0.05} onClick={handleInboundClick} />
                <StatsCard title="Outgoing" value={filteredStats ? (filteredStats.totalOutgoing).toString() : '0'} unit="TON" type="out" condensed delay={0.1} onClick={handleOutboundClick} />
                <StatsCard title="Net Flow" value={(filteredStats?.netMovement || 0).toString()} unit="TON" type={(filteredStats?.netMovement || 0) >= 0 ? 'in' : 'out'} condensed delay={0.15} />
                <StatsCard title="Transactions" value={(filteredStats?.totalCount ?? filteredMovements.length).toString()} unit="TRX" type="total" condensed delay={0.2} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 xl:gap-4">
                <div className="md:col-span-12 lg:col-span-5">
                  <div 
                    className="group relative flex-none rounded-2xl bg-white border border-[#10b981]/20 p-5 shadow-sm shadow-[#10b981]/5 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[#10b981]/10 hover:border-[#10b981]/40 hover:-translate-y-1" 
                    onClick={() => router.push('/pipa-nc')}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                      <Box size={64} className="text-[#047857] -rotate-12" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">GRADE C</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/20 text-white"><TrendingUp size={16} /></div>
                    </div>
                    <div className="relative z-10 flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl font-extrabold tabular-nums tracking-tight text-slate-800">{pipaNCStats.gradeC.toLocaleString('id-ID')}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">{pipaNCStats.gradeC} batch akhiran C</span>
                    </div>
                  </div>

                  {/* Grade E */}
                  <div 
                    className="group relative flex-none rounded-2xl bg-white border border-[#e11d48]/20 p-5 shadow-sm shadow-[#e11d48]/5 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[#e11d48]/10 hover:border-[#e11d48]/40 hover:-translate-y-1" 
                    onClick={() => router.push('/pipa-nc')}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                      <Box size={64} className="text-[#be123c] -rotate-12" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">GRADE E</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-rose-400 to-rose-600 shadow-md shadow-rose-500/20 text-white"><TrendingUp size={16} /></div>
                    </div>
                    <div className="relative z-10 flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl font-extrabold tabular-nums tracking-tight text-slate-800">{pipaNCStats.gradeE.toLocaleString('id-ID')}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">{pipaNCStats.gradeE} batch akhiran E</span>
                    </div>
                  </div>

                  {/* Total Pipa NC */}
                  <div 
                    className="group relative flex-none rounded-2xl bg-white border border-indigo-200/50 p-5 shadow-sm shadow-indigo-500/5 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/30 hover:-translate-y-1" 
                    onClick={() => router.push('/pipa-nc')}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                      <Package size={64} className="text-indigo-600 -rotate-12" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">TOTAL ITEM</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-md shadow-indigo-500/20 text-white"><Box size={16} /></div>
                    </div>
                    <div className="relative z-10 flex items-baseline gap-1.5 mb-6">
                      <span className="text-4xl font-extrabold tabular-nums tracking-tight text-slate-800">{(pipaNCStats.gradeC + pipaNCStats.gradeE).toLocaleString('id-ID')}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">Total pipa NC</span>
                    </div>
                  </div>

                  {/* Total Qty */}
                  <div 
                    className="group relative flex-none rounded-2xl bg-white border border-sky-200/50 p-5 shadow-sm shadow-sky-500/5 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10 hover:border-sky-500/30 hover:-translate-y-1" 
                    onClick={() => router.push('/pipa-nc')}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                      <Box size={64} className="text-sky-600 -rotate-12" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">TOTAL QTY</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-sky-400 to-sky-600 shadow-md shadow-sky-500/20 text-white"><Package size={16} /></div>
                    </div>
                    <div className="relative z-10 flex items-baseline gap-1.5 mb-6">
                      <span className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-800">{pipaNCStats.totalQty.toLocaleString('id-ID')}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PC</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">Stok BOM</span>
                    </div>
                  </div>

                  {/* Total Tonase */}
                  <div 
                    className="group relative flex-none rounded-2xl bg-white border border-violet-200/50 p-5 shadow-sm shadow-violet-500/5 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-500/30 hover:-translate-y-1" 
                    onClick={() => router.push('/pipa-nc')}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 group-hover:scale-110 transition-all duration-500">
                      <Box size={64} className="text-violet-600 -rotate-12" />
                    </div>
                    <div className="relative z-10 flex justify-between items-start mb-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 leading-tight">TOTAL<br/>TONASE</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-400 to-violet-600 shadow-md shadow-violet-500/20 text-white"><TrendingUp size={16} /></div>
                    </div>
                    <div className="relative z-10 flex items-baseline gap-1.5 mb-6">
                      <span className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-800">
                        {pipaNCStats.totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TON</span>
                    </div>
                    <div className="relative z-10 flex items-center gap-2 mt-auto pt-4 border-t border-slate-50">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-40"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 truncate">Stok EOM</span>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <SectionTitle>Analisis Pergerakan Material</SectionTitle>
                <MovementChart data={chartMovements} useAllData selectedGudang={selectedGudang} />
              </section>