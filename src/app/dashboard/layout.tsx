'use client';

import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { AppointmentNotifier } from '@/components/dashboard/appointment-notifier';
import { useAppContext } from '@/contexts/app-context';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewMode } = useAppContext();
  const isForcedMobile = viewMode === 'mobile';

  return (
    <div className={cn(
      "min-h-screen w-full bg-background transition-all duration-500 relative overflow-x-hidden",
      isForcedMobile ? "flex flex-col items-center bg-[#dcdcdc] py-6 sm:py-12" : "grid md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]"
    )}>
      {/* Premium Background Decoration - Subtle micro-dots & radial glow */}
      {!isForcedMobile && (
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.03]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,hsl(var(--primary)/0.05),transparent_70%)]" />
        </div>
      )}

      {/* Sidebar - Desktop/Tablet Mode */}
      {!isForcedMobile && (
        <div className="hidden border-r bg-card/50 backdrop-blur-xl md:block sticky top-0 h-screen overflow-y-auto z-20">
          <div className="flex h-full flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <span className="text-lg font-black tracking-tighter text-primary">집중트랙</span>
            </div>
            <MainNav />
          </div>
        </div>
      )}

      {/* Main Content Area - Phone Simulation or Fluid Web */}
      <div className={cn(
        "flex flex-col transition-all duration-700 relative z-10",
        isForcedMobile 
          ? "w-[390px] h-[844px] bg-background rounded-[3.5rem] overflow-hidden border-[12px] border-[#1a1a1a] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] ring-1 ring-black/10" 
          : "w-full min-h-screen"
      )}>
        {/* Mobile Mock Pattern Inside */}
        {isForcedMobile && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] z-0">
            <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:24px_24px]" />
          </div>
        )}

        {/* Header */}
        <DashboardHeader />
        
        {/* Scrollable Content */}
        <main className={cn(
          "flex-1 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto relative z-10",
          isForcedMobile ? "p-5 pb-28 pt-2" : "p-4 md:p-6 lg:p-10 max-w-[1400px] pb-24 md:pb-8"
        )}>
          {children}
        </main>

        {/* Global Notifiers */}
        <AppointmentNotifier />

        {/* Bottom Nav */}
        <BottomNav />
        
        {/* Mobile Home Indicator Simulation */}
        {isForcedMobile && (
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-black/10 rounded-full z-[60]" />
        )}
      </div>
    </div>
  );
}