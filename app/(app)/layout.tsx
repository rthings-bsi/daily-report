import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AuthenticatedShell from '@/components/AuthenticatedShell';

export default async function AppGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <AuthenticatedShell session={session}>{children}</AuthenticatedShell>;
}
