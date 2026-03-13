import OpenAI from 'openai';
import { getSignedDownloadUrl } from './storage';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
Your task is to suggest the 3 best 15-second hook segments from a track that would work best as a music ad on Instagram/TikTok.
Apply standard song structure knowledge: intros are rarely catchy in ads, choruses and drops are best, melodic builds create anticipation.
Typical track structure: intro (0-15s), verse (15-45s), pre-chorus/build (45-60s), chorus/drop (60-90s), second verse (90-120s), second chorus (120-150s), bridge (150-165s), outro chorus (165-195s).
Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: `${trackContext}

Suggest 3 hook segments (each 15 seconds long) that would perform best as music ads.
Focus on moments that would hook a listener within the first 2 seconds.

Return JSON:
{
  "hooks": [
    { "start": <seconds>, "end": <seconds>, "label": "<short description>", "energy": "high" | "chorus" | "build" },
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
    return hooks.slice(0, 3).map((h) => ({
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
    { start: 42, end: 57, label: 'Pre-chorus build', energy: 'build' },
    { start: 90, end: 105, label: 'Second chorus drop', energy: 'high' },
  ];
}
