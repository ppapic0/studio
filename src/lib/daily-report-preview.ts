import type { DailyReport } from '@/lib/types';

type DailyReportPreviewSource = Pick<DailyReport, 'content' | 'aiMeta'>;

const REPORT_SECTION_TITLES = new Set([
  '오늘 관찰',
  '교육학적 해석',
  '내일 코칭',
  '가정 연계 팁',
]);

function normalizePreviewWhitespace(value?: string | null) {
  return (value || '')
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitPreviewSentences(value?: string | null) {
  const normalized = normalizePreviewWhitespace(value);
  if (!normalized) return [];

  return normalized
    .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function trimPreviewLine(value?: string | null, maxLength = 72) {
  const normalized = normalizePreviewWhitespace(value);
  if (!normalized) return '';

  const sentence = splitPreviewSentences(normalized).slice(0, 2).join(' ').trim() || normalized;
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength - 1).trimEnd()}…` : sentence;
}

function extractPreviewContentLines(content: string) {
  return content
    .split('\n')
    .map((line) => line.replace(/^[🕒✅📊💬🧠]\s*/u, '').trim())
    .filter(Boolean)
    .filter((line) => !REPORT_SECTION_TITLES.has(line))
    .flatMap((line) => splitPreviewSentences(line));
}

export function buildDailyReportPreview(source?: DailyReportPreviewSource | null, maxLength = 72) {
  if (!source) return '';

  const candidates = [
    source.aiMeta?.teacherOneLiner,
    source.aiMeta?.coachingFocus,
    source.aiMeta?.homeTip,
    ...extractPreviewContentLines(source.content || ''),
  ]
    .map((item) => trimPreviewLine(item, maxLength))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    const key = item.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped[0] || '오늘 학습 리포트가 도착했습니다.';
}
