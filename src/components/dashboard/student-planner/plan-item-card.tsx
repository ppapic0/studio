'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
}: PlanItemCardProps) {
  const toneValue = toneMap[tone];

  return (
    <div className={cn(
      "group flex items-start gap-3 rounded-[1.45rem] border transition-all",
      checked ? toneValue.done : toneValue.idle,
      compact ? "p-4" : isMobile ? "p-4" : "p-5"
    )}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
        className={cn("mt-1 rounded-xl border-2", compact ? "h-5 w-5" : isMobile ? "h-6 w-6" : "h-6 w-6")}
      />
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
