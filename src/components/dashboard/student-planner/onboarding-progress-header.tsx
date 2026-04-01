'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { type OnboardingProgressMeta } from '@/lib/types';

type OnboardingProgressHeaderProps = {
  meta: OnboardingProgressMeta;
};

export function OnboardingProgressHeader({ meta }: OnboardingProgressHeaderProps) {
  return (
    <Card variant="primary" className="rounded-[2rem]">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--text-on-dark-muted)]">
              계획 찾는 중
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[1.45rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
                {meta.currentStep} / {meta.totalSteps}
              </h2>
              <Badge variant="dark" className="px-3 py-1.5 text-[11px]">
                {meta.sectionLabel}
              </Badge>
            </div>
            <p className="text-[12px] font-semibold leading-5 text-[var(--text-on-dark-soft)]">
              {meta.remainingMinutesLabel}
            </p>
          </div>
        </div>
        <Progress value={meta.progressPercent} className="h-2.5 bg-white/12" />
      </CardContent>
    </Card>
  );
}
