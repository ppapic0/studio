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
} from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { usePathname } from 'next/navigation';

type MainNavProps = {
  isMobile?: boolean;
};

const navItems: Record<string, { href: string; label: string; icon: React.ElementType }[]> = {
  student: [
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
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
    'flex-1 items-start px-2 text-sm font-medium',
    isMobile ? 'grid gap-6 text-lg' : 'flex flex-col gap-1'
  );
  
  const linkClass = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary',
    isMobile ? 'text-lg' : ''
  );
  
  const activeLinkClass = 'bg-muted text-primary';

  return (
    <nav className={navClass}>
      <Link
        href="/dashboard"
        className="flex items-center gap-2 text-lg font-headline font-semibold text-primary mb-4"
      >
        <BookOpen className="h-6 w-6" />
        <span>LEARNING-LAB</span>
      </Link>
      {userNavItems.map((item) => (
        <Link key={item.href} href={item.href} className={cn(linkClass, pathname === item.href ? activeLinkClass : '')}>
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
