'use client';

import Link from 'next/link';
import {
  Bell,
  CalendarDays,
  ClipboardCheck,
  DollarSign,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageCircle,
  Monitor,
  MonitorSmartphone,
  Settings,
  Trophy,
  Zap,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

type MainNavProps = {
  isMobile?: boolean;
};

const navItems: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  student: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/growth', label: '성장트랙', icon: Zap },
    { href: '/dashboard/analysis', label: '분석트랙', icon: FileText },
    { href: '/dashboard/study-history', label: '기록트랙', icon: CalendarDays },
    { href: '/dashboard/plan', label: '계획트랙', icon: ClipboardCheck },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
  ],
  teacher: [
    { href: '/dashboard/teacher', label: '실시간 관리', icon: Monitor },
    { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
    { href: '/dashboard/reports', label: '데일리 리포트', icon: FileText },
    { href: '/dashboard/teacher/students', label: '학생 관리', icon: GraduationCap },
    { href: '/dashboard/leads', label: '홍보/상담 리드DB', icon: Megaphone },
    { href: '/dashboard/attendance', label: '출결/요청 확인', icon: ClipboardCheck },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
  ],
  parent: [
    { href: '/dashboard?parentTab=home', label: '홈', icon: LayoutDashboard },
    { href: '/dashboard?parentTab=studyDetail', label: '학습', icon: History },
    { href: '/dashboard?parentTab=data', label: '데이터', icon: FileText },
    { href: '/dashboard?parentTab=communication', label: '소통', icon: MessageCircle },
    { href: '/dashboard?parentTab=billing', label: '수납', icon: DollarSign },
    { href: '/dashboard?parentTab=reports', label: '리포트', icon: FileText },
  ],
  centerAdmin: [
    { href: '/dashboard', label: '운영실', icon: LayoutDashboard },
    { href: '/dashboard/teacher', label: '실시간 교실', icon: Monitor },
    { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
    { href: '/dashboard/reports', label: '데일리 리포트', icon: FileText },
    { href: '/dashboard/teacher/students', label: '학생 관리', icon: GraduationCap },
    { href: '/dashboard/leads', label: '홍보/상담 리드DB', icon: Megaphone },
    { href: '/dashboard/attendance', label: '출결/요청 확인', icon: ClipboardCheck },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
    { href: '/dashboard/revenue', label: '비즈니스 분석', icon: DollarSign },
    { href: '/dashboard/settings/notifications', label: '문자 알림', icon: Bell },
    { href: '/dashboard/settings/invites', label: '초대 코드', icon: Settings },
  ],
};

export function MainNav({ isMobile = false }: MainNavProps) {
  const { activeMembership, currentTier } = useAppContext();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!activeMembership) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const userRole = activeMembership.role;
  const userNavItems = navItems[userRole] || [];

  const isStudent = userRole === 'student';
  const activeParentTab = searchParams.get('parentTab') || 'home';

  const navClass = cn('flex-1 items-start px-3 text-sm font-medium pt-0', isMobile ? 'grid gap-5 text-lg' : 'flex flex-col gap-1');
  const linkClass = cn(
    'relative flex items-center gap-3 rounded-[0.9rem] px-3.5 py-2.5 text-[#5c6e88] transition-all duration-100 ease-out hover:text-[#14295F] hover:bg-[rgba(20,41,95,0.05)] active:scale-[0.98] group overflow-hidden',
    isMobile ? 'text-lg' : ''
  );

  return (
    <nav className={navClass}>
      {userNavItems.map((item) => {
        const [itemPath, itemQuery] = item.href.split('?');
        const isParentQueryItem = userRole === 'parent' && !!itemQuery;

        const isActive = isParentQueryItem
          ? pathname === itemPath && activeParentTab === new URLSearchParams(itemQuery).get('parentTab')
          : pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              linkClass,
              isActive && (
                isStudent
                  ? `bg-gradient-to-r ${currentTier.gradient} text-white shadow-[0_2px_8px_rgba(20,41,95,0.18),0_6px_16px_-4px_rgba(20,41,95,0.14)] hover:text-white hover:bg-transparent`
                  : 'bg-[linear-gradient(135deg,#1e4898,#14295f)] text-white shadow-[0_2px_8px_rgba(20,41,95,0.18),0_6px_16px_-4px_rgba(20,41,95,0.14)] hover:text-white hover:bg-transparent'
              )
            )}
          >
            {/* 좌측 액센트 바 */}
            {isActive && !isStudent && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-white/50" />
            )}
            <item.icon className={cn(
              'h-[1.05rem] w-[1.05rem] flex-shrink-0 transition-all duration-200',
              isActive ? 'text-white' : 'text-[#8a9daf] group-hover:text-[#14295F] group-hover:scale-105'
            )} />
            <span className={cn(
              'whitespace-nowrap truncate',
              isActive ? 'font-bold' : 'font-semibold'
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
