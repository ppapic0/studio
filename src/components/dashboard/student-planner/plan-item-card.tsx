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
    idle: 'surface-card surface-card--primary on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
  },
  amber: {
    done: 'border border-[#FFB347]/24 bg-[linear-gradient(180deg,rgba(255,150,38,0.18)_0%,rgba(14,27,61,0.9)_100%)]',
    idle: 'surface-card surface-card--secondary on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
  },
  slate: {
    done: 'border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(14,27,61,0.92)_100%)]',
    idle: 'surface-card surface-card--ghost on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
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
      "group flex items-start gap-3 rounded-[1.45rem] transition-all",
      checked ? toneValue.done : toneValue.idle,
      compact ? "p-4" : isMobile ? "p-4" : "p-5"
    )}>
      {volumeMeta ? (
        <div className={cn(
          "mt-1 flex h-6 min-w-[2.25rem] items-center justify-center rounded-full px-2 text-[10px] font-black",
          checked ? "bg-emerald-500 text-white" : "bg-white/[0.12] text-[var(--text-on-dark-soft)]"
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
            <Badge variant="dark" className="rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none">
              {badgeLabel}
            </Badge>
          ) : null}
          {metaLabel ? (
            <span className="text-[10px] font-black text-[var(--text-on-dark-soft)]">{metaLabel}</span>
          ) : null}
        </div>
        <Label
          htmlFor={id}
          className={cn(
            "mt-1 block break-keep font-black leading-snug tracking-tight text-white transition-all",
            compact ? "text-sm" : isMobile ? "text-sm" : "text-base",
            checked && "text-[var(--text-on-dark-soft)] line-through italic"
          )}
        >
          {title}
        </Label>

        {volumeMeta ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
              <span className="surface-chip surface-chip--dark px-2.5 py-1 text-[var(--text-on-dark-soft)]">
                목표 {volumeMeta.targetAmount}{volumeMeta.unitLabel}
              </span>
              <span className={cn(
                "rounded-full px-2.5 py-1",
                checked ? "bg-emerald-500 text-white" : "bg-emerald-500/18 text-emerald-200"
              )}>
                실제 {volumeMeta.actualAmount}{volumeMeta.unitLabel}
              </span>
              <span className="surface-chip surface-chip--dark px-2.5 py-1 text-[var(--text-on-dark-soft)]">
                달성률 {progressRate}%
              </span>
            </div>
            {!disabled ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="dark"
                    onClick={() => commitAmount(0)}
                    className="h-7 rounded-full px-3 text-[10px] font-black"
                  >
                    0
                  </Button>
                  <Button
                    type="button"
                    variant="dark"
                    onClick={() => commitAmount(Math.max(1, Math.round(volumeMeta.targetAmount / 2)))}
                    className="h-7 rounded-full px-3 text-[10px] font-black"
                  >
                    절반
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
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
                    className="h-9 max-w-[7rem] rounded-xl text-center text-xs font-black"
                  />
                  <span className="text-[10px] font-semibold text-[var(--text-on-dark-soft)]">직접입력</span>
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
            "h-8 w-8 shrink-0 rounded-full text-[var(--text-on-dark-soft)] transition-all hover:text-rose-300",
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
