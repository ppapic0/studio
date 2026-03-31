'use client';

import Link from 'next/link';
import { ArrowRight, BookOpenCheck, Compass, Edit3, Flame, Lock, Sparkles, Target } from 'lucide-react';

import { TodayBlockCard } from '@/components/dashboard/student-planner/today-block-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  buildNextDayRoutinePreview,
  buildSubjectBalanceSummary,
  getNextPendingBlock,
  getRoutineProgress,
} from '@/lib/routine-workspace';
import { type DailyRoutineBlock, type RoutineWorkspaceState } from '@/lib/types';

type RoutineHomeProps = {
  studentName?: string;
  workspace: RoutineWorkspaceState;
  sharingLabel: string;
  onToggleBlock: (blockId: string) => void;
  onOpenEditor: () => void;
  onOpenPrivacy: () => void;
  onOpenReflection: () => void;
  onEditBlock: (block: DailyRoutineBlock) => void;
};

export function RoutineHome({
  studentName,
  workspace,
  sharingLabel,
  onToggleBlock,
  onOpenEditor,
  onOpenPrivacy,
  onOpenReflection,
  onEditBlock,
}: RoutineHomeProps) {
  const routine = workspace.activeRoutine;
  const nextBlock = getNextPendingBlock(routine);
  const progress = getRoutineProgress(routine);
  const balance = buildSubjectBalanceSummary(workspace);
  const nextDayPreview = buildNextDayRoutinePreview(routine);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-2">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-on-dark-muted)]">MY ROUTINE</p>
              <h2 className="text-[1.7rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
                {studentName ? `${studentName}님의` : '오늘의'}
                <br />
                {routine.routineName}
              </h2>
              <p className="text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">{routine.routineSummary}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-white/12 bg-white/8 text-white hover:bg-white/12" onClick={onOpenEditor}>
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {routine.tags.map((tag) => (
              <Badge key={tag} variant="dark">{tag}</Badge>
            ))}
            <Badge variant="secondary">추천 기반</Badge>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-3 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">총량</p>
              <p className="mt-2 text-[1.25rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{routine.totalMinutes}분</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-3 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">진행률</p>
              <p className="mt-2 text-[1.25rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{progress.percent}%</p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-3 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">다음</p>
              <p className="mt-2 text-[1.05rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{nextBlock?.subjectLabel || '마감'}</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] font-bold text-[var(--text-on-dark-soft)]">
              <span>{progress.completedBlocks}/{progress.totalBlocks} 블록 완료</span>
              <span>{progress.completedMinutes}분 진행</span>
            </div>
            <Progress value={progress.percent} className="h-2.5 bg-white/12" />
          </div>

          <div className="rounded-[1.35rem] border border-white/12 bg-white/8 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">오늘 핵심 목표</p>
            <p className="mt-2 text-[15px] font-black text-[var(--text-on-dark)]">{routine.targetFocus}</p>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">{routine.reminderMessage}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" size="lg" className="h-13 rounded-[1.15rem]">
              오늘 루틴 시작
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="dark" size="lg" className="h-13 rounded-[1.15rem]" onClick={onOpenEditor}>
              오늘만 수정
            </Button>
          </div>
        </CardContent>
      </Card>

      {nextBlock ? (
        <Card variant="ivory" className="rounded-[1.8rem]">
          <CardContent className="space-y-3 p-6">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-[#FF8A1F]" />
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">지금 할 것</p>
            </div>
            <TodayBlockCard block={nextBlock} isNext onToggleDone={onToggleBlock} onEdit={onEditBlock} />
          </CardContent>
        </Card>
      ) : null}

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">TODAY FLOW</p>
            <p className="mt-1 text-[1.2rem] font-black tracking-[-0.03em] text-[#17326B]">오늘 전체 흐름</p>
          </div>
          <div className="space-y-3">
            {routine.blocks.map((block) => (
              <TodayBlockCard key={block.id} block={block} onToggleDone={onToggleBlock} onEdit={onEditBlock} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">실행 보조</p>
          </div>
          <div className="space-y-3">
            {routine.executionRules.slice(0, 2).map((rule) => (
              <div key={rule.id} className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
                <p className="text-[13px] font-black text-[#17326B]">{rule.trigger}</p>
                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7597]">{rule.response}</p>
                <p className="mt-1 text-[11px] font-bold leading-5 text-[#D86A11]">{rule.fallback}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">과목 밸런스</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {balance.subjects.slice(0, 3).map((item) => (
              <div key={item.subject} className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-white px-4 py-4">
                <p className="text-[12px] font-black text-[#17326B]">{item.subject}</p>
                <p className="mt-2 text-[1.1rem] font-black tracking-[-0.03em] text-[#17326B]">{item.todayMinutes}분</p>
                <p className="mt-1 text-[11px] font-semibold text-[#5F7597]">최근 7일 {item.recentMinutes}분</p>
              </div>
            ))}
          </div>
          <div className="rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] px-4 py-4">
            <p className="text-[12px] font-semibold leading-6 text-[#17326B]">{balance.insight}</p>
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-4 w-4 text-[#FF8A1F]" />
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">복습과 회고</p>
          </div>
          <div className="space-y-3">
            {routine.reviewRules.map((rule) => (
              <div key={rule.id} className="rounded-[1.15rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
                <p className="text-[13px] font-black text-[#17326B]">{rule.title}</p>
                <p className="mt-1 text-[12px] font-bold text-[#D86A11]">{rule.timing}</p>
                <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7597]">{rule.description}</p>
              </div>
            ))}
          </div>
          <Button variant="default" size="lg" className="h-12 rounded-[1rem]" onClick={onOpenReflection}>
            하루 마감 회고 열기
          </Button>
        </CardContent>
      </Card>

      <Card variant="ivory" className="rounded-[1.8rem]">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">WEEKLY SUMMARY</p>
              <p className="mt-1 text-[1.1rem] font-black tracking-[-0.03em] text-[#17326B]">주간 회고 요약</p>
            </div>
            <Badge variant="outline">{workspace.weeklySummary.consistencyLabel}</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">완료율</p>
              <p className="mt-2 text-[1.25rem] font-black tracking-[-0.03em] text-[#17326B]">{workspace.weeklySummary.completionRate}%</p>
            </div>
            <div className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">가장 많이 본 과목</p>
              <p className="mt-2 text-[1.05rem] font-black tracking-[-0.03em] text-[#17326B]">{workspace.weeklySummary.topSubject}</p>
            </div>
            <div className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-white/72 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">다음날 미리보기</p>
              <p className="mt-2 text-[12px] font-black leading-5 text-[#17326B]">{nextDayPreview.firstBlockTitle}</p>
            </div>
          </div>
          <div className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/72 px-4 py-4">
            <p className="text-[13px] font-black text-[#17326B]">{workspace.weeklySummary.reflectionHeadline}</p>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-[#5F7597]">{workspace.weeklySummary.coachingTip}</p>
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">REFERENCE</p>
              <p className="mt-1 text-[1.12rem] font-black tracking-[-0.03em] text-[#17326B]">비슷한 학생 루틴 참고하기</p>
            </div>
            <Badge variant="outline">{sharingLabel}</Badge>
          </div>
          <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">
            전교 비교 없이, 같은 목표와 약점 과목을 가진 학생들의 루틴만 조용히 둘러보고
            내 루틴으로 저장할 수 있어요.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" asChild>
              <Link href="/dashboard/plan/explore">
                <Compass className="mr-2 h-4 w-4" />
                루틴 탐색 열기
              </Link>
            </Button>
            <Button variant="default" size="lg" className="h-12 rounded-[1rem]" onClick={onOpenPrivacy}>
              <Lock className="mr-2 h-4 w-4" />
              공유 설정
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
