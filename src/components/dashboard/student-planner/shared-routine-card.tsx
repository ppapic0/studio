'use client';

import Link from 'next/link';
import { ArrowRight, BookmarkPlus, Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getReactionCount, getSimilarityTagLabel, getVisibilityLabel } from '@/lib/routine-social';
import { type SharedRoutine } from '@/lib/types';

type SharedRoutineCardProps = {
  routine: SharedRoutine;
  detailHref: string;
  onApplyRoutine: (routine: SharedRoutine) => void;
  onCheer: (routineId: string) => void;
};

export function SharedRoutineCard({
  routine,
  detailHref,
  onApplyRoutine,
  onCheer,
}: SharedRoutineCardProps) {
  const saveCount = getReactionCount(routine, 'save');
  const cheerCount = getReactionCount(routine, 'cheer');
  const referenceCount = getReactionCount(routine, 'reference');
  const cheerReaction = routine.reactions.find((item) => item.type === 'cheer');

  return (
    <Card variant="light" className="rounded-[1.9rem] border-[rgba(20,41,95,0.08)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{routine.source === 'popular' ? '저장 많은 루틴' : '추천 루틴'}</Badge>
              <Badge variant="outline">{getVisibilityLabel(routine.visibility)}</Badge>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">
              {routine.authorAlias}
              {routine.authorSchoolLabel ? ` · ${routine.authorSchoolLabel}` : ''}
            </p>
            <h3 className="text-[1.1rem] font-black tracking-[-0.03em] text-[#17326B]">{routine.title}</h3>
            <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">{routine.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => onCheer(routine.id)}
            className={`rounded-full border px-3 py-2 text-[11px] font-black transition-all ${
              cheerReaction?.viewerReacted
                ? 'border-[rgba(255,138,31,0.35)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-white'
                : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
            }`}
          >
            응원 {cheerCount}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{routine.gradeLabel}</Badge>
          <Badge variant="outline">{routine.goalLabel}</Badge>
          {routine.styleTags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline">{tag}</Badge>
          ))}
        </div>

        {routine.similarityTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {routine.similarityTags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary">{getSimilarityTagLabel(tag)}</Badge>
            ))}
          </div>
        ) : null}

        <div className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">하루 예시 구조</p>
          <div className="mt-3 space-y-2">
            {routine.routine.studyBlocks.slice(0, 3).map((block) => (
              <div key={block.id} className="flex items-center justify-between gap-3 rounded-[1rem] bg-white px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[#17326B]">
                    {block.subjectLabel || '기본 블록'} · {block.title}
                  </p>
                  <p className="text-[11px] font-semibold text-[#5F7597]">{block.instruction}</p>
                </div>
                <p className="shrink-0 text-[12px] font-black text-[#D86A11]">{block.durationMinutes}분</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] px-4 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">왜 추천되나요</p>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#17326B]">{routine.fitSummary}</p>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">작성자 한마디</p>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#17326B]">{routine.authorNote}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-white px-4 py-3">
          <div className="flex items-center gap-4 text-[12px] font-bold text-[#5F7597]">
            <span>저장 {saveCount}</span>
            <span>응원 {cheerCount}</span>
            <span>참고 {referenceCount}</span>
          </div>
          <Sparkles className="h-4 w-4 text-[#FF8A1F]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={() => onApplyRoutine(routine)}>
            <BookmarkPlus className="mr-2 h-4 w-4" />
            내 루틴으로 저장
          </Button>
          <Button variant="default" size="lg" className="h-12 rounded-[1rem]" asChild>
            <Link href={detailHref}>
              참고하기
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
