"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  Package,
  Users,
  ShieldCheck,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { GUDANG_LIST } from "@/lib/gudang";
import { useSidebar } from "./SidebarContext";

const baseMenuItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Upload", href: "/upload", icon: FileUp },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminMenuItem = { name: "Manajemen User", href: "/admin/users", icon: Users };

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, toggle } = useSidebar();

  if (!session) return null;

  return (
    <>
      {/* ─── Mobile Overlay ─── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={toggle}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-[51] h-screen flex flex-col bg-white/95 backdrop-blur-xl border-r border-slate-200/60 shadow-lg shadow-slate-200/20 transition-all duration-300 ease-in-out",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16 w-64"
        )}
      >
        {/* ─── Logo ─── */}
        <div className={cn(
          "flex items-center h-16 shrink-0 border-b border-slate-200/50",
          isOpen ? "px-5" : "px-4"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center shrink-0">
              <Image
                src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
                alt="SPINDO Logo"
                width={36}
                height={36}
                className="object-contain scale-[1.6]"
              />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <span className="text-base font-bold text-slate-900 tracking-tight block leading-tight">SPINDO</span>
                <span className="text-[9px] font-medium text-slate-400 tracking-wider uppercase block leading-tight">Warehouse</span>
              </div>
            )}
          </div>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 space-y-0.5 px-2.5 py-5 overflow-hidden">
          <div className={cn("text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-2.5 mb-3", isOpen ? "block" : "sr-only")}>
            Menu
          </div>
          {baseMenuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center rounded-xl text-sm font-medium relative overflow-hidden",
                  isOpen ? "px-3 py-2.5 gap-3" : "justify-center py-3",
                  isActive
                    ? "text-sky-700"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {isActive && (
                  <span className={cn(
                    "absolute inset-0 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50/50",
                    "transition-all duration-300"
                  )} />
                )}
                {isActive && (
                  <span className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full bg-gradient-to-b from-sky-500 to-sky-600",
                    "transition-all duration-300"
                  )} />
                )}
                <div className={cn(
                  "relative flex items-center justify-center",
                  isOpen ? "gap-3" : "gap-0"
                )}>
                  <item.icon
                    size={20}
                    className={cn(
                      "shrink-0 transition-all duration-200",
                      isActive
                        ? "text-sky-600"
                        : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                </div>
                {isOpen && (
                  <>
                    <span className="relative flex-1 text-[13px]">{item.name}</span>
                    {isActive && (
                      <ChevronRight size={14} className="relative text-sky-400" />
                    )}
                  </>
                )}
              </Link>
            );
          })}

          {/* Admin-only section */}
          {session.user?.role === 'admin' && (
            <>
              <div className={cn("text-[10px] font-semibold text-amber-500 uppercase tracking-widest px-2.5 mb-1 mt-4 flex items-center gap-1", isOpen ? "block" : "sr-only")}>
                <ShieldCheck size={9} />
                Admin
              </div>
              {[adminMenuItem].map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "group flex items-center rounded-xl text-sm font-medium relative overflow-hidden",
                      isOpen ? "px-3 py-2.5 gap-3" : "justify-center py-3",
                      isActive
                        ? "text-amber-700"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {isActive && (
                      <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-50 to-amber-50/50" />
                    )}
                    <div className={cn("relative flex items-center justify-center", isOpen ? "gap-3" : "gap-0")}>
                      <item.icon size={20} className={isActive ? "text-amber-600" : "text-slate-400 group-hover:text-slate-600"} />
                    </div>
                    {isOpen && (
                      <span className="relative flex-1 text-[13px]">{item.name}</span>
                    )}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* ─── User ─── */}
        <div className={cn(
          "shrink-0 border-t border-slate-200/50 overflow-hidden",
          isOpen ? "px-3 py-3" : "px-2 py-3"
        )}>
          <div className={cn(
            "flex items-center",
            isOpen ? "gap-3" : "flex-col gap-2"
          )}>
            <div className="relative shrink-0">
              <div className={cn(
                "rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-sky-200/50",
                isOpen ? "h-9 w-9 text-sm" : "h-9 w-9 text-sm"
              )}>
                {session.user?.name?.substring(0, 2).toUpperCase() || "U"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{session.user?.name}</p>
                <p className="text-[10px] text-slate-400 truncate leading-tight">
                  {session.user?.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                      <ShieldCheck size={9} />
                      Admin
                    </span>
                  ) : session.user?.gudangId ? (
                    <span className="font-mono">{GUDANG_LIST.find((g) => g.gudangId === session.user!.gudangId)?.name}</span>
                  ) : (
                    'User'
                  )}
                </p>
              </div>
            )}
            {isOpen && (
              <button
                onClick={() => signOut()}
                className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200"
                title="Sign out"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
          {!isOpen && (
            <button
              onClick={() => signOut()}
              className="flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors duration-200 w-full"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        {/* ─── Toggle ─── */}
        <button
          onClick={toggle}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-50",
            "flex items-center justify-center",
            "w-6 h-6 rounded-full",
            "bg-white border border-slate-200/80 text-slate-400",
            "hover:border-sky-200 hover:text-sky-600 hover:shadow-md hover:shadow-sky-100",
            "shadow-sm transition-all duration-200"
          )}
          title={isOpen ? "Tutup sidebar" : "Buka sidebar"}
        >
          {isOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>
      </aside>
    </>
  );
}
