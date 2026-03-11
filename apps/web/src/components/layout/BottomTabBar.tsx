import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks/useTheme";
import { fontSize, fonts } from "../../theme";
import type { ColorPalette } from "../../theme";

const NAV_ITEMS = [
  {
    key: "sidebar.dashboard",
    path: "/dashboard",
    href: "/(app)/dashboard",
    icon: "home-outline" as const,
    activeIcon: "home" as const,
  },
  {
    key: "sidebar.releases",
    path: "/releases",
    href: "/(app)/releases",
    icon: "musical-notes-outline" as const,
    activeIcon: "musical-notes" as const,
  },
  {
    key: "sidebar.contacts",
    path: "/contacts",
    href: "/(app)/contacts",
    icon: "people-outline" as const,
    activeIcon: "people" as const,
  },
  {
    key: "sidebar.settings",
    path: "/settings",
    href: "/(app)/settings",
    icon: "settings-outline" as const,
    activeIcon: "settings" as const,
  },
] as const;

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
      paddingBottom: Platform.OS === "ios" ? 20 : 0,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 10,
      paddingBottom: 10,
      gap: 3,
    },
    label: {
      fontSize: fontSize.xs,
    },
  });

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.bar}>
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.path || pathname.startsWith(item.path + "/");
        return (
          <TouchableOpacity
            key={item.href}
            style={styles.tab}
            onPress={() => router.push(item.href as any)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? item.activeIcon : item.icon}
              size={22}
              color={isActive ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? colors.primary : colors.textMuted,
                  fontFamily: isActive ? fonts.semiBold : fonts.regular,
                },
              ]}
            >
              {t(item.key)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
