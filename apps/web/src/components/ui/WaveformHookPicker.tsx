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

const HOOK_DURATION = 15; // seconds — fixed window size

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function energyLabel(energy: string): string {
  if (energy === "high") return "Drop";
  if (energy === "chorus") return "Refrain";
  return "Montée";
}

interface Props {
  audioFile: File | null;
  suggestions: HookSuggestion[];
  selected: HookSuggestion | null;
  onSelect: (hook: HookSuggestion) => void;
  loading?: boolean;
  previewVideoUrl?: string;
}

export function WaveformHookPicker({
  audioFile,
  suggestions,
  selected,
  onSelect,
  loading: suggestionsLoading,
  previewVideoUrl,
}: Props) {
  const { colors } = useTheme();

  // Audio/canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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

  // Drag state
  const isDraggingRef = useRef(false);
  const dragOffsetTimeRef = useRef(0);
  const hasAutoplayed = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const [audioLoaded, setAudioLoaded] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [duration, setDuration] = useState(0);
  const [displayTime, setDisplayTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);

  // Auto-preview first hook when suggestions arrive
  useEffect(() => {
    if (hasAutoplayed.current) return;
    if (suggestions.length === 0 || !selected) return;
    hasAutoplayed.current = true;
    const timer = setTimeout(() => {
      startPlayback(selected.start, HOOK_DURATION);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, selected]);

  // ─── Canvas draw ─────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use real waveform data or generate a placeholder
    const buf = audioBufferRef.current;
    const data: Float32Array = waveformRef.current ?? (() => {
      const N = 300;
      const placeholder = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        placeholder[i] = 0.15 + 0.5 * Math.abs(Math.sin(i * 0.18 + 1.2)) + 0.2 * Math.abs(Math.sin(i * 0.07));
      }
      return placeholder;
    })();
    // When no real audio, use suggestions-derived duration or fallback 180s
    const fakeDuration = buf?.duration ?? (suggestionsRef.current.length > 0
      ? Math.max(...suggestionsRef.current.map(h => h.end)) + 30
      : 180);
    const effectiveDuration = buf ? buf.duration : fakeDuration;

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

    const sel = selectedRef.current;
    const selX1 = sel ? (sel.start / effectiveDuration) * w : -1;
    const selX2 = sel ? (sel.end / effectiveDuration) * w : -1;

    // Dimmed area outside selection
    if (sel) {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, 0, selX1, h);
      ctx.fillRect(selX2, 0, w - selX2, h);
    }

    // Waveform bars
    const N = data.length;
    const barW = Math.max(1.5, (w / N) * 0.52);
    const spacing_ = w / N;

    for (let i = 0; i < N; i++) {
      const barH = Math.max(3, data[i] * h * 0.84);
      const x = i * spacing_;
      const inSel = sel ? (x + barW >= selX1 && x <= selX2) : false;

      if (inSel) {
        const grad = ctx.createLinearGradient(0, (h - barH) / 2, 0, (h + barH) / 2);
        grad.addColorStop(0, "rgba(255, 110, 30, 1)");
        grad.addColorStop(0.5, "rgba(255, 55, 20, 1)");
        grad.addColorStop(1, "rgba(255, 110, 30, 1)");
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.38)";
      }

      ctx.beginPath();
      ctx.roundRect(x, (h - barH) / 2, barW, barH, Math.min(barW / 2, 2));
      ctx.fill();
    }

    // Selection bracket
    if (sel && selX1 >= 0) {
      const bh = h * 0.82;
      const by = (h - bh) / 2;
      const bw = 3;

      // Top & bottom rails
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(selX1, by, selX2 - selX1, 2); // top
      ctx.fillRect(selX1, by + bh - 2, selX2 - selX1, 2); // bottom

      // Left handle
      ctx.beginPath();
      ctx.roundRect(selX1, by, bw, bh, [2, 0, 0, 2]);
      ctx.fillStyle = "#fff";
      ctx.fill();

      // Right handle
      ctx.beginPath();
      ctx.roundRect(selX2 - bw, by, bw, bh, [0, 2, 2, 0]);
      ctx.fill();

      // Handle notches
      const notchY = h / 2;
      const notchH = bh * 0.3;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      for (let d = -3; d <= 3; d += 3) {
        ctx.fillRect(selX1 + 1, notchY + d - 0.5, 1, 2);
        ctx.fillRect(selX2 - bw + 1, notchY + d - 0.5, 1, 2);
      }
    }

    // AI hook suggestion rectangles
    const COLORS = [
      { fill: "rgba(255,100,30,", stroke: "rgba(255,150,70,1)" },
      { fill: "rgba(120,80,255,", stroke: "rgba(160,120,255,1)" },
    ];
    const segs = suggestionsRef.current;
    segs.forEach((hook, idx) => {
      const isSel = selectedRef.current?.start === hook.start;
      const x1 = (hook.start / effectiveDuration) * w;
      const x2 = (hook.end / effectiveDuration) * w;
      const c = COLORS[idx % COLORS.length];
      const alpha = isSel ? "0.35)" : "0.15)";

      // Region fill
      ctx.fillStyle = c.fill + alpha;
      ctx.fillRect(x1, 0, x2 - x1, h);

      // Waveform bars inside (colored)
      for (let i = 0; i < N; i++) {
        const bx = i * spacing_;
        if (bx + barW < x1 || bx > x2) continue;
        const barH = Math.max(3, data[i] * h * 0.84);
        ctx.fillStyle = isSel ? c.fill + "1)" : c.fill + "0.55)";
        ctx.beginPath();
        ctx.roundRect(bx, (h - barH) / 2, barW, barH, Math.min(barW / 2, 2));
        ctx.fill();
      }

      // Border
      ctx.strokeStyle = isSel ? c.stroke : c.fill + "0.5)";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(x1 + 0.5, 0.5, x2 - x1 - 1, h - 1);
    });

    // Playhead
    if (isPlayingRef.current) {
      const px = effectiveDuration > 0 ? (currentTimeRef.current / effectiveDuration) * w : 0;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(255,255,255,0.5)";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, []);

  // ─── Decode ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!audioFile || Platform.OS !== "web") return;
    let cancelled = false;
    setDecoding(true);
    setAudioLoaded(false);

    (async () => {
      try {
        const ab = await audioFile.arrayBuffer();
        const ActxClass = (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ) as typeof AudioContext;
        const actx = new ActxClass();
        audioCtxRef.current = actx;
        const buf = await actx.decodeAudioData(ab);
        if (cancelled) return;

        audioBufferRef.current = buf;
        const ch = buf.getChannelData(0);
        const N = 300;
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

    return () => { cancelled = true; };
  }, [audioFile, drawCanvas]);

  useEffect(() => {
    requestAnimationFrame(drawCanvas);
  }, [selected, suggestions, drawCanvas]);

  // ─── Playback ────────────────────────────────────────────────────────────────
  function stopPlayback() {
    isPlayingRef.current = false;
    try { sourceRef.current?.stop(); } catch { /* */ }
    sourceRef.current = null;
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setIsPlaying(false);
    setPreviewProgress(0);
    const video = videoRef.current;
    if (video) { video.pause(); video.currentTime = 0; }
    drawCanvas();
  }

  function startPlayback(fromTime: number, hookDur = HOOK_DURATION) {
    const actx = audioCtxRef.current;
    const buf = audioBufferRef.current;

    // Play video even without audio
    if (!actx || !buf) {
      const video = videoRef.current;
      if (video && previewVideoUrl) {
        video.currentTime = 0;
        video.play().catch(() => {});
        setIsPlaying(true);
        setTimeout(() => {
          video.pause();
          video.currentTime = 0;
          setIsPlaying(false);
        }, hookDur * 1000);
      }
      return;
    }
    stopPlayback();
    if (actx.state === "suspended") actx.resume();

    const src = actx.createBufferSource();
    src.buffer = buf;
    src.connect(actx.destination);
    src.start(0, fromTime, hookDur);
    src.onended = () => {
      if (sourceRef.current === src) {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setPreviewProgress(0);
        const v = videoRef.current;
        if (v) { v.pause(); v.currentTime = 0; }
        drawCanvas();
      }
    };
    sourceRef.current = src;
    playCtxStartRef.current = actx.currentTime;
    playOffsetRef.current = fromTime;
    currentTimeRef.current = fromTime;
    isPlayingRef.current = true;
    setIsPlaying(true);

    const video = videoRef.current;
    if (video && previewVideoUrl) { video.currentTime = 0; video.play().catch(() => {}); }

    const tick = () => {
      if (!isPlayingRef.current || !audioCtxRef.current) return;
      const t = Math.min(playOffsetRef.current + (audioCtxRef.current.currentTime - playCtxStartRef.current), buf.duration);
      currentTimeRef.current = t;
      setDisplayTime(t);
      drawCanvas();
      const elapsed = t - fromTime;
      setPreviewProgress(Math.min(1, Math.max(0, elapsed / hookDur)));
      if (t < fromTime + hookDur && isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        isPlayingRef.current = false;
        setIsPlaying(false);
        setPreviewProgress(0);
        drawCanvas();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function togglePlay() {
    if (isPlaying) {
      stopPlayback();
    } else if (selectedRef.current) {
      startPlayback(selectedRef.current.start, selectedRef.current.end - selectedRef.current.start);
    }
  }

  // ─── Drag to position window ─────────────────────────────────────────────────
  function getEffectiveDuration(): number {
    const buf = audioBufferRef.current;
    if (buf) return buf.duration;
    const segs = suggestionsRef.current;
    return segs.length > 0 ? Math.max(...segs.map(h => h.end)) + 30 : 180;
  }

  function canvasTimeFromX(x: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return Math.max(0, (x / canvas.clientWidth) * getEffectiveDuration());
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const effectiveDur = getEffectiveDuration();
    e.currentTarget.setPointerCapture(e.pointerId);

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clickTime = canvasTimeFromX(x);
    const sel = selectedRef.current;

    // Check if clicking inside a suggestion rectangle
    for (const hook of suggestionsRef.current) {
      const rx1 = (hook.start / effectiveDur) * canvas.clientWidth;
      const rx2 = (hook.end / effectiveDur) * canvas.clientWidth;
      if (x >= rx1 && x <= rx2) {
        onSelect(hook);
        startPlayback(hook.start, HOOK_DURATION);
        return;
      }
    }

    if (sel) {
      const selX1 = (sel.start / effectiveDur) * canvas.clientWidth;
      const selX2 = (sel.end / effectiveDur) * canvas.clientWidth;

      // Drag the whole window if clicking inside or near it
      if (x >= selX1 - 12 && x <= selX2 + 12) {
        isDraggingRef.current = true;
        setIsDragging(true);
        dragOffsetTimeRef.current = clickTime - sel.start;
        if (isPlaying) stopPlayback();
        return;
      }
    }

    // Click outside → snap window to click position
    const newStart = Math.max(0, Math.min(effectiveDur - HOOK_DURATION, clickTime - HOOK_DURATION / 2));
    const newHook: HookSuggestion = { start: newStart, end: newStart + HOOK_DURATION, label: "Custom", energy: "chorus" };
    onSelect(newHook);
    currentTimeRef.current = newStart;
    if (isPlaying) stopPlayback();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragOffsetTimeRef.current = clickTime - newStart;
    requestAnimationFrame(drawCanvas);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.clientWidth, e.clientX - rect.left));
    const t = canvasTimeFromX(x);
    const newStart = Math.max(0, Math.min(getEffectiveDuration() - HOOK_DURATION, t - dragOffsetTimeRef.current));
    const sel = selectedRef.current;
    const newHook: HookSuggestion = {
      start: newStart,
      end: newStart + HOOK_DURATION,
      label: sel?.label ?? "Custom",
      energy: sel?.energy ?? "chorus",
    };
    onSelect(newHook);
    currentTimeRef.current = newStart;
    setDisplayTime(newStart);
    requestAnimationFrame(drawCanvas);
  }

  function handlePointerUp() {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
      // Auto-preview after positioning
      if (selectedRef.current) {
        startPlayback(selectedRef.current.start, HOOK_DURATION);
      }
    }
  }

  useEffect(() => {
    return () => {
      stopPlayback();
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Native fallback ──────────────────────────────────────────────────────────
  if (Platform.OS !== "web") {
    return (
      <View style={{ gap: spacing.sm }}>
        {suggestions.map((h, i) => {
          const isSel = selected?.start === h.start;
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
              <Text style={{ fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.textPrimary, flex: 1 }}>
                {fmt(h.start)} — {fmt(h.end)}
              </Text>
              {isSel && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── Web UI ──────────────────────────────────────────────────────────────────
  return (
    <View style={{ gap: spacing.md, alignItems: "center" }}>
      {/* ── Phone mockup ── */}
      <View style={{
        width: "100%",
        maxWidth: 300,
        aspectRatio: 9 / 16,
        borderRadius: 28,
        overflow: "hidden",
        backgroundColor: "#111",
        borderWidth: 2,
        borderColor: isPlaying ? "rgba(255,100,40,0.7)" : colors.border,
        position: "relative",
      } as any}>

        {/* Video / placeholder background */}
        {previewVideoUrl
          ? React.createElement("video", {
              ref: videoRef,
              src: previewVideoUrl,
              loop: false,
              muted: true,
              playsInline: true,
              style: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" },
            })
          : (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0d0d1a", alignItems: "center", justifyContent: "center" } as any}>
              <Ionicons name="musical-note-outline" size={40} color="rgba(255,255,255,0.08)" />
            </View>
          )
        }

        {/* Bottom gradient */}
        {React.createElement("div", {
          style: {
            position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
            background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.92) 100%)",
            pointerEvents: "none",
          },
        })}

        {/* Center play button (when paused) */}
        {!isPlaying && (
          <TouchableOpacity
            onPress={togglePlay}
            disabled={!selected && !audioLoaded}
            activeOpacity={0.8}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 120, alignItems: "center", justifyContent: "center" } as any}
          >
            {(selected || suggestions.length > 0) && (
              <View style={{
                width: 50, height: 50, borderRadius: 25,
                backgroundColor: "rgba(255,255,255,0.15)",
                borderWidth: 2, borderColor: "rgba(255,255,255,0.65)",
                alignItems: "center", justifyContent: "center",
              }}>
                <Ionicons name="play" size={22} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* PREVIEW badge */}
        {isPlaying && (
          <View style={{
            position: "absolute", top: 22, left: 10,
            flexDirection: "row", alignItems: "center", gap: 4,
            backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20,
            paddingHorizontal: 8, paddingVertical: 3,
          } as any}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff4444" }} />
            <Text style={{ fontFamily: fonts.semiBold, fontSize: 10, color: "#fff" }}>PREVIEW</Text>
          </View>
        )}

        {/* ── Bottom overlay: chips + controls + waveform ── */}
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 10, paddingBottom: 10, gap: 8 } as any}>

          {/* Controls row */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Duration pill */}
            <View style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center", justifyContent: "center",
            }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: "#fff" }}>
                {selected ? `${Math.round(selected.end - selected.start)}s` : `${HOOK_DURATION}s`}
              </Text>
            </View>

            {/* Time display */}
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" }}>
              {selected ? `${fmt(selected.start)} → ${fmt(selected.end)}` : duration > 0 ? fmt(displayTime) : "—"}
            </Text>

            {/* Play / stop button */}
            <TouchableOpacity
              onPress={togglePlay}
              disabled={!audioLoaded && !selected}
              activeOpacity={0.8}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: isPlaying ? "#fff" : "rgba(255,255,255,0.18)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name={isPlaying ? "stop" : "play"} size={14} color={isPlaying ? "#000" : "#fff"} />
            </TouchableOpacity>
          </View>

          {/* Waveform canvas */}
          <View style={{ borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.25)" }}>
            {suggestionsLoading && audioLoaded && (
              <View style={{ position: "absolute", top: 4, left: 0, right: 0, alignItems: "center", zIndex: 1 } as any}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <ActivityIndicator color="rgba(255,200,100,0.9)" size="small" />
                  <Text style={{ fontFamily: fonts.regular, fontSize: 9, color: "rgba(255,200,100,0.9)" }}>Analyse…</Text>
                </View>
              </View>
            )}
            {decoding ? (
              <View style={{ height: 64, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator color="rgba(255,255,255,0.5)" size="small" />
              </View>
            ) : (
              <canvas
                ref={canvasRef}
                style={{
                  display: "block",
                  width: "100%",
                  height: 64,
                  cursor: isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  userSelect: "none",
                } as any}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            )}
          </View>
        </View>
      </View>

      {/* Below phone: selected hook info */}
      {selected ? (
        <View style={{
          flexDirection: "row", alignItems: "center", gap: spacing.sm,
          backgroundColor: colors.bgElevated,
          borderRadius: radius.full,
          paddingHorizontal: spacing.md, paddingVertical: 6,
          borderWidth: 1, borderColor: colors.border,
        }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,100,30,1)" }} />
          <Text style={{ fontFamily: fonts.semiBold, fontSize: fontSize.sm, color: colors.textPrimary }}>
            {fmt(selected.start)} — {fmt(selected.end)}
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted }}>
            · {energyLabel(selected.energy)} · {HOOK_DURATION}s
          </Text>
          {audioLoaded && (
            <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted }}>
              · glisse pour repositionner
            </Text>
          )}
        </View>
      ) : audioLoaded ? (
        <Text style={{ fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, textAlign: "center" }}>
          Glisse sur la waveform pour choisir ton moment
        </Text>
      ) : null}
    </View>
  );
}
