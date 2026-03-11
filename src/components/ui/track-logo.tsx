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
      src={isMark ? '/track-logo-mark.png' : '/track-logo-full.png'}
      alt={isMark ? '트랙 심볼 로고' : '트랙 로고'}
      className={cn(
        isMark ? 'h-11 w-auto object-contain' : 'h-11 w-auto max-w-[8.75rem] object-contain',
        className
      )}
      loading="eager"
      decoding="async"
    />
  );
}
