import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';

/**
 * Common broadcast, cinema, and digital video framerates
 */
const STANDARD_FRAMERATES = [
  23.976, // 24000 / 1001 (NTSC Cinema)
  24,     // Cinema Standard
  25,     // PAL / European Broadcast
  29.97,  // 30000 / 1001 (NTSC Broadcast)
  30,     // Digital Standard
  48,     // HFR Cinema
  50,     // PAL High Speed
  59.94,  // 60000 / 1001 (NTSC High Speed)
  60,     // 60p Digital
  119.88, // 120000 / 1001 (NTSC Slow Motion)
  120     // 120p Slow Motion
];

/**
 * Normalizes raw floating-point framerates to standard film/broadcast cadence values
 */
export function normalizeStandardFps(fps: number): number {
  if (!fps || isNaN(fps) || fps <= 0) return 30;

  for (const std of STANDARD_FRAMERATES) {
    if (Math.abs(fps - std) < 0.06) {
      return std;
    }
  }

  // Round non-standard values to 3 decimal places
  return Math.round(fps * 1000) / 1000;
}

/**
 * Human-readable display of FPS
 */
export function formatFpsDisplay(fps: number): string {
  const norm = normalizeStandardFps(fps);
  if (norm === 23.976) return '23.98 fps (Cinema 24p)';
  if (norm === 24) return '24 fps (Cinema)';
  if (norm === 25) return '25 fps (PAL / Europe)';
  if (norm === 29.97) return '29.97 fps (NTSC)';
  if (norm === 30) return '30 fps (Web / Standard)';
  if (norm === 50) return '50 fps (PAL High Speed)';
  if (norm === 59.94) return '59.94 fps (NTSC High Speed)';
  if (norm === 60) return '60 fps (High Frame Rate)';
  if (norm === 120) return '120 fps (Slow Motion)';
  return `${norm} fps`;
}

/**
 * Fast ISO BMFF (MP4/MOV) atom parser fallback to compute FPS from mdhd timescale & stts delta
 */
async function parseIsoBmffFps(fileOrBlob: Blob): Promise<number | null> {
  try {
    // Read up to first 4MB (where moov and trak usually reside in web/streaming optimized videos)
    const chunkSize = Math.min(fileOrBlob.size, 4 * 1024 * 1024);
    const buffer = await fileOrBlob.slice(0, chunkSize).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const findBox = (name: string): number => {
      const b0 = name.charCodeAt(0);
      const b1 = name.charCodeAt(1);
      const b2 = name.charCodeAt(2);
      const b3 = name.charCodeAt(3);
      const len = bytes.length - 8;
      for (let i = 0; i < len; i++) {
        if (
          bytes[i + 4] === b0 &&
          bytes[i + 5] === b1 &&
          bytes[i + 6] === b2 &&
          bytes[i + 7] === b3
        ) {
          return i;
        }
      }
      return -1;
    };

    const mdhdOffset = findBox('mdhd');
    if (mdhdOffset !== -1 && mdhdOffset + 32 <= bytes.length) {
      const version = view.getUint8(mdhdOffset + 8);
      const timeScaleOffset = version === 0 ? mdhdOffset + 20 : mdhdOffset + 28;
      const timescale = view.getUint32(timeScaleOffset);

      const sttsOffset = findBox('stts');
      if (sttsOffset !== -1 && sttsOffset + 24 <= bytes.length && timescale > 0) {
        const entryCount = view.getUint32(sttsOffset + 12);
        if (entryCount > 0) {
          const sampleDelta = view.getUint32(sttsOffset + 20);
          if (sampleDelta > 0) {
            const rawFps = timescale / sampleDelta;
            if (rawFps >= 1 && rawFps <= 240) {
              return normalizeStandardFps(rawFps);
            }
          }
        }
      }
    }
  } catch (err) {
    console.debug('ISO BMFF atom parsing skipped:', err);
  }
  return null;
}

/**
 * Detects the authentic source video frame rate from:
 * 1. Mediabunny track analysis (computeFrameRateMetrics)
 * 2. ISO BMFF container metadata (mdhd timescale / stts delta)
 * 3. File name hints / conventions
 * 4. Fallback default
 */
export async function detectSourceVideoFps(
  fileOrBlob?: File | Blob | null,
  fallbackFps: number = 30
): Promise<number> {
  if (!fileOrBlob) {
    return normalizeStandardFps(fallbackFps);
  }

  // 1. Primary: Mediabunny track analysis
  try {
    const input = new Input({
      source: new BlobSource(fileOrBlob),
      formats: ALL_FORMATS
    });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (videoTrack) {
      const metrics = await videoTrack.computeFrameRateMetrics();
      const detected =
        metrics.bestGuessFrameRate ||
        metrics.underlyingFrameRate ||
        metrics.averageFrameRate ||
        metrics.medianFrameRate;

      if (typeof detected === 'number' && detected > 0 && !isNaN(detected)) {
        return normalizeStandardFps(detected);
      }
    }
  } catch (mbErr) {
    console.warn('Mediabunny computeFrameRateMetrics fallback:', mbErr);
  }

  // 2. Secondary: Direct ISO BMFF container parser
  const isoFps = await parseIsoBmffFps(fileOrBlob);
  if (isoFps && isoFps > 0) {
    return isoFps;
  }

  // 3. Filename framerate pattern detection (e.g. clip_24fps.mp4, 25p, 60fps, 5994, 23976)
  if ('name' in fileOrBlob && typeof (fileOrBlob as File).name === 'string') {
    const name = (fileOrBlob as File).name.toLowerCase();
    if (name.includes('23.976') || name.includes('23976') || name.includes('23.98')) return 23.976;
    if (name.includes('24fps') || name.includes('_24p') || name.includes('-24p')) return 24;
    if (name.includes('25fps') || name.includes('_25p') || name.includes('-25p')) return 25;
    if (name.includes('29.97') || name.includes('2997')) return 29.97;
    if (name.includes('30fps') || name.includes('_30p') || name.includes('-30p')) return 30;
    if (name.includes('50fps') || name.includes('_50p') || name.includes('-50p')) return 50;
    if (name.includes('59.94') || name.includes('5994')) return 59.94;
    if (name.includes('60fps') || name.includes('_60p') || name.includes('-60p')) return 60;
    if (name.includes('120fps') || name.includes('_120p')) return 120;
  }

  return normalizeStandardFps(fallbackFps);
}
