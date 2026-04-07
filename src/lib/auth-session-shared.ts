export const AUTH_SESSION_COOKIE_NAME = 'track_auth_session';
export const AUTH_SESSION_API_ROUTE = '/api/auth/session';
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5;
export const AUTH_SESSION_MAX_AGE_MS = AUTH_SESSION_MAX_AGE_SECONDS * 1000;
export const AUTH_SESSION_SYNC_SKIP_STORAGE_KEY = 'track_auth_session_sync_skip';

export function isDashboardRoute(pathname: string | null | undefined) {
  if (!pathname) return false;
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

export function sanitizeDashboardReturnPath(candidate: string | null | undefined) {
  if (!candidate || !candidate.startsWith('/')) return '/dashboard';
  if (candidate.startsWith('//')) return '/dashboard';
  return isDashboardRoute(candidate) ? candidate : '/dashboard';
}
