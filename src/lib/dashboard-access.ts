import { isValid, parseISO } from 'date-fns';

type MembershipLike = {
  id: string;
  role?: string | null;
  status?: string | null;
};

export function isActiveMembershipStatus(status?: string | null) {
  return !status || status === 'active';
}

export function isAdminRole(role?: string | null) {
  return role === 'centerAdmin' || role === 'owner';
}

export function isTeacherOrAdminRole(role?: string | null) {
  return role === 'teacher' || isAdminRole(role);
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
