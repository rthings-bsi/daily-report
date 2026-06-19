'use client';

import React, { useState, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

import Image from 'next/image';

const inputBase =
  'w-full h-12 px-4 text-sm text-slate-800 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100/60';

const easeOut = [0.16, 1, 0.3, 1] as const;

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
        router.push('/');
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-slate-50 via-white to-sky-50/40 selection:bg-sky-200">

      {/* ===== LEFT PANEL — Branding ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex relative w-[55%] flex-col justify-between p-14 xl:p-16 overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-sky-900"
      >
        {/* Subtle ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute top-1/3 -right-12 w-48 h-48 rounded-full bg-white/5 blur-3xl" />

        <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-white/10 via-white/20 to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
          className="relative z-10 mb-2"
        >
          <div className="w-40 h-16 flex items-center justify-start">
            <Image
              src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
              alt="SPINDO Logo"
              width={160}
              height={64}
              className="object-contain"
              priority
            />
          </div>
        </motion.div>

        {/* Hero */}
        <div className="space-y-5 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-[11px] font-semibold mb-5 border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Monitoring Gudang
            </div>
            <h2
              className="text-[2.8rem] xl:text-[3.2rem] font-bold text-white leading-[1.05] tracking-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <span className="block">Pergerakan</span>
              <span className="block">Barang</span>
            </h2>
            <p className="text-base text-sky-200/80 max-w-md mt-4 leading-relaxed font-medium">
              Catat dan pantau semua pergerakan barang di gudang.
            </p>
          </div>

          {/* Stats badges — clean & minimal */}
          <div className="flex gap-4 pt-2">
            {[
              { label: 'Real-time', desc: 'Update langsung' },
              { label: 'Multi-user', desc: 'Akses peran' },
              { label: 'SAP Import', desc: 'Otomatis' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: easeOut }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5"
              >
                <span className="text-xs font-semibold text-white/80">{item.label}</span>
                <span className="text-[10px] text-sky-200/50">—</span>
                <span className="text-[10px] text-sky-200/50">{item.desc}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-xs text-white/30">
            &copy; 2026 SPINDO
          </p>
          <p className="text-[10px] text-white/15 mt-1 tracking-wide">
            Created by <span className="font-semibold text-white/25">Ricky Satria</span>
          </p>
        </div>
      </motion.div>

      {/* ===== RIGHT PANEL — Form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: easeOut }}
          className="w-full max-w-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="mb-8 lg:hidden flex justify-center w-full"
          >
            <div className="w-36 h-14 flex items-center justify-center">
              <Image
                src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
                alt="SPINDO Logo"
                width={144}
                height={56}
                className="object-contain"
              />
            </div>
          </motion.div>

          {/* Form header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: easeOut }}
            className="mb-7"
          >
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 text-[10px] font-semibold mb-4 border border-sky-100/50">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
              Akses Terbatas
            </div>
            <h1
              className="text-2xl font-bold text-slate-900 tracking-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              Halo
            </h1>
            <p className="text-sm text-slate-400 mt-1 font-medium">
              Pakai akun SPINDO kamu
            </p>
          </motion.div>

          {/* Error banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.25, ease: easeOut }}
                className="flex items-center gap-2.5 bg-rose-50 rounded-xl text-rose-600 text-sm px-4 py-3 mb-5 border border-rose-200/60 overflow-hidden"
              >
                <AlertCircle size={15} className="flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                className={`text-sm font-semibold transition-colors duration-200 ${
                  focusedField === 'username' ? 'text-sky-600' : 'text-slate-700'
                }`}
              >
                Username
              </label>
              <div className="relative">
                <User
                  size={16}
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 ${
                    focusedField === 'username' ? 'text-sky-500' : 'text-slate-400'
                  }`}
                />
                <input
                  ref={usernameRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="username"
                  required
                  className={`${inputBase} pl-10`}
                  placeholder="Masukkan username"
                />
                {username && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400"
                  />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className={`text-sm font-semibold transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-sky-600' : 'text-slate-700'
                  }`}
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 ${
                    focusedField === 'password' ? 'text-sky-500' : 'text-slate-400'
                  }`}
                />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="current-password"
                  required
                  className={`${inputBase} pl-10 pr-10`}
                  placeholder="Masukkan password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="pt-2 pb-1 text-center">
              <p className="text-[11px] text-slate-500 font-medium">
                Lupa password?{' '}
                <a
                  href="https://wa.me/6287776216046"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 hover:text-sky-700 font-semibold transition-colors"
                >
                  Hubungi Admin
                </a>
              </p>
            </div>

            <div className="pt-1">
              <motion.button
                type="submit"
                disabled={loading || !username || !password}
                whileHover={!loading && username && password ? { scale: 1.01 } : {}}
                whileTap={!loading && username && password ? { scale: 0.98 } : {}}
                className="relative w-full h-12 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-200/50 overflow-hidden"
              >
                {loading ? (
                  <span className="flex items-center gap-2.5 relative z-10">
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    />
                    Masuk
                  </span>
                ) : (
                  <span className="flex items-center gap-2.5 relative z-10">
                    Masuk
                    <ArrowRight size={15} />
                  </span>
                )}
              </motion.button>
            </div>
          </form>

          {/* Created by — mobile */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="text-center mt-8 text-[11px] text-slate-400 font-medium lg:hidden"
          >
            Created by <span className="text-slate-500">Ricky Satria</span>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
