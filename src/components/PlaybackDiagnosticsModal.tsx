import React, { useState } from 'react';
import { X, Play, Cpu, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { PlaybackResolution, PlaybackTestResult } from '../types';

interface PlaybackDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoElement: HTMLVideoElement | null;
  currentMode: PlaybackResolution;
  onSelectMode: (mode: PlaybackResolution) => void;
  gpuInfo: { vendor: string; renderer: string };
  testResult: PlaybackTestResult | null;
  onRunTest: () => Promise<void>;
  isRunningTest: boolean;
  onOpenParityAudit?: () => void;
}

export const PlaybackDiagnosticsModal: React.FC<PlaybackDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  videoElement,
  currentMode,
  onSelectMode,
  gpuInfo,
  testResult,
  onRunTest,
  isRunningTest,
  onOpenParityAudit
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-[#161820] border border-[#2e3240] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#252834]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#272118] border border-[#523e21] flex items-center justify-center text-[#e5b96f]">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#f4f6fa]">
                Playback Benchmark & Hardware Optimization
              </h3>
              <p className="text-[11px] text-[#8e94a4]">
                Evaluate dropped frames and select optimal GPU LUT rendering pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8e94a4] hover:text-[#eceef2] hover:bg-[#222530] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-5">
          {/* Hardware Specs */}
          <div className="bg-[#101217] p-3.5 rounded-xl border border-[#21242f] text-xs space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span className="text-[#727888]">GPU Hardware:</span>
              <span className="text-[#d8dce6] text-right font-sans font-medium">{gpuInfo.renderer}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#727888]">Vendor:</span>
              <span className="text-[#d8dce6]">{gpuInfo.vendor}</span>
            </div>
            {videoElement && videoElement.videoWidth > 0 && (
              <div className="flex justify-between">
                <span className="text-[#727888]">Source Stream:</span>
                <span className="text-[#e5b96f]">
                  {videoElement.videoWidth} × {videoElement.videoHeight} px
                </span>
              </div>
            )}
          </div>

          {/* Test Action */}
          <div className="p-4 bg-[#1b1e27] rounded-xl border border-[#2b2f3e] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-[#f0f3f8]">Smoothness Benchmark</h4>
                <p className="text-[11px] text-[#8f96a7]">
                  Plays 3 seconds of footage to monitor decoder dropped frame rate.
                </p>
              </div>

              <button
                onClick={onRunTest}
                disabled={isRunningTest || !videoElement || videoElement.readyState < 1}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#e5b96f] hover:bg-[#f0c883] text-[#14120c] transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                {isRunningTest ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Benchmarking…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Smoothness Test</span>
                  </>
                )}
              </button>
            </div>

            {/* Test Result Box */}
            {testResult && (
              <div className="mt-2 p-3 bg-[#111319] rounded-lg border border-[#2b2f3d] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#e5b96f]">
                    Recommendation: {testResult.recommendedMode === 'original' ? 'Original Source Resolution' : `${testResult.recommendedMode}p Processing`}
                  </span>
                  <span className="font-mono text-[11px] text-[#9ba1ad]">
                    {testResult.droppedPercent.toFixed(1)}% dropped frames ({testResult.droppedFrames}/{testResult.totalFrames})
                  </span>
                </div>
                <p className="text-[11px] text-[#9ba1ad] leading-relaxed">
                  {testResult.reason}
                </p>
              </div>
            )}
          </div>

          {/* Processing Resolution Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[#b3b9c7]">
              Active GPU LUT Processing Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'original', label: 'Original', desc: 'Direct 1:1 camera pixels' },
                  { id: '1080', label: '1080p (FHD)', desc: 'Optimized proxy rendering' },
                  { id: '720', label: '720p (HD)', desc: 'High performance mode' }
                ] as const
              ).map((mode) => {
                const isSelected = currentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => onSelectMode(mode.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#292218] border-[#7d5d2e] ring-1 ring-[#e5b96f]/40'
                        : 'bg-[#1a1d26] border-[#282c39] hover:bg-[#20232e]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${isSelected ? 'text-[#e5b96f]' : 'text-[#e3e6ee]'}`}>
                        {mode.label}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#e5b96f]" />}
                    </div>
                    <span className="text-[10px] text-[#787f90] block mt-1">
                      {mode.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Pipeline Parity Audit Link */}
          {onOpenParityAudit && (
            <div className="p-3.5 bg-[#141822] border border-[#232c3f] rounded-xl flex items-center justify-between gap-3">
              <div>
                <h5 className="text-xs font-semibold text-[#f0f3f8] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Color Pipeline Parity Audit
                </h5>
                <p className="text-[11px] text-[#80899e] mt-0.5">
                  Run automated numerical comparison between CPU and GPU color grading shaders.
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenParityAudit();
                }}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-950/50 hover:bg-emerald-950 border border-emerald-600/40 text-emerald-300 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                Launch Audit
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-[#12141a] border-t border-[#252834] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-[#d5dae6] hover:bg-[#232733] rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
