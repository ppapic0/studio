'use client';

import { CheckCircle2 } from 'lucide-react';

import {
  type OnboardingQuestionConfig,
  type OnboardingQuestionOption,
} from '@/components/dashboard/student-planner/onboarding-questions';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function QuestionOptionCard({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200',
        active
          ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,rgba(255,246,236,1)_0%,rgba(255,236,213,0.98)_100%)] shadow-[0_18px_34px_-24px_rgba(255,138,31,0.48)]'
          : 'border-[rgba(20,41,95,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.98)_100%)] hover:border-[rgba(255,138,31,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,248,239,0.9)_100%)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-black leading-6 tracking-[-0.02em] text-[#17326B]">{label}</p>
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
            active
              ? 'border-[#FF8A1F] bg-[#FF8A1F] text-white'
              : 'border-[rgba(20,41,95,0.18)] bg-white text-transparent'
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function SelectedChip({ label }: { label: string }) {
  return (
    <div className="rounded-full border border-[rgba(255,138,31,0.25)] bg-[linear-gradient(180deg,#fff4e4_0%,#ffe7ca_100%)] px-3 py-1.5 text-[11px] font-black text-[#D86A11]">
      {label}
    </div>
  );
}

type StudyPlanQuestionCardProps = {
  question: OnboardingQuestionConfig;
  selectedValue: string | string[] | undefined;
  selectedLabels: string[];
  onSingleSelect: (option: OnboardingQuestionOption) => void;
  onMultiToggle: (option: OnboardingQuestionOption) => void;
};

export function StudyPlanQuestionCard({
  question,
  selectedValue,
  selectedLabels,
  onSingleSelect,
  onMultiToggle,
}: StudyPlanQuestionCardProps) {
  return (
    <Card variant="light" className="rounded-[1.9rem]">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{question.section}</p>
          <h3 className="text-[1.4rem] font-black tracking-[-0.04em] text-[#17326B]">{question.title}</h3>
          <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">{question.description}</p>
        </div>

        <div className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
          <p className="text-[12px] font-semibold leading-6 text-[#5F7597]">{question.helperText}</p>
        </div>

        {question.type === 'multi' && selectedLabels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((label) => (
              <SelectedChip key={label} label={label} />
            ))}
          </div>
        ) : null}

        {question.type === 'multi' ? (
          <div className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-3">
            <p className="text-[12px] font-semibold leading-5 text-[#5F7597]">최대 {question.maxSelect}개까지 선택할 수 있어요.</p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {question.options.map((option) => {
            const active = Array.isArray(selectedValue)
              ? selectedValue.includes(option.id)
              : selectedValue === option.id;
            return (
              <QuestionOptionCard
                key={option.id}
                label={option.label}
                active={active}
                onClick={() => (question.type === 'multi' ? onMultiToggle(option) : onSingleSelect(option))}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
