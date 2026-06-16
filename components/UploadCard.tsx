'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { parseSapExcel, ExcelParseResult } from '@/lib/excel-parser';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadCardProps {
  onDataLoaded: (data: ExcelParseResult) => void;
}

type UploadState = 'idle' | 'loading' | 'success' | 'error';

export const UploadCard: React.FC<UploadCardProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<UploadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState('idle');
    setError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Hanya file Excel (.xlsx, .xls) atau CSV yang diperbolehkan');
      setState('error');
      return;
    }

    setState('loading');
    setError(null);
    setFileName(file.name);

    try {
      const data = await parseSapExcel(file);
      if (data.movements.length === 0 && (!data.stockCards || data.stockCards.length === 0)) {
        setError('Data kosong atau format file tidak dikenali.');
        setState('error');
        setFileName(null);
        return;
      }
      setState('success');
      onDataLoaded(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal memproses file. Pastikan format file sesuai dengan export SAP.');
      setState('error');
      setFileName(null);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (state !== 'loading') setIsDragging(true);
  }, [state]);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onClick = () => {
    if (state === 'loading') return;
    if (state === 'success') {
      reset();
      // give React a tick to clear the input value before re-opening
      setTimeout(() => inputRef.current?.click(), 0);
      return;
    }
    inputRef.current?.click();
  };

  // ── Color tokens per state ──
  const palette = {
    idle:     { ring: 'ring-[#4BB8FA]/40', glow: 'from-[#1591DC]/30', btn: 'from-[#1591DC] to-[#2C5EAD]', icon: 'text-white' },
    loading:  { ring: 'ring-[#4BB8FA]/40', glow: 'from-[#1591DC]/30', btn: 'from-[#1591DC] to-[#2C5EAD]', icon: 'text-white' },
    success:  { ring: 'ring-emerald-400/60', glow: 'from-emerald-400/40', btn: 'from-emerald-500 to-emerald-600', icon: 'text-white' },
    error:    { ring: 'ring-rose-400/60',  glow: 'from-rose-400/40',    btn: 'from-rose-500 to-rose-600',    icon: 'text-white' },
  }[state];

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative w-full rounded-[2rem] border-2 border-dashed transition-all duration-500 overflow-hidden ${
        isDragging
          ? 'border-[#4BB8FA] bg-[#C4E2F5]/20 scale-[1.01] shadow-2xl shadow-[#1591DC]/10'
          : 'border-[#C4E2F5]/60 bg-white/60 hover:border-[#1591DC]/50 hover:bg-[#C4E2F5]/10 hover:shadow-xl hover:shadow-[#1591DC]/5'
      }`}
    >
      {/* Decorative Background Blob */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-[#1591DC]/10 to-[#C4E2F5]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-gradient-to-tr from-[#2C5EAD]/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center py-20 px-6">
        {/* ── Floating action button ── */}
        <div className="relative group">
          {/* soft glow */}
          <div
            className={`absolute inset-0 -m-4 rounded-full bg-gradient-to-br ${palette.glow} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500`}
            aria-hidden
          />
          <button
            type="button"
            onClick={onClick}
            disabled={state === 'loading'}
            className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${palette.btn} shadow-xl shadow-black/5 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center ring-4 ${palette.ring} disabled:cursor-wait`}
            aria-label={state === 'success' ? 'Ganti file' : 'Pilih file SAP Excel'}
          >
            {state === 'loading' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Upload size={32} className={palette.icon} strokeWidth={2.5} />
              </motion.div>
            ) : state === 'success' ? (
              <CheckCircle2 size={32} className={palette.icon} strokeWidth={2.5} />
            ) : state === 'error' ? (
              <AlertCircle size={32} className={palette.icon} strokeWidth={2.5} />
            ) : (
              <Upload size={32} className={palette.icon} strokeWidth={2.5} />
            )}
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={onFileChange}
          accept=".xlsx,.xls,.csv"
        />

        {/* ── Caption ── */}
        <div className="mt-8 text-center">
          <p className="text-base font-bold text-[#2C5EAD] mb-1.5">
            {state === 'loading'  && 'Memproses data warehouse…'}
            {state === 'success'  && 'Data berhasil disinkronisasi'}
            {state === 'error'    && 'Gagal memproses file'}
            {state === 'idle'     && (isDragging ? 'Lepaskan file Excel di sini' : 'Pilih File SAP Excel')}
          </p>
          <p className="text-xs font-medium text-[#1591DC]/70">
            {state === 'success' && fileName ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full text-emerald-700">
                <FileSpreadsheet size={13} className="text-emerald-500" />
                <span className="font-mono tracking-tight">{fileName}</span>
              </span>
            ) : state === 'idle' ? (
              'Seret dan lepaskan file ke area ini, atau klik tombol di atas.'
            ) : state === 'error' ? (
              <span className="text-rose-500">{error}</span>
            ) : (
              'Sedang mengurai baris material movement...'
            )}
          </p>
        </div>

        {/* ── Action chips (only when state is success or error) ── */}
        <AnimatePresence>
          {(state === 'success' || state === 'error') && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              className="mt-6 flex items-center gap-3"
            >
              {state === 'success' && (
                <button
                  onClick={onClick}
                  className="inline-flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-[#1591DC] bg-white border border-[#C4E2F5]/60 rounded-xl hover:bg-[#C4E2F5]/20 hover:border-[#1591DC]/40 shadow-sm shadow-[#1591DC]/5 transition-all"
                >
                  <Upload size={13} strokeWidth={2.5} />
                  Ganti File
                </button>
              )}
              {state === 'error' && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 px-4 h-8 text-[11px] font-bold text-rose-600 bg-white border border-rose-200 rounded-xl hover:bg-rose-50 hover:border-rose-300 shadow-sm shadow-rose-500/5 transition-all"
                >
                  <X size={13} strokeWidth={2.5} />
                  Coba Lagi
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
