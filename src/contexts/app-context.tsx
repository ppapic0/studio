
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any;
  displayName?: string;
  linkedStudentIds?: string[];
};

export type ViewMode = 'responsive' | 'mobile';

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

  const activeMembershipRef = useRef<string | null>(null);

  useEffect(() => {
    // Load view mode from local storage (UI preference is fine to keep global)
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

  // Timer Persistence Sync - User-Specific Keys
  useEffect(() => {
    // 사용자가 로그아웃하거나 바뀌면 이전 사용자의 타이머 상태를 클라이언트 메모리에서 즉시 초기화
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
    setLastActiveCheckTime
  }), [
    memberships, 
    activeMembership, 
    membershipsLoading, 
    viewMode,
    isTimerActive, 
    startTime, 
    lastActiveCheckTime
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
