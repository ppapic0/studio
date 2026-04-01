'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';

import {
  ONBOARDING_BRIDGE_COPY,
  ONBOARDING_SURVEY_COPY,
} from '@/components/dashboard/student-planner/onboarding-copy';
import { OnboardingIntroScreen } from '@/components/dashboard/student-planner/onboarding-intro-screen';
import { OnboardingProgressHeader } from '@/components/dashboard/student-planner/onboarding-progress-header';
import {
  applySingleOptionPatch,
  getSelectedLabels,
  ONBOARDING_QUESTIONS,
  toggleMultiQuestionValue,
  type OnboardingQuestionConfig,
  type OnboardingQuestionOption,
} from '@/components/dashboard/student-planner/onboarding-questions';
import { RecommendationLoadingScreen } from '@/components/dashboard/student-planner/recommendation-loading-screen';
import { RecommendationResultScreen } from '@/components/dashboard/student-planner/recommendation-result-screen';
import { SavePlanSuccessScreen } from '@/components/dashboard/student-planner/save-plan-success-screen';
import { StudyPlanQuestionCard } from '@/components/dashboard/student-planner/study-plan-question-card';
import { Button } from '@/components/ui/button';
import { createDefaultOnboardingAnswers, customizeRecommendedRoutine, generateRoutineRecommendationSet, getSubjectOption, type RoutineCustomizationDraft } from '@/lib/recommend-routine';
import { estimateRemainingTime, getSectionLabel } from '@/lib/study-plan/estimate-remaining-time';
import { type OnboardingAnswer, type RecommendedRoutine, type UserStudyProfile } from '@/lib/types';

type RoutineOnboardingFlowProps = {
  studentName?: string;
  onSaveRoutineProfile: (profile: UserStudyProfile, selectedRoutine: RecommendedRoutine) => Promise<void>;
  onContinueToPlanner: () => void;
  onSkipForNow: () => Promise<void> | void;
};

type QuestionSelectionState = Record<string, string | string[]>;

function getBridgeMessage(stepIndex: number) {
  if (stepIndex >= ONBOARDING_QUESTIONS.length - 2) return ONBOARDING_BRIDGE_COPY.final;
  if (stepIndex >= 4) return ONBOARDING_BRIDGE_COPY.middle;
  if (stepIndex >= 1) return ONBOARDING_BRIDGE_COPY.early;
  return null;
}

function isQuestionAnswered(question: OnboardingQuestionConfig, selectionState: QuestionSelectionState) {
  if (question.type === 'multi') {
    return Array.isArray(selectionState[question.id]) && selectionState[question.id].length > 0;
  }
  return typeof selectionState[question.id] === 'string';
}

export function RoutineOnboardingFlow({
  studentName: _studentName,
  onSaveRoutineProfile,
  onContinueToPlanner,
  onSkipForNow,
}: RoutineOnboardingFlowProps) {
  const [phase, setPhase] = useState<'intro' | 'survey' | 'loading' | 'results' | 'saved'>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer>(() => createDefaultOnboardingAnswers());
  const [selectionState, setSelectionState] = useState<QuestionSelectionState>({});
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [routineDrafts, setRoutineDrafts] = useState<Record<string, RoutineCustomizationDraft>>({});
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [isSavingRoutineId, setIsSavingRoutineId] = useState<string | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

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

  const currentQuestion = ONBOARDING_QUESTIONS[stepIndex];
  const bridgeMessage = getBridgeMessage(stepIndex);
  const selectedRoutine = routines.find((routine) => routine.id === selectedRoutineId) || routines[0];
  const availablePrioritySubjects = useMemo(() => {
    const candidates = [...answers.subjectPriority, ...answers.weakSubjects.filter((value) => value !== 'none')]
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((value) => getSubjectOption(value))
      .map((subject) => ({ id: subject.id, label: subject.label }));
    return candidates.slice(0, 4);
  }, [answers.subjectPriority, answers.weakSubjects]);

  const progressMeta = {
    currentStep: stepIndex + 1,
    totalSteps: ONBOARDING_QUESTIONS.length,
    progressPercent: ((stepIndex + 1) / ONBOARDING_QUESTIONS.length) * 100,
    remainingMinutesLabel: estimateRemainingTime(stepIndex + 1, ONBOARDING_QUESTIONS.length),
    section: currentQuestion.section,
    sectionLabel: getSectionLabel(currentQuestion.section),
  };

  const handleSingleSelect = (questionId: string, option: OnboardingQuestionOption) => {
    setSelectionState((previous) => ({ ...previous, [questionId]: option.id }));
    setAnswers((previous) => applySingleOptionPatch(previous, option));
  };

  const handleMultiToggle = (
    question: Extract<OnboardingQuestionConfig, { type: 'multi' }>,
    option: OnboardingQuestionOption
  ) => {
    setSelectionState((previous) => {
      const currentValues = (Array.isArray(previous[question.id]) ? previous[question.id] : []) as string[];
      if (option.exclusive) {
        return {
          ...previous,
          [question.id]: currentValues.includes(option.id) ? [] : [option.id],
        };
      }

      const withoutExclusive = currentValues.filter((selectedId: string) => {
        const selectedOption = question.options.find((candidate) => candidate.id === selectedId);
        return !selectedOption?.exclusive;
      });
      const nextValues = withoutExclusive.includes(option.id)
        ? withoutExclusive.filter((selectedId: string) => selectedId !== option.id)
        : [...withoutExclusive, option.id].slice(0, question.maxSelect);

      return {
        ...previous,
        [question.id]: nextValues,
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
      sharingPreference: 'private',
    };

    setIsSavingRoutineId(routine.id);
    try {
      await onSaveRoutineProfile(profile, routine);
      setSelectedRoutineId(routine.id);
      setPhase('saved');
    } finally {
      setIsSavingRoutineId(null);
    }
  };

  const handleSkipForNow = async () => {
    setIsSkipping(true);
    try {
      await onSkipForNow();
    } finally {
      setIsSkipping(false);
    }
  };

  if (phase === 'intro') {
    return <OnboardingIntroScreen onStart={() => setPhase('survey')} onSkip={() => void handleSkipForNow()} isSkipping={isSkipping} />;
  }

  if (phase === 'loading') {
    return <RecommendationLoadingScreen />;
  }

  if (phase === 'saved' && selectedRoutine) {
    return (
      <SavePlanSuccessScreen
        routine={selectedRoutine}
        onContinue={onContinueToPlanner}
        onBackToResults={() => setPhase('results')}
      />
    );
  }

  if (phase === 'results') {
    return (
      <RecommendationResultScreen
        routines={routines}
        editingRoutineId={editingRoutineId}
        routineDrafts={routineDrafts}
        availablePrioritySubjects={availablePrioritySubjects}
        onBack={() => setPhase('survey')}
        onToggleEditing={(routineId) => setEditingRoutineId((previous) => (previous === routineId ? null : routineId))}
        onDraftUpdate={updateRoutineDraft}
        onSelect={(routine) => {
          setSelectedRoutineId(routine.id);
          void handleSaveRoutine(routine);
        }}
        savingRoutineId={isSavingRoutineId}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
      <OnboardingProgressHeader meta={progressMeta} />

      {bridgeMessage ? (
        <div className="rounded-[1.35rem] border border-[rgba(255,138,31,0.12)] bg-[linear-gradient(180deg,rgba(255,248,239,0.95)_0%,rgba(255,244,234,0.9)_100%)] px-4 py-4">
          <p className="text-[13px] font-bold leading-6 text-[#17326B]">{bridgeMessage}</p>
        </div>
      ) : null}

      <StudyPlanQuestionCard
        question={currentQuestion}
        selectedValue={selectionState[currentQuestion.id]}
        selectedLabels={currentQuestion.type === 'multi' ? getSelectedLabels(currentQuestion, answers) : []}
        onSingleSelect={(option) => handleSingleSelect(currentQuestion.id, option)}
        onMultiToggle={(option) => {
          if (currentQuestion.type !== 'multi') return;
          handleMultiToggle(currentQuestion, option);
        }}
      />

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
        <Button variant="outline" size="lg" className="h-12 rounded-[1rem]" onClick={handleSkip}>
          {ONBOARDING_SURVEY_COPY.skipCta}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="h-12 rounded-[1rem]"
          onClick={handleNext}
          disabled={!isQuestionAnswered(currentQuestion, selectionState)}
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
