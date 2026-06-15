'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { History, Trash2, Search, X, Calendar, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ArchiveSession {
  reportSessionId: string;
  label: string;
  dateStr: string;
  fileName?: string;
  createdAt: string;
  totalCount: number;
}

interface ArchiveTableProps {
  refreshKey?: number;
}

type SortKey = 'dateStr' | 'label' | 'totalCount' | 'createdAt';

export const ArchiveTable: React.FC<ArchiveTableProps> = ({ refreshKey }) => {
  const router = useRouter();
  const [sessions, setSessions] = useState<ArchiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('dateStr');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const SortHeader: React.FC<{ k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }> = ({ k, children, align = 'left' }) => (
    <th
      onClick={() => handleSort(k)}
      className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider cursor-pointer select-none transition-colors hover:bg-sky-50 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${sortKey === k ? 'text-sky-700' : 'text-slate-500'}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && (
          <span className="text-[9px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  );

  return (
    <section className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-sky-50 rounded-lg border border-sky-100">
            <History size={14} className="text-sky-600" />
          </div>
          <div>
            <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Arsip Laporan</h2>
            <p className="text-[9px] text-slate-400 mt-0.5">
              {loading ? 'Memuat...' : `${filtered.length} dari ${sessions.length} laporan`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari label / file..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7 pr-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-44 placeholder:text-slate-400"
            />
          </div>
          <div className="relative">
            <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="month"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-8 pl-7 pr-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 [color-scheme:light]"
            />
          </div>
          {(search || dateFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setDateFilter('');
              }}
              className="h-8 inline-flex items-center gap-1 px-2.5 text-[10px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <X size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 z-10">
            <tr>
              <SortHeader k="dateStr">Tanggal</SortHeader>
              <SortHeader k="label">Label</SortHeader>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">File</th>
              <SortHeader k="totalCount" align="right">Transaksi</SortHeader>
              <SortHeader k="createdAt">Dibuat</SortHeader>
              <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right text-slate-500 w-16">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {loading && sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-slate-400">
                      <div className="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                      <span className="text-[11px]">Memuat arsip...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="inline-flex flex-col items-center gap-2 text-slate-400">
                      <FileSpreadsheet size={28} strokeWidth={1.2} />
                      <span className="text-[11px]">
                        {sessions.length === 0
                          ? 'Belum ada laporan tersimpan. Upload file Excel untuk memulai.'
                          : 'Tidak ada laporan yang cocok dengan filter.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <motion.tr
                    key={s.reportSessionId}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: Math.min(i * 0.015, 0.2) }}
                    onClick={() => openSession(s.reportSessionId)}
                    className="group cursor-pointer border-b border-slate-100 last:border-b-0 hover:bg-sky-50/40 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 font-mono">
                        <Calendar size={11} className="text-slate-400" />
                        {s.dateStr}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{s.label}</td>
                    <td className="px-4 py-2.5 text-[11px] text-slate-500 max-w-[280px] truncate" title={s.fileName}>
                      {s.fileName || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] font-bold text-sky-700 text-right tabular-nums">
                      {s.totalCount.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] text-slate-500">
                      {new Date(s.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={(e) => deleteSession(s.reportSessionId, e)}
                        disabled={deletingId === s.reportSessionId}
                        className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                        title="Hapus laporan"
                      >
                        {deletingId === s.reportSessionId ? (
                          <div className="w-3 h-3 border-2 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </section>
  );
};
