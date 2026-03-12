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
import { useQuery, useMutation, useLazyQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { ME_QUERY, RELEASE_QUERY, SEARCH_VIDEOS_QUERY, META_PAGES_QUERY } from '../../../src/graphql/queries';
import {
  GENERATE_EPK_MUTATION,
  PUBLISH_EPK_MUTATION,
  UNPUBLISH_EPK_MUTATION,
  UPDATE_EPK_PAGE_MUTATION,
  GENERATE_PRESS_KIT_MUTATION,
  DELETE_RELEASE_MUTATION,
  SAVE_VIDEO_SELECTION_MUTATION,
  CREATE_META_AD_CAMPAIGN_MUTATION,
} from '../../../src/graphql/mutations';
import { useAuth } from '../../../src/hooks/useAuth';
import { Button, Card, Badge } from '../../../src/components/ui';
import { Input } from '../../../src/components/ui/Input';
import { colors, spacing, fontSize, radius } from '../../../src/theme';
import type { Release, PexelsVideo } from '@toolkit/shared';

type Tab = 'overview' | 'epk' | 'outreach' | 'video-ads';

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
          {(['overview', 'epk', 'outreach', 'video-ads'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab ? styles.tabActive : undefined]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab ? styles.tabTextActive : undefined]}>
                {tab === 'overview'
                  ? 'Overview'
                  : tab === 'epk'
                  ? 'EPK Studio'
                  : tab === 'outreach'
                  ? 'Outreach'
                  : 'Video Ads'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'overview' && <OverviewTab release={release} refetch={refetch} />}
        {activeTab === 'epk' && <EPKTab release={release} refetch={refetch} />}
        {activeTab === 'outreach' && <OutreachTab release={release} />}
        {activeTab === 'video-ads' && <VideoAdsTab release={release} refetch={refetch} />}
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
          <ActionCard
            icon="film"
            title="Video Ads"
            description="Find videos & create Meta ads"
            onPress={() => {}}
            color="#8B5CF6"
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

function VideoAdsTab({ release, refetch }: { release: Release; refetch: () => void }) {
  const { user: authUser } = useAuth();
  const { data: meData } = useQuery(ME_QUERY);
  const user = meData?.me ?? authUser;
  const [videos, setVideos] = useState<PexelsVideo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(release.videoAdCampaign?.selectedVideoUrls ?? [])
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignVideoUrl, setCampaignVideoUrl] = useState('');
  const [campaignName, setCampaignName] = useState(`${release.title} – ${release.artistName}`);
  const [campaignMessage, setCampaignMessage] = useState(`Listen to ${release.title} by ${release.artistName} 🎵`);
  const [campaignBudget, setCampaignBudget] = useState('500');
  const [campaignDays, setCampaignDays] = useState('7');
  const [campaignResult, setCampaignResult] = useState<{ campaignId: string; campaignUrl: string } | null>(null);

  const metaConnected = Boolean(meData?.me?.metaConnected);

  const { data: pagesData, loading: loadingPages } = useQuery(META_PAGES_QUERY, {
    skip: !showCampaignForm || !metaConnected,
    onError: () => {},
  });

  const [searchVideos, { loading: searching }] = useLazyQuery(SEARCH_VIDEOS_QUERY, {
    onCompleted: (data) => {
      setVideos(data.searchVideosForRelease ?? []);
      setSaved(false);
    },
    onError: (err) => {
      alert(err.message);
    },
    fetchPolicy: 'network-only',
  });

  const [saveVideoSelection, { loading: saving }] = useMutation(SAVE_VIDEO_SELECTION_MUTATION, {
    onCompleted: () => {
      setSaved(true);
      refetch();
    },
    onError: (err) => {
      alert(err.message);
    },
  });

  const [createMetaAdCampaign, { loading: creatingCampaign }] = useMutation(
    CREATE_META_AD_CAMPAIGN_MUTATION,
    {
      onCompleted: (data) => {
        setCampaignResult(data.createMetaAdCampaign);
        setShowCampaignForm(false);
        refetch();
      },
      onError: (err) => {
        alert(err.message);
      },
    }
  );

  function toggleSelect(previewUrl: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(previewUrl)) {
        next.delete(previewUrl);
      } else {
        next.add(previewUrl);
      }
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    await saveVideoSelection({
      variables: { releaseId: release.id, videoUrls: Array.from(selected) },
    });
  }

  async function handleCreateCampaign() {
    const pages: Array<{ id: string; instagramActorId?: string }> = pagesData?.metaPages ?? [];
    if (pages.length === 0) {
      alert('No Meta Pages found on your account. Please create a Facebook Page first.');
      return;
    }
    const page = pages[0];
    await createMetaAdCampaign({
      variables: {
        releaseId: release.id,
        videoUrl: campaignVideoUrl,
        pageId: page.id,
        instagramActorId: page.instagramActorId ?? undefined,
        campaignName,
        dailyBudgetCents: Math.round(parseFloat(campaignBudget) * 100),
        durationDays: parseInt(campaignDays, 10),
        message: campaignMessage,
      },
    });
  }

  const isPro = (meData?.me?.plan ?? authUser?.plan) === 'PRO';

  if (!isPro) {
    return (
      <View style={styles.tabContent}>
        <Card padding="lg">
          <View style={styles.proGate}>
            <Ionicons name="lock-closed" size={32} color={colors.textMuted} />
            <Text style={styles.proGateTitle}>Video Ads — Pro Feature</Text>
            <Text style={styles.muted}>
              Upgrade to Pro to access the royalty-free video library and create Meta ad campaigns.
            </Text>
            <Button
              label="Upgrade to Pro"
              onPress={() => router.push('/(app)/settings')}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <Card padding="lg">
        <View style={styles.videoAdsHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Video Ads</Text>
            <Text style={styles.muted}>
              Find royalty-free portrait videos that match the mood of your track — ready for
              Instagram Reels & Stories ads.
            </Text>
          </View>
          <Button
            label={searching ? 'Searching...' : 'Find Videos'}
            onPress={() => searchVideos({ variables: { releaseId: release.id } })}
            loading={searching}
            size="sm"
          />
        </View>

        {release.mood || release.genre ? (
          <View style={styles.moodRow}>
            {release.mood && (
              <View style={styles.moodChip}>
                <Ionicons name="musical-note" size={12} color="#8B5CF6" />
                <Text style={styles.moodChipText}>{release.mood}</Text>
              </View>
            )}
            {release.genre && (
              <View style={styles.moodChip}>
                <Ionicons name="headset" size={12} color="#8B5CF6" />
                <Text style={styles.moodChipText}>{release.genre}</Text>
              </View>
            )}
            <Text style={styles.moodHint}>Keywords auto-generated from these tags</Text>
          </View>
        ) : null}
      </Card>

      {videos.length > 0 && (
        <Card padding="lg">
          <View style={styles.videoGridHeader}>
            <Text style={styles.sectionTitle}>
              {videos.length} videos found
            </Text>
            {selected.size > 0 && (
              <Text style={styles.selectedCount}>{selected.size} selected</Text>
            )}
          </View>

          <View style={styles.videoGrid}>
            {videos.map((video) => {
              const isSelected = selected.has(video.previewUrl);
              const isHovered = hoveredId === video.id;
              return (
                <TouchableOpacity
                  key={video.id}
                  style={[styles.videoCard, isSelected ? styles.videoCardSelected : undefined]}
                  onPress={() => toggleSelect(video.previewUrl)}
                  // @ts-ignore - web-only hover events
                  onMouseEnter={() => setHoveredId(video.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {isHovered ? (
                    // @ts-ignore - web-only video element
                    <video
                      src={video.previewUrl}
                      style={styles.videoThumb as any}
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <Image source={{ uri: video.thumbnailUrl }} style={styles.videoThumb} />
                  )}
                  {isSelected && (
                    <View style={styles.videoSelectedOverlay}>
                      <Ionicons name="checkmark-circle" size={28} color="#fff" />
                    </View>
                  )}
                  <View style={styles.videoMeta}>
                    <Text style={styles.videoDuration}>{video.duration}s</Text>
                    <Text style={styles.videoPhotographer} numberOfLines={1}>
                      {video.photographer}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.pexelsAttribution}>
            Videos provided by{' '}
            <Text
              style={styles.pexelsLink}
              onPress={() => Linking.openURL('https://www.pexels.com')}
            >
              Pexels
            </Text>
          </Text>
        </Card>
      )}

      {(videos.length > 0 || (release.videoAdCampaign?.selectedVideoUrls?.length ?? 0) > 0) && (
        <Card padding="lg">
          <Text style={styles.sectionTitle}>Export & Ads</Text>
          {selected.size === 0 ? (
            <Text style={styles.muted}>Select videos above to save your choices.</Text>
          ) : (
            <>
              <Text style={[styles.muted, { marginBottom: spacing.md }]}>
                {selected.size} video{selected.size > 1 ? 's' : ''} selected.
              </Text>
              <View style={styles.adsActions}>
                <Button
                  label={saved ? 'Saved!' : saving ? 'Saving...' : 'Save Selection'}
                  onPress={handleSave}
                  loading={saving}
                  variant={saved ? 'secondary' : 'primary'}
                />
                {metaConnected ? (
                  <Button
                    label="Create Meta Campaign"
                    onPress={() => {
                      setCampaignVideoUrl(Array.from(selected)[0] ?? '');
                      setShowCampaignForm(true);
                    }}
                    variant="secondary"
                  />
                ) : (
                  <Button
                    label="Open Meta Ads Manager"
                    onPress={() =>
                      Linking.openURL('https://adsmanager.facebook.com/adsmanager/creation')
                    }
                    variant="ghost"
                  />
                )}
              </View>

              {!metaConnected && (
                <View style={styles.metaHint}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <Text style={styles.metaHintText}>
                    Connect your Meta account in Settings to create campaigns directly from here.
                    Otherwise, download your videos from Pexels and upload them manually.
                  </Text>
                </View>
              )}

              {showCampaignForm && (
                <View style={styles.campaignForm}>
                  <Text style={styles.campaignFormTitle}>Create Meta Ad Campaign</Text>
                  <View style={styles.campaignVideoRow}>
                    <Text style={styles.campaignFieldLabel}>Video URL</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {Array.from(selected).map((url) => (
                        <TouchableOpacity
                          key={url}
                          style={[
                            styles.campaignVideoChip,
                            campaignVideoUrl === url ? styles.campaignVideoChipSelected : undefined,
                          ]}
                          onPress={() => setCampaignVideoUrl(url)}
                        >
                          <Text style={styles.campaignVideoChipText} numberOfLines={1}>
                            {url.split('/').pop()?.split('?')[0] ?? url}
                          </Text>
                          {campaignVideoUrl === url && (
                            <Ionicons name="checkmark-circle" size={14} color="#8B5CF6" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <Input
                    label="Campaign name"
                    value={campaignName}
                    onChangeText={setCampaignName}
                  />
                  <Input
                    label="Ad message (caption)"
                    value={campaignMessage}
                    onChangeText={setCampaignMessage}
                    multiline
                    numberOfLines={2}
                  />
                  <View style={styles.campaignRow}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Daily budget (€)"
                        value={campaignBudget}
                        onChangeText={setCampaignBudget}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input
                        label="Duration (days)"
                        value={campaignDays}
                        onChangeText={setCampaignDays}
                      />
                    </View>
                  </View>
                  {loadingPages && (
                    <Text style={styles.muted}>Loading your Meta Pages...</Text>
                  )}
                  <View style={styles.campaignActions}>
                    <Button
                      label={creatingCampaign ? 'Creating campaign...' : 'Launch Campaign (Paused)'}
                      onPress={handleCreateCampaign}
                      loading={creatingCampaign}
                      disabled={!campaignVideoUrl}
                    />
                    <Button
                      label="Cancel"
                      onPress={() => setShowCampaignForm(false)}
                      variant="ghost"
                    />
                  </View>
                  <View style={styles.metaHint}>
                    <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.metaHintText}>
                      Campaign is created in Paused state. Review it in Meta Ads Manager before
                      activating. Uses your first Facebook Page.
                    </Text>
                  </View>
                </View>
              )}

              {campaignResult && (
                <View style={[styles.metaHint, { borderColor: colors.success, borderWidth: 1, backgroundColor: colors.successBg }]}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.metaHintText, { color: colors.success, fontWeight: '700' }]}>
                      Campaign created! ID: {campaignResult.campaignId}
                    </Text>
                    <Text
                      style={[styles.metaHintText, { color: colors.primary }]}
                      onPress={() => Linking.openURL(campaignResult.campaignUrl)}
                    >
                      Open in Meta Ads Manager →
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </Card>
      )}

      {videos.length === 0 && !searching && (release.videoAdCampaign?.selectedVideoUrls?.length ?? 0) > 0 && (
        <Card padding="lg">
          <Text style={styles.sectionTitle}>Saved Selection</Text>
          <Text style={[styles.muted, { marginBottom: spacing.md }]}>
            {release.videoAdCampaign!.selectedVideoUrls.length} video
            {release.videoAdCampaign!.selectedVideoUrls.length > 1 ? 's' : ''} saved. Click "Find
            Videos" to update your selection.
          </Text>
          <Button
            label="Open Meta Ads Manager"
            onPress={() =>
              Linking.openURL('https://adsmanager.facebook.com/adsmanager/creation')
            }
            variant="secondary"
          />
        </Card>
      )}
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

  // VideoAdsTab
  videoAdsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  moodChipText: { fontSize: fontSize.xs, color: '#8B5CF6', fontWeight: '600' },
  moodHint: { fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' },
  videoGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectedCount: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  videoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  videoCard: {
    width: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  videoCardSelected: {
    borderColor: '#8B5CF6',
  },
  videoThumb: {
    width: 140,
    height: 196,
    objectFit: 'cover',
  } as any,
  videoSelectedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 999,
  },
  videoMeta: {
    padding: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  videoDuration: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  videoPhotographer: { fontSize: fontSize.xs, color: colors.textMuted, flex: 1, textAlign: 'right' },
  pexelsAttribution: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  pexelsLink: { color: colors.primary },
  adsActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  metaHint: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'flex-start',
  },
  metaHintText: { fontSize: fontSize.xs, color: colors.textMuted, flex: 1, lineHeight: 18 },
  proGate: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  proGateTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },

  campaignForm: {
    marginTop: spacing.lg,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  campaignFormTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  campaignFieldLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  campaignVideoRow: { gap: spacing.xs },
  campaignVideoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    backgroundColor: colors.bgElevated,
    maxWidth: 200,
  },
  campaignVideoChipSelected: { borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)' },
  campaignVideoChipText: { fontSize: fontSize.xs, color: colors.textPrimary, flex: 1 },
  campaignRow: { flexDirection: 'row', gap: spacing.md },
  campaignActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
