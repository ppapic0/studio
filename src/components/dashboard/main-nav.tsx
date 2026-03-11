'use client';

import Link from 'next/link';
import {
  Armchair,
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
    { href: '/dashboard?parentTab=life', label: '생활', icon: Armchair },
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
  const { activeMembership, currentTier, viewMode } = useAppContext();
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
  const userNavItems = (navItems[userRole] || []).filter((item) => {
    if (userRole === 'student' && viewMode === 'mobile' && item.href === '/dashboard/analysis') {
      return false;
    }
    return true;
  });

  const isStudent = userRole === 'student';
  const activeParentTab = searchParams.get('parentTab') || 'home';

  const navClass = cn('flex-1 items-start px-4 text-sm font-medium pt-0', isMobile ? 'grid gap-6 text-lg' : 'flex flex-col gap-2');
  const linkClass = cn(
    'flex items-center gap-4 rounded-2xl px-4 py-3 text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-primary/5 active:scale-95 group',
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
            className={cn(linkClass, isActive && (isStudent ? `bg-gradient-to-br ${currentTier.gradient} text-white shadow-xl` : 'bg-primary text-primary-foreground shadow-xl'))}
          >
            <item.icon className={cn('h-5 w-5 transition-transform duration-300 group-hover:scale-110', isActive ? 'text-white' : 'text-muted-foreground group-hover:text-primary')} />
            <span className="font-bold whitespace-nowrap truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
