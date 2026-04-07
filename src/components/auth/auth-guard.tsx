'use client';

import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  AUTH_SESSION_SYNC_SKIP_STORAGE_KEY,
  sanitizeDashboardReturnPath,
} from '@/lib/auth-session-shared';
import { createServerAuthSession } from '@/lib/client-auth-session';
import { logHandledClientIssue } from '@/lib/handled-client-log';

const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/signup',
  '/experience',
  '/class',
  '/lp',
  '/center',
  '/results',
  '/consult/check',
]);

function isPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return pathname.startsWith('/consult/check');
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading: userLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [isSessionSyncing, setIsSessionSyncing] = useState(false);
  const [hasTriedSessionSync, setHasTriedSessionSync] = useState(false);
  const isAuthRoute = pathname === '/login' || pathname === '/signup';
  const redirectPath = sanitizeDashboardReturnPath(searchParams.get('next'));

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    setHasTriedSessionSync(false);
    setIsSessionSyncing(false);
  }, [mounted, pathname, user?.uid]);

  useEffect(() => {
    if (userLoading || !mounted) return;

    if (!user) {
      if (!isPublicRoute(pathname)) {
        router.replace('/login');
      }
      return;
    }

    if (!isAuthRoute || hasTriedSessionSync) {
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem(AUTH_SESSION_SYNC_SKIP_STORAGE_KEY) === '1'
    ) {
      return;
    }

    let cancelled = false;

    const syncServerSession = async () => {
      setHasTriedSessionSync(true);
      setIsSessionSyncing(true);

      try {
        await createServerAuthSession(user);
        if (!cancelled) {
          router.replace(redirectPath);
        }
      } catch (error) {
        logHandledClientIssue('[auth-guard] session sync failed', error);
        try {
          await signOut(auth);
        } catch (signOutError) {
          logHandledClientIssue('[auth-guard] sign out after session sync failure failed', signOutError);
        } finally {
          if (!cancelled) {
            setIsSessionSyncing(false);
          }
        }
      }
    };

    void syncServerSession();

    return () => {
      cancelled = true;
    };
  }, [auth, hasTriedSessionSync, isAuthRoute, mounted, pathname, redirectPath, router, user, userLoading]);

  useEffect(() => {
    if (userLoading || !mounted || !user || isAuthRoute || isPublicRoute(pathname)) {
      return;
    }

    let cancelled = false;

    const syncServerSession = async () => {
      try {
        await createServerAuthSession(user);
      } catch (error) {
        if (!cancelled) {
          logHandledClientIssue('[auth-guard] protected route session refresh failed', error);
        }
      }
    };

    void syncServerSession();
    const refreshInterval = window.setInterval(() => {
      void syncServerSession();
    }, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [isAuthRoute, mounted, pathname, user, userLoading]);

  // 하이드레이션 오류 방지
  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // 로그인/회원가입 페이지는 인증 체크 없이 노출
  if (isAuthRoute && user && isSessionSyncing) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">인증 세션을 준비 중입니다...</p>
      </div>
    );
  }

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  // 로딩 중일 때
  if (userLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">인증 세션을 확인 중입니다...</p>
      </div>
    );
  }

  // 로그인이 되어 있지 않은 상태에서 보호된 경로 접근 시 (useEffect에서 처리하지만 렌더링 방지)
  if (!user && !isPublicRoute(pathname)) {
    return null;
  }
  
  return <>{children}</>;
}
