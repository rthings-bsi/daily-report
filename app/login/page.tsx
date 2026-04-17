'use client';

import React, { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, User, Warehouse, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-500/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 22 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Top accent */}
          <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

          <div className="p-8">
            {/* Brand */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/30 mb-4">
                <Warehouse className="text-white" size={30} />
              </div>
              <h1 className="text-xl font-black text-white tracking-tight">SPINDO Gudang 13</h1>
              <p className="text-sm text-slate-400 mt-1 font-medium">Warehouse Intelligence System</p>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium rounded-xl px-4 py-3 mb-5"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Username
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    placeholder="Masukkan username"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="Masukkan password"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl pl-11 pr-12 py-3 text-sm font-medium focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2.5 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Masuk...
                  </>
                ) : (
                  'Masuk ke Dashboard'
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-white/3 border-t border-white/5 text-center">
            <p className="text-xs text-slate-500">SPINDO © 2026 · Warehouse Intelligence</p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
