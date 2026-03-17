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

export async function detectMood(
  trackTitle: string,
  artistName: string
): Promise<MoodSuggestion> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a music supervisor and creative director specializing in short-form video ads for Instagram and TikTok.
Your task is to generate 4 unique mood/visual aesthetic options that would work well for a music track.
Each mood should feel distinct and specific to the artist's sound — avoid generic categories.
For each mood, provide Pexels video search keywords that would yield visually stunning, on-brand footage.

Available icons (Ionicons): ${VALID_ICONS.join(', ')}

Return ONLY valid JSON.`,
        },
        {
          role: 'user',
          content: `Track: "${trackTitle}" by ${artistName}

Based on the artist name, track title, and genre/style clues you can infer, generate 4 distinct mood/visual aesthetic options for this track.
Make the labels evocative and specific (e.g. "Dark Neon Hypnosis", "Melancholic City Rain", "Euphoric Highway Drive").

Return JSON:
{
  "moods": [
    {
      "key": "<snake_case_unique_key>",
      "label": "<evocative short label, 2-4 words>",
      "videoKeywords": ["<pexels keyword 1>", "<pexels keyword 2>", "<pexels keyword 3>"],
      "icon": "<one of the available Ionicons listed above>"
    }
  ]
}

Generate exactly 4 moods.`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.75,
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
      { key: 'dreamy', label: 'Dreamy & Ethereal', videoKeywords: ['golden hour bokeh', 'slow motion flowers', 'misty forest'], icon: 'partly-sunny-outline' },
      { key: 'night_drive', label: 'Night Drive', videoKeywords: ['city lights night', 'neon street rain', 'highway timelapse'], icon: 'moon-outline' },
      { key: 'raw_indie', label: 'Raw Indie', videoKeywords: ['film grain aesthetic', 'rooftop sunset', 'vintage camera footage'], icon: 'musical-note-outline' },
      { key: 'urban_energy', label: 'Urban Energy', videoKeywords: ['city street crowd', 'skyscraper timelapse', 'metro rush hour'], icon: 'business-outline' },
    ],
  };
}

export interface HookSuggestion {
  start: number;
  end: number;
  label: string;
  energy: 'high' | 'chorus' | 'build';
}

/**
 * Suggests the 3 catchiest hook segments from a track.
 *
 * Strategy:
 *   1. If a public trackUrl is available, we describe the detection task to GPT-4o
 *      and ask it to reason about likely segment positions based on typical track structures.
 *   2. When a real audio analysis library (e.g. librosa via a Python sidecar) is wired in,
 *      replace the GPT fallback with actual waveform energy data.
 *
 * For the MVP this provides musically plausible suggestions based on known
 * song-structure heuristics (intro ~0-20s, verse ~20-60s, pre-chorus/chorus ~60-100s, etc.)
 * while leaving the integration point clear for a real audio analysis upgrade.
 */
export async function suggestHooks(
  trackS3Key: string | null,
  trackTitle: string,
  artistName: string
): Promise<HookSuggestion[]> {
  // Build a signed URL for context (won't actually be sent to OpenAI in audio form)
  let trackContext = `Track: "${trackTitle}" by ${artistName}`;
  if (trackS3Key) {
    try {
      const url = await getSignedDownloadUrl(trackS3Key, 600);
      trackContext += `\nTrack URL (for reference): ${url}`;
    } catch {
      // Non-fatal: continue without URL
    }
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a music production expert specializing in creating short-form video ads for social media.
Your task is to suggest exactly 2 (no more, no less) 15-second hook segments from a track that would work best as a music ad on Instagram/TikTok.
Apply standard song structure knowledge: intros are rarely catchy in ads, choruses and drops are best, melodic builds create anticipation.
Typical track structure: intro (0-15s), verse (15-45s), pre-chorus/build (45-60s), chorus/drop (60-90s), second verse (90-120s), second chorus (120-150s), bridge (150-165s), outro chorus (165-195s).
Return ONLY valid JSON with exactly 2 hooks.`,
      },
      {
        role: 'user',
        content: `${trackContext}

Suggest 2 hook segments (each 15 seconds long) that would perform best as music ads.
Focus on moments that would hook a listener within the first 2 seconds.

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
    return getDefaultHooks();
  }

  try {
    const parsed = JSON.parse(content) as { hooks: HookSuggestion[] };
    const hooks = parsed.hooks ?? [];
    if (hooks.length === 0) return getDefaultHooks();
    return hooks.slice(0, 2).map((h) => ({
      start: Math.max(0, Math.round(h.start)),
      end: Math.max(15, Math.round(h.end)),
      label: h.label ?? '',
      energy: h.energy ?? 'chorus',
    }));
  } catch {
    return getDefaultHooks();
  }
}

function getDefaultHooks(): HookSuggestion[] {
  return [
    { start: 60, end: 75, label: 'Chorus', energy: 'chorus' },
    { start: 90, end: 105, label: 'Drop', energy: 'high' },
  ];
}
