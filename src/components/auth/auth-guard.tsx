'use client';

import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
        const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
        const querySnapshot = await getDocs(userCentersRef);
        let fetchedMemberships = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CenterMembership));

        let active = fetchedMemberships.find(m => m.status === 'active');

        if (!active && fetchedMemberships.length === 0) {
            // Development-only fallback: check center-1
            console.log("No memberships in /userCenters. Dev fallback: checking /centers/center-1/members...");
            const devMemberRef = doc(firestore, 'centers', 'center-1', 'members', user.uid);
            const devMemberSnap = await getDoc(devMemberRef);
            if (devMemberSnap.exists()) {
                const memberData = devMemberSnap.data();
                 if (memberData.status === 'active') {
                    console.log("Found active membership in center-1. Creating reverse index and setting active membership.");
                    const newMembership: CenterMembership = { id: 'center-1', ...memberData } as CenterMembership;
                    
                    // Create reverse index
                    const userCenterDocRef = doc(firestore, 'userCenters', user.uid, 'centers', 'center-1');
                    await setDoc(userCenterDocRef, {
                        role: memberData.role,
                        status: memberData.status,
                        joinedAt: memberData.joinedAt || serverTimestamp(),
                    });
                    
                    fetchedMemberships = [newMembership];
                    active = newMembership;
                }
            }
        }
        
        setMemberships(fetchedMemberships);
        
        if (active) {
          setActiveMembership(active);
          if (pathname === '/login' || pathname === '/signup') {
            router.push('/dashboard');
          }
        } else {
          setActiveMembership(null);
          // NO REDIRECT TO /connection-test
        }
      } catch (e) {
        console.error('AuthGuard: Failed to check membership.', e);
        setActiveMembership(null);
        setMemberships([]);
        // NO REDIRECT TO /connection-test
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
