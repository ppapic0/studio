'use client';

import { CheckCircle2, Clock3, Edit3, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type DailyRoutineBlock } from '@/lib/types';

type TodayBlockCardProps = {
  block: DailyRoutineBlock;
  isNext?: boolean;
  onToggleDone: (blockId: string) => void;
  onEdit: (block: DailyRoutineBlock) => void;
};

export function TodayBlockCard({ block, isNext = false, onToggleDone, onEdit }: TodayBlockCardProps) {
  return (
    <div
      className={cn(
        'rounded-[1.45rem] border px-4 py-4 transition-all',
        block.done
          ? 'border-[rgba(34,181,115,0.18)] bg-[linear-gradient(180deg,rgba(245,255,250,1)_0%,rgba(238,252,245,1)_100%)]'
          : isNext
            ? 'border-[rgba(255,138,31,0.22)] bg-[linear-gradient(180deg,rgba(255,251,246,1)_0%,rgba(255,245,232,1)_100%)] shadow-[0_20px_34px_-26px_rgba(255,138,31,0.48)]'
            : 'border-[rgba(20,41,95,0.1)] bg-white'
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleDone(block.id)}
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors',
            block.done
              ? 'border-[rgba(34,181,115,0.35)] bg-[#22B573] text-white'
              : isNext
                ? 'border-[rgba(255,138,31,0.35)] bg-white text-[#FF8A1F]'
                : 'border-[rgba(20,41,95,0.14)] bg-white text-transparent'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[rgba(20,41,95,0.1)] bg-[#F6F8FC] px-2.5 py-1 text-[11px] font-black text-[#17326B]">
                  {block.subjectLabel || '기타'}
                </span>
                <span className="rounded-full border border-[rgba(255,138,31,0.18)] bg-[rgba(255,138,31,0.1)] px-2.5 py-1 text-[11px] font-black text-[#D86A11]">
                  {block.studyTypeLabel}
                </span>
                {isNext && (
                  <span className="rounded-full border border-[rgba(255,138,31,0.26)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] px-2.5 py-1 text-[11px] font-black text-white">
                    지금 할 것
                  </span>
                )}
              </div>
              <p className={cn('mt-3 text-[17px] font-black tracking-[-0.03em]', block.done ? 'text-[#4F6486]' : 'text-[#17326B]')}>
                {block.title}
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full border border-[rgba(20,41,95,0.08)] bg-white text-[#17326B] hover:bg-[#F7FAFF]"
              onClick={() => onEdit(block)}
            >
              <Edit3 className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold text-[#5F7597]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-[#FF8A1F]" />
              {block.startTime ? `${block.startTime} 시작` : `${block.sequence}번째 순서`}
            </span>
            <span>{block.durationMinutes}분</span>
            <span className="inline-flex items-center gap-1.5 text-[#D86A11]">
              <Sparkles className="h-3.5 w-3.5" />
              {block.rewardLabel}
            </span>
          </div>

          <div className="rounded-[1rem] bg-[#F8FBFF] px-3 py-3">
            <p className="text-[12px] font-semibold leading-5 text-[#17326B]">{block.instruction}</p>
            {block.fallbackInstruction ? (
              <p className="mt-1 text-[11px] font-bold leading-5 text-[#6B7FA3]">{block.fallbackInstruction}</p>
            ) : null}
          </div>

          <p className="text-[12px] font-bold text-[#5F7597]">{block.feedbackMessage}</p>
        </div>
      </div>
    </div>
  );
}
