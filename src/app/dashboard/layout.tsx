import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { isMissingAdminCredentialsError } from '@/lib/firebase-admin';
import { getVerifiedServerSession } from '@/lib/server-auth-session';
import {
  canAccessDashboardPath,
  getServerDashboardMemberships,
  resolveDefaultDashboardMembership,
} from '@/lib/server-dashboard-access';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get('x-track-pathname') || '/dashboard';
  let session = null as Awaited<ReturnType<typeof getVerifiedServerSession>>;
  let skipServerAuthGuard = false;

  try {
    session = await getVerifiedServerSession();
  } catch (error) {
    if (isMissingAdminCredentialsError(error)) {
      skipServerAuthGuard = true;
    } else {
      throw error;
    }
  }

  if (!session && !skipServerAuthGuard) {
    redirect('/login');
  }

  let memberships = [] as Awaited<ReturnType<typeof getServerDashboardMemberships>>;
  let skipServerPathGuard = skipServerAuthGuard;

  if (session) {
    try {
      memberships = await getServerDashboardMemberships(session.uid);
    } catch (error) {
      if (isMissingAdminCredentialsError(error)) {
        skipServerPathGuard = true;
      } else {
        throw error;
      }
    }
  }

  if (session && !skipServerPathGuard && !canAccessDashboardPath(pathname, memberships)) {
    redirect('/dashboard');
  }

  const defaultMembership = resolveDefaultDashboardMembership(memberships);
  if (session && !skipServerPathGuard && defaultMembership?.role === 'kiosk') {
    redirect('/kiosk');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
