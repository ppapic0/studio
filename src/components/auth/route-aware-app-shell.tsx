'use client';

import { usePathname } from 'next/navigation';

import { AppProvider } from '@/contexts/app-context';
import { isAuthPublicRoute, isMarketingPublicRoute } from '@/lib/public-routes';

import { AuthGuard } from './auth-guard';

export function RouteAwareAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isMarketingPublicRoute(pathname)) {
    return <>{children}</>;
  }

  if (isAuthPublicRoute(pathname)) {
    return <AuthGuard>{children}</AuthGuard>;
  }

  return (
    <AppProvider>
      <AuthGuard>{children}</AuthGuard>
    </AppProvider>
  );
}
