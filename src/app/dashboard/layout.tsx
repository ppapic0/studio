
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
  const { viewMode } = useAppContext();
  const isMobileView = viewMode === 'mobile';

  return (
    <div className={cn(
      "min-h-screen w-full bg-[#f0f0f0] transition-all duration-500 relative overflow-x-hidden font-body flex items-start justify-center",
      !isMobileView && "md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] bg-background"
    )}>
      {/* Premium Background Decoration */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:40px_40px] opacity-[0.04]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)]" />
      </div>

      {/* Sidebar - Desktop/Tablet Mode */}
      {!isMobileView && (
        <div className="hidden border-r bg-white/40 backdrop-blur-2xl md:block sticky top-0 h-screen overflow-y-auto z-20">
          <div className="flex h-full flex-col justify-start">
            <MainNav />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col transition-all duration-700 relative z-10",
        isMobileView 
          ? "w-full max-w-[430px] aspect-[9/19.5] h-[92vh] max-h-[932px] bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border-[12px] border-black overflow-hidden ring-[4px] ring-gray-800 relative mt-8" 
          : "w-full min-h-screen"
      )}>
        {/* Header */}
        <DashboardHeader />
        
        {/* Scrollable Content */}
        <main className={cn(
          "flex-1 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto relative z-10",
          isMobileView ? "p-4 px-5 pb-24" : "p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1500px] pb-12"
        )}>
          {children}
        </main>

        {/* Global Notifiers */}
        <AppointmentNotifier />
        <ReportNotifier />

        {/* Bottom Nav - Shown in Mobile View Mode or on actual small screens */}
        {(isMobileView || (typeof window !== 'undefined' && window.innerWidth < 768)) && (
          <div className={isMobileView ? "absolute bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-black/5" : ""}>
            <BottomNav />
          </div>
        )}
      </div>
    </div>
  );
}
