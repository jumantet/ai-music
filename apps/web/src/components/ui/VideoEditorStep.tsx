import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useIsMobile } from '../../hooks/useIsMobile';
import { spacing, fontSize, radius, fonts } from '../../theme';
import type { ColorPalette } from '../../theme';

const MOTION_STYLE_ID = 'video-editor-motion-keyframes';
const SVG_FILTERS_ROOT_ID = 'video-editor-svg-filters-root';

type EditorTab = 'filters' | 'motion' | 'text';

/** Filtres SVG (déformation organique) — appliqués sur le conteneur vidéo */
const SVG_FILTER_BY_MOTION: Partial<Record<string, string>> = {
  liquify: 'url(#ve-filter-liquify)',
  ripple: 'url(#ve-filter-ripple)',
  heat: 'url(#ve-filter-heat)',
};

const SVG_FILTERS_HTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <filter id="ve-filter-liquify" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" result="n">
        <animate attributeName="baseFrequency" values="0.009;0.024;0.014;0.011;0.019;0.011" dur="9s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="14" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="ve-filter-ripple" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence type="turbulence" baseFrequency="0.028 0.09" numOctaves="2" seed="2" result="r">
        <animate attributeName="seed" values="2;8;14;5;11;2" dur="5s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="r" scale="9" xChannelSelector="R" yChannelSelector="B"/>
    </filter>
    <filter id="ve-filter-heat" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" result="h">
        <animate attributeName="baseFrequency" values="0.04;0.055;0.042" dur="3.5s" repeatCount="indefinite"/>
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="h" scale="5" xChannelSelector="R" yChannelSelector="G"/>
      <feGaussianBlur stdDeviation="0.35"/>
    </filter>
  </defs>
</svg>
`;

/**
 * Aperçu web : CSS + filtres SVG (pas de WebGL pour rester léger).
 * Effets type apps pro : mesh, verre, liquify, VHS, aurore, 3D, etc.
 */
const MOTION_PRESETS: Array<{ key: string; label: string; subtitle: string }> = [
  { key: 'none', label: 'Aucun', subtitle: 'Sans effet' },
  { key: 'halo', label: 'Halo sujet', subtitle: 'Aura centrale type portrait' },
  { key: 'rimlight', label: 'Liseré', subtitle: 'Balayage lumière' },
  { key: 'bloom', label: 'Bloom', subtitle: 'Halation ciné' },
  { key: 'dream', label: 'Rêve', subtitle: 'Vignette & douceur' },
  { key: 'mesh', label: 'Mesh', subtitle: 'Dégradés fluides 2025' },
  { key: 'sheen', label: 'Sheen', subtitle: 'Reflet métal / verre' },
  { key: 'holo', label: 'Hologramme', subtitle: 'Irisé mouvant' },
  { key: 'lensflare', label: 'Lens flare', subtitle: 'Faux flare anamorphique' },
  { key: 'glass', label: 'Verre dépoli', subtitle: 'Frosted + saturation' },
  { key: 'aurora', label: 'Aurore', subtitle: 'Bandes boréales' },
  { key: 'dopamine', label: 'Dopamine', subtitle: 'Énergie réseaux sociaux' },
  { key: 'prism', label: 'Prisme', subtitle: 'Conique irisé' },
  { key: 'chromatic', label: 'RGB split', subtitle: 'Franges couleur' },
  { key: 'stardust', label: 'Étoiles', subtitle: 'Poussière lumineuse' },
  { key: 'electric', label: 'Électrique', subtitle: 'Néon bords' },
  { key: 'neongrid', label: 'Grille néon', subtitle: 'Perspective cyber' },
  { key: 'liquid', label: 'Fluide', subtitle: 'Clip organique' },
  { key: 'scan', label: 'Scanline', subtitle: 'Rayon lumineux' },
  { key: 'vhs', label: 'VHS', subtitle: 'Analogique dégradé' },
  { key: 'noir', label: 'Neo-noir', subtitle: 'Contraste ciné' },
  { key: 'cinematic', label: 'Cinémascope', subtitle: 'Bandes noires' },
  { key: 'aqua', label: 'Underwater', subtitle: 'Aquatique ondulant' },
  { key: 'iris', label: 'Iris', subtitle: 'Ouverture diaphragme' },
  { key: 'tilt3d', label: 'Tilt 3D', subtitle: 'Perspective douce' },
  { key: 'pulseblur', label: 'Pulse blur', subtitle: 'Respiration floue' },
  { key: 'chromawave', label: 'Chromawave', subtitle: 'Vague de teinte' },
  { key: 'liquify', label: 'Liquify', subtitle: 'Déformation fluide (SVG)' },
  { key: 'ripple', label: 'Ripple', subtitle: 'Ondulation surface' },
  { key: 'heat', label: 'Heat haze', subtitle: 'Chaleur / mirage' },
  { key: 'kenburns', label: 'Zoom lent', subtitle: 'Ken Burns' },
  { key: 'zoomout', label: 'Ouverture', subtitle: 'Zoom arrière' },
  { key: 'beat', label: 'Beat', subtitle: 'Pulsation' },
  { key: 'pop', label: 'Pop', subtitle: 'Impact' },
  { key: 'drift', label: 'Dérive', subtitle: 'Pan lent' },
  { key: 'glitch', label: 'Glitch', subtitle: 'Numérique' },
];

/** Mouvements prioritaires (lo-fi / ciné) — le reste sous « Autres ». */
const LOFI_MOTION_KEYS = new Set([
  'none', 'halo', 'rimlight', 'bloom', 'dream', 'mesh', 'sheen', 'glass', 'aurora',
  'vhs', 'noir', 'cinematic', 'aqua', 'pulseblur', 'drift', 'kenburns', 'zoomout',
]);

const MOTION_PRESETS_LOFI = MOTION_PRESETS.filter((m) => LOFI_MOTION_KEYS.has(m.key));
const MOTION_PRESETS_OTHER = MOTION_PRESETS.filter((m) => !LOFI_MOTION_KEYS.has(m.key));

const MOTION_CSS = `
@keyframes ve-kenburns {
  0% { transform: scale(1) translate(0, 0); }
  100% { transform: scale(1.1) translate(-2%, -1.5%); }
}
@keyframes ve-zoomout {
  0% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes ve-beat {
  0%, 100% { transform: scale(1); }
  8% { transform: scale(1.06); }
  16% { transform: scale(1); }
  24% { transform: scale(1.04); }
  32% { transform: scale(1); }
}
@keyframes ve-pop {
  0%, 100% { transform: scale(1); }
  12% { transform: scale(1.09); }
  24% { transform: scale(0.98); }
  36% { transform: scale(1); }
}
@keyframes ve-drift {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(4%, 2%); }
}
@keyframes ve-glitch {
  0%, 88%, 100% { transform: translate(0); filter: hue-rotate(0deg); }
  90% { transform: translate(-4px, 2px); filter: hue-rotate(72deg) saturate(1.4); }
  92% { transform: translate(4px, -2px); filter: hue-rotate(-36deg); }
  94% { transform: translate(-2px); filter: hue-rotate(18deg); }
}
@keyframes ve-halo-pulse {
  0%, 100% { opacity: 0.75; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.07); }
}
@keyframes ve-rim-move {
  0% { background-position: 0% 50%; }
  100% { background-position: 200% 50%; }
}
@keyframes ve-bloom-pulse {
  0%, 100% { opacity: 0.5; transform: scale(1); filter: blur(0px); }
  50% { opacity: 0.95; transform: scale(1.12); filter: blur(1px); }
}
@keyframes ve-dream-pulse {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 1; }
}
@keyframes ve-prism-spin {
  to { transform: rotate(360deg); }
}
@keyframes ve-chromatic {
  0%, 100% { filter: drop-shadow(2px 0 0 rgba(255,0,100,0.35)) drop-shadow(-2px 0 0 rgba(0,255,255,0.35)); }
  50% { filter: drop-shadow(-3px 0 0 rgba(255,0,100,0.4)) drop-shadow(3px 0 0 rgba(0,255,255,0.4)); }
}
@keyframes ve-stardust {
  0% { background-position: 0% 0%, 100% 100%, 50% 30%, 80% 70%; }
  100% { background-position: 100% 100%, 0% 0%, 70% 60%, 20% 40%; }
}
@keyframes ve-electric {
  0%, 100% {
    box-shadow: inset 0 0 28px rgba(0, 210, 255, 0.38), inset 0 0 10px rgba(160, 80, 255, 0.28);
  }
  50% {
    box-shadow: inset 0 0 48px rgba(255, 80, 200, 0.5), inset 0 0 16px rgba(0, 255, 200, 0.4);
  }
}
@keyframes ve-liquid-shape {
  0%, 100% { clip-path: inset(2% 3% 2% 3% round 10px); }
  33% { clip-path: inset(3% 2% 3% 2% round 14px 6px); }
  66% { clip-path: inset(1% 4% 2% 4% round 8px 12px); }
}
@keyframes ve-scan {
  0% { transform: translateY(-120%); }
  100% { transform: translateY(120%); }
}
@keyframes ve-mesh-drift {
  0%, 100% { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 50%; filter: hue-rotate(0deg); }
  50% { background-position: 100% 100%, 0% 100%, 50% 0%, 100% 50%; filter: hue-rotate(12deg); }
}
@keyframes ve-sheen {
  0% { background-position: -80% 0; }
  100% { background-position: 180% 0; }
}
@keyframes ve-holo-shift {
  0% { background-position: 0% 40%; filter: hue-rotate(0deg) saturate(1.2); }
  33% { background-position: 100% 60%; filter: hue-rotate(25deg) saturate(1.35); }
  66% { background-position: 50% 0%; filter: hue-rotate(-15deg) saturate(1.25); }
  100% { background-position: 0% 40%; filter: hue-rotate(0deg) saturate(1.2); }
}
@keyframes ve-flare-shift {
  0%, 100% { opacity: 0.85; transform: scale(1) translate(0, 0); }
  50% { opacity: 1; transform: scale(1.03) translate(-1%, 1%); }
}
@keyframes ve-glass-shine {
  0%, 100% { opacity: 0.92; }
  50% { opacity: 1; }
}
@keyframes ve-aurora {
  0%, 100% { transform: translateY(4%) scale(1); opacity: 0.8; }
  50% { transform: translateY(-10%) scale(1.06); opacity: 1; }
}
@keyframes ve-dopamine {
  0%, 100% { transform: scale(1); filter: saturate(1) brightness(1); }
  35% { transform: scale(1.06); filter: saturate(1.4) brightness(1.04); }
  70% { transform: scale(1.02); filter: saturate(1.2) brightness(1.02); }
}
@keyframes ve-vhs-roll {
  0% { transform: translateY(0); }
  100% { transform: translateY(14px); }
}
@keyframes ve-noir-pulse {
  0%, 100% { opacity: 0.88; }
  50% { opacity: 1; }
}
@keyframes ve-grid-pulse {
  0%, 100% { opacity: 0.75; filter: brightness(1); }
  50% { opacity: 1; filter: brightness(1.15); }
}
@keyframes ve-aqua-wave {
  0% { transform: translateY(0) skewX(0deg); }
  50% { transform: translateY(-6px) skewX(0.8deg); }
  100% { transform: translateY(0) skewX(0deg); }
}
@keyframes ve-iris-clip {
  0%, 100% { clip-path: circle(94% at 50% 50%); }
  50% { clip-path: circle(76% at 50% 49%); }
}
@keyframes ve-tilt3d {
  0%, 100% { transform: rotateX(0deg) rotateY(0deg) translateZ(0); }
  20% { transform: rotateX(2.2deg) rotateY(-5deg) translateZ(10px); }
  45% { transform: rotateX(-1.2deg) rotateY(4deg) translateZ(6px); }
  70% { transform: rotateX(1.5deg) rotateY(3.5deg) translateZ(8px); }
}
@keyframes ve-pulseblur {
  0%, 100% { filter: blur(0px) brightness(1); }
  50% { filter: blur(0.85px) brightness(1.03); }
}
@keyframes ve-chromawave {
  0% { filter: hue-rotate(0deg) saturate(1.15); }
  50% { filter: hue-rotate(40deg) saturate(1.35); }
  100% { filter: hue-rotate(0deg) saturate(1.15); }
}

.ve-motion--tilt3d {
  perspective: 440px;
  perspective-origin: 50% 42%;
}
.ve-motion-inner {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.ve-motion--kenburns .ve-motion-inner { animation: ve-kenburns 7s ease-in-out infinite alternate; }
.ve-motion--zoomout .ve-motion-inner { animation: ve-zoomout 6s ease-in-out infinite alternate; }
.ve-motion--beat .ve-motion-inner { animation: ve-beat 1.8s ease-in-out infinite; }
.ve-motion--pop .ve-motion-inner { animation: ve-pop 2s ease-in-out infinite; }
.ve-motion--drift .ve-motion-inner { animation: ve-drift 10s ease-in-out infinite; }
.ve-motion--glitch .ve-motion-inner { animation: ve-glitch 2.5s steps(1, end) infinite; }
.ve-motion--chromatic .ve-motion-inner { animation: ve-chromatic 0.15s linear infinite; }
.ve-motion--electric .ve-motion-inner { animation: ve-electric 2s ease-in-out infinite; }
.ve-motion--liquid .ve-motion-inner { animation: ve-liquid-shape 7s ease-in-out infinite; }
.ve-motion--tilt3d .ve-motion-inner {
  animation: ve-tilt3d 9s ease-in-out infinite;
  transform-style: preserve-3d;
  will-change: transform;
}
.ve-motion--iris .ve-motion-inner { animation: ve-iris-clip 5.5s ease-in-out infinite; }
.ve-motion--pulseblur .ve-motion-inner { animation: ve-pulseblur 2.8s ease-in-out infinite; }
.ve-motion--chromawave .ve-motion-inner { animation: ve-chromawave 6s ease-in-out infinite; }

.ve-motion--halo .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -8%;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(ellipse 52% 48% at 50% 44%,
    rgba(255, 252, 235, 0.5) 0%,
    rgba(255, 200, 160, 0.18) 38%,
    transparent 72%);
  mix-blend-mode: screen;
  animation: ve-halo-pulse 2.8s ease-in-out infinite;
}
.ve-motion--rimlight .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(
    125deg,
    transparent 0%,
    transparent 35%,
    rgba(255, 255, 255, 0.22) 48%,
    rgba(180, 230, 255, 0.15) 52%,
    transparent 65%,
    transparent 100%
  );
  background-size: 220% 220%;
  animation: ve-rim-move 5s linear infinite;
  mix-blend-mode: overlay;
}
.ve-motion--bloom .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -15%;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.55) 0%, transparent 55%);
  mix-blend-mode: screen;
  animation: ve-bloom-pulse 3s ease-in-out infinite;
}
.ve-motion--dream .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse 90% 80% at 50% 50%, transparent 25%, rgba(60, 40, 100, 0.35) 100%),
    radial-gradient(ellipse 50% 40% at 50% 40%, rgba(255, 220, 200, 0.12) 0%, transparent 70%);
  mix-blend-mode: soft-light;
  animation: ve-dream-pulse 5s ease-in-out infinite;
}
.ve-motion--prism .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -25%;
  z-index: 4;
  pointer-events: none;
  background: conic-gradient(
    from 0deg at 50% 50%,
    transparent 0deg,
    rgba(255, 0, 128, 0.12) 60deg,
    transparent 120deg,
    rgba(0, 255, 255, 0.1) 200deg,
    transparent 280deg,
    rgba(255, 200, 0, 0.08) 320deg,
    transparent 360deg
  );
  animation: ve-prism-spin 10s linear infinite;
  mix-blend-mode: overlay;
}
.ve-motion--stardust .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  opacity: 0.75;
  background-image:
    radial-gradient(1.5px 1.5px at 15% 25%, rgba(255,255,255,0.95), transparent),
    radial-gradient(1.5px 1.5px at 85% 15%, rgba(200,230,255,0.9), transparent),
    radial-gradient(2px 2px at 70% 75%, rgba(255,200,255,0.85), transparent),
    radial-gradient(1.5px 1.5px at 40% 80%, rgba(255,255,220,0.9), transparent),
    radial-gradient(2px 2px at 55% 35%, rgba(180,255,255,0.8), transparent);
  background-size: 100% 100%;
  background-repeat: repeat;
  animation: ve-stardust 12s linear infinite;
  mix-blend-mode: screen;
}
.ve-motion--scan .ve-motion-inner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 28%;
  top: -28%;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(255, 255, 255, 0.07) 45%,
    rgba(100, 200, 255, 0.06) 50%,
    transparent 55%
  );
  animation: ve-scan 3.2s linear infinite;
  mix-blend-mode: screen;
}

.ve-motion--mesh .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -12%;
  z-index: 4;
  pointer-events: none;
  opacity: 0.88;
  background:
    radial-gradient(at 22% 28%, rgba(99, 102, 241, 0.38) 0px, transparent 52%),
    radial-gradient(at 78% 18%, rgba(236, 72, 153, 0.34) 0px, transparent 48%),
    radial-gradient(at 48% 82%, rgba(34, 211, 238, 0.32) 0px, transparent 42%),
    radial-gradient(at 8% 72%, rgba(168, 85, 247, 0.28) 0px, transparent 55%),
    radial-gradient(at 92% 65%, rgba(251, 191, 36, 0.2) 0px, transparent 50%);
  background-size: 200% 200%;
  animation: ve-mesh-drift 20s ease-in-out infinite;
  mix-blend-mode: hard-light;
}
.ve-motion--sheen .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(
    105deg,
    transparent 0%,
    transparent 42%,
    rgba(255, 255, 255, 0.22) 50%,
    transparent 58%,
    transparent 100%
  );
  background-size: 220% 100%;
  animation: ve-sheen 3.8s ease-in-out infinite;
  mix-blend-mode: overlay;
}
.ve-motion--holo .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -5%;
  z-index: 4;
  pointer-events: none;
  opacity: 0.42;
  background: linear-gradient(
    130deg,
    rgba(255, 0, 128, 0.35),
    rgba(255, 140, 0, 0.25),
    rgba(64, 224, 208, 0.3),
    rgba(121, 40, 202, 0.35),
    rgba(255, 0, 128, 0.35)
  );
  background-size: 400% 400%;
  animation: ve-holo-shift 6s ease-in-out infinite;
  mix-blend-mode: overlay;
}
.ve-motion--lensflare .ve-motion-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background:
    linear-gradient(124deg, transparent 32%, rgba(255, 255, 255, 0.12) 40%, transparent 46%),
    radial-gradient(ellipse 90% 50% at 74% 26%, rgba(255, 248, 220, 0.5) 0%, transparent 62%);
  mix-blend-mode: screen;
  animation: ve-flare-shift 7s ease-in-out infinite;
}
.ve-motion--lensflare .ve-motion-inner::after {
  content: '';
  position: absolute;
  width: 18%;
  height: 18%;
  top: 16%;
  right: 18%;
  z-index: 4;
  pointer-events: none;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.55) 0%, rgba(255, 200, 120, 0.15) 40%, transparent 70%);
  mix-blend-mode: screen;
  filter: blur(0.5px);
  animation: ve-flare-shift 7s ease-in-out infinite reverse;
}
.ve-motion--glass .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  backdrop-filter: blur(16px) saturate(1.45);
  -webkit-backdrop-filter: blur(16px) saturate(1.45);
  background: linear-gradient(
    168deg,
    rgba(255, 255, 255, 0.18) 0%,
    rgba(255, 255, 255, 0.03) 38%,
    rgba(255, 255, 255, 0.1) 100%
  );
  animation: ve-glass-shine 5.5s ease-in-out infinite;
  mix-blend-mode: soft-light;
}
.ve-motion--aurora .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -5%;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse 110% 45% at 28% 100%, rgba(0, 255, 200, 0.28), transparent),
    radial-gradient(ellipse 90% 40% at 72% 100%, rgba(140, 80, 255, 0.26), transparent),
    radial-gradient(ellipse 70% 35% at 50% 100%, rgba(255, 120, 200, 0.18), transparent);
  animation: ve-aurora 10s ease-in-out infinite;
  mix-blend-mode: screen;
}
.ve-motion--dopamine .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: -8%;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 45%, rgba(255, 230, 120, 0.35) 0%, transparent 58%),
    conic-gradient(from 180deg at 50% 120%, rgba(255, 60, 180, 0.12), transparent, rgba(60, 200, 255, 0.1));
  mix-blend-mode: overlay;
  animation: ve-dopamine 1.35s ease-in-out infinite;
}
.ve-motion--neongrid .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(0, 255, 210, 0.09) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 0, 200, 0.07) 1px, transparent 1px);
  background-size: 32px 32px;
  transform-origin: center bottom;
  transform: perspective(280px) rotateX(12deg) scale(1.08);
  animation: ve-grid-pulse 3.2s ease-in-out infinite;
  mix-blend-mode: screen;
  mask-image: linear-gradient(to top, black 55%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 55%, transparent 100%);
}
.ve-motion--vhs .ve-motion-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0.45;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.12) 0px,
    rgba(0, 0, 0, 0.12) 1px,
    transparent 1px,
    transparent 3px
  );
  mix-blend-mode: multiply;
}
.ve-motion--vhs .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  box-shadow: inset 0 0 50px rgba(255, 0, 90, 0.06);
  background: linear-gradient(180deg, rgba(80, 120, 255, 0.05) 0%, transparent 25%, transparent 78%, rgba(255, 50, 80, 0.04) 100%);
  animation: ve-vhs-roll 4.5s linear infinite;
  mix-blend-mode: screen;
}
.ve-motion--noir .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: radial-gradient(ellipse 95% 85% at 50% 32%, transparent 18%, rgba(0, 0, 0, 0.72) 100%);
  mix-blend-mode: multiply;
  animation: ve-noir-pulse 5s ease-in-out infinite;
}
.ve-motion--cinematic .ve-motion-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.62) 0%,
    rgba(0, 0, 0, 0.62) 11%,
    transparent 11.2%,
    transparent 88.8%,
    rgba(0, 0, 0, 0.62) 89%,
    rgba(0, 0, 0, 0.62) 100%
  );
  mix-blend-mode: multiply;
}
.ve-motion--aqua .ve-motion-inner::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  opacity: 0.55;
  background: repeating-linear-gradient(
    92deg,
    transparent,
    transparent 18px,
    rgba(0, 160, 200, 0.04) 19px,
    rgba(0, 160, 200, 0.04) 20px
  );
  mix-blend-mode: soft-light;
  animation: ve-aqua-wave 5s ease-in-out infinite;
}
.ve-motion--aqua .ve-motion-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse 100% 55% at 50% 100%, rgba(0, 140, 180, 0.22) 0%, transparent 55%),
    linear-gradient(180deg, rgba(0, 80, 120, 0.08) 0%, transparent 40%);
  mix-blend-mode: color-dodge;
  animation: ve-aqua-wave 7s ease-in-out infinite reverse;
}
`;

export interface VideoEditorSettings {
  filterPreset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  grain: number;
  motionPreset: string;
  text: string;
  fontFamily: 'sans' | 'serif' | 'mono' | 'bold';
  fontSize: number;
  fontColor: string;
  textBgColor: string;
  textBgOpacity: number;
  textPosition: 'top' | 'center' | 'bottom';
  endCardEnabled: boolean;
  endCardDurationSec: number;
  endCardTitle: string;
  endCardShowTitle: boolean;
  endCardCoverUrl: string;
}

export const DEFAULT_EDITOR_SETTINGS: VideoEditorSettings = {
  filterPreset: 'tape_warmth',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  grain: 12,
  motionPreset: 'dream',
  text: '',
  fontFamily: 'sans',
  fontSize: 42,
  fontColor: '#FFFFFF',
  textBgColor: '#000000',
  textBgOpacity: 0.5,
  textPosition: 'bottom',
  endCardEnabled: false,
  endCardDurationSec: 3,
  endCardTitle: '',
  endCardShowTitle: true,
  endCardCoverUrl: '',
};

interface FilterPreset {
  key: string;
  label: string;
  colors: string[];
  css: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { key: 'none',    label: 'Original', colors: ['#1a1a2e', '#2d2d4e'], css: '' },
  { key: 'tape_warmth', label: 'Tape warm', colors: ['#3d2f2a', '#c9a87c'], css: 'saturate(0.52) contrast(0.88) brightness(1.05) sepia(0.15)' },
  { key: 'dusk_room', label: 'Dusk room', colors: ['#2a2235', '#c4a574'], css: 'saturate(0.48) contrast(0.9) brightness(0.98) sepia(0.12) hue-rotate(8deg)' },
  { key: 'rain_glass', label: 'Rain glass', colors: ['#1e2a33', '#8aa4b4'], css: 'saturate(0.42) contrast(0.95) brightness(0.94) hue-rotate(198deg)' },
  { key: 'forest_mist', label: 'Forest mist', colors: ['#1a2e22', '#7d9a82'], css: 'saturate(0.55) contrast(0.84) brightness(0.96) hue-rotate(78deg)' },
  { key: 'moon_cool', label: 'Moon cool', colors: ['#1a1f2e', '#9aa8c4'], css: 'saturate(0.48) contrast(1.02) brightness(0.93) hue-rotate(215deg)' },
  { key: 'desk_night', label: 'Desk night', colors: ['#2a2418', '#e8c48a'], css: 'saturate(0.58) contrast(0.92) brightness(1.04) sepia(0.18) hue-rotate(12deg)' },
  { key: 'soft_vhs', label: 'Soft VHS', colors: ['#2d2a38', '#b8a8c9'], css: 'saturate(0.62) contrast(0.88) brightness(1.02) hue-rotate(165deg)' },
  { key: 'lofi',    label: 'Lo-fi',    colors: ['#e2d9f3', '#c4b5fd'], css: 'brightness(1.15) saturate(0.45) contrast(0.82) sepia(0.2)' },
  { key: 'prisme',  label: 'Prisme',   colors: ['#ff0066', '#00ffcc'], css: 'saturate(2.2) contrast(1.25) brightness(1.05) hue-rotate(8deg)' },
  { key: 'super8',  label: 'Super 8',  colors: ['#d4a76a', '#f2c882'], css: 'sepia(0.65) brightness(1.18) contrast(0.85) saturate(1.25)' },
  { key: 'k7',      label: 'K7',       colors: ['#1a3a2a', '#3d9970'], css: 'saturate(0.65) contrast(1.3) brightness(0.9) hue-rotate(168deg)' },
  { key: 'neon',    label: 'Néon',     colors: ['#7c3aed', '#ec4899'], css: 'brightness(0.65) contrast(1.6) saturate(2.8) hue-rotate(250deg)' },
  { key: 'dore',    label: 'Doré',     colors: ['#fbbf24', '#f97316'], css: 'sepia(0.45) saturate(1.9) brightness(1.1) contrast(1.05) hue-rotate(-10deg)' },
  { key: 'cobalt',  label: 'Cobalt',   colors: ['#1d4ed8', '#3b82f6'], css: 'brightness(0.95) saturate(0.75) contrast(1.2) hue-rotate(202deg)' },
  { key: 'duotone', label: 'Duotone',  colors: ['#9333ea', '#db2777'], css: 'saturate(3.5) contrast(1.35) brightness(0.88) hue-rotate(285deg)' },
  { key: 'matrix',  label: 'Matrix',   colors: ['#052e16', '#16a34a'], css: 'saturate(1.5) contrast(1.3) brightness(0.9) hue-rotate(100deg)' },
  { key: 'velours', label: 'Velours',  colors: ['#4a0e1a', '#831843'], css: 'brightness(0.72) contrast(1.45) saturate(1.3) hue-rotate(330deg) sepia(0.1)' },
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

type AdjustSliderKey = 'brightness' | 'contrast' | 'saturation' | 'grain';

const ADJUST_SLIDERS: Array<{
  key: AdjustSliderKey;
  label: string;
  min: number;
  max: number;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'brightness', label: 'Luminosité', min: 50, max: 150, icon: 'sunny-outline' },
  { key: 'contrast', label: 'Contraste', min: 50, max: 150, icon: 'contrast-outline' },
  { key: 'saturation', label: 'Saturation', min: 0, max: 200, icon: 'color-palette-outline' },
  { key: 'grain', label: 'Grain', min: 0, max: 100, icon: 'sparkles-outline' },
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
}

const TAB_DEFS: Array<{
  id: EditorTab;
  label: string;
  shortLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'filters', label: 'Filtres + réglages', shortLabel: 'Filtres', icon: 'color-filter-outline' },
  { id: 'motion', label: 'Animations', shortLabel: 'Anim.', icon: 'sparkles-outline' },
  { id: 'text', label: 'Textes', shortLabel: 'Texte', icon: 'text-outline' },
];

function motionIconFor(key: string): keyof typeof Ionicons.glyphMap {
  const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
    none: 'close-circle-outline',
    halo: 'sunny-outline',
    rimlight: 'flash-outline',
    bloom: 'sparkles',
    dream: 'cloud-outline',
    mesh: 'grid-outline',
    sheen: 'diamond-outline',
    holo: 'color-wand-outline',
    lensflare: 'radio-outline',
    glass: 'layers-outline',
    aurora: 'partly-sunny-outline',
    dopamine: 'heart-outline',
    prism: 'triangle-outline',
    chromatic: 'aperture-outline',
    stardust: 'star-outline',
    electric: 'flash-outline',
    neongrid: 'apps-outline',
    liquid: 'water-outline',
    scan: 'scan-outline',
    vhs: 'videocam-outline',
    noir: 'contrast-outline',
    cinematic: 'film-outline',
    aqua: 'rainy-outline',
    iris: 'eye-outline',
    tilt3d: 'cube-outline',
    pulseblur: 'water-outline',
    chromawave: 'pulse-outline',
    liquify: 'git-network-outline',
    ripple: 'radio-button-on-outline',
    heat: 'flame-outline',
    kenburns: 'expand-outline',
    zoomout: 'contract-outline',
    beat: 'musical-notes-outline',
    pop: 'rocket-outline',
    drift: 'navigate-outline',
    glitch: 'bug-outline',
  };
  return icons[key] ?? 'sparkles-outline';
}

function panelShadow(colors: ColorPalette, strong?: boolean) {
  if (Platform.OS === 'web') {
    return {
      boxShadow: strong
        ? `0 0 0 1px ${colors.border}, 0 24px 48px -16px rgba(0,0,0,0.55)`
        : `0 0 0 1px ${colors.border}, 0 12px 32px -8px rgba(0,0,0,0.4)`,
    } as const;
  }
  return {
    elevation: strong ? 12 : 8,
    shadowColor: '#000',
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
  defaultEndCardTitle = '',
}: Props) {
  const { colors } = useTheme();
  const isMobile = useIsMobile();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<EditorTab>('filters');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    let styleEl = document.getElementById(MOTION_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = MOTION_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = MOTION_CSS;

    if (!document.getElementById(SVG_FILTERS_ROOT_ID)) {
      const root = document.createElement('div');
      root.id = SVG_FILTERS_ROOT_ID;
      root.setAttribute('aria-hidden', 'true');
      root.innerHTML = SVG_FILTERS_HTML;
      Object.assign(root.style, {
        position: 'absolute',
        width: '0',
        height: '0',
        overflow: 'hidden',
        clipPath: 'inset(50%)',
        pointerEvents: 'none',
      });
      document.body.appendChild(root);
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const canvas = document.createElement('canvas');
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
    const onLoaded = () => { video.currentTime = Math.min(0.5, video.duration || 0.5); };
    const onSeeked = () => captureFrame();
    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('seeked', onSeeked);
    if (video.readyState >= 2) video.currentTime = Math.min(0.5, video.duration || 0.5);
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

  const styles = useMemo(() => makeStyles(colors, isMobile, !!fullBleed), [colors, isMobile, fullBleed]);

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

  const motionWrapClass =
    settings.motionPreset && settings.motionPreset !== 'none'
      ? `ve-motion--${settings.motionPreset}`
      : '';

  const svgSurfaceFilter = SVG_FILTER_BY_MOTION[settings.motionPreset] ?? '';

  const videoSurface = (
    <>
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
      {grainStyle && <View style={grainStyle} />}
    </>
  );

  const videoInner = svgSurfaceFilter
    ? React.createElement(
        'div',
        {
          style: {
            width: '100%',
            height: '100%',
            position: 'relative' as const,
            filter: svgSurfaceFilter,
            isolation: 'isolate' as const,
          },
        },
        videoSurface
      )
    : videoSurface;

  const previewCore = (
    <View style={styles.previewStack}>
    <View style={styles.previewFrame}>
      {React.createElement(
        'div',
        {
          className: motionWrapClass || undefined,
          style: { width: '100%', height: '100%', position: 'relative' as const },
        },
        React.createElement(
          'div',
          { className: 've-motion-inner', style: { width: '100%', height: '100%' } },
          videoInner
        )
      )}
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
    </View>
    </View>
  );

  const renderPresetGrid = (gridStyle: object, swatchHeight: number, narrowCards?: boolean) => (
    <View style={gridStyle}>
      {FILTER_PRESETS.map(preset => {
        const isActive = settings.filterPreset === preset.key;
        return (
          <TouchableOpacity
            key={preset.key}
            style={[
              styles.filterCard,
              narrowCards && styles.filterCardNarrow,
              { borderColor: colors.border, backgroundColor: colors.bgElevated },
              isActive && {
                borderColor: colors.primary,
                backgroundColor: colors.primaryBg,
                ...panelShadow(colors, false),
              },
            ]}
            onPress={() => set('filterPreset', preset.key)}
            activeOpacity={0.85}
          >
            <View style={[styles.filterSwatch, { overflow: 'hidden', height: swatchHeight }]}>
              {thumbDataUrl
                ? React.createElement('img', {
                    src: thumbDataUrl,
                    style: { width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: preset.css || 'none' },
                  })
                : React.createElement('div', {
                    style: { width: '100%', height: '100%', background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` },
                  })}
            </View>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }, isActive && { color: colors.primary }]} numberOfLines={1}>
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
        const defaultVal = key === 'grain' ? 0 : 100;
        const isModified = val !== defaultVal;
        const valueStr = key === 'grain' ? String(val) : `${val}%`;
        return (
          <View key={key} style={styles.sliderRow}>
            <View style={styles.sliderRowHeader}>
              <View style={styles.sliderLabelGroup}>
                <Ionicons name={icon} size={16} color={isModified ? colors.primary : colors.textMuted} />
                <Text
                  style={[styles.sliderRowTitle, { color: colors.textPrimary }, isModified && { color: colors.primary }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
              <Text style={[styles.sliderRowValue, { color: isModified ? colors.primary : colors.textMuted }]}>{valueStr}</Text>
            </View>
            {React.createElement('input', {
              type: 'range',
              min,
              max,
              step: 1,
              value: val,
              onChange: (e: any) => set(key, parseInt(e.target.value, 10)),
              style: {
                width: '100%',
                display: 'block',
                marginTop: 8,
                height: 22,
                accentColor: colors.primary,
                cursor: 'pointer',
              } as object,
            })}
          </View>
        );
      })}
    </View>
  );

  const filtersPanelStacked = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>Presets</Text>
      {renderPresetGrid(styles.filterGrid, isMobile ? 52 : 72)}
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Lumière & texture</Text>
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
              Platform.OS === 'web' &&
              ({
                boxShadow: `0 0 0 2px ${colors.primary}45, 0 14px 32px -12px ${colors.primary}40`,
              } as const),
          ]}
          onPress={() => set('motionPreset', m.key)}
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
            <Ionicons name={motionIconFor(m.key)} size={22} color={isActive ? colors.primary : colors.textSecondary} />
          </View>
          <Text
            style={[styles.fxTileLabel, { color: colors.textSecondary }, isActive && { color: colors.primary, fontFamily: fonts.semiBold }]}
            numberOfLines={2}
          >
            {m.label}
          </Text>
          {isActive ? <View style={[styles.fxTileDot, { backgroundColor: colors.primary }]} /> : <View style={styles.fxTileDotSpacer} />}
        </TouchableOpacity>
      );
    });

  const motionPanel = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>Lo-fi & ciné</Text>
      <View style={styles.fxGrid}>{renderMotionTiles(MOTION_PRESETS_LOFI)}</View>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Autres</Text>
      <View style={styles.fxGrid}>{renderMotionTiles(MOTION_PRESETS_OTHER)}</View>
      <View style={[styles.fxFootnote, { backgroundColor: colors.bgCard, borderColor: colors.borderLight }]}>
        <Ionicons name="phone-portrait-outline" size={12} color={colors.textMuted} />
        <Text style={[styles.fxFootnoteText, { color: colors.textMuted }]}>
          Animations : aperçu web · l’export applique filtres couleur, grain et fin de clip (cover).
        </Text>
      </View>
    </View>
  );

  const textPanel = (
    <View style={[styles.tabPanel, styles.tabPanelFill]}>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>Contenu</Text>
      {React.createElement('input', {
        type: 'text',
        value: settings.text,
        placeholder: 'Ton message sur la vidéo…',
        onChange: (e: any) => set('text', e.target.value),
        style: {
          width: '100%',
          padding: '14px 16px',
          borderRadius: radius.lg,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.bgCard,
          color: colors.textPrimary,
          fontFamily: 'inherit',
          fontSize: 15,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: spacing.lg,
        },
      })}
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginBottom: spacing.sm }]}>Police</Text>
      <View style={styles.textStyleRow}>
        {FONT_OPTIONS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.textStyleChip,
              { borderColor: colors.border, backgroundColor: colors.bgCard },
              settings.fontFamily === f.key && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
            ]}
            onPress={() => set('fontFamily', f.key)}
          >
            <Text style={[styles.textStyleChipLabel, { color: colors.textSecondary }, settings.fontFamily === f.key && { color: colors.primary }, { fontFamily: f.css as any }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Taille</Text>
      <View style={styles.textSizeRow}>
        <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>{settings.fontSize}px</Text>
        {React.createElement('input', {
          type: 'range',
          min: 20,
          max: 80,
          step: 2,
          value: settings.fontSize,
          onChange: (e: any) => set('fontSize', parseInt(e.target.value)),
          style: { flex: 1, accentColor: colors.primary, minWidth: 0 },
        })}
      </View>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Couleur</Text>
      <View style={styles.colorRow}>
        {TEXT_COLORS.map(c => (
          <TouchableOpacity
            key={c}
            style={[
              styles.colorSwatchLg,
              { backgroundColor: c, borderColor: colors.border },
              settings.fontColor === c && styles.colorSwatchLgActive,
              settings.fontColor === c && { borderColor: colors.primary },
            ]}
            onPress={() => set('fontColor', c)}
          />
        ))}
      </View>
      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Position</Text>
      <View style={styles.textStyleRow}>
        {(['top', 'center', 'bottom'] as const).map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.textStyleChip,
              { borderColor: colors.border, backgroundColor: colors.bgCard, flex: 1 },
              settings.textPosition === p && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
            ]}
            onPress={() => set('textPosition', p)}
          >
            <Text style={[styles.textStyleChipLabel, { color: colors.textSecondary }, settings.textPosition === p && { color: colors.primary }]}>
              {p === 'top' ? 'Haut' : p === 'center' ? 'Milieu' : 'Bas'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.fxSectionTitle, { color: colors.textMuted, marginTop: spacing.lg }]}>Fin de clip</Text>
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
              next && !settings.endCardTitle?.trim() && defaultEndCardTitle.trim()
                ? defaultEndCardTitle.trim()
                : settings.endCardTitle,
          });
        }}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: settings.endCardEnabled ? colors.primary : colors.border,
          backgroundColor: settings.endCardEnabled ? colors.primaryBg : colors.bgCard,
          marginBottom: settings.endCardEnabled ? spacing.md : 0,
        }}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textPrimary, flex: 1 }}>
          Overlay cover + titre (export)
        </Text>
        <Ionicons
          name={settings.endCardEnabled ? 'checkbox' : 'square-outline'}
          size={22}
          color={settings.endCardEnabled ? colors.primary : colors.textMuted}
        />
      </TouchableOpacity>
      {settings.endCardEnabled ? (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <Text style={[styles.sliderLabel, { color: colors.textPrimary }]}>
            Durée overlay : {settings.endCardDurationSec}s
          </Text>
          {React.createElement('input', {
            type: 'range',
            min: 1,
            max: 8,
            step: 1,
            value: settings.endCardDurationSec,
            onChange: (e: any) => set('endCardDurationSec', parseInt(e.target.value, 10)),
            style: { width: '100%', accentColor: colors.primary },
          })}
          <TouchableOpacity
            onPress={() => set('endCardShowTitle', !settings.endCardShowTitle)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={settings.endCardShowTitle ? 'checkbox' : 'square-outline'}
              size={20}
              color={settings.endCardShowTitle ? colors.primary : colors.textMuted}
            />
            <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSecondary }}>
              Afficher le titre sur la cover
            </Text>
          </TouchableOpacity>
          {React.createElement('input', {
            type: 'text',
            value: settings.endCardTitle,
            placeholder: defaultEndCardTitle || 'Titre du morceau',
            onChange: (e: any) => set('endCardTitle', e.target.value),
            style: {
              width: '100%',
              padding: '12px 14px',
              borderRadius: radius.lg,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bgCard,
              color: colors.textPrimary,
              fontFamily: 'inherit',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
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
          <Text style={[styles.sidePanelTitle, { color: colors.textPrimary }]}>Édition</Text>
          <Text style={[styles.sidePanelSubtitle, { color: colors.textMuted }]}>Filtres, animations & textes</Text>
        </View>
      </View>
      <View style={[styles.tabBarTrack, { backgroundColor: colors.bg, borderColor: colors.borderLight }]}>
        {TAB_DEFS.map(tab => {
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
              <Ionicons name={tab.icon} size={isMobile ? 14 : 17} color={active ? colors.primary : colors.textMuted} />
              <Text
                style={[
                  styles.tabSegmentLabel,
                  { color: colors.textMuted },
                  active && { color: colors.primary, fontFamily: fonts.semiBold },
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
        {editorTab === 'filters' && !isMobile ? (
          <View style={styles.filtersTwoColRow}>
            <ScrollView
              style={styles.filtersColScroll}
              contentContainerStyle={styles.filtersColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>Presets</Text>
              {renderPresetGrid(styles.filterGridNarrow, 56, true)}
            </ScrollView>
            <View style={[styles.filtersColDivider, { backgroundColor: colors.border }]} />
            <ScrollView
              style={styles.filtersColScroll}
              contentContainerStyle={styles.filtersColScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.fxSectionTitle, { color: colors.textMuted }]}>Lumière & texture</Text>
              {renderAdjustSliders()}
            </ScrollView>
          </View>
        ) : (
          <ScrollView
            style={styles.sideScroll}
            contentContainerStyle={styles.sideScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {editorTab === 'filters' && filtersPanelStacked}
            {editorTab === 'motion' && motionPanel}
            {editorTab === 'text' && textPanel}
          </ScrollView>
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.shell, { backgroundColor: colors.bg }]}>
      <View style={[styles.mainRow, isMobile && styles.mainRowMobile]}>
        <View style={styles.videoCol}>{previewCore}</View>
        {sidePanel}
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

const makeStyles = (colors: ColorPalette, isMobile: boolean, fullBleed: boolean) =>
  StyleSheet.create({
    shell: {
      flex: 1,
      width: '100%' as any,
      alignSelf: 'stretch',
      flexDirection: 'column',
      minHeight: 0,
    },
    mainRow: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'row',
      gap: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      alignItems: 'stretch',
      justifyContent: 'flex-start',
    },
    mainRowMobile: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.md,
    },
    videoCol: {
      flexGrow: 0,
      flexShrink: 0,
      alignItems: 'flex-start',
      position: 'relative',
      paddingTop: 0,
      paddingRight: isMobile ? 0 : spacing.sm,
      ...(isMobile
        ? { width: '100%' as const, maxWidth: '100%' as const }
        : { maxWidth: fullBleed ? 420 : 340 }),
    },
    previewStack: {
      alignItems: 'flex-start',
      width: '100%',
    },
    previewFrame: {
      aspectRatio: 9 / 16,
      width: '100%',
      maxWidth: isMobile ? 400 : fullBleed ? 400 : 320,
      borderRadius: radius.xl,
      overflow: 'hidden',
      backgroundColor: '#0a0a0f',
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.border,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: `0 0 0 1px ${colors.borderLight}, 0 28px 56px -12px rgba(0,0,0,0.65), 0 12px 24px -8px rgba(0,0,0,0.45)`,
          } as const)
        : {
            elevation: 16,
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 16 },
          }),
    },
    sidePanel: {
      flex: isMobile ? 0 : 1,
      flexDirection: 'column',
      minWidth: 0,
      minHeight: 0,
      width: isMobile ? ('100%' as any) : undefined,
      maxWidth: '100%' as any,
      borderRadius: radius.xl,
      borderWidth: 1,
      overflow: 'hidden',
      alignSelf: 'stretch',
      maxHeight: isMobile ? 400 : undefined,
    },
    sidePanelBody: {
      flex: 1,
      minHeight: 0,
      width: '100%' as any,
    },
    filtersTwoColRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'stretch',
      width: '100%' as any,
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
      alignSelf: 'stretch',
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
      flexDirection: 'row',
      marginHorizontal: isMobile ? spacing.xs : spacing.md,
      marginBottom: spacing.md,
      padding: 4,
      borderRadius: radius.full,
      gap: 3,
      borderWidth: 1,
    },
    tabSegment: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      paddingVertical: isMobile ? 8 : 10,
      paddingHorizontal: 2,
      borderRadius: radius.full,
      minHeight: isMobile ? 48 : 52,
      minWidth: 0,
    },
    tabSegmentActive:
      Platform.OS === 'web'
        ? ({ boxShadow: '0 2px 10px rgba(0,0,0,0.14)' } as const)
        : {
            elevation: 4,
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          },
    tabSegmentLabel: {
      fontFamily: fonts.medium,
      fontSize: isMobile ? 9 : 11,
      textAlign: 'center',
    },
    sideScroll: isMobile
      ? { maxHeight: 320 }
      : { flex: 1, minHeight: 0 },
    sideScrollContent: {
      flexGrow: 1,
      width: '100%' as any,
      paddingBottom: spacing.lg,
    },
    tabPanel: {
      paddingHorizontal: isMobile ? spacing.sm : spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    tabPanelFill: {
      flexGrow: 1,
      width: '100%' as any,
      minHeight: 0,
    },
    adjustSlidersWrap: {
      width: '100%' as any,
      gap: spacing.md,
      paddingBottom: spacing.sm,
    },
    sliderRow: {
      width: '100%' as any,
    },
    sliderRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%' as any,
    },
    sliderLabelGroup: {
      flexDirection: 'row',
      alignItems: 'center',
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
      textAlign: 'right',
    },
    fxSectionTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: spacing.sm,
    },
    fxGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 8 : 10,
      width: '100%' as any,
      ...(isMobile
        ? {}
        : { flexGrow: 1, alignContent: 'flex-start' }),
    },
    fxTile: {
      width: isMobile ? '31%' : '23.5%',
      minWidth: isMobile ? 72 : 88,
      borderRadius: 18,
      borderWidth: 1.5,
      paddingVertical: 12,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'flex-start',
      minHeight: isMobile ? 104 : 112,
    },
    fxTileIconRing: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    fxTileLabel: {
      fontFamily: fonts.medium,
      fontSize: isMobile ? 10 : 11,
      textAlign: 'center',
      lineHeight: 14,
      width: '100%' as any,
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
      flexDirection: 'row',
      alignItems: 'center',
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
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      width: '100%' as any,
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      width: '100%' as any,
    },
    filterGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isMobile ? 10 : 14,
      width: '100%' as any,
      alignContent: 'flex-start',
      justifyContent: 'flex-start',
    },
    filterGridNarrow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      width: '100%' as any,
      alignContent: 'flex-start',
      justifyContent: 'flex-start',
    },
    filterCard: {
      width: isMobile ? '30%' : '23.5%',
      minWidth: isMobile ? 76 : 96,
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
    },
    filterCardNarrow: {
      width: '47%',
      minWidth: 0,
      maxWidth: '48%' as any,
    },
    filterSwatch: {
      width: '100%' as any,
      position: 'relative',
    },
    filterLabel: {
      fontFamily: fonts.semiBold,
      fontSize: isMobile ? 10 : 11,
      textAlign: 'center',
      paddingVertical: isMobile ? 6 : 8,
      paddingHorizontal: 4,
    },
    sliderLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: spacing.xs },
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
