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
      "min-h-screen w-full bg-background transition-all duration-500",
      isForcedMobile ? "flex flex-col items-center bg-[#e5e5e5] py-6 sm:py-12" : "grid md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]"
    )}>
      {/* Sidebar - Desktop/Tablet Mode */}
      {!isForcedMobile && (
        <div className="hidden border-r bg-card md:block sticky top-0 h-screen overflow-y-auto">
          <div className="flex h-full flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <span className="text-lg font-black tracking-tighter text-primary">집중트랙</span>
            </div>
            <MainNav />
          </div>
        </div>
      )}

      {/* Main Content Area - Phone Simulation */}
      <div className={cn(
        "flex flex-col transition-all duration-700 relative",
        isForcedMobile 
          ? "w-[390px] h-[844px] bg-background rounded-[3.5rem] overflow-hidden border-[12px] border-[#1a1a1a] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] ring-1 ring-black/10" 
          : "w-full min-h-screen"
      )}>
        {/* Header */}
        <DashboardHeader />
        
        {/* Scrollable Content */}
        <main className={cn(
          "flex-1 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto",
          isForcedMobile ? "p-5 pb-28 pt-2" : "p-4 md:p-6 lg:p-8 max-w-[1400px] pb-24 md:pb-8"
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
