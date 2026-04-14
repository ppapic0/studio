import type { SupportedUniversityThemeKey } from '@/lib/types';

type UniversityThemeDefinition = {
  key: SupportedUniversityThemeKey;
  label: string;
  shortLabel: string;
  primary: string;
  primaryDeep: string;
  accent: string;
  accentSoft?: string;
  sourceUrl: string;
  aliases: string[];
};

type UniversityThemeCssVars = Record<`--${string}`, string>;

type UniversityThemeShellStyles = {
  dashboardBackdropMobile: string;
  dashboardBackdropDesktop: string;
  dotColor: string;
  dotOpacityMobile: string;
  dotOpacityDesktop: string;
  overlayGlow: string;
  mobileShellBackground: string;
  desktopShellBackground: string;
  mobileBorderColor: string;
  mobileRingColor: string;
};

const DEFAULT_THEME = {
  label: '기본 테마',
  shortLabel: '기본',
  primary: '#17326B',
  primaryDeep: '#0D1C45',
  accent: '#FF8A1F',
  accentSoft: '#FFD89F',
  sourceUrl: 'https://identity.snu.ac.kr/',
} as const;

// Source URLs point to official university brand / UI / symbol pages gathered on 2026-04-14.
// When a school publishes exact RGB values, the primary/accent colors below use those official values.
// `primaryDeep` and some `accentSoft` entries remain UI support tones derived from the official palette.
export const UNIVERSITY_THEMES: Record<SupportedUniversityThemeKey, UniversityThemeDefinition> = {
  'seoul-national': {
    key: 'seoul-national',
    label: '서울대학교',
    shortLabel: '서울대',
    primary: '#0F0F70',
    primaryDeep: '#090944',
    accent: '#DCDAB2',
    accentSoft: '#F0EEDC',
    sourceUrl: 'https://identity.snu.ac.kr/color/1',
    aliases: ['서울대학교', '서울대', 'snu'],
  },
  yonsei: {
    key: 'yonsei',
    label: '연세대학교',
    shortLabel: '연세대',
    primary: '#0F4C81',
    primaryDeep: '#0A2F59',
    accent: '#4F86B8',
    accentSoft: '#A8C6E4',
    sourceUrl: 'https://designcenter.yonsei.ac.kr/designcenter/index.do',
    aliases: ['연세대학교', '연세대', 'yonsei'],
  },
  korea: {
    key: 'korea',
    label: '고려대학교',
    shortLabel: '고려대',
    primary: '#8C2332',
    primaryDeep: '#5B1620',
    accent: '#BE5D6D',
    accentSoft: '#E2B0B9',
    sourceUrl: 'https://gpa.korea.ac.kr/koreaSejong/7784/subview.do',
    aliases: ['고려대학교', '고려대', 'korea'],
  },
  sogang: {
    key: 'sogang',
    label: '서강대학교',
    shortLabel: '서강대',
    primary: '#8E1F3F',
    primaryDeep: '#5C1028',
    accent: '#C46C87',
    accentSoft: '#E7B4C3',
    sourceUrl: 'https://www.sogang.ac.kr/intro/symbol/data/Sogang_UI_renewal.pdf',
    aliases: ['서강대학교', '서강대', 'sogang'],
  },
  sungkyunkwan: {
    key: 'sungkyunkwan',
    label: '성균관대학교',
    shortLabel: '성균관대',
    primary: '#072A60',
    primaryDeep: '#04183A',
    accent: '#ACB600',
    accentSoft: '#78BE20',
    sourceUrl: 'https://www.skku.edu/skku/about/skkui/skkui.do',
    aliases: ['성균관대학교', '성균관대', 'skku'],
  },
  hanyang: {
    key: 'hanyang',
    label: '한양대학교',
    shortLabel: '한양대',
    primary: '#1D2475',
    primaryDeep: '#12194F',
    accent: '#F2931E',
    accentSoft: '#A6CE39',
    sourceUrl: 'https://www.hanyang.ac.kr/web/eng/colors-fonts',
    aliases: ['한양대학교', '한양대', 'hanyang'],
  },
  'chung-ang': {
    key: 'chung-ang',
    label: '중앙대학교',
    shortLabel: '중앙대',
    primary: '#004B8D',
    primaryDeep: '#002E62',
    accent: '#6CA7DB',
    accentSoft: '#B8D4EE',
    sourceUrl: 'https://newsites.cau.ac.kr/02_intro/symbol_color.php',
    aliases: ['중앙대학교', '중앙대', 'chungang', 'cau'],
  },
  'kyung-hee': {
    key: 'kyung-hee',
    label: '경희대학교',
    shortLabel: '경희대',
    primary: '#9E1B32',
    primaryDeep: '#69111F',
    accent: '#D37A8C',
    accentSoft: '#EDC0C8',
    sourceUrl: 'https://www.khu.ac.kr/kor/user/bbs/BMSR00040/view.do',
    aliases: ['경희대학교', '경희대', '경희', 'khu'],
  },
  hufs: {
    key: 'hufs',
    label: '한국외국어대학교',
    shortLabel: '한국외대',
    primary: '#146E7A',
    primaryDeep: '#002D56',
    accent: '#A7A9AC',
    accentSoft: '#D6D7D9',
    sourceUrl: 'https://www.hufs.ac.kr/user/indexSub.action?codyMenuSeq=34529&siteId=hufseng&menuType=T&uId=4',
    aliases: ['한국외국어대학교', '한국외대', '외대', 'hufs'],
  },
  'seoul-city': {
    key: 'seoul-city',
    label: '서울시립대학교',
    shortLabel: '서울시립대',
    primary: '#004094',
    primaryDeep: '#00285C',
    accent: '#00B398',
    accentSoft: '#9CDBD9',
    sourceUrl: 'https://www.uos.ac.kr/kor/html/auos/symbol/ui/ui3.do?identified=anonymous',
    aliases: ['서울시립대학교', '서울시립대', '시립대', 'uos'],
  },
  konkuk: {
    key: 'konkuk',
    label: '건국대학교',
    shortLabel: '건국대',
    primary: '#00857C',
    primaryDeep: '#005A54',
    accent: '#67B7B0',
    accentSoft: '#B8E3DE',
    sourceUrl: 'https://www.konkuk.ac.kr/do/Contents/BrandColor.do',
    aliases: ['건국대학교', '건국대', 'konkuk', 'ku'],
  },
  dongguk: {
    key: 'dongguk',
    label: '동국대학교',
    shortLabel: '동국대',
    primary: '#E17100',
    primaryDeep: '#A84F00',
    accent: '#FFB562',
    accentSoft: '#FFD9AD',
    sourceUrl: 'https://www.dongguk.edu/article/SCH_SYMBOL/detail/3643611',
    aliases: ['동국대학교', '동국대', 'dongguk'],
  },
  hongik: {
    key: 'hongik',
    label: '홍익대학교',
    shortLabel: '홍익대',
    primary: '#D62828',
    primaryDeep: '#941B1B',
    accent: '#F08C8C',
    accentSoft: '#F7C7C7',
    sourceUrl: 'https://www.hongik.ac.kr/kr/introduction/color.do',
    aliases: ['홍익대학교', '홍익대', 'hongik'],
  },
  kookmin: {
    key: 'kookmin',
    label: '국민대학교',
    shortLabel: '국민대',
    primary: '#004F9F',
    primaryDeep: '#00356D',
    accent: '#FFCE44',
    accentSoft: '#F3953F',
    sourceUrl: 'https://www.kookmin.ac.kr/comm/menu/user/0a4f7cf187cc3164678352bc3f4575b3/content/index.do',
    aliases: ['국민대학교', '국민대', 'kookmin'],
  },
  soongsil: {
    key: 'soongsil',
    label: '숭실대학교',
    shortLabel: '숭실대',
    primary: '#006E93',
    primaryDeep: '#004C66',
    accent: '#02A6CB',
    accentSoft: '#62C6C4',
    sourceUrl: 'https://ssu.ac.kr/%EC%88%AD%EC%8B%A4%EB%8C%80%ED%95%99%EA%B5%90%EC%9D%98-%EC%83%81%EC%A7%95/ui-color/',
    aliases: ['숭실대학교', '숭실대', 'soongsil', 'ssu'],
  },
  sejong: {
    key: 'sejong',
    label: '세종대학교',
    shortLabel: '세종대',
    primary: '#C3002F',
    primaryDeep: '#7B001E',
    accent: '#51626F',
    accentSoft: '#D5D6D2',
    sourceUrl: 'https://www.sejong.ac.kr/news/promotion/basic-element.do',
    aliases: ['세종대학교', '세종대', 'sejong'],
  },
  dankook: {
    key: 'dankook',
    label: '단국대학교',
    shortLabel: '단국대',
    primary: '#003B82',
    primaryDeep: '#002857',
    accent: '#6B9CD5',
    accentSoft: '#B5D0EE',
    sourceUrl: 'https://www.dankook.ac.kr/web/kor/-496',
    aliases: ['단국대학교', '단국대', 'dankook'],
  },
};

export const UNIVERSITY_THEME_OPTIONS = [
  { value: 'default', label: DEFAULT_THEME.label },
  ...([
    'seoul-national',
    'yonsei',
    'korea',
    'sogang',
    'sungkyunkwan',
    'hanyang',
    'chung-ang',
    'kyung-hee',
    'hufs',
    'seoul-city',
    'konkuk',
    'dongguk',
    'hongik',
    'kookmin',
    'soongsil',
    'sejong',
    'dankook',
  ] as SupportedUniversityThemeKey[]).map((key) => ({
    value: key,
    label: UNIVERSITY_THEMES[key].label,
  })),
] as const;

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  const compact = normalized.length === 3
    ? normalized.split('').map((channel) => `${channel}${channel}`).join('')
    : normalized;
  const parsed = Number.parseInt(compact, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => clampChannel(value).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(baseHex: string, targetHex: string, targetWeight: number) {
  const safeWeight = Math.max(0, Math.min(1, targetWeight));
  const base = hexToRgb(baseHex);
  const target = hexToRgb(targetHex);
  return rgbToHex(
    base.r + ((target.r - base.r) * safeWeight),
    base.g + ((target.g - base.g) * safeWeight),
    base.b + ((target.b - base.b) * safeWeight),
  );
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

function normalizeUniversityText(raw?: string | null) {
  return (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/대학교/g, '대')
    .replace(/대학/g, '대');
}

export function isSupportedUniversityThemeKey(value: unknown): value is SupportedUniversityThemeKey {
  return typeof value === 'string' && value in UNIVERSITY_THEMES;
}

export function normalizeUniversityThemeLabel(raw?: string | null): SupportedUniversityThemeKey | null {
  const normalized = normalizeUniversityText(raw);
  if (!normalized) return null;

  for (const theme of Object.values(UNIVERSITY_THEMES)) {
    const aliases = theme.aliases.map((alias) => normalizeUniversityText(alias));
    if (aliases.some((alias) => alias.length > 0 && (normalized === alias || normalized.startsWith(alias)))) {
      return theme.key;
    }
  }

  return null;
}

export function resolveUniversityThemeKey({
  explicitThemeKey,
  goalPathType,
  goalPathLabel,
}: {
  explicitThemeKey?: SupportedUniversityThemeKey | null;
  goalPathType?: 'school' | 'job' | null;
  goalPathLabel?: string | null;
}): SupportedUniversityThemeKey | null {
  if (isSupportedUniversityThemeKey(explicitThemeKey)) return explicitThemeKey;
  if (goalPathType === 'job') return null;
  return normalizeUniversityThemeLabel(goalPathLabel);
}

export function getUniversityTheme(themeKey?: SupportedUniversityThemeKey | null) {
  return themeKey ? UNIVERSITY_THEMES[themeKey] : DEFAULT_THEME;
}

export function getUniversityThemeCssVars(themeKey?: SupportedUniversityThemeKey | null): UniversityThemeCssVars {
  const theme = getUniversityTheme(themeKey);
  const primary = theme.primary;
  const primaryDeep = theme.primaryDeep;
  const accent = theme.accent;
  const accentSoft = theme.accentSoft ?? mixHex(accent, '#FFFFFF', 0.46);
  const lightSurface = mixHex('#FFFFFF', primary, 0.045);
  const secondarySurface = mixHex('#FFFFFF', primary, 0.075);
  const fixedTextPrimary = '#14295F';
  const fixedTextSecondary = '#365377';
  const fixedTextMuted = '#5F7698';
  const fixedTextOnAccent = '#FFFAF5';
  const fixedAccentText = '#FF8A1F';
  const fixedAccentTextSoft = '#FFD89F';
  const fixedAccentTextMuted = '#FFC98F';
  const cardSecondary = mixHex(primaryDeep, primary, 0.5);
  const panel = mixHex(primaryDeep, primary, 0.28);
  const panelSoft = mixHex(primaryDeep, accent, 0.16);
  const chartBlue = mixHex(primary, '#7EC4FF', 0.38);
  const chartMint = mixHex(accent, '#6BE0B9', 0.28);
  const chartAmber = mixHex(accent, '#FFD97D', 0.42);
  const chartLavender = mixHex(primary, '#B4B2FF', 0.42);
  const accentStrong = mixHex(accent, primaryDeep, 0.2);

  return {
    '--bg-app': secondarySurface,
    '--bg-surface-1': '#FFFFFF',
    '--bg-surface-2': lightSurface,
    '--bg-card-primary': primaryDeep,
    '--bg-card-secondary': cardSecondary,
    '--bg-card-highlight': accent,
    '--surface-primary-gradient': `linear-gradient(180deg, ${mixHex(primary, '#FFFFFF', 0.08)} 0%, ${primaryDeep} 100%)`,
    '--surface-secondary-gradient': `linear-gradient(180deg, ${mixHex(primary, '#FFFFFF', 0.12)} 0%, ${mixHex(primaryDeep, primary, 0.26)} 100%)`,
    '--surface-highlight-gradient': `linear-gradient(180deg, ${mixHex(accentSoft, '#FFFFFF', 0.16)} 0%, ${accent} 100%)`,
    '--surface-light-gradient': `linear-gradient(180deg, #FFFFFF 0%, ${lightSurface} 100%)`,
    '--text-primary': fixedTextPrimary,
    '--text-secondary': fixedTextSecondary,
    '--text-muted': fixedTextMuted,
    '--text-on-dark': '#F7FBFF',
    '--text-on-dark-soft': 'rgba(247, 251, 255, 0.84)',
    '--text-on-dark-muted': 'rgba(247, 251, 255, 0.62)',
    '--text-on-light': fixedTextPrimary,
    '--text-on-accent': fixedTextOnAccent,
    '--text-accent-fixed': fixedAccentText,
    '--text-accent-soft-fixed': fixedAccentTextSoft,
    '--text-accent-muted-fixed': fixedAccentTextMuted,
    '--border-subtle': rgba(primary, 0.12),
    '--border-strong': rgba(primary, 0.24),
    '--accent-orange': accent,
    '--accent-orange-soft': accentSoft,
    '--accent-orange-strong': accentStrong,
    '--accent-orange-surface': rgba(accent, 0.14),
    '--accent-orange-surface-strong': rgba(accent, 0.22),
    '--accent-orange-border': rgba(accent, 0.32),
    '--accent-orange-shadow': `0 18px 34px -20px ${rgba(accent, 0.42)}`,
    '--accent-orange-shadow-soft': rgba(accent, 0.24),
    '--accent-blue': chartBlue,
    '--chart-1': accent,
    '--chart-2': chartBlue,
    '--chart-3': chartMint,
    '--chart-4': chartAmber,
    '--chart-5': chartLavender,
    '--glow-orange': rgba(accent, 0.34),
    '--glow-blue': rgba(primary, 0.22),
    '--shadow-accent': `0 18px 34px -20px ${rgba(accent, 0.42)}`,
    '--student-night-bg': primaryDeep,
    '--student-night-bg-soft': mixHex(primaryDeep, primary, 0.34),
    '--student-night-panel': panel,
    '--student-night-panel-soft': panelSoft,
    '--student-night-border': 'rgba(255, 255, 255, 0.08)',
    '--student-night-text': '#FFFFFF',
    '--student-night-text-soft': 'rgba(255, 255, 255, 0.82)',
    '--student-night-text-muted': 'rgba(255, 255, 255, 0.58)',
    '--student-night-text-disabled': 'rgba(255, 255, 255, 0.35)',
    '--student-night-orange': accent,
    '--student-night-gold': accentSoft,
    '--student-panel-glow': rgba(accent, 0.12),
    '--student-panel-glow-strong': rgba(accent, 0.18),
  };
}

export function getUniversityThemeShellStyles(themeKey?: SupportedUniversityThemeKey | null): UniversityThemeShellStyles {
  const theme = getUniversityTheme(themeKey);
  const primary = theme.primary;
  const primaryDeep = theme.primaryDeep;
  const accent = theme.accent;

  return {
    dashboardBackdropMobile: `radial-gradient(circle at top, ${rgba(accent, 0.12)} 0%, transparent 18%), radial-gradient(circle at 78% 14%, ${rgba(primary, 0.08)} 0%, transparent 22%), linear-gradient(180deg, #ffffff 0%, ${mixHex('#FFFFFF', primary, 0.04)} 45%, ${mixHex('#FFFFFF', primary, 0.08)} 100%)`,
    dashboardBackdropDesktop: `radial-gradient(circle at top, ${rgba(accent, 0.1)} 0%, transparent 16%), linear-gradient(180deg, #ffffff 0%, ${mixHex('#FFFFFF', primary, 0.04)} 48%, ${mixHex('#FFFFFF', primary, 0.08)} 100%)`,
    dotColor: rgba(primaryDeep, 0.95),
    dotOpacityMobile: '0.04',
    dotOpacityDesktop: '0.035',
    overlayGlow: `radial-gradient(circle at 20% 0%, ${rgba(accent, 0.12)}, transparent 34%), radial-gradient(circle at 78% 85%, ${rgba(primary, 0.08)}, transparent 38%)`,
    mobileShellBackground: `radial-gradient(circle at top, ${rgba(accent, 0.1)} 0%, transparent 18%), radial-gradient(circle at 78% 14%, ${rgba(primary, 0.06)} 0%, transparent 22%), linear-gradient(180deg, #ffffff 0%, ${mixHex('#FFFFFF', primary, 0.04)} 45%, ${mixHex('#FFFFFF', primary, 0.08)} 100%)`,
    desktopShellBackground: `radial-gradient(circle at top, ${rgba(accent, 0.08)} 0%, transparent 16%), linear-gradient(180deg, #ffffff 0%, ${mixHex('#FFFFFF', primary, 0.04)} 48%, ${mixHex('#FFFFFF', primary, 0.08)} 100%)`,
    mobileBorderColor: primaryDeep,
    mobileRingColor: rgba(accent, 0.12),
  };
}
