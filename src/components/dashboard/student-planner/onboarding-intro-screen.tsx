'use client';

import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ONBOARDING_START_COPY } from '@/components/dashboard/student-planner/onboarding-copy';

type OnboardingIntroScreenProps = {
  onStart: () => void;
  onSkip?: () => void;
  isSkipping?: boolean;
  allowSkip?: boolean;
};

export function OnboardingIntroScreen({
  onStart,
  onSkip,
  isSkipping = false,
  allowSkip = true,
}: OnboardingIntroScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-4">
      <Card variant="primary" className="overflow-hidden rounded-[2rem]">
        <CardContent className="space-y-7 p-7">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-on-dark-muted)]">study planning</p>
            <h1 className="text-[2rem] font-black tracking-[-0.05em] text-[var(--text-on-dark)]">
              {ONBOARDING_START_COPY.title}
            </h1>
            <p className="whitespace-pre-line text-[15px] font-semibold leading-7 text-[var(--text-on-dark)]">
              {ONBOARDING_START_COPY.subtitle}
            </p>
            <p className="whitespace-pre-line text-[13px] font-semibold leading-6 text-[var(--text-on-dark-soft)]">
              {ONBOARDING_START_COPY.description}
            </p>
          </div>

          <div className="grid gap-3">
            <Button variant="secondary" size="lg" className="h-14 rounded-[1.2rem] text-[15px]" onClick={onStart}>
              {ONBOARDING_START_COPY.primaryCta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {allowSkip ? (
              <Button
                variant="dark"
                size="lg"
                className="h-12 rounded-[1.1rem]"
                onClick={onSkip}
                disabled={isSkipping}
              >
                {ONBOARDING_START_COPY.secondaryCta}
              </Button>
            ) : null}
          </div>

          <div className="rounded-[1.2rem] border border-white/12 bg-white/8 px-4 py-4">
            <p className="text-[12px] font-bold text-[var(--text-on-dark-soft)]">{ONBOARDING_START_COPY.footnote}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
