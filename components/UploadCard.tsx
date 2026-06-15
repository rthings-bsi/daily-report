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
    idle:     { ring: 'ring-sky-400/60',   glow: 'from-sky-400/40',     btn: 'from-sky-500 to-sky-600',      icon: 'text-white' },
    loading:  { ring: 'ring-sky-400/60',   glow: 'from-sky-400/40',     btn: 'from-sky-500 to-sky-600',      icon: 'text-white' },
    success:  { ring: 'ring-emerald-400/60', glow: 'from-emerald-400/40', btn: 'from-emerald-500 to-emerald-600', icon: 'text-white' },
    error:    { ring: 'ring-rose-400/60',  glow: 'from-rose-400/40',    btn: 'from-rose-500 to-rose-600',    icon: 'text-white' },
  }[state];

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-300 ${
        isDragging
          ? 'border-sky-400 bg-sky-50/50 scale-[1.01]'
          : 'border-slate-200 bg-white/40 hover:border-sky-300 hover:bg-sky-50/30'
      }`}
    >
      <div className="flex flex-col items-center justify-center py-14 px-6">
        {/* ── Floating action button ── */}
        <div className="relative group">
          {/* soft glow */}
          <div
            className={`absolute inset-0 -m-3 rounded-full bg-gradient-to-br ${palette.glow} to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500`}
            aria-hidden
          />
          <button
            type="button"
            onClick={onClick}
            disabled={state === 'loading'}
            className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${palette.btn} shadow-xl shadow-sky-500/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center ring-4 ${palette.ring} disabled:cursor-wait`}
            aria-label={state === 'success' ? 'Ganti file' : 'Pilih file SAP Excel'}
          >
            {state === 'loading' ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              >
                <Upload size={28} className={palette.icon} strokeWidth={2.5} />
              </motion.div>
            ) : state === 'success' ? (
              <CheckCircle2 size={28} className={palette.icon} strokeWidth={2.5} />
            ) : state === 'error' ? (
              <AlertCircle size={28} className={palette.icon} strokeWidth={2.5} />
            ) : (
              <Upload size={28} className={palette.icon} strokeWidth={2.5} />
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
        <div className="mt-5 text-center">
          <p className="text-[13px] font-semibold text-slate-700">
            {state === 'loading'  && 'Memproses data…'}
            {state === 'success'  && 'Data berhasil dimuat'}
            {state === 'error'    && 'Upload gagal'}
            {state === 'idle'     && (isDragging ? 'Lepaskan file di sini' : 'Upload file SAP Excel')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {state === 'success' && fileName ? (
              <span className="inline-flex items-center gap-1.5">
                <FileSpreadsheet size={11} className="text-slate-400" />
                <span className="font-mono">{fileName}</span>
              </span>
            ) : state === 'idle' ? (
              'Drag & drop atau klik tombol di atas • .xlsx, .xls, .csv'
            ) : state === 'error' ? (
              error
            ) : (
              'Mohon tunggu sebentar'
            )}
          </p>
        </div>

        {/* ── Action chips (only when state is success or error) ── */}
        <AnimatePresence>
          {(state === 'success' || state === 'error') && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex items-center gap-2"
            >
              {state === 'success' && (
                <button
                  onClick={onClick}
                  className="inline-flex items-center gap-1 px-3 h-7 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <Upload size={11} />
                  Ganti file
                </button>
              )}
              {state === 'error' && (
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-1 px-3 h-7 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <X size={11} />
                  Reset
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
