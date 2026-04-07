import 'server-only';

import { adminDb } from '@/lib/firebase-admin';
import {
  canManageSettings,
  canReadFinance,
  canReadLeadOps,
  canReadSharedOps,
  isActiveMembershipStatus,
  isAdminRole,
  resolveMembershipByRole,
} from '@/lib/dashboard-access';

type DashboardMembership = {
  id: string;
  role?: string | null;
  status?: string | null;
  joinedAt?: { toMillis?: () => number } | null;
  linkedStudentIds?: unknown;
};

type DashboardRouteAccess = 'any' | 'sharedOps' | 'leadOps' | 'finance' | 'settings';

const DASHBOARD_ACCESS_RULES: Array<{
  access: DashboardRouteAccess;
  matcher: (pathname: string) => boolean;
}> = [
  {
    access: 'finance',
    matcher: (pathname) =>
      pathname.startsWith('/dashboard/revenue') || pathname.startsWith('/dashboard/analytics'),
  },
  {
    access: 'settings',
    matcher: (pathname) =>
      pathname.startsWith('/dashboard/settings'),
  },
  {
    access: 'leadOps',
    matcher: (pathname) =>
      pathname.startsWith('/dashboard/leads'),
  },
  {
    access: 'sharedOps',
    matcher: (pathname) =>
      pathname === '/kiosk' ||
      pathname.startsWith('/dashboard/kiosk') ||
      pathname.startsWith('/dashboard/teacher') ||
      pathname.startsWith('/dashboard/attendance') ||
      pathname.startsWith('/dashboard/analysis') ||
      pathname.startsWith('/dashboard/reports') ||
      pathname.startsWith('/dashboard/student-reports') ||
      pathname.startsWith('/dashboard/study-history') ||
      pathname.startsWith('/dashboard/appointments'),
  },
];

function hasLinkedStudents(membership: DashboardMembership) {
  return (
    Array.isArray(membership.linkedStudentIds) &&
    membership.linkedStudentIds.some((id) => typeof id === 'string' && id.trim().length > 0)
  );
}

function getMembershipPriority(membership: DashboardMembership) {
  if (isAdminRole(membership.role)) return 0;
  if (membership.role === 'teacher') return 1;
  if (membership.role === 'parent' && hasLinkedStudents(membership)) return 2;
  if (membership.role === 'student') return 3;
  return 4;
}

export function getDashboardRouteAccess(pathname: string): DashboardRouteAccess {
  const matchedRule = DASHBOARD_ACCESS_RULES.find((rule) => rule.matcher(pathname));
  return matchedRule?.access || 'any';
}

export async function getServerDashboardMemberships(uid: string): Promise<DashboardMembership[]> {
  const snapshot = await adminDb.collection('userCenters').doc(uid).collection('centers').get();
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      role: typeof data.role === 'string' ? data.role : null,
      status: typeof data.status === 'string' ? data.status : null,
      joinedAt: (data.joinedAt as DashboardMembership['joinedAt']) || null,
      linkedStudentIds: data.linkedStudentIds,
    } satisfies DashboardMembership;
  });
}

export function resolveDefaultDashboardMembership(
  memberships: DashboardMembership[],
): DashboardMembership | null {
  const activeMemberships = memberships.filter((membership) =>
    isActiveMembershipStatus(membership.status)
  );

  if (activeMemberships.length === 0) return null;

  return (
    [...activeMemberships].sort((a, b) => {
      const priorityDiff = getMembershipPriority(a) - getMembershipPriority(b);
      if (priorityDiff !== 0) return priorityDiff;

      const aJoinedAt = a.joinedAt?.toMillis?.() || 0;
      const bJoinedAt = b.joinedAt?.toMillis?.() || 0;
      return bJoinedAt - aJoinedAt;
    })[0] || null
  );
}

export function canAccessDashboardPath(
  pathname: string,
  memberships: DashboardMembership[],
): boolean {
  const access = getDashboardRouteAccess(pathname);
  if (access === 'any') return true;

  const defaultMembership = resolveDefaultDashboardMembership(memberships);

  if (access === 'settings') {
    return Boolean(
      resolveMembershipByRole(
        defaultMembership,
        memberships,
        (membership) =>
          canManageSettings(membership.role) && isActiveMembershipStatus(membership.status)
      )
    );
  }

  if (access === 'finance') {
    return Boolean(
      resolveMembershipByRole(
        defaultMembership,
        memberships,
        (membership) =>
          canReadFinance(membership.role) && isActiveMembershipStatus(membership.status)
      )
    );
  }

  if (access === 'leadOps') {
    return Boolean(
      resolveMembershipByRole(
        defaultMembership,
        memberships,
        (membership) =>
          canReadLeadOps(membership.role) && isActiveMembershipStatus(membership.status)
      )
    );
  }

  if (access === 'sharedOps') {
    return Boolean(
      resolveMembershipByRole(
        defaultMembership,
        memberships,
        (membership) =>
          canReadSharedOps(membership.role) && isActiveMembershipStatus(membership.status)
      )
    );
  }

  return true;
}
