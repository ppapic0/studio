'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type DetailPresentationMode = 'default' | 'student-analysis';

const StudentDetailPresentationModeContext = createContext<DetailPresentationMode>('default');

export function StudentDetailPresentationProvider({
  value,
  children,
}: {
  value: DetailPresentationMode;
  children: ReactNode;
}) {
  return (
    <StudentDetailPresentationModeContext.Provider value={value}>
      {children}
    </StudentDetailPresentationModeContext.Provider>
  );
}

export function useStudentDetailPresentationMode() {
  return useContext(StudentDetailPresentationModeContext);
}
