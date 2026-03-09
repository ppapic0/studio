'use client';

import { cn } from '@/lib/utils';

export function TrackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 100"
      className={cn('h-10 w-auto', className)}
      role="img"
      aria-label="트랙 학습센터 심볼"
    >
      <title>트랙 학습센터 심볼</title>
      
      <g transform="translate(70, 50)">
        {/* 바깥쪽 오렌지 트랙 (Stadium Shape) */}
        <path
          d="M 10 -35 H 35 A 35 35 0 0 1 35 35 H -35 A 35 35 0 0 1 -35 -35 H -10"
          fill="none"
          stroke="#FF7A16"
          strokeWidth="22"
          strokeLinecap="round"
        />
        {/* 안쪽 네이비 가이드 라인 */}
        <path
          d="M 10 -35 H 35 A 35 35 0 0 1 35 35 H -35 A 35 35 0 0 1 -35 -35 H -10"
          fill="none"
          stroke="#14295F"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="2 4"
        />
        {/* 중앙 포인트 가이드 */}
        <circle cx="0" cy="0" r="3" fill="#14295F" opacity="0.5" />
      </g>
    </svg>
  );
}
