'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { doc } from 'firebase/firestore';

import { AppointmentNotifier } from '@/components/dashboard/appointment-notifier';
import { BottomNav } from '@/components/dashboard/bottom-nav';
import { FeedbackNotifier } from '@/components/dashboard/feedback-notifier';
import { DashboardHeader } from '@/components/dashboard/header';
import { MainNav } from '@/components/dashboard/main-nav';
import { RankingRewardNotifier } from '@/components/dashboard/ranking-reward-notifier';
import { ReportNotifier } from '@/components/dashboard/report-notifier';
import { useAppContext } from '@/contexts/app-context';
import { NotificationsProvider } from '@/contexts/notifications-context';
import { useDoc, useFirestore, useUser } from '@/firebase';
import {
  STUDENT_POST_LOGIN_ENTRY_MOTION_KEY,
  clearBodyDashboardMotionPreset,
  getStudentDashboardRouteKey,
  hasRecentDashboardEntryMotion,
  setBodyDashboardMotionPreset,
} from '@/lib/dashboard-motion';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import type { StudentProfile, User as UserType } from '@/lib/types';
import {
  getUniversityThemeCssVars,
  getUniversityThemeShellStyles,
  resolveUniversityThemeKey,
} from '@/lib/university-theme';
import { cn } from '@/lib/utils';

export function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { activeMembership, activeStudentId, viewMode } = useAppContext();
  const { user } = useUser();
  const firestore = useFirestore();
  const pathname = usePathname();
  const [playStudentEntry, setPlayStudentEntry] = useState(false);
  const role = activeMembership?.role;
  const isStudentMode = role === 'student';
  const isParentMode = activeMembership?.role === 'parent';
  const isMobileView = isParentMode || viewMode === 'mobile';
  const studentUid = activeStudentId || user?.uid || null;
  const studentRouteKey = useMemo(
    () => (isStudentMode ? getStudentDashboardRouteKey(pathname) : null),
    [isStudentMode, pathname]
  );
  const userProfileRef = useMemoFirebase(
    () => (firestore && user?.uid && isStudentMode ? doc(firestore, 'users', user.uid) : null),
    [firestore, isStudentMode, user?.uid]
  );
  const { data: userProfile } = useDoc<UserType>(userProfileRef, {
    enabled: isStudentMode && Boolean(userProfileRef),
  });
  const studentProfileRef = useMemoFirebase(
    () => (
      firestore && studentUid && activeMembership?.id && isStudentMode
        ? doc(firestore, 'centers', activeMembership.id, 'students', studentUid)
        : null
    ),
    [activeMembership?.id, firestore, isStudentMode, studentUid]
  );
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, {
    enabled: isStudentMode && Boolean(studentProfileRef),
  });
  const resolvedGoalPathType = useMemo(
    () => ((userProfile?.goalPathType ?? studentProfile?.goalPathType) === 'job' ? 'job' : 'school'),
    [studentProfile?.goalPathType, userProfile?.goalPathType]
  );
  const resolvedUniversityThemeKey = useMemo(
    () =>
      resolveUniversityThemeKey({
        explicitThemeKey: userProfile?.universityThemeKey ?? studentProfile?.universityThemeKey ?? null,
        goalPathType: resolvedGoalPathType,
        goalPathLabel: userProfile?.goalPathLabel ?? studentProfile?.goalPathLabel ?? '',
      }),
    [
      resolvedGoalPathType,
      studentProfile?.goalPathLabel,
      studentProfile?.universityThemeKey,
      userProfile?.goalPathLabel,
      userProfile?.universityThemeKey,
    ]
  );
  const studentThemeVars = useMemo(
    () => (isStudentMode ? getUniversityThemeCssVars(resolvedUniversityThemeKey) : undefined),
    [isStudentMode, resolvedUniversityThemeKey]
  );
  const studentShellTheme = useMemo(
    () => getUniversityThemeShellStyles(resolvedUniversityThemeKey),
    [resolvedUniversityThemeKey]
  );
  const shellRootStyle = useMemo(() => {
    if (!isStudentMode || isParentMode) return undefined;
    return {
      ...(studentThemeVars ?? {}),
      background: isMobileView
        ? studentShellTheme.dashboardBackdropMobile
        : studentShellTheme.dashboardBackdropDesktop,
    };
  }, [isMobileView, isParentMode, isStudentMode, studentShellTheme, studentThemeVars]);
  const dotPatternStyle = useMemo(() => {
    if (!isStudentMode || isParentMode) return undefined;
    const dotSize = isMobileView ? '1px' : '1.3px';
    return {
      backgroundImage: `radial-gradient(${studentShellTheme.dotColor} ${dotSize}, transparent ${dotSize})`,
      backgroundSize: isMobileView ? '30px 30px' : '42px 42px',
      opacity: Number(isMobileView ? studentShellTheme.dotOpacityMobile : studentShellTheme.dotOpacityDesktop),
    };
  }, [isMobileView, isParentMode, isStudentMode, studentShellTheme]);
  const overlayGlowStyle = useMemo(
    () =>
      !isStudentMode || isParentMode
        ? undefined
        : {
            background: studentShellTheme.overlayGlow,
          },
    [isParentMode, isStudentMode, studentShellTheme]
  );
  const innerShellStyle = useMemo(() => {
    if (!isStudentMode || isParentMode) return undefined;
    if (isMobileView) {
      return {
        background: studentShellTheme.mobileShellBackground,
        borderColor: studentShellTheme.mobileBorderColor,
        boxShadow: `0 42px 95px -28px rgba(4,10,32,0.42), 0 0 0 1px ${studentShellTheme.mobileRingColor}`,
      };
    }
    return {
      background: studentShellTheme.desktopShellBackground,
    };
  }, [isMobileView, isParentMode, isStudentMode, studentShellTheme]);

  useEffect(() => {
    if (isStudentMode || isParentMode) {
      setBodyDashboardMotionPreset('dashboard-premium');
    } else {
      setBodyDashboardMotionPreset('default');
    }

    return () => clearBodyDashboardMotionPreset();
  }, [isParentMode, isStudentMode]);

  useEffect(() => {
    if (!isStudentMode || typeof window === 'undefined') {
      setPlayStudentEntry(false);
      return;
    }

    if (!hasRecentDashboardEntryMotion(STUDENT_POST_LOGIN_ENTRY_MOTION_KEY)) {
      return;
    }

    window.sessionStorage.removeItem(STUDENT_POST_LOGIN_ENTRY_MOTION_KEY);
    setPlayStudentEntry(true);
    const timer = window.setTimeout(() => setPlayStudentEntry(false), 1200);
    return () => window.clearTimeout(timer);
  }, [isStudentMode]);

  return (
    <NotificationsProvider>
      <div
        className={cn(
          'dashboard-shell min-h-screen w-full transition-all duration-500 relative overflow-x-hidden font-body flex items-start justify-center',
          isMobileView
            ? isParentMode
              ? 'bg-[radial-gradient(circle_at_top,#ffd7b6_0%,#eef4ff_48%,#e6efff_100%)] px-1.5 pb-4 sm:px-3 sm:pb-5 md:px-4'
              : 'px-2.5 pb-5 sm:px-3 sm:pb-6'
            : isStudentMode
              ? 'md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]'
              : 'bg-[#f2f4f8] md:grid md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr]'
        )}
        style={shellRootStyle}
      >
        <div className="fixed inset-0 pointer-events-none z-0">
          <div
            className={cn(
              'absolute inset-0',
              isStudentMode && !isParentMode
                ? ''
                : isMobileView
                  ? 'bg-[radial-gradient(#14295F_1px,transparent_1px)] [background-size:30px_30px] opacity-[0.05]'
                  : 'bg-[radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:40px_40px] opacity-[0.04]'
            )}
            style={dotPatternStyle}
          />
          <div
            className={cn(
              'absolute inset-0',
              isStudentMode && !isParentMode
                ? ''
                : isMobileView
                  ? 'bg-[radial-gradient(circle_at_20%_0%,rgba(255,122,22,0.35),transparent_42%),radial-gradient(circle_at_85%_90%,rgba(20,41,95,0.26),transparent_45%)]'
                  : 'bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_60%)]'
            )}
            style={overlayGlowStyle}
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
            isParentMode
              ? 'parent-app-shell overflow-hidden rounded-[3rem] border-[8px] border-[#10295f] bg-[linear-gradient(180deg,#fff7ef_0%,#ffffff_38%,#f4f9ff_100%)] shadow-[0_35px_90px_-25px_rgba(20,41,95,0.52)] ring-2 ring-[#ffb985]/40 relative mt-2 sm:mt-3'
              : isMobileView
                ? 'student-night-shell dashboard-mobile-shell overflow-hidden rounded-[3.25rem] border-[10px] shadow-[0_42px_95px_-28px_rgba(4,10,32,0.42)] relative mt-3 sm:mt-4'
                : isStudentMode
                  ? 'student-night-shell w-full min-h-screen'
                  : 'w-full min-h-screen',
            isStudentMode && 'student-font-shell',
            playStudentEntry && isStudentMode && 'student-shell-glow'
          )}
          style={innerShellStyle}
        >
          {isMobileView && (
            <div
              className={cn(
                'pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 rounded-b-[1.2rem] bg-[#0f224f] shadow-[0_5px_14px_rgba(0,0,0,0.32)]',
                isParentMode ? 'parent-app-notch h-5 w-28 sm:h-6 sm:w-32' : 'dashboard-mobile-notch h-6 w-32'
              )}
            />
          )}

          <DashboardHeader playStudentEntry={playStudentEntry} />

          <main
            className={cn(
              'flex-1 min-h-0 flex flex-col gap-4 mx-auto w-full custom-scrollbar overflow-y-auto relative z-10',
              isParentMode
                ? 'parent-app-main p-4 px-4 pb-24 pt-4 md:px-5 md:pt-5'
                : isMobileView
                  ? 'student-night-main dashboard-mobile-main p-4 px-4 pb-24 pt-5'
                  : 'p-4 sm:p-6 md:p-8 lg:p-12 max-w-[1500px] pb-12'
            )}
          >
            {isStudentMode && studentRouteKey ? (
              <div
                key={studentRouteKey}
                className={cn(
                  'student-route-stage',
                  'student-route-enter',
                  playStudentEntry && 'student-main-enter student-entry-delay-3'
                )}
              >
                {children}
              </div>
            ) : (
              <div className={cn(isStudentMode && playStudentEntry && 'student-main-enter student-entry-delay-3')}>
                {children}
              </div>
            )}
            {isMobileView ? (
              <div
                aria-hidden="true"
                className="pointer-events-none shrink-0"
                style={
                  isParentMode
                    ? { height: 'calc(var(--parent-app-scroll-tail, 0px) + 1rem)' }
                    : { height: 'calc(var(--dashboard-mobile-scroll-tail, 0px) + 1.1rem)' }
                }
              />
            ) : null}
          </main>

          <FeedbackNotifier />
          <RankingRewardNotifier />
          <AppointmentNotifier />
          <ReportNotifier />

          {(isMobileView || (typeof window !== 'undefined' && window.innerWidth < 768)) && (
            <div
              className={
                isParentMode
                  ? 'parent-app-nav-wrap absolute bottom-0 left-0 right-0 z-50'
                  : isMobileView
                    ? 'dashboard-mobile-nav-wrap absolute bottom-0 left-0 right-0 z-50'
                    : ''
              }
            >
              <BottomNav playStudentEntry={playStudentEntry} />
            </div>
          )}
        </div>
      </div>
    </NotificationsProvider>
  );
}
