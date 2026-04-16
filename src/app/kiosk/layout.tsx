import { redirect } from 'next/navigation';

import { isMissingAdminCredentialsError } from '@/lib/firebase-admin';
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
  let session = null as Awaited<ReturnType<typeof getVerifiedServerSession>>;
  let skipServerGuard = false;

  try {
    session = await getVerifiedServerSession();
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      skipServerGuard = true;
    } else {
      throw error;
    }
  }

  if (!session && !skipServerGuard) {
    redirect('/login?next=%2Fkiosk');
  }

  if (session && !skipServerGuard) {
    try {
      const memberships = await getServerDashboardMemberships(session.uid);
      if (!canAccessDashboardPath('/kiosk', memberships)) {
        redirect('/dashboard');
      }
    } catch (error) {
      if (!isMissingAdminCredentialsError(error)) {
        throw error;
      }
    }
  }

  return <>{children}</>;
}
