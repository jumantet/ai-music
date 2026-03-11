import type { ColorPalette } from './types';

export const colors: ColorPalette = {
  // Royal blue — high-contrast on dark backgrounds
  primary: '#4F7EFF',
  primaryDark: '#3362E0',
  primaryLight: '#6E97FF',
  primaryBg: 'rgba(79, 126, 255, 0.14)',

  // Dark surfaces — deep navy-black with strong contrast steps
  bg: '#08080E',
  bgCard: '#111118',
  bgElevated: '#1A1A25',
  bgHover: '#22222F',
  border: '#2C2C3E',
  borderLight: '#3E3E55',

  // Text — maximum contrast on dark backgrounds
  textPrimary: '#F5F5FA',
  textSecondary: '#9898B8',
  textMuted: '#505068',
  textInverse: '#FFFFFF',

  // Status — vivid, high-contrast for dark mode
  success: '#2EE89A',
  successBg: 'rgba(46, 232, 154, 0.12)',
  warning: '#FFB020',
  warningBg: 'rgba(255, 176, 32, 0.12)',
  error: '#FF4545',
  errorBg: 'rgba(255, 69, 69, 0.12)',
  info: '#4F7EFF',
  infoBg: 'rgba(79, 126, 255, 0.12)',

  white: '#FFFFFF',
  black: '#000000',
};

// Keep aliases for compatibility
export const lightColors = colors;
export const darkColors = colors;
