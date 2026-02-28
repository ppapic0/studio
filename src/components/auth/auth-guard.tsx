'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CenterMembership, useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { setMemberships, setActiveMembership, setMembershipsLoading } = useAppContext();
  const [isCheckingInitial, setIsCheckingInitial] = useState(true);

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

  // 초기 체크(Auth + Membership) 중에는 로딩 화면 표시
  if (isCheckingInitial && pathname !== '/login' && pathname !== '/signup') {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground animate-pulse">보안 세션을 확인하고 있습니다...</p>
      </div>
    );
  }
  
  return <>{children}</>;
}
