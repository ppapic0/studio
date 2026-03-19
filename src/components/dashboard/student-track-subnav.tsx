'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, FileText } from 'lucide-react';
import type { ElementType } from 'react';

import { cn } from '@/lib/utils';

type TrackItem = {
  href: '/dashboard/study-history' | '/dashboard/analysis';
  label: string;
  icon: ElementType;
};

const TRACK_ITEMS: TrackItem[] = [
  { href: '/dashboard/study-history', label: '기록트랙', icon: CalendarDays },
  { href: '/dashboard/analysis', label: '분석트랙', icon: FileText },
];

export function StudentTrackSubnav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-2 rounded-2xl border border-primary/15 bg-white/90 p-1.5 shadow-sm',
        className
      )}
    >
      {TRACK_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black tracking-tight transition-all',
              isActive
                ? 'bg-primary text-white shadow-md'
                : 'text-primary/70 hover:bg-primary/5 hover:text-primary'
            )}
          >
            <item.icon className="h-3.5 w-3.5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
