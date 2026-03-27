'use client';

import { History, Loader2, PenLine, PlusCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import type { RecentStudyOption } from './planner-constants';

type RecentStudySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: RecentStudyOption[];
  onPrefill: (item: RecentStudyOption) => void;
  onQuickAdd: (item: RecentStudyOption) => void | Promise<void>;
  isSubmitting: boolean;
  isMobile: boolean;
};

export function RecentStudySheet({
  open,
  onOpenChange,
  items,
  onPrefill,
  onQuickAdd,
  isSubmitting,
  isMobile,
}: RecentStudySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'overflow-hidden border-none bg-white p-0 shadow-2xl',
          isMobile
            ? 'h-auto max-h-[85dvh] rounded-t-[2rem] pb-[calc(1rem+env(safe-area-inset-bottom))]'
            : 'w-[27rem] max-w-[27rem] rounded-l-[2rem]'
        )}
      >
        <div className="bg-[linear-gradient(135deg,#10295f_0%,#1d4ed8_48%,#10b981_100%)] p-6 text-white">
          <SheetHeader className="text-left">
            <div className="flex items-center gap-2">
              <div className="rounded-2xl bg-white/12 p-2">
                <History className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-xl font-black tracking-tight text-white">
                  최근 학습 계획 불러오기
                </SheetTitle>
                <SheetDescription className="mt-1 text-[11px] font-semibold text-white/76">
                  전에 적어둔 계획을 바로 불러와서 제목이나 수치만 가볍게 바꿔보세요.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className={cn('space-y-3 overflow-y-auto bg-white', isMobile ? 'max-h-[calc(85dvh-11rem)] p-4' : 'h-full p-5')}>
          {items.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <p className="text-sm font-black text-slate-700">최근 학습 계획이 아직 없어요</p>
              <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                오늘 계획을 한두 개만 추가해두면 다음부터는 여기서 바로 불러올 수 있어요.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.key}
                className="rounded-[1.45rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.94)_100%)] p-4 shadow-[0_18px_40px_-34px_rgba(20,41,95,0.2)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 shadow-none">
                    {item.subjectLabel}
                  </Badge>
                  <Badge className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black text-slate-500 shadow-none">
                    {item.studyModeLabel}
                  </Badge>
                  <span className="text-[10px] font-black text-slate-400">{item.updatedLabel}</span>
                </div>
                <p className="mt-3 line-clamp-1 break-keep text-sm font-black tracking-tight text-slate-900">
                  {item.title}
                </p>
                <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                  {item.metaLabel}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={() => onPrefill(item)}
                    className="h-10 flex-1 rounded-xl border-slate-200 bg-white text-xs font-black text-slate-700"
                  >
                    <PenLine className="mr-2 h-3.5 w-3.5" />
                    불러와 수정
                  </Button>
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => onQuickAdd(item)}
                    className="h-10 flex-1 rounded-xl bg-emerald-500 text-xs font-black text-white hover:bg-emerald-600"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlusCircle className="mr-2 h-3.5 w-3.5" />
                    )}
                    그대로 추가
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <SheetFooter className="border-t bg-slate-50/70 p-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full rounded-xl border-2 font-black"
          >
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
