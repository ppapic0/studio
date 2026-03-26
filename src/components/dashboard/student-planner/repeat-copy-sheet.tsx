'use client';

import { Loader2 } from 'lucide-react';

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

type RepeatCopySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  weeksValue: string;
  onWeeksChange: (value: string) => void;
  selectedDays: number[];
  onToggleDay: (day: number, checked: boolean) => void;
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
  weeksValue,
  onWeeksChange,
  selectedDays,
  onToggleDay,
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
        <div className="bg-[linear-gradient(135deg,#10295f_0%,#1d4ed8_46%,#10b981_100%)] p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight text-white">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/72">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className={cn("space-y-5 bg-white", isMobile ? "p-5" : "p-6")}>
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-500">몇 주간 복사할까요?</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={weeksValue}
              onChange={(event) => onWeeksChange(event.target.value)}
              className="h-11 rounded-xl border-2 font-black"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-black text-slate-500">복사할 요일</Label>
            <div className="grid grid-cols-4 gap-2">
              {weekdayOptions.map((option) => (
                <label
                  key={`${title}-${option.value}`}
                  className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2"
                >
                  <Checkbox
                    checked={selectedDays.includes(option.value)}
                    onCheckedChange={(checked) => onToggleDay(option.value, checked === true)}
                  />
                  <span className="text-xs font-black text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className={cn("border-t bg-slate-50/60", isMobile ? "p-5" : "p-6")}>
          <div className="flex w-full gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 flex-1 rounded-xl border-2 font-black">
              취소
            </Button>
            <Button onClick={onConfirm} disabled={isSubmitting} className="h-11 flex-1 rounded-xl bg-primary font-black text-white">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '복사하기'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
