'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, RotateCcw, CheckCircle, Plus, Pen, Trash2, X, Factory, History } from 'lucide-react';
import type { SapMovementType, MovementGroup } from '@/lib/sap-mapping';
import { MOVEMENT_TYPES, MVT_STORAGE_KEY, saveCustomMovementTypes, loadDisabledMvtCodes, saveDisabledMvtCodes, loadCustomWcNames, saveCustomWcNames, loadDisabledWcCodes, saveDisabledWcCodes } from '@/lib/sap-mapping';
import { PageHeader } from '@/components/PageHeader';
import { SettingsModal } from '@/components/SettingsModal';
import { loadSlocExitMap, saveSlocExitMap, getGudangPrefix, loadPenampunganSlocs, savePenampunganSlocs } from '@/lib/gudang';

const GUDANG_LIST = Array.from({ length: 14 }, (_, i) => `Gudang ${i + 1}`);

const DEFAULT_CAPACITIES: Record<string, number> = {
  'Gudang 1': 1095,
  'Gudang 2': 755,
  'Gudang 3': 580,
  'Gudang 4': 450,
  'Gudang 5': 450,
  'Gudang 6': 350,
  'Gudang 7': 350,
  'Gudang 8': 350,
  'Gudang 9': 350,
  'Gudang 10': 350,
  'Gudang 11': 860,
  'Gudang 12': 750,
  'Gudang 13': 354,
  'Gudang 14': 255,
};

const STORAGE_KEY = 'analytics_capacity';

const easeOut = [0.16, 1, 0.3, 1] as const;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [capacities, setCapacities] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const isAdmin = session?.user?.role === 'admin';
  const userGudangId = session?.user?.gudangId;


  const [activeModal, setActiveModal] = useState<'capacity' | 'mvt' | 'wc' | 'sloc_exit' | 'penampungan' | 'password' | null>(null);

  const [customMvts, setCustomMvts] = useState<Record<string, SapMovementType>>({});
  const [disabledCodes, setDisabledCodes] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formGroup, setFormGroup] = useState<MovementGroup>('Masuk');
  const [formColor, setFormColor] = useState('#22c55e');
  const [mvtSaved, setMvtSaved] = useState(false);

  const [wcNames, setWcNames] = useState<Record<string, string>>({});
  const [wcDisabled, setWcDisabled] = useState<Set<string>>(new Set());
  const [wcCodesFromData, setWcCodesFromData] = useState<string[]>([]);
  const [wcLoading, setWcLoading] = useState(false);
  const [showWcForm, setShowWcForm] = useState(false);
  const [wcFormCode, setWcFormCode] = useState('');
  const [wcFormName, setWcFormName] = useState('');
  const [editWcCode, setEditWcCode] = useState<string | null>(null);

  const [slocExitMap, setSlocExitMap] = useState<Record<number, string[]>>({});
  const [slocExitInput, setSlocExitInput] = useState('');
  const [slocExitGudang, setSlocExitGudang] = useState(13);

  const [penampunganSlocs, setPenampunganSlocs] = useState<string[]>([]);
  const [penampunganInput, setPenampunganInput] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};
    const initial: Record<string, string> = {};
    GUDANG_LIST.forEach(g => {
      initial[g] = String(parsed[g] ?? DEFAULT_CAPACITIES[g] ?? '');
    });
    setCapacities(initial);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(MVT_STORAGE_KEY);
    if (stored) {
      try {
        setCustomMvts(JSON.parse(stored));
      } catch { /* ignore */ }
    }
    setDisabledCodes(loadDisabledMvtCodes());
    setWcNames(loadCustomWcNames());
    setWcDisabled(loadDisabledWcCodes());
    setSlocExitMap(loadSlocExitMap());
  }, []);

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password minimal 6 karakter');
      return;
    }
    setSavingPassword(true);
    setPasswordError('');
    try {
      const res = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengubah password');
      }
      setNewPassword('');
      setActiveModal(null);
      
      // Trigger saved notification
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setPasswordError(e.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSave = () => {
    const toStore: Record<string, number> = {};
    GUDANG_LIST.forEach(g => {
      const v = parseFloat(capacities[g]);
      if (!isNaN(v) && v > 0) toStore[g] = v;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    const initial: Record<string, string> = {};
    GUDANG_LIST.forEach(g => {
      initial[g] = String(DEFAULT_CAPACITIES[g] ?? '');
    });
    setCapacities(initial);
    localStorage.removeItem(STORAGE_KEY);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddMvt = () => {
    if (!formCode.trim() || !formDesc.trim()) return;
    const updated = {
      ...customMvts,
      [formCode.trim()]: {
        code: formCode.trim(),
        description: formDesc.trim(),
        group: formGroup,
        color: formColor,
      },
    };
    saveCustomMovementTypes(updated);
    setCustomMvts(updated);
    resetForm();
    setMvtSaved(true);
    setTimeout(() => setMvtSaved(false), 2000);
  };

  const handleEditMvt = (code: string) => {
    const mvt = customMvts[code];
    if (!mvt) return;
    setFormCode(code);
    setFormDesc(mvt.description);
    setFormGroup(mvt.group);
    setFormColor(mvt.color);
    setEditCode(code);
    setShowForm(true);
  };

  const handleUpdateMvt = () => {
    if (!editCode || !formDesc.trim()) return;
    const updated = { ...customMvts };
    if (editCode !== formCode.trim()) {
      delete updated[editCode];
    }
    updated[formCode.trim()] = {
      code: formCode.trim(),
      description: formDesc.trim(),
      group: formGroup,
      color: formColor,
    };
    saveCustomMovementTypes(updated);
    setCustomMvts(updated);
    resetForm();
    setMvtSaved(true);
    setTimeout(() => setMvtSaved(false), 2000);
  };

  const handleDeleteMvt = (code: string) => {
    const updated = { ...customMvts };
    delete updated[code];
    saveCustomMovementTypes(updated);
    setCustomMvts(updated);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditCode(null);
    setFormCode('');
    setFormDesc('');
    setFormGroup('Masuk');
    setFormColor('#22c55e');
  };

  const handleToggleMvt = (code: string) => {
    const next = new Set(disabledCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setDisabledCodes(next);
    saveDisabledMvtCodes(next);
  };

  const handleAddWc = () => {
    if (!wcFormCode.trim() || !wcFormName.trim()) return;
    const updated = { ...wcNames, [wcFormCode.trim()]: wcFormName.trim() };
    saveCustomWcNames(updated);
    setWcNames(updated);
    resetWcForm();
  };

  const handleEditWc = (code: string) => {
    setWcFormCode(code);
    setWcFormName(wcNames[code] || code);
    setEditWcCode(code);
    setShowWcForm(true);
  };

  const handleUpdateWc = () => {
    if (!editWcCode || !wcFormName.trim()) return;
    const updated = { ...wcNames };
    if (editWcCode !== wcFormCode.trim()) {
      delete updated[editWcCode];
      const wcDisabledNext = new Set(wcDisabled);
      if (wcDisabledNext.has(editWcCode)) {
        wcDisabledNext.delete(editWcCode);
        wcDisabledNext.add(wcFormCode.trim());
      }
      setWcDisabled(wcDisabledNext);
      saveDisabledWcCodes(wcDisabledNext);
    }
    updated[wcFormCode.trim()] = wcFormName.trim();
    saveCustomWcNames(updated);
    setWcNames(updated);
    resetWcForm();
  };

  const handleDeleteWc = (code: string) => {
    const updated = { ...wcNames };
    delete updated[code];
    saveCustomWcNames(updated);
    setWcNames(updated);
    const wcDisabledNext = new Set(wcDisabled);
    wcDisabledNext.delete(code);
    setWcDisabled(wcDisabledNext);
    saveDisabledWcCodes(wcDisabledNext);
  };

  const handleToggleWc = (code: string) => {
    const next = new Set(wcDisabled);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setWcDisabled(next);
    saveDisabledWcCodes(next);
  };

  const resetWcForm = () => {
    setShowWcForm(false);
    setEditWcCode(null);
    setWcFormCode('');
    setWcFormName('');
  };

  const fetchWcFromData = async () => {
    setWcLoading(true);
    try {
      const listRes = await fetch('/api/reports');
      if (!listRes.ok) return;
      const list = await listRes.json();
      if (list.length === 0) return;
      const latestId = list[0].reportSessionId;
      const dataRes = await fetch(`/api/reports/${latestId}?detail=true`);
      if (!dataRes.ok) return;
      const data = await dataRes.json();
      const codes = new Set<string>();
      let hasEmpty = false;
      (data.movements || []).forEach((m: any) => {
        if (m.workCenter) {
          codes.add(m.workCenter);
        } else {
          hasEmpty = true;
        }
      });
      if (hasEmpty) codes.add('UNASSIGNED');
      setWcCodesFromData(Array.from(codes).sort());
    } catch {
      // silent
    } finally {
      setWcLoading(false);
    }
  };

  const allWcEntries = React.useMemo(() => {
    const map = new Map<string, string>();
    wcCodesFromData.forEach(code => {
      map.set(code, wcNames[code] || code);
    });
    Object.entries(wcNames).forEach(([code, name]) => {
      if (!map.has(code)) map.set(code, name);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [wcCodesFromData, wcNames]);

  const allMvts = { ...MOVEMENT_TYPES, ...customMvts };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <div className="min-h-screen bg-slate-50/50 selection:bg-blue-200">
      <PageHeader icon={SettingsIcon} title="Settings" subtitle="Konfigurasi sistem gudang">
        {saved && (
          <span className="h-8 hidden sm:inline-flex items-center gap-1.5 px-2.5 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-lg">
            <CheckCircle size={12} strokeWidth={2.5} /> Tersimpan
          </span>
        )}
        <button
          onClick={handleReset}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-slate-600 bg-white/80 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-all duration-200"
        >
          <RotateCcw size={13} /> Reset
        </button>
        <button
          onClick={handleSave}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-medium text-white bg-gradient-to-b from-blue-500 to-blue-600 rounded-lg hover:from-blue-400 hover:to-blue-500 shadow-sm shadow-blue-200 transition-all duration-200"
        >
          <Save size={13} /> Simpan
        </button>
      </PageHeader>

      <div className="max-w-[1700px] mx-auto px-5 py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: easeOut }}
            onClick={() => setActiveModal('capacity')}
            className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Kapasitas Gudang</h3>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Atur kapasitas tonase per gudang. Digunakan di halaman Analytics untuk analisis utilisasi.
            </p>
          </motion.div>

          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: easeOut, delay: 0.05 }}
              onClick={() => setActiveModal('mvt')}
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <History size={18} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Movement Type</h3>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Atur mapping kode movement SAP (101, 261, 311, dll). Tambah, edit, atau nonaktifkan MVT.
              </p>
            </motion.div>
          )}

          {isAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ease: easeOut, delay: 0.1 }}
              onClick={() => { setActiveModal('wc'); fetchWcFromData(); }}
              className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                <Factory size={18} className="text-white" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">Work Center</h3>
              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                Atur nama tampilan dan status work center. Nonaktifkan WC untuk menyembunyikan transaksinya.
              </p>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: easeOut, delay: 0.15 }}
            onClick={() => { setActiveModal('sloc_exit'); if (!isAdmin && userGudangId) setSlocExitGudang(userGudangId); }}
            className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">SLOC Exit</h3>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Atur kode SLOC Exit. TF dari gudang lain ke SLOC Exit akan dihitung sebagai TF Sloc In.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: easeOut, delay: 0.2 }}
            onClick={() => { setActiveModal('penampungan'); setPenampunganSlocs(loadPenampunganSlocs()); }}
            className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-purple-300 transition-all group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <Pen size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">SLOC Penampungan</h3>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Atur SLOC Penampungan. Stok di SLOC ini akan ditandai secara khusus di dashboard.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ease: easeOut, delay: 0.25 }}
            onClick={() => { setActiveModal('password'); setPasswordError(''); setNewPassword(''); }}
            className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 cursor-pointer hover:shadow-md hover:border-slate-400 transition-all group"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
              <SettingsIcon size={18} className="text-white" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Ganti Password</h3>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              Ubah password untuk akun Anda.
            </p>
          </motion.div>
        </div>

        {/* ─── Modal: Kapasitas Gudang ─── */}
        <SettingsModal
          open={activeModal === 'capacity'}
          onClose={() => setActiveModal(null)}
          title="Kapasitas Gudang"
          subtitle="Atur kapasitas tonase per gudang (ton)"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gudang</th>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kapasitas (T)</th>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Default (T)</th>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {GUDANG_LIST.filter(g => isAdmin || g === `Gudang ${userGudangId}`).map((g, i) => {
                  const val = parseFloat(capacities[g]);
                  const defaultVal = DEFAULT_CAPACITIES[g] ?? 0;
                  const isCustom = !isNaN(val) && val !== defaultVal;
                  return (
                    <tr key={g} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-6 py-3 font-semibold text-slate-800">{g}</td>
                      <td className="px-6 py-3 text-right">
                        <input
                          type="number"
                          value={capacities[g] ?? ''}
                          onChange={e => setCapacities(prev => ({ ...prev, [g]: e.target.value }))}
                          placeholder={String(defaultVal || '')}
                          className="w-28 text-right text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </td>
                      <td className="px-6 py-3 text-right text-slate-400 font-medium">{defaultVal}</td>
                      <td className="px-6 py-3 text-right">
                        {isCustom ? (
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">Custom</span>
                        ) : (
                          <span className="text-[10px] font-medium text-slate-400">Default</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <p className="text-[11px] text-slate-400 font-medium">
              Kapasitas akan digunakan di halaman <span className="font-semibold text-slate-500">Analytics</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Reset ke Default
              </button>
              <button
                onClick={handleSave}
                className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-4 py-1.5 hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Save size={12} /> Simpan Semua
              </button>
            </div>
          </div>
        </SettingsModal>

        {/* ─── Modal: Movement Type ─── */}
        <SettingsModal
          open={activeModal === 'mvt'}
          onClose={() => { setActiveModal(null); resetForm(); }}
          title="Movement Type Settings"
          subtitle="Atur mapping movement type SAP (digunakan saat parsing Excel)"
        >
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
            {mvtSaved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-semibold text-emerald-600 flex items-center gap-1"
              >
                <CheckCircle size={12} /> Tersimpan
              </motion.span>
            )}
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={12} /> Add MVT
            </button>
          </div>

          {showForm && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Code</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="e.g. 999"
                    className="w-20 text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Movement description"
                    className="w-48 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Group</label>
                  <select
                    value={formGroup}
                    onChange={e => setFormGroup(e.target.value as MovementGroup)}
                    className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  >
                    <option value="Masuk">Masuk</option>
                    <option value="Keluar">Keluar</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Color</label>
                  <input
                    type="color"
                    value={formColor}
                    onChange={e => setFormColor(e.target.value)}
                    className="w-10 h-8 border border-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={editCode ? handleUpdateMvt : handleAddMvt}
                    disabled={!formCode.trim() || !formDesc.trim()}
                    className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save size={12} /> {editCode ? 'Update' : 'Simpan'}
                  </button>
                  <button
                    onClick={resetForm}
                    className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                  >
                    <X size={12} /> Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Code</th>
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Group</th>
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Color</th>
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active</th>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allMvts).map(([code, mvt], i) => {
                  const isCustom = code in customMvts;
                  const isDefault = code in MOVEMENT_TYPES;
                  return (
                    <tr key={code} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-6 py-3 font-mono font-bold text-slate-800">{code}</td>
                      <td className="px-6 py-3 text-slate-700">{mvt.description}</td>
                      <td className="px-6 py-3">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          mvt.group === 'Masuk' ? 'bg-green-50 text-green-700' :
                          mvt.group === 'Keluar' ? 'bg-red-50 text-red-700' :
                          'bg-purple-50 text-purple-700'
                        }`}>
                          {mvt.group}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: mvt.color }} />
                          <span className="text-[11px] text-slate-400 font-mono">{mvt.color}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        {isDefault ? (
                          <span className="text-[10px] font-medium text-slate-400">Default</span>
                        ) : (
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">Custom</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleToggleMvt(code)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            disabledCodes.has(code) ? 'bg-slate-200' : 'bg-emerald-500'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                            disabledCodes.has(code) ? 'translate-x-0' : 'translate-x-4'
                          }`} />
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right">
                        {isCustom && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEditMvt(code)}
                              className="text-xs text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Pen size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteMvt(code)}
                              className="text-xs text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400 font-medium">
              Custom MVT akan digunakan saat parsing file Excel. Default MVT tidak bisa dihapus.
            </p>
          </div>
        </SettingsModal>

        {/* ─── Modal: Work Center ─── */}
        <SettingsModal
          open={activeModal === 'wc'}
          onClose={() => { setActiveModal(null); resetWcForm(); }}
          title="Work Center Settings"
          subtitle="Atur nama tampilan dan status work center"
        >
          <div className="flex items-center justify-end px-6 py-3 border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => { resetWcForm(); setShowWcForm(true); }}
              className="text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={12} /> Add Work Center
            </button>
          </div>

          {showWcForm && (
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Code</label>
                  <input
                    type="text"
                    value={wcFormCode}
                    onChange={e => setWcFormCode(e.target.value)}
                    placeholder="e.g. XHB12"
                    className="w-28 text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Display Name</label>
                  <input
                    type="text"
                    value={wcFormName}
                    onChange={e => setWcFormName(e.target.value)}
                    placeholder="Nama work center"
                    className="w-48 text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={editWcCode ? handleUpdateWc : handleAddWc}
                    disabled={!wcFormCode.trim() || !wcFormName.trim()}
                    className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save size={12} /> {editWcCode ? 'Update' : 'Simpan'}
                  </button>
                  <button
                    onClick={resetWcForm}
                    className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
                  >
                    <X size={12} /> Batal
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Code</th>
                  <th className="text-left px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Display Name</th>
                  <th className="text-center px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active</th>
                  <th className="text-right px-6 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {wcLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center">
                      <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : allWcEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                      Belum ada data work center. Upload laporan SAP terlebih dahulu.
                    </td>
                  </tr>
                ) : (
                  allWcEntries.map(([code, displayName], i) => (
                    <tr key={code} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-6 py-3 font-mono font-bold text-slate-800">{code}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{displayName}</span>
                          {wcNames[code] && wcNames[code] !== code && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">Custom</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleToggleWc(code)}
                          className={`w-9 h-5 rounded-full transition-colors relative ${
                            wcDisabled.has(code) ? 'bg-slate-200' : 'bg-emerald-500'
                          }`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                            wcDisabled.has(code) ? 'translate-x-0' : 'translate-x-4'
                          }`} />
                        </button>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditWc(code)}
                            className="text-xs text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Pen size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (wcNames[code]) {
                                handleDeleteWc(code);
                              }
                            }}
                            className={`text-xs p-1 rounded transition-colors ${
                              wcNames[code]
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                : 'text-slate-200 cursor-not-allowed'
                            }`}
                            title={wcNames[code] ? 'Delete' : 'Default (tidak bisa dihapus)'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400 font-medium">
              Work center yang dinonaktifkan tidak akan muncul di dashboard dan analytics. Nama tampilan digunakan di seluruh halaman.
            </p>
          </div>
        </SettingsModal>

        {/* ─── Modal: SLOC Exit ─── */}
        <SettingsModal
          open={activeModal === 'sloc_exit'}
          onClose={() => setActiveModal(null)}
          title="SLOC Exit Settings"
          subtitle="Atur SLOC Exit per gudang. TF dari gudang lain ke SLOC Exit akan dihitung sebagai TF Sloc In."
        >
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gudang</label>
                <select
                  value={slocExitGudang}
                  onChange={e => setSlocExitGudang(Number(e.target.value))}
                  className="text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
                >
                  {Array.from({ length: 14 }, (_, i) => i + 1).filter(n => isAdmin || n === userGudangId).map(n => (
                    <option key={n} value={n}>Gudang {n} ({getGudangPrefix(n)}xx)</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kode SLOC</label>
                <input
                  type="text"
                  value={slocExitInput}
                  onChange={e => setSlocExitInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 5M16"
                  className="w-full text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all uppercase"
                />
              </div>
              <button
                onClick={() => {
                  const code = slocExitInput.trim().toUpperCase();
                  if (!code) return;
                  const gudang = slocExitGudang;
                  if (!isAdmin) {
                    const prefix = getGudangPrefix(gudang);
                    if (!code.startsWith(prefix)) {
                      alert(`Kode SLOC harus diawali dengan ${prefix} untuk Gudang ${gudang}`);
                      return;
                    }
                  }
                  const current = slocExitMap[gudang] || [];
                  if (current.includes(code)) return;
                  const updated = { ...slocExitMap, [gudang]: [...current, code] };
                  setSlocExitMap(updated);
                  saveSlocExitMap(updated);
                  setSlocExitInput('');
                }}
                disabled={!slocExitInput.trim()}
                className="text-xs font-semibold text-white bg-amber-600 rounded-lg px-4 py-1.5 hover:bg-amber-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} /> Tambah
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {(() => {
              const gudangList = Object.keys(slocExitMap).map(Number).filter(g => isAdmin || g === userGudangId).sort((a, b) => a - b);
              if (gudangList.length === 0) {
                return (
                  <div className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                    Belum ada SLOC Exit. Pilih gudang dan tambahkan kode SLOC.
                  </div>
                );
              }
              return gudangList.map(gudang => {
                const codes = slocExitMap[gudang] || [];
                if (codes.length === 0) return null;
                return (
                  <div key={gudang} className="border-b border-slate-50 last:border-b-0">
                    <div className="px-6 py-2 bg-gradient-to-r from-amber-50 to-transparent flex items-center gap-2">
                      <div className="w-5 h-5 bg-amber-100 rounded-md flex items-center justify-center">
                        <span className="text-[9px] font-bold text-amber-700">G{gudang}</span>
                      </div>
                      <span className="text-[11px] font-bold text-slate-600">{getGudangPrefix(gudang)}xx</span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kode SLOC</th>
                          <th className="text-right px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codes.map((code, i) => (
                          <tr key={code} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <td className="px-6 py-2.5 font-mono font-bold text-slate-800">{code}</td>
                            <td className="px-6 py-2.5 text-right">
                              <button
                                onClick={() => {
                                  const current = slocExitMap[gudang] || [];
                                  const updatedCodes = current.filter(c => c !== code);
                                  const updated = { ...slocExitMap };
                                  if (updatedCodes.length === 0) {
                                    delete updated[gudang];
                                  } else {
                                    updated[gudang] = updatedCodes;
                                  }
                                  setSlocExitMap(updated);
                                  saveSlocExitMap(updated);
                                }}
                                className="text-xs text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                                title="Hapus"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              });
            })()}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-[11px] text-slate-400 font-medium">
              <strong className="text-slate-500">Cara kerja:</strong> Saat user dari gudang <em>lain</em> melakukan TF (MVT 311) ke SLOC Exit gudang ini, entry positif akan dihitung sebagai <strong className="text-emerald-600">TF Sloc In</strong> dan entry negatif (offset) otomatis disembunyikan.
            </p>
          </div>
        </SettingsModal>

        {/* ─── Modal: SLOC Penampungan ─── */}
        <SettingsModal
          open={activeModal === 'penampungan'}
          onClose={() => setActiveModal(null)}
          title="SLOC Penampungan"
          subtitle="Atur SLOC yang berfungsi sebagai tempat penampungan. Stok di SLOC ini akan ditandai khusus di dashboard."
        >
          <div className="px-6 py-4 border-b border-slate-100">
            <div className="flex items-end gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Kode SLOC</label>
                <input
                  type="text"
                  value={penampunganInput}
                  onChange={e => setPenampunganInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 5M17"
                  className="w-full text-sm font-semibold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all uppercase"
                />
              </div>
              <button
                onClick={() => {
                  const code = penampunganInput.trim().toUpperCase();
                  if (!code || penampunganSlocs.includes(code)) return;
                  if (!isAdmin && userGudangId) {
                    const prefix = getGudangPrefix(userGudangId);
                    if (!code.startsWith(prefix)) {
                      alert(`Hanya dapat menambah SLOC untuk Gudang Anda (harus diawali ${prefix})`);
                      return;
                    }
                  }
                  const updated = [...penampunganSlocs, code];
                  setPenampunganSlocs(updated);
                  savePenampunganSlocs(updated);
                  setPenampunganInput('');
                }}
                disabled={!penampunganInput.trim()}
                className="text-xs font-semibold text-white bg-purple-600 rounded-lg px-4 py-1.5 hover:bg-purple-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={12} /> Tambah
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {penampunganSlocs.filter(code => isAdmin || !userGudangId || code.startsWith(getGudangPrefix(userGudangId))).length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400 font-medium">
                Belum ada SLOC Penampungan. Tambahkan kode SLOC di atas.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kode SLOC</th>
                    <th className="text-right px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {penampunganSlocs
                  .filter(code => isAdmin || !userGudangId || code.startsWith(getGudangPrefix(userGudangId)))
                  .map((code, i) => (
                    <tr key={code} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="px-6 py-2.5 font-mono font-bold text-slate-800">{code}</td>
                      <td className="px-6 py-2.5 text-right">
                        <button
                          onClick={() => {
                            const updated = penampunganSlocs.filter(c => c !== code);
                            setPenampunganSlocs(updated);
                            savePenampunganSlocs(updated);
                          }}
                          className="text-xs font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SettingsModal>
      
        {/* ─── Modal: Ganti Password ─── */}
        <SettingsModal
          open={activeModal === 'password'}
          onClose={() => setActiveModal(null)}
          title="Ganti Password"
          subtitle="Ubah password akun Anda."
        >
          <div className="p-6 bg-slate-50/50">
            {passwordError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm font-medium border border-red-100">
                {passwordError}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Minimal 6 karakter"
              />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end">
            <button
              onClick={handleSavePassword}
              disabled={savingPassword}
              className="text-xs font-semibold text-white bg-blue-600 rounded-lg px-4 py-2 hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {savingPassword ? 'Menyimpan...' : <><Save size={12} /> Simpan Password</>}
            </button>
          </div>
        </SettingsModal>

      </div>
    </div>
  );
}