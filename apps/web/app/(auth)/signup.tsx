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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    if (!name || !email || !password) { setError('Please fill in all fields'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await signup(email, password, name);
    } catch (e) {
      setError((e as Error).message ?? 'Signup failed');
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start releasing music smarter</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Input label="Artist / Full name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Julian Mantet" />
          <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

          <Button label="Create account" onPress={handleSignup} loading={loading} fullWidth size="lg" />

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
