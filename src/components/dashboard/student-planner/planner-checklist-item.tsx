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

  return (
    <div className={cn(
      'rounded-[1.35rem] border border-[#E3EAF4] bg-white/88 transition-all',
      task.done ? 'bg-[#F8FBFF]' : 'hover:border-[#D1DAE9] hover:bg-white/96'
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
        className={cn(
          'flex items-start gap-3 px-4 py-4 outline-none',
          isMobile ? 'min-h-[4.85rem]' : 'min-h-[5.2rem]'
        )}
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
              className="mt-0.5 h-6 w-6 rounded-xl border-[#173A82]/28 bg-white data-[state=checked]:border-[#173A82] data-[state=checked]:bg-[#173A82]"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('rounded-full px-2.5 py-0.5 text-[9px] font-black shadow-none', badgeClassName)}>
              {badgeLabel}
            </Badge>
            {task.priority ? (
              <Badge className="rounded-full border border-[#FF7A16]/15 bg-[#FFF7EC] px-2 py-0.5 text-[9px] font-black text-[#FF7A16] shadow-none">
                {task.priority === 'high' ? '중요' : task.priority === 'medium' ? '보통' : '가볍게'}
              </Badge>
            ) : null}
          </div>

          <p className={cn(
            'mt-2 break-keep font-black leading-snug tracking-tight text-[#173A82]',
            isMobile ? 'text-[1rem]' : 'text-[1.05rem]',
            task.done && 'text-[#173A82]/42 line-through'
          )}>
            {task.title}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#173A82]/72">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F5F8FF] px-2.5 py-1">
              <Clock3 className="h-3.5 w-3.5 text-[#FF7A16]" />
              {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : durationLabel}
            </span>
            {task.tag ? (
              <span className="rounded-full bg-[#FFF7EC] px-2.5 py-1 text-[#FF7A16]">{task.tag}</span>
            ) : null}
          </div>

          {detailLabel ? (
            <p className="mt-2 line-clamp-1 text-[11px] font-semibold leading-5 text-[#173A82]/56">{detailLabel}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onExpandedChange(!expanded);
            }}
            className="rounded-full bg-[#F5F8FF] p-2 text-[#173A82]/70 transition hover:bg-[#E8F0FF]"
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
              className="h-8 w-8 rounded-full text-[#173A82]/30 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : (
            <GripHorizontal className="h-4 w-4 text-[#173A82]/20" />
          )}
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-[#E3EAF4] px-4 py-4">
          {isVolumeTask ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-[#173A82]/75">
                <span className="rounded-full bg-[#F5F8FF] px-2.5 py-1">
                  목표 {Math.max(0, task.targetAmount || 0)}{task.amountUnit === '직접입력' ? task.amountUnitLabel || '단위' : task.amountUnit || '문제'}
                </span>
                <span className={cn(
                  'rounded-full px-2.5 py-1',
                  task.done ? 'bg-emerald-500 text-white' : 'bg-[#FFF7EC] text-[#FF7A16]'
                )}>
                  실제 {Math.max(0, task.actualAmount || 0)}{task.amountUnit === '직접입력' ? task.amountUnitLabel || '단위' : task.amountUnit || '문제'}
                </span>
              </div>
              {!disabled ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => onCommitActual(0)} className="h-8 rounded-full border-[#D9E1F2] text-[10px] font-black text-[#173A82]">0</Button>
                  <Button type="button" variant="outline" onClick={() => onCommitActual(Math.max(1, Math.round((task.targetAmount || 0) / 2)))} className="h-8 rounded-full border-[#D9E1F2] text-[10px] font-black text-[#173A82]">절반</Button>
                  <Button type="button" variant="outline" onClick={() => onCommitActual(Math.max(0, task.targetAmount || 0))} className="h-8 rounded-full border-[#D9E1F2] text-[10px] font-black text-[#173A82]">완료</Button>
                  <div className="flex items-center gap-2 rounded-full bg-[#F7FBFF] px-2 py-1.5">
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
                      className="h-7 w-16 rounded-full border-[#D9E1F2] text-center text-[11px] font-black text-[#173A82]"
                    />
                    <span className="text-[10px] font-bold text-[#173A82]/55">직접입력</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {task.category === 'study' && task.targetMinutes ? (
            <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">시작</p>
                <Input
                  type="time"
                  value={draftStartTime}
                  onChange={(event) => setDraftStartTime(event.target.value)}
                  onBlur={() => onUpdateWindow(draftStartTime, draftEndTime)}
                  disabled={disabled}
                  className="h-10 rounded-xl border-[#D9E1F2] font-black text-[#173A82]"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#173A82]/40">종료</p>
                <Input
                  type="time"
                  value={draftEndTime}
                  onChange={(event) => setDraftEndTime(event.target.value)}
                  onBlur={() => onUpdateWindow(draftStartTime, draftEndTime)}
                  disabled={disabled}
                  className="h-10 rounded-xl border-[#D9E1F2] font-black text-[#173A82]"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
