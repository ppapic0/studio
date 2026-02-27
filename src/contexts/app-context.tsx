'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type CenterMembership = {
  id: string; // This is the centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any; // Firestore Timestamp
  linkedStudentIds?: string[];
};

interface AppContextType {
  memberships: CenterMembership[];
  setMemberships: (memberships: CenterMembership[]) => void;
  activeMembership: CenterMembership | null;
  setActiveMembership: (membership: CenterMembership | null) => void;
  membershipsLoading: boolean;
  setMembershipsLoading: (loading: boolean) => void;
  
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
  const [memberships, setMemberships] = useState<CenterMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<CenterMembership | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(true);

  // Timer States
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [lastActiveCheckTime, setLastActiveCheckTime] = useState<number | null>(null);

  // Initial Sync with LocalStorage
  useEffect(() => {
    const savedStartTime = localStorage.getItem('study_start_time');
    const savedCheckTime = localStorage.getItem('study_last_check_time');
    
    if (savedStartTime) {
      const start = parseInt(savedStartTime, 10);
      setStartTime(start);
      setIsTimerActive(true);
      
      // Calculate initial elapsed
      const elapsed = Math.floor((Date.now() - start) / 1000);
      setSecondsElapsed(elapsed);
    }

    if (savedCheckTime) {
      setLastActiveCheckTime(parseInt(savedCheckTime, 10));
    }
  }, []);

  // Background Timer Ticking
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setSecondsElapsed(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  // Persist State Changes
  useEffect(() => {
    if (isTimerActive && startTime) {
      localStorage.setItem('study_start_time', startTime.toString());
    } else {
      localStorage.removeItem('study_start_time');
    }
  }, [isTimerActive, startTime]);

  useEffect(() => {
    if (lastActiveCheckTime) {
      localStorage.setItem('study_last_check_time', lastActiveCheckTime.toString());
    } else {
      localStorage.removeItem('study_last_check_time');
    }
  }, [lastActiveCheckTime]);

  return (
    <AppContext.Provider
      value={{
        memberships,
        setMemberships,
        activeMembership,
        setActiveMembership,
        membershipsLoading,
        setMembershipsLoading,
        isTimerActive,
        setIsTimerActive,
        secondsElapsed,
        setSecondsElapsed,
        startTime,
        setStartTime,
        lastActiveCheckTime,
        setLastActiveCheckTime
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
