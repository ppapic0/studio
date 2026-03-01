'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  CalendarDays, 
  ClipboardCheck, 
  MessageCircle,
  Armchair,
  FileText,
  Settings,
  Users,
  Trophy,
  GraduationCap
} from 'lucide-react';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export function BottomNav() {
  const { activeMembership, viewMode } = useAppContext();
  const pathname = usePathname();

  if (!activeMembership) return null;

  const role = activeMembership.role;
  const isForcedMobile = viewMode === 'mobile';

  const navItems: Record<string, { href: string; label: string; icon: any }[]> = {
    student: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/growth', label: '로드맵', icon: Zap },
      { href: '/dashboard/study-history', label: '기록', icon: CalendarDays },
      { href: '/dashboard/plan', label: '계획', icon: ClipboardCheck },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    teacher: [
      { href: '/dashboard/teacher', label: '센터홈', icon: LayoutDashboard },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/layout-view', label: '도면', icon: Armchair },
      { href: '/dashboard/teacher/students', label: '학생', icon: GraduationCap },
      { href: '/dashboard/appointments', label: '상담', icon: MessageCircle },
    ],
    centerAdmin: [
      { href: '/dashboard', label: '홈', icon: LayoutDashboard },
      { href: '/dashboard/reports', label: '리포트', icon: FileText },
      { href: '/dashboard/teacher/layout-view', label: '도면', icon: Armchair },
      { href: '/dashboard/teacher/students', label: '관리', icon: GraduationCap },
      { href: '/dashboard/settings/invites', label: '설정', icon: Settings },
    ],
  };

  const currentNav = navItems[role] || [];

  return (
    <div className={cn(
      "z-50 bg-white/80 backdrop-blur-2xl border-t border-black/[0.05] h-20 transition-all duration-500 pb-4",
      isForcedMobile ? "absolute bottom-0 left-0 right-0 rounded-b-[3.5rem]" : "fixed bottom-0 left-0 right-0 md:hidden"
    )}>
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
                isActive ? "bg-primary/5 shadow-inner" : "group-hover:bg-muted/50"
              )}>
                <item.icon className={cn(
                  "h-5.5 w-5.5 transition-all duration-300", 
                  isActive ? "stroke-[2.5px] scale-110" : "stroke-[2px]"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-black tracking-tighter transition-all duration-300", 
                isActive ? "opacity-100 translate-y-0" : "opacity-60 translate-y-0.5"
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute top-0 w-8 h-1 rounded-full bg-primary animate-in fade-in slide-in-from-top-1" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
