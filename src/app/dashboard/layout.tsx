
'use client';

import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { AppointmentNotifier } from '@/components/dashboard/appointment-notifier';
import { ReportNotifier } from '@/components/dashboard/report-notifier';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-background transition-all duration-500 relative overflow-x-hidden font-body grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]">
      {/* Premium Background Decoration - Subtle layers & noise */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:40px_40px] opacity-[0.04]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)/0.8))]" />
      </div>

      {/* Sidebar - Desktop/Tablet Mode */}
      <div className="hidden border-r bg-white/40 backdrop-blur-2xl md:block sticky top-0 h-screen overflow-y-auto z-20">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-14 items-center border-b px-6 lg:h-[70px]">
            <span className="text-xl font-black tracking-tighter text-primary italic uppercase">Track Engine</span>
          </div>
          <MainNav />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col transition-all duration-700 relative z-10 w-full min-h-screen">
        {/* Header */}
        <DashboardHeader />
        
        {/* Scrollable Content */}
        <main className="flex-1 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto relative z-10 p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1500px] pb-32 md:pb-12">
          {children}
        </main>

        {/* Global Notifiers */}
        <AppointmentNotifier />
        <ReportNotifier />

        {/* Bottom Nav - Only on Mobile */}
        <BottomNav />
      </div>
    </div>
  );
}
