export interface ColorPalette {
  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryBg: string;

  // Surface
  bg: string;
  bgCard: string;
  bgElevated: string;
  bgHover: string;
  border: string;
  borderLight: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;

  // Status
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  error: string;
  errorBg: string;
  info: string;
  infoBg: string;

  white: string;
  black: string;
}

export type ThemeMode = 'light' | 'dark';
