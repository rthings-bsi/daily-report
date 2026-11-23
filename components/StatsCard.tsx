'use client';

import React, { useEffect, useMemo } from 'react';
import { motion, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface StatsCardProps {
  title: string;
  value: string;
  unit: string;
  subtitle?: string;
  type: 'in' | 'out' | 'total' | 'net';
  delay?: number;
  condensed?: boolean;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

interface ThemeConfig {
  dotColor: string;
  iconColor: string;
  valueColor: string;
}

const THEME_CONFIG: Record<StatsCardProps['type'], ThemeConfig> = {
  in: {
    dotColor: 'bg-[var(--neu-green-bar)]',
    iconColor: 'text-[var(--neu-green)]',
    valueColor: 'text-[var(--neu-text)]',
  },
  out: {
    dotColor: 'bg-[var(--neu-red-bar)]',
    iconColor: 'text-[var(--neu-red)]',
    valueColor: 'text-[var(--neu-text)]',
  },
  net: {
    dotColor: 'bg-[var(--neu-accent)]',
    iconColor: 'text-[var(--neu-accent)]',
    valueColor: 'text-[var(--neu-accent)]',
  },
  total: {
    dotColor: 'bg-[var(--neu-purple-bar)]',
    iconColor: 'text-[var(--neu-purple)]',
    valueColor: 'text-[var(--neu-text)]',
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
  active = false,
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
      duration: 0.7,
      delay: delay + 0.04,
      ease: [0.23, 1, 0.32, 1],
    });
    return () => controls.stop();
  }, [numericValue, delay, reduceMotion, count]);

  const renderIcon = () => {
    if (type === 'in') {
      return (
        <svg className="w-4 h-4 transform -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        </svg>
      );
    }
    if (type === 'out') {
      return (
        <svg className="w-4 h-4 transform rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" />
        </svg>
      );
    }
    if (type === 'net') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.1" />
      </svg>
    );
  };

  const cardWrapperClasses = cn(
    'rounded-[1.25rem] flex flex-col justify-between text-left w-full transition-neu',
    active
      ? 'neu-inset border border-[var(--neu-accent-border)]'
      : 'neu-card',
    onClick ? 'cursor-pointer neu-card-interactive active:shadow-[var(--neu-shadow-inset-sm)] active:translate-y-0' : '',
    condensed ? 'p-4' : 'p-5',
    className
  );

  const cardInner = (
    <>
      {/* Top row: Title + Tactile Inset Icon Socket */}
      <div className="flex items-center justify-between w-full gap-2">
        <span className="text-[12.5px] font-bold text-[var(--neu-text-secondary)] tracking-tight truncate flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full shrink-0', theme.dotColor)} />
          {title}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {active && (
            <span className="neu-chip">Aktif</span>
          )}
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 neu-icon-inset',
              theme.iconColor
            )}
          >
            {renderIcon()}
          </div>
        </div>
      </div>

      {/* Tactile KPI Value */}
      <div className="mt-4">
        <div
          className={cn(
            'font-extrabold tracking-tight flex items-baseline gap-2 tabular-nums leading-none',
            condensed ? 'text-[26px] sm:text-[30px]' : 'text-[30px] sm:text-[36px]',
            theme.valueColor
          )}
          title={displayValue}
        >
          {numericValue !== null && !reduceMotion ? <motion.span>{formatted}</motion.span> : displayValue}
          <span className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
            {unit}
          </span>
        </div>

        {subtitle && (
          <div className="mt-3.5 pt-2.5 border-t border-[var(--neu-divider)] flex items-center justify-between gap-2">
            <p className="text-[11.5px] text-[var(--neu-text-muted)] font-medium truncate">
              {subtitle}
            </p>
            {onClick && (
              <span className="text-[11px] font-bold text-[var(--neu-accent)] shrink-0">
                Buka
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
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
