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
    <div className="flex min-h-screen overflow-hidden">
      <Sidebar />
      <main
        className={`flex-1 transition-all duration-300 ease-in-out w-full ${isOpen ? 'md:ml-64' : 'md:ml-16'} ml-0`}
      >
        {children}
      </main>
    </div>
  );
}
