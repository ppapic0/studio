
'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CenterMembership, useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

/**
 * AuthGuard - 사용자의 인증 상태와 센터 멤버십 정보를 확인하고 보호된 경로에 대한 접근을 관리합니다.
 * 하이드레이션 오류를 방지하기 위해 서버와 클라이언트의 초기 렌더링을 일치시킵니다.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { setMemberships, setActiveMembership, setMembershipsLoading } = useAppContext();
  
  // 하이드레이션 오류 방지를 위한 마운트 상태
  const [mounted, setMounted] = useState(false);
  const [isCheckingInitial, setIsCheckingInitial] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 1. Firebase Auth 인증 상태 확인 중이면 대기
    if (userLoading) {
      return;
    }

    // 2. 로그인하지 않은 상태 처리
    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.replace('/login');
      }
      setIsCheckingInitial(false);
      setMembershipsLoading(false);
      return;
    }

    // 3. 로그인된 상태: Firestore 멤버십 정보 구독
    if (!firestore) return;
    setMembershipsLoading(true);

    const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
    
    // 실시간 리스너 연결
    const unsubscribe = onSnapshot(userCentersRef, (snapshot) => {
      const fetchedMemberships = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as CenterMembership));

      setMemberships(fetchedMemberships);
      const active = fetchedMemberships.find(m => m.status === 'active');
      
      if (active) {
        setActiveMembership(active);
        // 이미 로그인/회원가입 페이지에 있다면 대시보드로 이동
        if (pathname === '/login' || pathname === '/signup') {
          router.replace('/dashboard');
        }
      } else {
        setActiveMembership(null);
        // 센터는 없지만 로그인은 되어있는 경우 (대시보드에서 '센터 없음' 화면 노출)
        if (pathname === '/login' || pathname === '/signup') {
          router.replace('/dashboard');
        }
      }
      
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    }, (error) => {
      console.error('AuthGuard Error:', error);
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    });

    return () => unsubscribe();
  }, [user, userLoading, firestore, pathname, router, setMemberships, setActiveMembership, setMembershipsLoading]);

  // 하이드레이션 오류를 방지하기 위해 컴포넌트가 브라우저에 마운트될 때까지 서버와 동일한 HTML을 유지합니다.
  if (!mounted) {
    // 서버 환경(SSR)에서 예상되는 구조와 정확히 일치시켜야 합니다.
    // bg-background와 text-primary를 제거하여 서버의 기본 렌더링 값과 맞춥니다.
    if (pathname !== '/login' && pathname !== '/signup') {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    return <div className="min-h-screen" />;
  }

  // 초기 체크(Auth + Membership) 중에는 상세 로딩 화면 표시
  if (isCheckingInitial && pathname !== '/login' && pathname !== '/signup') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">보안 세션을 확인하고 있습니다...</p>
      </div>
    );
  }
  
  return <>{children}</>;
}
