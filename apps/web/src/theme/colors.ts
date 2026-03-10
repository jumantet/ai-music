import type { ColorPalette } from './types';

export const colors: ColorPalette = {
  // Royal Blue as primary
  primary: '#1A47C8',
  primaryDark: '#1138A8',
  primaryLight: '#2B5CE8',
  primaryBg: 'rgba(26, 71, 200, 0.08)',

  // Surfaces
  bg: '#FFFFFF',
  bgCard: '#F8F8F8',
  bgElevated: '#EFEFEF',
  bgHover: '#E6E6E6',
  border: '#E0E0E0',
  borderLight: '#CCCCCC',

  // Text
  textPrimary: '#0A0A0A',
  textSecondary: '#444444',
  textMuted: '#888888',
  textInverse: '#FFFFFF',

  // Status
  success: '#15522B',
  successBg: 'rgba(21, 82, 43, 0.08)',
  warning: '#CC8800',
  warningBg: 'rgba(204, 136, 0, 0.10)',
  error: '#CC0A0A',
  errorBg: 'rgba(204, 10, 10, 0.08)',
  info: '#1A47C8',
  infoBg: 'rgba(26, 71, 200, 0.08)',

  white: '#FFFFFF',
  black: '#000000',
};

// Keep aliases for compatibility
export const lightColors = colors;
export const darkColors = colors;
