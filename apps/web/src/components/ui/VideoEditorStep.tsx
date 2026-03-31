import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../hooks/useTheme";
import { useIsMobile } from "../../hooks/useIsMobile";
import { spacing, fontSize, radius, fonts } from "../../theme";
import type { ColorPalette } from "../../theme";

const MOTION_STYLE_ID = "video-editor-motion-keyframes";

type EditorTab = "filters" | "motion" | "text";

/**
 * Liste alignée sur l’export FFmpeg (adGenerator) — pas d’effets SVG / filtres exotiques.
 */
const MOTION_PRESETS: Array<{ key: string; label: string; subtitle: string }> =
  [
    { key: "none", label: "Aucun", subtitle: "Sans animation" },
    { key: "kenburns", label: "Zoom lent", subtitle: "Ken Burns" },
    { key: "zoomout", label: "Ouverture", subtitle: "Zoom arrière" },
    { key: "drift", label: "Dérive", subtitle: "Pan lent" },
    { key: "beat", label: "Beat", subtitle: "Pulsation" },
    { key: "pop", label: "Pop", subtitle: "Impact" },
    { key: "iris", label: "Iris", subtitle: "Ouverture diaphragme" },
    { key: "dream", label: "Rêve", subtitle: "Vignette & douceur" },
    { key: "vhs", label: "VHS", subtitle: "Analogique" },
    { key: "noir", label: "Neo-noir", subtitle: "Contraste" },
    { key: "glitch", label: "Glitch", subtitle: "Bruit numérique" },
  ];

const ALLOWED_MOTION_KEYS = new Set(MOTION_PRESETS.map((m) => m.key));

const MOTION_CSS = `
/* Une seule div.ve-motion-inner.ve-motion--* : meilleure prise en charge RN Web + navigateurs */
.ve-motion-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.ve-motion-inner[class*="ve-motion--"] {
  will-change: transform, filter, clip-path;
  backface-visibility: hidden;
}
@keyframes ve-kenburns {
  0% { transform: scale(1) translate(0, 0); }
  100% { transform: scale(1.14) translate(-2.5%, -2%); }
}
@keyframes ve-zoomout {
  0% { transform: scale(1.14); }
  100% { transform: scale(1); }
}
@keyframes ve-beat {
  0%, 100% { transform: scale(1); }
  8% { transform: scale(1.08); }
  16% { transform: scale(1); }
  24% { transform: scale(1.055); }
  32% { transform: scale(1); }
}
@keyframes ve-pop {
  0%, 100% { transform: scale(1); }
  12% { transform: scale(1.11); }
  24% { transform: scale(0.97); }
  36% { transform: scale(1); }
}
@keyframes ve-drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(5%, 2.5%); }
}
@keyframes ve-glitch {
  0%, 88%, 100% { transform: translate(0); filter: hue-rotate(0deg); }
  90% { transform: translate(-5px, 3px); filter: hue-rotate(72deg) saturate(1.45); }
  92% { transform: translate(5px, -3px); filter: hue-rotate(-36deg); }
  94% { transform: translate(-3px); filter: hue-rotate(18deg); }
}
@keyframes ve-dream-zoom {
  0% { transform: scale(1); }
  100% { transform: scale(1.07); }
}
@keyframes ve-dream-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@keyframes ve-vhs-roll {
  0% { transform: translateY(0); }
  100% { transform: translateY(18px); }
}
@keyframes ve-noir-pulse {
  0%, 100% { opacity: 0.82; }
  50% { opacity: 1; }
}
@keyframes ve-iris-clip {
  0%, 100% { clip-path: circle(92% at 50% 50%); }
  50% { clip-path: circle(72% at 50% 49%); }
}
.ve-motion-inner.ve-motion--kenburns { animation: ve-kenburns 5.5s ease-in-out infinite alternate; }
.ve-motion-inner.ve-motion--zoomout { animation: ve-zoomout 5s ease-in-out infinite alternate; }
.ve-motion-inner.ve-motion--beat { animation: ve-beat 1.65s ease-in-out infinite; }
.ve-motion-inner.ve-motion--pop { animation: ve-pop 1.85s ease-in-out infinite; }
.ve-motion-inner.ve-motion--drift { animation: ve-drift 8s ease-in-out infinite; }
.ve-motion-inner.ve-motion--glitch { animation: ve-glitch 2.2s steps(1, end) infinite; }
.ve-motion-inner.ve-motion--iris { animation: ve-iris-clip 4.5s ease-in-out infinite; }
.ve-motion-inner.ve-motion--dream { animation: ve-dream-zoom 7s ease-in-out infinite alternate; }
.ve-motion-inner.ve-motion--dream::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse 90% 80% at 50% 50%, transparent 22%, rgba(60, 40, 100, 0.42) 100%),
    radial-gradient(ellipse 50% 40% at 50% 38%, rgba(255, 220, 200, 0.16) 0%, transparent 70%);
  mix-blend-mode: soft-light;
  animation: ve-dream-pulse 4s ease-in-out infinite;
}
.ve-motion-inner.ve-motion--vhs::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0.5;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.14) 0px,
    rgba(0, 0, 0, 0.14) 1px,
    transparent 1px,
    transparent 3px
  );
  mix-blend-mode: multiply;
}
.ve-motion-inner.ve-motion--vhs::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  box-shadow: inset 0 0 50px rgba(255, 0, 90, 0.08);
  background: linear-gradient(180deg, rgba(80, 120, 255, 0.07) 0%, transparent 25%, transparent 78%, rgba(255, 50, 80, 0.06) 100%);
  animation: ve-vhs-roll 3.8s linear infinite;
  mix-blend-mode: screen;
}
.ve-motion-inner.ve-motion--noir::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 85% at 50% 30%, transparent 14%, rgba(0, 0, 0, 0.78) 100%);
  mix-blend-mode: multiply;
  animation: ve-noir-pulse 4s ease-in-out infinite;
}
`

export interface VideoEditorSettings {
  filterPreset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  grain: number;
  motionPreset: string;
  text: string;
  fontFamily: "sans" | "serif" | "mono" | "bold";
  fontSize: number;
  fontColor: string;
  textBgColor: string;
  textBgOpacity: number;
  textPosition: "top" | "center" | "bottom";
  endCardEnabled: boolean;
  endCardDurationSec: number;
  endCardTitle: string;
  endCardShowTitle: boolean;
  endCardCoverUrl: string;
}

export const DEFAULT_EDITOR_SETTINGS: VideoEditorSettings = {
  filterPreset: "tape_warmth",
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grain: 12,
  motionPreset: "dream",
  text: "",
  fontFamily: "sans",
  fontSize: 42,
  fontColor: "#FFFFFF",
  textBgColor: "#000000",
  textBgOpacity: 0.5,
  textPosition: "bottom",
  endCardEnabled: false,
  endCardDurationSec: 3,
  endCardTitle: "",
  endCardShowTitle: true,
  endCardCoverUrl: "",
};

export function sanitizeEditorSettings(
  partial: Partial<VideoEditorSettings> | null | undefined,
): VideoEditorSettings {
  const merged: VideoEditorSettings = { ...DEFAULT_EDITOR_SETTINGS, ...partial };
  if (!ALLOWED_MOTION_KEYS.has(merged.motionPreset)) {
    merged.motionPreset = DEFAULT_EDITOR_SETTINGS.motionPreset;
  }
  return merged;
}

interface FilterPreset {
  key: string;
  label: string;
  colors: string[];
  css: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { key: "none", label: "Original", colors: ["#1a1a2e", "#2d2d4e"], css: "" },
  {
    key: "tape_warmth",
    label: "Tape warm",
    colors: ["#3d2f2a", "#c9a87c"],
    css: "saturate(0.52) contrast(0.88) brightness(1.05) sepia(0.15)",
  },
  {
    key: "dusk_room",
    label: "Dusk room",
    colors: ["#2a2235", "#c4a574"],
    css: "saturate(0.48) contrast(0.9) brightness(0.98) sepia(0.12) hue-rotate(8deg)",
  },
  {
    key: "rain_glass",
    label: "Rain glass",
    colors: ["#1e2a33", "#8aa4b4"],
    css: "saturate(0.42) contrast(0.95) brightness(0.94) hue-rotate(198deg)",
  },
  {
    key: "forest_mist",
    label: "Forest mist",
    colors: ["#1a2e22", "#7d9a82"],
    css: "saturate(0.55) contrast(0.84) brightness(0.96) hue-rotate(78deg)",
  },
  {
    key: "moon_cool",
    label: "Moon cool",
    colors: ["#1a1f2e", "#9aa8c4"],
    css: "saturate(0.48) contrast(1.02) brightness(0.93) hue-rotate(215deg)",
  },
  {
    key: "desk_night",
    label: "Desk night",
    colors: ["#2a2418", "#e8c48a"],
    css: "saturate(0.58) contrast(0.92) brightness(1.04) sepia(0.18) hue-rotate(12deg)",
  },
  {
    key: "soft_vhs",
    label: "Soft VHS",
    colors: ["#2d2a38", "#b8a8c9"],
    css: "saturate(0.62) contrast(0.88) brightness(1.02) hue-rotate(165deg)",
  },
  {
    key: "lofi",
    label: "Lo-fi",
    colors: ["#e2d9f3", "#c4b5fd"],
    css: "brightness(1.15) saturate(0.45) contrast(0.82) sepia(0.2)",
  },
  {
    key: "prisme",
    label: "Prisme",
    colors: ["#ff0066", "#00ffcc"],
    css: "saturate(2.2) contrast(1.25) brightness(1.05) hue-rotate(8deg)",
  },
  {
    key: "super8",
    label: "Super 8",
    colors: ["#d4a76a", "#f2c882"],
    css: "sepia(0.65) brightness(1.18) contrast(0.85) saturate(1.25)",
  },
  {
    key: "k7",
    label: "K7",
    colors: ["#1a3a2a", "#3d9970"],
    css: "saturate(0.65) contrast(1.3) brightness(0.9) hue-rotate(168deg)",
  },
  {
    key: "neon",
    label: "Néon",
    colors: ["#7c3aed", "#ec4899"],
    css: "brightness(0.65) contrast(1.6) saturate(2.8) hue-rotate(250deg)",
  },
  {
    key: "dore",
    label: "Doré",
    colors: ["#fbbf24", "#f97316"],
    css: "sepia(0.45) saturate(1.9) brightness(1.1) contrast(1.05) hue-rotate(-10deg)",
  },
  {
    key: "cobalt",
    label: "Cobalt",
    colors: ["#1d4ed8", "#3b82f6"],
    css: "brightness(0.95) saturate(0.75) contrast(1.2) hue-rotate(202deg)",
  },
  {
    key: "duotone",
    label: "Duotone",
    colors: ["#9333ea", "#db2777"],
    css: "saturate(3.5) contrast(1.35) brightness(0.88) hue-rotate(285deg)",
  },
  {
    key: "matrix",
    label: "Matrix",
    colors: ["#052e16", "#16a34a"],
    css: "saturate(1.5) contrast(1.3) brightness(0.9) hue-rotate(100deg)",
  },
  {
    key: "velours",
    label: "Velours",
    colors: ["#4a0e1a", "#831843"],
    css: "brightness(0.72) contrast(1.45) saturate(1.3) hue-rotate(330deg) sepia(0.1)",
  },
];

const FONT_OPTIONS: Array<{
  key: VideoEditorSettings["fontFamily"];
  label: string;
  css: string;
}> = [
  { key: "sans", label: "Sans", css: "Arial, sans-serif" },
  { key: "serif", label: "Serif", css: "Georgia, serif" },
  { key: "mono", label: "Mono", css: "'Courier New', monospace" },
  { key: "bold", label: "Impact", css: "Impact, fantasy" },
];

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#FFE500",
  "#FF3B30",
  "#007AFF",
  "#34C759",
  "#FF2D55",
  "#FF9500",
  "#AF52DE",
  "#5AC8FA",
  "#FF6B35",
  "#00D4AA",
];

type AdjustSliderKey = "brightness" | "contrast" | "saturation" | "grain";

const ADJUST_SLIDERS: Array<{
  key: AdjustSliderKey;
  label: string;
  min: number;
  max: number;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    key: "brightness",
    label: "Luminosité",
    min: 50,
    max: 150,
    icon: "sunny-outline",
  },
  {
    key: "contrast",
    label: "Contraste",
    min: 50,
    max: 150,
    icon: "contrast-outline",
  },
  {
    key: "saturation",
    label: "Saturation",
    min: 0,
    max: 200,
    icon: "color-palette-outline",
  },
  { key: "grain", label: "Grain", min: 0, max: 100, icon: "sparkles-outline" },
];

interface Props {
  videoUrl: string;
  settings: VideoEditorSettings;
  onChange: (s: VideoEditorSettings) => void;
  onBack?: () => void;
  fullBleed?: boolean;
  /** Cover streaming / import — préremplit l’overlay de fin si activé. */
  coverImageUrl?: string | null;
  /** Titre du morceau pour l’end card (placeholder). */
  defaultEndCardTitle?: string;
  /**
   * Remplace la colonne preview vidéo (ex. waveform + hook sur la gauche).
   * Sur le web, une vidéo masquée garde le même `videoUrl` pour les miniatures des filtres.
   */
  previewSlot?: React.ReactNode;
}

const TAB_DEFS: Array<{
  id: EditorTab;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    id: "filters",
    label: "Filtres + réglages",
    shortLabel: "Filtres",
    icon: "color-filter-outline",
  },
  {
    id: "motion",
    label: "Animations",
    shortLabel: "Anim.",
    icon: "sparkles-outline",
  },
  { id: "text", label: "Textes", shortLabel: "Texte", icon: "text-outline" },
];

function motionIconFor(key: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    none: "close-circle-outline",
    kenburns: "expand-outline",
    zoomout: "contract-outline",
    drift: "navigate-outline",
    beat: "musical-notes-outline",
    pop: "rocket-outline",
    iris: "eye-outline",
    dream: "cloud-outline",
    vhs: "videocam-outline",
    noir: "contrast-outline",
    glitch: "bug-outline",
  };
  return icons[key] ?? "sparkles-outline";
}

function panelShadow(colors: ColorPalette, strong?: boolean) {
  if (Platform.OS === "web") {
    return {
      boxShadow: strong
        ? `0 0 0 1px ${colors.border}, 0 24px 48px -16px rgba(0,0,0,0.55)`
        : `0 0 0 1px ${colors.border}, 0 12px 32px -8px rgba(0,0,0,0.4)`,
    } as const;
  }
  return {
    elevation: strong ? 12 : 8,
    shadowColor: "#000",
    shadowOpacity: strong ? 0.35 : 0.22,
    shadowRadius: strong ? 24 : 16,
    shadowOffset: { width: 0, height: strong ? 12 : 8 },
  };
}

export function VideoEditorStep({
  videoUrl,
  settings,
  onChange,
  fullBleed,
  coverImageUrl,
  defaultEndCardTitle = "",
  previewSlot,
}: Props) {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>("filters");

  useEffect(() => {
    if (typeof document === "undefined") return;
    let styleEl = document.getElementById(
      MOTION_STYLE_ID,
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = MOTION_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = MOTION_CSS;
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const canvas = document.createElement("canvas");
      const maxW = 320;
      const ratio = video.videoHeight / video.videoWidth;
      canvas.width = maxW;
      canvas.height = Math.round(maxW * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbDataUrl(canvas.toDataURL("image/jpeg", 0.7));
    } catch (e) {
      console.warn("[VideoEditor] frame capture failed:", e);
    }
  }, []);

  useEffect(() => {
    setThumbDataUrl(null);
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    const onLoaded = () => {
      video.currentTime = Math.min(0.5, video.duration || 0.5);
    };
    const onSeeked = () => captureFrame();
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", onSeeked);
    if (video.readyState >= 2)
      video.currentTime = Math.min(0.5, video.duration || 0.5);
    return () => {
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [videoUrl, captureFrame]);

  const set = <K extends keyof VideoEditorSettings>(
    key: K,
    val: VideoEditorSettings[K],
  ) => onChange({ ...settings, [key]: val });

  const textPositionY: Record<VideoEditorSettings["textPosition"], string> = {
    top: "8%",
    center: "50%",
    bottom: "82%",
  };

  const styles = useMemo(
    () => makeStyles(colors, isMobile, !!fullBleed),
    [colors, isMobile, fullBleed],
  );

  const currentPreset = FILTER_PRESETS.find(
    (p) => p.key === settings.filterPreset,
  );
  const presetCss = currentPreset?.css ?? "";
  const manualCss = [
    settings.brightness !== 100
      ? `brightness(${settings.brightness / 100})`
      : "",
    settings.contrast !== 100 ? `contrast(${settings.contrast / 100})` : "",
    settings.saturation !== 100 ? `saturate(${settings.saturation / 100})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const fullFilterCss =
    [presetCss, manualCss].filter(Boolean).join(" ") || "none";

  const grainOpacity = (settings.grain / 100) * 0.55;
  const grainStyle =
    settings.grain > 0
      ? {
          position: "absolute" as const,
          inset: 0,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          opacity: grainOpacity,
          pointerEvents: "none" as const,
          zIndex: 2,
          mixBlendMode: "overlay" as const,
        }
      : null;

  const motionInnerClass = [
    "ve-motion-inner",
    settings.motionPreset && settings.motionPreset !== "none"
      ? `ve-motion--${settings.motionPreset}`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const videoSurface = (
    <>
      {React.createElement("video", {
        ref: videoRef,
        src: videoUrl,
        crossOrigin: "anonymous",
        muted: true,
        playsInline: true,
        loop: true,
        autoPlay: true,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          filter: fullFilterCss,
          transition: "filter 0.25s ease",
        },
      })}
      {grainStyle && <View style={grainStyle} />}
    </>
  );

  const previewFrameInner = (
    <>
      {React.createElement(
        "div",
        {
          className: motionInnerClass,
          style: {
            width: "100%",
            height: "100%",
            position: "relative" as const,
          },
        },
        videoSurface,
      )}
      {settings.text.length > 0 && (
        <View
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            top: textPositionY[settings.textPosition] as any,
            transform:
              settings.textPosition === "center" ? [{ translateY: -20 }] : [],
            zIndex: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={
              {
                fontFamily:
                  FONT_OPTIONS.find((f) => f.key === settings.fontFamily)
                    ?.css ?? "Arial",
                fontSize: settings.fontSize * 0.55,
                color: settings.fontColor,
                textAlign: "center",
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor:
                  settings.textBgColor === "transparent"
                    ? "transparent"
                    : hexToRgba(settings.textBgColor, settings.textBgOpacity),
                borderRadius: 4,
                overflow: "hidden",
              } as any
            }
          >
            {settings.text}
          </Text>
        </View>
      )}
    </>
  );

  const previewCore = (
    <View style={styles.previewStack}>
      <View style={styles.previewFrame}>{previewFrameInner}</View>
    </View>
  );

  /** Même rendu que dans previewFrame, pour l’intégrer dans WaveformHookPicker (filtres / anim / texte). */
  const editorHookPreviewLayer = (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }}
      pointerEvents="box-none"
    >
      {previewFrameInner}
    </View>
  );

  const renderPresetGrid = (
    gridStyle: object,
    swatchHeight: number,
    narrowCards?: boolean,
  ) => (
    <View style={gridStyle}>
      {FILTER_PRESETS.map((preset) => {
        const isActive = settings.filterPreset === preset.key;
        return (
          <TouchableOpacity
            key={preset.key}
            style={[
              styles.filterCard,
              narrowCards && styles.filterCardNarrow,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgElevated,
              },
              isActive && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryBg,
                ...panelShadow(colors, false),
              },
            ]}
            onPress={() => set("filterPreset", preset.key)}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.filterSwatch,
                { overflow: "hidden", height: swatchHeight },
              ]}
            >
              {thumbDataUrl
                ? React.createElement("img", {
                    src: thumbDataUrl,
                    style: {
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      filter: preset.css || "none",
                    },
                  })
                : React.createElement("div", {
                    style: {
                      width: "100%",
                      height: "100%",
                      background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                    },
                  })}
            </View>
            <Text
              style={[
                styles.filterLabel,
                { color: colors.textSecondary },
                isActive && { color: colors.primary },
              ]}
              numberOfLines={1}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAdjustSliders = () => (
    <View style={styles.adjustSlidersWrap}>
      {ADJUST_SLIDERS.map(({ key, label, min, max, icon }) => {
        const val = settings[key] as number;
        const defaultVal = key === "grain" ? 0 : 100;
        const isModified = val !== defaultVal;
        const valueStr = key === "grain" ? String(val) : `${val}%`;
        return (
          <View key={key} style={styles.sliderRow}>
            <View style={styles.sliderRowHeader}>
              <View style={styles.sliderLabelGroup}>
                <Ionicons
                  name={icon}
                  size={16}
                  color={isModified ? colors.primary : colors.textMuted}
                />
                <Text
                  style={[
                    styles.sliderRowTitle,
                    { color: colors.textPrimary },
                    isModified && { color: colors.primary },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
              <Text
                style={[
                  styles.sliderRowValue,
                  { color: isModified ? colors.primary : colors.textMuted },
                ]}
              >
                {valueStr}
              </Text>
            </View>
            {React.createElement("input", {
              type: "range",
              min,
              max,
              step: 1,
              value: val,
              onChange: (e: any) => set(key, parseInt(e.target.value, 10)),
              style: {
                width: "100%",
                display: "block",
                marginTop: 8,
                height: 22,
                accentColor: colors.primary,
                cursor: "pointer",
              } as object,
            })}
          </View>
        );
      })}
    </View>
  );

  const filtersPanelStacked = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>
        Presets
      </Text>
      {renderPresetGrid(styles.filterGrid, isMobile ? 52 : 72)}
      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginTop: spacing.lg },
        ]}
      >
        Lumière & texture
      </Text>
      {renderAdjustSliders()}
    </View>
  );

  const renderMotionTiles = (list: typeof MOTION_PRESETS) =>
    list.map((m) => {
      const isActive = settings.motionPreset === m.key;
      return (
        <TouchableOpacity
          key={m.key}
          style={[
            styles.fxTile,
            {
              borderColor: isActive ? colors.primary : colors.border,
              backgroundColor: isActive ? colors.primaryBg : colors.bgCard,
            },
            isActive && { borderColor: colors.primary },
            isActive &&
              Platform.OS === "web" &&
              ({
                boxShadow: `0 0 0 2px ${colors.primary}45, 0 14px 32px -12px ${colors.primary}40`,
              } as const),
          ]}
          onPress={() => set("motionPreset", m.key)}
          activeOpacity={0.88}
          accessibilityLabel={`${m.label}. ${m.subtitle}`}
        >
          <View
            style={[
              styles.fxTileIconRing,
              {
                borderColor: isActive ? colors.primary : colors.borderLight,
                backgroundColor: isActive ? colors.bgElevated : colors.bgHover,
              },
            ]}
          >
            <Ionicons
              name={motionIconFor(m.key)}
              size={22}
              color={isActive ? colors.primary : colors.textSecondary}
            />
          </View>
          <Text
            style={[
              styles.fxTileLabel,
              { color: colors.textSecondary },
              isActive && { color: colors.primary, fontFamily: fonts.semiBold },
            ]}
            numberOfLines={2}
          >
            {m.label}
          </Text>
          {isActive ? (
            <View
              style={[styles.fxTileDot, { backgroundColor: colors.primary }]}
            />
          ) : (
            <View style={styles.fxTileDotSpacer} />
          )}
        </TouchableOpacity>
      );
    });

  const motionPanel = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>
        Animations (même rendu qu’à l’export)
      </Text>
      <View style={styles.fxGrid}>
        {renderMotionTiles(MOTION_PRESETS)}
      </View>
      <View
        style={[
          styles.fxFootnote,
          { backgroundColor: colors.bgCard, borderColor: colors.borderLight },
        ]}
      >
        <Ionicons
          name="phone-portrait-outline"
          size={12}
          color={colors.textMuted}
        />
        <Text style={[styles.fxFootnoteText, { color: colors.textMuted }]}>
          Mouvements et effets listés ici sont ceux encodés en FFmpeg (zoom,
          vignette, grain, contraste).
        </Text>
      </View>
    </View>
  );

  const textPanel = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>
        Contenu
      </Text>
      {React.createElement("input", {
        type: "text",
        value: settings.text,
        placeholder: "Ton message sur la vidéo…",
        onChange: (e: any) => set("text", e.target.value),
        style: {
          width: "100%",
          padding: "14px 16px",
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgCard,
          color: colors.textPrimary,
          fontFamily: "inherit",
          fontSize: 15,
          outline: "none",
          boxSizing: "border-box",
          marginBottom: spacing.lg,
        },
      })}
      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginBottom: spacing.sm },
        ]}
      >
        Police
      </Text>
      <View style={styles.textStyleRow}>
        {FONT_OPTIONS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.textStyleChip,
              { borderColor: colors.border, backgroundColor: colors.bgCard },
              settings.fontFamily === f.key && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryBg,
              },
            ]}
            onPress={() => set("fontFamily", f.key)}
          >
            <Text
              style={[
                styles.textStyleChipLabel,
                { color: colors.textSecondary },
                settings.fontFamily === f.key && { color: colors.primary },
                { fontFamily: f.css as any },
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginTop: spacing.lg },
        ]}
      >
        Taille
      </Text>
      <View style={styles.textSizeRow}>
        <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>
          {settings.fontSize}px
        </Text>
        {React.createElement("input", {
          type: "range",
          min: 20,
          max: 80,
          step: 2,
          value: settings.fontSize,
          onChange: (e: any) => set("fontSize", parseInt(e.target.value)),
          style: { flex: 1, accentColor: colors.primary, minWidth: 0 },
        })}
      </View>
      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginTop: spacing.lg },
        ]}
      >
        Couleur
      </Text>
      <View style={styles.colorRow}>
        {TEXT_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorSwatchLg,
              { backgroundColor: c, borderColor: colors.border },
              settings.fontColor === c && styles.colorSwatchLgActive,
              settings.fontColor === c && { borderColor: colors.primary },
            ]}
            onPress={() => set("fontColor", c)}
          />
        ))}
      </View>
      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginTop: spacing.lg },
        ]}
      >
        Position
      </Text>
      <View style={styles.textStyleRow}>
        {(["top", "center", "bottom"] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.textStyleChip,
              {
                borderColor: colors.border,
                backgroundColor: colors.bgCard,
                flex: 1,
              },
              settings.textPosition === p && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryBg,
              },
            ]}
            onPress={() => set("textPosition", p)}
          >
            <Text
              style={[
                styles.textStyleChipLabel,
                { color: colors.textSecondary },
                settings.textPosition === p && { color: colors.primary },
              ]}
            >
              {p === "top" ? "Haut" : p === "center" ? "Milieu" : "Bas"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text
        style={[
          styles.fxSectionTitle,
          { color: colors.textMuted, marginTop: spacing.lg },
        ]}
      >
        Fin de clip
      </Text>
      <TouchableOpacity
        onPress={() => {
          const next = !settings.endCardEnabled;
          onChange({
            ...settings,
            endCardEnabled: next,
            endCardCoverUrl:
              next && !settings.endCardCoverUrl?.trim() && coverImageUrl?.trim()
                ? coverImageUrl.trim()
                : settings.endCardCoverUrl,
            endCardTitle:
              next &&
              !settings.endCardTitle?.trim() &&
              defaultEndCardTitle.trim()
                ? defaultEndCardTitle.trim()
                : settings.endCardTitle,
          });
        }}
        activeOpacity={0.85}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: settings.endCardEnabled ? colors.primary : colors.border,
          backgroundColor: settings.endCardEnabled
            ? colors.primaryBg
            : colors.bgCard,
          marginBottom: settings.endCardEnabled ? spacing.md : 0,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: fontSize.sm,
            color: colors.textPrimary,
            flex: 1,
          }}
        >
          Overlay cover + titre (export)
        </Text>
        <Ionicons
          name={settings.endCardEnabled ? "checkbox" : "square-outline"}
          size={22}
          color={settings.endCardEnabled ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>
      {settings.endCardEnabled ? (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>
            Durée overlay : {settings.endCardDurationSec}s
          </Text>
          {React.createElement("input", {
            type: "range",
            min: 1,
            max: 8,
            step: 1,
            value: settings.endCardDurationSec,
            onChange: (e: any) =>
              set("endCardDurationSec", parseInt(e.target.value, 10)),
            style: { width: "100%", accentColor: colors.primary },
          })}
          <TouchableOpacity
            onPress={() => set("endCardShowTitle", !settings.endCardShowTitle)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={settings.endCardShowTitle ? "checkbox" : "square-outline"}
              size={20}
              color={
                settings.endCardShowTitle ? colors.primary : colors.textMuted
              }
            />
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: fontSize.sm,
                color: colors.textSecondary,
              }}
            >
              Afficher le titre sur la cover
            </Text>
          </TouchableOpacity>
          {React.createElement("input", {
            type: "text",
            value: settings.endCardTitle,
            placeholder: defaultEndCardTitle || "Titre du morceau",
            onChange: (e: any) => set("endCardTitle", e.target.value),
            style: {
              width: "100%",
              padding: "12px 14px",
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bgCard,
              color: colors.textPrimary,
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            },
          })}
        </View>
      ) : null}
    </View>
  );

  const sidePanel = (
    <View
      style={[
        styles.sidePanel,
        { borderColor: colors.border, backgroundColor: colors.bgElevated },
        panelShadow(colors, true),
      ]}
    >
      <View style={styles.sidePanelHeader}>
        <View style={styles.sidePanelHeaderText}>
          <Text style={[styles.sidePanelTitle, { color: colors.textPrimary }]}>
            Édition
          </Text>
          <Text style={[styles.sidePanelSubtitle, { color: colors.textMuted }]}>
            Filtres, animations & textes
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.tabBarTrack,
          { backgroundColor: colors.bg, borderColor: colors.borderLight },
        ]}
      >
        {TAB_DEFS.map((tab) => {
          const active = editorTab === tab.id;
          const tabLabel = isMobile ? tab.shortLabel : tab.label;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabSegment,
                active && { backgroundColor: colors.bgElevated },
                active && styles.tabSegmentActive,
              ]}
              onPress={() => setEditorTab(tab.id)}
              activeOpacity={0.88}
            >
              <Ionicons
                name={tab.icon}
                size={isMobile ? 14 : 17}
                color={active ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabSegmentLabel,
                  { color: colors.textMuted },
                  active && {
                    color: colors.primary,
                    fontFamily: fonts.semiBold,
                  },
                ]}
                numberOfLines={1}
              >
                {tabLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.sidePanelBody}>
        {editorTab === "filters" && !isMobile ? (
          <View style={styles.filtersTwoColRow}>
            <ScrollView
              style={styles.filtersColScroll}
              contentContainerStyle={styles.filtersColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[styles.fxSectionTitle, { color: colors.textMuted }]}
              >
                Presets
              </Text>
              {renderPresetGrid(styles.filterGridNarrow, 56, true)}
            </ScrollView>
            <View
              style={[
                styles.filtersColDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <ScrollView
              style={styles.filtersColScroll}
              contentContainerStyle={styles.filtersColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[styles.fxSectionTitle, { color: colors.textMuted }]}
              >
                Lumière & texture
              </Text>
              {renderAdjustSliders()}
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            style={styles.sideScroll}
            contentContainerStyle={styles.sideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {editorTab === "filters" && filtersPanelStacked}
            {editorTab === "motion" && motionPanel}
            {editorTab === "text" && textPanel}
          </ScrollView>
        )}
      </View>
    </View>
  );

  const editorWithHookSlot = previewSlot != null && !isMobile;

  const previewSlotResolved =
    previewSlot != null &&
    Platform.OS === "web" &&
    React.isValidElement(previewSlot)
      ? React.cloneElement(previewSlot as React.ReactElement<any>, {
          editorPreview: editorHookPreviewLayer,
          sharedVideoRef: videoRef,
        })
      : previewSlot;

  return (
    <View style={[styles.shell, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.mainRow,
          isMobile && styles.mainRowMobile,
          editorWithHookSlot
            ? ({ paddingHorizontal: spacing.md, gap: spacing.sm } as const)
            : null,
        ]}
      >
        <View
          style={[
            styles.videoCol,
            previewSlot != null ? { position: "relative" as const } : null,
            editorWithHookSlot
              ? { flexGrow: 1, flexBasis: 0, flexShrink: 1 }
              : null,
          ]}
        >
          {previewSlot != null ? (
            <View
              style={{
                flex: 1,
                minHeight: 0,
                width: "100%",
                alignSelf: "stretch",
              }}
            >
              {previewSlotResolved}
            </View>
          ) : (
            previewCore
          )}
        </View>
        <View
          style={
            editorWithHookSlot
              ? ({
                  flex: 1,
                  flexGrow: 1.48,
                  flexBasis: 0,
                  flexShrink: 1,
                  minWidth: 0,
                } as const)
              : undefined
          }
        >
          {sidePanel}
        </View>
      </View>
    </View>
  );
}

function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

const makeStyles = (
  colors: ColorPalette,
  isMobile: boolean,
  fullBleed: boolean,
) =>
  StyleSheet.create({
    shell: {
      flex: 1,
      width: "100%" as any,
      alignSelf: "stretch",
      flexDirection: "column",
      minHeight: 0,
    },
    mainRow: {
      flex: 1,
      minHeight: 0,
      flexDirection: "row",
      gap: fullBleed ? spacing.md : spacing.lg,
      paddingHorizontal: fullBleed ? spacing.lg : spacing.md,
      paddingTop: fullBleed ? spacing.xs : spacing.md,
      paddingBottom: fullBleed ? spacing.md : spacing.sm,
      alignItems: "stretch",
      justifyContent: "flex-start",
    },
    mainRowMobile: {
      flexDirection: "column",
      alignItems: "stretch",
      gap: spacing.md,
    },
    videoCol: {
      flexGrow: fullBleed && !isMobile ? 1 : 0,
      flexShrink: 1,
      flexBasis: fullBleed && !isMobile ? 0 : undefined,
      alignItems: "center",
      justifyContent: fullBleed && !isMobile ? "center" : "flex-start",
      position: "relative",
      paddingTop: 0,
      paddingRight: isMobile ? 0 : spacing.sm,
      minWidth: 0,
      ...(isMobile
        ? { width: "100%" as const, maxWidth: "100%" as const }
        : {
            minWidth: fullBleed ? 200 : undefined,
            maxWidth: fullBleed ? undefined : 340,
          }),
    },
    previewStack: {
      alignItems: "flex-start",
      width: "100%",
    },
    previewFrame: {
      aspectRatio: 9 / 16,
      width: "100%",
      maxWidth: isMobile ? 400 : fullBleed ? 560 : 320,
      ...(fullBleed && !isMobile && Platform.OS === "web"
        ? { maxHeight: "calc(100vh - 220px)" as any }
        : {}),
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: "#0a0a0f",
      position: "relative",
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === "web"
        ? ({
            boxShadow: `0 0 0 1px ${colors.borderLight}, 0 28px 56px -12px rgba(0,0,0,0.65), 0 12px 24px -8px rgba(0,0,0,0.45)`,
          } as const)
        : {
            elevation: 16,
            shadowColor: "#000",
            shadowOpacity: 0.45,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 16 },
          }),
    },
    sidePanel: {
      flex: isMobile ? 0 : 1,
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      width: isMobile ? ("100%" as any) : undefined,
      maxWidth: "100%" as any,
      borderRadius: radius.xl,
      borderWidth: 1,
      overflow: "hidden",
      alignSelf: "stretch",
      maxHeight: isMobile ? 400 : undefined,
    },
    sidePanelBody: {
      flex: 1,
      minHeight: 0,
      width: "100%" as any,
    },
    filtersTwoColRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "stretch",
      width: "100%" as any,
      minHeight: 0,
    },
    filtersColScroll: {
      flex: 1,
      minWidth: 0,
    },
    filtersColScrollContent: {
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.lg,
    },
    filtersColDivider: {
      width: 1,
      alignSelf: "stretch",
      opacity: 0.85,
    },
    sidePanelHeader: {
      flexShrink: 0,
      paddingHorizontal: isMobile ? spacing.md : spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    sidePanelHeaderText: {
      gap: 4,
    },
    sidePanelTitle: {
      fontFamily: fonts.bold,
      fontSize: isMobile ? fontSize.md : fontSize.lg,
      letterSpacing: -0.4,
    },
    sidePanelSubtitle: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      opacity: 0.9,
    },
    tabBarTrack: {
      flexShrink: 0,
      flexDirection: "row",
      marginHorizontal: isMobile ? spacing.xs : spacing.md,
      marginBottom: spacing.md,
      padding: 4,
      borderRadius: radius.full,
      gap: 3,
      borderWidth: 1,
    },
    tabSegment: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingVertical: isMobile ? 8 : 10,
      paddingHorizontal: 2,
      borderRadius: radius.full,
      minHeight: isMobile ? 48 : 52,
      minWidth: 0,
    },
    tabSegmentActive:
      Platform.OS === "web"
        ? ({ boxShadow: "0 2px 10px rgba(0,0,0,0.14)" } as const)
        : {
            elevation: 4,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          },
    tabSegmentLabel: {
      fontFamily: fonts.medium,
      fontSize: isMobile ? 9 : 11,
      textAlign: "center",
    },
    sideScroll: isMobile ? { maxHeight: 320 } : { flex: 1, minHeight: 0 },
    sideScrollContent: {
      flexGrow: 1,
      width: "100%" as any,
      paddingBottom: spacing.lg,
    },
    tabPanel: {
      paddingHorizontal: isMobile ? spacing.sm : spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    tabPanelFill: {
      flexGrow: 1,
      width: "100%" as any,
      minHeight: 0,
    },
    adjustSlidersWrap: {
      width: "100%" as any,
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    sliderRow: {
      width: "100%" as any,
    },
    sliderRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%" as any,
    },
    sliderLabelGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
      minWidth: 0,
    },
    sliderRowTitle: {
      fontFamily: fonts.medium,
      fontSize: fontSize.sm,
      flexShrink: 1,
    },
    sliderRowValue: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.sm,
      minWidth: 44,
      textAlign: "right",
    },
    fxSectionTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 10,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    fxGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isMobile ? 8 : 10,
      width: "100%" as any,
      ...(isMobile ? {} : { flexGrow: 1, alignContent: "flex-start" }),
    },
    fxTile: {
      width: isMobile ? "31%" : "23.5%",
      minWidth: isMobile ? 72 : 88,
      borderRadius: 18,
      borderWidth: 1.5,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: isMobile ? 104 : 112,
    },
    fxTileIconRing: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    fxTileLabel: {
      fontFamily: fonts.medium,
      fontSize: isMobile ? 10 : 11,
      textAlign: "center",
      lineHeight: 14,
      width: "100%" as any,
    },
    fxTileDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginTop: 8,
    },
    fxTileDotSpacer: {
      height: 5,
      marginTop: 8,
      opacity: 0,
    },
    fxFootnote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: spacing.lg,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    fxFootnoteText: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 15,
    },
    textStyleRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      width: "100%" as any,
    },
    textStyleChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: radius.full,
      borderWidth: 1,
    },
    textStyleChipLabel: {
      fontFamily: fonts.medium,
      fontSize: fontSize.xs,
    },
    textSizeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      width: "100%" as any,
    },
    filterGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isMobile ? 10 : 14,
      width: "100%" as any,
      alignContent: "flex-start",
      justifyContent: "flex-start",
    },
    filterGridNarrow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      width: "100%" as any,
      alignContent: "flex-start",
      justifyContent: "flex-start",
    },
    filterCard: {
      width: isMobile ? "30%" : "23.5%",
      minWidth: isMobile ? 76 : 96,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
    },
    filterCardNarrow: {
      width: "47%",
      minWidth: 0,
      maxWidth: "48%" as any,
    },
    filterSwatch: {
      width: "100%" as any,
      position: "relative",
    },
    filterLabel: {
      fontFamily: fonts.semiBold,
      fontSize: isMobile ? 10 : 11,
      textAlign: "center",
      paddingVertical: isMobile ? 6 : 8,
      paddingHorizontal: 4,
    },
    sliderLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs },
    colorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginTop: spacing.xs,
    },
    colorSwatchLg: {
      width: 32,
      height: 32,
      borderRadius: radius.full,
      borderWidth: 2,
    },
    colorSwatchLgActive: {
      transform: [{ scale: 1.08 }],
    },
  });
