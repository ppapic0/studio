import type { User } from 'firebase/auth';

import { AUTH_SESSION_API_ROUTE } from '@/lib/auth-session-shared';
import { getSafeErrorMessage } from '@/lib/exposed-error';

const AUTH_SESSION_REQUEST_TIMEOUT_MS = 5000;

type SessionRouteResponse = {
  ok?: boolean;
  message?: string;
};

function resolveSessionRouteMessage(payload: SessionRouteResponse | null, fallback: string) {
  return getSafeErrorMessage(payload?.message, fallback);
}

function createTimeoutError(message: string) {
  return Object.assign(new Error(message), {
    code: 'auth/session-timeout',
  });
}

async function resolveIdTokenWithTimeout(user: User) {
  let timeoutId: number | null = null;

  try {
    return await Promise.race([
      user.getIdToken(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(createTimeoutError('인증 토큰을 준비하는 데 시간이 오래 걸리고 있습니다.'));
        }, AUTH_SESSION_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function createServerAuthSession(user: User) {
  const idToken = await resolveIdTokenWithTimeout(user);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(createTimeoutError('인증 세션을 준비하는 데 시간이 오래 걸리고 있습니다.'));
  }, AUTH_SESSION_REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(AUTH_SESSION_API_ROUTE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ idToken }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw createTimeoutError('인증 세션을 준비하는 데 시간이 오래 걸리고 있습니다.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  let payload: SessionRouteResponse | null = null;
  try {
    payload = (await response.json()) as SessionRouteResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(resolveSessionRouteMessage(payload, '서버 인증 세션을 준비하지 못했습니다.'));
  }

  return payload;
}

export async function clearServerAuthSession() {
  await fetch(AUTH_SESSION_API_ROUTE, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
}
