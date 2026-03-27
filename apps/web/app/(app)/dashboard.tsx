import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ME_QUERY } from '../../src/graphql/queries';
import { UnverifiedBanner, Badge, Button } from '../../src/components/ui';
import { useAuth } from '../../src/hooks/useAuth';
import { useTheme } from '../../src/hooks/useTheme';
import { useIsMobile } from '../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../src/theme';
import type { ColorPalette } from '../../src/theme';
import type { Campaign } from '@toolkit/shared';

// ─── helpers ─────────────────────────────────────────────────────────────────

function trackKey(c: Campaign) {
  return `${c.trackTitle}|||${c.artistName}`;
}

function trackAccentColor(title: string, palette: string[]): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffff;
  return palette[h % palette.length];
}

const ACCENT_PALETTE = [
  '#4F7EFF',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#06B6D4',
  '#F97316',
];

function bestStatus(campaigns: Campaign[]): string {
  if (campaigns.some((c) => c.status === 'LAUNCHED')) return 'LAUNCHED';
  if (campaigns.some((c) => c.status === 'READY')) return 'READY';
  if (campaigns.some((c) => c.status === 'GENERATING')) return 'GENERATING';
  return 'DRAFT';
}

interface TrackGroup {
  title: string;
  artistName: string;
  campaigns: Campaign[];
  status: string;
  accent: string;
}

function groupByTrack(campaigns: Campaign[]): TrackGroup[] {
  const map = new Map<string, TrackGroup>();
  for (const c of campaigns) {
    const k = trackKey(c);
    const existing = map.get(k);
    if (existing) {
      existing.campaigns.push(c);
    } else {
      map.set(k, {
        title: c.trackTitle,
        artistName: c.artistName,
        campaigns: [c],
        status: c.status,
        accent: trackAccentColor(c.trackTitle, ACCENT_PALETTE),
      });
    }
  }
  return [...map.values()].map((g) => ({ ...g, status: bestStatus(g.campaigns) }));
}

function statusVariant(s: string): 'default' | 'success' | 'warning' | 'info' {
  if (s === 'LAUNCHED') return 'success';
  if (s === 'READY') return 'info';
  if (s === 'GENERATING') return 'warning';
  return 'default';
}

function statusLabel(s: string): string {
  if (s === 'LAUNCHED') return 'Lancé';
  if (s === 'READY') return 'Prêt';
  if (s === 'GENERATING') return 'Génération…';
  return 'Brouillon';
}

// ─── styles ──────────────────────────────────────────────────────────────────

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      paddingBottom: spacing.xxl,
    },

    // Page header
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: isMobile ? spacing.lg : spacing.xl,
    },
    pageTitle: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xxl : fontSize.xxxl,
      color: colors.textPrimary,
    },
    pageSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textMuted,
      marginTop: 2,
    },

    // Track grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    trackCard: {
      width: isMobile ? '100%' : Platform.OS === 'web' ? ('calc(33.333% - 11px)' as any) : '30%',
      minWidth: isMobile ? '100%' : 220,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    trackCover: {
      width: '100%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    trackCoverLetter: {
      fontFamily: fonts.extraBold,
      fontSize: 64,
      color: 'rgba(255,255,255,0.9)',
      letterSpacing: -2,
    },
    trackCoverOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: spacing.md,
      paddingTop: spacing.xl,
    },
    trackInfo: {
      padding: spacing.md,
      gap: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    trackTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    trackArtist: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    trackMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    trackCount: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },

    // Empty state
    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxxl,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: radius.full,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },
    emptyBody: {
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },

    muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  });

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({
  group,
  colors,
  isMobile,
}: {
  group: TrackGroup;
  colors: ColorPalette;
  isMobile: boolean;
}) {
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);
  const videoCount = group.campaigns.length;
  const launchedCount = group.campaigns.filter((c) => c.status === 'LAUNCHED').length;

  function handlePress() {
    router.push({
      pathname: '/(app)/campaigns',
      params: { track: encodeURIComponent(`${group.title}|||${group.artistName}`) },
    } as any);
  }

  return (
    <TouchableOpacity style={styles.trackCard} onPress={handlePress} activeOpacity={0.85}>
      {/* Cover */}
      <View style={[styles.trackCover, { backgroundColor: group.accent }]}>
        <Text style={styles.trackCoverLetter}>
          {group.title.charAt(0).toUpperCase()}
        </Text>
      </View>

      {/* Info row */}
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>{group.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{group.artistName}</Text>
        <View style={styles.trackMeta}>
          <Text style={styles.trackCount}>
            {videoCount} vidéo{videoCount > 1 ? 's' : ''}
            {launchedCount > 0 ? ` · ${launchedCount} lancée${launchedCount > 1 ? 's' : ''}` : ''}
          </Text>
          <Badge label={statusLabel(group.status)} variant={statusVariant(group.status)} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { data, loading } = useQuery(ME_QUERY);
  const { user: authUser } = useAuth();
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const user = data?.me;
  const campaigns: Campaign[] = user?.campaigns ?? [];
  const tracks = useMemo(() => groupByTrack(campaigns), [campaigns]);
  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {authUser && !authUser.emailVerified && <UnverifiedBanner />}

      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>
            {firstName ? `${firstName}'s tracks` : 'Mes musiques'}
          </Text>
          <Text style={styles.pageSubtitle}>
            {tracks.length === 0
              ? 'Aucune musique pour l\'instant'
              : `${tracks.length} morceau${tracks.length > 1 ? 'x' : ''}`}
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={styles.muted}>{t('common.loading')}</Text>
      ) : tracks.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="musical-notes-outline" size={36} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>Commence ta première promo</Text>
          <Text style={styles.emptyBody}>
            Chaque morceau que tu promeus apparaît ici — avec toutes ses vidéos ads et leurs performances.
          </Text>
          <Button
            label="Créer ma première vidéo promo"
            onPress={() => router.push('/(app)/campaigns/new')}
          />
        </View>
      ) : (
        <View style={styles.grid}>
          {tracks.map((group) => (
            <TrackCard
              key={`${group.title}|||${group.artistName}`}
              group={group}
              colors={colors}
              isMobile={isMobile}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
