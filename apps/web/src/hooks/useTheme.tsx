import React, { createContext, useContext, useMemo } from 'react';
import { colors } from '../theme/colors';
import type { ColorPalette } from '../theme/types';

interface ThemeContextValue {
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextValue>({ colors });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(() => ({ colors }), []);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
