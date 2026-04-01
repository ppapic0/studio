'use client';

import { ChevronDown, SlidersHorizontal, Sparkles, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type RecommendedRoutine } from '@/lib/types';
import { type RoutineCustomizationDraft } from '@/lib/recommend-routine';

type StudyPlanRecommendationCardProps = {
  routine: RecommendedRoutine;
  emphasized?: boolean;
  isEditing: boolean;
  draft: RoutineCustomizationDraft;
  availablePrioritySubjects: Array<{ id: string; label: string }>;
  onToggleEditing: () => void;
  onDraftUpdate: (patch: Partial<RoutineCustomizationDraft>) => void;
  onSelect: () => void;
  isSaving?: boolean;
};

export function StudyPlanRecommendationCard({
  routine,
  emphasized = false,
  isEditing,
  draft,
  availablePrioritySubjects,
  onToggleEditing,
  onDraftUpdate,
  onSelect,
  isSaving = false,
}: StudyPlanRecommendationCardProps) {
  const currentTotalMinutes = draft.totalStudyMinutes || routine.totalStudyMinutes;
  const currentBlockMinutes = draft.mainBlockMinutes || (routine.blockMeta.includes('3시간') ? 180 : routine.blockMeta.includes('2시간 30분') ? 150 : 120);
  const currentBreakMinutes = draft.breakMinutes || (routine.breakMeta.includes('30') ? 30 : 20);

  return (
    <Card variant={emphasized ? 'highlight' : 'light'} className="rounded-[1.9rem]">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{routine.badge}</Badge>
            <Badge variant="outline">{routine.typeMeta}</Badge>
          </div>
          <div className="space-y-2">
            <h3 className="text-[1.42rem] font-black tracking-[-0.04em] text-[#17326B]">{routine.name}</h3>
            <p className="text-[13px] font-semibold leading-6 text-[#5F7597]">{routine.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{routine.totalStudyLabel}</Badge>
            <Badge variant="outline">{routine.blockMeta}</Badge>
            <Badge variant="outline">{routine.breakMeta}</Badge>
            <Badge variant="outline">{routine.typeMeta}</Badge>
          </div>
        </div>

        <div className="grid gap-4">
          <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/82 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{routine.whyTitle}</p>
            <div className="mt-3 space-y-2">
              {routine.whyCopy.map((reason) => (
                <div key={reason} className="flex gap-3 rounded-[1rem] bg-[#F8FBFF] px-3 py-3">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FF8A1F]" />
                  <p className="text-[12px] font-semibold leading-5 text-[#17326B]">{reason}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/82 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{routine.dayPreviewTitle}</p>
            <div className="mt-3 space-y-2">
              {routine.dayPreview.map((item) => (
                <div key={item} className="flex gap-3 rounded-[1rem] bg-[#F8FBFF] px-3 py-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#17326B]" />
                  <p className="text-[12px] font-semibold leading-5 text-[#17326B]">{item}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-3">
            <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-white/82 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{routine.fitTitle}</p>
              <div className="mt-3 space-y-2">
                {routine.fitCopy.map((item) => (
                  <p key={item} className="text-[12px] font-semibold leading-5 text-[#17326B]">
                    {item}
                  </p>
                ))}
              </div>
            </section>
            <section className="rounded-[1.2rem] border border-[rgba(255,138,31,0.16)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,245,232,0.94)_100%)] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#D86A11]">{routine.downgradeTitle}</p>
              <div className="mt-3 space-y-2">
                {routine.downgradeVersion.map((item) => (
                  <p key={item} className="text-[12px] font-semibold leading-5 text-[#17326B]">{item}</p>
                ))}
              </div>
            </section>
            <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{routine.upgradeTitle}</p>
              <div className="mt-3 space-y-2">
                {routine.upgradeVersion.map((item) => (
                  <p key={item} className="text-[12px] font-semibold leading-5 text-[#17326B]">{item}</p>
                ))}
              </div>
            </section>
            <section className="rounded-[1.2rem] border border-[rgba(20,41,95,0.08)] bg-[#F8FBFF] p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8EA2C0]">{routine.ruleTitle}</p>
              <div className="mt-3 space-y-2">
                {routine.ruleCopy.map((item) => (
                  <p key={item} className="text-[12px] font-semibold leading-5 text-[#17326B]">{item}</p>
                ))}
              </div>
            </section>
          </div>
        </div>

        {isEditing ? (
          <div className="rounded-[1.3rem] border border-[rgba(255,138,31,0.18)] bg-[linear-gradient(180deg,rgba(255,251,246,0.98)_0%,rgba(255,246,236,0.98)_100%)] p-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#FF8A1F]" />
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#17326B]">{routine.secondaryCta}</p>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-[12px] font-black text-[#17326B]">총 공부시간</p>
                <div className="flex flex-wrap gap-2">
                  {[480, 600, 720].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => onDraftUpdate({ totalStudyMinutes: minutes })}
                      className={cn(
                        'rounded-full border px-3 py-2 text-xs font-black transition-all',
                        currentTotalMinutes === minutes
                          ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                          : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                      )}
                    >
                      총 {minutes / 60}시간
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-black text-[#17326B]">메인 블록 길이</p>
                <div className="flex flex-wrap gap-2">
                  {[120, 150, 180].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => onDraftUpdate({ mainBlockMinutes: minutes as 120 | 150 | 180 })}
                      className={cn(
                        'rounded-full border px-3 py-2 text-xs font-black transition-all',
                        currentBlockMinutes === minutes
                          ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                          : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                      )}
                    >
                      {minutes === 120 ? '2시간' : minutes === 150 ? '2시간 30분' : '3시간'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-black text-[#17326B]">휴식 길이</p>
                <div className="flex flex-wrap gap-2">
                  {[20, 30].map((minutes) => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => onDraftUpdate({ breakMinutes: minutes as 20 | 30 })}
                      className={cn(
                        'rounded-full border px-3 py-2 text-xs font-black transition-all',
                        currentBreakMinutes === minutes
                          ? 'border-[rgba(255,138,31,0.45)] bg-[linear-gradient(180deg,#ffb45f_0%,#ff8a1f_100%)] text-[#fff7ef]'
                          : 'border-[rgba(20,41,95,0.16)] bg-white text-[#17326B]'
                      )}
                    >
                      휴식 {minutes}분
                    </button>
                  ))}
                </div>
              </div>

              {availablePrioritySubjects.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-black text-[#17326B]">가장 먼저 챙길 과목</p>
                  <div className="flex flex-wrap gap-2">
                    {availablePrioritySubjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => onDraftUpdate({ prioritySubject: subject.id })}
                        className={cn(
                          'rounded-full border px-3 py-2 text-xs font-black transition-all',
                          draft.prioritySubject === subject.id
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
          <Button variant="secondary" size="lg" className="h-12 rounded-[1rem]" onClick={onSelect} disabled={isSaving}>
            {isSaving ? '저장 중...' : routine.primaryCta}
          </Button>
          <Button variant="default" size="lg" className="h-12 rounded-[1rem]" onClick={onToggleEditing}>
            {routine.secondaryCta}
            <ChevronDown className={cn('ml-2 h-4 w-4 transition-transform', isEditing && 'rotate-180')} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
