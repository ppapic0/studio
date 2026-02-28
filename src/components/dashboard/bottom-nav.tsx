'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  CalendarDays, 
  ClipboardCheck, 
  MessageCircle,
  GraduationCap,
  Armchair,
  FileText,
  Settings,
  Users
} from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const { activeMembership } = useAppContext();
  const pathname = usePathname();

  if (!activeMembership) return null;

  const role = activeMembership.role;

  const navItems: Record<string, { href: string; label: string; icon: any }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '성장', icon: Zap },
      { href: '/dashboard/study-history', label: '기록', icon: CalendarDays },
      { href: '/dashboard/plan', label: '계획', icon: ClipboardCheck },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    teacher: [
      { href: '/dashboard/teacher', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/layout-view', label: '도면', icon: Armchair },
      { href: '/dashboard/attendance', label: '출석', icon: Users },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    centerAdmin: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/layout-view', label: '도면', icon: Armchair },
      { href: '/dashboard/attendance', label: '출석', icon: Users },
      { href: '/dashboard/settings/invites', label: '설정', icon: Settings },
    ],
  };

  const currentNav = navItems[role] || [];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-border/50 h-16 md:hidden">
      <nav className="flex items-center justify-around h-full px-2">
        {currentNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-w-[60px] h-full transition-all active:scale-90",
                isActive ? "text-primary" : "text-muted-foreground/60"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
              <span className={cn("text-[10px] font-black tracking-tighter", isActive ? "opacity-100" : "opacity-60")}>
                {item.label}
              </span>
              {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
