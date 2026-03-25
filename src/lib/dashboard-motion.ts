'use client';

import { useEffect, useState } from 'react';

export type DashboardMotionPreset = 'default' | 'dashboard-premium';

export const STUDENT_POST_LOGIN_ENTRY_MOTION_KEY = 'track-student-dashboard-entry';
export const PARENT_POST_LOGIN_ENTRY_MOTION_KEY = 'track-parent-dashboard-entry';
export const DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS = 15000;

const DASHBOARD_MOTION_PRESET_EVENT = 'track:dashboard-motion-preset-change';

function readBodyDashboardMotionPreset(): DashboardMotionPreset {
  if (typeof document === 'undefined') return 'default';
  return document.body.dataset.dashboardMotionPreset === 'dashboard-premium'
    ? 'dashboard-premium'
    : 'default';
}

export function useResolvedDashboardMotionPreset(
  explicitPreset?: DashboardMotionPreset
): DashboardMotionPreset {
  const [resolvedPreset, setResolvedPreset] = useState<DashboardMotionPreset>(() => {
    return explicitPreset ?? readBodyDashboardMotionPreset();
  });

  useEffect(() => {
    if (explicitPreset) {
      setResolvedPreset(explicitPreset);
      return;
    }

    const syncPreset = () => setResolvedPreset(readBodyDashboardMotionPreset());

    syncPreset();
    window.addEventListener(DASHBOARD_MOTION_PRESET_EVENT, syncPreset);
    return () => window.removeEventListener(DASHBOARD_MOTION_PRESET_EVENT, syncPreset);
  }, [explicitPreset]);

  return explicitPreset ?? resolvedPreset;
}

export function setBodyDashboardMotionPreset(preset: DashboardMotionPreset) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  document.body.dataset.dashboardMotionPreset = preset;
  window.dispatchEvent(new Event(DASHBOARD_MOTION_PRESET_EVENT));
}

export function clearBodyDashboardMotionPreset() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  delete document.body.dataset.dashboardMotionPreset;
  window.dispatchEvent(new Event(DASHBOARD_MOTION_PRESET_EVENT));
}

export function hasRecentDashboardEntryMotion(
  storageKey: string,
  maxAgeMs = DASHBOARD_POST_LOGIN_ENTRY_MAX_AGE_MS
) {
  if (typeof window === 'undefined') return false;
  const timestamp = Number(window.sessionStorage.getItem(storageKey));
  return Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeMs;
}

export function setDashboardEntryMotionKeys(storageKeys: string[]) {
  if (typeof window === 'undefined') return;

  window.sessionStorage.removeItem(STUDENT_POST_LOGIN_ENTRY_MOTION_KEY);
  window.sessionStorage.removeItem(PARENT_POST_LOGIN_ENTRY_MOTION_KEY);

  const timestamp = String(Date.now());
  storageKeys.forEach((storageKey) => {
    window.sessionStorage.setItem(storageKey, timestamp);
  });
}

export function getStudentDashboardRouteKey(pathname: string): string | null {
  switch (pathname) {
    case '/dashboard':
      return 'home';
    case '/dashboard/growth':
      return 'growth';
    case '/dashboard/study-history':
      return 'study-history';
    case '/dashboard/plan':
      return 'plan';
    case '/dashboard/appointments':
      return 'appointments';
    default:
      return null;
  }
}
