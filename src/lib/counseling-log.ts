import type { CounselingLogStatus } from '@/lib/types';

export const COUNSELING_LOG_STATUS_OPTIONS: Array<{ value: CounselingLogStatus; label: string }> = [
  { value: 'good', label: '좋음' },
  { value: 'normal', label: '보통' },
  { value: 'watch', label: '주의' },
];

export const COUNSELING_LOG_STATUS_LABELS: Record<CounselingLogStatus, string> = {
  good: '좋음',
  normal: '보통',
  watch: '주의',
};

export const COUNSELING_LOG_STATUS_BADGE_CLASS: Record<CounselingLogStatus, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  normal: 'border-[#DCE7FF] bg-[#F7FAFF] text-[#2554D7]',
  watch: 'border-[#FFD7BA] bg-[#FFF8F2] text-[#C95A08]',
};

export function getCounselingLogStatusItems({
  studyStatus,
  lifeStatus,
  emotionStatus,
}: {
  studyStatus?: CounselingLogStatus | null;
  lifeStatus?: CounselingLogStatus | null;
  emotionStatus?: CounselingLogStatus | null;
}) {
  return [
    studyStatus ? { label: '학습', value: studyStatus } : null,
    lifeStatus ? { label: '생활', value: lifeStatus } : null,
    emotionStatus ? { label: '정서', value: emotionStatus } : null,
  ].filter((item): item is { label: string; value: CounselingLogStatus } => item !== null);
}

export function getCounselingLogStatusLabel(status?: CounselingLogStatus | null) {
  return status ? COUNSELING_LOG_STATUS_LABELS[status] || '-' : '-';
}

export function buildCounselingLogNotificationMessage({
  summary,
  agreedAction,
  freeMemo,
  nextCounselingDate,
  followUp,
}: {
  summary: string;
  agreedAction?: string;
  freeMemo?: string;
  nextCounselingDate?: string;
  followUp?: string;
}) {
  const lines = [`상담요약: ${summary.trim()}`];
  const normalizedAction = agreedAction?.trim();
  const normalizedMemo = freeMemo?.trim();
  const normalizedNextDate = nextCounselingDate?.trim();
  const normalizedFollowUp = followUp?.trim();

  if (normalizedAction) {
    lines.push(`합의액션: ${normalizedAction}`);
  }

  if (normalizedMemo) {
    lines.push(`자유메모: ${normalizedMemo}`);
  }

  if (normalizedNextDate) {
    lines.push(`다음상담예정일: ${normalizedNextDate}`);
  }

  if (normalizedFollowUp) {
    lines.push(`팔로업: ${normalizedFollowUp}`);
  }

  return lines.join('\n');
}
