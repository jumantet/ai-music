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
import { Link, useLocalSearchParams } from 'expo-router';
import { ApolloError } from '@apollo/client';
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
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
      gap: spacing.sm,
    },
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

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const redirectPath = typeof redirect === 'string' ? redirect : undefined;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) { setError(t('auth.login.errorEmpty')); return; }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      if (e instanceof ApolloError) {
        const code = e.graphQLErrors[0]?.extensions?.code;
        if (code === 'LOGIN_NO_PASSWORD') {
          setError(t('auth.login.errorNoPassword'));
          return;
        }
      }
      setError((e as Error).message ?? t('auth.login.errorFallback'));
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
          <Text style={styles.title}>{t('auth.login.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input label={t('auth.login.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder={t('auth.login.emailPlaceholder')} />
          <Input label={t('auth.login.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry placeholder={t('auth.login.passwordPlaceholder')} />

          <Button label={t('auth.login.submit')} onPress={handleLogin} loading={loading} fullWidth size="lg" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.noAccount')}</Text>
            <Link
              href={
                redirectPath
                  ? (`/(auth)/signup?redirect=${encodeURIComponent(redirectPath)}` as any)
                  : '/(auth)/signup'
              }
              asChild
            >
              <TouchableOpacity>
                <Text style={styles.footerLink}>{t('auth.login.signupLink')}</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
