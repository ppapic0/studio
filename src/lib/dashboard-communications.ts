import { format } from 'date-fns';

import type { CounselingReservation } from '@/lib/types';

type TimestampLike =
  | { toDate?: () => Date }
  | Date
  | string
  | number
  | null
  | undefined;

export type DashboardCounselTrackTab = 'reservations' | 'logs' | 'inquiries' | 'parent';

export type DashboardSupportKind = 'student_question' | 'student_suggestion' | 'wifi_unblock';

export interface DashboardParentCommunicationRecord {
  id?: string;
  studentId?: string;
  studentName?: string;
  parentUid?: string | null;
  parentName?: string;
  parentPhone?: string;
  senderRole?: 'parent' | 'student' | string;
  senderUid?: string;
  senderName?: string;
  type?: 'consultation' | 'request' | 'suggestion' | string;
  status?: string;
  latestMessageAt?: TimestampLike;
  updatedAt?: TimestampLike;
  repliedAt?: TimestampLike;
  createdAt?: TimestampLike;
  latestMessagePreview?: string;
  replyBody?: string;
  body?: string;
  title?: string;
  supportKind?: DashboardSupportKind | string | null;
  requestedUrl?: string | null;
}

export interface NormalizedDashboardParentCommunication extends DashboardParentCommunicationRecord {
  senderRole: string;
  studentId: string;
  parentUid: string;
  parentName: string;
  parentPhone: string;
}

export interface CounselingTrackPreviewRow {
  id: string;
  studentName: string;
  title?: string;
  preview: string;
  timeLabel: string;
  timeMs: number;
  targetTab: DashboardCounselTrackTab;
  badge: string;
  tone: 'navy' | 'orange' | 'blue' | 'teal';
  activityLabel?: string;
  roleLabel?: string;
  senderRole?: string;
  parentName?: string;
  requestedUrl?: string | null;
  type?: string;
  supportKind?: string | null;
}

export interface CounselingTrackOverview {
  wifiCount: number;
  studentContactCount: number;
  parentContactCount: number;
  consultationCount: number;
  parentRequestCount: number;
  wifiRequests: CounselingTrackPreviewRow[];
  recentContacts: CounselingTrackPreviewRow[];
  consultationInbox: CounselingTrackPreviewRow[];
  parentRequests: CounselingTrackPreviewRow[];
}

export function toDashboardTimestampDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toSafeDashboardStudentName(studentName?: string | null, studentId?: string) {
  const trimmedName = typeof studentName === 'string' ? studentName.trim() : '';
  if (trimmedName) return trimmedName;
  const trimmedId = typeof studentId === 'string' ? studentId.trim() : '';
  if (trimmedId) return `학생-${trimmedId.slice(0, 6)}`;
  return '학생';
}

export function normalizeParentCommunicationRecord(
  item: DashboardParentCommunicationRecord
): NormalizedDashboardParentCommunication {
  const senderRole = typeof item?.senderRole === 'string' ? item.senderRole : '';
  const hasParentIdentity =
    senderRole === 'parent'
    || (typeof item?.parentUid === 'string' && item.parentUid.trim().length > 0)
    || (typeof item?.parentName === 'string' && item.parentName.trim().length > 0)
    || (typeof item?.parentPhone === 'string' && item.parentPhone.trim().length > 0);

  const parentUid = hasParentIdentity
    ? (
      (typeof item?.parentUid === 'string' && item.parentUid.trim())
      || (typeof item?.senderUid === 'string' && item.senderUid.trim())
      || ''
    )
    : '';

  const parentName = hasParentIdentity
    ? (
      (typeof item?.parentName === 'string' && item.parentName.trim())
      || (typeof item?.senderName === 'string' && item.senderName.trim())
      || ''
    )
    : '';

  return {
    ...item,
    senderRole,
    studentId: typeof item?.studentId === 'string' ? item.studentId : '',
    parentUid,
    parentName,
    parentPhone: typeof item?.parentPhone === 'string' ? item.parentPhone.trim() : '',
  };
}

export function formatDashboardTrackTime(value: TimestampLike): string {
  const date = toDashboardTimestampDateSafe(value);
  if (!date) return '시간 미상';
  return format(date, 'M/d HH:mm');
}

export function getCommunicationActivityDate(item: DashboardParentCommunicationRecord): Date | null {
  return (
    toDashboardTimestampDateSafe(item?.latestMessageAt)
    || toDashboardTimestampDateSafe(item?.updatedAt)
    || toDashboardTimestampDateSafe(item?.repliedAt)
    || toDashboardTimestampDateSafe(item?.createdAt)
  );
}

export function getCommunicationPreview(item: DashboardParentCommunicationRecord): string {
  const candidates = [
    item?.latestMessagePreview,
    item?.replyBody,
    item?.body,
    item?.title,
  ];
  const matched = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  return typeof matched === 'string' ? matched.trim() : '';
}

export function getCommunicationKindLabel(
  item: Pick<DashboardParentCommunicationRecord, 'supportKind' | 'type'>
): string {
  if (item?.supportKind === 'wifi_unblock') return '방화벽 요청';
  if (item?.supportKind === 'student_question') return '학생 질문';
  if (item?.supportKind === 'student_suggestion') return '학생 건의';
  if (item?.type === 'consultation') return '상담 문의';
  if (item?.type === 'request') return '일반 요청';
  if (item?.type === 'suggestion') return '건의';
  return '문의';
}

type BuildCounselingTrackOverviewParams = {
  communications: DashboardParentCommunicationRecord[];
  reservations: CounselingReservation[];
  studentNameById: Map<string, string>;
  targetMemberIds: Set<string>;
  recentLimit?: number;
  listLimit?: number;
};

export function buildCounselingTrackOverview({
  communications,
  reservations,
  studentNameById,
  targetMemberIds,
  recentLimit = 5,
  listLimit = 3,
}: BuildCounselingTrackOverviewParams): CounselingTrackOverview {
  const scopedCommunications = communications
    .filter((item) => item.studentId && targetMemberIds.has(item.studentId))
    .map((item) => {
      const normalized = normalizeParentCommunicationRecord(item);
      const activityDate = getCommunicationActivityDate(normalized);
      const studentName =
        studentNameById.get(normalized.studentId)
        || (typeof normalized?.studentName === 'string' && normalized.studentName.trim())
        || toSafeDashboardStudentName(undefined, normalized.studentId);

      return {
        ...normalized,
        studentName,
        preview: getCommunicationPreview(normalized),
        activityDate,
        activityMs: activityDate?.getTime() ?? 0,
        activityLabel: formatDashboardTrackTime(activityDate),
        roleLabel: normalized.senderRole === 'student' ? '학생 1:1' : '학부모 1:1',
        targetTab: normalized.senderRole === 'student' ? 'inquiries' as const : 'parent' as const,
      };
    })
    .sort((left, right) => right.activityMs - left.activityMs);

  const wifiRequests = scopedCommunications
    .filter((item) => {
      const status = typeof item?.status === 'string' ? item.status : 'requested';
      return item.supportKind === 'wifi_unblock' && status !== 'done';
    })
    .map((item) => ({
      id: `wifi-${item.id || item.studentId}`,
      studentName: item.studentName,
      preview: item.preview || '방화벽 해제 사유가 접수되었습니다.',
      timeLabel: item.activityLabel,
      timeMs: item.activityMs,
      targetTab: 'inquiries' as const,
      badge: '방화벽 요청',
      tone: 'orange' as const,
      activityLabel: item.activityLabel,
      roleLabel: item.roleLabel,
      senderRole: item.senderRole,
      parentName: item.parentName,
      requestedUrl: item.requestedUrl,
      type: item.type,
      supportKind: item.supportKind,
    }));

  const consultationThreads = scopedCommunications
    .filter((item) => {
      const status = typeof item?.status === 'string' ? item.status : 'requested';
      return item.type === 'consultation' && status !== 'done';
    })
    .map((item) => ({
      id: `communication-${item.id || item.studentId}`,
      studentName: item.studentName,
      title: (typeof item?.title === 'string' && item.title.trim()) || '상담 문의',
      preview: item.preview || '상담 문의가 접수되었습니다.',
      timeLabel: item.activityLabel,
      timeMs: item.activityMs,
      targetTab: item.senderRole === 'student' ? 'inquiries' as const : 'parent' as const,
      badge: item.senderRole === 'student' ? '학생 상담' : '학부모 상담',
      tone: item.senderRole === 'student' ? 'blue' as const : 'orange' as const,
      activityLabel: item.activityLabel,
      roleLabel: item.roleLabel,
      senderRole: item.senderRole,
      parentName: item.parentName,
      type: item.type,
      supportKind: item.supportKind,
    }));

  const reservationThreads = reservations
    .filter((item) => item.studentId && targetMemberIds.has(item.studentId))
    .filter((item) => item.status !== 'done' && item.status !== 'canceled')
    .map((item) => {
      const createdDate = toDashboardTimestampDateSafe(item.createdAt);
      const studentName =
        studentNameById.get(item.studentId)
        || (typeof item.studentName === 'string' && item.studentName.trim())
        || toSafeDashboardStudentName(undefined, item.studentId);

      return {
        id: `reservation-${item.id}`,
        studentName,
        title: `${studentName} 상담 예약`,
        preview:
          (typeof item.studentNote === 'string' && item.studentNote.trim())
          || `${item.teacherName || '담당 선생님'} 상담이 대기 중입니다.`,
        timeLabel: formatDashboardTrackTime(createdDate),
        timeMs: createdDate?.getTime() ?? 0,
        targetTab: 'reservations' as const,
        badge: item.status === 'confirmed' ? '예약 확정' : '예약 요청',
        tone: 'navy' as const,
      };
    });

  const parentRequests = scopedCommunications
    .filter((item) => {
      const status = typeof item?.status === 'string' ? item.status : 'requested';
      return item.senderRole !== 'student'
        && item.type !== 'consultation'
        && item.supportKind !== 'wifi_unblock'
        && status !== 'done';
    })
    .map((item) => ({
      id: `parent-${item.id || item.studentId}`,
      studentName: item.studentName,
      preview: item.preview || '학부모 요청이 접수되었습니다.',
      timeLabel: item.activityLabel,
      timeMs: item.activityMs,
      targetTab: 'parent' as const,
      badge: item.type === 'suggestion' ? '학부모 건의' : '학부모 문의',
      tone: 'teal' as const,
      activityLabel: item.activityLabel,
      roleLabel: item.roleLabel,
      senderRole: item.senderRole,
      parentName: item.parentName,
      type: item.type,
      supportKind: item.supportKind,
    }));

  return {
    wifiCount: wifiRequests.length,
    studentContactCount: scopedCommunications.filter((item) => item.senderRole === 'student').length,
    parentContactCount: scopedCommunications.filter((item) => item.senderRole !== 'student').length,
    consultationCount: consultationThreads.length + reservationThreads.length,
    parentRequestCount: parentRequests.length,
    wifiRequests: wifiRequests.slice(0, listLimit),
    recentContacts: scopedCommunications
      .filter((item) => item.preview.length > 0 || (typeof item?.title === 'string' && item.title.trim().length > 0))
      .slice(0, recentLimit)
      .map((item) => ({
        id: `contact-${item.id || item.studentId}`,
        studentName: item.studentName,
        preview: item.preview || '최근 연락 내용이 업데이트되었습니다.',
        timeLabel: item.activityLabel,
        timeMs: item.activityMs,
        targetTab: item.targetTab,
        badge: getCommunicationKindLabel(item),
        tone: item.senderRole === 'student' ? 'blue' as const : 'teal' as const,
        activityLabel: item.activityLabel,
        roleLabel: item.roleLabel,
        senderRole: item.senderRole,
        parentName: item.parentName,
        requestedUrl: item.requestedUrl,
        type: item.type,
        supportKind: item.supportKind,
      })),
    consultationInbox: [...consultationThreads, ...reservationThreads]
      .sort((left, right) => right.timeMs - left.timeMs)
      .slice(0, listLimit),
    parentRequests: parentRequests
      .sort((left, right) => right.timeMs - left.timeMs)
      .slice(0, listLimit),
  };
}
