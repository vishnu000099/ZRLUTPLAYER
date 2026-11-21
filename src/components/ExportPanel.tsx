import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileVideo,
  RotateCcw,
  Sparkles,
  Layers,
  Sliders,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Volume2,
  VolumeX,
  Gauge,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Info,
  Zap,
  Cpu,
  ShieldCheck
} from 'lucide-react';
import {
  ColorAdjustments,
  ExportConfig,
  ExportProgress,
  LutData,
  LutInterpolationMode,
  VideoMetadata,
  EncoderEngine,
  EncoderCapabilities
} from '../types';
import { exportGradedVideo } from '../utils/videoExporter';
import { detectEncoderCapabilities } from '../utils/encoderCapabilities';
import { detectSourceVideoFps, formatFpsDisplay } from '../utils/fpsDetector';

import { UI_LOCK_CODE } from '../utils/uiLock';

// Convenience UI lock only — not a security control (see utils/uiLock.ts).
const MASTER_EXPORT_PASSCODE = UI_LOCK_CODE;

interface ExportPanelProps {
  videoElement: HTMLVideoElement | null;
  sourceFile: File | null;
  videoMetadata: VideoMetadata | null;
  adjustments: ColorAdjustments;
  activeLut: LutData | null;
  lutEnabled: boolean;
  onNavigateToGrading?: () => void;
  onNavigateToLut?: () => void;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  videoElement,
  sourceFile,
  videoMetadata,
  adjustments,
  activeLut,
  lutEnabled,
}) => {
  // UI lock state (convenience lock, not a security control)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem('nikon_zr_export_unlocked') === 'true';
  });
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);
  const [showPasscodeText, setShowPasscodeText] = useState<boolean>(false);
  const passcodeInputRef = useRef<HTMLInputElement>(null);

  // Hardware vs CPU Encoder Architecture & Capabilities
  const [capabilities, setCapabilities] = useState<EncoderCapabilities | null>(null);
  const [isDetectingCaps, setIsDetectingCaps] = useState<boolean>(true);
  const [encoderEngine, setEncoderEngine] = useState<EncoderEngine>('hardware');

  // Export Settings
  const codec = 'h264';
  const [bitDepth, setBitDepth] = useState<'8bit' | '10bit'>('8bit');
  const [interpolationMode, setInterpolationMode] = useState<LutInterpolationMode>('tetrahedral');
  const [crf, setCrf] = useState<number>(18); // 12-28
  const [preset, setPreset] = useState<'medium' | 'slow' | 'veryslow'>('slow');
  const [showPresetDetails, setShowPresetDetails] = useState<boolean>(false);

  // Resolution 3 options: Native, 1080p, 720p
  const [resolutionOption, setResolutionOption] = useState<'native' | '1080' | '720'>('native');
  const [preserveFps, setPreserveFps] = useState<boolean>(true);
  const [detectedFps, setDetectedFps] = useState<number>(videoMetadata?.fps || 30);
  const [targetFpsSelection, setTargetFpsSelection] = useState<number | 'preserve'>('preserve');
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);
  const [exportRange, setExportRange] = useState<'full' | 'preview-5s' | 'in-out'>('full');
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(videoMetadata?.duration || 10);

  // Detect authentic original source FPS from container / Mediabunny
  useEffect(() => {
    let active = true;
    if (sourceFile) {
      detectSourceVideoFps(sourceFile, videoMetadata?.fps || 30).then((fps) => {
        if (active && fps > 0) {
          setDetectedFps(fps);
        }
      });
    } else if (videoMetadata?.fps) {
      setDetectedFps(videoMetadata.fps);
    }
    return () => {
      active = false;
    };
  }, [sourceFile, videoMetadata?.fps]);

  // Export State & Progress
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<ExportProgress>({
    phase: 'idle',
    percent: 0,
    currentFrame: 0,
    totalFrames: 0,
    fps: 0,
    elapsedSeconds: 0,
    remainingSeconds: 0,
    stageMessage: 'Ready to export'
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect Hardware Encoding Capabilities on mount
  useEffect(() => {
    let isMounted = true;
    detectEncoderCapabilities().then((caps) => {
      if (!isMounted) return;
      setCapabilities(caps);
      setIsDetectingCaps(false);
      // Auto-select hardware if available, fallback to CPU if not supported
      if (caps.recommendedEngine === 'hardware' || caps.hardwareAccelerated || caps.webCodecsSupported) {
        setEncoderEngine('hardware');
      } else {
        setEncoderEngine('cpu');
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Focus passcode input when locked
  useEffect(() => {
    if (!isUnlocked) {
      passcodeInputRef.current?.focus();
    }
  }, [isUnlocked]);

  // Sync end time when video metadata updates
  useEffect(() => {
    if (videoMetadata?.duration && videoMetadata.duration > 0) {
      setEndTime(videoMetadata.duration);
    }
  }, [videoMetadata?.duration]);

  // Original video specifications
  const originalWidth = videoElement?.videoWidth || videoMetadata?.width || 1920;
  const originalHeight = videoElement?.videoHeight || videoMetadata?.height || 1080;
  const originalFps = detectedFps || videoMetadata?.fps || 30;
  const duration = videoElement?.duration || videoMetadata?.duration || 0;

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // Human CRF quality description
  const getCrfDescription = (val: number) => {
    if (val <= 14) return 'Near Lossless (Archival Grade, Largest File)';
    if (val <= 18) return 'Visually Lossless / Master (Recommended for ProRes / N-Log)';
    if (val <= 22) return 'High Quality Delivery (Web, YouTube, Vimeo)';
    if (val <= 25) return 'Standard Proxy (Balanced File Size)';
    return 'Compressed Proxy (Lightweight, Fastest Export)';
  };

  // Handle Passcode Unlock
  const handleVerifyPasscode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passcodeInput.trim() === MASTER_EXPORT_PASSCODE) {
      setIsUnlocked(true);
      sessionStorage.setItem('nikon_zr_export_unlocked', 'true');
      setPasscodeError(null);
      setPasscodeInput('');
    } else {
      setPasscodeError('Incorrect passcode. Please try again.');
    }
  };

  const handleLockExport = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem('nikon_zr_export_unlocked');
    setPasscodeInput('');
    setPasscodeError(null);
  };

  const handleStartExport = async () => {
    if (!videoElement) return;

    setIsExporting(true);
    abortControllerRef.current = new AbortController();

    const isPreservingFps = targetFpsSelection === 'preserve';
    const finalFps = isPreservingFps ? originalFps : Number(targetFpsSelection);

    const config: ExportConfig = {
      encoderEngine,
      codec,
      bitDepth,
      crf,
      preset,
      preserveResolution: resolutionOption === 'native',
      targetResolution: resolutionOption === 'native' ? 'original' : resolutionOption,
      preserveFps: isPreservingFps,
      targetFps: finalFps,
      includeAudio,
      exportRange,
      startTime,
      endTime,
      interpolationMode
    };

    try {
      const result = await exportGradedVideo({
        videoElement,
        sourceFile,
        sourceFileName: sourceFile?.name || videoMetadata?.name || 'nikon_zr_graded',
        adjustments,
        lutData: activeLut,
        lutEnabled,
        config,
        onProgress: (p) => setProgress(p),
        abortSignal: abortControllerRef.current.signal
      });

      // Auto trigger download for user convenience
      if (result.url) {
        const a = document.createElement('a');
        a.href = result.url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('cancelled')) {
        setProgress((prev) => ({
          ...prev,
          phase: 'aborted',
          stageMessage: 'Export cancelled by user'
        }));
      } else {
        setProgress((prev) => ({
          ...prev,
          phase: 'error',
          error: errMsg,
          stageMessage: `Export failed: ${errMsg}`
        }));
      }
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleReset = () => {
    setProgress({
      phase: 'idle',
      percent: 0,
      currentFrame: 0,
      totalFrames: 0,
      fps: 0,
      elapsedSeconds: 0,
      remainingSeconds: 0,
      stageMessage: 'Ready to export'
    });
  };

  // LOCKED STATE: UI lock passcode prompt
  if (!isUnlocked) {
    return (
      <div className="flex flex-col gap-4 text-[#e2e6ef] pb-6 select-none">
        <div className="bg-[#14161f] border border-[#262a39] p-5 rounded-2xl flex flex-col items-center text-center gap-4 shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-[#292218] border border-[#5d4624] flex items-center justify-center text-[#e5b96f] shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <div className="flex flex-col gap-1 max-w-[320px]">
            <span className="text-base font-bold text-[#f4f6fa] tracking-tight">
              Export Video Locked
            </span>
            <span className="text-xs text-[#8a92a5]">
              Enter the passcode to unlock the export panel.
            </span>
          </div>

          <form onSubmit={handleVerifyPasscode} className="w-full max-w-[320px] flex flex-col gap-3">
            <div className="relative flex items-center">
              <input
                ref={passcodeInputRef}
                type={showPasscodeText ? 'text' : 'password'}
                inputMode="numeric"
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  if (passcodeError) setPasscodeError(null);
                }}
                placeholder="Enter passcode"
                className={`w-full py-2.5 pl-3.5 pr-10 bg-[#0d0f15] border rounded-xl text-center text-sm font-mono tracking-widest text-[#f0f3f8] focus:outline-none transition-all ${
                  passcodeError
                    ? 'border-rose-500/80 ring-2 ring-rose-500/20'
                    : 'border-[#2d3246] focus:border-[#e5b96f] focus:ring-2 focus:ring-[#e5b96f]/20'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPasscodeText((prev) => !prev)}
                className="absolute right-3 p-1 text-[#6e7689] hover:text-[#c4cad7] transition-colors"
                title={showPasscodeText ? 'Hide passcode' : 'Show passcode'}
              >
                {showPasscodeText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {passcodeError && (
              <span className="text-[11px] font-medium text-rose-400 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passcodeError}</span>
              </span>
            )}

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Unlock Export Video</span>
            </button>
          </form>

          <span className="text-[10px] text-[#5e6678] font-mono">
            UI lock only · does not protect the app or its files
          </span>
        </div>
      </div>
    );
  }

  // UNLOCKED STATE: Full Export Module
  return (
    <div className="flex flex-col gap-4 text-[#e2e6ef] pb-6 select-none">
      {/* Top Banner: Export Master Video (Without any FFmpeg.wasm text) */}
      <div className="bg-[#14161e] border border-[#262937] p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#2b2416] border border-[#5a4321] flex items-center justify-center text-[#e5b96f] shrink-0">
            <FileVideo className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-tight text-[#f4f6fa]">
              Export Graded Video
            </span>
            <span className="text-[11px] text-[#848c9e]">
              Exports high-quality H.264 MP4 with selected 3D LUT and colour grading baked in
            </span>
          </div>
        </div>

        {/* Lock Button */}
        <button
          type="button"
          onClick={handleLockExport}
          className="p-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#252936] text-[#828a9b] hover:text-[#e5b96f] border border-[#282c3c] transition-colors"
          title="Lock the Export Video panel (UI lock)"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Applied Color Grading & LUT Summary Pill */}
      <div className="p-3 bg-[#161822] rounded-xl border border-[#2b2f3f] flex flex-col gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#7e8596] flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#e5b96f]" />
          <span>Baking Color Pipeline</span>
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Active LUT Status */}
          <div className="p-2 bg-[#1b1e2a] rounded-lg border border-[#2d3142] flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Layers className="w-3.5 h-3.5 text-[#e5b96f] shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[10px] text-[#868d9e]">Applied 3D LUT</span>
                <span className="font-medium text-[#f0f3f8] truncate">
                  {lutEnabled && activeLut ? activeLut.name : 'None (Log Raw)'}
                </span>
              </div>
            </div>
            {lutEnabled && activeLut && (
              <span className="text-[10px] font-mono text-[#e5b96f] bg-[#292218] px-1.5 py-0.5 rounded shrink-0">
                {Math.round(adjustments.lutStrength * 100)}%
              </span>
            )}
          </div>

          {/* Color Adjustments Status */}
          <div className="p-2 bg-[#1b1e2a] rounded-lg border border-[#2d3142] flex items-center justify-between">
            <div className="flex items-center gap-2 truncate">
              <Sliders className="w-3.5 h-3.5 text-[#e5b96f] shrink-0" />
              <div className="flex flex-col truncate">
                <span className="text-[10px] text-[#868d9e]">Grading Adjustments</span>
                <span className="font-mono text-[11px] text-[#d4d9e6] truncate">
                  Exp: {adjustments.exposure > 0 ? `+${adjustments.exposure.toFixed(2)}` : adjustments.exposure.toFixed(2)}EV · Sat: {Math.round(adjustments.saturation * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Controls Card */}
      <div className="p-4 bg-[#14161f] rounded-xl border border-[#242835] flex flex-col gap-4 shadow-sm">
        {/* Section 0: Encoder Architecture (Hardware Accelerated GPU vs Software CPU) */}
        <div className="flex flex-col gap-2.5 pb-3 border-b border-[#202330]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#f0f3f8]">
                Encoding Engine
              </label>
              {isDetectingCaps ? (
                <span className="text-[10px] font-mono text-[#8c94a5]">Detecting GPU capabilities…</span>
              ) : capabilities?.hardwareAccelerated ? (
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  <span>Hardware GPU Active</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  <span>Software CPU Available</span>
                </span>
              )}
            </div>
            {capabilities?.gpuRenderer && (
              <span className="text-[10px] font-mono text-[#7b8396] hidden sm:inline truncate max-w-[220px]" title={capabilities.gpuRenderer}>
                {capabilities.gpuRenderer.split('(')[0].trim()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Option 1: Hardware Accelerated (WebCodecs + Mediabunny) */}
            <button
              type="button"
              onClick={() => setEncoderEngine('hardware')}
              disabled={isExporting}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer relative ${
                encoderEngine === 'hardware'
                  ? 'bg-[#1b212e] border-[#e5b96f]/80 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-md'
                  : 'bg-[#101218] border-[#222533] text-[#7a8192] hover:bg-[#161922] hover:text-[#cdd3e0]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-md ${encoderEngine === 'hardware' ? 'bg-[#292218] text-[#e5b96f]' : 'bg-[#191c26] text-[#7c8396]'}`}>
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-[#f4f6fa]">
                    Hardware Accelerated (GPU)
                  </span>
                </div>
                <span className="text-[9px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  Recommended
                </span>
              </div>
              <p className="text-[11px] text-[#9098ab] leading-snug">
                WebCodecs hardware H.264 engine + Mediabunny MP4 muxer. High throughput, zero frame stall.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#71788a] pt-0.5 border-t border-[#232838]">
                <span>WebCodecs prefer-hardware</span>
                <span>·</span>
                <span>Mediabunny Mux</span>
              </div>
            </button>

            {/* Option 2: Software CPU Encoder */}
            <button
              type="button"
              onClick={() => setEncoderEngine('cpu')}
              disabled={isExporting}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer relative ${
                encoderEngine === 'cpu'
                  ? 'bg-[#1b212e] border-[#e5b96f]/80 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-md'
                  : 'bg-[#101218] border-[#222533] text-[#7a8192] hover:bg-[#161922] hover:text-[#cdd3e0]'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-md ${encoderEngine === 'cpu' ? 'bg-[#292218] text-[#e5b96f]' : 'bg-[#191c26] text-[#7c8396]'}`}>
                    <Cpu className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-[#f4f6fa]">
                    Software CPU (libx264)
                  </span>
                </div>
                <span className="text-[9px] font-mono uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[#1e2230] text-[#8e96a8] border border-[#2d3346]">
                  Compatibility
                </span>
              </div>
              <p className="text-[11px] text-[#9098ab] leading-snug">
                Universal CPU encoding fallback. Precision frame rendering with high multi-device compatibility.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#71788a] pt-0.5 border-t border-[#232838]">
                <span>x264 Software</span>
                <span>·</span>
                <span>CPU Fallback</span>
              </div>
            </button>
          </div>
        </div>

        {/* Section 1: Video Codec (H.264) & Bit Depth (8-bit / 10-bit) */}
        <div className="flex flex-col gap-3">
          {/* Video Codec */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#f0f3f8]">
              Video codec
            </label>
            <div className="flex items-center p-1 bg-[#101217] rounded-xl border border-[#232734] w-full">
              <div className="flex-1 py-2 text-xs font-semibold rounded-lg bg-[#252835] text-[#ffffff] shadow-sm text-center">
                H.264
              </div>
            </div>
          </div>

          {/* Color Depth: 8-bit / 10-bit */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#f0f3f8]">
                Bit depth
              </label>
              <span className="text-[10px] font-mono text-[#8c94a5]">
                {bitDepth === '10bit' ? '10-bit (RGBA16F float · yuv420p10le)' : '8-bit (Standard SDR · yuv420p)'}
              </span>
            </div>
            <div className="flex items-center p-1 bg-[#101217] rounded-xl border border-[#232734] w-full">
              <button
                type="button"
                onClick={() => setBitDepth('8bit')}
                disabled={isExporting}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                  bitDepth === '8bit'
                    ? 'bg-[#252835] text-[#ffffff] shadow-sm'
                    : 'text-[#8b92a2] hover:text-[#d3d8e3]'
                }`}
              >
                8-bit
              </button>
              <button
                type="button"
                onClick={() => setBitDepth('10bit')}
                disabled={isExporting}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                  bitDepth === '10bit'
                    ? 'bg-[#252835] text-[#ffffff] shadow-sm'
                    : 'text-[#8b92a2] hover:text-[#d3d8e3]'
                }`}
              >
                10-bit
              </button>
            </div>
            {bitDepth === '10bit' && (
              <p className="text-[11px] text-[#e5b96f]/90 leading-snug bg-[#292218]/40 border border-[#e5b96f]/20 rounded-lg p-2">
                <span className="font-semibold text-[#f4f6fa]">True 10-bit pipeline active:</span> 32-bit float 3D LUT sampling with RGBA16F floating-point framebuffers. Uncompressed 16-bit RGB frames stream directly into libx264 yuv420p10le (zero 8-bit JPEG quantization).
              </p>
            )}
          </div>

          {/* Section: 3D LUT Interpolation Mode */}
          {activeLut && lutEnabled && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#f0f3f8]">
                  3D LUT Interpolation
                </label>
                <span className="text-[10px] font-mono text-[#8c94a5]">
                  {interpolationMode === 'tetrahedral' ? 'Tetrahedral (Pro 4-Simplex · Zero Curvature)' : 'Trilinear (Standard 8-Tap Cubic)'}
                </span>
              </div>
              <div className="flex items-center p-1 bg-[#101217] rounded-xl border border-[#232734] w-full">
                <button
                  type="button"
                  onClick={() => setInterpolationMode('tetrahedral')}
                  disabled={isExporting}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    interpolationMode === 'tetrahedral'
                      ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e]/80 shadow-sm'
                      : 'text-[#8b92a2] hover:text-[#d3d8e3]'
                  }`}
                  title="Tetrahedral: 4-simplex subdivision without diagonal interpolation curvature error"
                >
                  Tetrahedral (Pro)
                </button>
                <button
                  type="button"
                  onClick={() => setInterpolationMode('trilinear')}
                  disabled={isExporting}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all text-center cursor-pointer ${
                    interpolationMode === 'trilinear'
                      ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e]/80 shadow-sm'
                      : 'text-[#8b92a2] hover:text-[#d3d8e3]'
                  }`}
                  title="Trilinear: standard 8-tap cubic interpolation"
                >
                  Trilinear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Quality & CRF Slider (12-28) */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[#202330]">
          <span className="text-xs font-semibold text-[#f0f3f8]">Quality</span>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#a0a6b5]">CRF</span>
            <span className="font-mono font-bold text-[#f4f6fa] text-xs px-2 py-0.5 rounded bg-[#1f222e] border border-[#2e3243]">
              {crf}
            </span>
          </div>

          {/* Slider from 12 to 28 matching screenshot with white knob */}
          <div className="relative flex items-center py-1">
            <input
              type="range"
              min={12}
              max={28}
              step={1}
              value={crf}
              onChange={(e) => setCrf(Number(e.target.value))}
              disabled={isExporting}
              className="w-full h-2 bg-[#232634] rounded-lg appearance-none cursor-pointer accent-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#747b8d] px-0.5">
            <span>12 (Highest Quality)</span>
            <span className="text-[#e5b96f] text-center hidden sm:inline truncate max-w-[200px]">
              {getCrfDescription(crf)}
            </span>
            <span>28 (Smallest File)</span>
          </div>
        </div>

        {/* Section 3: Encoding Preset (Medium, Slow, Very slow) with cursor hover details */}
        <div
          className="flex flex-col gap-2 pt-1 border-t border-[#202330]"
          onMouseEnter={() => setShowPresetDetails(true)}
          onMouseLeave={() => setShowPresetDetails(false)}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f0f3f8] flex items-center gap-1.5">
              <span>Encoding preset</span>
              <Info className="w-3.5 h-3.5 text-[#8890a2] cursor-help" />
            </span>
            <span className="text-[10px] text-[#707788] hidden sm:inline">
              Hover to view preset guide
            </span>
          </div>

          <div className="flex items-center gap-5 text-xs text-[#dce1ec] pt-0.5">
            {/* Medium */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="encodingPreset"
                value="medium"
                checked={preset === 'medium'}
                onChange={() => setPreset('medium')}
                disabled={isExporting}
                className="hidden"
              />
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  preset === 'medium'
                    ? 'border-white bg-white'
                    : 'border-[#515767] bg-transparent group-hover:border-[#868d9f]'
                }`}
              >
                {preset === 'medium' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#101217]" />
                )}
              </span>
              <span className={preset === 'medium' ? 'text-white font-medium' : 'text-[#8b92a2]'}>
                Medium
              </span>
            </label>

            {/* Slow */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="encodingPreset"
                value="slow"
                checked={preset === 'slow'}
                onChange={() => setPreset('slow')}
                disabled={isExporting}
                className="hidden"
              />
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  preset === 'slow'
                    ? 'border-white bg-white'
                    : 'border-[#515767] bg-transparent group-hover:border-[#868d9f]'
                }`}
              >
                {preset === 'slow' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#101217]" />
                )}
              </span>
              <span className={preset === 'slow' ? 'text-white font-medium' : 'text-[#8b92a2]'}>
                Slow
              </span>
            </label>

            {/* Very slow */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="encodingPreset"
                value="veryslow"
                checked={preset === 'veryslow'}
                onChange={() => setPreset('veryslow')}
                disabled={isExporting}
                className="hidden"
              />
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  preset === 'veryslow'
                    ? 'border-white bg-white'
                    : 'border-[#515767] bg-transparent group-hover:border-[#868d9f]'
                }`}
              >
                {preset === 'veryslow' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#101217]" />
                )}
              </span>
              <span className={preset === 'veryslow' ? 'text-white font-medium' : 'text-[#8b92a2]'}>
                Very slow
              </span>
            </label>
          </div>

          {/* Details shown when cursor moves near to Encoding Preset */}
          {showPresetDetails && (
            <div className="mt-1 p-3 bg-[#0f1118] rounded-xl border border-[#2c3245] text-xs text-[#cad0de] flex flex-col gap-2 shadow-lg transition-all">
              <p>
                <strong className="text-[#f4f6fa]">Medium:</strong> Balanced encoding speed and compression efficiency; good for everyday exports.
              </p>
              <p>
                <strong className="text-[#f4f6fa]">Slow:</strong> Takes longer but produces smaller files at comparable visual quality.
              </p>
              <p>
                <strong className="text-[#f4f6fa]">Very Slow:</strong> Takes considerably longer to maximise compression efficiency and reduce file size.
              </p>
            </div>
          )}
        </div>

        {/* Section 4: Resolution - 3 Options: Native, 1080p, 720p (Matching image_581b8065.png) */}
        <div className="pt-2 border-t border-[#202330] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f0f3f8]">
              Resolution
            </span>
            <span className="text-[10px] font-mono text-[#8b93a5]">
              Select output scaling
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {/* Option 1: Native */}
            <button
              type="button"
              onClick={() => setResolutionOption('native')}
              disabled={isExporting}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                resolutionOption === 'native'
                  ? 'bg-[#1b1f2e] border-[#e5b96f]/60 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-sm'
                  : 'bg-[#12141c] border-[#252837] text-[#7a8192] hover:bg-[#181a24] hover:text-[#d3d8e5]'
              }`}
            >
              <div className="flex flex-col pr-1 truncate">
                <span className="font-semibold text-xs text-[#f0f3f8]">Resolution</span>
                <span className="text-[10px] font-mono text-[#a0a6b5] truncate">
                  Native ({originalWidth}×{originalHeight})
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  resolutionOption === 'native'
                    ? 'border-[#e5b96f] bg-[#e5b96f]'
                    : 'border-[#4e5466] bg-transparent'
                }`}
              >
                {resolutionOption === 'native' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
            </button>

            {/* Option 2: 1080p */}
            <button
              type="button"
              onClick={() => setResolutionOption('1080')}
              disabled={isExporting}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                resolutionOption === '1080'
                  ? 'bg-[#1b1f2e] border-[#e5b96f]/60 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-sm'
                  : 'bg-[#12141c] border-[#252837] text-[#7a8192] hover:bg-[#181a24] hover:text-[#d3d8e5]'
              }`}
            >
              <div className="flex flex-col pr-1 truncate">
                <span className="font-semibold text-xs text-[#f0f3f8]">Resolution</span>
                <span className="text-[10px] font-mono text-[#a0a6b5] truncate">
                  1080p (1920×1080)
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  resolutionOption === '1080'
                    ? 'border-[#e5b96f] bg-[#e5b96f]'
                    : 'border-[#4e5466] bg-transparent'
                }`}
              >
                {resolutionOption === '1080' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
            </button>

            {/* Option 3: 720p */}
            <button
              type="button"
              onClick={() => setResolutionOption('720')}
              disabled={isExporting}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                resolutionOption === '720'
                  ? 'bg-[#1b1f2e] border-[#e5b96f]/60 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-sm'
                  : 'bg-[#12141c] border-[#252837] text-[#7a8192] hover:bg-[#181a24] hover:text-[#d3d8e5]'
              }`}
            >
              <div className="flex flex-col pr-1 truncate">
                <span className="font-semibold text-xs text-[#f0f3f8]">Resolution</span>
                <span className="text-[10px] font-mono text-[#a0a6b5] truncate">
                  720p (1280×720)
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  resolutionOption === '720'
                    ? 'border-[#e5b96f] bg-[#e5b96f]'
                    : 'border-[#4e5466] bg-transparent'
                }`}
              >
                {resolutionOption === '720' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
            </button>
          </div>
        </div>

        {/* Section 4.5: Frame Rate (FPS) */}
        <div className="pt-2 border-t border-[#202330] flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f0f3f8]">
              Frame rate (FPS)
            </span>
            <span className="text-[10px] font-mono text-[#8b93a5]">
              {targetFpsSelection === 'preserve'
                ? `Auto-detected: ${formatFpsDisplay(detectedFps)}`
                : `Target: ${targetFpsSelection} fps`}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Option 1: Preserve Source FPS */}
            <button
              type="button"
              onClick={() => {
                setTargetFpsSelection('preserve');
                setPreserveFps(true);
              }}
              disabled={isExporting}
              className={`col-span-2 p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                targetFpsSelection === 'preserve'
                  ? 'bg-[#1b1f2e] border-[#e5b96f]/60 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-sm'
                  : 'bg-[#12141c] border-[#252837] text-[#7a8192] hover:bg-[#181a24] hover:text-[#d3d8e5]'
              }`}
            >
              <div className="flex flex-col pr-1 truncate">
                <span className="font-semibold text-xs text-[#f0f3f8]">Preserve FPS</span>
                <span className="text-[10px] font-mono text-[#a0a6b5] truncate">
                  Auto Source ({formatFpsDisplay(detectedFps)})
                </span>
              </div>
              <span
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  targetFpsSelection === 'preserve'
                    ? 'border-[#e5b96f] bg-[#e5b96f]'
                    : 'border-[#4e5466] bg-transparent'
                }`}
              >
                {targetFpsSelection === 'preserve' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
            </button>

            {/* Target FPS Options */}
            {[
              { rate: 23.976, label: '23.98', desc: 'Cinema 24p' },
              { rate: 24, label: '24', desc: 'Film' },
              { rate: 25, label: '25', desc: 'PAL / Europe' },
              { rate: 29.97, label: '29.97', desc: 'NTSC TV' },
              { rate: 30, label: '30', desc: 'Standard Web' },
              { rate: 50, label: '50', desc: 'PAL High Speed' },
              { rate: 59.94, label: '59.94', desc: 'NTSC 60p' },
              { rate: 60, label: '60', desc: 'High Frame Rate' }
            ].map(({ rate, label, desc }) => (
              <button
                key={rate}
                type="button"
                onClick={() => {
                  setTargetFpsSelection(rate);
                  setPreserveFps(false);
                }}
                disabled={isExporting}
                className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  targetFpsSelection === rate
                    ? 'bg-[#1b1f2e] border-[#e5b96f]/60 text-[#f4f6fa] ring-1 ring-[#e5b96f]/30 shadow-sm font-semibold'
                    : 'bg-[#12141c] border-[#252837] text-[#82899a] hover:bg-[#181a24] hover:text-[#d3d8e5]'
                }`}
              >
                <span className="text-xs">{label} fps</span>
                <span className="text-[9px] text-[#5e6576] font-mono truncate max-w-full">
                  {desc}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 5: Audio & Range Selector */}
        <div className="pt-2 border-t border-[#202330] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#f0f3f8]">Export Duration</span>
            {/* Audio switch */}
            <button
              type="button"
              onClick={() => setIncludeAudio((prev) => !prev)}
              disabled={isExporting}
              className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border transition-colors cursor-pointer ${
                includeAudio
                  ? 'bg-[#232736] text-[#f0f3f8] border-[#393f54]'
                  : 'bg-[#14161f] text-[#696f80] border-[#242735]'
              }`}
            >
              {includeAudio ? <Volume2 className="w-3 h-3 text-[#e5b96f]" /> : <VolumeX className="w-3 h-3" />}
              <span>{includeAudio ? 'Audio Track Included' : 'Muted'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setExportRange('full')}
              disabled={isExporting}
              className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                exportRange === 'full'
                  ? 'bg-[#252835] text-white border-[#4d5367] font-medium'
                  : 'bg-[#12141a] text-[#868d9e] border-[#242735] hover:text-[#d3d8e3]'
              }`}
            >
              Full Clip ({formatTime(duration)})
            </button>
            <button
              type="button"
              onClick={() => setExportRange('preview-5s')}
              disabled={isExporting}
              className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                exportRange === 'preview-5s'
                  ? 'bg-[#252835] text-white border-[#4d5367] font-medium'
                  : 'bg-[#12141a] text-[#868d9e] border-[#242735] hover:text-[#d3d8e3]'
              }`}
              title="Fast 5-second test render to check look on phone/monitor"
            >
              Quick Test (5s)
            </button>
            <button
              type="button"
              onClick={() => setExportRange('in-out')}
              disabled={isExporting}
              className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                exportRange === 'in-out'
                  ? 'bg-[#252835] text-white border-[#4d5367] font-medium'
                  : 'bg-[#12141a] text-[#868d9e] border-[#242735] hover:text-[#d3d8e3]'
              }`}
            >
              Custom In/Out
            </button>
          </div>

          {/* In/Out Custom Inputs if selected */}
          {exportRange === 'in-out' && (
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[#747b8d]">In (Start sec)</span>
                <input
                  type="number"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={startTime}
                  onChange={(e) => setStartTime(Math.max(0, Number(e.target.value)))}
                  disabled={isExporting}
                  className="bg-[#111319] border border-[#262a39] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#e5b96f]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-[#747b8d]">Out (End sec)</span>
                <input
                  type="number"
                  min={startTime + 0.1}
                  max={duration}
                  step={0.1}
                  value={endTime}
                  onChange={(e) => setEndTime(Math.min(duration, Number(e.target.value)))}
                  disabled={isExporting}
                  className="bg-[#111319] border border-[#262a39] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#e5b96f]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progress & Live Encoding State (Percentage & Estimated Remaining Time) */}
      {(isExporting || progress.phase === 'completed' || progress.phase === 'error' || progress.phase === 'aborted') && (
        <div className="p-4 bg-[#141620] rounded-xl border border-[#2b3042] flex flex-col gap-3 shadow-md">
          {/* Header Progress Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {progress.phase === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : progress.phase === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400" />
              ) : progress.phase === 'aborted' ? (
                <XCircle className="w-4 h-4 text-amber-400" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-[#e5b96f] border-t-transparent animate-spin" />
              )}
              <span className="text-xs font-bold text-[#f0f3f8]">
                {progress.phase === 'completed'
                  ? 'Encoding Finished'
                  : progress.phase === 'error'
                  ? 'Encoding Error'
                  : progress.phase === 'aborted'
                  ? 'Encoding Cancelled'
                  : progress.phase === 'rendering'
                  ? 'Color Processing'
                  : 'Master Video Encoding'}
              </span>
            </div>

            {/* Percentage Display & Engine Badge */}
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 font-semibold ${
                  (progress.engine || encoderEngine) === 'hardware'
                    ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                    : 'bg-[#1e2332] border-[#2e3549] text-[#e5b96f]'
                }`}
              >
                {(progress.engine || encoderEngine) === 'hardware' ? (
                  <>
                    <Zap className="w-2.5 h-2.5 text-emerald-400" />
                    <span>GPU Hardware</span>
                  </>
                ) : (
                  <>
                    <Cpu className="w-2.5 h-2.5 text-[#e5b96f]" />
                    <span>CPU Software</span>
                  </>
                )}
              </span>
              <span className="text-sm font-mono font-bold text-[#e5b96f]">
                {progress.percent}%
              </span>
            </div>
          </div>

          {/* Progress Bar with Gradient */}
          <div className="relative w-full h-2.5 bg-[#1b1e2a] rounded-full overflow-hidden border border-[#2a2f40]">
            <div
              className="h-full bg-gradient-to-r from-[#ca9439] via-[#e5b96f] to-[#ffe29a] transition-all duration-200 rounded-full"
              style={{ width: `${progress.percent}%` }}
            />
          </div>

          {/* Stats Bar: Estimated remaining time, FPS, frame count */}
          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-[#8a92a5] bg-[#11131a] p-2.5 rounded-lg border border-[#222533]">
            {/* Estimated Remaining Time */}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-[#686f80]">
                Remaining Time
              </span>
              <span className="font-semibold text-[#f0f3f8] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#e5b96f]" />
                {progress.phase === 'completed'
                  ? '00:00'
                  : progress.remainingSeconds > 0
                  ? formatTime(progress.remainingSeconds)
                  : '--:--'}
              </span>
            </div>

            {/* Processing Speed */}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-[#686f80]">
                Speed
              </span>
              <span className="font-semibold text-[#f0f3f8] flex items-center gap-1">
                <Gauge className="w-3 h-3 text-[#e5b96f]" />
                {progress.fps > 0 ? `${progress.fps} fps` : '--'}
              </span>
            </div>

            {/* Frames Processed */}
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-[#686f80]">
                Frames
              </span>
              <span className="font-semibold text-[#f0f3f8]">
                {progress.currentFrame} / {progress.totalFrames || '--'}
              </span>
            </div>
          </div>

          {/* Current Stage Message */}
          <div className="flex items-center justify-between text-[11px] text-[#9ca3b5]">
            <span className="truncate pr-2">{progress.stageMessage}</span>
            <span className="text-[10px] font-mono shrink-0 text-[#6d7485]">
              Elapsed: {formatTime(progress.elapsedSeconds)}
            </span>
          </div>

          {/* Live Thumbnail Preview if active */}
          {progress.previewThumbnail && isExporting && (
            <div className="flex items-center gap-2.5 p-2 bg-[#0e1016] rounded-lg border border-[#202330]">
              <img
                src={progress.previewThumbnail}
                alt="Rendering frame"
                className="w-20 aspect-video object-cover rounded border border-[#2e3344] shrink-0"
              />
              <div className="flex flex-col text-[10px] font-mono text-[#7b8294] truncate">
                <span className="text-[#e5b96f] font-semibold">Live Frame Output</span>
                <span>LUT: {lutEnabled && activeLut ? activeLut.name : 'Raw'}</span>
                <span>Engine: {(progress.engine || encoderEngine) === 'hardware' ? 'WebCodecs GPU' : 'CPU Software'} · CRF {crf} · {codec.toUpperCase()} ({bitDepth === '10bit' ? '10-bit' : '8-bit'})</span>
              </div>
            </div>
          )}

          {/* Completed Download Action */}
          {progress.phase === 'completed' && progress.outputUrl && (
            <div className="flex flex-col gap-2 pt-2 border-t border-[#262b3c]">
              <div className="flex items-center gap-2">
                <a
                  href={progress.outputUrl}
                  download={progress.outputFileName || 'graded_video.mp4'}
                  className="flex-1 py-2.5 px-3 bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Graded MP4 Video</span>
                </a>
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-2.5 bg-[#232736] hover:bg-[#32364a] text-[#c7ccda] rounded-lg border border-[#373c52] transition-colors cursor-pointer"
                  title="Export another video"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Preview player of exported result */}
              <div className="mt-1 rounded-lg overflow-hidden border border-[#2b3042] bg-black">
                <video
                  src={progress.outputUrl}
                  controls
                  className="w-full max-h-[220px] object-contain"
                />
              </div>
            </div>
          )}

          {/* Abort Button while exporting */}
          {isExporting && (
            <button
              type="button"
              onClick={handleCancelExport}
              className="w-full py-2 bg-[#2d1b1f] hover:bg-[#3d2228] text-rose-300 border border-rose-900/60 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Export</span>
            </button>
          )}
        </div>
      )}

      {/* Main Start Export Action Button */}
      {!isExporting && progress.phase !== 'completed' && (
        <button
          type="button"
          onClick={handleStartExport}
          disabled={!videoElement}
          className="w-full py-3 px-4 bg-[#e5b96f] hover:bg-[#f0c883] disabled:opacity-50 disabled:cursor-not-allowed text-[#14120c] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#e5b96f]/10 cursor-pointer"
        >
          <Download className="w-4 h-4 stroke-[2.5]" />
          <span>Start Exporting Graded Video</span>
        </button>
      )}
    </div>
  );
};
