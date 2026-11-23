import React from 'react';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-2.5 h-2.5 rounded-full neu-inset-sm flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--neu-accent)]" />
      </div>
      <h2 className="font-mono text-[11px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
        {children}
      </h2>
    </div>
  );
}
