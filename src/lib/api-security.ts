import 'server-only';

import { NextResponse } from 'next/server';

type RequestLike = Pick<Request, 'headers' | 'url'>;

type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const globalRateLimitState = globalThis as typeof globalThis & {
  __trackRateLimitStore?: Map<string, RateLimitBucket>;
};

function getRateLimitStore() {
  if (!globalRateLimitState.__trackRateLimitStore) {
    globalRateLimitState.__trackRateLimitStore = new Map<string, RateLimitBucket>();
  }

  const now = Date.now();
  for (const [key, bucket] of globalRateLimitState.__trackRateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      globalRateLimitState.__trackRateLimitStore.delete(key);
    }
  }

  return globalRateLimitState.__trackRateLimitStore;
}

export function getRequestOrigin(request: RequestLike) {
  try {
    return new URL(request.url).origin;
  } catch {
    return '';
  }
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function buildOrigin(protocol: string | null | undefined, host: string | null | undefined) {
  const normalizedProtocol = protocol?.split(',')[0]?.trim().replace(/:$/, '');
  const normalizedHost = host?.split(',')[0]?.trim();
  if (!normalizedProtocol || !normalizedHost) return '';
  return normalizeOrigin(`${normalizedProtocol}://${normalizedHost}`);
}

function getTrustedOrigins(request: RequestLike) {
  const trustedOrigins = new Set<string>();
  const requestOrigin = getRequestOrigin(request);

  if (requestOrigin) {
    trustedOrigins.add(requestOrigin);
  }

  const requestProtocol = requestOrigin ? new URL(requestOrigin).protocol.replace(/:$/, '') : null;
  const hostHeader = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');

  const hostOrigin = buildOrigin(forwardedProto || requestProtocol, hostHeader);
  if (hostOrigin) {
    trustedOrigins.add(hostOrigin);
  }

  const forwardedOrigin = buildOrigin(forwardedProto || requestProtocol, forwardedHost);
  if (forwardedOrigin) {
    trustedOrigins.add(forwardedOrigin);
  }

  const configuredOrigins = [
    process.env.APP_ORIGIN,
    process.env.NEXT_PUBLIC_APP_ORIGIN,
    process.env.NEXT_PUBLIC_SITE_URL,
  ];

  configuredOrigins.forEach((origin) => {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      trustedOrigins.add(normalized);
    }
  });

  return trustedOrigins;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

function isTrustedOrigin(candidateOrigin: string, trustedOrigins: Set<string>) {
  const normalizedCandidate = normalizeOrigin(candidateOrigin);
  if (!normalizedCandidate) return false;
  if (trustedOrigins.has(normalizedCandidate)) return true;

  let candidateUrl: URL;
  try {
    candidateUrl = new URL(normalizedCandidate);
  } catch {
    return false;
  }

  for (const trustedOrigin of trustedOrigins) {
    try {
      const trustedUrl = new URL(trustedOrigin);
      const isLoopbackPair =
        LOOPBACK_HOSTS.has(candidateUrl.hostname.toLowerCase()) &&
        LOOPBACK_HOSTS.has(trustedUrl.hostname.toLowerCase());

      if (
        isLoopbackPair &&
        candidateUrl.protocol === trustedUrl.protocol &&
        candidateUrl.port === trustedUrl.port
      ) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function getClientIp(request: RequestLike) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const forwardedIp = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);
    if (forwardedIp) return forwardedIp;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown';
}

export function applyIpRateLimit(
  request: RequestLike,
  key: string,
  options: RateLimitOptions,
) {
  const store = getRateLimitStore();
  const now = Date.now();
  const bucketKey = `${key}:${getClientIp(request)}`;
  const existing = store.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    store.set(bucketKey, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      ok: true,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  store.set(bucketKey, existing);

  return {
    ok: existing.count <= options.max,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function hasTrustedBrowserContext(
  request: RequestLike,
  options?: { allowMissingHeaders?: boolean },
) {
  const allowMissingHeaders = options?.allowMissingHeaders !== false;
  const trustedOrigins = getTrustedOrigins(request);
  const secFetchSite = request.headers.get('sec-fetch-site');

  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    return false;
  }

  const origin = request.headers.get('origin');
  if (origin && !isTrustedOrigin(origin, trustedOrigins)) {
    return false;
  }

  const referer = request.headers.get('referer');
  if (referer && !isTrustedOrigin(referer, trustedOrigins)) {
    return false;
  }

  if (!origin && !referer && !allowMissingHeaders) {
    return false;
  }

  return true;
}

export function noStoreJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

export function tooManyRequestsJson(retryAfterSeconds: number, message?: string) {
  const response = noStoreJson(
    {
      ok: false,
      message: message || '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    },
    { status: 429 },
  );
  response.headers.set('Retry-After', String(Math.max(1, retryAfterSeconds)));
  return response;
}

export function forbiddenJson(message?: string) {
  return noStoreJson(
    {
      ok: false,
      message: message || '허용되지 않은 요청입니다.',
    },
    { status: 403 },
  );
}
