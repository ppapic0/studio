'use client';

import { useUser, useCollection } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { CenterMembership, useAppContext } from '@/contexts/app-context';
import { Loader2 } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: userLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { setMemberships, setActiveMembership } = useAppContext();
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
      return;
    }

    // User is logged in, check for center memberships
    const checkMembership = async () => {
      if (!firestore || !user) return;
      setIsCheckingMembership(true);
      try {
        const userCentersRef = collection(
          firestore,
          'userCenters',
          user.uid,
          'centers'
        );
        const querySnapshot = await getDocs(userCentersRef);
        const memberships = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as CenterMembership)
        );

        const activeMemberships = memberships.filter(m => m.status === 'active');
        
        setMemberships(memberships);

        if (activeMemberships.length > 0) {
            // For now, just pick the first active one.
            // A real app might have a center selector.
            setActiveMembership(activeMemberships[0]);

            // If user is on a non-app page but has membership, redirect to app
            if (pathname === '/connection-test') {
                router.push('/dashboard');
            }
        } else {
            // No active memberships, redirect to join page
            if (pathname !== '/connection-test') {
                router.push('/connection-test');
            }
        }
      } catch (e) {
        console.error("Failed to check membership", e);
        // Maybe redirect to an error page or show a toast
      } finally {
        setIsCheckingMembership(false);
      }
    };

    checkMembership();
  }, [user, userLoading, firestore, router, pathname, setMemberships, setActiveMembership]);

  if (userLoading || isCheckingMembership) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Allow access to public pages if not authenticated
  if (!user && (pathname === '/login' || pathname === '/signup')) {
    return <>{children}</>;
  }

  // If user is logged in and check is complete, render children
  if (user) {
      return <>{children}</>;
  }

  return null;
}
