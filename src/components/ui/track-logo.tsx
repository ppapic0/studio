'use client';

import { cn } from '@/lib/utils';

export function TrackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={cn('h-12 w-auto', className)}
      role="img"
      aria-label="트랙 학습센터 로고"
    >
      <title>트랙 학습센터 로고</title>
      
      {/* 트랙 심볼 (상단) */}
      <g transform="translate(200, 140)">
        {/* 바깥쪽 오렌지 트랙 */}
        <path
          d="M 6 -50 H 45 A 50 50 0 0 1 45 50 H -45 A 50 50 0 0 1 -45 -50 H -6"
          fill="none"
          stroke="#FF7A16"
          strokeWidth="28"
          strokeLinecap="butt"
        />
        {/* 안쪽 네이비 라인 */}
        <path
          d="M 6 -50 H 45 A 50 50 0 0 1 45 50 H -45 A 50 50 0 0 1 -45 -50 H -6"
          fill="none"
          stroke="#14295F"
          strokeWidth="6"
          strokeLinecap="butt"
        />
      </g>

      {/* 로고 텍스트 (하단) */}
      <text
        x="200"
        y="320"
        textAnchor="middle"
        fill="#14295F"
        style={{
          fontWeight: 900,
          fontSize: '62px',
          fontFamily: "Pretendard, 'Noto Sans KR', sans-serif",
          letterSpacing: '-3px'
        }}
      >
        트랙 학습센터
      </text>
    </svg>
  );
}
