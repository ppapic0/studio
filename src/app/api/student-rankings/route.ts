import { NextRequest, NextResponse } from 'next/server';
import { eachDayOfInterval, format, startOfWeek } from 'date-fns';

import { noStoreJson } from '@/lib/api-security';
import { adminAuth, adminDb, isMissingAdminCredentialsError } from '@/lib/firebase-admin';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import { getDailyRankWindowState, toKstDate } from '@/lib/student-ranking-policy';

type RankRange = 'daily' | 'weekly' | 'monthly';
type ActiveLiveRankStatus = 'studying' | 'away' | 'break';

type RankEntry = {
  id: string;
  studentId: string;
  displayNameSnapshot: string;
  classNameSnapshot: string | null;
  schoolNameSnapshot: string | null;
  value: number;
  rank: number;
  liveStatus?: ActiveLiveRankStatus | null;
  liveStartedAtMs?: number | null;
};

type RankEntrySeed = Omit<RankEntry, 'rank'> & {
  liveStatus: ActiveLiveRankStatus | null;
  liveStartedAtMs: number | null;
};

type StudentRankingSnapshot = Record<RankRange, RankEntry[]>;

const EMPTY_SNAPSHOT: StudentRankingSnapshot = {
  daily: [],
  weekly: [],
  monthly: [],
};

export const dynamic = 'force-dynamic';

const ACTIVE_LIVE_RANK_STATUSES = new Set<ActiveLiveRankStatus>(['studying', 'away', 'break']);

function getAttendanceStatusRank(value: unknown) {
  if (value === 'studying') return 0;
  if (value === 'away' || value === 'break') return 1;
  if (value === 'absent') return 3;
  return 2;
}

function getActiveLiveRankStatus(value: unknown): ActiveLiveRankStatus | null {
  if (value === 'studying' || value === 'away' || value === 'break') return value;
  return null;
}

function toTimestampMillis(value: unknown) {
  if (value && typeof value === 'object') {
    if ('toMillis' in value && typeof value.toMillis === 'function') {
      return Number(value.toMillis());
    }
    if ('toDate' in value && typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}

function toKstDateKeyFromTimestamp(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return format(toKstDate(value.toDate()), 'yyyy-MM-dd');
  }
  if (value instanceof Date) {
    return format(toKstDate(value), 'yyyy-MM-dd');
  }
  return '';
}

function pickPreferredAttendanceRecord(records: Record<string, unknown>[]) {
  if (!records.length) return null;

  return [...records].sort((left, right) => {
    const statusRankDiff = getAttendanceStatusRank(left.status) - getAttendanceStatusRank(right.status);
    if (statusRankDiff !== 0) return statusRankDiff;

    const checkInPresenceDiff = Number(Boolean(right.lastCheckInAt)) - Number(Boolean(left.lastCheckInAt));
    if (checkInPresenceDiff !== 0) return checkInPresenceDiff;

    return toTimestampMillis(right.updatedAt) - toTimestampMillis(left.updatedAt);
  })[0] ?? null;
}

function getLiveAttendanceMinutes(attendance: Record<string, unknown>, nowMs: number) {
  const status = getActiveLiveRankStatus(attendance.status);
  if (!status) return 0;

  const startedAtMs = toTimestampMillis(attendance.lastCheckInAt);
  if (startedAtMs <= 0) return 0;

  return Math.max(1, Math.ceil((nowMs - startedAtMs) / 60000));
}

function registerLookup(map: Map<string, string | null>, key: string, studentId: string) {
  const normalizedKey = key.trim();
  if (!normalizedKey) return;

  const existing = map.get(normalizedKey);
  if (typeof existing === 'undefined') {
    map.set(normalizedKey, studentId);
    return;
  }
  if (existing !== studentId) {
    map.set(normalizedKey, null);
  }
}

function registerNumberLookup(map: Map<number, string | null>, key: number, studentId: string) {
  if (!Number.isFinite(key) || key <= 0) return;

  const existing = map.get(key);
  if (typeof existing === 'undefined') {
    map.set(key, studentId);
    return;
  }
  if (existing !== studentId) {
    map.set(key, null);
  }
}

function addRankMinutes(target: Map<string, number>, studentId: string, minutes: number) {
  if (minutes <= 0) return;
  target.set(studentId, (target.get(studentId) || 0) + minutes);
}

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

function normalizeRole(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function shouldTreatMemberAsStudent(role: unknown, hasStudentProfile: boolean) {
  const normalizedRole = normalizeRole(role);
  if (['teacher', 'centeradmin', 'admin', 'parent', 'staff', 'manager', 'owner'].includes(normalizedRole)) {
    return false;
  }
  if (hasStudentProfile) return true;
  return normalizedRole === 'student' || normalizedRole === 'learner';
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
    return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  }

  if (!centerId) {
    return noStoreJson({ error: 'centerId-required' }, { status: 400 });
  }

  let uid = '';
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return noStoreJson({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const allowed = await hasCenterAccess(uid, centerId);
    if (!allowed) {
      return noStoreJson({ error: 'forbidden' }, { status: 403 });
    }

    const nowKst = toKstDate();
    const dailyRankWindow = getDailyRankWindowState(nowKst);
    const dailyDateKeys = dailyRankWindow.coveredDateKeys;
    const dailyDateKeySet = new Set(dailyDateKeys);
    const monthKey = format(nowKst, 'yyyy-MM');
    const weekDateKeys = eachDayOfInterval({
      start: startOfWeek(nowKst, { weekStartsOn: 1 }),
      end: nowKst,
    }).map((date) => format(date, 'yyyy-MM-dd'));

    const membersSnapPromise = adminDb
      .collection(`centers/${centerId}/members`)
      .get();
    const studentsSnapPromise = adminDb
      .collection(`centers/${centerId}/students`)
      .get();
    const dailySnapPromises = dailyDateKeys.map((dateKey) =>
      adminDb.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
    );
    const monthlySnapPromise = adminDb
      .collection(`centers/${centerId}/leaderboards/${monthKey}_study-time/entries`)
      .orderBy('value', 'desc')
      .limit(400)
      .get();
    const attendanceSnapPromise = adminDb
      .collection(`centers/${centerId}/attendanceCurrent`)
      .get();
    const weeklySnapPromises = weekDateKeys.map((dateKey) =>
      adminDb.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
    );

    const [membersSnap, studentsSnap, monthlySnap, attendanceSnap, ...dailyAndWeeklySnaps] = await Promise.all([
      membersSnapPromise,
      studentsSnapPromise,
      monthlySnapPromise,
      attendanceSnapPromise,
      ...dailySnapPromises,
      ...weeklySnapPromises,
    ]);
    const dailySnaps = dailyAndWeeklySnaps.slice(0, dailySnapPromises.length);
    const weeklySnaps = dailyAndWeeklySnaps.slice(dailySnapPromises.length);

    const studentProfiles = new Map<string, {
      displayNameSnapshot: string;
      classNameSnapshot: string | null;
      schoolNameSnapshot: string | null;
      seatId: string | null;
      seatNo: number;
      roomId: string | null;
      roomSeatNo: number;
    }>();

    studentsSnap.forEach((docSnap) => {
      const studentId = docSnap.id;
      if (isSyntheticStudentId(studentId)) return;

      const data = docSnap.data() as Record<string, unknown>;
      const seatIdentity = resolveSeatIdentity({
        seatId: typeof data.seatId === 'string' ? data.seatId : undefined,
        seatNo: Number.isFinite(Number(data.seatNo)) ? Number(data.seatNo) : undefined,
        roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
        roomSeatNo: Number.isFinite(Number(data.roomSeatNo)) ? Number(data.roomSeatNo) : undefined,
      });
      studentProfiles.set(studentId, {
        displayNameSnapshot: typeof data.name === 'string' && data.name.trim()
          ? data.name.trim()
          : typeof data.displayName === 'string' && data.displayName.trim()
            ? data.displayName.trim()
            : '학생',
        classNameSnapshot: typeof data.className === 'string' && data.className.trim()
          ? data.className.trim()
          : null,
        schoolNameSnapshot: typeof data.schoolName === 'string' && data.schoolName.trim()
          ? data.schoolName.trim()
          : null,
        seatId: seatIdentity.seatId || null,
        seatNo: seatIdentity.seatNo,
        roomId: seatIdentity.roomId || null,
        roomSeatNo: seatIdentity.roomSeatNo,
      });
    });

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
      const hasStudentProfile = studentProfiles.has(studentId);
      if (!shouldTreatMemberAsStudent(data.role, hasStudentProfile)) return;
      if (normalizeMembershipStatus(data.status) !== 'active') return;

      activeStudentIds.add(studentId);
      const studentProfile = studentProfiles.get(studentId);
      memberProfiles.set(studentId, {
        displayNameSnapshot: typeof data.displayName === 'string' && data.displayName.trim()
          ? data.displayName.trim()
          : studentProfile?.displayNameSnapshot || '학생',
        classNameSnapshot: typeof data.className === 'string' && data.className.trim()
          ? data.className.trim()
          : studentProfile?.classNameSnapshot || null,
        schoolNameSnapshot: typeof data.schoolName === 'string' && data.schoolName.trim()
          ? data.schoolName.trim()
          : typeof data.schoolNameSnapshot === 'string' && data.schoolNameSnapshot.trim()
            ? data.schoolNameSnapshot.trim()
            : studentProfile?.schoolNameSnapshot || null,
      });
    });

    const shouldInclude = (studentId: string) => activeStudentIds.size === 0 || activeStudentIds.has(studentId);
    const getProfile = (studentId: string) => memberProfiles.get(studentId) || studentProfiles.get(studentId) || {
      displayNameSnapshot: '학생',
      classNameSnapshot: null,
      schoolNameSnapshot: null,
    };

    const seatIdToStudentId = new Map<string, string | null>();
    const roomSeatToStudentId = new Map<string, string | null>();
    const globalSeatNoToStudentId = new Map<number, string | null>();

    studentProfiles.forEach((profile, studentId) => {
      if (!shouldInclude(studentId)) return;

      if (profile.seatId) {
        registerLookup(seatIdToStudentId, profile.seatId, studentId);
      }
      if (profile.roomId && profile.roomSeatNo > 0) {
        registerLookup(roomSeatToStudentId, `${profile.roomId}:${profile.roomSeatNo}`, studentId);
      }
      if (profile.seatNo > 0) {
        registerNumberLookup(globalSeatNoToStudentId, profile.seatNo, studentId);
      }
    });

    const weeklyTotals = new Map<string, number>();
    const dailyTotals = new Map<string, number>();

    dailySnaps.forEach((snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        addRankMinutes(dailyTotals, studentId, value);
      });
    });

    weeklySnaps.forEach((snapshot) => {
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        addRankMinutes(weeklyTotals, studentId, value);
      });
    });

    const nowMs = Date.now();
    const weekDateKeySet = new Set(weekDateKeys);
    const attendanceBuckets = new Map<string, Record<string, unknown>[]>();
    const liveAttendanceMeta = new Map<string, { liveStatus: ActiveLiveRankStatus; liveStartedAtMs: number }>();

    attendanceSnap.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const directStudentId = typeof data.studentId === 'string' ? data.studentId.trim() : '';
      const seatIdentity = resolveSeatIdentity({
        id: docSnap.id,
        seatNo: Number.isFinite(Number(data.seatNo)) ? Number(data.seatNo) : undefined,
        roomId: typeof data.roomId === 'string' ? data.roomId : undefined,
        roomSeatNo: Number.isFinite(Number(data.roomSeatNo)) ? Number(data.roomSeatNo) : undefined,
      });
      const seatIdStudentId = seatIdentity.seatId ? seatIdToStudentId.get(seatIdentity.seatId) : undefined;
      const roomSeatStudentId = seatIdentity.roomId && seatIdentity.roomSeatNo > 0
        ? roomSeatToStudentId.get(`${seatIdentity.roomId}:${seatIdentity.roomSeatNo}`)
        : undefined;
      const globalSeatStudentId = seatIdentity.seatNo > 0
        ? globalSeatNoToStudentId.get(seatIdentity.seatNo)
        : undefined;
      const studentId = directStudentId
        || (typeof seatIdStudentId === 'string' ? seatIdStudentId : '')
        || (typeof roomSeatStudentId === 'string' ? roomSeatStudentId : '')
        || (typeof globalSeatStudentId === 'string' ? globalSeatStudentId : '');
      if (!studentId || isSyntheticStudentId(studentId) || !shouldInclude(studentId)) return;

      const current = attendanceBuckets.get(studentId) || [];
      current.push({ ...data, studentId });
      attendanceBuckets.set(studentId, current);
    });

    attendanceBuckets.forEach((records, studentId) => {
      const selectedRecord = pickPreferredAttendanceRecord(records);
      if (!selectedRecord) return;

      const liveMinutes = getLiveAttendanceMinutes(selectedRecord, nowMs);
      if (liveMinutes <= 0) return;

      const liveStartedAtMs = toTimestampMillis(selectedRecord.lastCheckInAt);
      const liveStatus = getActiveLiveRankStatus(selectedRecord.status);
      const liveDateKey = toKstDateKeyFromTimestamp(selectedRecord.lastCheckInAt);
      if (!liveDateKey || !liveStatus || liveStartedAtMs <= 0 || !dailyDateKeySet.has(liveDateKey)) return;

      liveAttendanceMeta.set(studentId, {
        liveStatus,
        liveStartedAtMs,
      });
    });

    const dailyEntries = applyCompetitionRanks(
      Array.from(new Set([...dailyTotals.keys(), ...liveAttendanceMeta.keys()])).map((studentId) => {
        const profile = getProfile(studentId);
        return {
          id: studentId,
          studentId,
          displayNameSnapshot: profile.displayNameSnapshot,
          classNameSnapshot: profile.classNameSnapshot,
          schoolNameSnapshot: profile.schoolNameSnapshot,
          value: dailyTotals.get(studentId) || 0,
          liveStatus: liveAttendanceMeta.get(studentId)?.liveStatus ?? null,
          liveStartedAtMs: liveAttendanceMeta.get(studentId)?.liveStartedAtMs ?? null,
        };
      })
    );

    const weeklyEntries = applyCompetitionRanks(
      Array.from(new Set([...weeklyTotals.keys(), ...liveAttendanceMeta.keys()])).map((studentId) => {
        const profile = getProfile(studentId);
        return {
          id: `weekly-${studentId}`,
          studentId,
          displayNameSnapshot: profile.displayNameSnapshot,
          classNameSnapshot: profile.classNameSnapshot,
          schoolNameSnapshot: profile.schoolNameSnapshot,
          value: weeklyTotals.get(studentId) || 0,
          liveStatus: liveAttendanceMeta.get(studentId)?.liveStatus ?? null,
          liveStartedAtMs: liveAttendanceMeta.get(studentId)?.liveStartedAtMs ?? null,
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
            liveStatus: liveAttendanceMeta.get(studentId)?.liveStatus ?? null,
            liveStartedAtMs: liveAttendanceMeta.get(studentId)?.liveStartedAtMs ?? null,
          } satisfies RankEntrySeed;
        })
        .filter((entry): entry is RankEntrySeed => entry !== null)
    );

    return noStoreJson({
      ...EMPTY_SNAPSHOT,
      daily: dailyEntries,
      weekly: weeklyEntries,
      monthly: monthlyEntries,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production' && isMissingAdminCredentialsError(error)) {
      return noStoreJson(EMPTY_SNAPSHOT);
    }
    console.error('[student-rankings] query failed', error);
    return noStoreJson({ error: 'internal' }, { status: 500 });
  }
}
