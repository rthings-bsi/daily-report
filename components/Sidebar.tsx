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
  Users,
  ShieldCheck,
  ClipboardList,
  ClipboardCheck,
  PanelLeftClose,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { GUDANG_LIST } from "@/lib/gudang";
import { useSidebar } from "./SidebarContext";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  color: string;
}

const baseMenuItems: MenuItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, color: "bg-[#007AFF]" },
  { name: "Data Pipa NC", href: "/pipa-nc", icon: ClipboardList, color: "bg-[#5856D6]" },
  { name: "Audit SLoc", href: "/audit-sloc", icon: ClipboardCheck, color: "bg-[#34C759]" },
  { name: "Upload", href: "/upload", icon: FileUp, color: "bg-[#FF9500]" },
];

const adminMenuItems: MenuItem[] = [
  { name: "Manajemen User", href: "/admin/users", icon: Users, color: "bg-[#AF52DE]" },
];

const settingsMenuItems: MenuItem[] = [
  { name: "Settings", href: "/settings", icon: Settings, color: "bg-[#8E8E93]" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, toggle } = useSidebar();

  if (!session) return null;

  const renderMenuItem = (item: MenuItem) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={!isOpen ? item.name : undefined}
        className={cn(
          "group relative flex items-center rounded-xl transition-apple select-none",
          isOpen ? "px-3 py-2 gap-3" : "justify-center py-2.5 px-1.5",
          isActive
            ? "bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.28)] font-semibold"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 active:scale-[0.98]"
        )}
      >
        <div
          className={cn(
            "w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105",
            isActive
              ? "bg-white text-[#007AFF] shadow-sm"
              : cn(item.color, "text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)]")
          )}
        >
          <item.icon size={15} strokeWidth={2.4} />
        </div>

        {isOpen && (
          <>
            <span className="flex-1 text-[13px] tracking-tight truncate font-medium">
              {item.name}
            </span>
            {isActive ? (
              <ChevronRight size={13} strokeWidth={2.5} className="text-white/70 shrink-0 ml-auto" />
            ) : (
              <ChevronRight
                size={13}
                strokeWidth={2}
                className="text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-apple shrink-0 ml-auto"
              />
            )}
          </>
        )}
      </Link>
    );
  };

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
          "group/sidebar fixed left-0 top-0 z-[51] h-screen flex flex-col",
          "bg-[#FBFBFD]/85 backdrop-blur-2xl border-r border-slate-200/70 shadow-[1px_0_16px_rgba(0,0,0,0.03)]",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16 w-64"
        )}
      >
        {/* ─── Logo Header ─── */}
        <div
          className={cn(
            "flex items-center h-16 shrink-0 border-b border-slate-200/50",
            isOpen ? "px-4 justify-between" : "px-2 justify-center"
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <Image
                src="https://irp.cdn-website.com/2f73b385/dms3rep/multi/SPINDO+MAIN+LOGO.png"
                alt="SPINDO Logo"
                width={36}
                height={36}
                className="object-contain scale-[1.6]"
              />
            </div>
            {isOpen && (
              <div className="overflow-hidden min-w-0">
                <span className="text-[15px] font-black text-slate-900 tracking-tight block leading-tight">
                  SPINDO
                </span>
                <span className="text-[9px] font-bold text-slate-400 tracking-[0.18em] uppercase block leading-tight mt-0.5">
                  Warehouse Ops
                </span>
              </div>
            )}
          </div>

          {isOpen && (
            <button
              type="button"
              onClick={toggle}
              className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-apple shrink-0 cursor-pointer"
              title="Sembunyikan sidebar"
            >
              <PanelLeftClose size={16} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 space-y-1 px-2.5 py-4 overflow-x-hidden overflow-y-auto">
          {/* Main Menu Section */}
          <div className={cn("px-3 pt-1 pb-1", isOpen ? "block" : "sr-only")}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Menu
            </span>
          </div>
          {baseMenuItems.map(renderMenuItem)}

          {/* Admin Section */}
          {session.user?.role === "admin" && (
            <>
              <div className={cn("px-3 pt-5 pb-1", isOpen ? "block" : "sr-only")}>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Administrasi
                </span>
              </div>
              {adminMenuItems.map(renderMenuItem)}
            </>
          )}

          {/* Preferences Section */}
          <div className={cn("px-3 pt-5 pb-1", isOpen ? "block" : "sr-only")}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
              Preferensi
            </span>
          </div>
          {settingsMenuItems.map(renderMenuItem)}
        </nav>

        {/* ─── User Profile ─── */}
        <div
          className={cn(
            "shrink-0 border-t border-slate-200/50",
            isOpen ? "p-3" : "p-2"
          )}
        >
          {isOpen ? (
            <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white/70 border border-slate-200/60 shadow-apple-sm">
              <div className="relative shrink-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-300/70 flex items-center justify-center text-slate-700 font-bold text-xs shadow-sm">
                  {session.user?.name?.substring(0, 2).toUpperCase() || "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#34C759]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate leading-tight">
                  {session.user?.name}
                </p>
                <div className="mt-0.5">
                  {session.user?.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md leading-none">
                      <ShieldCheck size={9} strokeWidth={2.5} />
                      Admin
                    </span>
                  ) : session.user?.gudangId ? (
                    <span className="inline-flex items-center text-[9.5px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md leading-none">
                      {GUDANG_LIST.find((g) => g.gudangId === session.user!.gudangId)?.name ||
                        `Gudang ${session.user.gudangId}`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">User</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center justify-center rounded-xl p-1.5 text-slate-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-apple cursor-pointer shrink-0"
                title="Sign out"
              >
                <LogOut size={15} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-b from-slate-100 to-slate-200 border border-slate-300/70 flex items-center justify-center text-slate-700 font-bold text-xs shadow-sm">
                  {session.user?.name?.substring(0, 2).toUpperCase() || "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#34C759]" />
              </div>
              <button
                type="button"
                onClick={() => signOut()}
                className="flex items-center justify-center rounded-xl p-2 text-slate-400 hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-apple cursor-pointer w-full"
                title="Sign out"
              >
                <LogOut size={15} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* ─── Toggle Button (Floating Edge) ─── */}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "absolute -right-3 top-20 z-50",
            "hidden md:flex items-center justify-center",
            "w-6 h-6 rounded-full",
            "bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-500",
            "hover:bg-[#007AFF] hover:border-[#007AFF] hover:text-white hover:scale-110",
            "shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition-all duration-200 ease-out cursor-pointer",
            "opacity-0 -translate-x-1.5 pointer-events-none scale-90",
            "group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:scale-100 group-hover/sidebar:pointer-events-auto",
            "before:absolute before:-inset-2 before:content-['']"
          )}
          title={isOpen ? "Tutup sidebar" : "Buka sidebar"}
        >
          {isOpen ? (
            <ChevronLeft size={12} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={12} strokeWidth={2.5} />
          )}
        </button>
      </aside>
    </>
  );
}
