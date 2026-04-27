'use client';

import React, { useState } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

interface DetailedTableProps {
  data: ProcessedMovement[];
}

export const DetailedTable: React.FC<DetailedTableProps> = ({ data }) => {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredData = React.useMemo(() => {
    return data.filter(item => {
      const searchLower = search.toLowerCase();
      return (
        item.moveType.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.workCenter.toLowerCase().includes(searchLower) ||
        item.batch.toLowerCase().includes(searchLower)
      );
    });
  }, [data, search]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-3xl overflow-hidden mt-8"
    >
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold leading-none">Detail Transaksi</h3>
            <p className="text-xs text-slate-400 mt-1">Daftar lengkap pergerakan barang</p>
          </div>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Cari Batch, WC, atau Mvt..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-500 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-8 py-5 font-bold">Posting Date</th>
              <th className="px-8 py-5 font-bold">Mvt Type</th>
              <th className="px-8 py-5 font-bold">Work Center</th>
              <th className="px-8 py-5 font-bold">Batch</th>
              <th className="px-8 py-5 font-bold text-right">Qty (PC)</th>
              <th className="px-8 py-5 font-bold text-right">Tonnage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {item.postingDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded text-xs font-black text-indigo-600 w-fit">
                      {item.moveType}
                    </span>
                    <span className="text-xs text-slate-400 font-medium truncate max-w-[150px]" title={item.description}>
                      {item.description}
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-sm text-slate-600 dark:text-slate-400 font-bold">
                  {item.workCenter || '-'}
                </td>
                <td className="px-8 py-6">
                  <span className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800 font-bold">
                    {item.batch || 'NO BATCH'}
                  </span>
                </td>
                <td className="px-8 py-6 text-sm font-bold text-right text-slate-700 dark:text-slate-300 tabular-nums">
                  {item.unitQuantity.toLocaleString('id-ID')}
                </td>
                <td className={`px-8 py-6 text-base font-black text-right tabular-nums ${
                  item.group === 'Masuk' ? 'text-emerald-600' : 
                  item.group === 'Keluar' ? 'text-rose-600' : 
                  'text-slate-600 dark:text-slate-300'
                }`}>
                  {item.quantity.toLocaleString('id-ID', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                  <span className="text-[10px] ml-1 uppercase opacity-50">t</span>
                </td>
              </tr>
            ))}
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium">
                  Tidak ada data transaksi yang ditemukan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
        <p className="text-sm text-slate-500 font-medium">
          Menampilkan <span className="font-black text-slate-900">{startIndex + 1}</span> - <span className="font-black text-slate-900">{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> dari <span className="font-black text-slate-900">{filteredData.length}</span> baris
        </p>
        
        <div className="flex gap-3">
          <button 
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          
          <div className="flex items-center gap-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum = currentPage;
              if (totalPages > 5) {
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
              } else {
                pageNum = i + 1;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === pageNum 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => goToPage(currentPage + 1)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
