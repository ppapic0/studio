'use client';

import { MainNav } from '@/components/dashboard/main-nav';
import { DashboardHeader } from '@/components/dashboard/header';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { AppointmentNotifier } from '@/components/dashboard/appointment-notifier';
import { FeedbackNotifier } from '@/components/dashboard/feedback-notifier';
import { ReportNotifier } from '@/components/dashboard/report-notifier';
import { useAppContext } from '@/contexts/app-context';
import { NotificationsProvider } from '@/contexts/notifications-context';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeMembership, viewMode } = useAppContext();
  const isMobileView = activeMembership?.role === 'parent' || viewMode === 'mobile';

  return (
    <NotificationsProvider>
    <div
      className={cn(
        'dashboard-shell min-h-screen w-full transition-all duration-500 relative overflow-x-hidden font-body flex items-start justify-center',
        isMobileView
          ? 'bg-[radial-gradient(circle_at_top,#ffd7b6_0%,#eff4ff_52%,#e8efff_100%)] px-2.5 pb-5 sm:px-3 sm:pb-6'
          : 'bg-[#f2f4f8] md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]'
      )}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={cn(
            'absolute inset-0',
            isMobileView
              ? 'bg-[radial-gradient(#14295F_1px,transparent_1px)] [background-size:30px_30px] opacity-[0.05]'
              : 'bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:40px_40px] opacity-[0.04]'
          )}
        />
        <div
          className={cn(
            'absolute inset-0',
            isMobileView
              ? 'bg-[radial-gradient(circle_at_20%_0%,rgba(255,122,22,0.35),transparent_42%),radial-gradient(circle_at_85%_90%,rgba(20,41,95,0.26),transparent_45%)]'
              : 'bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)]'
          )}
        />
      </div>

      {!isMobileView && (
        <div className="hidden border-r border-[rgba(20,41,95,0.07)] bg-white/80 backdrop-blur-xl md:block sticky top-0 h-screen overflow-y-auto z-20 shadow-[1px_0_0_0_rgba(20,41,95,0.04)]">
          <div className="flex h-full flex-col justify-start">
            <MainNav />
          </div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col transition-all duration-700 relative z-10',
          isMobileView
            ? 'dashboard-mobile-shell overflow-hidden rounded-[3.25rem] border-[10px] border-[#10295f] bg-[linear-gradient(180deg,#fff7ef_0%,#ffffff_38%,#f5f9ff_100%)] shadow-[0_35px_90px_-25px_rgba(20,41,95,0.55)] ring-2 ring-[#ff7a16]/45 relative mt-3 sm:mt-4'
            : 'w-full min-h-screen'
        )}
      >
        {isMobileView && (
          <div className="dashboard-mobile-notch pointer-events-none absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-[1.2rem] bg-[#0f224f] shadow-[0_5px_14px_rgba(0,0,0,0.32)]" />
        )}

        <DashboardHeader />

        <main
          className={cn(
            'flex-1 min-h-0 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto relative z-10',
            isMobileView ? 'dashboard-mobile-main p-4 px-4 pb-24 pt-5' : 'p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1500px] pb-12'
          )}
        >
          {children}
        </main>

        <FeedbackNotifier />
        <AppointmentNotifier />
        <ReportNotifier />

        {(isMobileView || (typeof window !== 'undefined' && window.innerWidth < 768)) && (
          <div className={isMobileView ? 'dashboard-mobile-nav-wrap absolute bottom-0 left-0 right-0 z-50' : ''}>
            <BottomNav />
          </div>
        )}
      </div>
    </div>
    </NotificationsProvider>
  );
}
