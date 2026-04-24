'use client';

import type {
  AttendanceRequest,
  AttendanceRequestReasonCategory,
  AttendanceRequestType,
  StudyRoomClassScheduleTemplate,
} from '@/lib/types';

export const ATTENDANCE_REQUEST_PROOF_LIMIT = 2;
export const ATTENDANCE_REQUEST_PROOF_MAX_EDGE = 1600;
export const ATTENDANCE_REQUEST_PROOF_TARGET_BYTES = 450 * 1024;

export const ATTENDANCE_REQUEST_TYPE_LABELS: Record<AttendanceRequestType, string> = {
  late: '지각',
  absence: '결석',
  schedule_change: '등하원 변경',
};

export const SCHEDULE_CHANGE_REASON_LABELS: Record<AttendanceRequestReasonCategory, string> = {
  disaster: '천재지변',
  emergency: '긴급',
  surgery: '수술',
  hospital: '병원',
  other: '기타',
};

export const SCHEDULE_CHANGE_REASON_OPTIONS: Array<{
  value: AttendanceRequestReasonCategory;
  label: string;
  description: string;
}> = [
  { value: 'disaster', label: '천재지변', description: '태풍, 폭설처럼 불가항력 상황이면 벌점이 면제됩니다.' },
  { value: 'emergency', label: '긴급', description: '가정·안전 관련 긴급 상황이면 벌점이 면제됩니다.' },
  { value: 'surgery', label: '수술', description: '수술 일정은 벌점 없이 변경 신청할 수 있습니다.' },
  { value: 'hospital', label: '병원', description: '진료 확인·처방 자료와 학부모님 연락이 모두 확인되어야 벌점이 면제됩니다.' },
  { value: 'other', label: '기타', description: '그 외 사유는 원칙대로 벌점이 반영됩니다.' },
];

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function getAttendanceRequestTypeLabel(type?: AttendanceRequest['type'] | null) {
  if (!type) return '출결 신청';
  return ATTENDANCE_REQUEST_TYPE_LABELS[type] || '출결 신청';
}

export function getScheduleChangeReasonLabel(category?: AttendanceRequestReasonCategory | null) {
  if (!category) return '사유 미입력';
  return SCHEDULE_CHANGE_REASON_LABELS[category] || '사유 미입력';
}

export function shouldWaiveScheduleChangePenalty(
  category?: AttendanceRequestReasonCategory | null,
  proofCount = 0,
  parentContactConfirmed = false
) {
  if (category === 'disaster' || category === 'emergency' || category === 'surgery') return true;
  if (category === 'hospital') return proofCount > 0 && parentContactConfirmed;
  return false;
}

export function formatStudyRoomWeekdays(weekdays?: number[] | null) {
  const safeWeekdays = (weekdays || [])
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    .sort((left, right) => left - right);
  if (!safeWeekdays.length) return '요일 미지정';
  return safeWeekdays.map((weekday) => WEEKDAY_LABELS[weekday]).join(', ');
}

export function buildStudyRoomClassScheduleSummary(schedule: Pick<
  StudyRoomClassScheduleTemplate,
  'weekdays' | 'arrivalTime' | 'departureTime'
>) {
  return `${formatStudyRoomWeekdays(schedule.weekdays)} · ${schedule.arrivalTime} ~ ${schedule.departureTime}`;
}
