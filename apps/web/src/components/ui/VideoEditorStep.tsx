import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

export interface VideoEditorSettings {
  filterPreset: string;
  brightness: number;   // 50–150, default 100
  contrast: number;     // 50–150, default 100
  saturation: number;   // 0–200, default 100
  grain: number;        // 0–100, default 0
  text: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'bold';
  fontSize: number;
  fontColor: string;
  textBgColor: string;
  textBgOpacity: number;
  textPosition: 'top' | 'center' | 'bottom';
  fadeIn: number;
  fadeOut: number;
}

export const DEFAULT_EDITOR_SETTINGS: VideoEditorSettings = {
  filterPreset: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grain: 0,
  text: '',
  fontFamily: 'sans',
  fontSize: 42,
  fontColor: '#FFFFFF',
  textBgColor: '#000000',
  textBgOpacity: 0.5,
  textPosition: 'bottom',
  fadeIn: 0.5,
  fadeOut: 0.5,
};

type EditorTab = 'filter' | 'text' | 'transitions';

interface FilterPreset {
  key: string;
  label: string;
  colors: string[];
  css: string; // base CSS filter (without manual adjustments)
}

const FILTER_PRESETS: FilterPreset[] = [
  { key: 'none',       label: 'Original',   colors: ['#1a1a2e', '#2d2d4e'], css: '' },
  { key: 'california', label: 'California', colors: ['#f7971e', '#ffd200'], css: 'brightness(1.1) saturate(1.5) sepia(0.12)' },
  { key: 'tokyo',      label: 'Tokyo',      colors: ['#0f3460', '#533483'], css: 'brightness(1.05) saturate(1.2) hue-rotate(200deg) contrast(1.15)' },
  { key: 'havana',     label: 'Havana',     colors: ['#c94b4b', '#4b134f'], css: 'sepia(0.35) brightness(1.05) saturate(1.6) hue-rotate(-15deg)' },
  { key: 'paris',      label: 'Paris',      colors: ['#d4b8e0', '#a78cc4'], css: 'brightness(1.08) saturate(0.65) contrast(0.9) sepia(0.12)' },
  { key: 'berlin',     label: 'Berlin',     colors: ['#2c3e50', '#4ca1af'], css: 'saturate(0.4) contrast(1.3) brightness(0.9) hue-rotate(185deg)' },
  { key: 'lagos',      label: 'Lagos',      colors: ['#f7971e', '#ee4d4d'], css: 'saturate(2.0) brightness(1.1) contrast(1.1)' },
  { key: 'seoul',      label: 'Seoul',      colors: ['#8e9eab', '#eef2f3'], css: 'brightness(1.12) saturate(0.85) contrast(1.05)' },
  { key: 'midnight',   label: 'Midnight',   colors: ['#0f0c29', '#302b63'], css: 'brightness(0.6) contrast(1.4) saturate(0.8) hue-rotate(210deg)' },
  { key: 'desert',     label: 'Desert',     colors: ['#c9a96e', '#d4875c'], css: 'sepia(0.5) brightness(1.05) saturate(0.8) contrast(1.1)' },
  { key: 'cinema',     label: 'Cinéma',     colors: ['#2b2b2b', '#555555'], css: 'saturate(0) contrast(1.25) brightness(0.95)' },
  { key: 'polaroid',   label: 'Polaroid',   colors: ['#f8f4e3', '#c9b99a'], css: 'brightness(1.1) saturate(0.75) sepia(0.22) contrast(0.92) hue-rotate(5deg)' },
  { key: 'analog',     label: 'Analog',     colors: ['#8d6e63', '#bcaaa4'], css: 'sepia(0.3) contrast(1.1) brightness(0.92) saturate(1.15)' },
  { key: 'dream',      label: 'Dream',      colors: ['#a18cd1', '#fbc2eb'], css: 'brightness(1.1) saturate(1.3) hue-rotate(280deg) contrast(0.9)' },
];

const FONT_OPTIONS: Array<{ key: VideoEditorSettings['fontFamily']; label: string; css: string }> = [
  { key: 'sans', label: 'Sans', css: 'Arial, sans-serif' },
  { key: 'serif', label: 'Serif', css: 'Georgia, serif' },
  { key: 'mono', label: 'Mono', css: "'Courier New', monospace" },
  { key: 'bold', label: 'Impact', css: 'Impact, fantasy' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FFE500', '#FF3B30',
  '#007AFF', '#34C759', '#FF2D55', '#FF9500',
  '#AF52DE', '#5AC8FA', '#FF6B35', '#00D4AA',
];

const BG_COLORS = ['#000000', '#FFFFFF', '#1a1a2e', '#FF3B30', '#007AFF', 'transparent'];

interface Props {
  videoUrl: string;
  settings: VideoEditorSettings;
  onChange: (s: VideoEditorSettings) => void;
  onBack: () => void;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
}

export function VideoEditorStep({ videoUrl, settings, onChange, onBack, onContinue, continueLabel, continueDisabled }: Props) {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<EditorTab>('filter');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const canvas = document.createElement('canvas');
      // Limit canvas size to avoid memory issues
      const maxW = 320;
      const ratio = video.videoHeight / video.videoWidth;
      canvas.width = maxW;
      canvas.height = Math.round(maxW * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setThumbDataUrl(canvas.toDataURL('image/jpeg', 0.7));
    } catch (e) {
      console.warn('[VideoEditor] frame capture failed:', e);
    }
  }, []);

  useEffect(() => {
    setThumbDataUrl(null);
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const tryCapture = () => {
      if (video.readyState >= 2) {
        // Already has data — seek to get a non-black frame
        video.currentTime = Math.min(0.5, video.duration || 0.5);
      }
    };
    const onLoaded = () => { video.currentTime = Math.min(0.5, video.duration || 0.5); };
    const onSeeked = () => captureFrame();

    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);

    // If video is already loaded (cached), trigger immediately
    tryCapture();

    return () => {
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoUrl, captureFrame]);

  const set = <K extends keyof VideoEditorSettings>(key: K, val: VideoEditorSettings[K]) =>
    onChange({ ...settings, [key]: val });

  const textPositionY: Record<VideoEditorSettings['textPosition'], string> = {
    top: '8%',
    center: '50%',
    bottom: '82%',
  };

  const styles = makeStyles(colors, isMobile);

  const currentPreset = FILTER_PRESETS.find(p => p.key === settings.filterPreset);
  const presetCss = currentPreset?.css ?? '';
  const manualCss = [
    settings.brightness !== 100 ? `brightness(${settings.brightness / 100})` : '',
    settings.contrast !== 100   ? `contrast(${settings.contrast / 100})`     : '',
    settings.saturation !== 100 ? `saturate(${settings.saturation / 100})`   : '',
  ].filter(Boolean).join(' ');
  const fullFilterCss = [presetCss, manualCss].filter(Boolean).join(' ') || 'none';

  const grainOpacity = settings.grain / 100 * 0.55;
  const grainStyle = settings.grain > 0
    ? { position: 'absolute' as const, inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', opacity: grainOpacity, pointerEvents: 'none' as const, zIndex: 2, mixBlendMode: 'overlay' as const }
    : null;

  return (
    <View style={styles.root}>
      <View style={[styles.body, isMobile ? styles.bodyMobile : styles.bodyDesktop]}>

        {/* ── VIDEO PREVIEW ── */}
        <View style={styles.previewCol}>
          <View style={styles.previewWrapper}>
            {/* Video */}
            {React.createElement('video', {
              ref: videoRef,
              src: videoUrl,
              crossOrigin: 'anonymous',
              muted: true,
              playsInline: true,
              loop: true,
              autoPlay: true,
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                filter: fullFilterCss,
                transition: 'filter 0.25s ease',
              },
            })}
            {/* Grain overlay */}
            {grainStyle && <View style={grainStyle} />}
            {/* Text overlay */}
            {settings.text.length > 0 && (
              <View
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  top: textPositionY[settings.textPosition] as any,
                  transform: settings.textPosition === 'center' ? [{ translateY: -20 }] : [],
                  zIndex: 10,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT_OPTIONS.find(f => f.key === settings.fontFamily)?.css ?? 'Arial',
                    fontSize: settings.fontSize * 0.55,
                    color: settings.fontColor,
                    textAlign: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: settings.textBgColor === 'transparent'
                      ? 'transparent'
                      : hexToRgba(settings.textBgColor, settings.textBgOpacity),
                    borderRadius: 4,
                    overflow: 'hidden',
                  } as any}
                >
                  {settings.text}
                </Text>
              </View>
            )}
            {/* Fade badges */}
            {settings.fadeIn > 0 && (
              <View style={styles.fadeBadgeTop}>
                <Ionicons name="sunny-outline" size={10} color="rgba(255,255,255,0.8)" />
                <Text style={styles.fadeBadgeText}>Fade in {settings.fadeIn}s</Text>
              </View>
            )}
            {settings.fadeOut > 0 && (
              <View style={styles.fadeBadgeBottom}>
                <Ionicons name="moon-outline" size={10} color="rgba(255,255,255,0.8)" />
                <Text style={styles.fadeBadgeText}>Fade out {settings.fadeOut}s</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── CONTROLS ── */}
        <View style={styles.controlsCol}>
          {/* Tab bar */}
          <View style={styles.tabBar}>
            {([
              { id: 'filter' as EditorTab, icon: 'color-palette-outline', label: 'Filtre' },
              { id: 'text' as EditorTab, icon: 'text-outline', label: 'Texte' },
              { id: 'transitions' as EditorTab, icon: 'sparkles-outline', label: 'Transitions' },
            ] as const).map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, activeTab === tab.id && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={activeTab === tab.id ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>

            {/* ── FILTER TAB ── */}
            {activeTab === 'filter' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Preset</Text>
                <View style={styles.filterGrid}>
                  {FILTER_PRESETS.map(preset => {
                    const isActive = settings.filterPreset === preset.key;
                    return (
                      <TouchableOpacity
                        key={preset.key}
                        style={[styles.filterCard, isActive && styles.filterCardActive]}
                        onPress={() => set('filterPreset', preset.key)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.filterSwatch, { overflow: 'hidden' }]}>
                          {thumbDataUrl
                            ? React.createElement('img', {
                                src: thumbDataUrl,
                                style: {
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  display: 'block',
                                  filter: preset.css || 'none',
                                },
                              })
                            : React.createElement('div', {
                                style: {
                                  width: '100%',
                                  height: '100%',
                                  background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                                },
                              })
                          }
                          {isActive && React.createElement('div', {
                            style: {
                              position: 'absolute',
                              inset: 0,
                              border: '2px solid',
                              borderColor: 'rgba(79,126,255,0.9)',
                              borderRadius: 4,
                              pointerEvents: 'none',
                            },
                          })}
                        </View>
                        <Text style={[styles.filterLabel, isActive && { color: colors.primary }]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Manual adjustments */}
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  <Text style={styles.sectionLabel}>Ajustements manuels</Text>

                  {([
                    { key: 'brightness' as const, label: 'Luminosité', min: 50, max: 150, icon: 'sunny-outline' },
                    { key: 'contrast'   as const, label: 'Contraste',  min: 50, max: 150, icon: 'contrast-outline' },
                    { key: 'saturation' as const, label: 'Saturation', min: 0,  max: 200, icon: 'color-palette-outline' },
                    { key: 'grain'      as const, label: 'Grain',      min: 0,  max: 100, icon: 'sparkles-outline' },
                  ]).map(({ key, label, min, max, icon }) => {
                    const val = settings[key] as number;
                    const defaultVal = key === 'grain' ? 0 : 100;
                    const isModified = val !== defaultVal;
                    return (
                      <View key={key} style={{ gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name={icon as any} size={13} color={isModified ? colors.primary : colors.textMuted} />
                            <Text style={[styles.sectionLabel, { marginBottom: 0, textTransform: 'none', letterSpacing: 0, fontFamily: fonts.medium, fontSize: fontSize.xs }, isModified && { color: colors.primary }]}>
                              {label}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.xs, color: isModified ? colors.primary : colors.textMuted }}>
                              {key === 'grain' ? val : `${val}%`}
                            </Text>
                            {isModified && (
                              <TouchableOpacity onPress={() => set(key, defaultVal)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                <Ionicons name="refresh-outline" size={12} color={colors.textMuted} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                        {React.createElement('input', {
                          type: 'range', min, max, step: 1,
                          value: val,
                          onChange: (e: any) => set(key, parseInt(e.target.value)),
                          style: { width: '100%', accentColor: colors.primary },
                        })}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={styles.rangeLabelText}>{min}{key !== 'grain' ? '%' : ''}</Text>
                          <Text style={styles.rangeLabelText}>{max}{key !== 'grain' ? '%' : ''}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── TEXT TAB ── */}
            {activeTab === 'text' && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Texte</Text>
                {React.createElement('input', {
                  type: 'text',
                  value: settings.text,
                  placeholder: 'Out now · Ton texte ici…',
                  onChange: (e: any) => set('text', e.target.value),
                  style: {
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.bgElevated,
                    color: colors.textPrimary,
                    fontFamily: 'inherit',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                  },
                })}

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Police</Text>
                <View style={styles.fontRow}>
                  {FONT_OPTIONS.map(f => (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.fontBtn, settings.fontFamily === f.key && styles.fontBtnActive]}
                      onPress={() => set('fontFamily', f.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fontBtnLabel, settings.fontFamily === f.key && { color: colors.primary }, { fontFamily: f.css as any }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                  Taille : {settings.fontSize}px
                </Text>
                {React.createElement('input', {
                  type: 'range', min: 20, max: 80, step: 2,
                  value: settings.fontSize,
                  onChange: (e: any) => set('fontSize', parseInt(e.target.value)),
                  style: { width: '100%', accentColor: colors.primary, marginTop: 4 },
                })}

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Couleur du texte</Text>
                <View style={styles.colorGrid}>
                  {TEXT_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, settings.fontColor === c && styles.colorSwatchActive]}
                      onPress={() => set('fontColor', c)}
                    />
                  ))}
                </View>

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Fond du texte</Text>
                <View style={styles.colorGrid}>
                  {BG_COLORS.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorSwatch,
                        c === 'transparent'
                          ? { backgroundColor: 'transparent', borderStyle: 'dashed' as any }
                          : { backgroundColor: c },
                        settings.textBgColor === c && styles.colorSwatchActive,
                      ]}
                      onPress={() => set('textBgColor', c)}
                    >
                      {c === 'transparent' && (
                        <Ionicons name="close" size={12} color={colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                {settings.textBgColor !== 'transparent' && (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>
                      Opacité fond : {Math.round(settings.textBgOpacity * 100)}%
                    </Text>
                    {React.createElement('input', {
                      type: 'range', min: 0, max: 1, step: 0.05,
                      value: settings.textBgOpacity,
                      onChange: (e: any) => set('textBgOpacity', parseFloat(e.target.value)),
                      style: { width: '100%', accentColor: colors.primary, marginTop: 4 },
                    })}
                  </>
                )}

                <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Position</Text>
                <View style={styles.fontRow}>
                  {([
                    { key: 'top', label: '↑ Haut' },
                    { key: 'center', label: '⟵ Centre' },
                    { key: 'bottom', label: '↓ Bas' },
                  ] as const).map(p => (
                    <TouchableOpacity
                      key={p.key}
                      style={[styles.fontBtn, settings.textPosition === p.key && styles.fontBtnActive]}
                      onPress={() => set('textPosition', p.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.fontBtnLabel, settings.textPosition === p.key && { color: colors.primary }]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ── TRANSITIONS TAB ── */}
            {activeTab === 'transitions' && (
              <View style={styles.section}>
                <View style={styles.transitionRow}>
                  <Ionicons name="sunny-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>Fade In : {settings.fadeIn}s</Text>
                    {React.createElement('input', {
                      type: 'range', min: 0, max: 3, step: 0.25,
                      value: settings.fadeIn,
                      onChange: (e: any) => set('fadeIn', parseFloat(e.target.value)),
                      style: { width: '100%', accentColor: colors.primary, marginTop: 4 },
                    })}
                    <View style={styles.rangeLabels}>
                      <Text style={styles.rangeLabelText}>0s</Text>
                      <Text style={styles.rangeLabelText}>3s</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.transitionRow, { marginTop: spacing.lg }]}>
                  <Ionicons name="moon-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>Fade Out : {settings.fadeOut}s</Text>
                    {React.createElement('input', {
                      type: 'range', min: 0, max: 3, step: 0.25,
                      value: settings.fadeOut,
                      onChange: (e: any) => set('fadeOut', parseFloat(e.target.value)),
                      style: { width: '100%', accentColor: colors.primary, marginTop: 4 },
                    })}
                    <View style={styles.rangeLabels}>
                      <Text style={styles.rangeLabelText}>0s</Text>
                      <Text style={styles.rangeLabelText}>3s</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.infoBox, { marginTop: spacing.xl }]}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.infoText}>
                    Les transitions sont appliquées au rendu final de la vidéo.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* ── ACTIONS ── */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
          <Text style={styles.backBtnLabel}>Retour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueBtn, continueDisabled && { opacity: 0.6 }]}
          onPress={continueDisabled ? undefined : onContinue}
          activeOpacity={continueDisabled ? 1 : 0.8}
        >
          <Text style={styles.continueBtnLabel}>{continueLabel ?? "Générer l'ad"}</Text>
          <Ionicons name="rocket-outline" size={16} color="#fff" />
        </TouchableOpacity>
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

const makeStyles = (colors: ColorPalette, isMobile: boolean) =>
  StyleSheet.create({
    root: { gap: spacing.lg },
    body: { gap: spacing.lg },
    bodyDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
    bodyMobile: { flexDirection: 'column' },

    previewCol: {
      width: isMobile ? '100%' : 300,
      alignSelf: isMobile ? 'center' : 'flex-start',
    },
    previewWrapper: {
      aspectRatio: 9 / 16,
      width: isMobile ? '85%' : 300,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: '#000',
      alignSelf: 'center',
      position: 'relative',
    },

    fadeBadgeTop: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    fadeBadgeBottom: {
      position: 'absolute',
      bottom: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: radius.full,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    fadeBadgeText: {
      fontFamily: fonts.regular,
      fontSize: 9,
      color: 'rgba(255,255,255,0.85)',
    },

    controlsCol: {
      flex: 1,
      backgroundColor: colors.bgElevated,
      borderRadius: radius.xl,
      overflow: 'hidden',
      minHeight: 420,
    },

    tabBar: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm + 2,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabBtnActive: { borderBottomColor: colors.primary },
    tabLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textMuted },
    tabLabelActive: { color: colors.primary },

    tabContent: { padding: spacing.md, maxHeight: 500 },

    section: { gap: spacing.xs },
    sectionLabel: {
      fontFamily: fonts.semiBold,
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 4,
    },

    filterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    filterCard: {
      width: '30%',
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: colors.bgCard,
    },
    filterCardActive: { borderColor: colors.primary },
    filterSwatch: { height: 52, position: 'relative' },
    filterLabel: {
      fontFamily: fonts.medium,
      fontSize: 10,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 4,
    },

    fontRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
    fontBtn: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bgCard,
    },
    fontBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryBg },
    fontBtnLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textSecondary },

    colorGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
    },
    colorSwatch: {
      width: 28,
      height: 28,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSwatchActive: {
      borderWidth: 2.5,
      borderColor: colors.primary,
    },

    transitionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    rangeLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    rangeLabelText: {
      fontFamily: fonts.regular,
      fontSize: 10,
      color: colors.textMuted,
    },

    infoBox: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.bgCard,
      borderRadius: radius.lg,
      padding: spacing.md,
      alignItems: 'flex-start',
    },
    infoText: {
      fontFamily: fonts.regular,
      fontSize: fontSize.xs,
      color: colors.textMuted,
      flex: 1,
      lineHeight: 18,
    },

    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    backBtnLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textSecondary },
    continueBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
    },
    continueBtnLabel: { fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: '#fff' },
  });
