import React, { useState, useMemo } from 'react';
import { View, TextInput, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, radius, fontSize, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    wrapper: { gap: spacing.xs },
    label: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      backgroundColor: colors.bgElevated,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      minHeight: 44,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.error,
    },
    multiline: {
      minHeight: 96,
      textAlignVertical: 'top',
      paddingTop: spacing.sm + 2,
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.error,
    },
  });

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  error,
  multiline = false,
  numberOfLines,
  style,
}: InputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[
          styles.input,
          focused ? styles.inputFocused : undefined,
          error ? styles.inputError : undefined,
          multiline ? styles.multiline : undefined,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}
