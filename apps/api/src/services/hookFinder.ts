import OpenAI from 'openai';
import { getSignedDownloadUrl } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface MoodOption {
  key: string;
  label: string;
  videoKeywords: string[];
  icon: string;
}

export interface MoodSuggestion {
  moods: MoodOption[];
}

const VALID_ICONS = [
  'moon-outline', 'sunny-outline', 'partly-sunny-outline', 'musical-note-outline',
  'color-palette-outline', 'camera-outline', 'business-outline', 'car-outline',
  'flame-outline', 'heart-outline', 'star-outline', 'thunderstorm-outline',
  'water-outline', 'leaf-outline', 'snow-outline', 'pulse-outline',
];

export interface DetectMoodAudioContext {
  durationSec?: number;
  audioEnergyEnvelope?: number[];
}

function summarizeEnvelopeForMood(envelope: number[], durationSec: number): string {
  const n = envelope.length;
  if (n < 8 || durationSec <= 0) return '';
  const mean = envelope.reduce((a, b) => a + b, 0) / n;
  const max = Math.max(...envelope);
  const maxIdx = envelope.indexOf(max);
  const peakPct = Math.round((maxIdx / Math.max(1, n - 1)) * 100);
  const dynamicRange = max - mean;
  let vibe =
    'moderate dynamics — balanced lo-fi energy suitable for mixed interior and outdoor B-roll.';
  if (mean < 0.22 && max < 0.38) {
    vibe =
      'very calm waveform — favor sparse, still, ambient visuals (minimal motion, soft interiors, fog, long static shots).';
  } else if (mean < 0.35) {
    vibe = 'soft steady energy — cozy interiors, gentle rain, warm lamps, slow camera.';
  } else if (max > 0.62 && dynamicRange > 0.28) {
    vibe =
      'clear energy peaks — you can suggest slightly more rhythmic urban glow or subtle motion, still cinematic never fitness.';
  }
  return `Client RMS envelope (${n} bins, ~${Math.round(durationSec)}s track): avg≈${mean.toFixed(2)}, peak≈${max.toFixed(2)} around ~${peakPct}% of duration. ${vibe}`;
}

export async function detectMood(
  trackTitle: string,
  artistName: string,
  audio?: DetectMoodAudioContext
): Promise<MoodSuggestion> {
  const env = audio?.audioEnergyEnvelope?.filter((x) => typeof x === 'number' && !Number.isNaN(x));
  const durationSec =
    audio?.durationSec && audio.durationSec > 0 ? audio.durationSec : undefined;
  const audioBlock =
    env && env.length >= 16 && durationSec
      ? `\n\nAudio analysis (from artist upload, not streaming):\n${summarizeEnvelopeForMood(env, durationSec)}`
      : '';

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative director for indie lo-fi music videos (study beats, chillhop, tape aesthetic, ambient bedroom production).
Generate 4 distinct visual mood options for vertical music clips — cinematic, soft, intentional — never corporate or fitness stock.

DIVERSITY RULE (critical): The 4 moods must search DIFFERENTLY on stock video sites. Assign each mood a different primary setting:
(1) intimate interior — desk, vinyl, warm lamp, bookshelf, bedroom soft light
(2) rain / glass / window — bokeh city, droplets, cozy inside-looking-out (not all 4 moods may use rain)
(3) nature / fog / forest / field / mist — wide calm outdoor
(4) soft urban night — empty streets, subtle neon reflection, calm alley, slow traffic blur — never nightclub crowd

Each mood needs exactly 3 Pexels-oriented keyword phrases in English (editorial, cinematic). Avoid repeating the same root theme across all four (e.g. not four "rain window" variants). Keywords should be specific enough to return varied footage.

Icons (Ionicons only): ${VALID_ICONS.join(', ')}
Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Track: "${trackTitle}" by ${artistName}${audioBlock}

Generate 4 lo-fi indie visual moods. Labels evocative (short). Keywords in English, editorial / cinematic, not generic "happy people".

Return JSON:
{
  "moods": [
    {
      "key": "<snake_case_unique_key>",
      "label": "<2-4 words>",
      "videoKeywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>"],
      "icon": "<one of the listed Ionicons>"
    }
  ]
}

Generate exactly 4 moods.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.78,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return getDefaultMoods();

    const parsed = JSON.parse(content) as { moods: MoodOption[] };
    const moods = parsed.moods ?? [];
    if (moods.length === 0) return getDefaultMoods();

    return {
      moods: moods.slice(0, 4).map((m) => ({
        key: m.key ?? 'mood',
        label: m.label ?? 'Mood',
        videoKeywords: (m.videoKeywords ?? []).slice(0, 3),
        icon: VALID_ICONS.includes(m.icon) ? m.icon : 'musical-note-outline',
      })),
    };
  } catch {
    return getDefaultMoods();
  }
}

function getDefaultMoods(): MoodSuggestion {
  return {
    moods: [
      { key: 'study_rain', label: 'Study & Rain', videoKeywords: ['rain window bokeh cinematic', 'cozy desk lamp night', 'soft focus city rain'], icon: 'water-outline' },
      { key: 'tape_dusk', label: 'Tape & Dusk', videoKeywords: ['golden hour urban calm', 'analog film grain aesthetic', 'sunset rooftop slow'], icon: 'partly-sunny-outline' },
      { key: 'night_neon', label: 'Soft Neon Night', videoKeywords: ['neon reflection wet street moody', 'tokyo night soft blur', 'empty alley cinematic'], icon: 'moon-outline' },
      { key: 'forest_mist', label: 'Forest Mist', videoKeywords: ['foggy forest cinematic', 'misty trees morning', 'nature slow motion calm'], icon: 'leaf-outline' },
    ],
  };
}

export interface HookSuggestion {
  start: number;
  end: number;
  label: string;
  energy: 'high' | 'chorus' | 'build';
}

export interface SuggestHooksOptions {
  /** Durée totale du fichier audio en secondes (pour caler les segments). */
  durationSec?: number;
  /** Échantillons RMS 0–1 depuis le navigateur (Web Audio). */
  audioEnergyEnvelope?: number[];
}

function segmentsFromEnvelope(
  envelope: number[],
  durationSec: number,
  windowSec: number
): HookSuggestion[] {
  const n = envelope.length;
  if (n < 8 || durationSec <= 0) return [];
  const step = durationSec / n;
  const peaks: { i: number; v: number }[] = [];
  for (let i = 2; i < n - 2; i++) {
    const v = envelope[i] ?? 0;
    if (
      v > (envelope[i - 1] ?? 0) &&
      v > (envelope[i + 1] ?? 0) &&
      v > (envelope[i - 2] ?? 0) &&
      v > (envelope[i + 2] ?? 0)
    ) {
      peaks.push({ i, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);
  const minSep = Math.max(4, Math.floor(n * 0.06));
  const chosen: number[] = [];
  const hooks: HookSuggestion[] = [];
  for (const p of peaks) {
    if (hooks.length >= 2) break;
    if (chosen.some((c) => Math.abs(p.i - c) < minSep)) continue;
    chosen.push(p.i);
    const center = (p.i + 0.5) * step;
    const half = windowSec / 2;
    let start = Math.max(0, Math.floor(center - half));
    let end = Math.min(Math.ceil(durationSec), Math.ceil(center + half));
    if (end - start < 8) {
      end = Math.min(Math.ceil(durationSec), start + Math.min(30, Math.ceil(durationSec) - start));
    }
    hooks.push({
      start,
      end: Math.max(end, start + 5),
      label: p.v > 0.55 ? 'Pic d’énergie' : 'Passage aéré',
      energy: p.v > 0.55 ? 'high' : 'chorus',
    });
  }
  return hooks;
}

export async function suggestHooks(
  trackS3Key: string | null,
  trackTitle: string,
  artistName: string,
  options?: SuggestHooksOptions
): Promise<HookSuggestion[]> {
  const durationSec = options?.durationSec && options.durationSec > 0 ? options.durationSec : undefined;
  const env = options?.audioEnergyEnvelope?.filter((x) => typeof x === 'number' && !Number.isNaN(x));

  if (env && env.length >= 16 && durationSec) {
    const win = Math.min(45, Math.max(12, durationSec * 0.25));
    const fromEnv = segmentsFromEnvelope(env, durationSec, win);
    if (fromEnv.length >= 2) return fromEnv.slice(0, 2);
  }

  let trackContext = `Track: "${trackTitle}" by ${artistName}`;
  if (durationSec) {
    trackContext += `\nKnown duration: ${Math.round(durationSec)} seconds. Suggest segments fully inside [0, ${Math.floor(durationSec)}].`;
  }
  if (trackS3Key) {
    try {
      const url = await getSignedDownloadUrl(trackS3Key, 600);
      trackContext += `\nTrack URL (for reference): ${url}`;
    } catch {
      /* */
    }
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You suggest 2 time ranges for an indie lo-fi music video clip (vertical, cinematic).
Avoid calling them "ads" or "hooks for conversion". Use musical language: loop, section, vibe, chorus, drop, bridge.
Segments should be 8–60 seconds; prefer the most engaging parts. If duration is known, never exceed it.
Return ONLY valid JSON with exactly 2 items.`,
      },
      {
        role: 'user',
        content: `${trackContext}

Suggest 2 segments (start/end in seconds) that work best as lo-fi visual clips.

Return JSON:
{
  "hooks": [
    { "start": <seconds>, "end": <seconds>, "label": "<short description>", "energy": "high" | "chorus" | "build" },
    { "start": <seconds>, "end": <seconds>, "label": "<short description>", "energy": "high" | "chorus" | "build" }
  ]
}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.6,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return getDefaultHooks(durationSec);
  }

  try {
    const parsed = JSON.parse(content) as { hooks: HookSuggestion[] };
    const hooks = parsed.hooks ?? [];
    if (hooks.length === 0) return getDefaultHooks(durationSec);
    const maxEnd = durationSec ?? 600;
    return hooks.slice(0, 2).map((h) => {
      let start = Math.max(0, Math.round(h.start));
      let end = Math.max(start + 5, Math.round(h.end));
      if (durationSec) {
        end = Math.min(end, Math.floor(durationSec));
        start = Math.min(start, Math.max(0, end - 5));
      } else {
        end = Math.min(end, start + 120);
      }
      if (end <= start) end = Math.min(maxEnd, start + 15);
      return {
        start,
        end,
        label: h.label ?? '',
        energy: h.energy ?? 'chorus',
      };
    });
  } catch {
    return getDefaultHooks(durationSec);
  }
}

function getDefaultHooks(durationSec?: number): HookSuggestion[] {
  const d = durationSec && durationSec > 30 ? durationSec : 180;
  const a = Math.min(45, Math.floor(d * 0.25));
  const b = Math.min(Math.floor(d * 0.55), Math.floor(d) - 20);
  return [
    { start: a, end: Math.min(a + 25, Math.floor(d)), label: 'Section A', energy: 'chorus' },
    { start: Math.max(b, a + 15), end: Math.min(b + 25, Math.floor(d)), label: 'Section B', energy: 'build' },
  ];
}
