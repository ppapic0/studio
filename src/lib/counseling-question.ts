import type { CounselingQuestionAttachment, CounselingReservation } from '@/lib/types';

export const COUNSELING_QUESTION_ATTACHMENT_LIMIT = 3;
export const COUNSELING_QUESTION_ATTACHMENT_MAX_EDGE = 1600;
export const COUNSELING_QUESTION_ATTACHMENT_TARGET_BYTES = 450 * 1024;
export const COUNSELING_QUESTION_ATTACHMENT_RETENTION_DAYS = 7;

export const COUNSELING_QUESTION_SUBJECT_OPTIONS = [
  '국어',
  '수학',
  '영어',
  '탐구',
  '기타',
] as const;

type StudyQuestionPreviewInput = {
  subject?: string | null;
  workbook?: string | null;
  problemNumbers?: string | null;
  summary?: string | null;
};

function toTrimmed(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildStudyQuestionReservationPreview(input: StudyQuestionPreviewInput) {
  const parts = [
    toTrimmed(input.subject),
    [toTrimmed(input.workbook), toTrimmed(input.problemNumbers)].filter(Boolean).join(' '),
    toTrimmed(input.summary),
  ].filter(Boolean);

  return parts.join(' · ') || '학습 질의 상담';
}

export function isStudyQuestionReservation(reservation?: Pick<CounselingReservation, 'requestMode'> | null) {
  return reservation?.requestMode === 'study_question';
}

export function getVisibleCounselingQuestionAttachments(
  attachments?: CounselingQuestionAttachment[] | null
) {
  return (attachments || []).filter((attachment) => !attachment?.deletedAt);
}

export function getCounselingAttachmentCountLabel(attachments?: CounselingQuestionAttachment[] | null) {
  const count = getVisibleCounselingQuestionAttachments(attachments).length;
  return count > 0 ? `${count}장` : '첨부 없음';
}
