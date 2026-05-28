'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, User, Eye, EyeOff, AlertCircle, ArrowRight,
  BarChart3, Upload, Shield,
} from 'lucide-react';

const features = [
  { icon: BarChart3, label: 'Dashboard Live', desc: 'Pantau pergerakan barang langsung' },
  { icon: Upload, label: 'Import SAP', desc: 'Data SAP diimpor otomatis' },
  { icon: Shield, label: 'Multi-Level Akses', desc: 'Tiap user punya akses sesuai perannya' },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const inputBase =
  'w-full h-12 px-4 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100';

const easeOut = [0.16, 1, 0.3, 1] as const;

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const leftItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
};

const leftFeature = {
  hidden: { opacity: 0, x: -20, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1, x: 0, scale: 1,
    transition: { duration: 0.5, delay: 0.4 + i * 0.1, ease: easeOut },
  }),
};

const formContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.25 },
  },
};

const formItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: easeOut },
  },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1, scale: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
};

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

  const dots = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 24 }, () => ({
      left: `${rng() * 100}%`,
      top: `${rng() * 100}%`,
      size: rng() * 3 + 1.5,
      xDrift: (rng() - 0.5) * 30,
      yDrift: (rng() - 0.5) * 30,
      delay: rng() * 5,
      duration: rng() * 6 + 4,
    }));
  }, []);

  return (
    <div className="flex min-h-dvh bg-gradient-to-br from-slate-50 via-white to-sky-50/40 selection:bg-sky-200">

      {/* ===== LEFT PANEL ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex relative w-[55%] flex-col justify-between p-14 xl:p-18 overflow-hidden bg-gradient-to-br from-sky-600 via-sky-700 to-sky-900"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.12)_0%,_transparent_50%)]" />

        {/* Floating dots */}
        {dots.map((d, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white/8"
            style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
            animate={{
              x: [0, d.xDrift, 0],
              y: [0, d.yDrift, 0],
              opacity: [0.15, 0.6, 0.15],
              scale: [1, 1.3, 1],
            }}
            transition={{
              duration: d.duration,
              repeat: Infinity,
              delay: d.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

        <div className="absolute right-0 top-0 w-px h-full bg-gradient-to-b from-white/10 via-white/20 to-transparent" />

        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute -bottom-10 -right-10 w-60 h-60 rounded-full bg-white/5 blur-3xl" />

        {/* Brand */}
        <motion.div
          variants={leftItem}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.6, ease: easeOut }}
          className="flex items-center gap-3 relative z-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeOut }}
            className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10"
          >
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-outfit)' }}>S</span>
          </motion.div>
          <motion.span
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: easeOut }}
            className="text-lg font-bold text-white/90" style={{ fontFamily: 'var(--font-outfit)' }}
          >
            SPINDO
          </motion.span>
        </motion.div>

        {/* Hero */}
        <div className="space-y-6 relative z-10">
          <motion.div
            variants={leftItem}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1, duration: 0.7, ease: easeOut }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: easeOut }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white/70 text-[11px] font-semibold mb-5 border border-white/10"
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
              Monitoring Gudang
            </motion.div>
            <h2
              className="text-[2.8rem] xl:text-[3.2rem] font-bold text-white leading-[1.05] tracking-tight"
              style={{ fontFamily: 'var(--font-outfit)' }}
            >
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25, ease: easeOut }}
                className="block"
              >
                Pergerakan
              </motion.span>
              <motion.span
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease: easeOut }}
                className="block"
              >
                Barang
              </motion.span>
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: easeOut }}
              className="text-base text-sky-200/80 max-w-md mt-4 leading-relaxed font-medium"
            >
              Catat dan pantau semua pergerakan barang di gudang.
            </motion.p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={container}
            className="space-y-3 pt-2"
          >
            {features.map((item, i) => (
              <motion.div
                key={i}
                custom={i}
                variants={leftFeature}
                className="flex items-center gap-3.5 group"
              >
                <motion.div
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.2)' }}
                  className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shrink-0 transition-colors border border-white/10"
                >
                  <item.icon size={16} className="text-sky-200" />
                </motion.div>
                <div>
                  <span className="font-semibold text-white text-sm">{item.label}</span>
                  <span className="text-sm text-sky-200/60 ml-2">— {item.desc}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-xs text-white/30 relative z-10"
        >
          &copy; 2026 SPINDO
        </motion.p>
      </motion.div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-gradient-to-br from-white via-slate-50/50 to-white">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: easeOut }}
          className="w-full max-w-sm"
        >
          {/* Brand (mobile) */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: easeOut }}
            className="flex items-center gap-2.5 mb-8 lg:hidden"
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: easeOut }}
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 to-sky-700 flex items-center justify-center shadow-lg shadow-sky-200/50"
            >
              <span className="text-white font-bold text-base" style={{ fontFamily: 'var(--font-outfit)' }}>S</span>
            </motion.div>
            <span className="text-base font-bold text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>SPINDO</span>
          </motion.div>

          <motion.div variants={formContainer} initial="hidden" animate="visible">
            {/* Form header */}
            <motion.div variants={formItem} className="mb-7">
              <motion.div
                variants={scaleIn}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 text-[10px] font-semibold mb-4 border border-sky-100/50"
              >
                <motion.span
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-1.5 h-1.5 rounded-full bg-sky-500"
                />
                Akses Terbatas
              </motion.div>
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
                  initial={{ opacity: 0, y: -10, scale: 0.96, height: 0 }}
                  animate={{ opacity: 1, y: 0, scale: 1, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, scale: 0.96, height: 0 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                  className="flex items-center gap-2.5 bg-rose-50 rounded-xl text-rose-600 text-sm px-4 py-3 mb-5 border border-rose-200/60 overflow-hidden"
                >
                  <motion.div
                    initial={{ rotate: -20, scale: 0 }}
                    animate={{ rotate: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.1, ease: easeOut }}
                  >
                    <AlertCircle size={15} className="flex-shrink-0" />
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    {error}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <motion.div variants={formItem} className="space-y-1.5 group">
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
                  {username && focusedField !== 'username' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400"
                    />
                  )}
                </div>
              </motion.div>

              <motion.div variants={formItem} className="space-y-1.5 group">
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
                  <motion.button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-500 transition-colors"
                    tabIndex={-1}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={showPass ? 'off' : 'on'}
                        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
                        animate={{ opacity: 1, rotate: 0, scale: 1 }}
                        exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
                        transition={{ duration: 0.2 }}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </motion.div>
                    </AnimatePresence>
                  </motion.button>
                </div>
              </motion.div>

              <motion.div variants={formItem} className="pt-1">
                <motion.button
                  type="submit"
                  disabled={loading || !username || !password}
                  whileHover={!loading && username && password ? { scale: 1.01 } : {}}
                  whileTap={!loading && username && password ? { scale: 0.98 } : {}}
                  className="relative w-full h-12 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-200/50 overflow-hidden group/btn"
                >
                  <motion.div
                    animate={loading ? { opacity: [0, 0.3, 0] } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,_rgba(255,255,255,0.2)_0%,_transparent_60%)]"
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                  />
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
                      <motion.div
                        animate={{ x: [0, 3, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <ArrowRight size={15} />
                      </motion.div>
                    </span>
                  )}
                </motion.button>
              </motion.div>
            </form>

            {/* Footer (mobile) */}
            <motion.p
              variants={formItem}
              className="text-center mt-8 text-[11px] text-slate-300 font-medium lg:hidden"
            >
              &copy; 2026 SPINDO
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
