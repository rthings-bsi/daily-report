'use client';

import { useState, useEffect } from 'react';
import { UploadCard } from '@/components/UploadCard';
import { ArchiveTable } from '@/components/ArchiveTable';
import { PageHeader } from '@/components/PageHeader';
import { FileUp, Printer, Check, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ProcessedMovement, ProcessedStock } from '@/lib/excel-parser';
import { motion } from 'framer-motion';

export default function UploadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // bumps after every successful save so ArchiveTable re-fetches
  const [archiveKey, setArchiveKey] = useState(0);

  const saveToDb = async (movs: ProcessedMovement[], stks: ProcessedStock[], fileName: string, stockCards?: any[]) => {
    setSaving(true);
    try {
      const dateCounts: Record<string, number> = {};
      movs.forEach(m => { dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1; });
      const sortedDates = Object.entries(dateCounts).sort((a, b) => b[1] - a[1]);

      let dateStr = '';
      if (sortedDates.length > 0) {
        dateStr = sortedDates[0][0];
      } else {
        const now = new Date();
        dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      }

      const sampleMov = movs.find(m => m.dateStr === dateStr) || movs[0];
      let label = dateStr;
      if (sampleMov?.dateStr) {
        const parts = sampleMov.dateStr.split('-');
        if (parts.length === 3) {
          const y = parts[0];
          const m = parseInt(parts[1]);
          const d = parts[2];
          const monthsNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          label = `${d.padStart(2, '0')} ${monthsNames[m - 1]} ${y}`;
        }
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label,
          dateStr,
          fileName,
          movements: movs.map(m => ({
            ...m,
            postingDate: m.dateStr,
          })),
          stocks: stks,
          stockCards: stockCards || undefined,
        }),
      });

      if (res.ok) {
        const { reportSessionId } = await res.json();
        setActiveSessionId(reportSessionId);
        setSaved(true);
        setArchiveKey((k) => k + 1);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (activeSessionId) {
      router.push(`/?reportSessionId=${activeSessionId}`);
    }
  }, [activeSessionId, router]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <PageHeader icon={FileUp} title="Upload Data" subtitle="Import file Excel dari SAP" className="print:hidden">
        {(saving || saved) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-semibold ${
              saving ? 'text-sky-600 bg-sky-50' : 'text-emerald-600 bg-emerald-50'
            }`}
          >
            {saving ? (
              <div className="w-3 h-3 border-[2px] border-sky-200 border-t-sky-600 rounded-full animate-spin" />
            ) : (
              <Check size={12} strokeWidth={2.5} />
            )}
            {saving ? 'Menyimpan...' : 'Tersimpan'}
          </motion.div>
        )}

        <button
          onClick={() => window.print()}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all duration-200"
          aria-label="Cetak"
        >
          <Printer size={13} />
          <span className="hidden sm:inline">Cetak</span>
        </button>

        <div className="w-px h-5 bg-slate-200/60" />

        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all duration-200"
          aria-label="Keluar"
        >
          <LogOut size={13} />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </PageHeader>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-5">
        <UploadCard
          onDataLoaded={async (data) => {
            await saveToDb(data.movements, data.stocks, 'uploaded-file', data.stockCards);
          }}
        />
        <ArchiveTable refreshKey={archiveKey} />
      </div>
    </div>
  );
}
