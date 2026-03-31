'use client';

import { useEffect, useMemo, useState } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';

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
import { type DailyRoutineBlock } from '@/lib/types';
import { cn } from '@/lib/utils';

type RoutineBlockSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block?: DailyRoutineBlock | null;
  onSave: (block: Omit<DailyRoutineBlock, 'id' | 'sequence' | 'done'>) => void;
  onDelete?: (blockId: string) => void;
};

const subjectOptions = ['국어', '수학', '영어', '사탐', '과탐', '한국사', '기타'];
const studyTypeOptions: Array<{ value: DailyRoutineBlock['studyType']; label: string }> = [
  { value: 'concept', label: '개념' },
  { value: 'problem-solving', label: '문풀' },
  { value: 'memorization', label: '암기' },
  { value: 'review', label: '복습' },
  { value: 'warmup', label: '시작' },
  { value: 'recovery', label: '회복' },
];

export function RoutineBlockSheet({
  open,
  onOpenChange,
  block,
  onSave,
  onDelete,
}: RoutineBlockSheetProps) {
  const [title, setTitle] = useState('');
  const [subjectLabel, setSubjectLabel] = useState('기타');
  const [studyType, setStudyType] = useState<DailyRoutineBlock['studyType']>('concept');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('50');
  const [instruction, setInstruction] = useState('');
  const [fallbackInstruction, setFallbackInstruction] = useState('');

  useEffect(() => {
    if (!block) {
      setTitle('');
      setSubjectLabel('기타');
      setStudyType('concept');
      setStartTime('');
      setDurationMinutes('50');
      setInstruction('');
      setFallbackInstruction('');
      return;
    }
    setTitle(block.title);
    setSubjectLabel(block.subjectLabel || '기타');
    setStudyType(block.studyType);
    setStartTime(block.startTime || '');
    setDurationMinutes(String(block.durationMinutes));
    setInstruction(block.instruction);
    setFallbackInstruction(block.fallbackInstruction || '');
  }, [block, open]);

  const studyTypeLabel = useMemo(
    () => studyTypeOptions.find((option) => option.value === studyType)?.label || '개념',
    [studyType]
  );

  const handleSubmit = () => {
    onSave({
      title: title.trim() || `${subjectLabel} ${studyTypeLabel} 블록`,
      subjectId: undefined,
      subjectLabel,
      studyType,
      studyTypeLabel,
      startTime: startTime.trim() || undefined,
      durationMinutes: Math.max(10, Number(durationMinutes) || 30),
      rewardLabel: `+${Math.max(2, Math.round((Number(durationMinutes) || 30) / 15))}P`,
      feedbackMessage: block?.feedbackMessage || `${subjectLabel} 흐름을 유지하는 블록`,
      instruction: instruction.trim() || '추천 루틴을 내 상황에 맞게 조정한 블록입니다.',
      fallbackInstruction: fallbackInstruction.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[88svh] rounded-t-[2rem] border-x-0 border-b-0 px-5 pb-6 pt-10 sm:max-w-none">
        <SheetHeader className="space-y-2">
          <SheetTitle className="text-[1.35rem] font-black tracking-[-0.04em] text-[#17326B]">
            {block ? '공부 블록 수정' : '공부 블록 추가'}
          </SheetTitle>
          <SheetDescription className="text-[13px] font-semibold leading-6 text-[#64779D]">
            추천값은 유지하되, 오늘 내 상황에 맞게 블록 강도와 시작 시간을 부드럽게 조정할 수 있어요.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5 overflow-y-auto pb-2">
          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">블록 이름</p>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 수학 문제풀이 50분" />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">과목</p>
            <div className="flex flex-wrap gap-2">
              {subjectOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSubjectLabel(option)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-black transition-all',
                    subjectLabel === option
                      ? 'border-[rgba(255,138,31,0.35)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-white'
                      : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">공부 유형</p>
            <div className="flex flex-wrap gap-2">
              {studyTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStudyType(option.value)}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-black transition-all',
                    studyType === option.value
                      ? 'border-[rgba(20,41,95,0.35)] bg-[#17326B] text-white'
                      : 'border-[rgba(20,41,95,0.12)] bg-white text-[#17326B]'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">시작 시간</p>
              <Input value={startTime} onChange={(event) => setStartTime(event.target.value)} placeholder="예: 19:30" />
            </div>
            <div className="space-y-2">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">세션 길이</p>
              <Input value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="50" />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">이 블록에서 할 일</p>
            <Input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="예: 기출 세트 1개 + 오답 표시" />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">흔들릴 때 대체 규칙</p>
            <Input value={fallbackInstruction} onChange={(event) => setFallbackInstruction(event.target.value)} placeholder="예: 힘들면 쉬운 유형 3문제만 하고 마감" />
          </div>
        </div>

        <SheetFooter className="mt-6 flex-col gap-3 sm:flex-col sm:space-x-0">
          <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={handleSubmit}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {block ? '이 블록 저장' : '블록 추가'}
          </Button>
          {block && onDelete ? (
            <Button
              variant="default"
              size="lg"
              className="h-12 rounded-[1rem] border-[rgba(241,93,114,0.2)] text-[#C33A59]"
              onClick={() => {
                onDelete(block.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              블록 삭제
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
