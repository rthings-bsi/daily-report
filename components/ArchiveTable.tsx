'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { History, Trash2, Search, X, Calendar, FileSpreadsheet, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';

export interface ArchiveSession {
  reportSessionId: string;
  label: string;
  dateStr: string;
  fileName?: string;
  createdAt: string;
  totalCount: number;
  gudangId?: number | null;
}

interface ArchiveTableProps {
  refreshKey?: number;
}

type SortKey = 'dateStr' | 'label' | 'totalCount' | 'createdAt' | 'gudangId';

export const ArchiveTable: React.FC<ArchiveTableProps> = ({ refreshKey }) => {
  const router = useRouter();
  const { data: authSession } = useSession();
  const isAdmin = authSession?.user?.role === 'admin';

  const [sessions, setSessions] = useState<ArchiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('dateStr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      if (res.ok) setSessions(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, refreshKey]);

  const filtered = useMemo(() => {
    let list = sessions;
    if (dateFilter) list = list.filter((s) => s.dateStr.startsWith(dateFilter));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          (s.fileName || '').toLowerCase().includes(q) ||
          s.dateStr.toLowerCase().includes(q),
      );
    }
    const sorted = [...list].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return sorted;
  }, [sessions, search, dateFilter, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const openSession = (id: string) => {
    router.push(`/?reportSessionId=${id}`);
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Hapus laporan ini? Tindakan tidak dapat dibatalkan.')) return;
    setDeletingId(id);
    try {
      await fetch(`/api/reports/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.reportSessionId !== id));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.reportSessionId)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Yakin ingin menghapus ${selectedIds.size} laporan secara permanen?`)) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await fetch('/api/reports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Failed to bulk delete');

      setSessions(prev => prev.filter(s => !selectedIds.has(s.reportSessionId)));
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menghapus data.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const SortHeader: React.FC<{ k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }> = ({ k, children, align = 'left' }) => (
    <th
      onClick={() => handleSort(k)}
      className={`px-5 py-3 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors hover:bg-[#C4E2F5]/30 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortKey === k ? 'text-[#1591DC]' : 'text-[#2C5EAD]/60'}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortKey === k && (
          <span className="text-[9px] text-[#4BB8FA]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <section className="bg-white/80 border border-[#C4E2F5]/60 rounded-3xl shadow-sm shadow-[#1591DC]/5 overflow-hidden backdrop-blur-xl">
      <div className="px-6 py-4 border-b border-[#C4E2F5]/40 flex items-center justify-between gap-3 flex-wrap bg-gradient-to-r from-white/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-[#1591DC]/10 to-[#4BB8FA]/10 rounded-xl border border-[#C4E2F5]/50">
            <History size={16} className="text-[#1591DC]" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-[#2C5EAD] uppercase tracking-wider">Arsip Laporan</h2>
            <p className="text-[10px] font-medium text-[#1591DC]/70 mt-0.5">
              {loading ? 'Memuat data sinkronisasi...' : `${filtered.length} dari ${sessions.length} dokumen`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1591DC]/50" />
            <input
              type="text"
              placeholder="Cari label / file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 pr-3 text-[11px] font-semibold text-[#2C5EAD] bg-white/70 border border-[#C4E2F5]/50 rounded-xl outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 w-48 placeholder:text-[#1591DC]/40 transition-all hover:bg-white"
            />
          </div>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1591DC]/50 pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 pl-8 pr-3 text-[11px] font-semibold text-[#2C5EAD] bg-white/70 border border-[#C4E2F5]/50 rounded-xl outline-none focus:border-[#4BB8FA] focus:ring-2 focus:ring-[#4BB8FA]/20 [color-scheme:light] transition-all hover:bg-white"
            />
          </div>
          {(search || dateFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setDateFilter('');
              }}
              className="h-9 inline-flex items-center gap-1 px-3 text-[11px] font-bold text-rose-500 hover:text-white hover:bg-rose-500 rounded-xl transition-colors border border-transparent hover:border-rose-600 shadow-sm"
            >
              <X size={12} strokeWidth={2.5} />
              Reset
            </button>
          )}

          <AnimatePresence>
            {isAdmin && selectedIds.size > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="h-9 inline-flex items-center gap-1.5 px-3 text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                {isBulkDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={13} strokeWidth={2.5} />
                )}
                Hapus ({selectedIds.size})
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-[#C4E2F5]/50 z-10 shadow-sm shadow-[#1591DC]/5">
            <tr>
              <th className="px-5 py-3 w-10 text-left border-b border-[#C4E2F5]/50">
                <div
                  onClick={toggleAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                    selectedIds.size > 0 && selectedIds.size === filtered.length
                      ? 'bg-[#1591DC] border-[#1591DC]'
                      : 'border-[#1591DC]/40 hover:border-[#1591DC]'
                  }`}
                >
                  {selectedIds.size > 0 && selectedIds.size === filtered.length && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
                  {selectedIds.size > 0 && selectedIds.size < filtered.length && <div className="w-2 h-0.5 bg-white rounded-full" />}
                </div>
              </th>
              <SortHeader k="dateStr">Tanggal</SortHeader>
              <SortHeader k="label">Label</SortHeader>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-left text-[#2C5EAD]/60">Diupload Oleh</th>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-left text-[#2C5EAD]/60">File SAP</th>
              <SortHeader k="totalCount" align="right">Transaksi</SortHeader>
              <SortHeader k="createdAt">Disinkronisasi</SortHeader>
              <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-right text-[#2C5EAD]/60 w-16">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-3 text-[#1591DC]/60">
                      <div className="w-6 h-6 border-[3px] border-[#C4E2F5]/50 border-t-[#1591DC] rounded-full animate-spin" />
                      <span className="text-[11px] font-medium tracking-wide">Mencari arsip sinkronisasi...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FileSpreadsheet size={32} strokeWidth={1.2} />
                      <span className="text-[12px] font-medium">
                        {sessions.length === 0
                          ? 'Belum ada data warehouse yang disinkronkan.'
                          : 'Tidak ada dokumen yang cocok dengan pencarian.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => {
                  const isSelected = selectedIds.has(s.reportSessionId);
                  return (
                  <motion.tr
                    key={s.reportSessionId}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: Math.min(i * 0.015, 0.2) }}
                    onClick={() => openSession(s.reportSessionId)}
                    className={`group cursor-pointer border-b border-[#C4E2F5]/20 last:border-b-0 hover:bg-gradient-to-r hover:from-transparent hover:via-[#1591DC]/5 hover:to-transparent transition-colors ${isSelected ? 'bg-[#1591DC]/5' : ''}`}
                  >
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div
                        onClick={(e) => toggleSelection(s.reportSessionId, e)}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#1591DC] border-[#1591DC]'
                            : 'border-slate-300 hover:border-[#1591DC] bg-white'
                        }`}
                      >
                        {isSelected && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="inline-flex items-center gap-2 text-[11px] font-bold text-[#2C5EAD]">
                        <Calendar size={12} className="text-[#1591DC]/60" />
                        {s.dateStr}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-bold text-[#1591DC] group-hover:text-[#2C5EAD] transition-colors">
                        {s.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.gudangId ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                          Gudang {s.gudangId}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-100">
                          Admin (Global)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[11px] font-medium text-[#2C5EAD]/60 max-w-[280px] truncate" title={s.fileName}>
                      {s.fileName || <span className="text-[#C4E2F5]">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] font-black text-[#2C5EAD] text-right tabular-nums">
                      {s.totalCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3.5 text-[10px] font-medium text-[#2C5EAD]/50">
                      {new Date(s.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => deleteSession(s.reportSessionId, e)}
                        disabled={deletingId === s.reportSessionId || isBulkDeleting}
                        className="inline-flex items-center justify-center p-2 text-rose-300 hover:text-white hover:bg-rose-500 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50 shadow-sm"
                        title="Hapus sinkronisasi"
                      >
                        {deletingId === s.reportSessionId ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
};
