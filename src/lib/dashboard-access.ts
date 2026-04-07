import { isValid, parseISO } from 'date-fns';

type MembershipLike = {
  id: string;
  role?: string | null;
  status?: string | null;
};

function normalizeMembershipStatus(status?: string | null) {
  return typeof status === 'string' ? status.trim().toLowerCase().replace(/[\s_-]+/g, '') : '';
}

function normalizeMembershipRole(role?: string | null) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase().replace(/[\s_-]+/g, '') : '';
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'centermanager' || normalized === 'centeradmin') {
    return 'centerAdmin';
  }
  if (normalized === 'teacher') return 'teacher';
  if (normalized === 'parent') return 'parent';
  if (normalized === 'student') return 'student';
  return '';
}

export function isActiveMembershipStatus(status?: string | null) {
  const normalized = normalizeMembershipStatus(status);
  return !normalized || normalized === 'active' || normalized === 'approved' || normalized === 'enabled' || normalized === 'current';
}

export function isAdminRole(role?: string | null) {
  return normalizeMembershipRole(role) === 'centerAdmin';
}

export function isTeacherOrAdminRole(role?: string | null) {
  return normalizeMembershipRole(role) === 'teacher' || isAdminRole(role);
}

export function canReadSharedOps(role?: string | null) {
  return isTeacherOrAdminRole(role);
}

export function canReadLeadOps(role?: string | null) {
  return isTeacherOrAdminRole(role);
}

export function canReadFinance(role?: string | null) {
  return isAdminRole(role);
}

export function canManageSettings(role?: string | null) {
  return isAdminRole(role);
}

export function canManageStaff(role?: string | null) {
  return isAdminRole(role);
}

export function canRunExports(role?: string | null) {
  return isAdminRole(role);
}

export function resolveMembershipByRole(
  activeMembership: MembershipLike | null | undefined,
  memberships: MembershipLike[] | null | undefined,
  matcher: (membership: MembershipLike) => boolean
) {
  if (activeMembership && matcher(activeMembership)) {
    return activeMembership;
  }

  return memberships?.find(matcher) || null;
}

export function parseDateInputValue(value: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}
