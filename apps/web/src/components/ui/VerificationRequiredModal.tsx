import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { RESEND_VERIFICATION_MUTATION } from '../../graphql/mutations';
import { spacing, fontSize, radius, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      width: '100%',
      maxWidth: 400,
      gap: spacing.md,
    },
    icon: {
      fontSize: 32,
      textAlign: 'center',
    },
    title: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    resendBtn: {
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    resendBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.white,
    },
    dismissBtn: {
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    dismissBtnText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    successText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.success,
      textAlign: 'center',
    },
    errorText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.error,
      textAlign: 'center',
    },
  });

export function VerificationRequiredModal() {
  const { showVerificationModal, dismissVerificationModal } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [resend, { loading }] = useMutation(RESEND_VERIFICATION_MUTATION);

  async function handleResend() {
    setSendError(false);
    try {
      await resend();
      setSent(true);
    } catch {
      setSendError(true);
    }
  }

  function handleDismiss() {
    setSent(false);
    setSendError(false);
    dismissVerificationModal();
  }

  return (
    <Modal visible={showVerificationModal} transparent animationType="fade" onRequestClose={handleDismiss}>
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.icon}>✉️</Text>
              <Text style={styles.title}>{t('auth.verificationModal.title')}</Text>
              <Text style={styles.body}>{t('auth.verificationModal.body')}</Text>

              {sent && <Text style={styles.successText}>{t('auth.verificationModal.sent')}</Text>}
              {sendError && <Text style={styles.errorText}>{t('auth.verificationModal.error')}</Text>}

              {!sent && (
                <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.resendBtnText}>{t('auth.verificationModal.resend')}</Text>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss}>
                <Text style={styles.dismissBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
