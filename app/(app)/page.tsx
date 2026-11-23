import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import DashboardClient from '@/components/DashboardClient';

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role?.toLowerCase() || '';
  const userPerms = session.user.permissions || [];
  const hasDashboardAccess = userRole === 'admin' || userPerms.includes('dashboard');
  const isRepairRole =
    userRole === 'repair' ||
    userRole === 'rep' ||
    userRole.includes('repair') ||
    (!hasDashboardAccess && userPerms.includes('repair-packing'));

  if (isRepairRole) {
    redirect('/repair-packing');
  }

  return <DashboardClient />;
}
