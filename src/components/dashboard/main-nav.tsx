
'use client';

import Link from 'next/link';
import {
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Trophy,
  Users,
  BarChart3,
  Loader2,
  CalendarDays,
  Zap,
  MessageCircle,
  GraduationCap,
  Armchair,
  FileText,
  History,
  DollarSign,
  MonitorSmartphone,
  UserCog,
  Monitor
} from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

type MainNavProps = {
  isMobile?: boolean;
};

const navItems: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  student: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/growth', label: '성장트랙', icon: Zap },
    { href: '/dashboard/study-history', label: '기록트랙', icon: CalendarDays },
    { href: '/dashboard/plan', label: '계획트랙', icon: ClipboardCheck },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
  ],
  teacher: [
    { href: '/dashboard/teacher', label: '실시간 관제', icon: Monitor },
    { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
    { href: '/dashboard/reports', label: '데일리 리포트', icon: FileText },
    { href: '/dashboard/teacher/students', label: '학생 관리', icon: GraduationCap },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
  ],
  parent: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/study-history', label: '기록트랙', icon: History },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
  ],
  centerAdmin: [
    { href: '/dashboard', label: '운영 홈', icon: LayoutDashboard },
    { href: '/dashboard/teacher', label: '실시간 현황', icon: Monitor },
    { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
    { href: '/dashboard/reports', label: '데일리 리포트', icon: FileText },
    { href: '/dashboard/teacher/students', label: '학생 관리', icon: GraduationCap },
    { href: '/dashboard/settings/students', label: '학생 계정 관리', icon: UserCog },
    { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
    { href: '/dashboard/revenue', label: '비즈니스 분석', icon: DollarSign },
    { href: '/dashboard/settings/invites', label: '초대 코드', icon: Settings },
  ],
};

export function MainNav({ isMobile = false }: MainNavProps) {
  const { activeMembership, currentTier } = useAppContext();
  const pathname = usePathname();
  
  if (!activeMembership) {
      return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const userRole = activeMembership.role;
  const userNavItems = navItems[userRole] || [];
  const isStudent = userRole === 'student';
  
  const navClass = cn(
    'flex-1 items-start px-4 text-sm font-medium pt-8',
    isMobile ? 'grid gap-6 text-lg' : 'flex flex-col gap-2'
  );
  
  const linkClass = cn(
    'flex items-center gap-4 rounded-2xl px-4 py-3 text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-primary/5 active:scale-95 group',
    isMobile ? 'text-lg' : ''
  );
  
  return (
    <nav className={navClass}>
      <Link
        href="/dashboard"
        className="flex items-center gap-3 text-2xl font-black text-primary mb-10 px-2 tracking-tighter"
      >
        <div className="bg-primary p-2 rounded-xl">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <span>트랙학습센터</span>
      </Link>
      {userNavItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link 
            key={item.href} 
            href={item.href} 
            className={cn(
              linkClass, 
              isActive && (isStudent ? `bg-gradient-to-br ${currentTier.gradient} text-white shadow-xl` : 'bg-primary text-primary-foreground shadow-xl')
            )}
          >
            <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
            <span className="font-bold">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
