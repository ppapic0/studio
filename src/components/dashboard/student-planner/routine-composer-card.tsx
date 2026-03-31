'use client';

import { Loader2, PenLine, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { type RoutineTemplateOption } from './planner-constants';
import { RoutineTemplateStrip } from './routine-template-strip';

type RoutineComposerCardProps = {
  title: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isMobile: boolean;
  submitLabel?: string;
  compact?: boolean;
  selectedTemplateKey: string;
  onTemplateSelect: (template: RoutineTemplateOption) => void;
  templateOptions: RoutineTemplateOption[];
  disabled?: boolean;
};

export function RoutineComposerCard({
  title,
  description,
  value,
  onValueChange,
  onSubmit,
  isSubmitting,
  isMobile,
  submitLabel = '루틴 추가',
  compact = false,
  selectedTemplateKey,
  onTemplateSelect,
  templateOptions,
  disabled = false,
}: RoutineComposerCardProps) {
  return (
    <Card variant="secondary" className={cn(
      "overflow-hidden shadow-[0_18px_44px_-34px_rgba(0,0,0,0.5)]",
      compact ? "rounded-[1.35rem]" : "rounded-[1.85rem]"
    )}>
      <CardHeader className={cn(compact ? "p-4 pb-3" : isMobile ? "p-5 pb-4" : "p-6 pb-4")}>
        <div className="flex items-center gap-2">
          <div className={cn("surface-chip surface-chip--accent", compact ? "p-2" : "p-2.5")}>
            <Sparkles className={compact ? "h-4 w-4" : "h-4 w-4"} />
          </div>
          <div className="min-w-0">
            <CardTitle className={cn("font-black tracking-tight text-white break-keep", compact ? "text-sm" : isMobile ? "text-base leading-6" : "text-lg")}>
              {title}
            </CardTitle>
            <CardDescription className={cn("break-keep text-[var(--text-on-dark-soft)]", compact ? "mt-0.5 text-[10px] leading-4" : isMobile ? "mt-0.5 text-[11px] leading-5" : "mt-0.5 text-[11px] leading-5")}>
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(compact ? "space-y-3 p-4 pt-0" : isMobile ? "space-y-3 p-5 pt-0" : "space-y-4 p-6 pt-0")}>
        <RoutineTemplateStrip
          templates={templateOptions}
          selectedKey={selectedTemplateKey}
          onSelect={onTemplateSelect}
          isMobile={isMobile}
          compact={compact}
        />

        <div className={cn(
          "rounded-[1.15rem] border border-white/12 bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
          compact ? "flex items-center gap-2" : isMobile ? "flex flex-col gap-2.5" : "flex items-center gap-2",
          compact ? "p-1.5" : "p-2"
        )}>
          <div className={cn("flex min-w-0 items-center gap-2", compact ? "flex-1" : "w-full flex-1")}>
            <PenLine className={cn("shrink-0 text-[var(--text-on-dark-muted)]", compact ? "ml-1 h-3.5 w-3.5" : "ml-1 h-4 w-4")} />
            <Input
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder="예: 영어 학원, 저녁 시간"
              disabled={disabled || isSubmitting}
              className={cn(
                "border-none bg-transparent px-0 text-white shadow-none focus-visible:ring-0 placeholder:text-white/55",
                compact ? "h-9 text-sm font-bold" : "h-10 text-sm font-bold"
              )}
            />
          </div>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !value.trim()}
            className={cn(
              "shrink-0 rounded-xl bg-[linear-gradient(135deg,#173A82_0%,#22479B_58%,#FF7A16_160%)] font-black text-white shadow-[0_14px_26px_-18px_rgba(20,41,95,0.55)] hover:brightness-105",
              compact ? "h-9 px-3 text-[11px]" : isMobile ? "h-10 w-full px-4 text-xs" : "h-10 px-4 text-sm"
            )}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
