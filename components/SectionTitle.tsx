import React from 'react';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-0.5 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-indigo-300" />
      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{children}</h2>
    </div>
  );
}
