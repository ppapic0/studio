'use client';

import { Loader2 } from 'lucide-react';

import { ONBOARDING_LOADING_COPY } from '@/components/dashboard/student-planner/onboarding-copy';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function RecommendationLoadingScreen() {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-8">
      <Card variant="primary" className="rounded-[2rem]">
        <CardContent className="space-y-5 p-7">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/14 bg-white/10 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-3">
            <h2 className="text-[1.8rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
              {ONBOARDING_LOADING_COPY.title}
            </h2>
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
