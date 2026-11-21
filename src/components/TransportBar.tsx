import React from 'react';
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Columns,
  ChevronLeft,
  ChevronRight,
  Monitor
} from 'lucide-react';
import { SplitMode, PlaybackResolution } from '../types';

interface TransportBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayToggle: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: number) => void;
  isLooping: boolean;
  onToggleLoop: () => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  splitMode: SplitMode;
  onSplitModeChange: (mode: SplitMode) => void;
  splitPos: number;
  onSplitPosChange: (pos: number) => void;
  onOpenDiagnostics?: () => void;
  playbackResolution: PlaybackResolution;
  onResolutionChange: (res: PlaybackResolution) => void;
  onNextClip?: () => void;
  onPrevClip?: () => void;
  playlistCount?: number;
  currentClipIndex?: number;
  disabled?: boolean;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatTimecode(seconds: number, fps: number = 24): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00:00';
  const totalFrames = Math.floor(seconds * fps);
  const ff = String(totalFrames % fps).padStart(2, '0');
  const s = Math.floor(seconds);
  const ss = String(s % 60).padStart(2, '0');
  const mm = String(Math.floor(s / 60) % 60).padStart(2, '0');
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  return `${hh}:${mm}:${ss}:${ff}`;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  isPlaying,
  currentTime,
  duration,
  onPlayToggle,
  onStop,
  onSeek,
  onStepFrame,
  isLooping,
  onToggleLoop,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  speed,
  onSpeedChange,
  splitMode,
  onSplitModeChange,
  splitPos,
  onSplitPosChange,
  onOpenDiagnostics,
  playbackResolution,
  onResolutionChange,
  onNextClip,
  onPrevClip,
  playlistCount = 0,
  currentClipIndex = 0,
  disabled = false
}) => {
  const progressRatio = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-[#14161d] border border-[#262934] rounded-xl shadow-lg">
      {/* Scrubber timeline */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono tabular-nums text-[#a0a6b5] min-w-[54px]">
          {formatTime(currentTime)}
        </span>

        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.01}
            value={currentTime}
            disabled={disabled}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-1.5 bg-[#252834] rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#e5b96f]"
            aria-label="Seek Video"
          />
        </div>

        <span className="text-xs font-mono tabular-nums text-[#727887] min-w-[54px] text-right">
          {formatTime(duration)}
        </span>

        <div className="hidden lg:flex items-center text-xs font-mono tabular-nums text-[#e5b96f] bg-[#221e16] border border-[#4d3b20] px-2.5 py-0.5 rounded">
          {formatTimecode(currentTime)}
        </div>
      </div>

      {/* Primary transport buttons and secondary controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Playback controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPlayToggle}
            disabled={disabled}
            className="px-3.5 py-1.5 rounded-lg bg-[#e5b96f] hover:bg-[#f0c883] text-[#13110b] font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            onClick={onStop}
            disabled={disabled}
            className="p-2 rounded-lg bg-[#20222a] hover:bg-[#2c303c] text-[#c4c8d2] transition-colors disabled:opacity-40"
            title="Stop Playback"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          <button
            onClick={() => onStepFrame(-1)}
            disabled={disabled}
            className="p-2 rounded-lg bg-[#20222a] hover:bg-[#2c303c] text-[#c4c8d2] transition-colors disabled:opacity-40"
            title="Step back 1 frame (Left Arrow / [)"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onStepFrame(1)}
            disabled={disabled}
            className="p-2 rounded-lg bg-[#20222a] hover:bg-[#2c303c] text-[#c4c8d2] transition-colors disabled:opacity-40"
            title="Step forward 1 frame (Right Arrow / ])"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleLoop}
            className={`p-2 rounded-lg transition-colors ${
              isLooping ? 'bg-[#3b301f] text-[#e5b96f] border border-[#6b512c]' : 'bg-[#20222a] hover:bg-[#2c303c] text-[#8e94a2]'
            }`}
            title="Toggle Repeat Loop"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {playlistCount > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#20222a] border border-[#303444] text-[11px] font-mono text-[#c4c8d2] shadow-sm">
              <button
                onClick={onPrevClip}
                disabled={currentClipIndex <= 0}
                className="p-0.5 hover:text-[#e5b96f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous clip in folder (Shift+Left)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[#e5b96f] font-semibold px-1">
                {currentClipIndex + 1}/{playlistCount}
              </span>
              <button
                onClick={onNextClip}
                disabled={currentClipIndex >= playlistCount - 1}
                className="p-0.5 hover:text-[#e5b96f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next clip in folder (Shift+Right)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Center: Split screen controls */}
        <div className="flex items-center gap-2 bg-[#1b1d25] px-2.5 py-1 rounded-lg border border-[#2b2e3b]">
          <Columns className="w-3.5 h-3.5 text-[#e5b96f]" />
          <span className="text-xs text-[#959baa]">Split View:</span>
          <select
            value={splitMode}
            onChange={(e) => onSplitModeChange(e.target.value as SplitMode)}
            className="bg-[#242732] text-xs text-[#eceef2] border border-[#3b3f4f] rounded px-2 py-1 outline-none cursor-pointer"
          >
            <option value="off">Off (Graded)</option>
            <option value="vertical">Vertical Split</option>
            <option value="horizontal">Horizontal Split</option>
            <option value="side-by-side">Side-by-Side (2-Up)</option>
          </select>

          {(splitMode === 'vertical' || splitMode === 'horizontal') && (
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="range"
                min={5}
                max={95}
                value={Math.round(splitPos * 100)}
                onChange={(e) => onSplitPosChange(Number(e.target.value) / 100)}
                className="w-16 h-1 bg-[#323644] rounded cursor-pointer"
              />
              <span className="text-[11px] font-mono tabular-nums text-[#a0a6b5]">
                {Math.round(splitPos * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* Right: Audio Volume, Speed, Diagnostics */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="p-1.5 text-[#a0a6b5] hover:text-[#eceef2] transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-[#e06464]" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={isMuted ? 0 : Math.round(volume * 100)}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              className="w-16 h-1.5 bg-[#252834] rounded cursor-pointer"
              title="Volume"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[#787e8e]">Speed:</span>
            <select
              value={speed}
              onChange={(e) => onSpeedChange(Number(e.target.value))}
              className="bg-[#20222a] text-xs text-[#c4c8d2] border border-[#343846] rounded px-1.5 py-1 outline-none cursor-pointer"
            >
              <option value="0.25">0.25×</option>
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1.0× Normal</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2.0×</option>
            </select>
          </div>

          {/* Display Resolution Toggle Button (options: Full Resolution, 1080p, 720p) */}
          <div className="flex items-center rounded-lg bg-[#20222a] border border-[#343846] p-0.5 shadow-sm">
            <button
              onClick={() => {
                const order: PlaybackResolution[] = ['original', '1080', '720'];
                const currentIdx = order.indexOf(playbackResolution);
                const nextRes = order[(currentIdx + 1) % order.length];
                onResolutionChange(nextRes);
              }}
              className="px-2 py-0.5 text-xs font-mono font-medium text-[#e5b96f] hover:text-[#f3cd8c] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Display Resolution: Click to toggle between Full Resolution, 1080p, and 720p"
            >
              <Monitor className="w-3.5 h-3.5 text-[#e5b96f]" />
              <span className="font-semibold text-[11px]">
                {playbackResolution === 'original'
                  ? 'Full Resolution'
                  : playbackResolution === '1080'
                  ? '1080p'
                  : '720p'}
              </span>
            </button>

            <div className="flex items-center border-l border-[#343846] pl-0.5 pr-0.5">
              <button
                onClick={() => onResolutionChange('original')}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  playbackResolution === 'original'
                    ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                    : 'text-[#7d8496] hover:text-[#d5dae6]'
                }`}
                title="Full Resolution (Native video decode)"
              >
                Full
              </button>
              <button
                onClick={() => onResolutionChange('1080')}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  playbackResolution === '1080'
                    ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                    : 'text-[#7d8496] hover:text-[#d5dae6]'
                }`}
                title="1080p (Full HD proxy)"
              >
                1080p
              </button>
              <button
                onClick={() => onResolutionChange('720')}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  playbackResolution === '720'
                    ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                    : 'text-[#7d8496] hover:text-[#d5dae6]'
                }`}
                title="720p (HD proxy)"
              >
                720p
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
