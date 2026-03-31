/**
 * Analyse légère côté client pour guider suggestHooks (courbe RMS).
 */
export async function computeAudioEnergyEnvelope(
  file: File
): Promise<{ durationSec: number; envelope: number[] }> {
  if (typeof window === 'undefined') {
    return { durationSec: 0, envelope: [] };
  }
  const ab = await file.arrayBuffer();
  const ActxClass = (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext;
  const actx = new ActxClass();
  try {
    const buf = await actx.decodeAudioData(ab.slice(0));
    const ch = buf.getChannelData(0);
    const bins = 128;
    const step = Math.max(1, Math.floor(ch.length / bins));
    const envelope: number[] = [];
    let maxR = 0;
    for (let i = 0; i < bins; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        const v = ch[i * step + j] ?? 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / step);
      envelope.push(rms);
      maxR = Math.max(maxR, rms);
    }
    const norm = maxR > 1e-6 ? envelope.map((x) => Math.min(1, x / maxR)) : envelope.map(() => 0);
    return { durationSec: buf.duration, envelope: norm };
  } finally {
    await actx.close().catch(() => {});
  }
}
