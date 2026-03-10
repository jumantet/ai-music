import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { RELEASE_QUERY } from '../../../src/graphql/queries';
import {
  GENERATE_EPK_MUTATION,
  PUBLISH_EPK_MUTATION,
  UNPUBLISH_EPK_MUTATION,
  UPDATE_EPK_PAGE_MUTATION,
  GENERATE_PRESS_KIT_MUTATION,
  DELETE_RELEASE_MUTATION,
} from '../../../src/graphql/mutations';
import { Button, Card, Badge } from '../../../src/components/ui';
import { Input } from '../../../src/components/ui/Input';
import { colors, spacing, fontSize, radius } from '../../../src/theme';
import type { Release } from '@toolkit/shared';

type Tab = 'overview' | 'epk' | 'outreach';

export default function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data, loading, refetch } = useQuery(RELEASE_QUERY, {
    variables: { id },
    skip: !id,
  });

  const release: Release | undefined = data?.release;

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  if (!release) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Release not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/(app)/releases')}>
          <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Releases</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          {release.coverUrl ? (
            <Image source={{ uri: release.coverUrl }} style={styles.coverArt} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" size={48} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{release.title}</Text>
            <Text style={styles.heroArtist}>{release.artistName}</Text>
            <View style={styles.heroBadges}>
              {release.genre && <Badge label={release.genre} />}
              {release.mood && <Badge label={release.mood} />}
              {release.city && <Badge label={release.city} />}
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['overview', 'epk', 'outreach'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab ? styles.tabActive : undefined]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : undefined]}>
                {tab === 'overview' ? 'Overview' : tab === 'epk' ? 'EPK Studio' : 'Outreach'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && <OverviewTab release={release} refetch={refetch} />}
        {activeTab === 'epk' && <EPKTab release={release} refetch={refetch} />}
        {activeTab === 'outreach' && <OutreachTab release={release} />}
      </ScrollView>
    </View>
  );
}

function OverviewTab({ release, refetch }: { release: Release; refetch: () => void }) {
  const [deleteRelease, { loading }] = useMutation(DELETE_RELEASE_MUTATION);

  async function handleDelete() {
    if (!confirm('Delete this release? This cannot be undone.')) return;
    await deleteRelease({ variables: { id: release.id } });
    router.replace('/(app)/releases');
  }

  return (
    <View style={styles.tabContent}>
      <Card padding="lg">
        <Text style={styles.sectionTitle}>Release Info</Text>
        <View style={styles.infoGrid}>
          <InfoRow label="Artist" value={release.artistName} />
          <InfoRow label="Title" value={release.title} />
          {release.genre && <InfoRow label="Genre" value={release.genre} />}
          {release.mood && <InfoRow label="Mood" value={release.mood} />}
          {release.bpm && <InfoRow label="BPM" value={String(release.bpm)} />}
          {release.city && <InfoRow label="City" value={release.city} />}
          {release.influences && <InfoRow label="Influences" value={release.influences} />}
        </View>
      </Card>

      <Card padding="lg">
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <ActionCard
            icon="document-text"
            title="EPK Studio"
            description="Generate AI press materials"
            onPress={() => {}}
            color={colors.primary}
          />
          <ActionCard
            icon="archive"
            title="Press Kit"
            description={release.pressKit ? 'Download press-kit.zip' : 'Generate press kit'}
            onPress={() => {
              if (release.pressKit) Linking.openURL(release.pressKit.zipUrl);
            }}
            color={colors.info}
          />
          <ActionCard
            icon="mail"
            title="Outreach"
            description="Generate & send emails"
            onPress={() => {}}
            color={colors.success}
          />
        </View>
      </Card>

      <Button
        label="Delete Release"
        onPress={handleDelete}
        variant="danger"
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
    </View>
  );
}

function EPKTab({ release, refetch }: { release: Release; refetch: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generatingKit, setGeneratingKit] = useState(false);

  const [bio, setBio] = useState(release.epkPage?.bio ?? '');
  const [pressPitch, setPressPitch] = useState(release.epkPage?.pressPitch ?? '');
  const [shortBio, setShortBio] = useState(release.epkPage?.shortBio ?? '');
  const [releaseDescription, setReleaseDescription] = useState(release.epkPage?.releaseDescription ?? '');

  const [generateEPK] = useMutation(GENERATE_EPK_MUTATION);
  const [updateEPKPage] = useMutation(UPDATE_EPK_PAGE_MUTATION);
  const [publishEPK] = useMutation(PUBLISH_EPK_MUTATION);
  const [unpublishEPK] = useMutation(UNPUBLISH_EPK_MUTATION);
  const [generatePressKit] = useMutation(GENERATE_PRESS_KIT_MUTATION);

  const epk = release.epkPage;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data } = await generateEPK({ variables: { releaseId: release.id } });
      const page = data.generateEPK;
      setBio(page.bio ?? '');
      setPressPitch(page.pressPitch ?? '');
      setShortBio(page.shortBio ?? '');
      setReleaseDescription(page.releaseDescription ?? '');
      refetch();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    await updateEPKPage({
      variables: { releaseId: release.id, bio, pressPitch, shortBio, releaseDescription },
    });
    setEditing(false);
    refetch();
  }

  async function handleTogglePublish() {
    if (epk?.isPublished) {
      await unpublishEPK({ variables: { releaseId: release.id } });
    } else {
      await publishEPK({ variables: { releaseId: release.id } });
    }
    refetch();
  }

  async function handleGenerateKit() {
    setGeneratingKit(true);
    try {
      await generatePressKit({ variables: { releaseId: release.id } });
      refetch();
    } finally {
      setGeneratingKit(false);
    }
  }

  return (
    <View style={styles.tabContent}>
      <Card padding="lg">
        <View style={styles.epkHeader}>
          <Text style={styles.sectionTitle}>EPK Studio</Text>
          <Button
            label={generating ? 'Generating...' : epk ? 'Regenerate with AI' : 'Generate with AI'}
            onPress={handleGenerate}
            loading={generating}
            size="sm"
          />
        </View>

        {!epk && !generating && (
          <View style={styles.epkEmpty}>
            <Text style={styles.muted}>
              Click "Generate with AI" to create your press bio, pitch, and descriptions automatically.
            </Text>
          </View>
        )}

        {epk && (
          <View style={styles.epkContent}>
            {editing ? (
              <>
                <Input label="Artist Bio" value={bio} onChangeText={setBio} multiline numberOfLines={6} />
                <Input label="Press Pitch" value={pressPitch} onChangeText={setPressPitch} multiline numberOfLines={5} />
                <Input label="Short Bio (Spotify / Social)" value={shortBio} onChangeText={setShortBio} multiline numberOfLines={2} />
                <Input label="Release Description" value={releaseDescription} onChangeText={setReleaseDescription} multiline numberOfLines={4} />
                <View style={styles.editActions}>
                  <Button label="Save" onPress={handleSave} />
                  <Button label="Cancel" onPress={() => setEditing(false)} variant="ghost" />
                </View>
              </>
            ) : (
              <>
                <EPKSection title="Artist Bio" content={bio} />
                <EPKSection title="Press Pitch" content={pressPitch} />
                <EPKSection title="Short Bio" content={shortBio} />
                <EPKSection title="Release Description" content={releaseDescription} />
                <Button label="Edit" onPress={() => setEditing(true)} variant="secondary" size="sm" />
              </>
            )}
          </View>
        )}
      </Card>

      {epk && (
        <Card padding="lg">
          <Text style={styles.sectionTitle}>Publish EPK Page</Text>
          <View style={styles.publishRow}>
            <View style={styles.publishInfo}>
              <Text style={styles.publishStatus}>
                {epk.isPublished ? (
                  <Text style={{ color: colors.success }}>● Live</Text>
                ) : (
                  <Text style={{ color: colors.textMuted }}>● Draft</Text>
                )}
              </Text>
              {epk.isPublished && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`${process.env.EXPO_PUBLIC_FRONTEND_URL ?? ''}/epk/${epk.slug}`)}
                >
                  <Text style={styles.epkUrl}>
                    /epk/{epk.slug}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Button
              label={epk.isPublished ? 'Unpublish' : 'Publish'}
              onPress={handleTogglePublish}
              variant={epk.isPublished ? 'secondary' : 'primary'}
              size="sm"
            />
          </View>
        </Card>
      )}

      <Card padding="lg">
        <Text style={styles.sectionTitle}>Press Kit</Text>
        {release.pressKit ? (
          <View style={styles.pressKitRow}>
            <View style={styles.pressKitInfo}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.pressKitLabel}>press-kit.zip ready</Text>
            </View>
            <View style={styles.pressKitActions}>
              <Button
                label="Download"
                onPress={() => Linking.openURL(release.pressKit!.zipUrl)}
                size="sm"
                variant="secondary"
              />
              <Button
                label="Regenerate"
                onPress={handleGenerateKit}
                loading={generatingKit}
                size="sm"
                variant="ghost"
              />
            </View>
          </View>
        ) : (
          <View style={styles.pressKitEmpty}>
            <Text style={styles.muted}>
              Generate a downloadable zip with bio, pitch, and cover art for press distribution.
            </Text>
            <Button
              label="Generate Press Kit"
              onPress={handleGenerateKit}
              loading={generatingKit}
              style={{ marginTop: spacing.md }}
            />
          </View>
        )}
      </Card>
    </View>
  );
}

function OutreachTab({ release }: { release: Release }) {
  return (
    <View style={styles.tabContent}>
      <Card padding="lg">
        <Text style={styles.sectionTitle}>Outreach</Text>
        <Text style={styles.muted}>
          Go to the Contacts page to manage your contacts, then generate and send personalized outreach emails for this release.
        </Text>
        <Button
          label="Go to Contacts →"
          onPress={() => router.push('/(app)/contacts')}
          style={{ marginTop: spacing.md }}
          variant="secondary"
        />
      </Card>
      <Button
        label="Generate Outreach Emails"
        onPress={() => router.push(`/(app)/outreach/${release.id}` as any)}
        size="lg"
        fullWidth
      />
    </View>
  );
}

function EPKSection({ title, content }: { title: string; content: string }) {
  if (!content) return null;
  return (
    <View style={styles.epkSection}>
      <Text style={styles.epkSectionTitle}>{title}</Text>
      <Text style={styles.epkSectionContent}>{content}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <Ionicons name={icon} size={28} color={color} />
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDesc}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: spacing.xl, gap: spacing.lg, maxWidth: 860, width: '100%', alignSelf: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { color: colors.textSecondary, fontSize: fontSize.md },
  hero: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  coverArt: { width: 120, height: 120, borderRadius: radius.lg },
  coverPlaceholder: {
    width: 120, height: 120, borderRadius: radius.lg,
    backgroundColor: colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  heroInfo: { flex: 1, gap: spacing.sm },
  heroTitle: { fontSize: fontSize.xxxl, fontWeight: '700', color: colors.textPrimary },
  heroArtist: { fontSize: fontSize.lg, color: colors.textSecondary },
  heroBadges: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabContent: { gap: spacing.lg },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  infoGrid: { gap: spacing.sm },
  infoRow: { flexDirection: 'row', gap: spacing.md },
  infoLabel: { width: 80, fontSize: fontSize.sm, color: colors.textMuted },
  infoValue: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  actionGrid: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  actionCard: {
    flex: 1, minWidth: 140, backgroundColor: colors.bgElevated,
    borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  actionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  actionDesc: { fontSize: fontSize.sm, color: colors.textSecondary },
  epkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  epkEmpty: { paddingVertical: spacing.md },
  epkContent: { gap: spacing.lg },
  epkSection: { gap: spacing.xs },
  epkSectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  epkSectionContent: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24 },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  publishRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  publishInfo: { gap: 4 },
  publishStatus: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  epkUrl: { fontSize: fontSize.sm, color: colors.primary },
  pressKitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pressKitInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressKitLabel: { fontSize: fontSize.md, color: colors.textPrimary },
  pressKitActions: { flexDirection: 'row', gap: spacing.sm },
  pressKitEmpty: {},
  muted: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
});
