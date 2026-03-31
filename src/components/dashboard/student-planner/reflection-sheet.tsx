'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { type RoutineReflectionEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

type ReflectionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    reflection: Omit<RoutineReflectionEntry, 'dateKey' | 'completedBlockCount' | 'totalBlockCount'>
  ) => void;
};

const moodOptions: Array<{ value: RoutineReflectionEntry['mood']; label: string }> = [
  { value: 'low', label: '버거웠어요' },
  { value: 'steady', label: '무난했어요' },
  { value: 'good', label: '잘 굴렀어요' },
  { value: 'great', label: '몰입됐어요' },
];

const energyOptions: Array<{ value: RoutineReflectionEntry['energy']; label: string }> = [
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '보통' },
  { value: 'high', label: '좋음' },
];

export function ReflectionSheet({ open, onOpenChange, onSubmit }: ReflectionSheetProps) {
  const [goodPoint, setGoodPoint] = useState('');
  const [derailReason, setDerailReason] = useState('');
  const [keepOneThing, setKeepOneThing] = useState('');
  const [changeOneThing, setChangeOneThing] = useState('');
  const [mood, setMood] = useState<RoutineReflectionEntry['mood']>('steady');
  const [energy, setEnergy] = useState<RoutineReflectionEntry['energy']>('medium');

  const reset = () => {
    setGoodPoint('');
    setDerailReason('');
    setKeepOneThing('');
    setChangeOneThing('');
    setMood('steady');
    setEnergy('medium');
  };

  const handleSubmit = () => {
    onSubmit({
      goodPoint: goodPoint.trim() || '첫 블록을 시작한 점',
      derailReason: derailReason.trim() || '특별히 큰 방해는 없었어요.',
      keepOneThing: keepOneThing.trim() || '첫 블록 먼저 시작하기',
      changeOneThing: changeOneThing.trim() || '내일 첫 블록 진입 속도 올리기',
      mood,
      energy,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88svh] rounded-t-[2rem] border-x-0 border-b-0 px-5 pb-6 pt-10 sm:max-w-none">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-[1.4rem] font-black tracking-[-0.04em] text-[#17326B]">하루 마감 회고</SheetTitle>
          <SheetDescription className="text-[13px] font-semibold leading-6 text-[#64779D]">
            길게 쓰지 않아도 괜찮아요. 오늘을 한 번 돌아보고 내일 이어질 한 가지를 남기면 충분합니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 overflow-y-auto pb-2">
          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">오늘 잘 된 점</p>
            <Textarea value={goodPoint} onChange={(event) => setGoodPoint(event.target.value)} placeholder="예: 수학 첫 블록을 미루지 않고 시작했다." />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">가장 밀린 이유</p>
            <Textarea value={derailReason} onChange={(event) => setDerailReason(event.target.value)} placeholder="예: 저녁에 피곤해서 마지막 블록이 흔들렸다." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">내일 유지할 것 1개</p>
              <Input value={keepOneThing} onChange={(event) => setKeepOneThing(event.target.value)} placeholder="예: 첫 블록 25분 바로 시작" />
            </div>
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">내일 바꿀 것 1개</p>
              <Input value={changeOneThing} onChange={(event) => setChangeOneThing(event.target.value)} placeholder="예: 밤 블록은 복습으로 낮추기" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">기분</p>
              <div className="flex flex-wrap gap-2">
                {moodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMood(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-xs font-black transition-all',
                      mood === option.value
                        ? 'border-[rgba(255,138,31,0.35)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-white'
                        : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">에너지</p>
              <div className="flex flex-wrap gap-2">
                {energyOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEnergy(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-2 text-xs font-black transition-all',
                      energy === option.value
                        ? 'border-[rgba(20,41,95,0.35)] bg-[#17326B] text-white'
                        : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
            <p className="text-[12px] font-semibold leading-6 text-[#5F7597]">
              오늘 기록한 회고는 주간 요약에 이어지고, 다음 추천 루틴을 다듬는 기준으로도 활용됩니다.
            </p>
          </div>
        </div>

        <SheetFooter className="mt-6 flex-col gap-3 sm:flex-col sm:space-x-0">
          <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={handleSubmit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            오늘 회고 저장
          </Button>
          <Button variant="default" size="lg" className="h-12 rounded-[1rem]" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
