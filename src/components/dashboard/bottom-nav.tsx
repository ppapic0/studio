'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Armchair,
  Bell,
  CalendarDays,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
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
  const isStudent = role === 'student';
  const activeParentTab = searchParams.get('parentTab') || 'home';

  const navItems: Record<string, { href: string; label: string; icon: any }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '성장', icon: Zap },
      { href: '/dashboard/study-history', label: '기록', icon: CalendarDays },
      { href: '/dashboard/plan', label: '계획', icon: CalendarDays },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    teacher: [
      { href: '/dashboard/teacher', label: '현황', icon: Monitor },
      { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    parent: [
      { href: '/dashboard?parentTab=home', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard?parentTab=reports', label: '리포트', icon: FileText },
      { href: '/dashboard?parentTab=studyDetail', label: '학습', icon: History },
      { href: '/dashboard?parentTab=life', label: '생활', icon: Armchair },
      { href: '/dashboard?parentTab=communication', label: '상담', icon: MessageCircle },
      { href: '/dashboard?parentTab=notifications', label: '알림', icon: Bell },
    ],
    centerAdmin: [
      { href: '/dashboard', label: '운영', icon: LayoutDashboard },
      { href: '/dashboard/teacher', label: '현황', icon: Monitor },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
  };

  const currentNav = navItems[role] || [];

  return (
    <div
      className={cn(
        'z-50 bg-white/90 backdrop-blur-2xl border-t border-black/[0.05] h-20 transition-all duration-500 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]',
        isMobileMode ? 'relative' : 'fixed bottom-0 left-0 right-0 md:hidden'
      )}
    >
      <nav className="flex items-center justify-around h-full px-2">
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
                'flex flex-col items-center justify-center gap-1 min-w-[52px] h-full transition-all active:scale-90 relative group',
                isActive ? 'text-primary' : 'text-muted-foreground/30'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-2xl transition-all duration-500',
                  isActive ? (isStudent ? `bg-gradient-to-br ${currentTier.gradient} text-white shadow-lg` : 'bg-primary text-white shadow-inner') : 'group-hover:bg-muted/50'
                )}
              >
                <item.icon className={cn('h-5 w-5 transition-all duration-500', isActive ? 'stroke-[2.5px] scale-110' : 'stroke-[2px]')} />
              </div>
              <span className={cn('text-[10px] font-black tracking-tighter transition-all duration-300', isActive ? 'text-primary opacity-100' : 'opacity-40')}>{item.label}</span>
              {isActive && <div className={cn('absolute top-0 w-8 h-1 rounded-full animate-in fade-in slide-in-from-top-1', isStudent ? `bg-gradient-to-r ${currentTier.gradient}` : 'bg-primary')} />}
            </Link>
          );
        })}
      </nav>
      {isMobileMode && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-black/10 rounded-full" />}
    </div>
  );
}
