import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { isMissingAdminCredentialsError } from '@/lib/firebase-admin';
import { getVerifiedServerSession } from '@/lib/server-auth-session';
import {
  canAccessDashboardPath,
  getServerDashboardMemberships,
} from '@/lib/server-dashboard-access';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const pathname = headerStore.get('x-track-pathname') || '/dashboard';
  const session = await getVerifiedServerSession();
  if (!session) {
    redirect('/login');
  }

  let memberships = [] as Awaited<ReturnType<typeof getServerDashboardMemberships>>;
  let skipServerPathGuard = false;

  try {
    memberships = await getServerDashboardMemberships(session.uid);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && isMissingAdminCredentialsError(error)) {
      skipServerPathGuard = true;
    } else {
      throw error;
    }
  }

  if (!skipServerPathGuard && !canAccessDashboardPath(pathname, memberships)) {
    redirect('/dashboard');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
