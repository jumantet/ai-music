import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { radius, fontSize, spacing, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    base: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.full,
    },
    fullWidth: { width: '100%' },
    disabled: { opacity: 0.4 },

    primary: { backgroundColor: colors.primary },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.error },

    size_sm: {
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      paddingTop: spacing.xs + 2,
      paddingBottom: spacing.xs + 2,
      minHeight: 32,
    },
    size_md: {
      paddingLeft: spacing.lg,
      paddingRight: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
      minHeight: 40,
    },
    size_lg: {
      paddingLeft: spacing.xl,
      paddingRight: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      minHeight: 48,
    },

    label: { fontFamily: fonts.bold, letterSpacing: 0.3 },
    labelSize_sm: { fontSize: fontSize.sm },
    labelSize_md: { fontSize: fontSize.sm },
    labelSize_lg: { fontSize: fontSize.md },

    labelVariant_primary: { color: colors.textInverse },
    labelVariant_secondary: { color: colors.textPrimary },
    labelVariant_ghost: { color: colors.primary },
    labelVariant_danger: { color: colors.white },
  });

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}`],
        fullWidth ? styles.fullWidth : undefined,
        isDisabled ? styles.disabled : undefined,
        style,
      ]}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.textPrimary}
        />
      ) : (
        <Text style={[styles.label, styles[`labelSize_${size}`], styles[`labelVariant_${variant}`]]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
