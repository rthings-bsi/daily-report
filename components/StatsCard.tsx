'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  unit: string;
  subtitle?: string;
  type: 'in' | 'out' | 'total';
  delay?: number;
  condensed?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  type,
  delay = 0,
  condensed = false,
}) => {
  const getIcon = () => {
    if (type === 'in') return ArrowUpRight;
    if (type === 'out') return ArrowDownRight;
    return Activity;
  };

  const getColorStyles = () => {
    switch (type) {
      case 'in':
        return {
          bg: 'bg-emerald-50',
          icon: 'text-emerald-600',
          border: 'border-l-emerald-500',
          badge: 'bg-emerald-500',
        };
      case 'out':
        return {
          bg: 'bg-rose-50',
          icon: 'text-rose-600',
          border: 'border-l-rose-500',
          badge: 'bg-rose-500',
        };
      default:
        return {
          bg: 'bg-indigo-50',
          icon: 'text-indigo-600',
          border: 'border-l-indigo-500',
          badge: 'bg-indigo-500',
        };
    }
  };

  const styles = getColorStyles();
  const Icon = getIcon();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.015 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      className={`relative overflow-hidden bg-white border border-slate-200 border-l-4 ${styles.border} shadow-sm hover:shadow-lg transition-all duration-300 group ${condensed ? 'rounded-2xl p-4' : 'rounded-2xl p-6'}`}
    >
      {/* Subtle BG on hover */}
      <div
        className={`absolute inset-0 ${styles.bg} opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none`}
      />

      <div className="flex items-start justify-between relative z-10">
        <div className={condensed ? 'space-y-2' : 'space-y-3'}>
          <p className={`${condensed ? 'text-[10px]' : 'text-xs'} font-bold text-slate-400 uppercase tracking-widest`}>
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <h3
              className={`${condensed ? 'text-2xl' : 'text-3xl'} font-black text-slate-900 tabular-nums tracking-tight`}
            >
              {value}
            </h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{unit}</span>
          </div>
          {!condensed && subtitle && (
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${styles.badge} animate-pulse`} />
              <p className="text-xs font-medium text-slate-400">{subtitle}</p>
            </div>
          )}
        </div>

        <div
          className={`${condensed ? 'p-2.5 rounded-xl' : 'p-3.5 rounded-2xl'} ${styles.bg} group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}
        >
          <Icon size={condensed ? 18 : 22} className={styles.icon} strokeWidth={2.5} />
        </div>
      </div>
    </motion.div>
  );
};
