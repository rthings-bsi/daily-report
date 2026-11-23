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
      className={`px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-[var(--neu-text)] ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortKey === k ? 'text-[var(--neu-accent)]' : 'text-[var(--neu-text-muted)]'}`}
    >
      <span className="inline-flex items-center gap-1.5">
        {children}
        {sortKey === k && (
          <span className="text-[10px] text-[var(--neu-accent)]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <section className="neu-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--neu-divider)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 neu-icon-inset rounded-xl flex items-center justify-center text-[var(--neu-accent)]">
            <History size={16} />
          </div>
          <div>
            <h2 className="text-[14.5px] font-extrabold text-[var(--neu-text)] tracking-tight">Arsip Laporan</h2>
            <p className="text-[11.5px] text-[var(--neu-text-muted)]">
              {loading ? 'Memuat data sinkronisasi...' : `${filtered.length} dari ${sessions.length} dokumen`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neu-text-muted)]" />
            <input
              type="text"
              placeholder="Cari label / file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="neu-input h-9 pl-8 pr-3 text-xs font-medium rounded-xl w-48"
            />
          </div>
          <div className="relative">
            <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--neu-text-muted)] pointer-events-none" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="neu-input h-9 pl-8 pr-3 font-mono text-[11px] font-medium rounded-xl"
            />
          </div>
          {(search || dateFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDateFilter('');
              }}
              className="h-9 inline-flex items-center gap-1 px-3 text-xs font-bold text-[var(--neu-red)] neu-btn rounded-xl cursor-pointer"
            >
              <X size={12} strokeWidth={2.5} />
              Reset
            </button>
          )}

          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={handleBulkDelete}
                disabled={isBulkDeleting}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 text-xs font-bold text-white bg-[var(--neu-red)] rounded-xl transition-neu disabled:opacity-50 cursor-pointer"
              >
                {isBulkDeleting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={13} strokeWidth={2.3} />
                )}
                Hapus ({selectedIds.size})
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 bg-[var(--neu-surface)] z-10">
            <tr className="border-b border-[var(--neu-divider)]">
              <th className="px-5 py-3 w-10 text-left border-b border-[var(--neu-divider)]">
                <div
                  onClick={toggleAll}
                  className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors ${
                    selectedIds.size > 0 && selectedIds.size === filtered.length
                      ? 'bg-[var(--neu-accent)]'
                      : 'neu-inset-sm'
                  }`}
                >
                  {selectedIds.size > 0 && selectedIds.size === filtered.length && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
                  {selectedIds.size > 0 && selectedIds.size < filtered.length && <div className="w-2 h-0.5 bg-[var(--neu-accent)] rounded-full" />}
                </div>
              </th>
              <SortHeader k="dateStr">Tanggal</SortHeader>
              <SortHeader k="label">Label</SortHeader>
              <th className="px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-left text-[var(--neu-text-muted)]">Diupload Oleh</th>
              <th className="px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-left text-[var(--neu-text-muted)]">File SAP</th>
              <SortHeader k="totalCount" align="right">Transaksi</SortHeader>
              <SortHeader k="createdAt">Disinkronisasi</SortHeader>
              <th className="px-5 py-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-right text-[var(--neu-text-muted)] w-16">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--neu-divider)]">
            <AnimatePresence initial={false}>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="inline-flex flex-col items-center gap-3 text-[var(--neu-text-muted)]">
                      <div className="w-6 h-6 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
                      <span className="font-mono text-xs">Mencari arsip sinkronisasi...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex flex-col items-center justify-center text-[var(--neu-text-muted)] gap-2">
                      <FileSpreadsheet size={30} strokeWidth={1.4} />
                      <span className="text-xs font-medium">
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
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(i * 0.01, 0.15) }}
                      onClick={() => openSession(s.reportSessionId)}
                      className={`group cursor-pointer hover:bg-[var(--neu-row-hover)] transition-colors ${
                        isSelected ? 'bg-[var(--neu-accent-soft)]' : ''
                      }`}
                    >
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div
                          onClick={(e) => toggleSelection(s.reportSessionId, e)}
                          className={`w-4 h-4 rounded flex items-center justify-center cursor-pointer transition-colors ${
                            isSelected ? 'bg-[var(--neu-accent)]' : 'neu-inset-sm'
                          }`}
                        >
                          {isSelected && <CheckSquare size={12} className="text-white" strokeWidth={3} />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold text-[var(--neu-text)]">
                          <Calendar size={12} className="text-[var(--neu-text-muted)]" />
                          {s.dateStr}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[12.5px] font-bold text-[var(--neu-accent)]">
                          {s.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {s.gudangId ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--neu-green-soft)] text-[var(--neu-green)] font-mono text-[10.5px] font-semibold">
                            Gudang {s.gudangId}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--neu-purple-soft)] text-[var(--neu-purple)] font-mono text-[10.5px] font-semibold">
                            Admin (Global)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-[var(--neu-text-muted)] max-w-[260px] truncate" title={s.fileName}>
                        {s.fileName || <span>-</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] font-bold text-[var(--neu-text)] text-right tabular-nums">
                        {s.totalCount.toLocaleString('id-ID')}
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-[var(--neu-text-muted)]">
                        {new Date(s.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => deleteSession(s.reportSessionId, e)}
                          disabled={deletingId === s.reportSessionId || isBulkDeleting}
                          className="inline-flex items-center justify-center p-1.5 text-[var(--neu-text-muted)] hover:text-[var(--neu-red)] neu-btn rounded-lg opacity-0 group-hover:opacity-100 disabled:opacity-50 cursor-pointer"
                          title="Hapus sinkronisasi"
                        >
                          {deletingId === s.reportSessionId ? (
                            <div className="w-3.5 h-3.5 border-2 border-[var(--neu-divider)] border-t-[var(--neu-red)] rounded-full animate-spin" />
                          ) : (
                            <Trash2 size={14} />
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
