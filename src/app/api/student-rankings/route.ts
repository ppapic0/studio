import { NextRequest, NextResponse } from 'next/server';
import { eachDayOfInterval, format, startOfWeek } from 'date-fns';

import { adminAuth, adminDb } from '@/lib/firebase-admin';

type RankRange = 'daily' | 'weekly' | 'monthly';

type RankEntry = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  schoolNameSnapshot: string | null;
  value: number;
  rank: number;
};

type StudentRankingSnapshot = Record<RankRange, RankEntry[]>;

const EMPTY_SNAPSHOT: StudentRankingSnapshot = {
  daily: [],
  weekly: [],
  monthly: [],
};

function normalizeMembershipStatus(value: unknown) {
  if (typeof value !== 'string') return 'active';
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!normalized || normalized === 'active' || normalized === 'approved' || normalized === 'enabled' || normalized === 'current') {
    return 'active';
  }
  if (normalized === 'onhold' || normalized === 'pending') return 'onHold';
  if (normalized === 'inactive' || normalized === 'withdrawn') return 'withdrawn';
  return 'active';
}

function isSyntheticStudentId(studentId: unknown): boolean {
  if (typeof studentId !== 'string') return true;
  const normalized = studentId.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith('test-')
    || normalized.startsWith('seed-')
    || normalized.startsWith('mock-')
    || normalized.includes('dummy')
  );
}

function applyCompetitionRanks(entries: Omit<RankEntry, 'rank'>[]): RankEntry[] {
  const sorted = [...entries].sort((left, right) => right.value - left.value);
  let lastValue: number | null = null;
  let currentRank = 0;

  return sorted.map((entry, index) => {
    if (lastValue === null || entry.value < lastValue) {
      currentRank = index + 1;
      lastValue = entry.value;
    }
    return {
      ...entry,
      rank: currentRank,
    };
  });
}

async function hasCenterAccess(uid: string, centerId: string) {
  const [userCenterSnap, memberSnap] = await Promise.all([
    adminDb.doc(`userCenters/${uid}/centers/${centerId}`).get(),
    adminDb.doc(`centers/${centerId}/members/${uid}`).get(),
  ]);

  const userCenterStatus = normalizeMembershipStatus(userCenterSnap.data()?.status);
  if (userCenterSnap.exists && userCenterStatus === 'active') {
    return true;
  }

  const memberStatus = normalizeMembershipStatus(memberSnap.data()?.status);
  return memberSnap.exists && memberStatus === 'active';
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const centerId = request.nextUrl.searchParams.get('centerId')?.trim() || '';

  if (!idToken) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!centerId) {
    return NextResponse.json({ error: 'centerId-required' }, { status: 400 });
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const allowed = await hasCenterAccess(uid, centerId);
    if (!allowed) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const monthKey = format(today, 'yyyy-MM');
    const weekDateKeys = eachDayOfInterval({
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: today,
    }).map((date) => format(date, 'yyyy-MM-dd'));

    const membersSnapPromise = adminDb
      .collection(`centers/${centerId}/members`)
      .where('role', '==', 'student')
      .get();
    const dailySnapPromise = adminDb
      .collection(`centers/${centerId}/dailyStudentStats/${todayKey}/students`)
      .get();
    const monthlySnapPromise = adminDb
      .collection(`centers/${centerId}/leaderboards/${monthKey}_study-time/entries`)
      .orderBy('value', 'desc')
      .limit(400)
      .get();
    const weeklySnapPromises = weekDateKeys.map((dateKey) =>
      adminDb.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
    );

    const [membersSnap, dailySnap, monthlySnap, ...weeklySnaps] = await Promise.all([
      membersSnapPromise,
      dailySnapPromise,
      monthlySnapPromise,
      ...weeklySnapPromises,
    ]);

    const memberProfiles = new Map<string, {
      displayNameSnapshot: string;
      classNameSnapshot: string | null;
      schoolNameSnapshot: string | null;
    }>();
    const activeStudentIds = new Set<string>();

    membersSnap.forEach((docSnap) => {
      const studentId = docSnap.id;
      if (isSyntheticStudentId(studentId)) return;

      const data = docSnap.data() as Record<string, unknown>;
      if (normalizeMembershipStatus(data.status) !== 'active') return;

      activeStudentIds.add(studentId);
      memberProfiles.set(studentId, {
        displayNameSnapshot: typeof data.displayName === 'string' && data.displayName.trim()
          ? data.displayName.trim()
          : '학생',
        classNameSnapshot: typeof data.className === 'string' && data.className.trim()
          ? data.className.trim()
          : null,
        schoolNameSnapshot: typeof data.schoolName === 'string' && data.schoolName.trim()
          ? data.schoolName.trim()
          : typeof data.schoolNameSnapshot === 'string' && data.schoolNameSnapshot.trim()
            ? data.schoolNameSnapshot.trim()
            : null,
      });
    });

    const shouldInclude = (studentId: string) => activeStudentIds.size === 0 || activeStudentIds.has(studentId);
    const getProfile = (studentId: string) => memberProfiles.get(studentId) || {
      displayNameSnapshot: '학생',
      classNameSnapshot: null,
      schoolNameSnapshot: null,
    };

    const dailyEntries = applyCompetitionRanks(
      dailySnap.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
          const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
          if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return null;
          const profile = getProfile(studentId);
          return {
            id: studentId,
            studentId,
            displayNameSnapshot: profile.displayNameSnapshot,
            classNameSnapshot: profile.classNameSnapshot,
            schoolNameSnapshot: profile.schoolNameSnapshot,
            value,
          };
        })
        .filter((entry): entry is Omit<RankEntry, 'rank'> => Boolean(entry))
    );

    const weeklyTotals = new Map<string, number>();
    weeklySnaps.forEach((snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        weeklyTotals.set(studentId, (weeklyTotals.get(studentId) || 0) + value);
      });
    });

    const weeklyEntries = applyCompetitionRanks(
      Array.from(weeklyTotals.entries()).map(([studentId, value]) => {
        const profile = getProfile(studentId);
        return {
          id: `weekly-${studentId}`,
          studentId,
          displayNameSnapshot: profile.displayNameSnapshot,
          classNameSnapshot: profile.classNameSnapshot,
          schoolNameSnapshot: profile.schoolNameSnapshot,
          value,
        };
      })
    );

    const monthlyEntries = applyCompetitionRanks(
      monthlySnap.docs
        .map((docSnap) => {
          const data = docSnap.data() as Record<string, unknown>;
          const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
          const value = Math.max(0, Number(data.value ?? 0));
          if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return null;
          const profile = getProfile(studentId);
          return {
            id: docSnap.id,
            studentId,
            displayNameSnapshot: typeof data.displayNameSnapshot === 'string' && data.displayNameSnapshot.trim()
              ? data.displayNameSnapshot.trim()
              : profile.displayNameSnapshot,
            classNameSnapshot: typeof data.classNameSnapshot === 'string' && data.classNameSnapshot.trim()
              ? data.classNameSnapshot.trim()
              : profile.classNameSnapshot,
            schoolNameSnapshot: typeof data.schoolNameSnapshot === 'string' && data.schoolNameSnapshot.trim()
              ? data.schoolNameSnapshot.trim()
              : profile.schoolNameSnapshot,
            value,
          };
        })
        .filter((entry): entry is Omit<RankEntry, 'rank'> => Boolean(entry))
    );

    return NextResponse.json({
      ...EMPTY_SNAPSHOT,
      daily: dailyEntries,
      weekly: weeklyEntries,
      monthly: monthlyEntries,
    });
  } catch (error) {
    console.error('[student-rankings] query failed', error);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
