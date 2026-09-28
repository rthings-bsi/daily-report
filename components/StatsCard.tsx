'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Activity, ArrowLeftRight, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  title: string;
  value: string;
  unit: string;
  subtitle?: string;
  type: 'in' | 'out' | 'total' | 'net';
  delay?: number;
  condensed?: boolean;
  onClick?: () => void;
  className?: string;
}

const ICONS: Record<StatsCardProps['type'], LucideIcon> = {
  in: ArrowUpRight,
  out: ArrowDownRight,
  net: ArrowLeftRight,
  total: Activity,
};

interface ThemeConfig {
  gradient: string;
  code: string;
  mainLabel: string;
  subLabel: string;
}

const THEME_CONFIG: Record<StatsCardProps['type'], ThemeConfig> = {
  in: {
    gradient: 'from-emerald-500 to-emerald-700',
    code: 'IN',
    mainLabel: 'Masuk',
    subLabel: 'Inbound',
  },
  out: {
    gradient: 'from-rose-500 to-rose-700',
    code: 'OUT',
    mainLabel: 'Keluar',
    subLabel: 'Outbound',
  },
  net: {
    gradient: 'from-sky-500 to-blue-700',
    code: 'NET',
    mainLabel: 'Net Flow',
    subLabel: 'Balance',
  },
  total: {
    gradient: 'from-slate-700 to-slate-900',
    code: 'TRX',
    mainLabel: 'Transaksi',
    subLabel: 'Total SAP',
  },
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  type,
  delay = 0,
  condensed = false,
  onClick,
  className,
}) => {
  const Icon = ICONS[type];
  const theme = THEME_CONFIG[type];

  // Parse numeric value supporting standard floats, id-ID formatted floats, and integers
  const isInteger = useMemo(() => {
    return unit === 'TRX' || unit === 'ITEM' || unit === 'PC';
  }, [unit]);

  const numericValue = useMemo(() => {
    if (typeof value !== 'string') return null;
    let cleanStr = value.trim();

    if (isInteger) {
      // Remove all dots and commas for integer counts
      cleanStr = cleanStr.replace(/[.,]/g, '');
      const parsedInt = parseInt(cleanStr, 10);
      return isNaN(parsedInt) ? null : parsedInt;
    }

    if (cleanStr.includes(',') && cleanStr.includes('.')) {
      if (cleanStr.lastIndexOf(',') > cleanStr.lastIndexOf('.')) {
        cleanStr = cleanStr.replace(/\./g, '').replace(',', '.');
      } else {
        cleanStr = cleanStr.replace(/,/g, '');
      }
    } else if (cleanStr.includes(',')) {
      cleanStr = cleanStr.replace(',', '.');
    }

    const rawFloat = parseFloat(cleanStr);
    return isNaN(rawFloat) ? null : rawFloat;
  }, [value, isInteger]);

  const hasDecimal = useMemo(() => {
    if (isInteger) return false;
    return value.includes(',') || value.includes('.');
  }, [value, isInteger]);

  const reduceMotion = useReducedMotion();
  const fmt = (v: number) =>
    hasDecimal
      ? v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : Math.round(v).toLocaleString('id-ID');

  const count = useMotionValue(0);
  const formatted = useTransform(count, v => fmt(v));

  const displayValue = useMemo(() => {
    if (numericValue === null) return value;
    return fmt(numericValue);
  }, [numericValue, value, hasDecimal]);

  useEffect(() => {
    if (numericValue === null) return;
    if (reduceMotion) {
      count.set(numericValue);
      return;
    }
    count.set(0);
    const controls = animate(count, numericValue, {
      duration: 1.0,
      delay: delay + 0.1,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [numericValue, delay, reduceMotion, count]);

  const cardClasses = cn(
    'group relative flex w-full rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-[0_1px_3px_0_rgba(0,0,0,0.03),0_4px_14px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-300 text-left',
    condensed ? 'min-h-[114px]' : 'min-h-[142px]',
    onClick
      ? 'cursor-pointer hover:-translate-y-0.5 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40'
      : '',
    className
  );

  const cardContent = (
    <>
      {/* Left Panel - Gradient with Icon and Labels */}
      <div
        className={cn(
          'w-[35%] flex flex-col justify-between text-white bg-gradient-to-br transition-all duration-300 relative shrink-0',
          theme.gradient,
          condensed ? 'p-3' : 'p-4',
          onClick && 'group-hover:brightness-105'
        )}
      >
        <div className="flex items-center justify-between w-full">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-inner shrink-0">
            <Icon size={17} strokeWidth={2.5} className="text-white" />
          </div>
          <span className="text-[9px] font-black tracking-widest uppercase bg-black/20 px-2 py-0.5 rounded-full text-white/90 shrink-0">
            {theme.code}
          </span>
        </div>

        <div className={condensed ? 'mt-2' : 'mt-3'}>
          <p className="text-sm font-bold text-white leading-tight">
            {theme.mainLabel}
          </p>
          <p className="text-[10px] font-medium text-white/80 leading-tight">
            {theme.subLabel}
          </p>
        </div>
      </div>

      {/* Right Panel - Data Metric and Caption */}
      <div
        className={cn(
          'w-[65%] flex flex-col justify-between bg-white text-slate-800',
          condensed ? 'p-3' : 'p-4'
        )}
      >
        <div>
          <div className="flex justify-between items-center gap-1.5 mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
              {title}
            </span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
              {unit}
            </span>
          </div>

          <div className="flex items-baseline gap-1 mt-1">
            <span
              className={cn(
                'font-extrabold tracking-tight text-slate-900 tabular-nums leading-none',
                condensed ? 'text-2xl' : 'text-2xl sm:text-[26px] lg:text-[28px]'
              )}
              title={displayValue}
            >
              {numericValue !== null ? <motion.span>{formatted}</motion.span> : value}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100/90">
          <p className="text-[11px] font-medium text-slate-400 group-hover:text-slate-600 transition-colors truncate pr-1">
            {subtitle || (onClick ? 'Klik untuk detail' : 'Data terverifikasi')}
          </p>
          {onClick && (
            <span className="text-slate-300 group-hover:text-slate-700 transition-colors flex items-center shrink-0">
              <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full"
    >
      {onClick ? (
        <button type="button" onClick={onClick} className={cardClasses}>
          {cardContent}
        </button>
      ) : (
        <div className={cardClasses}>{cardContent}</div>
      )}
    </motion.div>
  );
};
