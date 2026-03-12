import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ME_QUERY } from '../../src/graphql/queries';
import {
  CREATE_STRIPE_CHECKOUT_MUTATION,
  CREATE_STRIPE_PORTAL_MUTATION,
  CONNECT_META_MUTATION,
  DISCONNECT_META_MUTATION,
} from '../../src/graphql/mutations';
import { Input } from '../../src/components/ui/Input';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import { Button, Card, Badge, UnverifiedBanner } from '../../src/components/ui';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';

const PRO_FEATURE_KEYS = [
  'settings.featureUnlimitedReleases',
  'settings.featureUnlimitedEpk',
  'settings.featureUnlimitedOutreach',
  'settings.featurePressKit',
  'settings.featurePriorityAI',
  'settings.featureEmailSending',
];

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      gap: isMobile ? spacing.lg : spacing.xl,
      maxWidth: 640,
      width: '100%',
      alignSelf: 'center',
    },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    titleAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: colors.primary },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xxl : fontSize.xxxl,
      color: colors.textPrimary,
    },

    successBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.successBg, borderRadius: radius.md,
      padding: spacing.md, borderWidth: 1, borderColor: colors.success,
    },
    successText: { color: colors.success, fontSize: fontSize.sm, flex: 1, fontFamily: fonts.regular },

    sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.textPrimary, marginBottom: spacing.md },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: {
      width: 48, height: 48, borderRadius: radius.full,
      backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: colors.textInverse, fontFamily: fonts.bold, fontSize: fontSize.lg },
    accountInfo: { flex: 1 },
    accountName: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary },
    accountEmail: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },

    // Pro upgrade card — blue accents
    upgradeCard: { borderColor: colors.primary, borderWidth: 2 },
    upgradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
    upgradeTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    upgradePrice: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSecondary, marginTop: 4 },
    priceHighlight: { color: colors.primary, fontFamily: fonts.bold },
    proStarBadge: {
      backgroundColor: colors.primaryBg,
      borderRadius: radius.full,
      paddingLeft: spacing.sm, paddingRight: spacing.sm,
      paddingTop: spacing.xs, paddingBottom: spacing.xs,
      borderWidth: 1, borderColor: colors.primary,
    },
    proStarText: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.primary },
    featureList: { gap: spacing.sm },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    featureText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textPrimary },

    proBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    proTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    proSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSecondary },

    aboutList: { gap: spacing.sm },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between' },
    aboutLabel: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
    aboutValue: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textPrimary },

    metaHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    metaConnectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.successBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    metaConnectedText: { fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.success },
    metaDesc: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.sm },
    metaLink: { color: colors.primary },
    metaFormActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  });

function AboutRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.aboutRow}>
      <Text style={styles.aboutLabel}>{label}</Text>
      <Text style={styles.aboutValue}>{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { upgraded } = useLocalSearchParams<{ upgraded?: string }>();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);
  const { data, refetch: refetchMe } = useQuery(ME_QUERY);
  const [createCheckout, { loading: checkoutLoading }] = useMutation(CREATE_STRIPE_CHECKOUT_MUTATION);
  const [createPortal, { loading: portalLoading }] = useMutation(CREATE_STRIPE_PORTAL_MUTATION);
  const [connectMeta, { loading: connectingMeta }] = useMutation(CONNECT_META_MUTATION);
  const [disconnectMeta, { loading: disconnectingMeta }] = useMutation(DISCONNECT_META_MUTATION);

  const [metaToken, setMetaToken] = useState('');
  const [metaAccountId, setMetaAccountId] = useState('');
  const [showMetaForm, setShowMetaForm] = useState(false);

  const plan = data?.me?.plan ?? user?.plan ?? 'FREE';
  const metaConnected = data?.me?.metaConnected ?? false;

  async function handleUpgrade() {
    try {
      const { data } = await createCheckout();
      await Linking.openURL(data.createStripeCheckout);
    } catch (e) { alert((e as Error).message); }
  }

  async function handleManageBilling() {
    try {
      const { data } = await createPortal();
      await Linking.openURL(data.createStripePortal);
    } catch (e) { alert((e as Error).message); }
  }

  async function handleConnectMeta() {
    if (!metaToken.trim() || !metaAccountId.trim()) {
      alert('Please enter both the access token and ad account ID.');
      return;
    }
    try {
      await connectMeta({ variables: { accessToken: metaToken.trim(), adAccountId: metaAccountId.trim() } });
      setShowMetaForm(false);
      setMetaToken('');
      setMetaAccountId('');
      refetchMe();
    } catch (e) { alert((e as Error).message); }
  }

  async function handleDisconnectMeta() {
    if (!confirm('Disconnect your Meta account?')) return;
    try {
      await disconnectMeta();
      refetchMe();
    } catch (e) { alert((e as Error).message); }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('settings.title')}</Text>

      {user && !user.emailVerified && <UnverifiedBanner />}

      {upgraded === 'true' && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={styles.successText}>{t('settings.welcomePro')}</Text>
        </View>
      )}

      <Card padding="lg">
        <Text style={styles.sectionTitle}>{t('settings.sectionAccount')}</Text>
        <View style={styles.accountRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name ?? 'U').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user?.name}</Text>
            <Text style={styles.accountEmail}>{user?.email}</Text>
          </View>
          <Badge label={plan} variant={plan === 'PRO' ? 'warning' : 'default'} />
        </View>
        <Button label={t('settings.signOut')} onPress={logout} variant="ghost" style={{ marginTop: spacing.md }} />
      </Card>

      {plan === 'FREE' ? (
        <Card padding="lg" style={styles.upgradeCard}>
          <View style={styles.upgradeHeader}>
            <View>
              <Text style={styles.upgradeTitle}>{t('settings.upgradeTitle')}</Text>
              <Text style={styles.upgradePrice}>
                {t('settings.upgradePrice').split('€12')[0]}
                <Text style={styles.priceHighlight}>€12</Text>
                {t('settings.upgradePrice').split('€12')[1]}
              </Text>
            </View>
            <View style={styles.proStarBadge}>
              <Text style={styles.proStarText}>{t('settings.proBadge')}</Text>
            </View>
          </View>
          <View style={styles.featureList}>
            {PRO_FEATURE_KEYS.map((key) => (
              <View key={key} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={styles.featureText}>{t(key)}</Text>
              </View>
            ))}
          </View>
          <Button label={t('settings.upgradeBtn')} onPress={handleUpgrade} loading={checkoutLoading} fullWidth size="lg" style={{ marginTop: spacing.md }} />
        </Card>
      ) : (
        <Card padding="lg">
          <View style={styles.proBadgeRow}>
            <Ionicons name="star" size={24} color={colors.primary} />
            <Text style={styles.proTitle}>{t('settings.proTitle')}</Text>
          </View>
          <Text style={styles.proSubtitle}>{t('settings.proSubtitle')}</Text>
          <Button label={t('settings.manageBilling')} onPress={handleManageBilling} loading={portalLoading} variant="secondary" style={{ marginTop: spacing.md }} />
        </Card>
      )}

      {plan === 'PRO' && (
        <Card padding="lg">
          <View style={styles.metaHeader}>
            <Ionicons name="logo-facebook" size={22} color="#1877F2" />
            <Text style={styles.sectionTitle} >Meta Ads</Text>
            {metaConnected && (
              <View style={styles.metaConnectedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={styles.metaConnectedText}>Connected</Text>
              </View>
            )}
          </View>

          {metaConnected ? (
            <>
              <Text style={styles.metaDesc}>
                Your Meta Business account is connected. You can create Instagram ad campaigns directly from the Video Ads tab on each release.
              </Text>
              <Button
                label={disconnectingMeta ? 'Disconnecting...' : 'Disconnect Meta'}
                onPress={handleDisconnectMeta}
                loading={disconnectingMeta}
                variant="ghost"
                style={{ marginTop: spacing.md }}
              />
            </>
          ) : showMetaForm ? (
            <>
              <Text style={styles.metaDesc}>
                Enter your Meta User Access Token and Ad Account ID. You can get these from{' '}
                <Text style={styles.metaLink} onPress={() => Linking.openURL('https://developers.facebook.com/tools/explorer/')}>
                  Meta Graph API Explorer
                </Text>
                .
              </Text>
              <Input
                label="User Access Token"
                value={metaToken}
                onChangeText={setMetaToken}
                placeholder="EAABwzLix..."
              />
              <Input
                label="Ad Account ID"
                value={metaAccountId}
                onChangeText={setMetaAccountId}
                placeholder="123456789"
              />
              <View style={styles.metaFormActions}>
                <Button
                  label={connectingMeta ? 'Connecting...' : 'Connect'}
                  onPress={handleConnectMeta}
                  loading={connectingMeta}
                />
                <Button
                  label="Cancel"
                  onPress={() => setShowMetaForm(false)}
                  variant="ghost"
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.metaDesc}>
                Connect your Meta Business account to create Instagram Reels & Stories ad campaigns directly from your releases.
              </Text>
              <Button
                label="Connect Meta Business"
                onPress={() => setShowMetaForm(true)}
                variant="secondary"
                style={{ marginTop: spacing.md }}
              />
            </>
          )}
        </Card>
      )}

      <Card padding="lg">
        <Text style={styles.sectionTitle}>{t('settings.sectionAbout')}</Text>
        <View style={styles.aboutList}>
          <AboutRow label={t('settings.labelVersion')} value="1.0.0" styles={styles} />
          <AboutRow label={t('settings.labelStack')} value="Expo · Apollo · PostgreSQL" styles={styles} />
        </View>
      </Card>
    </ScrollView>
  );
}
