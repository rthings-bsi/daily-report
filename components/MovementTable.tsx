'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Search, History, Filter, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MovementTableProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

const GROUP_STYLE: Record<string, { accent: string; chip: string; chipText: string; stripe: string; }> = {
  Masuk: {
    accent: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    chipText: 'group-hover:text-emerald-700 group-hover:border-emerald-200 group-hover:bg-emerald-50',
    stripe: 'bg-emerald-500',
  },
  Keluar: {
    accent: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-100',
    chipText: 'group-hover:text-rose-700 group-hover:border-rose-200 group-hover:bg-rose-50',
    stripe: 'bg-rose-500',
  },
};

const DEFAULT_STYLE = {
  accent: 'bg-indigo-500',
  chip: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  chipText: 'group-hover:text-indigo-700 group-hover:border-indigo-200 group-hover:bg-indigo-50',
  stripe: 'bg-indigo-400',
};

type SortField = 'moveType' | 'description' | 'count' | 'totalWeight';
type SortDirection = 'asc' | 'desc';

export const MovementTable: React.FC<MovementTableProps> = ({ data, condensed = false }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isFocused, setIsFocused] = useState(false);
  const [sortField, setSortField] = useState<SortField>('totalWeight');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="opacity-30 group-hover:opacity-100 transition-opacity ml-1 inline-block" />;
    return sortDirection === 'asc'
      ? <ArrowUp size={12} className="text-indigo-500 ml-1 inline-block" />
      : <ArrowDown size={12} className="text-indigo-500 ml-1 inline-block" />;
  };

  const summaryData = useMemo(() => {
    const map = new Map<string, {
      moveType: string;
      description: string;
      group: string;
      color: string;
      count: number;
      totalWeight: number;
      totalPcs: number;
      fastCount: number;
      slowCount: number;
    }>();

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
      entry.totalWeight += item.quantity;
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

  const maxWeight = useMemo(() => Math.max(...summaryData.map(d => Math.abs(d.totalWeight)), 1), [summaryData]);

  const exportCSV = () => {
    const headers = ['Type', 'Description', 'Group', 'Count', 'Weight (TON)'];
    const csvContent = [
      headers.join(','),
      ...summaryData.map(d => `${d.moveType},"${d.description}",${d.group},${d.count},${d.totalWeight}`)
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
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300 ${condensed ? 'rounded-xl h-full' : 'rounded-2xl mb-12'}`}
      role="region"
      aria-label="Transaction Analytics Dashboard"
    >
      {!condensed && <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />}

      <div className={`${condensed ? 'px-4 py-3' : 'px-5 py-4'} border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 relative bg-white z-10`}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500 rounded-lg text-white shadow-sm shadow-indigo-500/20" aria-hidden="true">
            <History size={14} />
          </div>
          <div>
            <h3 className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Transaction Analytics</h3>
            {!condensed && <p className="text-[10px] text-slate-400 font-medium mt-0.5">Ringkasan pergerakan SAP</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!condensed && (
            <div className={`relative transition-all duration-300 ${isFocused ? 'w-44' : 'w-36'}`}>
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isFocused ? 'text-indigo-600' : 'text-slate-400'}`} size={16} />
              <input
                type="text"
                placeholder="Cari pergerakan..."
                aria-label="Cari transaksi"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-400 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {!condensed && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg" role="tablist">
              {['all', 'Masuk', 'Keluar'].map(t => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={filterType === t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    filterType === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t === 'all' ? 'Semua' : t}
                </button>
              ))}
            </div>
          )}
          {!condensed && (
             <button
                onClick={exportCSV}
                aria-label="Export CSV"
                title="Export CSV"
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
             >
                <Download size={14} />
             </button>
          )}
        </div>
      </div>

      <div className={`overflow-auto flex-1 ${condensed ? '' : 'min-h-[250px]'} custom-scrollbar relative bg-slate-50/30`}>
        <table className="w-full text-left border-separate border-spacing-0" aria-label="Summary of transactions">
          <caption className="sr-only">Table of transaction movements showing type, description, record count, and total weight.</caption>
          <colgroup>
            <col className="w-1" />
            <col className={condensed ? 'w-20' : 'w-24'} />
            <col />
            <col className={condensed ? 'w-16' : 'w-20'} />
            <col className={condensed ? 'w-28' : 'w-32'} />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-white/95 backdrop-blur-md text-slate-500 text-[10px] shadow-sm shadow-slate-200/50">
            <tr>
              <th className="w-1 p-0"></th>
              <th aria-sort={sortField === 'moveType' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${condensed ? 'px-3 sm:px-4 py-2' : 'px-4 sm:px-6 py-3'} font-bold uppercase tracking-widest border-b border-slate-200 group cursor-pointer hover:bg-slate-50 transition-colors`} onClick={() => handleSort('moveType')} tabIndex={0}>
                Type <SortIcon field="moveType" />
              </th>
              <th aria-sort={sortField === 'description' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${condensed ? 'px-3 sm:px-4 py-2' : 'px-4 sm:px-6 py-3'} font-bold uppercase tracking-widest border-b border-slate-200 group cursor-pointer hover:bg-slate-50 transition-colors`} onClick={() => handleSort('description')} tabIndex={0}>
                Ref Code <SortIcon field="description" />
              </th>
              <th aria-sort={sortField === 'count' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${condensed ? 'px-3 sm:px-4 py-2' : 'px-4 sm:px-6 py-3'} font-bold uppercase tracking-widest border-b border-slate-200 text-center group cursor-pointer hover:bg-slate-50 transition-colors`} onClick={() => handleSort('count')} tabIndex={0}>
                Rec <SortIcon field="count" />
              </th>
              <th aria-sort={sortField === 'totalWeight' ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'} className={`${condensed ? 'px-3 sm:px-4 py-2' : 'px-4 sm:px-6 py-3'} font-bold uppercase tracking-widest border-b border-slate-200 text-right group cursor-pointer hover:bg-slate-50 transition-colors`} onClick={() => handleSort('totalWeight')} tabIndex={0}>
                Weight (T) <SortIcon field="totalWeight" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            <AnimatePresence>
              {summaryData.length === 0 ? (
                <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <AlertCircle className="mx-auto mb-2 opacity-50" size={24} />
                    <p className="text-sm font-medium">No transactions found</p>
                    <p className="text-xs opacity-75 mt-1">Try adjusting your search or filters.</p>
                  </td>
                </motion.tr>
              ) : (
                summaryData.map((item, index) => {
                  const style = GROUP_STYLE[item.group] || DEFAULT_STYLE;
                  const weightColor = item.group === 'Masuk' ? 'text-emerald-600' : item.group === 'Keluar' ? 'text-rose-600' : 'text-slate-600';
                  const weightPct = (Math.abs(item.totalWeight) / maxWeight) * 100;

                  return (
                    <motion.tr
                      key={`${item.moveType}-${item.description}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: (condensed ? 0 : index * 0.02), duration: 0.15 }}
                      tabIndex={0}
                      className="group relative hover:bg-slate-50 focus-within:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                    >
                      <td className="relative p-0 w-1">
                        <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${style.stripe} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200`} />
                      </td>
                      <td className={`${condensed ? 'px-3 sm:px-4 py-2.5' : 'px-4 sm:px-6 py-3.5'}`}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[10px] font-black bg-slate-50 border border-slate-200 transition-all ${style.chipText}`}>
                          {item.moveType}
                        </span>
                      </td>
                      <td className={`${condensed ? 'px-3 sm:px-4 py-2.5' : 'px-4 sm:px-6 py-3.5'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`${condensed ? 'w-1.5 h-1.5' : 'w-2 h-2'} rounded-full transition-all group-hover:scale-125 group-focus-within:scale-125`} style={{ backgroundColor: item.color }} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-700 tracking-tight transition-colors group-hover:text-slate-900 group-focus-within:text-slate-900 text-[11px] block truncate" title={item.description}>
                              {item.description}
                            </span>
                            {(item.fastCount > 0 || item.slowCount > 0) && (
                              <div className={`flex gap-2 font-medium text-slate-400 ${condensed ? 'inline-flex ml-1 text-[9px]' : 'mt-0.5 text-[9px]'}`}>
                                {item.fastCount > 0 && <span className="text-emerald-600/70">{item.fastCount} Fast</span>}
                                {item.slowCount > 0 && <span className="text-amber-600/70">{item.slowCount} Slow</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={`${condensed ? 'px-3 sm:px-4 py-2.5' : 'px-4 sm:px-6 py-3.5'} text-center`}>
                        <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 tabular-nums group-hover:bg-slate-200 transition-colors">
                          {item.count.toLocaleString('id-ID')}
                        </span>
                      </td>
                      <td className={`${condensed ? 'px-3 sm:px-4 py-2.5' : 'px-4 sm:px-6 py-3.5'} text-right`}>
                         <div className="flex flex-col items-end gap-1">
                          <div className={`text-xs font-mono font-black tabular-nums ${weightColor} flex items-center justify-end gap-1`}>
                            {item.group === 'Masuk' ? <TrendingUp size={12} className="opacity-70" /> : item.group === 'Keluar' ? <TrendingDown size={12} className="opacity-70" /> : null}
                            {item.totalWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                          </div>
                          {!condensed && (
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden" aria-hidden="true">
                              <div className={`h-full rounded-full transition-all duration-500 ease-out ${item.group === 'Masuk' ? 'bg-emerald-400' : item.group === 'Keluar' ? 'bg-rose-400' : 'bg-slate-400'}`} style={{ width: `${Math.max(weightPct, 5)}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {!condensed && summaryData.length > 0 && (
        <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 sm:gap-0">
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]" id="global-aggregate-label">Global Aggregate</span>
              <div className="flex items-center gap-2" aria-labelledby="global-aggregate-label">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {summaryData.filter(i => i.group === 'Masuk').length} Types In
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  {summaryData.filter(i => i.group === 'Keluar').length} Types Out
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-0.5">Cumulative Net Output</span>
              <p className="text-2xl font-black text-slate-900 tracking-tighter" aria-label={`Total weight ${summaryData.reduce((acc, curr) => acc + curr.totalWeight, 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })} tons`}>
                {summaryData.reduce((acc, curr) => acc + curr.totalWeight, 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                <span className="text-[10px] font-bold text-slate-400 ml-1 uppercase" aria-hidden="true">ton</span>
              </p>
            </div>
          </div>
        </div>
      )}
      {condensed && summaryData.length > 0 && (
        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-[10px] font-medium text-slate-500">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{summaryData.filter(i => i.group === 'Masuk').length} In</span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{summaryData.filter(i => i.group === 'Keluar').length} Out</span>
          </div>
          <div className="text-xs font-mono font-bold text-slate-700 tabular-nums">
            {summaryData.reduce((acc, curr) => acc + curr.totalWeight, 0).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            <span className="text-[9px] font-semibold text-slate-400 ml-0.5">ton</span>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: #94a3b8;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </motion.div>
  );
};
