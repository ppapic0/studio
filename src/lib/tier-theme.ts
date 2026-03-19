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
    heroGradient: 'linear-gradient(150deg, #F6B37A 0%, #E88A47 34%, #C7682E 66%, #8C3F1E 100%)',
    heroBorder: '#D7773A',
    chipBg: 'rgba(133,60,26,0.54)',
    chipBorder: 'rgba(255,223,188,0.72)',
    subtleBg: 'rgba(170,82,37,0.44)',
    subtleBorder: 'rgba(255,209,169,0.62)',
    sessionBg: 'rgba(142,66,30,0.62)',
  },
  silver: {
    heroGradient: 'linear-gradient(150deg, #EAF0F8 0%, #C5D3E5 36%, #93A8C1 68%, #5E7692 100%)',
    heroBorder: '#99AEC7',
    chipBg: 'rgba(74,98,126,0.44)',
    chipBorder: 'rgba(235,242,250,0.76)',
    subtleBg: 'rgba(102,125,151,0.4)',
    subtleBorder: 'rgba(223,234,246,0.68)',
    sessionBg: 'rgba(77,100,127,0.58)',
  },
  gold: {
    heroGradient: 'linear-gradient(150deg, #FFE59A 0%, #FFD057 30%, #E6AF28 62%, #B47912 100%)',
    heroBorder: '#E5B743',
    chipBg: 'rgba(145,98,18,0.48)',
    chipBorder: 'rgba(255,243,190,0.78)',
    subtleBg: 'rgba(179,123,24,0.42)',
    subtleBorder: 'rgba(255,231,154,0.68)',
    sessionBg: 'rgba(150,99,19,0.62)',
  },
  platinum: {
    heroGradient: 'linear-gradient(150deg, #93F0D7 0%, #4FD2B0 34%, #2AA389 66%, #14685A 100%)',
    heroBorder: '#41B69A',
    chipBg: 'rgba(22,108,90,0.5)',
    chipBorder: 'rgba(194,255,237,0.76)',
    subtleBg: 'rgba(39,143,120,0.42)',
    subtleBorder: 'rgba(173,247,224,0.66)',
    sessionBg: 'rgba(22,103,86,0.62)',
  },
  diamond: {
    heroGradient: 'linear-gradient(150deg, #9BC6FF 0%, #5E98FF 34%, #3E6EDB 64%, #2346A8 100%)',
    heroBorder: '#5F8EEC',
    chipBg: 'rgba(42,84,180,0.52)',
    chipBorder: 'rgba(198,220,255,0.76)',
    subtleBg: 'rgba(62,109,214,0.42)',
    subtleBorder: 'rgba(184,210,255,0.68)',
    sessionBg: 'rgba(44,84,173,0.62)',
  },
  master: {
    heroGradient: 'linear-gradient(150deg, #C9A2FF 0%, #A474F4 34%, #7A4FD0 66%, #4C2E8E 100%)',
    heroBorder: '#9A67DD',
    chipBg: 'rgba(90,57,156,0.52)',
    chipBorder: 'rgba(234,215,255,0.74)',
    subtleBg: 'rgba(114,73,190,0.42)',
    subtleBorder: 'rgba(224,202,255,0.66)',
    sessionBg: 'rgba(84,50,146,0.62)',
  },
  grandmaster: {
    heroGradient: 'linear-gradient(150deg, #FF9EC0 0%, #F36D98 34%, #CF3F72 66%, #8F214D 100%)',
    heroBorder: '#E25A8A',
    chipBg: 'rgba(166,44,93,0.54)',
    chipBorder: 'rgba(255,207,227,0.74)',
    subtleBg: 'rgba(197,58,109,0.42)',
    subtleBorder: 'rgba(255,193,219,0.66)',
    sessionBg: 'rgba(150,38,84,0.62)',
  },
  challenger: {
    heroGradient: 'linear-gradient(150deg, #8DE7FF 0%, #44C4F7 30%, #2D93DF 62%, #1F5FB1 100%)',
    heroBorder: '#47A8E6',
    chipBg: 'rgba(20,105,170,0.52)',
    chipBorder: 'rgba(197,238,255,0.78)',
    subtleBg: 'rgba(37,133,206,0.42)',
    subtleBorder: 'rgba(185,229,255,0.68)',
    sessionBg: 'rgba(24,100,160,0.62)',
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
