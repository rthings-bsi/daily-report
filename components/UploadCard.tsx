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

  const handleFile = useCallback(async (file: File) => {
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
  }, [onDataLoaded]);

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
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onClick = () => {
    if (state === 'loading') return;
    if (state === 'success') {
      reset();
      setTimeout(() => inputRef.current?.click(), 0);
      return;
    }
    inputRef.current?.click();
  };

  const iconColor = {
    idle: 'text-[var(--neu-accent)]',
    loading: 'text-[var(--neu-accent)]',
    success: 'text-[var(--neu-green)]',
    error: 'text-[var(--neu-red)]',
  }[state];

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative w-full rounded-[1.5rem] transition-neu overflow-hidden ${
        isDragging ? 'neu-inset border border-[var(--neu-accent-border)]' : 'neu-card'
      }`}
    >
      <div className="relative flex flex-col items-center justify-center py-16 px-6">
        <button
          type="button"
          onClick={onClick}
          disabled={state === 'loading'}
          className={`w-20 h-20 rounded-3xl neu-icon-inset flex items-center justify-center transition-neu cursor-pointer disabled:cursor-wait hover:scale-105 ${iconColor}`}
          aria-label={state === 'success' ? 'Ganti file' : 'Pilih file SAP Excel'}
        >
          {state === 'loading' ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            >
              <Upload size={28} strokeWidth={2.2} />
            </motion.div>
          ) : state === 'success' ? (
            <CheckCircle2 size={28} strokeWidth={2.2} />
          ) : state === 'error' ? (
            <AlertCircle size={28} strokeWidth={2.2} />
          ) : (
            <Upload size={28} strokeWidth={2.2} />
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={onFileChange}
          accept=".xlsx,.xls,.csv"
        />

        <div className="mt-6 text-center max-w-md">
          <p className="text-[16px] font-extrabold text-[var(--neu-text)] mb-1.5">
            {state === 'loading' && 'Memproses data warehouse...'}
            {state === 'success' && 'Data berhasil disinkronisasi'}
            {state === 'error' && 'Gagal memproses file'}
            {state === 'idle' && (isDragging ? 'Lepaskan file Excel di sini' : 'Unggah File SAP Excel')}
          </p>
          <p className="text-[12.5px] text-[var(--neu-text-muted)]">
            {state === 'success' && fileName ? (
              <span className="inline-flex items-center gap-1.5 neu-inset-sm px-3.5 py-1.5 rounded-full text-[var(--neu-green)] mt-1">
                <FileSpreadsheet size={13} />
                <span className="font-mono text-xs font-semibold">{fileName}</span>
              </span>
            ) : state === 'idle' ? (
              'Seret dan lepaskan file (.xlsx, .xls, .csv) ke area ini, atau pilih file dari perangkat Anda.'
            ) : state === 'error' ? (
              <span className="text-[var(--neu-red)] font-semibold">{error}</span>
            ) : (
              'Sedang mengurai baris material movement...'
            )}
          </p>
        </div>

        {state === 'idle' && (
          <button
            type="button"
            onClick={onClick}
            className="mt-6 px-5 h-10 neu-btn-primary text-[13px] font-bold rounded-xl cursor-pointer"
          >
            Pilih File SAP
          </button>
        )}

        <AnimatePresence>
          {(state === 'success' || state === 'error') && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-5 flex items-center gap-2.5"
            >
              {state === 'success' && (
                <button
                  type="button"
                  onClick={onClick}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-xs font-bold text-[var(--neu-accent)] neu-btn rounded-xl cursor-pointer"
                >
                  <Upload size={13} strokeWidth={2.2} />
                  Ganti File
                </button>
              )}
              {state === 'error' && (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-xs font-bold text-[var(--neu-red)] neu-btn rounded-xl cursor-pointer"
                >
                  <X size={13} strokeWidth={2.4} />
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
