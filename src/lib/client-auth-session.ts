import type { User } from 'firebase/auth';

import { AUTH_SESSION_API_ROUTE } from '@/lib/auth-session-shared';
import { getSafeErrorMessage } from '@/lib/exposed-error';

type SessionRouteResponse = {
  ok?: boolean;
  message?: string;
};

function resolveSessionRouteMessage(payload: SessionRouteResponse | null, fallback: string) {
  return getSafeErrorMessage(payload?.message, fallback);
}

export async function createServerAuthSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch(AUTH_SESSION_API_ROUTE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  });

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
