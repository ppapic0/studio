'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Coffee,
  Delete,
  Loader2,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Undo2,
  UserRound,
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, limit, query, Timestamp, where, type Firestore } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/app-context';
import { useFirestore, useFunctions } from '@/firebase';
import { cn } from '@/lib/utils';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import type { AttendanceCurrent, StudentProfile } from '@/lib/types';
import {
  enqueueKioskAttendanceActionSecure,
  type EnqueueKioskAttendanceActionInput,
  type EnqueueKioskAttendanceActionResult,
  type KioskAttendanceAction,
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
  completeTitle: string;
  completeDescription: (studentName: string) => string;
  Icon: LucideIcon;
  buttonClass: string;
  iconClass: string;
  overlayClass: string;
};

type KioskSuccessFeedback = {
  title: string;
  description: string;
  label: string;
  Icon: LucideIcon;
  overlayClass: string;
  iconClass: string;
};

type KioskOutboxItem = {
  id: string;
  payload: EnqueueKioskAttendanceActionInput;
  attempts: number;
  createdAt: number;
  lastError?: string;
};

const OUTBOX_STORAGE_KEY = 'track:kiosk-attendance-outbox:v1';
const MAX_OUTBOX_ITEMS = 40;
const SUCCESS_FEEDBACK_VISIBLE_MS = 900;
const RESET_AFTER_SUCCESS_MS = 140;
const kioskTouchClass = 'touch-manipulation select-none [-webkit-tap-highlight-color:transparent] [touch-action:manipulation]';

const ACTIONS: Record<KioskAttendanceAction, KioskActionConfig> = {
  check_in: {
    action: 'check_in',
    label: '등원',
    completeTitle: '등원 처리 완료',
    completeDescription: (studentName) => `${studentName} 학생 등원이 처리되었습니다.`,
    Icon: LogIn,
    buttonClass: 'bg-[#14295F] text-white shadow-[0_24px_42px_-26px_rgba(20,41,95,0.85)] hover:bg-[#10224E]',
    iconClass: 'bg-white text-[#14295F]',
    overlayClass: 'bg-[#14295F] text-white border-[#D7E4FF]',
  },
  away_start: {
    action: 'away_start',
    label: '외출',
    completeTitle: '외출 처리 완료',
    completeDescription: (studentName) => `${studentName} 학생 외출이 처리되었습니다.`,
    Icon: Coffee,
    buttonClass: 'bg-[#FF7A16] text-white shadow-[0_24px_42px_-26px_rgba(255,122,22,0.9)] hover:bg-[#E9680C]',
    iconClass: 'bg-white text-[#C95A08]',
    overlayClass: 'bg-[#FF7A16] text-white border-[#FFD7B0]',
  },
  away_end: {
    action: 'away_end',
    label: '복귀',
    completeTitle: '복귀 처리 완료',
    completeDescription: (studentName) => `${studentName} 학생 복귀가 처리되었습니다.`,
    Icon: Undo2,
    buttonClass: 'bg-[#0EA36A] text-white shadow-[0_24px_42px_-26px_rgba(14,163,106,0.85)] hover:bg-[#0B8C5A]',
    iconClass: 'bg-white text-[#0B8C5A]',
    overlayClass: 'bg-[#0EA36A] text-white border-[#C7F5E3]',
  },
  check_out: {
    action: 'check_out',
    label: '퇴실',
    completeTitle: '퇴실 처리 완료',
    completeDescription: (studentName) => `${studentName} 학생 퇴실이 처리되었습니다.`,
    Icon: LogOut,
    buttonClass: 'bg-[#F04462] text-white shadow-[0_24px_42px_-26px_rgba(240,68,98,0.86)] hover:bg-[#D93654]',
    iconClass: 'bg-white text-[#D93654]',
    overlayClass: 'bg-[#F04462] text-white border-[#FFD1DB]',
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
  if (status === 'studying') return ['away_start', 'check_out'];
  if (status === 'away' || status === 'break') return ['away_end', 'check_out'];
  return ['check_in'];
}

function getNextStatusForAction(action: KioskAttendanceAction): AttendanceStatus {
  if (action === 'check_in' || action === 'away_end') return 'studying';
  if (action === 'away_start') return 'away';
  return 'absent';
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

function handleKioskPointerPress(event: PointerEvent<HTMLElement>, action: () => void) {
  if (event.pointerType === 'mouse') return;
  event.preventDefault();
  action();
}

function readOutbox(): KioskOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(OUTBOX_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_OUTBOX_ITEMS) : [];
  } catch {
    return [];
  }
}

function writeOutbox(items: KioskOutboxItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items.slice(-MAX_OUTBOX_ITEMS)));
}

function getKioskErrorMessage(error: unknown) {
  const raw = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    customData?: unknown;
  };
  const detailSources = [raw.details, raw.customData];
  for (const source of detailSources) {
    if (source && typeof source === 'object') {
      const userMessage = (source as Record<string, unknown>).userMessage;
      if (typeof userMessage === 'string' && userMessage.trim()) return userMessage.trim();
    }
  }
  const code = typeof raw.code === 'string' ? raw.code.toLowerCase() : '';
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';
  if (code.includes('internal') || /(^|\b)(functions\/)?internal(\b|$)/i.test(message)) {
    return '키오스크 출결 처리 중 서버 응답이 불안정했습니다. 실제 반영 여부를 확인한 뒤 다시 처리합니다.';
  }
  if (message) return message;
  return '잠시 후 다시 시도해 주세요.';
}

function getKioskCallableErrorCode(error: unknown): string {
  const raw = error as { code?: unknown };
  return typeof raw?.code === 'string' ? raw.code.toLowerCase().replace(/^functions\//, '') : '';
}

function shouldUseDirectKioskAttendanceFallback(error: unknown): boolean {
  const code = getKioskCallableErrorCode(error);
  const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || '');
  return (
    code === 'internal' ||
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    /\b(functions\/)?(internal|unavailable|deadline-exceeded)\b/i.test(message)
  );
}

async function verifyKioskSeatStatus(params: {
  firestore: Firestore | null;
  payload: EnqueueKioskAttendanceActionInput;
  expectedStatus: AttendanceStatus;
  seatId?: string | null;
}): Promise<{
  verified: boolean;
  confirmedStatus?: AttendanceStatus;
  confirmedSeatId?: string;
}> {
  if (!params.firestore) {
    return { verified: false };
  }

  const readSeatStatus = async (seatId: string) => {
    const seatSnap = await getDoc(doc(
      params.firestore!,
      'centers',
      params.payload.centerId,
      'attendanceCurrent',
      seatId
    ));
    if (!seatSnap.exists()) {
      return { verified: false, confirmedSeatId: seatId };
    }

    const seatData = seatSnap.data() as Partial<AttendanceCurrent>;
    if (seatData.studentId && seatData.studentId !== params.payload.studentId) {
      return {
        verified: false,
        confirmedSeatId: seatSnap.id,
        confirmedStatus: normalizeStatus(seatData.status),
      };
    }

    const confirmedStatus = normalizeStatus(seatData.status);
    return {
      verified: confirmedStatus === params.expectedStatus,
      confirmedSeatId: seatSnap.id,
      confirmedStatus,
    };
  };

  const candidateSeatId = params.seatId || params.payload.seatId || '';
  if (candidateSeatId) {
    const directResult = await readSeatStatus(candidateSeatId);
    if (directResult.verified) {
      return directResult;
    }
  }

  const seatsSnap = await getDocs(query(
    collection(params.firestore, 'centers', params.payload.centerId, 'attendanceCurrent'),
    where('studentId', '==', params.payload.studentId),
    limit(10)
  ));
  const seats = seatsSnap.docs.map((docSnap) => {
    const data = docSnap.data() as AttendanceCurrent;
    return {
      ...data,
      id: docSnap.id,
      studentId: data.studentId || params.payload.studentId,
      status: normalizeStatus(data.status),
    };
  });
  const matchingSeat = seats.find((seat) => seat.status === params.expectedStatus) || pickPreferredSeat(seats);
  if (matchingSeat) {
    return {
      verified: matchingSeat.status === params.expectedStatus,
      confirmedSeatId: matchingSeat.id,
      confirmedStatus: matchingSeat.status,
    };
  }

  return { verified: false, confirmedSeatId: candidateSeatId || undefined };
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
  const [lookupMessage, setLookupMessage] = useState('번호 확인 중');
  const [successFeedback, setSuccessFeedback] = useState<KioskSuccessFeedback | null>(null);
  const [actionProcessingLabel, setActionProcessingLabel] = useState<string | null>(null);
  const lookupVersionRef = useRef(0);
  const pendingActionRef = useRef(false);
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

  const resetKiosk = useCallback(() => {
    lookupVersionRef.current += 1;
    setPin('');
    setStep('pin');
    setMatchedStudents([]);
    setLookupSeats([]);
    setSelectedStudent(null);
    setLookupMessage('번호 확인 중');
    setIsSearching(false);
  }, []);

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
          name: String(data.name || raw.displayName || '학생'),
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

    try {
      let lookupData: KioskStudentLookupResult | null = null;
      try {
        lookupData = await lookupStudentFromFirestore(code);
      } catch (firestoreError) {
        console.warn('[kiosk] fast Firestore lookup failed', firestoreError);
      }

      if ((!lookupData || !lookupData.students?.length) && lookupKioskStudentsByPin) {
        setLookupMessage('학생 정보 확인 중');
        lookupData = await lookupStudentFromBackend(code);
      }

      if (lookupVersion !== lookupVersionRef.current) return;

      const students = lookupData?.students || [];
      const seats = (lookupData?.seats || []).map((seat) => ({ ...seat, status: normalizeStatus(seat.status) }));
      if (!students.length) {
        toast({
          variant: 'destructive',
          title: '일치하는 정보 없음',
          description: '번호를 다시 입력해 주세요.',
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
    } catch (error) {
      console.error('[kiosk] student lookup failed', error);
      toast({
        variant: 'destructive',
        title: '조회 실패',
        description: getKioskErrorMessage(error),
      });
      resetKiosk();
    } finally {
      if (lookupVersion === lookupVersionRef.current) {
        setIsSearching(false);
        setLookupMessage('번호 확인 중');
      }
    }
  }, [
    centerId,
    firestore,
    lookupKioskStudentsByPin,
    lookupStudentFromBackend,
    lookupStudentFromFirestore,
    resetKiosk,
    toast,
  ]);

  const flushOutbox = useCallback(async () => {
    if (!functions || flushingOutboxRef.current) return;
    flushingOutboxRef.current = true;
    try {
      let items = readOutbox();
      for (const item of items) {
        try {
          const result = await enqueueKioskAttendanceActionSecure(functions, item.payload);
          if (result.status === 'completed' || result.status === 'failed' || result.status === 'rejected_stale') {
            items = readOutbox().filter((candidate) => candidate.id !== item.id);
            writeOutbox(items);
          } else {
            break;
          }
        } catch (error) {
          const nextItems = readOutbox().map((candidate) =>
            candidate.id === item.id
              ? { ...candidate, attempts: candidate.attempts + 1, lastError: getKioskErrorMessage(error) }
              : candidate
          );
          writeOutbox(nextItems);
          console.warn('[kiosk] queued attendance delivery pending', error);
          break;
        }
      }
    } finally {
      flushingOutboxRef.current = false;
    }
  }, [functions]);

  const saveActionForRetry = useCallback((payload: EnqueueKioskAttendanceActionInput) => {
    const items = readOutbox().filter((item) => item.id !== payload.idempotencyKey);
    writeOutbox([
      ...items,
      {
        id: payload.idempotencyKey,
        payload,
        attempts: 0,
        createdAt: Date.now(),
      },
    ]);
  }, []);

  const removeActionFromRetry = useCallback((idempotencyKey: string) => {
    writeOutbox(readOutbox().filter((item) => item.id !== idempotencyKey));
  }, []);

  const sendActionToBackend = useCallback(async (payload: EnqueueKioskAttendanceActionInput): Promise<EnqueueKioskAttendanceActionResult> => {
    saveActionForRetry(payload);
    const nextStatus = getNextStatusForAction(payload.action);
    if (!functions) {
      void flushOutbox();
      return {
        ok: true,
        queued: true,
        actionId: payload.idempotencyKey,
        optimisticStatus: nextStatus,
        status: 'queued',
        userMessage: '네트워크가 연결되면 자동으로 다시 전송합니다.',
      };
    }

    let result: EnqueueKioskAttendanceActionResult;
    try {
      result = await enqueueKioskAttendanceActionSecure(functions, payload);
    } catch (error) {
      if (!shouldUseDirectKioskAttendanceFallback(error)) {
        throw error;
      }

      const alreadyApplied = await verifyKioskSeatStatus({
        firestore,
        payload,
        expectedStatus: nextStatus,
      });
      if (alreadyApplied.verified) {
        return {
          ok: true,
          queued: false,
          actionId: payload.idempotencyKey,
          optimisticStatus: nextStatus,
          status: 'completed',
          verified: true,
          confirmedStatus: alreadyApplied.confirmedStatus || nextStatus,
          confirmedSeatId: alreadyApplied.confirmedSeatId,
          result: {
            fallback: 'post_error_verification',
            originalError: getKioskErrorMessage(error),
          },
        };
      }

      const directAttendanceFn = httpsCallable<
        {
          centerId: string;
          studentId: string;
          nextStatus: AttendanceStatus;
          seatId?: string;
          seatHint?: EnqueueKioskAttendanceActionInput['seatHint'];
          source: 'kiosk';
        },
        Record<string, unknown>
      >(functions, 'setStudentAttendanceStatusSecure');
      const directResult = await directAttendanceFn({
        centerId: payload.centerId,
        studentId: payload.studentId,
        nextStatus,
        seatId: payload.seatId || undefined,
        seatHint: payload.seatHint || undefined,
        source: 'kiosk',
      });
      const directResultData = directResult.data as { seatId?: unknown };
      const directResultSeatId = typeof directResultData?.seatId === 'string' ? directResultData.seatId : null;
      const verified = await verifyKioskSeatStatus({
        firestore,
        payload,
        expectedStatus: nextStatus,
        seatId: directResultSeatId || payload.seatId,
      });

      if (!verified.verified) {
        return {
          ok: true,
          queued: false,
          actionId: payload.idempotencyKey,
          optimisticStatus: nextStatus,
          status: 'failed',
          confirmedStatus: verified.confirmedStatus,
          confirmedSeatId: verified.confirmedSeatId,
          result: directResult.data,
          userMessage: '출결 처리 요청은 보냈지만 실제 상태 확인에 실패했습니다. 번호를 다시 입력해 현재 상태를 확인해 주세요.',
          failedReason: getKioskErrorMessage(error),
        };
      }

      result = {
        ok: true,
        queued: false,
        actionId: payload.idempotencyKey,
        optimisticStatus: nextStatus,
        status: 'completed',
        verified: true,
        confirmedStatus: verified.confirmedStatus || nextStatus,
        confirmedSeatId: verified.confirmedSeatId,
        result: {
          ...directResult.data,
          fallback: 'setStudentAttendanceStatusSecure',
          originalError: getKioskErrorMessage(error),
        },
      };
    }
    if (result.status === 'completed' || result.status === 'failed' || result.status === 'rejected_stale') {
      removeActionFromRetry(payload.idempotencyKey);
    }
    return result;
  }, [firestore, flushOutbox, functions, removeActionFromRetry, saveActionForRetry]);

  useEffect(() => {
    void flushOutbox();
    const interval = window.setInterval(() => void flushOutbox(), 10000);
    const handleOnline = () => void flushOutbox();
    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, [flushOutbox]);

  useEffect(() => {
    if (!successFeedback) return;
    const timer = window.setTimeout(() => setSuccessFeedback(null), SUCCESS_FEEDBACK_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [successFeedback]);

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

  const handleAction = useCallback(async (action: KioskAttendanceAction) => {
    if (!centerId || !selectedStudent || pendingActionRef.current) return;
    const seat = resolveSeatForStudent(selectedStudent);
    if (!seat) {
      toast({
        variant: 'destructive',
        title: '좌석 미배정',
        description: '관리자에게 좌석 배정을 요청해 주세요.',
      });
      resetKiosk();
      return;
    }

    const status = normalizeStatus(seat.status);
    if (!getAllowedActions(status).includes(action)) {
      toast({
        variant: 'destructive',
        title: '처리할 수 없는 상태',
        description: '번호를 다시 입력해 현재 상태를 확인해 주세요.',
      });
      resetKiosk();
      return;
    }

    const config = ACTIONS[action];
    const nextStatus = getNextStatusForAction(action);
    pendingActionRef.current = true;
    setActionProcessingLabel(`${config.label} 처리 중`);

    const payload: EnqueueKioskAttendanceActionInput = {
      centerId,
      studentId: selectedStudent.id,
      pin,
      action,
      expectedStatus: status,
      seatId: seat.id,
      seatHint: {
        seatNo: seat.seatNo ?? selectedStudent.seatNo ?? null,
        roomId: seat.roomId || selectedStudent.roomId || null,
        roomSeatNo: seat.roomSeatNo ?? selectedStudent.roomSeatNo ?? null,
      },
      idempotencyKey: createIdempotencyKey(),
      clientActionAtMillis: Date.now(),
    };

    try {
      const result = await sendActionToBackend(payload);
      const confirmedStatus = result.confirmedStatus ? normalizeStatus(result.confirmedStatus) : undefined;
      const isAlreadyApplied = Boolean(confirmedStatus && confirmedStatus === nextStatus);
      if (result.status !== 'completed' && !isAlreadyApplied) {
        toast({
          variant: result.status === 'failed' || result.status === 'rejected_stale' ? 'destructive' : 'default',
          title: result.status === 'failed' || result.status === 'rejected_stale' ? '처리 실패' : '전송 대기 중',
          description:
            result.userMessage ||
            result.failedReason ||
            (result.status === 'rejected_stale'
              ? '출결 상태가 바뀌었습니다. 번호를 다시 입력해 현재 상태를 확인해 주세요.'
              : '백엔드 처리가 완료되면 자동 반영됩니다.'),
        });
        resetKiosk();
        return;
      }

      setSuccessFeedback({
        title: config.completeTitle,
        description: config.completeDescription(selectedStudent.name),
        label: config.label,
        Icon: config.Icon,
        overlayClass: config.overlayClass,
        iconClass: config.iconClass,
      });
      window.setTimeout(() => {
        resetKiosk();
      }, RESET_AFTER_SUCCESS_MS);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '처리 실패',
        description: getKioskErrorMessage(error),
      });
      void flushOutbox();
      resetKiosk();
    } finally {
      setActionProcessingLabel(null);
      pendingActionRef.current = false;
    }
  }, [centerId, flushOutbox, pin, resetKiosk, resolveSeatForStudent, selectedStudent, sendActionToBackend, toast]);

  const canGoBack = activeMembership?.role === 'teacher' || activeMembership?.role === 'centerAdmin';
  const selectedSeat = selectedStudent ? resolveSeatForStudent(selectedStudent) : null;
  const selectedStatus = normalizeStatus(selectedSeat?.status);
  const selectedActions = selectedSeat ? getAllowedActions(selectedStatus) : [];

  return (
    <div className={cn('min-h-screen overflow-hidden bg-[#F7FAFF] text-[#14295F]', kioskTouchClass)}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <Image
          src="/track-logo-mark-transparent.png"
          alt=""
          width={720}
          height={720}
          priority
          className="absolute -right-24 top-12 h-[34rem] w-[34rem] opacity-[0.035]"
        />
        <div className="absolute inset-x-0 top-0 h-1 bg-[#FF7A16]" />
      </div>

      {successFeedback && (
        <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-[#061330]/48 p-5 backdrop-blur-[2px]">
          <div className={cn(
            'w-full max-w-lg rounded-[2rem] border-4 p-9 text-center shadow-[0_44px_80px_-34px_rgba(6,19,48,0.9)]',
            'animate-in zoom-in-95 fade-in duration-100',
            successFeedback.overlayClass
          )}>
            <div className={cn('mx-auto flex h-24 w-24 items-center justify-center rounded-[1.65rem] shadow-xl', successFeedback.iconClass)}>
              <successFeedback.Icon className="h-12 w-12" />
            </div>
            <div className="mt-6 font-aggro-display text-5xl leading-none text-white sm:text-6xl">
              처리 완료
            </div>
            <p className="mt-4 text-xl font-black text-white">{successFeedback.label}</p>
            <p className="mt-3 text-base font-bold leading-6 text-white/86">{successFeedback.description}</p>
          </div>
        </div>
      )}

      {actionProcessingLabel && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-[#061330]/45 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-[#D7E4FF] bg-white p-8 text-center shadow-[0_34px_70px_-34px_rgba(6,19,48,0.75)]">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#FF7A16]" />
            <p className="mt-5 text-xl font-black text-[#14295F]">{actionProcessingLabel}</p>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.15rem] border border-[#D7E4FF] bg-white shadow-[0_14px_30px_-24px_rgba(20,41,95,0.42)]">
              <Image src="/track-logo-mark-transparent.png" alt="TRACK" width={36} height={36} priority />
            </div>
            <div>
              <p className="font-aggro-display text-2xl leading-none text-[#14295F]">출결 키오스크</p>
              <p className="mt-1 text-xs font-black text-[#5C6E97]">TRACK Attendance</p>
            </div>
          </div>

          {canGoBack ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="h-11 rounded-[1rem] border-[#D7E4FF] bg-white px-4 text-sm font-black text-[#14295F] shadow-sm hover:bg-[#F1F6FF]"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              대시보드
            </Button>
          ) : null}
        </div>

        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8">
          {step === 'pin' ? (
            <div className="rounded-[2rem] border border-[#D7E4FF] bg-white p-6 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.52)] sm:p-8">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#14295F] text-white shadow-[0_20px_36px_-24px_rgba(20,41,95,0.7)]">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h1 className="mt-6 font-aggro-display text-5xl leading-none text-[#14295F] sm:text-6xl">
                  번호 6자리 입력
                </h1>
              </div>

              <div className="mt-8 flex justify-center gap-3 sm:gap-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      'flex h-16 w-12 items-center justify-center rounded-[1rem] border-2 text-2xl font-black transition-colors sm:h-[4.6rem] sm:w-14',
                      pin.length > index
                        ? 'border-[#14295F] bg-[#14295F] text-white'
                        : 'border-[#D7E4FF] bg-[#F7FAFF] text-[#A6B5D1]'
                    )}
                  >
                    {pin[index] ? '●' : ''}
                  </div>
                ))}
              </div>

              <div className="relative mt-8">
                {isSearching ? (
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
                      onPointerDown={(event) => handleKioskPointerPress(event, () => handleNumberClick(num))}
                      onClick={() => handleNumberClick(num)}
                      className={cn(kioskTouchClass, 'h-20 rounded-[1.35rem] border-2 border-[#D7E4FF] bg-white text-3xl font-black text-[#14295F] shadow-sm active:scale-[0.99] active:bg-[#F1F6FF] sm:h-24')}
                    >
                      {num}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSearching}
                    onPointerDown={(event) => handleKioskPointerPress(event, resetKiosk)}
                    onClick={resetKiosk}
                    className={cn(kioskTouchClass, 'h-20 rounded-[1.35rem] border-2 border-[#D7E4FF] bg-[#F7FAFF] text-base font-black text-[#5C6E97] active:scale-[0.99] active:bg-white sm:h-24')}
                  >
                    <RotateCcw className="mr-2 h-5 w-5" />
                    초기화
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSearching}
                    onPointerDown={(event) => handleKioskPointerPress(event, () => handleNumberClick('0'))}
                    onClick={() => handleNumberClick('0')}
                    className={cn(kioskTouchClass, 'h-20 rounded-[1.35rem] border-2 border-[#D7E4FF] bg-white text-3xl font-black text-[#14295F] shadow-sm active:scale-[0.99] active:bg-[#F1F6FF] sm:h-24')}
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSearching}
                    onPointerDown={(event) => handleKioskPointerPress(event, handleDelete)}
                    onClick={handleDelete}
                    className={cn(kioskTouchClass, 'h-20 rounded-[1.35rem] border-2 border-[#D7E4FF] bg-[#F7FAFF] text-[#14295F] active:scale-[0.99] active:bg-white sm:h-24')}
                    aria-label="한 글자 지우기"
                  >
                    <Delete className="h-8 w-8" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 'select' ? (
            <div className="rounded-[2rem] border border-[#D7E4FF] bg-white p-6 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.52)] sm:p-8">
              <div className="text-center">
                <p className="font-aggro-display text-4xl leading-none text-[#14295F] sm:text-5xl">학생 선택</p>
              </div>
              <div className="mt-7 grid gap-3">
                {matchedStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onPointerDown={(event) =>
                      handleKioskPointerPress(event, () => {
                        setSelectedStudent(student);
                        setStep('action');
                      })
                    }
                    onClick={() => {
                      setSelectedStudent(student);
                      setStep('action');
                    }}
                    className={cn(kioskTouchClass, 'flex min-h-20 items-center justify-between rounded-[1.35rem] border border-[#D7E4FF] bg-[#F7FAFF] px-5 py-4 text-left shadow-sm transition hover:border-[#FF7A16]/40 hover:bg-white active:scale-[0.99] active:bg-white')}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-white text-[#14295F] shadow-[0_12px_24px_-20px_rgba(20,41,95,0.45)]">
                        <UserRound className="h-6 w-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xl font-black text-[#14295F]">{student.name}</p>
                        <p className="mt-1 truncate text-sm font-bold text-[#5C6E97]">
                          {[student.schoolName, student.grade, student.className].filter(Boolean).join(' · ') || '학생 정보'}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#14295F] px-4 py-2 text-sm font-black text-white">선택</span>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                onPointerDown={(event) => handleKioskPointerPress(event, resetKiosk)}
                onClick={resetKiosk}
                className={cn(kioskTouchClass, 'mt-5 h-12 w-full rounded-[1rem] text-base font-black text-[#5C6E97] hover:bg-[#F1F6FF] hover:text-[#14295F]')}
              >
                처음으로
              </Button>
            </div>
          ) : null}

          {step === 'action' && selectedStudent ? (
            <div className="rounded-[2rem] border border-[#D7E4FF] bg-white p-6 shadow-[0_34px_80px_-54px_rgba(20,41,95,0.52)] sm:p-8">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-[#F7FAFF] text-[#14295F] ring-1 ring-[#D7E4FF]">
                  <UserRound className="h-8 w-8" />
                </div>
                <p className="mt-5 font-aggro-display text-5xl leading-none text-[#14295F] sm:text-6xl">
                  {selectedStudent.name}
                </p>
                <p className="mt-3 text-base font-black text-[#5C6E97]">
                  {[selectedStudent.schoolName, selectedStudent.grade, selectedStudent.className].filter(Boolean).join(' · ') || '학생 정보'}
                </p>
                <div className="mt-5 inline-flex rounded-full border border-[#D7E4FF] bg-[#F7FAFF] px-4 py-2 text-sm font-black text-[#14295F]">
                  현재 {selectedSeat ? statusLabel[selectedStatus] : '좌석 미배정'}
                </div>
              </div>

              {selectedSeat ? (
                <div className={cn('mt-8 grid gap-4', selectedActions.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
                  {selectedActions.map((action) => {
                    const config = ACTIONS[action];
                    return (
                      <Button
                         key={action}
                         type="button"
                         onPointerDown={(event) => handleKioskPointerPress(event, () => void handleAction(action))}
                         onClick={() => handleAction(action)}
                         disabled={Boolean(actionProcessingLabel)}
                         className={cn(
                           kioskTouchClass,
                           'h-36 rounded-[1.65rem] text-white transition active:scale-[0.99] active:brightness-95 sm:h-44',
                           'flex flex-col items-center justify-center gap-4 border-0 text-2xl font-black',
                           config.buttonClass
                        )}
                      >
                        <span className={cn('flex h-14 w-14 items-center justify-center rounded-[1.1rem]', config.iconClass)}>
                          <config.Icon className="h-8 w-8" />
                        </span>
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-8 rounded-[1.35rem] border border-[#FFD7B0] bg-[#FFF8F1] p-5 text-center">
                  <p className="text-lg font-black text-[#14295F]">좌석 배정 확인 필요</p>
                  <p className="mt-2 text-sm font-bold text-[#8A5A2B]">관리자에게 좌석 배정을 요청해 주세요.</p>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                onPointerDown={(event) => handleKioskPointerPress(event, resetKiosk)}
                onClick={resetKiosk}
                className={cn(kioskTouchClass, 'mt-5 h-12 w-full rounded-[1rem] text-base font-black text-[#5C6E97] hover:bg-[#F1F6FF] hover:text-[#14295F]')}
              >
                처음으로
              </Button>
            </div>
          ) : null}
        </section>

        <footer className="pb-2 text-center text-[11px] font-black text-[#8FA0BE]">
          TRACK LEARNING SYSTEM
        </footer>
      </main>

      <div className="fixed bottom-4 right-4 hidden items-center gap-2 rounded-full border border-[#D7E4FF] bg-white px-3 py-2 text-[11px] font-black text-[#5C6E97] shadow-sm sm:flex">
        <CheckCircle2 className="h-4 w-4 text-[#FF7A16]" />
        Queue Ready
      </div>
    </div>
  );
}
