import { NextRequest } from 'next/server';

import {
  applyIpRateLimit,
  forbiddenJson,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from '@/lib/api-security';
import {
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth-session-shared';
import { adminAuth } from '@/lib/firebase-admin';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export const dynamic = 'force-dynamic';

function resolveIdTokenCookieMaxAge(decodedToken: { exp?: number }) {
  if (typeof decodedToken.exp !== 'number') {
    return Math.min(AUTH_SESSION_MAX_AGE_SECONDS, 60 * 60);
  }

  const remainingSeconds = decodedToken.exp - Math.floor(Date.now() / 1000);
  return Math.max(60, Math.min(AUTH_SESSION_MAX_AGE_SECONDS, remainingSeconds));
}

export async function POST(request: NextRequest) {
  if (!hasTrustedBrowserContext(request, { allowMissingHeaders: true })) {
    return forbiddenJson('허용되지 않은 인증 요청입니다.');
  }

  const rateLimit = applyIpRateLimit(request, 'auth-session-create', {
    max: 20,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds, '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
  }

  try {
    const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
    const idToken = typeof body?.idToken === 'string' ? body.idToken.trim() : '';

    if (!idToken) {
      return noStoreJson(
        {
          ok: false,
          message: '인증 토큰이 없습니다.',
        },
        { status: 400 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(idToken);

    const response = noStoreJson({ ok: true });
    response.cookies.set(AUTH_SESSION_COOKIE_NAME, idToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: resolveIdTokenCookieMaxAge(decodedToken),
    });
    return response;
  } catch {
    return noStoreJson(
      {
        ok: false,
        message: '서버 인증 세션을 준비하지 못했습니다. 다시 로그인해 주세요.',
      },
      { status: 401 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedBrowserContext(request, { allowMissingHeaders: true })) {
    return forbiddenJson('허용되지 않은 인증 요청입니다.');
  }

  const rateLimit = applyIpRateLimit(request, 'auth-session-clear', {
    max: 60,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.ok) {
    return tooManyRequestsJson(rateLimit.retryAfterSeconds);
  }

  const response = noStoreJson({ ok: true });
  response.cookies.set(AUTH_SESSION_COOKIE_NAME, '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
