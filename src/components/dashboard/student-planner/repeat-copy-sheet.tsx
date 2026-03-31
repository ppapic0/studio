'use client';

import { Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type WeekdayOption = {
  value: number;
  label: string;
};

type RepeatCopyItemOption = {
  id: string;
  title: string;
  meta: string;
  badgeLabel?: string;
  badgeClassName?: string;
};

type RepeatCopySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  itemLabel: string;
  weeksValue: string;
  onWeeksChange: (value: string) => void;
  selectedDays: number[];
  onToggleDay: (day: number, checked: boolean) => void;
  itemOptions: RepeatCopyItemOption[];
  selectedItemIds: string[];
  onToggleItem: (id: string, checked: boolean) => void;
  onSelectAllItems: () => void;
  onClearItems: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  isMobile: boolean;
  weekdayOptions: WeekdayOption[];
};

export function RepeatCopySheet({
  open,
  onOpenChange,
  title,
  description,
  itemLabel,
  weeksValue,
  onWeeksChange,
  selectedDays,
  onToggleDay,
  itemOptions,
  selectedItemIds,
  onToggleItem,
  onSelectAllItems,
  onClearItems,
  onConfirm,
  isSubmitting,
  isMobile,
  weekdayOptions,
}: RepeatCopySheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "overflow-hidden border-none shadow-2xl",
        isMobile ? "w-[92vw] max-w-[360px] rounded-[2rem] p-0" : "sm:max-w-md rounded-[2rem] p-0"
      )}>
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(255,179,71,0.16),transparent_28%),linear-gradient(135deg,#10295f_0%,#17326B_46%,#0f2149_100%)] p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight text-white">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-[var(--text-on-dark-soft)]">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("space-y-5 bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)] text-white", isMobile ? "p-5" : "p-6")}>
          <div className="space-y-2">
            <Label className="text-xs font-black text-[var(--text-on-dark-soft)]">몇 주간 복사할까요?</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={weeksValue}
              onChange={(event) => onWeeksChange(event.target.value)}
              className="h-11 rounded-xl border-white/12 bg-white/[0.1] font-black text-white"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Label className="text-xs font-black text-[var(--text-on-dark-soft)]">{itemLabel}</Label>
                <p className="mt-1 text-[11px] font-semibold text-[var(--text-on-dark-soft)]">
                  선택한 항목만 같은 요일 라인으로 복사해요.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onSelectAllItems}
                  className="h-8 rounded-lg border border-white/12 bg-white/[0.08] px-2.5 text-[10px] font-black text-white hover:bg-white/[0.14]"
                >
                  전체 선택
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClearItems}
                  className="h-8 rounded-lg border border-white/12 bg-white/[0.06] px-2.5 text-[10px] font-black text-[var(--text-on-dark-soft)] hover:bg-white/[0.12]"
                >
                  전체 해제
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              {itemOptions.map((option) => (
                <label
                  key={`${title}-${option.id}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                    selectedItemIds.includes(option.id)
                      ? "border-[#FFB347]/28 bg-[#FF9626]/14 shadow-[0_16px_28px_-22px_rgba(255,122,22,0.32)]"
                      : "border-white/12 bg-white/[0.08] hover:bg-white/[0.11]"
                  )}
                >
                  <Checkbox
                    checked={selectedItemIds.includes(option.id)}
                    onCheckedChange={(checked) => onToggleItem(option.id, checked === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-keep text-sm font-black leading-5 text-white">{option.title}</p>
                      {option.badgeLabel ? (
                        <Badge
                          variant="outline"
                          className={cn("h-6 rounded-full px-2 text-[10px] font-black shadow-sm", option.badgeClassName)}
                        >
                          {option.badgeLabel}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">{option.meta}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black text-[var(--text-on-dark-soft)]">복사할 요일</Label>
            <div className="grid grid-cols-4 gap-2">
              {weekdayOptions.map((option) => (
                <label
                  key={`${title}-${option.value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/12 bg-white/[0.08] p-2 hover:bg-white/[0.11]"
                >
                  <Checkbox
                    checked={selectedDays.includes(option.value)}
                    onCheckedChange={(checked) => onToggleDay(option.value, checked === true)}
                  />
                  <span className="text-xs font-black text-white">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className={cn("border-t border-white/12 bg-[linear-gradient(180deg,#13285A_0%,#0E1B3D_100%)]", isMobile ? "p-5" : "p-6")}>
          <div className="flex w-full gap-2">
            <Button variant="dark" onClick={() => onOpenChange(false)} className="h-11 flex-1 rounded-xl font-black">
              취소
            </Button>
            <Button variant="secondary" onClick={onConfirm} disabled={isSubmitting} className="h-11 flex-1 rounded-xl font-black">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '복사하기'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
