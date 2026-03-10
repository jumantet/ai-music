import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { EPK_PAGE_QUERY } from '../../src/graphql/queries';
import { colors, spacing, fontSize, radius } from '../../src/theme';

export default function PublicEPKPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, loading, error } = useQuery(EPK_PAGE_QUERY, {
    variables: { slug },
    skip: !slug,
  });

  const epk = data?.epkPage;
  const release = epk?.release;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!epk || !release) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>🎵</Text>
        <Text style={styles.notFoundTitle}>EPK not found</Text>
        <Text style={styles.notFoundText}>This page doesn't exist or hasn't been published yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        {release.coverUrl ? (
          <Image source={{ uri: release.coverUrl }} style={styles.heroImage} />
        ) : (
          <View style={styles.heroImagePlaceholder}>
            <Text style={styles.heroImageEmoji}>🎵</Text>
          </View>
        )}
        <View style={styles.heroOverlay}>
          <Text style={styles.heroArtist}>{release.artistName}</Text>
          <Text style={styles.heroTitle}>{release.title}</Text>
          <View style={styles.heroBadges}>
            {release.genre && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{release.genre}</Text>
              </View>
            )}
            {release.city && (
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>📍 {release.city}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Music Player link */}
        {release.trackUrl && (
          <Section title="Listen">
            <TouchableOpacity
              style={styles.playerBox}
              onPress={() => release.trackUrl && Linking.openURL(release.trackUrl)}
            >
              <Ionicons name="play-circle" size={48} color={colors.primary} />
              <View style={styles.playerInfo}>
                <Text style={styles.playerTitle}>{release.title}</Text>
                <Text style={styles.playerArtist}>{release.artistName}</Text>
              </View>
              <Ionicons name="open-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Section>
        )}

        {/* Artist Bio */}
        {epk.bio && (
          <Section title="About">
            <Text style={styles.bodyText}>{epk.bio}</Text>
          </Section>
        )}

        {/* Press Pitch */}
        {epk.pressPitch && (
          <Section title="Press Notes">
            <View style={styles.pitchBox}>
              <Text style={styles.pitchText}>{epk.pressPitch}</Text>
            </View>
          </Section>
        )}

        {/* Release Description */}
        {epk.releaseDescription && (
          <Section title="About the Track">
            <Text style={styles.bodyText}>{epk.releaseDescription}</Text>
          </Section>
        )}

        {/* Short Bio */}
        {epk.shortBio && (
          <Section title="One Line">
            <Text style={styles.shortBio}>{epk.shortBio}</Text>
          </Section>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Created with</Text>
          <Text style={styles.footerBrand}> AI Release Toolkit</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  container: { paddingBottom: spacing.xxxl },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, padding: spacing.xl, gap: spacing.md,
  },
  loadingText: { color: colors.textMuted, fontSize: fontSize.md },
  emoji: { fontSize: 64 },
  notFoundTitle: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  notFoundText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },

  // Hero
  hero: { position: 'relative', height: 420 },
  heroImage: { width: '100%', height: '100%' },
  heroImagePlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  heroImageEmoji: { fontSize: 96 },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.5)',
    gap: spacing.sm,
  },
  heroArtist: {
    fontSize: fontSize.sm, fontWeight: '700', color: colors.primaryLight,
    textTransform: 'uppercase', letterSpacing: 2,
  },
  heroTitle: { fontSize: fontSize.display, fontWeight: '700', color: colors.white, lineHeight: 52 },
  heroBadges: { flexDirection: 'row', gap: spacing.sm },
  heroBadge: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  heroBadgeText: { fontSize: fontSize.sm, color: colors.white },

  // Content
  content: {
    maxWidth: 720, width: '100%', alignSelf: 'center',
    padding: spacing.xl, gap: spacing.xxl,
  },
  section: { gap: spacing.md },
  sectionTitle: {
    fontSize: fontSize.xs, fontWeight: '700', color: colors.primary,
    textTransform: 'uppercase', letterSpacing: 2,
  },
  bodyText: {
    fontSize: fontSize.lg, color: colors.textPrimary,
    lineHeight: 30,
  },
  pitchBox: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    paddingLeft: spacing.lg,
  },
  pitchText: {
    fontSize: fontSize.lg, color: colors.textSecondary,
    lineHeight: 30, fontStyle: 'italic',
  },
  shortBio: {
    fontSize: fontSize.xl, color: colors.textPrimary,
    lineHeight: 32, fontStyle: 'italic',
  },
  playerBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  playerInfo: { flex: 1 },
  playerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  playerArtist: { fontSize: fontSize.md, color: colors.textSecondary },
  footer: {
    flexDirection: 'row', justifyContent: 'center',
    paddingTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerText: { fontSize: fontSize.sm, color: colors.textMuted },
  footerBrand: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
