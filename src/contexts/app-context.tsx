
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, onSnapshot, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
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
  
  // Timer Global State
  isTimerActive: boolean;
  setIsTimerActive: (active: boolean) => void;
  startTime: number | null;
  setStartTime: (time: number | null) => void;
  lastActiveCheckTime: number | null;
  setLastActiveCheckTime: (time: number | null) => void;

  // View Mode (App Mode Toggle)
  viewMode: 'mobile' | 'desktop';
  setViewMode: (mode: 'mobile' | 'desktop') => void;

  // Global Tier State
  currentTier: typeof TIERS[0];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [memberships, setMemberships] = useState<CenterMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<CenterMembership | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  
  // Timer States
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastActiveCheckTime, setLastActiveCheckTime] = useState<number | null>(null);

  // View Mode State
  const [viewMode, setViewMode] = useState<'mobile' | 'desktop'>('desktop');

  // Tier State (Default to Bronze)
  const [currentTier, setCurrentTier] = useState(TIERS[0]);

  const activeMembershipRef = useRef<string | null>(null);

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
    const userCentersRef = collection(firestore, 'userCenters', user.uid, 'centers');
    
    const unsubscribe = onSnapshot(userCentersRef, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CenterMembership));

      setMemberships(fetched);
      const active = fetched.find(m => m.status === 'active') || fetched[0] || null;
      
      const activeKey = active ? `${active.id}_${active.status}_${active.role}` : 'null';
      if (activeMembershipRef.current !== activeKey) {
        setActiveMembership(active);
        activeMembershipRef.current = activeKey;
      }
      
      setMembershipsLoading(false);
    }, (error) => {
      console.error("Membership sync error:", error);
      setMembershipsLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // 실시간 티어 동기화 (학생인 경우에만)
  useEffect(() => {
    if (!user || !firestore || !activeMembership || activeMembership.role !== 'student') {
      setCurrentTier(TIERS[0]);
      return;
    }

    const centerId = activeMembership.id;
    const periodKey = format(new Date(), 'yyyy-MM');
    const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', user.uid);
    const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_lp`, 'entries', user.uid);

    let currentLp = 0;
    let currentRank = 999;

    const updateTierState = (lp: number, rank: number) => {
      if (lp >= 25000) {
        if (rank === 1) setCurrentTier(TIERS.find(t => t.name === '챌린저')!);
        else if (rank === 2 || rank === 3) setCurrentTier(TIERS.find(t => t.name === '그랜드마스터')!);
        else setCurrentTier(TIERS.find(t => t.name === '마스터')!);
      } else {
        const found = [...TIERS.slice(0, 5)].reverse().find(t => lp >= t.min) || TIERS[0];
        setCurrentTier(found);
      }
    };

    const unsubProgress = onSnapshot(progressRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        currentLp = data.seasonLp || 0;
        updateTierState(currentLp, currentRank);
      }
    });

    const unsubRank = onSnapshot(rankRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        currentRank = data.rank || 999;
        updateTierState(currentLp, currentRank);
      }
    });

    return () => {
      unsubProgress();
      unsubRank();
    };
  }, [user, firestore, activeMembership]);

  const contextValue = useMemo(() => ({
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
    currentTier
  }), [
    memberships, 
    activeMembership, 
    membershipsLoading, 
    isTimerActive, 
    startTime, 
    lastActiveCheckTime,
    viewMode,
    currentTier
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
}
