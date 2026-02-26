import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr]">
      <div className="hidden border-r bg-card md:block sticky top-0 h-screen">
        <div className="flex h-full flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            {/* Logo/Title space in sidebar */}
          </div>
          <MainNav />
        </div>
      </div>
      <div className="flex flex-col">
        <DashboardHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-8 lg:p-8 bg-background max-w-[1400px] mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}