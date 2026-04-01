'use client';

import { ArrowRight, BookOpenCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GeneratedStudyPlan } from '@/lib/types';

type WeeklyTodoCardProps = {
  generatedPlan: GeneratedStudyPlan;
  onPrefillSchedule: () => void;
};

export function WeeklyTodoCard({ generatedPlan, onPrefillSchedule }: WeeklyTodoCardProps) {
  return (
    <div className="rounded-[1.7rem] border border-[#DCE6F5] bg-[#17326B] p-4 text-white shadow-[0_22px_48px_-38px_rgba(20,41,95,0.48)]">
      <div className="flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-[#FFB347]" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#B8CAE9]">이번 주 실행안</p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-white">이번 주 투두리스트</h3>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(generatedPlan.weekly_balance).map(([subject, ratio]) => (
          <Badge
            key={subject}
            className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-black text-white shadow-none"
          >
            {subject} {ratio}%
          </Badge>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#B8CAE9]">오늘부터 이렇게 시작해요</p>
      </div>

      <div className="mt-3 space-y-3">
        {generatedPlan.daily_todos.map((todo, index) => (
          <div
            key={`${todo.과목}-${index}`}
            className="rounded-[1.1rem] border border-white/12 bg-white/[0.08] px-4 py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{todo.과목}</p>
                <p className="mt-1 break-keep text-[13px] font-semibold leading-6 text-[#D7E4FF]">{todo.활동}</p>
              </div>
              <Badge className="rounded-full border-none bg-[#FF8A1F] px-3 py-1 text-[11px] font-black text-white shadow-none">
                {todo.시간}분
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[1.1rem] border border-white/12 bg-white/[0.08] px-4 py-4">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#B8CAE9]">코칭 메모</p>
        <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#F7FAFF]">{generatedPlan.coaching_message}</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={onPrefillSchedule}
        className="mt-4 h-12 w-full rounded-[1rem] font-black"
      >
        이 플랜으로 이번 주 일정 등록하기
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
