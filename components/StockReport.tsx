'use client';

import React from 'react';
import { ProcessedStock } from '@/lib/excel-parser';
import { Box, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StockReportProps {
  data: ProcessedStock[];
  condensed?: boolean;
}

export const StockReport: React.FC<StockReportProps> = ({ data, condensed = false }) => {
  const groupedData = React.useMemo(() => {
    const groups = new Map<string, {
      status: string;
      totalQty: number;
      totalTonnage: number;
    }>();

    data.forEach(item => {
      const status = item.status || 'UNSPECIFIED';
      if (!groups.has(status)) {
        groups.set(status, {
          status: status,
          totalQty: 0,
          totalTonnage: 0,
        });
      }
      const group = groups.get(status)!;
      group.totalQty += item.quantity;
      group.totalTonnage += item.tonnage;
    });

    return Array.from(groups.values()).sort((a, b) => b.totalTonnage - a.totalTonnage);
  }, [data]);

  const grandTotalTonnage = React.useMemo(() => 
    groupedData.reduce((acc, g) => acc + g.totalTonnage, 0)
  , [groupedData]);

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 rounded-3xl`}
    >
      <div className={`px-6 py-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <Box className="text-indigo-600 dark:text-indigo-400" size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Inventory Distribution</h2>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <AnimatePresence>
          {groupedData.map((group, idx) => (
            <motion.div
              key={group.status}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 group transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2 h-2 rounded-full ${group.status === 'Sloc Penampungan' ? 'bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]' : 'bg-slate-300'}`} />
                <span className={`text-xs font-bold uppercase tracking-wide truncate ${group.status === 'Sloc Penampungan' ? 'text-indigo-600' : 'text-slate-600 dark:text-slate-300'}`}>
                  {group.status}
                </span>
              </div>
              <div className="flex items-center gap-8 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1 opacity-70">Quantity</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                    {group.totalQty.toLocaleString('id-ID')}
                    <span className="text-[10px] ml-1 font-medium text-slate-400 uppercase">Pcs</span>
                  </span>
                </div>
                <div className="text-right border-l border-slate-200/50 dark:border-slate-700 pl-8 w-32">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-widest mb-1 opacity-70">Weight</span>
                  <span className="text-sm font-black text-emerald-600 tabular-nums">
                    {group.totalTonnage.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    <span className="text-[10px] ml-1 font-bold uppercase text-emerald-600/60">ton</span>
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Mini Progress Bars for visual context with better visibility */}
      <div className="px-6 pb-6 mt-2 flex gap-1.5 h-1.5">
        {groupedData.map((group, idx) => (
          <div 
            key={idx}
            className={`h-full rounded-full transition-all duration-1000 ${group.status === 'Sloc Penampungan' ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            style={{ width: `${(group.totalTonnage / grandTotalTonnage) * 100}%` }}
          />
        ))}
      </div>
    </motion.div>
  );
};
