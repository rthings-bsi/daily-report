'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Package,
  ClipboardList,
  RefreshCw,
  Search,
  X,
  TrendingUp,
  Box,
  Layers,
  Download,
  FileSearch,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { SectionTitle } from '@/components/SectionTitle';
import { cn } from '@/lib/utils';
import type { StockCardItem } from '@/lib/excel-parser';

export const dynamic = 'force-dynamic';

const easeOut: [number, number, number, number] = [0.23, 1, 0.32, 1];

// ─── Filter: batch ending with C or E ───
function isPipaNC(batch: string): boolean {
  const trimmed = batch.trim().toUpperCase();
  return trimmed.endsWith('C') || trimmed.endsWith('E');
}

// ─── Split No NC -> No NC (angka/kode/romawi/tahun) + Keterangan NC (sisanya) ───
function splitNoNC(custRemark: string): { noNC: string; keterangan: string } {
  const trimmed = (custRemark || '').trim();
  const match =
    trimmed.match(/^(\d+\s*\/\s*[A-Za-z0-9\-\s.]+\s*\/\s*[IVXLCDM\d]+\s*(?:[\/-]\s*\d{4}|$))\s*(.*)$/i) ||
    trimmed.match(/^(\d+\s*\/\s*[IVXLCDM\d]+\s*(?:[\/-]\s*\d{4}|$))\s*(.*)$/i);
  if (match) {
    let noNC = match[1].replace(/\s*\/\s*/g, '/').replace(/\./g, '-');
    if (/^\d+\/(?:[IVXLCDM\d]+)/.test(noNC)) {
      noNC = noNC.replace(/^(\d+)\//, '$1/NCR-SKF/');
    }
    return { noNC, keterangan: (match[2] || '').trim().replace(/^[\/\-_]\s*/, '') };
  }
  return { noNC: '', keterangan: trimmed };
}

function PipaNCContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialGudang = searchParams.get('gudangId') || searchParams.get('gudang');

  const [stockCards, setStockCards] = useState<StockCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGudang, setSelectedGudang] = useState<number | null>(
    initialGudang ? Number(initialGudang) : null
  );
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'C' | 'E'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = session?.user?.role === 'admin';
  const isMerger = (session?.user as any)?.roleScope === 'merger';
  const mergerGudangIds: number[] = ((session?.user as any)?.mergerGudangIds as number[] | undefined) || [];
  const canFilterGudang = isAdmin || (session?.user as any)?.roleScope === 'global' || isMerger;
  const userPerms = session?.user?.permissions ?? [];
  const hasAccess = isAdmin || userPerms.includes('pipa-nc');

  const sessionGudang = useMemo(() => {
    if (session?.user?.gudangId) return session.user.gudangId;
    if (!session?.user?.name) return null;
    const g = session.user.name.match(/GUDANG\s*(\d+)/i);
    return g ? parseInt(g[1], 10) : null;
  }, [session]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (!canFilterGudang && session.user.gudangId && selectedGudang === null) {
        setSelectedGudang(session.user.gudangId);
      }
    }
  }, [status, session, canFilterGudang, selectedGudang]);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    else if (status === 'authenticated' && !hasAccess) router.push('/');
  }, [status, hasAccess, router]);

  const fetchPipaNC = useCallback(async () => {
    if (status !== 'authenticated' || !hasAccess) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedGudang) params.set('gudangId', String(selectedGudang));
      const res = await fetch(`/api/reports/aggregate?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const text = await res.text();
      const data = JSON.parse(text);
      setStockCards(data.stockCards || []);
    } catch (err) {
      console.error('Fetch Pipa NC error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGudang, status, hasAccess]);

  useEffect(() => {
    if (status === 'authenticated' && hasAccess) {
      fetchPipaNC();
    }
  }, [status, hasAccess, fetchPipaNC]);

  // ─── All Pipa NC (batch ending with C or E, BOM > 0) ───
  const pipaNCData = useMemo(() => {
    return stockCards
      .filter((sc) => isPipaNC(sc.batch || '') && (sc.ttlStokBom || 0) > 0)
      .sort((a, b) => {
        if (a.sloc !== b.sloc) return a.sloc.localeCompare(b.sloc);
        return a.batch.localeCompare(b.batch);
      });
  }, [stockCards]);

  // ─── Filtered by Grade & Search ───
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pipaNCData.filter((item) => {
      const upperBatch = (item.batch || '').trim().toUpperCase();
      if (gradeFilter === 'C' && !upperBatch.endsWith('C')) return false;
      if (gradeFilter === 'E' && !upperBatch.endsWith('E')) return false;
      if (q) {
        const { noNC, keterangan } = splitNoNC(item.custRemark);
        const hay = [
          item.materialNumber,
          item.batch,
          item.sloc,
          item.description,
          noNC,
          keterangan,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [pipaNCData, gradeFilter, searchQuery]);

  // ─── KPI Metrics (overall for active gudang) ───
  const totalItems = pipaNCData.length;
  const gradeCCount = useMemo(
    () => pipaNCData.filter((d) => d.batch.trim().toUpperCase().endsWith('C')).length,
    [pipaNCData]
  );
  const gradeECount = useMemo(
    () => pipaNCData.filter((d) => d.batch.trim().toUpperCase().endsWith('E')).length,
    [pipaNCData]
  );
  const totalQty = useMemo(
    () => pipaNCData.reduce((sum, d) => sum + (d.ttlStokBom || 0), 0),
    [pipaNCData]
  );
  const totalTonase = useMemo(
    () => pipaNCData.reduce((sum, d) => sum + (d.ttlStokEom || 0), 0) / 1000,
    [pipaNCData]
  );

  // ─── Group filtered items by SLOC ───
  const groups = useMemo(() => {
    const map = new Map<string, StockCardItem[]>();
    for (const item of filteredData) {
      const key = item.sloc || 'Unknown SLOC';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData]);

  const gudangLabel = selectedGudang
    ? `Gudang ${selectedGudang}`
    : isMerger
    ? `Merger (${mergerGudangIds.join(', ')})`
    : sessionGudang
    ? `Gudang ${sessionGudang}`
    : 'Semua Gudang';

  const gudangBadgeCode = selectedGudang
    ? `G${selectedGudang}`
    : isMerger
    ? 'MG'
    : sessionGudang
    ? `G${sessionGudang}`
    : 'NC';

  const goBack = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleExportCsv = useCallback(() => {
    if (filteredData.length === 0) return;
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['SLOC', 'Material', 'Batch', 'Grade', 'No NC', 'Ket. NC', 'Deskripsi', 'Stok BOM (PC)', 'Stok EOM (KG)'];
    const rows = filteredData.map((item) => {
      const { noNC, keterangan } = splitNoNC(item.custRemark);
      const grade = item.batch.trim().toUpperCase().endsWith('C') ? 'C' : 'E';
      return [
        item.sloc,
        item.materialNumber || '',
        item.batch,
        grade,
        noNC,
        keterangan,
        item.description || '',
        item.ttlStokBom,
        item.ttlStokEom,
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-pipa-nc-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredData]);

  if (status === 'unauthenticated' || (status === 'authenticated' && !hasAccess)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--neu-bg)] text-[var(--neu-text)] font-sans transition-colors duration-200">
      <PageHeader
        icon={ClipboardList}
        title="Data Pipa NC"
        subtitle="Stok pipa non-conforming (Batch C & E)"
        className="print:hidden"
      >
        {/* ─── Gudang Selector (Admin / Global / Merger) ─── */}
        {canFilterGudang && (
          <select
            value={selectedGudang ?? ''}
            onChange={(e) => setSelectedGudang(e.target.value ? Number(e.target.value) : null)}
            aria-label="Filter gudang"
            className="neu-input h-9 text-[12px] font-bold rounded-xl px-3 cursor-pointer"
          >
            <option value="">{isMerger ? 'Semua Gudang Terhubung' : 'Semua Gudang'}</option>
            {(isMerger ? mergerGudangIds : Array.from({ length: 14 }, (_, i) => i + 1)).map((n) => (
              <option key={n} value={n}>
                Gudang {n}
              </option>
            ))}
          </select>
        )}

        {/* ─── Header Action Buttons ─── */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredData.length === 0}
            className="h-9 px-3.5 rounded-xl text-[12px] font-bold transition-neu flex items-center gap-1.5 neu-btn text-[var(--neu-green)] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            title="Unduh CSV Data Pipa NC"
          >
            <Download size={13} strokeWidth={2.2} />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={fetchPipaNC}
            disabled={loading}
            className="h-9 w-9 rounded-xl text-[12px] font-bold transition-neu flex items-center justify-center neu-btn text-[var(--neu-text-secondary)] disabled:opacity-50 cursor-pointer"
            title="Muat ulang data"
            aria-label="Muat ulang data"
          >
            <RefreshCw size={13} strokeWidth={2.2} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={goBack}
            className="h-9 px-3.5 rounded-xl text-[12px] font-bold transition-neu flex items-center gap-1.5 neu-btn text-[var(--neu-text-secondary)] cursor-pointer"
            title="Kembali ke Dashboard"
          >
            <ArrowLeft size={13} strokeWidth={2.3} />
            <span className="hidden md:inline">Dashboard</span>
          </button>
        </div>
      </PageHeader>

      {/* ─── Page Content ─── */}
      <div className="max-w-[1700px] mx-auto px-3 sm:px-5 lg:px-6 py-5 sm:py-7">
        {status === 'loading' || loading ? (
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-14 h-14 rounded-2xl neu-card-sm flex items-center justify-center">
                <div className="w-7 h-7 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
              </div>
              <p className="font-mono text-xs font-medium text-[var(--neu-text-muted)]">
                Memuat data Pipa NC...
              </p>
            </div>
          </div>
        ) : pipaNCData.length === 0 ? (
          <div className="min-h-[60vh] flex items-center justify-center p-4">
            <div className="neu-card p-8 max-w-md w-full text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-2xl neu-icon-inset flex items-center justify-center text-[var(--neu-accent)]">
                <Package size={28} strokeWidth={1.9} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[var(--neu-text)]">
                  Tidak Ada Data Pipa NC
                </h2>
                <p className="text-[13px] text-[var(--neu-text-muted)] mt-1.5 leading-relaxed flex items-center justify-center gap-1.5">
                  <FileSearch size={14} className="shrink-0 text-[var(--neu-accent)]" />
                  Belum ada stok aktif dengan batch berakhiran C atau E pada {gudangLabel}.
                </p>
              </div>
              <div className="flex items-center gap-2.5 mt-1">
                {selectedGudang && canFilterGudang && (
                  <button
                    type="button"
                    onClick={() => setSelectedGudang(null)}
                    className="h-9.5 px-4 rounded-xl text-[12.5px] font-bold neu-btn text-[var(--neu-text-secondary)] cursor-pointer"
                  >
                    Lihat Semua Gudang
                  </button>
                )}
                <button
                  type="button"
                  onClick={goBack}
                  className="h-9.5 px-5 rounded-xl text-[12.5px] font-bold neu-btn-primary inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={14} strokeWidth={2.4} />
                  Kembali ke Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-6 pb-12"
          >
            {/* ─── Tactile Banner Header ─── */}
            <header
              className="neu-card px-5 py-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              data-purpose="dashboard-hero-header"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl neu-icon-inset text-[var(--neu-accent)] flex items-center justify-center font-mono font-extrabold text-sm shrink-0">
                  {gudangBadgeCode}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight text-[var(--neu-text)] leading-tight">
                      Data Pipa NC
                    </h1>
                    <span className="neu-chip">{gudangLabel.toUpperCase()}</span>
                    <span className="neu-chip">BATCH C / E</span>
                  </div>
                  <p className="text-[12.5px] text-[var(--neu-text-muted)] mt-1">
                    Monitoring stok pipa non-conforming berdasarkan customer remark &amp; No NC SAP
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

            {/* ─── 5-Card Tactile KPI Strip (Matches Dashboard Pipa NC Bar) ─── */}
            <section aria-label="Ringkasan Data Pipa NC">
              <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 mb-3">
                <SectionTitle>Ringkasan Stok Pipa NC</SectionTitle>
                <span className="font-mono text-[10.5px] font-medium text-[var(--neu-text-muted)]">
                  Klik Grade C / E untuk menyaring tabel
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  {
                    key: 'grade-c',
                    label: 'GRADE C',
                    value: gradeCCount.toLocaleString('id-ID'),
                    unit: 'ITEM',
                    desc: `${gradeCCount.toLocaleString('id-ID')} batch akhiran C`,
                    dot: 'var(--neu-amber-bar)',
                    icon: TrendingUp,
                    color: 'text-[var(--neu-amber)]',
                    interactive: true,
                    isActive: gradeFilter === 'C',
                    onClick: () => setGradeFilter(gradeFilter === 'C' ? 'ALL' : 'C'),
                  },
                  {
                    key: 'grade-e',
                    label: 'GRADE E',
                    value: gradeECount.toLocaleString('id-ID'),
                    unit: 'ITEM',
                    desc: `${gradeECount.toLocaleString('id-ID')} batch akhiran E`,
                    dot: 'var(--neu-red-bar)',
                    icon: TrendingUp,
                    color: 'text-[var(--neu-red)]',
                    interactive: true,
                    isActive: gradeFilter === 'E',
                    onClick: () => setGradeFilter(gradeFilter === 'E' ? 'ALL' : 'E'),
                  },
                  {
                    key: 'total-item',
                    label: 'TOTAL ITEM',
                    value: totalItems.toLocaleString('id-ID'),
                    unit: 'ITEM',
                    desc: 'Total pipa terdaftar',
                    dot: 'var(--neu-accent)',
                    icon: Box,
                    color: 'text-[var(--neu-accent)]',
                    interactive: true,
                    isActive: gradeFilter === 'ALL' && !searchQuery,
                    onClick: () => {
                      setGradeFilter('ALL');
                      setSearchQuery('');
                    },
                  },
                  {
                    key: 'total-qty',
                    label: 'TOTAL QTY',
                    value: totalQty.toLocaleString('id-ID'),
                    unit: 'PC',
                    desc: 'Stok BOM terhitung',
                    dot: 'var(--neu-purple-bar)',
                    icon: Package,
                    color: 'text-[var(--neu-purple)]',
                    interactive: false,
                    isActive: false,
                  },
                  {
                    key: 'total-tonase',
                    label: 'TOTAL TONASE',
                    value: totalTonase.toLocaleString('id-ID', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }),
                    unit: 'TON',
                    desc: 'Stok EOM aktif',
                    dot: 'var(--neu-green-bar)',
                    icon: TrendingUp,
                    color: 'text-[var(--neu-green)]',
                    span: 'col-span-2 md:col-span-1',
                    interactive: false,
                    isActive: false,
                  },
                ].map((c) => {
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider truncate">
                          {c.label}
                        </span>
                        <span
                          className={cn(
                            'w-7 h-7 rounded-xl neu-icon-inset flex items-center justify-center shrink-0',
                            c.color
                          )}
                        >
                          <c.icon size={12} strokeWidth={2.4} />
                        </span>
                      </div>
                      <div className="text-[24px] font-extrabold text-[var(--neu-text)] mt-2.5 tabular-nums leading-none">
                        {c.value}{' '}
                        <span className="font-mono text-[11px] font-medium text-[var(--neu-text-muted)]">
                          {c.unit}
                        </span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-[var(--neu-divider)] flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[var(--neu-text-muted)] truncate flex items-center gap-1.5 font-medium">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: c.dot }}
                          />
                          {c.desc}
                        </span>
                        {c.interactive && c.key !== 'total-item' && (
                          <span
                            className={cn(
                              'font-mono text-[10px] font-bold shrink-0',
                              c.isActive
                                ? 'text-[var(--neu-accent)]'
                                : 'text-[var(--neu-text-muted)] group-hover:text-[var(--neu-accent)]'
                            )}
                          >
                            {c.isActive ? 'Aktif' : 'Filter'}
                          </span>
                        )}
                      </div>
                    </>
                  );

                  if (c.interactive) {
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={c.onClick}
                        className={cn(
                          'p-4 rounded-2xl transition-neu cursor-pointer text-left flex flex-col justify-between group',
                          c.isActive && c.key !== 'total-item'
                            ? 'neu-inset border border-[var(--neu-accent-border)]'
                            : 'neu-card neu-card-interactive active:shadow-[var(--neu-shadow-inset-sm)]',
                          c.span
                        )}
                      >
                        {content}
                      </button>
                    );
                  }

                  return (
                    <article
                      key={c.key}
                      className={cn(
                        'p-4 rounded-2xl neu-card text-left flex flex-col justify-between',
                        c.span
                      )}
                    >
                      {content}
                    </article>
                  );
                })}
              </div>
            </section>

            {/* ─── Search & Filter Bar for SLOC Groups ─── */}
            <section aria-label="Daftar Pipa NC per SLOC" className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-0.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <SectionTitle>Distribusi Pipa NC per SLOC</SectionTitle>
                  <span className="neu-chip">{groups.length} SLOC</span>
                  <span className="neu-chip">{filteredData.length} Item</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:flex-none sm:w-64">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neu-text-muted)] pointer-events-none"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari material, batch, No NC..."
                      className="neu-input w-full h-9 pl-8.5 pr-8 rounded-xl text-[12px] font-medium"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] cursor-pointer"
                        aria-label="Hapus pencarian"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* Grade Segmented Filter */}
                  <div className="flex items-center p-1 neu-inset-sm rounded-xl text-[11.5px] font-bold">
                    {(['ALL', 'C', 'E'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGradeFilter(g)}
                        className={cn(
                          'h-7 px-3 rounded-lg transition-neu cursor-pointer',
                          gradeFilter === g
                            ? 'bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                            : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                        )}
                      >
                        {g === 'ALL' ? 'Semua' : `Grade ${g}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ─── SLOC Cards ─── */}
              {groups.length === 0 ? (
                <div className="neu-card p-10 text-center flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl neu-icon-inset flex items-center justify-center text-[var(--neu-text-muted)]">
                    <FileSearch size={24} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--neu-text)]">
                      Tidak ada item yang cocok
                    </p>
                    <p className="text-xs text-[var(--neu-text-muted)] mt-1">
                      Ubah kata kunci pencarian atau reset filter grade.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGradeFilter('ALL');
                      setSearchQuery('');
                    }}
                    className="h-8.5 px-4 rounded-xl text-xs font-bold neu-btn text-[var(--neu-accent)] cursor-pointer mt-1"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {groups.map(([sloc, items], groupIdx) => {
                    const slocBom = items.reduce((s, it) => s + (it.ttlStokBom || 0), 0);
                    const slocTon = items.reduce((s, it) => s + (it.ttlStokEom || 0), 0) / 1000;
                    const slocC = items.filter((it) => it.batch.trim().toUpperCase().endsWith('C')).length;
                    const slocE = items.filter((it) => it.batch.trim().toUpperCase().endsWith('E')).length;

                    return (
                      <motion.article
                        key={sloc}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(groupIdx * 0.04, 0.2), duration: 0.25, ease: easeOut }}
                        className="neu-card overflow-hidden"
                      >
                        {/* SLOC Card Header */}
                        <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl neu-icon-inset text-[var(--neu-accent)] flex items-center justify-center shrink-0">
                              <Layers size={16} strokeWidth={2.2} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-mono text-[14.5px] font-extrabold text-[var(--neu-text)] tracking-tight">
                                  {sloc}
                                </h3>
                                <span className="neu-chip">{items.length} item</span>
                              </div>
                              <p className="text-[11.5px] text-[var(--neu-text-muted)] mt-0.5 font-mono">
                                {slocBom.toLocaleString('id-ID')} PC &middot;{' '}
                                {slocTon.toLocaleString('id-ID', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{' '}
                                TON
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {slocC > 0 && (
                              <span className="font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-[var(--neu-amber-soft)] text-[var(--neu-amber)]">
                                {slocC} Grade C
                              </span>
                            )}
                            {slocE > 0 && (
                              <span className="font-mono text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-[var(--neu-red-soft)] text-[var(--neu-red)]">
                                {slocE} Grade E
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[var(--neu-divider)] bg-[var(--neu-inset-bg)]/45">
                                <th className="px-5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Material
                                </th>
                                <th className="px-3.5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Batch
                                </th>
                                <th className="px-3.5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  No NC
                                </th>
                                <th className="px-3.5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Ket. NC
                                </th>
                                <th className="px-3.5 py-3 font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Deskripsi
                                </th>
                                <th className="px-3.5 py-3 text-right font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Stok BOM
                                </th>
                                <th className="px-5 py-3 text-right font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                                  Stok EOM
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, idx) => {
                                const { noNC, keterangan } = splitNoNC(item.custRemark);
                                const isGradeC = item.batch.trim().toUpperCase().endsWith('C');

                                return (
                                  <tr
                                    key={`${item.batch}-${item.materialNumber}-${idx}`}
                                    className="border-b border-[var(--neu-divider)]/60 last:border-b-0 hover:bg-[var(--neu-row-hover)] transition-colors"
                                  >
                                    <td className="px-5 py-3 whitespace-nowrap">
                                      <span className="font-mono font-bold text-[12px] text-[var(--neu-text)]">
                                        {item.materialNumber || '-'}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                      <span className="inline-flex items-center gap-1.5 font-mono font-bold text-[11.5px] text-[var(--neu-text)] neu-inset-sm px-2.5 py-1 rounded-lg">
                                        {item.batch}
                                        <span
                                          className={cn(
                                            'text-[9.5px] font-extrabold px-1.5 py-0.25 rounded-md',
                                            isGradeC
                                              ? 'bg-[var(--neu-amber-soft)] text-[var(--neu-amber)]'
                                              : 'bg-[var(--neu-red-soft)] text-[var(--neu-red)]'
                                          )}
                                        >
                                          {isGradeC ? 'C' : 'E'}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-3 whitespace-nowrap">
                                      {noNC ? (
                                        <span className="font-mono font-bold text-[11px] bg-[var(--neu-purple-soft)] text-[var(--neu-purple)] px-2 py-0.5 rounded-md">
                                          {noNC}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-[var(--neu-text-muted)]">-</span>
                                      )}
                                    </td>
                                    <td className="px-3.5 py-3 max-w-[220px]">
                                      <span className="text-[12px] text-[var(--neu-text-secondary)] font-medium">
                                        {keterangan || '-'}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-3 max-w-[260px]">
                                      <span className="text-[12px] text-[var(--neu-text-muted)] line-clamp-2">
                                        {item.description || '-'}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                                      <span className="font-mono font-bold text-[12.5px] text-[var(--neu-text)] tabular-nums">
                                        {item.ttlStokBom.toLocaleString('id-ID')}
                                      </span>
                                      <span className="font-mono text-[10px] text-[var(--neu-text-muted)] ml-1">
                                        PC
                                      </span>
                                    </td>
                                    <td className="px-5 py-3 text-right whitespace-nowrap">
                                      <span className="font-mono font-bold text-[12.5px] text-[var(--neu-text)] tabular-nums">
                                        {item.ttlStokEom.toLocaleString('id-ID')}
                                      </span>
                                      <span className="font-mono text-[10px] text-[var(--neu-text-muted)] ml-1">
                                        KG
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* SLOC Subtotal Bar */}
                        <div className="px-5 py-3 border-t border-[var(--neu-divider)] bg-[var(--neu-inset-bg)]/35 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                          <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                            Subtotal {sloc}
                          </span>
                          <div className="flex items-center gap-4 font-mono">
                            <span className="text-[var(--neu-text-secondary)]">
                              BOM:{' '}
                              <strong className="text-[var(--neu-text)] font-extrabold tabular-nums">
                                {slocBom.toLocaleString('id-ID')} PC
                              </strong>
                            </span>
                            <span className="text-[var(--neu-text-secondary)]">
                              EOM:{' '}
                              <strong className="text-[var(--neu-green)] font-extrabold tabular-nums">
                                {slocTon.toLocaleString('id-ID', {
                                  minimumFractionDigits: 1,
                                  maximumFractionDigits: 1,
                                })}{' '}
                                TON
                              </strong>
                            </span>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─── Tactile Legend Strip ─── */}
            <div className="neu-card-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-[11.5px]">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="inline-flex items-center gap-2 font-semibold text-[var(--neu-text-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-amber-bar)]" />
                  Batch Akhiran C (Grade C)
                </span>
                <span className="inline-flex items-center gap-2 font-semibold text-[var(--neu-text-secondary)]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--neu-red-bar)]" />
                  Batch Akhiran E (Grade E)
                </span>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap text-[var(--neu-text-muted)]">
                <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded-md bg-[var(--neu-purple-soft)] text-[var(--neu-purple)]">
                  No NC
                </span>
                <span>Format 185/NCR-SKF/V/2026 atau 237/IV/2026</span>
                <span className="text-[var(--neu-divider)]">|</span>
                <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded-md neu-inset-sm text-[var(--neu-text-secondary)]">
                  Ket. NC
                </span>
                <span>Keterangan tambahan customer remark</span>
              </div>
            </div>

            {/* ─── Neumorphic Footer ─── */}
            <footer className="neu-card-sm px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--neu-text-muted)] gap-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--neu-green-bar)]" />
                <span className="font-mono text-[11px]">Data Pipa Non-Conforming (NC)</span>
              </div>
              <div className="flex items-center">
                <span>&copy; 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
              </div>
            </footer>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function PipaNCPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--neu-bg)] flex items-center justify-center">
          <div className="w-14 h-14 rounded-2xl neu-card-sm flex items-center justify-center">
            <div className="w-7 h-7 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <PipaNCContent />
    </Suspense>
  );
}
