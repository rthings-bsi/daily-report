"use client";

import { usePathname } from "next/navigation";
import { useSidebar } from "./SidebarContext";
import Sidebar from "./Sidebar";
import type { ReactNode } from "react";

export default function LayoutContent({ children }: { children: ReactNode }) {
  const { isOpen } = useSidebar();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        style={{
          marginLeft: isOpen ? 256 : 64,
          transition: 'margin-left 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="flex-1"
      >
        {children}
      </main>
    </div>
  );
}
