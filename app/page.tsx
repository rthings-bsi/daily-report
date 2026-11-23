'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FileUp, LayoutDashboard, Layout, TrendingUp, Upload, Check, X, Filter, Package, Box, Copy, Loader2, AlertCircle, Download } from 'lucide-react';
import { copyDashboardToClipboard } from '@/lib/clipboard-capture';
import { useRouter } from 'next/navigation';
import { parseSapExcel, ProcessedMovement, MovementStats, calculateStats, ProcessedStock, getShiftFromTime, getOperationalDateStr } from '@/lib/excel-parser';
import { getUserGudang, filterByGudang, filterByGudangList, getGudangPrefix, gudangFromSloc, reclassify311, removeInternalTfSloc, classifyBatch, isPenampunganSloc } from '@/lib/gudang';
import { filterEnabledMovements, filterEnabledWorkCenters, getMovementInfo } from '@/lib/sap-mapping';
import { StatsCard } from '@/components/StatsCard';
import { MovementTable } from '@/components/MovementTable';
import { MovementChart } from '@/components/MovementChart';
import { WorkCenterBreakdown } from '@/components/WorkCenterBreakdown';
import { StockReport, StockReportSummary } from '@/components/StockReport';
import { StockClassificationSection } from '@/components/StockClassificationSection';
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
  totalUnitQuantity?: number;
  fastCount?: number;
  slowCount?: number;
  fastWeight?: number;
  slowWeight?: number;
}

const easeOut = [0.16, 1, 0.3, 1] as const;

import { adjustStockSummaryWithMovements } from '@/lib/stock-adjustment';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = session?.user?.role?.toLowerCase() || '';
  const isAdmin = session?.user?.role === 'admin';
  const isMerger = (session?.user as any)?.roleScope === 'merger';
  const mergerGudangIds: number[] = ((session?.user as any)?.mergerGudangIds as number[] | undefined) || [];
  const canFilterGudang = isAdmin || (session?.user as any)?.roleScope === 'global' || isMerger;
  const userPerms = session?.user?.permissions || [];
  const hasDashboardAccess = isAdmin || userPerms.includes('dashboard');
  const isRepairRole =
    userRole === 'repair' ||
    userRole === 'rep' ||
    userRole.includes('repair') ||
    (!hasDashboardAccess && userPerms.includes('repair-packing'));

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
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [history, setHistory] = useState<HistorySession[]>([]);
  const sessionGudang = useMemo(() => getUserGudang(session?.user?.name), [session]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [copyErrorMessage, setCopyErrorMessage] = useState('');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [modalCopied, setModalCopied] = useState(false);

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
    if (selectedGudang) {
       const afterRemove = removeInternalTfSloc(result);
       const afterGudang = filterByGudang(afterRemove, selectedGudang);
       result = reclassify311(afterGudang, selectedGudang);
    } else if (isMerger && mergerGudangIds.length > 0) {
       const afterRemove = removeInternalTfSloc(result);
       const afterFilter = filterByGudangList(afterRemove, mergerGudangIds);
       result = afterFilter.map(m => {
         if (m.moveType !== '311' || m.group !== 'Transfer') return m;
         return m.quantity < 0
           ? { ...m, description: 'TF Sloc Out', group: 'Keluar' }
           : { ...m, description: 'TF Sloc In', group: 'Masuk' };
       });
    }
    if (startDate) result = result.filter(m => {
        const opDate = m.entryTime ? getOperationalDateStr(m.entryDate || m.dateStr, m.entryTime) : m.dateStr;
        const mDate = opDate?.split('T')[0];
        return mDate ? mDate >= startDate : true;
    });
    if (endDate) result = result.filter(m => {
        const opDate = m.entryTime ? getOperationalDateStr(m.entryDate || m.dateStr, m.entryTime) : m.dateStr;
        const mDate = opDate?.split('T')[0];
        return mDate ? mDate <= endDate : true;
    });
    if (selectedShift !== null) {
      result = result.filter(m => {
        const mShift = m.shift || (m.entryTime ? getShiftFromTime(m.entryTime) : undefined);
        return mShift === selectedShift;
      });
    }
    return result;
  }, [movements, selectedGudang, isMerger, mergerGudangIds, startDate, endDate, selectedShift]);

  const filteredStocks = useMemo(() => {
    if (!stocks.length) return stocks;
    if (selectedGudang) {
      const prefix = getGudangPrefix(selectedGudang);
      if (!prefix) return stocks;
      return stocks.filter(s => {
        const sloc = (s.sloc || '').toUpperCase();
        return sloc.startsWith(prefix) || s.status === 'Sloc Penampungan';
      });
    }
    if (isMerger && mergerGudangIds.length > 0) {
      const prefixes = mergerGudangIds.map(getGudangPrefix).filter(Boolean);
      return stocks.filter(s => {
        const sloc = (s.sloc || '').toUpperCase();
        return prefixes.some(p => sloc.startsWith(p)) || s.status === 'Sloc Penampungan';
      });
    }
    return stocks;
  }, [stocks, selectedGudang, isMerger, mergerGudangIds]);

  const adjustedStockSummary = useMemo(() => {
    return adjustStockSummaryWithMovements(stockSummary, filteredStocks, filteredMovements);
  }, [stockSummary, filteredStocks, filteredMovements]);

  const filteredStats = useMemo(() => {
    if (movements && movements.length > 0) {
      return calculateStats(filteredMovements);
    }

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
  }, [movements, filteredMovements, movementSummaries, stats]);

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
        unitQuantity: s.totalUnitQuantity || 0,
        userName: '',
        storageLocation: '',
        color: s.color,
        movementStatus:
          s.fastCount && s.fastCount > 0 && !s.slowCount
            ? ('Fast' as const)
            : s.slowCount && s.slowCount > 0 && !s.fastCount
            ? ('Slow' as const)
            : ('Unknown' as const),
        fastCount: s.fastCount || 0,
        slowCount: s.slowCount || 0,
        fastWeight: s.fastWeight || 0,
        slowWeight: s.slowWeight || 0,
        totalCount: s.totalCount,
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
    if (status === 'authenticated' && hasDashboardAccess && !isRepairRole) {
      loadHistory();
    }
  }, [status, hasDashboardAccess, isRepairRole, loadHistory]);

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
        const opDate = m.entryTime ? getOperationalDateStr(m.entryDate || m.dateStr, m.entryTime) : m.dateStr;
        const mShift = m.shift || (m.entryTime ? getShiftFromTime(m.entryTime) : undefined);
        return {
          movementId: m.movementId || `move-${Math.random()}`,
          postingDate: opDate,
          dateStr: opDate,
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
          entryTime: m.entryTime || undefined,
          entryDate: m.entryDate || undefined,
          shift: mShift,
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
        const opDate = m.entryTime ? getOperationalDateStr(m.entryDate || m.dateStr, m.entryTime) : m.dateStr;
        const mShift = m.shift || (m.entryTime ? getShiftFromTime(m.entryTime) : undefined);
        return {
          movementId: m.movementId || `agg-${Math.random()}`,
          postingDate: opDate,
          dateStr: opDate,
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
          entryTime: m.entryTime || undefined,
          entryDate: m.entryDate || undefined,
          shift: mShift,
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
  }, []);

  // Load aggregated data whenever filters change
  useEffect(() => {
    if (!hasDashboardAccess || isRepairRole) return;

    const params = new URLSearchParams();
    if (selectedGudang) params.set('gudangId', String(selectedGudang));
    if (startDate) params.set('start', startDate);
    if (endDate) params.set('end', endDate);
    if (selectedShift !== null) params.set('shift', String(selectedShift));

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
  }, [hasDashboardAccess, isRepairRole, startDate, endDate, selectedGudang, selectedShift, loadAggregate]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      if (isRepairRole) {
        router.replace('/repair-packing');
      } else if (!hasDashboardAccess) {
        const firstModule = userPerms.find((p: string) =>
          ['repair-packing', 'pipa-nc', 'audit-sloc', 'upload'].includes(p)
        );
        router.replace(firstModule ? `/${firstModule}` : '/login');
      } else if (session?.user?.role !== 'admin' && !isMerger && session?.user?.gudangId) {
        setSelectedGudang(session.user.gudangId);
      }
    }
  }, [status, session, isRepairRole, hasDashboardAccess, userPerms, router]);

  // ─── Protected Routes Handling ───
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated' || isRepairRole || !hasDashboardAccess) return null;

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
      <main className="min-h-screen bg-[var(--neu-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl neu-card-sm flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
          </div>
          <p className="font-mono text-xs font-medium text-[var(--neu-text-muted)]">Memuat data terbaru...</p>
        </div>
      </main>
    );
  }

  // ─── First-time: no data & no history → show upload prompt inline ───
  if (!movements.length && !stocks.length && history.length === 0) {
    return (
      <main className="min-h-screen bg-[var(--neu-bg)] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-5 max-w-sm text-center neu-card p-8">
          <div className="w-16 h-16 rounded-2xl neu-icon-inset flex items-center justify-center text-[var(--neu-accent)]">
            <Upload size={26} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[var(--neu-text)] mb-1">Warehouse Intelligence</h1>
            <p className="text-[13px] text-[var(--neu-text-muted)]">
              Unggah laporan SAP Excel untuk mulai memvisualisasikan data gudang.
            </p>
          </div>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 neu-btn-primary rounded-xl text-[13px] font-bold cursor-pointer"
          >
            Pilih File SAP Excel
          </button>
        </div>
      </main>
    );
  }

  // ─── Dashboard / Report ───
  return (
    <main className="min-h-screen bg-[var(--neu-bg)] text-[var(--neu-text)] font-sans transition-colors duration-200">
      <PageHeader icon={LayoutDashboard} title="Warehouse" subtitle="Dashboard gudang SPINDO" className="print:hidden">

        {/* ─── Collapsible Neumorphic Filter Control ─── */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className={`h-9 px-3.5 inline-flex items-center gap-1.5 rounded-xl text-[12px] font-bold transition-neu cursor-pointer ${
              selectedGudang || startDate || endDate || selectedShift !== null
                ? 'neu-btn-primary'
                : 'neu-btn text-[var(--neu-text-secondary)]'
            }`}
            title="Filter"
          >
            <Filter size={13} strokeWidth={2.2} className="shrink-0" />
            <span className="hidden lg:inline">Filter</span>
            {(selectedGudang || startDate || endDate || selectedShift !== null) && (
              <span className="w-4 h-4 rounded-full bg-white/25 flex items-center justify-center font-mono text-[9.5px] font-bold">
                {(selectedGudang ? 1 : 0) + ((startDate || endDate) ? 1 : 0) + (selectedShift !== null ? 1 : 0)}
              </span>
            )}
          </button>

          {filterOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-2.5 z-50 neu-float p-4 min-w-[295px] space-y-4">
                <p className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                  Filter Parameter
                </p>

                {canFilterGudang && (
                  <div>
                    <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">Gudang</label>
                    <select
                      value={selectedGudang ?? ''}
                      onChange={e => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
                      className="neu-input w-full h-9.5 text-[12px] font-semibold rounded-xl px-3 cursor-pointer"
                    >
                      <option value="">{isMerger ? 'Semua Gudang Terhubung' : 'Semua Gudang'}</option>
                      {(isMerger ? mergerGudangIds : Array.from({ length: 14 }, (_, i) => i + 1)).map(n => (
                        <option key={n} value={n}>Gudang {n}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] mb-1.5 block">Rentang Tanggal</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="neu-input flex-1 h-9.5 text-[11px] font-mono font-medium rounded-xl px-2.5"
                    />
                    <span className="text-xs text-[var(--neu-text-muted)] font-bold">-</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="neu-input flex-1 h-9.5 text-[11px] font-mono font-medium rounded-xl px-2.5"
                    />
                  </div>
                </div>

                {/* ─── Shift Kerja Filter ─── */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11.5px] font-bold text-[var(--neu-text-secondary)] block">Shift Kerja</label>
                    <span className="font-mono text-[9.5px] text-[var(--neu-text-muted)]">Entered at (SAP)</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-1 neu-inset-sm rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSelectedShift(null)}
                      className={`h-7.5 rounded-lg text-[11px] font-bold transition-neu cursor-pointer ${
                        selectedShift === null
                          ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                          : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                      }`}
                    >
                      Semua
                    </button>
                    {[
                      { num: 1, label: 'Shift 1', title: '07:00 - 15:00' },
                      { num: 2, label: 'Shift 2', title: '15:00 - 23:00' },
                      { num: 3, label: 'Shift 3', title: '23:00 - 07:00' },
                    ].map(s => (
                      <button
                        key={s.num}
                        type="button"
                        onClick={() => setSelectedShift(s.num)}
                        className={`h-7.5 rounded-lg text-[11px] font-bold transition-neu flex items-center justify-center cursor-pointer ${
                          selectedShift === s.num
                            ? 'neu-btn-primary'
                            : 'text-[var(--neu-text-secondary)] hover:text-[var(--neu-text)]'
                        }`}
                        title={s.title}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between font-mono text-[9px] text-[var(--neu-text-muted)] mt-1.5 px-0.5">
                    <span>S1: 07.00-15.00</span>
                    <span>S2: 15.00-23.00</span>
                    <span>S3: 23.00-07.00</span>
                  </div>
                </div>

                {(selectedGudang || startDate || endDate || selectedShift !== null) && (
                  <button
                    type="button"
                    onClick={() => { setSelectedGudang(null); setStartDate(''); setEndDate(''); setSelectedShift(null); setFilterOpen(false); }}
                    className="w-full h-8.5 text-[11.5px] font-bold text-[var(--neu-red)] neu-btn rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X size={12} strokeWidth={2.5} /> Reset Filter
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── Tactile View Mode Segmented Switcher & Copy Action ─── */}
        <div className="flex items-center gap-2">
          <div className="flex neu-inset-sm rounded-xl p-1">
            {[
              { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
              { id: 'report' as const, label: 'Report', icon: Layout },
              { id: 'analytics' as const, label: 'Analytics', icon: TrendingUp },
            ].map((tab) => {
              const activeTab = viewMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setViewMode(tab.id)}
                  className={`h-7.5 px-3 rounded-lg text-[12px] font-bold transition-neu flex items-center gap-1.5 cursor-pointer ${
                    activeTab
                      ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                      : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                  }`}
                >
                  <tab.icon size={13} strokeWidth={activeTab ? 2.4 : 2} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* ─── Copy Dashboard Button ─── */}
          <button
            type="button"
            onClick={handleCopyDashboard}
            disabled={copyStatus === 'loading'}
            className={`h-9 px-3.5 rounded-xl text-[12px] font-bold transition-neu flex items-center gap-1.5 cursor-pointer ${
              copyStatus === 'success'
                ? 'neu-inset-sm text-[var(--neu-green)]'
                : copyStatus === 'error'
                ? 'neu-inset-sm text-[var(--neu-red)]'
                : 'neu-btn-primary'
            }`}
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
        <AnimatePresence mode="wait">

          {/* ═══════════ ANALYTICS MODE ═══════════ */}
          {viewMode === 'analytics' ? (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: easeOut }}
            >
              <AnalyticsDashboard />
            </motion.div>
          ) : viewMode === 'report' ? (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="flex flex-col gap-5 sm:gap-6 pb-8"
              data-purpose="report-mode-container"
            >
              {/* Row 1: KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Total Inbound"
                  value={
                    filteredStats
                      ? (filteredStats.totalIncoming / 1000).toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : '0'
                  }
                  unit="TON"
                  subtitle={`${filteredStats?.incomingCount.toLocaleString('id-ID') || '0'} transaksi masuk`}
                  type="in"
                  condensed
                  delay={0.03}
                  onClick={handleInboundClick}
                />
                <StatsCard
                  title="Total Outbound"
                  value={
                    filteredStats
                      ? (filteredStats.totalOutgoing / 1000).toLocaleString('id-ID', {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })
                      : '0'
                  }
                  unit="TON"
                  subtitle={`${filteredStats?.outgoingCount.toLocaleString('id-ID') || '0'} transaksi keluar`}
                  type="out"
                  condensed
                  delay={0.06}
                  onClick={handleOutboundClick}
                />
                <StatsCard
                  title="Net Flow"
                  value={((filteredStats?.netMovement || 0) / 1000).toLocaleString('id-ID', {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  unit="TON"
                  subtitle="Selisih material masuk & keluar"
                  type="net"
                  condensed
                  delay={0.09}
                />
                <StatsCard
                  title="Total Transaksi"
                  value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString('id-ID')}
                  unit="TRX"
                  subtitle="Total pergerakan data SAP"
                  type="total"
                  condensed
                  delay={0.12}
                />
              </div>

              {/* Row 2: Pipa NC 5-item Strip */}
              <div className="neu-card p-5">
                <div className="flex items-center justify-between px-0.5 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--neu-accent)]" />
                    <h3 className="text-[13.5px] font-extrabold text-[var(--neu-text)] tracking-tight">
                      Ringkasan Data Pipa NC
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/pipa-nc')}
                    className="text-[12px] font-bold text-[var(--neu-accent)] hover:underline cursor-pointer"
                  >
                    Buka Detail Pipa NC
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  {[
                    {
                      label: 'GRADE C',
                      value: pipaNCStats.gradeC.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: `${pipaNCStats.gradeC || 0} batch akhiran C`,
                      dot: 'var(--neu-amber-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-amber)]',
                    },
                    {
                      label: 'GRADE E',
                      value: pipaNCStats.gradeE.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: `${pipaNCStats.gradeE || 0} batch akhiran E`,
                      dot: 'var(--neu-red-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-red)]',
                    },
                    {
                      label: 'TOTAL ITEM',
                      value: pipaNCStats.totalItem.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: 'Total pipa terdaftar',
                      dot: 'var(--neu-accent)',
                      icon: Box,
                      color: 'text-[var(--neu-accent)]',
                    },
                    {
                      label: 'TOTAL QTY',
                      value: pipaNCStats.totalQty.toLocaleString('id-ID'),
                      unit: 'PC',
                      desc: 'Stok BOM terhitung',
                      dot: 'var(--neu-purple-bar)',
                      icon: Package,
                      color: 'text-[var(--neu-purple)]',
                    },
                    {
                      label: 'TOTAL TONASE',
                      value: pipaNCStats.totalTonase.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                      unit: 'TON',
                      desc: 'Stok EOM aktif',
                      dot: 'var(--neu-green-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-green)]',
                      span: 'col-span-2 md:col-span-1',
                    },
                  ].map((c) => (
                    <button
                      type="button"
                      key={c.label}
                      onClick={() => router.push('/pipa-nc')}
                      className={`p-3.5 rounded-2xl neu-inset-sm hover:bg-[var(--neu-surface)] hover:shadow-[var(--neu-shadow-sm)] transition-neu cursor-pointer text-left ${c.span || ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">{c.label}</span>
                        <span className={`w-6 h-6 rounded-lg neu-icon-well flex items-center justify-center ${c.color}`}>
                          <c.icon size={11} strokeWidth={2.4} />
                        </span>
                      </div>
                      <div className="text-[20px] font-extrabold text-[var(--neu-text)] mt-2 tabular-nums leading-none">
                        {c.value}{' '}
                        <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)]">{c.unit}</span>
                      </div>
                      <p className="text-[11px] text-[var(--neu-text-muted)] mt-2 truncate flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                        {c.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Daily Movement & Volume */}
              <div className="w-full">
                <MovementChart
                  data={chartMovements}
                  condensed={true}
                  useAllData={true}
                  selectedGudang={selectedGudang}
                  startDate={startDate}
                  endDate={endDate}
                  selectedShift={selectedShift}
                />
              </div>

              {/* Row 4: Stock Classification */}
              <div className="w-full">
                <StockClassificationSection
                  stocks={filteredStocks}
                  stockSummary={adjustedStockSummary}
                  movements={statusMovements}
                />
              </div>

              {/* Row 5: Work Center + Movement Table */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                <div className="lg:col-span-7 flex flex-col">
                  <WorkCenterBreakdown data={chartMovements} condensed={true} />
                </div>
                <div className="lg:col-span-5 flex flex-col">
                  <MovementTable data={statusMovements} condensed={true} />
                </div>
              </div>
            </motion.div>

          ) : (

          /* ═══════════ FULL DASHBOARD MODE (Tactile Soft UI) ═══════════ */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
                    {selectedGudang ? `G${selectedGudang}` : (isMerger ? 'MG' : sessionGudang ? `G${sessionGudang}` : 'ALL')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h1 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight text-[var(--neu-text)] leading-tight">
                        Warehouse Dashboard
                      </h1>
                      <span className="neu-chip">
                        {selectedGudang
                          ? `GUDANG ${selectedGudang}`
                          : isMerger
                          ? `MERGER (${mergerGudangIds.join(', ')})`
                          : sessionGudang
                          ? `GUDANG ${sessionGudang}`
                          : 'SEMUA GUDANG'}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[var(--neu-text-muted)] mt-1">
                      Monitoring tonase masuk, keluar, dan klasifikasi pergerakan stok harian
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

              {/* ─── KPI Section ─── */}
              <section aria-label="Key Performance Indicators" data-purpose="hero-kpi-grid">
                <SectionTitle>Key Performance Indicators</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                  <StatsCard
                    title="Total Inbound"
                    value={
                      filteredStats
                        ? (filteredStats.totalIncoming / 1000).toLocaleString('id-ID', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })
                        : '0'
                    }
                    unit="TON"
                    subtitle={`${filteredStats?.incomingCount.toLocaleString('id-ID') || '0'} transaksi masuk`}
                    type="in"
                    delay={0.03}
                    onClick={handleInboundClick}
                  />
                  <StatsCard
                    title="Total Outbound"
                    value={
                      filteredStats
                        ? (filteredStats.totalOutgoing / 1000).toLocaleString('id-ID', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })
                        : '0'
                    }
                    unit="TON"
                    subtitle={`${filteredStats?.outgoingCount.toLocaleString('id-ID') || '0'} transaksi keluar`}
                    type="out"
                    delay={0.06}
                    onClick={handleOutboundClick}
                  />
                  <StatsCard
                    title="Net Flow"
                    value={((filteredStats?.netMovement || 0) / 1000).toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    unit="TON"
                    subtitle="Selisih material masuk & keluar"
                    type="net"
                    delay={0.09}
                  />
                  <StatsCard
                    title="Total Transaksi"
                    value={(filteredStats?.totalCount ?? filteredMovements.length).toLocaleString('id-ID')}
                    unit="TRX"
                    subtitle="Total row data dari SAP"
                    type="total"
                    delay={0.12}
                  />
                </div>
              </section>

              {/* ─── Pipa NC Section ─── */}
              <section aria-label="Data Pipa NC Secondary Stats Bar" data-purpose="pipa-nc-stats-bar">
                <div className="flex items-center justify-between px-0.5 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full neu-inset-sm flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)]" />
                    </div>
                    <h2 className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                      Data Pipa NC
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/pipa-nc')}
                    className="text-[12px] font-bold text-[var(--neu-accent)] hover:underline cursor-pointer"
                  >
                    Buka Detail Pipa NC
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    {
                      label: 'GRADE C',
                      value: pipaNCStats.gradeC.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: `${pipaNCStats.gradeC || 0} batch akhiran C`,
                      dot: 'var(--neu-amber-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-amber)]',
                    },
                    {
                      label: 'GRADE E',
                      value: pipaNCStats.gradeE.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: `${pipaNCStats.gradeE || 0} batch akhiran E`,
                      dot: 'var(--neu-red-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-red)]',
                    },
                    {
                      label: 'TOTAL ITEM',
                      value: pipaNCStats.totalItem.toLocaleString('id-ID'),
                      unit: 'ITEM',
                      desc: 'Total pipa terdaftar',
                      dot: 'var(--neu-accent)',
                      icon: Box,
                      color: 'text-[var(--neu-accent)]',
                    },
                    {
                      label: 'TOTAL QTY',
                      value: pipaNCStats.totalQty.toLocaleString('id-ID'),
                      unit: 'PC',
                      desc: 'Stok BOM terhitung',
                      dot: 'var(--neu-purple-bar)',
                      icon: Package,
                      color: 'text-[var(--neu-purple)]',
                    },
                    {
                      label: 'TOTAL TONASE',
                      value: pipaNCStats.totalTonase.toLocaleString('id-ID', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }),
                      unit: 'TON',
                      desc: 'Stok EOM aktif',
                      dot: 'var(--neu-green-bar)',
                      icon: TrendingUp,
                      color: 'text-[var(--neu-green)]',
                      span: 'col-span-2 md:col-span-1',
                      descCls: 'text-[var(--neu-green)] font-semibold',
                    },
                  ].map((c) => (
                    <button
                      type="button"
                      key={c.label}
                      onClick={() => router.push('/pipa-nc')}
                      className={`p-4 rounded-2xl neu-card neu-card-interactive active:shadow-[var(--neu-shadow-inset-sm)] cursor-pointer text-left ${c.span || ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                          {c.label}
                        </span>
                        <span className={`w-7 h-7 rounded-xl neu-icon-inset flex items-center justify-center ${c.color}`}>
                          <c.icon size={12} strokeWidth={2.4} />
                        </span>
                      </div>
                      <div className="text-[24px] font-extrabold text-[var(--neu-text)] mt-2.5 tabular-nums leading-none">
                        {c.value}{' '}
                        <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">{c.unit}</span>
                      </div>
                      <p className={`text-[11px] mt-2.5 truncate flex items-center gap-1.5 ${c.descCls || 'text-[var(--neu-text-muted)]'}`}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
                        {c.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </section>

              {/* ─── Daily Movement & Trend Section ─── */}
              <section aria-label="Analisis Pergerakan Material">
                <MovementChart
                  data={chartMovements}
                  useAllData={true}
                  selectedGudang={selectedGudang}
                  startDate={startDate}
                  endDate={endDate}
                  selectedShift={selectedShift}
                />
              </section>

              {/* ─── Fast vs Slow Stock Classification ─── */}
              <section aria-label="Distribusi Stok & Transaksi per Klasifikasi">
                <StockClassificationSection
                  stocks={filteredStocks}
                  stockSummary={adjustedStockSummary}
                  movements={statusMovements}
                />
              </section>

              {/* ─── Work Center & Transaction Table ─── */}
              <section aria-label="Work Center & Analitik Transaksi">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <div className="lg:col-span-7 flex flex-col">
                    <WorkCenterBreakdown data={chartMovements} />
                  </div>
                  <div className="lg:col-span-5 flex flex-col">
                    <MovementTable data={statusMovements} />
                  </div>
                </div>
              </section>

              {/* ─── Neumorphic Footer ─── */}
              <footer className="neu-card-sm px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--neu-text-muted)] gap-3 mt-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" />
                  <span className="font-mono text-[11px]">Created By Ricky</span>
                </div>
                <div className="flex items-center">
                  <span>&copy; 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
                </div>
              </footer>
            </motion.div>
          )}
        </AnimatePresence>
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
                    className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                      modalCopied ? 'neu-inset-sm text-[var(--neu-green)]' : 'neu-btn-primary'
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

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between mb-3 px-0.5 gap-1">
      <div className="flex items-center gap-2.5">
        <div className="w-2.5 h-2.5 rounded-full neu-inset-sm flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)]" />
        </div>
        <h2 className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
          {children}
        </h2>
      </div>
      {subtitle && <p className="text-xs text-[var(--neu-text-muted)]">{subtitle}</p>}
    </div>
  );
}
