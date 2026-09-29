'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, ArrowLeftRight, ClipboardList, type LucideIcon } from 'lucide-react';
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

interface ThemeConfig {
  code: string;
  gradient: string;
  glowClass: string;
  glowHover: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  valueColor: string;
  subtitleColor: string;
  actionText: string;
  actionColor: string;
  glowBg: string;
}

const THEME_CONFIG: Record<StatsCardProps['type'], ThemeConfig> = {
  in: {
    code: 'IN',
    gradient: 'from-emerald-400 to-emerald-600',
    glowClass: 'shadow-apple-glow-green',
    glowHover: 'hover:shadow-apple-glow-green',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-600',
    badgeBorder: 'border-emerald-200',
    valueColor: 'text-slate-900',
    subtitleColor: 'text-emerald-700',
    actionText: 'Masuk →',
    actionColor: 'text-emerald-500',
    glowBg: 'bg-emerald-500/10',
  },
  out: {
    code: 'OUT',
    gradient: 'from-rose-500 to-red-600',
    glowClass: 'shadow-apple-glow-red',
    glowHover: 'hover:shadow-apple-glow-red',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-600',
    badgeBorder: 'border-rose-200',
    valueColor: 'text-slate-900',
    subtitleColor: 'text-rose-600',
    actionText: 'Keluar →',
    actionColor: 'text-rose-500',
    glowBg: 'bg-rose-500/10',
  },
  net: {
    code: 'NET',
    gradient: 'from-blue-500 to-blue-600',
    glowClass: 'shadow-apple-glow-blue',
    glowHover: 'hover:shadow-apple-glow-blue',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-600',
    badgeBorder: 'border-blue-200',
    valueColor: 'text-blue-600',
    subtitleColor: 'text-slate-600',
    actionText: 'Balance',
    actionColor: 'text-blue-500',
    glowBg: 'bg-blue-500/10',
  },
  total: {
    code: 'TRX',
    gradient: 'from-slate-700 to-slate-900',
    glowClass: 'shadow-apple-glow-dark',
    glowHover: 'hover:shadow-apple-glow-dark',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-300',
    valueColor: 'text-slate-900',
    subtitleColor: 'text-slate-600',
    actionText: 'Verified',
    actionColor: 'text-slate-800',
    glowBg: 'bg-slate-800/10',
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
  const theme = THEME_CONFIG[type];

  const isInteger = useMemo(() => {
    return unit === 'TRX' || unit === 'ITEM' || unit === 'PC';
  }, [unit]);

  const numericValue = useMemo(() => {
    if (typeof value !== 'string') return null;
    let cleanStr = value.trim();

    if (isInteger) {
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
      duration: 0.9,
      delay: delay + 0.05,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [numericValue, delay, reduceMotion, count]);

  const renderIcon = () => {
    if (type === 'in') {
      return (
        <svg className="w-6 h-6 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        </svg>
      );
    }
    if (type === 'out') {
      return (
        <svg className="w-6 h-6 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        </svg>
      );
    }
    if (type === 'net') {
      return (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    );
  };

  const cardWrapperClasses = cn(
    'glass-card rounded-3xl p-5 shadow-apple-card transition-apple flex flex-col justify-between group relative overflow-hidden border border-white/80 text-left w-full',
    theme.glowHover,
    onClick ? 'cursor-pointer hover:-translate-y-1 active:scale-[0.99]' : '',
    condensed ? 'p-4' : 'p-5',
    className
  );

  const cardInner = (
    <>
      {/* Background radial glow */}
      <div
        className={cn(
          'absolute -right-6 -bottom-6 w-28 h-28 rounded-full blur-2xl group-hover:scale-150 transition-all pointer-events-none',
          theme.glowBg
        )}
      />

      {/* Top row: Icon + Code + Title + Unit Pill */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl bg-gradient-to-br text-white flex items-center justify-center font-bold text-sm shrink-0',
              theme.gradient,
              theme.glowClass
            )}
          >
            {renderIcon()}
          </div>
          <div>
            <span
              className={cn(
                'text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border',
                theme.badgeBg,
                theme.badgeText,
                theme.badgeBorder
              )}
            >
              {theme.code}
            </span>
            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
              {title}
            </p>
          </div>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/80 shrink-0">
          {unit}
        </span>
      </div>

      {/* Metric value and caption */}
      <div className="mt-4 pt-2">
        <div
          className={cn(
            'font-black tracking-tight flex items-baseline gap-1.5 tabular-nums',
            condensed ? 'text-3xl' : 'text-3xl sm:text-4xl',
            theme.valueColor
          )}
          title={displayValue}
        >
          {numericValue !== null ? <motion.span>{formatted}</motion.span> : value}
          <span className="text-sm font-semibold text-slate-500">{unit}</span>
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-slate-600 border-t border-slate-200/80 pt-2.5">
          <span className={cn('font-medium truncate', theme.subtitleColor)}>
            {subtitle || (onClick ? 'Klik untuk detail' : 'Data terverifikasi')}
          </span>
          <span
            className={cn(
              'font-semibold group-hover:translate-x-1 transition-transform shrink-0 ml-2',
              theme.actionColor
            )}
          >
            {theme.actionText}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex"
    >
      {onClick ? (
        <button type="button" onClick={onClick} className={cardWrapperClasses}>
          {cardInner}
        </button>
      ) : (
        <article className={cardWrapperClasses}>
          {cardInner}
        </article>
      )}
    </motion.div>
  );
};
