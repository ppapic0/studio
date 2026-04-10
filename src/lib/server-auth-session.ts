import 'server-only';

import { cookies } from 'next/headers';

import { AUTH_SESSION_COOKIE_NAME } from '@/lib/auth-session-shared';
import { adminAuth, isMissingAdminCredentialsError } from '@/lib/firebase-admin';

type VerifiedSessionClaims = Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;

export async function getVerifiedServerSession(): Promise<VerifiedSessionClaims | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) return null;

  try {
    return await adminAuth.verifySessionCookie(sessionCookie);
  } catch (sessionCookieError) {
    if (isMissingAdminCredentialsError(sessionCookieError)) {
      throw sessionCookieError;
    }

    try {
      return await adminAuth.verifyIdToken(sessionCookie);
    } catch (idTokenError) {
      if (isMissingAdminCredentialsError(idTokenError)) {
        throw idTokenError;
      }

      return null;
    }
  }
}
