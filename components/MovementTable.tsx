'use client';

import React, { useState } from 'react';
import { ProcessedMovement } from '@/lib/excel-parser';
import { Search, History, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MovementTableProps {
  data: ProcessedMovement[];
  condensed?: boolean;
}

export const MovementTable: React.FC<MovementTableProps> = ({ data, condensed = false }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isFocused, setIsFocused] = useState(false);

  const summaryData = React.useMemo(() => {
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
          slowCount: 0
        });
      }
      const entry = map.get(key)!;
      entry.count += 1;
      entry.totalWeight += item.quantity;
      entry.totalPcs += item.unitQuantity;
      if (item.movementStatus === 'Fast') entry.fastCount += 1;
      if (item.movementStatus === 'Slow') entry.slowCount += 1;
    });

    return Array.from(map.values()).filter(item => {
      const matchesSearch = 
        item.moveType.includes(search) || 
        item.description.toLowerCase().includes(search.toLowerCase());
      
      const matchesType = filterType === 'all' || item.group === filterType;

      return matchesSearch && matchesType;
    });
  }, [data, search, filterType]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-500 ${condensed ? 'rounded-3xl' : 'rounded-3xl mb-12'}`}
    >
      <div className={`${condensed ? 'px-6 py-4' : 'p-6'} border-b border-slate-100 dark:border-slate-800 flex items-center justify-between relative bg-white dark:bg-slate-900 z-10`}>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
            <History className="text-indigo-600" size={20} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Transaction Analytics</h3>
        </div>
        
        {!condensed && (
          <div className="flex gap-4 items-center">
            <div className={`relative transition-all duration-300 ${isFocused ? 'w-80' : 'w-64'}`}>
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isFocused ? 'text-indigo-600' : 'text-slate-400'}`} size={18} />
              <input 
                type="text"
                placeholder="Search movements..."
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1 min-h-0 custom-scrollbar relative">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className={`sticky top-0 z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md text-slate-500 text-[11px]`}>
            <tr>
              <th className="px-6 py-3 font-bold uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Type</th>
              <th className="px-6 py-3 font-bold uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">Ref Code</th>
              <th className="px-6 py-3 font-bold uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-center">Rec</th>
              <th className="px-6 py-3 font-bold uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            <AnimatePresence>
              {summaryData.map((item, index) => (
                <motion.tr 
                  key={`${item.moveType}-${item.description}`} 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-colors group cursor-default"
                >
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-slate-500 bg-slate-50 border border-slate-100 font-black group-hover:bg-white group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all text-[11px]`}>
                      {item.moveType}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-1.5 h-1.5 rounded-full transition-all group-hover:scale-125" 
                        style={{ backgroundColor: item.color }} 
                      />
                      <span className={`font-bold text-slate-700 dark:text-slate-200 tracking-tight transition-colors group-hover:text-slate-900 text-xs`}>
                        {item.description}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-xs text-center font-bold text-slate-400 tabular-nums">
                    {item.count}
                  </td>
                  <td className={`px-6 py-3.5 text-sm font-mono font-black text-right tabular-nums ${
                    item.group === 'Masuk' ? 'text-emerald-600' : 
                    item.group === 'Keluar' ? 'text-rose-600' : 
                    'text-slate-600'
                  }`}>
                    {item.totalWeight.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {!condensed && (
        <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 backdrop-blur-sm">
          <div className="flex justify-between items-end">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Aggregate</span>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  {summaryData.filter(i => i.group === 'Masuk').length} Types In
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  {summaryData.filter(i => i.group === 'Keluar').length} Types Out
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Cumulative Net Output</span>
              <p className="text-3xl font-black text-slate-900 tracking-tighter">
                {summaryData.reduce((acc, curr) => acc + curr.totalWeight, 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                <span className="text-sm font-bold text-slate-400 ml-1.5 uppercase">ton</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </motion.div>
  );
};
