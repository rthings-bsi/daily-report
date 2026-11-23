'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';
import { SidebarProvider } from '@/components/SidebarContext';
import { SettingsProvider } from '@/components/SettingsProvider';
import LayoutContent from '@/components/LayoutContent';

const ChatBot = dynamic(() => import('@/components/ChatBot'), { ssr: false });

interface AuthenticatedShellProps {
  session: Session;
  children: React.ReactNode;
}

export default function AuthenticatedShell({ session, children }: AuthenticatedShellProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <SidebarProvider>
        <SettingsProvider>
          <LayoutContent>{children}</LayoutContent>
          <ChatBot />
        </SettingsProvider>
      </SidebarProvider>
    </SessionProvider>
  );
}
