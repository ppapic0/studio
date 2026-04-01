'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

import { PlannerProgressHeader } from '@/features/planner/components/PlannerProgressHeader';
import { QuestionCard } from '@/features/planner/components/QuestionCard';
import { RadarScoreCard } from '@/features/planner/components/RadarScoreCard';
import { InsightCard } from '@/features/planner/components/InsightCard';
import { WeeklyTodoCard } from '@/features/planner/components/WeeklyTodoCard';
import { PLANNER_INTRO_COPY, PLANNER_LOADING_COPY, PLANNER_RESULT_COPY } from '@/features/planner/config/plannerCopy';
import { PLANNER_BLOCK_TITLES, PLANNER_QUESTIONS, PLANNER_TOTAL_QUESTION_COUNT } from '@/features/planner/config/plannerQuestions';
import { buildPlannerInsights } from '@/features/planner/lib/buildPlannerInsights';
import { callGenerateStudyPlan } from '@/features/planner/lib/callGenerateStudyPlan';
import { deriveSchedulePrefill } from '@/features/planner/lib/deriveSchedulePrefill';
import { scorePlannerDiagnosis } from '@/features/planner/lib/scorePlannerDiagnosis';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/app-context';
import { useFirestore, useFunctions, useUser } from '@/firebase';
import type { GeneratedStudyPlan, StudyPlannerAnswers, StudyPlannerDiagnosticResult } from '@/lib/types';
import { cn } from '@/lib/utils';

type PlannerDiagnosisPageProps = {
  studentName?: string;
};

function getInitialAnswers(): Partial<StudyPlannerAnswers> {
  return {
    subjectGrades: {},
    topTimeSubjects: [],
    studyActivities: [],
    burnoutReasons: [],
  };
}

function estimateRemainingLabel(currentIndex: number) {
  const remaining = PLANNER_TOTAL_QUESTION_COUNT - (currentIndex + 1);
  if (remaining <= 2) return '약 30초 남음';
  if (remaining <= 5) return '약 1분 남음';
  return '약 2분 남음';
}

function getBlockDescription(block: string) {
  if (block === 'A') return '학습 맥락과 목표를 먼저 파악하고 있어요.';
  if (block === 'B') return '평소 계획과 점검 습관을 살펴보고 있어요.';
  if (block === 'C') return '과목 투자와 활동 방식의 균형을 보고 있어요.';
  return '동기와 번아웃 신호를 함께 정리하고 있어요.';
}

function isQuestionAnswered(question: (typeof PLANNER_QUESTIONS)[number], answers: Partial<StudyPlannerAnswers>) {
  const value = answers[question.id as keyof StudyPlannerAnswers];
  if (question.type === 'multi-select') {
    return Array.isArray(value) && value.length > 0;
  }
  if (question.type === 'subject-grades') return true;
  return typeof value === 'string' && value.length > 0;
}

function normalizeAnswers(answers: Partial<StudyPlannerAnswers>) {
  return answers as StudyPlannerAnswers;
}

export function PlannerDiagnosisPage({ studentName }: PlannerDiagnosisPageProps) {
  const router = useRouter();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';

  const [phase, setPhase] = useState<'intro' | 'questions' | 'loading' | 'result'>('intro');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<StudyPlannerAnswers>>(getInitialAnswers);
  const [result, setResult] = useState<StudyPlannerDiagnosticResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentQuestion = PLANNER_QUESTIONS[questionIndex];

  const progressMeta = useMemo(() => ({
    blockLabel: `블록 ${currentQuestion.block} · ${PLANNER_BLOCK_TITLES[currentQuestion.block]}`,
    stepLabel: `${questionIndex + 1} / ${PLANNER_TOTAL_QUESTION_COUNT}`,
    progress: ((questionIndex + 1) / PLANNER_TOTAL_QUESTION_COUNT) * 100,
    remainingLabel: estimateRemainingLabel(questionIndex),
    sectionLabel: getBlockDescription(currentQuestion.block),
  }), [currentQuestion.block, questionIndex]);

  const buildFallbackResult = useCallback((normalizedAnswers: StudyPlannerAnswers) => {
    const { scores, flags, metrics } = scorePlannerDiagnosis(normalizedAnswers);
    const insights = buildPlannerInsights({ answers: normalizedAnswers, scores, flags });
    const fallbackPlan: GeneratedStudyPlan = {
      weekly_balance: { 국어: 25, 수학: 30, 영어: 20, 탐구: 25 },
      daily_todos: [
        { 과목: '수학', 활동: '오답 원인 다시 쓰고 비슷한 문제 5개 풀기', 시간: 60 },
        { 과목: '국어', 활동: '비문학 2지문 정독 후 핵심 문장 표시하기', 시간: 45 },
        { 과목: '영어', 활동: '틀린 유형 문장 해석 + 단어 점검', 시간: 40 },
        { 과목: '탐구', 활동: '개념 빈칸 회상 후 확인하기', 시간: 40 },
      ],
      coaching_message: '이번 주는 총량을 무리하게 늘리기보다, 효율이 낮은 과목의 활동 방식을 바꾸는 데 먼저 집중해보세요.',
    };

    return {
      scores,
      flags,
      metrics,
      insights,
      generatedPlan: fallbackPlan,
      recommendedWeeklyDays: deriveSchedulePrefill({ answers: normalizedAnswers, flags, generatedPlan: fallbackPlan }).recommendedWeeklyDays,
      recommendedDailyMinutes: deriveSchedulePrefill({ answers: normalizedAnswers, flags, generatedPlan: fallbackPlan }).recommendedDailyStudyMinutes,
      createdAtISO: new Date().toISOString(),
    } satisfies StudyPlannerDiagnosticResult;
  }, []);

  const handleSingleChange = (value: string) => {
    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]: currentQuestion.id === 'planningScore' || currentQuestion.id === 'reflectionScore'
        ? Number(value)
        : value,
    }));
  };

  const handleMultiToggle = (value: string) => {
    setAnswers((previous) => {
      const currentValues = Array.isArray(previous[currentQuestion.id as keyof StudyPlannerAnswers])
        ? ([...(previous[currentQuestion.id as keyof StudyPlannerAnswers] as string[])] as string[])
        : [];
      const exists = currentValues.includes(value);
      const nextValues = exists
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      const limitedValues = currentQuestion.type === 'multi-select' && currentQuestion.maxSelect
        ? nextValues.slice(0, currentQuestion.maxSelect)
        : nextValues;

      return {
        ...previous,
        [currentQuestion.id]: limitedValues,
      };
    });
  };

  const handleSubjectGradeChange = (subject: string, value: number | null) => {
    setAnswers((previous) => ({
      ...previous,
      subjectGrades: {
        ...(previous.subjectGrades || {}),
        [subject]: value,
      },
    }));
  };

  const persistResult = async (nextAnswers: StudyPlannerAnswers, nextResult: StudyPlannerDiagnosticResult) => {
    if (!firestore || !user) return false;

    const diagnosticsRef = collection(firestore, 'users', user.uid, 'plannerDiagnostics');
    const diagnosisDoc = await addDoc(diagnosticsRef, {
      diagnosisId: '',
      createdAt: serverTimestamp(),
      answers: nextAnswers,
      scores: nextResult.scores,
      flags: nextResult.flags,
      generatedPlanRef: format(new Date(), "yyyy-'W'II"),
    });

    await setDoc(doc(firestore, 'users', user.uid, 'plannerDiagnostics', diagnosisDoc.id), {
      diagnosisId: diagnosisDoc.id,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    const weekKey = format(new Date(), "yyyy-'W'II");
    await setDoc(doc(firestore, 'users', user.uid, 'studyPlans', weekKey), {
      weekKey,
      weeklyBalance: nextResult.generatedPlan.weekly_balance,
      dailyTodos: nextResult.generatedPlan.daily_todos,
      coachingMessage: nextResult.generatedPlan.coaching_message,
      sourceDiagnosisId: diagnosisDoc.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (activeMembership?.id) {
      await setDoc(doc(firestore, 'centers', activeMembership.id, 'students', user.uid), {
        studyPlannerDiagnostic: {
          answers: nextAnswers,
          result: nextResult,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      }, { merge: true });
    }
    return true;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setPhase('loading');
    try {
      const normalizedAnswers = normalizeAnswers(answers);
      if (!user) {
        const fallbackResult = buildFallbackResult(normalizedAnswers);
        setResult(fallbackResult);
        setPhase('result');
        return;
      }

      const { scores, flags, metrics } = scorePlannerDiagnosis(normalizedAnswers);
      const insights = buildPlannerInsights({ answers: normalizedAnswers, scores, flags });
      const generatedPlan = functions
        ? await callGenerateStudyPlan({
            functions,
            answers: normalizedAnswers,
            scores,
            flags,
          })
        : buildFallbackResult(normalizedAnswers).generatedPlan;

      const nextResult: StudyPlannerDiagnosticResult = {
        scores,
        flags,
        metrics,
        insights,
        generatedPlan,
        recommendedWeeklyDays: deriveSchedulePrefill({ answers: normalizedAnswers, flags, generatedPlan }).recommendedWeeklyDays,
        recommendedDailyMinutes: deriveSchedulePrefill({ answers: normalizedAnswers, flags, generatedPlan }).recommendedDailyStudyMinutes,
        createdAtISO: new Date().toISOString(),
      };

      await persistResult(normalizedAnswers, nextResult);
      setResult(nextResult);
      setPhase('result');
    } catch (error) {
      console.error('[planner-diagnosis] generate failed', error);
      const normalizedAnswers = normalizeAnswers(answers);
      const nextResult = buildFallbackResult(normalizedAnswers);
      await persistResult(normalizedAnswers, nextResult);
      setResult(nextResult);
      setPhase('result');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrefillSchedule = () => {
    if (!result || !user) return;
    const prefill = deriveSchedulePrefill({
      answers: normalizeAnswers(answers),
      flags: result.flags,
      generatedPlan: result.generatedPlan,
    });
    try {
      window.localStorage.setItem(
        `planner-schedule-prefill:${user.uid}`,
        JSON.stringify({
          ...prefill,
          source: 'planner-diagnostic',
          createdAtISO: new Date().toISOString(),
        })
      );
    } catch (error) {
      console.warn('[planner-diagnosis] schedule prefill cache failed', error);
    }
    router.push('/dashboard/plan?schedulePrefill=1');
  };

  if (phase === 'intro') {
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-20 pt-4">
        <div className="rounded-[2rem] border border-[#DCE6F5] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,255,0.96)_100%)] px-5 py-6 shadow-[0_22px_52px_-38px_rgba(20,41,95,0.18)]">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">학습 플래너</p>
          <h1 className="mt-3 text-[1.9rem] font-black tracking-tight text-[#17326B]">{PLANNER_INTRO_COPY.title}</h1>
          <p className="mt-3 break-keep text-[14px] font-semibold leading-7 text-[#17326B]">
            {studentName ? `${studentName} 학생에게 ` : ''}{PLANNER_INTRO_COPY.subtitle}
          </p>
          <p className="mt-3 break-keep text-[13px] font-semibold leading-6 text-[#5A6F95]">{PLANNER_INTRO_COPY.description}</p>
          <div className="mt-6 grid gap-3">
            <Button variant="secondary" className="h-12 rounded-[1rem] font-black" onClick={() => setPhase('questions')}>
              {PLANNER_INTRO_COPY.primaryCta}
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-[1rem] font-black">
              <Link href="/dashboard/plan">{PLANNER_INTRO_COPY.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4 px-4 pb-20 pt-8">
        <div className="rounded-[2rem] border border-[#DCE6F5] bg-white px-5 py-8 text-center shadow-[0_22px_52px_-38px_rgba(20,41,95,0.18)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF2E4]">
            <Loader2 className="h-7 w-7 animate-spin text-[#FF8A1F]" />
          </div>
          <h2 className="mt-5 text-[1.55rem] font-black tracking-tight text-[#17326B]">{PLANNER_LOADING_COPY.title}</h2>
          <div className="mt-4 space-y-3">
            {PLANNER_LOADING_COPY.lines.map((line) => (
              <p key={line} className="break-keep text-[13px] font-semibold leading-6 text-[#5A6F95]">{line}</p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result' && result) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pb-20 pt-4">
        <div className="rounded-[1.8rem] border border-[#DCE6F5] bg-white px-5 py-5 shadow-[0_18px_42px_-34px_rgba(20,41,95,0.18)]">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#7C8FB5]">진단 결과</p>
          <h1 className="mt-3 text-[1.7rem] font-black tracking-tight text-[#17326B]">{PLANNER_RESULT_COPY.title}</h1>
          <p className="mt-2 break-keep text-[13px] font-semibold leading-6 text-[#5A6F95]">{PLANNER_RESULT_COPY.subtitle}</p>
        </div>

        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[1.1fr_0.9fr]')}>
          <RadarScoreCard metrics={result.metrics} />
          <InsightCard insights={result.insights.slice(0, 3)} />
        </div>

        <WeeklyTodoCard generatedPlan={result.generatedPlan} onPrefillSchedule={handlePrefillSchedule} />

        <div className="grid gap-3 sm:grid-cols-2">
          <Button asChild variant="outline" className="h-12 rounded-[1rem] font-black">
            <Link href="/dashboard/plan">
              <ArrowLeft className="mr-2 h-4 w-4" />
              계획트랙으로 돌아가기
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-12 rounded-[1rem] font-black"
            onClick={() => {
              setQuestionIndex(0);
              setAnswers(getInitialAnswers());
              setResult(null);
              setPhase('questions');
            }}
          >
            {PLANNER_RESULT_COPY.restartCta}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 pb-24 pt-4">
      <PlannerProgressHeader
        blockLabel={progressMeta.blockLabel}
        stepLabel={progressMeta.stepLabel}
        progress={progressMeta.progress}
        remainingLabel={progressMeta.remainingLabel}
        sectionLabel={progressMeta.sectionLabel}
      />

      <QuestionCard
        question={currentQuestion}
        value={answers[currentQuestion.id as keyof StudyPlannerAnswers]}
        onSingleChange={handleSingleChange}
        onMultiToggle={handleMultiToggle}
        onSubjectGradeChange={handleSubjectGradeChange}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1.2fr]">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-[1rem] font-black"
          onClick={() => {
            if (questionIndex === 0) {
              setPhase('intro');
              return;
            }
            setQuestionIndex((previous) => previous - 1);
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          이전
        </Button>
        <Button asChild variant="ghost" className="h-12 rounded-[1rem] font-black text-[#6A7FA4]">
          <Link href="/dashboard/plan">나중에 하기</Link>
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12 rounded-[1rem] font-black"
          disabled={!isQuestionAnswered(currentQuestion, answers) || isGenerating}
          onClick={() => {
            if (questionIndex === PLANNER_TOTAL_QUESTION_COUNT - 1) {
              void handleGenerate();
              return;
            }
            setQuestionIndex((previous) => previous + 1);
          }}
        >
          {questionIndex === PLANNER_TOTAL_QUESTION_COUNT - 1 ? '결과 보기' : '다음'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
