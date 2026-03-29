const MARKETING_PUBLIC_ROUTES = new Set([
  '/',
  '/experience',
  '/class',
  '/lp',
  '/center',
  '/results',
]);

const AUTH_PUBLIC_ROUTES = new Set(['/login', '/signup']);

export function isMarketingPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  if (MARKETING_PUBLIC_ROUTES.has(pathname)) return true;
  return pathname.startsWith('/consult/check');
}

export function isAuthPublicRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return AUTH_PUBLIC_ROUTES.has(pathname);
}
