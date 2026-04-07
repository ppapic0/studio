import { getSafeErrorMessage, isSensitiveExposedMessage } from '@/lib/exposed-error';

export function getHandledClientIssueMessage(error: unknown): string | null {
  const sanitized = getSafeErrorMessage(error, '');
  return sanitized || null;
}

export function logHandledClientIssue(label: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') return;

  const message = getHandledClientIssueMessage(error);
  if (message) {
    console.warn(label, message);
    return;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const rawMessage = String((error as { message?: unknown }).message || '').trim();
    if (rawMessage && isSensitiveExposedMessage(rawMessage)) {
      console.warn(label, '[redacted]');
      return;
    }
  }

  console.warn(label, '[redacted]');
}
