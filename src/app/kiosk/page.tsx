'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clock3,
  Coffee,
  Delete,
  Loader2,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Undo2,
  UserRound,
  WifiOff,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, query, Timestamp, where, type Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/app-context';
import { useFirestore, useFunctions } from '@/firebase';
import { cn } from '@/lib/utils';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import type { AttendanceCurrent, StudentProfile } from '@/lib/types';
import {
  enqueueKioskAttendanceActionSecure,
  submitKioskAttendanceActionFast,
  type EnqueueKioskAttendanceActionResult,
  type KioskAttendanceAction,
  type KioskAttendanceAwayKind,
  type SubmitKioskAttendanceActionFastInput,
  type SubmitKioskAttendanceActionFastResult,
} from '@/lib/kiosk-attendance-actions';
import type { LucideIcon } from 'lucide-react';

type KioskStep = 'pin' | 'select' | 'action';
type AttendanceStatus = AttendanceCurrent['status'];

type KioskStudent = Pick<StudentProfile, 'id' | 'name'> &
  Partial<StudentProfile> & {
    parentLinkCode?: string;
    seatNo?: number;
    seatId?: string;
    roomId?: string;
    roomSeatNo?: number;
    seatLabel?: string;
    seatZone?: string;
  };

type KioskLookupAttendance = Pick<AttendanceCurrent, 'id' | 'status'> &
  Partial<AttendanceCurrent> & {
    studentId?: string;
    lastCheckInAtMillis?: number;
    updatedAtMillis?: number;
  };

type KioskStudentLookupResult = {
  ok?: boolean;
  students?: KioskStudent[];
  seats?: KioskLookupAttendance[];
};

type KioskActionConfig = {
  action: KioskAttendanceAction;
  label: string;
  title: string;
  Icon: LucideIcon;
  accentClassName: string;
  completeMessage: (studentName: string) => string;
};

type KioskSuccessFeedback = {
  title: string;
  description: string;
  actionLabel: string;
  Icon: LucideIcon;
};

type KioskFastOutboxItem = {
  id: string;
  payload: SubmitKioskAttendanceActionFastInput;
  attempts: number;
  createdAt: number;
  studentName?: string;
  studentSchool?: string;
  studentGrade?: string;
  actionLabel?: string;
  seatLabel?: string;
  lastError?: string;
};

type KioskFailedOutboxItem = KioskFastOutboxItem & {
  failedAt: number;
  errorCode?: string;
};

type KioskFastOutboxMeta = Pick<
  KioskFastOutboxItem,
  'studentName' | 'studentSchool' | 'studentGrade' | 'actionLabel' | 'seatLabel'
>;

const FAST_OUTBOX_STORAGE_KEY = 'track:kiosk-fast-attendance-outbox:v1';
const FAILED_OUTBOX_STORAGE_KEY = 'track:kiosk-fast-attendance-failures:v1';
const MAX_OUTBOX_ITEMS = 48;
const LOOKUP_LOADING_DELAY_MS = 150;
const TOUCH_LOCK_MS = 350;
const SUCCESS_FEEDBACK_VISIBLE_MS = 760;
const RESET_AFTER_ACTION_MS = 420;
const kioskTouchClass = 'touch-manipulation select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] [touch-action:manipulation]';
const ENABLE_FAST_CALLABLE = process.env.NEXT_PUBLIC_KIOSK_FAST_CALLABLE === 'true';

const ACTIONS: Record<KioskAttendanceAction, KioskActionConfig> = {
  check_in: {
    action: 'check_in',
    label: '등원',
    title: '센터에 도착했어요',
    Icon: LogIn,
    accentClassName: 'from-[#FF7A16] to-[#FF9E45]',
    completeMessage: (studentName) => `${studentName} 학생 등원이 접수되었습니다.`,
  },
  away_start: {
    action: 'away_start',
    label: '단기외출',
    title: '화장실 등 10분 이내 외출',
    Icon: Coffee,
    accentClassName: 'from-[#FF8A1D] to-[#FFB35C]',
    completeMessage: (studentName) => `${studentName} 학생 단기외출이 접수되었습니다.`,
  },
  away_start_long: {
    action: 'away_start_long',
    label: '장기외출',
    title: '10분 이상 · 학원, 편의점 등',
    Icon: Clock3,
    accentClassName: 'from-[#14295F] to-[#FF7A16]',
    completeMessage: (studentName) => `${studentName} 학생 장기외출이 접수되었습니다.`,
  },
  away_end: {
    action: 'away_end',
    label: '복귀',
    title: '다시 공부하러 왔어요',
    Icon: Undo2,
    accentClassName: 'from-[#FF7A16] to-[#FFC06D]',
    completeMessage: (studentName) => `${studentName} 학생 복귀가 접수되었습니다.`,
  },
  check_out: {
    action: 'check_out',
    label: '퇴실',
    title: '오늘 공부를 마쳤어요',
    Icon: LogOut,
    accentClassName: 'from-[#14295F] to-[#FF7A16]',
    completeMessage: (studentName) => `${studentName} 학생 퇴실이 접수되었습니다.`,
  },
};

const statusLabel: Record<AttendanceStatus, string> = {
  studying: '등원 중',
  away: '외출 중',
  break: '외출 중',
  absent: '미등원',
};

function normalizeStatus(status?: string | null): AttendanceStatus {
  if (status === 'studying' || status === 'away' || status === 'break' || status === 'absent') return status;
  return 'absent';
}

function getAllowedActions(status: AttendanceStatus): KioskAttendanceAction[] {
  if (status === 'studying') return ['away_start', 'away_start_long', 'check_out'];
  if (status === 'away' || status === 'break') return ['away_end', 'check_out'];
  return ['check_in'];
}

function getNextStatusForAction(action: KioskAttendanceAction): AttendanceStatus {
  if (action === 'check_in' || action === 'away_end') return 'studying';
  if (action === 'away_start' || action === 'away_start_long') return 'away';
  return 'absent';
}

function getSubmissionActionForAction(action: KioskAttendanceAction): KioskAttendanceAction {
  return action === 'away_start_long' ? 'away_start' : action;
}

function getAwayKindForAction(action: KioskAttendanceAction): KioskAttendanceAwayKind | null {
  if (action === 'away_start') return 'short';
  if (action === 'away_start_long') return 'long';
  return null;
}

function getSeatActivityRank(status?: AttendanceStatus) {
  if (status === 'studying') return 0;
  if (status === 'away' || status === 'break') return 1;
  if (status === 'absent') return 3;
  return 2;
}

function getSeatSortMillis(seat: KioskLookupAttendance) {
  return (
    seat.lastCheckInAtMillis ||
    seat.updatedAtMillis ||
    seat.lastCheckInAt?.toMillis?.() ||
    seat.updatedAt?.toMillis?.() ||
    0
  );
}

function pickPreferredSeat(seats: KioskLookupAttendance[]) {
  return seats
    .slice()
    .sort((left, right) => {
      const rankDiff = getSeatActivityRank(left.status) - getSeatActivityRank(right.status);
      if (rankDiff !== 0) return rankDiff;
      return getSeatSortMillis(right) - getSeatSortMillis(left);
    })[0] || null;
}

function createIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `kiosk_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function normalizeKioskPin(value: unknown) {
  return (getTrimmedString(value) || '').replace(/\D/g, '');
}

function isKnownKioskAction(value: unknown): value is KioskAttendanceAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

function isValidKioskPayload(value: unknown): value is SubmitKioskAttendanceActionFastInput {
  if (!value || typeof value !== 'object') return false;
  const payload = value as SubmitKioskAttendanceActionFastInput;
  return Boolean(
    getTrimmedString(payload.centerId) &&
    getTrimmedString(payload.studentId) &&
    normalizeKioskPin(payload.pin).length === 6 &&
    isKnownKioskAction(payload.action) &&
    getTrimmedString(payload.idempotencyKey)
  );
}

function isValidKioskOutboxItem(value: unknown): value is KioskFastOutboxItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as KioskFastOutboxItem;
  return Boolean(getTrimmedString(item.id) && isValidKioskPayload(item.payload));
}

function readFastOutbox(): KioskFastOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAST_OUTBOX_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter(isValidKioskOutboxItem)
          .slice(0, MAX_OUTBOX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function writeFastOutbox(items: KioskFastOutboxItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAST_OUTBOX_STORAGE_KEY, JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)));
}

function readFailedOutbox(): KioskFailedOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAILED_OUTBOX_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is KioskFailedOutboxItem => (
            isValidKioskOutboxItem(item) &&
            Number.isFinite(Number((item as KioskFailedOutboxItem).failedAt))
          ))
          .slice(0, MAX_OUTBOX_ITEMS)
      : [];
  } catch {
    return [];
  }
}

function writeFailedOutbox(items: KioskFailedOutboxItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FAILED_OUTBOX_STORAGE_KEY, JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)));
}

function getTrimmedString(value: unknown) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function getKioskStudentName(student: Partial<KioskStudent> | Record<string, unknown>) {
  const raw = student as Record<string, unknown>;
  return getTrimmedString(raw.name) || getTrimmedString(raw.displayName) || '학생';
}

function getKioskStudentSchool(student: Partial<KioskStudent> | Record<string, unknown>) {
  const raw = student as Record<string, unknown>;
  return (
    getTrimmedString(raw.schoolName) ||
    getTrimmedString(raw.schoolNameSnapshot) ||
    getTrimmedString(raw.school)
  );
}

function getKioskStudentGrade(student: Partial<KioskStudent> | Record<string, unknown>) {
  const raw = student as Record<string, unknown>;
  return getTrimmedString(raw.grade) || getTrimmedString(raw.gradeLabel) || getTrimmedString(raw.schoolGrade);
}

function getKioskErrorMessage(error: unknown) {
  const raw = error as { code?: unknown; message?: unknown; details?: unknown; customData?: unknown };
  const detailSources = [raw.details, raw.customData];
  for (const source of detailSources) {
    if (source && typeof source === 'object') {
      const userMessage = (source as Record<string, unknown>).userMessage;
      if (typeof userMessage === 'string' && userMessage.trim()) return userMessage.trim();
    }
  }
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  return message || '네트워크가 안정되면 자동으로 다시 동기화합니다.';
}

function getKioskErrorCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  if (typeof code !== 'string') return '';
  return code.trim().replace(/^functions\//, '');
}

function isInvalidArgumentKioskSubmissionError(error: unknown) {
  return getKioskErrorCode(error) === 'invalid-argument';
}

function isRetryableKioskSubmissionError(error: unknown) {
  const code = getKioskErrorCode(error);
  if (!code) return true;
  return code === 'aborted' || code === 'deadline-exceeded' || code === 'internal' || code === 'unavailable';
}

function formatOutboxTime(millis: number) {
  if (!Number.isFinite(millis)) return '시간 미확인';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(millis));
}

function formatOutboxSeatLabel(item: KioskFastOutboxItem) {
  if (item.seatLabel?.trim()) return item.seatLabel.trim();
  const hint = item.payload.seatHint;
  if (hint?.roomSeatNo) {
    return `${hint.roomId ? `${hint.roomId} · ` : ''}${hint.roomSeatNo}번`;
  }
  if (hint?.seatNo) return `${hint.seatNo}번`;
  if (item.payload.seatId) return `좌석 ${item.payload.seatId}`;
  return '좌석 미확인';
}

function formatOutboxStudentLabel(item: KioskFastOutboxItem) {
  return getTrimmedString(item.studentName) || `학생 ${item.payload.studentId.slice(0, 6)}`;
}

function formatOutboxStudentProfileLabel(item: KioskFastOutboxItem) {
  const school = getTrimmedString(item.studentSchool) || '학교 미확인';
  const grade = getTrimmedString(item.studentGrade) || '학년 미확인';
  return `${school} · ${grade}`;
}

function formatOutboxActionLabel(item: KioskFastOutboxItem) {
  return item.actionLabel?.trim() || ACTIONS[item.payload.action]?.label || item.payload.action;
}

function formatOutboxStatusFlow(item: KioskFastOutboxItem) {
  const from = statusLabel[normalizeStatus(item.payload.expectedStatus)] || item.payload.expectedStatus;
  const to = statusLabel[getNextStatusForAction(item.payload.action)];
  return `${from} -> ${to}`;
}

function isStudentLookupResult(value: KioskStudentLookupResult | null): value is KioskStudentLookupResult {
  return Boolean(value?.students?.length);
}

function normalizeQueuedAttendanceResult(
  result: EnqueueKioskAttendanceActionResult
): SubmitKioskAttendanceActionFastResult {
  const state: SubmitKioskAttendanceActionFastResult['state'] =
    result.status === 'rejected_stale'
      ? 'stale'
      : result.status === 'completed'
        ? result.result?.alreadyApplied === true ? 'already_applied' : 'applied'
        : 'queued';
  const userMessage = result.userMessage || result.staleReason || '';

  return {
    ok: true,
    actionId: result.actionId,
    state,
    nextStatus: result.confirmedStatus || result.optimisticStatus,
    ...(result.confirmedStatus ? { confirmedStatus: result.confirmedStatus } : {}),
    ...(result.confirmedSeatId ? { confirmedSeatId: result.confirmedSeatId } : {}),
    ...(userMessage ? { userMessage } : {}),
  };
}

async function firstLookupWithStudents(
  lookups: Array<Promise<KioskStudentLookupResult | null>>
): Promise<KioskStudentLookupResult | null> {
  const candidates = lookups.map((lookup) =>
    lookup.then((result) => {
      if (isStudentLookupResult(result)) return result;
      throw new Error('empty_lookup');
    })
  );

  try {
    return await Promise.any(candidates);
  } catch {
    const settled = await Promise.allSettled(lookups);
    for (const item of settled) {
      if (item.status === 'fulfilled' && isStudentLookupResult(item.value)) {
        return item.value;
      }
    }
    return null;
  }
}

export default function KioskPage() {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  const router = useRouter();

  const centerId = activeMembership?.id;
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<KioskStep>('pin');
  const [matchedStudents, setMatchedStudents] = useState<KioskStudent[]>([]);
  const [lookupSeats, setLookupSeats] = useState<KioskLookupAttendance[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<KioskStudent | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showLookupOverlay, setShowLookupOverlay] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('번호 확인 중');
  const [successFeedback, setSuccessFeedback] = useState<KioskSuccessFeedback | null>(null);
  const [queuedItems, setQueuedItems] = useState<KioskFastOutboxItem[]>([]);
  const [failedItems, setFailedItems] = useState<KioskFailedOutboxItem[]>([]);
  const lookupVersionRef = useRef(0);
  const touchLocksRef = useRef<Record<string, number>>({});
  const lookupLoadingTimerRef = useRef<number | null>(null);
  const pendingActionRef = useRef(false);
  const actionReleaseTimerRef = useRef<number | null>(null);
  const flushingOutboxRef = useRef(false);

  const lookupKioskStudentsByPin = useMemo(() => {
    if (!functions) return null;
    return httpsCallable<{ centerId: string; pin: string }, KioskStudentLookupResult>(
      functions,
      'lookupKioskStudentsByPin'
    );
  }, [functions]);

  const lookupSeatsByStudentId = useMemo(() => {
    const mapped = new Map<string, KioskLookupAttendance[]>();
    lookupSeats.forEach((seat) => {
      if (!seat.studentId) return;
      const bucket = mapped.get(seat.studentId) || [];
      bucket.push({ ...seat, status: normalizeStatus(seat.status) });
      mapped.set(seat.studentId, bucket);
    });
    return mapped;
  }, [lookupSeats]);

  const syncQueuedCount = useCallback(() => {
    setQueuedItems(readFastOutbox());
  }, []);

  const syncFailedCount = useCallback(() => {
    setFailedItems(readFailedOutbox());
  }, []);

  const runLockedAction = useCallback((key: string, action: () => void) => {
    const now = Date.now();
    if ((touchLocksRef.current[key] || 0) > now) return;
    touchLocksRef.current[key] = now + TOUCH_LOCK_MS;
    action();
  }, []);

  const handleTouchPress = useCallback((event: PointerEvent<HTMLElement>, key: string, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    runLockedAction(key, action);
  }, [runLockedAction]);

  const handleKeyboardPress = useCallback((event: KeyboardEvent<HTMLElement>, key: string, action: () => void) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    runLockedAction(key, action);
  }, [runLockedAction]);

  const clearLookupDelay = useCallback(() => {
    if (lookupLoadingTimerRef.current !== null) {
      window.clearTimeout(lookupLoadingTimerRef.current);
      lookupLoadingTimerRef.current = null;
    }
  }, []);

  const resetKiosk = useCallback(() => {
    lookupVersionRef.current += 1;
    clearLookupDelay();
    setPin('');
    setStep('pin');
    setMatchedStudents([]);
    setLookupSeats([]);
    setSelectedStudent(null);
    setLookupMessage('번호 확인 중');
    setIsSearching(false);
    setShowLookupOverlay(false);
  }, [clearLookupDelay]);

  const resolveSeatForStudent = useCallback((student: KioskStudent): KioskLookupAttendance | null => {
    const liveSeat = pickPreferredSeat(lookupSeatsByStudentId.get(student.id) || []);
    if (liveSeat) return liveSeat;

    const identity = resolveSeatIdentity(student as StudentProfile);
    const seatId = identity.seatId || student.seatId || '';
    const seatNo = identity.seatNo || Number(student.seatNo || 0);
    if (!seatId || seatNo <= 0) return null;

    return {
      id: seatId,
      studentId: student.id,
      seatNo,
      roomId: identity.roomId || student.roomId,
      roomSeatNo: identity.roomSeatNo || student.roomSeatNo,
      seatLabel: student.seatLabel,
      seatZone: student.seatZone,
      status: 'absent',
      type: 'seat',
      updatedAt: Timestamp.now(),
    };
  }, [lookupSeatsByStudentId]);

  const lookupStudentFromFirestore = useCallback(async (code: string): Promise<KioskStudentLookupResult | null> => {
    if (!firestore || !centerId) return null;

    const studentsRef = collection(firestore, 'centers', centerId, 'students');
    const lookupValues: Array<string | number> = [code];
    const numericCode = Number(code);
    if (Number.isFinite(numericCode)) lookupValues.push(numericCode);

    const studentDocs = new Map<string, KioskStudent>();
    const studentSnaps = await Promise.all(
      lookupValues.map((value) =>
        getDocs(query(studentsRef, where('parentLinkCode', '==', value), limit(8)))
      )
    );

    studentSnaps.forEach((snap) => {
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data() as Omit<KioskStudent, 'id'>;
        const raw = data as Record<string, unknown>;
        studentDocs.set(docSnap.id, {
          ...data,
          id: docSnap.id,
          name: getKioskStudentName(raw),
          parentLinkCode: code,
        });
      });
    });

    const students = Array.from(studentDocs.values()).slice(0, 8);
    const seatSnaps = await Promise.all(
      students.map((student) =>
        getDocs(query(
          collection(firestore, 'centers', centerId, 'attendanceCurrent'),
          where('studentId', '==', student.id),
          limit(10)
        ))
      )
    );
    const seats = seatSnaps.flatMap((snap, index) =>
      snap.docs.map((docSnap) => {
        const data = docSnap.data() as AttendanceCurrent;
        return {
          ...data,
          id: docSnap.id,
          studentId: students[index]?.id || data.studentId,
          status: normalizeStatus(data.status),
        };
      })
    );

    return { ok: true, students, seats };
  }, [centerId, firestore]);

  const lookupStudentFromBackend = useCallback(async (code: string): Promise<KioskStudentLookupResult | null> => {
    if (!lookupKioskStudentsByPin || !centerId) return null;
    const result = await lookupKioskStudentsByPin({ centerId, pin: code });
    return result.data || null;
  }, [centerId, lookupKioskStudentsByPin]);

  const searchStudent = useCallback(async (code: string) => {
    if (!centerId || (!firestore && !lookupKioskStudentsByPin)) return;
    const lookupVersion = lookupVersionRef.current + 1;
    lookupVersionRef.current = lookupVersion;
    setIsSearching(true);
    setLookupMessage('번호 확인 중');
    clearLookupDelay();
    lookupLoadingTimerRef.current = window.setTimeout(() => {
      setShowLookupOverlay(true);
    }, LOOKUP_LOADING_DELAY_MS);

    try {
      const lookupData = await firstLookupWithStudents([
        lookupStudentFromFirestore(code).catch(() => null),
        lookupStudentFromBackend(code).catch(() => null),
      ]);

      if (lookupVersion !== lookupVersionRef.current) return;

      const students = lookupData?.students || [];
      const seats = (lookupData?.seats || []).map((seat) => ({ ...seat, status: normalizeStatus(seat.status) }));
      if (!students.length) {
        toast({
          variant: 'destructive',
          title: '번호 확인 필요',
          description: '일치하는 학생이 없습니다. 번호 6자리를 다시 입력해 주세요.',
        });
        resetKiosk();
        return;
      }

      setMatchedStudents(students);
      setLookupSeats(seats);
      if (students.length === 1) {
        setSelectedStudent(students[0]);
        setStep('action');
      } else {
        setSelectedStudent(null);
        setStep('select');
      }
    } finally {
      if (lookupVersion === lookupVersionRef.current) {
        clearLookupDelay();
        setIsSearching(false);
        setShowLookupOverlay(false);
        setLookupMessage('번호 확인 중');
      }
    }
  }, [
    centerId,
    clearLookupDelay,
    firestore,
    lookupKioskStudentsByPin,
    lookupStudentFromBackend,
    lookupStudentFromFirestore,
    resetKiosk,
    toast,
  ]);

  const saveActionForRetry = useCallback((
    payload: SubmitKioskAttendanceActionFastInput,
    lastError?: string,
    meta?: KioskFastOutboxMeta
  ) => {
    const currentItems = readFastOutbox();
    const existing = currentItems.find((item) => item.id === payload.idempotencyKey);
    const items = currentItems.filter((item) => item.id !== payload.idempotencyKey);
    writeFastOutbox([
      ...items,
      {
        ...existing,
        id: payload.idempotencyKey,
        payload,
        attempts: lastError ? Math.max(0, existing?.attempts || 0) + 1 : Math.max(0, existing?.attempts || 0),
        createdAt: existing?.createdAt || Date.now(),
        ...(meta?.studentName ? { studentName: meta.studentName } : {}),
        ...(meta?.studentSchool ? { studentSchool: meta.studentSchool } : {}),
        ...(meta?.studentGrade ? { studentGrade: meta.studentGrade } : {}),
        ...(meta?.actionLabel ? { actionLabel: meta.actionLabel } : {}),
        ...(meta?.seatLabel ? { seatLabel: meta.seatLabel } : {}),
        ...(lastError ? { lastError } : existing?.lastError ? { lastError: existing.lastError } : {}),
      },
    ]);
    syncQueuedCount();
  }, [syncQueuedCount]);

  const removeActionFromRetry = useCallback((idempotencyKey: string) => {
    writeFastOutbox(readFastOutbox().filter((item) => item.id !== idempotencyKey));
    syncQueuedCount();
  }, [syncQueuedCount]);

  const saveActionFailure = useCallback((
    payload: SubmitKioskAttendanceActionFastInput,
    lastError: string,
    meta?: KioskFastOutboxMeta,
    errorCode?: string
  ) => {
    const currentRetryItems = readFastOutbox();
    const retryItem = currentRetryItems.find((item) => item.id === payload.idempotencyKey);
    const currentFailedItems = readFailedOutbox();
    const existingFailure = currentFailedItems.find((item) => item.id === payload.idempotencyKey);
    const failedAt = Date.now();
    const nextFailure: KioskFailedOutboxItem = {
      ...existingFailure,
      ...retryItem,
      id: payload.idempotencyKey,
      payload,
      attempts: Math.max(0, retryItem?.attempts || existingFailure?.attempts || 0),
      createdAt: retryItem?.createdAt || existingFailure?.createdAt || failedAt,
      failedAt,
      ...(meta?.studentName || retryItem?.studentName || existingFailure?.studentName
        ? { studentName: meta?.studentName || retryItem?.studentName || existingFailure?.studentName }
        : {}),
      ...(meta?.studentSchool || retryItem?.studentSchool || existingFailure?.studentSchool
        ? { studentSchool: meta?.studentSchool || retryItem?.studentSchool || existingFailure?.studentSchool }
        : {}),
      ...(meta?.studentGrade || retryItem?.studentGrade || existingFailure?.studentGrade
        ? { studentGrade: meta?.studentGrade || retryItem?.studentGrade || existingFailure?.studentGrade }
        : {}),
      ...(meta?.actionLabel || retryItem?.actionLabel || existingFailure?.actionLabel
        ? { actionLabel: meta?.actionLabel || retryItem?.actionLabel || existingFailure?.actionLabel }
        : {}),
      ...(meta?.seatLabel || retryItem?.seatLabel || existingFailure?.seatLabel
        ? { seatLabel: meta?.seatLabel || retryItem?.seatLabel || existingFailure?.seatLabel }
        : {}),
      lastError,
      ...(errorCode ? { errorCode } : existingFailure?.errorCode ? { errorCode: existingFailure.errorCode } : {}),
    };

    writeFastOutbox(currentRetryItems.filter((item) => item.id !== payload.idempotencyKey));
    writeFailedOutbox([
      ...currentFailedItems.filter((item) => item.id !== payload.idempotencyKey),
      nextFailure,
    ]);
    syncQueuedCount();
    syncFailedCount();
  }, [syncFailedCount, syncQueuedCount]);

  const clearFailedActions = useCallback(() => {
    writeFailedOutbox([]);
    syncFailedCount();
  }, [syncFailedCount]);

  const submitLongAwayCompatibilityFallback = useCallback(async (
    payload: SubmitKioskAttendanceActionFastInput,
    error: unknown,
    meta?: KioskFastOutboxMeta
  ): Promise<{ handled: boolean; result: SubmitKioskAttendanceActionFastResult | null }> => {
    if (!functions || payload.action !== 'away_start_long' || !isInvalidArgumentKioskSubmissionError(error)) {
      return { handled: false, result: null };
    }

    const legacyPayload: SubmitKioskAttendanceActionFastInput = {
      ...payload,
      action: 'away_start',
    };

    try {
      const result = normalizeQueuedAttendanceResult(
        await enqueueKioskAttendanceActionSecure(functions, legacyPayload)
      );
      if (result.state === 'stale') {
        saveActionFailure(
          payload,
          result.userMessage || '출결 상태가 이미 바뀌었습니다. 번호를 다시 입력해 확인해 주세요.',
          meta,
          'stale'
        );
        return { handled: true, result };
      }

      removeActionFromRetry(payload.idempotencyKey);
      return { handled: true, result };
    } catch (fallbackError) {
      if (isRetryableKioskSubmissionError(fallbackError)) {
        saveActionForRetry(
          legacyPayload,
          getKioskErrorMessage(fallbackError),
          {
            ...meta,
            actionLabel: meta?.actionLabel || ACTIONS.away_start_long.label,
          }
        );
        return { handled: true, result: null };
      }
      return { handled: false, result: null };
    }
  }, [functions, removeActionFromRetry, saveActionFailure, saveActionForRetry]);

  const submitFastPayload = useCallback(async (
    payload: SubmitKioskAttendanceActionFastInput,
    options: { quiet?: boolean; outboxMeta?: KioskFastOutboxMeta } = {}
  ): Promise<SubmitKioskAttendanceActionFastResult | null> => {
    saveActionForRetry(payload, undefined, options.outboxMeta);
    if (!functions) {
      if (!options.quiet) {
        toast({
          title: '동기화 대기',
          description: '네트워크가 연결되면 출결 기록을 자동으로 전송합니다.',
        });
      }
      return null;
    }

    try {
      const result = ENABLE_FAST_CALLABLE
        ? await submitKioskAttendanceActionFast(functions, payload)
        : normalizeQueuedAttendanceResult(await enqueueKioskAttendanceActionSecure(functions, payload));
      if (result.state === 'stale') {
        saveActionFailure(
          payload,
          result.userMessage || '출결 상태가 이미 바뀌었습니다. 번호를 다시 입력해 확인해 주세요.',
          options.outboxMeta,
          'stale'
        );
        return result;
      }
      removeActionFromRetry(payload.idempotencyKey);
      return result;
    } catch (error) {
      if (ENABLE_FAST_CALLABLE) {
        try {
          const fallbackResult = normalizeQueuedAttendanceResult(
            await enqueueKioskAttendanceActionSecure(functions, payload)
          );
          if (fallbackResult.state === 'stale') {
            saveActionFailure(
              payload,
              fallbackResult.userMessage || '출결 상태가 이미 바뀌었습니다. 번호를 다시 입력해 확인해 주세요.',
              options.outboxMeta,
              'stale'
            );
            return fallbackResult;
          }
          removeActionFromRetry(payload.idempotencyKey);
          return fallbackResult;
        } catch (fallbackError) {
          const compatibilityFallback = await submitLongAwayCompatibilityFallback(
            payload,
            fallbackError,
            options.outboxMeta
          );
          if (compatibilityFallback.handled) {
            return compatibilityFallback.result;
          }

          if (isRetryableKioskSubmissionError(fallbackError)) {
            saveActionForRetry(payload, getKioskErrorMessage(fallbackError));
          } else {
            saveActionFailure(
              payload,
              getKioskErrorMessage(fallbackError),
              options.outboxMeta,
              getKioskErrorCode(fallbackError)
            );
          }
        }
      } else if (isRetryableKioskSubmissionError(error)) {
        saveActionForRetry(payload, getKioskErrorMessage(error));
      } else {
        const compatibilityFallback = await submitLongAwayCompatibilityFallback(
          payload,
          error,
          options.outboxMeta
        );
        if (compatibilityFallback.handled) {
          return compatibilityFallback.result;
        }

        saveActionFailure(payload, getKioskErrorMessage(error), options.outboxMeta, getKioskErrorCode(error));
      }
      return null;
    }
  }, [functions, removeActionFromRetry, saveActionFailure, saveActionForRetry, submitLongAwayCompatibilityFallback]);

  const retryFailedAction = useCallback((item: KioskFailedOutboxItem) => {
    const retryPayload: SubmitKioskAttendanceActionFastInput = {
      ...item.payload,
      action: getSubmissionActionForAction(item.payload.action),
      awayKind: item.payload.awayKind || getAwayKindForAction(item.payload.action),
      pin: normalizeKioskPin(item.payload.pin),
      idempotencyKey: createIdempotencyKey(),
      clientActionAtMillis: item.payload.clientActionAtMillis || item.createdAt || Date.now(),
    };

    if (!isValidKioskPayload(retryPayload)) {
      toast({
        variant: 'destructive',
        title: '재전송 불가',
        description: '저장된 출결 정보가 부족합니다. 번호를 다시 입력해 처리해 주세요.',
      });
      writeFailedOutbox(readFailedOutbox().filter((failedItem) => failedItem.id !== item.id));
      syncFailedCount();
      return;
    }

    writeFailedOutbox(readFailedOutbox().filter((failedItem) => failedItem.id !== item.id));
    syncFailedCount();
    void submitFastPayload(retryPayload, {
      outboxMeta: {
        studentName: item.studentName,
        studentSchool: item.studentSchool,
        studentGrade: item.studentGrade,
        actionLabel: item.actionLabel,
        seatLabel: item.seatLabel,
      },
    });
  }, [submitFastPayload, syncFailedCount, toast]);

  const flushOutbox = useCallback(async () => {
    if (flushingOutboxRef.current) return;
    flushingOutboxRef.current = true;
    try {
      const items = readFastOutbox();
      for (const item of items) {
        await submitFastPayload(
          {
            ...item.payload,
            clientActionAtMillis: item.payload.clientActionAtMillis || item.createdAt,
          },
          { quiet: true }
        );
      }
    } finally {
      flushingOutboxRef.current = false;
      syncQueuedCount();
      syncFailedCount();
    }
  }, [submitFastPayload, syncFailedCount, syncQueuedCount]);

  useEffect(() => {
    syncQueuedCount();
    syncFailedCount();
    void flushOutbox();
    const interval = window.setInterval(() => void flushOutbox(), 8000);
    const handleOnline = () => void flushOutbox();
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [flushOutbox, syncFailedCount, syncQueuedCount]);

  useEffect(() => {
    if (!firestore || !centerId || (queuedItems.length === 0 && failedItems.length === 0)) return;

    const studentIds = Array.from(
      new Set(
        [...queuedItems, ...failedItems]
          .filter((item) => (
            !getTrimmedString(item.studentName) ||
            !getTrimmedString(item.studentSchool) ||
            !getTrimmedString(item.studentGrade)
          ))
          .map((item) => item.payload.studentId)
          .filter(Boolean)
      )
    );
    if (studentIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      const profiles = await Promise.all(
        studentIds.map(async (studentId) => {
          try {
            const snap = await getDoc(doc(firestore, 'centers', centerId, 'students', studentId));
            if (!snap.exists()) return null;
            const data = snap.data() as Record<string, unknown>;
            return {
              studentId,
              studentName: getTrimmedString(data.name) || getTrimmedString(data.displayName),
              studentSchool: getKioskStudentSchool(data),
              studentGrade: getKioskStudentGrade(data),
            };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const profilesByStudentId = new Map(
        profiles
          .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile))
          .map((profile) => [profile.studentId, profile])
      );
      if (profilesByStudentId.size === 0) return;

      const mergeProfiles = <T extends KioskFastOutboxItem>(items: T[]) => {
        let changed = false;
        const mergedItems = items.map((item) => {
          const profile = profilesByStudentId.get(item.payload.studentId);
          if (!profile) return item;

          const nextItem = {
            ...item,
            ...(profile.studentName ? { studentName: profile.studentName } : {}),
            ...(profile.studentSchool ? { studentSchool: profile.studentSchool } : {}),
            ...(profile.studentGrade ? { studentGrade: profile.studentGrade } : {}),
          };
          if (
            nextItem.studentName !== item.studentName ||
            nextItem.studentSchool !== item.studentSchool ||
            nextItem.studentGrade !== item.studentGrade
          ) {
            changed = true;
          }
          return nextItem as T;
        });
        return { changed, mergedItems };
      };

      const queuedMerge = mergeProfiles(readFastOutbox());
      if (queuedMerge.changed) {
        writeFastOutbox(queuedMerge.mergedItems);
        syncQueuedCount();
      }

      const failedMerge = mergeProfiles(readFailedOutbox());
      if (failedMerge.changed) {
        writeFailedOutbox(failedMerge.mergedItems);
        syncFailedCount();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [centerId, failedItems, firestore, queuedItems, syncFailedCount, syncQueuedCount]);

  useEffect(() => {
    if (!successFeedback) return;
    const timer = window.setTimeout(() => setSuccessFeedback(null), SUCCESS_FEEDBACK_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [successFeedback]);

  useEffect(() => () => {
    clearLookupDelay();
    if (actionReleaseTimerRef.current !== null) {
      window.clearTimeout(actionReleaseTimerRef.current);
    }
  }, [clearLookupDelay]);

  const handleNumberClick = useCallback((num: string) => {
    if (isSearching || step !== 'pin') return;
    setPin((previous) => {
      if (previous.length >= 6) return previous;
      const next = previous + num;
      if (next.length === 6) {
        window.setTimeout(() => void searchStudent(next), 0);
      }
      return next;
    });
  }, [isSearching, searchStudent, step]);

  const handleDelete = useCallback(() => {
    if (isSearching || step !== 'pin') return;
    setPin((previous) => previous.slice(0, -1));
  }, [isSearching, step]);

  const handleSelectStudent = useCallback((student: KioskStudent) => {
    setSelectedStudent(student);
    setStep('action');
  }, []);

  const handleAction = useCallback((action: KioskAttendanceAction) => {
    if (!centerId || !selectedStudent || pendingActionRef.current) return;
    const actionPin = normalizeKioskPin(selectedStudent.parentLinkCode || pin);
    const studentId = getTrimmedString(selectedStudent.id);
    if (!studentId || actionPin.length !== 6) {
      toast({
        variant: 'destructive',
        title: '번호 확인 필요',
        description: '학생 번호 확인이 풀렸습니다. 번호 6자리를 다시 입력해 주세요.',
      });
      resetKiosk();
      return;
    }

    const seat = resolveSeatForStudent(selectedStudent);
    if (!seat) {
      toast({
        title: '좌석 확인 필요',
        description: '좌석이 배정된 학생만 키오스크를 사용할 수 있습니다.',
      });
      resetKiosk();
      return;
    }

    const status = normalizeStatus(seat.status);
    if (!getAllowedActions(status).includes(action)) {
      toast({
        title: '상태 확인 필요',
        description: '현재 출결 상태가 바뀌었습니다. 번호를 다시 입력해 주세요.',
      });
      resetKiosk();
      return;
    }

    const config = ACTIONS[action];
    const nextStatus = getNextStatusForAction(action);
    const submissionAction = getSubmissionActionForAction(action);
    const idempotencyKey = createIdempotencyKey();
    const queuedSeatLabel =
      seat.seatLabel ||
      selectedStudent.seatLabel ||
      (seat.roomSeatNo ? `${seat.roomId ? `${seat.roomId} · ` : ''}${seat.roomSeatNo}번` : '') ||
      (seat.seatNo ? `${seat.seatNo}번` : '');
    const payload: SubmitKioskAttendanceActionFastInput = {
      centerId,
      studentId,
      pin: actionPin,
      action: submissionAction,
      awayKind: getAwayKindForAction(action),
      expectedStatus: status,
      seatId: seat.id,
      seatHint: {
        seatNo: seat.seatNo ?? selectedStudent.seatNo ?? null,
        roomId: seat.roomId || selectedStudent.roomId || null,
        roomSeatNo: seat.roomSeatNo ?? selectedStudent.roomSeatNo ?? null,
      },
      idempotencyKey,
      clientActionAtMillis: Date.now(),
    };

    pendingActionRef.current = true;
    if (actionReleaseTimerRef.current !== null) {
      window.clearTimeout(actionReleaseTimerRef.current);
    }
    actionReleaseTimerRef.current = window.setTimeout(() => {
      pendingActionRef.current = false;
      actionReleaseTimerRef.current = null;
    }, TOUCH_LOCK_MS);
    setLookupSeats((previous) =>
      previous.map((item) =>
        item.studentId === selectedStudent.id || item.id === seat.id
          ? { ...item, status: nextStatus, updatedAtMillis: Date.now() }
          : item
      )
    );
    setSuccessFeedback({
      title: '처리 완료',
      description: config.completeMessage(selectedStudent.name),
      actionLabel: config.label,
      Icon: config.Icon,
    });
    window.setTimeout(resetKiosk, RESET_AFTER_ACTION_MS);

    void submitFastPayload(payload, {
      outboxMeta: {
        studentName: getKioskStudentName(selectedStudent),
        studentSchool: getKioskStudentSchool(selectedStudent),
        studentGrade: getKioskStudentGrade(selectedStudent),
        actionLabel: config.label,
        seatLabel: queuedSeatLabel,
      },
    });
  }, [centerId, pin, resetKiosk, resolveSeatForStudent, selectedStudent, submitFastPayload, toast]);

  const canGoBack = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';
  const queuedCount = queuedItems.length;
  const failedCount = failedItems.length;
  const selectedSeat = selectedStudent ? resolveSeatForStudent(selectedStudent) : null;
  const selectedStatus = normalizeStatus(selectedSeat?.status);
  const selectedActions = selectedSeat ? getAllowedActions(selectedStatus) : [];

  return (
    <div className={cn('min-h-[100dvh] overflow-y-auto bg-[#FFF7ED] text-[#14295F]', kioskTouchClass)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-3 bg-[#FF7A16]" />
        <div className="absolute inset-x-0 top-3 h-28 bg-white/70" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[#FF7A16]/10" />
        <Image
          src="/track-logo-mark-transparent.png"
          alt=""
          width={720}
          height={720}
          priority
          className="absolute -right-14 top-20 h-[30rem] w-[30rem] opacity-[0.045]"
        />
      </div>

      {successFeedback ? (
        <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-[#14295F]/18 p-5">
          <div className="w-full max-w-xl rounded-[2.4rem] border-4 border-white bg-[#FF7A16] p-9 text-center text-white shadow-[0_44px_90px_-34px_rgba(255,122,22,0.92)] animate-in zoom-in-95 fade-in duration-75">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.8rem] bg-white text-[#FF7A16] shadow-xl">
              <successFeedback.Icon className="h-12 w-12" />
            </div>
            <div className="mt-6 font-aggro-display text-5xl leading-none sm:text-6xl">
              {successFeedback.title}
            </div>
            <p className="mt-4 text-2xl font-black">{successFeedback.actionLabel}</p>
            <p className="mt-3 text-base font-bold leading-6 text-white/90">{successFeedback.description}</p>
          </div>
        </div>
      ) : null}

      <main className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[760px] flex-col px-5 py-5 sm:px-7 sm:py-7">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white shadow-[0_18px_36px_-24px_rgba(255,122,22,0.56)] ring-2 ring-[#FF7A16]/16">
              <Image src="/track-logo-mark-transparent.png" alt="TRACK" width={42} height={42} priority />
            </div>
            <div>
              <p className="font-aggro-display text-3xl leading-none text-[#14295F]">트랙 키오스크</p>
              <p className="mt-1 text-xs font-black text-[#FF7A16]">출결 키오스크</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {failedCount > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      kioskTouchClass,
                      'inline-flex h-10 items-center gap-2 rounded-full border border-rose-200 bg-white px-3 text-[11px] font-black text-rose-600 shadow-sm transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300'
                    )}
                    aria-label={`실패한 출결 ${failedCount}건 보기`}
                  >
                    <CircleAlert className="h-4 w-4" />
                    오류 {failedCount}건
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[min(92vw,24rem)] rounded-[1.4rem] border-rose-200 bg-white p-0 text-[#14295F] shadow-[0_24px_60px_-30px_rgba(20,41,95,0.34)]"
                >
                  <div className="border-b border-rose-100 bg-rose-50 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-rose-600">처리 실패</p>
                    <p className="mt-1 text-sm font-black text-[#14295F]">{failedCount}건의 출결을 처리하지 못했습니다</p>
                  </div>
                  <div className="flex max-h-80 flex-col gap-2 overflow-y-auto p-3">
                    {failedItems.map((item) => (
                      <div key={item.id} className="rounded-[1rem] border border-rose-100 bg-white px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#14295F]">
                              {formatOutboxStudentLabel(item)}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-bold text-[#5F739F]">
                              {formatOutboxStudentProfileLabel(item)}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-[#5F739F]">
                              {formatOutboxSeatLabel(item)} · {formatOutboxStatusFlow(item)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-black text-rose-600">
                            {formatOutboxActionLabel(item)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8C6B4E]">
                          <span>{formatOutboxTime(item.payload.clientActionAtMillis || item.createdAt)}</span>
                          <span>실패 {formatOutboxTime(item.failedAt)}</span>
                          {item.errorCode ? <span>{item.errorCode}</span> : null}
                        </div>
                        {item.lastError ? (
                          <p className="mt-2 break-keep rounded-[0.75rem] bg-rose-50 px-2 py-1.5 text-[10px] font-bold leading-4 text-rose-600">
                            {item.lastError}
                          </p>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => retryFailedAction(item)}
                          className={cn(
                            kioskTouchClass,
                            'mt-2 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300'
                          )}
                        >
                          다시 보내기
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-rose-100 px-4 py-3">
                    <p className="text-[10px] font-bold leading-4 text-[#8C6B4E]">
                      확인 후 목록을 비울 수 있습니다.
                    </p>
                    <button
                      type="button"
                      onClick={clearFailedActions}
                      className={cn(
                        kioskTouchClass,
                        'shrink-0 rounded-full bg-rose-600 px-3 py-2 text-[10px] font-black text-white transition-colors hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300'
                      )}
                    >
                      비우기
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            {queuedCount > 0 ? (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      kioskTouchClass,
                      'inline-flex h-10 items-center gap-2 rounded-full border border-[#FFD7B0] bg-white px-3 text-[11px] font-black text-[#C95A08] shadow-sm transition-colors hover:bg-[#FFF8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7A16]/30'
                    )}
                    aria-label={`재전송 중인 출결 ${queuedCount}건 보기`}
                  >
                    <WifiOff className="h-4 w-4" />
                    {queuedCount}건 재전송 중
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-[min(92vw,24rem)] rounded-[1.4rem] border-[#FFD7B0] bg-white p-0 text-[#14295F] shadow-[0_24px_60px_-30px_rgba(20,41,95,0.34)]"
                >
                  <div className="border-b border-[#FFE2C5] bg-[#FFF8F0] px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#C95A08]">재전송 대기</p>
                    <p className="mt-1 text-sm font-black text-[#14295F]">{queuedCount}건을 다시 보내는 중입니다</p>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto p-3">
                    {queuedItems.map((item) => (
                      <div key={item.id} className="rounded-[1rem] border border-[#FFE2C5] bg-white px-3 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#14295F]">
                              {formatOutboxStudentLabel(item)}
                            </p>
                            <p className="mt-1 truncate text-[11px] font-bold text-[#5F739F]">
                              {formatOutboxStudentProfileLabel(item)}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-[#5F739F]">
                              {formatOutboxSeatLabel(item)} · {formatOutboxStatusFlow(item)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#FFF0DD] px-2 py-1 text-[10px] font-black text-[#C95A08]">
                            {formatOutboxActionLabel(item)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold text-[#8C6B4E]">
                          <span>{formatOutboxTime(item.payload.clientActionAtMillis || item.createdAt)}</span>
                          <span>시도 {Math.max(0, item.attempts || 0)}회</span>
                        </div>
                        {item.lastError ? (
                          <p className="mt-2 break-keep rounded-[0.75rem] bg-rose-50 px-2 py-1.5 text-[10px] font-bold leading-4 text-rose-600">
                            {item.lastError}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#FFE2C5] px-4 py-3 text-[10px] font-bold leading-4 text-[#8C6B4E]">
                    네트워크가 연결되면 자동으로 재전송되고, 성공하면 이 목록에서 사라집니다.
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}
            {canGoBack ? (
              <Button
                type="button"
                variant="outline"
                onPointerDown={(event) => handleTouchPress(event, 'dashboard', () => router.push('/dashboard'))}
                onKeyDown={(event) => handleKeyboardPress(event, 'dashboard', () => router.push('/dashboard'))}
                className={cn(kioskTouchClass, 'h-12 rounded-[1rem] border-[#FFD7B0] bg-white px-4 text-sm font-black text-[#14295F] shadow-sm hover:bg-white')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                대시보드
              </Button>
            ) : null}
          </div>
        </header>

        <section className="flex flex-1 items-start justify-center py-5 sm:py-6">
          {step === 'pin' ? (
            <div className="w-full space-y-5">
              <div className="relative overflow-hidden rounded-[2rem] border-2 border-[#FFD7B0] bg-white p-6 text-[#14295F] shadow-[0_34px_80px_-50px_rgba(20,41,95,0.34)] sm:rounded-[2.3rem] sm:p-7">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-[#FF7A16]" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-3 bg-[#FF7A16]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[#14295F]/5" />
                <div className="relative z-10 flex min-h-40 items-center justify-between gap-5 sm:min-h-44">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-[#FF7A16] text-white shadow-[0_18px_34px_-24px_rgba(255,122,22,0.76)] sm:h-16 sm:w-16 sm:rounded-[1.35rem]">
                      <ShieldCheck className="h-8 w-8" />
                    </div>
                    <div className="min-w-0">
                      <h1 className="font-aggro-display text-5xl leading-[0.95] sm:text-6xl">번호 6자리</h1>
                      <p className="mt-3 text-lg font-black leading-7 text-[#FF7A16]">출결 확인 대기</p>
                    </div>
                  </div>
                  <div className="hidden shrink-0 rounded-[1.45rem] border border-[#14295F]/10 bg-[#14295F] p-4 text-left text-white shadow-[0_18px_34px_-26px_rgba(20,41,95,0.56)] sm:block">
                    <p className="text-[11px] font-black text-white/70">현재 상태</p>
                    <p className="mt-2 text-xl font-black text-white">번호 입력</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[2rem] border border-[#FFD7B0] bg-white p-5 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.28)] sm:rounded-[2.3rem] sm:p-7">
                <div className="flex justify-center gap-3 sm:gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex h-14 w-11 items-center justify-center rounded-[0.95rem] border-2 text-2xl font-black transition-colors sm:h-[4.35rem] sm:w-14 sm:rounded-[1rem]',
                        pin.length > index
                          ? 'border-[#FF7A16] bg-[#FF7A16] text-white'
                          : 'border-[#FFD7B0] bg-[#FFF7ED] text-[#F4B37A]'
                      )}
                    >
                      {pin[index] ? '●' : ''}
                    </div>
                  ))}
                </div>

                <div className="relative mt-7">
                  {showLookupOverlay ? (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-[1.6rem] bg-white/88 backdrop-blur-sm">
                      <Loader2 className="h-10 w-10 animate-spin text-[#FF7A16]" />
                      <p className="mt-3 text-base font-black text-[#14295F]">{lookupMessage}</p>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant="outline"
                        disabled={isSearching}
                        onPointerDown={(event) => handleTouchPress(event, `num-${num}`, () => handleNumberClick(num))}
                        onKeyDown={(event) => handleKeyboardPress(event, `num-${num}`, () => handleNumberClick(num))}
                        className={cn(kioskTouchClass, 'h-[5.7rem] rounded-[1.35rem] border-2 border-[#FFD7B0] bg-white text-4xl font-black text-[#14295F] shadow-sm active:scale-[0.99] active:bg-[#FFF7ED] sm:h-28 sm:rounded-[1.45rem]')}
                      >
                        {num}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSearching}
                      onPointerDown={(event) => handleTouchPress(event, 'reset', resetKiosk)}
                      onKeyDown={(event) => handleKeyboardPress(event, 'reset', resetKiosk)}
                      className={cn(kioskTouchClass, 'h-[5.7rem] rounded-[1.35rem] border-2 border-[#FFD7B0] bg-[#FFF7ED] text-base font-black text-[#9A4E10] active:scale-[0.99] active:bg-white sm:h-28 sm:rounded-[1.45rem]')}
                    >
                      <RotateCcw className="mr-2 h-5 w-5" />
                      초기화
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSearching}
                      onPointerDown={(event) => handleTouchPress(event, 'num-0', () => handleNumberClick('0'))}
                      onKeyDown={(event) => handleKeyboardPress(event, 'num-0', () => handleNumberClick('0'))}
                      className={cn(kioskTouchClass, 'h-[5.7rem] rounded-[1.35rem] border-2 border-[#FFD7B0] bg-white text-4xl font-black text-[#14295F] shadow-sm active:scale-[0.99] active:bg-[#FFF7ED] sm:h-28 sm:rounded-[1.45rem]')}
                    >
                      0
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSearching}
                      onPointerDown={(event) => handleTouchPress(event, 'delete', handleDelete)}
                      onKeyDown={(event) => handleKeyboardPress(event, 'delete', handleDelete)}
                      className={cn(kioskTouchClass, 'h-[5.7rem] rounded-[1.35rem] border-2 border-[#FFD7B0] bg-[#FFF7ED] text-[#14295F] active:scale-[0.99] active:bg-white sm:h-28 sm:rounded-[1.45rem]')}
                      aria-label="한 글자 지우기"
                    >
                      <Delete className="h-8 w-8" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 'select' ? (
            <div className="mx-auto w-full rounded-[2rem] border border-[#FFD7B0] bg-white p-6 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.28)] sm:rounded-[2.3rem] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black text-[#FF7A16]">학생 확인</p>
                  <h1 className="mt-2 font-aggro-display text-5xl leading-none text-[#14295F]">학생 선택</h1>
                </div>
                <div className="rounded-full bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C95A08]">{matchedStudents.length}명</div>
              </div>
              <div className="mt-7 grid gap-3">
                {matchedStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onPointerDown={(event) => handleTouchPress(event, `student-${student.id}`, () => handleSelectStudent(student))}
                    onKeyDown={(event) => handleKeyboardPress(event, `student-${student.id}`, () => handleSelectStudent(student))}
                    className={cn(kioskTouchClass, 'flex min-h-24 items-center justify-between rounded-[1.55rem] border-2 border-[#FFD7B0] bg-[#FFF7ED] px-5 py-4 text-left shadow-sm transition active:scale-[0.99] active:bg-white')}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-white text-[#FF7A16] shadow-[0_12px_24px_-20px_rgba(255,122,22,0.55)]">
                        <UserRound className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-2xl font-black text-[#14295F]">{student.name}</p>
                        <p className="mt-1 truncate text-sm font-bold text-[#7B5A43]">
                          {[student.schoolName, student.grade, student.className].filter(Boolean).join(' · ') || '학생 정보'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#FF7A16] px-5 py-3 text-base font-black text-white">선택</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                onPointerDown={(event) => handleTouchPress(event, 'select-reset', resetKiosk)}
                onKeyDown={(event) => handleKeyboardPress(event, 'select-reset', resetKiosk)}
                className={cn(kioskTouchClass, 'mt-6 h-14 w-full rounded-[1rem] text-base font-black text-[#9A4E10] hover:bg-[#FFF7ED] hover:text-[#14295F]')}
              >
                처음으로
              </Button>
            </div>
          ) : null}

          {step === 'action' && selectedStudent ? (
            <div className="mx-auto w-full space-y-5">
              <div className="rounded-[2rem] border border-[#FFD7B0] bg-white p-5 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.28)] sm:rounded-[2.3rem] sm:p-7">
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black text-[#FF7A16]">출결 처리</p>
                    <h1 className="mt-2 font-aggro-display text-5xl leading-none text-[#14295F]">바로 처리</h1>
                  </div>
                  <div className="rounded-full border border-[#FFD7B0] bg-[#FFF7ED] px-4 py-2 text-sm font-black text-[#C95A08]">
                    {selectedSeat ? statusLabel[selectedStatus] : '좌석 미배정'}
                  </div>
                </div>

                {selectedSeat ? (
                  <div className={cn('grid grid-cols-1 gap-4', selectedActions.length >= 3 && 'sm:grid-cols-3')}>
                    {selectedActions.map((action) => {
                      const config = ACTIONS[action];
                      return (
                        <button
                          key={action}
                          type="button"
                          onPointerDown={(event) => handleTouchPress(event, `action-${action}`, () => handleAction(action))}
                          onKeyDown={(event) => handleKeyboardPress(event, `action-${action}`, () => handleAction(action))}
                          className={cn(
                            kioskTouchClass,
                            'group relative min-h-32 overflow-hidden rounded-[1.75rem] border-2 border-[#FFD7B0] bg-white p-5 text-left shadow-[0_24px_50px_-36px_rgba(255,122,22,0.62)] transition active:scale-[0.99] sm:min-h-40'
                          )}
                        >
                          <div className={cn('absolute inset-x-0 top-0 h-3 bg-gradient-to-r', config.accentClassName)} />
                          <div className="flex h-full min-w-0 flex-col justify-between gap-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-[#FFF1E4] text-[#FF7A16] shadow-[0_14px_26px_-20px_rgba(255,122,22,0.7)]">
                                <config.Icon className="h-8 w-8" />
                              </div>
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF7A16] text-white shadow-[0_14px_24px_-18px_rgba(255,122,22,0.78)]">
                                <Check className="h-6 w-6" />
                              </div>
                            </div>
                            <div className="min-w-0">
                              <p className="text-4xl font-black leading-none text-[#14295F] sm:text-[2rem] lg:text-4xl">{config.label}</p>
                              <p className="mt-3 whitespace-normal text-base font-black leading-6 text-[#9A4E10]">{config.title}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[1.55rem] border-2 border-[#FFD7B0] bg-[#FFF7ED] p-6 text-center">
                    <p className="text-2xl font-black text-[#14295F]">좌석 배정 확인 필요</p>
                    <p className="mt-2 text-base font-bold text-[#9A4E10]">관리자에게 좌석 배정을 요청해 주세요.</p>
                  </div>
                )}
              </div>

              <div className="rounded-[1.85rem] border border-[#FFD7B0] bg-white px-5 py-4 shadow-[0_20px_42px_-36px_rgba(20,41,95,0.28)]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-[#FFF1E4] text-[#FF7A16] shadow-[0_12px_24px_-20px_rgba(255,122,22,0.55)]">
                    <UserRound className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-2xl font-black text-[#14295F]">{selectedStudent.name}</p>
                    <p className="mt-1 truncate text-sm font-bold text-[#7B5A43]">
                      {[selectedStudent.schoolName, selectedStudent.grade, selectedStudent.className].filter(Boolean).join(' · ') || '학생 정보'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onPointerDown={(event) => handleTouchPress(event, 'action-reset', resetKiosk)}
                    onKeyDown={(event) => handleKeyboardPress(event, 'action-reset', resetKiosk)}
                    className={cn(kioskTouchClass, 'h-12 rounded-[1rem] border-[#FFD7B0] bg-[#FFF7ED] px-4 text-sm font-black text-[#9A4E10] hover:bg-white')}
                  >
                    처음으로
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <footer className="pb-2 text-center text-[11px] font-black text-[#C95A08]/70">
          트랙 학습 시스템
        </footer>
      </main>
    </div>
  );
}
