import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSignedDownloadUrl, uploadBuffer } from './storage';

const execFileAsync = promisify(execFile);

export interface AdVariant {
  visualStyle: string;
  textOverlay: string;
  videoS3Key: string;
  videoUrl: string;
}

export interface EditorSettings {
  filterPreset?: string;
  brightness?: number;   // 50–150, default 100
  contrast?: number;     // 50–150, default 100
  saturation?: number;   // 0–200, default 100
  grain?: number;        // 0–100, default 0
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textBgColor?: string;
  textBgOpacity?: number;
  textPosition?: string;
  fadeIn?: number;
  fadeOut?: number;
}

// ffmpeg filter chains per preset (before manual adjustments)
const PRESET_FFMPEG: Record<string, string> = {
  none:       '',
  california: 'colorchannelmixer=rr=1.1:gg=1.0:bb=0.85',
  tokyo:      'colorchannelmixer=rr=0.85:gg=0.9:bb=1.15,hue=h=200',
  havana:     'colorchannelmixer=rr=1.15:gg=0.95:bb=0.8',
  paris:      'eq=saturation=0.65:contrast=0.9,colorchannelmixer=rr=1.02:gg=1.0:bb=1.04',
  berlin:     'eq=saturation=0.4:contrast=1.3,colorchannelmixer=rr=0.9:gg=1.0:bb=1.1',
  lagos:      'eq=saturation=2.0',
  seoul:      'eq=saturation=0.85:contrast=1.05',
  midnight:   'eq=saturation=0.8,colorchannelmixer=rr=0.8:gg=0.85:bb=1.2',
  desert:     'colorchannelmixer=rr=1.1:gg=1.0:bb=0.8',
  cinema:     'eq=saturation=0:contrast=1.25',
  polaroid:   'eq=saturation=0.75:contrast=0.92,colorchannelmixer=rr=1.0:gg=1.02:bb=0.95',
  analog:     'colorchannelmixer=rr=1.05:gg=0.95:bb=0.9',
  dream:      'colorchannelmixer=rr=0.9:gg=0.85:bb=1.15',
};

const MOOD_LABEL: Record<string, string> = {
  dreamy: 'Dreamy',
  night_drive: 'Night Drive',
  indie: 'Indie',
  psychedelic: 'Psychedelic',
  vintage: 'Vintage',
  urban: 'Urban',
};

const PRESET_LABEL: Record<string, string> = {
  none: 'Original',
  california: 'California',
  tokyo: 'Tokyo',
  havana: 'Havana',
  paris: 'Paris',
  berlin: 'Berlin',
  lagos: 'Lagos',
  seoul: 'Seoul',
  midnight: 'Midnight',
  desert: 'Desert',
  cinema: 'Cinéma',
  polaroid: 'Polaroid',
  analog: 'Analog',
  dream: 'Dream',
};

/**
 * Generates a single video ad for a campaign, applying editor settings (filter,
 * text overlay with custom font/color/position, and fade in/out transitions).
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
  editorSettings?: EditorSettings;
}): Promise<AdVariant[]> {
  const {
    campaignId,
    trackS3Key,
    hookStart,
    hookEnd,
    mood,
    videoUrls,
    customVideoS3Key,
    artistName,
    trackTitle,
    editorSettings = {},
  } = params;

  const hookDuration = Math.min(hookEnd - hookStart, 15);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ad-gen-${campaignId}-`));

  try {
    // Download audio
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
      } catch { /* no audio */ }
    }

    // Download video (custom upload takes priority)
    let videoPath: string | null = null;
    if (customVideoS3Key) {
      try {
        const signedUrl = await getSignedDownloadUrl(customVideoS3Key, 600);
        const res = await fetch(signedUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = path.join(tmpDir, 'video.mp4');
          fs.writeFileSync(videoPath, buf);
        }
      } catch { /* fall through */ }
    }

    if (!videoPath && videoUrls[0]) {
      try {
        const res = await fetch(videoUrls[0]);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = path.join(tmpDir, 'video.mp4');
          fs.writeFileSync(videoPath, buf);
        }
      } catch { /* fall through */ }
    }

    let outputKey: string | null = null;
    let outputUrl: string | null = null;

    if (videoPath && audioPath) {
      try {
        const outputPath = path.join(tmpDir, 'ad.mp4');
        await runFfmpeg(videoPath, audioPath, outputPath, {
          hookStart,
          hookDuration,
          artistName,
          trackTitle,
          editorSettings,
        });
        const outputBuf = fs.readFileSync(outputPath);
        outputKey = `campaigns/${campaignId}/ad_${Date.now()}.mp4`;
        outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
      } catch { /* ffmpeg failed */ }
    }

    const presetName = editorSettings.filterPreset
      ? (PRESET_LABEL[editorSettings.filterPreset] ?? editorSettings.filterPreset)
      : null;
    const visualStyle = presetName && presetName !== 'Original'
      ? presetName
      : (MOOD_LABEL[mood] ?? mood);
    const textOverlay = editorSettings.text || 'Out now';

    return [{
      visualStyle,
      textOverlay,
      videoS3Key: outputKey ?? '',
      videoUrl: outputUrl ?? '',
    }];
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildFfmpegFilterComplex(opts: {
  hookDuration: number;
  artistName: string;
  trackTitle: string;
  editorSettings: EditorSettings;
}): string {
  const { hookDuration, artistName, trackTitle, editorSettings } = opts;
  const {
    filterPreset = 'none',
    brightness = 100,
    contrast = 100,
    saturation = 100,
    grain = 0,
    text = '',
    fontFamily = 'sans',
    fontSize = 42,
    fontColor = '#FFFFFF',
    textBgColor = '#000000',
    textBgOpacity = 0.5,
    textPosition = 'bottom',
    fadeIn = 0.5,
    fadeOut = 0.5,
  } = editorSettings;

  const filters: string[] = [];

  // 1. Scale & crop to 9:16, loop to hookDuration
  filters.push(
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,loop=loop=-1:size=500,trim=duration=${hookDuration},setpts=PTS-STARTPTS[base]`
  );

  // 2. Preset color grading
  const presetFilter = PRESET_FFMPEG[filterPreset] ?? '';

  // 3. Manual eq adjustments (convert 50–150/0–200 range → ffmpeg values)
  const eqBrightness = ((brightness - 100) / 100).toFixed(3);  // -0.5 to +0.5
  const eqContrast   = (contrast / 100).toFixed(3);             // 0.5 to 1.5
  const eqSaturation = (saturation / 100).toFixed(3);           // 0.0 to 2.0
  const hasEq = brightness !== 100 || contrast !== 100 || saturation !== 100;
  const eqFilter = hasEq
    ? `eq=brightness=${eqBrightness}:contrast=${eqContrast}:saturation=${eqSaturation}`
    : '';

  const colorChain = [presetFilter, eqFilter].filter(Boolean).join(',');
  if (colorChain) {
    filters.push(`[base]${colorChain}[colored]`);
  } else {
    filters.push(`[base]null[colored]`);
  }

  // 4. Grain
  if (grain > 0) {
    const noiseStr = Math.round(grain * 0.4); // 0-40 noise strength
    filters.push(`[colored]noise=alls=${noiseStr}:allf=t+u[grained]`);
  } else {
    filters.push(`[colored]null[grained]`);
  }

  // 5. FadeIn / FadeOut
  const fadeFilters: string[] = [];
  if (fadeIn > 0) fadeFilters.push(`fade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) fadeFilters.push(`fade=t=out:st=${Math.max(0, hookDuration - fadeOut)}:d=${fadeOut}`);
  if (fadeFilters.length > 0) {
    filters.push(`[grained]${fadeFilters.join(',')}[faded]`);
  } else {
    filters.push(`[grained]null[faded]`);
  }

  // 6. Text overlay
  const displayText = text
    ? `${escapeDrawtext(text)}\\n${escapeDrawtext(artistName)} - ${escapeDrawtext(trackTitle)}`
    : `${escapeDrawtext(artistName)} - ${escapeDrawtext(trackTitle)}`;

  const ffFontColor = hexToFfmpegColor(fontColor);
  const ffBgColor = textBgColor === 'transparent' || !textBgColor
    ? '00000000'
    : `${hexToFfmpegColor(textBgColor)}@${textBgOpacity.toFixed(2)}`;

  const yPos =
    textPosition === 'top'    ? '80' :
    textPosition === 'center' ? '(h-text_h)/2' :
    'h-150';

  const fontstyle = fontFamily === 'bold' ? 'Bold' : 'Normal';

  filters.push(
    `[faded]drawtext=text='${displayText}':fontsize=${fontSize}:fontcolor=${ffFontColor}:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=${ffBgColor}:boxborderw=12:fontstyle=${fontstyle}[vout]`
  );

  return filters.join(';');
}

async function runFfmpeg(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  opts: {
    hookStart: number;
    hookDuration: number;
    artistName: string;
    trackTitle: string;
    editorSettings: EditorSettings;
  }
): Promise<void> {
  const { hookStart, hookDuration, artistName, trackTitle, editorSettings } = opts;

  const filterComplex = buildFfmpegFilterComplex({
    hookDuration,
    artistName,
    trackTitle,
    editorSettings,
  });

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

function hexToFfmpegColor(hex: string): string {
  // ffmpeg expects RRGGBB (no #)
  return hex.replace('#', '').toUpperCase();
}

function escapeDrawtext(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
}
