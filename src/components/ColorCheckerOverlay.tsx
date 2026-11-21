import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChartCorners, ColorCheckerAnalysis, Point2D, ChartType } from '../types';
import { PerspectiveHomography, COLORCHECKER_VIDEO_PATCHES } from '../utils/colorChecker';
import { Move, Crosshair } from 'lucide-react';

interface ColorCheckerOverlayProps {
  corners: ChartCorners;
  onChangeCorners: (corners: ChartCorners) => void;
  analysis: ColorCheckerAnalysis | null;
  videoWidth: number;
  videoHeight: number;
  active: boolean;
  chartType?: ChartType;
  onAutoDetect?: () => void;
  onResetCorners?: () => void;
  onClose?: () => void;
}

type DragTarget = 'tl' | 'tr' | 'br' | 'bl' | 'center' | null;

export const ColorCheckerOverlay: React.FC<ColorCheckerOverlayProps> = ({
  corners,
  onChangeCorners,
  analysis,
  active,
  chartType = 'video',
  onAutoDetect,
  onResetCorners,
  onClose
}) => {
  const [activeDrag, setActiveDrag] = useState<DragTarget>(null);
  const [dragStartPoint, setDragStartPoint] = useState<Point2D | null>(null);
  const [startCorners, setStartCorners] = useState<ChartCorners | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const effectiveChartType = analysis?.chartType || chartType;

  // Compute homography for internal grid lines and patch centers
  const homography = React.useMemo(() => {
    return new PerspectiveHomography(corners);
  }, [corners]);

  // Center coordinate of the entire quad for the move handle
  const centerPoint = React.useMemo(() => {
    return homography.transform(0.5, 0.5);
  }, [homography]);

  // Generate internal geometry wireframes (for both Classic 24 and SpyderCheckr 24 4x6 charts)
  const classicGridLines = React.useMemo(() => {
    if (effectiveChartType !== 'classic24' && effectiveChartType !== 'spyder24') return [];
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

    // Horizontal lines (rows 1, 2, 3)
    for (let r = 1; r < 4; r++) {
      const v = r / 4.0;
      const p1 = homography.transform(0, v);
      const p2 = homography.transform(1, v);
      lines.push({ x1: p1.x * 100, y1: p1.y * 100, x2: p2.x * 100, y2: p2.y * 100 });
    }

    // Vertical lines (cols 1, 2, 3, 4, 5)
    for (let c = 1; c < 6; c++) {
      const u = c / 6.0;
      const p1 = homography.transform(u, 0);
      const p2 = homography.transform(u, 1);
      lines.push({ x1: p1.x * 100, y1: p1.y * 100, x2: p2.x * 100, y2: p2.y * 100 });
    }

    return lines;
  }, [homography, effectiveChartType]);

  // Video Chart Layout Shapes: 4 Wide Center Horizontal Bars
  const videoCenterBars = React.useMemo(() => {
    if (effectiveChartType !== 'video') return [];
    // 4 bars vertically centered at v = 0.185, 0.388, 0.592, 0.796 with height ~0.16 each
    const barConfigs = [
      { name: '100 IRE White', vMin: 0.105, vMax: 0.265, targetIRE: 100, patchIdx: 14, color: 'rgba(255, 255, 255, 0.15)' },
      { name: '40 IRE Midtone', vMin: 0.308, vMax: 0.468, targetIRE: 40, patchIdx: 15, color: 'rgba(160, 160, 160, 0.18)' },
      { name: '25 IRE Dark Gray', vMin: 0.512, vMax: 0.672, targetIRE: 25, patchIdx: 16, color: 'rgba(85, 85, 85, 0.22)' },
      { name: '0 IRE Black', vMin: 0.716, vMax: 0.876, targetIRE: 0, patchIdx: 17, color: 'rgba(26, 26, 26, 0.35)' }
    ];

    const uLeft = 0.245;
    const uRight = 0.755;

    return barConfigs.map((cfg) => {
      const pTL = homography.transform(uLeft, cfg.vMin);
      const pTR = homography.transform(uRight, cfg.vMin);
      const pBR = homography.transform(uRight, cfg.vMax);
      const pBL = homography.transform(uLeft, cfg.vMax);
      const pts = `${pTL.x * 100},${pTL.y * 100} ${pTR.x * 100},${pTR.y * 100} ${pBR.x * 100},${pBR.y * 100} ${pBL.x * 100},${pBL.y * 100}`;
      const center = homography.transform(0.5, (cfg.vMin + cfg.vMax) * 0.5);
      const sample = analysis?.patches.find((p) => p.index === cfg.patchIdx);

      return {
        ...cfg,
        polygonPoints: pts,
        centerX: center.x * 100,
        centerY: center.y * 100,
        measuredIRE: sample?.measuredIRE ?? cfg.targetIRE
      };
    });
  }, [homography, effectiveChartType, analysis]);

  // Patch targets to render on screen
  const patchTargets = React.useMemo(() => {
    if (effectiveChartType === 'video') {
      return COLORCHECKER_VIDEO_PATCHES.map((spec) => {
        const pt = homography.transform(spec.uvCenter[0], spec.uvCenter[1]);
        const patchSample = analysis?.patches.find((p) => p.index === spec.index);
        return {
          index: spec.index,
          name: spec.name,
          category: spec.category,
          isNeutral: spec.isNeutral,
          isWideBar: spec.isWideBar,
          targetIRE: spec.targetIRE,
          measuredIRE: patchSample?.measuredIRE,
          x: pt.x * 100,
          y: pt.y * 100,
          measuredRgb: patchSample?.measuredRgb,
          referenceRgb: spec.srgbD65,
          deltaE: patchSample?.deltaE
        };
      });
    }

    // Classic 24 patches
    const targets = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const idx = r * 6 + c;
        const u = (c + 0.5) / 6.0;
        const v = (r + 0.5) / 4.0;
        const pt = homography.transform(u, v);
        const patchSample = analysis?.patches.find((p) => p.index === idx);

        targets.push({
          index: idx,
          name: patchSample?.name || `Patch ${idx}`,
          category: r === 3 ? ('grayscale' as const) : ('chromatic' as const),
          isNeutral: r === 3,
          isWideBar: false,
          x: pt.x * 100,
          y: pt.y * 100,
          measuredRgb: patchSample?.measuredRgb,
          referenceRgb: patchSample?.referenceSrgb,
          deltaE: patchSample?.deltaE
        });
      }
    }
    return targets;
  }, [homography, effectiveChartType, analysis]);

  // Mouse drag handlers
  const handlePointerDown = (target: DragTarget, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    setActiveDrag(target);
    setDragStartPoint({ x: normX, y: normY });
    setStartCorners({ ...corners });
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeDrag || !dragStartPoint || !startCorners || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const dx = normX - dragStartPoint.x;
      const dy = normY - dragStartPoint.y;

      if (activeDrag === 'center') {
        const clamp = (val: number) => Math.max(0.01, Math.min(0.99, val));
        onChangeCorners({
          tl: { x: clamp(startCorners.tl.x + dx), y: clamp(startCorners.tl.y + dy) },
          tr: { x: clamp(startCorners.tr.x + dx), y: clamp(startCorners.tr.y + dy) },
          br: { x: clamp(startCorners.br.x + dx), y: clamp(startCorners.br.y + dy) },
          bl: { x: clamp(startCorners.bl.x + dx), y: clamp(startCorners.bl.y + dy) }
        });
      } else {
        const clamp = (val: number) => Math.max(0.01, Math.min(0.99, val));
        const updated = { ...startCorners };
        updated[activeDrag] = { x: clamp(normX), y: clamp(normY) };
        onChangeCorners(updated);
      }
    },
    [activeDrag, dragStartPoint, startCorners, onChangeCorners]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (activeDrag) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // pointer not captured
      }
      setActiveDrag(null);
      setDragStartPoint(null);
      setStartCorners(null);
    }
  }, [activeDrag]);

  if (!active) return null;

  const polyPoints = `${corners.tl.x * 100},${corners.tl.y * 100} ${corners.tr.x * 100},${corners.tr.y * 100} ${corners.br.x * 100},${corners.br.y * 100} ${corners.bl.x * 100},${corners.bl.y * 100}`;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-auto select-none z-30 overflow-hidden"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Banner Control HUD */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0c1017]/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-cyan-500/50 shadow-xl text-xs z-40 max-w-[95%] whitespace-nowrap overflow-x-auto">
        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold font-mono whitespace-nowrap">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>
            {effectiveChartType === 'video'
              ? 'Calibrite ColorChecker Video'
              : effectiveChartType === 'spyder24'
              ? 'Datacolor SpyderCheckr 24'
              : 'Calibrate ColorChecker Classic'}
          </span>
        </span>
        <span className="text-[#475569]">&bull;</span>
        <span className="text-[11px] text-[#cbd5e1]">
          {effectiveChartType === 'video'
            ? 'Skin • 4 Grayscale Bars • Chromatic'
            : effectiveChartType === 'spyder24'
            ? 'Datacolor 24 • D65 Spec'
            : 'Drag 4 corners over chart'}
        </span>
        {onAutoDetect && (
          <button
            onClick={onAutoDetect}
            className="ml-1 px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 text-[10px] font-mono transition-colors cursor-pointer"
            title="Auto-fit quad to chart edges"
          >
            Auto-Fit
          </button>
        )}
        {onResetCorners && (
          <button
            onClick={onResetCorners}
            className="px-2 py-0.5 rounded bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] text-[10px] font-mono transition-colors cursor-pointer"
            title="Reset corners to standard center"
          >
            Reset
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-1 px-1.5 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 text-rose-300 text-[10px] font-mono transition-colors cursor-pointer"
            title="Hide ColorChecker tool overlay"
          >
            Done
          </button>
        )}
      </div>

      {/* SVG Canvas for Perspective Mesh & Boundaries */}
      <svg className="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <radialGradient id="quadGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.01" />
          </radialGradient>
        </defs>

        {/* Shaded Chart Body */}
        <polygon points={polyPoints} fill="url(#quadGlow)" />

        {/* Outer Quadrilateral Border */}
        <polygon
          points={polyPoints}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="0.35"
          strokeDasharray="1.2 0.8"
          className="drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
        />

        {/* Video Target Geometry: 4 Wide Center Grayscale Bars */}
        {effectiveChartType === 'video' && videoCenterBars.map((bar, idx) => (
          <polygon
            key={idx}
            points={bar.polygonPoints}
            fill={bar.color}
            stroke="#38bdf8"
            strokeWidth="0.25"
            strokeDasharray="1.0 0.5"
            strokeOpacity="0.8"
          />
        ))}

        {/* Video Target Column Dividers (Left Skin column and Right Chromatic column) */}
        {effectiveChartType === 'video' && (() => {
          const pLeftDivTop = homography.transform(0.24, 0.08);
          const pLeftDivBot = homography.transform(0.24, 0.92);
          const pRightDivTop = homography.transform(0.76, 0.08);
          const pRightDivBot = homography.transform(0.76, 0.92);

          return (
            <>
              <line
                x1={pLeftDivTop.x * 100}
                y1={pLeftDivTop.y * 100}
                x2={pLeftDivBot.x * 100}
                y2={pLeftDivBot.y * 100}
                stroke="#0284c7"
                strokeWidth="0.2"
                strokeDasharray="1.0 1.0"
              />
              <line
                x1={pRightDivTop.x * 100}
                y1={pRightDivTop.y * 100}
                x2={pRightDivBot.x * 100}
                y2={pRightDivBot.y * 100}
                stroke="#0284c7"
                strokeWidth="0.2"
                strokeDasharray="1.0 1.0"
              />
            </>
          );
        })()}

        {/* Classic 4x6 Grid Perspective Mesh */}
        {effectiveChartType === 'classic24' && classicGridLines.map((line, idx) => (
          <line
            key={idx}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#0891b2"
            strokeWidth="0.15"
            strokeOpacity="0.7"
          />
        ))}
      </svg>

      {/* Video Chart 4 Center Grayscale Bars Floating Badges */}
      {effectiveChartType === 'video' && videoCenterBars.map((bar) => (
        <div
          key={`bar-${bar.patchIdx}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm border border-cyan-500/40 shadow-md font-mono text-[9px]"
          style={{ left: `${bar.centerX}%`, top: `${bar.centerY}%` }}
        >
          <span className="text-cyan-300 font-bold">{bar.name}</span>
          <span className="text-[#64748b]">&bull;</span>
          <span className={Math.abs(bar.measuredIRE - bar.targetIRE) <= 4 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
            {bar.measuredIRE}% IRE
          </span>
        </div>
      ))}

      {/* Sampling Target Circles for Individual Chips */}
      {patchTargets.map((pt) => {
        // Skip rendering circular pin on center wide bars if in video mode (handled by bar badges above)
        if (effectiveChartType === 'video' && pt.isWideBar) return null;

        const measRgb = pt.measuredRgb || [128, 128, 128];
        const refRgb = pt.referenceRgb || [128, 128, 128];
        const isSkin = pt.category === 'skin';
        const isNeutral = pt.isNeutral;

        return (
          <div
            key={pt.index}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center justify-center transition-transform"
            style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
          >
            {/* Split Swatch Circle: Left half = Measured, Right half = Reference */}
            <div
              className={`w-3.5 h-3.5 rounded-full overflow-hidden border shadow-md flex ${
                isSkin
                  ? 'border-amber-400 ring-1 ring-amber-400/60'
                  : isNeutral
                  ? 'border-cyan-300 ring-1 ring-cyan-300/40'
                  : 'border-cyan-400/80 ring-1 ring-cyan-400/30'
              }`}
              title={`${pt.name} (${pt.category || 'chip'})\nMeasured: rgb(${measRgb.join(',')})\nRef: rgb(${refRgb.join(',')})\nΔE: ${pt.deltaE?.toFixed(1) || '0.0'}`}
            >
              <div
                className="w-1/2 h-full"
                style={{ backgroundColor: `rgb(${measRgb[0]},${measRgb[1]},${measRgb[2]})` }}
              />
              <div
                className="w-1/2 h-full"
                style={{ backgroundColor: `rgb(${refRgb[0]},${refRgb[1]},${refRgb[2]})` }}
              />
            </div>
            <span
              className={`text-[8px] font-mono font-bold px-0.5 rounded leading-none mt-0.5 ${
                isSkin
                  ? 'text-amber-300 bg-black/80'
                  : isNeutral
                  ? 'text-cyan-300 bg-black/80'
                  : 'text-cyan-200 bg-black/60'
              }`}
            >
              {pt.index}
            </span>
          </div>
        );
      })}

      {/* Center Drag Pivot (moves entire quad) */}
      <div
        onPointerDown={(e) => handlePointerDown('center', e)}
        className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-cyan-950/80 hover:bg-cyan-800 border-2 border-cyan-400 text-cyan-200 flex items-center justify-center shadow-lg cursor-move z-40 transition-transform hover:scale-110 active:scale-95"
        style={{ left: `${centerPoint.x * 100}%`, top: `${centerPoint.y * 100}%` }}
        title="Drag to reposition entire ColorChecker quad"
      >
        <Move className="w-4 h-4 text-cyan-300" />
      </div>

      {/* 4 Interactive Corner Handles */}
      <CornerHandle
        id="tl"
        label="TL"
        description={effectiveChartType === 'video' ? 'Top-Left • Dark Skin / Limits' : 'Top-Left • Dark Skin'}
        x={corners.tl.x * 100}
        y={corners.tl.y * 100}
        color="border-cyan-400 bg-cyan-950 text-cyan-200"
        onPointerDown={(e) => handlePointerDown('tl', e)}
      />
      <CornerHandle
        id="tr"
        label="TR"
        description={effectiveChartType === 'video' ? 'Top-Right • Highlight Limit / White' : 'Top-Right • Bluish Green'}
        x={corners.tr.x * 100}
        y={corners.tr.y * 100}
        color="border-cyan-400 bg-cyan-950 text-cyan-200"
        onPointerDown={(e) => handlePointerDown('tr', e)}
      />
      <CornerHandle
        id="br"
        label="BR"
        description={effectiveChartType === 'video' ? 'Bottom-Right • Green Chips / Limits' : 'Bottom-Right • Black 2'}
        x={corners.br.x * 100}
        y={corners.br.y * 100}
        color="border-amber-400 bg-amber-950 text-amber-200"
        onPointerDown={(e) => handlePointerDown('br', e)}
      />
      <CornerHandle
        id="bl"
        label="BL"
        description={effectiveChartType === 'video' ? 'Bottom-Left • Black Shadow Limit' : 'Bottom-Left • White 9.5'}
        x={corners.bl.x * 100}
        y={corners.bl.y * 100}
        color="border-amber-400 bg-amber-950 text-amber-200"
        onPointerDown={(e) => handlePointerDown('bl', e)}
      />
    </div>
  );
};

interface CornerHandleProps {
  id: string;
  label: string;
  description: string;
  x: number;
  y: number;
  color: string;
  onPointerDown: (e: React.PointerEvent) => void;
}

const CornerHandle: React.FC<CornerHandleProps> = ({
  label,
  description,
  x,
  y,
  color,
  onPointerDown
}) => {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute -translate-x-1/2 -translate-y-1/2 z-50 flex items-center justify-center cursor-crosshair group touch-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`${description} • Drag to adjust perspective`}
    >
      {/* Outer Pulse Ring */}
      <div className="absolute w-8 h-8 rounded-full border border-cyan-400/40 animate-ping opacity-60 pointer-events-none" />

      {/* Reticle Circle Handle */}
      <div
        className={`w-5 h-5 rounded-full border-2 ${color} flex items-center justify-center shadow-lg transition-transform group-hover:scale-125 group-active:scale-90`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
      </div>

      {/* Floating Corner Badge */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/85 backdrop-blur-sm border border-cyan-500/60 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-cyan-300 pointer-events-none shadow-md">
        {label}
      </div>
    </div>
  );
};
