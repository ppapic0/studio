import type { User } from 'firebase/auth';

type MembershipApiResponse = {
  memberships?: Array<{
    id: string;
    role?: string;
    status?: string;
    displayName?: string;
    className?: string;
    phoneNumber?: string;
    linkedStudentIds?: string[];
    joinedAtMs?: number | null;
  }>;
};

type TimestampLike = {
  toMillis: () => number;
};

export type RecoveredMembership = {
  id: string;
  role?: string;
  status?: string;
  displayName?: string;
  className?: string;
  phoneNumber?: string;
  linkedStudentIds?: string[];
  joinedAt?: TimestampLike;
};

function toTimestampLike(joinedAtMs?: number | null): TimestampLike | undefined {
  if (typeof joinedAtMs !== 'number' || !Number.isFinite(joinedAtMs)) {
    return undefined;
  }

  return {
    toMillis: () => joinedAtMs,
  };
}

export async function recoverLegacyMemberships(user: User): Promise<RecoveredMembership[]> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/auth/memberships', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`legacy-membership-recovery-failed:${response.status}`);
  }

  const payload = (await response.json()) as MembershipApiResponse;
  const memberships = Array.isArray(payload.memberships) ? payload.memberships : [];

  return memberships
    .filter((membership): membership is NonNullable<MembershipApiResponse['memberships']>[number] => {
      return typeof membership?.id === 'string' && membership.id.trim().length > 0;
    })
    .map((membership) => ({
      id: membership.id,
      role: membership.role,
      status: membership.status,
      displayName: membership.displayName,
      className: membership.className,
      phoneNumber: membership.phoneNumber,
      linkedStudentIds: membership.linkedStudentIds,
      joinedAt: toTimestampLike(membership.joinedAtMs),
    }));
}
