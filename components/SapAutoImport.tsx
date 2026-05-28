'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Globe,
  User,
  KeyRound,
  FileCode,
  Building2,
  Calendar,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DebugLog {
  text: string;
  time: string;
}

export const SapAutoImport: React.FC = () => {
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [transactionCode, setTransactionCode] = useState('');
  const [plant, setPlant] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savedSessions, setSavedSessions] = useState<{ url: string; username: string; transactionCode: string }[]>([]);

  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [progressStage, setProgressStage] = useState('');
  const [progressMessage, setProgressMessage] = useState('');
  const [resultData, setResultData] = useState<{
    sessionId?: string;
    movementsCount?: number;
    stocksCount?: number;
    stockCardsCount?: number;
  } | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (text: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLogs(prev => [...prev, { text, time }]);
  };

  const handleStart = async () => {
    if (!url || !username || !password) return;

    setStatus('running');
    setStatusMessage('Memulai proses auto-import dari SAP...');
    setProgressStage('browser');
    setProgressMessage('Meluncurkan browser...');
    setResultData(null);
    setDebugLogs([]);
    addLog('Memulai auto-import SAP...');
    addLog(`URL: ${url}`);
    addLog(`User: ${username}`);
    addLog(`Transaksi: ${transactionCode || '(tidak ada)'}`);

    try {
      const res = await fetch('/api/sap/auto-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          username,
          password,
          transactionCode,
          plant: plant || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
      });

      const result = await res.json();

      if (result.debugLogs && Array.isArray(result.debugLogs)) {
        result.debugLogs.forEach((log: string) => addLog(log));
      }

      if (result.success && result.sessionId) {
        setStatus('success');
        setProgressStage('complete');
        setProgressMessage('Data berhasil di-import');
        setStatusMessage(result.message || 'Data berhasil di-import dari SAP!');
        setResultData({
          sessionId: result.sessionId,
          movementsCount: result.movementsCount,
          stocksCount: result.stocksCount,
          stockCardsCount: result.stockCardsCount,
        });
        addLog(`SUCCESS: Session ID = ${result.sessionId}`);

        // Save to localStorage for quick reuse
        saveSession(url, username, transactionCode);
      } else {
        setStatus('error');
        setProgressStage('error');
        setProgressMessage('Import gagal');
        setStatusMessage(result.message || result.error || 'Gagal meng-import data dari SAP');
        addLog(`ERROR: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setStatus('error');
      setProgressStage('error');
      setProgressMessage('Koneksi error');
      setStatusMessage(err.message || 'Gagal terhubung ke server');
      addLog(`FETCH ERROR: ${err.message}`);
    }
  };

  const saveSession = (sapUrl: string, user: string, tcode: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem('sap_saved_sessions') || '[]');
      // Remove duplicate if exists
      const filtered = stored.filter((s: any) => !(s.url === sapUrl && s.username === user));
      const updated = [{ url: sapUrl, username: user, transactionCode: tcode, lastUsed: new Date().toISOString() }, ...filtered].slice(0, 5);
      localStorage.setItem('sap_saved_sessions', JSON.stringify(updated));
      setSavedSessions(updated);
    } catch {}
  };

  const loadSavedSessions = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('sap_saved_sessions') || '[]');
      setSavedSessions(stored);
    } catch {}
  };

  React.useEffect(() => {
    loadSavedSessions();
  }, []);

  const applySession = (s: { url: string; username: string; transactionCode: string }) => {
    setUrl(s.url);
    setUsername(s.username);
    setTransactionCode(s.transactionCode || '');
  };

  const deleteSession = (index: number) => {
    const updated = savedSessions.filter((_, i) => i !== index);
    setSavedSessions(updated);
    localStorage.setItem('sap_saved_sessions', JSON.stringify(updated));
  };

  const progressStages = [
    { key: 'browser', label: 'Browser' },
    { key: 'navigate', label: 'Buka URL' },
    { key: 'login', label: 'Login SAP' },
    { key: 'transaction', label: 'Transaksi' },
    { key: 'parameters', label: 'Parameter' },
    { key: 'export', label: 'Export Excel' },
    { key: 'manual', label: 'Manual' },
    { key: 'complete', label: 'Selesai' },
    { key: 'error', label: 'Error' },
  ];

  const currentStageIndex = progressStages.findIndex(s => s.key === progressStage);

  const resetForm = () => {
    setStatus('idle');
    setStatusMessage('');
    setProgressStage('');
    setProgressMessage('');
    setResultData(null);
    setDebugLogs([]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-sky-50 to-indigo-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sm">
            <Database size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Auto Import SAP</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Download data otomatis dari SAP via browser
            </p>
          </div>
        </div>
      </div>

      {/* Saved Sessions */}
      {savedSessions.length > 0 && status === 'idle' && (
        <div className="px-6 pt-4 pb-2">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Sesi Tersimpan</p>
          <div className="flex flex-wrap gap-2">
            {savedSessions.map((s, i) => (
              <button
                key={i}
                onClick={() => applySession(s)}
                className="group relative flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 rounded-lg text-[11px] text-slate-600 hover:text-sky-700 transition-all"
              >
                <Globe size={11} />
                <span className="max-w-[120px] truncate">{s.username}@{s.transactionCode || 'N/A'}</span>
                <span
                  onClick={(e) => { e.stopPropagation(); deleteSession(i); }}
                  className="ml-1 text-slate-300 hover:text-red-500 transition-colors"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <AnimatePresence mode="wait">
        {status === 'idle' || status === 'error' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            {/* URL */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                <Globe size={12} />
                URL SAP Web
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://sap-server.company.com:8000/sap/bc/gui/sap/its/webgui"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
              />
            </div>

            {/* Username & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <User size={12} />
                  Username SAP
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="GUDANG13C"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <KeyRound size={12} />
                  Password SAP
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <FileCode size={12} />
                  Transaction Code
                </label>
                <input
                  type="text"
                  value={transactionCode}
                  onChange={e => setTransactionCode(e.target.value)}
                  placeholder="ZMMR001, MB5B, ..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                  <Building2 size={12} />
                  Plant (opsional)
                </label>
                <input
                  type="text"
                  value={plant}
                  onChange={e => setPlant(e.target.value)}
                  placeholder="SPINDO"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                    <Calendar size={12} />
                    Dari
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 mb-1.5">
                    <Calendar size={12} />
                    Sampai
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-400 bg-white/50"
                  />
                </div>
              </div>
            </div>

            {/* Error message */}
            {status === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div className="text-xs text-red-700 leading-relaxed">{statusMessage}</div>
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-sm font-medium rounded-xl shadow-lg shadow-sky-500/30 hover:shadow-sky-600/40 active:scale-[0.97] transition-all"
              >
                <Play size={15} />
                Mulai Auto Import
              </button>
              {status === 'error' && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
                >
                  Reset
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Browser Chrome akan terbuka secara otomatis. Jangan menutup browser selama proses berjalan.
              Password hanya digunakan untuk sesi ini dan tidak disimpan.
            </p>
          </motion.div>
        ) : null}

        {/* Running State */}
        {status === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-5"
          >
            {/* Progress stages */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {progressStages.map((stage, i) => {
                const isActive = stage.key === progressStage;
                const isDone = currentStageIndex > i;
                return (
                  <div key={stage.key} className="flex items-center gap-1 shrink-0">
                    <div className={cn(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all',
                      isActive ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-300' :
                      isDone ? 'bg-emerald-50 text-emerald-600' :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {isDone ? <CheckCircle2 size={10} /> : isActive ? <Loader2 size={10} className="animate-spin" /> : null}
                      {stage.label}
                    </div>
                    {i < progressStages.length - 1 && (
                      <ChevronDown size={10} className="text-slate-300 rotate-[-90deg]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current progress message */}
            <div className="flex items-center gap-3 p-4 bg-sky-50 border border-sky-100 rounded-xl">
              <Loader2 size={20} className="text-sky-600 animate-spin shrink-0" />
              <div>
                <p className="text-sm font-medium text-sky-800">{progressMessage}</p>
                <p className="text-xs text-sky-600/70 mt-0.5">Jangan tutup browser SAP yang terbuka</p>
              </div>
            </div>

            {/* Debug logs */}
            <div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Terminal size={12} />
                {showDebug ? 'Sembunyikan' : 'Lihat'} log detail
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {showDebug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <div className="bg-slate-900 text-green-400 rounded-lg p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
                      {debugLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span>{log.text}</span>
                        </div>
                      ))}
                      {debugLogs.length === 0 && (
                        <span className="text-slate-500 italic">Menunggu log...</span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Success State */}
        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 space-y-4"
          >
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 size={24} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-emerald-800">Import Berhasil!</h4>
                <p className="text-sm text-emerald-700 mt-1">{statusMessage}</p>
              </div>
            </div>

            {resultData && (
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-sky-50 border border-sky-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-sky-700">{resultData.movementsCount ?? 0}</p>
                  <p className="text-[11px] text-sky-600">Movements</p>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-indigo-700">{resultData.stocksCount ?? 0}</p>
                  <p className="text-[11px] text-indigo-600">Stocks</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-100 rounded-lg text-center">
                  <p className="text-2xl font-bold text-purple-700">{resultData.stockCardsCount ?? 0}</p>
                  <p className="text-[11px] text-purple-600">Stock Cards</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (resultData?.sessionId) {
                    window.location.href = `/?session=${resultData.sessionId}`;
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white text-sm font-medium rounded-xl hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/30 active:scale-[0.97] transition-all"
              >
                <CheckCircle2 size={15} />
                Lihat Report
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                Import Lagi
              </button>
            </div>

            {/* Debug logs */}
            <div>
              <button
                onClick={() => setShowDebug(!showDebug)}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Terminal size={12} />
                {showDebug ? 'Sembunyikan' : 'Lihat'} log detail
                {showDebug ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              <AnimatePresence>
                {showDebug && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2"
                  >
                    <div className="bg-slate-900 text-green-400 rounded-lg p-3 font-mono text-[11px] max-h-40 overflow-y-auto space-y-1">
                      {debugLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span>{log.text}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
