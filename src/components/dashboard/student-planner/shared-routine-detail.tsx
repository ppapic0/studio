'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookMarked, BookmarkPlus, ShieldCheck, Sparkles, TimerReset } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getReactionCount,
  getSimilarityTagLabel,
  getVisibilityLabel,
  PEER_SIMILARITY_LABELS,
} from '@/lib/routine-social';
import { type SharedRoutine } from '@/lib/types';

type SharedRoutineDetailProps = {
  routine: SharedRoutine;
  onApplyRoutine: (routine: SharedRoutine) => void;
  onSaveTemplate: (routine: SharedRoutine) => void;
  onCheer: (routineId: string) => void;
  onReference: (routineId: string) => void;
};

export function SharedRoutineDetail({
  routine,
  onApplyRoutine,
  onSaveTemplate,
  onCheer,
  onReference,
}: SharedRoutineDetailProps) {
  const cheerReaction = routine.reactions.find((item) => item.type === 'cheer');
  const referenceReaction = routine.reactions.find((item) => item.type === 'reference');

  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pb-24 pt-3">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Button variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[var(--text-on-dark)]" asChild>
                <Link href="/dashboard/plan/explore">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  탐색으로
                </Link>
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark">{routine.authorAlias}</Badge>
                <Badge variant="secondary">{getVisibilityLabel(routine.visibility)}</Badge>
              </div>
              <h1 className="text-[1.7rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">{routine.title}</h1>
              <p className="text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">{routine.summary}</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/10 px-4 py-4 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">저장 수</p>
              <p className="mt-2 text-[1.35rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{getReactionCount(routine, 'save')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="dark">{routine.gradeLabel}</Badge>
            <Badge variant="dark">{routine.goalLabel}</Badge>
            {routine.styleTags.map((tag) => (
              <Badge key={tag} variant="dark">{tag}</Badge>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={() => onApplyRoutine(routine)}>
              <BookmarkPlus className="mr-2 h-4 w-4" />
              내 루틴으로 저장
            </Button>
            <Button variant="dark" size="lg" className="h-12 rounded-[1rem]" onClick={() => onSaveTemplate(routine)}>
              <BookMarked className="mr-2 h-4 w-4" />
              참고 목록에 담기
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">이 루틴이 맞는 학생</p>
          </div>
          <p className="text-[14px] font-semibold leading-7 text-[#17326B]">{routine.fitSummary}</p>
          {routine.similarityTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {routine.similarityTags.map((tag) => (
                <Badge key={tag} variant="secondary">{getSimilarityTagLabel(tag)}</Badge>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.keys(PEER_SIMILARITY_LABELS).slice(0, 2).map((key) => (
                <Badge key={key} variant="outline">{PEER_SIMILARITY_LABELS[key as keyof typeof PEER_SIMILARITY_LABELS]}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card variant="ivory" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <TimerReset className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">하루 예시 구조</p>
          </div>
          <div className="space-y-3">
            {routine.routine.studyBlocks.map((block, index) => (
              <div key={block.id} className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/78 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">BLOCK {index + 1}</p>
                    <p className="mt-1 text-[15px] font-black text-[#17326B]">
                      {block.subjectLabel || '기본'} · {block.title}
                    </p>
                  </div>
                  <Badge variant="outline">{block.durationMinutes}분</Badge>
                </div>
                <p className="mt-3 text-[13px] font-semibold leading-6 text-[#5F7597]">{block.instruction}</p>
                {block.fallbackInstruction ? (
                  <p className="mt-2 text-[12px] font-bold leading-5 text-[#D86A11]">IF-THEN: {block.fallbackInstruction}</p>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card variant="light" className="rounded-[1.7rem]">
          <CardContent className="space-y-3 p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">과목 밸런스</p>
            <p className="text-[14px] font-semibold leading-7 text-[#17326B]">{routine.subjectBalanceLabel}</p>
          </CardContent>
        </Card>
        <Card variant="light" className="rounded-[1.7rem]">
          <CardContent className="space-y-3 p-6">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">쉬는 방식</p>
            <p className="text-[14px] font-semibold leading-7 text-[#17326B]">{routine.breakRuleLabel}</p>
          </CardContent>
        </Card>
      </div>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">복습 규칙</p>
          <p className="text-[14px] font-semibold leading-7 text-[#17326B]">{routine.reviewRuleLabel}</p>
          <div className="rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] px-4 py-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">작성자 회고 팁</p>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[#17326B]">{routine.reflectionTip}</p>
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">학습 친화적 반응</p>
          </div>
          <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">
            비교 대신 참고를 중심에 둡니다. 성적이나 순위를 올리는 반응은 제공하지 않고,
            응원하거나 참고할 루틴으로만 표시합니다.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onCheer(routine.id)}
              className={`rounded-[1rem] border px-4 py-3 text-left transition-all ${
                cheerReaction?.viewerReacted
                  ? 'border-[rgba(255,138,31,0.35)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-white'
                  : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
              }`}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em]">응원</p>
              <p className="mt-1 text-[16px] font-black">{getReactionCount(routine, 'cheer')}</p>
            </button>
            <button
              type="button"
              onClick={() => onReference(routine.id)}
              className={`rounded-[1rem] border px-4 py-3 text-left transition-all ${
                referenceReaction?.viewerReacted
                  ? 'border-[rgba(20,41,95,0.3)] bg-[#17326B] text-white'
                  : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
              }`}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em]">이 루틴 참고할래요</p>
              <p className="mt-1 text-[16px] font-black">{getReactionCount(routine, 'reference')}</p>
            </button>
          </div>
          <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={() => onApplyRoutine(routine)}>
            오늘부터 이 루틴 써보기
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
