import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getSignedDownloadUrl, uploadBuffer, getPublicUrl } from './storage';

const execFileAsync = promisify(execFile);

export const MIN_EXPORT_SEC = 1;
export const MAX_EXPORT_SEC = 180;

export interface AdResult {
  videoS3Key: string;
  videoUrl: string;
}

export interface EditorSettings {
  filterPreset?: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  grain?: number;
  motionPreset?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  textBgColor?: string;
  textBgOpacity?: number;
  textPosition?: string;
  endCardEnabled?: boolean;
  endCardDurationSec?: number;
  endCardTitle?: string;
  endCardShowTitle?: boolean;
  endCardCoverUrl?: string;
}

const PRESET_FFMPEG: Record<string, string> = {
  none: '',
  prisme: 'eq=saturation=2.2:contrast=1.25,hue=h=8',
  super8: 'colorchannelmixer=rr=1.2:gg=1.0:bb=0.75,eq=saturation=1.25:contrast=0.85',
  k7: 'eq=saturation=0.65:contrast=1.3,colorchannelmixer=rr=0.95:gg=1.05:bb=0.9,hue=h=168',
  neon: 'eq=brightness=-0.35:contrast=1.6:saturation=2.8,hue=h=250',
  dore: 'colorchannelmixer=rr=1.25:gg=1.05:bb=0.7,eq=saturation=1.9:contrast=1.05',
  lofi: 'colorchannelmixer=rr=1.02:gg=1.0:bb=0.97,eq=saturation=0.45:contrast=0.82',
  cobalt: 'eq=saturation=0.75:contrast=1.2,colorchannelmixer=rr=0.82:gg=0.9:bb=1.25,hue=h=202',
  duotone: 'eq=saturation=3.5:contrast=1.35,hue=h=285',
  matrix: 'eq=saturation=1.5:contrast=1.3,colorchannelmixer=rr=0.8:gg=1.3:bb=0.8,hue=h=100',
  velours: 'colorchannelmixer=rr=1.1:gg=0.85:bb=1.0,eq=saturation=1.3:contrast=1.45',
  // Curated lo-fi (preview keys alignés)
  tape_warmth: 'colorchannelmixer=rr=1.08:gg=1.02:bb=0.94,eq=saturation=0.52:contrast=0.88:brightness=0.02',
  dusk_room: 'eq=saturation=0.48:contrast=0.9,colorchannelmixer=rr=1.12:gg=1.0:bb=0.88,hue=h=12',
  rain_glass: 'eq=saturation=0.42:contrast=0.95:brightness=-0.03,colorchannelmixer=rr=0.92:gg=0.98:bb=1.08,hue=h=200',
  forest_mist: 'eq=saturation=0.55:contrast=0.84,colorchannelmixer=rr=0.9:gg=1.05:bb=0.95,hue=h=85',
  moon_cool: 'eq=saturation=0.5:contrast=1.05:brightness=-0.04,colorchannelmixer=rr=0.88:gg=0.95:bb=1.12,hue=h=220',
  desk_night: 'eq=saturation=0.58:contrast=0.92:brightness=0.03,colorchannelmixer=rr=1.1:gg=1.05:bb=0.82,hue=h=28',
  soft_vhs: 'eq=saturation=0.62:contrast=0.88,colorchannelmixer=rr=1.05:gg=0.98:bb=1.02,hue=h=168',
};

/**
 * Animations export — sous-ensemble volontairement court (~10), testé avec FFmpeg 8+.
 * Uniquement zoompan, vignette, gblur, noise, eq (pas colorbalance/unsharp/curves/hue animé).
 */
function buildMotionFfmpegChain(motionPreset: string | undefined): string {
  const m = (motionPreset || 'none').trim();
  if (!m || m === 'none') return '';

  // zoompan : virgules échappées pour la syntaxe filtergraph
  const Z = {
    kb: "zoompan=z='min(zoom+0.0024\\,1.32)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    zo: "zoompan=z='if(eq(on\\,0)\\,1.26\\,max(zoom-0.0022\\,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    dr: "zoompan=z='1.1':x='max(iw/2-(iw/zoom/2)-on*0.55\\,0)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    bt: "zoompan=z='1+0.05*sin(2*PI*on/14)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    pp: "zoompan=z='1+0.085*sin(2*PI*on/9)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    ir: "zoompan=z='if(lte(on\\,3)\\,1+on*0.05\\,min(zoom+0.0028\\,1.22))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
  };

  const chains: Record<string, string> = {
    kenburns: Z.kb,
    zoomout: Z.zo,
    drift: Z.dr,
    beat: Z.bt,
    pop: Z.pp,
    iris: Z.ir,
    dream:
      "zoompan=z='min(zoom+0.0009\\,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,vignette=angle=0.52:eval=frame,gblur=sigma=0.75",
    vhs: 'noise=alls=5:allf=t+u,eq=saturation=0.82:contrast=0.95:brightness=-0.03',
    noir: 'eq=contrast=1.42:brightness=-0.07:saturation=0.62',
    glitch: 'noise=alls=10:allf=t,eq=contrast=1.08',
  };

  return chains[m] || '';
}

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

  const rawDur = hookEnd - hookStart;
  const hookDuration = Math.min(
    MAX_EXPORT_SEC,
    Math.max(MIN_EXPORT_SEC, Number.isFinite(rawDur) ? rawDur : 30)
  );

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ad-gen-${campaignId}-`));

  try {
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
        /* */
      }
    }

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
      } catch {
        /* */
      }
    }
    if (!videoPath && videoUrl) {
      try {
        const res = await fetch(videoUrl);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          videoPath = path.join(tmpDir, 'video.mp4');
          fs.writeFileSync(videoPath, buf);
        }
      } catch {
        /* */
      }
    }

    let coverPath: string | null = null;
    const ecUrl = editorSettings.endCardCoverUrl?.trim();
    if (editorSettings.endCardEnabled && ecUrl) {
      try {
        const res = await fetch(ecUrl, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = ecUrl.includes('.png') ? 'png' : 'jpg';
          coverPath = path.join(tmpDir, `cover.${ext}`);
          fs.writeFileSync(coverPath, buf);
        }
      } catch {
        /* */
      }
    }

    let outputKey = '';
    let outputUrl = '';

    const renderOpts = {
      hookStart,
      hookDuration,
      artistName,
      trackTitle,
      editorSettings,
      coverPath,
    };
    const outputPath = path.join(tmpDir, 'ad.mp4');

    if (videoPath && audioPath) {
      try {
        await runFfmpegVideoAudio(videoPath, audioPath, outputPath, renderOpts);
        const outputBuf = fs.readFileSync(outputPath);
        outputKey = `campaigns/${campaignId}/ad_${Date.now()}.mp4`;
        outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
      } catch (e) {
        console.error('[adGenerator] ffmpeg/upload (avec audio) a échoué:', e);
      }
    }

    if (!outputUrl && videoPath) {
      try {
        await runFfmpegSilent(videoPath, outputPath, renderOpts);
        const outputBuf = fs.readFileSync(outputPath);
        outputKey = `campaigns/${campaignId}/ad_${Date.now()}.mp4`;
        outputUrl = await uploadBuffer(outputKey, outputBuf, 'video/mp4');
      } catch (e) {
        console.error('[adGenerator] ffmpeg/upload (sans morceau / silence) a échoué:', e);
      }
    }

    const previewUrl =
      outputUrl ||
      (videoUrl ?? '') ||
      (videoS3Key ? getPublicUrl(videoS3Key) : '');
    return [{ videoS3Key: outputKey, videoUrl: previewUrl }];
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildFilterComplex(opts: {
  hookDuration: number;
  artistName: string;
  trackTitle: string;
  editorSettings: EditorSettings;
  coverPath: string | null;
}): string {
  const { hookDuration, artistName, trackTitle, editorSettings, coverPath } = opts;
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
    endCardEnabled = false,
    endCardDurationSec = 3,
    endCardTitle = '',
    endCardShowTitle = true,
    motionPreset = 'none',
  } = editorSettings;

  const filters: string[] = [];

  filters.push(
    `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,loop=loop=-1:size=500,trim=duration=${hookDuration},setpts=PTS-STARTPTS[base]`
  );

  const presetFilter = PRESET_FFMPEG[filterPreset] ?? '';
  const eqBrightness = ((brightness - 100) / 100).toFixed(3);
  const eqContrast = (contrast / 100).toFixed(3);
  const eqSaturation = (saturation / 100).toFixed(3);
  const hasEq = brightness !== 100 || contrast !== 100 || saturation !== 100;
  const eqFilter = hasEq
    ? `eq=brightness=${eqBrightness}:contrast=${eqContrast}:saturation=${eqSaturation}`
    : '';

  const colorChain = [presetFilter, eqFilter].filter(Boolean).join(',');
  filters.push(colorChain ? `[base]${colorChain}[colored]` : `[base]null[colored]`);

  const motionChain = buildMotionFfmpegChain(motionPreset);
  if (motionChain) {
    filters.push(`[colored]${motionChain}[motioned]`);
  } else {
    filters.push(`[colored]null[motioned]`);
  }

  if (grain > 0) {
    filters.push(`[motioned]noise=alls=${Math.round(grain * 0.4)}:allf=t+u[grained]`);
  } else {
    filters.push(`[motioned]null[grained]`);
  }

  filters.push(`[grained]null[faded]`);

  const displayText = text
    ? `${escapeDrawtext(text)}\\n${escapeDrawtext(artistName)} - ${escapeDrawtext(trackTitle)}`
    : `${escapeDrawtext(artistName)} - ${escapeDrawtext(trackTitle)}`;

  const ffFontColor = hexToFfmpegColor(fontColor);
  const ffBgColor =
    textBgColor === 'transparent' || !textBgColor
      ? '00000000'
      : `${hexToFfmpegColor(textBgColor)}@${textBgOpacity.toFixed(2)}`;

  const yPos =
    textPosition === 'top' ? '80' : textPosition === 'center' ? '(h-text_h)/2' : 'h-150';

  /** FFmpeg 8+ : l’option drawtext `fontstyle` n’existe plus — on grossit un peu pour « bold ». */
  const drawFontSize =
    fontFamily === 'bold' ? Math.round(fontSize * 1.12) : fontSize;

  filters.push(
    `[faded]drawtext=text='${displayText}':fontsize=${drawFontSize}:fontcolor=${ffFontColor}:x=(w-text_w)/2:y=${yPos}:box=1:boxcolor=${ffBgColor}:boxborderw=12[vtxt]`
  );

  const ecDur = Math.min(Math.max(0.5, endCardDurationSec), hookDuration * 0.45);
  const ecStart = Math.max(0, hookDuration - ecDur);

  if (endCardEnabled && coverPath) {
    filters.push(
      `[2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,format=rgba,fade=t=in:st=${ecStart.toFixed(3)}:d=${ecDur.toFixed(3)}:alpha=1[cvf]`
    );
    filters.push(`[vtxt][cvf]overlay=(W-w)/2:(H-h)/2:format=auto[voc]`);
    if (endCardShowTitle && endCardTitle.trim()) {
      const t = escapeDrawtext(endCardTitle.trim());
      filters.push(
        `[voc]drawtext=text='${t}':fontsize=56:fontcolor=FFFFFF:x=(w-text_w)/2:y=h-200:box=1:boxcolor=00000080:boxborderw=16:enable='between(t\\,${ecStart.toFixed(3)}\\,${hookDuration.toFixed(3)})'[vout]`
      );
    } else {
      filters.push(`[voc]null[vout]`);
    }
  } else {
    filters.push(`[vtxt]null[vout]`);
  }

  return filters.join(';');
}

async function runFfmpegVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  opts: {
    hookStart: number;
    hookDuration: number;
    artistName: string;
    trackTitle: string;
    editorSettings: EditorSettings;
    coverPath: string | null;
  }
): Promise<void> {
  const { hookStart, hookDuration, artistName, trackTitle, editorSettings, coverPath } = opts;

  const filterComplex = buildFilterComplex({
    hookDuration,
    artistName,
    trackTitle,
    editorSettings,
    coverPath,
  });

  const args = [
    '-y',
    '-i',
    videoPath,
    '-ss',
    hookStart.toString(),
    '-t',
    hookDuration.toString(),
    '-i',
    audioPath,
  ];

  if (coverPath && editorSettings.endCardEnabled) {
    args.push('-loop', '1', '-framerate', '1', '-t', hookDuration.toString(), '-i', coverPath);
  }

  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '[vout]',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath
  );

  await execFileAsync('ffmpeg', args);
}

async function runFfmpegSilent(
  videoPath: string,
  outputPath: string,
  opts: {
    hookStart: number;
    hookDuration: number;
    artistName: string;
    trackTitle: string;
    editorSettings: EditorSettings;
    coverPath: string | null;
  }
): Promise<void> {
  const { hookStart, hookDuration, artistName, trackTitle, editorSettings, coverPath } = opts;

  const filterComplex = buildFilterComplex({
    hookDuration,
    artistName,
    trackTitle,
    editorSettings,
    coverPath,
  });

  const args: string[] = [
    '-y',
    '-i',
    videoPath,
    '-ss',
    hookStart.toString(),
    '-t',
    hookDuration.toString(),
    '-f',
    'lavfi',
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t',
    hookDuration.toString(),
  ];

  if (coverPath && editorSettings.endCardEnabled) {
    args.push('-loop', '1', '-framerate', '1', '-t', hookDuration.toString(), '-i', coverPath);
  }

  args.push(
    '-filter_complex',
    filterComplex,
    '-map',
    '[vout]',
    '-map',
    '1:a',
    '-c:v',
    'libx264',
    '-c:a',
    'aac',
    '-pix_fmt',
    'yuv420p',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath
  );

  await execFileAsync('ffmpeg', args);
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
