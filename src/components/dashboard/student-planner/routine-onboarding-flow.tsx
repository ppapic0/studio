'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, Loader2, Sparkles, Target } from 'lucide-react';

import {
  ONBOARDING_BRIDGE_COPY,
  ONBOARDING_LOADING_COPY,
  ONBOARDING_RESULTS_COPY,
  ONBOARDING_SAVED_COPY,
  ONBOARDING_START_COPY,
  ONBOARDING_SURVEY_COPY,
} from '@/components/dashboard/student-planner/onboarding-copy';
import {
  applySingleOptionPatch,
  getSelectedLabels,
  ONBOARDING_QUESTIONS,
  toggleMultiQuestionValue,
  type OnboardingQuestionConfig,
  type OnboardingQuestionOption,
} from '@/components/dashboard/student-planner/onboarding-questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  createDefaultOnboardingAnswers,
  customizeRecommendedRoutine,
  generateRoutineRecommendationSet,
  SUBJECT_OPTIONS,
  type RoutineCustomizationDraft,
} from '@/lib/recommend-routine';
import {
  type OnboardingAnswer,
  type RecommendedRoutine,
  type UserStudyProfile,
} from '@/lib/types';

type RoutineOnboardingFlowProps = {
  studentName?: string;
  onSaveRoutineProfile: (profile: UserStudyProfile, selectedRoutine: RecommendedRoutine) => Promise<void>;
  onContinueToPlanner: () => void;
};

type QuestionSelectionState = Record<string, string | string[]>;

function SurveyOptionCard({
  label,
  description,
  active,
  onClick,
  compact = false,
}: {
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all duration-200',
        compact ? 'min-h-[78px]' : 'min-h-[98px]',
        active
          ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,rgba(255,246,236,1)_0%,rgba(255,236,213,0.98)_100%)] shadow-[0_18px_34px_-24px_rgba(255,138,31,0.48)]'
          : 'border-[rgba(20,41,95,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.98)_100%)] hover:border-[rgba(255,138,31,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(255,248,239,0.9)_100%)]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[15px] font-black leading-6 tracking-[-0.02em] text-[#17326B]">{label}</p>
          {description ? <p className="text-[12px] font-semibold leading-5 text-[#5F7597]">{description}</p> : null}
        </div>
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

function getBridgeMessage(stepIndex: number) {
  if (stepIndex >= 10) return ONBOARDING_BRIDGE_COPY.final;
  if (stepIndex >= 5) return ONBOARDING_BRIDGE_COPY.middle;
  if (stepIndex >= 2) return ONBOARDING_BRIDGE_COPY.early;
  return null;
}

function getRoutineBadgeLabel(routine: RecommendedRoutine, index: number) {
  if (index === 0) return ONBOARDING_RESULTS_COPY.badgeLabels.primary;
  if (routine.archetypeId === 'exam-sprint') return ONBOARDING_RESULTS_COPY.badgeLabels.exam;
  if (routine.archetypeId === 'weak-subject-recovery' || routine.archetypeId === 'concept-rebuild') {
    return ONBOARDING_RESULTS_COPY.badgeLabels.weakSubject;
  }
  if (routine.archetypeId === 'routine-reset' || routine.difficulty === 'easy') {
    return ONBOARDING_RESULTS_COPY.badgeLabels.resilient;
  }
  return ONBOARDING_RESULTS_COPY.badgeLabels.easy;
}

function renderQuestionOptions(
  question: OnboardingQuestionConfig,
  selectionState: QuestionSelectionState,
  answers: OnboardingAnswer,
  onSingleSelect: (questionKey: string, option: OnboardingQuestionOption) => void,
  onMultiToggle: (
    question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
    option: OnboardingQuestionOption
  ) => void
) {
  if (question.type === 'multi') {
    const selectedIds = Array.isArray(selectionState[question.id]) ? selectionState[question.id] : [];
    const selectedLabels =
      selectedIds.length > 0
        ? question.options.filter((option) => selectedIds.includes(option.id)).map((option) => option.label)
        : getSelectedLabels(question, answers);
    return (
      <div className="space-y-4">
        {selectedLabels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedLabels.map((label) => (
              <SelectedChip key={label} label={label} />
            ))}
          </div>
        ) : null}
        <div className="rounded-[1.1rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-3">
          <p className="text-[12px] font-semibold leading-5 text-[#5F7597]">최대 {question.maxSelect}개까지 선택할 수 있어요.</p>
        </div>
        <div className="grid gap-3">
          {question.options.map((option) => (
            <SurveyOptionCard
              key={option.id}
              label={option.label}
              active={selectedIds.includes(option.id)}
              onClick={() => onMultiToggle(question, option)}
              compact
            />
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'dual') {
    return (
      <div className="space-y-4">
        {question.subQuestions.map((subQuestion) => (
          <div key={subQuestion.id} className="space-y-3 rounded-[1.35rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] p-4">
            <div className="space-y-1">
              <p className="text-[15px] font-black tracking-[-0.02em] text-[#17326B]">{subQuestion.title}</p>
              {subQuestion.helperText ? (
                <p className="text-[12px] font-semibold leading-5 text-[#5F7597]">{subQuestion.helperText}</p>
              ) : null}
            </div>
            <div className="grid gap-3">
              {subQuestion.options.map((option) => (
                <SurveyOptionCard
                  key={option.id}
                  label={option.label}
                  active={selectionState[subQuestion.id] === option.id}
                  onClick={() => onSingleSelect(subQuestion.id, option)}
                  compact
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {question.options.map((option) => (
        <SurveyOptionCard
          key={option.id}
          label={option.label}
          active={selectionState[question.id] === option.id}
          onClick={() => onSingleSelect(question.id, option)}
          compact
        />
      ))}
    </div>
  );
}

export function RoutineOnboardingFlow({
  studentName: _studentName,
  onSaveRoutineProfile,
  onContinueToPlanner,
}: RoutineOnboardingFlowProps) {
  const [phase, setPhase] = useState<'intro' | 'survey' | 'loading' | 'results' | 'saved'>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer>(() => createDefaultOnboardingAnswers());
  const [selectionState, setSelectionState] = useState<QuestionSelectionState>({});
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineDrafts, setRoutineDrafts] = useState<Record<string, RoutineCustomizationDraft>>({});
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const recommendationResult = useMemo(() => generateRoutineRecommendationSet(answers), [answers]);
  const routines = useMemo(
    () =>
      recommendationResult.recommendations.map((routine) =>
        routineDrafts[routine.id]
          ? customizeRecommendedRoutine(routine, answers, routineDrafts[routine.id])
          : routine
      ),
    [answers, recommendationResult.recommendations, routineDrafts]
  );

  useEffect(() => {
    if (phase !== 'loading') return;
    const timer = window.setTimeout(() => {
      setSelectedRoutineId((current) => current || routines[0]?.id || null);
      setPhase('results');
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [phase, routines]);

  useEffect(() => {
    if (phase === 'results' && !selectedRoutineId && routines[0]) {
      setSelectedRoutineId(routines[0].id);
    }
  }, [phase, routines, selectedRoutineId]);

  const currentQuestion = ONBOARDING_QUESTIONS[stepIndex];
  const surveyProgress = ((stepIndex + 1) / ONBOARDING_QUESTIONS.length) * 100;
  const bridgeMessage = getBridgeMessage(stepIndex);
  const canGoNext =
    currentQuestion.type === 'multi'
      ? Array.isArray(selectionState[currentQuestion.id]) && selectionState[currentQuestion.id].length > 0
      : currentQuestion.type === 'dual'
        ? currentQuestion.subQuestions.every((subQuestion) => typeof selectionState[subQuestion.id] === 'string')
        : typeof selectionState[currentQuestion.id] === 'string';
  const selectedRoutine = routines.find((routine) => routine.id === selectedRoutineId) || routines[0];

  const handleSingleSelect = (questionKey: string, option: OnboardingQuestionOption) => {
    setSelectionState((previous) => ({
      ...previous,
      [questionKey]: option.id,
    }));
    setAnswers((previous) => applySingleOptionPatch(previous, option));
  };

  const handleMultiToggle = (
    question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
    option: OnboardingQuestionOption
  ) => {
    setSelectionState((previous) => {
      const rawSelection = previous[question.id];
      const currentSelection = (Array.isArray(rawSelection) ? rawSelection : []) as string[];
      if (option.exclusive) {
        return {
          ...previous,
          [question.id]: currentSelection.includes(option.id) ? [] : [option.id],
        };
      }

      const withoutExclusive = currentSelection.filter((selectedId: string) => {
        const selectedOption = question.options.find((candidate) => candidate.id === selectedId);
        return !selectedOption?.exclusive;
      });
      const nextSelection = withoutExclusive.includes(option.id)
        ? withoutExclusive.filter((selectedId: string) => selectedId !== option.id)
        : [...withoutExclusive, option.id].slice(0, question.maxSelect);

      return {
        ...previous,
        [question.id]: nextSelection,
      };
    });
    setAnswers((previous) => toggleMultiQuestionValue(previous, question, option));
  };

  const handleNext = () => {
    if (stepIndex === ONBOARDING_QUESTIONS.length - 1) {
      setPhase('loading');
      return;
    }
    setStepIndex((previous) => previous + 1);
  };

  const handleSkip = () => {
    if (stepIndex === ONBOARDING_QUESTIONS.length - 1) {
      setPhase('loading');
      return;
    }
    setStepIndex((previous) => previous + 1);
  };

  const updateRoutineDraft = (routineId: string, patch: Partial<RoutineCustomizationDraft>) => {
    setRoutineDrafts((previous) => ({
      ...previous,
      [routineId]: {
        ...previous[routineId],
        ...patch,
      },
    }));
  };

  const handleSaveRoutine = async (routine: RecommendedRoutine) => {
    const matchedArchetype =
      recommendationResult.matchedArchetypes.find((entry) => entry.archetype.id === routine.archetypeId)?.archetype ||
      recommendationResult.matchedArchetypes[0]?.archetype;
    if (!matchedArchetype) return;

    const profile: UserStudyProfile = {
      version: 1,
      answers,
      archetypeId: matchedArchetype.id,
      archetypeName: matchedArchetype.name,
      recommendedRoutines: routines,
      selectedRoutineId: routine.id,
      selectedRoutine: routine,
      sharingPreference: answers.sharingPreference,
    };

    setIsSaving(true);
    try {
      await onSaveRoutineProfile(profile, routine);
      setSelectedRoutineId(routine.id);
      setPhase('saved');
    } finally {
      setIsSaving(false);
    }
  };

  if (phase === 'intro') {
    return (
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
        <Card variant="primary" className="rounded-[2rem] overflow-hidden">
          <CardContent className="space-y-6 p-7">
            <div className="space-y-3">
              <h1 className="text-[2rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">{ONBOARDING_START_COPY.title}</h1>
              <p className="whitespace-pre-line text-[15px] font-semibold leading-7 text-[var(--text-on-dark)]">
                {ONBOARDING_START_COPY.subtitle}
              </p>
              <p className="whitespace-pre-line text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                {ONBOARDING_START_COPY.description}
              </p>
            </div>

            <div className="grid gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="h-14 rounded-[1.2rem] text-[15px]"
                onClick={() => setPhase('survey')}
              >
                {ONBOARDING_START_COPY.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="dark"
                size="lg"
                className="h-12 rounded-[1.1rem]"
                onClick={() => setPhase('loading')}
              >
                {ONBOARDING_START_COPY.secondaryCta}
              </Button>
            </div>

            <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-4 py-4">
              <p className="text-[12px] font-bold text-[var(--text-on-dark-soft)]">{ONBOARDING_START_COPY.footnote}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-8">
        <Card variant="primary" className="rounded-[2rem]">
          <CardContent className="space-y-5 p-7">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/14 bg-white/10 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div className="space-y-3">
              <h2 className="text-[1.8rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">{ONBOARDING_LOADING_COPY.title}</h2>
              {ONBOARDING_LOADING_COPY.lines.map((line) => (
                <p key={line} className="whitespace-pre-line text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                  {line}
                </p>
              ))}
            </div>
            <Progress value={78} className="h-2.5 bg-white/12" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === 'survey') {
    return (
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
        <Card variant="primary" className="rounded-[2rem]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-on-dark-muted)]">
                  {ONBOARDING_SURVEY_COPY.progressLabel}
                </p>
                <h2 className="text-[1.55rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">{currentQuestion.title}</h2>
                <p className="text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">{currentQuestion.description}</p>
              </div>
              <Badge variant="dark" className="h-fit px-3 py-1.5 text-[11px]">
                {stepIndex + 1} / {ONBOARDING_QUESTIONS.length}
              </Badge>
            </div>
            <Progress value={surveyProgress} className="h-2.5 bg-white/12" />
          </CardContent>
        </Card>

        {bridgeMessage ? (
          <div className="rounded-[1.35rem] border border-[rgba(255,138,31,0.12)] bg-[linear-gradient(180deg,rgba(255,248,239,0.95)_0%,rgba(255,244,234,0.9)_100%)] px-4 py-4">
            <p className="text-[13px] font-bold leading-6 text-[#17326B]">{bridgeMessage}</p>
          </div>
        ) : null}

        <Card variant="light" className="rounded-[1.9rem]">
          <CardContent key={currentQuestion.id} className="space-y-5 p-6">
            <div className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] px-4 py-4">
              <p className="text-[12px] font-semibold leading-6 text-[#5F7597]">{currentQuestion.helperText || ONBOARDING_SURVEY_COPY.helperText}</p>
            </div>

            {renderQuestionOptions(currentQuestion, selectionState, answers, handleSingleSelect, handleMultiToggle)}
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.15fr]">
          <Button
            variant="default"
            size="lg"
            className="h-12 rounded-[1rem]"
            onClick={() => {
              if (stepIndex === 0) {
                setPhase('intro');
                return;
              }
              setStepIndex((previous) => previous - 1);
            }}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {ONBOARDING_SURVEY_COPY.previousCta}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-12 rounded-[1rem]"
            onClick={handleSkip}
          >
            {ONBOARDING_SURVEY_COPY.skipCta}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-12 rounded-[1rem]"
            onClick={handleNext}
            disabled={!canGoNext}
          >
            {stepIndex === ONBOARDING_QUESTIONS.length - 1
              ? ONBOARDING_SURVEY_COPY.submitCta
              : ONBOARDING_SURVEY_COPY.nextCta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'saved' && selectedRoutine) {
    return (
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
        <Card variant="highlight" className="rounded-[2rem]">
          <CardContent className="space-y-5 p-7">
            <div className="space-y-2">
              <h2 className="text-[1.9rem] font-black tracking-[-0.05em] text-white">{ONBOARDING_SAVED_COPY.title}</h2>
              <p className="text-[14px] font-semibold leading-7 text-white/88">{ONBOARDING_SAVED_COPY.subtitle}</p>
            </div>
            <div className="rounded-[1.45rem] border border-white/24 bg-white/10 p-4">
              <p className="text-[1.35rem] font-black tracking-[-0.03em] text-white">{selectedRoutine.name}</p>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-white/84">{selectedRoutine.oneLineDescription}</p>
            </div>
            <div className="grid gap-3">
              <Button variant="dark" size="lg" className="h-13 rounded-[1.15rem] border-white/20 bg-white text-[#17326B] hover:bg-white/92" onClick={onContinueToPlanner}>
                {ONBOARDING_SAVED_COPY.primaryCta}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" size="lg" className="h-12 rounded-[1rem] border border-white/18 bg-white/10 text-white hover:bg-white/14" onClick={() => setPhase('results')}>
                {ONBOARDING_SAVED_COPY.secondaryCta}
              </Button>
            </div>
            <p className="text-[12px] font-semibold text-white/76">{ONBOARDING_SAVED_COPY.footnote}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="text-[1.7rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">{ONBOARDING_RESULTS_COPY.title}</h2>
              <p className="whitespace-pre-line text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                {ONBOARDING_RESULTS_COPY.subtitle}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border border-white/12 bg-white/8 text-white hover:bg-white/14"
              onClick={() => setPhase('survey')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {routines.map((routine, index) => {
          const isEditing = editingRoutineId === routine.id;
          const routineDraft = routineDrafts[routine.id] || {};
          const focusSubjectCandidates = answers.difficultSubjects
            .filter((subjectId) => !['none', 'assignment'].includes(subjectId))
            .map((subjectId) => SUBJECT_OPTIONS.find((item) => item.id === subjectId))
            .filter((subject): subject is NonNullable<typeof subject> => Boolean(subject));

          return (
            <Card key={routine.id} variant={index === 0 ? 'highlight' : 'light'} className="rounded-[1.9rem]">
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{getRoutineBadgeLabel(routine, index)}</Badge>
                    <Badge variant="outline">{routine.difficultyLabel}</Badge>
                  </div>
                  <h3 className="text-[1.42rem] font-black tracking-[-0.04em] text-[#17326B]">{routine.name}</h3>
                  <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">{routine.oneLineDescription}</p>
                </div>

                <div className="grid gap-4">
                  <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/78 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{ONBOARDING_RESULTS_COPY.reasonLabel}</p>
                    <div className="mt-3 space-y-2">
                      {routine.recommendationReasons.map((reason) => (
                        <div key={reason} className="flex gap-3 rounded-[1rem] bg-[#F8FBFF] px-3 py-3">
                          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A1F]" />
                          <p className="text-[12px] font-semibold leading-5 text-[#17326B]">{reason}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/78 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{ONBOARDING_RESULTS_COPY.dayPreviewLabel}</p>
                    <div className="mt-3 space-y-2">
                      {routine.studyBlocks.slice(0, 4).map((block) => (
                        <div key={block.id} className="flex gap-3 rounded-[1rem] bg-[#F8FBFF] px-3 py-3">
                          <p className="min-w-[72px] text-[12px] font-black text-[#D86A11]">{block.startTime}</p>
                          <div className="min-w-0">
                            <p className="text-[13px] font-black text-[#17326B]">{block.title}</p>
                            <p className="text-[12px] font-semibold leading-5 text-[#5F7597]">{block.instruction}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/78 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{ONBOARDING_RESULTS_COPY.fitLabel}</p>
                      <p className="mt-3 text-[12px] font-semibold leading-6 text-[#17326B]">{routine.fitStudent}</p>
                    </section>
                    <section className="rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">{ONBOARDING_RESULTS_COPY.downgradeLabel}</p>
                      <div className="mt-3 space-y-2">
                        {routine.downgradeVersion.map((item) => (
                          <p key={item} className="text-[12px] font-semibold leading-5 text-[#17326B]">{item}</p>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                {isEditing ? (
                  <div className="rounded-[1.3rem] border border-[rgba(255,138,31,0.18)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,246,236,0.98)_100%)] p-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-[#FF8A1F]" />
                      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">{ONBOARDING_RESULTS_COPY.secondaryCta}</p>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="space-y-2">
                        <p className="text-[12px] font-black text-[#17326B]">첫 블록 시작 시간</p>
                        <div className="flex flex-wrap gap-2">
                          {[routine.studyBlocks[0]?.startTime, '06:30', '16:30', '19:30', '22:00']
                            .filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index)
                            .map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => updateRoutineDraft(routine.id, { startTime: time })}
                                className={cn(
                                  'rounded-full border px-3 py-2 text-xs font-black transition-all',
                                  (routineDraft.startTime || routine.studyBlocks[0]?.startTime) === time
                                    ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                                    : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                                )}
                              >
                                {time}
                              </button>
                            ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[12px] font-black text-[#17326B]">세션 길이</p>
                        <div className="flex flex-wrap gap-2">
                          {[30, 50, 80].map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => updateRoutineDraft(routine.id, { sessionLength: minute as 30 | 50 | 80 })}
                              className={cn(
                                'rounded-full border px-3 py-2 text-xs font-black transition-all',
                                (routineDraft.sessionLength || routine.studyBlocks[1]?.durationMinutes || 50) === minute
                                  ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                                  : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                              )}
                            >
                              {minute}분
                            </button>
                          ))}
                        </div>
                      </div>
                      {focusSubjectCandidates.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-[12px] font-black text-[#17326B]">우선 과목</p>
                          <div className="flex flex-wrap gap-2">
                            {focusSubjectCandidates.map((subject) => (
                              <button
                                key={subject.id}
                                type="button"
                                onClick={() => updateRoutineDraft(routine.id, { prioritySubject: subject.id })}
                                className={cn(
                                  'rounded-full border px-3 py-2 text-xs font-black transition-all',
                                  (routineDraft.prioritySubject || routine.studyBlocks.find((block) => block.subjectId)?.subjectId) === subject.id
                                    ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                                    : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                                )}
                              >
                                {subject.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-12 rounded-[1rem]"
                    onClick={() => {
                      setSelectedRoutineId(routine.id);
                      void handleSaveRoutine(routine);
                    }}
                    disabled={isSaving}
                  >
                    {isSaving && selectedRoutineId === routine.id ? '저장 중...' : ONBOARDING_RESULTS_COPY.primaryCta}
                  </Button>
                  <Button
                    variant="default"
                    size="lg"
                    className="h-12 rounded-[1rem]"
                    onClick={() =>
                      setEditingRoutineId((previous) => (previous === routine.id ? null : routine.id))
                    }
                  >
                    {ONBOARDING_RESULTS_COPY.secondaryCta}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
