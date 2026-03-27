import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { ME_QUERY } from '../../../src/graphql/queries';
import { Badge, Button } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { Campaign } from '@toolkit/shared';

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusVariant(s: string): 'default' | 'success' | 'warning' | 'info' {
  if (s === 'LAUNCHED') return 'success';
  if (s === 'READY') return 'info';
  if (s === 'GENERATING') return 'warning';
  return 'default';
}

function statusLabel(s: string): string {
  if (s === 'LAUNCHED') return 'Lancée';
  if (s === 'READY') return 'Prête';
  if (s === 'GENERATING') return 'Génération…';
  return 'Brouillon';
}

function trackAccentColor(title: string): string {
  const palette = [
    '#4F7EFF', '#8B5CF6', '#EC4899', '#F59E0B',
    '#10B981', '#EF4444', '#06B6D4', '#F97316',
  ];
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

function AdVideoThumb({ videoUrl, fallback }: { videoUrl: string; fallback: React.ReactNode }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</>;
  return React.createElement('video', {
    src: videoUrl,
    muted: true,
    playsInline: true,
    loop: true,
    autoPlay: true,
    preload: 'metadata',
    onError: () => setErrored(true),
    style: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      borderRadius: 12,
    },
  });
}

// ─── styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      paddingBottom: spacing.xxxl,
    },

    // Track hero
    hero: {
      flexDirection: isMobile ? 'column' : 'row',
      alignItems: isMobile ? 'flex-start' : 'center',
      gap: spacing.lg,
      paddingHorizontal: isMobile ? spacing.md : spacing.xl,
      paddingTop: isMobile ? spacing.md : spacing.xl,
      paddingBottom: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    heroBack: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: isMobile ? spacing.sm : 0,
    },
    heroBackText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    heroCover: {
      width: isMobile ? 72 : 96,
      height: isMobile ? 72 : 96,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    heroCoverLetter: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? 32 : 42,
      color: 'rgba(255,255,255,0.9)',
    },
    heroMeta: { flex: 1, gap: 4 },
    heroTitle: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xl : fontSize.xxl,
      color: colors.textPrimary,
    },
    heroArtist: {
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: colors.textSecondary,
    },
    heroStats: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    heroStat: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    heroStatText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    heroActions: { gap: spacing.sm },

    // Section header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isMobile ? spacing.md : spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
    },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
    },

    // Video cards list
    videoList: {
      paddingHorizontal: isMobile ? spacing.md : spacing.xl,
      gap: spacing.md,
    },
    videoCard: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    videoCardTop: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    thumbArea: {
      width: isMobile ? '100%' : 140,
      aspectRatio: 9 / 16,
      borderRadius: radius.lg,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    videoMeta: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
    videoLabel: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    videoDate: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    videoStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },

    // Performance stats row
    perfRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      gap: spacing.xl,
    },
    perfStat: { alignItems: 'center', gap: 2 },
    perfValue: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    perfLabel: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },

    // Launch bar
    launchBar: {
      flexDirection: isMobile ? 'column' : 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: isMobile ? 'stretch' : 'center',
    },
    launchLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      flex: isMobile ? undefined : 1,
    },
    platformBtns: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
    },
    platformBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    platformBtnLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
    },

    // Empty state
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.xxxl,
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
    },
    emptySubtext: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      textAlign: 'center',
    },

    muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
    errorText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.error },
  });

// ─── Video card ───────────────────────────────────────────────────────────────

function VideoCard({
  campaign,
  index,
  colors,
  isMobile,
}: {
  campaign: Campaign;
  index: number;
  colors: ColorPalette;
  isMobile: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);
  const ad = campaign.generatedAd;
  const isLaunched = campaign.status === 'LAUNCHED';

  const createdAt = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <View style={styles.videoCard}>
      <View style={styles.videoCardTop}>
        {/* Thumbnail */}
        <View style={styles.thumbArea}>
          {ad?.videoUrl ? (
            <AdVideoThumb
              videoUrl={ad.videoUrl}
              fallback={<Ionicons name="film-outline" size={28} color={colors.textMuted} />}
            />
          ) : (
            <Ionicons name="film-outline" size={28} color={colors.textMuted} />
          )}
        </View>

        {/* Meta */}
        <View style={styles.videoMeta}>
          <Text style={styles.videoLabel}>Vidéo {index + 1}</Text>
          {createdAt && <Text style={styles.videoDate}>Créée le {createdAt}</Text>}
          <View style={styles.videoStatusRow}>
            <Badge label={statusLabel(campaign.status)} variant={statusVariant(campaign.status)} />
            {campaign.metaCampaignId && (
              <Badge label="Meta" variant="info" />
            )}
          </View>
          {/* Quick actions */}
          <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.xs }}>
            {ad?.videoUrl && (
              <TouchableOpacity
                onPress={() => typeof window !== 'undefined' && window.open(ad.videoUrl!, '_blank')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                activeOpacity={0.7}
              >
                <Ionicons name="download-outline" size={14} color={colors.primary} />
                <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.primary }}>
                  Télécharger
                </Text>
              </TouchableOpacity>
            )}
            {!isLaunched && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/(app)/campaigns/[id]',
                    params: { id: campaign.id },
                  } as any)
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: spacing.sm }}
                activeOpacity={0.7}
              >
                <Ionicons name="create-outline" size={14} color={colors.textMuted} />
                <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.textMuted }}>
                  Détails
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Performance stats (if launched) */}
      {isLaunched && (
        <View style={styles.perfRow}>
          <View style={styles.perfStat}>
            <Text style={styles.perfValue}>—</Text>
            <Text style={styles.perfLabel}>Vues</Text>
          </View>
          <View style={styles.perfStat}>
            <Text style={styles.perfValue}>—</Text>
            <Text style={styles.perfLabel}>CTR</Text>
          </View>
          <View style={styles.perfStat}>
            <Text style={styles.perfValue}>—</Text>
            <Text style={styles.perfLabel}>Clics</Text>
          </View>
          <View style={styles.perfStat}>
            <Text style={styles.perfValue}>—</Text>
            <Text style={styles.perfLabel}>Budget dépensé</Text>
          </View>
        </View>
      )}

      {/* Launch bar */}
      {!isLaunched && ad && (
        <View style={styles.launchBar}>
          <Text style={styles.launchLabel}>Lancer la pub sur :</Text>
          <View style={styles.platformBtns}>
            {/* Meta */}
            <TouchableOpacity
              style={[
                styles.platformBtn,
                { borderColor: '#1877F2', backgroundColor: 'rgba(24,119,242,0.08)' },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/(app)/campaigns/[id]',
                  params: { id: campaign.id },
                } as any)
              }
              activeOpacity={0.8}
            >
              <Ionicons name="logo-facebook" size={16} color="#1877F2" />
              <Text style={[styles.platformBtnLabel, { color: '#1877F2' }]}>Meta / Instagram</Text>
            </TouchableOpacity>

            {/* TikTok */}
            <TouchableOpacity
              style={[
                styles.platformBtn,
                { borderColor: colors.border, backgroundColor: colors.bgElevated },
              ]}
              activeOpacity={0.8}
              onPress={() => {}}
            >
              <Ionicons name="logo-tiktok" size={16} color={colors.textSecondary} />
              <Text style={[styles.platformBtnLabel, { color: colors.textSecondary }]}>TikTok</Text>
              <View
                style={{
                  backgroundColor: colors.warningBg,
                  borderRadius: radius.full,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                }}
              >
                <Text style={{ fontFamily: fonts.semiBold, fontSize: 10, color: colors.warning }}>
                  Bientôt
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrackDetailScreen() {
  const { track: trackParam } = useLocalSearchParams<{ track?: string }>();
  const { data, loading, error } = useQuery(ME_QUERY);
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const allCampaigns: Campaign[] = data?.me?.campaigns ?? [];

  const { trackTitle, artistName, campaigns } = useMemo(() => {
    if (!trackParam) return { trackTitle: '', artistName: '', campaigns: allCampaigns };
    const decoded = decodeURIComponent(trackParam);
    const [title, artist] = decoded.split('|||');
    const filtered = allCampaigns.filter(
      (c) => c.trackTitle === title && c.artistName === artist
    );
    return { trackTitle: title ?? '', artistName: artist ?? '', campaigns: filtered };
  }, [trackParam, allCampaigns]);

  const accent = trackTitle ? trackAccentColor(trackTitle) : colors.primary;
  const launchedCount = campaigns.filter((c) => c.status === 'LAUNCHED').length;

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={[styles.muted, { padding: spacing.xl }]}>{`Chargement…`}</Text>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        <Text style={[styles.errorText, { padding: spacing.xl }]}>Erreur de chargement.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            style={styles.heroBack}
            onPress={() => router.replace('/(app)/dashboard')}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
            <Text style={styles.heroBackText}>Mes musiques</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
            <View style={[styles.heroCover, { backgroundColor: accent }]}>
              <Text style={styles.heroCoverLetter}>
                {trackTitle ? trackTitle.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>

            <View style={styles.heroMeta}>
              <Text style={styles.heroTitle} numberOfLines={1}>{trackTitle || 'Toutes les vidéos'}</Text>
              {artistName ? <Text style={styles.heroArtist}>{artistName}</Text> : null}
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Ionicons name="film-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.heroStatText}>
                    {campaigns.length} vidéo{campaigns.length > 1 ? 's' : ''}
                  </Text>
                </View>
                {launchedCount > 0 && (
                  <View style={styles.heroStat}>
                    <Ionicons name="rocket-outline" size={12} color={colors.success} />
                    <Text style={[styles.heroStatText, { color: colors.success }]}>
                      {launchedCount} lancée{launchedCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <Button
          label="+ Nouvelle vidéo pour ce titre"
          size="sm"
          onPress={() => router.push('/(app)/campaigns/new')}
        />
      </View>

      {/* Videos list */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Vidéos promo</Text>
      </View>

      {campaigns.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Aucune vidéo encore</Text>
          <Text style={styles.emptySubtext}>
            Crée une première vidéo promo pour ce morceau.
          </Text>
          <Button
            label="Créer une vidéo promo"
            onPress={() => router.push('/(app)/campaigns/new')}
          />
        </View>
      ) : (
        <View style={styles.videoList}>
          {campaigns.map((campaign, i) => (
            <VideoCard
              key={campaign.id}
              campaign={campaign}
              index={i}
              colors={colors}
              isMobile={isMobile}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
