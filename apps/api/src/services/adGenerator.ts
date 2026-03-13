import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSignedDownloadUrl, uploadBuffer, getPublicUrl } from './storage';

const execFileAsync = promisify(execFile);

export interface AdVariant {
  visualStyle: string;
  textOverlay: string;
  videoS3Key: string;
  videoUrl: string;
}

const MOOD_STYLES: Record<string, Array<{ style: string; text: string }>> = {
  dreamy: [
    { style: 'Dreamy Blur', text: 'Out now' },
    { style: 'Pastel Haze', text: 'Listen now' },
    { style: 'Soft Focus', text: 'Stream now' },
    { style: 'Golden Hour', text: 'New track' },
  ],
  night_drive: [
    { style: 'Night Drive', text: 'Out now' },
    { style: 'Neon City', text: 'Listen now' },
    { style: 'Dark Highway', text: 'Stream now' },
    { style: 'City Lights', text: 'New track' },
  ],
  indie: [
    { style: 'Indie Aesthetic', text: 'Out now' },
    { style: 'Grain Film', text: 'Listen now' },
    { style: 'Lo-Fi Warm', text: 'Stream now' },
    { style: 'Muted Tones', text: 'New track' },
  ],
  psychedelic: [
    { style: 'Psychedelic Loop', text: 'Out now' },
    { style: 'Color Prism', text: 'Listen now' },
    { style: 'Abstract Motion', text: 'Stream now' },
    { style: 'Kaleidoscope', text: 'New track' },
  ],
  vintage: [
    { style: 'Vintage Footage', text: 'Out now' },
    { style: 'Super 8 Film', text: 'Listen now' },
    { style: 'Sepia Tone', text: 'Stream now' },
    { style: 'Analog Grain', text: 'New track' },
  ],
  urban: [
    { style: 'Urban Street', text: 'Out now' },
    { style: 'City Rooftop', text: 'Listen now' },
    { style: 'Concrete Jungle', text: 'Stream now' },
    { style: 'Metro Motion', text: 'New track' },
  ],
};

const DEFAULT_STYLES = [
  { style: 'Night Drive', text: 'Out now' },
  { style: 'Abstract Motion', text: 'Listen now' },
  { style: 'Vintage Footage', text: 'Stream now' },
  { style: 'City Lights', text: 'New track' },
];

/**
 * Generates 4 video ad variations for a campaign.
 *
 * Each ad is a 9:16 portrait MP4 (~15s) consisting of:
 *   - A looped video clip (from Pexels, already downloaded to a temp file)
 *   - The campaign hook trimmed from the track
 *   - A text overlay burned in via ffmpeg drawtext
 *
 * If ffmpeg is not available or any step fails, we gracefully return stub
 * metadata so the rest of the flow is not blocked (the videoUrl will be null).
 */
export async function generateAdVariants(params: {
  campaignId: string;
  trackS3Key: string | null;
  hookStart: number;
  hookEnd: number;
  mood: string;
  videoUrls: string[];
  customVideoS3Key?: string | null;
  artistName: string;
  trackTitle: string;
}): Promise<AdVariant[]> {
  const { campaignId, trackS3Key, hookStart, hookEnd, mood, videoUrls, customVideoS3Key, artistName, trackTitle } = params;
  const styles = MOOD_STYLES[mood] ?? DEFAULT_STYLES;
  const hookDuration = Math.min(hookEnd - hookStart, 15);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ad-gen-${campaignId}-`));

  try {
    // Download track hook audio if available
    let audioPath: string | null = null;
    if (trackS3Key) {
      try {
        const audioUrl = await getSignedDownloadUrl(trackS3Key, 300);
        const res = await fetch(audioUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          audioPath = path.join(tmpDir, 'track.mp3');
          fs.writeFileSync(audioPath, buf);
        }
      } catch {
        // Continue without audio
      }
    }

    // If a custom video was uploaded, download it once and reuse across all 4 ads
    let sharedVideoPath: string | null = null;
    if (customVideoS3Key) {
      try {
        const customVideoSignedUrl = await getSignedDownloadUrl(customVideoS3Key, 600);
        const res = await fetch(customVideoSignedUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          sharedVideoPath = path.join(tmpDir, 'custom_video.mp4');
          fs.writeFileSync(sharedVideoPath, buf);
        }
      } catch {
        // Non-fatal: fall through to Pexels URLs
      }
    }

    const results: AdVariant[] = [];

    for (let i = 0; i < 4; i++) {
      const styleInfo = styles[i] ?? styles[0];
      // Use the custom video for every variation, or rotate through Pexels clips
      const pexelsUrl = sharedVideoPath ? null : (videoUrls[i % videoUrls.length] ?? null);

      let outputKey: string | null = null;
      let outputUrl: string | null = null;

      if ((sharedVideoPath || pexelsUrl) && audioPath) {
        try {
          let videoPath: string | null = sharedVideoPath;

          if (!videoPath && pexelsUrl) {
            // Download Pexels clip
            const videoRes = await fetch(pexelsUrl);
            if (videoRes.ok) {
              const videoBuf = Buffer.from(await videoRes.arrayBuffer());
              videoPath = path.join(tmpDir, `clip_${i}.mp4`);
              fs.writeFileSync(videoPath, videoBuf);
            }
          }

          if (videoPath) {
            const outputPath = path.join(tmpDir, `ad_${i}.mp4`);
            const text = `${styleInfo.text}\\n${artistName} - ${trackTitle}`;

            await runFfmpeg(videoPath, audioPath, outputPath, {
              hookStart,
              hookDuration,
              text,
            });

            const outputBuf = fs.readFileSync(outputPath);
            outputKey = `campaigns/${campaignId}/ad_${i}_${Date.now()}.mp4`;
            outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
          }
        } catch {
          // Ffmpeg step failed — fall through to stub
        }
      }

      results.push({
        visualStyle: styleInfo.style,
        textOverlay: styleInfo.text,
        videoS3Key: outputKey ?? '',
        videoUrl: outputUrl ?? '',
      });
    }

    return results;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function runFfmpeg(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  opts: { hookStart: number; hookDuration: number; text: string }
): Promise<void> {
  const { hookStart, hookDuration, text } = opts;

  // Filter complex:
  //   1. Scale & crop video to 1080x1920 (9:16), loop it to hookDuration
  //   2. Trim audio to hook segment
  //   3. Burn text overlay at bottom
  const filterComplex = [
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,loop=loop=-1:size=500,trim=duration=${hookDuration}[v]`,
    `[v]drawtext=text='${text.replace(/'/g, "\\'")}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-120:box=1:boxcolor=black@0.5:boxborderw=10[vout]`,
  ].join(';');

  await execFileAsync('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-ss', hookStart.toString(),
    '-t', hookDuration.toString(),
    '-i', audioPath,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-map', '1:a',
    '-c:v', 'libx264',
    '-c:a', 'aac',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ]);
}
