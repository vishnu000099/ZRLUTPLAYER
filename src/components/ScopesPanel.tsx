import React, { useRef, useEffect, useState } from 'react';
import {
  BarChart2,
  Eye,
  EyeOff,
  Compass,
  Activity,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Info,
  Maximize2,
  Wand2,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Gauge,
  ArrowRight,
  ArrowLeft,
  Crop,
  Sun,
  ShieldCheck,
  Target,
  Split,
  Layers,
  Scale
} from 'lucide-react';
import {
  computeHistogram,
  drawWaveform,
  drawVectorscope,
  SkinToneAnalysisResult,
  WaveformMode,
  WaveformPhosphor,
  WaveformMetrics,
  RGBChannelsVisible,
  RGBParadeMetrics
} from '../utils/scopesCalculator';
import { ColorAdjustments } from '../types';

import { WebGLPlayer } from '../utils/webglPlayer';

interface ScopesPanelProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  playerRef?: React.RefObject<WebGLPlayer | null>;
  videoLoaded: boolean;
  lutName?: string;
  lutEnabled?: boolean;
  adjustments?: ColorAdjustments;
  onAdjustmentsChange?: (adj: ColorAdjustments) => void;
  // Select Skin Area Picker Tool
  isSelectingSkinArea?: boolean;
  onStartSkinSelection?: () => void;
  onClearSkinSelection?: () => void;
  skinSelectionRect?: { x: number; y: number; width: number; height: number } | null;
  skinSelectionStats?: { pixelCount: number; framePercentage: number; width: number; height: number } | null;
  sampleSource?: 'graded' | 'raw';
  onToggleSampleSource?: () => void;
}

type ScopeLayout = 'all' | 'vectorscope' | 'waveform' | 'parade' | 'histogram';

export const ScopesPanel: React.FC<ScopesPanelProps> = ({
  canvasRef,
  videoRef,
  playerRef,
  videoLoaded,
  lutName,
  lutEnabled = true,
  adjustments,
  onAdjustmentsChange,
  isSelectingSkinArea = false,
  onStartSkinSelection,
  onClearSkinSelection,
  skinSelectionRect = null,
  skinSelectionStats = null,
  sampleSource = 'graded',
  onToggleSampleSource
}) => {
  const [scopesActive, setScopesActive] = useState<boolean>(true);
  const [scopeLayout, setScopeLayout] = useState<ScopeLayout>('all');
  const [internalSampleSource, setInternalSampleSource] = useState<'graded' | 'raw'>(sampleSource);
  const effectiveSampleSource = sampleSource ?? internalSampleSource;
  const handleToggleSource = onToggleSampleSource ?? (() => {
    setInternalSampleSource((prev) => (prev === 'graded' ? 'raw' : 'graded'));
  });

  // Vectorscope Skin Tone Controls
  const [showSkinToneLine, setShowSkinToneLine] = useState<boolean>(true);
  const [isolateSkin, setIsolateSkin] = useState<boolean>(false);
  const [traceGain, setTraceGain] = useState<number>(1.5);
  const [showToleranceWedge, setShowToleranceWedge] = useState<boolean>(true);
  const [targetSkinIRE, setTargetSkinIRE] = useState<number>(65);

  // Waveform Monitor & RGB Parade Controls
  const [waveformMode, setWaveformMode] = useState<WaveformMode>('rgb_parade');
  const [waveformPhosphor, setWaveformPhosphor] = useState<WaveformPhosphor>('amber');
  const [waveformIntensity, setWaveformIntensity] = useState<number>(1.2);
  const [waveformShowBands, setWaveformShowBands] = useState<boolean>(true);
  const [paradeChannels, setParadeChannels] = useState<RGBChannelsVisible>({
    r: true,
    g: true,
    b: true
  });
  const [waveformMetrics, setWaveformMetrics] = useState<WaveformMetrics>({
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
    exposureSummary: 'Analyzing exposure and brightness…'
  });

  // Auto-Neutralise State
  const [correctionStrength, setCorrectionStrength] = useState<number>(100);
  const [lastNeutralizedAdj, setLastNeutralizedAdj] = useState<ColorAdjustments | null>(null);
  const [lastNeutralizeFeedback, setLastNeutralizeFeedback] = useState<string | null>(null);

  // Live Skin Tone Analysis State (with EricRollei diagnostic metrics)
  const [skinAnalysis, setSkinAnalysis] = useState<SkinToneAnalysisResult>({
    detectedCount: 0,
    detectedPercentage: 0,
    averageHueDeviationDeg: 0,
    averageSaturation: 0,
    status: 'undetermined',
    statusLabel: 'Analyzing...',
    compensationTint: 0,
    compensationTemp: 0,
    compensationTempKelvin: 0,
    vectorMagnitudeDeg: 0,
    skinLuminanceIRE: 60,
    targetSkinIRE: 65,
    exposureOffsetEV: 0,
    castConsistencyPct: 100,
    hueSpreadDeg: 0,
    isMixedLighting: false,
    skinToneAngleDeg: 123.0
  });

  // Coverage condition: must be > 10% (or isolated box sample active)
  const isSkinEligible = skinAnalysis.detectedPercentage > 8 || !!skinAnalysis.isSelectionIsolated || !!skinSelectionRect;

  // 1-Click Hue Alignment (Tint & Temp)
  const handleNeutralizeSkin = () => {
    if (!adjustments || !onAdjustmentsChange || !isSkinEligible) return;

    const deltaDeg = skinAnalysis.averageHueDeviationDeg;
    const avgSat = skinAnalysis.averageSaturation;

    const rawDeltaTint = -deltaDeg * 2.8;
    const rawDeltaTemp = -(avgSat - 32) * 0.6;

    const MAX_TINT_CAP = 20;
    const MAX_TEMP_CAP = 20;
    const strengthFactor = correctionStrength / 100;

    const clampedDeltaTint = Math.max(-MAX_TINT_CAP, Math.min(MAX_TINT_CAP, rawDeltaTint)) * strengthFactor;
    const clampedDeltaTemp = Math.max(-MAX_TEMP_CAP, Math.min(MAX_TEMP_CAP, rawDeltaTemp)) * strengthFactor;

    const tintOffset = Math.round(clampedDeltaTint);
    const tempOffset = Math.round(clampedDeltaTemp);

    setLastNeutralizedAdj({ ...adjustments });

    const newTint = Math.max(-100, Math.min(100, adjustments.tint + tintOffset));
    const newTemp = Math.max(-100, Math.min(100, adjustments.temperature + tempOffset));

    onAdjustmentsChange({
      ...adjustments,
      tint: newTint,
      temperature: newTemp
    });

    setLastNeutralizeFeedback(
      `✓ Neutralized: Tint ${tintOffset >= 0 ? '+' : ''}${tintOffset}, Temp ${tempOffset >= 0 ? '+' : ''}${tempOffset} (Vector Δ: ${deltaDeg >= 0 ? '+' : ''}${deltaDeg.toFixed(1)}°)`
    );
    setTimeout(() => setLastNeutralizeFeedback(null), 5000);
  };

  // Full 3-Way Skin Calibration (Hue Alignment + Target Skin Luminance IRE)
  const handleFullSkinCalibration = () => {
    if (!adjustments || !onAdjustmentsChange || !isSkinEligible) return;

    const deltaDeg = skinAnalysis.averageHueDeviationDeg;
    const avgSat = skinAnalysis.averageSaturation;
    const expOffset = skinAnalysis.exposureOffsetEV || 0;

    const rawDeltaTint = -deltaDeg * 2.8;
    const rawDeltaTemp = -(avgSat - 32) * 0.6;

    const MAX_TINT_CAP = 20;
    const MAX_TEMP_CAP = 20;
    const strengthFactor = correctionStrength / 100;

    const clampedDeltaTint = Math.max(-MAX_TINT_CAP, Math.min(MAX_TINT_CAP, rawDeltaTint)) * strengthFactor;
    const clampedDeltaTemp = Math.max(-MAX_TEMP_CAP, Math.min(MAX_TEMP_CAP, rawDeltaTemp)) * strengthFactor;
    const clampedExp = Math.max(-0.6, Math.min(0.6, expOffset * 0.65)) * strengthFactor;

    const tintOffset = Math.round(clampedDeltaTint);
    const tempOffset = Math.round(clampedDeltaTemp);
    const newExp = Number(Math.max(-2.0, Math.min(2.0, adjustments.exposure + clampedExp)).toFixed(2));

    setLastNeutralizedAdj({ ...adjustments });

    const newTint = Math.max(-100, Math.min(100, adjustments.tint + tintOffset));
    const newTemp = Math.max(-100, Math.min(100, adjustments.temperature + tempOffset));

    onAdjustmentsChange({
      ...adjustments,
      tint: newTint,
      temperature: newTemp,
      exposure: newExp
    });

    setLastNeutralizeFeedback(
      `✓ 3-Way Calibration: Tint ${tintOffset >= 0 ? '+' : ''}${tintOffset}, Temp ${tempOffset >= 0 ? '+' : ''}${tempOffset}, Exp ${clampedExp >= 0 ? '+' : ''}${clampedExp.toFixed(2)} EV (Target ${targetSkinIRE}% IRE)`
    );
    setTimeout(() => setLastNeutralizeFeedback(null), 5000);
  };

  const handleUndoNeutralize = () => {
    if (lastNeutralizedAdj && onAdjustmentsChange) {
      onAdjustmentsChange(lastNeutralizedAdj);
      setLastNeutralizedAdj(null);
      setLastNeutralizeFeedback('Reverted to previous color grade');
      setTimeout(() => setLastNeutralizeFeedback(null), 3000);
    }
  };

  // RGB Parade Channel Visibility Controls
  const toggleChannel = (ch: 'r' | 'g' | 'b') => {
    setParadeChannels((prev) => {
      const next = { ...prev, [ch]: !prev[ch] };
      // Prevent all from being disabled simultaneously
      if (!next.r && !next.g && !next.b) {
        return { r: true, g: true, b: true };
      }
      return next;
    });
  };

  const soloChannel = (ch: 'r' | 'g' | 'b') => {
    setParadeChannels({
      r: ch === 'r',
      g: ch === 'g',
      b: ch === 'b'
    });
  };

  const resetAllChannels = () => {
    setParadeChannels({ r: true, g: true, b: true });
  };

  // 1-Click White Balance Alignment from Neutral Grey Card
  const handleAutoBalanceWBFromGreyCard = () => {
    if (!adjustments || !onAdjustmentsChange || !waveformMetrics.parade) return;
    const { wbBalance } = waveformMetrics.parade;
    // rbDelta: R - B in IRE. Positive means warm (Red higher than Blue). Negative means cool.
    const tempCorrection = -Math.round(wbBalance.rbDelta * 2.2);
    // rDelta: R - G, bDelta: B - G. If both are higher than G, magenta cast, so shift green (negative tint).
    const avgRB_vs_G = (wbBalance.rDelta + wbBalance.bDelta) / 2;
    const tintCorrection = -Math.round(avgRB_vs_G * 2.0);

    const newTemp = Math.max(-100, Math.min(100, adjustments.temperature + tempCorrection));
    const newTint = Math.max(-100, Math.min(100, adjustments.tint + tintCorrection));

    setLastNeutralizedAdj({ ...adjustments });
    onAdjustmentsChange({
      ...adjustments,
      temperature: newTemp,
      tint: newTint
    });

    setLastNeutralizeFeedback(
      `✓ WB Balanced: Temp ${tempCorrection >= 0 ? '+' : ''}${tempCorrection}, Tint ${tintCorrection >= 0 ? '+' : ''}${tintCorrection} (Grey Card Δ(R-B): ${wbBalance.rbDelta >= 0 ? '+' : ''}${wbBalance.rbDelta.toFixed(1)} IRE)`
    );
    setTimeout(() => setLastNeutralizeFeedback(null), 5000);
  };

  const vectorCanvasRef = useRef<HTMLCanvasElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);

  // Analysis offscreen downsampler canvas
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!scopesActive) return;

    // Immediately draw vectorscope graticules so the canvas is never black
    if (vectorCanvasRef.current) {
      drawVectorscope(vectorCanvasRef.current, new ImageData(2, 2), {
        showSkinToneLine,
        isolateSkin,
        traceGain,
        showToleranceWedge,
        targetSkinIRE,
        selectionRect: skinSelectionRect
      });
    }

    if (!videoLoaded) return;

    let animId = 0;
    let lastTime = 0;

    if (!sampleCanvasRef.current) {
      sampleCanvasRef.current = document.createElement('canvas');
      sampleCanvasRef.current.width = 180;
      sampleCanvasRef.current.height = 100;
    }

    const sampleCanvas = sampleCanvasRef.current;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    const updateScopes = (time: number) => {
      // Throttle scopes computation to ~15-20fps for optimal balance of smooth live tracking and GPU headroom
      if (time - lastTime > 55 && sampleCtx) {
        lastTime = time;
        try {
          let imageData: ImageData | null = null;

          if (playerRef?.current) {
            imageData = playerRef.current.getSampleImageData(
              effectiveSampleSource,
              videoRef?.current || null,
              180,
              100
            );
          } else if (effectiveSampleSource === 'raw' && videoRef?.current && videoRef.current.readyState >= 2) {
            sampleCtx.drawImage(videoRef.current, 0, 0, sampleCanvas.width, sampleCanvas.height);
            imageData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
          } else if (canvasRef.current && canvasRef.current.width > 0) {
            sampleCtx.drawImage(canvasRef.current, 0, 0, sampleCanvas.width, sampleCanvas.height);
            imageData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
          }

          if (imageData) {
            // 1. Draw Vectorscope & Skin Tone Indicator
            if (vectorCanvasRef.current) {
              drawVectorscope(vectorCanvasRef.current, imageData, {
                showSkinToneLine,
                isolateSkin,
                traceGain,
                showToleranceWedge,
                targetSkinIRE,
                step: 2,
                selectionRect: skinSelectionRect,
                onAnalysis: (res) => {
                  setSkinAnalysis(res);
                }
              });
            }

            // 2. Draw Waveform Monitor & RGB Parade
            if (waveCanvasRef.current && (scopeLayout === 'all' || scopeLayout === 'waveform' || scopeLayout === 'parade')) {
              drawWaveform(waveCanvasRef.current, imageData, {
                step: 2,
                mode: scopeLayout === 'parade' && waveformMode === 'luma' ? 'rgb_parade' : waveformMode,
                phosphor: waveformPhosphor,
                intensity: waveformIntensity,
                showBands: waveformShowBands,
                targetSkinIRE,
                visibleChannels: paradeChannels,
                onMetrics: (m) => setWaveformMetrics(m)
              });
            }

            // 3. Draw Histogram
            if (histCanvasRef.current && (scopeLayout === 'all' || scopeLayout === 'histogram')) {
              const hCanvas = histCanvasRef.current;
              const hCtx = hCanvas.getContext('2d');
              if (hCtx) {
                const hist = computeHistogram(imageData);
                const hw = hCanvas.width;
                const hh = hCanvas.height;

                hCtx.fillStyle = '#0a0c10';
                hCtx.fillRect(0, 0, hw, hh);

                // Grid lines
                hCtx.strokeStyle = '#222530';
                hCtx.lineWidth = 1;
                for (let i = 1; i <= 3; i++) {
                  const x = (i * hw) / 4;
                  hCtx.beginPath();
                  hCtx.moveTo(x, 0);
                  hCtx.lineTo(x, hh);
                  hCtx.stroke();
                }

                // Draw curves
                const drawCurve = (counts: Uint32Array, color: string) => {
                  hCtx.beginPath();
                  hCtx.strokeStyle = color;
                  hCtx.lineWidth = 1.2;
                  for (let i = 0; i < 256; i++) {
                    const x = (i / 255) * hw;
                    const y = hh - (counts[i] / hist.maxCount) * (hh - 10) - 2;
                    if (i === 0) hCtx.moveTo(x, y);
                    else hCtx.lineTo(x, y);
                  }
                  hCtx.stroke();
                };

                drawCurve(hist.r, 'rgba(239, 68, 68, 0.7)');
                drawCurve(hist.g, 'rgba(34, 197, 94, 0.7)');
                drawCurve(hist.b, 'rgba(59, 130, 246, 0.7)');
                drawCurve(hist.lum, 'rgba(245, 245, 245, 0.9)');
              }
            }
          }
        } catch {
          // Frame may be temporarily locked or rebuilding texture
        }
      }

      animId = requestAnimationFrame(updateScopes);
    };

    animId = requestAnimationFrame(updateScopes);
    return () => cancelAnimationFrame(animId);
  }, [
    scopesActive,
    videoLoaded,
    canvasRef,
    videoRef,
    playerRef,
    showSkinToneLine,
    isolateSkin,
    traceGain,
    showToleranceWedge,
    targetSkinIRE,
    scopeLayout,
    skinSelectionRect,
    effectiveSampleSource,
    adjustments,
    lutEnabled,
    lutName,
    waveformMode,
    waveformPhosphor,
    waveformIntensity,
    waveformShowBands,
    paradeChannels
  ]);

  return (
    <div className="bg-[#14161d] border border-[#262934] rounded-xl p-4 flex flex-col gap-4">
      {/* Top Header & Layout Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#242733]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#272118] border border-[#523e21] flex items-center justify-center text-[#e5b96f]">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#d5dae6] flex items-center gap-2">
              <span>Color Scopes & Skin Correction</span>
              {lutEnabled && lutName ? (
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-[#201d18] border border-[#523e21] text-[#e5b96f]">
                  LUT Active: {lutName.split(' ')[0]}
                </span>
              ) : (
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded bg-[#1e2029] border border-[#2e3342] text-[#8e95a5]">
                  LUT Bypassed / Native
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Graded vs Raw Source Selector */}
          <div className="flex items-center gap-1.5 bg-[#101217] px-2 py-1 rounded-lg border border-[#242733] text-xs">
            <span className="text-[10px] text-[#717b91]">Source:</span>
            <button
              type="button"
              onClick={handleToggleSource}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                effectiveSampleSource === 'graded'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-700/80 shadow-sm'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-700/80 shadow-sm'
              }`}
              title={
                effectiveSampleSource === 'graded'
                  ? 'Reading active Graded WebGL pixels (post-LUT, 3D color grading, EV, Kelvin shift)'
                  : 'Reading original Raw Camera Footage (un-graded sensor/log pixels)'
              }
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ backgroundColor: effectiveSampleSource === 'graded' ? '#06b6d4' : '#f59e0b' }}
              />
              <span>{effectiveSampleSource === 'graded' ? 'Graded (WebGL)' : 'Raw Footage'}</span>
            </button>
          </div>

          {/* Layout switcher tabs */}
          <div className="flex items-center bg-[#101217] p-0.5 rounded-lg border border-[#242733] text-xs">
            <button
              onClick={() => setScopeLayout('all')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                scopeLayout === 'all'
                  ? 'bg-[#292218] text-[#e5b96f] font-semibold'
                  : 'text-[#8e95a5] hover:text-[#d5dae6]'
              }`}
            >
              All Scopes
            </button>
            <button
              onClick={() => {
                setScopeLayout('parade');
                setWaveformMode('rgb_parade');
              }}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                scopeLayout === 'parade'
                  ? 'bg-[#292218] text-[#e5b96f] font-semibold shadow-sm'
                  : 'text-[#8e95a5] hover:text-[#d5dae6]'
              }`}
            >
              <Split className="w-3 h-3 text-[#e5b96f]" />
              <span>RGB Parade</span>
            </button>
            <button
              onClick={() => {
                setScopeLayout('waveform');
                setWaveformMode('luma');
              }}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                scopeLayout === 'waveform'
                  ? 'bg-[#292218] text-[#e5b96f] font-semibold shadow-sm'
                  : 'text-[#8e95a5] hover:text-[#d5dae6]'
              }`}
            >
              <Activity className="w-3 h-3 text-[#e5b96f]" />
              <span>Waveform</span>
            </button>
            <button
              onClick={() => setScopeLayout('vectorscope')}
              className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer ${
                scopeLayout === 'vectorscope'
                  ? 'bg-[#292218] text-[#e5b96f] font-semibold'
                  : 'text-[#8e95a5] hover:text-[#d5dae6]'
              }`}
            >
              <span>Vectorscope</span>
            </button>
            <button
              onClick={() => setScopeLayout('histogram')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                scopeLayout === 'histogram'
                  ? 'bg-[#292218] text-[#e5b96f] font-semibold'
                  : 'text-[#8e95a5] hover:text-[#d5dae6]'
              }`}
            >
              Histogram
            </button>
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setScopesActive(!scopesActive)}
            className={`text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              scopesActive
                ? 'bg-[#2b2518] text-[#e5b96f] border border-[#5c4623]'
                : 'bg-[#1e2029] text-[#7d8494] hover:text-[#c4c8d2] border border-[#2b2f3d]'
            }`}
          >
            {scopesActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{scopesActive ? 'Live' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* Live Measurement Source Indicator Banner */}
      <div className={`px-3 py-1.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
        effectiveSampleSource === 'raw'
          ? 'bg-amber-950/25 border-amber-800/40 text-amber-200'
          : 'bg-cyan-950/25 border-cyan-800/40 text-cyan-200'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${effectiveSampleSource === 'raw' ? 'bg-amber-400 animate-pulse' : 'bg-cyan-400 animate-pulse'}`} />
          <span className="font-semibold">
            {effectiveSampleSource === 'raw' ? 'Measuring: Raw Camera Log (Pre-Grade)' : 'Measuring: Graded WebGL (Post-LUT & Grade)'}
          </span>
          <span className="text-[11px] opacity-75 hidden sm:inline">
            {effectiveSampleSource === 'raw'
              ? '— Scopes analyzing un-graded camera sensor pixels'
              : '— Scopes analyzing live graded pixels (3D LUT, EV, Temp, Tint)'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggleSource}
          className="text-[11px] font-mono underline hover:opacity-100 opacity-90 cursor-pointer shrink-0 ml-2"
        >
          Switch to {effectiveSampleSource === 'raw' ? 'Graded WebGL' : 'Raw Footage'}
        </button>
      </div>

      {/* Main Scopes Display Area */}
      <div className="grid gap-3.5 grid-cols-1">
        {/* 1. Vectorscope with Advanced Skin Tone Diagnostics */}
        {(scopeLayout === 'all' || scopeLayout === 'vectorscope') && (
          <div className="flex flex-col gap-2.5 bg-[#101217] p-3 rounded-xl border border-[#222530] w-full">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span className="text-xs font-semibold text-[#c8cbd4]">
                  Vectorscope
                </span>
                <span className="text-[10px] font-mono text-[#e5b96f] bg-[#2a2319] border border-[#5c4723] px-1.5 py-0.2 rounded">
                  123° I-Line
                </span>
              </div>

              {/* Scope Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Tolerance Wedge Toggle */}
                <button
                  onClick={() => setShowToleranceWedge(!showToleranceWedge)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors border cursor-pointer ${
                    showToleranceWedge
                      ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                      : 'bg-[#181b24] text-[#6d7486] border-[#292c3a]'
                  }`}
                  title="Toggle Broadcast Safe Tolerance Cone (±2.8°)"
                >
                  Cone: {showToleranceWedge ? 'ON' : 'OFF'}
                </button>

                {/* Trace Gain */}
                <select
                  value={traceGain}
                  onChange={(e) => setTraceGain(Number(e.target.value))}
                  className="bg-[#1a1c24] text-[10px] font-mono text-[#c4c8d2] border border-[#292c3a] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                  title="Vectorscope Trace Gain / Brightness"
                >
                  <option value="1">1.0× Gain</option>
                  <option value="1.5">1.5× Gain</option>
                  <option value="2">2.0× Gain</option>
                  <option value="3">3.0× Gain</option>
                </select>
              </div>
            </div>

            {/* Select Skin Area Tool Bar */}
            <div className="bg-[#12151e] border border-[#272d3f] rounded-lg p-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-[#e5b96f]" />
                  <span className="text-[11px] font-bold text-[#f1f5f9]">
                    Select Skin Area Picker Tool
                  </span>
                </div>
                {skinSelectionRect ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-600/60 text-[#fbbf24] font-semibold animate-pulse">
                    🎯 Area Isolated
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#788295]">
                    Full Frame Analysis
                  </span>
                )}
              </div>

              {skinSelectionRect && skinSelectionStats ? (
                <div className="flex flex-col gap-1.5 bg-[#0a0c12] p-2 rounded border border-[#202738]">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#94a3b8]">Sample Rect:</span>
                    <span className="text-[#e2e8f0] font-bold">
                      {skinSelectionStats.width} &times; {skinSelectionStats.height} px
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#94a3b8]">Pixels Sampled:</span>
                    <span className="text-[#fbbf24] font-bold">
                      {skinSelectionStats.pixelCount.toLocaleString()} px ({skinSelectionStats.framePercentage.toFixed(2)}% of frame)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[#64748b]">
                    <span>Vectorscope trace strictly isolated to skin box</span>
                    <button
                      onClick={onClearSkinSelection}
                      className="text-rose-400 hover:text-rose-300 font-mono text-[11px] underline underline-offset-2 ml-2 cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#8691a6] leading-relaxed">
                  Click and drag a bounding box directly over the subject's face/exposed skin on the video to isolate only those pixels on the vectorscope.
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onStartSkinSelection}
                  className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    isSelectingSkinArea
                      ? 'bg-amber-500 text-black font-bold ring-2 ring-amber-300 shadow-md animate-pulse'
                      : skinSelectionRect
                      ? 'bg-[#292218] text-[#f2c77d] border border-[#705021] hover:bg-[#342918]'
                      : 'bg-[#1b2234] text-[#60a5fa] border border-[#29426f] hover:bg-[#232e47]'
                  }`}
                >
                  <Crop className="w-3.5 h-3.5" />
                  <span>
                    {isSelectingSkinArea
                      ? 'Drag Box on Video Now…'
                      : skinSelectionRect
                      ? 'Re-select Skin Area'
                      : 'Select Skin Area on Video'}
                  </span>
                </button>

                {skinSelectionRect && (
                  <button
                    onClick={onClearSkinSelection}
                    className="py-1.5 px-2.5 rounded text-xs font-mono bg-[#1c1417] text-rose-300 border border-rose-900/50 hover:bg-rose-950/70 transition-colors cursor-pointer"
                    title="Return to full frame vectorscope sampling"
                  >
                    Reset Full Frame
                  </button>
                )}
              </div>
            </div>

            {/* Circular Vectorscope Canvas */}
            <div className="relative aspect-square w-full max-h-[340px] mx-auto rounded-lg overflow-hidden border border-[#2b2f3e] bg-[#0a0c10] flex items-center justify-center">
              <canvas
                ref={vectorCanvasRef}
                width={320}
                height={320}
                className="w-full h-full max-w-[340px] max-h-[340px] object-contain block"
              />
            </div>

            {/* Real-time Skin Tone Alignment Diagnostics Card */}
            <div className="bg-[#141720] rounded-lg p-3 border border-[#262b3a] flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#c8cbd4] flex items-center gap-1.5">
                  <span>Skin Tone Alignment</span>
                  {skinAnalysis.status === 'optimal' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {(skinAnalysis.status === 'magenta_bias' || skinAnalysis.status === 'yellow_bias') && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </span>

                <span
                  className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                    skinAnalysis.status === 'optimal'
                      ? 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/60'
                      : skinAnalysis.status === 'magenta_bias'
                      ? 'bg-pink-950/70 text-pink-300 border border-pink-800/60'
                      : skinAnalysis.status === 'yellow_bias'
                      ? 'bg-amber-950/70 text-amber-300 border border-amber-800/60'
                      : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/50'
                  }`}
                >
                  {skinAnalysis.statusLabel}
                </span>
              </div>

              {/* EricRollei Diagnostic Grid (4 Core Metrics) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                {/* 1. Skin Hue Angle */}
                <div className="flex flex-col gap-1 bg-[#0f1117] p-2 rounded-lg border border-[#1f2330]">
                  <span className="text-[#7c8496] text-[10px]">Skin Vector Angle</span>
                  <div className="flex items-center justify-between">
                    <span className="text-[#f1f5f9] font-bold text-xs">
                      {skinAnalysis.skinToneAngleDeg}°
                    </span>
                    <span className="text-[10px] text-[#636a7b]">Ref: 123.0°</span>
                  </div>
                  <span className={`text-[10px] ${Math.abs(skinAnalysis.averageHueDeviationDeg) <= 2.8 ? 'text-emerald-400 font-semibold' : 'text-amber-400'}`}>
                    Δθ: {skinAnalysis.averageHueDeviationDeg >= 0 ? `+${skinAnalysis.averageHueDeviationDeg.toFixed(1)}°` : `${skinAnalysis.averageHueDeviationDeg.toFixed(1)}°`}
                  </span>
                </div>

                {/* 2. Skin Luminance (IRE) */}
                <div className="flex flex-col gap-1 bg-[#0f1117] p-2 rounded-lg border border-[#1f2330]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7c8496] text-[10px]">Skin Luma (IRE)</span>
                    <span className="text-[9px] text-[#636a7b]">T: {targetSkinIRE}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${Math.abs(skinAnalysis.skinLuminanceIRE - targetSkinIRE) <= 5 ? 'text-emerald-400' : 'text-[#f59e0b]'}`}>
                      {skinAnalysis.skinLuminanceIRE}% IRE
                    </span>
                    <span className="text-[10px] text-cyan-300">
                      {skinAnalysis.exposureOffsetEV >= 0 ? `+${skinAnalysis.exposureOffsetEV}` : skinAnalysis.exposureOffsetEV} EV
                    </span>
                  </div>
                  <div className="w-full bg-[#1e2230] h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full transition-all duration-150 ${Math.abs(skinAnalysis.skinLuminanceIRE - targetSkinIRE) <= 5 ? 'bg-emerald-400' : 'bg-[#f59e0b]'}`}
                      style={{ width: `${Math.min(100, skinAnalysis.skinLuminanceIRE)}%` }}
                    />
                  </div>
                </div>

                {/* 3. Cast Consistency / Lighting Uniformity */}
                <div className="flex flex-col gap-1 bg-[#0f1117] p-2 rounded-lg border border-[#1f2330]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7c8496] text-[10px]">Cast Consistency</span>
                    <span className="text-[9px] text-[#636a7b]">{skinAnalysis.hueSpreadDeg ? `±${skinAnalysis.hueSpreadDeg}°` : ''}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-xs ${skinAnalysis.castConsistencyPct >= 80 ? 'text-emerald-400' : skinAnalysis.castConsistencyPct >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {skinAnalysis.castConsistencyPct}%
                    </span>
                    <span className="text-[10px] text-[#8e95a5]">
                      {skinAnalysis.isMixedLighting ? 'Split Light' : 'Uniform'}
                    </span>
                  </div>
                  <div className="w-full bg-[#1e2230] h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className={`h-full transition-all duration-150 ${skinAnalysis.castConsistencyPct >= 80 ? 'bg-emerald-400' : skinAnalysis.castConsistencyPct >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                      style={{ width: `${Math.min(100, skinAnalysis.castConsistencyPct)}%` }}
                    />
                  </div>
                </div>

                {/* 4. Average Saturation */}
                <div className="flex flex-col gap-1 bg-[#0f1117] p-2 rounded-lg border border-[#1f2330]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#7c8496] text-[10px]">Saturation</span>
                    <span className="text-[9px] text-[#636a7b]">20–45%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#e5b96f] font-bold text-xs">
                      {skinAnalysis.averageSaturation.toFixed(0)}%
                    </span>
                    <span className="text-[10px] text-[#636a7b]">
                      {skinAnalysis.detectedCount} px
                    </span>
                  </div>
                  <div className="w-full bg-[#1e2230] h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-[#e5b96f] h-full transition-all duration-150"
                      style={{ width: `${Math.min(100, skinAnalysis.averageSaturation * 2)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Delta Meter & Vector Magnitude Indicator */}
              {(() => {
                const strengthFactor = correctionStrength / 100;
                const projectedTint = (skinAnalysis.compensationTint || 0) * strengthFactor;
                const projectedTempKelvin = Math.round((skinAnalysis.compensationTempKelvin || 0) * strengthFactor);
                const projectedExp = Number(((skinAnalysis.exposureOffsetEV || 0) * 0.65 * strengthFactor).toFixed(2));
                const magnitude = skinAnalysis.vectorMagnitudeDeg || 0;

                return (
                  <div className="bg-[#0f1118] rounded-lg p-2.5 border border-[#1f2434] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-[#38bdf8]" />
                        <span className="text-[11px] font-bold text-[#f1f5f9] tracking-tight">
                          Delta Meter &bull; Vector Magnitude
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#0b2234] border border-[#164e63] text-[#38bdf8]">
                        Matrix Compensation
                      </span>
                    </div>

                    {/* Vector directional compensation readout */}
                    <div className="bg-[#141824] p-2 rounded-lg border border-[#22293d] flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-md bg-[#0e2133] border border-[#174466] flex items-center justify-center shrink-0 text-[#38bdf8]"
                          title={
                            skinAnalysis.status === 'optimal'
                              ? 'Skin vector aligned with ideal skin tone line'
                              : skinAnalysis.averageHueDeviationDeg > 0
                              ? 'Compensates Magenta shift by pushing toward Green'
                              : 'Compensates Yellow/Green shift by pushing toward Magenta'
                          }
                        >
                          {skinAnalysis.status === 'optimal' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : skinAnalysis.averageHueDeviationDeg > 0 ? (
                            <ArrowLeft className="w-4 h-4 text-[#38bdf8] rotate-[-25deg]" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-[#38bdf8] rotate-[25deg]" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono text-[#8c96aa]">1-Click Injection:</span>
                            <span className="text-xs font-mono font-bold text-[#38bdf8]">
                              Tint: {projectedTint >= 0 ? `+${projectedTint.toFixed(1)}` : projectedTint.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-[#475569]">&bull;</span>
                            <span className="text-xs font-mono font-bold text-[#f59e0b]">
                              Temp: {projectedTempKelvin >= 0 ? `+${projectedTempKelvin}` : projectedTempKelvin}K
                            </span>
                            <span className="text-[10px] text-[#475569]">&bull;</span>
                            <span className="text-xs font-mono font-bold text-cyan-300">
                              Exp: {projectedExp >= 0 ? `+${projectedExp}` : projectedExp} EV
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-[#627084] truncate">
                            {skinAnalysis.status === 'optimal'
                              ? 'Skin vector on target (< ±2.8°)'
                              : skinAnalysis.averageHueDeviationDeg > 0
                              ? `Vector shifted Magenta (+${skinAnalysis.averageHueDeviationDeg.toFixed(1)}°) → Injects Green & WB balance`
                              : `Vector shifted Yellow (${skinAnalysis.averageHueDeviationDeg.toFixed(1)}°) → Injects Magenta & WB balance`}
                          </span>
                        </div>
                      </div>

                      {/* Magnitude gauge value */}
                      <div className="flex flex-col items-end shrink-0 pl-2 border-l border-[#242b3e]">
                        <span className="text-[9px] font-mono uppercase text-[#627084]">Magnitude</span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            magnitude <= 2.8
                              ? 'text-emerald-400'
                              : magnitude <= 8
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {magnitude.toFixed(1)}°
                        </span>
                      </div>
                    </div>

                    {/* Magnitude Meter Bar with Broadcast Tolerance zones */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-[9px] font-mono text-[#627084]">
                        <span>0° (Aligned)</span>
                        <span className="text-emerald-500 font-semibold">2.8° Target</span>
                        <span className="text-amber-500">8° Warning</span>
                        <span className="text-rose-500">18° Max</span>
                      </div>
                      <div className="relative w-full h-1.5 bg-[#181d2a] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-150 ${
                            magnitude <= 2.8
                              ? 'bg-emerald-400'
                              : magnitude <= 8
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                          style={{
                            width: `${Math.min(100, (magnitude / 18) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Block: EricRollei-Inspired Skin Correction Actions */}
              <div className="bg-[#101218] p-2.5 rounded-lg border border-[#232734] flex flex-col gap-2 mt-0.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#e5b96f]" />
                    <span className="text-[11px] font-bold text-[#f0f3f8]">
                      Auto Skin Tone Calibration
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#2b2416] text-[#e5b96f] border border-[#574221]">
                      1-Click
                    </span>
                  </div>

                  {/* Target Skin Exposure & Strength Selectors */}
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <div className="flex items-center gap-1">
                      <span className="text-[#7d8598]">Target IRE:</span>
                      <select
                        value={targetSkinIRE}
                        onChange={(e) => setTargetSkinIRE(Number(e.target.value))}
                        className="bg-[#171922] text-[#e5b96f] border border-[#3b3425] rounded px-1.5 py-0.5 outline-none cursor-pointer text-[10px] font-mono"
                        title="Target skin exposure benchmark on IRE scale"
                      >
                        <optgroup label="Camera Log Profiles" className="bg-[#12141a] text-[#8ea5cc]">
                          <option value="35">35% IRE (N-Log / Nikon ZR)</option>
                          <option value="37">37% IRE (C-Log3 / Canon Log 3)</option>
                          <option value="39">39% IRE (RED Log / Nikon ZR)</option>
                          <option value="42">42% IRE (V-Log / Panasonic)</option>
                        </optgroup>
                        <optgroup label="Rec.709 Graded Standards" className="bg-[#12141a] text-[#e5b96f]">
                          <option value="60">60% IRE (Cinematic / Rich)</option>
                          <option value="65">65% IRE (Broadcast Standard)</option>
                          <option value="70">70% IRE (Bright / Fair)</option>
                        </optgroup>
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[#7d8598]">Strength:</span>
                      {[25, 50, 75, 100].map((str) => (
                        <button
                          key={str}
                          onClick={() => setCorrectionStrength(str)}
                          className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                            correctionStrength === str
                              ? 'bg-[#2b2416] text-[#e5b96f] font-semibold border border-[#574221]'
                              : 'bg-[#171922] text-[#8c94a6] hover:text-[#d0d6e4]'
                          }`}
                          title={`${str}% vector correction strength`}
                        >
                          {str}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons: Hue Neutralize vs 3-Way Full Calibration */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  {isSkinEligible ? (
                    <>
                      <button
                        onClick={handleNeutralizeSkin}
                        className="flex-1 w-full py-2 px-3 rounded-lg bg-gradient-to-r from-[#e5b96f] to-[#f5d496] hover:from-[#f0c883] hover:to-[#fae2ab] text-[#14120c] font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                        title="Translates vector angular error to Tint & Temp offsets"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-[#14120c]" />
                        <span>Neutralise Skin (Tint & Temp)</span>
                        <span className="text-[10px] font-mono opacity-80 font-normal">
                          ({skinAnalysis.detectedPercentage.toFixed(1)}% coverage)
                        </span>
                      </button>

                      <button
                        onClick={handleFullSkinCalibration}
                        className="flex-1 w-full py-2 px-3 rounded-lg bg-[#1a2536] hover:bg-[#22334b] text-cyan-300 font-bold text-xs flex items-center justify-center gap-2 border border-cyan-700/60 transition-all active:scale-[0.98] cursor-pointer"
                        title="Aligns hue to 123° I-line AND adjusts exposure to hit target skin IRE (3-Way Skin Calibration)"
                      >
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        <span>3-Way Skin Calibration ({targetSkinIRE}% IRE)</span>
                      </button>
                    </>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2 px-3 rounded-lg bg-[#181a23] border border-[#262a38] text-[#6d7486] font-medium text-xs flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
                      title="Skin coverage must be above 8% to prevent inaccurate neutralizations on background objects"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-[#a87a38]" />
                      <span>Neutralise Disabled: Coverage {skinAnalysis.detectedPercentage.toFixed(1)}% (Needs &gt;8%)</span>
                    </button>
                  )}

                  {lastNeutralizedAdj && (
                    <button
                      onClick={handleUndoNeutralize}
                      className="py-2 px-3 rounded-lg bg-[#202330] hover:bg-[#2c3042] text-[#c4c9d6] hover:text-[#f0f3f8] text-xs font-semibold flex items-center gap-1.5 border border-[#353b4e] transition-colors shrink-0 cursor-pointer"
                      title="Revert to previous color grading before neutralization"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#e5b96f]" />
                      <span>Undo</span>
                    </button>
                  )}
                </div>

                {/* Real-time Applied Toast / Feedback */}
                {lastNeutralizeFeedback && (
                  <div className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-md flex items-center justify-between animate-in fade-in duration-150">
                    <span>{lastNeutralizeFeedback}</span>
                    <span className="text-[10px] text-emerald-500/80">I-Axis Locked</span>
                  </div>
                )}
              </div>

              {/* Colorist Guidance Note */}
              <p className="text-[10px] text-[#8e95a7] leading-relaxed flex items-start gap-1">
                <Info className="w-3 h-3 text-[#e5b96f] shrink-0 mt-0.5" />
                <span>
                  {skinAnalysis.status === 'optimal'
                    ? 'Skin hues align along the I-axis. Melanin pigmentation is accurately rendered under current LUT.'
                    : skinAnalysis.status === 'magenta_bias'
                    ? 'Skin hues pull warm magenta (+Δ°). Adjust Tint towards green or reduce magenta in Color Grading.'
                    : skinAnalysis.status === 'yellow_bias'
                    ? 'Skin hues pull olive/yellow (-Δ°). Adjust Tint towards magenta or warm red in Color Grading.'
                    : 'Point frame towards subjects or drag face bounding box to measure melanin vectorscope alignment.'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* 2. Waveform Monitor & RGB Parade */}
        {(scopeLayout === 'all' || scopeLayout === 'waveform' || scopeLayout === 'parade') && (
          <div className="flex flex-col gap-3 bg-[#101217] p-3.5 rounded-xl border border-[#222530] w-full">
            {/* Header & Mode Controls */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#1c1f29]">
              <div className="flex items-center gap-2">
                {waveformMode === 'rgb_parade' ? (
                  <Split className="w-4 h-4 text-[#e5b96f]" />
                ) : (
                  <Activity className="w-4 h-4 text-[#e5b96f]" />
                )}
                <span className="text-xs font-bold text-[#f1f4f9]">
                  {waveformMode === 'rgb_parade'
                    ? 'RGB Parade'
                    : waveformMode === 'rgb_overlay'
                    ? 'Combined RGB Overlay'
                    : 'Waveform Monitor'}
                </span>
                <span className="text-[10px] font-mono text-[#8c94a6] hidden sm:inline">
                  {waveformMode === 'rgb_parade'
                    ? '— Individual Channel Balance & White Balance'
                    : waveformMode === 'rgb_overlay'
                    ? '— Superimposed Channel Alignment'
                    : '— Photometric Exposure & Brightness'}
                </span>

                {/* Status Badges */}
                {waveformMetrics.parade?.individualChannelClipping.isLumaSafeWhileChannelClips ? (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-semibold border bg-rose-950/80 text-rose-300 border-rose-600 animate-pulse">
                    ⚠️ {waveformMetrics.parade.individualChannelClipping.clippedChannels.join(' & ')} Clipping
                  </span>
                ) : waveformMetrics.isOverRange ? (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-semibold border bg-rose-950/80 text-rose-300 border-rose-800/80 animate-pulse">
                    Over-range ({waveformMetrics.overRangePct.toFixed(1)}% &gt; 100 IRE)
                  </span>
                ) : waveformMetrics.isUnderRange ? (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-semibold border bg-amber-950/80 text-amber-300 border-amber-800/80">
                    Sub-Black Warning (&lt; 0 IRE)
                  </span>
                ) : (
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-semibold border bg-emerald-950/70 text-emerald-400 border-emerald-800/60">
                    Broadcast Safe (0–100 IRE)
                  </span>
                )}
              </div>

              {/* Mode, Channel Toggles & Display Controls */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mode Switcher: RGB Parade / Combined View / Luma */}
                <div className="flex items-center p-0.5 bg-[#171922] rounded border border-[#2a2d3a] text-[10px] font-mono">
                  <button
                    onClick={() => setWaveformMode('rgb_parade')}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                      waveformMode === 'rgb_parade'
                        ? 'bg-[#2b2416] text-[#e5b96f] font-semibold border border-[#5c4723]'
                        : 'text-[#828a9b] hover:text-[#d3d9e4]'
                    }`}
                    title="RGB Parade: Displays Red, Green, and Blue channels separately across individual columns"
                  >
                    <Split className="w-2.5 h-2.5" />
                    <span>RGB Parade</span>
                  </button>
                  <button
                    onClick={() => setWaveformMode('rgb_overlay')}
                    className={`px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer ${
                      waveformMode === 'rgb_overlay'
                        ? 'bg-[#2b2416] text-[#e5b96f] font-semibold border border-[#5c4723]'
                        : 'text-[#828a9b] hover:text-[#d3d9e4]'
                    }`}
                    title="Combined View (RGB Overlay): Superimposed R, G, B traces reveal color casts across exposure"
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>Combined View</span>
                  </button>
                  <button
                    onClick={() => setWaveformMode('luma')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      waveformMode === 'luma'
                        ? 'bg-[#2b2416] text-[#e5b96f] font-semibold border border-[#5c4723]'
                        : 'text-[#828a9b] hover:text-[#d3d9e4]'
                    }`}
                    title="Luma (Y): High-resolution photometric luminance waveform"
                  >
                    Luma (Y)
                  </button>
                </div>

                {/* Individual Channel Visibility Toggles (Parade & Overlay Modes) */}
                {waveformMode !== 'luma' && (
                  <div className="flex items-center gap-1 bg-[#13161f] p-0.5 rounded border border-[#262c3e] text-[10px] font-mono">
                    <span className="text-[#64748b] px-1 text-[9px] uppercase hidden sm:inline">Channels:</span>
                    <button
                      onClick={() => toggleChannel('r')}
                      className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
                        paradeChannels.r
                          ? 'bg-red-950/90 text-red-300 border border-red-700/80 shadow-sm'
                          : 'bg-[#181a22] text-neutral-500 border border-transparent opacity-60 line-through'
                      }`}
                      title="Toggle Red Channel visibility"
                    >
                      Red
                    </button>
                    <button
                      onClick={() => toggleChannel('g')}
                      className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
                        paradeChannels.g
                          ? 'bg-green-950/90 text-green-300 border border-green-700/80 shadow-sm'
                          : 'bg-[#181a22] text-neutral-500 border border-transparent opacity-60 line-through'
                      }`}
                      title="Toggle Green Channel visibility"
                    >
                      Green
                    </button>
                    <button
                      onClick={() => toggleChannel('b')}
                      className={`px-2 py-0.5 rounded transition-all font-bold cursor-pointer ${
                        paradeChannels.b
                          ? 'bg-blue-950/90 text-blue-300 border border-blue-700/80 shadow-sm'
                          : 'bg-[#181a22] text-neutral-500 border border-transparent opacity-60 line-through'
                      }`}
                      title="Toggle Blue Channel visibility"
                    >
                      Blue
                    </button>
                    <button
                      onClick={resetAllChannels}
                      className="px-1.5 py-0.5 rounded bg-[#1e2230] text-[#94a3b8] hover:text-[#f1f5f9] text-[9px] cursor-pointer"
                      title="Reset all channels to visible (3-Ch Parade)"
                    >
                      All
                    </button>
                    <div className="flex items-center gap-0.5 ml-0.5 border-l border-[#2d354a] pl-1 text-[9px]">
                      <span className="text-[#64748b]">Solo:</span>
                      <button
                        onClick={() => soloChannel('r')}
                        className="px-1 py-0.5 text-red-400 hover:text-red-300 cursor-pointer font-bold"
                        title="Solo Red Channel"
                      >
                        R
                      </button>
                      <button
                        onClick={() => soloChannel('g')}
                        className="px-1 py-0.5 text-green-400 hover:text-green-300 cursor-pointer font-bold"
                        title="Solo Green Channel"
                      >
                        G
                      </button>
                      <button
                        onClick={() => soloChannel('b')}
                        className="px-1 py-0.5 text-blue-400 hover:text-blue-300 cursor-pointer font-bold"
                        title="Solo Blue Channel"
                      >
                        B
                      </button>
                    </div>
                  </div>
                )}

                {/* Phosphor Theme (when Luma mode active) */}
                {waveformMode === 'luma' && (
                  <select
                    value={waveformPhosphor}
                    onChange={(e) => setWaveformPhosphor(e.target.value as WaveformPhosphor)}
                    className="bg-[#171922] text-[10px] font-mono text-[#c4c8d2] border border-[#2a2d3a] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                    title="Trace Phosphor Color"
                  >
                    <option value="amber">Amber Phosphor</option>
                    <option value="green">Green (P1)</option>
                    <option value="cyan">Digital Cyan</option>
                    <option value="white">Neutral White</option>
                  </select>
                )}

                {/* Gain / Intensity */}
                <select
                  value={waveformIntensity}
                  onChange={(e) => setWaveformIntensity(Number(e.target.value))}
                  className="bg-[#171922] text-[10px] font-mono text-[#c4c8d2] border border-[#2a2d3a] rounded px-1.5 py-0.5 outline-none cursor-pointer"
                  title="Waveform Trace Intensity"
                >
                  <option value="0.8">0.8× Trace</option>
                  <option value="1.2">1.2× Trace</option>
                  <option value="1.6">1.6× Trace</option>
                  <option value="2.0">2.0× Trace</option>
                </select>

                {/* IRE Band Guides Toggle */}
                <button
                  onClick={() => setWaveformShowBands(!waveformShowBands)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors border cursor-pointer ${
                    waveformShowBands
                      ? 'bg-amber-950/70 text-[#e5b96f] border-amber-800/60 font-semibold'
                      : 'bg-[#181b24] text-[#6d7486] border-[#292c3a]'
                  }`}
                  title="Toggle Rec.709 IRE interpretation guide bands (0, 10-20, 40-60, 60-75, 90-100, >100)"
                >
                  IRE Bands: {waveformShowBands ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Waveform / Parade Canvas */}
            <div className="relative w-full aspect-[2.2/1] min-h-[190px] max-h-[300px] rounded-lg overflow-hidden border border-[#2b2f3e] bg-[#07090e]">
              <canvas
                ref={waveCanvasRef}
                width={560}
                height={260}
                className="w-full h-full object-fill block"
              />
            </div>

            {/* Hidden / Independent Channel Clipping Alert Banner */}
            {waveformMetrics.parade?.individualChannelClipping.hasClipping && (
              <div className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                waveformMetrics.parade.individualChannelClipping.isLumaSafeWhileChannelClips
                  ? 'bg-rose-950/70 border-rose-500/80 text-rose-200'
                  : 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              }`}>
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-rose-300 flex items-center gap-1.5">
                    <span>
                      {waveformMetrics.parade.individualChannelClipping.isLumaSafeWhileChannelClips
                        ? '⚠️ Hidden Channel Clipping Detected (Luma Waveform Appears Safe!)'
                        : '⚠️ RGB Channel Over-Range Clipping Detected'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-900/80 border border-rose-600 text-rose-100">
                      Clipped: {waveformMetrics.parade.individualChannelClipping.clippedChannels.join(', ')}
                    </span>
                  </span>
                  <p className="text-[11px] leading-relaxed text-rose-200/90 font-mono">
                    {waveformMetrics.parade.individualChannelClipping.summary}
                  </p>
                </div>
              </div>
            )}

            {/* RGB 3-Channel Metering & Clipping Inspector */}
            {waveformMetrics.parade && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
                {/* Red Channel Card */}
                <div className={`p-2.5 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                  waveformMetrics.parade.r.isClipping
                    ? 'bg-rose-950/35 border-rose-800/60 shadow-sm'
                    : 'bg-[#12151e] border-[#222838]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span>RED CHANNEL</span>
                      {!paradeChannels.r && (
                        <span className="text-[9px] text-[#64748b] font-normal">(Hidden)</span>
                      )}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      waveformMetrics.parade.r.isClipping
                        ? 'bg-rose-900/80 text-rose-200 border border-rose-600 animate-pulse'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    }`}>
                      {waveformMetrics.parade.r.isClipping
                        ? `CLIP (${waveformMetrics.parade.r.overRangePct.toFixed(1)}% &gt; 100)`
                        : 'Safe (0–100)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-[#1d2232]">
                    <div>
                      <span className="text-[9px] text-[#788295] block">Peak IRE</span>
                      <span className={`font-bold ${waveformMetrics.parade.r.maxIRE > 100 ? 'text-rose-400' : 'text-[#f1f5f9]'}`}>
                        {waveformMetrics.parade.r.maxIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Midtones</span>
                      <span className="text-amber-300 font-bold">
                        {waveformMetrics.parade.r.midtonesIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Mean Level</span>
                      <span className="text-[#cbd5e1]">
                        {waveformMetrics.parade.r.avgIRE.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1f2c] rounded-full overflow-hidden mt-0.5 relative">
                    <div
                      className={`h-full transition-all duration-150 ${waveformMetrics.parade.r.maxIRE > 100 ? 'bg-rose-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (waveformMetrics.parade.r.maxIRE / 110) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Green Channel Card */}
                <div className={`p-2.5 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                  waveformMetrics.parade.g.isClipping
                    ? 'bg-rose-950/35 border-rose-800/60 shadow-sm'
                    : 'bg-[#12151e] border-[#222838]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-green-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      <span>GREEN CHANNEL</span>
                      {!paradeChannels.g && (
                        <span className="text-[9px] text-[#64748b] font-normal">(Hidden)</span>
                      )}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      waveformMetrics.parade.g.isClipping
                        ? 'bg-rose-900/80 text-rose-200 border border-rose-600 animate-pulse'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    }`}>
                      {waveformMetrics.parade.g.isClipping
                        ? `CLIP (${waveformMetrics.parade.g.overRangePct.toFixed(1)}% &gt; 100)`
                        : 'Safe (0–100)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-[#1d2232]">
                    <div>
                      <span className="text-[9px] text-[#788295] block">Peak IRE</span>
                      <span className={`font-bold ${waveformMetrics.parade.g.maxIRE > 100 ? 'text-rose-400' : 'text-[#f1f5f9]'}`}>
                        {waveformMetrics.parade.g.maxIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Midtones</span>
                      <span className="text-emerald-300 font-bold">
                        {waveformMetrics.parade.g.midtonesIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Mean Level</span>
                      <span className="text-[#cbd5e1]">
                        {waveformMetrics.parade.g.avgIRE.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1f2c] rounded-full overflow-hidden mt-0.5 relative">
                    <div
                      className={`h-full transition-all duration-150 ${waveformMetrics.parade.g.maxIRE > 100 ? 'bg-rose-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.min(100, (waveformMetrics.parade.g.maxIRE / 110) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Blue Channel Card */}
                <div className={`p-2.5 rounded-lg border flex flex-col gap-1.5 transition-colors ${
                  waveformMetrics.parade.b.isClipping
                    ? 'bg-rose-950/35 border-rose-800/60 shadow-sm'
                    : 'bg-[#12151e] border-[#222838]'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>BLUE CHANNEL</span>
                      {!paradeChannels.b && (
                        <span className="text-[9px] text-[#64748b] font-normal">(Hidden)</span>
                      )}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      waveformMetrics.parade.b.isClipping
                        ? 'bg-rose-900/80 text-rose-200 border border-rose-600 animate-pulse'
                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                    }`}>
                      {waveformMetrics.parade.b.isClipping
                        ? `CLIP (${waveformMetrics.parade.b.overRangePct.toFixed(1)}% &gt; 100)`
                        : 'Safe (0–100)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[11px] pt-1 border-t border-[#1d2232]">
                    <div>
                      <span className="text-[9px] text-[#788295] block">Peak IRE</span>
                      <span className={`font-bold ${waveformMetrics.parade.b.maxIRE > 100 ? 'text-rose-400' : 'text-[#f1f5f9]'}`}>
                        {waveformMetrics.parade.b.maxIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Midtones</span>
                      <span className="text-cyan-300 font-bold">
                        {waveformMetrics.parade.b.midtonesIRE.toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#788295] block">Mean Level</span>
                      <span className="text-[#cbd5e1]">
                        {waveformMetrics.parade.b.avgIRE.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[#1a1f2c] rounded-full overflow-hidden mt-0.5 relative">
                    <div
                      className={`h-full transition-all duration-150 ${waveformMetrics.parade.b.maxIRE > 100 ? 'bg-rose-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (waveformMetrics.parade.b.maxIRE / 110) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Neutral Grey Card & White Balance Analysis Card */}
            {waveformMetrics.parade && (
              <div className="bg-[#12151e] p-3 rounded-lg border border-[#23293a] flex flex-col gap-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-[#f0f3f8]">
                    <Scale className="w-3.5 h-3.5 text-[#e5b96f]" />
                    <span>Neutral Grey Card & White Balance Alignment</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold border ${
                    waveformMetrics.parade.wbBalance.isAligned
                      ? 'bg-emerald-950/70 text-emerald-400 border-emerald-800/60'
                      : waveformMetrics.parade.wbBalance.status === 'warm_red'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                      : waveformMetrics.parade.wbBalance.status === 'cool_blue'
                      ? 'bg-blue-950/70 text-blue-300 border-blue-800/60'
                      : 'bg-pink-950/70 text-pink-300 border-pink-800/60'
                  }`}>
                    {waveformMetrics.parade.wbBalance.label}
                  </span>
                </div>

                {/* Diagnostic Delta Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono bg-[#0b0e14] p-2 rounded border border-[#1b202e]">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8892a4]">Red vs Blue (Δ R-B):</span>
                    <span className={`font-bold ${
                      Math.abs(waveformMetrics.parade.wbBalance.rbDelta) <= 1.5
                        ? 'text-emerald-400'
                        : waveformMetrics.parade.wbBalance.rbDelta > 0
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}>
                      {waveformMetrics.parade.wbBalance.rbDelta >= 0 ? `+${waveformMetrics.parade.wbBalance.rbDelta.toFixed(1)}` : waveformMetrics.parade.wbBalance.rbDelta.toFixed(1)} IRE
                      {waveformMetrics.parade.wbBalance.rbDelta > 1.8 ? ' (Warm)' : waveformMetrics.parade.wbBalance.rbDelta < -1.8 ? ' (Cool)' : ''}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8892a4]">Red vs Green (Δ R-G):</span>
                    <span className="text-[#cbd5e1] font-bold">
                      {waveformMetrics.parade.wbBalance.rDelta >= 0 ? `+${waveformMetrics.parade.wbBalance.rDelta.toFixed(1)}` : waveformMetrics.parade.wbBalance.rDelta.toFixed(1)} IRE
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8892a4]">Blue vs Green (Δ B-G):</span>
                    <span className="text-[#cbd5e1] font-bold">
                      {waveformMetrics.parade.wbBalance.bDelta >= 0 ? `+${waveformMetrics.parade.wbBalance.bDelta.toFixed(1)}` : waveformMetrics.parade.wbBalance.bDelta.toFixed(1)} IRE
                    </span>
                  </div>
                </div>

                {/* Explanatory colorist guidance */}
                <div className="flex items-start justify-between gap-3 text-[11px] leading-relaxed">
                  <div className="flex items-start gap-1.5 text-[#94a0b8]">
                    <Info className="w-3.5 h-3.5 text-[#e5b96f] shrink-0 mt-0.5" />
                    <span>{waveformMetrics.parade.wbBalance.advice}</span>
                  </div>

                  {/* 1-Click Auto-Balance Button */}
                  {adjustments && onAdjustmentsChange && !waveformMetrics.parade.wbBalance.isAligned && (
                    <button
                      onClick={handleAutoBalanceWBFromGreyCard}
                      className="shrink-0 px-2.5 py-1 rounded bg-[#201c15] text-[#e5b96f] border border-[#5c4623] hover:bg-[#2b2416] text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Automatically adjust Temperature and Tint to align R, G, and B channels on neutral grey"
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Auto-Balance WB</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Rec.709 IRE Interpretation Guide Reference Card */}
            <div className="bg-[#12151f] p-3 rounded-lg border border-[#23293a] flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-[#f0f3f8]">
                  <Gauge className="w-3.5 h-3.5 text-[#e5b96f]" />
                  <span>Rec.709 IRE Exposure & Brightness Interpretation</span>
                </div>
                <span className="text-[10px] font-mono text-[#8c94a6]">
                  Mean Level: {waveformMetrics.avgIRE.toFixed(1)} IRE · Peak: {waveformMetrics.maxIRE.toFixed(1)} IRE
                </span>
              </div>

              {/* Live Exposure Summary Note */}
              <p className="text-[11px] text-[#94a0b8] leading-relaxed font-mono bg-[#0b0e14] px-2.5 py-1.5 rounded border border-[#1d2230]">
                {waveformMetrics.exposureSummary}
              </p>

              {/* Exact Rec.709 IRE Interpretation Table with Live Gauge Bars */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#212738] text-[10px] text-[#717b90] uppercase">
                      <th className="py-1 px-2">IRE</th>
                      <th className="py-1 px-2">Meaning</th>
                      <th className="py-1 px-2">Colorist Application</th>
                      <th className="py-1 px-2 text-right">Live Frame Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c2233] text-[11px]">
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 font-bold text-[#cbd5e1]">0</td>
                      <td className="py-1.5 px-2 text-[#e2e8f0]">Black</td>
                      <td className="py-1.5 px-2 text-[#8b95a8]">True black pedestal / black point calibration</td>
                      <td className="py-1.5 px-2 text-right font-bold text-[#cbd5e1]">{waveformMetrics.blackPct.toFixed(1)}%</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 font-bold text-[#c084fc]">10–20</td>
                      <td className="py-1.5 px-2 text-[#e2e8f0]">Deep shadows</td>
                      <td className="py-1.5 px-2 text-[#8b95a8]">Shadow toe, dark hair, clothing folds, low-key detail</td>
                      <td className="py-1.5 px-2 text-right font-bold text-[#c084fc]">{waveformMetrics.deepShadowsPct.toFixed(1)}%</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 font-bold text-[#34d399]">40–60</td>
                      <td className="py-1.5 px-2 text-[#e2e8f0]">Midtones</td>
                      <td className="py-1.5 px-2 text-[#8b95a8]">Key tonal body; 18% middle gray anchors at ~41–43 IRE</td>
                      <td className="py-1.5 px-2 text-right font-bold text-[#34d399]">{waveformMetrics.midtonesPct.toFixed(1)}%</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 font-bold text-[#e5b96f]">60–75</td>
                      <td className="py-1.5 px-2 text-[#e2e8f0]">Brighter midtones</td>
                      <td className="py-1.5 px-2 text-[#8b95a8]">Caucasian & fair skin highlights; optimal key skin luminance</td>
                      <td className="py-1.5 px-2 text-right font-bold text-[#e5b96f]">{waveformMetrics.brightMidtonesPct.toFixed(1)}%</td>
                    </tr>
                    <tr className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2 font-bold text-[#fbbf24]">90–100</td>
                      <td className="py-1.5 px-2 text-[#e2e8f0]">Highlights</td>
                      <td className="py-1.5 px-2 text-[#8b95a8]">Bright clouds, white paper/clothing, specular roll-off</td>
                      <td className="py-1.5 px-2 text-right font-bold text-[#fbbf24]">{waveformMetrics.highlightsPct.toFixed(1)}%</td>
                    </tr>
                    <tr className={`hover:bg-white/[0.02] ${waveformMetrics.isOverRange ? 'bg-rose-950/25' : ''}`}>
                      <td className="py-1.5 px-2 font-bold text-rose-400">Above 100</td>
                      <td className="py-1.5 px-2 text-[#fca5a5]">Over-range signal</td>
                      <td className="py-1.5 px-2 text-[#94a3b8]">Super-white speculars; preserved in float, clips at broadcast display</td>
                      <td className="py-1.5 px-2 text-right font-bold text-rose-400">
                        {waveformMetrics.overRangePct.toFixed(1)}% {waveformMetrics.isOverRange && '⚠️'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. RGB Parade & Luma Histogram */}
        {(scopeLayout === 'all' || scopeLayout === 'histogram') && (
          <div className="flex flex-col gap-2 bg-[#101217] p-3 rounded-xl border border-[#222530] w-full">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#c8cbd4] flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span>RGB & Luminance Histogram</span>
              </span>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-red-400">R</span>
                <span className="text-green-400">G</span>
                <span className="text-blue-400">B</span>
                <span className="text-gray-300">Lum</span>
              </div>
            </div>
            <div className="relative w-full aspect-[2/1] max-h-[220px] rounded-lg overflow-hidden border border-[#2b2f3e] bg-[#0a0c10]">
              <canvas
                ref={histCanvasRef}
                width={380}
                height={190}
                className="w-full h-full object-fill block"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
