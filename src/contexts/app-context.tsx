'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

export type CenterMembership = {
  id: string; // centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any;
  displayName?: string;
};

interface AppContextType {
  memberships: CenterMembership[];
  activeMembership: CenterMembership | null;
  membershipsLoading: boolean;
  
  // Timer Global State
  isTimerActive: boolean;
  setIsTimerActive: (active: boolean) => void;
  secondsElapsed: number;
  setSecondsElapsed: (seconds: number | ((prev: number) => number)) => void;
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

  // Timer States
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastActiveCheckTime, setLastActiveCheckTime] = useState<number | null>(null);

  // 멤버십 데이터 실시간 동기화
  useEffect(() => {
    if (!user || !firestore) {
      setMemberships([]);
      setActiveMembership(null);
      setMembershipsLoading(false);
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
      
      // Only update if the ID has changed or it's the first load to prevent flickering
      setActiveMembership(prev => {
        if (!prev && active) return active;
        if (prev && active && prev.id === active.id && prev.status === active.status) return prev;
        return active;
      });
      
      setMembershipsLoading(false);
    }, (error) => {
      console.error("Membership sync error:", error);
      setMembershipsLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  // Timer LocalStorage Sync
  useEffect(() => {
    const savedStartTime = localStorage.getItem('study_start_time');
    const savedCheckTime = localStorage.getItem('study_last_check_time');
    
    if (savedStartTime) {
      const start = parseInt(savedStartTime, 10);
      setStartTime(start);
      setIsTimerActive(true);
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSecondsElapsed(elapsed);
    }
    if (savedCheckTime) setLastActiveCheckTime(parseInt(savedCheckTime, 10));
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      interval = setInterval(() => {
        setSecondsElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  useEffect(() => {
    if (isTimerActive && startTime) {
      localStorage.setItem('study_start_time', startTime.toString());
    } else {
      localStorage.removeItem('study_start_time');
    }
  }, [isTimerActive, startTime]);

  // Memoize context value to prevent unnecessary re-renders of the entire app
  const contextValue = useMemo(() => ({
    memberships,
    activeMembership,
    membershipsLoading,
    isTimerActive,
    setIsTimerActive,
    secondsElapsed,
    setSecondsElapsed,
    startTime,
    setStartTime,
    lastActiveCheckTime,
    setLastActiveCheckTime
  }), [
    memberships, 
    activeMembership, 
    membershipsLoading, 
    isTimerActive, 
    secondsElapsed, 
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