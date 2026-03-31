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

/** Nombre d’ambiances visuelles proposées par suggestMood. */
const MOOD_SUGGESTION_COUNT = 6;

export interface DetectMoodAudioContext {
  durationSec?: number;
  audioEnergyEnvelope?: number[];
}

/** Empreinte stable par morceau — variation des defaults et du prompt sans RNG. */
function moodRequestFingerprint(trackTitle: string, artistName: string): number {
  const s = `${trackTitle.trim()}\n${artistName.trim()}`.toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const VARIATION_LENSES = [
  'Slight lean: deep shadows, film grain, solitary framing, intimacy.',
  'Slight lean: golden-hour warmth, dust in light beams, analog softness.',
  'Slight lean: cool desaturated palette, clean geometry, negative space.',
  'Slight lean: organic textures — fabric, wood grain, resting hands, plants.',
  'Slight lean: wide horizons, still air, open fields or coast.',
  'Slight lean: quiet motion — curtains, steam, distant train, soft traffic blur.',
] as const;

function summarizeEnvelopeForMood(envelope: number[], durationSec: number): string {
  const n = envelope.length;
  if (n < 8 || durationSec <= 0) return '';
  const mean = envelope.reduce((a, b) => a + b, 0) / n;
  const max = Math.max(...envelope);
  const maxIdx = envelope.indexOf(max);
  const peakPct = Math.round((maxIdx / Math.max(1, n - 1)) * 100);
  const dynamicRange = max - mean;
  let vibe =
    'moderate dynamics — balanced energy; mixed interior and outdoor B-roll both work.';
  if (mean < 0.22 && max < 0.38) {
    vibe =
      'very calm waveform — favor sparse, still, ambient visuals (minimal motion, soft interiors, fog, long static shots).';
  } else if (mean < 0.35) {
    vibe = 'soft steady energy — cozy interiors, gentle rain, warm lamps, slow camera.';
  } else if (max > 0.62 && dynamicRange > 0.28) {
    vibe =
      'clear energy peaks — slightly more rhythmic urban glow or subtle motion; stay cinematic, never fitness or party stock.';
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
    env && env.length >= 8 && durationSec
      ? `\n\nAudio analysis (from artist upload, not streaming):\n${summarizeEnvelopeForMood(env, durationSec)}`
      : '';

  const fp = moodRequestFingerprint(trackTitle, artistName);
  const lens = VARIATION_LENSES[fp % VARIATION_LENSES.length];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a creative director for music promo clips (indie, electronic, soul, rock, hip-hop, ambient — not only lo-fi).
Generate exactly ${MOOD_SUGGESTION_COUNT} DISTINCT visual mood options for vertical (9:16) stock footage — cinematic, tasteful, never corporate stock smiles or gym/fitness.

TRACK-SPECIFICITY (critical): Infer genre, era, and emotional tone from the track TITLE and ARTIST name (and audio summary if present). Labels (2–4 words; English, or short evocative French if the track metadata is French) and keyword phrases must feel tailored to THIS track — not generic names that could apply to any chill playlist.

STOCK SEARCH DIVERSITY (critical): All ${MOOD_SUGGESTION_COUNT} moods must return DIFFERENT clips on stock sites. Spread across contrasting worlds (e.g. intimate interior, rain/glass, open nature, quiet urban night, industrial/minimal space, water/coast or desert/road — mix as fits the track). If the song evokes a clear theme, adapt while keeping ${MOOD_SUGGESTION_COUNT} non-overlapping search vectors.

Each mood: exactly 3 English keyword phrases for stock search (editorial, cinematic, specific — not "happy people" or "dancing crowd").

Icons (Ionicons only): ${VALID_ICONS.join(', ')}
Return ONLY valid JSON with top-level key "moods" (array of length ${MOOD_SUGGESTION_COUNT}).`,
        },
        {
          role: 'user',
          content: `Track: "${trackTitle}" by ${artistName}${audioBlock}

Creative lens (subtle, across all moods): ${lens}
Request fingerprint ${fp}: mood keys and labels must plausibly differ from an unrelated track.

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

Generate exactly ${MOOD_SUGGESTION_COUNT} moods.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.92,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return defaultMoodsForTrack(trackTitle, artistName);

    let parsed: { moods?: MoodOption[] };
    try {
      parsed = JSON.parse(content) as { moods?: MoodOption[] };
    } catch {
      console.warn('[detectMood] invalid JSON from model, using per-track defaults');
      return defaultMoodsForTrack(trackTitle, artistName);
    }

    const moods = parsed.moods ?? [];
    if (moods.length === 0) return defaultMoodsForTrack(trackTitle, artistName);

    const normalized = moods.slice(0, MOOD_SUGGESTION_COUNT).map((m) => ({
      key: m.key ?? 'mood',
      label: m.label ?? 'Mood',
      videoKeywords: (m.videoKeywords ?? []).slice(0, 3),
      icon: VALID_ICONS.includes(m.icon) ? m.icon : 'musical-note-outline',
    }));

    const seen = new Set(normalized.map((m) => m.key));
    if (normalized.length < MOOD_SUGGESTION_COUNT) {
      for (const fallback of defaultMoodsForTrack(trackTitle, artistName).moods) {
        if (normalized.length >= MOOD_SUGGESTION_COUNT) break;
        if (seen.has(fallback.key)) continue;
        seen.add(fallback.key);
        normalized.push({ ...fallback });
      }
    }

    return { moods: normalized.slice(0, MOOD_SUGGESTION_COUNT) };
  } catch (e) {
    console.warn('[detectMood] OpenAI error, using per-track defaults', e);
    return defaultMoodsForTrack(trackTitle, artistName);
  }
}

const DEFAULT_MOOD_SETS: MoodSuggestion[] = [
  {
    moods: [
      { key: 'study_rain', label: 'Study & Rain', videoKeywords: ['rain window bokeh cinematic', 'cozy desk lamp night', 'soft focus city rain'], icon: 'water-outline' },
      { key: 'tape_dusk', label: 'Tape & Dusk', videoKeywords: ['golden hour urban calm', 'analog film grain aesthetic', 'sunset rooftop slow'], icon: 'partly-sunny-outline' },
      { key: 'night_neon', label: 'Soft Neon Night', videoKeywords: ['neon reflection wet street moody', 'tokyo night soft blur', 'empty alley cinematic'], icon: 'moon-outline' },
      { key: 'forest_mist', label: 'Forest Mist', videoKeywords: ['foggy forest cinematic', 'misty trees morning', 'nature slow motion calm'], icon: 'leaf-outline' },
      { key: 'desert_road', label: 'Desert Road Haze', videoKeywords: ['empty highway heat shimmer cinematic', 'arizona landscape long road', 'dust devil slow wide shot'], icon: 'car-outline' },
      { key: 'attic_dust', label: 'Attic Sunbeams', videoKeywords: ['dust particles sunbeam attic window', 'old wooden beams soft light', 'stored boxes vintage room still'], icon: 'sunny-outline' },
    ],
  },
  {
    moods: [
      { key: 'coastal_dawn', label: 'Coastal Dawn', videoKeywords: ['empty beach morning mist cinematic', 'soft waves slow motion shore', 'pier silhouette sunrise calm'], icon: 'partly-sunny-outline' },
      { key: 'loft_haze', label: 'Loft Haze', videoKeywords: ['industrial loft window light dust', 'concrete interior plant shadows', 'minimal studio morning haze'], icon: 'business-outline' },
      { key: 'midnight_diner', label: 'Midnight Diner', videoKeywords: ['diner neon reflection wet pavement', 'empty street steam vent night', 'vintage booth lamp moody'], icon: 'moon-outline' },
      { key: 'highland_fog', label: 'Highland Fog', videoKeywords: ['rolling hills fog cinematic wide', 'sheep trail misty pasture', 'stone wall moss overcast'], icon: 'leaf-outline' },
      { key: 'harbor_dusk', label: 'Harbor Still', videoKeywords: ['marina boats still water dusk', 'crane silhouette blue hour port', 'rope pier wooden planks moody'], icon: 'water-outline' },
      { key: 'greenhouse_glass', label: 'Greenhouse Glass', videoKeywords: ['glass greenhouse condensation plants', 'botanical interior soft overcast', 'fern shadows humid air cinematic'], icon: 'leaf-outline' },
    ],
  },
  {
    moods: [
      { key: 'vinyl_corner', label: 'Vinyl Corner', videoKeywords: ['record player close up warm lamp', 'bookshelf bokeh evening interior', 'tea steam window rainy blur'], icon: 'musical-note-outline' },
      { key: 'subway_drift', label: 'Subway Drift', videoKeywords: ['empty subway tunnel motion blur', 'fluorescent corridor lone figure', 'escalator city underground moody'], icon: 'pulse-outline' },
      { key: 'meadow_wind', label: 'Meadow Wind', videoKeywords: ['tall grass wind golden hour field', 'wildflowers slow pan horizon', 'country road sunset dust'], icon: 'sunny-outline' },
      { key: 'rooftop_amber', label: 'Rooftop Amber', videoKeywords: ['rooftop city skyline dusk haze', 'antenna silhouette orange sky', 'helicopter distant lights soft'], icon: 'star-outline' },
      { key: 'bridge_fog', label: 'Bridge in Fog', videoKeywords: ['suspension bridge vanishing fog', 'river below mist morning wide', 'lone pedestrian cable bridge moody'], icon: 'thunderstorm-outline' },
      { key: 'snow_field', label: 'Quiet Snowfield', videoKeywords: ['snow field overcast footsteps alone', 'bare trees winter horizon cinematic', 'frozen lake gray sky still'], icon: 'snow-outline' },
    ],
  },
];

function defaultMoodsForTrack(trackTitle: string, artistName: string): MoodSuggestion {
  const i = moodRequestFingerprint(trackTitle, artistName) % DEFAULT_MOOD_SETS.length;
  return DEFAULT_MOOD_SETS[i]!;
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
