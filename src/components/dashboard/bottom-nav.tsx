'use client';

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
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
  Wallet,
} from 'lucide-react';

import { useAppContext } from '@/contexts/app-context';
import {
  DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS,
  PARENT_POST_LOGIN_ENTRY_MOTION_KEY,
  getStudentDashboardRouteKey,
} from '@/lib/dashboard-motion';
import { cn } from '@/lib/utils';

type BottomNavProps = {
  playStudentEntry?: boolean;
};

export function BottomNav({ playStudentEntry = false }: BottomNavProps) {
  const { activeMembership, currentTier, viewMode } = useAppContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobileMode = viewMode === 'mobile';
  const [playParentEntry, setPlayParentEntry] = useState(false);
  const role = activeMembership?.role;
  const isParent = role === 'parent';
  const isStudent = role === 'student';
  const activeParentTab = searchParams.get('parentTab') || 'home';
  const useBrandNav = isParent || isMobileMode;
  const activeStudentRouteKey = useMemo(
    () => (isStudent ? getStudentDashboardRouteKey(pathname) : null),
    [isStudent, pathname]
  );

  const adminNavItems = [
    { href: '/dashboard', label: '운영', icon: LayoutDashboard },
    { href: '/dashboard/teacher', label: '교실', icon: Monitor },
    { href: '/dashboard/reports', label: '리포트', icon: FileText },
    { href: '/dashboard/leads', label: '리드DB', icon: Megaphone },
    { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
    { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
  ] as const;

  useEffect(() => {
    if (!isParent || typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);
    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS) {
      return;
    }

    setPlayParentEntry(true);
    const timer = window.setTimeout(() => setPlayParentEntry(false), 1400);
    return () => window.clearTimeout(timer);
  }, [isParent]);

  if (!activeMembership || !role) return null;

  const navItems: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '포인트', icon: Wallet },
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
      { href: '/dashboard?parentTab=data', label: '학습분석', icon: FileText },
      { href: '/dashboard?parentTab=communication', label: '소통', icon: MessageCircle },
      { href: '/dashboard?parentTab=billing', label: '수납', icon: DollarSign },
    ],
    centerAdmin: [...adminNavItems],
    owner: [...adminNavItems],
  };

  const currentNav = navItems[role] || [];
  const activeStudentIndex = isStudent
    ? currentNav.findIndex((item) => getStudentDashboardRouteKey(item.href) === activeStudentRouteKey)
    : -1;

  const studentIndicatorStyle =
    activeStudentIndex >= 0
      ? ({
          '--student-nav-count': currentNav.length,
          '--student-nav-index': activeStudentIndex,
        } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        'z-50 transition-all duration-300',
        useBrandNav
          ? isParent
            ? 'h-[5.9rem] rounded-t-[1.6rem] border-x border-t border-[#223a71] bg-[linear-gradient(180deg,#163267_0%,#14295F_56%,#0e1f49_100%)] px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] shadow-[0_-16px_32px_rgba(10,20,52,0.44)] sm:h-[6.05rem]'
            : 'h-[6.35rem] rounded-t-[1.75rem] border-x border-t border-[#223a71] bg-[linear-gradient(180deg,#14295F_0%,#0e1f49_100%)] px-1.5 pb-[calc(env(safe-area-inset-bottom)+0.48rem)] shadow-[0_-16px_32px_rgba(10,20,52,0.46)]'
          : 'h-20 border-t border-black/[0.06] bg-white/95 pb-6 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-2xl',
        isParent || isMobileMode ? 'relative' : 'fixed bottom-0 left-0 right-0 md:hidden',
        playParentEntry && 'parent-nav-enter parent-entry-delay-5',
        playStudentEntry && isStudent && 'student-nav-enter student-entry-delay-5'
      )}
    >
      <nav
        className={cn(
          'relative h-full',
          isParent
            ? 'grid grid-cols-5 gap-0.5 px-1 pt-1.5'
            : useBrandNav
              ? 'grid gap-1 px-2.5 pt-2'
              : 'flex items-center justify-around px-2'
        )}
        style={!isParent && useBrandNav ? { gridTemplateColumns: `repeat(${Math.max(currentNav.length, 1)}, minmax(0, 1fr))` } : undefined}
      >
        {isStudent && useBrandNav && activeStudentIndex >= 0 && (
          <div className="student-nav-active-indicator" style={studentIndicatorStyle} aria-hidden="true" />
        )}

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
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center rounded-2xl transition-all active:scale-95',
                isParent
                  ? 'h-full justify-start gap-1 px-0.5 pt-2.5 pb-2.5'
                  : useBrandNav
                    ? 'h-full min-w-[52px] justify-start gap-1.5 px-1 pt-2.5 pb-3 group'
                    : 'h-full justify-center gap-1 group',
                useBrandNav
                  ? isActive
                    ? 'text-[#FFE6CB]'
                    : 'text-white/82'
                  : isActive
                    ? 'text-primary'
                    : 'text-muted-foreground/40'
              )}
            >
              <div
                className={cn(
                  'rounded-xl transition-all',
                  isParent ? 'p-[0.36rem] sm:p-[0.42rem]' : useBrandNav ? 'p-2.5' : 'p-2',
                  isActive
                    ? useBrandNav
                      ? isParent
                        ? 'bg-[linear-gradient(180deg,#fffaf3_0%,#ffe4c3_100%)] text-[#FF7A16] shadow-[0_16px_24px_rgba(255,122,22,0.24)] ring-1 ring-[#ffcf9f]'
                        : 'bg-[#FF7A16] text-[#14295F] shadow-[0_10px_18px_rgba(255,122,22,0.40)]'
                      : `bg-gradient-to-br ${currentTier.gradient} text-white shadow-lg`
                    : useBrandNav
                      ? isParent
                        ? 'bg-white/10 text-white/86 ring-1 ring-white/8'
                        : 'bg-white/10 text-white/90'
                      : 'group-hover:bg-muted/50'
                )}
              >
                <item.icon
                  className={cn(
                    isParent ? 'h-[0.9rem] w-[0.9rem] sm:h-[0.98rem] sm:w-[0.98rem]' : 'h-5 w-5',
                    'transition-all duration-300',
                    isActive ? 'stroke-[2.4px] scale-110' : 'stroke-[2px]'
                  )}
                />
              </div>

              <span
                className={cn(
                  'font-black tracking-tight transition-all duration-300 whitespace-nowrap leading-none',
                  isParent ? 'px-0.5 text-center text-[10.4px] sm:text-[10.9px]' : useBrandNav ? 'text-[10.8px]' : 'text-[10px]',
                  useBrandNav
                    ? isActive
                      ? 'text-white opacity-100'
                      : isParent
                        ? 'text-white/82'
                        : 'text-white opacity-90'
                    : isActive
                      ? 'opacity-100'
                      : 'opacity-45'
                )}
              >
                {item.label}
              </span>

              {isActive && useBrandNav && <div className={cn('absolute bottom-[0.78rem] h-1.5 w-1.5 rounded-full', isParent ? 'bg-[#FF7A16]' : 'bg-[#FF7A16]')} />}
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
            'absolute bottom-1 left-1/2 h-1.5 w-32 -translate-x-1/2 rounded-full',
            useBrandNav ? 'bg-white/25' : 'bg-black/10'
          )}
        />
      )}
    </div>
  );
}
