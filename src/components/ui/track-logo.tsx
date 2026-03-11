'use client';

import { cn } from '@/lib/utils';

type TrackLogoProps = {
  className?: string;
  variant?: 'full' | 'mark';
};

export function TrackLogo({ className, variant = 'full' }: TrackLogoProps) {
  const isMark = variant === 'mark';

  return (
    <img
      src={isMark ? '/track-logo-mark.svg' : '/track-logo-full.svg'}
      alt={isMark ? '트랙 심볼 로고' : '트랙 로고'}
      className={cn('h-11 w-auto', className)}
      loading="eager"
      decoding="async"
    />
  );
}
