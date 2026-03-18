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
    heroGradient: 'linear-gradient(145deg, #E56817 0%, #BE4D11 45%, #672D0E 100%)',
    heroBorder: '#B84B1A',
    chipBg: 'rgba(111,45,18,0.72)',
    chipBorder: 'rgba(255,181,132,0.45)',
    subtleBg: 'rgba(143,57,23,0.58)',
    subtleBorder: 'rgba(246,170,125,0.45)',
    sessionBg: 'rgba(112,43,18,0.72)',
  },
  silver: {
    heroGradient: 'linear-gradient(145deg, #607287 0%, #475A72 45%, #24374B 100%)',
    heroBorder: '#596D86',
    chipBg: 'rgba(58,73,93,0.74)',
    chipBorder: 'rgba(201,214,230,0.45)',
    subtleBg: 'rgba(71,90,114,0.58)',
    subtleBorder: 'rgba(190,206,223,0.45)',
    sessionBg: 'rgba(47,61,80,0.72)',
  },
  gold: {
    heroGradient: 'linear-gradient(145deg, #D79B1B 0%, #A77315 45%, #5E410E 100%)',
    heroBorder: '#B98616',
    chipBg: 'rgba(118,81,14,0.74)',
    chipBorder: 'rgba(255,219,128,0.45)',
    subtleBg: 'rgba(145,103,20,0.58)',
    subtleBorder: 'rgba(255,217,125,0.45)',
    sessionBg: 'rgba(97,67,12,0.72)',
  },
  platinum: {
    heroGradient: 'linear-gradient(145deg, #14A76D 0%, #0E7E54 45%, #0A4B33 100%)',
    heroBorder: '#0F8E5F',
    chipBg: 'rgba(9,101,70,0.74)',
    chipBorder: 'rgba(145,242,207,0.45)',
    subtleBg: 'rgba(13,126,84,0.58)',
    subtleBorder: 'rgba(145,242,207,0.45)',
    sessionBg: 'rgba(8,83,56,0.72)',
  },
  diamond: {
    heroGradient: 'linear-gradient(145deg, #2D61D8 0%, #2047A3 45%, #102557 100%)',
    heroBorder: '#2A58C8',
    chipBg: 'rgba(18,71,166,0.74)',
    chipBorder: 'rgba(152,193,255,0.45)',
    subtleBg: 'rgba(36,78,176,0.58)',
    subtleBorder: 'rgba(152,193,255,0.45)',
    sessionBg: 'rgba(17,55,124,0.72)',
  },
  master: {
    heroGradient: 'linear-gradient(145deg, #7B3FC4 0%, #5A2F98 45%, #2E1952 100%)',
    heroBorder: '#7240B3',
    chipBg: 'rgba(76,40,139,0.74)',
    chipBorder: 'rgba(206,171,255,0.45)',
    subtleBg: 'rgba(95,52,165,0.58)',
    subtleBorder: 'rgba(206,171,255,0.45)',
    sessionBg: 'rgba(61,33,112,0.72)',
  },
  grandmaster: {
    heroGradient: 'linear-gradient(145deg, #E55185 0%, #B43663 45%, #611C40 100%)',
    heroBorder: '#CD4A79',
    chipBg: 'rgba(152,42,88,0.74)',
    chipBorder: 'rgba(255,169,204,0.45)',
    subtleBg: 'rgba(186,63,110,0.58)',
    subtleBorder: 'rgba(255,169,204,0.45)',
    sessionBg: 'rgba(122,34,71,0.72)',
  },
  challenger: {
    heroGradient: 'linear-gradient(145deg, #1A5CCF 0%, #143F9A 45%, #0B2358 100%)',
    heroBorder: '#1F5AC5',
    chipBg: 'rgba(19,70,167,0.74)',
    chipBorder: 'rgba(149,196,255,0.45)',
    subtleBg: 'rgba(27,81,188,0.58)',
    subtleBorder: 'rgba(149,196,255,0.45)',
    sessionBg: 'rgba(13,47,111,0.72)',
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
