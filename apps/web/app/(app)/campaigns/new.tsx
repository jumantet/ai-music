import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  TextInput,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApolloError, useMutation, useQuery, useLazyQuery, useApolloClient } from '@apollo/client';
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
import {
  SUGGEST_HOOKS_QUERY,
  SUGGEST_MOOD_QUERY,
  SEARCH_VIDEOS_FOR_MOOD_QUERY,
  SEARCH_PEXELS_VIDEOS_QUERY,
  CAMPAIGN_QUERY,
  STREAMING_TRACK_FROM_URL_QUERY,
} from '../../../src/graphql/queries';
import { Button, Card } from '../../../src/components/ui';
import { VideoEditorStep, DEFAULT_EDITOR_SETTINGS } from '../../../src/components/ui/VideoEditorStep';
import type { VideoEditorSettings } from '../../../src/components/ui/VideoEditorStep';
import { WaveformHookPicker } from '../../../src/components/ui/WaveformHookPicker';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTheme } from '../../../src/hooks/useTheme';
import { computeAudioEnergyEnvelope } from '../../../src/lib/audioAnalysis';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../../src/theme';
import type { ColorPalette } from '../../../src/theme';
import type { HookSuggestion } from '@toolkit/shared';

type WizardStep = 1 | 2 | 3 | 4 | 5;
const WIZARD_STEPS: WizardStep[] = [1, 2, 3, 4, 5];

const WIZARD_RESUME_KEY = 'wizard_resume';
const CLIP_WIZARD_REDIRECT = '/(app)/campaigns/new';

type StockVideoOption = {
  id: string;
  previewUrl: string;
  url: string;
  thumbnailUrl: string;
  photographer: string;
};

type WizardMood = {
  key: string;
  label: string;
  videoKeywords: string[];
  icon: string;
};

/** Clips Pexels par ambiance ou recherche (grille 3×3). */
const STEP2_STOCK_VIDEO_COUNT = 9;
/** Nombre max de pages Pexels affichées (tag ou recherche). */
const STEP2_STOCK_MAX_PAGES = 5;

function normalizeHookEnergy(h: {
  start: number;
  end: number;
  label?: string;
  energy?: string;
}): HookSuggestion {
  const e = h.energy;
  const energy: HookSuggestion['energy'] =
    e === 'high' || e === 'chorus' || e === 'build' ? e : 'chorus';
  return {
    start: h.start,
    end: h.end,
    label: h.label ?? '',
    energy,
  };
}

function formatTrackDurationMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

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
    /** Étape éditeur : contenu scroll pleine largeur viewport */
    containerFullBleed: {
      flexGrow: 1,
      gap: spacing.lg,
      width: '100%',
      maxWidth: '100%' as any,
      alignSelf: 'stretch',
      alignItems: 'stretch',
      paddingHorizontal: 0,
      paddingTop: isMobile ? spacing.md : spacing.xl,
      paddingBottom: spacing.xl * 2,
    },
    /** Étape 4 : pas de ScrollView page — colonne vidéo + panneau en flex, hauteur viewport */
    editorStep4Root: {
      flex: 1,
      width: '100%' as any,
      minHeight: 0,
      ...(Platform.OS === 'web' ? ({ height: '100%' as any } as const) : {}),
    },
    editorStep4Body: {
      flex: 1,
      minHeight: 0,
      width: '100%' as any,
    },
    editorStep4FabOverlay: {
      ...StyleSheet.absoluteFillObject,
      pointerEvents: 'box-none' as const,
      zIndex: 999,
    },
    editorStep4Fab: {
      position: 'absolute' as const,
      right: spacing.lg,
      bottom: spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 9999,
      elevation: 14,
    },
    editorStep4FabLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.md,
    },
    /** Header + stepper restent lisibles au centre quand l’éditeur est full-bleed */
    editorPageHeader: {
      paddingHorizontal: isMobile ? spacing.md : spacing.xl,
      maxWidth: 720,
      width: '100%',
      alignSelf: 'center',
      gap: spacing.lg,
    },

    // Header
    topRow: { flexDirection: 'row', alignItems: 'center' },
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
      flex: 1,
      textAlign: 'center',
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
    /** Étape 2 : même échelle verticale partout (titre → sous-titre → filtres → grille). */
    step2WizardCard: { gap: spacing.md },
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
    /** Étape 2 : 3 colonnes sur toute la largeur du bloc (mesure JS + gap) */
    step2VideoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: '100%',
      alignSelf: 'stretch',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    step2VideoCell: {
      flexGrow: 0,
      flexShrink: 0,
    },
    step2ThumbOuter: {
      position: 'relative',
      width: '100%',
    },
    step2VideoThumb: {
      width: '100%',
      aspectRatio: 9 / 16,
      borderRadius: radius.md,
      backgroundColor: colors.bgElevated,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    /** Bouton play centré sur la vignette */
    step2PlayFab: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 56,
      height: 56,
      marginTop: -28,
      marginLeft: -28,
      borderRadius: 28,
      backgroundColor: 'rgba(0,0,0,0.52)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2,
    },
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
    adGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
    adVideoBlock: {
      width: isMobile ? '60%' : 220,
      aspectRatio: 9 / 16,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: colors.primaryBg,
      alignSelf: 'center',
    },

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

    actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', flexWrap: 'wrap' as const },
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

export default function NewCampaignScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { width: windowW } = useWindowDimensions();
  const params = useLocalSearchParams<{ editCampaignId?: string }>();
  const editCampaignId = params.editCampaignId ?? null;

  const videoThumbW = isMobile ? 152 : 168;
  const styles = useMemo(() => makeStyles(colors, isMobile, videoThumbW), [colors, isMobile, videoThumbW]);

  const [step, setStep] = useState<WizardStep>(1);
  const apolloClient = useApolloClient();

  // Step 1 — titre & artiste viennent du choix Spotify
  const [trackTitle, setTrackTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [trackUploaded, setTrackUploaded] = useState(false);
  const [trackS3Key, setTrackS3Key] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingTrackFile, setPendingTrackFile] = useState<File | null>(null);
  const [pickedSpotifyTrackId, setPickedSpotifyTrackId] = useState<string | null>(null);
  const [pickedSpotifyCoverUrl, setPickedSpotifyCoverUrl] = useState<string | null>(null);
  const [streamingUrlInput, setStreamingUrlInput] = useState('');
  const [stockVideoOptions, setStockVideoOptions] = useState<StockVideoOption[]>([]);
  const [selectedStockVideoId, setSelectedStockVideoId] = useState<string | null>(null);
  const [step2GridMeasuredW, setStep2GridMeasuredW] = useState<number | null>(null);
  const [step2PreviewVideoId, setStep2PreviewVideoId] = useState<string | null>(null);

  const step2EstimatedGridW = useMemo(() => {
    const horizontalPad = (isMobile ? spacing.md : spacing.xl) * 2;
    const cardPad = spacing.lg * 2;
    return Math.max(220, Math.min(720, windowW) - horizontalPad - cardPad);
  }, [isMobile, windowW]);
  const step2GridW = step2GridMeasuredW ?? step2EstimatedGridW;
  const step2CellW = Math.max(72, (step2GridW - 2 * spacing.sm) / 3);

  const step2VisibleVideos = useMemo(
    () => stockVideoOptions.slice(0, STEP2_STOCK_VIDEO_COUNT),
    [stockVideoOptions]
  );

  const [step2StockPage, setStep2StockPage] = useState(1);
  const [step2StockTotalResults, setStep2StockTotalResults] = useState(0);
  const step2StockPageCount = useMemo(() => {
    if (step2StockTotalResults <= 0) return 1;
    return Math.min(
      STEP2_STOCK_MAX_PAGES,
      Math.max(1, Math.ceil(step2StockTotalResults / STEP2_STOCK_VIDEO_COUNT))
    );
  }, [step2StockTotalResults]);

  const [moodOptions, setMoodOptions] = useState<WizardMood[]>([]);
  const [selectedMoodKey, setSelectedMoodKey] = useState<string | null>(null);
  const [stockVideosLoading, setStockVideosLoading] = useState(false);
  const [step2PexelsSearchText, setStep2PexelsSearchText] = useState('');
  const [step2PexelsSearchQuery, setStep2PexelsSearchQuery] = useState('');
  const audioEnergySnapshotRef = useRef<{ durationSec: number; envelope: number[] } | null>(null);
  const step2PreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);

  const [videoSource, setVideoSource] = useState<'stock' | 'own'>('stock');
  const [customVideoS3Key, setCustomVideoS3Key] = useState('');
  const [customVideoUploaded, setCustomVideoUploaded] = useState(false);
  const [customVideoLocalUrl, setCustomVideoLocalUrl] = useState<string | null>(null);
  const [customVideoFileName, setCustomVideoFileName] = useState('');

  // Éditeur vidéo
  const [editorSettings, setEditorSettings] = useState<VideoEditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [selectedPreviewUrls, setSelectedPreviewUrls] = useState<string[]>([]);
  const [hookSuggestions, setHookSuggestions] = useState<HookSuggestion[]>([]);
  const [selectedHook, setSelectedHook] = useState<HookSuggestion | null>(null);
  const [hooksLoading, setHooksLoading] = useState(false);

  // Edit existing campaign: load campaign data and jump to step 4
  const [editLoaded, setEditLoaded] = useState(false);
  useQuery(CAMPAIGN_QUERY, {
    variables: { id: editCampaignId },
    skip: !editCampaignId,
    onCompleted: (data) => {
      if (editLoaded) return;
      const c = data?.campaign;
      if (!c) return;
      setCampaignId(c.id);
      setTrackTitle(c.trackTitle ?? '');
      setArtistName(c.artistName ?? '');
      setPickedSpotifyTrackId(c.spotifyTrackId ?? null);
      setPickedSpotifyCoverUrl(null);
      setTrackS3Key(c.trackS3Key ?? '');
      setTrackUploaded(!!c.trackS3Key || !!c.trackUrl);
      if (c.videoUrl) {
        setCustomVideoLocalUrl(c.videoUrl);
        setSelectedPreviewUrls([c.videoUrl]);
        if (c.videoS3Key) {
          setVideoSource('own');
          setCustomVideoS3Key(c.videoS3Key);
          setCustomVideoUploaded(true);
        }
      }
      if (c.editorSettings) setEditorSettings({ ...DEFAULT_EDITOR_SETTINGS, ...c.editorSettings });
      if (c.hookStart != null && c.hookEnd != null) {
        setSelectedHook(
          normalizeHookEnergy({
            start: c.hookStart,
            end: c.hookEnd,
            label: '',
            energy: 'chorus',
          })
        );
      }
      setEditLoaded(true);
      setStep(3);
    },
  });

  useEffect(() => {
    if (!user || editCampaignId) return;
    void (async () => {
      const raw = await AsyncStorage.getItem(WIZARD_RESUME_KEY);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { campaignId: string; step: WizardStep };
        await AsyncStorage.removeItem(WIZARD_RESUME_KEY);
        if (!parsed.campaignId || !parsed.step) return;
        setCampaignId(parsed.campaignId);
        setStep(parsed.step);
        const { data } = await apolloClient.query({
          query: CAMPAIGN_QUERY,
          variables: { id: parsed.campaignId },
          fetchPolicy: 'network-only',
        });
        const c = data?.campaign;
        if (!c) return;
        if (c.editorSettings) setEditorSettings({ ...DEFAULT_EDITOR_SETTINGS, ...c.editorSettings });
        if (c.hookStart != null && c.hookEnd != null) {
          setSelectedHook(
            normalizeHookEnergy({
              start: c.hookStart,
              end: c.hookEnd,
              label: '',
              energy: 'chorus',
            })
          );
        }
        if (c.videoUrl) setSelectedPreviewUrls([c.videoUrl]);
      } catch {
        await AsyncStorage.removeItem(WIZARD_RESUME_KEY);
      }
    })();
  }, [user, editCampaignId, apolloClient]);

  useEffect(() => {
    if (step !== 2) setStep2PreviewVideoId(null);
  }, [step]);

  useEffect(() => {
    if (step !== 2 || step2VisibleVideos.length === 0) return;
    const ok = step2VisibleVideos.some((v) => v.id === selectedStockVideoId);
    if (!ok) setSelectedStockVideoId(step2VisibleVideos[0]!.id);
  }, [step, step2VisibleVideos, selectedStockVideoId]);

  /** Lecture immédiate (navigateurs exigent souvent muted pour l’autoplay). */
  useEffect(() => {
    if (Platform.OS !== 'web' || !step2PreviewVideoId) return;
    const tick = () => {
      const el = step2PreviewVideoRef.current;
      if (!el) return;
      el.muted = true;
      void el.play().catch(() => {});
    };
    const t = typeof window !== 'undefined' ? window.setTimeout(tick, 0) : 0;
    return () => {
      if (typeof window !== 'undefined' && t) window.clearTimeout(t);
    };
  }, [step2PreviewVideoId]);

  // Step 5
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generatedAds, setGeneratedAds] = useState<Array<{ id: string; videoUrl?: string; visualStyle: string; textOverlay?: string }>>([]);

  const [error, setError] = useState<string | null>(null);
  const [showAudioHint, setShowAudioHint] = useState(false);
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

  const [fetchStreamingTrackFromUrl, { loading: fetchingStreamingTrack }] = useLazyQuery(
    STREAMING_TRACK_FROM_URL_QUERY,
    { fetchPolicy: 'network-only' }
  );

  const STEP_LABELS = [
    t('campaigns.new.wizardStepTrack'),
    t('campaigns.new.wizardStepVideoPick'),
    t('campaigns.new.wizardStepEditor'),
    t('campaigns.new.wizardStepGenerate'),
    t('campaigns.new.wizardStepExport'),
  ];

  async function fetchStockVideosForStep2(
    cid: string,
    moodKey: string,
    keywords: string[],
    pexelsFreeText?: string | null,
    pageNum: number = 1
  ): Promise<number> {
    setStockVideosLoading(true);
    try {
      const apiPage = Math.min(STEP2_STOCK_MAX_PAGES, Math.max(1, pageNum));
      const freeQ = pexelsFreeText?.trim() ?? '';
      let videosRes;
      let pageData: {
        videos?: Array<{
          id: string;
          previewUrl: string;
          url: string;
          thumbnailUrl: string;
          photographer: string;
        }>;
        totalResults?: number;
        page?: number;
        perPage?: number;
      } | undefined;
      let videos: Array<{
        id: string;
        previewUrl: string;
        url: string;
        thumbnailUrl: string;
        photographer: string;
      }> = [];

      if (freeQ) {
        videosRes = await apolloClient.query({
          query: SEARCH_PEXELS_VIDEOS_QUERY,
          variables: { query: freeQ, page: apiPage },
          fetchPolicy: 'network-only',
        });
        pageData = videosRes.data?.searchPexelsVideos;
        videos = pageData?.videos ?? [];
      } else {
        videosRes = await apolloClient.query({
          query: SEARCH_VIDEOS_FOR_MOOD_QUERY,
          variables: {
            mood: moodKey,
            page: apiPage,
            ...(keywords.length ? { keywords } : {}),
          },
          fetchPolicy: 'network-only',
        });
        pageData = videosRes.data?.searchVideosForMood;
        videos = pageData?.videos ?? [];
        if (videos.length === 0 && keywords.length) {
          videosRes = await apolloClient.query({
            query: SEARCH_VIDEOS_FOR_MOOD_QUERY,
            variables: { mood: moodKey, page: apiPage },
            fetchPolicy: 'network-only',
          });
          pageData = videosRes.data?.searchVideosForMood;
          videos = pageData?.videos ?? [];
        }
        if (videos.length === 0) {
          videosRes = await apolloClient.query({
            query: SEARCH_VIDEOS_FOR_MOOD_QUERY,
            variables: { mood: 'dreamy', page: apiPage },
            fetchPolicy: 'network-only',
          });
          pageData = videosRes.data?.searchVideosForMood;
          videos = pageData?.videos ?? [];
        }
      }

      setStep2StockTotalResults(pageData?.totalResults ?? 0);
      setStep2StockPage(apiPage);

      const mapped: StockVideoOption[] = videos
        .map(
          (v: { id: string; previewUrl: string; url: string; thumbnailUrl: string; photographer: string }) => ({
            id: v.id,
            previewUrl: v.previewUrl,
            url: v.url,
            thumbnailUrl: v.thumbnailUrl,
            photographer: v.photographer,
          })
        )
        .slice(0, STEP2_STOCK_VIDEO_COUNT);

      setStockVideoOptions(mapped);

      const firstPreview =
        mapped[0]?.previewUrl || mapped[0]?.url || (videos[0] as { previewUrl?: string; url?: string })?.previewUrl || (videos[0] as { url?: string })?.url || null;

      if (firstPreview) {
        setSelectedStockVideoId(mapped[0]?.id ?? null);
        setSelectedPreviewUrls([firstPreview]);
        await updateCampaign({ variables: { id: cid, videoUrl: firstPreview } }).catch(() => {});
      } else {
        setSelectedStockVideoId(null);
      }

      return videos.length;
    } finally {
      setStockVideosLoading(false);
    }
  }

  async function prepareVisualsAndHooksForEditor(
    campaignId: string,
    s3Key: string,
    audioFile: File
  ): Promise<{ videoCount: number }> {
    setHooksLoading(true);
    try {
      let audioDurationSec: number | undefined;
      let audioEnergyEnvelope: number[] | undefined;
      try {
        const env = await computeAudioEnergyEnvelope(audioFile);
        audioDurationSec = env.durationSec;
        audioEnergyEnvelope = env.envelope;
      } catch {
        /* fallback : suggestions sans enveloppe */
      }

      const [hooksResult, moodResult] = await Promise.all([
        apolloClient.query({
          query: SUGGEST_HOOKS_QUERY,
          variables: {
            campaignId,
            ...(audioDurationSec != null ? { audioDurationSec } : {}),
            ...(audioEnergyEnvelope?.length ? { audioEnergyEnvelope } : {}),
          },
          fetchPolicy: 'network-only',
        }),
        apolloClient.query({
          query: SUGGEST_MOOD_QUERY,
          variables: {
            campaignId,
            ...(audioDurationSec != null ? { audioDurationSec } : {}),
            ...(audioEnergyEnvelope?.length ? { audioEnergyEnvelope } : {}),
          },
          fetchPolicy: 'network-only',
        }),
      ]);

      const rawHooks = hooksResult.data?.suggestHooks ?? [];
      const hooks = rawHooks.map((h: { start: number; end: number; label?: string; energy?: string }) =>
        normalizeHookEnergy(h)
      );
      setHookSuggestions(hooks);

      const moodsRaw = moodResult.data?.suggestMood?.moods ?? [];
      const moodsList: WizardMood[] = moodsRaw.map(
        (m: { key?: string; label?: string; videoKeywords?: string[]; icon?: string }) => ({
          key: m.key ?? 'mood',
          label: m.label ?? '',
          videoKeywords: (m.videoKeywords ?? []).filter(Boolean).slice(0, 3),
          icon: m.icon ?? 'musical-note-outline',
        })
      );
      setMoodOptions(moodsList);
      const firstMood = moodsList[0];
      const moodKey = firstMood?.key ?? 'dreamy';
      const keywords: string[] = firstMood?.videoKeywords ?? [];
      setSelectedMoodKey(moodKey);
      audioEnergySnapshotRef.current =
        audioDurationSec != null && audioEnergyEnvelope?.length
          ? { durationSec: audioDurationSec, envelope: audioEnergyEnvelope }
          : null;

      const videos = await fetchStockVideosForStep2(campaignId, moodKey, keywords);

      const fileDur = audioDurationSec && audioDurationSec > 0 ? audioDurationSec : 180;
      const defaultLen = Math.min(30, Math.max(5, fileDur * 0.2));
      const hook =
        hooks[0] ?? normalizeHookEnergy({ start: 0, end: defaultLen, label: 'intro', energy: 'chorus' });
      setSelectedHook(hook);

      await updateCampaign({
        variables: {
          id: campaignId,
          hookStart: hook.start,
          hookEnd: hook.end,
          trackS3Key: s3Key || undefined,
        },
      });
      return { videoCount: videos };
    } catch (e) {
      console.warn('[wizard] prepareVisualsAndHooksForEditor', e);
      setStockVideoOptions([]);
      setSelectedStockVideoId(null);
      setMoodOptions([]);
      setSelectedMoodKey(null);
      setStep2StockPage(1);
      setStep2StockTotalResults(0);
      setHookSuggestions([]);
      const fallback = normalizeHookEnergy({ start: 0, end: 30, label: 'intro', energy: 'chorus' });
      setSelectedHook(fallback);
      await updateCampaign({
        variables: {
          id: campaignId,
          hookStart: fallback.start,
          hookEnd: fallback.end,
          trackS3Key: s3Key || undefined,
        },
      }).catch(() => {});
      return { videoCount: 0 };
    } finally {
      setHooksLoading(false);
    }
  }

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

  async function uploadPendingTrack(id: string, file: File): Promise<string> {
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
      return key;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[upload] uploadPendingTrack error:', msg);
      setError(`Upload failed: ${msg}`);
      throw err;
    } finally {
      setUploading(false);
    }
  }

  async function handleStep1Continue() {
    if (!trackTitle.trim() || !artistName.trim()) {
      setError(t('campaigns.new.errorStreamingMetadataRequired'));
      return;
    }
    if (!pendingTrackFile) {
      setError(trackTitle.trim()
        ? `Merci d'importer le fichier audio de "${trackTitle}"`
        : t('campaigns.new.errorTrackRequired'));
      return;
    }
    setError(null);
    setUploadOverlay(true);
    setUploadProgress(0);
    setUploadStepIdx(0);
    animateProgressTo(28, 600);

    try {
      const { data } = await createCampaign({
        variables: {
          trackTitle,
          artistName,
          spotifyTrackId: pickedSpotifyTrackId ?? undefined,
        },
      });
      const id = data.createCampaign.id;
      setCampaignId(id);

      setUploadStepIdx(1);
      animateProgressTo(55, pendingTrackFile.size > 5_000_000 ? 3000 : 1500);
      const s3Key = await uploadPendingTrack(id, pendingTrackFile);

      setUploadStepIdx(2);
      animateProgressTo(88, 2800);
      const { videoCount } = await prepareVisualsAndHooksForEditor(id, s3Key, pendingTrackFile);

      setUploadStepIdx(3);
      animateProgressTo(100, 400);

      await new Promise((r) => setTimeout(r, 400));
      setUploadOverlay(false);
      clearProgressInterval();
      setStep(videoCount === 0 ? 3 : 2);
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

  async function handleResolveStreamingUrl() {
    if (Platform.OS !== 'web') return;
    setError(null);
    const url = streamingUrlInput.trim();
    if (!url) {
      setError(t('campaigns.new.streamingUrlEmpty'));
      return;
    }
    const { data, error: qErr } = await fetchStreamingTrackFromUrl({ variables: { url } });
    const gqlErrors = qErr?.graphQLErrors ?? [];
    if (gqlErrors.some((e) => (e.extensions as { code?: string } | undefined)?.code === 'EMAIL_NOT_VERIFIED')) {
      setShowVerifModal(true);
      return;
    }
    if (qErr) {
      setError(t('campaigns.new.streamingUrlFetchError'));
      return;
    }
    const tr = data?.streamingTrackFromUrl;
    if (!tr) {
      setError(t('campaigns.new.streamingUrlNotFound'));
      return;
    }
    setTrackTitle(tr.name);
    setArtistName(tr.artistName);
    setPickedSpotifyTrackId(tr.spotifyTrackId ?? null);
    setPickedSpotifyCoverUrl(tr.albumImageUrl ?? null);
  }

  async function submitStep2PexelsSearch() {
    if (!campaignId) return;
    const q = step2PexelsSearchText.trim();
    setStep2PexelsSearchQuery(q);
    setStep2PreviewVideoId(null);
    setStep2StockPage(1);
    const m = moodOptions.find((x) => x.key === selectedMoodKey);
    await fetchStockVideosForStep2(campaignId, m?.key ?? 'dreamy', m?.videoKeywords ?? [], q || undefined, 1);
  }

  async function clearStep2PexelsSearch() {
    if (!campaignId) return;
    setStep2PexelsSearchText('');
    setStep2PexelsSearchQuery('');
    setStep2PreviewVideoId(null);
    setStep2StockPage(1);
    const m = moodOptions.find((x) => x.key === selectedMoodKey);
    if (m) {
      await fetchStockVideosForStep2(campaignId, m.key, m.videoKeywords, undefined, 1);
    }
  }

  async function handleStep2MoodChange(moodKey: string) {
    if (!campaignId || moodKey === selectedMoodKey) return;
    const m = moodOptions.find((x) => x.key === moodKey);
    if (!m) return;
    setStep2PreviewVideoId(null);
    setStep2PexelsSearchText('');
    setStep2PexelsSearchQuery('');
    setStep2StockPage(1);
    setSelectedMoodKey(moodKey);
    await fetchStockVideosForStep2(campaignId, m.key, m.videoKeywords, undefined, 1);
  }

  async function handleStep2StockPageChange(nextPage: number) {
    if (!campaignId) return;
    if (nextPage < 1 || nextPage > STEP2_STOCK_MAX_PAGES || nextPage === step2StockPage) return;
    const maxP = Math.min(
      STEP2_STOCK_MAX_PAGES,
      Math.max(1, Math.ceil(step2StockTotalResults / STEP2_STOCK_VIDEO_COUNT))
    );
    if (nextPage > maxP) return;
    setStep2PreviewVideoId(null);
    const m = moodOptions.find((x) => x.key === selectedMoodKey);
    const committed = step2PexelsSearchQuery.trim();
    await fetchStockVideosForStep2(
      campaignId,
      m?.key ?? 'dreamy',
      m?.videoKeywords ?? [],
      committed || undefined,
      nextPage
    );
  }

  async function handleStep2Continue() {
    if (!campaignId) return;
    setError(null);
    const sel =
      stockVideoOptions.find((v) => v.id === selectedStockVideoId) ?? stockVideoOptions[0];
    const previewUrl = sel?.previewUrl || sel?.url || null;
    if (previewUrl) {
      setSelectedPreviewUrls([previewUrl]);
      try {
        await updateCampaign({ variables: { id: campaignId, videoUrl: previewUrl } });
      } catch {
        /* non-bloquant */
      }
    }
    setStep(3);
  }

  async function handleEditorContinue() {
    if (!campaignId) return;

    if (!user) {
      try {
        await AsyncStorage.setItem(WIZARD_RESUME_KEY, JSON.stringify({ campaignId, step: 4 }));
      } catch {
        /* */
      }
      router.push(`/(auth)/login?redirect=${encodeURIComponent(CLIP_WIZARD_REDIRECT)}` as any);
      return;
    }

    const credits = user.videoCredits;
    if (typeof credits === 'number' && credits < 1) {
      setError(t('campaigns.new.insufficientCredits'));
      return;
    }

    if (selectedHook) {
      try {
        await updateCampaign({
          variables: {
            id: campaignId,
            hookStart: selectedHook.start,
            hookEnd: selectedHook.end,
          },
        });
      } catch {
        /* non-bloquant */
      }
    }

    setStep(4);
    void simulateGenerate();
  }

  async function simulateGenerate() {
    if (!campaignId) return;

    // Run animation and API call in parallel
    const animationPromise = (async () => {
      for (let i = 1; i <= GENERATE_STEPS.length; i++) {
        await new Promise((r) => setTimeout(r, 1200));
        setGenerateProgress(i);
      }
    })();

    // Save editor settings to campaign before generating
    await updateCampaign({
      variables: {
        id: campaignId,
        editorSettings: {
          filterPreset: editorSettings.filterPreset,
          brightness: editorSettings.brightness,
          contrast: editorSettings.contrast,
          saturation: editorSettings.saturation,
          grain: editorSettings.grain,
          motionPreset: editorSettings.motionPreset,
          text: editorSettings.text,
          fontFamily: editorSettings.fontFamily,
          fontSize: editorSettings.fontSize,
          fontColor: editorSettings.fontColor,
          textBgColor: editorSettings.textBgColor,
          textBgOpacity: editorSettings.textBgOpacity,
          textPosition: editorSettings.textPosition,
          endCardEnabled: editorSettings.endCardEnabled,
          endCardDurationSec: editorSettings.endCardDurationSec,
          endCardTitle: editorSettings.endCardTitle,
          endCardShowTitle: editorSettings.endCardShowTitle,
          endCardCoverUrl:
            editorSettings.endCardCoverUrl?.trim() ||
            (pickedSpotifyCoverUrl ?? '') ||
            undefined,
        },
      },
    }).catch(() => { /* non-blocking */ });

    const apiPromise = generateAds({ variables: { campaignId } });

    await animationPromise;

    try {
      const { data } = await apiPromise;
      const generatedAd = data?.generateAds?.generatedAd;
      setGeneratedAds(generatedAd ? [generatedAd] : [{ id: '1', visualStyle: 'default' }]);
    } catch (e) {
      const insufficient =
        e instanceof ApolloError &&
        e.graphQLErrors?.some((g) => g.extensions?.code === 'INSUFFICIENT_CREDITS');
      if (insufficient) {
        setError(t('campaigns.new.insufficientCredits'));
        setGenerateProgress(0);
        setStep(3);
      } else {
        setError(t('campaigns.new.errorCreateFallback'));
        setGeneratedAds([]);
      }
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


  function renderAuxiliaryModals() {
    return (
      <>
        {/* ── Audio hint info modal ── */}
        <Modal visible={showAudioHint} transparent animationType="fade" onRequestClose={() => setShowAudioHint(false)}>
          <TouchableWithoutFeedback onPress={() => setShowAudioHint(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
              <TouchableWithoutFeedback>
                <View style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.xl,
                  width: '100%',
                  maxWidth: 380,
                  gap: spacing.md,
                  alignItems: 'center',
                }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.primaryBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="musical-notes-outline" size={22} color={colors.primary} />
                  </View>
                  <Text style={{ fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center' }}>
                    {t('campaigns.new.audioWhyTitle')}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                    {t('campaigns.new.audioWhyBody')}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowAudioHint(false)}
                    style={{ backgroundColor: colors.primary, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.xs }}
                  >
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.white }}>OK</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* ── Error modal ── */}
        <Modal visible={!!error} transparent animationType="fade" onRequestClose={() => setError(null)}>
          <TouchableWithoutFeedback onPress={() => setError(null)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
              <TouchableWithoutFeedback>
                <View style={{
                  backgroundColor: colors.bgCard,
                  borderRadius: radius.lg,
                  borderWidth: 1,
                  borderColor: colors.error,
                  padding: spacing.xl,
                  width: '100%',
                  maxWidth: 380,
                  gap: spacing.md,
                  alignItems: 'center',
                }}>
                  <View style={{
                    width: 44,
                    height: 44,
                    borderRadius: radius.full,
                    backgroundColor: colors.errorBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
                  </View>
                  <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'center' }}>
                    {error}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setError(null)}
                    style={{ backgroundColor: colors.bgElevated, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.xs }}
                  >
                    <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textPrimary }}>OK</Text>
                  </TouchableOpacity>
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
                    name={
                      uploadStepIdx === 3
                        ? 'checkmark'
                        : uploadStepIdx === 1
                          ? 'cloud-upload-outline'
                          : uploadStepIdx === 2
                            ? 'film-outline'
                            : 'add-circle-outline'
                    }
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

      </>
    );
  }

  const pageHeader = (
    <View style={step === 3 ? styles.editorPageHeader : undefined}>
      {/* Header */}

      {/* Step indicator — séquence 1 → 4 → 5 → 6 */}
      <View style={styles.stepRow}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = WIZARD_STEPS[i];
          const curIdx = WIZARD_STEPS.indexOf(step);
          const isDone = curIdx > i;
          const isActive = step === stepNum;
          const canNavigate = WIZARD_STEPS.indexOf(stepNum) < curIdx;
          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <View style={[styles.stepConnector, isDone ? styles.stepConnectorDone : styles.stepConnectorInactive]} />
              )}
              <TouchableOpacity
                style={styles.stepItem}
                onPress={() => canNavigate && setStep(stepNum)}
                activeOpacity={canNavigate ? 0.7 : 1}
                disabled={!canNavigate}
              >
                <View style={[styles.stepDot, isDone ? styles.stepDotDone : isActive ? styles.stepDotActive : styles.stepDotInactive]}>
                  {isDone ? (
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: isActive ? colors.white : colors.textMuted }}>
                      {i + 1}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </View>

    </View>
  );

  const videoEditorStepEl = (
    <View style={{ width: '100%' as any, gap: spacing.lg, alignItems: 'stretch' }}>
      {Platform.OS === 'web' && pendingTrackFile ? (
        <View style={{ paddingHorizontal: isMobile ? spacing.md : spacing.xl, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: fonts.semiBold,
              fontSize: fontSize.sm,
              color: colors.textMuted,
              marginBottom: spacing.sm,
              textAlign: 'center',
            }}
          >
            {t('campaigns.new.waveformSectionTitle')}
          </Text>
          <WaveformHookPicker
            audioFile={pendingTrackFile}
            suggestions={hookSuggestions}
            selected={selectedHook}
            onSelect={setSelectedHook}
            loading={hooksLoading}
            previewVideoUrl={customVideoLocalUrl ?? selectedPreviewUrls[0] ?? undefined}
          />
        </View>
      ) : null}
      <VideoEditorStep
        fullBleed
        videoUrl={customVideoLocalUrl ?? selectedPreviewUrls[0] ?? ''}
        settings={editorSettings}
        onChange={setEditorSettings}
        coverImageUrl={pickedSpotifyCoverUrl}
        defaultEndCardTitle={trackTitle}
      />
    </View>
  );

  if (step === 3) {
    const fabLabel = user ? t('campaigns.new.generateFab') : t('campaigns.new.loginToGenerateFab');

    /** Bouton HTML natif : RN Web ne garantit pas `position:fixed` sur TouchableOpacity. */
    const editorStep4FloatingWeb =
      typeof document !== 'undefined'
        ? createPortal(
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.preventDefault();
                  void handleEditorContinue();
                },
                style: {
                  position: 'fixed',
                  right: spacing.lg,
                  bottom: spacing.lg,
                  zIndex: 2147483647,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '14px 22px',
                  margin: 0,
                  border: 'none',
                  borderRadius: 9999,
                  backgroundColor: colors.primary,
                  color: colors.white,
                  fontSize: fontSize.md,
                  fontWeight: 600,
                  fontFamily: 'Figtree, ui-sans-serif, system-ui, sans-serif',
                  cursor: 'pointer',
                  boxShadow: '0 14px 44px -10px rgba(0,0,0,0.55), 0 6px 20px -6px rgba(0,0,0,0.35)',
                  lineHeight: 1.25,
                } satisfies React.CSSProperties,
              },
              fabLabel
            ),
            document.body
          )
        : null;

    return (
      <>
        <View style={[styles.root, styles.editorStep4Root]}>
          <View style={styles.editorStep4Body}>{videoEditorStepEl}</View>
        </View>
        {Platform.OS === 'web' ? editorStep4FloatingWeb : (
          <View style={styles.editorStep4FabOverlay} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.editorStep4Fab, { backgroundColor: colors.primary }]}
              onPress={() => void handleEditorContinue()}
              activeOpacity={0.88}
            >
              <Text style={[styles.editorStep4FabLabel, { color: colors.white }]}>{fabLabel}</Text>
            </TouchableOpacity>
          </View>
        )}
        {renderAuxiliaryModals()}
      </>
    );
  }

  return (
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.container}>
        {pageHeader}

      {/* ── STEP 1: Upload ── */}
      {step === 1 && !editCampaignId && (
        <Card padding="lg">
          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.wizardTrackTitle')}</Text>
            <Text style={styles.stepSubtitle}>{t('campaigns.new.wizardTrackSubtitle')}</Text>

            <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {t('campaigns.new.wizardStepStreamingLink')}
            </Text>
            <TextInput
              value={streamingUrlInput}
              onChangeText={setStreamingUrlInput}
              placeholder={t('campaigns.new.streamingLinkPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              style={{
                fontFamily: fonts.regular,
                fontSize: fontSize.md,
                color: colors.textPrimary,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            />
            <Button
              label={t('campaigns.new.streamingLinkFetchBtn')}
              onPress={() => void handleResolveStreamingUrl()}
              variant="secondary"
              loading={fetchingStreamingTrack}
              fullWidth
            />

            {trackTitle.trim() && artistName.trim() ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: colors.bgElevated,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {pickedSpotifyCoverUrl ? (
                  <Image source={{ uri: pickedSpotifyCoverUrl }} style={{ width: 56, height: 56, borderRadius: radius.md }} />
                ) : (
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radius.md,
                      backgroundColor: colors.primaryBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="musical-note" size={24} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textPrimary }} numberOfLines={2}>
                    {trackTitle}
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary }} numberOfLines={1}>
                    {artistName}
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm }}>
              <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                {t('campaigns.new.wizardStepUploadAudio')}
              </Text>
              <TouchableOpacity onPress={() => setShowAudioHint(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
                <Ionicons name="information-circle-outline" size={isMobile ? 19 : 15} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

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
                <Text style={styles.uploadZoneLabel}>
                  {trackTitle.trim() ? `Importe "${trackTitle}"` : t('campaigns.new.uploadTrackLabel')}
                </Text>
                <Text style={styles.uploadZoneHint}>{t('campaigns.new.uploadTrackHint')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actions}>
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={handleStep1Continue}
                loading={creating}
                fullWidth={isMobile}
              />
            </View>
          </View>
        </Card>
      )}

      {/* ── STEP 2: choix du clip (stock) ── */}
      {step === 2 && (
        <Card padding="lg">
          <View style={styles.step2WizardCard}>
            <Text style={styles.stepTitle}>{t('campaigns.new.step2VideoTitle')}</Text>
            <Text style={[styles.stepSubtitle, { marginTop: 0 }]}>{t('campaigns.new.step2VideoSubtitle')}</Text>

            <View style={{ gap: spacing.md }}>
              {moodOptions.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={[styles.sectionLabel, { marginTop: 0 }]}>{t('campaigns.new.step2MoodLabel')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      paddingVertical: 0,
                      paddingRight: spacing.md,
                    }}
                  >
                    {moodOptions.map((m) => {
                      const active = m.key === selectedMoodKey;
                      const iconName = (
                        m.icon && m.icon in Ionicons.glyphMap ? m.icon : 'color-palette-outline'
                      ) as keyof typeof Ionicons.glyphMap;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          onPress={() => void handleStep2MoodChange(m.key)}
                          disabled={stockVideosLoading}
                          activeOpacity={0.85}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingVertical: spacing.sm,
                            paddingHorizontal: spacing.md,
                            borderRadius: radius.full,
                            borderWidth: 1,
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primaryBg : colors.bgElevated,
                          }}
                        >
                          <Ionicons
                            name={iconName}
                            size={16}
                            color={active ? colors.primary : colors.textMuted}
                          />
                          <Text
                            style={{
                              fontFamily: fonts.medium,
                              fontSize: fontSize.sm,
                              color: active ? colors.primary : colors.textSecondary,
                              maxWidth: 160,
                            }}
                            numberOfLines={1}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
              <View style={{ gap: spacing.sm }}>
                <Text style={[styles.sectionLabel, { marginTop: 0 }]}>{t('campaigns.new.step2PexelsSearchLabel')}</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                    alignItems: 'center',
                  }}
                >
                  <TextInput
                    value={step2PexelsSearchText}
                    onChangeText={setStep2PexelsSearchText}
                    onSubmitEditing={() => void submitStep2PexelsSearch()}
                    placeholder={t('campaigns.new.step2PexelsSearchPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="search"
                    editable={!stockVideosLoading}
                    style={{
                      flex: 1,
                      flexBasis: 200,
                      minWidth: 160,
                      fontFamily: fonts.regular,
                      fontSize: fontSize.md,
                      color: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    }}
                  />
                  <Button
                    label={t('campaigns.new.step2PexelsSearchSubmit')}
                    variant="secondary"
                    size="sm"
                    onPress={() => void submitStep2PexelsSearch()}
                    disabled={stockVideosLoading}
                  />
                  {step2PexelsSearchQuery.trim() ? (
                    <Button
                      label={t('campaigns.new.step2PexelsSearchClear')}
                      variant="secondary"
                      size="sm"
                      onPress={() => void clearStep2PexelsSearch()}
                      disabled={stockVideosLoading}
                    />
                  ) : null}
                </View>
              </View>
            </View>

            {stockVideosLoading && stockVideoOptions.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.muted}>{t('campaigns.new.step2LoadingClips')}</Text>
              </View>
            ) : stockVideoOptions.length === 0 ? (
              <Text style={styles.muted}>{t('campaigns.new.videosNone')}</Text>
            ) : (
              <View
                style={styles.step2VideoGrid}
                onLayout={(e) => setStep2GridMeasuredW(Math.round(e.nativeEvent.layout.width))}
              >
                {step2VisibleVideos.map((v) => {
                  const selected = v.id === selectedStockVideoId;
                  const previewing = Platform.OS === 'web' && step2PreviewVideoId === v.id;
                  return (
                    <View key={v.id} style={[styles.step2VideoCell, { width: step2CellW }]}>
                      <View style={styles.step2ThumbOuter}>
                        <View
                          style={[
                            styles.step2VideoThumb,
                            selected ? styles.videoThumbSelected : styles.videoThumbIdle,
                          ]}
                        >
                          {previewing && v.previewUrl ? (
                            React.createElement('video', {
                              ref: (el: HTMLVideoElement | null): void => {
                                step2PreviewVideoRef.current = el;
                              },
                              src: v.previewUrl,
                              autoPlay: true,
                              controls: true,
                              playsInline: true,
                              muted: true,
                              preload: 'auto',
                              onLoadedData: (e: React.SyntheticEvent<HTMLVideoElement>) => {
                                const tgt = e.currentTarget;
                                tgt.muted = true;
                                void tgt.play().catch(() => {});
                              },
                              style: {
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block',
                              } satisfies React.CSSProperties,
                            })
                          ) : (
                            <>
                              <TouchableOpacity
                                onPress={() => setSelectedStockVideoId(v.id)}
                                activeOpacity={0.88}
                                style={{ width: '100%', height: '100%' }}
                              >
                                {v.thumbnailUrl ? (
                                  <Image
                                    source={{ uri: v.thumbnailUrl }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <View
                                    style={{
                                      flex: 1,
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minHeight: 120,
                                    }}
                                  >
                                    <Ionicons name="film-outline" size={28} color={colors.textMuted} />
                                  </View>
                                )}
                              </TouchableOpacity>
                              {(v.previewUrl || v.url) ? (
                                <TouchableOpacity
                                  style={styles.step2PlayFab}
                                  onPress={() => {
                                    if (Platform.OS === 'web') {
                                      setStep2PreviewVideoId((p) => (p === v.id ? null : v.id));
                                    } else {
                                      const u = v.previewUrl || v.url;
                                      if (u) void Linking.openURL(u);
                                    }
                                  }}
                                  accessibilityRole="button"
                                  accessibilityLabel={t('campaigns.new.step2PlayPreview')}
                                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                  <Ionicons name="play" size={26} color={colors.white} />
                                </TouchableOpacity>
                              ) : null}
                            </>
                          )}
                        </View>
                      </View>
                      <Text style={styles.videoCredit} numberOfLines={1}>
                        {v.photographer}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {stockVideoOptions.length > 0 && step2StockPageCount > 1 ? (
              <View
                style={{ alignItems: 'center', gap: spacing.sm }}
                accessibilityRole="toolbar"
                accessibilityLabel={t('campaigns.new.step2PaginationA11y')}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: spacing.xs,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {Array.from({ length: step2StockPageCount }, (_, idx) => idx + 1).map((num) => {
                    const active = num === step2StockPage;
                    return (
                      <TouchableOpacity
                        key={num}
                        onPress={() => void handleStep2StockPageChange(num)}
                        disabled={stockVideosLoading || active}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active, disabled: stockVideosLoading || active }}
                        accessibilityLabel={t('campaigns.new.step2Page', { n: num })}
                        style={{
                          minWidth: 42,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active ? colors.primaryBg : colors.bgElevated,
                          opacity: stockVideosLoading && !active ? 0.55 : 1,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.semiBold,
                            fontSize: fontSize.sm,
                            color: active ? colors.primary : colors.textSecondary,
                            textAlign: 'center',
                          }}
                        >
                          {num}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={[styles.actions, { marginTop: spacing.md }]}>
              <Button
                label={t('campaigns.new.step2Back')}
                variant="secondary"
                onPress={() => setStep(1)}
                disabled={stockVideosLoading && stockVideoOptions.length === 0}
              />
              <Button
                label={t('campaigns.new.continueBtn')}
                onPress={() => void handleStep2Continue()}
                fullWidth={isMobile}
                disabled={stockVideosLoading && stockVideoOptions.length === 0}
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
              {t('campaigns.new.generateSubtitle')}
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

            {generateProgress >= GENERATE_STEPS.length && generatedAds.length === 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary }}>
                  {t('campaigns.new.generateFinalizing')}
                </Text>
              </View>
            )}

            {generateProgress >= GENERATE_STEPS.length && generatedAds.length > 0 && (
              <>
                <Text style={styles.successText}>{t('campaigns.new.generateDone')}</Text>
                <View style={styles.adGrid}>
                  {generatedAds.map((ad) => (
                    <View key={ad.id} style={styles.adVideoBlock}>
                      {(ad.videoUrl || selectedPreviewUrls[0] || customVideoLocalUrl)
                        ? React.createElement('video', {
                            src: ad.videoUrl || selectedPreviewUrls[0] || customVideoLocalUrl,
                            playsInline: true,
                            loop: true,
                            controls: true,
                            preload: 'metadata',
                            style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: radius.xl },
                          })
                        : (
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="film-outline" size={32} color={colors.primary} />
                          </View>
                        )
                      }
                    </View>
                  ))}
                </View>
                <View style={styles.actions}>
                  <Button label={t('campaigns.new.continueBtn')} onPress={() => setStep(5)} fullWidth={isMobile} />
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
              <Button label={t('common.back')} variant="secondary" onPress={() => setStep(4)} />
              <Button label={t('campaigns.new.finish')} onPress={handleFinish} />
            </View>
          </View>
        </Card>
      )}
      </ScrollView>
      {renderAuxiliaryModals()}
    </>
  );
}
