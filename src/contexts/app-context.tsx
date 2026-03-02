
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { format } from 'date-fns';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any;
  displayName?: string;
  linkedStudentIds?: string[];
};

export type ViewMode = 'responsive' | 'mobile';

export const TIERS = [
  { name: '브론즈', min: 0, color: 'text-orange-700', bg: 'bg-orange-700', border: 'border-orange-200', gradient: 'from-orange-600 via-orange-700 to-orange-900' },
  { name: '실버', min: 5000, color: 'text-slate-300', bg: 'bg-slate-300', border: 'border-slate-100', gradient: 'from-blue-300 via-slate-400 to-slate-600' },
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
  
  // View Mode
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Timer Global State
  isTimerActive: boolean;
  setIsTimerActive: (active: boolean) => void;
  startTime: number | null;
  setStartTime: (time: number | null) => void;
  lastActiveCheckTime: number | null;
  setLastActiveCheckTime: (time: number | null) => void;

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
  
  const [viewMode, setViewModeState] = useState<ViewMode>('responsive');

  // Timer States
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastActiveCheckTime, setLastActiveCheckTime] = useState<number | null>(null);

  // Tier State
  const [currentTier, setCurrentTier] = useState(TIERS[0]);

  const activeMembershipRef = useRef<string | null>(null);

  useEffect(() => {
    const savedMode = localStorage.getItem('app_view_mode') as ViewMode;
    if (savedMode) setViewModeState(savedMode);
  }, []);

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('app_view_mode', mode);
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

    let progressData: any = null;
    let rankData: any = null;

    const updateTier = () => {
      const lp = progressData?.seasonLp || 0;
      const rank = rankData?.rank || 999;

      // 엘리트 티어 기준을 25,000점으로 조정
      if (lp >= 25000) {
        if (rank === 1) setCurrentTier(TIERS.find(t => t.name === '챌린저')!);
        else if (rank === 2 || rank === 3) setCurrentTier(TIERS.find(t => t.name === '그랜드마스터')!);
        else setCurrentTier(TIERS.find(t => t.name === '마스터')!);
      } else {
        // 하위 티어 (브론즈~다이아몬드)
        const found = TIERS.slice(0, 5).reverse().find(t => lp >= t.min) || TIERS[0];
        setCurrentTier(found);
      }
    };

    const unsubProgress = onSnapshot(progressRef, (snap) => {
      if (snap.exists()) {
        progressData = snap.data();
        updateTier();
      }
    });

    const unsubRank = onSnapshot(rankRef, (snap) => {
      if (snap.exists()) {
        rankData = snap.data();
        updateTier();
      }
    });

    return () => {
      unsubProgress();
      unsubRank();
    };
  }, [user, firestore, activeMembership]);

  // Timer Persistence Sync - User-Specific Keys
  useEffect(() => {
    setIsTimerActive(false);
    setStartTime(null);
    setLastActiveCheckTime(null);

    if (user) {
      const savedStartTime = localStorage.getItem(`study_start_time_${user.uid}`);
      const savedCheckTime = localStorage.getItem(`study_last_check_time_${user.uid}`);
      
      if (savedStartTime) {
        setStartTime(parseInt(savedStartTime, 10));
        setIsTimerActive(true);
      }
      if (savedCheckTime) setLastActiveCheckTime(parseInt(savedCheckTime, 10));
    }
  }, [user?.uid]);

  // Save Timer State - User-Specific Keys
  useEffect(() => {
    if (!user) return;

    const startTimeKey = `study_start_time_${user.uid}`;
    const checkTimeKey = `study_last_check_time_${user.uid}`;

    if (isTimerActive && startTime) {
      localStorage.setItem(startTimeKey, startTime.toString());
    } else {
      localStorage.removeItem(startTimeKey);
    }

    if (lastActiveCheckTime) {
      localStorage.setItem(checkTimeKey, lastActiveCheckTime.toString());
    } else {
      localStorage.removeItem(checkTimeKey);
    }
  }, [isTimerActive, startTime, lastActiveCheckTime, user?.uid]);

  const contextValue = useMemo(() => ({
    memberships,
    activeMembership,
    membershipsLoading,
    viewMode,
    setViewMode,
    isTimerActive,
    setIsTimerActive,
    startTime,
    setStartTime,
    lastActiveCheckTime,
    setLastActiveCheckTime,
    currentTier
  }), [
    memberships, 
    activeMembership, 
    membershipsLoading, 
    viewMode,
    isTimerActive, 
    startTime, 
    lastActiveCheckTime,
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
