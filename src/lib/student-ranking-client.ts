export type StudentRankRange = 'daily' | 'weekly' | 'monthly';

export type StudentRankEntry = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  value: number;
  rank: number;
};

export type StudentRankingSnapshot = Record<StudentRankRange, StudentRankEntry[]>;

export const EMPTY_STUDENT_RANKING_SNAPSHOT: StudentRankingSnapshot = {
  daily: [],
  weekly: [],
  monthly: [],
};

type IdTokenUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export async function fetchStudentRankingSnapshot({
  centerId,
  user,
}: {
  centerId: string;
  user: IdTokenUser;
}): Promise<StudentRankingSnapshot> {
  const token = await user.getIdToken();
  const response = await fetch(`/api/student-rankings?centerId=${encodeURIComponent(centerId)}`, {
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
  };
}
