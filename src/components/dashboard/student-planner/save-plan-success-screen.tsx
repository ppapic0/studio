'use client';

import { ArrowRight } from 'lucide-react';

import { ONBOARDING_SAVED_COPY } from '@/components/dashboard/student-planner/onboarding-copy';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
type SavePlanSuccessScreenProps = {
  onContinue: () => void;
  onBackToResults: () => void;
};

export function SavePlanSuccessScreen({
  onContinue,
  onBackToResults,
}: SavePlanSuccessScreenProps) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 px-4 pb-24 pt-3">
      <Card variant="highlight" className="rounded-[2rem]">
        <CardContent className="space-y-5 p-7">
          <div className="space-y-2">
            <h2 className="text-[1.9rem] font-black tracking-[-0.05em] text-white">{ONBOARDING_SAVED_COPY.title}</h2>
            <p className="text-[14px] font-semibold leading-7 text-white/88">{ONBOARDING_SAVED_COPY.subtitle}</p>
          </div>
          <div className="rounded-[1.45rem] border border-white/24 bg-white/10 p-4">
            <p className="text-[1.2rem] font-black tracking-[-0.03em] text-white">이제 직접 쓴 계획을 기준으로 읽어드릴게요</p>
            <p className="mt-2 text-[13px] font-semibold leading-6 text-white/84">
              우선 과목이 빠졌는지, 총량이 너무 가벼운지, 복습이 없는지처럼 매일 계획에서 바로 보완 포인트를 확인할 수 있어요.
            </p>
          </div>
          <div className="grid gap-3">
            <Button
              variant="dark"
              size="lg"
              className="h-13 rounded-[1.15rem] border-white/20 bg-white text-[#17326B] hover:bg-white/92"
              onClick={onContinue}
            >
              {ONBOARDING_SAVED_COPY.primaryCta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-12 rounded-[1rem] border border-white/18 bg-white/10 text-white hover:bg-white/14"
              onClick={onBackToResults}
            >
              {ONBOARDING_SAVED_COPY.secondaryCta}
            </Button>
          </div>
          <p className="text-[12px] font-semibold text-white/76">{ONBOARDING_SAVED_COPY.footnote}</p>
        </CardContent>
      </Card>
    </div>
  );
}
