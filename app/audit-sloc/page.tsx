'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Building2,
  Calendar,
  X,
  FileCheck,
  ClipboardCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { GUDANG_LIST } from '@/lib/gudang';
import { parseAuditSlocText, parseAuditSlocExcel } from '@/lib/audit-sloc-parser';
import { PageHeader } from '@/components/PageHeader';
import {
  AuditSlocChart,
  SlocStatItem,
  OverallBreakdownData,
} from '@/components/AuditSlocChart';

interface AuditItem {
  id: string;
  plant: string;
  sloc: string;
  material: string;
  batch: string | null;
  sapQty: number;
  eomKg: number;
  qtyAudit: number;
  kgAudit: number;
  diffKgAudit: number;
  diffQty: number;
  sapRef: number | null;
  actual: number | null;
  diffAudit: number | null;
  status: 'MATCH' | 'DEFICIT' | 'SURPLUS';
}

interface AuditSession {
  id: string;
  title: string;
  dateStr: string;
  plant: string | null;
  gudangId: number | null;
  fileName: string | null;
  totalItems: number;
  totalQtySap: number;
  totalKgSap: number;
  totalQtyAudit: number;
  totalKgAudit: number;
  totalDiffQty: number;
  totalDiffKg: number;
  matchCount: number;
  diffCount: number;
  createdAt: string;
}

function AuditSlocContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<AuditSession | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [availableSlocs, setAvailableSlocs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedSloc, setSelectedSloc] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedGudang, setSelectedGudang] = useState<number | null>(null);
  const [slocStats, setSlocStats] = useState<SlocStatItem[]>([]);
  const [overallBreakdown, setOverallBreakdown] = useState<OverallBreakdownData | null>(null);
  const [showTable, setShowTable] = useState<boolean>(false);

  const tableRef = useRef<HTMLDivElement>(null);

  const handleCloseTable = useCallback(() => {
    setShowTable(false);
    setSelectedSloc('');
    setSelectedStatus('ALL');
    setSearch('');
    setPage(1);
  }, []);

  const handleOpenTableWithSloc = useCallback((sloc: string) => {
    setSelectedSloc(sloc);
    setPage(1);
    if (sloc) {
      setShowTable(true);
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, []);

  const handleOpenTableWithStatus = useCallback((st: string) => {
    setSelectedStatus(st);
    setPage(1);
    if (st && st !== 'ALL') {
      setShowTable(true);
      setTimeout(() => {
        tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  }, []);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState<string>('');
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [parsedPreviewCount, setParsedPreviewCount] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize gudang from user session or search params
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated' && session?.user) {
      if (session.user.role !== 'admin' && session.user.gudangId) {
        setSelectedGudang(session.user.gudangId);
      } else {
        const paramGudang = searchParams.get('gudangId');
        if (paramGudang) setSelectedGudang(parseInt(paramGudang, 10));
      }
    }
  }, [status, session, router, searchParams]);

  // Load audit sessions list
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedGudang) params.set('gudangId', String(selectedGudang));

      const res = await fetch(`/api/audit-sloc?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil daftar sesi audit');
      const data = await res.json();
      const list: AuditSession[] = data.sessions || [];
      setSessions(list);

      if (list.length > 0 && !selectedSessionId) {
        setSelectedSessionId(list[0].id);
      } else if (list.length === 0) {
        setSelectedSessionId('');
        setCurrentSession(null);
        setItems([]);
        setTotalItems(0);
        setSlocStats([]);
        setOverallBreakdown(null);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGudang, selectedSessionId]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSessions();
    }
  }, [status, fetchSessions]);

  // Load items for the selected session
  const fetchSessionItems = useCallback(async () => {
    if (!selectedSessionId) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('sessionId', selectedSessionId);
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (selectedSloc) params.set('sloc', selectedSloc);
      if (selectedStatus && selectedStatus !== 'ALL') params.set('status', selectedStatus);

      const res = await fetch(`/api/audit-sloc?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengambil data item audit');
      const data = await res.json();

      setCurrentSession(data.session);
      setItems(data.items || []);
      setTotalItems(data.total || 0);
      setAvailableSlocs(data.availableSlocs || []);
      if (data.slocStats) setSlocStats(data.slocStats);
      if (data.overallBreakdown) setOverallBreakdown(data.overallBreakdown);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, page, limit, search, selectedSloc, selectedStatus]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchSessionItems();
    }
  }, [selectedSessionId, fetchSessionItems]);

  // Handle live preview count when pasting text
  useEffect(() => {
    if (uploadTab === 'paste' && pasteText.trim()) {
      try {
        const preview = parseAuditSlocText(pasteText);
        setParsedPreviewCount(preview.rows.length);
      } catch {
        setParsedPreviewCount(null);
      }
    } else {
      setParsedPreviewCount(null);
    }
  }, [uploadTab, pasteText]);

  // Handle file drop / select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(`Audit SLoc - ${nameWithoutExt}`);
      }
    }
  };

  // Submit upload or paste
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsSubmitting(true);

    try {
      let res;
      if (uploadTab === 'file') {
        if (!uploadFile) {
          throw new Error('Pilih file Excel atau CSV terlebih dahulu');
        }
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('title', uploadTitle || `Audit SLoc - ${uploadDate}`);
        formData.append('dateStr', uploadDate);
        if (selectedGudang) {
          formData.append('gudangId', String(selectedGudang));
        }

        res = await fetch('/api/audit-sloc', {
          method: 'POST',
          body: formData,
        });
      } else {
        if (!pasteText.trim()) {
          throw new Error('Tempelkan teks data tabel dari SAP terlebih dahulu');
        }
        res = await fetch('/api/audit-sloc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rawText: pasteText,
            title: uploadTitle || `Audit SLoc (Paste) - ${uploadDate}`,
            dateStr: uploadDate,
            gudangId: selectedGudang,
          }),
        });
      }

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Terjadi kesalahan saat menyimpan data audit');
      }

      setIsUploadOpen(false);
      setUploadFile(null);
      setPasteText('');
      setUploadTitle('');
      setSelectedSessionId(result.session.id);
      await fetchSessions();
    } catch (err: any) {
      setUploadError(err.message || 'Gagal memproses file audit');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete current session
  const handleDeleteSession = async () => {
    if (!selectedSessionId || !currentSession) return;
    const confirmDelete = window.confirm(
      `Hapus sesi audit "${currentSession.title}" beserta seluruh baris datanya? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/audit-sloc?sessionId=${selectedSessionId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus sesi');
      setSelectedSessionId('');
      await fetchSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('Gagal menghapus sesi audit.');
    } finally {
      setLoading(false);
    }
  };

  // Export current table to Excel
  const handleExportExcel = () => {
    if (items.length === 0) {
      alert('Tidak ada data yang dapat diekspor');
      return;
    }

    const exportRows = items.map(item => ({
      Plant: item.plant,
      SLoc: item.sloc,
      Material: item.material,
      Batch: item.batch || '',
      SAP: item.sapQty,
      Eom: item.eomKg,
      'Qty Audit': item.qtyAudit,
      'KG Audit': item.kgAudit,
      'Diff KG Audit': item.diffKgAudit,
      Diff: item.diffQty,
      'SAP Ref': item.sapRef ?? '',
      Actual: item.actual ?? '',
      'Diff Audit': item.diffAudit ?? '',
      Status:
        item.status === 'MATCH'
          ? 'Cocok'
          : item.status === 'DEFICIT'
            ? 'Selisih Kurang'
            : 'Selisih Lebih',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit SLoc');

    const fileName = `Audit_SLoc_${currentSession?.dateStr || 'export'}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Metrics
  const accuracyPct = useMemo(() => {
    if (!currentSession || currentSession.totalItems === 0) return 0;
    return (currentSession.matchCount / currentSession.totalItems) * 100;
  }, [currentSession]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16">
      {/* ─── Top Bar & Page Header ─── */}
      <PageHeader
        icon={ClipboardCheck}
        iconBg="bg-blue-50 text-blue-600 border-blue-200/60"
        title="Audit SLoc"
        subtitle={
          currentSession
            ? `Plant ${currentSession.plant || '1105'} • ${currentSession.title}`
            : 'Rekonsiliasi Fisik vs SAP'
        }
      >
        {/* Warehouse switcher (admin) */}
        {session?.user?.role === 'admin' && (
          <div className="flex items-center gap-1.5 bg-slate-100/90 px-2 py-1.5 rounded-lg border border-slate-200">
            <Building2 size={13} className="text-slate-500 shrink-0" />
            <select
              value={selectedGudang ?? ''}
              onChange={e => {
                const val = e.target.value ? parseInt(e.target.value, 10) : null;
                setSelectedGudang(val);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer max-w-[130px] truncate"
            >
              <option value="">Semua Gudang</option>
              {GUDANG_LIST.map(g => (
                <option key={g.gudangId} value={g.gudangId}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Session selector */}
        {sessions.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-100/90 px-2 py-1.5 rounded-lg border border-slate-200">
            <Calendar size={13} className="text-slate-500 shrink-0" />
            <select
              value={selectedSessionId || ''}
              onChange={e => {
                setSelectedSessionId(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer max-w-[170px] truncate"
            >
              {sessions.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.totalItems})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
        >
          <Upload size={13} />
          <span className="hidden sm:inline">Upload</span>
        </button>

        <button
          onClick={handleExportExcel}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 disabled:opacity-50 transition-all"
          title="Export Excel"
        >
          <Download size={13} />
          <span className="hidden sm:inline">Export</span>
        </button>

        {currentSession && (
          <button
            onClick={handleDeleteSession}
            className="p-1.5 rounded-lg bg-white text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all"
            title="Hapus sesi audit"
          >
            <Trash2 size={13} />
          </button>
        )}
      </PageHeader>

      {/* ─── Main Content Container ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* If no session exists */}
        {!loading && sessions.length === 0 && (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet size={32} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Belum Ada Data Audit SLoc</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Silakan upload file Excel laporan audit SAP atau tempelkan data dari tabel SAP untuk memulai analisis rekonsiliasi stok fisik.
              </p>
            </div>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
            >
              <Upload size={16} />
              <span>Upload Data Sekarang</span>
            </button>
          </div>
        )}

        {/* ─── KPI Summary Cards ─── */}
        {currentSession && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Lines */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Total Item Baris</span>
                <Layers size={16} className="text-blue-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {currentSession.totalItems.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  Plant {currentSession.plant || '1105'} • {availableSlocs.length} SLoc Terdata
                </div>
              </div>
            </div>

            {/* Total Audit Physical */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Total Fisik Audit</span>
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {currentSession.totalQtyAudit.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-semibold text-slate-500">PCS</span>
                </div>
                <div className="text-xs text-slate-600 font-bold mt-1">
                  {(currentSession.totalKgAudit / 1000).toLocaleString('id-ID', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  <span className="text-[10px] text-slate-500">TON</span> (
                  {currentSession.totalKgAudit.toLocaleString('id-ID')} KG)
                </div>
              </div>
            </div>

            {/* Total Discrepancies */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Selisih Net (Audit - SAP)</span>
                {currentSession.totalDiffQty !== 0 ? (
                  <AlertTriangle size={16} className="text-rose-600" />
                ) : (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                )}
              </div>
              <div className="mt-3">
                <div
                  className={`text-2xl font-black tabular-nums ${
                    currentSession.totalDiffQty < 0
                      ? 'text-rose-600'
                      : currentSession.totalDiffQty > 0
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}
                >
                  {currentSession.totalDiffQty > 0 ? '+' : ''}
                  {currentSession.totalDiffQty.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-semibold text-slate-500">PCS</span>
                </div>
                <div className="text-xs font-bold text-slate-700 mt-1">
                  Selisih KG:{' '}
                  <span
                    className={
                      currentSession.totalDiffKg < 0
                        ? 'text-rose-600'
                        : currentSession.totalDiffKg > 0
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    }
                  >
                    {currentSession.totalDiffKg > 0 ? '+' : ''}
                    {currentSession.totalDiffKg.toLocaleString('id-ID', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    KG
                  </span>
                </div>
              </div>
            </div>

            {/* Accuracy Rate */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
                <span>Akurasi Kesesuaian</span>
                <FileCheck size={16} className="text-blue-600" />
              </div>
              <div className="mt-3">
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {accuracyPct.toFixed(1)}%
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium mt-1">
                  <span className="text-emerald-700 font-bold">
                    {currentSession.matchCount} Cocok
                  </span>
                  <span className="text-rose-600 font-bold">
                    {currentSession.diffCount} Ada Selisih
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── STO Analytics Charts (HASIL STO PER SLOC & HASIL STO ALL) ─── */}
        {currentSession && slocStats.length > 0 && (
          <AuditSlocChart
            slocStats={slocStats}
            overall={
              overallBreakdown || {
                totalItems: currentSession.totalItems,
                matchCount: currentSession.matchCount,
                deficitCount: 0,
                surplusCount: 0,
                accuracyPct: accuracyPct,
              }
            }
            gudangId={selectedGudang ?? currentSession.gudangId}
            onSelectGudang={gId => {
              setSelectedGudang(gId);
              setPage(1);
            }}
            selectedSloc={selectedSloc}
            onSelectSloc={sloc => {
              if (sloc) {
                handleOpenTableWithSloc(sloc);
              } else {
                setSelectedSloc('');
                setPage(1);
              }
            }}
            selectedStatus={selectedStatus}
            onSelectStatus={st => {
              if (st && st !== 'ALL') {
                handleOpenTableWithStatus(st);
              } else {
                setSelectedStatus('ALL');
                setPage(1);
              }
            }}
            gudangNameDisplay={
              currentSession.gudangId
                ? `Gd.${currentSession.gudangId}`
                : undefined
            }
          />
        )}

        {/* ─── Table Section (Hidden by default, muncul saat klik diagram atau tombol buka) ─── */}
        {currentSession && !showTable && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Filter size={14} />
              </div>
              <span>
                Klik bar SLoc atau status pada grafik diagram di atas untuk memunculkan tabel rincian data.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTable(true);
                setTimeout(() => {
                  tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 80);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 transition-all shrink-0 cursor-pointer"
            >
              <FileText size={13} className="text-slate-500" />
              <span>Buka Tabel Data Lengkap</span>
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {currentSession && showTable && (
          <div ref={tableRef} className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Active Drill-Down Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-2.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-blue-900">Rincian Data Aktif:</span>
                {selectedSloc ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-white text-blue-700 border border-blue-200 font-mono shadow-2xs">
                    SLoc: {selectedSloc}
                  </span>
                ) : (
                  <span className="text-blue-700 font-medium">Semua SLoc</span>
                )}
                {selectedStatus && selectedStatus !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs">
                    Status:{' '}
                    {selectedStatus === 'MATCH'
                      ? 'Cocok'
                      : selectedStatus === 'DEFICIT'
                        ? 'Selisih Kurang (-)'
                        : selectedStatus === 'SURPLUS'
                          ? 'Selisih Lebih (+)'
                          : 'Selisih Saja'}
                  </span>
                )}
                <span className="text-slate-500 text-[11px]">({totalItems} baris ditemukan)</span>
              </div>

              <button
                type="button"
                onClick={handleCloseTable}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200 transition-all self-end sm:self-auto shrink-0 cursor-pointer"
                title="Sembunyikan tabel rincian"
              >
                <X size={14} />
                <span>Sembunyikan Tabel</span>
              </button>
            </div>

            {/* ─── Filters & Search Toolbar ─── */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari Material, Batch, SLoc..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* SLoc filter dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">SLoc:</span>
                <select
                  value={selectedSloc}
                  onChange={e => {
                    setSelectedSloc(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="">Semua SLoc ({availableSlocs.length})</option>
                  {availableSlocs.map(sloc => (
                    <option key={sloc} value={sloc}>
                      {sloc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Page size */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 shrink-0">Tampilkan:</span>
                <select
                  value={limit}
                  onChange={e => {
                    setLimit(parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value={25}>25 baris</option>
                  <option value={50}>50 baris</option>
                  <option value={100}>100 baris</option>
                  <option value={250}>250 baris</option>
                </select>
              </div>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setSelectedStatus('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatus === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Data
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('DIFF');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedStatus === 'DIFF'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle size={13} />
                <span>Selisih Saja ({currentSession.diffCount})</span>
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('DEFICIT');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatus === 'DEFICIT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Selisih Kurang (-)
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('SURPLUS');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedStatus === 'SURPLUS'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Selisih Lebih (+)
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('MATCH');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedStatus === 'MATCH'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Cocok ({currentSession.matchCount})</span>
              </button>
            </div>
          </div>

          {/* ─── Audit SLoc Data Table ─── */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-extrabold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-3 w-16">Plant</th>
                    <th className="py-3 px-3 w-20">SLoc</th>
                    <th className="py-3 px-3 min-w-[170px]">Material</th>
                    <th className="py-3 px-3 min-w-[120px]">Batch</th>
                    <th className="py-3 px-3 text-right">SAP</th>
                    <th className="py-3 px-3 text-right">Eom (KG)</th>
                    <th className="py-3 px-3 text-right bg-blue-50/50">Qty Audit</th>
                    <th className="py-3 px-3 text-right bg-blue-50/50">KG Audit</th>
                    <th className="py-3 px-3 text-right bg-slate-200/50">Diff KG</th>
                    <th className="py-3 px-3 text-right bg-slate-200/50">Diff</th>
                    <th className="py-3 px-3 text-right text-slate-500">SAP</th>
                    <th className="py-3 px-3 text-right text-slate-500">Actual</th>
                    <th className="py-3 px-3 text-right text-slate-500">Diff Audit</th>
                    <th className="py-3 px-3 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 text-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-500 font-medium">
                        Tidak ada baris data yang cocok dengan kriteria filter saat ini.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, idx) => {
                      const isMatch = item.status === 'MATCH';
                      const isDeficit = item.status === 'DEFICIT';
                      const isSurplus = item.status === 'SURPLUS';

                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            !isMatch ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{item.plant}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200">
                              {item.sloc}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {item.material}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {item.batch || '-'}
                          </td>

                          {/* SAP Qty */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {item.sapQty.toLocaleString('id-ID')}
                          </td>

                          {/* Eom KG */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                            {item.eomKg.toLocaleString('id-ID', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 3,
                            })}
                          </td>

                          {/* Qty Audit */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-blue-950 bg-blue-50/40">
                            {item.qtyAudit.toLocaleString('id-ID')}
                          </td>

                          {/* KG Audit */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-blue-950 bg-blue-50/40">
                            {item.kgAudit.toLocaleString('id-ID', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 3,
                            })}
                          </td>

                          {/* Diff KG Audit */}
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-slate-100/30 ${
                              item.diffKgAudit < -0.001
                                ? 'text-rose-600'
                                : item.diffKgAudit > 0.001
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {item.diffKgAudit.toLocaleString('id-ID', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 3,
                            })}
                            {item.diffKgAudit < -0.001 ? '-' : ''}
                          </td>

                          {/* Diff Qty */}
                          <td
                            className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums bg-slate-100/30 ${
                              item.diffQty < 0
                                ? 'text-rose-600'
                                : item.diffQty > 0
                                  ? 'text-amber-600'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {item.diffQty.toLocaleString('id-ID')}
                            {item.diffQty < 0 ? '-' : ''}
                          </td>

                          {/* Secondary SAP Ref */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                            {item.sapRef !== null && item.sapRef !== undefined
                              ? item.sapRef.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Actual */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                            {item.actual !== null && item.actual !== undefined
                              ? item.actual.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Diff Audit */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                            {item.diffAudit !== null && item.diffAudit !== undefined
                              ? item.diffAudit.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {isMatch ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Cocok
                              </span>
                            ) : isDeficit ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                Kurang
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                Lebih
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-medium">
              <div>
                Menampilkan{' '}
                <strong className="text-slate-900 font-bold">
                  {items.length === 0 ? 0 : (page - 1) * limit + 1}
                </strong>{' '}
                sampai{' '}
                <strong className="text-slate-900 font-bold">
                  {Math.min(page * limit, totalItems)}
                </strong>{' '}
                dari <strong className="text-slate-900 font-bold">{totalItems}</strong> baris data
              </div>

              <div className="flex items-center gap-1.5 self-center">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold hover:bg-slate-100 disabled:opacity-40 transition-all"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-bold hover:bg-slate-100 disabled:opacity-40 transition-all"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>

      {/* ─── Upload & Update Audit Modal ─── */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Update Data Audit SLoc</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Upload file Excel (.xlsx) SAP atau tempelkan data tabel hasil copy langsung dari SAP
                </p>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Judul Sesi Audit
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="Contoh: Audit Fisik SLoc 5M Akhir Bulan"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Audit
                  </label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={e => setUploadDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Mode Tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setUploadTab('file')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    uploadTab === 'file'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Upload File Excel / CSV
                </button>
                <button
                  type="button"
                  onClick={() => setUploadTab('paste')}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    uploadTab === 'paste'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Paste Data dari SAP
                </button>
              </div>

              {uploadTab === 'file' ? (
                /* Dropzone */
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-blue-50/20"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                    <FileSpreadsheet size={24} />
                  </div>
                  {uploadFile ? (
                    <div>
                      <div className="text-sm font-bold text-slate-900">{uploadFile.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {(uploadFile.size / 1024).toFixed(1)} KB • Klik untuk mengganti file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-bold text-slate-700">
                        Klik untuk memilih file Excel / CSV dari komputer Anda
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Mendukung format .xlsx, .xls, .csv hasil export ALV SAP
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Textarea Paste */
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Salin baris dari SAP lalu tempel (Ctrl+V) di sini:</span>
                    {parsedPreviewCount !== null && (
                      <span className="font-bold text-emerald-700">
                        {parsedPreviewCount} baris terdeteksi
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={8}
                    value={pasteText}
                    onChange={e => setPasteText(e.target.value)}
                    placeholder={`Plant\tSLoc\tMaterial\tBatch\tSAP\tEom\tQty Audit\tKG Audit\tDiff KG Audit\tDiff\n1105\t5M02\tZCB12CGC0220+08800\t5261841HFA\t0\t\t62\t172,546\t172,546-\t62-`}
                    className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || (uploadTab === 'file' ? !uploadFile : !pasteText.trim())}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Simpan Data Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditSlocPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-semibold text-slate-400">
          Memuat Audit SLoc...
        </div>
      }
    >
      <AuditSlocContent />
    </Suspense>
  );
}
