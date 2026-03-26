import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { Button, Input } from '../../src/components/ui';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.xl,
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
    },
    header: { alignItems: 'center', marginBottom: spacing.xxl, gap: spacing.sm },
    logo: {
      width: 64,
      height: 64,
      borderRadius: radius.xl,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    logoText: { fontSize: 32 },
    title: { fontFamily: fonts.extraBold, fontSize: fontSize.xxl, color: colors.textPrimary },
    subtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSecondary },
    form: { gap: spacing.md },
    errorBox: {
      backgroundColor: colors.errorBg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.error,
    },
    errorText: { color: colors.error, fontSize: fontSize.sm, fontFamily: fonts.regular },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
    footerText: { fontFamily: fonts.regular, color: colors.textSecondary, fontSize: fontSize.sm },
    footerLink: { fontFamily: fonts.bold, color: colors.primary, fontSize: fontSize.sm },
  });

export default function SignupScreen() {
  const { signup } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    if (!email || !password) {
      setError(t('auth.signup.errorEmpty'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.signup.errorPassword'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signup(email, password);
    } catch (e) {
      setError((e as Error).message ?? t('auth.signup.errorFallback'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>🎵</Text>
          </View>
          <Text style={styles.title}>{t('auth.signup.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.signup.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input
            label={t('auth.signup.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={t('auth.signup.emailPlaceholder')}
          />
          <Input
            label={t('auth.signup.passwordLabel')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('auth.signup.passwordPlaceholder')}
          />

          <Button label={t('auth.signup.submit')} onPress={handleSignup} loading={loading} fullWidth size="lg" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.signup.hasAccount')}</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>{t('auth.signup.loginLink')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
