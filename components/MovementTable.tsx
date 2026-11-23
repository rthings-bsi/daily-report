'use client';

import React, { useState, useMemo } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { classifyBatch } from '@/lib/gudang';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MovementTableProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

type SortField = 'moveType' | 'description' | 'count' | 'totalWeight';
type SortDirection = 'asc' | 'desc';

const getMoveTypeBadge = (moveType: string, group: string) => {
  if (moveType === '101') return 'bg-[var(--neu-green-soft)] text-[var(--neu-green)]';
  if (moveType === '311' && group === 'Masuk') return 'bg-[var(--neu-accent-soft)] text-[var(--neu-accent)]';
  if (moveType === '311' && group === 'Keluar') return 'bg-[var(--neu-purple-soft)] text-[var(--neu-purple)]';
  if (moveType === '262') return 'bg-[var(--neu-accent-soft)] text-[var(--neu-accent)]';
  if (moveType === '601') return 'bg-[var(--neu-amber-soft)] text-[var(--neu-amber)]';
  if (moveType === '261') return 'bg-[var(--neu-red-soft)] text-[var(--neu-red)]';
  return group === 'Masuk'
    ? 'bg-[var(--neu-green-soft)] text-[var(--neu-green)]'
    : 'bg-[var(--neu-red-soft)] text-[var(--neu-red)]';
};

const getDotVar = (moveType: string, group: string) => {
  if (moveType === '101') return 'var(--neu-green-bar)';
  if (moveType === '311' && group === 'Masuk') return 'var(--neu-accent)';
  if (moveType === '311' && group === 'Keluar') return 'var(--neu-purple-bar)';
  if (moveType === '262') return 'var(--neu-accent)';
  if (moveType === '601') return 'var(--neu-amber-bar)';
  if (moveType === '261') return 'var(--neu-red-bar)';
  return group === 'Masuk' ? 'var(--neu-green-bar)' : 'var(--neu-red-bar)';
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
      return <ArrowUpDown size={11} className="opacity-40 group-hover:opacity-100 transition-opacity ml-1 inline-block" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp size={11} className="text-[var(--neu-accent)] ml-1 inline-block" />
    ) : (
      <ArrowDown size={11} className="text-[var(--neu-accent)] ml-1 inline-block" />
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
        fastWeight: number;
        slowWeight: number;
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
          fastWeight: 0,
          slowWeight: 0,
        });
      }
      const entry = map.get(key)!;
      entry.totalWeight += item.quantity / 1000;
      entry.totalPcs += item.unitQuantity;
      const hasPrecomputed = item.fastWeight !== undefined || item.fastCount !== undefined;
      if (hasPrecomputed) {
        entry.fastCount += item.fastCount || 0;
        entry.slowCount += item.slowCount || 0;
        entry.fastWeight += (item.fastWeight || 0) / 1000;
        entry.slowWeight += (item.slowWeight || 0) / 1000;
        entry.count += item.totalCount ?? (((item.fastCount || 0) + (item.slowCount || 0)) || 1);
      } else {
        entry.count += 1;
        const wTon = Math.abs(item.quantity) / 1000;
        const status =
          item.movementStatus && item.movementStatus !== 'Unknown'
            ? item.movementStatus
            : classifyBatch(item.batch || '');
        if (status === 'Fast') {
          entry.fastCount += 1;
          entry.fastWeight += wTon;
        }
        if (status === 'Slow') {
          entry.slowCount += 1;
          entry.slowWeight += wTon;
        }
      }
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
  const totalFastCount = useMemo(() => summaryData.reduce((acc, curr) => acc + curr.fastCount, 0), [summaryData]);
  const totalSlowCount = useMemo(() => summaryData.reduce((acc, curr) => acc + curr.slowCount, 0), [summaryData]);
  const totalFastWeight = useMemo(() => summaryData.reduce((acc, curr) => acc + curr.fastWeight, 0), [summaryData]);
  const totalSlowWeight = useMemo(() => summaryData.reduce((acc, curr) => acc + curr.slowWeight, 0), [summaryData]);

  const exportCSV = () => {
    const headers = [
      'Type',
      'Description',
      'Group',
      'Count',
      'Weight (TON)',
      'Fast Count',
      'Fast Weight (TON)',
      'Slow Count',
      'Slow Weight (TON)',
    ];
    const csvContent = [
      headers.join(','),
      ...summaryData.map(
        d =>
          `${d.moveType},"${d.description}",${d.group},${d.count},${d.totalWeight},${d.fastCount},${d.fastWeight},${d.slowCount},${d.slowWeight}`
      ),
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
      className={`neu-card flex flex-col justify-between h-full ${
        condensed ? 'p-4' : 'p-5 sm:p-6'
      }`}
      data-purpose="sap-analytics-card"
      role="region"
      aria-label="Transaction Analytics Dashboard"
    >
      <div>
        {/* Card Header with Search & Segmented Filter */}
        <div className="flex flex-col gap-3 border-b border-[var(--neu-divider)] pb-4 mb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight">
                Analitik Pergerakan (SAP)
              </h2>
              <p className="text-[12px] text-[var(--neu-text-muted)] mt-0.5">
                Ringkasan pergerakan material berdasarkan tonase
              </p>
            </div>

            {!condensed && (
              <button
                type="button"
                onClick={exportCSV}
                aria-label="Export CSV"
                title="Export Table ke CSV"
                className="w-8.5 h-8.5 rounded-xl neu-btn flex items-center justify-center cursor-pointer shrink-0"
              >
                <Download size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            {/* Recessed Search Input */}
            <div className={`relative flex-1 min-w-[150px] transition-all duration-200 ${isFocused ? 'max-w-[230px]' : 'max-w-[200px]'}`}>
              <Search
                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                  isFocused ? 'text-[var(--neu-accent)]' : 'text-[var(--neu-text-muted)]'
                }`}
              />
              <input
                type="text"
                placeholder="Cari tipe..."
                aria-label="Cari transaksi"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="neu-input w-full h-8.5 text-xs pl-8 pr-2.5 rounded-xl font-medium"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Filter Pills */}
            <div className="neu-inset-sm p-0.5 rounded-xl flex items-center text-[11.5px] font-semibold shrink-0" role="tablist">
              {[
                { key: 'all', label: 'Semua' },
                { key: 'Masuk', label: 'Masuk' },
                { key: 'Keluar', label: 'Keluar' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filterType === t.key}
                  onClick={() => setFilterType(t.key)}
                  className={`px-2.5 py-1 rounded-lg transition-neu cursor-pointer ${
                    filterType === t.key
                      ? 'bg-[var(--neu-surface)] font-bold text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)]'
                      : 'text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto min-h-[220px]">
          <table className="w-full text-left text-xs" aria-label="Tabel transaksi pergerakan SAP">
            <caption className="sr-only">Tabel pergerakan transaksi menampilkan tipe, referensi, frekuensi, dan berat</caption>
            <thead>
              <tr className="text-[var(--neu-text-muted)] border-b border-[var(--neu-divider)] font-mono uppercase tracking-wider text-[10px]">
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[var(--neu-text)] transition-colors"
                  onClick={() => handleSort('moveType')}
                >
                  Type <SortIcon field="moveType" />
                </th>
                <th
                  className="py-2.5 px-3 font-semibold cursor-pointer hover:text-[var(--neu-text)] transition-colors"
                  onClick={() => handleSort('description')}
                >
                  Ref Code &amp; Detail <SortIcon field="description" />
                </th>
                <th
                  className="py-2.5 px-3 font-semibold text-center cursor-pointer hover:text-[var(--neu-text)] transition-colors"
                  onClick={() => handleSort('count')}
                >
                  Rec (Tx) <SortIcon field="count" />
                </th>
                <th
                  className="py-2.5 px-3 font-semibold text-right cursor-pointer hover:text-[var(--neu-text)] transition-colors"
                  onClick={() => handleSort('totalWeight')}
                >
                  Weight (TON) <SortIcon field="totalWeight" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--neu-divider)] text-[var(--neu-text-secondary)]">
              <AnimatePresence>
                {summaryData.length === 0 ? (
                  <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <td colSpan={4} className="py-10 text-center text-[var(--neu-text-muted)]">
                      <AlertCircle className="mx-auto mb-2 opacity-60" size={22} />
                      <p className="text-xs font-bold text-[var(--neu-text-secondary)]">Tidak ada pergerakan ditemukan</p>
                      <p className="text-[11px] mt-0.5">Sesuaikan kata kunci pencarian atau filter grup.</p>
                    </td>
                  </motion.tr>
                ) : (
                  summaryData.map(item => {
                    const badgeClass = getMoveTypeBadge(item.moveType, item.group);
                    const dotVar = getDotVar(item.moveType, item.group);
                    const isMasuk = item.group === 'Masuk';
                    const weightColor = isMasuk ? 'text-[var(--neu-green)]' : 'text-[var(--neu-red)]';

                    return (
                      <tr
                        key={`${item.moveType}-${item.description}`}
                        className="group hover:bg-[var(--neu-row-hover)] transition-colors"
                      >
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-lg font-bold text-[11px] tabular-nums font-mono ${badgeClass}`}
                          >
                            {item.moveType}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold flex items-center gap-2 text-[var(--neu-text)] text-[12.5px]">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotVar }} />
                            <span className="truncate">{item.description}</span>
                          </div>
                          {(item.fastCount > 0 || item.slowCount > 0) && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {item.fastCount > 0 && item.slowCount > 0 ? (
                                <>
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--neu-green-soft)] text-[var(--neu-green)] font-mono text-[10px] font-semibold"
                                    title={`${item.fastWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                                  >
                                    Fast: {item.fastCount.toLocaleString('id-ID')}
                                  </span>
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--neu-amber-soft)] text-[var(--neu-amber)] font-mono text-[10px] font-semibold"
                                    title={`${item.slowWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                                  >
                                    Slow: {item.slowCount.toLocaleString('id-ID')}
                                  </span>
                                </>
                              ) : item.fastCount > 0 ? (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--neu-green-soft)] text-[var(--neu-green)] font-mono text-[10px] font-semibold"
                                  title={`${item.fastWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                                >
                                  Fast Moving
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--neu-amber-soft)] text-[var(--neu-amber)] font-mono text-[10px] font-semibold"
                                  title={`${item.slowWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                                >
                                  Slow Moving
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-semibold text-[var(--neu-text-secondary)] tabular-nums">
                          {item.count.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-extrabold text-[13.5px] tabular-nums ${weightColor}`}>
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

      {/* Recessed Global Aggregate Footer Bar */}
      {summaryData.length > 0 && (
        <div className="mt-4 p-3.5 rounded-2xl neu-inset-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
              Aggregate:
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--neu-green-soft)] text-[var(--neu-green)] font-mono text-[10.5px] font-semibold">
              {inCount} In
            </span>
            <span className="px-2 py-0.5 rounded-md bg-[var(--neu-red-soft)] text-[var(--neu-red)] font-mono text-[10.5px] font-semibold">
              {outCount} Out
            </span>
            {totalFastCount > 0 && totalSlowCount > 0 ? (
              <>
                <span
                  className="px-2 py-0.5 rounded-md neu-card-sm text-[var(--neu-green)] font-mono text-[10.5px] font-semibold"
                  title={`${totalFastWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                >
                  {totalFastCount.toLocaleString('id-ID')} Fast
                </span>
                <span
                  className="px-2 py-0.5 rounded-md neu-card-sm text-[var(--neu-amber)] font-mono text-[10.5px] font-semibold"
                  title={`${totalSlowWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
                >
                  {totalSlowCount.toLocaleString('id-ID')} Slow
                </span>
              </>
            ) : totalFastCount > 0 ? (
              <span
                className="px-2 py-0.5 rounded-md neu-card-sm text-[var(--neu-green)] font-mono text-[10.5px] font-semibold"
                title={`${totalFastWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
              >
                100% Fast
              </span>
            ) : totalSlowCount > 0 ? (
              <span
                className="px-2 py-0.5 rounded-md neu-card-sm text-[var(--neu-amber)] font-mono text-[10.5px] font-semibold"
                title={`${totalSlowWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} TON`}
              >
                100% Slow
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2 shrink-0">
            <span className="text-[11.5px] text-[var(--neu-text-muted)] font-medium">Net Output:</span>
            <span className="text-[16px] font-extrabold text-[var(--neu-accent)] tabular-nums">
              {cumulativeNet.toLocaleString('id-ID', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{' '}
              <span className="font-mono text-[10.5px] font-semibold text-[var(--neu-text-muted)]">TON</span>
            </span>
          </div>
        </div>
      )}
    </article>
  );
};
