import React, { useState } from 'react';
import {
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Contrast,
  Droplets,
  Thermometer,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  Download,
  Lock
} from 'lucide-react';
import { ColorAdjustments, LutData, LutInterpolationMode } from '../types';
import { ExportLutModal } from './ExportLutModal';

// Temperature: 3 increments per 100 Kelvin: 33 K, 67 K, 100 K
export function stepToKelvin(step: number): number {
  const sign = step < 0 ? -1 : 1;
  const absStep = Math.abs(Math.round(step));
  const hundreds = Math.floor(absStep / 3) * 100;
  const rem = absStep % 3;
  const extra = rem === 1 ? 33 : rem === 2 ? 67 : 0;
  return sign * (hundreds + extra);
}

export function kelvinToStep(k: number): number {
  const sign = k < 0 ? -1 : 1;
  const absK = Math.abs(k);
  const hundreds = Math.floor(absK / 100);
  const rem = absK % 100;
  let remStep = 0;
  if (rem >= 17 && rem < 50) remStep = 1;
  else if (rem >= 50 && rem < 83) remStep = 2;
  else if (rem >= 83) remStep = 3;
  return sign * (hundreds * 3 + remStep);
}

// Tint: 3 increments per 1.0 point: 0.33, 0.66, 1.0
export function stepToTint(step: number): number {
  const sign = step < 0 ? -1 : 1;
  const absStep = Math.abs(Math.round(step));
  const ones = Math.floor(absStep / 3);
  const rem = absStep % 3;
  const extra = rem === 1 ? 0.33 : rem === 2 ? 0.66 : 0;
  return Number((sign * (ones + extra)).toFixed(2));
}

export function tintToStep(t: number): number {
  const sign = t < 0 ? -1 : 1;
  const absT = Math.abs(t);
  const ones = Math.floor(absT);
  const rem = absT - ones;
  let remStep = 0;
  if (rem >= 0.165 && rem < 0.495) remStep = 1;
  else if (rem >= 0.495 && rem < 0.83) remStep = 2;
  else if (rem >= 0.83) remStep = 3;
  return sign * (ones * 3 + remStep);
}

interface ColorGradingPanelProps {
  adjustments: ColorAdjustments;
  onChange: (adj: ColorAdjustments) => void;
  lutEnabled: boolean;
  onLutEnabledChange: (enabled: boolean) => void;
  activeLutName?: string;
  activeLut?: LutData | null;
  interpolationMode?: LutInterpolationMode;
  onInterpolationModeChange?: (mode: LutInterpolationMode) => void;
  onOpenParityModal?: () => void;
}

export const ColorGradingPanel: React.FC<ColorGradingPanelProps> = ({
  adjustments,
  onChange,
  lutEnabled,
  onLutEnabledChange,
  activeLutName,
  activeLut,
  interpolationMode = 'tetrahedral',
  onInterpolationModeChange,
  onOpenParityModal
}) => {
  // Zoom mode states: when clicked, sliders expand for high-precision fine increments
  const [isTempZoomed, setIsTempZoomed] = useState<boolean>(false);
  const [isTintZoomed, setIsTintZoomed] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  const updateField = (field: keyof ColorAdjustments, value: number) => {
    onChange({
      ...adjustments,
      [field]: value
    });
  };

  const handleReset = () => {
    onChange({
      exposure: 0,
      contrast: 1,
      saturation: 1,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      lutStrength: 1
    });
  };

  return (
    <div className="bg-[#14161d] border border-[#262934] rounded-xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#242733] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#e5b96f]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d5dae6]">
            Real-Time Primary Color Grading
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {onOpenParityModal && (
            <button
              onClick={onOpenParityModal}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-lg bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-700/50 cursor-pointer"
              title="Audit CPU vs GPU Color Pipeline Parity"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
              <span>Parity Audit</span>
            </button>
          )}

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="text-xs text-[#e5b96f] hover:text-[#f0c883] flex items-center gap-1.5 transition-colors px-2.5 py-1 rounded-lg bg-[#272016] hover:bg-[#34291a] border border-[#5c4422] cursor-pointer"
            title="Export baked 3D LUT (.CUBE) - passcode required (UI lock)"
          >
            <Download className="w-3.5 h-3.5 text-[#e5b96f]" />
            <span>Export .CUBE</span>
            <Lock className="w-2.5 h-2.5 text-[#e5b96f]/70" />
          </button>

          <button
            onClick={handleReset}
            className="text-xs text-[#9ba1ad] hover:text-[#e5b96f] flex items-center gap-1 transition-colors px-2 py-1 rounded-lg bg-[#1e2029] hover:bg-[#282b37]"
            title="Reset all adjustments to zero"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* LUT Blend & Master Toggle */}
      <div className="p-3 bg-[#1a1d26] rounded-lg border border-[#2b2f3d] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lutEnabled}
              onChange={(e) => onLutEnabledChange(e.target.checked)}
              className="w-4 h-4 rounded accent-[#e5b96f] cursor-pointer"
            />
            <span className="text-xs font-semibold text-[#f0f3f8]">
              Enable 3D LUT
            </span>
          </label>
          <span className="text-[11px] font-mono text-[#a2a8b8] truncate max-w-[200px]">
            {activeLutName || 'No LUT Selected'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#8e95a5] min-w-[65px]">LUT Mix:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(adjustments.lutStrength * 100)}
            disabled={!lutEnabled}
            onChange={(e) => updateField('lutStrength', Number(e.target.value) / 100)}
            className="flex-1 h-1.5 bg-[#2c303f] rounded cursor-pointer disabled:opacity-30"
          />
          <span className="text-xs font-mono tabular-nums text-[#e5b96f] min-w-[42px] text-right">
            {Math.round(adjustments.lutStrength * 100)}%
          </span>
        </div>

        {/* Tetrahedral vs Trilinear Interpolation Toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-[#252836] text-xs">
          <span className="text-[#8e95a5]">Interpolation:</span>
          <div className="flex items-center gap-1 bg-[#14161f] p-0.5 rounded-lg border border-[#2b2f3d]">
            <button
              type="button"
              onClick={() => onInterpolationModeChange?.('tetrahedral')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                interpolationMode === 'tetrahedral'
                  ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e]/80 shadow-xs'
                  : 'text-[#8e95a5] hover:text-[#d0d5e2]'
              }`}
              title="Tetrahedral: 4-simplex subdivision with zero diagonal curvature error (Pro standard)"
            >
              Tetrahedral (Pro)
            </button>
            <button
              type="button"
              onClick={() => onInterpolationModeChange?.('trilinear')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                interpolationMode === 'trilinear'
                  ? 'bg-[#292218] text-[#e5b96f] border border-[#7d5d2e]/80 shadow-xs'
                  : 'text-[#8e95a5] hover:text-[#d0d5e2]'
              }`}
              title="Trilinear: standard 8-tap cubic interpolation"
            >
              Trilinear
            </button>
          </div>
        </div>
      </div>

      {/* Primary Tonal Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Exposure */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#a8afc0] flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-[#e5b96f]" /> Exposure
            </span>
            <span className="font-mono tabular-nums text-[#d0d5e2]">
              {adjustments.exposure > 0 ? `+${adjustments.exposure.toFixed(2)}` : adjustments.exposure.toFixed(2)} EV
            </span>
          </div>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.05}
            value={adjustments.exposure}
            onChange={(e) => updateField('exposure', Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#a8afc0] flex items-center gap-1.5">
              <Contrast className="w-3.5 h-3.5 text-[#e5b96f]" /> Contrast
            </span>
            <span className="font-mono tabular-nums text-[#d0d5e2]">
              {Math.round(adjustments.contrast * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.01}
            value={adjustments.contrast}
            onChange={(e) => updateField('contrast', Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer"
          />
        </div>

        {/* Highlights */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#a8afc0]">Highlights Roll-off</span>
            <span className="font-mono tabular-nums text-[#d0d5e2]">
              {adjustments.highlights > 0 ? `+${adjustments.highlights}` : adjustments.highlights}
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.highlights}
            onChange={(e) => updateField('highlights', Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer"
          />
        </div>

        {/* Shadows */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-[#a8afc0]">Shadows Lift</span>
            <span className="font-mono tabular-nums text-[#d0d5e2]">
              {adjustments.shadows > 0 ? `+${adjustments.shadows}` : adjustments.shadows}
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={adjustments.shadows}
            onChange={(e) => updateField('shadows', Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer"
          />
        </div>

        {/* Temperature (with Zoomed Fine 33, 67, 100 Kelvin Increments) */}
        {(() => {
          const currentStep = Math.round(adjustments.temperature);
          const currentKelvin = stepToKelvin(currentStep);
          // Zoom window: ±9 steps (±300K) around current center
          const zoomMin = Math.max(-90, currentStep - 9);
          const zoomMax = Math.min(90, currentStep + 9);

          return (
            <div
              className={`space-y-1.5 transition-all duration-200 ${
                isTempZoomed
                  ? 'sm:col-span-2 bg-[#171a24] p-3 rounded-xl border border-[#e5b96f]/50 shadow-lg ring-1 ring-[#e5b96f]/20'
                  : 'bg-[#101218]/50 p-2.5 rounded-lg border border-[#232734]'
              }`}
            >
              <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                <span className="text-[#a8afc0] flex items-center gap-1.5 font-medium">
                  <Thermometer className="w-3.5 h-3.5 text-[#e5b96f]" />
                  <span>Temperature (Kelvin)</span>
                  {isTempZoomed && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#2e2417] text-[#e5b96f] border border-[#6b4e22] font-semibold">
                      🔍 Zoomed Fine (33, 67, 100K)
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-[#e5b96f] font-semibold text-xs">
                    {currentKelvin > 0
                      ? `+${currentKelvin} K (Warm)`
                      : currentKelvin < 0
                      ? `${currentKelvin} K (Cool)`
                      : '0 K (Neutral)'}
                  </span>

                  <button
                    onClick={() => setIsTempZoomed(!isTempZoomed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-colors border cursor-pointer ${
                      isTempZoomed
                        ? 'bg-[#e5b96f] text-[#14120c] font-bold border-[#f2cd8c]'
                        : 'bg-[#1c1f2b] text-[#9ba2b3] hover:text-[#eceef2] border-[#2e3445]'
                    }`}
                    title={isTempZoomed ? 'Click to exit zoomed mode' : 'Click to zoom for fine ±33K increments'}
                  >
                    {isTempZoomed ? (
                      <>
                        <ZoomOut className="w-3 h-3" />
                        <span>Exit Zoom</span>
                      </>
                    ) : (
                      <>
                        <ZoomIn className="w-3 h-3 text-[#e5b96f]" />
                        <span>Zoom Fine</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Slider Input */}
              {isTempZoomed ? (
                /* ZOOMED HIGH-PRECISION SLIDER */
                <div className="space-y-2 pt-1">
                  <div className="relative flex items-center">
                    <input
                      type="range"
                      min={zoomMin}
                      max={zoomMax}
                      step={1}
                      value={currentStep}
                      onChange={(e) => updateField('temperature', Number(e.target.value))}
                      className="w-full h-2.5 bg-[#252838] accent-[#e5b96f] rounded-lg cursor-ew-resize focus:outline-none"
                    />
                  </div>

                  {/* Visual micro-graduation ruler marks (33, 67, 100 Kelvin ticks) */}
                  <div className="flex justify-between items-center text-[9px] font-mono text-[#788296] px-1 select-none">
                    <span>{stepToKelvin(zoomMin)} K</span>
                    <span>-67K</span>
                    <span>-33K</span>
                    <span className="text-[#e5b96f] font-bold text-[10px]">
                      {currentKelvin >= 0 ? `+${currentKelvin}` : currentKelvin} K
                    </span>
                    <span>+33K</span>
                    <span>+67K</span>
                    <span>{stepToKelvin(zoomMax)} K</span>
                  </div>

                  {/* 1-Click Fine Step Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#262c3e]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateField('temperature', Math.max(-90, currentStep - 3))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Step cooler by -100 Kelvin"
                      >
                        -100 K
                      </button>
                      <button
                        onClick={() => updateField('temperature', Math.max(-90, currentStep - 1))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Fine step cooler by -33 Kelvin"
                      >
                        -33 K
                      </button>
                    </div>

                    <button
                      onClick={() => updateField('temperature', 0)}
                      className="px-2 py-1 rounded bg-[#1e212c] hover:bg-[#2a2e3d] text-[#8e95a6] hover:text-[#e5b96f] text-[10px] font-mono transition-colors cursor-pointer"
                      title="Reset Temperature to 0 K (Neutral)"
                    >
                      Reset 0 K
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateField('temperature', Math.min(90, currentStep + 1))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Fine step warmer by +33 Kelvin"
                      >
                        +33 K
                      </button>
                      <button
                        onClick={() => updateField('temperature', Math.min(90, currentStep + 3))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Step warmer by +100 Kelvin"
                      >
                        +100 K
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* NORMAL OVERVIEW SLIDER (Clicking anywhere zooms in) */
                <div className="relative group">
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={1}
                    value={currentStep}
                    onClick={() => setIsTempZoomed(true)}
                    onMouseDown={() => setIsTempZoomed(true)}
                    onChange={(e) => updateField('temperature', Number(e.target.value))}
                    className="w-full h-1.5 bg-[#252836] rounded cursor-pointer group-hover:h-2 transition-all"
                    title="Click to zoom in for fine 33, 67, 100 Kelvin adjustments"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-[#585f72] px-0.5 mt-0.5">
                    <span>-3000 K (Cool)</span>
                    <span className="text-[#a8afc0]">Click slider to zoom fine (33/67/100K)</span>
                    <span>+3000 K (Warm)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Tint (with Zoomed Fine .33, 0.66, 1.0 Increments) */}
        {(() => {
          const currentStep = tintToStep(adjustments.tint);
          const currentTint = stepToTint(currentStep);
          // Zoom window: ±9 steps (±3.0 points) around current center
          const zoomMin = Math.max(-90, currentStep - 9);
          const zoomMax = Math.min(90, currentStep + 9);

          return (
            <div
              className={`space-y-1.5 transition-all duration-200 ${
                isTintZoomed
                  ? 'sm:col-span-2 bg-[#171a24] p-3 rounded-xl border border-[#38bdf8]/50 shadow-lg ring-1 ring-[#38bdf8]/20'
                  : 'bg-[#101218]/50 p-2.5 rounded-lg border border-[#232734]'
              }`}
            >
              <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                <span className="text-[#a8afc0] flex items-center gap-1.5 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-400 to-pink-400" />
                  <span>Tint (Green / Magenta)</span>
                  {isTintZoomed && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#0b2234] text-[#38bdf8] border border-[#164e63] font-semibold">
                      🔍 Zoomed Fine (.33, .66, 1.0)
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums text-[#38bdf8] font-semibold text-xs">
                    {currentTint > 0
                      ? `+${currentTint.toFixed(2)} (Magenta)`
                      : currentTint < 0
                      ? `${currentTint.toFixed(2)} (Green)`
                      : '0.00 (Neutral)'}
                  </span>

                  <button
                    onClick={() => setIsTintZoomed(!isTintZoomed)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-colors border cursor-pointer ${
                      isTintZoomed
                        ? 'bg-[#38bdf8] text-[#0a101d] font-bold border-[#7dd3fc]'
                        : 'bg-[#1c1f2b] text-[#9ba2b3] hover:text-[#eceef2] border-[#2e3445]'
                    }`}
                    title={isTintZoomed ? 'Click to exit zoomed mode' : 'Click to zoom for fine ±0.33 increments'}
                  >
                    {isTintZoomed ? (
                      <>
                        <ZoomOut className="w-3 h-3" />
                        <span>Exit Zoom</span>
                      </>
                    ) : (
                      <>
                        <ZoomIn className="w-3 h-3 text-[#38bdf8]" />
                        <span>Zoom Fine</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Slider Input */}
              {isTintZoomed ? (
                /* ZOOMED HIGH-PRECISION SLIDER */
                <div className="space-y-2 pt-1">
                  <div className="relative flex items-center">
                    <input
                      type="range"
                      min={zoomMin}
                      max={zoomMax}
                      step={1}
                      value={currentStep}
                      onChange={(e) => updateField('tint', stepToTint(Number(e.target.value)))}
                      className="w-full h-2.5 bg-[#252838] accent-[#38bdf8] rounded-lg cursor-ew-resize focus:outline-none"
                    />
                  </div>

                  {/* Visual micro-graduation ruler marks (.33, .66, 1.0 ticks) */}
                  <div className="flex justify-between items-center text-[9px] font-mono text-[#788296] px-1 select-none">
                    <span>{stepToTint(zoomMin).toFixed(2)}</span>
                    <span>-0.66</span>
                    <span>-0.33</span>
                    <span className="text-[#38bdf8] font-bold text-[10px]">
                      {currentTint >= 0 ? `+${currentTint.toFixed(2)}` : currentTint.toFixed(2)}
                    </span>
                    <span>+0.33</span>
                    <span>+0.66</span>
                    <span>{stepToTint(zoomMax).toFixed(2)}</span>
                  </div>

                  {/* 1-Click Fine Step Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#262c3e]">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateField('tint', stepToTint(Math.max(-90, currentStep - 3)))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Step toward Green by -1.0 point"
                      >
                        -1.0
                      </button>
                      <button
                        onClick={() => updateField('tint', stepToTint(Math.max(-90, currentStep - 1)))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Fine step toward Green by -0.33"
                      >
                        -0.33
                      </button>
                    </div>

                    <button
                      onClick={() => updateField('tint', 0)}
                      className="px-2 py-1 rounded bg-[#1e212c] hover:bg-[#2a2e3d] text-[#8e95a6] hover:text-[#38bdf8] text-[10px] font-mono transition-colors cursor-pointer"
                      title="Reset Tint to 0.00 (Neutral)"
                    >
                      Reset 0.00
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateField('tint', stepToTint(Math.min(90, currentStep + 1)))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Fine step toward Magenta by +0.33"
                      >
                        +0.33
                      </button>
                      <button
                        onClick={() => updateField('tint', stepToTint(Math.min(90, currentStep + 3)))}
                        className="px-2 py-1 rounded bg-[#202433] hover:bg-[#2b3145] text-[#b3bace] text-[10px] font-mono transition-colors border border-[#30364c] cursor-pointer"
                        title="Step toward Magenta by +1.0 point"
                      >
                        +1.0
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* NORMAL OVERVIEW SLIDER (Clicking anywhere zooms in) */
                <div className="relative group">
                  <input
                    type="range"
                    min={-90}
                    max={90}
                    step={1}
                    value={currentStep}
                    onClick={() => setIsTintZoomed(true)}
                    onMouseDown={() => setIsTintZoomed(true)}
                    onChange={(e) => updateField('tint', stepToTint(Number(e.target.value)))}
                    className="w-full h-1.5 bg-[#252836] rounded cursor-pointer group-hover:h-2 transition-all"
                    title="Click to zoom in for fine .33, 0.66, 1.0 adjustments"
                  />
                  <div className="flex justify-between text-[8px] font-mono text-[#585f72] px-0.5 mt-0.5">
                    <span>-30.0 (Green)</span>
                    <span className="text-[#a8afc0]">Click slider to zoom fine (.33/.66/1.0)</span>
                    <span>+30.0 (Magenta)</span>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Saturation */}
        <div className="space-y-1 sm:col-span-2">
          <div className="flex justify-between text-xs">
            <span className="text-[#a8afc0] flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-[#e5b96f]" /> Saturation
            </span>
            <span className="font-mono tabular-nums text-[#d0d5e2]">
              {Math.round(adjustments.saturation * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.02}
            value={adjustments.saturation}
            onChange={(e) => updateField('saturation', Number(e.target.value))}
            className="w-full h-1.5 bg-[#252836] rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Export Graded 3D LUT Card */}
      <div className="p-3 bg-[#161922] rounded-lg border border-[#2a3040] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#272115] border border-[#5a4320] flex items-center justify-center text-[#e5b96f] shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold text-[#f0f3f8] flex items-center gap-1.5 flex-wrap">
              <span>Export Graded 3D LUT (.CUBE)</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2b2216] border border-[#5e4320] text-[#e5b96f] flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Request for passcode via email to developer
              </span>
            </span>
            <span className="text-[11px] text-[#8e95a5] truncate">
              Bake active primary grade & 3D LUT into DaVinci Resolve & Premiere format
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export LUT</span>
        </button>
      </div>

      <div className="text-[11px] text-[#717787] flex items-start gap-1.5 bg-[#101217] p-2.5 rounded-lg border border-[#20222a]">
        <ShieldAlert className="w-4 h-4 text-[#a67c3b] shrink-0 mt-0.5" />
        <span>
          GPU Shader Acceleration: All color adjustments and 3D LUT trilinear interpolations run inside the WebGL fragment shader on each frame at zero CPU rendering overhead.
        </span>
      </div>

      {/* Export LUT modal (behind a UI lock passcode) */}
      <ExportLutModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        adjustments={adjustments}
        activeLut={activeLut || null}
        lutEnabled={lutEnabled}
      />
    </div>
  );
};
