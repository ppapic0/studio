type TierLike = {
  bg?: string;
} | null | undefined;

export type TierTheme = {
  heroGradient: string;
  heroBorder: string;
  chipBg: string;
  chipBorder: string;
  subtleBg: string;
  subtleBorder: string;
  sessionBg: string;
};

const THEMES = {
  bronze: {
    heroGradient: 'linear-gradient(152deg, #D88134 0%, #B35F24 38%, #7E3E18 72%, #4A220F 100%)',
    heroBorder: '#A45524',
    chipBg: 'rgba(103,53,26,0.74)',
    chipBorder: 'rgba(249,204,167,0.46)',
    subtleBg: 'rgba(129,68,34,0.62)',
    subtleBorder: 'rgba(248,197,153,0.44)',
    sessionBg: 'rgba(96,46,22,0.76)',
  },
  silver: {
    heroGradient: 'linear-gradient(152deg, #99A6B6 0%, #758398 36%, #536178 68%, #2F394A 100%)',
    heroBorder: '#6E7D92',
    chipBg: 'rgba(76,89,109,0.74)',
    chipBorder: 'rgba(219,228,239,0.48)',
    subtleBg: 'rgba(95,111,133,0.6)',
    subtleBorder: 'rgba(204,217,231,0.46)',
    sessionBg: 'rgba(63,75,95,0.76)',
  },
  gold: {
    heroGradient: 'linear-gradient(152deg, #E3BC4C 0%, #C5962A 34%, #9A6E1B 68%, #614112 100%)',
    heroBorder: '#B18424',
    chipBg: 'rgba(125,90,24,0.74)',
    chipBorder: 'rgba(255,230,160,0.5)',
    subtleBg: 'rgba(152,113,31,0.62)',
    subtleBorder: 'rgba(255,224,145,0.47)',
    sessionBg: 'rgba(101,72,19,0.76)',
  },
  platinum: {
    heroGradient: 'linear-gradient(152deg, #47C6A3 0%, #2D9B80 36%, #1D6E5B 68%, #103F34 100%)',
    heroBorder: '#2D8D75',
    chipBg: 'rgba(30,98,83,0.74)',
    chipBorder: 'rgba(171,243,221,0.48)',
    subtleBg: 'rgba(43,126,106,0.6)',
    subtleBorder: 'rgba(160,238,214,0.46)',
    sessionBg: 'rgba(23,80,66,0.76)',
  },
  diamond: {
    heroGradient: 'linear-gradient(152deg, #5A87EC 0%, #3965CB 36%, #264696 68%, #142750 100%)',
    heroBorder: '#3C63BD',
    chipBg: 'rgba(39,79,170,0.74)',
    chipBorder: 'rgba(176,205,255,0.48)',
    subtleBg: 'rgba(53,94,190,0.6)',
    subtleBorder: 'rgba(166,198,255,0.46)',
    sessionBg: 'rgba(30,62,134,0.76)',
  },
  master: {
    heroGradient: 'linear-gradient(152deg, #9A5FE0 0%, #7546BE 36%, #522F8B 68%, #2C184D 100%)',
    heroBorder: '#7144B2',
    chipBg: 'rgba(87,56,146,0.74)',
    chipBorder: 'rgba(223,196,255,0.48)',
    subtleBg: 'rgba(106,70,173,0.6)',
    subtleBorder: 'rgba(212,186,255,0.46)',
    sessionBg: 'rgba(70,43,122,0.76)',
  },
  grandmaster: {
    heroGradient: 'linear-gradient(152deg, #F06D98 0%, #CD4D78 34%, #9E3458 68%, #5A1B36 100%)',
    heroBorder: '#C54870',
    chipBg: 'rgba(149,54,92,0.74)',
    chipBorder: 'rgba(255,190,219,0.48)',
    subtleBg: 'rgba(178,72,114,0.6)',
    subtleBorder: 'rgba(255,181,212,0.46)',
    sessionBg: 'rgba(121,42,75,0.76)',
  },
  challenger: {
    heroGradient: 'linear-gradient(152deg, #4EB8EE 0%, #2E8FCD 30%, #2267AB 62%, #153E73 100%)',
    heroBorder: '#2D79BC',
    chipBg: 'rgba(37,95,155,0.74)',
    chipBorder: 'rgba(181,227,255,0.5)',
    subtleBg: 'rgba(51,114,181,0.62)',
    subtleBorder: 'rgba(170,219,252,0.48)',
    sessionBg: 'rgba(30,78,126,0.76)',
  },
} satisfies Record<string, TierTheme>;

export function getTierTheme(tier: TierLike): TierTheme {
  const tone = tier?.bg ?? '';
  if (tone.includes('cyan')) return THEMES.challenger;
  if (tone.includes('rose')) return THEMES.grandmaster;
  if (tone.includes('purple')) return THEMES.master;
  if (tone.includes('blue')) return THEMES.diamond;
  if (tone.includes('emerald')) return THEMES.platinum;
  if (tone.includes('yellow')) return THEMES.gold;
  if (tone.includes('slate')) return THEMES.silver;
  return THEMES.bronze;
}
