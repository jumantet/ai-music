import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { HookSuggestion } from "@toolkit/shared";
import { useTheme } from "../../hooks/useTheme";
import { fonts, fontSize, radius, spacing } from "../../theme";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function energyLabel(energy: string): string {
  if (energy === "high") return "Haute énergie";
  if (energy === "chorus") return "Refrain";
  return "Montée progressive";
}

interface Props {
  audioFile: File | null;
  suggestions: HookSuggestion[];
  selected: HookSuggestion | null;
  onSelect: (hook: HookSuggestion) => void;
  loading?: boolean;
}

export function WaveformHookPicker({
  audioFile,
  suggestions,
  selected,
  onSelect,
  loading: suggestionsLoading,
}: Props) {
  const { colors } = useTheme();

  // Canvas + audio refs — never cause re-renders
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const waveformRef = useRef<Float32Array | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);
  const playCtxStartRef = useRef(0);
  const playOffsetRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const selectedRef = useRef(selected);
  const suggestionsRef = useRef(suggestions);

  // React state — for labels / button states only
  const [audioLoaded, setAudioLoaded] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep refs in sync with props
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  // ─── Canvas draw (reads refs only, no re-render) ────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const data = waveformRef.current;
    const buf = audioBufferRef.current;
    if (!canvas || !data || !buf) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, w, h);

    const N = data.length;
    const barW = Math.max(1.5, (w / N) * 0.65);

    // Draw base waveform (dim)
    for (let i = 0; i < N; i++) {
      const barH = Math.max(2, data[i] * h * 0.82);
      const x = (i / N) * w;
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(x, (h - barH) / 2, barW, barH);
    }

    // Draw hook regions + colored waveform inside
    const segs = suggestionsRef.current;
    segs.forEach((hook, idx) => {
      const isSel =
        selectedRef.current?.start === hook.start &&
        selectedRef.current?.end === hook.end;
      const x1 = (hook.start / buf.duration) * w;
      const x2 = (hook.end / buf.duration) * w;

      // Region fill
      ctx.fillStyle = isSel ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.10)";
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Waveform inside region (colored)
      for (let i = 0; i < N; i++) {
        const bx = (i / N) * w;
        if (bx < x1 || bx > x2) continue;
        const barH = Math.max(2, data[i] * h * 0.82);
        ctx.fillStyle = isSel
          ? "rgba(139,92,246,0.9)"
          : "rgba(99,102,241,0.45)";
        ctx.fillRect(bx, (h - barH) / 2, barW, barH);
      }

      // Border
      ctx.strokeStyle = isSel ? "rgba(139,92,246,1)" : "rgba(99,102,241,0.55)";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(x1 + 0.5, 0.5, x2 - x1 - 1, h - 1);

      // Index label
      ctx.fillStyle = isSel ? "#fff" : "rgba(255,255,255,0.65)";
      ctx.font = `bold 11px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(`${idx + 1}`, x1 + 5, 5);
    });

    // Playhead
    const px =
      buf.duration > 0 ? (currentTimeRef.current / buf.duration) * w : 0;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }, []);

  // ─── Decode audio ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioFile || Platform.OS !== "web") return;
    let cancelled = false;
    setDecoding(true);
    setAudioLoaded(false);

    (async () => {
      try {
        const ab = await audioFile.arrayBuffer();
        const ActxClass = (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext) as typeof AudioContext;
        const actx = new ActxClass();
        audioCtxRef.current = actx;
        const buf = await actx.decodeAudioData(ab);
        if (cancelled) return;

        audioBufferRef.current = buf;

        // Downsample to 200 points
        const ch = buf.getChannelData(0);
        const N = 200;
        const step = Math.floor(ch.length / N);
        const wav = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          let max = 0;
          for (let j = 0; j < step; j++)
            max = Math.max(max, Math.abs(ch[i * step + j] ?? 0));
          wav[i] = max;
        }
        waveformRef.current = wav;
        setDuration(buf.duration);
        setAudioLoaded(true);
        setDecoding(false);
        requestAnimationFrame(drawCanvas);
      } catch (e) {
        console.error("[WaveformHookPicker] decode error", e);
        if (!cancelled) setDecoding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioFile, drawCanvas]);

  // Redraw when selected changes
  useEffect(() => {
    if (audioBufferRef.current) requestAnimationFrame(drawCanvas);
  }, [selected, suggestions, drawCanvas]);

  // ─── Playback ──────────────────────────────────────────────────────────────
  function stopPlayback() {
    isPlayingRef.current = false;
    try {
      sourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    sourceRef.current = null;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }

  function startPlayback(fromTime: number) {
    const actx = audioCtxRef.current;
    const buf = audioBufferRef.current;
    if (!actx || !buf) return;
    stopPlayback();
    if (actx.state === "suspended") actx.resume();

    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0, fromTime);
    src.onended = () => {
      if (sourceRef.current === src) {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };
    sourceRef.current = src;
    playCtxStartRef.current = actx.currentTime;
    playOffsetRef.current = fromTime;
    currentTimeRef.current = fromTime;
    isPlayingRef.current = true;
    setIsPlaying(true);

    const tick = () => {
      if (!isPlayingRef.current || !audioCtxRef.current) return;
      const t = Math.min(
        playOffsetRef.current +
          (audioCtxRef.current.currentTime - playCtxStartRef.current),
        buf.duration,
      );
      currentTimeRef.current = t;
      setDisplayTime(t);
      drawCanvas();
      if (t < buf.duration && isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (isPlaying) {
      const actx = audioCtxRef.current;
      if (actx)
        playOffsetRef.current += actx.currentTime - playCtxStartRef.current;
      stopPlayback();
    } else {
      startPlayback(currentTimeRef.current);
    }
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const buf = audioBufferRef.current;
    if (!canvas || !buf) return;
    const rect = canvas.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / canvas.clientWidth) * buf.duration;
    currentTimeRef.current = t;
    setDisplayTime(t);
    if (isPlayingRef.current) startPlayback(t);
    else drawCanvas();
  }

  function handleHookSelect(hook: HookSuggestion) {
    onSelect(hook);
    currentTimeRef.current = hook.start;
    setDisplayTime(hook.start);
    startPlayback(hook.start);
  }

  // Cleanup
  useEffect(() => {
    return () => {
      stopPlayback();
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Native fallback ───────────────────────────────────────────────────────
  if (Platform.OS !== "web") {
    return (
      <View style={{ gap: spacing.sm }}>
        {suggestions.map((h, i) => {
          const isSel = selected?.start === h.start && selected?.end === h.end;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => onSelect(h)}
              activeOpacity={0.8}
              style={{
                padding: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: isSel ? colors.primary : colors.border,
                backgroundColor: isSel ? colors.primaryBg : colors.bgElevated,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: fontSize.md,
                  color: colors.textPrimary,
                  flex: 1,
                }}
              >
                {formatTime(h.start)} — {formatTime(h.end)}
              </Text>
              {isSel && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.primary}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── Web UI ────────────────────────────────────────────────────────────────
  return (
    <View style={{ gap: spacing.lg }}>
      {/* Waveform canvas */}
      <View style={{ borderRadius: radius.xl, overflow: "hidden" }}>
        {decoding ? (
          <View
            style={{
              height: 96,
              backgroundColor: "#0d0d1a",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <ActivityIndicator color={colors.primary} />
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: fontSize.xs,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Décodage de l'audio…
            </Text>
          </View>
        ) : !audioFile ? (
          <View
            style={{
              height: 96,
              backgroundColor: "#0d0d1a",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.xs,
            }}
          >
            <Ionicons
              name="musical-note-outline"
              size={22}
              color="rgba(255,255,255,0.25)"
            />
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: fontSize.xs,
                color: "rgba(255,255,255,0.35)",
              }}
            >
              Hooks générés depuis les métadonnées
            </Text>
          </View>
        ) : (
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              width: "100%",
              height: 96,
              cursor: "crosshair",
            }}
            onClick={handleCanvasClick}
          />
        )}
      </View>

      {/* Playback bar */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
      >
        <TouchableOpacity
          onPress={togglePlay}
          disabled={!audioLoaded}
          activeOpacity={0.8}
          style={{
            width: 42,
            height: 42,
            borderRadius: radius.full,
            backgroundColor: audioLoaded ? colors.primary : colors.bgElevated,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={18}
            color={audioLoaded ? "#fff" : colors.textMuted}
          />
        </TouchableOpacity>

        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: fontSize.sm,
            color: colors.textSecondary,
            flex: 1,
          }}
        >
          {formatTime(displayTime)}
          <Text style={{ color: colors.textMuted }}>
            {" "}
            / {formatTime(duration)}
          </Text>
        </Text>

        {selected && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radius.full,
            }}
          >
            <Ionicons
              name="checkmark-circle"
              size={13}
              color={colors.primary}
            />
            <Text
              style={{
                fontFamily: fonts.semiBold,
                fontSize: fontSize.xs,
                color: colors.primary,
              }}
            >
              {formatTime(selected.start)} — {formatTime(selected.end)}
            </Text>
          </View>
        )}
      </View>

      {/* Hook suggestion rows */}
      {suggestionsLoading ? (
        <View
          style={{
            alignItems: "center",
            paddingVertical: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <ActivityIndicator color={colors.primary} size="large" />
          <Text
            style={{
              fontFamily: fonts.regular,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            Analyse du morceau en cours…
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {suggestions.map((hook, i) => {
            const isSel =
              selected?.start === hook.start && selected?.end === hook.end;
            return (
              <TouchableOpacity
                key={i}
                onPress={() => handleHookSelect(hook)}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: isSel ? colors.primary : colors.border,
                  backgroundColor: isSel ? colors.primaryBg : colors.bgElevated,
                }}
              >
                {/* Number badge */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: radius.full,
                    backgroundColor: isSel ? colors.primary : colors.bgCard,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 13,
                      color: isSel ? "#fff" : colors.textMuted,
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: fontSize.md,
                      color: colors.textPrimary,
                    }}
                  >
                    {formatTime(hook.start)} — {formatTime(hook.end)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.regular,
                      fontSize: fontSize.sm,
                      color: colors.textSecondary,
                    }}
                  >
                    {energyLabel(hook.energy)}
                  </Text>
                </View>

                {isSel ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.primary}
                  />
                ) : (
                  <Ionicons
                    name="play-circle-outline"
                    size={20}
                    color={colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
