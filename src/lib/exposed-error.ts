const EXPOSED_ERROR_FALLBACK = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';

const SENSITIVE_EXPOSED_MESSAGE_PATTERNS = [
  /\b(firebase|firestore|identitytoolkit|googleapis|gstatic)\b/i,
  /\b(auth|functions)\/[a-z0-9-]+/i,
  /\b(permission[-_ ]?denied|failed[-_ ]?precondition|invalid[-_ ]?argument|already[-_ ]?exists|deadline[-_ ]?exceeded|unauthenticated|internal|not[-_ ]found)\b/i,
  /\b(api[_ -]?key|apikey|secret|token|credential|service account|bearer|project[_ -]?id)\b/i,
  /\bhttp\s*\d{3}\b/i,
  /https?:\/\//i,
  /\bmissing or insufficient permissions\b/i,
  /\bat\s+\S+:\d+:\d+/i,
  /firebaseerror:/i,
];

function coerceErrorCandidates(error: unknown): string[] {
  const candidates: string[] = [];

  if (typeof error === 'string') {
    candidates.push(error);
  }

  if (error && typeof error === 'object') {
    const record = error as {
      message?: unknown;
      details?: unknown;
    };

    if (typeof record.details === 'string') {
      candidates.push(record.details);
    } else if (record.details && typeof record.details === 'object') {
      const details = record.details as { userMessage?: unknown; message?: unknown; error?: unknown };
      if (typeof details.userMessage === 'string') candidates.push(details.userMessage);
      if (typeof details.message === 'string') candidates.push(details.message);
      if (typeof details.error === 'string') candidates.push(details.error);
    }

    if (typeof record.message === 'string') {
      candidates.push(record.message);
    }
  }

  return candidates;
}

function normalizeExposedMessage(raw: string): string {
  return raw
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^\d+\s+FAILED_PRECONDITION:?\s*/i, '')
    .replace(/^\d+\s+INVALID_ARGUMENT:?\s*/i, '')
    .replace(/^\d+\s+ALREADY_EXISTS:?\s*/i, '')
    .replace(/^\d+\s+PERMISSION_DENIED:?\s*/i, '')
    .replace(/^\d+\s+INTERNAL:?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSensitiveExposedMessage(message: string): boolean {
  const normalized = normalizeExposedMessage(message);
  if (!normalized) return true;
  if (normalized.length > 180) return true;
  if (normalized.includes('\n')) return true;
  return SENSITIVE_EXPOSED_MESSAGE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function getSafeErrorMessage(error: unknown, fallback = EXPOSED_ERROR_FALLBACK): string {
  for (const candidate of coerceErrorCandidates(error)) {
    const normalized = normalizeExposedMessage(candidate);
    if (!normalized) continue;
    if (isSensitiveExposedMessage(normalized)) continue;
    return normalized;
  }

  return fallback;
}
