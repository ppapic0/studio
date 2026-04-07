import { redirect } from 'next/navigation';

import { getVerifiedServerSession } from '@/lib/server-auth-session';
import {
  canAccessDashboardPath,
  getServerDashboardMemberships,
} from '@/lib/server-dashboard-access';

export default async function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getVerifiedServerSession();
  if (!session) {
    redirect('/login?next=%2Fkiosk');
  }

  const memberships = await getServerDashboardMemberships(session.uid);
  if (!canAccessDashboardPath('/kiosk', memberships)) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
