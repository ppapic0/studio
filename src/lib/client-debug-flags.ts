'use client';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const STRICT_FIRESTORE_ERRORS_STORAGE_KEY = 'track:strict-firestore-errors';

export function shouldUseStrictFirestorePermissionErrors() {
  if (typeof window === 'undefined') return false;

  try {
    const override = window.localStorage.getItem(STRICT_FIRESTORE_ERRORS_STORAGE_KEY);
    if (override === 'true') return true;
    if (override === 'false') return false;
  } catch {
    // Ignore localStorage access failures and fall back to hostname detection.
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  return LOOPBACK_HOSTS.has(hostname);
}
