import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation } from '@apollo/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { VERIFY_EMAIL_MUTATION } from '../src/graphql/mutations';
import { Button } from '../src/components/ui';
import { colors, spacing, fontSize, radius } from '../src/theme';
import { useAuth } from '../src/hooks/useAuth';

type State = 'loading' | 'success' | 'error';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { t } = useTranslation();
  const [state, setState] = useState<State>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const { updateUser } = useAuth();
  const [verifyEmail] = useMutation(VERIFY_EMAIL_MUTATION);

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMsg(t('auth.verify.errorMissingToken'));
      return;
    }

    verifyEmail({ variables: { token } })
      .then(async ({ data }) => {
        const { token: authToken, user } = data.verifyEmail;
        await AsyncStorage.setItem('auth_token', authToken);
        await updateUser(user);
        setState('success');
        setTimeout(() => router.replace('/(app)/dashboard'), 2000);
      })
      .catch((e) => {
        setState('error');
        setErrorMsg((e as Error).message ?? t('auth.verify.errorFallback'));
      });
  }, [token]);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        {state === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>{t('auth.verify.loading')}</Text>
          </>
        )}

        {state === 'success' && (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            </View>
            <Text style={styles.title}>{t('auth.verify.successTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.verify.successSubtitle')}</Text>
          </>
        )}

        {state === 'error' && (
          <>
            <View style={styles.iconCircle}>
              <Ionicons name="close-circle" size={48} color={colors.error} />
            </View>
            <Text style={styles.title}>{t('auth.verify.errorTitle')}</Text>
            <Text style={styles.subtitle}>{errorMsg}</Text>
            <Button
              label={t('auth.verify.backToLogin')}
              onPress={() => router.replace('/(auth)/login')}
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    maxWidth: 400,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
