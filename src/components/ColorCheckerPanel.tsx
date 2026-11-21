import React, { useState } from 'react';
import {
  ColorCheckerAnalysis,
  ColorAdjustments,
  ChartCorners,
  LutData,
  ChartType
} from '../types';
import {
  Grid,
  Sparkles,
  RotateCcw,
  Sliders,
  Crosshair,
  Maximize2,
  Wand2,
  AlertTriangle,
  Compass,
  CheckCircle2,
  Layers,
  Activity,
  Info
} from 'lucide-react';

interface ColorCheckerPanelProps {
  analysis: ColorCheckerAnalysis | null;
  corners: ChartCorners;
  onChangeCorners: (corners: ChartCorners) => void;
  overlayActive: boolean;
  onToggleOverlay: () => void;
  onAutoDetect: () => void;
  onResetCorners: () => void;
  adjustments: ColorAdjustments;
  onAdjustmentsChange: (adj: ColorAdjustments) => void;
  activeLut?: LutData | null;
  lutEnabled?: boolean;
  videoLoaded: boolean;
  sampleSource?: 'graded' | 'raw';
  onToggleSampleSource?: () => void;
  chartType?: ChartType;
  onChartTypeChange?: (type: ChartType) => void;
}

export const ColorCheckerPanel: React.FC<ColorCheckerPanelProps> = ({
  analysis,
  corners,
  onChangeCorners,
  overlayActive,
  onToggleOverlay,
  onAutoDetect,
  onResetCorners,
  adjustments,
  onAdjustmentsChange,
  videoLoaded,
  sampleSource = 'graded',
  onToggleSampleSource,
  chartType = 'video',
  onChartTypeChange
}) => {
  const [lastAdjustments, setLastAdjustments] = useState<ColorAdjustments | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [selectedPatchIdx, setSelectedPatchIdx] = useState<number | null>(null);
  const [wbStrength, setWbStrength] = useState<number>(100); // 0 to 100%
  const [showPatchGrid, setShowPatchGrid] = useState<boolean>(false);

  const effectiveChartType = analysis?.chartType || chartType;

  // 1-Click Auto White Balance
  const handleAutoWhiteBalance = () => {
    if (!analysis) return;
    const nb = analysis.neutralBalance;

    // Save previous state for undo
    setLastAdjustments({ ...adjustments });

    const factor = wbStrength / 100;
    const tempOffset = Math.round(nb.recommendedTemp * factor);
    const tintOffset = Math.round(nb.recommendedTint * factor);
    const expOffset = Number((nb.recommendedExposureEV * 0.5 * factor).toFixed(2));

    const newTemp = Math.max(-100, Math.min(100, adjustments.temperature + tempOffset));
    const newTint = Math.max(-100, Math.min(100, adjustments.tint + tintOffset));
    const newExp = Number(Math.max(-2.0, Math.min(2.0, adjustments.exposure + expOffset)).toFixed(2));

    onAdjustmentsChange({
      ...adjustments,
      temperature: newTemp,
      tint: newTint,
      exposure: newExp
    });

    const kelvinApplied = Math.round(nb.colorTempKelvinShift * factor);
    setFeedbackMessage(
      `✓ Neutralized White Balance: Temp ${tempOffset >= 0 ? '+' : ''}${tempOffset} (${kelvinApplied >= 0 ? '+' : ''}${kelvinApplied}K), Tint ${tintOffset >= 0 ? '+' : ''}${tintOffset}, Exp ${expOffset >= 0 ? '+' : ''}${expOffset} EV`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // 1-Click Full Calibration
  const handleFullCalibration = () => {
    if (!analysis) return;
    const nb = analysis.neutralBalance;

    setLastAdjustments({ ...adjustments });

    const factor = wbStrength / 100;
    const newTemp = Math.max(-100, Math.min(100, adjustments.temperature + Math.round(nb.recommendedTemp * factor)));
    const newTint = Math.max(-100, Math.min(100, adjustments.tint + Math.round(nb.recommendedTint * factor)));
    const newExp = Number(Math.max(-2.0, Math.min(2.0, adjustments.exposure + nb.recommendedExposureEV * 0.7 * factor)).toFixed(2));
    const newContrast = Number(Math.max(0.6, Math.min(1.4, adjustments.contrast * (1.0 + (nb.recommendedContrast - 1.0) * factor))).toFixed(2));

    onAdjustmentsChange({
      ...adjustments,
      temperature: newTemp,
      tint: newTint,
      exposure: newExp,
      contrast: newContrast
    });

    setFeedbackMessage(
      `✓ Calibration Applied: WB (${Math.round(nb.colorTempKelvinShift * factor)}K), Exp (${newExp} EV), Contrast (${newContrast})`
    );
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleUndo = () => {
    if (lastAdjustments) {
      onAdjustmentsChange(lastAdjustments);
      setLastAdjustments(null);
      setFeedbackMessage('Reverted to previous color grade.');
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  // Flip Chart Orientation (if chart is positioned upside down or mirrored)
  const handleFlipVertical = () => {
    onChangeCorners({
      tl: corners.bl,
      tr: corners.br,
      br: corners.tr,
      bl: corners.tl
    });
  };

  const handleFlipHorizontal = () => {
    onChangeCorners({
      tl: corners.tr,
      tr: corners.tl,
      br: corners.bl,
      bl: corners.br
    });
  };

  const nb = analysis?.neutralBalance;
  const avgDeltaE = analysis?.averageDeltaE ?? 0;
  const vTel = analysis?.videoTelemetry;
  const selectedPatch = selectedPatchIdx !== null ? analysis?.patches.find((p) => p.index === selectedPatchIdx) : null;

  // Video target specific groupings
  const skinPatches = analysis?.patches.filter((p) => p.category === 'skin') || [];
  const chromaticPatches = analysis?.patches.filter((p) => p.category === 'chromatic') || [];
  const grayscaleBars = analysis?.patches.filter((p) => p.index >= 14 && p.index <= 17) || [];

  return (
    <div className="bg-[#14161d] border border-[#262934] rounded-xl p-4 flex flex-col gap-4">
      {/* Top Header & Chart Switcher */}
      <div className="flex flex-col gap-3 pb-3 border-b border-[#242733]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#14232c] border border-[#1b4356] flex items-center justify-center text-cyan-400">
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#d5dae6] flex items-center gap-2">
                <span>
                  {effectiveChartType === 'video'
                    ? 'Calibrite ColorChecker Video'
                    : effectiveChartType === 'spyder24'
                    ? 'Datacolor SpyderCheckr 24'
                    : 'Calibrate ColorChecker Classic'}
                </span>
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-300">
                  {effectiveChartType === 'video'
                    ? 'Video Target'
                    : effectiveChartType === 'spyder24'
                    ? 'SpyderCheckr 24'
                    : '24-Patch Classic'}
                </span>
              </h3>
              <p className="text-[11px] text-[#71788a]">
                {effectiveChartType === 'video'
                  ? 'Skin Tone I-line • 4 Grayscale Bars (100, 40, 25, 0 IRE) • SMPTE Chromatics'
                  : effectiveChartType === 'spyder24'
                  ? 'Datacolor SpyderCheckr 24 official spectral data (D65) • 4×6 Grid • Neutral ramp'
                  : 'Semi-manual 4-corner perspective quad tool with chromatic & neutral calibration'}
              </p>
            </div>
          </div>

          {/* Source Toggle & Overlay toggle */}
          <div className="flex items-center gap-2">
            {onToggleSampleSource && (
              <button
                onClick={onToggleSampleSource}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  sampleSource === 'raw'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/80 hover:bg-amber-900/60'
                    : 'bg-[#1b2234] text-[#93c5fd] border-[#29426f] hover:bg-[#232e47]'
                }`}
                title="Toggle sampling between Graded WebGL output and Raw native video"
              >
                <span className="text-[#94a3b8]">Source:</span>
                <span className="font-mono">{sampleSource === 'raw' ? 'Raw Video' : 'Graded WebGL'}</span>
              </button>
            )}

            <button
              onClick={onToggleOverlay}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                overlayActive
                  ? 'bg-cyan-500 text-black font-bold border-cyan-400 shadow-md ring-2 ring-cyan-400/40'
                  : 'bg-[#1b2234] text-[#60a5fa] border-[#29426f] hover:bg-[#232e47]'
              }`}
              title="Toggle 4-corner interactive chart grid on video viewport"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{overlayActive ? 'Quad Overlay ON' : 'Show 4-Corner Quad'}</span>
            </button>
          </div>
        </div>

        {/* Target Format Switcher Tabs */}
        {onChartTypeChange && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#0d0f14] p-1 rounded-lg border border-[#202534]">
            <button
              onClick={() => onChartTypeChange('video')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                effectiveChartType === 'video'
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/70 shadow-sm'
                  : 'text-[#8b95a8] hover:text-[#dbe2ee] hover:bg-[#151924]'
              }`}
              title="Calibrite ColorChecker Video: 4 horizontal bars, skin tone column, and SMPTE chips"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Video Target (4-Bar IRE)</span>
            </button>
            <button
              onClick={() => onChartTypeChange('classic24')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                effectiveChartType === 'classic24'
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/70 shadow-sm'
                  : 'text-[#8b95a8] hover:text-[#dbe2ee] hover:bg-[#151924]'
              }`}
              title="X-Rite / Calibrite ColorChecker Classic: 24-patch standard photographic chart"
            >
              <Grid className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">Classic 24-Patch</span>
            </button>
            <button
              onClick={() => onChartTypeChange('spyder24')}
              className={`py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer truncate ${
                effectiveChartType === 'spyder24'
                  ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-600/70 shadow-sm'
                  : 'text-[#8b95a8] hover:text-[#dbe2ee] hover:bg-[#151924]'
              }`}
              title="Datacolor SpyderCHECKR 24: Official 24-patch spectral pigment data (D65)"
            >
              <Grid className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="truncate">SpyderCheckr 24</span>
            </button>
          </div>
        )}
      </div>

      {/* Live Measurement Source Indicator Banner */}
      <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
        sampleSource === 'raw'
          ? 'bg-amber-950/25 border-amber-800/40 text-amber-200'
          : 'bg-cyan-950/25 border-cyan-800/40 text-cyan-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${sampleSource === 'raw' ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400 animate-pulse'}`} />
          <span className="font-semibold">
            {sampleSource === 'raw' ? 'Measuring: Raw Camera Footage (Un-Graded Log)' : 'Measuring: Graded WebGL (Post-LUT & Grade)'}
          </span>
          <span className="text-[11px] opacity-75 hidden sm:inline">
            {sampleSource === 'raw'
              ? '— Analyzing flat camera/sensor patches to compute exact neutral white balance offset'
              : '— Analyzing active WebGL render to verify broadcast accuracy (target ΔE < 2.5)'}
          </span>
        </div>
        {onToggleSampleSource && (
          <button
            type="button"
            onClick={onToggleSampleSource}
            className="text-[11px] font-mono underline hover:opacity-100 opacity-90 cursor-pointer shrink-0 ml-2"
          >
            Switch to {sampleSource === 'raw' ? 'Graded WebGL' : 'Raw Video'}
          </button>
        )}
      </div>

      {feedbackMessage && (
        <div className="p-2.5 rounded-lg bg-cyan-950/70 border border-cyan-700/60 text-cyan-200 text-xs font-mono flex items-center justify-between animate-fade-in">
          <span>{feedbackMessage}</span>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-cyan-400 hover:text-white ml-2 text-xs"
          >
            &times;
          </button>
        </div>
      )}

      {/* 4-Corner Quad Positioning Controls */}
      <div className="bg-[#0f1118] p-3 rounded-lg border border-[#222736] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#f1f5f9]">4-Corner Quad Position</span>
            <span className="text-[10px] font-mono text-[#64748b]">
              Drag pins in video to wrap chart
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleFlipHorizontal}
              className="px-2 py-0.5 rounded bg-[#181d2a] hover:bg-[#232b3d] text-[#94a3b8] hover:text-[#f1f5f9] text-[10px] font-mono border border-[#262d3f] transition-colors cursor-pointer"
              title="Flip Left-Right"
            >
              Flip H
            </button>
            <button
              onClick={handleFlipVertical}
              className="px-2 py-0.5 rounded bg-[#181d2a] hover:bg-[#232b3d] text-[#94a3b8] hover:text-[#f1f5f9] text-[10px] font-mono border border-[#262d3f] transition-colors cursor-pointer"
              title="Flip Top-Bottom"
            >
              Flip V
            </button>
            <button
              onClick={onResetCorners}
              className="px-2 py-0.5 rounded bg-[#181d2a] hover:bg-[#232b3d] text-[#94a3b8] hover:text-[#f1f5f9] text-[10px] font-mono border border-[#262d3f] transition-colors cursor-pointer"
              title="Reset corners to standard center"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onAutoDetect}
            className="py-1.5 px-3 rounded-lg bg-gradient-to-r from-cyan-900/60 to-cyan-800/60 hover:from-cyan-800 hover:to-cyan-700 text-cyan-200 border border-cyan-600/50 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Automatically detect high-contrast ColorChecker edges in frame"
          >
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auto-Fit Chart</span>
          </button>

          <button
            onClick={() => {
              onChangeCorners({
                tl: { x: 0.22, y: 0.38 },
                tr: { x: 0.78, y: 0.28 },
                br: { x: 0.74, y: 0.72 },
                bl: { x: 0.26, y: 0.76 }
              });
            }}
            className="py-1.5 px-3 rounded-lg bg-[#181e2b] hover:bg-[#222b3d] text-[#cbd5e1] border border-[#29354d] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Apply angled perspective preset"
          >
            <Maximize2 className="w-3.5 h-3.5 text-[#94a3b8]" />
            <span>Angled Preset</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIDEO TARGET SPECIFIC MONITOR: 4 CENTER GRAYSCALE BARS & SKIN ANGLE */}
      {/* ===================================================================== */}
      {effectiveChartType === 'video' && (
        <div className="bg-[#10131c] rounded-xl p-3 border border-[#242b3d] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-[#f1f5f9]">Center Grayscale Ramp Monitor (4 Wide Bars)</span>
            </div>
            {vTel?.clippingHighlights && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Highlight Clipping
              </span>
            )}
            {vTel?.crushedShadows && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Crushed Shadows
              </span>
            )}
          </div>

          {/* 4 Wide Grayscale Bars Live Readout */}
          <div className="grid grid-cols-4 gap-2 text-[11px] font-mono">
            {/* White Bar */}
            <div className="bg-[#141824] p-2 rounded-lg border border-[#222a3d] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-[10px]">100 IRE White</span>
                <span className="text-[10px] text-[#64748b]">T: 100%</span>
              </div>
              <span className={`text-sm font-bold ${vTel && vTel.whiteIRE >= 95 && vTel.whiteIRE <= 102 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {vTel ? `${vTel.whiteIRE}% IRE` : '--'}
              </span>
              <div className="h-1.5 w-full bg-[#1e2330] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${Math.min(100, vTel?.whiteIRE ?? 100)}%` }}
                />
              </div>
            </div>

            {/* 40 IRE Midtone Gray Bar */}
            <div className="bg-[#141824] p-2 rounded-lg border border-cyan-800/70 ring-1 ring-cyan-500/30 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-cyan-300 text-[10px] font-semibold">40 IRE Midtone</span>
                <span className="text-[10px] text-cyan-400/70">Anchor</span>
              </div>
              <span className={`text-sm font-bold ${vTel && Math.abs(vTel.midGrayIRE - 40) <= 4 ? 'text-emerald-400' : 'text-cyan-300'}`}>
                {vTel ? `${vTel.midGrayIRE}% IRE` : '--'}
              </span>
              <div className="h-1.5 w-full bg-[#1e2330] rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${Math.min(100, ((vTel?.midGrayIRE ?? 40) / 60) * 100)}%` }}
                />
              </div>
            </div>

            {/* 25 IRE Dark Gray Bar */}
            <div className="bg-[#141824] p-2 rounded-lg border border-[#222a3d] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-[10px]">Dark Gray</span>
                <span className="text-[10px] text-[#64748b]">T: ~25%</span>
              </div>
              <span className="text-sm font-bold text-[#cbd5e1]">
                {vTel ? `${vTel.darkGrayIRE}% IRE` : '--'}
              </span>
              <div className="h-1.5 w-full bg-[#1e2330] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 transition-all"
                  style={{ width: `${Math.min(100, ((vTel?.darkGrayIRE ?? 25) / 50) * 100)}%` }}
                />
              </div>
            </div>

            {/* 0 IRE Black Bar */}
            <div className="bg-[#141824] p-2 rounded-lg border border-[#222a3d] flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[#94a3b8] text-[10px]">0 IRE Black</span>
                <span className="text-[10px] text-[#64748b]">T: 0-5%</span>
              </div>
              <span className={`text-sm font-bold ${vTel && vTel.blackIRE <= 6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {vTel ? `${vTel.blackIRE}% IRE` : '--'}
              </span>
              <div className="h-1.5 w-full bg-[#1e2330] rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-600 transition-all"
                  style={{ width: `${Math.min(100, Math.max(10, (vTel?.blackIRE ?? 0) * 5))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Skin Tone Vectorscope Alignment Telemetry */}
          {vTel && (
            <div className="p-2.5 rounded-lg bg-[#141824] border border-[#222a3d] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <div className="flex flex-col">
                  <span className="text-[#f1f5f9] font-bold">Skin Tone Line Alignment (6 Flesh Chips)</span>
                  <span className="text-[10px] text-[#94a3b8]">
                    Vectorscope Target: 123.0° I-Line &bull; Measured: {vTel.skinToneAngleDeg}°
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    Math.abs(vTel.skinToneDeviationDeg) <= 1.5
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700'
                      : Math.abs(vTel.skinToneDeviationDeg) <= 3.5
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-700'
                  }`}
                >
                  Δθ: {vTel.skinToneDeviationDeg >= 0 ? `+${vTel.skinToneDeviationDeg}` : vTel.skinToneDeviationDeg}°{' '}
                  {vTel.skinToneDeviationDeg > 0 ? '(Magenta)' : vTel.skinToneDeviationDeg < 0 ? '(Yellow)' : '(Aligned)'}
                </span>
              </div>
            </div>
          )}

          {/* 6 Skin Tone Swatches */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-[#94a3b8]">6 Skin Tone Chips (Left Column):</span>
            <div className="grid grid-cols-6 gap-1.5">
              {skinPatches.map((patch) => {
                const meas = patch.measuredRgb;
                const ref = patch.referenceSrgb;
                return (
                  <div
                    key={patch.index}
                    onClick={() => setSelectedPatchIdx(patch.index)}
                    className="flex flex-col rounded-md overflow-hidden border border-[#2b241c] bg-[#14120f] p-1 cursor-pointer hover:border-amber-500 transition-all"
                    title={`${patch.name}\nMeasured: rgb(${meas.join(',')})\nRef: rgb(${ref.join(',')})\nΔE: ${patch.deltaE.toFixed(1)}`}
                  >
                    <div className="h-5 w-full rounded overflow-hidden flex border border-black/40">
                      <div
                        className="w-1/2 h-full"
                        style={{ backgroundColor: `rgb(${meas[0]},${meas[1]},${meas[2]})` }}
                      />
                      <div
                        className="w-1/2 h-full"
                        style={{ backgroundColor: `rgb(${ref[0]},${ref[1]},${ref[2]})` }}
                      />
                    </div>
                    <span className="text-[8px] font-mono text-amber-300 truncate mt-0.5">{patch.name.replace('Skin ', '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Automated White Balance & Neutral Calibration Card */}
      <div className="bg-[#10131c] rounded-xl p-3 border border-[#242b3d] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-[#f1f5f9]">White Balance Automation</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/70 border border-amber-800/60 text-amber-300">
              {effectiveChartType === 'video' ? '40 IRE Gray Bar' : 'Row 4 Neutral Ramp'}
            </span>
          </div>

          {avgDeltaE > 0 && (
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${
                avgDeltaE <= 3.0
                  ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                  : avgDeltaE <= 6.5
                  ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                  : 'bg-rose-950/70 text-rose-300 border border-rose-800/60'
              }`}
            >
              Avg ΔE: {avgDeltaE} {avgDeltaE <= 3 ? '✓ Excellent' : avgDeltaE <= 6.5 ? 'Moderate' : 'High Error'}
            </span>
          )}
        </div>

        {/* Live White Balance Metrics */}
        {nb ? (
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-[#141824] p-2 rounded-lg border border-[#222a3d] flex flex-col gap-1">
              <span className="text-[#94a3b8] text-[10px]">Detected Color Cast</span>
              <span className="text-[#f1f5f9] font-bold truncate" title={nb.castDescription}>
                {nb.castDescription}
              </span>
              <div className="flex items-center gap-2 text-[10px] text-[#64748b] mt-0.5">
                <span>R: {nb.rGain}</span>
                <span>&bull;</span>
                <span>G: {nb.gGain}</span>
                <span>&bull;</span>
                <span>B: {nb.bGain}</span>
              </div>
            </div>

            <div className="bg-[#141824] p-2 rounded-lg border border-[#222a3d] flex flex-col gap-1">
              <span className="text-[#94a3b8] text-[10px]">Correction Needed</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-amber-400 font-bold">
                  Temp: {nb.recommendedTemp >= 0 ? `+${nb.recommendedTemp}` : nb.recommendedTemp} ({nb.colorTempKelvinShift >= 0 ? `+${nb.colorTempKelvinShift}` : nb.colorTempKelvinShift}K)
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-300">
                <span>Tint: {nb.recommendedTint >= 0 ? `+${nb.recommendedTint}` : nb.recommendedTint}</span>
                <span>&bull;</span>
                <span>Exp: {nb.recommendedExposureEV >= 0 ? `+${nb.recommendedExposureEV}` : nb.recommendedExposureEV} EV</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#64748b] font-mono p-2 bg-[#141824] rounded border border-[#222a3d]">
            Analyzing chart neutral patches…
          </div>
        )}

        {/* Correction Strength Control (0% to 100%) */}
        <div className="bg-[#141824] p-2.5 rounded-lg border border-[#222a3d] flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#94a3b8] flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-WB Correction Strength</span>
            </span>
            <span className="font-mono text-amber-300 font-bold">{wbStrength}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={wbStrength}
            onChange={(e) => setWbStrength(Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer accent-amber-400"
          />
          <div className="flex justify-between text-[9px] font-mono text-[#585f72]">
            <span>10% (Gentle)</span>
            <span>50% (Subtle)</span>
            <span>100% (Full Neutral)</span>
          </div>
        </div>

        {/* 1-Click Action Buttons */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoWhiteBalance}
              disabled={!analysis || !videoLoaded}
              className="flex-1 py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              title="Automatically balance Temperature and Tint based on ColorChecker neutral target"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>
                1-Click Auto White Balance
                {nb && (
                  <span className="ml-1 text-[10px] font-mono opacity-90">
                    ({nb.recommendedTemp >= 0 ? '+' : ''}{Math.round(nb.recommendedTemp * (wbStrength / 100))}T, {nb.recommendedTint >= 0 ? '+' : ''}{Math.round(nb.recommendedTint * (wbStrength / 100))}Tint)
                  </span>
                )}
              </span>
            </button>

            {lastAdjustments && (
              <button
                onClick={handleUndo}
                className="p-2 rounded-lg bg-[#1a1e2a] hover:bg-[#252a3b] border border-[#2d3548] text-[#94a3b8] hover:text-[#f1f5f9] transition-colors cursor-pointer"
                title="Undo last White Balance / Calibration adjustment"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleFullCalibration}
            disabled={!analysis || !videoLoaded}
            className="w-full py-1.5 px-2.5 rounded-lg bg-[#1a2333] hover:bg-[#232f45] border border-cyan-700/60 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Applies White Balance + Exposure + Contrast based on target patches"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {effectiveChartType === 'video'
                ? 'Calibrate Video Target (WB + 40 IRE Midtone + Contrast)'
                : effectiveChartType === 'spyder24'
                ? 'Calibrate SpyderCheckr 24 (WB + 60% Gray + Contrast)'
                : 'Full 24-Patch Chromatic Calibration (WB + Exp + Contrast)'}
            </span>
          </button>
        </div>
      </div>

      {/* 12 Chromatic SMPTE Color Chips (Right Column) in Video Target */}
      {effectiveChartType === 'video' && chromaticPatches.length > 0 && (
        <div className="bg-[#0f1118] p-3 rounded-lg border border-[#222736] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f1f5f9]">12 Chromatic SMPTE Chips (6 Pairs)</span>
            <span className="text-[10px] font-mono text-[#64748b]">Yellow &bull; Red &bull; Magenta &bull; Blue &bull; Cyan &bull; Green</span>
          </div>

          <div className="grid grid-cols-6 gap-1.5">
            {chromaticPatches.map((patch) => {
              const meas = patch.measuredRgb;
              const ref = patch.referenceSrgb;
              return (
                <div
                  key={patch.index}
                  onClick={() => setSelectedPatchIdx(patch.index)}
                  className="flex flex-col rounded-md overflow-hidden border border-[#232838] bg-[#12141c] p-1 cursor-pointer hover:border-cyan-400 transition-all"
                  title={`${patch.name}\nMeasured: rgb(${meas.join(',')})\nRef: rgb(${ref.join(',')})\nΔE: ${patch.deltaE.toFixed(1)}`}
                >
                  <div className="h-5 w-full rounded overflow-hidden flex border border-black/40">
                    <div
                      className="w-1/2 h-full"
                      style={{ backgroundColor: `rgb(${meas[0]},${meas[1]},${meas[2]})` }}
                    />
                    <div
                      className="w-1/2 h-full"
                      style={{ backgroundColor: `rgb(${ref[0]},${ref[1]},${ref[2]})` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[8px] font-mono mt-0.5">
                    <span className="text-[#94a3b8] truncate">{patch.name.split(' ')[0]}</span>
                    <span className={patch.deltaE <= 4 ? 'text-emerald-400' : 'text-amber-400'}>
                      {patch.deltaE.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Target Skin Exposure & Calibration Instructions */}
      <div className="bg-[#0f1118] p-3.5 rounded-lg border border-[#222736] flex flex-col gap-2.5">
        <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
          <Info className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Chart Skin Tone Target IRE Guidelines</span>
        </div>

        <div className="flex flex-col gap-2 text-xs leading-relaxed">
          <div
            className={`p-2.5 rounded border transition-colors ${
              effectiveChartType === 'video'
                ? 'bg-[#151c28] border-cyan-500/50 text-[#e2e8f0]'
                : 'bg-[#0b0d13] border-[#1d2230] text-[#94a3b8]'
            }`}
          >
            <p className="font-mono text-[11px] leading-snug">
              <span className={effectiveChartType === 'video' ? 'text-cyan-300 font-semibold' : 'text-[#cbd5e1] font-semibold'}>
                Calibrite Video Target (anchored around the 40 IRE mid-tone video bar):
              </span>{' '}
              Finalizes skin cleanly around 60–65 IRE (cinematic/standard balance).
            </p>
          </div>

          <div
            className={`p-2.5 rounded border transition-colors ${
              effectiveChartType === 'classic24'
                ? 'bg-[#151c28] border-cyan-500/50 text-[#e2e8f0]'
                : 'bg-[#0b0d13] border-[#1d2230] text-[#94a3b8]'
            }`}
          >
            <p className="font-mono text-[11px] leading-snug">
              <span className={effectiveChartType === 'classic24' ? 'text-cyan-300 font-semibold' : 'text-[#cbd5e1] font-semibold'}>
                Classic 24-Patch (standard photographic chart calibration):
              </span>{' '}
              Finalizes skin right around 65 IRE (the universal broadcast sweet spot).
            </p>
          </div>

          <div
            className={`p-2.5 rounded border transition-colors ${
              effectiveChartType === 'spyder24'
                ? 'bg-[#151c28] border-cyan-500/50 text-[#e2e8f0]'
                : 'bg-[#0b0d13] border-[#1d2230] text-[#94a3b8]'
            }`}
          >
            <p className="font-mono text-[11px] leading-snug">
              <span className={effectiveChartType === 'spyder24' ? 'text-cyan-300 font-semibold' : 'text-[#cbd5e1] font-semibold'}>
                SpyderCheckr 24 (anchored around the 60% gray patch):
              </span>{' '}
              Finalizes skin right around 65–70 IRE (punchier, bright commercial/outdoor look).
            </p>
          </div>
        </div>

        {/* Optional Collapsible 24-Patch Inspection for Classic / Spyder */}
        {(effectiveChartType === 'classic24' || effectiveChartType === 'spyder24') && (
          <div className="pt-2 border-t border-[#1e2330] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPatchGrid(!showPatchGrid)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-[#94a3b8] hover:text-[#e2e8f0] py-1 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>{showPatchGrid ? 'Hide 24-Patch Swatch Table' : 'Inspect 24-Patch Swatches (Measured vs Ref)'}</span>
              </button>
              {selectedPatch && showPatchGrid && (
                <button
                  type="button"
                  onClick={() => setSelectedPatchIdx(null)}
                  className="text-[10px] font-mono text-cyan-400 hover:underline cursor-pointer"
                >
                  Clear Focus
                </button>
              )}
            </div>

            {showPatchGrid && (
              <div className="grid grid-cols-6 gap-1.5 pt-1">
                {analysis?.patches.map((patch) => {
                  const isSelected = selectedPatchIdx === patch.index;
                  const isNeutral = patch.isNeutral;
                  const meas = patch.measuredRgb;
                  const ref = patch.referenceSrgb;

                  return (
                    <div
                      key={patch.index}
                      onClick={() => setSelectedPatchIdx(patch.index)}
                      className={`flex flex-col rounded-md overflow-hidden border p-1 cursor-pointer transition-all ${
                        isSelected
                          ? 'ring-2 ring-cyan-400 border-cyan-400 bg-[#1b2537]'
                          : isNeutral
                          ? 'border-amber-900/60 bg-[#14121a] hover:border-amber-600'
                          : 'border-[#22283a] bg-[#12151f] hover:border-[#38435f]'
                      }`}
                      title={`#${patch.index} ${patch.name}\nMeasured: rgb(${meas.join(',')})\nRef: rgb(${ref.join(',')})\nΔE: ${patch.deltaE.toFixed(1)}`}
                    >
                      <div className="h-6 w-full rounded overflow-hidden flex border border-black/40">
                        <div
                          className="w-1/2 h-full"
                          style={{ backgroundColor: `rgb(${meas[0]},${meas[1]},${meas[2]})` }}
                        />
                        <div
                          className="w-1/2 h-full"
                          style={{ backgroundColor: `rgb(${ref[0]},${ref[1]},${ref[2]})` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono mt-1">
                        <span className={isNeutral ? 'text-amber-400 font-bold' : 'text-[#94a3b8]'}>
                          #{patch.index}
                        </span>
                        <span
                          className={
                            patch.deltaE <= 3
                              ? 'text-emerald-400'
                              : patch.deltaE <= 6.5
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          Δ{patch.deltaE.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Focused Patch Readout */}
      {selectedPatch && (
        <div className="p-2.5 rounded bg-[#141926] border border-cyan-700/50 flex items-center justify-between gap-3 text-xs font-mono animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded border border-white/20 overflow-hidden flex shrink-0">
              <div
                className="w-1/2 h-full"
                style={{
                  backgroundColor: `rgb(${selectedPatch.measuredRgb[0]},${selectedPatch.measuredRgb[1]},${selectedPatch.measuredRgb[2]})`
                }}
              />
              <div
                className="w-1/2 h-full"
                style={{
                  backgroundColor: `rgb(${selectedPatch.referenceSrgb[0]},${selectedPatch.referenceSrgb[1]},${selectedPatch.referenceSrgb[2]})`
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#f1f5f9]">
                Patch #{selectedPatch.index}: {selectedPatch.name}
              </span>
              <span className="text-[10px] text-[#94a3b8]">
                Measured: rgb({selectedPatch.measuredRgb.join(', ')}) &bull; Target: rgb({selectedPatch.referenceSrgb.join(', ')})
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end shrink-0">
            <span className="text-[10px] text-[#64748b]">Color Error</span>
            <span
              className={`font-bold ${
                selectedPatch.deltaE <= 3
                  ? 'text-emerald-400'
                  : selectedPatch.deltaE <= 6.5
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              &Delta;E {selectedPatch.deltaE.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* 3x3 Color Correction Matrix (CCM) from solver */}
      {analysis?.ccm && (
        <div className="bg-[#0f1118] p-3 rounded-lg border border-[#222736] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#f1f5f9]">Fitted 3&times;3 Color Matrix (CCM)</span>
            <span className="text-[10px] font-mono text-[#64748b]">Rec.709 Matrix</span>
          </div>

          <div className="bg-[#090b10] p-2 rounded border border-[#1e2330] font-mono text-[11px] text-[#cbd5e1] grid grid-cols-3 gap-1 text-center">
            {analysis.ccm.map((val, idx) => (
              <span
                key={idx}
                className={idx % 4 === 0 ? 'text-cyan-400 font-bold' : 'text-[#818ea3]'}
              >
                {val.toFixed(3)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
