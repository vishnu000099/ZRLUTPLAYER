import React, { useRef, useState, useEffect } from 'react';
import { Camera, Maximize, Video, HelpCircle, FolderPlus, Compass, Crosshair, Crop, X, Sparkles, Grid } from 'lucide-react';
import { SplitMode, PlaybackResolution, ChartCorners, ColorCheckerAnalysis, ChartType } from '../types';
import { ColorCheckerOverlay } from './ColorCheckerOverlay';

export interface SkinSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SkinSelectionStats {
  pixelCount: number;
  framePercentage: number;
  width: number;
  height: number;
}

interface ViewportProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  videoLoaded: boolean;
  onOpenVideoClick: () => void;
  onOpenFolderClick: () => void;
  onOpenLutLibrary: () => void;
  onOpenScopes?: () => void;
  onDropFile: (file: File) => void;
  onSnapshot: () => void;
  splitMode: SplitMode;
  splitPos: number;
  onSplitPosChange: (pos: number) => void;
  playbackResolution: PlaybackResolution;
  lutName?: string;
  lutEnabled: boolean;
  onToggleFullscreen: () => void;
  // Select Skin Area Picker Tool
  isSelectingSkinArea?: boolean;
  onStartSkinSelection?: () => void;
  onCancelSkinSelection?: () => void;
  skinSelectionRect?: SkinSelectionRect | null;
  skinSelectionStats?: SkinSelectionStats | null;
  onSkinAreaSelected?: (rect: SkinSelectionRect, stats: SkinSelectionStats) => void;
  onClearSkinSelection?: () => void;
  // 4-Corner ColorChecker Tool
  colorCheckerActive?: boolean;
  onToggleColorChecker?: () => void;
  chartType?: ChartType;
  chartCorners?: ChartCorners;
  onChangeChartCorners?: (corners: ChartCorners) => void;
  colorCheckerAnalysis?: ColorCheckerAnalysis | null;
  onAutoDetectChartCorners?: () => void;
  onResetChartCorners?: () => void;
  videoWidth?: number;
  videoHeight?: number;
}

export const Viewport: React.FC<ViewportProps> = ({
  canvasRef,
  videoLoaded,
  onOpenVideoClick,
  onOpenFolderClick,
  onOpenLutLibrary,
  onOpenScopes,
  onDropFile,
  onSnapshot,
  splitMode,
  splitPos,
  onSplitPosChange,
  playbackResolution,
  lutName,
  lutEnabled,
  onToggleFullscreen,
  isSelectingSkinArea = false,
  onStartSkinSelection,
  onCancelSkinSelection,
  skinSelectionRect = null,
  skinSelectionStats = null,
  onSkinAreaSelected,
  onClearSkinSelection,
  colorCheckerActive = false,
  onToggleColorChecker,
  chartType = 'video',
  chartCorners,
  onChangeChartCorners,
  colorCheckerAnalysis,
  onAutoDetectChartCorners,
  onResetChartCorners,
  videoWidth = 1920,
  videoHeight = 1080
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoStageRef = useRef<HTMLDivElement>(null);
  const [stageDimensions, setStageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  // Dynamically compute exact video bounds inside container to eliminate letterbox discrepancy
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;
      const cRect = containerRef.current.getBoundingClientRect();
      const cw = cRect.width;
      const ch = cRect.height;
      if (cw <= 0 || ch <= 0) return;

      const vw = videoWidth || 1920;
      const vh = videoHeight || 1080;
      const videoAspect = vw / vh;
      const containerAspect = cw / ch;

      let w = cw;
      let h = ch;
      if (containerAspect > videoAspect) {
        h = ch;
        w = Math.round(ch * videoAspect);
      } else {
        w = cw;
        h = Math.round(cw / videoAspect);
      }
      setStageDimensions({ width: w, height: h });
    };

    updateDimensions();

    const ro = new ResizeObserver(() => {
      updateDimensions();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [videoWidth, videoHeight]);

  // Skin Area Bounding Box Drag State
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [isMouseDownBox, setIsMouseDownBox] = useState(false);

  // Keyboard escape listener to cancel selection
  useEffect(() => {
    if (!isSelectingSkinArea) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancelSkinSelection?.();
        setDragStart(null);
        setDragCurrent(null);
        setIsMouseDownBox(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isSelectingSkinArea, onCancelSkinSelection]);

  // Handle Box Drag with exact 1:1 video frame mapping
  const handleBoxMouseDown = (e: React.MouseEvent) => {
    const targetEl = videoStageRef.current || canvasRef.current;
    if (!isSelectingSkinArea || !targetEl) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = targetEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragStart({ x, y });
    setDragCurrent({ x, y });
    setIsMouseDownBox(true);
  };

  const handleBoxMouseMove = (e: React.MouseEvent) => {
    const targetEl = videoStageRef.current || canvasRef.current;
    if (!isSelectingSkinArea || !isMouseDownBox || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragCurrent({ x, y });
  };

  const handleBoxMouseUp = () => {
    if (!isSelectingSkinArea || !isMouseDownBox || !dragStart || !dragCurrent) {
      setIsMouseDownBox(false);
      return;
    }

    const minX = Math.min(dragStart.x, dragCurrent.x);
    const minY = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);

    const vidW = videoWidth || 1920;
    const vidH = videoHeight || 1080;
    const selW = Math.round(w * vidW);
    const selH = Math.round(h * vidH);
    const pixelCount = selW * selH;
    const totalPixels = vidW * vidH;
    const pct = totalPixels > 0 ? (pixelCount / totalPixels) * 100 : 0;

    // Minimum sensible face box threshold (> 15x15 px and > 100 pixels)
    if (w > 0.015 && h > 0.015 && pixelCount > 100) {
      onSkinAreaSelected?.(
        { x: minX, y: minY, width: w, height: h },
        { pixelCount, framePercentage: pct, width: selW, height: selH }
      );
    }

    setDragStart(null);
    setDragCurrent(null);
    setIsMouseDownBox(false);
  };

  // Drag and drop video / LUT
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onDropFile(file);
    }
  };

  // Draggable split bar handler
  const handleMouseDownSplit = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplit(true);
  };

  useEffect(() => {
    if (!isDraggingSplit) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (splitMode === 'vertical') {
        const x = Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width));
        onSplitPosChange(x);
      } else if (splitMode === 'horizontal') {
        const y = Math.max(0.05, Math.min(0.95, (rect.bottom - e.clientY) / rect.height));
        onSplitPosChange(y);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplit, splitMode, onSplitPosChange]);

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full aspect-video min-h-[260px] sm:min-h-[320px] max-h-[66vh] bg-[#08090c] border rounded-xl overflow-hidden flex items-center justify-center select-none transition-colors ${
        isDraggingFile ? 'border-[#e5b96f] ring-2 ring-[#e5b96f]/30' : 'border-[#262933]'
      }`}
    >
      {/* Aspect-Preserved Video Stage Frame (Eliminates Letterbox Discrepancy) */}
      <div
        ref={videoStageRef}
        style={
          stageDimensions.width > 0 && stageDimensions.height > 0
            ? { width: `${stageDimensions.width}px`, height: `${stageDimensions.height}px` }
            : { width: '100%', height: '100%' }
        }
        className="relative flex items-center justify-center overflow-hidden max-w-full max-h-full"
      >
        {/* WebGL Canvas */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full block ${
            isSelectingSkinArea ? 'cursor-crosshair' : 'cursor-default'
          }`}
          aria-label="WebGL Video Preview"
        />

        {/* Interactive Drag Surface when selecting skin area */}
        {isSelectingSkinArea && (
          <div
            onMouseDown={handleBoxMouseDown}
            onMouseMove={handleBoxMouseMove}
            onMouseUp={handleBoxMouseUp}
            className="absolute inset-0 z-30 cursor-crosshair select-none bg-black/15"
            title="Click and drag bounding box over subject face/skin"
          />
        )}

        {/* Render Bounding Box and Live Telemetry Tooltip */}
        {(() => {
          const isDragging = isMouseDownBox && dragStart && dragCurrent;
          const box = isDragging
            ? {
                x: Math.min(dragStart.x, dragCurrent.x),
                y: Math.min(dragStart.y, dragCurrent.y),
                width: Math.abs(dragCurrent.x - dragStart.x),
                height: Math.abs(dragCurrent.y - dragStart.y)
              }
            : skinSelectionRect;

          if (!box || box.width < 0.005 || box.height < 0.005) return null;

          const vidW = videoWidth || 1920;
          const vidH = videoHeight || 1080;
          const widthPx = Math.round(box.width * vidW);
          const heightPx = Math.round(box.height * vidH);
          const pixelCount = widthPx * heightPx;
          const totalPixels = vidW * vidH;
          const percentage = totalPixels > 0 ? (pixelCount / totalPixels) * 100 : 0;
          const isSweetSpot = percentage >= 0.2;

          return (
            <div
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`
              }}
              className={`absolute z-30 pointer-events-none border-2 transition-all ${
                isDragging
                  ? 'border-[#e5b96f] bg-[#e5b96f]/15 shadow-[0_0_20px_rgba(229,185,111,0.5)]'
                  : 'border-[#e5b96f] bg-[#e5b96f]/10 shadow-[0_0_12px_rgba(229,185,111,0.3)]'
              }`}
            >
              {/* 4 Corner Bracket Reticles */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-[#fff]" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-[#fff]" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-[#fff]" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-[#fff]" />

              {/* Center Crosshair */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-80">
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[#e5b96f]" />
                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-[#e5b96f]" />
              </div>

              {/* Live Floating Telemetry Badge */}
              <div
                className="absolute left-0 bottom-full mb-1.5 whitespace-nowrap bg-[#10131b]/95 backdrop-blur-md px-2.5 py-1 rounded-md border border-[#5c4623] shadow-xl text-[10px] font-mono pointer-events-auto flex items-center gap-2"
              >
                <div className="flex items-center gap-1.5">
                  <Crop className="w-3 h-3 text-[#e5b96f]" />
                  <span className="font-bold text-[#f5f8fc]">
                    {widthPx} × {heightPx} px
                  </span>
                  <span className="text-[#8e95a5]">
                    ({pixelCount.toLocaleString()} px &bull; {percentage.toFixed(2)}% frame)
                  </span>
                </div>

                {isDragging ? (
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                      isSweetSpot
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                        : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                    }`}
                  >
                    {isSweetSpot ? '✨ Sweet Spot' : 'Sampling...'}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
                      Isolated on Vectorscope
                    </span>
                    {onClearSkinSelection && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearSkinSelection();
                        }}
                        className="ml-1 text-[#a0a6b5] hover:text-[#f87171] p-0.5 rounded hover:bg-[#202434] transition-colors cursor-pointer"
                        title="Clear isolated skin area"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 4-Corner ColorChecker Interactive Perspective Quad Overlay */}
        {videoLoaded && colorCheckerActive && chartCorners && onChangeChartCorners && (
          <ColorCheckerOverlay
            corners={chartCorners}
            onChangeCorners={onChangeChartCorners}
            analysis={colorCheckerAnalysis || null}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            active={colorCheckerActive}
            chartType={chartType}
            onAutoDetect={onAutoDetectChartCorners}
            onResetCorners={onResetChartCorners}
            onClose={onToggleColorChecker}
          />
        )}

        {/* Draggable vertical split divider handle */}
        {videoLoaded && splitMode === 'vertical' && (
          <div
            onMouseDown={handleMouseDownSplit}
            style={{ left: `${splitPos * 100}%` }}
            className="absolute top-0 bottom-0 w-6 -ml-3 flex items-center justify-center cursor-ew-resize group z-20"
          >
            <div className="w-[2px] h-full bg-[#e5b96f] shadow-[0_0_8px_rgba(229,185,111,0.5)] group-hover:w-1 transition-all" />
            <div className="absolute top-1/2 -translate-y-1/2 w-6 h-10 rounded-full bg-[#1b1e26] border border-[#e5b96f] flex flex-col items-center justify-center gap-1 shadow-lg text-[10px] text-[#e5b96f]">
              <span>◀</span>
              <span>▶</span>
            </div>
            {/* Label indicators */}
            <div className="absolute top-4 -left-16 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-black/60 text-[#c8cbd2] backdrop-blur-sm pointer-events-none">
              Original
            </div>
            <div className="absolute top-4 left-6 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-black/60 text-[#e5b96f] backdrop-blur-sm pointer-events-none">
              Graded
            </div>
          </div>
        )}

        {/* Draggable horizontal split divider handle */}
        {videoLoaded && splitMode === 'horizontal' && (
          <div
            onMouseDown={handleMouseDownSplit}
            style={{ bottom: `${splitPos * 100}%` }}
            className="absolute left-0 right-0 h-6 -mb-3 flex items-center justify-center cursor-ns-resize group z-20"
          >
            <div className="h-[2px] w-full bg-[#e5b96f] shadow-[0_0_8px_rgba(229,185,111,0.5)] group-hover:h-1 transition-all" />
            <div className="absolute left-1/2 -translate-x-1/2 h-6 w-10 rounded-full bg-[#1b1e26] border border-[#e5b96f] flex items-center justify-center gap-1 shadow-lg text-[10px] text-[#e5b96f]">
              <span>▲</span>
              <span>▼</span>
            </div>
          </div>
        )}
      </div>

      {/* Empty State Overlay */}
      {!videoLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-[#090a0d]/90 backdrop-blur-sm z-10">
          <div className="w-16 h-16 rounded-2xl bg-[#1d1f27] border border-[#373c4d] flex items-center justify-center text-[#e5b96f] mb-4 shadow-xl">
            <Video className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#f2f4f8] tracking-tight mb-2">
            Open a Nikon ZR Proxy Video or Folder
          </h2>
          <p className="text-sm text-[#9ba1ad] max-w-md mb-6 leading-relaxed">
            Drag & drop an H.264 / ProRes proxy video file here, or select an entire folder of video clips to play in sequential queue.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onOpenVideoClick}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] transition-colors shadow-sm flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Browse Local Video</span>
            </button>
            <button
              onClick={onOpenFolderClick}
              className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#292218] hover:bg-[#382d1c] text-[#e5b96f] border border-[#523e21] transition-colors flex items-center gap-2 shadow-sm"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Open Video Folder</span>
            </button>
          </div>

          <div className="mt-8 text-xs text-[#6e7585] flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Accepts .cube 3D LUTs via drag-and-drop onto this window</span>
          </div>
        </div>
      )}

      {/* Top Floating Viewport HUD (When video loaded) */}
      {videoLoaded && (
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 flex items-center justify-between pointer-events-none z-10 gap-2">
          {/* Clickable LUT indicator that jumps to LUT tab */}
          <div className="flex items-center gap-1.5 bg-[#12141a]/85 backdrop-blur-md border border-[#2d313d] px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#c5cad3] shadow-md pointer-events-auto min-w-0">
            <button
              onClick={onOpenLutLibrary}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity text-left truncate"
              title="Click to view LUT library or load .cube file"
            >
              <span className="text-[#9ba1ad] shrink-0">LUT:</span>
              <span className={`truncate max-w-[100px] sm:max-w-[190px] ${lutEnabled && lutName ? 'text-[#e5b96f] font-semibold' : 'text-[#777e8a]'}`}>
                {lutEnabled && lutName ? lutName : 'None'}
              </span>
            </button>
            <span className="text-[#3f4350] hidden sm:inline">|</span>
            <span className="text-[#9ba1ad] hidden sm:inline">Mode:</span>
            <span className="text-[#aeb4bf] hidden sm:inline">{playbackResolution === 'original' ? 'Original' : `${playbackResolution}p`}</span>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
            {onStartSkinSelection && (
              <button
                onClick={onStartSkinSelection}
                className={`px-2 py-1.5 sm:px-2.5 rounded-lg backdrop-blur-md border text-xs font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  isSelectingSkinArea || skinSelectionRect
                    ? 'bg-[#312515] text-[#e5b96f] border-[#7a5824] ring-1 ring-[#e5b96f]/50 font-bold'
                    : 'bg-[#12141a]/85 hover:bg-[#1f222b] text-[#c5cad3] hover:text-[#e5b96f] border-[#2d313d]'
                }`}
                title="Select Skin Area Tool: Pauses video and allows click-and-drag bounding box over subject face/skin for instant vector isolation"
              >
                <Crop className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span className="hidden sm:inline text-[11px]">
                  {skinSelectionRect ? 'Skin Area: Active' : 'Select Skin Area'}
                </span>
              </button>
            )}

            {onOpenScopes && (
              <button
                onClick={onOpenScopes}
                className="px-2 py-1.5 sm:px-2.5 rounded-lg bg-[#12141a]/85 hover:bg-[#1f222b] backdrop-blur-md border border-[#2d313d] text-xs font-mono flex items-center gap-1.5 transition-colors shadow-md text-[#c5cad3] hover:text-[#e5b96f]"
                title="Open DaVinci Vectorscope & Skin Tone Indicator"
              >
                <Compass className="w-3.5 h-3.5 text-[#e5b96f]" />
                <span className="hidden sm:inline text-[11px]">Skin Tone</span>
              </button>
            )}

            {onToggleColorChecker && (
              <button
                onClick={onToggleColorChecker}
                className={`px-2 py-1.5 sm:px-2.5 rounded-lg backdrop-blur-md border text-xs font-mono flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                  colorCheckerActive
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500/80 ring-1 ring-cyan-400/50 font-bold'
                    : 'bg-[#12141a]/85 hover:bg-[#1f222b] text-[#c5cad3] hover:text-cyan-300 border-[#2d313d]'
                }`}
                title="ColorChecker 4-Corner Tool: Semi-manual perspective quad for automated White Balance & calibration"
              >
                <Grid className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline text-[11px]">
                  {colorCheckerActive
                    ? 'Calibrate: ON'
                    : chartType === 'video'
                    ? 'Calibrate Video Target'
                    : chartType === 'spyder24'
                    ? 'Calibrate SpyderCheckr 24'
                    : 'Calibrate ColorChecker Classic'}
                </span>
              </button>
            )}

            <button
              onClick={onSnapshot}
              className="p-1.5 sm:p-2 rounded-lg bg-[#12141a]/80 hover:bg-[#1f222b] backdrop-blur-md border border-[#2d313d] text-[#c5cad3] hover:text-[#f4f6fa] transition-colors shadow-md"
              title="Capture full-resolution graded PNG snapshot"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              onClick={onToggleFullscreen}
              className="p-1.5 sm:p-2 rounded-lg bg-[#12141a]/80 hover:bg-[#1f222b] backdrop-blur-md border border-[#2d313d] text-[#c5cad3] hover:text-[#f4f6fa] transition-colors shadow-md"
              title="Toggle Fullscreen (F)"
            >
              <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
