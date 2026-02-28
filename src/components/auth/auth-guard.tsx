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
  
  const [mounted, setMounted] = useState(false);
  const [isCheckingInitial, setIsCheckingInitial] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.replace('/login');
      }
      setMemberships([]);
      setActiveMembership(null);
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
      return;
    }

    if (!firestore) return;
    setMembershipsLoading(true);

    // 사용자의 소속 센터 목록을 실시간으로 구독합니다.
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
        if (pathname === '/login' || pathname === '/signup') {
          router.replace('/dashboard');
        }
      } else {
        setActiveMembership(null);
      }
      
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    }, (error) => {
      console.error('AuthGuard Membership Sync Error:', error);
      setMembershipsLoading(false);
      setIsCheckingInitial(false);
    });

    return () => unsubscribe();
  }, [user, userLoading, firestore, pathname, router, setMemberships, setActiveMembership, setMembershipsLoading]);

  // 서버 사이드 렌더링과의 일관성을 위해 마운트 전에는 최소한의 구조만 렌더링
  if (!mounted) {
    if (pathname !== '/login' && pathname !== '/signup') {
      return (
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    return <div className="min-h-screen" />;
  }

  // 인증 및 멤버십 초기 확인 중에는 로딩 화면 표시
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