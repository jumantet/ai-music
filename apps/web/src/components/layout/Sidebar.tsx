import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import { spacing, fontSize, radius, fonts } from "../../theme";
import type { ColorPalette } from "../../theme";

interface NavItem {
  label: string;
  path: string;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}

const NAV_ITEMS_CONFIG = [
  {
    key: "sidebar.dashboard",
    path: "/dashboard",
    href: "/(app)/dashboard",
    icon: "grid-outline",
    activeIcon: "grid",
  },
  {
    key: "sidebar.campaigns",
    path: "/campaigns",
    href: "/(app)/campaigns",
    icon: "film-outline",
    activeIcon: "film",
  },
  {
    key: "sidebar.settings",
    path: "/settings",
    href: "/(app)/settings",
    icon: "settings-outline",
    activeIcon: "settings",
  },
] as const;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    sidebar: {
      width: 232,
      backgroundColor: colors.bg,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      justifyContent: "space-between",
      flexShrink: 0,
    },
    top: { flex: 1 },
    logo: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingLeft: spacing.xs,
      marginBottom: spacing.xxl,
    },
    logoIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    logoEmoji: { fontSize: 19 },
    logoTextBlock: { gap: 1 },
    logoText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      lineHeight: 18,
    },
    logoTagline: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.textMuted,
      lineHeight: 13,
    },
    nav: { gap: 2 },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm + 2,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      borderRadius: radius.md,
      position: "relative",
    },
    navItemActive: { backgroundColor: colors.primaryBg },
    navActiveBar: {
      position: "absolute",
      left: 0,
      top: 6,
      bottom: 6,
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    navLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    navLabelActive: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.white,
    },
    footer: {},
    userRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    userAvatar: {
      width: 34,
      height: 34,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    userAvatarText: {
      fontFamily: fonts.bold,
      color: colors.white,
      fontSize: fontSize.sm,
    },
    userInfo: { flex: 1, minWidth: 0 },
    userName: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.textPrimary,
    },
    planFree: {
      fontFamily: fonts.medium,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    planPro: {
      fontFamily: fonts.bold,
      fontSize: fontSize.xs,
      color: colors.primary,
    },
    logoutIcon: { padding: spacing.xs },
  });

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.sidebar}>
      <View style={styles.top}>
        <View style={styles.logo}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoEmoji}>📱</Text>
          </View>
          <View style={styles.logoTextBlock}>
            <Text style={styles.logoText}>{t("sidebar.appName")}</Text>
            <Text style={styles.logoTagline}>{t("sidebar.tagline")}</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {NAV_ITEMS_CONFIG.map((item) => {
            const isActive =
              pathname === item.path || pathname.startsWith(item.path + "/");
            return (
              <TouchableOpacity
                key={item.href}
                style={[
                  styles.navItem,
                  isActive ? styles.navItemActive : undefined,
                ]}
                onPress={() => router.push(item.href as any)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isActive ? item.activeIcon : item.icon}
                  size={20}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={isActive ? styles.navLabelActive : styles.navLabel}
                >
                  {t(item.key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        {user ? (
          <View style={styles.userRow}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user.name}
              </Text>
              <Text
                style={user.plan === "PRO" ? styles.planPro : styles.planFree}
              >
                {user.plan === "PRO" ? t("common.pro") : t("common.freePlan")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={logout}
              activeOpacity={0.7}
              style={styles.logoutIcon}
            >
              <Ionicons
                name="log-out-outline"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}
