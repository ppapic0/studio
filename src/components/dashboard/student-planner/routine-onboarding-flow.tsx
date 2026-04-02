'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft } from 'lucide-react';

import {
  ONBOARDING_BRIDGE_COPY,
  ONBOARDING_SURVEY_COPY,
} from '@/components/dashboard/student-planner/onboarding-copy';
import { OnboardingIntroScreen } from '@/components/dashboard/student-planner/onboarding-intro-screen';
import { OnboardingProgressHeader } from '@/components/dashboard/student-planner/onboarding-progress-header';
import {
  applySingleOptionPatch,
  ONBOARDING_QUESTIONS,
  toggleMultiQuestionValue,
  type OnboardingQuestionConfig,
  type OnboardingQuestionOption,
} from '@/components/dashboard/student-planner/onboarding-questions';
import { RecommendationLoadingScreen } from '@/components/dashboard/student-planner/recommendation-loading-screen';
import { SavePlanSuccessScreen } from '@/components/dashboard/student-planner/save-plan-success-screen';
import { StudyPlanQuestionCard } from '@/components/dashboard/student-planner/study-plan-question-card';
import { Button } from '@/components/ui/button';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { createDefaultOnboardingAnswers, generateRoutineRecommendationSet } from '@/lib/recommend-routine';
import { estimateRemainingTime, getSectionLabel } from '@/lib/study-plan/estimate-remaining-time';
import { type OnboardingAnswer, type UserStudyProfile } from '@/lib/types';

type RoutineOnboardingFlowProps = {
  studentName?: string;
  onSaveRoutineProfile: (profile: UserStudyProfile) => Promise<void>;
  onContinueToPlanner: () => void;
  onSkipForNow?: () => Promise<void> | void;
  allowSkip?: boolean;
  autoContinueOnSave?: boolean;
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
  allowSkip = true,
  autoContinueOnSave = false,
}: RoutineOnboardingFlowProps) {
  const [phase, setPhase] = useState<'intro' | 'survey' | 'loading' | 'saved'>('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswer>(() => createDefaultOnboardingAnswers());
  const [selectionState, setSelectionState] = useState<QuestionSelectionState>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasTriggeredLoadingSaveRef = useRef(false);

  const recommendationResult = useMemo(() => generateRoutineRecommendationSet(answers), [answers]);

  useEffect(() => {
    if (phase !== 'loading') {
      hasTriggeredLoadingSaveRef.current = false;
      return;
    }
    if (hasTriggeredLoadingSaveRef.current) return;
    hasTriggeredLoadingSaveRef.current = true;

    if (phase !== 'loading') return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        const primaryRoutine = recommendationResult.recommendations[0];
        const matchedArchetype =
          recommendationResult.matchedArchetypes.find((entry) => entry.archetype.id === primaryRoutine?.archetypeId)?.archetype ||
          recommendationResult.matchedArchetypes[0]?.archetype;

        if (!primaryRoutine || !matchedArchetype) {
          setPhase('survey');
          return;
        }

        const profile: UserStudyProfile = {
          version: 1,
          planningMode: 'feedback-coach',
          answers,
          archetypeId: matchedArchetype.id,
          archetypeName: matchedArchetype.name,
          recommendedRoutines: recommendationResult.recommendations,
          selectedRoutineId: primaryRoutine.id,
          selectedRoutine: primaryRoutine,
          sharingPreference: 'private',
        };

        setIsSavingProfile(true);
        setSaveError(null);
        try {
          await onSaveRoutineProfile(profile);
          if (!cancelled) {
            if (autoContinueOnSave) {
              onContinueToPlanner();
            } else {
              setPhase('saved');
            }
          }
        } catch (error) {
          logHandledClientIssue('[routine-onboarding] save profile failed', error);
          if (!cancelled) {
            setSaveError('기준 저장 중 문제가 있었어요. 다시 한 번 눌러주세요.');
            setPhase('survey');
          }
        } finally {
          if (!cancelled) {
            setIsSavingProfile(false);
          }
        }
      })();
    }, 1100);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [answers, autoContinueOnSave, onContinueToPlanner, onSaveRoutineProfile, phase, recommendationResult]);

  const currentQuestion = ONBOARDING_QUESTIONS[stepIndex];
  const currentSelectedLabels =
    currentQuestion.type === 'multi' && Array.isArray(selectionState[currentQuestion.id])
      ? currentQuestion.options
          .filter((option) => selectionState[currentQuestion.id]?.includes(option.id))
          .map((option) => option.label)
      : [];
  const bridgeMessage = getBridgeMessage(stepIndex);
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
    setSaveError(null);
    if (stepIndex === ONBOARDING_QUESTIONS.length - 1) {
      setPhase('loading');
      return;
    }
    setStepIndex((previous) => previous + 1);
  };

  const handleSkip = () => {
    setSaveError(null);
    if (stepIndex === ONBOARDING_QUESTIONS.length - 1) {
      setPhase('loading');
      return;
    }
    setStepIndex((previous) => previous + 1);
  };

  const handleSkipForNow = async () => {
    if (!onSkipForNow) return;
    setIsSkipping(true);
    try {
      await onSkipForNow();
    } finally {
      setIsSkipping(false);
    }
  };

  if (phase === 'intro') {
    return (
      <OnboardingIntroScreen
        onStart={() => setPhase('survey')}
        onSkip={() => void handleSkipForNow()}
        isSkipping={isSkipping}
        allowSkip={allowSkip}
      />
    );
  }

  if (phase === 'loading') {
    return <RecommendationLoadingScreen />;
  }

  if (phase === 'saved') {
    return (
      <SavePlanSuccessScreen
        onContinue={onContinueToPlanner}
        onBackToResults={() => setPhase('survey')}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
      <OnboardingProgressHeader meta={progressMeta} />

      {saveError ? (
        <div className="rounded-[1.2rem] border border-[rgba(255,138,31,0.18)] bg-[linear-gradient(180deg,rgba(255,247,236,0.98)_0%,rgba(255,242,228,0.94)_100%)] px-4 py-3">
          <p className="text-[13px] font-bold leading-6 text-[#17326B]">{saveError}</p>
        </div>
      ) : null}

      {bridgeMessage ? (
        <div className="rounded-[1.35rem] border border-[rgba(255,138,31,0.12)] bg-[linear-gradient(180deg,rgba(255,248,239,0.95)_0%,rgba(255,244,234,0.9)_100%)] px-4 py-4">
          <p className="text-[13px] font-bold leading-6 text-[#17326B]">{bridgeMessage}</p>
        </div>
      ) : null}

      <StudyPlanQuestionCard
        question={currentQuestion}
        selectedValue={selectionState[currentQuestion.id]}
        selectedLabels={currentSelectedLabels}
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
