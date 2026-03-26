'use client';

import { CalendarDays, Coffee, MapPin, PlusCircle, School, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { type RoutineTemplateOption } from './planner-constants';

const iconByKey = {
  arrival: MapPin,
  departure: School,
  meal: Coffee,
  academy: CalendarDays,
  break: Sparkles,
  custom: PlusCircle,
} as const;

type RoutineTemplateStripProps = {
  templates: RoutineTemplateOption[];
  selectedKey: string;
  onSelect: (template: RoutineTemplateOption) => void;
  isMobile: boolean;
  compact?: boolean;
};

export function RoutineTemplateStrip({
  templates,
  selectedKey,
  onSelect,
  isMobile,
  compact = false,
}: RoutineTemplateStripProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
      {templates.map((template) => {
        const Icon = iconByKey[template.icon];
        const isActive = template.key === selectedKey;

        return (
          <Button
            key={template.key}
            type="button"
            variant="outline"
            onClick={() => onSelect(template)}
            className={cn(
              "rounded-full border transition-all active:scale-[0.98]",
              compact ? "h-8 px-3 text-[10px]" : isMobile ? "h-9 px-3.5 text-[10px]" : "h-10 px-4 text-xs",
              isActive
                ? "border-primary/15 bg-primary text-white shadow-[0_14px_28px_-18px_rgba(20,41,95,0.55)] hover:bg-primary"
                : "border-slate-200 bg-white/88 text-slate-600 hover:border-primary/20 hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon className={cn("mr-1.5 shrink-0", compact ? "h-3.5 w-3.5" : "h-3.5 w-3.5")} />
            <span className="font-black tracking-tight">{template.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
