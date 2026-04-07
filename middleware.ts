import { NextRequest, NextResponse } from 'next/server';

const SECURITY_HEADERS: Array<[string, string]> = [
  ['X-Frame-Options', 'DENY'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'accelerometer=(), autoplay=(), geolocation=(), gyroscope=(), magnetometer=(), midi=(), usb=(), browsing-topics=()'],
  ['X-DNS-Prefetch-Control', 'off'],
  ['X-Permitted-Cross-Domain-Policies', 'none'],
  ['Origin-Agent-Cluster', '?1'],
];

function applySecurityHeaders(response: NextResponse) {
  SECURITY_HEADERS.forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }

  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NODE_ENV === 'production' && pathname.startsWith('/dev')) {
    return applySecurityHeaders(new NextResponse('Not Found', { status: 404 }));
  }

  const response = NextResponse.next();

  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
