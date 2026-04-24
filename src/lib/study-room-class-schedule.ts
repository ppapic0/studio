import type { StudyRoomClassScheduleTemplate, StudyRoomPeriodBlock } from '@/lib/types';

export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_ID = 'shared-study-room-schedule';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_NAME = '센터 공통 교시제';
export const SHARED_STUDY_ROOM_CLASS_SCHEDULE_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

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

export function buildSharedStudyRoomClassSchedules(centerId?: string | null) {
  const schedule = buildSharedStudyRoomClassSchedule(centerId);
  return schedule ? [schedule] : [];
}
