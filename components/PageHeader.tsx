'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: React.ElementType;
  iconBg?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  iconBg = 'bg-gradient-to-br from-slate-800 to-slate-900',
  title,
  subtitle,
  className,
  children,
}) => (
  <header className={cn(
    'sticky top-0 z-50',
    'bg-white/70 backdrop-blur-2xl',
    'border-b border-slate-200/50',
    'shadow-[0_1px_3px_0_rgb(0,0,0,0.02),0_1px_2px_-1px_rgb(0,0,0,0.03)]',
    className
  )}>
    <div className="max-w-[1700px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-4">
      {/* ─── Left: Title ─── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
          'shadow-sm',
          iconBg
        )}>
          <Icon size={15} className="text-white" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-slate-900 truncate tracking-tight leading-none">{title}</h1>
          {subtitle && (
            <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate leading-none">{subtitle}</p>
          )}
        </div>
      </div>

      {/* ─── Right: Actions ─── */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {children}
      </div>
    </div>
  </header>
);
