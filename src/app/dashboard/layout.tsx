'use client';

import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import { BottomNav } from '@/components/dashboard/bottom-nav';
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
      isForcedMobile ? "flex flex-col items-center bg-[#f4f4f4] py-2 sm:py-6" : "grid md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]"
    )}>
      {/* Sidebar - Desktop/Tablet Mode */}
      {!isForcedMobile && (
        <div className="hidden border-r bg-card md:block sticky top-0 h-screen overflow-y-auto">
          <div className="flex h-full flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
              <span className="text-lg font-black tracking-tighter text-primary">Mastery Track</span>
            </div>
            <MainNav />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-500",
        isForcedMobile 
          ? "w-full max-w-[410px] aspect-[9/19.5] bg-background shadow-[0_30px_80px_rgba(0,0,0,0.15)] rounded-[2.5rem] overflow-hidden border-[6px] border-white relative ring-1 ring-black/5 text-sm" 
          : "w-full"
      )}>
        {/* Header */}
        <DashboardHeader />
        
        {/* Scrollable Content */}
        <main className={cn(
          "flex-1 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto",
          isForcedMobile ? "p-4 pb-20" : "p-4 md:p-6 lg:p-8 max-w-[1400px] pb-24 md:pb-8"
        )}>
          {children}
        </main>

        {/* Bottom Nav */}
        <BottomNav />
      </div>
    </div>
  );
}
