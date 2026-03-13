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
import { ME_QUERY } from '../../../src/graphql/queries';
import { Button, Card, Badge } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { Campaign } from '@toolkit/shared';

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      gap: spacing.lg,
      maxWidth: 900,
      width: '100%',
      alignSelf: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xxl : fontSize.xxxl,
      color: colors.textPrimary,
    },
    freeLimitRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
      gap: 2,
    },
    freeLimitText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    freeLimitLink: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.primary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    card: {
      width: isMobile ? '100%' : ('48%' as any),
    },
    cardInner: { gap: spacing.sm },
    cardThumb: {
      width: '100%',
      height: 100,
      borderRadius: radius.md,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    cardTrackTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    cardArtist: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    cardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    cardBadges: { flexDirection: 'row', gap: spacing.xs },
    viewBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    viewBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.primary,
    },
    emptyInner: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    emptyIconBox: {
      width: 80,
      height: 80,
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
      maxWidth: 340,
      lineHeight: 22,
    },
    muted: { color: colors.textMuted, fontFamily: fonts.regular },
    errorText: { color: colors.error, fontSize: fontSize.sm },
  });

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

function moodIcon(mood?: string): keyof typeof Ionicons.glyphMap {
  switch (mood) {
    case 'night_drive': return 'moon-outline';
    case 'psychedelic': return 'color-palette-outline';
    case 'vintage': return 'camera-outline';
    case 'urban': return 'business-outline';
    case 'indie': return 'musical-note-outline';
    default: return 'film-outline';
  }
}

function CampaignCard({ campaign, colors, isMobile }: { campaign: Campaign; colors: ColorPalette; isMobile: boolean }) {
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  return (
    <Link href={`/(app)/campaigns/${campaign.id}` as any} asChild>
      <TouchableOpacity style={styles.card} activeOpacity={0.8}>
        <Card padding="md">
          <View style={styles.cardInner}>
            <View style={styles.cardThumb}>
              <Ionicons name={moodIcon(campaign.mood)} size={32} color={colors.primary} />
            </View>
            <Text style={styles.cardTrackTitle} numberOfLines={1}>{campaign.trackTitle}</Text>
            <Text style={styles.cardArtist} numberOfLines={1}>{campaign.artistName}</Text>
            <View style={styles.cardMeta}>
              <View style={styles.cardBadges}>
                <Badge label={statusLabel(campaign.status, t)} variant={statusVariant(campaign.status)} />
                {campaign.generatedAds?.length > 0 && (
                  <Badge
                    label={t('campaigns.adsCount', { count: campaign.generatedAds.length })}
                    variant="default"
                  />
                )}
              </View>
              <View style={styles.viewBtn}>
                <Text style={styles.viewBtnText}>{t('campaigns.view')}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    </Link>
  );
}

export default function CampaignsScreen() {
  const { data, loading, error } = useQuery(ME_QUERY);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const user = data?.me;
  const campaigns: Campaign[] = user?.campaigns ?? [];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('campaigns.title')}</Text>
        <Button
          label={t('campaigns.newCampaign')}
          onPress={() => router.push('/(app)/campaigns/new')}
          size="sm"
        />
      </View>

      {user?.plan === 'FREE' && campaigns.length >= 1 && (
        <View style={styles.freeLimitRow}>
          <Text style={styles.freeLimitText}>{t('campaigns.freePlanLimit')}</Text>
          <Link href="/(app)/settings" asChild>
            <TouchableOpacity>
              <Text style={styles.freeLimitLink}>{t('campaigns.freePlanUpgrade')}</Text>
            </TouchableOpacity>
          </Link>
          <Text style={styles.freeLimitText}>{t('campaigns.freePlanLimitSuffix')}</Text>
        </View>
      )}

      {loading ? <Text style={styles.muted}>{t('common.loading')}</Text> : null}
      {error ? <Text style={styles.errorText}>{t('dashboard.errorLoad')}</Text> : null}

      {!loading && campaigns.length === 0 ? (
        <View style={styles.emptyInner}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="film-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('campaigns.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('campaigns.emptySubtitle')}</Text>
          <Button
            label={t('campaigns.createCampaign')}
            onPress={() => router.push('/(app)/campaigns/new')}
          />
        </View>
      ) : (
        <View style={styles.grid}>
          {campaigns.map((campaign: Campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} colors={colors} isMobile={isMobile} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
