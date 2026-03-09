'use client';

import { cn } from '@/lib/utils';

export function TrackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 220"
      className={cn('h-12 w-auto', className)}
      role="img"
      aria-label={'\uD2B8\uB799\uD559\uC2B5\uC13C\uD130 \uB85C\uACE0'}
    >
      <title>{'\uD2B8\uB799\uD559\uC2B5\uC13C\uD130 \uB85C\uACE0'}</title>
      <rect x="16" y="16" width="488" height="188" rx="94" fill="none" stroke="#FF7A16" strokeWidth="26" />
      <rect x="28" y="28" width="464" height="164" rx="82" fill="none" stroke="#14295F" strokeWidth="6" />
      <rect x="196" y="6" width="30" height="44" fill="#FFFFFF" />
      <text
        x="260"
        y="98"
        textAnchor="middle"
        fill="#14295F"
        fontWeight="800"
        fontSize="64"
        letterSpacing="-3"
        fontFamily="Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
      >
        {'\uD2B8\uB799'}
      </text>
      <text
        x="260"
        y="166"
        textAnchor="middle"
        fill="#14295F"
        fontWeight="800"
        fontSize="74"
        letterSpacing="-4"
        fontFamily="Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
      >
        {'\uD559\uC2B5\uC13C\uD130'}
      </text>
    </svg>
  );
}
