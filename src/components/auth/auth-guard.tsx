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
  const { activeMembership, setMemberships, setActiveMembership } = useAppContext();
  const [isCheckingMembership, setIsCheckingMembership] = useState(true);

  useEffect(() => {
    if (userLoading) {
      return; // Wait until user state is resolved
    }

    // 1. Handle unauthenticated users
    if (!user) {
      if (pathname !== '/login' && pathname !== '/signup') {
        router.push('/login');
      }
      setIsCheckingMembership(false);
      return;
    }

    // 2. User is authenticated. Check for membership if we don't have one already.
    // If we already have an active membership, we are good.
    if (activeMembership) {
      setIsCheckingMembership(false);
      // If user with membership is on a non-app page, redirect them.
      if (
        pathname === '/connection-test' ||
        pathname === '/login' ||
        pathname === '/signup'
      ) {
        router.push('/dashboard');
      }
      return;
    }

    // 3. No active membership in context, check Firestore.
    const checkMembership = async () => {
      if (!firestore) return;
      setIsCheckingMembership(true);

      try {
        const userCentersRef = collection(
          firestore,
          'userCenters',
          user.uid,
          'centers'
        );
        const querySnapshot = await getDocs(userCentersRef);
        const fetchedMemberships = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as CenterMembership)
        );

        setMemberships(fetchedMemberships);
        const active = fetchedMemberships.find((m) => m.status === 'active');

        if (active) {
          setActiveMembership(active);
          // Just found a membership, if they were on a connection page, move to dashboard
          if (pathname === '/connection-test') {
            router.push('/dashboard');
          }
        } else {
          // No active memberships found. Set to null.
          // IMPORTANT: We no longer redirect to /connection-test here.
          // The UI components should handle the state where activeMembership is null.
          setActiveMembership(null);
           if (fetchedMemberships.length === 0 && pathname !== '/connection-test') {
            router.push('/connection-test');
          }
        }
      } catch (e) {
        console.error('AuthGuard: Failed to check membership.', e);
        setActiveMembership(null);
        setMemberships([]);
         if (pathname !== '/connection-test') {
            router.push('/connection-test');
          }
      } finally {
        setIsCheckingMembership(false);
      }
    };

    checkMembership();
  }, [
    user,
    userLoading,
    firestore,
    router,
    pathname,
    setMemberships,
    setActiveMembership,
    activeMembership,
  ]);

  if (userLoading || isCheckingMembership) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // If we are finished loading, render the children.
  // The app will now show the dashboard page, but components inside will
  // react to `activeMembership` being null if no active membership was found.
  return <>{children}</>;
}
