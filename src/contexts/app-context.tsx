'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, collectionGroup, onSnapshot, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin' | 'owner';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any;
  displayName?: string;
  linkedStudentIds?: string[];
  className?: string;
};

export const TIERS = [
  { name: '브론즈', min: 0, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-orange-600 via-orange-700 to-orange-900' },
  { name: '실버', min: 5000, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-slate-400 via-slate-500 to-slate-700' },
  { name: '골드', min: 10000, color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-amber-400 via-yellow-500 to-yellow-700' },
  { name: '플래티넘', min: 15000, color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-200', gradient: 'from-emerald-400 via-teal-500 to-teal-700' },
  { name: '다이아몬드', min: 20000, color: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-200', gradient: 'from-blue-400 via-indigo-500 to-indigo-700' },
  { name: '마스터', min: 25000, color: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-purple-500 via-violet-600 to-violet-800' },
  { name: '그랜드마스터', min: 25000, color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-200', gradient: 'from-rose-500 via-pink-600 to-rose-800' },
  { name: '챌린저', min: 25000, color: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-200', gradient: 'from-cyan-400 via-blue-500 to-indigo-600' },
];

interface AppContextType {
  memberships: CenterMembership[];
  activeMembership: CenterMembership | null;
  membershipsLoading: boolean;

  isTimerActive: boolean;
  setIsTimerActive: (active: boolean) => void;
  startTime: number | null;
  setStartTime: (time: number | null) => void;
  lastActiveCheckTime: number | null;
  setLastActiveCheckTime: (time: number | null) => void;

  viewMode: 'mobile' | 'desktop';
  setViewMode: (mode: 'mobile' | 'desktop') => void;

  currentTier: typeof TIERS[0];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [memberships, setMemberships] = useState<CenterMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<CenterMembership | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(true);

  const [isTimerActive, setIsTimerActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastActiveCheckTime, setLastActiveCheckTime] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop');
  const [currentTier, setCurrentTier] = useState(TIERS[0]);

  const activeMembershipRef = useRef<string | null>(null);

  const normalizeRole = (role: CenterMembership['role'] | string | undefined): CenterMembership['role'] => {
    if (role === 'owner') return 'centerAdmin';
    if (role === 'student' || role === 'teacher' || role === 'parent' || role === 'centerAdmin') return role;
    return 'student';
  };

  useEffect(() => {
    if (!user || !firestore) {
      setMemberships([]);
      setActiveMembership(null);
      setMembershipsLoading(false);
      activeMembershipRef.current = null;
      setCurrentTier(TIERS[0]);
      return;
    }

    setMembershipsLoading(true);

    let userCenterMemberships: CenterMembership[] = [];
    let memberFallbackMemberships: CenterMembership[] = [];
    const normalizeLinkedStudentIds = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    };
    const mergeMembership = (primary: CenterMembership, secondary: CenterMembership): CenterMembership => {
      const primaryLinkedIds = normalizeLinkedStudentIds(primary.linkedStudentIds);
      const secondaryLinkedIds = normalizeLinkedStudentIds(secondary.linkedStudentIds);
      const mergedLinkedIds = Array.from(new Set(primaryLinkedIds.length > 0 ? primaryLinkedIds : secondaryLinkedIds));
      return {
        ...secondary,
        ...primary,
        role: normalizeRole(primary.role || secondary.role),
        status: (primary.status || secondary.status || 'active') as CenterMembership['status'],
        joinedAt: primary.joinedAt || secondary.joinedAt,
        displayName: primary.displayName || secondary.displayName,
        className: primary.className ?? secondary.className,
        linkedStudentIds: mergedLinkedIds.length > 0 ? mergedLinkedIds : undefined,
      };
    };

    const applyMembershipState = () => {
      const map = new Map<string, CenterMembership>();

      userCenterMemberships.forEach((membership) => {
        map.set(membership.id, membership);
      });

      memberFallbackMemberships.forEach((membership) => {
        const existing = map.get(membership.id);
        if (!existing) {
          map.set(membership.id, membership);
          return;
        }

        map.set(membership.id, mergeMembership(existing, membership));
      });

      const mergedMemberships = Array.from(map.values());
      setMemberships(mergedMemberships);

      const active = mergedMemberships.find((m) => m.status === 'active') || mergedMemberships[0] || null;
      const linkedKey = active?.linkedStudentIds?.join(',') || '';
      const activeKey = active
        ? `${active.id}_${active.status}_${active.role}_${active.className || ''}_${active.displayName || ''}_${linkedKey}`
        : 'null';

      if (activeMembershipRef.current !== activeKey) {
        setActiveMembership(active);
        activeMembershipRef.current = activeKey;
      }

      setMembershipsLoading(false);
    };

    const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
    const fallbackMembersQuery = query(collectionGroup(firestore, 'members'), where('id', '==', user.uid));

    const unsubscribeUserCenters = onSnapshot(
      userCentersRef,
      (snapshot) => {
        userCenterMemberships = snapshot.docs.map((docSnap) => {
          const raw = docSnap.data() as any;
          return {
            id: docSnap.id,
            role: normalizeRole(raw.role),
            status: raw.status || 'active',
            joinedAt: raw.joinedAt,
            displayName: raw.displayName,
            linkedStudentIds: raw.linkedStudentIds,
            className: raw.className,
          } as CenterMembership;
        });

        applyMembershipState();
      },
      (error) => {
        console.error('Membership sync error:', error);
        setMembershipsLoading(false);
      }
    );

    const unsubscribeFallback = onSnapshot(
      fallbackMembersQuery,
      (snapshot) => {
        memberFallbackMemberships = snapshot.docs
          .map((docSnap) => {
            const raw = docSnap.data() as any;
            const centerId = docSnap.ref.parent.parent?.id;
            if (!centerId) return null;

            return {
              id: centerId,
              role: normalizeRole(raw.role),
              status: raw.status || 'active',
              joinedAt: raw.joinedAt,
              displayName: raw.displayName,
              linkedStudentIds: raw.linkedStudentIds,
              className: raw.className,
            } as CenterMembership;
          })
          .filter((membership): membership is CenterMembership => !!membership);

        applyMembershipState();
      },
      (error) => {
        console.warn('Membership fallback sync warning:', error);
        setMembershipsLoading(false);
      }
    );

    return () => {
      unsubscribeUserCenters();
      unsubscribeFallback();
    };
  }, [user, firestore]);

  useEffect(() => {
    if (!user || !firestore || !activeMembership || activeMembership.role !== 'student') {
      setIsTimerActive(false);
      setStartTime(null);
      return;
    }

    const centerId = activeMembership.id;
    const q = query(
      collection(firestore, 'centers', centerId, 'attendanceCurrent'),
      where('studentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setIsTimerActive(false);
        setStartTime(null);
        return;
      }

      const seat = snapshot.docs[0].data();
      if (seat?.status === 'studying' && seat.lastCheckInAt) {
        setIsTimerActive(true);
        setStartTime(seat.lastCheckInAt.toMillis());
      } else {
        setIsTimerActive(false);
        setStartTime(null);
      }
    });

    return () => unsubscribe();
  }, [user, firestore, activeMembership]);

  useEffect(() => {
    if (!user || !firestore || !activeMembership || activeMembership.role !== 'student') {
      setCurrentTier(TIERS[0]);
      return;
    }

    const centerId = activeMembership.id;
    const periodKey = format(new Date(), 'yyyy-MM');
    const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', user.uid);
    const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);

    let latestLp = 0;
    let latestRank = 999;

    const updateTierState = () => {
      if (latestLp >= 25000) {
        if (latestRank === 1) setCurrentTier(TIERS.find((t) => t.name === '챌린저')!);
        else if (latestRank === 2 || latestRank === 3) setCurrentTier(TIERS.find((t) => t.name === '그랜드마스터')!);
        else setCurrentTier(TIERS.find((t) => t.name === '마스터')!);
      } else {
        const lowerTiers = TIERS.slice(0, 5);
        const found = [...lowerTiers].reverse().find((t) => latestLp >= t.min) || TIERS[0];
        setCurrentTier(found);
      }
    };

    const unsubProgress = onSnapshot(progressRef, (snap) => {
      if (snap.exists()) {
        latestLp = snap.data().seasonLp || 0;
        updateTierState();
      }
    });

    const unsubRank = onSnapshot(rankRef, (snap) => {
      if (snap.exists()) {
        latestRank = snap.data().rank || 999;
        updateTierState();
      }
    });

    return () => {
      unsubProgress();
      unsubRank();
    };
  }, [user, firestore, activeMembership]);

  const contextValue = useMemo(
    () => ({
      memberships,
      activeMembership,
      membershipsLoading,
      isTimerActive,
      setIsTimerActive,
      startTime,
      setStartTime,
      lastActiveCheckTime,
      setLastActiveCheckTime,
      viewMode,
      setViewMode,
      currentTier,
    }),
    [
      memberships,
      activeMembership,
      membershipsLoading,
      isTimerActive,
      startTime,
      lastActiveCheckTime,
      viewMode,
      currentTier,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
}
