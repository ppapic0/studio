import { NextRequest, NextResponse } from 'next/server';
import { eachDayOfInterval, format, startOfMonth, startOfWeek } from 'date-fns';

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

function buildStudentDateRankKey(studentId: string, dateKey: string) {
  return `${studentId}\u001f${dateKey}`;
}

function mergeRankMinutesByDate(target: Map<string, number>, studentId: string, dateKey: string, minutes: number) {
  if (!studentId || !dateKey || minutes <= 0) return;
  const key = buildStudentDateRankKey(studentId, dateKey);
  target.set(key, Math.max(target.get(key) || 0, minutes));
}

function foldRankMinutesByDate(source: Map<string, number>) {
  const totals = new Map<string, number>();

  source.forEach((minutes, compositeKey) => {
    const separatorIndex = compositeKey.indexOf('\u001f');
    const studentId = separatorIndex >= 0 ? compositeKey.slice(0, separatorIndex) : compositeKey;
    if (!studentId || minutes <= 0) return;
    addRankMinutes(totals, studentId, minutes);
  });

  return totals;
}

function chunkItems<T>(items: T[], size: number) {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
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

    const now = new Date();
    const nowKst = toKstDate(now);
    const dailyRankWindow = getDailyRankWindowState(now);
    const dailyDateKeys = dailyRankWindow.coveredDateKeys;
    const dailyDateKeySet = new Set(dailyDateKeys);
    const weekDateKeys = eachDayOfInterval({
      start: startOfWeek(nowKst, { weekStartsOn: 1 }),
      end: nowKst,
    }).map((date) => format(date, 'yyyy-MM-dd'));
    const monthDateKeys = eachDayOfInterval({
      start: startOfMonth(nowKst),
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
    const attendanceSnapPromise = adminDb
      .collection(`centers/${centerId}/attendanceCurrent`)
      .get();
    const weeklySnapPromises = weekDateKeys.map((dateKey) =>
      adminDb.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
    );
    const monthlySnapPromises = monthDateKeys.map((dateKey) =>
      adminDb.collection(`centers/${centerId}/dailyStudentStats/${dateKey}/students`).get()
    );

    const [membersSnap, studentsSnap, attendanceSnap, ...dateStatSnaps] = await Promise.all([
      membersSnapPromise,
      studentsSnapPromise,
      attendanceSnapPromise,
      ...dailySnapPromises,
      ...weeklySnapPromises,
      ...monthlySnapPromises,
    ]);
    const dailySnaps = dateStatSnaps.slice(0, dailySnapPromises.length);
    const weeklySnaps = dateStatSnaps.slice(dailySnapPromises.length, dailySnapPromises.length + weeklySnapPromises.length);
    const monthlySnaps = dateStatSnaps.slice(dailySnapPromises.length + weeklySnapPromises.length);

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
    const knownStudentMemberIds = new Set<string>();
    const activeStudentIds = new Set<string>();

    membersSnap.forEach((docSnap) => {
      const studentId = docSnap.id;
      if (isSyntheticStudentId(studentId)) return;

      const data = docSnap.data() as Record<string, unknown>;
      const hasStudentProfile = studentProfiles.has(studentId);
      if (!shouldTreatMemberAsStudent(data.role, hasStudentProfile)) return;
      knownStudentMemberIds.add(studentId);
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

    const shouldInclude = (studentId: string) => {
      if (activeStudentIds.has(studentId)) return true;
      if (!studentProfiles.has(studentId)) return activeStudentIds.size === 0;
      return !knownStudentMemberIds.has(studentId);
    };
    const includedStudentIds = Array.from(
      new Set([
        ...studentProfiles.keys(),
        ...activeStudentIds,
        ...knownStudentMemberIds,
      ])
    ).filter((studentId) => shouldInclude(studentId) && !isSyntheticStudentId(studentId));
    const getProfile = (studentId: string) => memberProfiles.get(studentId) || studentProfiles.get(studentId) || {
      displayNameSnapshot: '학생',
      classNameSnapshot: null,
      schoolNameSnapshot: null,
    };

    const fetchStudyLogDayDocs = async (dateKeys: string[]) => {
      if (includedStudentIds.length === 0 || dateKeys.length === 0) return [];

      const refs = includedStudentIds.flatMap((studentId) =>
        dateKeys.map((dateKey) => adminDb.doc(`centers/${centerId}/studyLogs/${studentId}/days/${dateKey}`))
      );

      const snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
      for (const chunk of chunkItems(refs, 350)) {
        if (chunk.length === 0) continue;
        const chunkSnapshots = await adminDb.getAll(...chunk);
        snapshots.push(...chunkSnapshots);
      }
      return snapshots;
    };

    const [dailyStudyDayDocs, weeklyStudyDayDocs, monthlyStudyDayDocs] = await Promise.all([
      fetchStudyLogDayDocs(dailyDateKeys),
      fetchStudyLogDayDocs(weekDateKeys),
      fetchStudyLogDayDocs(monthDateKeys),
    ]);

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

    const dailyMinutesByStudentDate = new Map<string, number>();
    const weeklyMinutesByStudentDate = new Map<string, number>();
    const monthlyMinutesByStudentDate = new Map<string, number>();

    dailySnaps.forEach((snapshot, index) => {
      const fallbackDateKey = dailyDateKeys[index] || '';
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const dateKey = typeof data.dateKey === 'string' && data.dateKey.trim() ? data.dateKey.trim() : fallbackDateKey;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        mergeRankMinutesByDate(dailyMinutesByStudentDate, studentId, dateKey, value);
      });
    });

    dailyStudyDayDocs.forEach((docSnap) => {
      if (!docSnap.exists) return;
      const data = docSnap.data() as Record<string, unknown>;
      const studentId = typeof data.studentId === 'string' ? data.studentId : '';
      const dateKey = typeof data.dateKey === 'string' ? data.dateKey.trim() : '';
      const value = Math.max(0, Number(data.totalMinutes ?? data.totalStudyMinutes ?? 0));
      if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
      mergeRankMinutesByDate(dailyMinutesByStudentDate, studentId, dateKey, value);
    });

    weeklySnaps.forEach((snapshot, index) => {
      const fallbackDateKey = weekDateKeys[index] || '';
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const dateKey = typeof data.dateKey === 'string' && data.dateKey.trim() ? data.dateKey.trim() : fallbackDateKey;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        mergeRankMinutesByDate(weeklyMinutesByStudentDate, studentId, dateKey, value);
      });
    });

    monthlySnaps.forEach((snapshot, index) => {
      const fallbackDateKey = monthDateKeys[index] || '';
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const studentId = typeof data.studentId === 'string' ? data.studentId : docSnap.id;
        const dateKey = typeof data.dateKey === 'string' && data.dateKey.trim() ? data.dateKey.trim() : fallbackDateKey;
        const value = Math.max(0, Number(data.totalStudyMinutes ?? 0));
        if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
        mergeRankMinutesByDate(monthlyMinutesByStudentDate, studentId, dateKey, value);
      });
    });

    weeklyStudyDayDocs.forEach((docSnap) => {
      if (!docSnap.exists) return;
      const data = docSnap.data() as Record<string, unknown>;
      const studentId = typeof data.studentId === 'string' ? data.studentId : '';
      const dateKey = typeof data.dateKey === 'string' ? data.dateKey.trim() : '';
      const value = Math.max(0, Number(data.totalMinutes ?? data.totalStudyMinutes ?? 0));
      if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
      mergeRankMinutesByDate(weeklyMinutesByStudentDate, studentId, dateKey, value);
    });

    monthlyStudyDayDocs.forEach((docSnap) => {
      if (!docSnap.exists) return;
      const data = docSnap.data() as Record<string, unknown>;
      const studentId = typeof data.studentId === 'string' ? data.studentId : '';
      const dateKey = typeof data.dateKey === 'string' ? data.dateKey.trim() : '';
      const value = Math.max(0, Number(data.totalMinutes ?? data.totalStudyMinutes ?? 0));
      if (!studentId || !dateKey || isSyntheticStudentId(studentId) || !shouldInclude(studentId) || value <= 0) return;
      mergeRankMinutesByDate(monthlyMinutesByStudentDate, studentId, dateKey, value);
    });

    const dailyTotals = foldRankMinutesByDate(dailyMinutesByStudentDate);
    const weeklyTotals = foldRankMinutesByDate(weeklyMinutesByStudentDate);
    const monthlyTotals = foldRankMinutesByDate(monthlyMinutesByStudentDate);

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
      Array.from(new Set([...monthlyTotals.keys(), ...liveAttendanceMeta.keys()])).map((studentId) => {
        const profile = getProfile(studentId);
        return {
          id: `monthly-${studentId}`,
          studentId,
          displayNameSnapshot: profile.displayNameSnapshot,
          classNameSnapshot: profile.classNameSnapshot,
          schoolNameSnapshot: profile.schoolNameSnapshot,
          value: monthlyTotals.get(studentId) || 0,
          liveStatus: liveAttendanceMeta.get(studentId)?.liveStatus ?? null,
          liveStartedAtMs: liveAttendanceMeta.get(studentId)?.liveStartedAtMs ?? null,
        };
      })
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
