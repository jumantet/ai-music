import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { spacing, fontSize, radius, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    bar: {
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
      flexShrink: 0,
      zIndex: 100,
    },
    logoArea: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    logoIcon: {
      width: 30,
      height: 30,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoEmoji: { fontSize: 15 },
    appName: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      letterSpacing: -0.2,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      ...(Platform.OS === 'web' ? ({ boxShadow: '0 4px 18px rgba(79,126,255,0.45)' } as any) : {}),
    },
    newBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.white,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: fonts.bold,
      fontSize: 13,
      color: colors.textPrimary,
    },
  });

export function TopBar() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.logoArea} onPress={() => router.replace('/(app)/dashboard')} activeOpacity={0.8}>
        <View style={styles.logoIcon}>
          <Text style={styles.logoEmoji}>🎵</Text>
        </View>
        <Text style={styles.appName}>PromoStudio</Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        {!isMobile && (
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => router.push('/(app)/campaigns/new')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.newBtnText}>Nouvelle vidéo</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => router.push('/(app)/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.avatar} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.avatarText}>{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
