'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
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
      setIsCheckingMembership(false);
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
        let memberships = querySnapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as CenterMembership)
        );

        // DEV FALLBACK: If no memberships in userCenters, check a default center.
        // This helps during development if only /centers/{c}/members/{u} exists.
        if (memberships.length === 0 && process.env.NODE_ENV === 'development') {
          const defaultCenterId = 'center-1';
          try {
            const memberDocRef = doc(firestore, 'centers', defaultCenterId, 'members', user.uid);
            const memberDocSnap = await getDoc(memberDocRef);

            if (memberDocSnap.exists()) {
              console.log(`[AuthGuard Dev] Found membership in fallback center '${defaultCenterId}'. Creating reverse-index and proceeding.`);
              const memberData = memberDocSnap.data();
              const fallbackMembership = { id: defaultCenterId, ...memberData } as CenterMembership;
              
              // Create the reverse index doc so this fallback isn't needed on next load
              const userCenterDocRef = doc(firestore, 'userCenters', user.uid, 'centers', defaultCenterId);
              await setDoc(userCenterDocRef, {
                  role: memberData.role,
                  status: memberData.status,
                  joinedAt: memberData.joinedAt || serverTimestamp(),
              });

              memberships.push(fallbackMembership);
            }
          } catch (e) {
            console.error(`[AuthGuard Dev] Error during fallback check for center '${defaultCenterId}':`, e);
          }
        }


        const activeMemberships = memberships.filter(
          (m) => m.status === 'active'
        );

        setMemberships(memberships);

        if (activeMemberships.length > 0) {
          // For now, just pick the first active one.
          // A real app might have a center selector.
          setActiveMembership(activeMemberships[0]);

          // If user is on a non-app page but has membership, redirect to app
          if (
            pathname === '/connection-test' ||
            pathname === '/app' ||
            pathname === '/'
          ) {
            router.push('/dashboard');
          }
        } else {
          // No active memberships, redirect to join page
          if (pathname !== '/connection-test') {
            router.push('/connection-test');
          }
        }
      } catch (e) {
        console.error('Failed to check membership', e);
        // Maybe redirect to an error page or show a toast
        if (pathname !== '/connection-test') {
          router.push('/connection-test');
        }
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
