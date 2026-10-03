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
  const isAdmin = session?.user?.role === 'admin';
  const userPerms = session?.user?.permissions ?? [];
  const hasAccess = isAdmin || userPerms.includes('audit-sloc');
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<AuditSession | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [availableSlocs, setAvailableSlocs] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Dates with audit sessions
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach(s => {
      if (s.dateStr) set.add(s.dateStr);
    });
    return Array.from(set).sort().reverse();
  }, [sessions]);

  // Sessions for currently selected date
  const sessionsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return sessions.filter(s => s.dateStr === selectedDate);
  }, [sessions, selectedDate]);

  // Change date and auto-select matching session
  const handleDateChange = useCallback(
    (newDate: string) => {
      setSelectedDate(newDate);
      setPage(1);
      const matching = sessions.filter(s => s.dateStr === newDate);
      if (matching.length > 0) {
        setSelectedSessionId(matching[0].id);
      } else {
        setSelectedSessionId('');
        setCurrentSession(null);
        setItems([]);
        setTotalItems(0);
        setSlocStats([]);
        setOverallBreakdown(null);
      }
    },
    [sessions]
  );

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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadDate, setUploadDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize gudang from user session or search params
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated' && !hasAccess) {
      router.push('/');
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
  }, [status, hasAccess, session, router, searchParams]);

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

      if (list.length > 0) {
        setSelectedDate(prevDate => {
          const targetDate = prevDate && list.some(s => s.dateStr === prevDate)
            ? prevDate
            : list[0].dateStr;

          const matching = list.filter(s => s.dateStr === targetDate);
          if (matching.length > 0) {
            setSelectedSessionId(prevId => {
              const stillValid = matching.some(s => s.id === prevId);
              return stillValid ? prevId : matching[0].id;
            });
          } else {
            setSelectedSessionId('');
            setCurrentSession(null);
            setItems([]);
            setTotalItems(0);
            setSlocStats([]);
            setOverallBreakdown(null);
          }

          return targetDate;
        });
      } else {
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
  }, [selectedGudang]);

  useEffect(() => {
    if (status === 'authenticated' && hasAccess) {
      fetchSessions();
    }
  }, [status, hasAccess, fetchSessions]);

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

  // Submit file upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setIsSubmitting(true);

    try {
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

      const res = await fetch('/api/audit-sloc', {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Terjadi kesalahan saat menyimpan data audit');
      }

      setIsUploadOpen(false);
      setUploadFile(null);
      setUploadTitle('');
      if (result.session?.dateStr) {
        setSelectedDate(result.session.dateStr);
      }
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
    if (!isAdmin) {
      alert('Hanya admin yang memiliki izin untuk menghapus sesi audit.');
      return;
    }
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
    if (!isAdmin) {
      alert('Hanya admin yang memiliki izin untuk mengekspor data.');
      return;
    }
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
          ? 'Match'
          : item.status === 'DEFICIT'
            ? 'Mismatch (-)'
            : 'Mismatch (+)',
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

  if (status === 'authenticated' && !hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen dashboard-apple-bg selection:bg-apple-blue/20 selection:text-apple-blue font-sans pb-16">
      {/* ─── Top Bar & Page Header ─── */}
      <PageHeader
        icon={ClipboardCheck}
        iconBg="bg-blue-500/10 text-[#007AFF] border-blue-200/60 shadow-apple-xs"
        title="Audit SLoc"
      >
        {/* Warehouse switcher (admin) */}
        {session?.user?.role === 'admin' && (
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-apple-xs transition-apple">
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

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-apple-xs transition-apple">
          <Calendar size={13} className="text-[#007AFF] shrink-0" />
          <input
            type="date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
            title="Filter tanggal audit"
          />
        </div>

        {/* Multiple Sessions on Same Date Switcher */}
        {sessionsOnSelectedDate.length > 1 && (
          <div className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/80 hover:bg-white text-xs font-semibold text-slate-700 shadow-apple-xs transition-apple">
            <select
              value={selectedSessionId || ''}
              onChange={e => {
                setSelectedSessionId(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
            >
              {sessionsOnSelectedDate.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  Sesi {idx + 1}: {s.title} ({s.totalItems})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={() => setIsUploadOpen(true)}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] hover:scale-[1.02] active:scale-[0.98] transition-apple cursor-pointer"
        >
          <Upload size={13} strokeWidth={2.4} />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {isAdmin && (
          <>
            <button
              onClick={handleExportExcel}
              disabled={items.length === 0}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold bg-white/80 backdrop-blur-md hover:bg-white text-slate-700 border border-slate-200/80 shadow-apple-xs hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-apple cursor-pointer"
              title="Export Excel"
            >
              <Download size={13} strokeWidth={2.4} />
              <span className="hidden sm:inline">Export</span>
            </button>

            {currentSession && (
              <button
                onClick={handleDeleteSession}
                className="h-8 w-8 rounded-xl bg-white/80 backdrop-blur-md border border-slate-200/80 hover:bg-rose-50 hover:border-rose-200 text-rose-600 hover:text-rose-700 flex items-center justify-center shadow-apple-xs hover:scale-[1.02] active:scale-[0.98] transition-apple cursor-pointer"
                title="Hapus sesi audit"
              >
                <Trash2 size={13} strokeWidth={2.2} />
              </button>
            )}
          </>
        )}
      </PageHeader>

      {/* ─── Main Content Container ─── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* If no session exists or no session for selected date */}
        {!loading && !currentSession && (
          <div className="glass-card rounded-[32px] p-12 text-center border border-white/80 shadow-apple-card space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#0A84FF] text-white flex items-center justify-center mx-auto shadow-apple-glow-blue">
              <FileSpreadsheet size={30} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {selectedDate ? `Tidak Ada Data Audit pada ${selectedDate}` : 'Belum Ada Data Audit SLoc'}
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
                {sessions.length > 0
                  ? 'Belum ada data audit fisik SLoc untuk tanggal yang dipilih. Pilih tanggal yang memiliki data atau upload data audit baru.'
                  : 'Silakan upload file Excel laporan audit SAP atau tempelkan data dari tabel SAP untuk memulai analisis rekonsiliasi stok fisik.'}
              </p>
            </div>

            {availableDates.length > 0 && (
              <div className="flex items-center justify-center gap-2 flex-wrap text-xs pt-1">
                <span className="text-slate-400 font-medium">Tanggal tersedia:</span>
                {availableDates.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDateChange(d)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#007AFF] font-bold text-xs hover:bg-blue-100 transition-apple cursor-pointer"
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                if (selectedDate) setUploadDate(selectedDate);
                setIsUploadOpen(true);
              }}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl text-xs font-bold bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] hover:scale-[1.02] active:scale-[0.98] transition-apple cursor-pointer"
            >
              <Upload size={14} strokeWidth={2.5} />
              <span>{selectedDate ? `Upload Audit Tanggal ${selectedDate}` : 'Upload Data Sekarang'}</span>
            </button>
          </div>
        )}

        {/* ─── KPI Summary Cards (Apple iOS Style) ─── */}
        {currentSession && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Lines */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Item Baris
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50/80 text-[#007AFF] border border-blue-100/60 flex items-center justify-center shrink-0">
                  <Layers size={16} strokeWidth={2.4} />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {currentSession.totalItems.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-slate-400 font-medium mt-1">
                  Plant {currentSession.plant || '1105'} • {availableSlocs.length} SLoc terdata
                </div>
              </div>
            </div>

            {/* Card 2: Total Audit Physical */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Total Fisik Audit
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50/80 text-[#34C759] border border-emerald-100/60 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={16} strokeWidth={2.4} />
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                    {currentSession.totalQtyAudit.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">pcs</span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  {(currentSession.totalKgAudit / 1000).toLocaleString('id-ID', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ton ({currentSession.totalKgAudit.toLocaleString('id-ID')} kg)
                </div>
              </div>
            </div>

            {/* Card 3: Total Discrepancies */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Selisih Net (Audit - SAP)
                </span>
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                    currentSession.totalDiffQty === 0
                      ? 'bg-emerald-50/80 text-[#34C759] border-emerald-100/60'
                      : currentSession.totalDiffQty > 0
                        ? 'bg-amber-50/80 text-[#FF9500] border-amber-100/60'
                        : 'bg-rose-50/80 text-[#FF3B30] border-rose-100/60'
                  }`}
                >
                  {currentSession.totalDiffQty !== 0 ? (
                    <AlertTriangle size={16} strokeWidth={2.4} />
                  ) : (
                    <CheckCircle2 size={16} strokeWidth={2.4} />
                  )}
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-baseline gap-1">
                  <span
                    className={`text-3xl font-bold tracking-tight tabular-nums ${
                      currentSession.totalDiffQty < 0
                        ? 'text-[#FF3B30]'
                        : currentSession.totalDiffQty > 0
                          ? 'text-[#FF9500]'
                          : 'text-[#34C759]'
                    }`}
                  >
                    {currentSession.totalDiffQty > 0 ? '+' : ''}
                    {currentSession.totalDiffQty.toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">pcs</span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-1">
                  {currentSession.totalDiffKg === 0 ? (
                    <span className="text-emerald-700 font-medium">Sesuai SAP (0 kg)</span>
                  ) : (
                    <span>
                      Selisih berat:{' '}
                      <span
                        className={
                          currentSession.totalDiffKg < 0
                            ? 'text-rose-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {currentSession.totalDiffKg > 0 ? '+' : ''}
                        {(currentSession.totalDiffKg / 1000).toLocaleString('id-ID', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        ton
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Accuracy Rate */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 shadow-apple-card border border-white/80 flex flex-col justify-between hover:shadow-apple-hover transition-apple">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  Akurasi Kesesuaian
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50/80 text-[#AF52DE] border border-purple-100/60 flex items-center justify-center shrink-0">
                  <FileCheck size={16} strokeWidth={2.4} />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {accuracyPct.toFixed(1)}%
                </div>
                <div className="mt-2 space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="h-full bg-[#34C759] transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, accuracyPct))}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="text-emerald-700 font-medium">{currentSession.matchCount} match</span>
                    <span className={currentSession.diffCount > 0 ? 'text-rose-600 font-medium' : 'text-slate-400'}>
                      {currentSession.diffCount} mismatch
                    </span>
                  </div>
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
          <div className="glass-card rounded-2xl p-4 border border-white/80 shadow-apple-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-slate-600 font-medium">
              <div className="w-8 h-8 rounded-xl bg-blue-50/80 text-[#007AFF] border border-blue-200/60 flex items-center justify-center shrink-0 shadow-apple-xs">
                <Filter size={14} strokeWidth={2.4} />
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
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white/80 backdrop-blur-md hover:bg-white border border-slate-200/80 shadow-apple-xs hover:scale-[1.02] active:scale-[0.98] transition-apple shrink-0 cursor-pointer"
            >
              <FileText size={13} className="text-slate-500" strokeWidth={2.4} />
              <span>Buka Tabel Data Lengkap</span>
              <ChevronDown size={14} strokeWidth={2.4} />
            </button>
          </div>
        )}

        {currentSession && showTable && (
          <div ref={tableRef} className="space-y-4 pt-1 animate-in fade-in duration-200">
            {/* Active Drill-Down Banner */}
            <div className="glass-card rounded-2xl px-4 py-2.5 bg-blue-50/70 backdrop-blur-md border border-blue-200/70 shadow-apple-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-bold text-blue-900">Rincian Data Aktif:</span>
                {selectedSloc ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-white text-[#007AFF] border border-blue-200 font-mono shadow-2xs">
                    SLoc: {selectedSloc}
                  </span>
                ) : (
                  <span className="text-[#007AFF] font-semibold">Semua SLoc</span>
                )}
                {selectedStatus && selectedStatus !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs">
                    Status:{' '}
                    {selectedStatus === 'MATCH'
                      ? 'Match'
                      : selectedStatus === 'DEFICIT'
                        ? 'Mismatch (-)'
                        : selectedStatus === 'SURPLUS'
                          ? 'Mismatch (+)'
                          : 'Mismatch'}
                  </span>
                )}
                <span className="text-slate-500 text-[11px] font-medium">({totalItems} baris ditemukan)</span>
              </div>

              <button
                type="button"
                onClick={handleCloseTable}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent hover:border-slate-200 shadow-apple-xs transition-apple self-end sm:self-auto shrink-0 cursor-pointer"
                title="Sembunyikan tabel rincian"
              >
                <X size={14} strokeWidth={2.4} />
                <span>Sembunyikan Tabel</span>
              </button>
            </div>

            {/* ─── Filters & Search Toolbar ─── */}
            <div className="glass-card rounded-2xl p-4 border border-white/80 shadow-apple-card space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search size={15} strokeWidth={2.4} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Cari Material, Batch, SLoc..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/25 focus:border-[#007AFF] transition-apple"
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
                  className="px-3 py-2 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/25 cursor-pointer transition-apple"
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
                  className="px-3 py-2 rounded-xl bg-slate-100/70 border border-slate-200/80 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#007AFF]/25 cursor-pointer transition-apple"
                >
                  <option value={25}>25 baris</option>
                  <option value={50}>50 baris</option>
                  <option value={100}>100 baris</option>
                  <option value={250}>250 baris</option>
                </select>
              </div>
            </div>

            {/* Status Tabs (iOS Segmented Pill Row) */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-slate-200/50 backdrop-blur-md border border-slate-200/60 pt-1">
              <button
                onClick={() => {
                  setSelectedStatus('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs transition-apple cursor-pointer ${
                  selectedStatus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] font-bold rounded-[9px]'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                Semua Data
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('DIFF');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs transition-apple cursor-pointer flex items-center gap-1.5 ${
                  selectedStatus === 'DIFF'
                    ? 'bg-[#FF3B30] text-white shadow-[0_2px_8px_rgba(255,59,48,0.28)] font-bold rounded-[9px]'
                    : 'text-rose-700 hover:text-rose-900 font-semibold'
                }`}
              >
                <AlertTriangle size={13} strokeWidth={2.4} />
                <span>Mismatch ({currentSession.diffCount})</span>
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('DEFICIT');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs transition-apple cursor-pointer ${
                  selectedStatus === 'DEFICIT'
                    ? 'bg-[#FF3B30] text-white shadow-[0_2px_8px_rgba(255,59,48,0.28)] font-bold rounded-[9px]'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                Mismatch (-)
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('SURPLUS');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs transition-apple cursor-pointer ${
                  selectedStatus === 'SURPLUS'
                    ? 'bg-[#FF9500] text-white shadow-[0_2px_8px_rgba(255,149,0,0.28)] font-bold rounded-[9px]'
                    : 'text-slate-600 hover:text-slate-900 font-semibold'
                }`}
              >
                Mismatch (+)
              </button>

              <button
                onClick={() => {
                  setSelectedStatus('MATCH');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs transition-apple cursor-pointer flex items-center gap-1.5 ${
                  selectedStatus === 'MATCH'
                    ? 'bg-[#34C759] text-white shadow-[0_2px_8px_rgba(52,199,89,0.28)] font-bold rounded-[9px]'
                    : 'text-emerald-700 hover:text-emerald-900 font-semibold'
                }`}
              >
                <CheckCircle2 size={13} strokeWidth={2.4} />
                <span>Match ({currentSession.matchCount})</span>
              </button>
            </div>
          </div>

          {/* ─── Audit SLoc Data Table ─── */}
          <div className="glass-card rounded-[24px] border border-white/80 shadow-apple-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 backdrop-blur-md text-slate-600 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200/80">
                    <th className="py-3 px-3 w-16">Plant</th>
                    <th className="py-3 px-3 w-20">SLoc</th>
                    <th className="py-3 px-3 min-w-[170px]">Material</th>
                    <th className="py-3 px-3 min-w-[120px]">Batch</th>
                    <th className="py-3 px-3 text-right">SAP</th>
                    <th className="py-3 px-3 text-right">Eom (KG)</th>
                    <th className="py-3 px-3 text-right bg-blue-50/50 text-[#007AFF]">Qty Audit</th>
                    <th className="py-3 px-3 text-right bg-blue-50/50 text-[#007AFF]">KG Audit</th>
                    <th className="py-3 px-3 text-right bg-slate-200/40">Diff KG</th>
                    <th className="py-3 px-3 text-right bg-slate-200/40">Diff</th>
                    <th className="py-3 px-3 text-right text-slate-400">SAP</th>
                    <th className="py-3 px-3 text-right text-slate-400">Actual</th>
                    <th className="py-3 px-3 text-right text-slate-400">Diff Audit</th>
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

                      return (
                        <tr
                          key={item.id || idx}
                          className={`hover:bg-slate-100/50 transition-colors ${
                            !isMatch ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{item.plant}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-200/80">
                              {item.sloc}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                            {item.material}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
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
                                ? 'text-[#FF3B30]'
                                : item.diffKgAudit > 0.001
                                  ? 'text-[#FF9500]'
                                  : 'text-[#34C759]'
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
                                ? 'text-[#FF3B30]'
                                : item.diffQty > 0
                                  ? 'text-[#FF9500]'
                                  : 'text-[#34C759]'
                            }`}
                          >
                            {item.diffQty.toLocaleString('id-ID')}
                            {item.diffQty < 0 ? '-' : ''}
                          </td>

                          {/* Secondary SAP Ref */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                            {item.sapRef !== null && item.sapRef !== undefined
                              ? item.sapRef.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Actual */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                            {item.actual !== null && item.actual !== undefined
                              ? item.actual.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Diff Audit */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">
                            {item.diffAudit !== null && item.diffAudit !== undefined
                              ? item.diffAudit.toLocaleString('id-ID')
                              : '-'}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-3 text-center">
                            {isMatch ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70 shadow-2xs">
                                Match
                              </span>
                            ) : isDeficit ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/70 shadow-2xs"
                                title="Selisih kurang (-)"
                              >
                                Mismatch
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 shadow-2xs"
                                title="Selisih lebih (+)"
                              >
                                Mismatch
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
            <div className="px-4 py-3 bg-white/50 backdrop-blur-md border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 font-medium">
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
                  className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-apple-xs transition-apple cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  Halaman {page} dari {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 shadow-apple-xs transition-apple cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>

      {/* ─── Upload Audit Modal (Apple Sheet Style) ─── */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-3xl shadow-apple-card border border-white/80 overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200/50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Upload Data Audit SLoc</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Pilih file Excel (.xlsx, .xls) atau .csv hasil export SAP
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="w-7 h-7 rounded-xl bg-slate-100/70 hover:bg-slate-200/70 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-apple cursor-pointer"
                title="Tutup"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0 text-rose-600" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Title & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Judul Sesi
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="Contoh: Audit Fisik SLoc 5M"
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 transition-apple"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Tanggal Audit
                  </label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={e => setUploadDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/15 transition-apple cursor-pointer"
                  />
                </div>
              </div>

              {/* File Dropzone / Selected File Card */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  File Laporan SAP
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {uploadFile ? (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/60 shadow-apple-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white text-[#007AFF] border border-blue-100 flex items-center justify-center shrink-0 shadow-2xs">
                        <FileSpreadsheet size={18} strokeWidth={2.2} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {uploadFile.name}
                        </p>
                        <p className="text-[11px] text-blue-700/80 font-medium">
                          {(uploadFile.size / 1024).toFixed(1)} KB • Siap diproses
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setUploadFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="w-7 h-7 rounded-lg text-blue-600/70 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-apple shrink-0 cursor-pointer"
                      title="Ganti file"
                    >
                      <X size={14} strokeWidth={2.4} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="group border border-dashed border-slate-300 hover:border-[#007AFF] rounded-2xl p-6 text-center cursor-pointer transition-apple bg-slate-50/50 hover:bg-blue-50/30"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white text-slate-500 group-hover:text-[#007AFF] border border-slate-200/80 group-hover:border-blue-200/60 flex items-center justify-center mx-auto mb-2.5 transition-apple shadow-apple-xs">
                      <Upload size={18} strokeWidth={2.2} />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 group-hover:text-[#007AFF] transition-colors">
                      Pilih file Excel / CSV dari komputer
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Mendukung format .xlsx, .xls, .csv hasil export SAP
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-apple cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !uploadFile}
                  className="h-9 px-4 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0071E3] text-white shadow-apple-xs hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-apple flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} strokeWidth={2.4} />
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
