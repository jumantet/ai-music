import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { ME_QUERY } from '../../../src/graphql/queries';
import { DELETE_RELEASE_MUTATION } from '../../../src/graphql/mutations';
import { Button, Card, Badge } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { Release } from '@toolkit/shared';

const makeStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    container: { padding: spacing.xl, gap: spacing.xl },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    titleAccent: { width: 4, height: 28, borderRadius: 2, backgroundColor: colors.primary },
    title: { fontFamily: fonts.extraBold, fontSize: fontSize.xxxl, color: colors.textPrimary },
    limitBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.warningBg,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    limitText: { flex: 1, fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    upgradeLink: { color: colors.primary, fontFamily: fonts.semiBold },
    muted: { color: colors.textMuted, fontFamily: fonts.regular },
    emptyInner: { alignItems: 'center', gap: spacing.sm },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.textPrimary },
    emptySubtitle: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', maxWidth: 320 },
    grid: { gap: spacing.md },
    card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    cover: { width: 64, height: 64, borderRadius: radius.md, flexShrink: 0 },
    coverPlaceholder: {
      width: 64, height: 64, borderRadius: radius.md,
      backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    cardBody: { flex: 1, gap: 4 },
    releaseTitle: { fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary },
    releaseArtist: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary },
    badges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  });

export default function ReleasesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { data, loading } = useQuery(ME_QUERY);

  const releases: Release[] = data?.me?.releases ?? [];
  const plan = data?.me?.plan ?? 'FREE';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Releases</Text>
        <Button
          label="New Release"
          onPress={() => router.push('/(app)/releases/new')}
          disabled={plan === 'FREE' && releases.length >= 1}
        />
      </View>

      {plan === 'FREE' && releases.length >= 1 && (
        <View style={styles.limitBox}>
          <Ionicons name="lock-closed" size={16} color={colors.warning} />
          <Text style={styles.limitText}>
            Free plan: 1 release max.{' '}
            <Text style={styles.upgradeLink} onPress={() => router.push('/(app)/settings')}>
              Upgrade to Pro
            </Text>{' '}
            for unlimited releases.
          </Text>
        </View>
      )}

      {loading ? <Text style={styles.muted}>Loading...</Text> : null}

      {!loading && releases.length === 0 ? (
        <Card padding="xl">
          <View style={styles.emptyInner}>
            <Text style={styles.emptyEmoji}>🎵</Text>
            <Text style={styles.emptyTitle}>No releases yet</Text>
            <Text style={styles.emptySubtitle}>
              Add your first release to generate an EPK, press kit, and outreach emails
            </Text>
            <Button label="Create release" onPress={() => router.push('/(app)/releases/new')} style={{ marginTop: spacing.md }} />
          </View>
        </Card>
      ) : null}

      <View style={styles.grid}>
        {releases.map((release) => (
          <TouchableOpacity key={release.id} onPress={() => router.push(`/(app)/releases/${release.id}` as any)}>
            <Card padding="md" style={styles.card}>
              {release.coverUrl ? (
                <Image source={{ uri: release.coverUrl }} style={styles.cover} />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="musical-notes" size={36} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.releaseTitle} numberOfLines={1}>{release.title}</Text>
                <Text style={styles.releaseArtist} numberOfLines={1}>{release.artistName}</Text>
                <View style={styles.badges}>
                  {release.genre ? <Badge label={release.genre} /> : null}
                  {release.epkPage?.isPublished ? <Badge label="EPK Live" variant="success" /> : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Card>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
