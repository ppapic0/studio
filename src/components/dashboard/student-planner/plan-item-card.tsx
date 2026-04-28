'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, PencilLine, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type PlanItemCardProps = {
  id: string;
  title: string;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  isEditing?: boolean;
  disabled?: boolean;
  completionDisabled?: boolean;
  isMobile: boolean;
  tone: 'emerald' | 'amber' | 'slate';
  badgeLabel?: string | null;
  metaLabel?: string | null;
  compact?: boolean;
  completionActionLabel?: string;
  volumeMeta?: {
    targetAmount: number;
    actualAmount: number;
    unitLabel: string;
    onCommitActual: (value: number) => void;
    onRequestCompletion?: () => void;
  } | null;
};

const toneMap = {
  emerald: {
    done: 'border border-emerald-400/14 bg-[linear-gradient(180deg,rgba(47,170,125,0.12)_0%,rgba(14,27,61,0.9)_100%)]',
    idle: 'surface-card surface-card--primary on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
    accent: 'bg-emerald-500/20 text-emerald-100',
  },
  amber: {
    done: 'border border-[#FFB347]/20 bg-[linear-gradient(180deg,rgba(255,150,38,0.14)_0%,rgba(14,27,61,0.9)_100%)]',
    idle: 'surface-card surface-card--secondary on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
    accent: 'bg-[#FF7A16]/16 text-[#FFD4AA]',
  },
  slate: {
    done: 'border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(14,27,61,0.92)_100%)]',
    idle: 'surface-card surface-card--ghost on-dark shadow-[0_18px_34px_-26px_rgba(0,0,0,0.48)]',
    accent: 'bg-white/[0.12] text-white',
  },
} as const;

export function PlanItemCard({
  id,
  title,
  checked,
  onToggle,
  onDelete,
  onEdit,
  isEditing = false,
  disabled = false,
  completionDisabled = false,
  isMobile,
  tone,
  badgeLabel,
  metaLabel,
  compact = false,
  completionActionLabel,
  volumeMeta = null,
}: PlanItemCardProps) {
  const toneValue = toneMap[tone];
  const [draftAmount, setDraftAmount] = useState(volumeMeta ? String(volumeMeta.actualAmount || 0) : '');
  const [isActualPanelOpen, setIsActualPanelOpen] = useState(false);
  const isCompletionControlDisabled = disabled || (completionDisabled && !checked);
  const canRecordActual = !disabled && !completionDisabled;

  useEffect(() => {
    if (volumeMeta) {
      setDraftAmount(String(volumeMeta.actualAmount || 0));
    }
  }, [volumeMeta?.actualAmount, volumeMeta?.targetAmount, volumeMeta?.unitLabel]);

  useEffect(() => {
    if (!volumeMeta) {
      setIsActualPanelOpen(false);
    }
  }, [volumeMeta]);

  const commitAmount = (nextValue: number) => {
    if (!volumeMeta || !canRecordActual) return;
    const safeValue = Number.isFinite(nextValue) ? Math.max(0, Math.round(nextValue)) : 0;
    setDraftAmount(String(safeValue));
    volumeMeta.onCommitActual(safeValue);
  };

  const progressRate =
    volumeMeta && volumeMeta.targetAmount > 0
      ? Math.min(999, Math.round((volumeMeta.actualAmount / volumeMeta.targetAmount) * 100))
      : 0;

  return (
    <div
      className={cn(
        'group rounded-[1.35rem] transition-all',
        checked ? toneValue.done : toneValue.idle,
        compact ? 'p-3.5' : isMobile ? 'p-4' : 'p-4'
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onToggle}
          disabled={isCompletionControlDisabled}
          className={cn('mt-1 rounded-xl border-2', compact ? 'h-5 w-5' : 'h-6 w-6')}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {badgeLabel ? (
                  <Badge variant="dark" className="rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none">
                    {badgeLabel}
                  </Badge>
                ) : null}
                {volumeMeta ? (
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[9px] font-black',
                      checked ? 'bg-emerald-500 text-white' : toneValue.accent
                    )}
                  >
                    {progressRate}%
                  </span>
                ) : null}
                {metaLabel ? (
                  <span className="text-[10px] font-black text-[var(--text-on-dark-soft)]">
                    {metaLabel}
                  </span>
                ) : null}
              </div>

              <Label
                htmlFor={id}
                className={cn(
                  'mt-1 block break-keep font-black leading-snug tracking-tight text-white transition-all',
                  compact ? 'text-sm' : isMobile ? 'text-sm' : 'text-base',
                  checked && 'text-[var(--text-on-dark-soft)] line-through italic'
                )}
              >
                {title}
              </Label>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {onEdit && !disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onEdit}
                  aria-label={`${title} 수정`}
                  className={cn(
                    'h-8 rounded-full border text-[10px] font-black transition-all',
                    isMobile ? 'w-8 px-0' : 'px-3',
                    isEditing
                      ? 'border-[#FFB347]/40 bg-[#FF7A16]/18 text-[#FFD4AA]'
                      : 'border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]'
                  )}
                >
                  <PencilLine className={cn('h-3.5 w-3.5', !isMobile && 'mr-1.5')} />
                  {isMobile ? <span className="sr-only">수정</span> : '수정'}
                </Button>
              ) : null}
              {volumeMeta && canRecordActual ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsActualPanelOpen((prev) => !prev)}
                  className="h-8 rounded-full border border-white/10 bg-white/[0.05] px-3 text-[10px] font-black text-white hover:bg-white/[0.1]"
                >
                  실제 기록
                  <ChevronDown
                    className={cn('ml-1.5 h-3.5 w-3.5 transition-transform', isActualPanelOpen && 'rotate-180')}
                  />
                </Button>
              ) : null}
              {!disabled ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-full border border-transparent text-[var(--text-on-dark-soft)] transition-all hover:border-white/10 hover:bg-white/[0.08] hover:text-rose-300',
                    isMobile ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
                  )}
                  onClick={onDelete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {volumeMeta ? (
            <div className="mt-3 rounded-[1.05rem] border border-white/10 bg-white/[0.05] p-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black">
                <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[var(--text-on-dark-soft)]">
                  목표 {volumeMeta.targetAmount}
                  {volumeMeta.unitLabel}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-1',
                    checked ? 'bg-emerald-500 text-white' : toneValue.accent
                  )}
                >
                  실제 {volumeMeta.actualAmount}
                  {volumeMeta.unitLabel}
                </span>
                <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[var(--text-on-dark-soft)]">
                  달성률 {progressRate}%
                </span>
              </div>

              {isActualPanelOpen && canRecordActual ? (
                <div className="mt-3 space-y-2">
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
                      variant="ghost"
                      size="icon"
                      onClick={onDelete}
                      aria-label="계획 삭제"
                      className="h-7 w-7 rounded-full border border-white/10 bg-white/[0.06] text-[var(--text-on-dark-soft)] hover:bg-white/[0.12] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (volumeMeta.onRequestCompletion) {
                          volumeMeta.onRequestCompletion();
                          return;
                        }
                        commitAmount(volumeMeta.targetAmount);
                      }}
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
                      className="h-9 max-w-[7rem] rounded-xl border-white/12 bg-white/[0.08] text-center text-xs font-black text-white"
                    />
                    <span className="text-[10px] font-semibold text-[var(--text-on-dark-soft)]">
                      직접입력
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!checked && completionActionLabel ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={onToggle}
                disabled={isCompletionControlDisabled}
                className={cn(
                  'h-8 rounded-full px-3 text-[10px] font-black shadow-none',
                  isCompletionControlDisabled && 'opacity-55'
                )}
              >
                {isCompletionControlDisabled ? '당일만' : completionActionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
