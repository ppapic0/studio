export type StudentRankRange = 'daily' | 'weekly' | 'monthly';

export type StudentRankEntry = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  schoolNameSnapshot?: string | null;
  value: number;
  rank: number;
  liveStatus?: 'studying' | 'away' | 'break' | null;
  liveStartedAtMs?: number | null;
};

export type StudentRankingSnapshot = Record<StudentRankRange, StudentRankEntry[]> & {
  dailyWaitingTopMinutes?: number | null;
  dateKey?: string | null;
  generatedAt?: string | null;
};

export const EMPTY_STUDENT_RANKING_SNAPSHOT: StudentRankingSnapshot = {
  daily: [],
  weekly: [],
  monthly: [],
  dailyWaitingTopMinutes: null,
  dateKey: null,
  generatedAt: null,
};

type IdTokenUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export async function fetchStudentRankingSnapshot({
  centerId,
  user,
  dateKey,
}: {
  centerId: string;
  user: IdTokenUser;
  dateKey?: string | null;
}): Promise<StudentRankingSnapshot> {
  const token = await user.getIdToken();
  const params = new URLSearchParams({ centerId });
  if (dateKey) {
    params.set('dateKey', dateKey);
  }
  const response = await fetch(`/api/student-rankings?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`student-rankings-fetch-failed:${response.status}`);
  }

  const payload = (await response.json()) as Partial<StudentRankingSnapshot>;

  return {
    daily: Array.isArray(payload.daily) ? payload.daily : [],
    weekly: Array.isArray(payload.weekly) ? payload.weekly : [],
    monthly: Array.isArray(payload.monthly) ? payload.monthly : [],
    dailyWaitingTopMinutes: Number.isFinite(Number(payload.dailyWaitingTopMinutes))
      ? Math.max(0, Number(payload.dailyWaitingTopMinutes))
      : null,
    dateKey: typeof payload.dateKey === 'string' ? payload.dateKey : null,
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : null,
  };
}
