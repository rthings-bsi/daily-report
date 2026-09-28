'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileUp, LayoutDashboard, Layout, TrendingUp, Upload, Check, X, Filter, Package, ArrowLeftRight, Box, Copy, Loader2, AlertCircle, Download } from 'lucide-react';
import { copyDashboardToClipboard } from '@/lib/clipboard-capture';
import { useRouter } from 'next/navigation';
import { parseSapExcel, ProcessedMovement, MovementStats, calculateStats, ProcessedStock } from '@/lib/excel-parser';
import { getUserGudang, filterByGudang, getGudangPrefix, gudangFromSloc, reclassify311, removeInternalTfSloc, classifyBatch, isPenampunganSloc } from '@/lib/gudang';
import { filterEnabledMovements, filterEnabledWorkCenters, getMovementInfo } from '@/lib/sap-mapping';
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
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [copyErrorMessage, setCopyErrorMessage] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

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

  const filteredMovements = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    let result = filterEnabledMovements(filterEnabledWorkCenters(movements));
    console.log('[FM-step1] after enabled filters:', result.length, 'of', movements.length);
    if (selectedGudang) {
       const afterRemove = removeInternalTfSloc(result);
       console.log('[FM-step2] after removeInternalTfSloc:', afterRemove.length);
       const afterGudang = filterByGudang(afterRemove, selectedGudang);
       console.log('[FM-step3] after filterByGudang(', selectedGudang, '):', afterGudang.length);
       result = reclassify311(afterGudang, selectedGudang);
       console.log('[FM-step4] after reclassify311:', result.length);
    }
    if (startDate) result = result.filter(m => {
        const mDate = m.dateStr?.split('T')[0];
        return mDate ? mDate >= startDate : true;
    });
    if (endDate) result = result.filter(m => {
        const mDate = m.dateStr?.split('T')[0];
        return mDate ? mDate <= endDate : true;
    });
    console.log('[FM-final] filteredMovements:', result.length);
    return result;
  }, [movements, selectedGudang, startDate, endDate]);

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
    // Kalo movements (detail) lokal kosong (karena aggregate hanya mengembalikan summaries),
    // langsung gunakan stats pre-calculated dari server (yang sudah difilter di server).
    if (filteredMovements.length === 0) {
      if (stats) return stats;

      // Fallback jika ada data summary tetapi tidak ada object stats terpisah
      if (movementSummaries && movementSummaries.length > 0) {
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
              totalCount: incCount + outCount
          };
      }
      return null;
    }
    // Jika ada data movements lokal (habis upload baru), hitung manual
    return calculateStats(filteredMovements);
  }, [filteredMovements, movementSummaries, stats]);

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
      totalTonase: filtered.reduce((s: number, sc: any) => s + (sc.ttlStokEom || 0), 0) / 1000,
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

  const chartMovements = useMemo((): ProcessedMovement[] => {
    // Hanya pakai movementSummaries sebagai fallback kalau filteredMovements benar-benar kosong.
    // Summary tidak punya batch → movementStatus selalu 'Unknown', jadi jangan dipaksa
    // menggantikan filteredMovements (yang punya klasifikasi Fast/Slow dari classifyBatch).
    if (filteredMovements.length === 0 && movementSummaries && movementSummaries.length > 0) {
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

  // ─── Data untuk chart Fast & Slow Moving ───
  // Status Fast/Slow hanya bisa dihitung dari batch pada raw movements
  // (movementSummaries tidak menyimpan batch → semuanya 'Unknown').
  // Kalau movements tersedia (mis. aggregate default view), pakai movements
  // agar Fast & Slow Moving muncul. Kalau kosong (session legacy), fallback
  // ke chartMovements (summaries → ditampilkan sebagai Total Transaksi).
  const statusMovements = useMemo(
    () => (filteredMovements.length > 0 ? filteredMovements : chartMovements),
    [filteredMovements, chartMovements]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadGen = useRef(0);

  // ─── Load a saved session ───
  const loadSession = async (id: string) => {
    const gen = ++loadGen.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}?detail=true`);
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
      const movs: ProcessedMovement[] = data.movements && data.movements.length > 0 ? data.movements.map((m: any) => {
        const info = getMovementInfo(m.moveType);
        // For 311, keep the direction already set by parser (based on quantity sign)
        const is311 = m.moveType === '311';
        return {
          movementId: m.movementId || `move-${Math.random()}`,
          postingDate: m.dateStr,
          dateStr: m.dateStr,
          moveType: m.moveType,
          description: is311 ? m.description : info.description,
          material: m.material || undefined,
          workCenter: m.workCenter || '',
          batch: m.batch || '',
          quantity: m.quantity,
          unitQuantity: m.unitQuantity || 0,
          userName: m.userName || '',
          storageLocation: m.storageLocation || '',
          group: is311 ? (m.group || 'Transfer') : info.group,
          color: info.color,
          movementStatus: classifyBatch(m.batch || ''),
        };
      }) : [];
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

      const movs: ProcessedMovement[] = data.movements && data.movements.length > 0 ? data.movements.map((m: any) => {
        const info = getMovementInfo(m.moveType);
        const is311 = m.moveType === '311';
        return {
          movementId: m.movementId || `agg-${Math.random()}`,
          postingDate: m.dateStr,
          dateStr: m.dateStr,
          moveType: m.moveType,
          description: is311 ? m.description : info.description,
          material: m.material || undefined,
          workCenter: m.workCenter || '',
          batch: m.batch || '',
          quantity: m.quantity,
          unitQuantity: m.unitQuantity || 0,
          userName: m.userName || '',
          storageLocation: m.storageLocation || '',
          group: is311 ? (m.group || 'Transfer') : info.group,
          color: info.color,
          movementStatus: classifyBatch(m.batch || ''),
        };
      }) : [];

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

      // DEBUG batch
      const _dbg = { total: movs.length, fast: 0, slow: 0, unknown: 0, sampleBatches: [] as string[] };
      for (const m of movs) { if (m.movementStatus === 'Fast') _dbg.fast++; else if (m.movementStatus === 'Slow') _dbg.slow++; else _dbg.unknown++; }
      const _wb = movs.filter(m => m.batch && m.batch.trim()).slice(0, 5);
      _dbg.sampleBatches = _wb.map(m => m.batch);
      console.log('[FastSlow] movements:', JSON.stringify(_dbg));

      // ── Selalu update state dengan hasil server.
      setMovements(movs);
      setStockCards(data.stockCards || []);
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

    // Debounce: tunggu user selesai mengubah rentang tanggal sebelum fetch.
    // Set start lalu end (2x perubahan input) hanya memicu SATU request aggregate
    // → mengurangi burst request berat yang bisa menghabiskan pool koneksi DB.
    const t = setTimeout(() => {
      lastAggregateQs.current = qs;
      loadAggregate(params);
    }, 400);
    return () => clearTimeout(t);
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

  const handleCopyDashboard = async () => {
    if (!contentRef.current || copyStatus === 'loading') return;
    setCopyStatus('loading');
    setCopyErrorMessage('');

    const gudangLabel = selectedGudang
      ? `Gudang ${selectedGudang}`
      : (sessionGudang ? `Gudang ${sessionGudang}` : 'Semua Gudang');

    const dateRangeLabel = startDate || endDate
      ? `Periode: ${startDate || 'Awal'} s/d ${endDate || 'Akhir'}`
      : 'Data Pergerakan Terkini';

    const res = await copyDashboardToClipboard(contentRef.current, {
      headerTitle: `Warehouse Dashboard - ${gudangLabel}`,
      headerSubtitle: dateRangeLabel,
    });

    if (res.success) {
      setCopyStatus('success');
      setTimeout(() => {
        setCopyStatus('idle');
      }, 2500);
    } else {
      if (res.dataUrl) {
        setCapturedImageUrl(res.dataUrl);
        setPreviewModalOpen(true);
        setCopyStatus('idle');
      } else {
        setCopyStatus('error');
        setCopyErrorMessage(res.error || 'Gagal menyalin');
        setTimeout(() => {
          setCopyStatus('idle');
        }, 3500);
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
    a.download = `dashboard-spindo-${dateStr}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
        <div className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl">

          <div className="flex bg-white border border-slate-200/60 rounded-lg p-0.5 shadow-sm">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`h-7 px-3 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <LayoutDashboard size={14} strokeWidth={viewMode === 'dashboard' ? 2.5 : 2} />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <button
              onClick={() => setViewMode('report')}
              className={`h-7 px-3 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'report'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Layout size={14} strokeWidth={viewMode === 'report' ? 2.5 : 2} />
              <span className="hidden sm:inline">Report</span>
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`h-7 px-3 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
                viewMode === 'analytics'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <TrendingUp size={14} strokeWidth={viewMode === 'analytics' ? 2.5 : 2} />
              <span className="hidden sm:inline">Analytics</span>
            </button>
          </div>

          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          {/* ─── Copy Dashboard Button ─── */}
          <button
            onClick={handleCopyDashboard}
            disabled={copyStatus === 'loading'}
            className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm border ${
              copyStatus === 'success'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : copyStatus === 'error'
                ? 'bg-rose-50 text-rose-700 border-rose-300'
                : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
            }`}
            title="Salin grafik dashboard ke clipboard (bisa langsung di-paste dengan Ctrl+V)"
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
                <span title={copyErrorMessage}>Gagal Menyalin</span>
              </>
            ) : (
              <>
                <Copy size={13} strokeWidth={2} className="text-slate-500" />
                <span className="hidden sm:inline">Salin Grafik</span>
              </>
            )}
          </button>
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
                <StatsCard title="Incoming" value={filteredStats ? (filteredStats.totalIncoming / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="in" condensed delay={0.05} onClick={handleInboundClick} />
                <StatsCard title="Outgoing" value={filteredStats ? (filteredStats.totalOutgoing / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" type="out" condensed delay={0.1} onClick={handleOutboundClick} />
                <StatsCard title="Net Flow" value={((filteredStats?.netMovement || 0) / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" type="net" condensed delay={0.15} />
                <StatsCard title="Transactions" value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString('id-ID')} unit="TRX" type="total" condensed delay={0.2} />
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
                      if (id === 'stock') return <SortableItem key="stock" id="stock"><StockReport data={filteredStocks} summary={adjustedStockSummary} condensed /></SortableItem>;
                      if (id === 'pipa-nc') return (
                        <SortableItem key="pipa-nc" id="pipa-nc">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center gap-2.5 mb-4">
                              <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/60">
                                <Package size={14} strokeWidth={2.5} />
                              </div>
                              <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Data Pipa NC</h3>
                              <div className="ml-auto flex items-center gap-2">
                                <button onClick={() => leftOrder.includes('pipa-nc') ? moveToRight('pipa-nc') : moveToLeft('pipa-nc')} className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-md transition-colors" title="Pindah Kolom">
                                  <ArrowLeftRight size={14} strokeWidth={2} />
                                </button>
                                <button onClick={() => router.push('/pipa-nc')} className="text-[9px] font-semibold text-slate-600 hover:text-slate-900 underline">Lihat Detail</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                              {/* Grade C */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">GRADE C</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeC.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">{pipaNCStats.gradeC || 0} batch akhiran C</span>
                                </div>
                              </motion.div>
                              {/* Grade E */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">GRADE E</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeE.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">{pipaNCStats.gradeE || 0} batch akhiran E</span>
                                </div>
                              </motion.div>
                              {/* Total Item */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL ITEM</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200"><Box size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{((pipaNCStats.gradeC || 0) + (pipaNCStats.gradeE || 0)).toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Total pipa NC</span>
                                </div>
                              </motion.div>
                              {/* Total Qty */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-sky-600" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL QTY</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-sky-50 text-sky-700 border border-sky-200/60"><Package size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalQty.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">PC</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Stok BOM</span>
                                </div>
                              </motion.div>
                              {/* Total Tonase */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-600" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL TONASE</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">TON</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Stok EOM</span>
                                </div>
                              </motion.div>
                            </div>
                          </div>
                        </SortableItem>
                      );
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
                      if (id === 'movement-chart') return <SortableItem key="movement-chart" id="movement-chart"><MovementChart data={chartMovements} condensed useAllData={true} selectedGudang={selectedGudang} startDate={startDate} endDate={endDate} /></SortableItem>;
                      if (id === 'movement-table') return <SortableItem key="movement-table" id="movement-table"><MovementTable data={chartMovements} condensed /></SortableItem>;
                      if (id === 'fastslow') return <SortableItem key="fastslow" id="fastslow"><FastSlowTransactionChart data={statusMovements} condensed /></SortableItem>;
                      if (id === 'pipa-nc') return (
                        <SortableItem key="pipa-nc" id="pipa-nc">
                          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            <div className="flex items-center gap-2.5 mb-4">
                              <div className="p-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200/60">
                                <Package size={14} strokeWidth={2.5} />
                              </div>
                              <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Data Pipa NC</h3>
                              <div className="ml-auto flex items-center gap-2">
                                <button onClick={() => leftOrder.includes('pipa-nc') ? moveToRight('pipa-nc') : moveToLeft('pipa-nc')} className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 p-1.5 rounded-md transition-colors" title="Pindah Kolom">
                                  <ArrowLeftRight size={14} strokeWidth={2} />
                                </button>
                                <button onClick={() => router.push('/pipa-nc')} className="text-[9px] font-semibold text-slate-600 hover:text-slate-900 underline">Lihat Detail</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                              {/* Grade C */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">GRADE C</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeC.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">{pipaNCStats.gradeC || 0} batch akhiran C</span>
                                </div>
                              </motion.div>
                              {/* Grade E */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">GRADE E</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeE.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">{pipaNCStats.gradeE || 0} batch akhiran E</span>
                                </div>
                              </motion.div>
                              {/* Total Item */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-500" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL ITEM</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200"><Box size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{((pipaNCStats.gradeC || 0) + (pipaNCStats.gradeE || 0)).toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">ITEM</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Total pipa NC</span>
                                </div>
                              </motion.div>
                              {/* Total Qty */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-sky-600" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL QTY</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-sky-50 text-sky-700 border border-sky-200/60"><Package size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalQty.toLocaleString('id-ID')}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">PC</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Stok BOM</span>
                                </div>
                              </motion.div>
                              {/* Total Tonase */}
                              <motion.div
                                whileHover={{ y: -2 }}
                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-3 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                                onClick={() => router.push('/pipa-nc')}
                              >
                                <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-600" />
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL TONASE</span>
                                  <div className="w-6 h-6 rounded flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60"><TrendingUp size={10} strokeWidth={2.5} /></div>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                  <span className="text-xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                                  <span className="text-[9px] font-semibold text-slate-400">TON</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  <span className="text-[9px] font-medium text-slate-500 truncate">Stok EOM</span>
                                </div>
                              </motion.div>
                            </div>
                          </div>
                        </SortableItem>
                      );
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatsCard title="Total Inbound" value={filteredStats ? (filteredStats.totalIncoming / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${filteredStats?.incomingCount.toLocaleString('id-ID') || '0'} transaksi masuk`} type="in" delay={0.05} onClick={handleInboundClick} />
                  <StatsCard title="Total Outbound" value={filteredStats ? (filteredStats.totalOutgoing / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1}) : '0'} unit="TON" subtitle={`${filteredStats?.outgoingCount.toLocaleString('id-ID') || '0'} transaksi keluar`} type="out" delay={0.1} onClick={handleOutboundClick} />
                  <StatsCard title="Net Flow" value={((filteredStats?.netMovement || 0) / 1000).toLocaleString('id-ID', {minimumFractionDigits: 1, maximumFractionDigits: 1})} unit="TON" subtitle="Selisih material masuk & keluar" type="net" delay={0.15} />
                  <StatsCard title="Total Transaksi" value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString('id-ID')} unit="TRX" subtitle="Total row data dari SAP" type="total" delay={0.2} />
                </div>
              </section>

              {/* ─── Pipa NC Section ─── */}
              <section>
                  <SectionTitle>Data Pipa NC</SectionTitle>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Grade C */}
                    <motion.div
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                      onClick={() => router.push('/pipa-nc')}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-amber-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">GRADE C</span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-50 text-amber-600 border border-amber-200/60"><TrendingUp size={14} strokeWidth={2.5} /></div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeC.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-semibold text-slate-400">ITEM</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-[10px] font-medium text-slate-500 truncate">{pipaNCStats.gradeC || 0} batch akhiran C</span>
                      </div>
                    </motion.div>
                    {/* Grade E */}
                    <motion.div
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                      onClick={() => router.push('/pipa-nc')}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-rose-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">GRADE E</span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600 border border-rose-200/60"><TrendingUp size={14} strokeWidth={2.5} /></div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.gradeE.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-semibold text-slate-400">ITEM</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span className="text-[10px] font-medium text-slate-500 truncate">{pipaNCStats.gradeE || 0} batch akhiran E</span>
                      </div>
                    </motion.div>
                    {/* Total Item */}
                    <motion.div
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                      onClick={() => router.push('/pipa-nc')}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-slate-500" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL ITEM</span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700 border border-slate-200"><Box size={14} strokeWidth={2.5} /></div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalItem.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-semibold text-slate-400">ITEM</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        <span className="text-[10px] font-medium text-slate-500 truncate">Total pipa NC</span>
                      </div>
                    </motion.div>
                    {/* Total Qty */}
                    <motion.div
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                      onClick={() => router.push('/pipa-nc')}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-sky-600" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL QTY</span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-50 text-sky-700 border border-sky-200/60"><Package size={14} strokeWidth={2.5} /></div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalQty.toLocaleString('id-ID')}</span>
                        <span className="text-[10px] font-semibold text-slate-400">PC</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-sky-600" />
                        <span className="text-[10px] font-medium text-slate-500 truncate">Stok BOM</span>
                      </div>
                    </motion.div>
                    {/* Total Tonase */}
                    <motion.div
                      whileHover={{ y: -3 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      className="group relative overflow-hidden rounded-xl bg-white border border-slate-200/80 p-4 shadow-sm hover:border-slate-300 hover:shadow-md cursor-pointer"
                      onClick={() => router.push('/pipa-nc')}
                    >
                      <div className="absolute top-0 left-0 right-0 h-[3px] bg-emerald-600" />
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">TOTAL TONASE</span>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60"><TrendingUp size={14} strokeWidth={2.5} /></div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mb-1.5">
                        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{pipaNCStats.totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        <span className="text-[10px] font-semibold text-slate-400">TON</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        <span className="text-[10px] font-medium text-slate-500 truncate">Stok EOM</span>
                      </div>
                    </motion.div>
                  </div>
                </section>

              <section>
                <SectionTitle>Analisis Pergerakan Material</SectionTitle>
                <MovementChart data={chartMovements} useAllData={true} selectedGudang={selectedGudang} startDate={startDate} endDate={endDate} />
              </section>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

              <section>
                <SectionTitle>Distribusi Stok &amp; Transaksi per Klasifikasi</SectionTitle>
                <div className="flex flex-col gap-5">
                  <StockReport data={filteredStocks} summary={adjustedStockSummary} />
                  <FastSlowTransactionChart data={statusMovements} />
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
                    <MovementTable data={chartMovements} />
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Fallback Preview / Manual Copy Modal ─── */}
      <AnimatePresence>
        {previewModalOpen && capturedImageUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
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

              {/* Modal Image Body */}
              <div className="p-4 overflow-y-auto max-h-[62vh] bg-slate-50/50 flex justify-center">
                <img
                  src={capturedImageUrl}
                  alt="Dashboard Preview"
                  className="rounded-xl border border-slate-200/80 shadow-sm max-w-full h-auto object-contain cursor-pointer"
                  title="Klik kanan lalu pilih 'Salin Gambar' (Copy Image)"
                />
              </div>

              {/* Modal Footer Actions */}
              <div className="px-5 py-3 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
                <button
                  onClick={handleDownloadFromModal}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>Unduh PNG</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewModalOpen(false)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Tutup
                  </button>
                  <button
                    onClick={handleCopyFromModal}
                    className={`h-8 px-3.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                      modalCopied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
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
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3.5 px-0.5">
      <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{children}</h2>
    </div>
  );
}
