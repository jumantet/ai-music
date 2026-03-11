import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useMutation } from "@apollo/client";
import { useTranslation } from "react-i18next";
import { RESEND_VERIFICATION_MUTATION } from "../../graphql/mutations";
import { useTheme } from "../../hooks/useTheme";
import { spacing, fontSize, radius, fonts } from "../../theme";
import type { ColorPalette } from "../../theme";

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.warning,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      marginBottom: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      flexWrap: "wrap",
    },
    text: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textPrimary,
      flex: 1,
    },
    link: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.white,
      textDecorationLine: "underline",
    },
  });

export function UnverifiedBanner() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [sent, setSent] = useState(false);
  const [resend] = useMutation(RESEND_VERIFICATION_MUTATION);

  async function handleResend() {
    try {
      await resend();
      setSent(true);
    } catch {
      // ignore
    }
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {sent
          ? t("auth.unverifiedBanner.sent")
          : t("auth.unverifiedBanner.prompt")}
      </Text>
      {!sent && (
        <TouchableOpacity onPress={handleResend}>
          <Text style={styles.link}>{t("auth.unverifiedBanner.resend")}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
