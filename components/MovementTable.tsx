'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MovementTableProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

type SortField = 'moveType' | 'description' | 'count' | 'totalWeight';
type SortDirection = 'asc' | 'desc';

const getMoveTypeBadge = (moveType: string, group: string) => {
  if (moveType === '101') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (moveType === '311' && group === 'Masuk') return 'bg-teal-50 text-teal-700 border-teal-200';
  if (moveType === '311' && group === 'Keluar') return 'bg-purple-50 text-purple-700 border-purple-200';
  if (moveType === '262') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (moveType === '601') return 'bg-pink-50 text-pink-700 border-pink-200';
  if (moveType === '261') return 'bg-rose-50 text-rose-700 border-rose-200';
  return group === 'Masuk'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-rose-50 text-rose-700 border-rose-200';
};

const getDotColor = (moveType: string, group: string) => {
  if (moveType === '101') return 'bg-emerald-500';
  if (moveType === '311' && group === 'Masuk') return 'bg-teal-500';
  if (moveType === '311' && group === 'Keluar') return 'bg-purple-500';
  if (moveType === '262') return 'bg-blue-500';
  if (moveType === '601') return 'bg-pink-500';
  if (moveType === '261') return 'bg-rose-500';
  return group === 'Masuk' ? 'bg-emerald-500' : 'bg-rose-500';
};

export const MovementTable: React.FC<MovementTableProps> = ({ data, condensed = false }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isFocused, setIsFocused] = useState(false);
  const [sortField, setSortField] = useState<SortField>('totalWeight');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown size={11} className="opacity-30 group-hover:opacity-100 transition-opacity ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={11} className="text-apple-blue ml-1 inline-block" />
    ) : (
      <ArrowDown size={11} className="text-apple-blue ml-1 inline-block" />
    );
  };

  const summaryData = useMemo(() => {
    const map = new Map<
      string,
      {
        moveType: string;
        description: string;
        group: string;
        color: string;
        count: number;
        totalWeight: number;
        totalPcs: number;
        fastCount: number;
        slowCount: number;
      }
    >();

    data.forEach(item => {
      const key = `${item.moveType}-${item.description}`;
      if (!map.has(key)) {
        map.set(key, {
          moveType: item.moveType,
          description: item.description,
          group: item.group,
          color: item.color,
          count: 0,
          totalWeight: 0,
          totalPcs: 0,
          fastCount: 0,
          slowCount: 0,
        });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      // Konversi KG dari SAP ke satuan TON (/ 1000)
      entry.totalWeight += item.quantity / 1000;
      entry.totalPcs += item.unitQuantity;
      if (item.movementStatus === 'Fast') entry.fastCount += 1;
      if (item.movementStatus === 'Slow') entry.slowCount += 1;
    });

    let result = Array.from(map.values()).filter(item => {
      const matchesSearch =
        item.moveType.includes(search) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === 'all' || item.group === filterType;
      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return result;
  }, [data, search, filterType, sortField, sortDirection]);

  const cumulativeNet = useMemo(() => {
    return summaryData.reduce((acc, curr) => acc + curr.totalWeight, 0);
  }, [summaryData]);

  const inCount = useMemo(() => summaryData.filter(i => i.group === 'Masuk').length, [summaryData]);
  const outCount = useMemo(() => summaryData.filter(i => i.group === 'Keluar').length, [summaryData]);

  const exportCSV = () => {
    const headers = ['Type', 'Description', 'Group', 'Count', 'Weight (TON)'];
    const csvContent = [
      headers.join(','),
      ...summaryData.map(d => `${d.moveType},"${d.description}",${d.group},${d.count},${d.totalWeight}`),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'transaction_analytics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <article
      className={`glass-card shadow-apple-card border border-white/80 flex flex-col justify-between transition-apple ${
        condensed ? 'rounded-2xl p-4' : 'rounded-3xl p-5 md:p-6'
      }`}
      data-purpose="sap-analytics-card"
      role="region"
      aria-label="Transaction Analytics Dashboard"
    >
      <div>
        {/* Card Header with Search & Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-apple-gray-200/50 pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-apple-orange flex items-center justify-center font-bold">
              <svg
                className="w-4.5 h-4.5 text-apple-orange"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 8v4l3 3" />
                <circle cx="12" cy="12" r="9" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Movement Analytics (SAP)</h2>
              <p className="text-xs text-slate-500 font-medium">Ringkasan pergerakan material berdasarkan tonase</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className={`relative transition-all duration-300 ${isFocused ? 'w-44' : 'w-36 sm:w-40'}`}>
              <Search
                className={`w-3.5 h-3.5 absolute left-2.5 top-2.5 transition-colors ${
                  isFocused ? 'text-apple-blue' : 'text-slate-400'
                }`}
              />
              <input
                type="text"
                placeholder="Cari pergerakan..."
                aria-label="Cari transaksi"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-300/80 bg-white/80 text-slate-800 focus:bg-white focus:ring-2 focus:ring-apple-blue focus:outline-none transition-apple placeholder:text-slate-400 font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Pills */}
            <div className="glass-pill p-0.5 rounded-xl flex items-center text-xs font-medium" role="tablist">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'Masuk', label: 'Masuk' },
                { key: 'Keluar', label: 'Keluar' },
              ].map(t => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={filterType === t.key}
                  onClick={() => setFilterType(t.key)}
                  className={`px-3 py-1 rounded-lg transition-apple ${
                    filterType === t.key
                      ? 'bg-white font-bold text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 font-semibold'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Export Button */}
            {!condensed && (
              <button
                type="button"
                onClick={exportCSV}
                aria-label="Export CSV"
                title="Export Table ke CSV"
                className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-apple shadow-sm cursor-pointer"
              >
                <Download size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[220px]">
          <table className="w-full text-left text-xs" aria-label="Tabel transaksi pergerakan SAP">
            <caption className="sr-only">Tabel pergerakan transaksi menampilkan tipe, referensi, frekuensi, dan berat</caption>
            <thead>
              <tr className="text-slate-500 border-b border-slate-200/80 uppercase tracking-wider text-[10px]">
                <th
                  className="py-2.5 px-3 font-bold cursor-pointer hover:text-slate-900 transition-colors"
                  onClick={() => handleSort('moveType')}
                >
                  Type <SortIcon field="moveType" />
                </th>
                <th
                  className="py-2.5 px-3 font-bold cursor-pointer hover:text-slate-900 transition-colors"
                  onClick={() => handleSort('description')}
                >
                  Ref Code &amp; Detail <SortIcon field="description" />
                </th>
                <th
                  className="py-2.5 px-3 font-bold text-center cursor-pointer hover:text-slate-900 transition-colors"
                  onClick={() => handleSort('count')}
                >
                  Rec (Tx) <SortIcon field="count" />
                </th>
                <th
                  className="py-2.5 px-3 font-bold text-right cursor-pointer hover:text-slate-900 transition-colors"
                  onClick={() => handleSort('totalWeight')}
                >
                  Weight (TON) <SortIcon field="totalWeight" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <AnimatePresence>
                {summaryData.length === 0 ? (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      <AlertCircle className="mx-auto mb-2 opacity-50 text-slate-400" size={24} />
                      <p className="text-xs font-semibold text-slate-600">Tidak ada pergerakan ditemukan</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Coba sesuaikan kata kunci pencarian atau filter.</p>
                    </td>
                  </motion.tr>
                ) : (
                  summaryData.map(item => {
                    const badgeClass = getMoveTypeBadge(item.moveType, item.group);
                    const dotClass = getDotColor(item.moveType, item.group);
                    const isMasuk = item.group === 'Masuk';
                    const weightColor = isMasuk ? 'text-emerald-600' : 'text-rose-500';

                    return (
                      <tr
                        key={`${item.moveType}-${item.description}`}
                        className="group hover:bg-white/90 transition-apple"
                      >
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold border text-[11px] tabular-nums font-mono ${badgeClass}`}
                          >
                            {item.moveType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold flex items-center gap-2 text-slate-900 text-xs">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
                            <span className="truncate">{item.description}</span>
                          </div>
                          {(item.fastCount > 0 || item.slowCount > 0) && (
                            <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                              {item.fastCount > 0 && <span>{item.fastCount} Fast</span>}
                              {item.fastCount > 0 && item.slowCount > 0 && <span> · </span>}
                              {item.slowCount > 0 && <span>{item.slowCount} Slow</span>}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700 tabular-nums">
                          {item.count.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-black text-sm tabular-nums ${weightColor}`}>
                            {item.totalWeight.toLocaleString('id-ID', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Global Aggregate Banner */}
      {summaryData.length > 0 && (
        <div className="mt-4 p-3.5 rounded-2xl bg-gradient-to-r from-slate-100/90 to-white/90 border border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-apple-sm">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-bold text-slate-700 uppercase">Global Aggregate:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-semibold">
              ● {inCount} Types In
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-800 text-xs font-semibold">
              ● {outCount} Types Out
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-slate-500 font-medium">Cumulative Net Output:</span>
            <span className="text-lg font-black text-slate-900 tabular-nums">
              {cumulativeNet.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              <span className="text-xs font-semibold text-slate-600">TON</span>
            </span>
          </div>
        </div>
      )}
    </article>
  );
};
