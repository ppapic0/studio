import { NextRequest } from 'next/server';

import {
  applyIdentifierRateLimit,
  applyIpRateLimit,
  clearRateLimitIdentifier,
  forbiddenJson,
  getClientIp,
  hasTrustedBrowserContext,
  noStoreJson,
  tooManyRequestsJson,
} from '@/lib/api-security';
import {
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth-session-shared';
import { firebaseConfig } from '@/firebase/config';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const LOGIN_IP_LIMIT = { max: 20, windowMs: 15 * 60 * 1000 };
const LOGIN_ACCOUNT_LIMIT = { max: 6, windowMs: 10 * 60 * 1000 };

type FirebasePasswordLoginResponse = {
  idToken?: string;
  expiresIn?: string;
};

function normalizeLoginEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizePassword(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function buildLoginScope(request: NextRequest, email: string) {
  return `${getClientIp(request)}:${email}`;
}

function resolveAuthCookieMaxAge(expiresIn: unknown) {
  const parsed = Number(expiresIn);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Math.min(AUTH_SESSION_MAX_AGE_SECONDS, 60 * 60);
  }

  return Math.max(60, Math.min(AUTH_SESSION_MAX_AGE_SECONDS, Math.floor(parsed)));
}

function resolveIdentityToolkitUrl() {
  const apiKey = firebaseConfig.apiKey;
  if (!apiKey) {
    throw new Error('Firebase API key is not configured.');
  }
  return `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
}

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!hasTrustedBrowserContext(request, { allowMissingHeaders: true })) {
    return forbiddenJson('허용되지 않은 로그인 요청입니다.');
  }

  const parsedBody = (await request.json().catch(() => null)) as
    | {
        email?: unknown;
        password?: unknown;
      }
    | null;

  const email = normalizeLoginEmail(parsedBody?.email);
  const password = normalizePassword(parsedBody?.password);

  if (!email || !password) {
    return noStoreJson(
      {
        ok: false,
        message: '이메일과 비밀번호를 모두 입력해 주세요.',
      },
      { status: 400 }
    );
  }

  const ipRateLimit = applyIpRateLimit(request, 'auth-login-ip', LOGIN_IP_LIMIT);
  if (!ipRateLimit.ok) {
    return tooManyRequestsJson(
      ipRateLimit.retryAfterSeconds,
      '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  const loginScope = buildLoginScope(request, email);
  const accountRateLimit = applyIdentifierRateLimit(
    'auth-login-account',
    loginScope,
    LOGIN_ACCOUNT_LIMIT
  );
  if (!accountRateLimit.ok) {
    return tooManyRequestsJson(
      accountRateLimit.retryAfterSeconds,
      '같은 계정으로 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  try {
    const authResponse = await fetch(resolveIdentityToolkitUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
      cache: 'no-store',
    });

    const payload = (await authResponse.json().catch(() => null)) as
      | FirebasePasswordLoginResponse
      | { error?: { message?: string } }
      | null;

    if (!authResponse.ok) {
      const firebaseError = payload && 'error' in payload ? payload.error?.message || '' : '';
      if (firebaseError === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
        return tooManyRequestsJson(
          15 * 60,
          '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.'
        );
      }

      return noStoreJson(
        {
          ok: false,
          message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        },
        { status: 401 }
      );
    }

    const idToken = payload && 'idToken' in payload ? payload.idToken?.trim() || '' : '';
    if (!idToken) {
      return noStoreJson(
        {
          ok: false,
          message: '로그인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
        },
        { status: 401 }
      );
    }

    clearRateLimitIdentifier('auth-login-account', loginScope);

    const response = noStoreJson({
      ok: true,
    });
    response.cookies.set(AUTH_SESSION_COOKIE_NAME, idToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: resolveAuthCookieMaxAge(
        payload && 'expiresIn' in payload ? payload.expiresIn : undefined
      ),
    });
    return response;
  } catch {
    return noStoreJson(
      {
        ok: false,
        message: '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 500 }
    );
  }
}
