'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CenterMembership = {
  id: string; // This is the centerId
  role: 'student' | 'teacher' | 'parent' | 'centerAdmin';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: any; // Firestore Timestamp
};

interface AppContextType {
  memberships: CenterMembership[];
  setMemberships: (memberships: CenterMembership[]) => void;
  activeMembership: CenterMembership | null;
  setActiveMembership: (membership: CenterMembership | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<CenterMembership[]>([]);
  const [activeMembership, setActiveMembership] = useState<CenterMembership | null>(null);

  return (
    <AppContext.Provider
      value={{
        memberships,
        setMemberships,
        activeMembership,
        setActiveMembership,
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
