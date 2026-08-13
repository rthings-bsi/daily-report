'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';

interface PageHeaderProps {
  icon: React.ElementType;
  iconBg?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

const spring = { type: 'spring' as const, stiffness: 200, damping: 22, mass: 0.8 };

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  className,
  children,
}) => {
  const { toggle, isOpen } = useSidebar();
  
  return (
  <motion.header
    initial={{ y: -16, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={spring}
    className={cn(
      'sticky top-0 z-40',
      'bg-white/95 backdrop-blur-2xl',
      'border-b border-slate-200',
      'shadow-[0_1px_2px_rgba(0,0,0,0.02)]',
      className
    )}
  >
    <div className="max-w-[1700px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-4">
      {/* ─── Left: Title ─── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggle}
          className="md:hidden p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <motion.div
          initial={{ rotate: -8, scale: 0.85 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.7 }}
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-slate-200/50',
            iconBg || 'bg-slate-100 text-slate-700'
          )}
        >
          <Icon size={15} strokeWidth={2.5} />
        </motion.div>
        <div className="min-w-0 flex flex-col justify-center h-8">
          <h1 className="text-[14px] font-bold text-slate-800 tracking-tight leading-none mb-0.5">{title}</h1>
          {subtitle && (
            <p className="text-[10px] text-slate-500 font-medium truncate leading-none">{subtitle}</p>
          )}
        </div>
      </div>

      {/* ─── Right: Actions ─── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {children}
      </div>
    </div>
  </motion.header>
  );
};
