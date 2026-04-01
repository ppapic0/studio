export type SubjectOption = {
  id: string;
  label: string;
  shortLabel: string;
};

export const SUBJECT_OPTIONS: SubjectOption[] = [
  { id: 'kor', label: '국어', shortLabel: '국어' },
  { id: 'math', label: '수학', shortLabel: '수학' },
  { id: 'eng', label: '영어', shortLabel: '영어' },
  { id: 'history', label: '한국사', shortLabel: '한국사' },
  { id: 'social', label: '사회탐구', shortLabel: '사탐' },
  { id: 'science', label: '과학탐구', shortLabel: '과탐' },
  { id: 'major', label: '전공/직렬 과목', shortLabel: '전공' },
  { id: 'admin-law', label: '행정법/행정학 계열', shortLabel: '법·행정' },
  { id: 'etc', label: '기타 시험 과목', shortLabel: '기타' },
  { id: 'review', label: '복습', shortLabel: '복습' },
];

export function getSubjectOption(subjectId?: string | null) {
  if (!subjectId) return SUBJECT_OPTIONS[0];
  return SUBJECT_OPTIONS.find((subject) => subject.id === subjectId) || SUBJECT_OPTIONS[SUBJECT_OPTIONS.length - 2];
}
