'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string;
  unit: string;
  subtitle?: string;
  type: 'in' | 'out' | 'total';
  delay?: number;
  condensed?: boolean;
  onClick?: () => void;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  type,
  delay = 0,
  condensed = false,
  onClick,
}) => {
  const getIcon = () => {
    if (type === 'in') return ArrowUpRight;
    if (type === 'out') return ArrowDownRight;
    return Activity;
  };

  const displayValue = useMemo(() => {
    const rawFloat = parseFloat(value);
    if (isNaN(rawFloat)) return value;
    return rawFloat.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }, [value]);

  const Icon = getIcon();

  const getStyleTokens = () => {
    switch (type) {
      case 'in':
        return {
          wrapper: 'border-emerald-200/50 bg-gradient-to-br from-emerald-50/50 to-white hover:border-emerald-300 hover:shadow-emerald-500/10',
          iconWrap: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-50',
          text: 'text-emerald-950',
          label: 'text-emerald-600/80',
          trendIcon: 'text-emerald-500',
          wave: 'text-emerald-500',
        };
      case 'out':
        return {
          wrapper: 'border-rose-200/50 bg-gradient-to-br from-rose-50/50 to-white hover:border-rose-300 hover:shadow-rose-500/10',
          iconWrap: 'bg-rose-500 text-white shadow-md shadow-rose-500/20 ring-4 ring-rose-50',
          text: 'text-rose-950',
          label: 'text-rose-600/80',
          trendIcon: 'text-rose-500',
          wave: 'text-rose-500',
        };
      default:
        return {
          wrapper: 'border-indigo-200/50 bg-gradient-to-br from-indigo-50/50 to-white hover:border-indigo-300 hover:shadow-indigo-500/10',
          iconWrap: 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 ring-4 ring-indigo-50',
          text: 'text-indigo-950',
          label: 'text-indigo-600/80',
          trendIcon: 'text-indigo-500',
          wave: 'text-indigo-500',
        };
    }
  };

  const s = getStyleTokens();

  const containerClasses = `relative flex flex-col overflow-hidden rounded-[24px] border ${s.wrapper} shadow-[0_2px_10px_rgba(0,0,0,0.02)] transition-all duration-300 group ${
    condensed ? 'p-4 min-h-[130px]' : 'p-6 min-h-[160px]'
  } ${onClick ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl' : ''}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className={`${containerClasses} w-full text-left focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2`}>
          <CardContent condensed={condensed} title={title} displayValue={displayValue} unit={unit} subtitle={subtitle} Icon={Icon} s={s} type={type} />
        </button>
      ) : (
        <div className={containerClasses}>
          <CardContent condensed={condensed} title={title} displayValue={displayValue} unit={unit} subtitle={subtitle} Icon={Icon} s={s} type={type} />
        </div>
      )}
    </motion.div>
  );
};

const CardContent = ({ condensed, title, displayValue, unit, subtitle, Icon, s, type }: any) => {
  return (
    <>
      {/* Decorative Abstract Waveform Background */}
      <div className="absolute bottom-0 right-0 left-0 h-24 pointer-events-none overflow-hidden opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" className={`w-full h-full fill-current ${s.wave}`}>
          {type === 'in' && <path d="M0,100 L0,50 C100,80 200,10 400,40 L400,100 Z" />}
          {type === 'out' && <path d="M0,100 L0,20 C150,80 250,10 400,60 L400,100 Z" />}
          {type === 'total' && <path d="M0,100 L0,40 C100,20 200,80 400,40 L400,100 Z" />}
        </svg>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

      <div className="relative z-10 flex items-start justify-between w-full mb-2">
        <div className="flex flex-col gap-1">
          <p className={`${condensed ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-widest ${s.label}`}>
            {title}
          </p>
        </div>
        <div className={`p-2 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 ${s.iconWrap}`}>
          <Icon size={condensed ? 16 : 20} strokeWidth={2.5} />
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        <div className="flex items-baseline gap-1.5">
          <h3
            className={`${condensed ? 'text-3xl' : 'text-4xl md:text-[42px]'} font-extrabold tabular-nums tracking-tight ${s.text} drop-shadow-sm`}
            title={displayValue}
          >
            {displayValue}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{unit}</span>
        </div>

        {!condensed && subtitle && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
            <TrendingUp size={14} strokeWidth={2.5} className={s.trendIcon} />
            <p className="text-[11px] font-semibold text-slate-500">{subtitle}</p>
          </div>
        )}
      </div>
    </>
  );
};
