'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CenterMembership, useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { activeMembership, setMemberships, setActiveMembership, setMembershipsLoading } = useAppContext();
  const [isCheckingInitial, setIsCheckingInitial] = useState(true);

  useEffect(() => {
    if (userLoading) {
      return; 
    }

    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
      setIsCheckingInitial(false);
      setMembershipsLoading(false);
      return;
    }
    
    // If we already have an active membership from a previous check, we are done.
    if (activeMembership) {
       setIsCheckingInitial(false);
       setMembershipsLoading(false);
       if (pathname === '/login' || pathname === '/signup') {
        router.push('/dashboard');
      }
      return;
    }

    const checkMembership = async () => {
      if (!firestore) return;
      setMembershipsLoading(true);

      try {
        // The source of truth for a user's memberships is the /userCenters collection,
        // which is a reverse index populated by the Cloud Functions.
        const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
        const querySnapshot = await getDocs(userCentersRef);
        const fetchedMemberships = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CenterMembership));

        setMemberships(fetchedMemberships);
        const active = fetchedMemberships.find(m => m.status === 'active');
        
        if (active) {
          setActiveMembership(active);
          if (pathname === '/login' || pathname === '/signup') {
            router.push('/dashboard');
          }
        } else {
          setActiveMembership(null);
          // Do not redirect. The dashboard page will handle the UI for users without a membership.
        }
      } catch (e) {
        console.error('AuthGuard: Failed to check membership.', e);
        setActiveMembership(null);
        setMemberships([]);
      } finally {
        setIsCheckingInitial(false);
        setMembershipsLoading(false);
      }
    };

    checkMembership();
  }, [user, userLoading, firestore, router, pathname, setMemberships, setActiveMembership, setMembershipsLoading, activeMembership]);

  if (isCheckingInitial) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  return <>{children}</>;
}
