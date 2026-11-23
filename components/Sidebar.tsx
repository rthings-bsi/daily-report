"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import spindoLogo from "@/app/icon.png";
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
  Wrench,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { GUDANG_LIST } from "@/lib/gudang";
import { useSidebar } from "./SidebarContext";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ElementType;
  moduleId?: string;
}

const baseMenuItems: MenuItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, moduleId: "dashboard" },
  { name: "Data Pipa NC", href: "/pipa-nc", icon: ClipboardList, moduleId: "pipa-nc" },
  { name: "Repair & Packing", href: "/repair-packing", icon: Wrench, moduleId: "repair-packing" },
  { name: "Audit SLoc", href: "/audit-sloc", icon: ClipboardCheck, moduleId: "audit-sloc" },
  { name: "Upload Data", href: "/upload", icon: FileUp, moduleId: "upload" },
];

const adminMenuItems: MenuItem[] = [
  { name: "Manajemen User", href: "/admin/users", icon: Users, moduleId: "admin-users" },
  { name: "Konfigurasi Role", href: "/admin/roles", icon: ShieldCheck, moduleId: "admin-roles" },
];

const settingsMenuItems: MenuItem[] = [
  { name: "Settings", href: "/settings", icon: Settings, moduleId: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOpen, toggle } = useSidebar();

  const userRole = session?.user?.role?.toLowerCase() || "";
  const isAdmin = userRole === "admin";
  const userPerms = session?.user?.permissions || [];
  const isRepairRole =
    userRole === "repair" ||
    userRole === "rep" ||
    userRole.includes("repair") ||
    (!userPerms.includes("dashboard") && userPerms.includes("repair-packing"));

  const canAccess = (item: MenuItem) => {
    if (isAdmin) return true;
    if (!item.moduleId) return true;
    return userPerms.includes(item.moduleId);
  };

  const visibleBaseMenuItems = useMemo(() => {
    if (!session) return [];
    let items = baseMenuItems.filter(canAccess);
    if (isRepairRole) {
      items = items.map((it) => {
        if (it.moduleId === "repair-packing") {
          return { ...it, name: "Dashboard Repair" };
        }
        return it;
      });
      return [...items].sort((a, b) => {
        if (a.moduleId === "repair-packing") return -1;
        if (b.moduleId === "repair-packing") return 1;
        return 0;
      });
    }
    return items;
  }, [session, isAdmin, userPerms, isRepairRole]);

  if (!session) return null;

  const visibleAdminMenuItems = adminMenuItems.filter(canAccess);
  const visibleSettingsMenuItems = settingsMenuItems.filter(canAccess);

  const renderMenuItem = (item: MenuItem) => {
    const isActive = pathname === item.href;
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={true}
        title={!isOpen ? item.name : undefined}
        className={cn(
          "group relative flex items-center rounded-xl transition-neu select-none",
          isOpen ? "px-3 py-2.5 gap-3" : "justify-center py-2.5 px-1.5",
          isActive
            ? "neu-inset-sm text-[var(--neu-accent)] font-bold"
            : "text-[var(--neu-text-secondary)] hover:text-[var(--neu-text)] hover:bg-[var(--neu-surface)]/70 hover:shadow-[var(--neu-shadow-xs)]"
        )}
      >
        <div
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-neu",
            isActive
              ? "bg-[var(--neu-surface)] text-[var(--neu-accent)] shadow-[var(--neu-shadow-xs)] border border-[var(--neu-border)]"
              : "text-[var(--neu-text-muted)] group-hover:text-[var(--neu-accent)]"
          )}
        >
          <item.icon size={16} strokeWidth={isActive ? 2.4 : 2} />
        </div>

        {isOpen && (
          <>
            <span className={cn("flex-1 text-[13px] truncate", isActive ? "font-bold text-[var(--neu-accent)]" : "font-semibold")}>
              {item.name}
            </span>
            {isActive && (
              <span className="w-2 h-2 rounded-full bg-[var(--neu-accent)] shrink-0" />
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
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] md:hidden"
          onClick={toggle}
        />
      )}

      <aside
        className={cn(
          "group/sidebar fixed left-0 top-0 z-[51] h-screen flex flex-col",
          "bg-[var(--neu-sidebar)] border-r border-[var(--neu-divider)]",
          "shadow-[6px_0_18px_-6px_var(--neu-shadow-dark)]",
          "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-16 w-64"
        )}
      >
        {/* ─── Brand Header ─── */}
        <Link
          href={isRepairRole ? "/repair-packing" : "/"}
          className={cn(
            "flex items-center h-16 shrink-0 border-b border-[var(--neu-divider)] transition-colors",
            isOpen ? "px-4 justify-between" : "px-2 justify-center"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl neu-logo-well flex items-center justify-center shrink-0 overflow-hidden p-1">
              <Image
                src={spindoLogo}
                alt="SPINDO Logo"
                width={28}
                height={17}
                className="object-contain"
              />
            </div>
            {isOpen && (
              <div className="overflow-hidden min-w-0">
                <span className="text-[15px] font-extrabold text-[var(--neu-text)] tracking-tight block leading-none">
                  SPINDO
                </span>
                <span className="font-mono text-[10px] font-medium text-[var(--neu-text-muted)] block leading-tight mt-1 truncate">
                  {isRepairRole ? "Repair & Packing" : "Warehouse Ops"}
                </span>
              </div>
            )}
          </div>
        </Link>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-x-hidden overflow-y-auto">
          {visibleBaseMenuItems.length > 0 && (
            <>
              <div className={cn("px-2 pt-1 pb-1.5", isOpen ? "block" : "sr-only")}>
                <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                  Operasional
                </span>
              </div>
              {visibleBaseMenuItems.map(renderMenuItem)}
            </>
          )}

          {visibleAdminMenuItems.length > 0 && (
            <>
              <div className={cn("px-2 pt-5 pb-1.5", isOpen ? "block" : "sr-only")}>
                <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                  Administrasi
                </span>
              </div>
              {visibleAdminMenuItems.map(renderMenuItem)}
            </>
          )}

          {visibleSettingsMenuItems.length > 0 && (
            <>
              <div className={cn("px-2 pt-5 pb-1.5", isOpen ? "block" : "sr-only")}>
                <span className="font-mono text-[10px] font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider">
                  Sistem
                </span>
              </div>
              {visibleSettingsMenuItems.map(renderMenuItem)}
            </>
          )}
        </nav>

        {/* ─── User Profile Dock ─── */}
        <div
          className={cn(
            "shrink-0 border-t border-[var(--neu-divider)]",
            isOpen ? "p-3.5" : "p-2"
          )}
        >
          {isOpen ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl neu-card-sm">
              <div className="relative shrink-0">
                <div className="h-9 w-9 rounded-full neu-inset-sm flex items-center justify-center text-[var(--neu-accent)] font-extrabold text-xs">
                  {session.user?.name?.substring(0, 2).toUpperCase() || "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--neu-surface)] bg-[var(--neu-green-bar)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[var(--neu-text)] truncate leading-tight">
                  {session.user?.name}
                </p>
                <div className="mt-1">
                  {session.user?.role === "admin" ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[var(--neu-accent)] bg-[var(--neu-accent-soft)] px-1.5 py-0.5 rounded-md leading-none">
                      <ShieldCheck size={9} strokeWidth={2.5} />
                      Admin
                    </span>
                  ) : session.user?.gudangId ? (
                    <span className="inline-flex items-center font-mono text-[10px] font-semibold text-[var(--neu-text-secondary)] neu-inset-sm px-1.5 py-0.5 rounded-md leading-none">
                      {GUDANG_LIST.find((g) => g.gudangId === session.user!.gudangId)?.name ||
                        `Gudang ${session.user.gudangId}`}
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[var(--neu-text-muted)]">User</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center justify-center rounded-xl p-2 neu-btn text-[var(--neu-text-muted)] hover:text-[var(--neu-red)] cursor-pointer shrink-0"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={14} strokeWidth={2.2} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="h-9 w-9 rounded-full neu-inset-sm flex items-center justify-center text-[var(--neu-accent)] font-extrabold text-xs">
                  {session.user?.name?.substring(0, 2).toUpperCase() || "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--neu-surface)] bg-[var(--neu-green-bar)]" />
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center justify-center rounded-xl p-2 neu-btn text-[var(--neu-text-muted)] hover:text-[var(--neu-red)] cursor-pointer w-full"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={14} strokeWidth={2.2} />
              </button>
            </div>
          )}
        </div>

        {/* ─── Floating Edge Collapse Button ─── */}
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "absolute -right-3.5 top-20 z-50",
            "hidden md:flex items-center justify-center",
            "w-7 h-7 rounded-full neu-btn text-[var(--neu-text-secondary)]",
            "hover:text-[var(--neu-accent)] cursor-pointer",
            "opacity-0 -translate-x-1 pointer-events-none",
            "group-hover/sidebar:opacity-100 group-hover/sidebar:translate-x-0 group-hover/sidebar:pointer-events-auto",
            "before:absolute before:-inset-2 before:content-['']"
          )}
          title={isOpen ? "Tutup sidebar" : "Buka sidebar"}
          aria-label={isOpen ? "Tutup sidebar" : "Buka sidebar"}
        >
          {isOpen ? (
            <ChevronLeft size={13} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={13} strokeWidth={2.5} />
          )}
        </button>
      </aside>
    </>
  );
}
