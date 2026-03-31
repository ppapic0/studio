'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, PlusCircle, SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RoutineBlockSheet } from '@/components/dashboard/student-planner/routine-block-sheet';
import { type DailyRoutineBlock, type DailyRoutinePlan } from '@/lib/types';
import { getRoutineProgress } from '@/lib/routine-workspace';
import { cn } from '@/lib/utils';

type RoutineEditorProps = {
  routine: DailyRoutinePlan;
  onBack: () => void;
  onSaveBlock: (block: Omit<DailyRoutineBlock, 'id' | 'sequence' | 'done'>, blockId?: string) => void;
  onDeleteBlock: (blockId: string) => void;
};

export function RoutineEditor({ routine, onBack, onSaveBlock, onDeleteBlock }: RoutineEditorProps) {
  const [selectedBlock, setSelectedBlock] = useState<DailyRoutineBlock | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const progress = useMemo(() => getRoutineProgress(routine), [routine]);

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-2">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-on-dark-muted)]">ROUTINE EDITOR</p>
              <h2 className="text-[1.65rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">추천 루틴 다듬기</h2>
              <p className="text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                처음부터 새로 만드는 게 아니라, 추천 루틴을 내 하루 리듬에 맞게 조금씩 손보는 화면입니다.
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full border border-white/12 bg-white/8 text-white hover:bg-white/12" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-[1.3rem] border border-white/12 bg-white/8 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--text-on-dark-muted)]">현재 루틴</p>
                <p className="mt-2 text-[1.2rem] font-black tracking-[-0.03em] text-[var(--text-on-dark)]">{routine.routineName}</p>
                <p className="mt-1 text-[12px] font-semibold text-[var(--text-on-dark-soft)]">{routine.routineSummary}</p>
              </div>
              <Button variant="secondary" size="sm" className="rounded-full px-4" onClick={() => {
                setSelectedBlock(null);
                setBlockSheetOpen(true);
              }}>
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                블록 추가
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-[12px] font-bold text-[var(--text-on-dark-soft)]">
                <span>총 블록 {routine.blocks.length}개</span>
                <span>{progress.completedBlocks}/{progress.totalBlocks} 완료</span>
              </div>
              <Progress value={progress.percent} className="h-2 bg-white/12" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="light" className="rounded-[1.8rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">BLOCKS</p>
              <p className="mt-1 text-[15px] font-black text-[#17326B]">추천값을 기준으로 블록만 수정</p>
            </div>
            <Button
              variant="default"
              size="sm"
              className="rounded-full px-3"
              onClick={() => setShowAdvanced((previous) => !previous)}
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              {showAdvanced ? '간단히 보기' : '고급 설정'}
            </Button>
          </div>

          <div className="space-y-3">
            {routine.blocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => {
                  setSelectedBlock(block);
                  setBlockSheetOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-[1.2rem] border border-[rgba(20,41,95,0.1)] bg-white px-4 py-4 text-left transition-colors hover:bg-[#F8FBFF]"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[rgba(20,41,95,0.1)] bg-[#F6F8FC] px-2.5 py-1 text-[11px] font-black text-[#17326B]">
                      {block.subjectLabel || '기타'}
                    </span>
                    <span className="rounded-full border border-[rgba(255,138,31,0.18)] bg-[rgba(255,138,31,0.1)] px-2.5 py-1 text-[11px] font-black text-[#D86A11]">
                      {block.studyTypeLabel}
                    </span>
                  </div>
                  <p className="text-[15px] font-black tracking-[-0.02em] text-[#17326B]">{block.title}</p>
                  <p className="text-[12px] font-semibold text-[#5F7597]">
                    {block.startTime ? `${block.startTime} · ` : `${block.sequence}번째 · `}
                    {block.durationMinutes}분
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-[#8EA2C0]" />
              </button>
            ))}
          </div>

          {showAdvanced ? (
            <div className="rounded-[1.25rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] p-4">
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">고급 편집 힌트</p>
              <ul className="mt-3 space-y-2 text-[12px] font-semibold leading-5 text-[#5F7597]">
                <li>과목칩은 다 펼치지 않고, 블록별로 눌러서 필요한 것만 수정하세요.</li>
                <li>새 블록은 많아도 하루 1개만 추가하는 쪽이 유지에 유리합니다.</li>
                <li>시작 시간이 자주 흔들리면 첫 블록만 고정하고 나머지는 순서형으로 두세요.</li>
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <RoutineBlockSheet
        open={blockSheetOpen}
        onOpenChange={setBlockSheetOpen}
        block={selectedBlock}
        onSave={(blockDraft) => onSaveBlock(blockDraft, selectedBlock?.id)}
        onDelete={selectedBlock ? onDeleteBlock : undefined}
      />
    </div>
  );
}
