'use client';

import { Progress } from '@/components/ui/progress';

type PlannerProgressHeaderProps = {
  blockLabel: string;
  stepLabel: string;
  progress: number;
  remainingLabel: string;
  sectionLabel: string;
};

export function PlannerProgressHeader({
  blockLabel,
  stepLabel,
  progress,
  remainingLabel,
  sectionLabel,
}: PlannerProgressHeaderProps) {
  return (
    <div className="rounded-[1.6rem] border border-[#DCE6F5] bg-white px-4 py-4 shadow-[0_18px_42px_-34px_rgba(20,41,95,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">계획 찾는 중</p>
          <p className="mt-2 text-lg font-black tracking-tight text-[#17326B]">{blockLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black text-[#17326B]">{stepLabel}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#58709A]">{remainingLabel}</p>
        </div>
      </div>
      <Progress value={progress} className="mt-4 h-2 rounded-full bg-[#EEF3FB]" indicatorClassName="bg-[linear-gradient(90deg,#FF8A1F_0%,#FFB347_100%)]" />
      <div className="mt-3 inline-flex rounded-full border border-[#E3EAF6] bg-[#F7FAFF] px-3 py-1.5 text-[11px] font-semibold text-[#58709A]">
        {sectionLabel}
      </div>
    </div>
  );
}
