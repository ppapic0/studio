'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, collectionGroup, getDocs, onSnapshot, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin' | 'owner';
  status: 'active' | 'pending' | 'inactive' | 'onHold' | 'withdrawn';
  joinedAt: any;
  displayName?: string;
  linkedStudentIds?: string[];
  className?: string;
  phoneNumber?: string;
};

export const TIERS = [
  { name: '\uBE0C\uB860\uC988', min: 0, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-[#D88134] via-[#B35F24] to-[#4A220F]' },
  { name: '\uC2E4\uBC84', min: 5000, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-[#99A6B6] via-[#758398] to-[#2F394A]' },
  { name: '\uACE8\uB4DC', min: 10000, color: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-200', gradient: 'from-[#E3BC4C] via-[#C5962A] to-[#614112]' },
  { name: '\uD50C\uB798\uD2F0\uB118', min: 15000, color: 'text-emerald-400', bg: 'bg-emerald-400', border: 'border-emerald-200', gradient: 'from-[#47C6A3] via-[#2D9B80] to-[#103F34]' },
  { name: '\uB2E4\uC774\uC544\uBAAC\uB4DC', min: 20000, color: 'text-blue-400', bg: 'bg-blue-400', border: 'border-blue-200', gradient: 'from-[#5A87EC] via-[#3965CB] to-[#142750]' },
  { name: '\uB9C8\uC2A4\uD130', min: 25000, color: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-200', gradient: 'from-[#9A5FE0] via-[#7546BE] to-[#2C184D]' },
  { name: '\uADF8\uB79C\uB4DC\uB9C8\uC2A4\uD130', min: 25000, color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-200', gradient: 'from-[#F06D98] via-[#CD4D78] to-[#5A1B36]' },
  { name: '\uCC4C\uB9B0\uC800', min: 25000, color: 'text-cyan-400', bg: 'bg-cyan-400', border: 'border-cyan-200', gradient: 'from-[#4EB8EE] via-[#2E8FCD] to-[#153E73]' },
];

const ACTIVE_ATTENDANCE_STATUSES = ['studying', 'away', 'break'] as const;

function getSeatActivityRank(status?: string | null): number {
  if (status === 'studying') return 0;
  if (status === 'away' || status === 'break') return 1;
  if (status === 'absent') return 3;
  return 2;
}

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

  isNativeDevice: boolean;

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
  const isNativeDevice = false;

  const activeMembershipRef = useRef<string | null>(null);

  const normalizeRole = (role: CenterMembership['role'] | string | undefined): CenterMembership['role'] => {
    if (role === 'owner' || role === 'centerManager' || role === 'admin') return 'centerAdmin';
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
        phoneNumber: primary.phoneNumber ?? secondary.phoneNumber,
        linkedStudentIds: mergedLinkedIds.length > 0 ? mergedLinkedIds : undefined,
      };
    };

    const getNormalizedStatus = (value: unknown) =>
      typeof value === 'string' ? value.trim().toLowerCase() : '';

    const hasLinkedStudents = (membership: CenterMembership) =>
      Array.isArray(membership.linkedStudentIds) &&
      membership.linkedStudentIds.some((id) => typeof id === 'string' && id.trim().length > 0);

    const getMembershipPriority = (membership: CenterMembership) => {
      const normalizedRole = normalizeRole(membership.role);
      if (normalizedRole === 'centerAdmin') return 0;
      if (normalizedRole === 'teacher') return 1;
      if (normalizedRole === 'parent' && hasLinkedStudents(membership)) return 2;
      if (normalizedRole === 'student') return 3;
      return 4;
    };

    const pickActiveMembership = (items: CenterMembership[]): CenterMembership | null => {
      if (items.length === 0) return null;

      const activeItems = items.filter((membership) => {
        const normalized = getNormalizedStatus(membership.status);
        return !normalized || normalized === 'active';
      });
      if (activeItems.length === 0) return null;

      return (
        activeItems
          .slice()
          .sort((a, b) => {
            const priorityDiff = getMembershipPriority(a) - getMembershipPriority(b);
            if (priorityDiff !== 0) return priorityDiff;

            const aJoinedAt = typeof a.joinedAt?.toMillis === 'function' ? a.joinedAt.toMillis() : 0;
            const bJoinedAt = typeof b.joinedAt?.toMillis === 'function' ? b.joinedAt.toMillis() : 0;
            return bJoinedAt - aJoinedAt;
          })[0] || null
      );
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

      const active = pickActiveMembership(mergedMemberships);
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

    // Track whether the one-time fallback has already been fetched
    let fallbackFetched = false;

    const fetchFallbackOnce = async () => {
      if (fallbackFetched) return;
      fallbackFetched = true;
      try {
        const snapshot = await getDocs(fallbackMembersQuery);
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
              phoneNumber: raw.phoneNumber,
            } as CenterMembership;
          })
          .filter((membership): membership is CenterMembership => !!membership);
        applyMembershipState();
      } catch (error: any) {
        memberFallbackMemberships = [];
        if (error?.code !== 'permission-denied') {
          console.warn('Membership fallback fetch warning:', error);
        }
        applyMembershipState();
      }
    };

    void fetchFallbackOnce();

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
            phoneNumber: raw.phoneNumber,
          } as CenterMembership;
        });

        applyMembershipState();
      },
      (error) => {
        console.error('Membership sync error:', error);
        setMembershipsLoading(false);
      }
    );

    return () => {
      unsubscribeUserCenters();
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

      const seat = [...snapshot.docs]
        .sort((a, b) => {
          const aSeat = a.data() as Record<string, any>;
          const bSeat = b.data() as Record<string, any>;
          const rankDiff = getSeatActivityRank(aSeat?.status) - getSeatActivityRank(bSeat?.status);
          if (rankDiff !== 0) return rankDiff;

          const aTime = aSeat?.lastCheckInAt?.toMillis?.() || aSeat?.updatedAt?.toMillis?.() || 0;
          const bTime = bSeat?.lastCheckInAt?.toMillis?.() || bSeat?.updatedAt?.toMillis?.() || 0;
          return bTime - aTime;
        })[0]?.data() as Record<string, any> | undefined;

      if (seat?.lastCheckInAt && ACTIVE_ATTENDANCE_STATUSES.includes(seat.status)) {
        setIsTimerActive(true);
        setStartTime(seat.lastCheckInAt.toMillis());
      } else {
        setIsTimerActive(false);
        setStartTime(null);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, firestore, activeMembership?.id, activeMembership?.role]);

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
        if (latestRank === 1) setCurrentTier(TIERS.find((t) => t.name === '\uCC4C\uB9B0\uC800')!);
        else if (latestRank === 2 || latestRank === 3) setCurrentTier(TIERS.find((t) => t.name === '\uADF8\uB79C\uB4DC\uB9C8\uC2A4\uD130')!);
        else setCurrentTier(TIERS.find((t) => t.name === '\uB9C8\uC2A4\uD130')!);
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
  }, [user?.uid, firestore, activeMembership?.id, activeMembership?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isPhoneViewport = window.matchMedia('(max-width: 768px)').matches;
    const shouldUseMobileByDefault =
      activeMembership?.role === 'parent'
      || (activeMembership?.role === 'student' && isPhoneViewport);

    if (shouldUseMobileByDefault && viewMode !== 'mobile') {
      setViewMode('mobile');
    }
  }, [activeMembership?.role, viewMode]);

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
      isNativeDevice,
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
      isNativeDevice,
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
