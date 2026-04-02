export function getHandledClientIssueMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    const trimmed = error.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      const trimmed = message.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}

export function logHandledClientIssue(label: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') return;

  const message = getHandledClientIssueMessage(error);
  if (message) {
    console.warn(label, message);
    return;
  }

  console.warn(label, error);
}
