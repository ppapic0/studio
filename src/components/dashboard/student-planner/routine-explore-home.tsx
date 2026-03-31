'use client';

import Link from 'next/link';
import { Compass, Lock, ShieldCheck } from 'lucide-react';

import { SharedRoutineCard } from '@/components/dashboard/student-planner/shared-routine-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  type RoutineExploreSection,
  ROUTINE_VISIBILITY_LABELS,
} from '@/lib/routine-social';
import { type RoutineVisibility, type SharedRoutine } from '@/lib/types';

type RoutineExploreHomeProps = {
  studentName?: string;
  currentVisibility: RoutineVisibility;
  sectionList: RoutineExploreSection[];
  savedTemplateCount: number;
  onApplyRoutine: (routine: SharedRoutine) => void;
  onCheerRoutine: (routineId: string) => void;
};

export function RoutineExploreHome({
  studentName,
  currentVisibility,
  sectionList,
  savedTemplateCount,
  onApplyRoutine,
  onCheerRoutine,
}: RoutineExploreHomeProps) {
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-5 px-4 pb-24 pt-3">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dark">탐색 홈</Badge>
                <Badge variant="secondary">기본값 private</Badge>
              </div>
              <h1 className="text-[1.65rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
                {studentName ? `${studentName}님에게 맞는` : '나에게 맞는'}
                <br />
                참고용 루틴 모아보기
              </h1>
              <p className="text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                비교보다 참고가 먼저입니다. 비슷한 학생이 실제로 굴리는 루틴을 둘러보고,
                마음에 드는 흐름만 내 루틴으로 저장할 수 있어요.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/10 px-4 py-4 text-right">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">공유 상태</p>
              <p className="mt-2 text-[1rem] font-black text-[var(--text-on-dark)]">{ROUTINE_VISIBILITY_LABELS[currentVisibility]}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.2rem] border border-white/12 bg-white/10 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">탐색 원칙</p>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-[var(--text-on-dark)]">
                전교 순위나 성적 비교는 없고, 루틴 구조와 회고 팁만 참고합니다.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-white/12 bg-white/10 px-4 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">저장한 템플릿</p>
              <p className="mt-2 text-[1.4rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{savedTemplateCount}개</p>
              <p className="text-[12px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">나중에 루틴 편집에서 다시 꺼내볼 수 있어요.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" asChild>
              <Link href="/dashboard/plan">
                <ShieldCheck className="mr-2 h-4 w-4" />
                내 루틴 홈으로
              </Link>
            </Button>
            <Button variant="dark" size="lg" className="h-12 rounded-[1rem]" asChild>
              <Link href="/dashboard/plan?privacy=1">
                <Lock className="mr-2 h-4 w-4" />
                공유 설정 열기
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {sectionList.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{section.id.toUpperCase()}</p>
              <h2 className="mt-1 text-[1.2rem] font-black tracking-[-0.03em] text-[#17326B]">{section.title}</h2>
            </div>
            <Compass className="h-4 w-4 text-[#FF8A1F]" />
          </div>
          <p className="px-1 text-[13px] font-semibold leading-6 text-[#5F7597]">{section.description}</p>
          <div className="space-y-3">
            {section.items.map((routine) => (
              <SharedRoutineCard
                key={routine.id}
                routine={routine}
                detailHref={`/dashboard/plan/explore/${routine.id}`}
                onApplyRoutine={onApplyRoutine}
                onCheer={onCheerRoutine}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
