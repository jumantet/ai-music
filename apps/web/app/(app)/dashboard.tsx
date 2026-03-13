import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ME_QUERY } from '../../src/graphql/queries';
import { Button, Card, Badge, UnverifiedBanner } from '../../src/components/ui';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';
import type { Campaign } from '@toolkit/shared';

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      gap: isMobile ? spacing.lg : spacing.xl,
      maxWidth: 900,
      width: '100%',
      alignSelf: 'center',
    },

    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: isMobile ? spacing.lg : spacing.xl,
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    heroLeft: { flex: isMobile ? 0 : 1 },
    heroEyebrow: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: 'rgba(255,255,255,0.7)',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xxl : fontSize.xxxl,
      color: colors.white,
      lineHeight: isMobile ? 30 : 38,
    },
    heroSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 6,
    },
    heroBtn: {
      backgroundColor: colors.white,
      paddingLeft: spacing.lg,
      paddingRight: spacing.lg,
      paddingTop: spacing.sm + 2,
      paddingBottom: spacing.sm + 2,
      borderRadius: radius.full,
      flexShrink: 0,
      alignSelf: isMobile ? 'flex-start' : 'auto',
    },
    heroBtnText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.primary,
    },

    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      flexWrap: isMobile ? 'wrap' : 'nowrap',
    },

    upgradeBanner: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: colors.primaryBg,
    },
    upgradeInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    upgradeIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    upgradeLeft: { flex: 1, gap: spacing.xs },
    upgradeTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textPrimary },
    upgradeSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    upgradeBtn: { marginTop: spacing.xs, alignSelf: 'flex-start' },

    section: { gap: spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    viewAllText: { color: colors.primary, fontSize: fontSize.sm, fontFamily: fonts.semiBold },

    muted: { color: colors.textMuted, fontFamily: fonts.regular },
    errorText: { color: colors.error, fontSize: fontSize.sm },

    emptyInner: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.lg },
    emptyIconBox: {
      width: 72,
      height: 72,
      borderRadius: radius.full,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    emptySubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 22,
    },

    campaignInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    campaignThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    campaignInfo: { flex: 1, gap: 3 },
    campaignTitle: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary },
    campaignArtist: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    campaignMeta: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 4 },
  });

function StatCard({ label, value, icon, accentColor }: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
}) {
  return (
    <Card style={{ flex: 1 } as any} padding="md">
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Ionicons name={icon} size={22} color={accentColor} />
        <Text style={{ fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 44, color: accentColor }}>{value}</Text>
        <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: '#888', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>{label}</Text>
      </View>
    </Card>
  );
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'LAUNCHED') return 'success';
  if (status === 'READY') return 'info';
  if (status === 'GENERATING') return 'warning';
  return 'default';
}

function statusLabel(status: string, t: (k: string) => string): string {
  if (status === 'LAUNCHED') return t('dashboard.badgeLaunched');
  if (status === 'READY') return t('dashboard.badgeReady');
  if (status === 'GENERATING') return t('dashboard.badgeGenerating');
  return status;
}

function CampaignRow({ campaign, colors }: { campaign: Campaign; colors: ColorPalette }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);
  return (
    <Link href={`/(app)/campaigns/${campaign.id}` as any} asChild>
      <TouchableOpacity>
        <Card padding="md">
          <View style={styles.campaignInner}>
            <View style={styles.campaignThumb}>
              <Ionicons name="film-outline" size={24} color={colors.primary} />
            </View>
            <View style={styles.campaignInfo}>
              <Text style={styles.campaignTitle} numberOfLines={1}>{campaign.trackTitle}</Text>
              <Text style={styles.campaignArtist} numberOfLines={1}>{campaign.artistName}</Text>
              <View style={styles.campaignMeta}>
                <Badge label={statusLabel(campaign.status, t)} variant={statusVariant(campaign.status)} />
                {campaign.generatedAds?.length > 0 && (
                  <Badge label={`${campaign.generatedAds.length} ads`} variant="default" />
                )}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>
      </TouchableOpacity>
    </Link>
  );
}

export default function DashboardScreen() {
  const { data, loading, error } = useQuery(ME_QUERY);
  const { user: authUser } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const user = data?.me;
  const campaigns: Campaign[] = user?.campaigns ?? [];
  const firstName = user?.name?.split(' ')[0] ?? '';

  const adsGenerated = campaigns.reduce((sum: number, c: Campaign) => sum + (c.generatedAds?.length ?? 0), 0);
  const launched = campaigns.filter((c: Campaign) => c.status === 'LAUNCHED').length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {authUser && !authUser.emailVerified && <UnverifiedBanner />}

      <View style={styles.hero}>
        <View style={styles.heroLeft}>
          <Text style={styles.heroEyebrow}>{t('dashboard.eyebrow')}</Text>
          <Text style={styles.heroTitle}>
            {firstName ? t('dashboard.welcome', { name: firstName }) : t('dashboard.welcomeAnon')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {campaigns.length === 0
              ? t('dashboard.subtitleEmpty')
              : t('dashboard.subtitleCampaigns', { count: campaigns.length })}
          </Text>
        </View>
        <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/(app)/campaigns/new')}>
          <Text style={styles.heroBtnText}>{t('dashboard.newCampaign')}</Text>
        </TouchableOpacity>
      </View>

      {user?.plan === 'FREE' && (
        <Card style={styles.upgradeBanner} padding="md">
          <View style={styles.upgradeInner}>
            <View style={styles.upgradeIconBox}>
              <Ionicons name="rocket-outline" size={22} color={colors.white} />
            </View>
            <View style={styles.upgradeLeft}>
              <Text style={styles.upgradeTitle}>{t('dashboard.upgradeBannerTitle')}</Text>
              <Text style={styles.upgradeSubtitle}>{t('dashboard.upgradeBannerSubtitle')}</Text>
              <Link href="/(app)/settings" asChild>
                <TouchableOpacity style={styles.upgradeBtn}>
                  <Button label={t('dashboard.upgradeButton')} onPress={() => {}} size="sm" />
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </Card>
      )}

      <View style={styles.statsRow}>
        <StatCard label={t('dashboard.statCampaigns')} value={campaigns.length.toString()} icon="film-outline" accentColor={colors.white} />
        <StatCard label={t('dashboard.statAdsGenerated')} value={adsGenerated.toString()} icon="play-circle-outline" accentColor={colors.white} />
        <StatCard label={t('dashboard.statLaunched')} value={launched.toString()} icon="rocket-outline" accentColor={colors.white} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('dashboard.recentCampaigns')}</Text>
          {campaigns.length > 5 && (
            <Link href="/(app)/campaigns" asChild>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>{t('dashboard.seeAll')}</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>

        {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
        {error ? <Text style={styles.errorText}>{t('dashboard.errorLoad')}</Text> : null}

        {!loading && campaigns.length === 0 ? (
          <Card>
            <View style={styles.emptyInner}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="film-outline" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('dashboard.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('dashboard.emptySubtitle')}</Text>
              <Button
                label={t('dashboard.createFirst')}
                onPress={() => router.push('/(app)/campaigns/new')}
              />
            </View>
          </Card>
        ) : null}

        {campaigns.slice(0, 5).map((campaign: Campaign) => (
          <CampaignRow key={campaign.id} campaign={campaign} colors={colors} />
        ))}
      </View>
    </ScrollView>
  );
}
