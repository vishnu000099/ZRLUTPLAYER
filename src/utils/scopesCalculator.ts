/**
 * Scopes computation: RGB Histogram, IRE Luma Waveform, and DaVinci/EricRollei-grade Vectorscope with Skin Tone Diagnostics.
 * Accurately analyzes the active WebGL canvas frame (including applied 3D LUTs & color grading).
 * Incorporates EricRollei-inspired skin-line deviation, skin luminance (IRE), cast consistency, and multi-scale vector zoom.
 */

export interface HistogramData {
  r: Uint32Array;
  g: Uint32Array;
  b: Uint32Array;
  lum: Uint32Array;
  maxCount: number;
}

export interface SkinToneAnalysisResult {
  detectedCount: number;
  detectedPercentage: number;
  averageHueDeviationDeg: number; // Positive = shifted towards Magenta, Negative = shifted towards Yellow/Green
  averageSaturation: number; // 0 to 100%
  status: 'optimal' | 'magenta_bias' | 'yellow_bias' | 'undetermined';
  statusLabel: string;
  // Delta Meter / Vector Magnitude Compensation metrics for WebGL matrix injection
  compensationTint: number; // Injected tint compensation (e.g. -4.2)
  compensationTemp: number; // Injected temp compensation (-20 to +20)
  compensationTempKelvin: number; // Kelvin equivalent offset (e.g. +120K)
  vectorMagnitudeDeg: number; // Absolute angular error
  isSelectionIsolated?: boolean; // True when sampling strictly within a user-drawn bounding box
  selectionPixelCount?: number;
  selectionRelativePercentage?: number;

  // EricRollei-inspired diagnostic metrics:
  skinLuminanceIRE: number; // 0 - 100 IRE (broadcast skin luma, standard ~60-70 IRE)
  targetSkinIRE: number; // Target IRE benchmark (e.g. 65 IRE)
  exposureOffsetEV: number; // Recommended EV exposure compensation to land skin at target IRE
  castConsistencyPct: number; // 0 - 100% (uniformity of skin tones vs mixed lighting)
  hueSpreadDeg: number; // Standard deviation of skin hue angles
  isMixedLighting: boolean; // True if hue spread > 10.5° (indicates mixed/split lighting)
  skinToneAngleDeg: number; // Absolute vector angle (e.g. 133.4° vs 123.0° ideal)
}

export function computeHistogram(imageData: ImageData): HistogramData {
  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const lum = new Uint32Array(256);
  const data = imageData.data;
  const len = data.length;

  let maxCount = 0;

  for (let i = 0; i < len; i += 4) {
    const red = data[i];
    const green = data[i + 1];
    const blue = data[i + 2];
    const l = Math.round(0.2126 * red + 0.7152 * green + 0.0722 * blue);

    r[red]++;
    g[green]++;
    b[blue]++;
    lum[l]++;

    if (r[red] > maxCount) maxCount = r[red];
    if (g[green] > maxCount) maxCount = g[green];
    if (b[blue] > maxCount) maxCount = b[blue];
    if (lum[l] > maxCount) maxCount = lum[l];
  }

  return { r, g, b, lum, maxCount: Math.max(1, maxCount) };
}

export type WaveformMode = 'luma' | 'rgb_overlay' | 'rgb_parade';
export type WaveformPhosphor = 'amber' | 'green' | 'cyan' | 'white';

export interface RGBChannelsVisible {
  r: boolean;
  g: boolean;
  b: boolean;
}

export interface RGBChannelStats {
  minIRE: number;
  maxIRE: number;
  avgIRE: number;
  overRangePct: number;
  isClipping: boolean;
  midtonesIRE: number;
}

export interface RGBParadeMetrics {
  r: RGBChannelStats;
  g: RGBChannelStats;
  b: RGBChannelStats;
  wbBalance: {
    rDelta: number;     // R_mid - G_mid
    bDelta: number;     // B_mid - G_mid
    rbDelta: number;    // R_mid - B_mid (positive = warm/red, negative = cool/blue)
    status: 'neutral' | 'warm_red' | 'cool_blue' | 'magenta_tint' | 'green_tint';
    label: string;
    advice: string;
    isAligned: boolean;
  };
  individualChannelClipping: {
    hasClipping: boolean;
    clippedChannels: ('Red' | 'Green' | 'Blue')[];
    isLumaSafeWhileChannelClips: boolean;
    summary: string;
  };
}

export interface WaveformOptions {
  step?: number;
  mode?: WaveformMode;
  phosphor?: WaveformPhosphor;
  intensity?: number;
  showBands?: boolean;
  targetSkinIRE?: number;
  showGraticuleText?: boolean;
  visibleChannels?: RGBChannelsVisible;
  onMetrics?: (metrics: WaveformMetrics) => void;
  onParadeMetrics?: (metrics: RGBParadeMetrics) => void;
}

export interface WaveformMetrics {
  minIRE: number;
  maxIRE: number;
  avgIRE: number;
  blackPct: number;         // <= 0.5 IRE (Black pedestal)
  deepShadowsPct: number;   // 10–20 IRE (Deep shadows)
  midtonesPct: number;      // 40–60 IRE (Standard midtones)
  brightMidtonesPct: number;// 60–75 IRE (Brighter midtones / skin)
  highlightsPct: number;    // 90–100 IRE (Highlights)
  overRangePct: number;     // > 100 IRE (Over-range signal)
  isOverRange: boolean;
  isUnderRange: boolean;
  exposureStatus: 'optimal' | 'underexposed' | 'overexposed' | 'high_contrast' | 'low_contrast';
  exposureSummary: string;
  parade?: RGBParadeMetrics;
}

export function drawWaveform(
  targetCanvas: HTMLCanvasElement,
  sourceImageData: ImageData,
  optionsOrStep: WaveformOptions | number = 2,
  targetSkinIREArg: number = 65
): WaveformMetrics {
  const options: WaveformOptions =
    typeof optionsOrStep === 'number'
      ? { step: optionsOrStep, targetSkinIRE: targetSkinIREArg }
      : { ...optionsOrStep };

  const {
    step = 2,
    mode = 'luma',
    phosphor = 'amber',
    intensity = 1.0,
    showBands = true,
    targetSkinIRE = 65,
    showGraticuleText = true,
    visibleChannels = { r: true, g: true, b: true }
  } = options;

  const defaultParadeMetrics: RGBParadeMetrics = {
    r: { minIRE: 0, maxIRE: 100, avgIRE: 50, overRangePct: 0, isClipping: false, midtonesIRE: 50 },
    g: { minIRE: 0, maxIRE: 100, avgIRE: 50, overRangePct: 0, isClipping: false, midtonesIRE: 50 },
    b: { minIRE: 0, maxIRE: 100, avgIRE: 50, overRangePct: 0, isClipping: false, midtonesIRE: 50 },
    wbBalance: {
      rDelta: 0,
      bDelta: 0,
      rbDelta: 0,
      status: 'neutral',
      label: 'Neutral White Balance (R ≈ G ≈ B)',
      advice: 'Channels are balanced across midtones.',
      isAligned: true
    },
    individualChannelClipping: {
      hasClipping: false,
      clippedChannels: [],
      isLumaSafeWhileChannelClips: false,
      summary: 'All RGB channels within broadcast range.'
    }
  };

  const defaultMetrics: WaveformMetrics = {
    minIRE: 0,
    maxIRE: 100,
    avgIRE: 50,
    blackPct: 0,
    deepShadowsPct: 0,
    midtonesPct: 0,
    brightMidtonesPct: 0,
    highlightsPct: 0,
    overRangePct: 0,
    isOverRange: false,
    isUnderRange: false,
    exposureStatus: 'optimal',
    exposureSummary: 'Analyzing exposure and brightness…',
    parade: defaultParadeMetrics
  };

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return defaultMetrics;

  const w = targetCanvas.width;
  const h = targetCanvas.height;
  ctx.fillStyle = '#07090e';
  ctx.fillRect(0, 0, w, h);

  // Vertical scale range: -10 IRE to +110 IRE (total 120 IRE)
  // Preserves clear visibility of sub-black (< 0 IRE) and over-range super-whites (> 100 IRE)
  const minIREScale = -10;
  const maxIREScale = 110;
  const totalIRE = maxIREScale - minIREScale; // 120

  const paddingTop = 14;
  const paddingBottom = 16;
  const paddingLeft = 32;
  const paddingRight = 10;
  const plotW = w - paddingLeft - paddingRight;
  const plotH = h - paddingTop - paddingBottom;

  const ireToY = (ire: number): number => {
    const norm = (ire - minIREScale) / totalIRE;
    return h - paddingBottom - norm * plotH;
  };

  // Draw Rec.709 IRE Interpretation Background Bands
  if (showBands) {
    // 1. Above 100 IRE: Over-range signal (if preserved / clipping warning)
    const y100 = ireToY(100);
    const y110 = ireToY(110);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.09)'; // Soft red warning
    ctx.fillRect(paddingLeft, y110, plotW, y100 - y110);

    // 2. 90–100 IRE: Highlights
    const y90 = ireToY(90);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.06)'; // Amber highlights
    ctx.fillRect(paddingLeft, y100, plotW, y90 - y100);

    // 3. 60–75 IRE: Brighter midtones / Skin key zone
    const y75 = ireToY(75);
    const y60 = ireToY(60);
    ctx.fillStyle = 'rgba(229, 185, 111, 0.08)'; // Golden skin tones
    ctx.fillRect(paddingLeft, y75, plotW, y60 - y75);

    // 4. 40–60 IRE: Midtones (including 18% gray at 42 IRE)
    const y40 = ireToY(40);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.05)'; // Emerald midtones
    ctx.fillRect(paddingLeft, y60, plotW, y40 - y60);

    // 5. 10–20 IRE: Deep shadows
    const y20 = ireToY(20);
    const y10 = ireToY(10);
    ctx.fillStyle = 'rgba(168, 85, 247, 0.06)'; // Purple shadows
    ctx.fillRect(paddingLeft, y20, plotW, y10 - y20);

    // 6. Sub-zero under-range (< 0 IRE)
    const y0 = ireToY(0);
    const yMin = ireToY(minIREScale);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)'; // Sub-black crushed warning
    ctx.fillRect(paddingLeft, y0, plotW, yMin - y0);
  }

  // Draw Grid Lines & IRE Labels
  const gridLines = [
    { ire: 110, label: '110', color: 'rgba(239, 68, 68, 0.4)', text: 'OVER-RANGE' },
    { ire: 100, label: '100', color: 'rgba(239, 68, 68, 0.75)', text: 'CLIP / 100% WHITE', dash: [3, 2] },
    { ire: 90, label: '90', color: 'rgba(245, 158, 11, 0.4)', text: 'HIGHLIGHTS' },
    { ire: 75, label: '75', color: 'rgba(229, 185, 111, 0.4)', text: 'BRIGHT MID' },
    { ire: 60, label: '60', color: 'rgba(229, 185, 111, 0.35)', text: 'SKIN SWEET SPOT' },
    { ire: 40, label: '40', color: 'rgba(52, 211, 153, 0.3)', text: 'MIDTONES' },
    { ire: 20, label: '20', color: 'rgba(168, 85, 247, 0.3)', text: 'DEEP SHADOW' },
    { ire: 10, label: '10', color: 'rgba(168, 85, 247, 0.25)' },
    { ire: 0, label: '0', color: 'rgba(148, 163, 184, 0.85)', text: 'BLACK (PEDESTAL)' },
    { ire: -10, label: '-10', color: 'rgba(239, 68, 68, 0.3)' }
  ];

  ctx.lineWidth = 1;
  ctx.font = '8px "JetBrains Mono", monospace';

  for (const line of gridLines) {
    const y = ireToY(line.ire);
    ctx.strokeStyle = line.color;
    if (line.dash) {
      ctx.setLineDash(line.dash);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    // Left label: IRE number
    ctx.fillStyle = line.ire === 100 || line.ire === 110 ? '#ef4444' : line.ire === 0 ? '#cbd5e1' : '#64748b';
    ctx.fillText(`${line.label}`, 6, y + 3);

    // Right subtle annotation
    if (showGraticuleText && line.text && w > 360) {
      ctx.fillStyle = line.color;
      ctx.font = '7px "JetBrains Mono", monospace';
      ctx.fillText(line.text, w - paddingRight - 88, y - 2);
    }
  }

  // 18% Middle Gray reference marker line (~42 IRE in Rec.709 gamma 2.4)
  const yGray = ireToY(42);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(paddingLeft, yGray);
  ctx.lineTo(w - paddingRight, yGray);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(52, 211, 153, 0.75)';
  ctx.font = '7.5px "JetBrains Mono", monospace';
  ctx.fillText('18% Mid-Gray (42)', paddingLeft + 4, yGray - 2);

  // Target Skin IRE Guide Line (if configured)
  if (targetSkinIRE > 0 && targetSkinIRE <= 100) {
    const yTarget = ireToY(targetSkinIRE);
    ctx.strokeStyle = 'rgba(229, 185, 111, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, yTarget);
    ctx.lineTo(w - paddingRight, yTarget);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(229, 185, 111, 0.9)';
    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillText(`Skin Target: ${targetSkinIRE} IRE`, w - paddingRight - 94, yTarget - 3);
  }

  // Determine active channels
  const vis = options.visibleChannels || { r: true, g: true, b: true };
  const effectiveVis = {
    r: vis.r ?? true,
    g: vis.g ?? true,
    b: vis.b ?? true
  };
  if (!effectiveVis.r && !effectiveVis.g && !effectiveVis.b) {
    effectiveVis.r = true;
    effectiveVis.g = true;
    effectiveVis.b = true;
  }

  // Sample Pixel Data and accumulate exposure & per-channel statistics
  const srcW = sourceImageData.width;
  const srcH = sourceImageData.height;
  const data = sourceImageData.data;

  let minIRE = 999;
  let maxIRE = -999;
  let sumIRE = 0;
  let totalSamples = 0;

  let countBlack = 0;
  let countDeepShadows = 0;
  let countMidtones = 0;
  let countBrightMidtones = 0;
  let countHighlights = 0;
  let countOverRange = 0;
  let countUnderRange = 0;

  // Individual channel metrics accumulators
  let rMin = 999, rMax = -999, rSum = 0, rOverRangeCount = 0;
  let gMin = 999, gMax = -999, gSum = 0, gOverRangeCount = 0;
  let bMin = 999, bMax = -999, bSum = 0, bOverRangeCount = 0;

  // Midtone accumulator for Neutral Grey Card & White Balance analysis (35–65 IRE)
  let midRSum = 0, midGSum = 0, midBSum = 0, midSamples = 0;

  // Determine phosphor base colors for Luma mode
  let phosphorR = 229, phosphorG = 185, phosphorB = 111; // amber default
  if (phosphor === 'green') {
    phosphorR = 52; phosphorG = 211; phosphorB = 153;
  } else if (phosphor === 'cyan') {
    phosphorR = 56; phosphorG = 189; phosphorB = 248;
  } else if (phosphor === 'white') {
    phosphorR = 241; phosphorG = 245; phosphorB = 249;
  }

  const alpha = Math.min(0.85, Math.max(0.12, 0.28 * intensity));
  const lumaColor = `rgba(${phosphorR}, ${phosphorG}, ${phosphorB}, ${alpha})`;

  if (mode === 'rgb_parade') {
    // Dynamic columns for active channels
    const activeCols: ('r' | 'g' | 'b')[] = [];
    if (effectiveVis.r) activeCols.push('r');
    if (effectiveVis.g) activeCols.push('g');
    if (effectiveVis.b) activeCols.push('b');

    const numCols = activeCols.length;
    const colGap = numCols > 1 ? 8 : 0;
    const colW = (plotW - colGap * (numCols - 1)) / numCols;

    // Draw Column Headers & Vertical Partition Dividers
    ctx.font = '8.5px "JetBrains Mono", monospace';
    for (let c = 0; c < numCols; c++) {
      const ch = activeCols[c];
      const colX = paddingLeft + c * (colW + colGap);

      if (c > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.beginPath();
        ctx.moveTo(colX - colGap / 2, paddingTop - 4);
        ctx.lineTo(colX - colGap / 2, h - paddingBottom);
        ctx.stroke();
      }

      if (ch === 'r') {
        ctx.fillStyle = '#f87171';
        ctx.fillText(numCols === 1 ? 'RED CHANNEL (SOLO PARADE)' : 'RED PARADE', colX + 4, paddingTop - 4);
      } else if (ch === 'g') {
        ctx.fillStyle = '#4ade80';
        ctx.fillText(numCols === 1 ? 'GREEN CHANNEL (SOLO PARADE)' : 'GREEN PARADE', colX + 4, paddingTop - 4);
      } else if (ch === 'b') {
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(numCols === 1 ? 'BLUE CHANNEL (SOLO PARADE)' : 'BLUE PARADE', colX + 4, paddingTop - 4);
      }
    }

    // Sample & Plot Parade Traces
    for (let x = 0; x < srcW; x += step) {
      const normX = x / srcW;
      for (let y = 0; y < srcH; y += step) {
        const idx = (y * srcW + x) * 4;
        const rVal = (data[idx] / 255) * 100;
        const gVal = (data[idx + 1] / 255) * 100;
        const bVal = (data[idx + 2] / 255) * 100;
        const lum = 0.2126 * rVal + 0.7152 * gVal + 0.0722 * bVal;

        // Overall Luma Statistics
        minIRE = Math.min(minIRE, lum);
        maxIRE = Math.max(maxIRE, lum);
        sumIRE += lum;
        totalSamples++;

        if (lum <= 0.5) countBlack++;
        if (lum >= 10 && lum <= 20) countDeepShadows++;
        if (lum >= 40 && lum <= 60) countMidtones++;
        if (lum > 60 && lum <= 75) countBrightMidtones++;
        if (lum >= 90 && lum <= 100) countHighlights++;
        if (lum > 100) countOverRange++;
        if (lum < 0) countUnderRange++;

        // Channel stats
        rMin = Math.min(rMin, rVal); rMax = Math.max(rMax, rVal); rSum += rVal;
        gMin = Math.min(gMin, gVal); gMax = Math.max(gMax, gVal); gSum += gVal;
        bMin = Math.min(bMin, bVal); bMax = Math.max(bMax, bVal); bSum += bVal;
        if (rVal > 100) rOverRangeCount++;
        if (gVal > 100) gOverRangeCount++;
        if (bVal > 100) bOverRangeCount++;

        // Midtone accumulation for grey card balance
        if (lum >= 35 && lum <= 65) {
          midRSum += rVal;
          midGSum += gVal;
          midBSum += bVal;
          midSamples++;
        }

        // Draw active channel traces in respective columns
        for (let c = 0; c < numCols; c++) {
          const cCh = activeCols[c];
          const cX = paddingLeft + c * (colW + colGap) + normX * colW;
          const val = cCh === 'r' ? rVal : cCh === 'g' ? gVal : bVal;
          const targetY = ireToY(val);

          if (val > 100) {
            // Over-range clipping indicator
            ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
            ctx.fillRect(cX - 0.5, targetY - 0.5, 1.8, 1.8);
          } else {
            const chColor =
              cCh === 'r'
                ? `rgba(248, 113, 113, ${alpha * 1.15})`
                : cCh === 'g'
                ? `rgba(74, 222, 128, ${alpha * 1.15})`
                : `rgba(96, 165, 250, ${alpha * 1.15})`;
            ctx.fillStyle = chColor;
            ctx.fillRect(cX, targetY, 1.2, 1.2);
          }
        }
      }
    }
  } else if (mode === 'rgb_overlay') {
    // Combined View: Red, Green, and Blue traces overlaid across full width
    const activeNames: string[] = [];
    if (effectiveVis.r) activeNames.push('R');
    if (effectiveVis.g) activeNames.push('G');
    if (effectiveVis.b) activeNames.push('B');

    ctx.font = '8.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText(
      `COMBINED RGB OVERLAY (${activeNames.join('+')}) — SUPERIMPOSED FOR NEUTRAL BALANCE`,
      paddingLeft + 4,
      paddingTop - 4
    );

    for (let x = 0; x < srcW; x += step) {
      const targetX = paddingLeft + (x / srcW) * plotW;
      for (let y = 0; y < srcH; y += step) {
        const idx = (y * srcW + x) * 4;
        const rVal = (data[idx] / 255) * 100;
        const gVal = (data[idx + 1] / 255) * 100;
        const bVal = (data[idx + 2] / 255) * 100;
        const lum = 0.2126 * rVal + 0.7152 * gVal + 0.0722 * bVal;

        minIRE = Math.min(minIRE, lum);
        maxIRE = Math.max(maxIRE, lum);
        sumIRE += lum;
        totalSamples++;

        if (lum <= 0.5) countBlack++;
        if (lum >= 10 && lum <= 20) countDeepShadows++;
        if (lum >= 40 && lum <= 60) countMidtones++;
        if (lum > 60 && lum <= 75) countBrightMidtones++;
        if (lum >= 90 && lum <= 100) countHighlights++;
        if (lum > 100) countOverRange++;
        if (lum < 0) countUnderRange++;

        // Channel stats
        rMin = Math.min(rMin, rVal); rMax = Math.max(rMax, rVal); rSum += rVal;
        gMin = Math.min(gMin, gVal); gMax = Math.max(gMax, gVal); gSum += gVal;
        bMin = Math.min(bMin, bVal); bMax = Math.max(bMax, bVal); bSum += bVal;
        if (rVal > 100) rOverRangeCount++;
        if (gVal > 100) gOverRangeCount++;
        if (bVal > 100) bOverRangeCount++;

        if (lum >= 35 && lum <= 65) {
          midRSum += rVal;
          midGSum += gVal;
          midBSum += bVal;
          midSamples++;
        }

        // Draw only active channels with additive overlay
        if (effectiveVis.r) {
          ctx.fillStyle = rVal > 100 ? 'rgba(239, 68, 68, 0.95)' : `rgba(248, 113, 113, ${alpha * 0.8})`;
          ctx.fillRect(targetX, ireToY(rVal), 1.2, 1.2);
        }
        if (effectiveVis.g) {
          ctx.fillStyle = gVal > 100 ? 'rgba(34, 197, 94, 0.95)' : `rgba(74, 222, 128, ${alpha * 0.8})`;
          ctx.fillRect(targetX, ireToY(gVal), 1.2, 1.2);
        }
        if (effectiveVis.b) {
          ctx.fillStyle = bVal > 100 ? 'rgba(59, 130, 246, 0.95)' : `rgba(96, 165, 250, ${alpha * 0.8})`;
          ctx.fillRect(targetX, ireToY(bVal), 1.2, 1.2);
        }
      }
    }
  } else {
    // Default: High-definition Rec.709 Luma Waveform
    for (let x = 0; x < srcW; x += step) {
      const targetX = paddingLeft + (x / srcW) * plotW;
      for (let y = 0; y < srcH; y += step) {
        const idx = (y * srcW + x) * 4;
        const rVal = (data[idx] / 255) * 100;
        const gVal = (data[idx + 1] / 255) * 100;
        const bVal = (data[idx + 2] / 255) * 100;
        const lum = 0.2126 * rVal + 0.7152 * gVal + 0.0722 * bVal;

        minIRE = Math.min(minIRE, lum);
        maxIRE = Math.max(maxIRE, lum);
        sumIRE += lum;
        totalSamples++;

        if (lum <= 0.5) countBlack++;
        if (lum >= 10 && lum <= 20) countDeepShadows++;
        if (lum >= 40 && lum <= 60) countMidtones++;
        if (lum > 60 && lum <= 75) countBrightMidtones++;
        if (lum >= 90 && lum <= 100) countHighlights++;
        if (lum > 100) countOverRange++;
        if (lum < 0) countUnderRange++;

        // Accumulate RGB channel stats even in Luma mode for clipping inspector
        rMin = Math.min(rMin, rVal); rMax = Math.max(rMax, rVal); rSum += rVal;
        gMin = Math.min(gMin, gVal); gMax = Math.max(gMax, gVal); gSum += gVal;
        bMin = Math.min(bMin, bVal); bMax = Math.max(bMax, bVal); bSum += bVal;
        if (rVal > 100) rOverRangeCount++;
        if (gVal > 100) gOverRangeCount++;
        if (bVal > 100) bOverRangeCount++;

        if (lum >= 35 && lum <= 65) {
          midRSum += rVal;
          midGSum += gVal;
          midBSum += bVal;
          midSamples++;
        }

        const targetY = ireToY(lum);

        // Highlight over-range super-whites with crimson warning
        if (lum > 100) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
          ctx.fillRect(targetX - 0.5, targetY - 0.5, 2.0, 2.0);
        } else {
          ctx.fillStyle = lumaColor;
          ctx.fillRect(targetX, targetY, 1.2, 1.2);
        }
      }
    }
  }

  // Finalize overall statistics
  const samples = Math.max(1, totalSamples);
  const avgIRE = sumIRE / samples;
  const blackPct = (countBlack / samples) * 100;
  const deepShadowsPct = (countDeepShadows / samples) * 100;
  const midtonesPct = (countMidtones / samples) * 100;
  const brightMidtonesPct = (countBrightMidtones / samples) * 100;
  const highlightsPct = (countHighlights / samples) * 100;
  const overRangePct = (countOverRange / samples) * 100;
  const isOverRange = overRangePct > 0.05;
  const isUnderRange = countUnderRange / samples > 0.02;

  // Finalize Individual Channel Metrics
  const rAvgIRE = rSum / samples;
  const gAvgIRE = gSum / samples;
  const bAvgIRE = bSum / samples;

  const rOverRangePct = (rOverRangeCount / samples) * 100;
  const gOverRangePct = (gOverRangeCount / samples) * 100;
  const bOverRangePct = (bOverRangeCount / samples) * 100;

  const rIsClipping = rMax > 100 || rOverRangePct > 0.05;
  const gIsClipping = gMax > 100 || gOverRangePct > 0.05;
  const bIsClipping = bMax > 100 || bOverRangePct > 0.05;

  const midCount = Math.max(1, midSamples);
  const rMidIRE = midSamples > 10 ? midRSum / midCount : rAvgIRE;
  const gMidIRE = midSamples > 10 ? midGSum / midCount : gAvgIRE;
  const bMidIRE = midSamples > 10 ? midBSum / midCount : bAvgIRE;

  // Neutral Grey Card & White Balance Analysis
  // If neutral grey card is filmed: R, G, B should be approximately aligned at the same brightness
  const rDelta = rMidIRE - gMidIRE;
  const bDelta = bMidIRE - gMidIRE;
  const rbDelta = rMidIRE - bMidIRE; // Positive = warm/red, Negative = cool/blue

  let wbStatus: RGBParadeMetrics['wbBalance']['status'] = 'neutral';
  let wbLabel = 'Neutral White Balance (R ≈ G ≈ B)';
  let wbAdvice = 'R, G, and B channels align within ±1.5 IRE across midtones. Neutral grey reference is balanced.';
  const isAligned = Math.abs(rbDelta) <= 1.5 && Math.abs(rDelta) <= 1.5 && Math.abs(bDelta) <= 1.5;

  if (!isAligned) {
    if (rbDelta > 1.8) {
      wbStatus = 'warm_red';
      wbLabel = `Warm / Red Cast (R > B by +${rbDelta.toFixed(1)} IRE)`;
      wbAdvice = `Red sits ${rbDelta.toFixed(1)} IRE above Blue in midtones. Lower Temperature or balance Red gain to align grey card.`;
    } else if (rbDelta < -1.8) {
      wbStatus = 'cool_blue';
      wbLabel = `Cool / Blue Cast (B > R by +${Math.abs(rbDelta).toFixed(1)} IRE)`;
      wbAdvice = `Blue sits ${Math.abs(rbDelta).toFixed(1)} IRE above Red in midtones. Increase Temperature or warm highlights/midtones to align grey card.`;
    } else if (rDelta > 1.5 && bDelta > 1.5) {
      wbStatus = 'magenta_tint';
      wbLabel = `Magenta Tint (R & B > G by +${((rDelta + bDelta) / 2).toFixed(1)} IRE)`;
      wbAdvice = `Red and Blue sit above Green. Adjust Tint toward Green to achieve neutral grey alignment.`;
    } else if (rDelta < -1.5 && bDelta < -1.5) {
      wbStatus = 'green_tint';
      wbLabel = `Green Tint (G > R & B by +${Math.abs((rDelta + bDelta) / 2).toFixed(1)} IRE)`;
      wbAdvice = `Green sits above Red and Blue. Adjust Tint toward Magenta to achieve neutral grey alignment.`;
    }
  }

  // Individual Channel Clipping Detection
  const clippedChannels: ('Red' | 'Green' | 'Blue')[] = [];
  if (rIsClipping) clippedChannels.push('Red');
  if (gIsClipping) clippedChannels.push('Green');
  if (bIsClipping) clippedChannels.push('Blue');

  const hasClipping = clippedChannels.length > 0;
  const isLumaSafeWhileChannelClips = !isOverRange && hasClipping;

  let clippingSummary = 'All RGB channels within 100 IRE broadcast limit.';
  if (isLumaSafeWhileChannelClips) {
    clippingSummary = `⚠️ Hidden Channel Clipping: Overall luma is safe (${avgIRE.toFixed(1)} / peak ${maxIRE.toFixed(1)} IRE), but ${clippedChannels.join(' and ')} channel is clipping (> 100 IRE)! Highlights will suffer color skew.`;
  } else if (hasClipping) {
    clippingSummary = `Clipping detected on ${clippedChannels.join(', ')} channel(s) (> 100 IRE).`;
  }

  const paradeMetrics: RGBParadeMetrics = {
    r: {
      minIRE: rMin === 999 ? 0 : rMin,
      maxIRE: rMax === -999 ? 100 : rMax,
      avgIRE: rAvgIRE,
      overRangePct: rOverRangePct,
      isClipping: rIsClipping,
      midtonesIRE: rMidIRE
    },
    g: {
      minIRE: gMin === 999 ? 0 : gMin,
      maxIRE: gMax === -999 ? 100 : gMax,
      avgIRE: gAvgIRE,
      overRangePct: gOverRangePct,
      isClipping: gIsClipping,
      midtonesIRE: gMidIRE
    },
    b: {
      minIRE: bMin === 999 ? 0 : bMin,
      maxIRE: bMax === -999 ? 100 : bMax,
      avgIRE: bAvgIRE,
      overRangePct: bOverRangePct,
      isClipping: bIsClipping,
      midtonesIRE: bMidIRE
    },
    wbBalance: {
      rDelta,
      bDelta,
      rbDelta,
      status: wbStatus,
      label: wbLabel,
      advice: wbAdvice,
      isAligned
    },
    individualChannelClipping: {
      hasClipping,
      clippedChannels,
      isLumaSafeWhileChannelClips,
      summary: clippingSummary
    }
  };

  let exposureStatus: WaveformMetrics['exposureStatus'] = 'optimal';
  let exposureSummary = '';

  if (isOverRange) {
    exposureStatus = 'overexposed';
    exposureSummary = `Over-range clipping: ${overRangePct.toFixed(1)}% of signal exceeds 100 IRE. Reduce Exposure or Highlights.`;
  } else if (isLumaSafeWhileChannelClips) {
    exposureStatus = 'optimal';
    exposureSummary = `Luma waveform is safe (${maxIRE.toFixed(1)} IRE peak), but ${clippedChannels.join(' & ')} channel clips (> 100 IRE). Check RGB Parade.`;
  } else if (avgIRE < 25 && highlightsPct < 2) {
    exposureStatus = 'underexposed';
    exposureSummary = `Underexposed: average luma is ${avgIRE.toFixed(1)} IRE. Boost Exposure or lift Shadows.`;
  } else if (maxIRE > 95 && minIRE < 5) {
    exposureStatus = 'high_contrast';
    exposureSummary = `High dynamic range: wide span from ${minIRE.toFixed(1)} IRE black to ${maxIRE.toFixed(1)} IRE highlights.`;
  } else if (maxIRE - minIRE < 40) {
    exposureStatus = 'low_contrast';
    exposureSummary = `Low contrast: compressed signal span (${minIRE.toFixed(1)} to ${maxIRE.toFixed(1)} IRE). Increase Contrast.`;
  } else {
    exposureStatus = 'optimal';
    exposureSummary = `Balanced exposure: highlights peak at ${maxIRE.toFixed(1)} IRE, pedestal at ${minIRE.toFixed(1)} IRE, midtones at ${avgIRE.toFixed(1)} IRE.`;
  }

  const metrics: WaveformMetrics = {
    minIRE: minIRE === 999 ? 0 : minIRE,
    maxIRE: maxIRE === -999 ? 100 : maxIRE,
    avgIRE,
    blackPct,
    deepShadowsPct,
    midtonesPct,
    brightMidtonesPct,
    highlightsPct,
    overRangePct,
    isOverRange,
    isUnderRange,
    exposureStatus,
    exposureSummary,
    parade: paradeMetrics
  };

  options.onMetrics?.(metrics);
  options.onParadeMetrics?.(paradeMetrics);
  return metrics;
}

export interface VectorscopeOptions {
  showSkinToneLine?: boolean;
  isolateSkin?: boolean;
  traceGain?: number;
  step?: number;
  onAnalysis?: (result: SkinToneAnalysisResult) => void;
  selectionRect?: { x: number; y: number; width: number; height: number } | null;
  showToleranceWedge?: boolean; // Draw ±2.8° broadcast target wedge
  targetSkinIRE?: number; // Target skin exposure IRE (default 65)
}

// Ideal Skin Tone vector angle in Rec.709 YCbCr/YUV space (~123° / 10:30 position)
const IDEAL_SKIN_ANGLE_RAD = (123 * Math.PI) / 180;

export function drawVectorscope(
  targetCanvas: HTMLCanvasElement,
  sourceImageData: ImageData,
  options: VectorscopeOptions = {}
): SkinToneAnalysisResult {
  const {
    showSkinToneLine = true,
    isolateSkin = false,
    traceGain = 1.0,
    step = 2,
    onAnalysis,
    selectionRect = null,
    showToleranceWedge = true,
    targetSkinIRE = 65
  } = options;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) {
    return {
      detectedCount: 0,
      detectedPercentage: 0,
      averageHueDeviationDeg: 0,
      averageSaturation: 0,
      status: 'undetermined',
      statusLabel: 'No Analysis',
      compensationTint: 0,
      compensationTemp: 0,
      compensationTempKelvin: 0,
      vectorMagnitudeDeg: 0,
      skinLuminanceIRE: 0,
      targetSkinIRE: 65,
      exposureOffsetEV: 0,
      castConsistencyPct: 100,
      hueSpreadDeg: 0,
      isMixedLighting: false,
      skinToneAngleDeg: 123.0
    };
  }

  const w = targetCanvas.width;
  const h = targetCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxRadius = Math.min(cx, cy) - 14;

  // 1. Dark Studio Background
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, w, h);

  // Outer border & clipping circle for vectorscope
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
  ctx.clip();

  // 2. Graticule Circles (100% Saturation Outer, 75% Broadcast Reference, 50%, 25%)
  ctx.lineWidth = 1;

  // 100% Saturation Circle
  ctx.strokeStyle = '#333a4c';
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius, 0, Math.PI * 2);
  ctx.stroke();

  // 75% Saturation Circle (Broadcast Color Bar Target ring)
  const r75 = maxRadius * 0.75;
  ctx.strokeStyle = '#475168';
  ctx.beginPath();
  ctx.arc(cx, cy, r75, 0, Math.PI * 2);
  ctx.stroke();

  // 50% & 25% Circles
  ctx.strokeStyle = '#2a3142';
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#202636';
  ctx.beginPath();
  ctx.arc(cx, cy, maxRadius * 0.25, 0, Math.PI * 2);
  ctx.stroke();

  // Subtle Saturation Ring Labels
  ctx.font = '7.5px "JetBrains Mono", monospace';
  ctx.fillStyle = '#4b556b';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('75%', cx + 3, cy - r75 + 10);
  ctx.fillText('100%', cx + 3, cy - maxRadius + 10);

  // 3. Center Crosshairs (Neutral Chroma origin)
  ctx.strokeStyle = '#475168';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();

  // 4. Standard 75% Target Boxes (R, Mg, B, Cy, G, Yl)
  const targets = [
    { label: 'R', r: 0.75, g: 0, b: 0, color: '#ef4444' },
    { label: 'Mg', r: 0.75, g: 0, b: 0.75, color: '#ec4899' },
    { label: 'B', r: 0, g: 0, b: 0.75, color: '#3b82f6' },
    { label: 'Cy', r: 0, g: 0.75, b: 0.75, color: '#06b6d4' },
    { label: 'G', r: 0, g: 0.75, b: 0, color: '#22c55e' },
    { label: 'Yl', r: 0.75, g: 0.75, b: 0, color: '#eab308' }
  ];

  ctx.font = '8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const t of targets) {
    const Y = 0.2126 * t.r + 0.7152 * t.g + 0.0722 * t.b;
    const u = (t.b - Y) / 1.772;
    const v = (t.r - Y) / 1.402;
    const tx = cx + (u / 0.5) * maxRadius;
    const ty = cy - (v / 0.5) * maxRadius;

    // Target boundary box
    ctx.strokeStyle = '#374151';
    ctx.strokeRect(tx - 4, ty - 4, 8, 8);

    // Target Center Cross
    ctx.strokeStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(tx - 2, ty);
    ctx.lineTo(tx + 2, ty);
    ctx.moveTo(tx, ty - 2);
    ctx.lineTo(tx, ty + 2);
    ctx.stroke();

    // Target label
    ctx.fillStyle = '#7a8294';
    ctx.fillText(t.label, tx + (tx > cx ? 9 : -9), ty + (ty > cy ? 7 : -7));
  }

  // 5. Skin Tone Tolerance Wedge / Cone
  if (showSkinToneLine && showToleranceWedge) {
    const rInner = maxRadius * 0.18;
    const rOuter = maxRadius * 0.52;
    const tolAngleRad = (2.8 * Math.PI) / 180;
    const warnAngleRad = (7.5 * Math.PI) / 180;

    // Warning wedge (±7.5°)
    const startWarn = IDEAL_SKIN_ANGLE_RAD - warnAngleRad;
    const endWarn = IDEAL_SKIN_ANGLE_RAD + warnAngleRad;
    ctx.fillStyle = 'rgba(234, 179, 8, 0.035)';
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, -endWarn, -startWarn, false);
    ctx.arc(cx, cy, rInner, -startWarn, -endWarn, true);
    ctx.closePath();
    ctx.fill();

    // Broadcast Target Wedge (±2.8° Safe Cone)
    const startSafe = IDEAL_SKIN_ANGLE_RAD - tolAngleRad;
    const endSafe = IDEAL_SKIN_ANGLE_RAD + tolAngleRad;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, -endSafe, -startSafe, false);
    ctx.arc(cx, cy, rInner, -startSafe, -endSafe, true);
    ctx.closePath();
    ctx.fill();

    // Subtle dashed boundaries for safe zone
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 6. Draw DaVinci Resolve Skin Tone Indicator Line (Fleshtone Line at ~10:30)
  if (showSkinToneLine) {
    const skinCos = Math.cos(IDEAL_SKIN_ANGLE_RAD);
    const skinSin = Math.sin(IDEAL_SKIN_ANGLE_RAD);

    const endX = cx + skinCos * maxRadius * 0.95;
    const endY = cy - skinSin * maxRadius * 0.95;

    // Glowing Fleshtone Axis
    ctx.save();
    ctx.shadowColor = 'rgba(229, 185, 111, 0.5)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = '#e5b96f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.restore();

    // Standard Melanin Saturation Target Brackets (20% to 45% saturation zone)
    const bracket20X = cx + skinCos * maxRadius * 0.20;
    const bracket20Y = cy - skinSin * maxRadius * 0.20;
    const bracket45X = cx + skinCos * maxRadius * 0.45;
    const bracket45Y = cy - skinSin * maxRadius * 0.45;

    // Perpendicular ticks
    const perpCos = -skinSin;
    const perpSin = skinCos;
    const tickLen = 4;

    ctx.strokeStyle = '#e5b96f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bracket20X - perpCos * tickLen, bracket20Y + perpSin * tickLen);
    ctx.lineTo(bracket20X + perpCos * tickLen, bracket20Y - perpSin * tickLen);
    ctx.moveTo(bracket45X - perpCos * tickLen, bracket45Y + perpSin * tickLen);
    ctx.lineTo(bracket45X + perpCos * tickLen, bracket45Y - perpSin * tickLen);
    ctx.stroke();

    // Skin Tone Label
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#e5b96f';
    ctx.textAlign = 'right';
    ctx.fillText('SKIN TONE', endX - 4, endY - 4);
  }

  // 7. Trace Phosphor Drawing & Real-time Skin Tone Analysis
  const srcW = sourceImageData.width;
  const srcH = sourceImageData.height;
  const data = sourceImageData.data;

  const hasSelection = !!(
    selectionRect &&
    selectionRect.width > 0.005 &&
    selectionRect.height > 0.005
  );

  const startX = hasSelection ? Math.max(0, Math.floor(selectionRect.x * srcW)) : 0;
  const endX = hasSelection ? Math.min(srcW, Math.ceil((selectionRect.x + selectionRect.width) * srcW)) : srcW;
  const startY = hasSelection ? Math.max(0, Math.floor(selectionRect.y * srcH)) : 0;
  const endY = hasSelection ? Math.min(srcH, Math.ceil((selectionRect.y + selectionRect.height) * srcH)) : srcH;

  const selectionPixels = (endX - startX) * (endY - startY);
  const totalFramePixels = srcW * srcH;
  const selectionRelativePct = totalFramePixels > 0 ? (selectionPixels / totalFramePixels) * 100 : 0;

  let totalSampleCount = 0;

  // Collection for EricRollei-grade robust statistical analysis
  interface SampledSkinPoint {
    deltaDeg: number;
    sat: number;
    luma: number;
    px: number;
    py: number;
  }
  const skinSamples: SampledSkinPoint[] = [];

  const normalTraceAlpha = Math.min(0.45, 0.16 * traceGain);
  const skinTraceAlpha = Math.min(0.9, 0.5 * traceGain);
  const sampleStep = hasSelection ? 1 : step;
  const dotSize = 1.3;

  for (let y = startY; y < endY; y += sampleStep) {
    for (let x = startX; x < endX; x += sampleStep) {
      const idx = (y * srcW + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      totalSampleCount++;

      // Rec.709 conversion
      const normR = r / 255;
      const normG = g / 255;
      const normB = b / 255;
      const Y = 0.2126 * normR + 0.7152 * normG + 0.0722 * normB;
      const u = (normB - Y) / 1.772;
      const v = (normR - Y) / 1.402;

      // Plot coordinates
      const px = cx + (u / 0.5) * maxRadius;
      const py = cy - (v / 0.5) * maxRadius;

      // Calculate hue angle and chroma magnitude
      const chroma = Math.sqrt(u * u + v * v);
      const satNormalized = Math.min(1.0, chroma / 0.35);

      // Chroma angle in radians
      const angle = Math.atan2(v, u);

      // Angular deviation from ideal skin tone line (123°)
      let deltaAngle = angle - IDEAL_SKIN_ANGLE_RAD;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      const deltaDeg = (deltaAngle * 180) / Math.PI;

      // Skin Tone detection heuristic:
      // When inside an isolated face box, capture skin gamut accurately across all complexions and flat log profiles
      const isSkinCandidate = hasSelection
        ? Y >= 0.04 && Y <= 0.96 && satNormalized >= 0.015 && Math.abs(deltaDeg) <= 65
        : Y >= 0.12 && Y <= 0.90 && satNormalized >= 0.04 && Math.abs(deltaDeg) <= 28;

      if (isSkinCandidate) {
        skinSamples.push({
          deltaDeg,
          sat: satNormalized,
          luma: Y,
          px,
          py
        });

        // Warm phosphor trace with density glow
        ctx.fillStyle = `rgba(240, 195, 120, ${skinTraceAlpha})`;
        ctx.fillRect(px - dotSize / 2, py - dotSize / 2, dotSize, dotSize);
      } else if (!isolateSkin && !hasSelection) {
        // Normal background phosphor trace
        ctx.fillStyle = `rgba(110, 180, 140, ${normalTraceAlpha})`;
        ctx.fillRect(px - dotSize / 2, py - dotSize / 2, dotSize, dotSize);
      }
    }
  }

  // 8. Compute EricRollei-Inspired Trimmed Statistics & Diagnostics
  const totalSkinCount = skinSamples.length;
  const detectedPercentage = totalSampleCount > 0 ? (totalSkinCount / totalSampleCount) * 100 : 0;
  const minThreshold = hasSelection ? 4 : 20;

  let avgDelta = 0;
  let avgSat = 0;
  let skinLuminanceIRE = 60;
  let hueSpreadDeg = 0;
  let castConsistencyPct = 100;
  let isMixedLighting = false;

  if (totalSkinCount >= minThreshold) {
    // Robust Outlier Rejection: sort by delta angle and trim 10% highest & lowest outliers
    // (Prevents lips, facial hair, jewelry, and specular highlights from skewing the measurement)
    const sorted = [...skinSamples].sort((a, b) => a.deltaDeg - b.deltaDeg);
    const trimCount = Math.floor(sorted.length * 0.1);
    const coreSamples = sorted.slice(trimCount, sorted.length - trimCount);
    const count = Math.max(1, coreSamples.length);

    avgDelta = coreSamples.reduce((acc, s) => acc + s.deltaDeg, 0) / count;
    avgSat = (coreSamples.reduce((acc, s) => acc + s.sat, 0) / count) * 100;
    const meanLuma = coreSamples.reduce((acc, s) => acc + s.luma, 0) / count;
    skinLuminanceIRE = Math.round(meanLuma * 100);

    // Color Cast Consistency & Angular Spread
    const variance = coreSamples.reduce((acc, s) => acc + Math.pow(s.deltaDeg - avgDelta, 2), 0) / count;
    hueSpreadDeg = Number(Math.sqrt(variance).toFixed(1));
    castConsistencyPct = Math.round(Math.max(15, Math.min(100, 100 - hueSpreadDeg * 5.2)));
    isMixedLighting = hueSpreadDeg > 10.5;
  }

  // Calculate Exposure Compensation to hit target skin IRE (EricRollei SkinLuminanceAdjust logic)
  const safeSkinLuma = Math.max(15, skinLuminanceIRE);
  const targetRatio = targetSkinIRE / safeSkinLuma;
  const exposureOffsetEV = totalSkinCount >= minThreshold
    ? Number(Math.max(-1.5, Math.min(1.5, Math.log2(targetRatio))).toFixed(2))
    : 0;

  // Absolute vector angle on vectorscope (ideal = 123.0°)
  const skinToneAngleDeg = Number((123.0 + avgDelta).toFixed(1));

  // Safe compensation injection calculation
  const MAX_TINT_CAP = 20;
  const MAX_TEMP_CAP = 20;
  const rawDeltaTint = -avgDelta * 2.8;
  const rawDeltaTemp = -(avgSat - 32) * 0.6;
  const clampedDeltaTint = Math.max(-MAX_TINT_CAP, Math.min(MAX_TINT_CAP, rawDeltaTint));
  const clampedDeltaTemp = Math.max(-MAX_TEMP_CAP, Math.min(MAX_TEMP_CAP, rawDeltaTemp));
  const compensationTint = totalSkinCount >= minThreshold ? Number(clampedDeltaTint.toFixed(1)) : 0;
  const compensationTemp = totalSkinCount >= minThreshold ? Number(clampedDeltaTemp.toFixed(1)) : 0;
  const compensationTempKelvin = totalSkinCount >= minThreshold ? Math.round(clampedDeltaTemp * 25) : 0;
  const vectorMagnitudeDeg = totalSkinCount >= minThreshold ? Number(Math.abs(avgDelta).toFixed(1)) : 0;

  let status: SkinToneAnalysisResult['status'] = 'undetermined';
  let statusLabel = 'Analyzing...';

  if (totalSkinCount >= minThreshold) {
    if (Math.abs(avgDelta) <= 2.8) {
      status = 'optimal';
      statusLabel = hasSelection
        ? `Isolated Face: Aligned (${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(1)}°)`
        : `On Target (${avgDelta >= 0 ? '+' : ''}${avgDelta.toFixed(1)}°)`;
    } else if (avgDelta > 2.8) {
      status = 'magenta_bias';
      statusLabel = hasSelection
        ? `Isolated Face: Magenta (+${avgDelta.toFixed(1)}°)`
        : `Shifted Magenta (+${avgDelta.toFixed(1)}°)`;
    } else {
      status = 'yellow_bias';
      statusLabel = hasSelection
        ? `Isolated Face: Yellow/Green (${avgDelta.toFixed(1)}°)`
        : `Shifted Yellow/Green (${avgDelta.toFixed(1)}°)`;
    }
  } else {
    status = 'undetermined';
    statusLabel = hasSelection ? 'No Skin in Box' : 'Low Skin Pixels Detected';
  }

  // 9. Draw Visual Vector Arrow (Delta Vector Compensation Indicator) on Vectorscope Canvas
  if (showSkinToneLine && totalSkinCount >= minThreshold && detectedPercentage > 0.4) {
    ctx.save();

    // Cluster centroid coordinates
    const clusterAngleRad = IDEAL_SKIN_ANGLE_RAD + (avgDelta * Math.PI) / 180;
    const clusterRadius = Math.max(0.18, Math.min(0.78, avgSat / 100)) * maxRadius;
    const clusterX = cx + Math.cos(clusterAngleRad) * clusterRadius;
    const clusterY = cy - Math.sin(clusterAngleRad) * clusterRadius;

    // Target coordinates on the ideal skin tone line
    const targetRadius = Math.max(0.20, Math.min(0.45, avgSat / 100)) * maxRadius;
    const targetX = cx + Math.cos(IDEAL_SKIN_ANGLE_RAD) * targetRadius;
    const targetY = cy - Math.sin(IDEAL_SKIN_ANGLE_RAD) * targetRadius;

    // Measured cluster centroid circle
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(clusterX, clusterY, 4.5, 0, Math.PI * 2);
    ctx.stroke();

    // Visual compensation arrow from cluster centroid to skin tone line target
    const dist = Math.hypot(targetX - clusterX, targetY - clusterY);
    if (dist > 3) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);

      ctx.beginPath();
      ctx.moveTo(clusterX, clusterY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead at target
      const angle = Math.atan2(targetY - clusterY, targetX - clusterX);
      const headLen = 6;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX - headLen * Math.cos(angle - Math.PI / 6), targetY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(targetX - headLen * Math.cos(angle + Math.PI / 6), targetY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();

      // Delta Meter Badge showing compensation values
      const midX = (clusterX + targetX) / 2;
      const midY = (clusterY + targetY) / 2;
      const badgeText = `Δ Tint ${compensationTint >= 0 ? '+' : ''}${compensationTint.toFixed(1)} | ${compensationTempKelvin >= 0 ? '+' : ''}${compensationTempKelvin}K`;

      ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(badgeText).width;

      ctx.fillStyle = 'rgba(10, 14, 22, 0.9)';
      ctx.fillRect(midX - textWidth / 2 - 4, midY - 6.5, textWidth + 8, 13);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(midX - textWidth / 2 - 4, midY - 6.5, textWidth + 8, 13);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText(badgeText, midX, midY);
    }

    ctx.restore();
  }

  // Restore vectorscope circular clipping
  ctx.restore();

  // Overlay HUD Badge for Isolated Skin Area
  if (hasSelection) {
    ctx.save();
    const badgeX = 8;
    ctx.fillStyle = 'rgba(23, 20, 15, 0.9)';
    ctx.fillRect(badgeX, 8, 126, 18);
    ctx.strokeStyle = '#e5b96f';
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, 8, 126, 18);
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#e5b96f';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎯 ISOLATED SKIN AREA', badgeX + 6, 17);
    ctx.restore();
  }

  const analysisResult: SkinToneAnalysisResult = {
    detectedCount: totalSkinCount,
    detectedPercentage,
    averageHueDeviationDeg: avgDelta,
    averageSaturation: avgSat,
    status,
    statusLabel,
    compensationTint,
    compensationTemp,
    compensationTempKelvin,
    vectorMagnitudeDeg,
    isSelectionIsolated: hasSelection,
    selectionPixelCount: hasSelection ? selectionPixels : undefined,
    selectionRelativePercentage: hasSelection ? selectionRelativePct : undefined,
    skinLuminanceIRE,
    targetSkinIRE,
    exposureOffsetEV,
    castConsistencyPct,
    hueSpreadDeg,
    isMixedLighting,
    skinToneAngleDeg
  };

  if (onAnalysis) {
    onAnalysis(analysisResult);
  }

  return analysisResult;
}
