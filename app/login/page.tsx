'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  BarChart3,
  Layers,
  ClipboardCheck,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';

const easeOut = [0.23, 1, 0.32, 1] as const;

const SYSTEM_MODULES = [
  {
    icon: BarChart3,
    title: 'Pergerakan Material SAP',
    desc: 'Pantau tonase inbound, outbound, dan net flow harian per shift dan work center.',
  },
  {
    icon: Layers,
    title: 'Klasifikasi Fast & Slow Moving',
    desc: 'Identifikasi perputaran stok aktif, stok melambat, serta status Pipa NC.',
  },
  {
    icon: ClipboardCheck,
    title: 'Audit SLoc & Rekonsiliasi',
    desc: 'Bandingkan stok fisik hasil opname dengan data SAP secara terstruktur.',
  },
  {
    icon: ShieldCheck,
    title: 'Akses Multi-Gudang (RBAC)',
    desc: 'Cakupan data otomatis menyesuaikan peran admin, merger, maupun gudang.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
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

        if (isRepair) {
          router.push('/repair-packing');
        } else {
          router.push('/');
        }
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh bg-[var(--neu-bg)] text-[var(--neu-text)] transition-colors duration-200">
      {/* Top-right Dark / Light Neumorphic Toggle */}
      <div className="fixed top-5 right-5 z-30">
        <ThemeToggle showLabel />
      </div>

      {/* ===== LEFT PANEL — Tactile Neumorphic System Showcase ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: easeOut }}
        className="hidden lg:flex relative w-[56%] flex-col justify-between p-12 xl:p-16 border-r border-[var(--neu-divider)]"
      >
        {/* Brand Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl neu-logo-well flex items-center justify-center p-2">
            <Image
              src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
              alt="SPINDO Logo"
              width={40}
              height={40}
              className="object-contain scale-[1.35]"
              priority
            />
          </div>
          <div>
            <span className="text-[18px] font-extrabold text-[var(--neu-text)] tracking-tight block leading-none">
              SPINDO Warehouse
            </span>
            <span className="font-mono text-[11px] text-[var(--neu-text-muted)] block mt-1">
              Daily Report &amp; Inventory Control
            </span>
          </div>
        </div>

        {/* Core Product Identity + Tactile Module Tiles */}
        <div className="max-w-xl my-auto py-8 space-y-8">
          <div className="space-y-3">
            <h2 className="text-[2.4rem] xl:text-[2.85rem] font-extrabold text-[var(--neu-text)] leading-[1.12] tracking-tight">
              Kendali Pergerakan &amp; Stok Gudang Terpadu
            </h2>
            <p className="text-[15px] text-[var(--neu-text-secondary)] leading-relaxed max-w-lg">
              Sistem pelaporan operasional harian berbasis data SAP untuk memantau arus material, kapasitas penyimpanan, dan audit lokasi gudang SPINDO.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SYSTEM_MODULES.map((mod) => (
              <div
                key={mod.title}
                className="neu-card p-4 flex items-start gap-3.5"
              >
                <div className="w-10 h-10 rounded-xl neu-icon-inset flex items-center justify-center text-[var(--neu-accent)] shrink-0">
                  <mod.icon size={18} strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[13px] font-bold text-[var(--neu-text)] leading-snug">
                    {mod.title}
                  </h3>
                  <p className="text-[11.5px] text-[var(--neu-text-muted)] mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-[var(--neu-text-muted)]">
          <span>&copy; 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
          <span className="font-mono text-[11px]">Created by Ricky Satria</span>
        </div>
      </motion.div>

      {/* ===== RIGHT PANEL — Sculpted Neumorphic Auth Card ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: easeOut }}
          className="w-full max-w-[400px]"
        >
          {/* Mobile Brand */}
          <div className="mb-8 lg:hidden flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-2xl neu-logo-well flex items-center justify-center p-1.5">
              <Image
                src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
                alt="SPINDO Logo"
                width={36}
                height={36}
                className="object-contain scale-[1.35]"
              />
            </div>
            <div>
              <span className="text-lg font-extrabold text-[var(--neu-text)] tracking-tight block leading-none">
                SPINDO
              </span>
              <span className="font-mono text-[10px] text-[var(--neu-text-muted)] uppercase tracking-wider">
                Warehouse Ops
              </span>
            </div>
          </div>

          <div className="neu-card p-7 sm:p-9">
            {/* Form Header */}
            <div className="mb-7">
              <h1 className="text-[24px] font-extrabold text-[var(--neu-text)] tracking-tight leading-tight">
                Masuk ke Sistem
              </h1>
              <p className="text-[13px] text-[var(--neu-text-muted)] mt-1.5">
                Gunakan username dan password akun gudang SPINDO Anda.
              </p>
            </div>

            {/* Error Banner */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -6, height: 0 }}
                  transition={{ duration: 0.2, ease: easeOut }}
                  className="flex items-center gap-2.5 neu-inset-sm rounded-xl text-[var(--neu-red)] text-[13px] font-semibold px-3.5 py-3 mb-5 border border-[var(--neu-red)]/30 overflow-hidden"
                >
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Auth Form */}
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
                    className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                      focusedField === 'username'
                        ? 'text-[var(--neu-accent)]'
                        : 'text-[var(--neu-text-muted)]'
                    }`}
                  />
                  <input
                    id="login-username"
                    ref={usernameRef}
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
                    className="neu-input w-full h-12 pl-10 pr-11 rounded-xl text-[14px] font-medium"
                    placeholder="Masukkan password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--neu-text-muted)] hover:text-[var(--neu-accent)] transition-colors cursor-pointer"
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
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

            <div className="mt-6 pt-5 border-t border-[var(--neu-divider)] text-center">
              <p className="text-[12px] text-[var(--neu-text-muted)]">
                Lupa password?{' '}
                <a
                  href="https://wa.me/6287776216046"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--neu-accent)] hover:underline font-bold"
                >
                  Hubungi Admin
                </a>
              </p>
            </div>
          </div>

          <p className="text-center mt-6 font-mono text-[11px] text-[var(--neu-text-muted)] lg:hidden">
            Created by Ricky Satria
          </p>
        </motion.div>
      </div>
    </div>
  );
}
