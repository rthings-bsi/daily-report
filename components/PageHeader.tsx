'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { ThemeToggle } from './ThemeToggle';

interface PageHeaderProps {
  icon: React.ElementType;
  iconBg?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
}

const ease = [0.23, 1, 0.32, 1] as const;

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  className,
  children,
}) => {
  const { toggle } = useSidebar();

  return (
    <motion.header
      initial={{ y: -8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease }}
      className={cn(
        'sticky top-0 z-40',
        'bg-[var(--neu-bg)]/95 backdrop-blur-md',
        'border-b border-[var(--neu-divider)]',
        'shadow-[0_6px_16px_-10px_var(--neu-shadow-dark)]',
        className
      )}
    >
      <div className="max-w-[1700px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* ─── Left: Title & Embossed Icon Socket ─── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={toggle}
            className="md:hidden p-2 -ml-1 neu-btn rounded-xl text-[var(--neu-text-secondary)] cursor-pointer"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 neu-icon-well',
              iconBg ? iconBg : 'text-[var(--neu-accent)]'
            )}
          >
            <Icon size={16} strokeWidth={2.3} />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h1 className={cn("text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight leading-tight truncate", subtitle && "mb-0.5")}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-[var(--neu-text-muted)] font-medium truncate leading-tight">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* ─── Right: Actions + Dark/Light Neumorphic Switch ─── */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </motion.header>
  );
};
