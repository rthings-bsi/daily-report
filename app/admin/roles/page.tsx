'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Shield, Users, CheckCircle2, AlertCircle,
  Plus, Edit3, Trash2, X, Lock, Check,
  Search, Sliders, Globe, Building2,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { GUDANG_LIST } from '@/lib/gudang';
import { APP_MODULES, RoleConfigItem } from '@/lib/roles';

interface UserRow {
  userId: string;
  username: string;
  role: string;
  gudangId: number | null;
  createdAt: string;
  updatedAt: string;
}

const COLOR_OPTIONS = [
  { id: 'bg-rose-500', label: 'Rose', text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  { id: 'bg-sky-500', label: 'Sky', text: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200' },
  { id: 'bg-indigo-500', label: 'Indigo', text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  { id: 'bg-violet-500', label: 'Violet', text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
  { id: 'bg-emerald-500', label: 'Emerald', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'bg-amber-500', label: 'Amber', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'bg-slate-600', label: 'Slate', text: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-300' },
];

export default function AdminRolesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [roles, setRoles] = useState<RoleConfigItem[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleConfigItem | null>(null);
  const [userAssignmentModal, setUserAssignmentModal] = useState<{
    user: UserRow;
    selectedRole: string;
    selectedGudang: number | null;
  } | null>(null);

  const [savingAction, setSavingAction] = useState(false);

  // Auth gate
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/users'),
      ]);

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      loadData();
    }
  }, [status, session, loadData]);

  const showBanner = (kind: 'ok' | 'err', msg: string) => {
    setBanner({ kind, msg });
    setTimeout(() => setBanner(null), 3500);
  };

  // Toggle module permission directly in matrix table
  const handleToggleMatrixPermission = async (role: RoleConfigItem, moduleId: string) => {
    if (role.roleId === 'admin') {
      showBanner('err', 'Izin role Administrator tidak dapat dikurangi');
      return;
    }

    const hasPerm = role.permissions.includes(moduleId);
    const newPerms = hasPerm
      ? role.permissions.filter((p) => p !== moduleId)
      : [...role.permissions, moduleId];

    // Optimistic update
    setRoles((prev) =>
      prev.map((r) => (r.roleId === role.roleId ? { ...r, permissions: newPerms } : r))
    );

    try {
      const res = await fetch(`/api/roles/${role.roleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: newPerms }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      showBanner('ok', `Izin ${role.name} berhasil diperbarui`);
    } catch (e: any) {
      // Revert optimistic update
      setRoles((prev) =>
        prev.map((r) => (r.roleId === role.roleId ? { ...r, permissions: role.permissions } : r))
      );
      showBanner('err', e.message || 'Gagal mengubah izin');
    }
  };

  // Delete role handler
  const handleDeleteRole = async (r: RoleConfigItem) => {
    if (r.isSystem || r.roleId === 'admin' || r.roleId === 'user') {
      showBanner('err', 'Role sistem tidak dapat dihapus');
      return;
    }
    if (!confirm(`Hapus role "${r.name}" (${r.roleId})? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch(`/api/roles/${r.roleId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      showBanner('ok', `Role "${r.name}" berhasil dihapus`);
      await loadData();
    } catch (e: any) {
      showBanner('err', e.message || 'Gagal menghapus role');
    } finally {
      setSavingAction(false);
    }
  };

  // Submit User Role Assignment
  const handleSaveUserAssignment = async () => {
    if (!userAssignmentModal) return;
    const { user, selectedRole, selectedGudang } = userAssignmentModal;

    const targetRole = roles.find((r) => r.roleId === selectedRole);
    const isGlobal = targetRole ? targetRole.scope === 'global' : selectedRole === 'admin';

    setSavingAction(true);
    try {
      const res = await fetch(`/api/users/${user.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          gudangId: isGlobal ? null : selectedGudang,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      showBanner('ok', `Role user "${user.username}" berhasil diperbarui`);
      setUserAssignmentModal(null);
      await loadData();
    } catch (e: any) {
      showBanner('err', e.message || 'Gagal mengubah role user');
    } finally {
      setSavingAction(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users;
    const q = userSearch.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        (u.gudangId ? GUDANG_LIST.find((g) => g.gudangId === u.gudangId)?.name.toLowerCase().includes(q) : false)
    );
  }, [users, userSearch]);

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin' && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16">
      <PageHeader
        icon={ShieldCheck}
        iconBg="bg-rose-500/10 text-rose-600 border border-rose-500/20"
        title="Konfigurasi Role"
        subtitle="Kelola peran, izin modul, dan penugasan akses sistem"
        className="print:hidden"
      >
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold ${
                banner.kind === 'ok' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200'
              }`}
            >
              {banner.kind === 'ok' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
              {banner.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setCreateModalOpen(true)}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 rounded-lg hover:from-rose-600 hover:to-rose-700 transition-all shadow-sm"
        >
          <Plus size={14} />
          Tambah Role Baru
        </button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-6">
        {/* ─── Role Cards Grid ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Daftar Role Terkonfigurasi ({roles.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              Role sistem dilindungi dari penghapusan
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => {
              const colorInfo = COLOR_OPTIONS.find((c) => c.id === r.color) || COLOR_OPTIONS[0];
              const isGlobal = r.scope === 'global';

              return (
                <div
                  key={r.roleId}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm relative flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorInfo.bg} ${colorInfo.text} border ${colorInfo.border}`}
                        >
                          {r.roleId === 'admin' ? (
                            <ShieldCheck size={18} strokeWidth={2.4} />
                          ) : (
                            <Shield size={18} strokeWidth={2.4} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-slate-900 leading-tight">
                              {r.name}
                            </h3>
                            {r.isSystem && (
                              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded uppercase">
                                Sistem
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            ID: {r.roleId}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-slate-900 font-mono">
                          {r.userCount ?? 0}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-semibold">User</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                      {r.description || 'Tidak ada deskripsi.'}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isGlobal
                            ? 'text-purple-700 bg-purple-50 border border-purple-200/80'
                            : 'text-sky-700 bg-sky-50 border border-sky-200/80'
                        }`}
                      >
                        {isGlobal ? <Globe size={10} /> : <Building2 size={10} />}
                        {isGlobal ? 'Scope Global (Semua Gudang)' : 'Scope Per-Gudang (Terikat PIC)'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 font-medium">
                      Hak Akses: <strong className="text-slate-700">{r.permissions.length} dari {APP_MODULES.length} Modul</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-3 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEditingRole(r)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-colors inline-flex items-center gap-1"
                    >
                      <Edit3 size={11} />
                      Edit Role & Izin
                    </button>

                    {!r.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(r)}
                        disabled={savingAction}
                        className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100/80 rounded-lg transition-colors"
                        title="Hapus role"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Interactive Permission Matrix ─── */}
        <section className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-rose-50 rounded-lg border border-rose-100">
                <Sliders size={14} className="text-rose-600" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Matriks Hak Akses Modul
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Klik checkbox pada kolom role untuk mengubah izin akses modul secara instan
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Check size={12} className="text-emerald-600" /> Diizinkan
              </span>
              <span className="inline-flex items-center gap-1">
                <X size={12} className="text-slate-300" /> Ditolak
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/95 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500 min-w-[220px]">
                    Modul / Fitur Sistem
                  </th>
                  <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-400 w-24">
                    Kategori
                  </th>
                  {roles.map((r) => (
                    <th
                      key={r.roleId}
                      className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-center text-slate-700 min-w-[130px]"
                    >
                      <div className="inline-flex flex-col items-center">
                        <span className="font-bold">{r.name}</span>
                        <span className="text-[8.5px] font-normal text-slate-400 lowercase">
                          ({r.roleId})
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {APP_MODULES.map((mod) => (
                  <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <span className="font-semibold text-slate-800 text-[12px] block">
                          {mod.name}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.2">
                          {mod.description}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[9.5px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {mod.category}
                      </span>
                    </td>
                    {roles.map((r) => {
                      const isPermitted = r.permissions.includes(mod.id);
                      const isAdminRole = r.roleId === 'admin';

                      return (
                        <td key={r.roleId} className="px-4 py-3 text-center">
                          {isAdminRole ? (
                            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/70" title="Admin memiliki akses penuh secara permanen">
                              <Lock size={12} strokeWidth={2.4} />
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleMatrixPermission(r, mod.id)}
                              className={`w-7 h-7 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer ${
                                isPermitted
                                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm hover:bg-emerald-600'
                                  : 'bg-slate-100/80 border-slate-200 text-slate-300 hover:bg-slate-200 hover:text-slate-500'
                              }`}
                              title={`Klik untuk ${isPermitted ? 'mencabut' : 'memberikan'} izin ${mod.name} untuk role ${r.name}`}
                            >
                              {isPermitted ? <Check size={14} strokeWidth={3} /> : <X size={13} strokeWidth={2.4} />}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── Role Assignment for Users ─── */}
        <section className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                <Users size={14} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Penugasan Role Pengguna ({users.length} Akun)
                </h3>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  Tugaskan pengguna ke role apa pun dalam sistem
                </p>
              </div>
            </div>

            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari user / role / gudang..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 pl-7 pr-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-60 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/95 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">
                    Username
                  </th>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">
                    Role Ditugaskan
                  </th>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">
                    Scope Gudang
                  </th>
                  <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right text-slate-500 w-36">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-xs">
                      Memuat daftar user...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400 text-xs">
                      Tidak ada user yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const gudang = u.gudangId ? GUDANG_LIST.find((g) => g.gudangId === u.gudangId) : null;
                    const isSelf = u.userId === session?.user?.id;
                    const userRoleObj = roles.find((r) => r.roleId === u.role);

                    return (
                      <tr key={u.userId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-slate-800 text-xs">
                              {u.username}
                            </span>
                            {isSelf && (
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200/60 px-1.5 py-0.2 rounded uppercase">
                                Anda
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {userRoleObj ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              <Shield size={10} />
                              {userRoleObj.name}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                              {u.role}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600 font-medium">
                          {u.gudangId === null ? (
                            <span className="text-slate-400 italic text-[11px]">Semua Gudang (Global)</span>
                          ) : (
                            <span className="text-slate-700 font-semibold text-[11px]">
                              {gudang ? `${gudang.name} (${gudang.prefix})` : `Gudang ${u.gudangId}`}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isSelf ? (
                            <span className="text-[10px] text-slate-400 italic">Akun Anda</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setUserAssignmentModal({
                                  user: u,
                                  selectedRole: u.role,
                                  selectedGudang: u.gudangId ?? 1,
                                })
                              }
                              className="px-2.5 py-1 text-[10px] font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
                            >
                              Ubah Role
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ─── Modal: Tambah Role Baru ─── */}
      <AnimatePresence>
        {createModalOpen && (
          <RoleFormModal
            title="Tambah Role Baru"
            onClose={() => setCreateModalOpen(false)}
            onSave={async (roleData) => {
              setSavingAction(true);
              try {
                const res = await fetch('/api/roles', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(roleData),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || `HTTP ${res.status}`);
                }
                showBanner('ok', `Role "${roleData.name}" berhasil dibuat`);
                setCreateModalOpen(false);
                await loadData();
              } catch (e: any) {
                showBanner('err', e.message || 'Gagal membuat role');
                throw e;
              } finally {
                setSavingAction(false);
              }
            }}
            saving={savingAction}
          />
        )}
      </AnimatePresence>

      {/* ─── Modal: Edit Role ─── */}
      <AnimatePresence>
        {editingRole && (
          <RoleFormModal
            title={`Edit Role: ${editingRole.name}`}
            initialData={editingRole}
            isEditing
            onClose={() => setEditingRole(null)}
            onSave={async (roleData) => {
              setSavingAction(true);
              try {
                const res = await fetch(`/api/roles/${editingRole.roleId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(roleData),
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.error || `HTTP ${res.status}`);
                }
                showBanner('ok', `Role "${roleData.name}" berhasil diperbarui`);
                setEditingRole(null);
                await loadData();
              } catch (e: any) {
                showBanner('err', e.message || 'Gagal memperbarui role');
                throw e;
              } finally {
                setSavingAction(false);
              }
            }}
            saving={savingAction}
          />
        )}
      </AnimatePresence>

      {/* ─── Modal: Ubah Role User ─── */}
      <AnimatePresence>
        {userAssignmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setUserAssignmentModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-sm w-full p-5 space-y-4 z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Ubah Role: {userAssignmentModal.user.username}
                </h3>
                <button
                  type="button"
                  onClick={() => setUserAssignmentModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Pilih Role
                  </label>
                  <select
                    value={userAssignmentModal.selectedRole}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      const roleObj = roles.find((r) => r.roleId === newRole);
                      setUserAssignmentModal({
                        ...userAssignmentModal,
                        selectedRole: newRole,
                        selectedGudang: roleObj?.scope === 'global' ? null : (userAssignmentModal.selectedGudang ?? 1),
                      });
                    }}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-400"
                  >
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.name} ({r.scope === 'global' ? 'Global' : 'Per-Gudang'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Show Gudang dropdown if the selected role is per-gudang */}
                {(() => {
                  const targetRole = roles.find((r) => r.roleId === userAssignmentModal.selectedRole);
                  const isPerGudang = targetRole ? targetRole.scope === 'gudang' : userAssignmentModal.selectedRole === 'user';

                  if (!isPerGudang) return null;

                  return (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Gudang Penugasan
                      </label>
                      <select
                        value={userAssignmentModal.selectedGudang ?? 1}
                        onChange={(e) =>
                          setUserAssignmentModal({
                            ...userAssignmentModal,
                            selectedGudang: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-400"
                      >
                        {GUDANG_LIST.map((g) => (
                          <option key={g.gudangId} value={g.gudangId}>
                            {g.name} ({g.prefix})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserAssignmentModal(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveUserAssignment}
                  disabled={savingAction}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingAction ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Modal Form Component for Create / Edit Role ───
interface RoleFormModalProps {
  title: string;
  initialData?: RoleConfigItem;
  isEditing?: boolean;
  onClose: () => void;
  onSave: (data: {
    roleId?: string;
    name: string;
    description: string;
    color: string;
    scope: 'global' | 'gudang';
    permissions: string[];
  }) => Promise<void>;
  saving: boolean;
}

const RoleFormModal: React.FC<RoleFormModalProps> = ({
  title,
  initialData,
  isEditing = false,
  onClose,
  onSave,
  saving,
}) => {
  const [roleId, setRoleId] = useState(initialData?.roleId || '');
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [color, setColor] = useState(initialData?.color || 'bg-indigo-500');
  const [scope, setScope] = useState<'global' | 'gudang'>(initialData?.scope || 'gudang');
  const [permissions, setPermissions] = useState<string[]>(initialData?.permissions || []);
  const [error, setError] = useState<string | null>(null);

  const isSystemAdmin = initialData?.roleId === 'admin';

  const togglePermission = (modId: string) => {
    if (isSystemAdmin && ['admin-roles', 'admin-users'].includes(modId)) return;
    setPermissions((prev) =>
      prev.includes(modId) ? prev.filter((p) => p !== modId) : [...prev, modId]
    );
  };

  const handleSelectAll = () => {
    setPermissions(APP_MODULES.map((m) => m.id));
  };

  const handleDeselectAll = () => {
    if (isSystemAdmin) {
      setPermissions(['admin-roles', 'admin-users']);
    } else {
      setPermissions([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEditing && !roleId.trim()) {
      setError('Role ID wajib diisi');
      return;
    }
    if (!name.trim()) {
      setError('Nama Role wajib diisi');
      return;
    }

    try {
      await onSave({
        roleId: isEditing ? undefined : roleId.trim().toLowerCase().replace(/\s+/g, '_'),
        name: name.trim(),
        description: description.trim(),
        color,
        scope,
        permissions,
      });
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onSubmit={handleSubmit}
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 max-w-lg w-full max-h-[90vh] flex flex-col z-10 overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isEditing && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Role ID (Slug unik tanpa spasi)
              </label>
              <input
                type="text"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                placeholder="contoh: supervisor_qc atau auditor"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400"
                required
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Nama Role
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="contoh: Supervisor QC / Internal Auditor"
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Deskripsi Singkat
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi tugas dan batasan role ini..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
              Scope Batasan Akses
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSystemAdmin}
                onClick={() => setScope('gudang')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  scope === 'gudang'
                    ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Building2 size={13} />
                Per-Gudang (PIC 1-14)
              </button>
              <button
                type="button"
                onClick={() => setScope('global')}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                  scope === 'global'
                    ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Globe size={13} />
                Global (Semua Gudang)
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Warna Identitas Badge
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-6 h-6 rounded-full ${c.id} transition-transform ${
                    color === c.id ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-105 opacity-80'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Izin Akses Modul ({permissions.length} dari {APP_MODULES.length})
              </label>
              <div className="space-x-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-semibold text-rose-600 hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Hapus Semua
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {APP_MODULES.map((mod) => {
                const checked = permissions.includes(mod.id);
                return (
                  <label
                    key={mod.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer select-none text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block text-[11px]">
                        {mod.name}
                      </span>
                      <span className="text-[9px] text-slate-400 block">{mod.category}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(mod.id)}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-slate-300 rounded cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Buat Role'}
          </button>
        </div>
      </motion.form>
    </div>
  );
};
