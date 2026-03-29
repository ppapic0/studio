'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

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
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userLoading || !mounted) return;

    if (!user) {
      if (!isPublicRoute(pathname)) {
        router.replace('/login');
      }
    } else {
      if (pathname === '/login' || pathname === '/signup') {
        router.replace('/dashboard');
      }
    }
  }, [user, userLoading, pathname, router, mounted]);

  // 하이드레이션 오류 방지
  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // 로그인/회원가입 페이지는 인증 체크 없이 노출
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
