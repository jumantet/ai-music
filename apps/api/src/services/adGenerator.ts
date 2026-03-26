import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSignedDownloadUrl, uploadBuffer, getPublicUrl } from './storage';

const execFileAsync = promisify(execFile);

export interface AdResult {
  videoS3Key: string;
  videoUrl: string;
}

export interface EditorSettings {
  filterPreset?: string;
  brightness?: number;   // 50–150, default 100
  contrast?: number;     // 50–150, default 100
  saturation?: number;   // 0–200, default 100
  grain?: number;        // 0–100, default 0
  /** Aperçu web uniquement (CSS) — ignoré par ffmpeg pour l’instant */
  motionPreset?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textBgColor?: string;
  textBgOpacity?: number;
  textPosition?: string;
}

const PRESET_FFMPEG: Record<string, string> = {
  none:     '',
  prisme:   'eq=saturation=2.2:contrast=1.25,hue=h=8',
  super8:   'colorchannelmixer=rr=1.2:gg=1.0:bb=0.75,eq=saturation=1.25:contrast=0.85',
  k7:       'eq=saturation=0.65:contrast=1.3,colorchannelmixer=rr=0.95:gg=1.05:bb=0.9,hue=h=168',
  neon:     'eq=brightness=-0.35:contrast=1.6:saturation=2.8,hue=h=250',
  dore:     'colorchannelmixer=rr=1.25:gg=1.05:bb=0.7,eq=saturation=1.9:contrast=1.05',
  lofi:     'colorchannelmixer=rr=1.02:gg=1.0:bb=0.97,eq=saturation=0.45:contrast=0.82',
  cobalt:   'eq=saturation=0.75:contrast=1.2,colorchannelmixer=rr=0.82:gg=0.9:bb=1.25,hue=h=202',
  duotone:  'eq=saturation=3.5:contrast=1.35,hue=h=285',
  matrix:   'eq=saturation=1.5:contrast=1.3,colorchannelmixer=rr=0.8:gg=1.3:bb=0.8,hue=h=100',
  velours:  'colorchannelmixer=rr=1.1:gg=0.85:bb=1.0,eq=saturation=1.3:contrast=1.45',
};

export async function generateAdVariants(params: {
  campaignId: string;
  trackS3Key: string | null;
  hookStart: number;
  hookEnd: number;
  videoUrl: string | null;
  videoS3Key: string | null;
  artistName: string;
  trackTitle: string;
  editorSettings?: EditorSettings;
}): Promise<AdResult[]> {
  const {
    campaignId,
    trackS3Key,
    hookStart,
    hookEnd,
    videoUrl,
    videoS3Key,
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

    // Download video: custom S3 upload takes priority over Pexels URL
    let videoPath: string | null = null;
    if (videoS3Key) {
      try {
        const signedUrl = await getSignedDownloadUrl(videoS3Key, 600);
        const res = await fetch(signedUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = path.join(tmpDir, 'video.mp4');
          fs.writeFileSync(videoPath, buf);
        }
      } catch { /* fall through */ }
    }
    if (!videoPath && videoUrl) {
      try {
        const res = await fetch(videoUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = path.join(tmpDir, 'video.mp4');
          fs.writeFileSync(videoPath, buf);
        }
      } catch { /* fall through */ }
    }

    let outputKey = '';
    let outputUrl = '';

    const renderOpts = {
      hookStart,
      hookDuration,
      artistName,
      trackTitle,
      editorSettings,
    };
    const outputPath = path.join(tmpDir, 'ad.mp4');

    // 1) Vidéo + morceau → MP4 final sur R2 (comportement nominal)
    if (videoPath && audioPath) {
      try {
        await runFfmpeg(videoPath, audioPath, outputPath, renderOpts);
        const outputBuf = fs.readFileSync(outputPath);
        outputKey = `campaigns/${campaignId}/ad_${Date.now()}.mp4`;
        outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
      } catch (e) {
        console.error('[adGenerator] ffmpeg/upload (avec audio) a échoué:', e);
      }
    }

    // 2) Vidéo seule → même rendu visuel + audio silencieux, toujours uploadé sur R2
    if (!outputUrl && videoPath) {
      try {
        await runFfmpegWithSilentAudio(videoPath, outputPath, renderOpts);
        const outputBuf = fs.readFileSync(outputPath);
        outputKey = `campaigns/${campaignId}/ad_${Date.now()}.mp4`;
        outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
      } catch (e) {
        console.error('[adGenerator] ffmpeg/upload (sans morceau / silence) a échoué:', e);
      }
    }

    // Repli UI : URL source si le rendu n’a pas pu être produit sur R2
    const previewUrl =
      outputUrl ||
      (videoUrl ?? '') ||
      (videoS3Key ? getPublicUrl(videoS3Key) : '');
    return [{ videoS3Key: outputKey, videoUrl: previewUrl }];
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
  } = editorSettings;

  const filters: string[] = [];

  // 1. Scale & crop to 9:16, loop to hookDuration
  filters.push(
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,loop=loop=-1:size=500,trim=duration=${hookDuration},setpts=PTS-STARTPTS[base]`
  );

  // 2. Preset color grading
  const presetFilter = PRESET_FFMPEG[filterPreset] ?? '';

  // 3. Manual eq adjustments
  const eqBrightness = ((brightness - 100) / 100).toFixed(3);
  const eqContrast   = (contrast / 100).toFixed(3);
  const eqSaturation = (saturation / 100).toFixed(3);
  const hasEq = brightness !== 100 || contrast !== 100 || saturation !== 100;
  const eqFilter = hasEq
    ? `eq=brightness=${eqBrightness}:contrast=${eqContrast}:saturation=${eqSaturation}`
    : '';

  const colorChain = [presetFilter, eqFilter].filter(Boolean).join(',');
  filters.push(colorChain ? `[base]${colorChain}[colored]` : `[base]null[colored]`);

  // 4. Grain
  if (grain > 0) {
    filters.push(`[colored]noise=alls=${Math.round(grain * 0.4)}:allf=t+u[grained]`);
  } else {
    filters.push(`[colored]null[grained]`);
  }

  // 5. Pas de fondu (pipeline inchangé : label [faded] pour la suite)
  filters.push(`[grained]null[faded]`);

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

/** Même graphe vidéo (filtres, texte) ; piste audio = silence (si pas de morceau sur la campagne). */
async function runFfmpegWithSilentAudio(
  videoPath: string,
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
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t', hookDuration.toString(),
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
  return hex.replace('#', '').toUpperCase();
}

function escapeDrawtext(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
}
