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

  const getColorStyles = () => {
    switch (type) {
      case 'in':
        return {
          bg: 'bg-emerald-50/50',
          gradient: 'from-emerald-400/20 via-emerald-100/5 to-transparent',
          iconBg: 'bg-emerald-500',
          iconShadow: 'shadow-emerald-500/30',
          text: 'text-emerald-900',
          ring: 'border-emerald-200/60',
          hoverRing: 'hover:border-emerald-400/50 hover:shadow-emerald-500/10',
          glow: 'bg-emerald-400',
        };
      case 'out':
        return {
          bg: 'bg-rose-50/50',
          gradient: 'from-rose-400/20 via-rose-100/5 to-transparent',
          iconBg: 'bg-rose-500',
          iconShadow: 'shadow-rose-500/30',
          text: 'text-rose-900',
          ring: 'border-rose-200/60',
          hoverRing: 'hover:border-rose-400/50 hover:shadow-rose-500/10',
          glow: 'bg-rose-400',
        };
      default:
        return {
          bg: 'bg-[#C4E2F5]/30',
          gradient: 'from-[#1591DC]/20 via-[#4BB8FA]/5 to-transparent',
          iconBg: 'bg-gradient-to-br from-[#1591DC] to-[#2C5EAD]',
          iconShadow: 'shadow-[#1591DC]/30',
          text: 'text-[#2C5EAD]',
          ring: 'border-[#C4E2F5]/80',
          hoverRing: 'hover:border-[#4BB8FA]/60 hover:shadow-[#1591DC]/10',
          glow: 'bg-[#1591DC]',
        };
    }
  };

  const styles = getColorStyles();
  const Icon = getIcon();

  const containerClasses = `relative flex overflow-hidden bg-white/80 backdrop-blur-xl border ${styles.ring} ${styles.hoverRing} shadow-sm transition-all duration-300 group ${condensed ? 'rounded-2xl p-4' : 'rounded-3xl p-5'}`;

  const renderContent = () => (
    <>
      {/* Decorative Gradient Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

      {/* Subtle Glow Dot */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 ${styles.glow} rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />

      <div className="flex items-start justify-between relative z-10 w-full">
        <div className={condensed ? 'space-y-1' : 'space-y-2'}>
          <p className={`${condensed ? 'text-[10px]' : 'text-xs'} font-bold text-slate-500 uppercase tracking-widest`}>
            {title}
          </p>
          <div className="flex items-baseline gap-1.5">
            <h3
              className={`${condensed ? 'text-2xl' : 'text-3xl'} font-black ${styles.text} tabular-nums tracking-tighter`}
            >
              {value}
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{unit}</span>
          </div>
          {!condensed && subtitle && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`w-1.5 h-1.5 rounded-full ${styles.glow} animate-pulse`} />
              <p className="text-[11px] font-bold text-slate-500">{subtitle}</p>
            </div>
          )}
        </div>

        <div
          className={`${condensed ? 'p-2' : 'p-2.5'} rounded-xl ${styles.iconBg} shadow-lg ${styles.iconShadow} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 flex-shrink-0 relative overflow-hidden`}
        >
          <div className="absolute inset-0 bg-white/20 w-1/2 h-full skew-x-12 translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-700 ease-in-out" />
          <Icon size={condensed ? 16 : 20} className="text-white" strokeWidth={3} />
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
        onClick={onClick}
        type="button"
        className={`${containerClasses} cursor-pointer text-left hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50`}
      >
        {renderContent()}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      className={`${containerClasses} hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/50`}
    >
      {renderContent()}
    </motion.div>
  );
};
