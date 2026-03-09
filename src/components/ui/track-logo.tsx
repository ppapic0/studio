'use client';

import { cn } from '@/lib/utils';

export function TrackLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 236 134"
      className={cn('h-11 w-auto', className)}
      role="img"
      aria-label={'트랙 심볼 로고'}
    >
      <title>{'트랙 심볼 로고'}</title>
      <rect x="18" y="22" width="200" height="88" rx="44" fill="none" stroke="#FF7A16" strokeWidth="18" />
      <rect x="27" y="31" width="182" height="70" rx="35" fill="none" stroke="#14295F" strokeWidth="5.5" />
      <rect x="104" y="10" width="28" height="30" fill="hsl(var(--background))" />
    </svg>
  );
}
