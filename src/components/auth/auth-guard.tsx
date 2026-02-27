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
    // 1. 인증 상태 확인 중이면 대기
    if (userLoading) {
      return; 
    }

    // 2. 비로그인 상태 처리
    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
      setIsCheckingInitial(false);
      setMembershipsLoading(false);
      return;
    }
    
    // 3. 로그인 상태일 경우 실시간 멤버십 리스너 연결
    if (!firestore) return;
    setMembershipsLoading(true);

    // 사용자의 가입 센터 목록을 실시간으로 감시합니다.
    const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
    
    const unsubscribe = onSnapshot(userCentersRef, (snapshot) => {
      const fetchedMemberships = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as CenterMembership));

      setMemberships(fetchedMemberships);
      const active = fetchedMemberships.find(m => m.status === 'active');
      
      if (active) {
        setActiveMembership(active);
        // 로그인/회원가입 페이지에 있다면 대시보드로 이동
        if (pathname === '/login' || pathname === '/signup') {
          router.push('/dashboard');
        }
      } else {
        setActiveMembership(null);
      }
      
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    }, (error) => {
      console.error('AuthGuard: Membership listener error', error);
      // 권한 에러 등이 발생해도 무한 로딩 방지를 위해 로딩은 해제
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    });

    return () => unsubscribe();
  }, [user, userLoading, firestore, router, pathname, setMemberships, setActiveMembership, setMembershipsLoading]);

  // 초기 체크 중에는 로딩 화면 표시
  if (isCheckingInitial) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return <>{children}</>;
}