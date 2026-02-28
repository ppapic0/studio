import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import { BottomNav } from '@/components/dashboard/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr] bg-background">
      {/* Sidebar - Desktop/Tablet Mode */}
      <div className="hidden border-r bg-card md:block sticky top-0 h-screen overflow-y-auto">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <span className="text-lg font-black tracking-tighter text-primary">Mastery Track</span>
          </div>
          <MainNav />
        </div>
      </div>

      <div className="flex flex-col min-h-screen">
        {/* Header - Always visible but responsive */}
        <DashboardHeader />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col gap-4 p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto w-full pb-24 md:pb-8">
          {children}
        </main>

        {/* Bottom Nav - App Mode (Mobile only) */}
        <BottomNav />
      </div>
    </div>
  );
}
