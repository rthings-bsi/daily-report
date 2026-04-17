'use client';

import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseSapExcel, ProcessedMovement } from '@/lib/excel-parser';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadCardProps {
  onDataLoaded: (data: ProcessedMovement[]) => void;
}

export const UploadCard: React.FC<UploadCardProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Hanya file Excel (.xlsx, .xls) atau CSV yang diperbolehkan');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await parseSapExcel(file);
      if (data.movements.length === 0) {
        setError('Data kosong atau tidak ada movement SAP yang valid dalam file ini.');
        setFileName(null);
        return;
      }
      onDataLoaded(data.movements);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal memproses file. Pastikan format file sesuai dengan export SAP.');
      setFileName(null);
    } finally {
      setIsLoading(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass rounded-3xl p-8 transition-all duration-300 ${isDragging ? 'ring-4 ring-blue-500/50 scale-[1.02]' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <div className={`p-6 rounded-2xl mb-4 transition-colors ${error ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
          {isLoading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Upload size={48} />
            </motion.div>
          ) : error ? (
            <AlertCircle size={48} />
          ) : fileName ? (
            <CheckCircle2 size={48} className="text-green-500" />
          ) : (
            <FileSpreadsheet size={48} />
          )}
        </div>

        <h3 className="text-2xl font-bold mb-2">
          {isLoading ? 'Memproses Data...' : fileName ? 'Data Berhasil Dimuat' : 'Upload Data SAP'}
        </h3>
        
        <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          {fileName 
            ? `File: ${fileName}` 
            : 'Tarik dan lepas file Excel SAP Anda di sini, atau klik untuk memilih file.'}
        </p>

        {!isLoading && (
          <label className="relative group overflow-hidden">
            <input
              type="file"
              className="hidden"
              onChange={onFileChange}
              accept=".xlsx,.xls,.csv"
            />
            <span className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/30 active:scale-95 cursor-pointer inline-block">
              {fileName ? 'Ganti File' : 'Pilih File'}
            </span>
          </label>
        )}

        <AnimatePresence>
          {error && (
            <motion.p 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 text-red-500 text-sm font-medium"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
