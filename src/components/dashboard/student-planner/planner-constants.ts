'use client';

export type RoutineTemplateOption = {
  key: string;
  label: string;
  title: string;
  icon: 'arrival' | 'departure' | 'meal' | 'academy' | 'break' | 'custom';
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
