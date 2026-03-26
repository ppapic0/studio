'use client';

import { Loader2, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import { STUDY_MINUTE_PRESETS } from './planner-constants';

type SubjectOption = {
  id: string;
  label: string;
  color?: string;
  light?: string;
  text?: string;
};

type StudyComposerCardProps = {
  title: string;
  description: string;
  subjectOptions: SubjectOption[];
  subjectValue: string;
  onSubjectChange: (value: string) => void;
  minuteValue: string;
  onMinuteChange: (value: string) => void;
  taskValue: string;
  onTaskChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isMobile: boolean;
  compact?: boolean;
  disabled?: boolean;
  submitLabel?: string;
};

export function StudyComposerCard({
  title,
  description,
  subjectOptions,
  subjectValue,
  onSubjectChange,
  minuteValue,
  onMinuteChange,
  taskValue,
  onTaskChange,
  onSubmit,
  isSubmitting,
  isMobile,
  compact = false,
  disabled = false,
  submitLabel = '계획 추가',
}: StudyComposerCardProps) {
  return (
    <Card className={cn(
      "overflow-hidden border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,253,248,0.96)_100%)] ring-1 ring-emerald-100/80 shadow-[0_18px_44px_-34px_rgba(16,185,129,0.28)]",
      compact ? "rounded-[1.35rem]" : "rounded-[1.85rem]"
    )}>
      <CardHeader className={cn(compact ? "p-4 pb-3" : isMobile ? "p-5 pb-4" : "p-6 pb-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("rounded-2xl bg-emerald-500/10 text-emerald-600", compact ? "p-2" : "p-2.5")}>
            <Target className={compact ? "h-4 w-4" : "h-4 w-4"} />
          </div>
          <div className="min-w-0">
            <CardTitle className={cn("font-black tracking-tight text-slate-900", compact ? "text-sm" : isMobile ? "text-base" : "text-lg")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("break-keep text-slate-500", compact ? "mt-0.5 text-[10px] leading-4" : "mt-0.5 text-[11px] leading-5")}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "space-y-3 p-4 pt-0" : isMobile ? "space-y-3 p-5 pt-0" : "space-y-4 p-6 pt-0")}>
        <div className={cn("grid gap-2", compact ? "grid-cols-2" : "grid-cols-[minmax(0,1fr)_7.2rem]")}>
          <Select value={subjectValue} onValueChange={onSubjectChange} disabled={disabled || isSubmitting}>
            <SelectTrigger className={cn("rounded-xl border-slate-200 bg-white/92 font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-2xl">
              {subjectOptions.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            value={minuteValue}
            onChange={(event) => onMinuteChange(event.target.value)}
            disabled={disabled || isSubmitting}
            className={cn("rounded-xl border-slate-200 bg-white/92 text-center font-black shadow-none", compact ? "h-10 text-[11px]" : "h-11 text-xs")}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {STUDY_MINUTE_PRESETS.map((preset) => {
            const isActive = minuteValue === String(preset);
            return (
              <Button
                key={preset}
                type="button"
                variant="outline"
                disabled={disabled || isSubmitting}
                onClick={() => onMinuteChange(String(preset))}
                className={cn(
                  "rounded-full border transition-all active:scale-[0.98]",
                  compact ? "h-7 px-3 text-[10px]" : "h-8 px-3.5 text-[10px]",
                  isActive
                    ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-500"
                    : "border-emerald-100 bg-white/88 text-emerald-700 hover:bg-emerald-50"
                )}
              >
                <span className="font-black">{preset}분</span>
              </Button>
            );
          })}
        </div>

        <div className={cn(
          "flex items-center gap-2 rounded-[1.15rem] border border-emerald-100 bg-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
          compact ? "p-1.5" : "p-2"
        )}>
          <Input
            value={taskValue}
            onChange={(event) => onTaskChange(event.target.value)}
            placeholder="예: 수학 오답 정리"
            disabled={disabled || isSubmitting}
            className={cn(
              "border-none bg-transparent shadow-none focus-visible:ring-0",
              compact ? "h-9 text-sm font-bold" : "h-10 text-sm font-bold"
            )}
          />
          <Button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !taskValue.trim()}
            className={cn(
              "rounded-xl bg-emerald-500 font-black text-white shadow-[0_14px_26px_-18px_rgba(16,185,129,0.55)] hover:bg-emerald-600",
              compact ? "h-9 px-3 text-[11px]" : isMobile ? "h-10 px-4 text-xs" : "h-10 px-4 text-sm"
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
