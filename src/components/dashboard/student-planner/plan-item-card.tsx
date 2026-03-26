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
    done: 'bg-emerald-50/60 border-emerald-100/70',
    idle: 'bg-white border-emerald-100/40 shadow-sm hover:shadow-md',
  },
  amber: {
    done: 'bg-amber-50/55 border-amber-100/70',
    idle: 'bg-white border-amber-100/40 shadow-sm hover:shadow-md',
  },
  slate: {
    done: 'bg-slate-50 border-slate-200/80',
    idle: 'bg-white border-slate-200/80 shadow-sm hover:shadow-md',
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
          checked ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
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
            <Badge className="rounded-full border-none bg-slate-900 px-2.5 py-0.5 text-[9px] font-black text-white shadow-sm">
              {badgeLabel}
            </Badge>
          ) : null}
          {metaLabel ? (
            <span className="text-[10px] font-black text-slate-400">{metaLabel}</span>
          ) : null}
        </div>
        <Label
          htmlFor={id}
          className={cn(
            "mt-1 block break-keep font-black leading-snug tracking-tight text-slate-900 transition-all",
            compact ? "text-sm" : isMobile ? "text-sm" : "text-base",
            checked && "text-slate-400 line-through italic"
          )}
        >
          {title}
        </Label>

        {volumeMeta ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-500">
                목표 {volumeMeta.targetAmount}{volumeMeta.unitLabel}
              </span>
              <span className={cn(
                "rounded-full px-2.5 py-1",
                checked ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700"
              )}>
                실제 {volumeMeta.actualAmount}{volumeMeta.unitLabel}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-slate-500 ring-1 ring-slate-200">
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
                    className="h-7 rounded-full px-3 text-[10px] font-black"
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => commitAmount(Math.max(1, Math.round(volumeMeta.targetAmount / 2)))}
                    className="h-7 rounded-full px-3 text-[10px] font-black"
                  >
                    절반
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => commitAmount(volumeMeta.targetAmount)}
                    className="h-7 rounded-full px-3 text-[10px] font-black"
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
                    className="h-9 max-w-[7rem] rounded-xl border-slate-200 text-center text-xs font-black"
                  />
                  <span className="text-[10px] font-semibold text-slate-400">직접입력</span>
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
            "h-8 w-8 shrink-0 rounded-full text-slate-400 transition-all hover:text-destructive",
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
