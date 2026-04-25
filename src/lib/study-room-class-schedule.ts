import type {
  StudentScheduleTemplate,
  StudyRoomClassScheduleTemplate,
  StudyRoomPeriodBlock,
} from '@/lib/types';

export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_ID = 'shared-study-room-schedule';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME = '센터 공통 트랙제';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5, 0] as const;
export const SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_ID = 'saturday-mandatory-track-schedule';
export const SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_NAME = '토요일 의무 트랙제';
export const SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS = [6] as const;
export const NSU_STUDY_ROOM_CLASS_SCHEDULE_ID = 'nsu-study-room-schedule';
export const NSU_STUDY_ROOM_CLASS_SCHEDULE_NAME = 'N수반 트랙제';
export const NSU_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const DEFAULT_STUDY_ROOM_SCHEDULE_TEMPLATE_ID = 'default-shared-study-room-schedule';
export const SATURDAY_STUDY_ROOM_SCHEDULE_TEMPLATE_ID = 'default-saturday-mandatory-track-schedule';
export const NSU_STUDY_ROOM_SCHEDULE_TEMPLATE_ID = 'default-nsu-study-room-schedule';
export const SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME = '18:00';
export const SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME = '23:30';
export const SATURDAY_STUDY_ROOM_MANDATORY_ARRIVAL_TIME = '08:30';
export const SATURDAY_STUDY_ROOM_MANDATORY_DEPARTURE_TIME = '16:40';
export const NSU_STUDY_ROOM_MANDATORY_ARRIVAL_TIME = '17:00';
export const NSU_STUDY_ROOM_MANDATORY_DEPARTURE_TIME = '01:00';

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
    label: '1트랙',
    startTime: '18:10',
    endTime: '19:30',
    description: '집중 학습',
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
    label: '2트랙',
    startTime: '19:40',
    endTime: '21:00',
    description: '집중 학습',
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
    label: '3트랙',
    startTime: '21:20',
    endTime: '22:40',
    description: '집중 학습',
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
    label: '의무 트랙',
    startTime: '22:50',
    endTime: '23:30',
    description: '오답정리 / 테스트',
  },
  {
    id: 'shared-period-4',
    label: '4트랙 또는 심화반',
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

export const SATURDAY_STUDY_ROOM_PERIOD_BLOCKS: StudyRoomPeriodBlock[] = [
  {
    id: 'saturday-arrival',
    label: '입실',
    startTime: '08:30',
    endTime: '08:40',
    description: '휴대폰 제출',
  },
  {
    id: 'saturday-track-1',
    label: '1트랙',
    startTime: '08:40',
    endTime: '10:00',
    description: '집중 학습',
  },
  {
    id: 'saturday-break-1',
    label: '쉬는시간',
    startTime: '10:00',
    endTime: '10:30',
    description: '휴식',
  },
  {
    id: 'saturday-track-2',
    label: '2트랙',
    startTime: '10:30',
    endTime: '12:10',
    description: '집중 학습',
  },
  {
    id: 'saturday-lunch',
    label: '점심시간',
    startTime: '12:10',
    endTime: '13:10',
    description: '식사/휴식',
  },
  {
    id: 'saturday-track-3',
    label: '3트랙',
    startTime: '13:10',
    endTime: '14:20',
    description: '집중 학습',
  },
  {
    id: 'saturday-break-2',
    label: '쉬는시간',
    startTime: '14:20',
    endTime: '14:50',
    description: '휴식',
  },
  {
    id: 'saturday-track-4',
    label: '4트랙',
    startTime: '14:50',
    endTime: '16:40',
    description: '집중 학습',
  },
  {
    id: 'saturday-wrap-up',
    label: '종료',
    startTime: '16:40',
    endTime: '16:40',
    description: '기록 마감',
  },
];

function clonePeriodBlocks(prefix: string, blocks = SHARED_STUDY_ROOM_PERIOD_BLOCKS) {
  return blocks.map((block) => ({
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
  const normalized = toStudyRoomTrackScheduleName(schedule.className);
  if (normalized.includes('트랙제')) return normalized;
  return `${normalized} 반 트랙제`;
}

export function toStudyRoomTrackScheduleName(name?: string | null) {
  return (name?.trim() || SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME)
    .replaceAll('교시제', '트랙제')
    .replaceAll('교시', '트랙');
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
    arrivalTime: SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME,
    departureTime: SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME,
    note: '의무 등원은 18:00, 의무 하원은 23:30입니다. 특이사항이 없으면 이 트랙제를 그대로 따르고, 학원 및 외출 일정이 있는 학생만 별도로 등록합니다.',
    blocks: SHARED_STUDY_ROOM_PERIOD_BLOCKS.map((block) => ({ ...block })),
    active: true,
    createdByUid: null,
    updatedByUid: null,
  };
}

export function buildSaturdayStudyRoomClassSchedule(
  centerId?: string | null
): StudyRoomClassScheduleTemplate | null {
  if (!centerId) return null;

  return {
    id: SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_ID,
    centerId,
    className: SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_NAME,
    weekdays: [...SATURDAY_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS],
    arrivalTime: SATURDAY_STUDY_ROOM_MANDATORY_ARRIVAL_TIME,
    departureTime: SATURDAY_STUDY_ROOM_MANDATORY_DEPARTURE_TIME,
    note: '토요일은 의무 트랙제로 운영합니다. 08:30 입실 후 16:40 기록 마감까지 토요일 전용 트랙을 따릅니다.',
    blocks: SATURDAY_STUDY_ROOM_PERIOD_BLOCKS.map((block) => ({ ...block })),
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
    weekdays: [...NSU_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS],
    arrivalTime: NSU_STUDY_ROOM_MANDATORY_ARRIVAL_TIME,
    departureTime: NSU_STUDY_ROOM_MANDATORY_DEPARTURE_TIME,
    note: 'N수반은 센터 공통 트랙제와 별도 기준으로 운영합니다. 특이사항이 있는 학생만 학원 및 외출 일정을 별도로 등록합니다.',
    blocks: clonePeriodBlocks('nsu'),
    active: true,
    createdByUid: null,
    updatedByUid: null,
  };
}

export function buildSharedStudyRoomClassSchedules(centerId?: string | null) {
  const sharedSchedule = buildSharedStudyRoomClassSchedule(centerId);
  const saturdaySchedule = buildSaturdayStudyRoomClassSchedule(centerId);
  const nsuSchedule = buildNsuStudyRoomClassSchedule(centerId);
  return [sharedSchedule, saturdaySchedule, nsuSchedule].filter(
    (schedule): schedule is StudyRoomClassScheduleTemplate => Boolean(schedule)
  );
}

export function buildStudyRoomClassSchedulesForClassName(
  centerId?: string | null,
  className?: string | null
) {
  if (resolveStudyRoomScheduleTrack(className) === 'nsu') {
    const nsuSchedule = buildNsuStudyRoomClassSchedule(centerId);
    return nsuSchedule ? [nsuSchedule] : [];
  }

  return [buildSharedStudyRoomClassSchedule(centerId), buildSaturdayStudyRoomClassSchedule(centerId)].filter(
    (schedule): schedule is StudyRoomClassScheduleTemplate => Boolean(schedule)
  );
}

export function buildDefaultStudyRoomScheduleTemplates(params: {
  centerId?: string | null;
  className?: string | null;
}): Array<Omit<StudentScheduleTemplate, 'createdAt' | 'updatedAt'>> {
  const track = resolveStudyRoomScheduleTrack(params.className);
  const schedules =
    track === 'nsu'
      ? [
          {
            templateId: NSU_STUDY_ROOM_SCHEDULE_TEMPLATE_ID,
            schedule: buildNsuStudyRoomClassSchedule(params.centerId),
          },
        ]
      : [
          {
            templateId: DEFAULT_STUDY_ROOM_SCHEDULE_TEMPLATE_ID,
            schedule: buildSharedStudyRoomClassSchedule(params.centerId),
          },
          {
            templateId: SATURDAY_STUDY_ROOM_SCHEDULE_TEMPLATE_ID,
            schedule: buildSaturdayStudyRoomClassSchedule(params.centerId),
          },
        ];

  return schedules
    .filter((item): item is { templateId: string; schedule: StudyRoomClassScheduleTemplate } => Boolean(item.schedule))
    .map(({ templateId, schedule }) => ({
      id: templateId,
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
    }));
}
