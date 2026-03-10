import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing, radius, fontSize, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignSelf: 'flex-start',
      alignItems: 'center',
      borderRadius: radius.full,
      paddingLeft: spacing.sm,
      paddingRight: spacing.sm,
      paddingTop: spacing.xs - 2,
      paddingBottom: spacing.xs - 2,
    },
    text: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      letterSpacing: 0.5,
    },
    default: { backgroundColor: colors.bgElevated },
    defaultText: { color: colors.textSecondary },
    success: { backgroundColor: colors.successBg },
    successText: { color: colors.success },
    warning: { backgroundColor: colors.warningBg },
    warningText: { color: colors.warning },
    error: { backgroundColor: colors.errorBg },
    errorText: { color: colors.error },
    info: { backgroundColor: colors.infoBg },
    infoText: { color: colors.info },
  });

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.badge, styles[variant]]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text>
    </View>
  );
}

import type { OutreachStatus } from '@toolkit/shared';

const STATUS_VARIANT: Record<OutreachStatus, BadgeVariant> = {
  NOT_CONTACTED: 'default',
  SENT: 'info',
  REPLIED: 'warning',
  FEATURED: 'success',
};

const STATUS_LABEL: Record<OutreachStatus, string> = {
  NOT_CONTACTED: 'Not contacted',
  SENT: 'Sent',
  REPLIED: 'Replied',
  FEATURED: 'Featured',
};

export function OutreachStatusBadge({ status }: { status: OutreachStatus }) {
  return <Badge label={STATUS_LABEL[status]} variant={STATUS_VARIANT[status]} />;
}
