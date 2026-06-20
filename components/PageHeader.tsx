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
      'bg-white/70 backdrop-blur-2xl',
      'border-b border-[#C4E2F5]/40',
      'shadow-sm shadow-[#1591DC]/5',
      className
    )}
  >
    <div className="max-w-[1700px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-4">
      {/* ─── Left: Title ─── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={toggle}
          className="md:hidden p-1.5 -ml-1 text-[#2C5EAD] hover:bg-[#C4E2F5]/40 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <motion.div
          initial={{ rotate: -8, scale: 0.85 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring' as const, stiffness: 280, damping: 14, mass: 0.7 }}
          className={cn(
            'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm',
            iconBg || 'bg-gradient-to-br from-[#1591DC] to-[#2C5EAD]'
          )}
        >
          <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_60%)] pointer-events-none" />
          <Icon size={15} className="text-white relative" strokeWidth={2.2} />
        </motion.div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-[#2C5EAD] truncate tracking-tight leading-none">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-[#1591DC]/60 font-medium mt-0.5 truncate leading-none">{subtitle}</p>
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
