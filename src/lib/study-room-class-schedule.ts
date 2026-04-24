import type {
  StudentScheduleTemplate,
  StudyRoomClassScheduleTemplate,
  StudyRoomPeriodBlock,
} from '@/lib/types';

export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_ID = 'shared-study-room-schedule';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME = '센터 공통 교시제';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const NSU_STUDY_ROOM_CLASS_SCHEDULE_ID = 'nsu-study-room-schedule';
export const NSU_STUDY_ROOM_CLASS_SCHEDULE_NAME = 'N수반 교시제';
export const DEFAULT_STUDY_ROOM_SCHEDULE_TEMPLATE_ID = 'default-shared-study-room-schedule';
export const NSU_STUDY_ROOM_SCHEDULE_TEMPLATE_ID = 'default-nsu-study-room-schedule';

export type StudyRoomScheduleTrack = 'regular' | 'nsu';

export const SHARED_STUDY_ROOM_PERIOD_BLOCKS: StudyRoomPeriodBlock[] = [
  {
    id: 'shared-arrival',
    label: '자율등원',
    startTime: '17:00',
    endTime: '18:00',
    description: '저녁 / 상담 / 숙제체크',
  },
  {
    id: 'shared-checkin',
    label: '출결 안내',
    startTime: '18:00',
    endTime: '18:10',
    description: '출결 / 자리정리 / 당일 안내',
  },
  {
    id: 'shared-period-1',
    label: '1교시',
    startTime: '18:10',
    endTime: '19:30',
    description: '',
  },
  {
    id: 'shared-break-1',
    label: '쉬는시간',
    startTime: '19:30',
    endTime: '19:40',
    description: '',
  },
  {
    id: 'shared-period-2',
    label: '2교시',
    startTime: '19:40',
    endTime: '21:00',
    description: '',
  },
  {
    id: 'shared-break-long',
    label: '긴 쉬는시간',
    startTime: '21:00',
    endTime: '21:20',
    description: '',
  },
  {
    id: 'shared-period-3',
    label: '3교시',
    startTime: '21:20',
    endTime: '22:40',
    description: '',
  },
  {
    id: 'shared-break-2',
    label: '쉬는시간',
    startTime: '22:40',
    endTime: '22:50',
    description: '',
  },
  {
    id: 'shared-mandatory-study',
    label: '의무관리 자습',
    startTime: '22:50',
    endTime: '23:30',
    description: '오답정리 / 테스트 / 질의응답',
  },
  {
    id: 'shared-period-4',
    label: '4교시 또는 심화반',
    startTime: '23:30',
    endTime: '00:50',
    description: '보강 / 선택자습',
  },
  {
    id: 'shared-wrap-up',
    label: '정리 / 귀가',
    startTime: '00:50',
    endTime: '01:00',
    description: '',
  },
];

function clonePeriodBlocks(prefix: string) {
  return SHARED_STUDY_ROOM_PERIOD_BLOCKS.map((block) => ({
    ...block,
    id: block.id.replace('shared', prefix),
  }));
}

export function isNsuClassName(className?: string | null) {
  const normalized = String(className || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._-]/g, '');

  return (
    normalized.includes('n수') ||
    normalized.includes('엔수') ||
    normalized.includes('재수') ||
    normalized.includes('nstudent') ||
    normalized.includes('n반')
  );
}

export function resolveStudyRoomScheduleTrack(className?: string | null): StudyRoomScheduleTrack {
  return isNsuClassName(className) ? 'nsu' : 'regular';
}

export function getStudyRoomClassScheduleDisplayName(
  schedule: Pick<StudyRoomClassScheduleTemplate, 'className'>
) {
  const name = schedule.className?.trim() || SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME;
  if (name.includes('교시제')) return name;
  return `${name} 반 교시제`;
}

export function buildSharedStudyRoomClassSchedule(
  centerId?: string | null
): StudyRoomClassScheduleTemplate | null {
  if (!centerId) return null;

  return {
    id: SHARED_STUDY_ROOM_CLASS_SCHEDULE_ID,
    centerId,
    className: SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME,
    weekdays: [...SHARED_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS],
    arrivalTime: '17:00',
    departureTime: '01:00',
    note: '특이사항이 없으면 이 교시제를 그대로 따르고, 학원 일정이 있는 학생만 별도로 등록합니다.',
    blocks: SHARED_STUDY_ROOM_PERIOD_BLOCKS.map((block) => ({ ...block })),
    active: true,
    createdByUid: null,
    updatedByUid: null,
  };
}

export function buildNsuStudyRoomClassSchedule(
  centerId?: string | null
): StudyRoomClassScheduleTemplate | null {
  if (!centerId) return null;

  return {
    id: NSU_STUDY_ROOM_CLASS_SCHEDULE_ID,
    centerId,
    className: NSU_STUDY_ROOM_CLASS_SCHEDULE_NAME,
    weekdays: [...SHARED_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS],
    arrivalTime: '17:00',
    departureTime: '01:00',
    note: 'N수반은 일반 토요일·일요일 교시제를 평일에도 동일하게 적용합니다. 특이사항이 있는 학생만 학원 일정을 별도로 등록합니다.',
    blocks: clonePeriodBlocks('nsu'),
    active: true,
    createdByUid: null,
    updatedByUid: null,
  };
}

export function buildSharedStudyRoomClassSchedules(centerId?: string | null) {
  const sharedSchedule = buildSharedStudyRoomClassSchedule(centerId);
  const nsuSchedule = buildNsuStudyRoomClassSchedule(centerId);
  return [sharedSchedule, nsuSchedule].filter(
    (schedule): schedule is StudyRoomClassScheduleTemplate => Boolean(schedule)
  );
}

export function buildStudyRoomClassSchedulesForClassName(
  centerId?: string | null,
  className?: string | null
) {
  const schedule =
    resolveStudyRoomScheduleTrack(className) === 'nsu'
      ? buildNsuStudyRoomClassSchedule(centerId)
      : buildSharedStudyRoomClassSchedule(centerId);

  return schedule ? [schedule] : [];
}

export function buildDefaultStudyRoomScheduleTemplates(params: {
  centerId?: string | null;
  className?: string | null;
}): Array<Omit<StudentScheduleTemplate, 'createdAt' | 'updatedAt'>> {
  const track = resolveStudyRoomScheduleTrack(params.className);
  const schedule =
    track === 'nsu'
      ? buildNsuStudyRoomClassSchedule(params.centerId)
      : buildSharedStudyRoomClassSchedule(params.centerId);

  if (!schedule) return [];

  return [
    {
      id:
        track === 'nsu'
          ? NSU_STUDY_ROOM_SCHEDULE_TEMPLATE_ID
          : DEFAULT_STUDY_ROOM_SCHEDULE_TEMPLATE_ID,
      centerId: params.centerId || null,
      name: `${getStudyRoomClassScheduleDisplayName(schedule)} 기본 등하원`,
      weekdays: [...schedule.weekdays],
      arrivalPlannedAt: schedule.arrivalTime,
      departurePlannedAt: schedule.departureTime,
      academyNameDefault: null,
      academyStartAtDefault: null,
      academyEndAtDefault: null,
      hasExcursionDefault: false,
      defaultExcursionStartAt: null,
      defaultExcursionEndAt: null,
      defaultExcursionReason: null,
      note: schedule.note || null,
      classScheduleId: schedule.id || null,
      classScheduleName: getStudyRoomClassScheduleDisplayName(schedule),
      active: true,
      timezone: 'Asia/Seoul',
      source: 'default-study-room-class-schedule',
    },
  ];
}
