export const palette = {
  forest900: '#06261C',
  forest800: '#0B3D2E',
  forest700: '#145C45',
  forest600: '#1F7A5A',
  sage500: '#3FA87A',
  sage300: '#8FD4B0',
  sage100: '#D8F3E6',
  mist50: '#F3F8F5',
  mist100: '#E7F1EB',
  gold500: '#D4920A',
  gold400: '#E8A317',
  gold200: '#F5D78A',
  ink900: '#14201B',
  ink700: '#2C3B34',
  ink500: '#5A6B62',
  ink300: '#9AABA2',
  ink100: '#D5DFD9',
  white: '#FFFFFF',
  danger: '#C23B3B',
  success: '#1B8A55',
  warning: '#C47B0A',
};

export const lightColors = {
  mode: 'light' as const,
  background: palette.mist50,
  backgroundAlt: palette.mist100,
  surface: palette.white,
  surfaceElevated: palette.white,
  text: palette.ink900,
  textSecondary: palette.ink500,
  textMuted: palette.ink300,
  primary: palette.forest700,
  primarySoft: palette.sage100,
  accent: palette.gold400,
  accentSoft: '#FFF4D6',
  border: palette.ink100,
  tabBar: palette.white,
  tabInactive: palette.ink500,
  danger: palette.danger,
  success: palette.success,
  warning: palette.warning,
  gradientTop: '#C8E8D6',
  gradientMid: '#F3F8F5',
  gradientBottom: '#EEF6F1',
  heroOverlay: 'rgba(11, 61, 46, 0.78)',
  inputBg: '#F7FBF8',
  shadow: 'rgba(11, 61, 46, 0.12)',
};

export const darkColors = {
  mode: 'dark' as const,
  background: palette.forest900,
  backgroundAlt: '#0A3226',
  surface: '#0F3F30',
  surfaceElevated: '#14503C',
  text: '#F2FBF6',
  textSecondary: '#B7CFC3',
  textMuted: '#7E9B8D',
  primary: palette.sage300,
  primarySoft: '#174A38',
  accent: palette.gold200,
  accentSoft: '#3A2E12',
  border: '#1F5A45',
  tabBar: '#0A2E22',
  tabInactive: '#7E9B8D',
  danger: '#F07171',
  success: '#5DDB9A',
  warning: '#F0B35A',
  gradientTop: '#083224',
  gradientMid: '#06261C',
  gradientBottom: '#041C15',
  heroOverlay: 'rgba(4, 28, 21, 0.72)',
  inputBg: '#0C3528',
  shadow: 'rgba(0, 0, 0, 0.35)',
};

export type AppColors = {
  mode: 'light' | 'dark';
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  accent: string;
  accentSoft: string;
  border: string;
  tabBar: string;
  tabInactive: string;
  danger: string;
  success: string;
  warning: string;
  gradientTop: string;
  gradientMid: string;
  gradientBottom: string;
  heroOverlay: string;
  inputBg: string;
  shadow: string;
};
