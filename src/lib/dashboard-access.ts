import { isValid, parseISO } from 'date-fns';

type MembershipLike = {
  id: string;
  role?: string | null;
  status?: string | null;
};

function normalizeMembershipStatusValue(value?: string | null) {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

function normalizeMembershipRoleValue(value?: string | null) {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[_\s-]+/g, '');
}

export function isActiveMembershipStatus(status?: string | null) {
  const normalized = normalizeMembershipStatusValue(status);
  return !normalized || normalized === 'active' || normalized === 'approved' || normalized === 'enabled' || normalized === 'current';
}

export function isAdminRole(role?: string | null) {
  const normalized = normalizeMembershipRoleValue(role);
  return normalized === 'centeradmin' || normalized === 'owner' || normalized === 'centermanager' || normalized === 'admin';
}

export function isTeacherOrAdminRole(role?: string | null) {
  return normalizeMembershipRoleValue(role) === 'teacher' || isAdminRole(role);
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
