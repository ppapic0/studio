import Link from 'next/link';
import {
  BookOpen,
  ClipboardCheck,
  LayoutDashboard,
  Settings,
  Trophy,
  Users,
  BarChart3
} from 'lucide-react';
import { mockUser } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

type MainNavProps = {
  isMobile?: boolean;
};

const navItems = {
  student: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/plan', label: 'My Plan', icon: ClipboardCheck },
    { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: Trophy },
  ],
  parent: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: Trophy },
  ],
  teacher: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/attendance', label: 'Attendance', icon: Users },
    { href: '/dashboard/leaderboards', label: 'Leaderboards', icon: Trophy },
  ],
  admin: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/attendance', label: 'Attendance', icon: Users },
    { href: '/dashboard/analytics', label: 'Center Analytics', icon: BarChart3 },
    { href: '/dashboard/settings/invites', label: 'Invite Codes', icon: Settings },
  ],
};

export function MainNav({ isMobile = false }: MainNavProps) {
  const userNavItems = navItems[mockUser.role] || [];
  
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
        <Link key={item.href} href={item.href} className={cn(linkClass, item.href === '/dashboard' ? activeLinkClass : '')}>
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
