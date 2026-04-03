export type ExperienceMode = 'student' | 'parent' | 'admin';

export type MarketingEntryTarget = 'experience' | 'login';

type MarketingEntryOptions = {
  placement?: string;
  mode?: ExperienceMode;
  view?: 'mobile' | 'desktop';
};

export function normalizeExperienceMode(
  value: string | string[] | undefined,
): ExperienceMode {
  const mode = Array.isArray(value) ? value[0] : value;

  switch (mode) {
    case 'parent':
      return 'parent';
    case 'admin':
      return 'admin';
    default:
      return 'student';
  }
}

export function buildMarketingEntryHref(
  target: MarketingEntryTarget,
  options: MarketingEntryOptions = {},
) {
  const params = new URLSearchParams();

  if (options.placement) {
    params.set('placement', options.placement);
  }

  if (options.mode) {
    params.set('mode', options.mode);
  }

  if (options.view) {
    params.set('view', options.view);
  }

  const query = params.toString();
  return query ? `/go/${target}?${query}` : `/go/${target}`;
}

export function buildExperiencePageHref(mode?: ExperienceMode) {
  if (!mode) {
    return '/experience';
  }

  const params = new URLSearchParams({ mode });
  return `/experience?${params.toString()}`;
}
