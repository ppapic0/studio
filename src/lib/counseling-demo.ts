export type OperationalExclusions = {
  rankings?: boolean;
  sms?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function isCounselingDemoId(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.startsWith('counseling-demo-') ||
    normalized.startsWith('demo-counseling-')
  );
}

export function isCounselingDemoRecord(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) return false;

  if (record.isCounselingDemo === true) {
    return true;
  }

  const accountKind = typeof record.accountKind === 'string' ? record.accountKind.trim().toLowerCase() : '';
  return accountKind === 'counseling-demo' || accountKind === 'counseling_demo';
}

export function readOperationalExclusions(value: unknown): OperationalExclusions {
  const record = asRecord(value);
  const raw = asRecord(record?.operationalExclusions);

  return {
    rankings: raw?.rankings === true || raw?.competition === true,
    sms: raw?.sms === true || raw?.messages === true,
  };
}

export function shouldExcludeFromCompetitionTrack(value: unknown, id?: unknown): boolean {
  const exclusions = readOperationalExclusions(value);
  return isCounselingDemoId(id) || isCounselingDemoRecord(value) || exclusions.rankings === true;
}

export function shouldExcludeFromSmsQueries(value: unknown, id?: unknown): boolean {
  const exclusions = readOperationalExclusions(value);
  return isCounselingDemoId(id) || isCounselingDemoRecord(value) || exclusions.sms === true;
}
