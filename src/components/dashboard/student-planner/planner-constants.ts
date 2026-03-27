'use client';

export type RoutineTemplateOption = {
  key: string;
  label: string;
  title: string;
  icon: 'arrival' | 'departure' | 'meal' | 'academy' | 'break' | 'custom';
};

export type StudyPlanMode = 'time' | 'volume';
export type StudyAmountUnit = '문제' | '페이지' | '챕터' | '지문' | '세트' | '회독' | '직접입력';
export type RecentStudyOption = {
  key: string;
  sourceId: string;
  sourceDateKey: string;
  sourceWeekKey: string;
  title: string;
  subjectValue: string;
  subjectLabel: string;
  studyModeValue: StudyPlanMode;
  studyModeLabel: string;
  minuteValue: string;
  amountValue: string;
  amountUnitValue: StudyAmountUnit;
  customAmountUnitValue: string;
  enableVolumeMinutes: boolean;
  metaLabel: string;
  updatedLabel: string;
};

export const ROUTINE_TEMPLATE_OPTIONS: RoutineTemplateOption[] = [
  { key: 'arrival', label: '등원', title: '등원 예정', icon: 'arrival' },
  { key: 'departure', label: '하원', title: '하원 예정', icon: 'departure' },
  { key: 'lunch', label: '점심', title: '점심 시간', icon: 'meal' },
  { key: 'dinner', label: '저녁', title: '저녁 시간', icon: 'meal' },
  { key: 'academy', label: '학원', title: '학원', icon: 'academy' },
  { key: 'break', label: '휴식', title: '휴식', icon: 'break' },
  { key: 'custom', label: '직접 입력', title: '', icon: 'custom' },
];

export const STUDY_MINUTE_PRESETS = [30, 45, 60, 90] as const;

export const STUDY_PLAN_MODE_OPTIONS: Array<{ value: StudyPlanMode; label: string; description: string }> = [
  { value: 'volume', label: '분량형', description: '문제 수, 페이지 수처럼 끝낼 양을 먼저 적어요.' },
  { value: 'time', label: '시간형', description: '예상 시간을 정해 리듬 중심으로 계획해요.' },
];

export const STUDY_AMOUNT_UNIT_OPTIONS: Array<{ value: StudyAmountUnit; label: string }> = [
  { value: '문제', label: '문제' },
  { value: '페이지', label: '페이지' },
  { value: '챕터', label: '챕터' },
  { value: '지문', label: '지문' },
  { value: '세트', label: '세트' },
  { value: '회독', label: '회독' },
  { value: '직접입력', label: '직접 입력' },
];
