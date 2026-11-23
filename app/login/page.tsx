import Image from 'next/image';
import { BarChart3, Layers, ClipboardCheck, ShieldCheck } from 'lucide-react';
import spindoLogo from '@/app/icon.png';
import { ThemeToggle } from '@/components/ThemeToggle';
import LoginForm from '@/components/LoginForm';

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
  return (
    <main className="relative flex min-h-dvh bg-[var(--neu-bg)] text-[var(--neu-text)] transition-colors duration-200">
      {/* Top-right Dark / Light Neumorphic Toggle */}
      <div className="fixed top-5 right-5 z-30">
        <ThemeToggle showLabel />
      </div>

      {/* ===== LEFT PANEL — Pure Server-Rendered Tactile System Showcase ===== */}
      <section
        aria-label="Ringkasan Sistem SPINDO Warehouse"
        className="hidden lg:flex relative w-[56%] flex-col justify-between p-12 xl:p-16 border-r border-[var(--neu-divider)]"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl neu-logo-well flex items-center justify-center p-1.5">
            <Image
              src={spindoLogo}
              alt="SPINDO Logo"
              width={36}
              height={22}
              className="object-contain"
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

        <div className="max-w-xl my-auto py-8 space-y-8">
          <div className="space-y-3">
            <p className="text-[2.4rem] xl:text-[2.85rem] font-extrabold text-[var(--neu-text)] leading-[1.12] tracking-tight">
              Kendali Pergerakan &amp; Stok Gudang Terpadu
            </p>
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
                <div
                  aria-hidden="true"
                  className="w-10 h-10 rounded-xl neu-icon-inset flex items-center justify-center text-[var(--neu-accent)] shrink-0"
                >
                  <mod.icon size={18} strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[var(--neu-text)] leading-snug">
                    {mod.title}
                  </p>
                  <p className="text-[11.5px] text-[var(--neu-text-muted)] mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-between text-xs text-[var(--neu-text-muted)]">
          <span>&copy; 2026 PT Steel Pipe Industry of Indonesia Tbk (SPINDO)</span>
          <span className="font-mono text-[11px]">Created by Ricky Satria</span>
        </footer>
      </section>

      {/* ===== RIGHT PANEL — Sculpted Neumorphic Auth Card ===== */}
      <section
        aria-label="Formulir Masuk Sistem"
        className="flex-1 flex items-center justify-center p-6 sm:p-10"
      >
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden flex items-center justify-center gap-3">
            <div className="w-11 h-11 rounded-2xl neu-logo-well flex items-center justify-center p-1.5">
              <Image
                src={spindoLogo}
                alt="SPINDO Logo"
                width={36}
                height={22}
                className="object-contain"
                priority
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
            <div className="mb-7">
              <h1 className="text-[24px] font-extrabold text-[var(--neu-text)] tracking-tight leading-tight">
                Masuk ke Sistem
              </h1>
              <p className="text-[13px] text-[var(--neu-text-muted)] mt-1.5">
                Gunakan username dan password akun gudang SPINDO Anda.
              </p>
            </div>

            <LoginForm />

            <div className="mt-6 pt-5 border-t border-[var(--neu-divider)] text-center">
              <p className="text-[12px] text-[var(--neu-text-muted)]">
                Lupa password?{' '}
                <a
                  href="https://wa.me/6287776216046"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-1 text-[var(--neu-accent)] hover:underline font-bold"
                >
                  Hubungi Admin
                </a>
              </p>
            </div>
          </div>

          <p className="text-center mt-6 font-mono text-[11px] text-[var(--neu-text-muted)] lg:hidden">
            Created by Ricky Satria
          </p>
        </div>
      </section>
    </main>
  );
}
