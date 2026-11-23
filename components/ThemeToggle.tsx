'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel = false }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
      title={isDark ? 'Beralih ke Light Mode' : 'Beralih ke Dark Mode'}
      onClick={toggleTheme}
      className={cn(
        'group inline-flex items-center gap-2 rounded-full p-1 transition-all duration-200 cursor-pointer select-none',
        'neu-inset-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neu-accent)]',
        showLabel ? 'pr-3' : '',
        className
      )}
    >
      {/* Physical sliding neumorphic switch track */}
      <span className="relative flex items-center w-[52px] h-[26px] rounded-full px-1">
        {/* Background hint icons */}
        <Sun
          size={11}
          strokeWidth={2.4}
          className={cn(
            'absolute left-2 transition-opacity duration-200',
            isDark ? 'text-[var(--neu-text-muted)] opacity-60' : 'opacity-0'
          )}
        />
        <Moon
          size={11}
          strokeWidth={2.4}
          className={cn(
            'absolute right-2 transition-opacity duration-200',
            isDark ? 'opacity-0' : 'text-[var(--neu-text-muted)] opacity-65'
          )}
        />

        {/* Tactile embossed sliding thumb */}
        <span
          className={cn(
            'relative z-10 w-[20px] h-[20px] rounded-full flex items-center justify-center transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]',
            'bg-[var(--neu-surface)] border border-[var(--neu-border)]',
            'shadow-[2px_2px_5px_var(--neu-shadow-dark),-2px_-2px_5px_var(--neu-shadow-light)]',
            isDark ? 'translate-x-[24px] text-[#fbbf24]' : 'translate-x-0 text-[#d97706]'
          )}
        >
          {isDark ? <Moon size={11} strokeWidth={2.5} /> : <Sun size={11} strokeWidth={2.5} />}
        </span>
      </span>

      {showLabel && (
        <span className="text-[11px] font-bold text-[var(--neu-text-secondary)]">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}
