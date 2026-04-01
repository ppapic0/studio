'use client';

import { Check, Info } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  PLANNER_GRADE_OPTIONS,
  PLANNER_SUBJECT_GRADE_FIELDS,
  type PlannerQuestionConfig,
} from '@/features/planner/config/plannerQuestions';

type QuestionCardProps = {
  question: PlannerQuestionConfig;
  value: unknown;
  onSingleChange: (value: string) => void;
  onMultiToggle: (value: string) => void;
  onSubjectGradeChange: (subject: string, value: number | null) => void;
};

function SelectCard({
  active,
  label,
  helper,
  onClick,
}: {
  active: boolean;
  label: string;
  helper?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full rounded-[1.25rem] border px-4 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFB347]/55 focus-visible:ring-offset-2',
        active
          ? 'border-[#FF8A1F] bg-[linear-gradient(180deg,rgba(255,243,230,0.96)_0%,rgba(255,235,210,0.96)_100%)] shadow-[0_18px_34px_-28px_rgba(255,138,31,0.55)]'
          : 'border-[#DCE6F5] bg-white hover:border-[#FFCF9D] hover:bg-[#FFF8F1]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-black tracking-tight text-[#17326B]">{label}</p>
          {helper ? <p className="mt-1 text-[12px] font-semibold leading-5 text-[#5D739B]">{helper}</p> : null}
        </div>
        <span
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
            active ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white' : 'border-[#D7E2F3] bg-white text-transparent'
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

export function QuestionCard({
  question,
  value,
  onSingleChange,
  onMultiToggle,
  onSubjectGradeChange,
}: QuestionCardProps) {
  return (
    <div className="rounded-[1.8rem] border border-[#DCE6F5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,255,0.96)_100%)] p-5 shadow-[0_20px_48px_-36px_rgba(20,41,95,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">질문</p>
          <h2 className="mt-2 text-[1.35rem] font-black tracking-tight text-[#17326B]">{question.title}</h2>
          <p className="mt-2 break-keep text-[14px] font-semibold leading-6 text-[#4F658B]">{question.description}</p>
        </div>
        <Badge className="rounded-full border border-[#DCE6F5] bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
          {question.block}
        </Badge>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-[1rem] border border-[#E7EEF9] bg-[#F8FBFF] px-3 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#7C8FB5]" />
        <div>
          <p className="text-[11px] font-black text-[#17326B]">이 질문을 묻는 이유</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-[#6A7FA4]">{question.rationale}</p>
        </div>
      </div>

      {question.type === 'subject-grades' ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {PLANNER_SUBJECT_GRADE_FIELDS.map((field) => {
            const currentValue = (value as Record<string, number | null> | undefined)?.[field.key] ?? null;
            return (
              <div key={field.key} className="rounded-[1.15rem] border border-[#DCE6F5] bg-white px-3 py-3">
                <p className="text-[11px] font-black text-[#17326B]">{field.label}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {PLANNER_GRADE_OPTIONS.map((option, index) => {
                    const gradeValue = index + 1;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => onSubjectGradeChange(field.key, currentValue === gradeValue ? null : gradeValue)}
                        className={cn(
                          'rounded-xl border px-2 py-2 text-[11px] font-black',
                          currentValue === gradeValue
                            ? 'border-[#FF8A1F] bg-[#FFF2E4] text-[#D86A11]'
                            : 'border-[#DCE6F5] bg-white text-[#5A6F95]'
                        )}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-2 h-8 w-full rounded-xl text-[11px] font-black text-[#6A7FA4]"
                  onClick={() => onSubjectGradeChange(field.key, null)}
                >
                  비워둘게요
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {question.type !== 'subject-grades' ? (
        <div className="mt-5 grid gap-3">
          {question.options.map((option) => {
            const active = question.type === 'multi-select'
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value;

            return (
              <SelectCard
                key={option.value}
                active={active}
                label={option.label}
                helper={option.helper}
                onClick={() => {
                  if (question.type === 'multi-select') {
                    onMultiToggle(option.value);
                    return;
                  }
                  onSingleChange(option.value);
                }}
              />
            );
          })}
        </div>
      ) : null}

      {question.type === 'multi-select' && question.maxSelect ? (
        <p className="mt-4 text-[12px] font-semibold text-[#5D739B]">최대 {question.maxSelect}개까지 선택할 수 있어요.</p>
      ) : null}
    </div>
  );
}
