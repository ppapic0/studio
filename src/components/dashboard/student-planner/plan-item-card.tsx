'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type PlanItemCardProps = {
  id: string;
  title: string;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  disabled?: boolean;
  isMobile: boolean;
  tone: 'emerald' | 'amber' | 'slate';
  badgeLabel?: string | null;
  metaLabel?: string | null;
  compact?: boolean;
  volumeMeta?: {
    targetAmount: number;
    actualAmount: number;
    unitLabel: string;
    onCommitActual: (value: number) => void;
  } | null;
};

const toneMap = {
  emerald: {
    done: 'border border-emerald-400/24 bg-[linear-gradient(180deg,rgba(47,170,125,0.2)_0%,rgba(14,27,61,0.9)_100%)]',
    idle: 'border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(13,28,69,0.92)_100%)] shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
  },
  amber: {
    done: 'border border-[#FFB347]/24 bg-[linear-gradient(180deg,rgba(255,150,38,0.18)_0%,rgba(14,27,61,0.9)_100%)]',
    idle: 'border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(13,28,69,0.92)_100%)] shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
  },
  slate: {
    done: 'border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(14,27,61,0.92)_100%)]',
    idle: 'border border-white/10 bg-[linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(13,28,69,0.92)_100%)] shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
  },
} as const;

export function PlanItemCard({
  id,
  title,
  checked,
  onToggle,
  onDelete,
  disabled = false,
  isMobile,
  tone,
  badgeLabel,
  metaLabel,
  compact = false,
  volumeMeta = null,
}: PlanItemCardProps) {
  const toneValue = toneMap[tone];
  const [draftAmount, setDraftAmount] = useState(volumeMeta ? String(volumeMeta.actualAmount || 0) : '');

  useEffect(() => {
    if (volumeMeta) {
      setDraftAmount(String(volumeMeta.actualAmount || 0));
    }
  }, [volumeMeta?.actualAmount, volumeMeta?.targetAmount, volumeMeta?.unitLabel]);

  const commitAmount = (nextValue: number) => {
    if (!volumeMeta || disabled) return;
    const safeValue = Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0;
    setDraftAmount(String(safeValue));
    volumeMeta.onCommitActual(safeValue);
  };

  const progressRate = volumeMeta && volumeMeta.targetAmount > 0
    ? Math.min(999, Math.round((volumeMeta.actualAmount / volumeMeta.targetAmount) * 100))
    : 0;

  return (
    <div className={cn(
      "group flex items-start gap-3 rounded-[1.45rem] border transition-all",
      checked ? toneValue.done : toneValue.idle,
      compact ? "p-4" : isMobile ? "p-4" : "p-5"
    )}>
      {volumeMeta ? (
        <div className={cn(
          "mt-1 flex h-6 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-[10px] font-black",
          checked ? "bg-emerald-500 text-white" : "bg-white/10 text-white/62"
        )}>
          {progressRate}%
        </div>
      ) : (
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onToggle}
          disabled={disabled}
          className={cn("mt-1 rounded-xl border-2", compact ? "h-5 w-5" : "h-6 w-6")}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {badgeLabel ? (
            <Badge className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[9px] font-black text-[#FFD79F] shadow-none">
              {badgeLabel}
            </Badge>
          ) : null}
          {metaLabel ? (
            <span className="text-[10px] font-black text-white/42">{metaLabel}</span>
          ) : null}
        </div>
        <Label
          htmlFor={id}
          className={cn(
            "mt-1 block break-keep font-black leading-snug tracking-tight text-white transition-all",
            compact ? "text-sm" : isMobile ? "text-sm" : "text-base",
            checked && "text-white/42 line-through italic"
          )}
        >
          {title}
        </Label>

        {volumeMeta ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
              <span className="rounded-full bg-white/8 px-2.5 py-1 text-white/62">
                목표 {volumeMeta.targetAmount}{volumeMeta.unitLabel}
              </span>
              <span className={cn(
                "rounded-full px-2.5 py-1",
                checked ? "bg-emerald-500 text-white" : "bg-emerald-500/18 text-emerald-200"
              )}>
                실제 {volumeMeta.actualAmount}{volumeMeta.unitLabel}
              </span>
              <span className="rounded-full bg-white/8 px-2.5 py-1 text-white/62 ring-1 ring-white/10">
                달성률 {progressRate}%
              </span>
            </div>
            {!disabled ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => commitAmount(0)}
                    className="h-7 rounded-full border-white/10 bg-white/8 px-3 text-[10px] font-black text-white hover:bg-white/12"
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => commitAmount(Math.max(1, Math.round(volumeMeta.targetAmount / 2)))}
                    className="h-7 rounded-full border-white/10 bg-white/8 px-3 text-[10px] font-black text-white hover:bg-white/12"
                  >
                    절반
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => commitAmount(volumeMeta.targetAmount)}
                    className="h-7 rounded-full border-white/10 bg-white/8 px-3 text-[10px] font-black text-white hover:bg-white/12"
                  >
                    완료
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={draftAmount}
                    onChange={(event) => setDraftAmount(event.target.value)}
                    onBlur={() => commitAmount(Number(draftAmount))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitAmount(Number(draftAmount));
                      }
                    }}
                    className="h-9 max-w-[7rem] rounded-xl border-white/10 bg-white/8 text-center text-xs font-black text-white"
                  />
                  <span className="text-[10px] font-semibold text-white/42">직접입력</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!disabled ? (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0 rounded-full text-white/35 transition-all hover:text-rose-300",
            isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
