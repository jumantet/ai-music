import '../src/i18n';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Slot, useSegments, useRouter, useGlobalSearchParams } from 'expo-router';
import { ApolloProvider } from '@apollo/client';
import {
  useFonts,
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { apolloClient } from '../src/graphql/client';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { ThemeProvider, useTheme } from '../src/hooks/useTheme';
import { VerificationRequiredModal } from '../src/components/ui/VerificationRequiredModal';

function RootGuard() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  const { redirect: authRedirectParam } = useGlobalSearchParams<{ redirect?: string }>();
  const authRedirect = typeof authRedirectParam === 'string' ? authRedirectParam.trim() : '';

  useEffect(() => {
    if (isLoading) return;
    const seg0 = segments[0] as string | undefined;
    const seg1 = segments[1] as string | undefined;
    const seg2 = segments[2] as string | undefined;
    const inAuthGroup = seg0 === '(auth)';
    const inEpkGroup = seg0 === 'epk';
    const inVerifyPage = seg0 === 'verify';
    /** Wizard clip lo-fi : accessible sans compte (auth seulement à la génération). */
    const inClipWizard = seg0 === '(app)' && seg1 === 'campaigns' && seg2 === 'new';
    if (!user && !inAuthGroup && !inEpkGroup && !inVerifyPage && !inClipWizard) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      if (authRedirect) router.replace(authRedirect as any);
      else router.replace('/(app)/dashboard');
    }
  }, [user, isLoading, segments, authRedirect]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <Slot />
      <VerificationRequiredModal />
    </>
  );
}

function AppProviders() {
  const { colors } = useTheme();

  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <RootGuard />
      </AuthProvider>
    </ApolloProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppProviders />
    </ThemeProvider>
  );
}
