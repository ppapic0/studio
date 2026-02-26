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
    { href: '/dashboard/study-history', label: '학습 기록', icon: CalendarDays },
    { href: '/dashboard/plan', label: '나의 학습 계획', icon: ClipboardCheck },
    { href: '/dashboard/leaderboards', label: '리더보드', icon: Trophy },
  ],
  parent: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/leaderboards', label: '리더보드', icon: Trophy },
  ],
  teacher: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/attendance', label: '출석', icon: Users },
    { href: '/dashboard/leaderboards', label: '리더보드', icon: Trophy },
  ],
  centerAdmin: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/dashboard/attendance', label: '출석', icon: Users },
    { href: '/dashboard/analytics', label: '센터 분석', icon: BarChart3 },
    { href: '/dashboard/settings/invites', label: '초대 코드', icon: Settings },
  ],
};

export function MainNav({ isMobile = false }: MainNavProps) {
  const { activeMembership } = useAppContext();
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
  
  const navClass = cn(
    'flex-1 items-start px-4 text-sm font-medium pt-8',
    isMobile ? 'grid gap-6 text-lg' : 'flex flex-col gap-2'
  );
  
  const linkClass = cn(
    'flex items-center gap-4 rounded-2xl px-4 py-3 text-muted-foreground transition-all duration-300 hover:text-primary hover:bg-primary/5 active:scale-95 group',
    isMobile ? 'text-lg' : ''
  );
  
  const activeLinkClass = 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-lg shadow-primary/20';

  return (
    <nav className={navClass}>
      <Link
        href="/dashboard"
        className="flex items-center gap-3 text-2xl font-black text-primary mb-10 px-2 tracking-tighter"
      >
        <div className="bg-primary p-2 rounded-xl">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <span>공부트랙</span>
      </Link>
      {userNavItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href} 
          className={cn(linkClass, pathname === item.href ? activeLinkClass : '')}
        >
          <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", pathname === item.href ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
          <span className="font-bold">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}