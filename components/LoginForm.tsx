'use client';

import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { signIn, getSession } = await import('next-auth/react');
      const res = await signIn('credentials', {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Username atau password salah.');
      } else {
        const sess = await getSession();
        const role = sess?.user?.role?.toLowerCase() || '';
        const perms = sess?.user?.permissions || [];
        const isRepair =
          role === 'repair' ||
          role === 'rep' ||
          role.includes('repair') ||
          (!perms.includes('dashboard') && perms.includes('repair-packing'));

        window.location.assign(isRepair ? '/repair-packing' : '/');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 neu-inset-sm rounded-xl text-[var(--neu-red)] text-[13px] font-semibold px-3.5 py-3 mb-5 border border-[var(--neu-red)]/30"
        >
          <AlertCircle size={16} aria-hidden="true" className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="login-username"
            className={`text-[13px] font-bold block transition-colors ${
              focusedField === 'username'
                ? 'text-[var(--neu-accent)]'
                : 'text-[var(--neu-text-secondary)]'
            }`}
          >
            Username
          </label>
          <div className="relative">
            <User
              size={16}
              aria-hidden="true"
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                focusedField === 'username'
                  ? 'text-[var(--neu-accent)]'
                  : 'text-[var(--neu-text-muted)]'
              }`}
            />
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField(null)}
              autoComplete="username"
              required
              className="neu-input w-full h-12 pl-10 pr-4 rounded-xl text-[14px] font-medium"
              placeholder="Masukkan username"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="login-password"
            className={`text-[13px] font-bold block transition-colors ${
              focusedField === 'password'
                ? 'text-[var(--neu-accent)]'
                : 'text-[var(--neu-text-secondary)]'
            }`}
          >
            Password
          </label>
          <div className="relative">
            <Lock
              size={16}
              aria-hidden="true"
              className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                focusedField === 'password'
                  ? 'text-[var(--neu-accent)]'
                  : 'text-[var(--neu-text-muted)]'
              }`}
            />
            <input
              id="login-password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              autoComplete="current-password"
              required
              className="neu-input w-full h-12 pl-10 pr-12 rounded-xl text-[14px] font-medium"
              placeholder="Masukkan password"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-[var(--neu-text-muted)] hover:text-[var(--neu-accent)] transition-colors cursor-pointer"
              aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPass ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !username || !password}
            className="neu-btn-primary w-full h-12 font-bold rounded-xl text-[14px] flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Memverifikasi...
              </span>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
