'use client';

import { ChevronLeft } from 'lucide-react';

import { ONBOARDING_RESULTS_COPY } from '@/components/dashboard/student-planner/onboarding-copy';
import { StudyPlanRecommendationCard } from '@/components/dashboard/student-planner/study-plan-recommendation-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type RecommendedRoutine } from '@/lib/types';
import { type RoutineCustomizationDraft } from '@/lib/recommend-routine';

type RecommendationResultScreenProps = {
  routines: RecommendedRoutine[];
  editingRoutineId: string | null;
  routineDrafts: Record<string, RoutineCustomizationDraft>;
  availablePrioritySubjects: Array<{ id: string; label: string }>;
  onBack: () => void;
  onToggleEditing: (routineId: string) => void;
  onDraftUpdate: (routineId: string, patch: Partial<RoutineCustomizationDraft>) => void;
  onSelect: (routine: RecommendedRoutine) => void;
  savingRoutineId?: string | null;
};

export function RecommendationResultScreen({
  routines,
  editingRoutineId,
  routineDrafts,
  availablePrioritySubjects,
  onBack,
  onToggleEditing,
  onDraftUpdate,
  onSelect,
  savingRoutineId,
}: RecommendationResultScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="text-[1.7rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
                {ONBOARDING_RESULTS_COPY.title}
              </h2>
              <p className="whitespace-pre-line text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
                {ONBOARDING_RESULTS_COPY.subtitle}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-full border border-white/12 bg-white/8 text-white hover:bg-white/14"
              onClick={onBack}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {routines.map((routine, index) => (
          <StudyPlanRecommendationCard
            key={routine.id}
            routine={routine}
            emphasized={index === 0}
            isEditing={editingRoutineId === routine.id}
            draft={routineDrafts[routine.id] || {}}
            availablePrioritySubjects={availablePrioritySubjects}
            onToggleEditing={() => onToggleEditing(routine.id)}
            onDraftUpdate={(patch) => onDraftUpdate(routine.id, patch)}
            onSelect={() => onSelect(routine)}
            isSaving={savingRoutineId === routine.id}
          />
        ))}
      </div>
    </div>
  );
}
