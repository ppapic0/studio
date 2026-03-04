
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  CalendarDays, 
  ClipboardCheck, 
  MessageCircle,
  FileText,
  Trophy,
  GraduationCap,
  History,
  MonitorSmartphone,
  Monitor
} from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const { activeMembership, currentTier } = useAppContext();
  const pathname = usePathname();

  if (!activeMembership) return null;

  const role = activeMembership.role;
  const isStudent = role === 'student';

  const navItems: Record<string, { href: string; label: string; icon: any }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '성장트랙', icon: Zap },
      { href: '/dashboard/study-history', label: '기록트랙', icon: CalendarDays },
      { href: '/dashboard/plan', label: '계획트랙', icon: ClipboardCheck },
      { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
    ],
    teacher: [
      { href: '/dashboard/teacher', label: '현황', icon: Monitor },
      { href: '/kiosk', label: '키오스크', icon: MonitorSmartphone },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    parent: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/study-history', label: '기록트랙', icon: History },
      { href: '/dashboard/appointments', label: '상담트랙', icon: MessageCircle },
      { href: '/dashboard/leaderboards', label: '랭킹트랙', icon: Trophy },
    ],
    centerAdmin: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/teacher', label: '현황', icon: Monitor },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
  };

  const currentNav = navItems[role] || [];

  return (
    <div className="z-50 bg-white/80 backdrop-blur-2xl border-t border-black/[0.05] h-20 transition-all duration-500 pb-4 fixed bottom-0 left-0 right-0 md:hidden">
      <nav className="flex items-center justify-around h-full px-4">
        {currentNav.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 min-w-[64px] h-full transition-all active:scale-90 relative group",
                isActive ? "text-primary" : "text-muted-foreground/40"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-2xl transition-all duration-300",
                isActive 
                  ? (isStudent ? `bg-gradient-to-br ${currentTier.gradient} text-white shadow-lg` : "bg-primary text-white shadow-inner") 
                  : "group-hover:bg-muted/50"
              )}>
                <item.icon className={cn(
                  "h-5.5 w-5.5 transition-all duration-300", 
                  isActive ? "stroke-[2.5px] scale-110" : "stroke-[2px]"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-black tracking-tighter transition-all duration-300", 
                isActive ? "text-primary opacity-100" : "opacity-60"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className={cn(
                  "absolute top-0 w-8 h-1 rounded-full animate-in fade-in slide-in-from-top-1",
                  isStudent ? `bg-gradient-to-r ${currentTier.gradient}` : "bg-primary"
                )} />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
