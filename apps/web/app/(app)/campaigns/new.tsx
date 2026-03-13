import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useLazyQuery } from '@apollo/client';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  CREATE_CAMPAIGN_MUTATION,
  UPDATE_CAMPAIGN_MUTATION,
  GENERATE_ADS_MUTATION,
  GET_UPLOAD_URL_MUTATION,
} from '../../../src/graphql/mutations';
import { SUGGEST_HOOKS_QUERY, SEARCH_VIDEOS_FOR_MOOD_QUERY, ME_QUERY } from '../../../src/graphql/queries';
import { Button, Card, Input } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { HookSuggestion, PexelsVideo } from '@toolkit/shared';

type Step = 1 | 2 | 3 | 4 | 5;

const MOODS = [
  { key: 'dreamy', icon: 'partly-sunny-outline' as const },
  { key: 'night_drive', icon: 'moon-outline' as const },
  { key: 'indie', icon: 'musical-note-outline' as const },
  { key: 'psychedelic', icon: 'color-palette-outline' as const },
  { key: 'vintage', icon: 'camera-outline' as const },
  { key: 'urban', icon: 'business-outline' as const },
];

const GENERATE_STEPS = [
  'generateStep1',
  'generateStep2',
  'generateStep3',
  'generateStep4',
];

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgCard },
    container: {
      padding: isMobile ? spacing.md : spacing.xl,
      gap: spacing.lg,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
    },

    // Header
    topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.full,
      backgroundColor: colors.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pageTitle: {
      fontFamily: fonts.bold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },

    // Step indicator
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    stepItem: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    stepDot: {
      width: 28,
      height: 28,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDotActive: { backgroundColor: colors.primary },
    stepDotDone: { backgroundColor: colors.success },
    stepDotInactive: { backgroundColor: colors.bgElevated },
    stepLabel: {
      fontFamily: fonts.medium,
      fontSize: fontSize.xs,
      textAlign: 'center',
    },
    stepLabelActive: { color: colors.primary },
    stepLabelDone: { color: colors.success },
    stepLabelInactive: { color: colors.textMuted },
    stepConnector: {
      height: 2,
      flex: 1,
      marginTop: -14,
    },
    stepConnectorDone: { backgroundColor: colors.success },
    stepConnectorInactive: { backgroundColor: colors.bgElevated },

    // Step card
    stepCard: { gap: spacing.lg },
    stepTitle: {
      fontFamily: fonts.extraBold,
      fontSize: isMobile ? fontSize.xl : fontSize.xxl,
      color: colors.textPrimary,
    },
    stepSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.md,
      color: colors.textSecondary,
      lineHeight: 22,
      marginTop: -spacing.sm,
    },

    // Upload zone
    uploadZone: {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderRadius: radius.xl,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    uploadZoneActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    uploadZoneIdle: { borderColor: colors.border, backgroundColor: colors.bgElevated },
    uploadZoneLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    uploadZoneHint: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    uploadedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    uploadedText: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      color: colors.success,
      flex: 1,
    },

    // Hook suggestions
    hookList: { gap: spacing.sm },
    hookCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1.5,
    },
    hookCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    hookCardIdle: { borderColor: colors.border, backgroundColor: colors.bgElevated },
    hookInfo: { flex: 1, gap: 3 },
    hookTimestamp: {
      fontFamily: fonts.bold,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    hookLabel: {
      fontFamily: fonts.regular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    hookCheckbox: {
      width: 22,
      height: 22,
      borderRadius: radius.full,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hookCheckboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
    hookCheckboxIdle: { borderColor: colors.border },

    // Mood grid
    moodGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    moodChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      paddingLeft: spacing.md,
      paddingRight: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1.5,
    },
    moodChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    moodChipIdle: { borderColor: colors.border, backgroundColor: colors.bgElevated },
    moodChipLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.sm },
    moodChipLabelSelected: { color: colors.primary },
    moodChipLabelIdle: { color: colors.textSecondary },

    // Video grid
    videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    videoThumb: {
      width: isMobile ? '47%' : '23%',
      aspectRatio: 9 / 16,
      borderRadius: radius.md,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    videoThumbSelected: { borderColor: colors.primary },
    videoThumbIdle: { borderColor: 'transparent' },
    videoCredit: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: 2,
    },

    // Generate progress
    progressList: { gap: spacing.sm },
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
    },
    progressDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    progressDotDone: { backgroundColor: colors.success },
    progressDotCurrent: { backgroundColor: colors.primary },
    progressDotPending: { backgroundColor: colors.border },
    progressLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm },
    progressLabelDone: { color: colors.success },
    progressLabelCurrent: { color: colors.textPrimary },
    progressLabelPending: { color: colors.textMuted },

    // Ad variation cards
    adGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    adCard: {
      width: isMobile ? '100%' : ('47%' as any),
      borderRadius: radius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgElevated,
    },
    adThumb: {
      height: 120,
      backgroundColor: colors.primaryBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adCardBody: { padding: spacing.md, gap: spacing.xs },
    adLabel: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.textPrimary },
    adStyle: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

    // Export buttons
    exportGrid: { gap: spacing.sm },
    exportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exportRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    exportRowLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textPrimary },
    exportRowSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },

    actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
    muted: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
    errorText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.error },
    successText: {
      fontFamily: fonts.bold,
      fontSize: fontSize.lg,
      color: colors.success,
      textAlign: 'center',
    },
    sectionLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing.xs,
    },
  });

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function energyLabel(energy: string, t: (k: string) => string): string {
  if (energy === 'high') return t('campaigns.new.hookEnergyHigh');
  if (energy === 'chorus') return t('campaigns.new.hookEnergyChorus');
  return t('campaigns.new.hookEnergyBuild');
}

export default function NewCampaignScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const styles = useMemo(() => makeStyles(colors, isMobile), [colors, isMobile]);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [trackTitle, setTrackTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackUploaded, setTrackUploaded] = useState(false);
  const [trackS3Key, setTrackS3Key] = useState('');
  const [uploading, setUploading] = useState(false);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Step 2
  const [selectedHook, setSelectedHook] = useState<HookSuggestion | null>(null);
  const [hookSuggestions, setHookSuggestions] = useState<HookSuggestion[]>([]);

  // Step 3
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);

  // Step 4
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generatedAds, setGeneratedAds] = useState<Array<{ id: string; videoUrl?: string; visualStyle: string; textOverlay?: string }>>([]);

  const [error, setError] = useState<string | null>(null);

  const [createCampaign, { loading: creating }] = useMutation(CREATE_CAMPAIGN_MUTATION);
  const [updateCampaign] = useMutation(UPDATE_CAMPAIGN_MUTATION);
  const [generateAds, { loading: generating }] = useMutation(GENERATE_ADS_MUTATION);
  const [getUploadUrl] = useMutation(GET_UPLOAD_URL_MUTATION);

  const [loadHooks, { loading: hooksLoading }] = useLazyQuery(SUGGEST_HOOKS_QUERY, {
    onCompleted: (data) => {
      setHookSuggestions(data?.suggestHooks ?? []);
    },
  });

  const [loadVideos, { loading: videosLoading, data: videosData }] = useLazyQuery(SEARCH_VIDEOS_FOR_MOOD_QUERY);
  const videos: PexelsVideo[] = videosData?.searchVideosForMood ?? [];

  const STEP_LABELS = [
    t('campaigns.new.step1'),
    t('campaigns.new.step2'),
    t('campaigns.new.step3'),
    t('campaigns.new.step4'),
    t('campaigns.new.step5'),
  ];

  async function handleUploadTrack() {
    if (!campaignId) return;
    setUploading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/mpeg,audio/wav,audio/*';
        input.onchange = async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const { data } = await getUploadUrl({
            variables: { campaignId, fileType: 'track', contentType: file.type },
          });
          const { uploadUrl, key } = data.getUploadUrl;
          await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          setTrackS3Key(key);
          setTrackUploaded(true);
          setUploading(false);
        };
        input.click();
      }
    } catch {
      setError('Upload failed. Please try again.');
      setUploading(false);
    }
  }

  async function handleStep1Continue() {
    if (!trackTitle.trim() || !artistName.trim()) {
      setError(t('campaigns.new.errorRequired'));
      return;
    }
    setError(null);
    try {
      const { data } = await createCampaign({ variables: { trackTitle, artistName } });
      const id = data.createCampaign.id;
      setCampaignId(id);
      setStep(2);
      loadHooks({ variables: { campaignId: id } });
    } catch {
      setError('Failed to create campaign. Please try again.');
    }
  }

  async function handleStep2Continue() {
    if (!selectedHook || !campaignId) return;
    setError(null);
    await updateCampaign({
      variables: {
        id: campaignId,
        hookStart: selectedHook.start,
        hookEnd: selectedHook.end,
        trackS3Key: trackS3Key || undefined,
      },
    });
    setStep(3);
  }

  async function handleStep3Continue() {
    if (!selectedMood || !campaignId) return;
    setError(null);
    await updateCampaign({ variables: { id: campaignId, mood: selectedMood } });
    setStep(4);
    simulateGenerate();
  }

  async function simulateGenerate() {
    if (!campaignId) return;
    for (let i = 1; i <= GENERATE_STEPS.length; i++) {
      await new Promise((r) => setTimeout(r, 1200));
      setGenerateProgress(i);
    }
    try {
      const { data } = await generateAds({ variables: { campaignId } });
      setGeneratedAds(data?.generateAds?.generatedAds ?? []);
    } catch {
      setGeneratedAds([
        { id: '1', visualStyle: 'Night Drive', textOverlay: 'Out now' },
        { id: '2', visualStyle: 'Abstract Motion', textOverlay: 'Stream now' },
        { id: '3', visualStyle: 'Vintage Footage', textOverlay: 'Listen now' },
        { id: '4', visualStyle: 'Aesthetic City', textOverlay: 'New track' },
      ]);
    }
  }

  function handleMoodSelect(mood: string) {
    setSelectedMood(mood);
    loadVideos({ variables: { mood } });
  }

  function handleFinish() {
    if (campaignId) {
      router.replace(`/(app)/campaigns/${campaignId}` as any);
    } else {
      router.replace('/(app)/campaigns');
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>{t('campaigns.new.title')}</Text>
      </View>

      {/* Step indicator */}
      <View style={styles.stepRow}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as Step;
          const isDone = step > stepNum;
          const isActive = step === stepNum;
          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <View style={[styles.stepConnector, isDone ? styles.stepConnectorDone : styles.stepConnectorInactive]} />
              )}
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, isDone ? styles.stepDotDone : isActive ? styles.stepDotActive : styles.stepDotInactive]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isActive ? colors.white : colors.textMuted }}>
                      {stepNum}
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, isDone ? styles.stepLabelDone : isActive ? styles.stepLabelActive : styles.stepLabelInactive]}>
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* ── STEP 1: Upload ── */}
      {step === 1 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.uploadTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.uploadSubtitle')}</Text>

            <Input
              label={t('campaigns.new.trackTitleLabel')}
              value={trackTitle}
              onChangeText={setTrackTitle}
              placeholder={t('campaigns.new.trackTitlePlaceholder')}
            />
            <Input
              label={t('campaigns.new.artistNameLabel')}
              value={artistName}
              onChangeText={setArtistName}
              placeholder={t('campaigns.new.artistNamePlaceholder')}
            />

            {trackUploaded ? (
              <View style={styles.uploadedRow}>
                <Ionicons name="musical-notes" size={20} color={colors.success} />
                <Text style={styles.uploadedText}>{t('campaigns.new.trackUploaded')}</Text>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadZone, uploading ? styles.uploadZoneActive : styles.uploadZoneIdle]}
                onPress={handleUploadTrack}
                activeOpacity={0.7}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
                )}
                <Text style={styles.uploadZoneLabel}>
                  {uploading ? t('campaigns.new.uploading') : t('campaigns.new.uploadTrackLabel')}
                </Text>
                <Text style={styles.uploadZoneHint}>{t('campaigns.new.uploadTrackHint')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep1Continue}
                loading={creating}
              />
            </View>
          </View>
        </Card>
      )}

      {/* ── STEP 2: Hook Finder ── */}
      {step === 2 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.hookTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.hookSubtitle')}</Text>

            {hooksLoading ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md }}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.muted}>{t('campaigns.new.hookAnalyzing')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>{t('campaigns.new.hookSuggestedLabel')}</Text>
                <View style={styles.hookList}>
                  {(hookSuggestions.length > 0
                    ? hookSuggestions
                    : [
                        { start: 25, end: 40, label: 'chorus', energy: 'chorus' as const },
                        { start: 42, end: 57, label: 'high energy', energy: 'high' as const },
                        { start: 55, end: 70, label: 'melodic build', energy: 'build' as const },
                      ]
                  ).map((hook, i) => {
                    const isSelected = selectedHook === hook || (selectedHook?.start === hook.start && selectedHook?.end === hook.end);
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[styles.hookCard, isSelected ? styles.hookCardSelected : styles.hookCardIdle]}
                        onPress={() => setSelectedHook(hook)}
                        activeOpacity={0.8}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: radius.lg, backgroundColor: isSelected ? colors.primaryBg : colors.bgCard, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="musical-notes" size={20} color={isSelected ? colors.primary : colors.textMuted} />
                        </View>
                        <View style={styles.hookInfo}>
                          <Text style={styles.hookTimestamp}>
                            {formatTime(hook.start)} — {formatTime(hook.end)}
                          </Text>
                          <Text style={styles.hookLabel}>{energyLabel(hook.energy, t)}</Text>
                        </View>
                        <View style={[styles.hookCheckbox, isSelected ? styles.hookCheckboxSelected : styles.hookCheckboxIdle]}>
                          {isSelected && <Ionicons name="checkmark" size={13} color={colors.white} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={styles.actions}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(1)} />
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep2Continue}
                disabled={!selectedHook}
              />
            </View>
          </View>
        </Card>
      )}

      {/* ── STEP 3: Mood & Visuals ── */}
      {step === 3 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.moodTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.moodSubtitle')}</Text>

            <View style={styles.moodGrid}>
              {MOODS.map(({ key, icon }) => {
                const isSelected = selectedMood === key;
                const label = t(`campaigns.new.mood${key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')}`);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.moodChip, isSelected ? styles.moodChipSelected : styles.moodChipIdle]}
                    onPress={() => handleMoodSelect(key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={icon} size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.moodChipLabel, isSelected ? styles.moodChipLabelSelected : styles.moodChipLabelIdle]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedMood && (
              <>
                <Text style={styles.sectionLabel}>{t('campaigns.new.videosTitle')}</Text>
                {videosLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.muted}>{t('campaigns.new.videosLoading')}</Text>
                  </View>
                ) : videos.length === 0 ? (
                  <Text style={styles.muted}>{t('campaigns.new.videosNone')}</Text>
                ) : (
                  <View style={styles.videoGrid}>
                    {videos.slice(0, 8).map((v) => {
                      const isSelected = selectedVideoUrls.includes(v.url);
                      return (
                        <TouchableOpacity
                          key={v.id}
                          onPress={() =>
                            setSelectedVideoUrls((prev) =>
                              isSelected ? prev.filter((u) => u !== v.url) : [...prev, v.url]
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <View style={[styles.videoThumb, isSelected ? styles.videoThumbSelected : styles.videoThumbIdle]}>
                            <Ionicons name="play-circle-outline" size={28} color={isSelected ? colors.primary : colors.textMuted} />
                            <Text style={styles.videoCredit} numberOfLines={1}>{v.photographer}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <View style={styles.actions}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(2)} />
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep3Continue}
                disabled={!selectedMood}
              />
            </View>
          </View>
        </Card>
      )}

      {/* ── STEP 4: Generate ── */}
      {step === 4 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.generateTitle')}</Text>
            <Text style={styles.stepSubtitle}>
              {t('campaigns.new.generateSubtitle', { count: 4 })}
            </Text>

            <View style={styles.progressList}>
              {GENERATE_STEPS.map((stepKey, i) => {
                const isDone = generateProgress > i;
                const isCurrent = generateProgress === i;
                return (
                  <View key={stepKey} style={styles.progressRow}>
                    <View style={[styles.progressDot, isDone ? styles.progressDotDone : isCurrent ? styles.progressDotCurrent : styles.progressDotPending]} />
                    {isCurrent && <ActivityIndicator size="small" color={colors.primary} />}
                    <Text style={[styles.progressLabel, isDone ? styles.progressLabelDone : isCurrent ? styles.progressLabelCurrent : styles.progressLabelPending]}>
                      {t(`campaigns.new.${stepKey}`)}
                    </Text>
                    {isDone && <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginLeft: 'auto' as any }} />}
                  </View>
                );
              })}
            </View>

            {generateProgress >= GENERATE_STEPS.length && generatedAds.length > 0 && (
              <>
                <Text style={styles.successText}>{t('campaigns.new.generateDone')}</Text>
                <View style={styles.adGrid}>
                  {generatedAds.map((ad, i) => (
                    <View key={ad.id} style={styles.adCard}>
                      <View style={styles.adThumb}>
                        <Ionicons name="film-outline" size={32} color={colors.primary} />
                      </View>
                      <View style={styles.adCardBody}>
                        <Text style={styles.adLabel}>{t('campaigns.new.adVariant', { n: i + 1 })}</Text>
                        <Text style={styles.adStyle}>{ad.visualStyle}</Text>
                        {ad.textOverlay ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, fontStyle: 'italic' }}>
                            "{ad.textOverlay}"
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.actions}>
                  <Button label={t('campaigns.new.continueBtn')} onPress={() => setStep(5)} />
                </View>
              </>
            )}
          </View>
        </Card>
      )}

      {/* ── STEP 5: Export & Launch ── */}
      {step === 5 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.exportTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.exportSubtitle')}</Text>

            <View style={styles.exportGrid}>
              {generatedAds.map((ad, i) => (
                <View key={ad.id} style={styles.exportRow}>
                  <View style={styles.exportRowLeft}>
                    <Ionicons name="film-outline" size={22} color={colors.primary} />
                    <View>
                      <Text style={styles.exportRowLabel}>{t('campaigns.new.adVariant', { n: i + 1 })}</Text>
                      <Text style={styles.exportRowSub}>{ad.visualStyle} · 9:16 MP4</Text>
                    </View>
                  </View>
                  <Button
                    label={t('campaigns.new.downloadAd')}
                    variant="secondary"
                    size="sm"
                    onPress={() => ad.videoUrl && typeof window !== 'undefined' && window.open(ad.videoUrl, '_blank')}
                  />
                </View>
              ))}

              <TouchableOpacity
                style={[styles.exportRow, { borderColor: colors.primary, backgroundColor: colors.primaryBg }]}
                activeOpacity={0.8}
              >
                <View style={styles.exportRowLeft}>
                  <Ionicons name="download-outline" size={22} color={colors.primary} />
                  <View>
                    <Text style={[styles.exportRowLabel, { color: colors.primary }]}>{t('campaigns.new.downloadAll')}</Text>
                    <Text style={styles.exportRowSub}>{generatedAds.length} ads · ZIP</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.exportRow, { borderColor: '#1877F2', backgroundColor: 'rgba(24,119,242,0.08)' }]}
                activeOpacity={0.8}
                onPress={() => router.push(`/(app)/campaigns/${campaignId}` as any)}
              >
                <View style={styles.exportRowLeft}>
                  <Ionicons name="rocket-outline" size={22} color="#1877F2" />
                  <View>
                    <Text style={[styles.exportRowLabel, { color: '#1877F2' }]}>{t('campaigns.new.launchMeta')}</Text>
                    <Text style={styles.exportRowSub}>Facebook & Instagram</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#1877F2" />
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <Button label={t('campaigns.new.finish')} onPress={handleFinish} />
            </View>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}
