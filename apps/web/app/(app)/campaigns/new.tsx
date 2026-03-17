import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Image,
  Animated,
  TextInput,
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
import { useMutation as useResendMutation } from '@apollo/client';
import { RESEND_VERIFICATION_MUTATION } from '../../../src/graphql/mutations';
import { SUGGEST_HOOKS_QUERY, SUGGEST_MOOD_QUERY, SEARCH_VIDEOS_FOR_MOOD_QUERY, ME_QUERY } from '../../../src/graphql/queries';
import { Button, Card, Input, WaveformHookPicker } from '../../../src/components/ui';
import { useTheme } from '../../../src/hooks/useTheme';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { HookSuggestion, PexelsVideo } from '@toolkit/shared';

type Step = 1 | 2 | 3 | 4 | 5;

interface MoodOption {
  key: string;
  label: string;
  videoKeywords: string[];
  icon: string;
}

const DEFAULT_MOODS: MoodOption[] = [
  { key: 'dreamy', label: 'Dreamy & Ethereal', videoKeywords: [], icon: 'partly-sunny-outline' },
  { key: 'night_drive', label: 'Night Drive', videoKeywords: [], icon: 'moon-outline' },
  { key: 'raw_indie', label: 'Raw Indie', videoKeywords: [], icon: 'musical-note-outline' },
  { key: 'psychedelic', label: 'Psychedelic', videoKeywords: [], icon: 'color-palette-outline' },
];

const GENERATE_STEPS = [
  'generateStep1',
  'generateStep2',
  'generateStep3',
  'generateStep4',
];

const makeStyles = (colors: ColorPalette, isMobile: boolean, thumbWidth: number) =>
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
    moodGridMobile: {
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

    // Video source tab switcher
    videoTabRow: {
      flexDirection: 'row',
      backgroundColor: colors.bgElevated,
      borderRadius: radius.lg,
      padding: 3,
      gap: 3,
    },
    videoTab: {
      flex: 1,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: spacing.xs,
    },
    videoTabActive: { backgroundColor: colors.bg },
    videoTabLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.sm },
    videoTabLabelActive: { color: colors.textPrimary },
    videoTabLabelIdle: { color: colors.textMuted },

    // Video grid
    videoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    videoThumb: {
      width: thumbWidth,
      height: Math.round(thumbWidth * (16 / 9)),
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

const COLS_DESKTOP = 4;
const COLS_MOBILE = 2;

function VideoSkeletonGrid({ isMobile, colors }: { isMobile: boolean; colors: ColorPalette }) {
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const rows = 2;

  return (
    <View style={{ gap: spacing.sm }}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: 'row', gap: spacing.sm }}>
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Animated.View
              key={colIdx}
              style={{
                flex: 1,
                aspectRatio: 9 / 16,
                borderRadius: radius.md,
                backgroundColor: colors.bgElevated,
                opacity: pulse,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export default function NewCampaignScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const styles = useMemo(() => makeStyles(colors, isMobile, 0), [colors, isMobile]);

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [trackTitle, setTrackTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackUploaded, setTrackUploaded] = useState(false);
  const [trackS3Key, setTrackS3Key] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingTrackFile, setPendingTrackFile] = useState<File | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Step 2
  const [selectedHook, setSelectedHook] = useState<HookSuggestion | null>(null);
  const [hookSuggestions, setHookSuggestions] = useState<HookSuggestion[]>([]);

  // Step 3
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [aiSuggestedMood, setAiSuggestedMood] = useState<string | null>(null);
  const [moodVideoKeywords, setMoodVideoKeywords] = useState<string[]>([]);
  const [aiMoods, setAiMoods] = useState<MoodOption[] | null>(null);
  const [moodsLoading, setMoodsLoading] = useState(false);

  const displayMoods = aiMoods ?? DEFAULT_MOODS;
  const [selectedVideoUrls, setSelectedVideoUrls] = useState<string[]>([]);
  const [videoSource, setVideoSource] = useState<'stock' | 'own'>('stock');
  const [customVideoS3Key, setCustomVideoS3Key] = useState('');
  const [customVideoUploaded, setCustomVideoUploaded] = useState(false);
  const [customVideoLocalUrl, setCustomVideoLocalUrl] = useState<string | null>(null);
  const [customVideoFileName, setCustomVideoFileName] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<PexelsVideo | null>(null);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [videoSearchActive, setVideoSearchActive] = useState(false);

  // Step 4
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generatedAds, setGeneratedAds] = useState<Array<{ id: string; videoUrl?: string; visualStyle: string; textOverlay?: string }>>([]);

  const [error, setError] = useState<string | null>(null);
  const [showVerifModal, setShowVerifModal] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState(false);

  // Step 1 loading overlay
  const [uploadOverlay, setUploadOverlay] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStepIdx, setUploadStepIdx] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearProgressInterval() {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }

  function animateProgressTo(target: number, durationMs: number) {
    clearProgressInterval();
    const steps = 30;
    const interval = durationMs / steps;
    let count = 0;
    progressIntervalRef.current = setInterval(() => {
      count++;
      setUploadProgress((prev) => {
        const next = prev + (target - prev) * (count / steps);
        return count >= steps ? target : next;
      });
      if (count >= steps) clearProgressInterval();
    }, interval);
  }

  useEffect(() => () => clearProgressInterval(), []);

  const [createCampaign, { loading: creating }] = useMutation(CREATE_CAMPAIGN_MUTATION);
  const [resendVerification, { loading: resending }] = useResendMutation(RESEND_VERIFICATION_MUTATION);
  const [updateCampaign] = useMutation(UPDATE_CAMPAIGN_MUTATION);
  const [generateAds, { loading: generating }] = useMutation(GENERATE_ADS_MUTATION);
  const [getUploadUrl] = useMutation(GET_UPLOAD_URL_MUTATION);

  const [loadHooks, { loading: hooksLoading }] = useLazyQuery(SUGGEST_HOOKS_QUERY, {
    onCompleted: (data) => {
      const hooks = data?.suggestHooks ?? [];
      setHookSuggestions(hooks);
      // Auto-select the first suggestion so the user can continue without interaction
      if (hooks.length > 0) {
        setSelectedHook(hooks[0]);
      }
    },
  });

  const [loadMoodSuggestion] = useLazyQuery(SUGGEST_MOOD_QUERY, {
    onCompleted: (data) => {
      const suggestion = data?.suggestMood;
      if (!suggestion?.moods?.length) return;
      const moods: MoodOption[] = suggestion.moods;
      setAiMoods(moods);
      setMoodsLoading(false);
      // Auto-select the first (best) mood
      const first = moods[0];
      setAiSuggestedMood(first.key);
      setMoodVideoKeywords(first.videoKeywords ?? []);
      setSelectedMood(first.key);
      setVideoPage(1);
      loadVideos({ variables: { mood: first.key, page: 1, keywords: first.videoKeywords } });
    },
  });

  const [videoPage, setVideoPage] = useState(1);
  const [loadVideos, { loading: videosLoading, data: videosData }] = useLazyQuery(SEARCH_VIDEOS_FOR_MOOD_QUERY);
  const videosPage = videosData?.searchVideosForMood;
  const videos: PexelsVideo[] = videosPage?.videos ?? [];
  const videoTotalResults: number = videosPage?.totalResults ?? 0;
  const videoPerPage: number = videosPage?.perPage ?? 8;
  const totalVideoPages = Math.ceil(videoTotalResults / videoPerPage);

  const videoGrid = useMemo(() => {
    const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP;
    const items = videos.slice(0, 8);
    const rows: PexelsVideo[][] = [];
    for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));
    return (
      <View style={{ gap: spacing.sm }}>
        {rows.map((row, rowIdx) => (
          <View key={rowIdx} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {row.map((v) => {
              const isSelected = selectedVideoUrls.includes(v.url);
              return (
                <TouchableOpacity
                  key={v.id}
                  style={{ flex: 1, aspectRatio: 9 / 16 }}
                  onPress={() => setPreviewVideo(v)}
                  activeOpacity={0.85}
                >
                  <View style={[
                    { flex: 1, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
                    isSelected ? styles.videoThumbSelected : styles.videoThumbIdle,
                  ]}>
                    <Image
                      source={{ uri: v.thumbnailUrl }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      resizeMode="cover"
                    />
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isSelected ? 'rgba(79,126,255,0.4)' : 'rgba(0,0,0,0.3)' }} />
                    {isSelected ? (
                      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={18} color={colors.white} />
                      </View>
                    ) : (
                      <Ionicons name="play-circle-outline" size={32} color="rgba(255,255,255,0.9)" />
                    )}
                    <Text style={[styles.videoCredit, { color: 'rgba(255,255,255,0.75)' }]} numberOfLines={1}>
                      {v.photographer}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {Array(cols - row.length).fill(null).map((_, i) => (
              <View key={`empty-${i}`} style={{ flex: 1 }} />
            ))}
          </View>
        ))}
      </View>
    );
  }, [videos, isMobile, selectedVideoUrls, colors, styles]);

  const STEP_LABELS = [
    t('campaigns.new.step1'),
    t('campaigns.new.step2'),
    t('campaigns.new.step3'),
    t('campaigns.new.step4'),
    t('campaigns.new.step5'),
  ];

  async function handleUploadTrack() {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/mpeg,audio/wav,audio/*';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setPendingTrackFile(file);
      setTrackUploaded(true);
    };
    input.click();
  }

  async function uploadPendingTrack(id: string, file: File) {
    setUploading(true);
    try {
      const { data, errors } = await getUploadUrl({
        variables: { campaignId: id, fileType: 'track', contentType: file.type },
      });
      if (errors?.length) throw new Error(errors[0].message);
      const { uploadUrl, key } = data.getUploadUrl;
      const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        console.error('[upload] PUT failed', res.status, text);
        throw new Error(`Storage error ${res.status}: ${text}`);
      }
      setTrackS3Key(key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[upload] uploadPendingTrack error:', msg);
      setError(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadVideo() {
    if (!campaignId) return;
    setVideoUploading(true);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/mp4,video/quicktime,video/webm,video/*';
        input.onchange = async (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) { setVideoUploading(false); return; }
          const localUrl = URL.createObjectURL(file);
          setCustomVideoLocalUrl(localUrl);
          setCustomVideoFileName(file.name);
          const { data } = await getUploadUrl({
            variables: { campaignId, fileType: 'custom-video', contentType: file.type },
          });
          const { uploadUrl, key } = data.getUploadUrl;
          await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
          setCustomVideoS3Key(key);
          setCustomVideoUploaded(true);
          setVideoUploading(false);
        };
        input.click();
      }
    } catch {
      setError('Video upload failed. Please try again.');
      setVideoUploading(false);
    }
  }

  async function handleStep1Continue() {
    if (!trackTitle.trim() || !artistName.trim()) {
      setError(t('campaigns.new.errorRequired'));
      return;
    }
    setError(null);
    setUploadOverlay(true);
    setUploadProgress(0);
    setUploadStepIdx(0);
    animateProgressTo(28, 600);

    try {
      const { data } = await createCampaign({ variables: { trackTitle, artistName } });
      const id = data.createCampaign.id;
      setCampaignId(id);

      if (pendingTrackFile) {
        setUploadStepIdx(1);
        animateProgressTo(72, pendingTrackFile.size > 5_000_000 ? 3000 : 1500);
        await uploadPendingTrack(id, pendingTrackFile);
      }

      setUploadStepIdx(2);
      animateProgressTo(92, 800);
      loadHooks({ variables: { campaignId: id } });
      setMoodsLoading(true);
      loadMoodSuggestion({ variables: { campaignId: id } });

      await new Promise((r) => setTimeout(r, 900));
      setUploadStepIdx(3);
      animateProgressTo(100, 400);

      await new Promise((r) => setTimeout(r, 500));
      setUploadOverlay(false);
      clearProgressInterval();
      setStep(2);
    } catch (err: unknown) {
      setUploadOverlay(false);
      clearProgressInterval();
      const gqlErrors: any[] = (err as any)?.graphQLErrors ?? [];
      const isUnverified =
        gqlErrors.some((e: any) => e?.extensions?.code === 'EMAIL_NOT_VERIFIED') ||
        (err instanceof Error && err.message.includes('not verified'));
      if (isUnverified) {
        setShowVerifModal(true);
      } else {
        setError(t('campaigns.new.errorCreateFallback'));
      }
    }
  }

  // Step 2 → 3 : mood + video confirmed, go to hook picker
  async function handleStep2Continue() {
    if (!selectedMood || !campaignId) return;
    setError(null);
    await updateCampaign({
      variables: {
        id: campaignId,
        mood: selectedMood,
        ...(videoSource === 'own' && customVideoS3Key ? { customVideoS3Key } : {}),
      },
    });
    setStep(3);
  }

  // Step 3 → 4 : hook confirmed, go to generate
  async function handleStep3Continue() {
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
    setVideoPage(1);
    setVideoSearchQuery('');
    setVideoSearchActive(false);
    const moodOption = displayMoods.find((m) => m.key === mood);
    const keywords = moodOption?.videoKeywords ?? [];
    setMoodVideoKeywords(keywords);
    loadVideos({ variables: { mood, page: 1, ...(keywords.length ? { keywords } : {}) } });
  }

  function handleVideoSearch() {
    const q = videoSearchQuery.trim();
    if (!q) return;
    setVideoSearchActive(true);
    setVideoPage(1);
    const keywords = q.split(',').map((s) => s.trim()).filter(Boolean);
    loadVideos({ variables: { mood: selectedMood ?? 'indie', page: 1, keywords } });
  }

  function handleVideoClearSearch() {
    setVideoSearchQuery('');
    setVideoSearchActive(false);
    setVideoPage(1);
    loadVideos({ variables: { mood: selectedMood, page: 1, ...(moodVideoKeywords.length ? { keywords: moodVideoKeywords } : {}) } });
  }

  function handleVideoPageChange(newPage: number) {
    setVideoPage(newPage);
    if (videoSearchActive) {
      const keywords = videoSearchQuery.split(',').map((s) => s.trim()).filter(Boolean);
      loadVideos({ variables: { mood: selectedMood ?? 'indie', page: newPage, keywords } });
    } else {
      loadVideos({ variables: { mood: selectedMood, page: newPage, ...(moodVideoKeywords.length ? { keywords: moodVideoKeywords } : {}) } });
    }
  }

  async function handleResendVerification() {
    setResendError(false);
    try {
      await resendVerification();
      setResendSent(true);
    } catch {
      setResendError(true);
    }
  }

  function handleCloseVerifModal() {
    setShowVerifModal(false);
    setResendSent(false);
    setResendError(false);
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

            {pendingTrackFile ? (
              <View style={styles.uploadedRow}>
                <Ionicons name="musical-notes" size={20} color={colors.success} />
                <Text style={styles.uploadedText} numberOfLines={1}>{pendingTrackFile.name}</Text>
                <TouchableOpacity onPress={() => { setPendingTrackFile(null); setTrackUploaded(false); }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadZone, styles.uploadZoneIdle]}
                onPress={handleUploadTrack}
                activeOpacity={0.7}
              >
                <Ionicons name="cloud-upload-outline" size={32} color={colors.textMuted} />
                <Text style={styles.uploadZoneLabel}>{t('campaigns.new.uploadTrackLabel')}</Text>
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

      {/* ── STEP 2: Mood & Visuals ── */}
      {step === 2 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.moodTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.moodSubtitle')}</Text>

            {moodsLoading ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.muted}>{t('campaigns.new.moodAnalyzing')}</Text>
              </View>
            ) : isMobile ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.moodGridMobile}
              >
                {displayMoods.map(({ key, label, icon }) => {
                  const isSelected = selectedMood === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.moodChip, isSelected ? styles.moodChipSelected : styles.moodChipIdle]}
                      onPress={() => handleMoodSelect(key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon as any} size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.moodChipLabel, isSelected ? styles.moodChipLabelSelected : styles.moodChipLabelIdle]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.moodGrid}>
                {displayMoods.map(({ key, label, icon }) => {
                  const isSelected = selectedMood === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.moodChip, isSelected ? styles.moodChipSelected : styles.moodChipIdle]}
                      onPress={() => handleMoodSelect(key)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={icon as any} size={16} color={isSelected ? colors.primary : colors.textSecondary} />
                      <Text style={[styles.moodChipLabel, isSelected ? styles.moodChipLabelSelected : styles.moodChipLabelIdle]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {aiSuggestedMood && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: -spacing.xs }}>
                <Ionicons name="sparkles" size={13} color={colors.primary} />
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.primary }}>
                  {t('campaigns.new.moodAiSuggested')}
                </Text>
              </View>
            )}

            {/* Video source tab switcher */}
            <View style={styles.videoTabRow}>
              {(['stock', 'own'] as const).map((src) => {
                const isActive = videoSource === src;
                const icon = src === 'stock' ? 'images-outline' : 'cloud-upload-outline';
                const label = src === 'stock' ? t('campaigns.new.videoSourceStock') : t('campaigns.new.videoSourceOwn');
                return (
                  <TouchableOpacity
                    key={src}
                    style={[styles.videoTab, isActive && styles.videoTabActive]}
                    onPress={() => setVideoSource(src)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={icon} size={15} color={isActive ? colors.primary : colors.textMuted} />
                    <Text style={[styles.videoTabLabel, isActive ? styles.videoTabLabelActive : styles.videoTabLabelIdle]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Stock videos tab */}
            {videoSource === 'stock' && selectedMood && (
              <>
                <Text style={styles.sectionLabel}>{t('campaigns.new.videosTitle')}</Text>

                {/* Search bar */}
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <View style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.bgElevated,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: videoSearchActive ? colors.primary : colors.border,
                    paddingHorizontal: spacing.md,
                    gap: spacing.sm,
                    height: 40,
                  }}>
                    <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                    <TextInput
                      value={videoSearchQuery}
                      onChangeText={setVideoSearchQuery}
                      onSubmitEditing={handleVideoSearch}
                      placeholder={t('campaigns.new.videoSearchPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      returnKeyType="search"
                      style={{
                        flex: 1,
                        fontFamily: fonts.regular,
                        fontSize: fontSize.sm,
                        color: colors.textPrimary,
                        outlineStyle: 'none',
                      } as any}
                    />
                    {videoSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={handleVideoClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={handleVideoSearch}
                    disabled={!videoSearchQuery.trim() || videosLoading}
                    style={{
                      height: 40,
                      paddingHorizontal: spacing.md,
                      backgroundColor: colors.primary,
                      borderRadius: radius.lg,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: !videoSearchQuery.trim() ? 0.4 : 1,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.white }}>
                      {t('campaigns.new.videoSearchBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {videosLoading ? (
                  <VideoSkeletonGrid isMobile={isMobile} colors={colors} />
                ) : videos.length === 0 ? (
                  <Text style={styles.muted}>{t('campaigns.new.videosNone')}</Text>
                ) : videoGrid}

                {/* Pagination */}
                {totalVideoPages > 1 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                    <TouchableOpacity
                      onPress={() => handleVideoPageChange(videoPage - 1)}
                      disabled={videoPage <= 1 || videosLoading}
                      style={{
                        width: 34, height: 34, borderRadius: radius.md,
                        backgroundColor: colors.bgElevated,
                        borderWidth: 1, borderColor: colors.border,
                        alignItems: 'center', justifyContent: 'center',
                        opacity: videoPage <= 1 ? 0.4 : 1,
                      }}
                    >
                      <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>

                    {Array.from({ length: Math.min(totalVideoPages, 5) }, (_, i) => {
                      const startPage = Math.max(1, Math.min(videoPage - 2, totalVideoPages - 4));
                      const p = startPage + i;
                      const isActive = p === videoPage;
                      return (
                        <TouchableOpacity
                          key={p}
                          onPress={() => handleVideoPageChange(p)}
                          disabled={videosLoading}
                          style={{
                            width: 34, height: 34, borderRadius: radius.md,
                            backgroundColor: isActive ? colors.primary : colors.bgElevated,
                            borderWidth: 1, borderColor: isActive ? colors.primary : colors.border,
                            alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: isActive ? colors.white : colors.textSecondary }}>
                            {p}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}

                    <TouchableOpacity
                      onPress={() => handleVideoPageChange(videoPage + 1)}
                      disabled={videoPage >= totalVideoPages || videosLoading}
                      style={{
                        width: 34, height: 34, borderRadius: radius.md,
                        backgroundColor: colors.bgElevated,
                        borderWidth: 1, borderColor: colors.border,
                        alignItems: 'center', justifyContent: 'center',
                        opacity: videoPage >= totalVideoPages ? 0.4 : 1,
                      }}
                    >
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            {/* Own video tab */}
            {videoSource === 'own' && (
              <>
                <Text style={styles.sectionLabel}>{t('campaigns.new.videoSourceOwn').toUpperCase()}</Text>

                {customVideoUploaded && customVideoLocalUrl ? (
                  <View style={{ gap: spacing.sm }}>
                    {/* Video player */}
                    <View style={{
                      width: '100%',
                      maxWidth: 220,
                      alignSelf: 'center',
                      borderRadius: radius.xl,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.black,
                    }}>
                      <View style={{ aspectRatio: 9 / 16 }}>
                        {Platform.OS === 'web' && React.createElement('video', {
                          src: customVideoLocalUrl,
                          controls: true,
                          loop: true,
                          playsInline: true,
                          style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
                        })}
                      </View>
                    </View>

                    {/* File name + replace button */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.lg, padding: spacing.md }}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text style={[styles.uploadedText, { flex: 1 }]} numberOfLines={1}>{customVideoFileName}</Text>
                      <TouchableOpacity
                        onPress={() => { setCustomVideoUploaded(false); setCustomVideoS3Key(''); setCustomVideoLocalUrl(null); setCustomVideoFileName(''); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      >
                        <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
                        <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted }}>{t('campaigns.new.uploadVideoReplace')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadZone, videoUploading ? styles.uploadZoneActive : styles.uploadZoneIdle]}
                    onPress={handleUploadVideo}
                    activeOpacity={0.7}
                    disabled={videoUploading || !campaignId}
                  >
                    {videoUploading ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <Ionicons name="videocam-outline" size={32} color={colors.textMuted} />
                    )}
                    <Text style={styles.uploadZoneLabel}>
                      {videoUploading ? t('campaigns.new.uploadVideoUploading') : t('campaigns.new.uploadVideoLabel')}
                    </Text>
                    <Text style={styles.uploadZoneHint}>{t('campaigns.new.uploadVideoHint')}</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.muted, { fontSize: fontSize.xs, textAlign: 'center', lineHeight: 18 }]}>
                  {t('campaigns.new.uploadVideoSubtitle')}
                </Text>
              </>
            )}

            <View style={styles.actions}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(1)} />
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep2Continue}
                disabled={!selectedMood || (videoSource === 'own' && !customVideoUploaded && !videoUploading)}
                loading={videoUploading}
              />
            </View>
          </View>
        </Card>
      )}

      {/* ── STEP 3: Hook — Waveform Timeline ── */}
      {step === 3 && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.hookTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.hookSubtitle')}</Text>

            <WaveformHookPicker
              audioFile={pendingTrackFile}
              suggestions={
                hookSuggestions.length > 0
                  ? hookSuggestions
                  : [
                      { start: 25, end: 40, label: 'chorus', energy: 'chorus' as const },
                      { start: 60, end: 75, label: 'drop', energy: 'high' as const },
                    ]
              }
              selected={selectedHook}
              onSelect={setSelectedHook}
              loading={hooksLoading}
              previewVideoUrl={
                customVideoLocalUrl ??
                (videos.length > 0 ? videos[0].previewUrl : undefined)
              }
            />

            <View style={styles.actions}>
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(2)} />
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep3Continue}
                disabled={!selectedHook}
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
      {/* ── Video preview modal ── */}
      <Modal visible={!!previewVideo} transparent animationType="fade" onRequestClose={() => setPreviewVideo(null)}>
        <TouchableWithoutFeedback onPress={() => setPreviewVideo(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
            <TouchableWithoutFeedback>
              <View style={{
                width: '100%',
                maxWidth: 380,
                backgroundColor: colors.bgCard,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                overflow: 'hidden',
              }}>
                {/* Video player */}
                <View style={{ width: '100%', aspectRatio: 9 / 16, backgroundColor: colors.black }}>
                  {previewVideo && Platform.OS === 'web' && (
                    // @ts-ignore – createElement renders a native <video> tag on React Native Web
                    React.createElement('video', {
                      src: previewVideo.previewUrl,
                      autoPlay: true,
                      controls: true,
                      loop: true,
                      playsInline: true,
                      style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
                    })
                  )}
                </View>

                {/* Footer */}
                <View style={{ padding: spacing.md, gap: spacing.sm }}>
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textPrimary }} numberOfLines={1}>
                    {previewVideo?.photographer}
                  </Text>

                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity
                      style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}
                      onPress={() => setPreviewVideo(null)}
                    >
                      <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary }}>{t('common.cancel')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 2,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: spacing.xs,
                        backgroundColor: previewVideo && selectedVideoUrls.includes(previewVideo.url)
                          ? colors.bgElevated
                          : colors.primary,
                        borderWidth: previewVideo && selectedVideoUrls.includes(previewVideo.url) ? 1 : 0,
                        borderColor: colors.border,
                      }}
                      onPress={() => {
                        if (!previewVideo) return;
                        setSelectedVideoUrls((prev) =>
                          prev.includes(previewVideo.url)
                            ? prev.filter((u) => u !== previewVideo.url)
                            : [...prev, previewVideo.url]
                        );
                        setPreviewVideo(null);
                      }}
                    >
                      <Ionicons
                        name={previewVideo && selectedVideoUrls.includes(previewVideo.url) ? 'close-circle-outline' : 'checkmark-circle-outline'}
                        size={16}
                        color={previewVideo && selectedVideoUrls.includes(previewVideo.url) ? colors.textSecondary : colors.white}
                      />
                      <Text style={{
                        fontFamily: fonts.semiBold,
                        fontSize: fontSize.sm,
                        color: previewVideo && selectedVideoUrls.includes(previewVideo.url) ? colors.textSecondary : colors.white,
                      }}>
                        {previewVideo && selectedVideoUrls.includes(previewVideo.url)
                          ? t('campaigns.new.videoDeselect')
                          : t('campaigns.new.videoSelect')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Step 1 upload overlay ── */}
      <Modal visible={uploadOverlay} transparent animationType="fade">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(8,8,14,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        }}>
          <View style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.bgCard,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xl,
            gap: spacing.lg,
          }}>
            {/* Icon + title */}
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: radius.full,
                backgroundColor: colors.primaryBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons
                  name={uploadStepIdx === 3 ? 'checkmark' : uploadStepIdx === 1 ? 'cloud-upload-outline' : uploadStepIdx === 2 ? 'musical-notes-outline' : 'add-circle-outline'}
                  size={26}
                  color={uploadStepIdx === 3 ? colors.success : colors.primary}
                />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' }}>
                {uploadStepIdx === 0 && t('campaigns.new.uploadOverlayStep0')}
                {uploadStepIdx === 1 && t('campaigns.new.uploadOverlayStep1')}
                {uploadStepIdx === 2 && t('campaigns.new.uploadOverlayStep2')}
                {uploadStepIdx === 3 && t('campaigns.new.uploadOverlayStep3')}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' }}>
                {uploadStepIdx === 0 && t('campaigns.new.uploadOverlayStep0Sub')}
                {uploadStepIdx === 1 && (pendingTrackFile ? pendingTrackFile.name : '')}
                {uploadStepIdx === 2 && t('campaigns.new.uploadOverlayStep2Sub')}
                {uploadStepIdx === 3 && t('campaigns.new.uploadOverlayStep3Sub')}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={{ gap: spacing.xs }}>
              <View style={{
                height: 6,
                backgroundColor: colors.bgElevated,
                borderRadius: radius.full,
                overflow: 'hidden',
              }}>
                <View style={{
                  height: '100%',
                  width: `${uploadProgress}%` as any,
                  backgroundColor: uploadStepIdx === 3 ? colors.success : colors.primary,
                  borderRadius: radius.full,
                }} />
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' }}>
                {Math.round(uploadProgress)}%
              </Text>
            </View>

            {/* Step dots */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: i <= uploadStepIdx
                    ? (uploadStepIdx === 3 ? colors.success : colors.primary)
                    : colors.bgElevated,
                }} />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Verification required modal ── */}
      <Modal visible={showVerifModal} transparent animationType="fade" onRequestClose={handleCloseVerifModal}>
        <TouchableWithoutFeedback onPress={handleCloseVerifModal}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: colors.bgCard,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.xl,
                width: '100%',
                maxWidth: 400,
                gap: spacing.md,
              }}>
                <Text style={{ fontSize: 32, textAlign: 'center' }}>✉️</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' }}>
                  {t('auth.verificationModal.title')}
                </Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                  {t('auth.verificationModal.body')}
                </Text>

                {resendSent && (
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.success, textAlign: 'center' }}>
                    {t('auth.verificationModal.sent')}
                  </Text>
                )}
                {resendError && (
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.error, textAlign: 'center' }}>
                    {t('auth.verificationModal.error')}
                  </Text>
                )}

                {!resendSent && (
                  <TouchableOpacity
                    onPress={handleResendVerification}
                    disabled={resending}
                    style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: 'center', marginTop: spacing.xs }}
                  >
                    {resending
                      ? <ActivityIndicator size="small" color={colors.white} />
                      : <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.white }}>{t('auth.verificationModal.resend')}</Text>
                    }
                  </TouchableOpacity>
                )}

                <TouchableOpacity onPress={handleCloseVerifModal} style={{ alignItems: 'center', paddingVertical: spacing.xs }}>
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted }}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScrollView>
  );
}
