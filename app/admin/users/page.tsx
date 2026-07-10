'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, Trash2, Edit3, X, Shield, ShieldCheck,
  CheckCircle2, AlertCircle, Search, UserCheck, KeyRound,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { GUDANG_LIST } from '@/lib/gudang';

interface UserRow {
  userId: string;
  username: string;
  role: 'admin' | 'user';
  gudangId: number | null;
  createdAt: string;
  updatedAt: string;
}

type FormMode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; user: UserRow };

const PASSWORD_MIN = 6;

export default function AdminUsersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormMode>({ kind: 'closed' });
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Auth gate
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/');
    }
  }, [status, session, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'admin') {
      load();
    }
  }, [status, session, load]);

  const filtered = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.gudangId ? GUDANG_LIST.find((g) => g.gudangId === u.gudangId)?.name.toLowerCase().includes(q) : false),
    );
  }, [users, search]);

  const showBanner = (kind: 'ok' | 'err', msg: string) => {
    setBanner({ kind, msg });
    setTimeout(() => setBanner(null), 3000);
  };

  const submitForm = async (data: {
    username: string;
    password?: string;
    role: 'admin' | 'user';
    gudangId: number | null;
  }) => {
    setSaving(true);
    try {
      if (form.kind === 'create') {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        showBanner('ok', `User "${data.username}" berhasil dibuat`);
      } else if (form.kind === 'edit') {
        const res = await fetch(`/api/users/${form.user.userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        showBanner('ok', `User "${data.username}" berhasil diperbarui`);
      }
      setForm({ kind: 'closed' });
      await load();
    } catch (e: any) {
      showBanner('err', e.message || 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`Hapus user "${u.username}"? Tindakan tidak dapat dibatalkan.`)) return;
    try {
      const res = await fetch(`/api/users/${u.userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      showBanner('ok', `User "${u.username}" dihapus`);
      await load();
    } catch (e: any) {
      showBanner('err', e.message || 'Gagal menghapus user');
    }
  };

  if (status === 'loading' || (status === 'authenticated' && session?.user?.role !== 'admin' && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <PageHeader icon={Users} title="Manajemen User" subtitle="Kelola akun untuk 14 gudang" className="print:hidden">
        <AnimatePresence>
          {banner && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[11px] font-semibold ${
                banner.kind === 'ok' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}
            >
              {banner.kind === 'ok' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {banner.msg}
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setForm({ kind: 'create' })}
          className="h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-white bg-gradient-to-r from-sky-500 to-sky-600 rounded-lg hover:from-sky-600 hover:to-sky-700 transition-all shadow-sm"
        >
          <Plus size={13} />
          Tambah User
        </button>
      </PageHeader>

      <div className="max-w-[1600px] mx-auto px-5 py-5 space-y-5">
        <section className="bg-white border border-slate-200/70 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-sky-50 rounded-lg border border-sky-100">
                <UserCheck size={14} className="text-sky-600" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Daftar User</h2>
                <p className="text-[9px] text-slate-400 mt-0.5">
                  {loading ? 'Memuat...' : `${filtered.length} dari ${users.length} user`}
                </p>
              </div>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari username / gudang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-7 pr-2 text-[11px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 w-56 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/95 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">Username</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">Role</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">Gudang</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-left text-slate-500">Dibuat</th>
                  <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-right text-slate-500 w-24">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center">
                      <div className="inline-flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-5 h-5 border-2 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
                        <span className="text-[11px]">Memuat user...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[11px] text-slate-400">
                      {users.length === 0 ? 'Belum ada user.' : 'Tidak ada user yang cocok.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const gudang = u.gudangId ? GUDANG_LIST.find((g) => g.gudangId === u.gudangId) : null;
                    const isSelf = u.userId === session?.user?.id;
                    return (
                      <tr key={u.userId} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/40">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-slate-800 font-mono">{u.username}</span>
                            {isSelf && (
                              <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded uppercase">Anda</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <ShieldCheck size={10} />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                              <Shield size={10} />
                              User
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-slate-600">
                          {gudang ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-mono text-[10px] text-slate-400">{gudang.prefix}</span>
                              <span className="font-semibold">{gudang.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setForm({ kind: 'edit', user: u })}
                              className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title="Edit user"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={isSelf}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? 'Tidak bisa hapus akun sendiri' : 'Hapus user'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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

      <AnimatePresence>
        {form.kind !== 'closed' && (
          <UserForm
            mode={form}
            onClose={() => setForm({ kind: 'closed' })}
            onSubmit={submitForm}
            saving={saving}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface UserFormProps {
  mode: { kind: 'create' } | { kind: 'edit'; user: UserRow };
  onClose: () => void;
  onSubmit: (data: {
    username: string;
    password?: string;
    role: 'admin' | 'user';
    gudangId: number | null;
  }) => Promise<void>;
  saving: boolean;
}

const UserForm: React.FC<UserFormProps> = ({ mode, onClose, onSubmit, saving }) => {
  const isEdit = mode.kind === 'edit';
  const [username, setUsername] = useState(mode.kind === 'edit' ? mode.user.username : '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>(mode.kind === 'edit' ? mode.user.role : 'user');
  const [gudangId, setGudangId] = useState<number | null>(mode.kind === 'edit' ? mode.user.gudangId : 1);
  const [error, setError] = useState<string | null>(null);

  const handleRoleChange = (newRole: 'admin' | 'user') => {
    setRole(newRole);
    if (newRole === 'admin') setGudangId(null);
    else if (gudangId === null) setGudangId(1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim()) {
      setError('Username wajib diisi');
      return;
    }
    if (!isEdit && !password) {
      setError('Password wajib diisi untuk user baru');
      return;
    }
    if (password && password.length < PASSWORD_MIN) {
      setError(`Password minimal ${PASSWORD_MIN} karakter`);
      return;
    }
    if (role === 'user' && (gudangId === null || gudangId < 1 || gudangId > 14)) {
      setError('User (non-admin) harus terikat ke gudang');
      return;
    }
    const payload: any = { username: username.trim(), role, gudangId: role === 'admin' ? null : gudangId };
    if (password) payload.password = password;
    onSubmit(payload).catch((e) => setError(e.message));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-50 rounded-lg">
              {isEdit ? <Edit3 size={14} className="text-sky-600" /> : <Plus size={14} className="text-sky-600" />}
            </div>
            <h2 className="text-sm font-bold text-slate-800">
              {isEdit ? `Edit User: ${mode.user.username}` : 'Tambah User Baru'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <Field label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className="w-full h-9 px-3 text-sm font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              placeholder="contoh: gudang5 atau admin2"
            />
          </Field>

          <Field label={isEdit ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password'}>
            <div className="relative">
              <KeyRound size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full h-9 pl-8 pr-3 text-sm font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                placeholder={isEdit ? '••••••' : 'Min. 6 karakter'}
              />
            </div>
          </Field>

          <Field label="Role">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleRoleChange('user')}
                className={`h-9 px-3 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  role === 'user' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Shield size={12} />
                User
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`h-9 px-3 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  role === 'admin' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShieldCheck size={12} />
                Admin
              </button>
            </div>
          </Field>

          {role === 'user' && (
            <Field label="Gudang">
              <select
                value={gudangId ?? ''}
                onChange={(e) => setGudangId(Number(e.target.value))}
                className="w-full h-9 px-3 text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {GUDANG_LIST.map((g) => (
                  <option key={g.gudangId} value={g.gudangId}>
                    {g.name} ({g.prefix})
                  </option>
                ))}
              </select>
            </Field>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              <AlertCircle size={12} />
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 h-9 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 h-9 text-[12px] font-semibold text-white bg-gradient-to-r from-sky-500 to-sky-600 rounded-lg hover:from-sky-600 hover:to-sky-700 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan' : 'Buat User'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);
