import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ME_QUERY } from '../../src/graphql/queries';
import { Button, Card, Badge, UnverifiedBanner } from '../../src/components/ui';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';
import type { Release } from '@toolkit/shared';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: { padding: spacing.xl, gap: spacing.xl, maxWidth: 900, width: '100%', alignSelf: 'center' },

    // Hero greeting — more space, friendly
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.lg,
    },
    heroLeft: { flex: 1 },
    heroEyebrow: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: 'rgba(255,255,255,0.7)',
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    heroTitle: {
      fontFamily: fonts.extraBold,
      fontSize: fontSize.xxxl,
      color: colors.white,
      lineHeight: 38,
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
    },
    heroBtnText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.sm,
      color: colors.primary,
    },

    // Stats row
    statsRow: { flexDirection: 'row', gap: spacing.md },
    statCard: { flex: 1, alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs, overflow: 'hidden' },
    statStrip: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    statValue: { fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 44 },
    statLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
    },

    // Upgrade banner
    upgradeBanner: {
      borderColor: colors.primary,
      borderWidth: 1.5,
      backgroundColor: colors.primaryBg,
    },
    upgradeInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    upgradeIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    upgradeLeft: { flex: 1 },
    upgradeTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textPrimary },
    upgradeSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },

    // Section
    section: { gap: spacing.md },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sectionAccent: { width: 3, height: 20, borderRadius: 2, backgroundColor: colors.primary },
    sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },

    muted: { color: colors.textMuted, fontFamily: fonts.regular },
    errorText: { color: colors.error, fontSize: fontSize.sm },

    // Empty state
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

    // Release rows
    releaseInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    releaseCover: { width: 52, height: 52, borderRadius: radius.md },
    releaseCoverPlaceholder: {
      width: 52, height: 52, borderRadius: radius.md,
      backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center',
    },
    releaseInfo: { flex: 1, gap: 3 },
    releaseTitle: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary },
    releaseArtist: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    releaseBadges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 4 },
    viewAll: { paddingTop: spacing.xs, paddingBottom: spacing.xs },
    viewAllText: { color: colors.primary, fontSize: fontSize.sm, fontFamily: fonts.semiBold },
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

function ReleaseRow({ release, colors }: { release: Release; colors: ColorPalette }) {
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Link href={`/(app)/releases/${release.id}` as any} asChild>
      <TouchableOpacity>
        <Card padding="md">
          <View style={styles.releaseInner}>
            {release.coverUrl ? (
              <Image source={{ uri: release.coverUrl }} style={styles.releaseCover} />
            ) : (
              <View style={styles.releaseCoverPlaceholder}>
                <Ionicons name="musical-notes" size={22} color={colors.primary} />
              </View>
            )}
            <View style={styles.releaseInfo}>
              <Text style={styles.releaseTitle} numberOfLines={1}>{release.title}</Text>
              <Text style={styles.releaseArtist} numberOfLines={1}>{release.artistName}</Text>
              <View style={styles.releaseBadges}>
                {release.genre ? <Badge label={release.genre} variant="default" /> : null}
                {release.epkPage?.isPublished ? <Badge label={t('dashboard.badgeEpkLive')} variant="success" /> : null}
                {release.pressKit ? <Badge label={t('dashboard.badgePressKit')} variant="info" /> : null}
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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const user = data?.me;
  const releases: Release[] = user?.releases ?? [];
  const firstName = user?.name?.split(' ')[0] ?? '';

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
            {releases.length === 0
              ? t('dashboard.subtitleEmpty')
              : t('dashboard.subtitleReleases', { count: releases.length })}
          </Text>
        </View>
        <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/(app)/releases/new')}>
          <Text style={styles.heroBtnText}>{t('dashboard.newRelease')}</Text>
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
            </View>
            <Link href="/(app)/settings" asChild>
              <TouchableOpacity>
                <Button label={t('dashboard.upgradeButton')} onPress={() => {}} size="sm" />
              </TouchableOpacity>
            </Link>
          </View>
        </Card>
      )}

      <View style={styles.statsRow}>
        <StatCard label={t('dashboard.statReleases')} value={releases.length.toString()} icon="musical-notes" accentColor={colors.white} />
        <StatCard label={t('dashboard.statEpk')} value={releases.filter((r) => r.epkPage?.isPublished).length.toString()} icon="globe-outline" accentColor={colors.white} />
        <StatCard label={t('dashboard.statPressKits')} value={releases.filter((r) => r.pressKit).length.toString()} icon="document-text" accentColor={colors.white} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>{t('dashboard.recentReleases')}</Text>
          </View>
          {releases.length > 5 && (
            <Link href="/(app)/releases" asChild>
              <TouchableOpacity style={styles.viewAll}>
                <Text style={styles.viewAllText}>{t('dashboard.seeAll')}</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>

        {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
        {error ? <Text style={styles.errorText}>{t('dashboard.errorLoad')}</Text> : null}

        {!loading && releases.length === 0 ? (
          <Card>
            <View style={styles.emptyInner}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="musical-notes" size={32} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('dashboard.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('dashboard.emptySubtitle')}</Text>
              <Button
                label={t('dashboard.createFirst')}
                onPress={() => router.push('/(app)/releases/new')}
              />
            </View>
          </Card>
        ) : null}

        {releases.slice(0, 5).map((release) => (
          <ReleaseRow key={release.id} release={release} colors={colors} />
        ))}
      </View>
    </ScrollView>
  );
}
