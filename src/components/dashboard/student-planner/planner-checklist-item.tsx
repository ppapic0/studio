'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Clock3, GripHorizontal, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { StudyPlanItem, WithId } from '@/lib/types';

type PlannerChecklistItemProps = {
  task: WithId<StudyPlanItem>;
  badgeLabel: string;
  badgeClassName: string;
  durationLabel: string;
  detailLabel?: string | null;
  rewardLabel?: string | null;
  statusLabel?: string | null;
  statusTone?: 'planned' | 'active' | 'completed';
  progressPercent?: number;
  isVolumeTask: boolean;
  isMobile: boolean;
  disabled?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onToggle: () => void;
  onDelete: () => void;
  onCommitActual: (value: number) => void;
  onUpdateWindow: (startTime: string, endTime: string) => void;
};

export function PlannerChecklistItem({
  task,
  badgeLabel,
  badgeClassName,
  durationLabel,
  detailLabel,
  rewardLabel,
  statusLabel,
  statusTone = 'planned',
  progressPercent = 0,
  isVolumeTask,
  isMobile,
  disabled = false,
  expanded,
  onExpandedChange,
  onToggle,
  onDelete,
  onCommitActual,
  onUpdateWindow,
}: PlannerChecklistItemProps) {
  const [draftActualAmount, setDraftActualAmount] = useState(String(task.actualAmount || 0));
  const [draftStartTime, setDraftStartTime] = useState(task.startTime || '');
  const [draftEndTime, setDraftEndTime] = useState(task.endTime || '');

  useEffect(() => {
    setDraftActualAmount(String(task.actualAmount || 0));
  }, [task.actualAmount]);

  useEffect(() => {
    setDraftStartTime(task.startTime || '');
    setDraftEndTime(task.endTime || '');
  }, [task.startTime, task.endTime]);

  const safeProgress = isVolumeTask && (task.targetAmount || 0) > 0
    ? Math.min(100, Math.round(((task.actualAmount || 0) / Math.max(1, task.targetAmount || 1)) * 100))
    : 0;
  const displayedProgress = isVolumeTask ? safeProgress : Math.max(0, Math.min(100, progressPercent));
  const containerClass =
    statusTone === 'completed'
      ? 'border-[#2FAA7D]/30 bg-[linear-gradient(180deg,rgba(25,74,82,0.92)_0%,rgba(18,57,63,0.88)_100%)]'
      : statusTone === 'active'
        ? 'border-[#FFB347]/24 bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.12),transparent_22%),linear-gradient(180deg,rgba(29,53,101,0.96)_0%,rgba(18,34,70,0.92)_100%)] shadow-[0_20px_36px_-28px_rgba(0,0,0,0.42)]'
        : 'border-white/12 bg-[linear-gradient(180deg,rgba(22,40,79,0.94)_0%,rgba(12,27,63,0.9)_100%)] hover:border-white/18 hover:bg-[linear-gradient(180deg,rgba(28,52,103,0.94)_0%,rgba(14,29,68,0.92)_100%)]';
  const statusBadgeClass =
    statusTone === 'completed'
      ? 'border border-[#2FAA7D]/26 bg-[#2FAA7D]/14 text-[#8BE1BF]'
      : statusTone === 'active'
        ? 'border border-[#FFB347]/28 bg-[#FF9626]/18 text-[var(--accent-orange-soft)]'
        : 'border border-white/12 bg-white/[0.1] text-[var(--text-on-dark-soft)]';

  return (
    <div className={cn(
      'rounded-[1.5rem] border transition-all',
      containerClass
    )}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onExpandedChange(!expanded)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onExpandedChange(!expanded);
          }
        }}
        className={cn('flex items-start gap-3 px-4 py-4 outline-none', isMobile ? 'min-h-[5.2rem]' : 'min-h-[5.6rem]')}
      >
        <div className="pt-1">
          {isVolumeTask ? (
            <div className={cn(
              'flex h-7 min-w-[2.85rem] items-center justify-center rounded-full px-2.5 text-[10px] font-black',
              task.done ? 'bg-emerald-500 text-white' : 'bg-[#EFF5FF] text-[#173A82]'
            )}>
              {safeProgress}%
            </div>
          ) : (
            <Checkbox
              checked={task.done}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={onToggle}
              disabled={disabled}
              className="mt-0.5 h-6 w-6 rounded-xl border-white/18 bg-white/[0.08] data-[state=checked]:border-[#FF9626] data-[state=checked]:bg-[#FF9626]"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none', badgeClassName)}>
              {badgeLabel}
            </Badge>
            {statusLabel ? (
              <Badge className={cn('rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none', statusBadgeClass)}>
                {statusLabel}
              </Badge>
            ) : null}
            {rewardLabel ? (
              <Badge className="rounded-full border border-[#FF9626]/24 bg-[#FF9626]/16 px-2.5 py-0.5 text-[9px] font-black text-[var(--accent-orange-soft)] shadow-none">
                {rewardLabel}
              </Badge>
            ) : null}
            {task.priority ? (
              <Badge className="rounded-full border border-[#FF7A16]/24 bg-[#FF9626]/16 px-2 py-0.5 text-[9px] font-black text-[var(--accent-orange-soft)] shadow-none">
                {task.priority === 'high' ? '중요' : task.priority === 'medium' ? '보통' : '가볍게'}
              </Badge>
            ) : null}
          </div>

          <p className={cn(
            'mt-2 break-keep font-black leading-snug tracking-tight text-white',
            isMobile ? 'text-[1rem]' : 'text-[1.05rem]',
            task.done && 'text-[var(--text-on-dark-muted)] line-through'
          )}>
            {task.title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.1] px-2.5 py-1">
              <Clock3 className="h-3.5 w-3.5 text-[#FF7A16]" />
              {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : durationLabel}
            </span>
            {task.tag ? (
              <span className="rounded-full bg-[#FF9626]/16 px-2.5 py-1 text-[var(--accent-orange-soft)]">{task.tag}</span>
            ) : null}
          </div>

          {detailLabel ? (
            <p className="mt-2 line-clamp-1 text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">{detailLabel}</p>
          ) : null}

          {!task.done && displayedProgress > 0 ? (
            <div className="mt-3">
              <div className="rounded-full bg-white/10 p-1">
                <div className="relative overflow-hidden rounded-full">
                  <div
                    className="h-2.5 rounded-full bg-[linear-gradient(90deg,#173A82_0%,#28478F_48%,#FFB347_100%)] transition-[width] duration-500"
                    style={{ width: `${displayedProgress}%` }}
                  />
                  <div className="pointer-events-none absolute inset-y-0 w-16 animate-[planner-shimmer-slide_2.6s_linear_infinite] bg-[linear-gradient(90deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.42)_55%,rgba(255,255,255,0)_100%)]" />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onExpandedChange(!expanded);
            }}
            className="rounded-full bg-white/[0.1] p-2 text-white transition hover:bg-white/[0.14]"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
          </button>
          {!disabled ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="h-8 w-8 rounded-full text-[var(--text-on-dark-soft)] hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <GripHorizontal className="h-4 w-4 text-[var(--text-on-dark-muted)]" />
          )}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-white/12 px-4 py-4">
          {isVolumeTask ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-[var(--text-on-dark-soft)]">
                <span className="rounded-full bg-white/[0.1] px-2.5 py-1">
                  목표 {Math.max(0, task.targetAmount || 0)}{task.amountUnit === '직접입력' ? task.amountUnitLabel || '단위' : task.amountUnit || '문제'}
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-1',
                  task.done ? 'bg-emerald-500 text-white' : 'bg-[#FF9626]/18 text-[var(--accent-orange-soft)]'
                )}>
                  실제 {Math.max(0, task.actualAmount || 0)}{task.amountUnit === '직접입력' ? task.amountUnitLabel || '단위' : task.amountUnit || '문제'}
                </span>
              </div>
              {!disabled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="dark" onClick={() => onCommitActual(0)} className="h-8 rounded-full text-[10px] font-black">0</Button>
                  <Button type="button" variant="dark" onClick={() => onCommitActual(Math.max(1, Math.round((task.targetAmount || 0) / 2)))} className="h-8 rounded-full text-[10px] font-black">절반</Button>
                  <Button type="button" variant="dark" onClick={() => onCommitActual(Math.max(0, task.targetAmount || 0))} className="h-8 rounded-full text-[10px] font-black">완료</Button>
                  <div className="flex items-center gap-2 rounded-full bg-white/[0.1] px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={draftActualAmount}
                      onChange={(event) => setDraftActualAmount(event.target.value)}
                      onBlur={() => onCommitActual(Number(draftActualAmount))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          onCommitActual(Number(draftActualAmount));
                        }
                      }}
                      className="h-7 w-16 rounded-full border-white/12 bg-transparent text-center text-[11px] font-black text-white"
                    />
                    <span className="text-[10px] font-bold text-[var(--text-on-dark-soft)]">직접입력</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {task.category === 'study' && task.targetMinutes ? (
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">시작</p>
                <Input
                  type="time"
                  value={draftStartTime}
                  onChange={(event) => setDraftStartTime(event.target.value)}
                  onBlur={() => onUpdateWindow(draftStartTime, draftEndTime)}
                  disabled={disabled}
                  className="h-10 rounded-xl border-white/12 bg-white/[0.1] font-black text-white"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">종료</p>
                <Input
                  type="time"
                  value={draftEndTime}
                  onChange={(event) => setDraftEndTime(event.target.value)}
                  onBlur={() => onUpdateWindow(draftStartTime, draftEndTime)}
                  disabled={disabled}
                  className="h-10 rounded-xl border-white/12 bg-white/[0.1] font-black text-white"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
