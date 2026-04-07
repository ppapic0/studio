'use client';

import {
  MARKETING_OPT_OUT_COOKIE,
  MARKETING_OPT_OUT_STORAGE_KEY,
  MARKETING_OPT_OUT_VALUE,
  MARKETING_SESSION_COOKIE,
  MARKETING_SESSION_STORAGE_KEY,
  MARKETING_VISITOR_COOKIE,
  MARKETING_VISITOR_STORAGE_KEY,
} from '@/lib/marketing-tracking-shared';

type MarketingClientEvent = {
  eventType: 'page_view' | 'login_success';
  pageType: 'landing' | 'experience' | 'login' | 'center' | 'results';
  mode?: string | null;
  view?: string | null;
  placement?: string | null;
  target?: string | null;
  extra?: Record<string, unknown>;
};

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=`, 'path=/', 'SameSite=Lax', 'max-age=0'];
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  document.cookie = parts.join('; ');
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return '';
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || '';
}

function writeCookie(name: string, value: string, maxAgeSeconds?: number) {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=${encodeURIComponent(value)}`, 'path=/', 'SameSite=Lax'];
  if (window.location.protocol === 'https:') {
    parts.push('Secure');
  }
  if (typeof maxAgeSeconds === 'number') {
    parts.push(`max-age=${maxAgeSeconds}`);
  }
  document.cookie = parts.join('; ');
}

function clearMarketingIdentity() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(MARKETING_VISITOR_STORAGE_KEY);
  window.sessionStorage.removeItem(MARKETING_SESSION_STORAGE_KEY);
  deleteCookie(MARKETING_VISITOR_COOKIE);
  deleteCookie(MARKETING_SESSION_COOKIE);
}

function buildId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureMarketingIdentity() {
  if (typeof window === 'undefined') {
    return { visitorId: '', sessionId: '' };
  }

  if (isMarketingTrackingOptedOut()) {
    clearMarketingIdentity();
    return { visitorId: '', sessionId: '' };
  }

  const storedVisitor =
    window.localStorage.getItem(MARKETING_VISITOR_STORAGE_KEY) || readCookie(MARKETING_VISITOR_COOKIE);
  const visitorId = storedVisitor || buildId();

  const storedSession =
    window.sessionStorage.getItem(MARKETING_SESSION_STORAGE_KEY) || readCookie(MARKETING_SESSION_COOKIE);
  const sessionId = storedSession || buildId();

  window.localStorage.setItem(MARKETING_VISITOR_STORAGE_KEY, visitorId);
  window.sessionStorage.setItem(MARKETING_SESSION_STORAGE_KEY, sessionId);

  writeCookie(MARKETING_VISITOR_COOKIE, visitorId, 60 * 60 * 24 * 180);
  writeCookie(MARKETING_SESSION_COOKIE, sessionId);

  return { visitorId, sessionId };
}

export function isMarketingTrackingOptedOut() {
  if (typeof window === 'undefined') return false;
  return (
    window.localStorage.getItem(MARKETING_OPT_OUT_STORAGE_KEY) === MARKETING_OPT_OUT_VALUE ||
    readCookie(MARKETING_OPT_OUT_COOKIE) === MARKETING_OPT_OUT_VALUE
  );
}

export function setMarketingTrackingOptOut(optedOut: boolean) {
  if (typeof window === 'undefined') return;

  if (optedOut) {
    window.localStorage.setItem(MARKETING_OPT_OUT_STORAGE_KEY, MARKETING_OPT_OUT_VALUE);
    writeCookie(MARKETING_OPT_OUT_COOKIE, MARKETING_OPT_OUT_VALUE, 60 * 60 * 24 * 365);
    clearMarketingIdentity();
    return;
  }

  window.localStorage.removeItem(MARKETING_OPT_OUT_STORAGE_KEY);
  deleteCookie(MARKETING_OPT_OUT_COOKIE);
}

export async function trackMarketingClientEvent(payload: MarketingClientEvent) {
  if (typeof window === 'undefined') return false;
  if (isMarketingTrackingOptedOut()) return false;

  const identity = ensureMarketingIdentity();
  if (!identity.visitorId || !identity.sessionId) return false;
  const body = JSON.stringify({
    ...payload,
    ...identity,
    pathname: window.location.pathname,
    search: window.location.search,
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const accepted = navigator.sendBeacon('/api/marketing-events', blob);
      if (accepted) return true;
    }

    await fetch('/api/marketing-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
    return true;
  } catch (error) {
    console.error('[marketing-tracking] event failed', error);
    return false;
  }
}
