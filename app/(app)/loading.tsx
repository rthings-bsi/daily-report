import React from "react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-[var(--neu-text-muted)]">
      <div className="w-14 h-14 rounded-2xl neu-card-sm flex items-center justify-center">
        <div className="w-7 h-7 border-[3px] border-[var(--neu-divider)] border-t-[var(--neu-accent)] rounded-full animate-spin" />
      </div>
      <p className="font-mono text-xs font-medium text-[var(--neu-text-muted)]">
        Memuat data modul...
      </p>
    </div>
  );
}
