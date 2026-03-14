'use client';

const VISITOR_STORAGE_KEY = 'track_marketing_visitor_id';
const SESSION_STORAGE_KEY = 'track_marketing_session_id';
const VISITOR_COOKIE = 'track_marketing_vid';
const SESSION_COOKIE = 'track_marketing_sid';

type MarketingClientEvent = {
  eventType: 'page_view' | 'login_success';
  pageType: 'landing' | 'experience' | 'login';
  mode?: string | null;
  view?: string | null;
  placement?: string | null;
  target?: string | null;
  extra?: Record<string, unknown>;
};

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

  const storedVisitor =
    window.localStorage.getItem(VISITOR_STORAGE_KEY) || readCookie(VISITOR_COOKIE);
  const visitorId = storedVisitor || buildId();

  const storedSession =
    window.sessionStorage.getItem(SESSION_STORAGE_KEY) || readCookie(SESSION_COOKIE);
  const sessionId = storedSession || buildId();

  window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);

  writeCookie(VISITOR_COOKIE, visitorId, 60 * 60 * 24 * 180);
  writeCookie(SESSION_COOKIE, sessionId);

  return { visitorId, sessionId };
}

export async function trackMarketingClientEvent(payload: MarketingClientEvent) {
  if (typeof window === 'undefined') return false;

  const identity = ensureMarketingIdentity();
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
