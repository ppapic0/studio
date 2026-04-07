'use client';

import { useEffect, useState } from 'react';

import {
  isMarketingTrackingOptedOut,
  setMarketingTrackingOptOut,
} from '@/lib/marketing-tracking-client';
import { cn } from '@/lib/utils';

type MarketingTrackingOptOutButtonProps = {
  theme?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
};

export function MarketingTrackingOptOutButton({
  theme = 'light',
  compact = false,
  className,
}: MarketingTrackingOptOutButtonProps) {
  const [optedOut, setOptedOut] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOptedOut(isMarketingTrackingOptedOut());
    setReady(true);
  }, []);

  function handleToggle() {
    const nextValue = !optedOut;
    setMarketingTrackingOptOut(nextValue);
    setOptedOut(nextValue);
  }

  const buttonClassName =
    theme === 'dark'
      ? 'border-white/15 bg-white/5 text-white/78 hover:border-[#FF7A16]/55 hover:text-white'
      : 'border-[#14295F]/12 bg-white text-[#14295F]/70 hover:border-[#FF7A16]/45 hover:text-[#14295F]';

  return (
    <div className={cn('grid gap-2', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-black transition duration-200 hover:-translate-y-0.5',
          buttonClassName,
        )}
      >
        {ready && optedOut ? '방문 분석 수집 거부 해제' : '방문 분석 수집 거부'}
      </button>
      {compact ? null : (
        <p
          className={cn(
            'text-xs font-semibold leading-6',
            theme === 'dark' ? 'text-white/58' : 'text-[#14295F]/58',
          )}
        >
          {ready && optedOut
            ? '현재 웹 방문 분석 식별 생성과 이벤트 전송이 중지된 상태입니다.'
            : 'first-party 방문 분석 식별값 생성과 이벤트 전송을 중지할 수 있습니다.'}
        </p>
      )}
    </div>
  );
}
