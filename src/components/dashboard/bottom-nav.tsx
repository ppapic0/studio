'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  DollarSign,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Monitor,
  MonitorSmartphone,
  Zap,
} from 'lucide-react';

import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const { activeMembership, currentTier, viewMode } = useAppContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobileMode = viewMode === 'mobile';

  if (!activeMembership) return null;

  const role = activeMembership.role;
  const isParent = role === 'parent';
  const activeParentTab = searchParams.get('parentTab') || 'home';
  const useBrandNav = isParent || isMobileMode;

  const navItems: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '성장', icon: Zap },
      { href: '/dashboard/study-history', label: '기록', icon: CalendarDays },
      { href: '/dashboard/plan', label: '계획', icon: CalendarDays },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    teacher: [
      { href: '/dashboard/teacher', label: '교실', icon: Monitor },
      { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/leads', label: '리드DB', icon: Megaphone },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    parent: [
      { href: '/dashboard?parentTab=home', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard?parentTab=studyDetail', label: '학습', icon: History },
      { href: '/dashboard?parentTab=data', label: '데이터', icon: FileText },
      { href: '/dashboard?parentTab=communication', label: '소통', icon: MessageCircle },
      { href: '/dashboard?parentTab=billing', label: '수납', icon: DollarSign },
    ],
    centerAdmin: [
      { href: '/dashboard', label: '운영', icon: LayoutDashboard },
      { href: '/dashboard/teacher', label: '교실', icon: Monitor },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/leads', label: '리드DB', icon: Megaphone },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
  };

  const currentNav = navItems[role] || [];

  return (
    <div
      className={cn(
        'z-50 transition-all duration-300',
        useBrandNav
          ? 'h-[5.8rem] rounded-t-[1.75rem] border-x border-t border-[#223a71] bg-[linear-gradient(180deg,#14295F_0%,#0e1f49_100%)] px-1 pb-[calc(env(safe-area-inset-bottom)+0.38rem)] shadow-[0_-16px_32px_rgba(10,20,52,0.46)]'
          : 'h-20 border-t border-black/[0.06] bg-white/95 pb-6 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl',
        isMobileMode ? 'relative' : 'fixed bottom-0 left-0 right-0 md:hidden'
      )}
    >
      <nav
        className={cn(
          'h-full',
          isParent
            ? 'grid grid-cols-5 gap-0.5 px-1.5 pt-1'
            : useBrandNav
              ? 'grid gap-1 px-2 pt-1.5'
              : 'flex items-center justify-around px-2'
        )}
        style={!isParent && useBrandNav ? { gridTemplateColumns: `repeat(${Math.max(currentNav.length, 1)}, minmax(0, 1fr))` } : undefined}
      >
        {currentNav.map((item) => {
          const [itemPath, itemQuery] = item.href.split('?');
          const isParentQueryItem = role === 'parent' && !!itemQuery;

          const isActive = isParentQueryItem
            ? pathname === itemPath && activeParentTab === new URLSearchParams(itemQuery).get('parentTab')
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center rounded-2xl transition-all active:scale-95',
                isParent ? 'h-full gap-0.5' : 'h-full min-w-[52px] gap-1 group',
                useBrandNav
                  ? isActive
                    ? 'text-[#FFD7AE]'
                    : 'text-white/65'
                  : isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/40'
              )}
            >
              <div
                className={cn(
                  'rounded-xl transition-all',
                  isParent ? 'p-1.5' : 'p-2',
                  isActive
                    ? useBrandNav
                      ? 'bg-[#FF7A16] text-[#14295F] shadow-[0_6px_14px_rgba(255,122,22,0.45)]'
                      : `bg-gradient-to-br ${currentTier.gradient} text-white shadow-lg`
                    : useBrandNav
                      ? 'bg-white/10 text-white/85'
                      : 'group-hover:bg-muted/50'
                )}
              >
                <item.icon
                  className={cn(
                    isParent ? 'h-4 w-4' : 'h-5 w-5',
                    'transition-all duration-300',
                    isActive ? 'stroke-[2.4px] scale-110' : 'stroke-[2px]'
                  )}
                />
              </div>

              <span
                className={cn(
                  'font-black tracking-tight transition-all duration-300 whitespace-nowrap',
                  isParent ? 'text-[12px] leading-tight px-0.5 text-center' : 'text-[10px]',
                  isActive ? 'opacity-100' : 'opacity-45'
                )}
              >
                {item.label}
              </span>

              {isActive && useBrandNav && <div className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#FF7A16]" />}
              {isActive && !useBrandNav && (
                <div
                  className={cn(
                    'absolute top-0 h-1 w-8 rounded-full animate-in fade-in slide-in-from-top-1',
                    `bg-gradient-to-r ${currentTier.gradient}`
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {isMobileMode && (
        <div
          className={cn(
            'absolute bottom-1.5 left-1/2 h-1.5 w-32 -translate-x-1/2 rounded-full',
            useBrandNav ? 'bg-white/25' : 'bg-black/10'
          )}
        />
      )}
    </div>
  );
}
