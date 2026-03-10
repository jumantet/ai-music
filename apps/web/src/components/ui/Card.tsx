import React, { useMemo } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, radius } from '../../theme';
import type { ColorPalette } from '../../theme';

type PaddingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  noPadding?: boolean;
  padding?: PaddingSize;
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      // Subtle shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    elevated: {
      backgroundColor: colors.bgCard,
      shadowOpacity: 0.10,
      shadowRadius: 10,
    },
    noPadding: {
      padding: 0,
    },
  });

export function Card({ children, style, elevated = false, noPadding = false, padding }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const paddingOverride = padding ? { padding: spacing[padding] } : undefined;

  return (
    <View
      style={[
        styles.card,
        elevated ? styles.elevated : undefined,
        noPadding ? styles.noPadding : undefined,
        paddingOverride,
        style,
      ]}
    >
      {children}
    </View>
  );
}
