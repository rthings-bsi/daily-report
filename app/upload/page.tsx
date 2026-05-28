'use client';

import { useState, useEffect } from 'react';
import { UploadCard } from '@/components/UploadCard';
import { SapAutoImport } from '@/components/SapAutoImport';
import { SapGuiImport } from '@/components/SapGuiImport';
import { PageHeader } from '@/components/PageHeader';
import { FileUp, Database, Monitor, Printer, Check, LogOut, ArrowUpFromLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { ProcessedMovement, ProcessedStock } from '@/lib/excel-parser';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type Tab = 'manual' | 'auto' | 'gui';

export default function UploadPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('manual');

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
        const { id } = await res.json();
        setActiveSessionId(id);
        setSaved(true);
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
      router.push(`/?session=${activeSessionId}`);
    }
  }, [activeSessionId, router]);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <PageHeader icon={FileUp} title="Upload Data" subtitle="Import file Excel dari SAP" className="print:hidden">
        <AnimatePresence>
          {(saving || saved) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
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
        </AnimatePresence>

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
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm w-fit">
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              activeTab === 'manual'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            )}
          >
            <ArrowUpFromLine size={15} />
            Upload Manual
          </button>
          <button
            onClick={() => setActiveTab('auto')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              activeTab === 'auto'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-sky-700 hover:bg-sky-50'
            )}
          >
            <Database size={15} />
            Auto Browser
          </button>
          <button
            onClick={() => setActiveTab('gui')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              activeTab === 'gui'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
            )}
          >
            <Monitor size={15} />
            GUI Scripting
          </button>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'manual' && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <UploadCard
                onDataLoaded={async (data) => {
                  await saveToDb(data.movements, data.stocks, 'uploaded-file', data.stockCards);
                }}
              />
            </motion.div>
          )}

          {activeTab === 'auto' && (
            <motion.div
              key="auto"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <SapAutoImport />
            </motion.div>
          )}

          {activeTab === 'gui' && (
            <motion.div
              key="gui"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <SapGuiImport />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
