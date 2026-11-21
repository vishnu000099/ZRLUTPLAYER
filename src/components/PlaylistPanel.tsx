import React, { useRef, useState } from 'react';
import {
  Folder,
  Film,
  Play,
  SkipForward,
  SkipBack,
  Trash2,
  Plus,
  FolderPlus,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PlaylistItem } from '../types';

interface PlaylistPanelProps {
  playlist: PlaylistItem[];
  currentIndex: number;
  onSelectClip: (index: number) => void;
  onNextClip: () => void;
  onPrevClip: () => void;
  onOpenFolder: (files: FileList | File[]) => void;
  onAddFiles: (files: FileList | File[]) => void;
  onClearPlaylist: () => void;
  autoPlayNext: boolean;
  onToggleAutoPlayNext: () => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const s = Math.floor(seconds);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export const PlaylistPanel: React.FC<PlaylistPanelProps> = ({
  playlist,
  currentIndex,
  onSelectClip,
  onNextClip,
  onPrevClip,
  onOpenFolder,
  onAddFiles,
  onClearPlaylist,
  autoPlayNext,
  onToggleAutoPlayNext
}) => {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'thumbnails' | 'list'>('thumbnails');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onOpenFolder(e.target.files);
      e.target.value = '';
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="bg-[#14161d] border border-[#262934] rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-md">
      {/* Hidden file & folder inputs */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        // @ts-expect-error webkitdirectory is standard in HTML5 for directory picking
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilesChange}
        accept="video/*,.mp4,.mov,.m4v,.mkv,.webm"
        multiple
        className="hidden"
      />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#242733]">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#e5b96f]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#d5dae6]">
            Folder Queue & Video Clips ({playlist.length} {playlist.length === 1 ? 'Clip' : 'Clips'})
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View mode toggle (Thumbnails vs List) */}
          <div className="flex items-center bg-[#1b1e27] border border-[#2b2f3e] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('thumbnails')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'thumbnails' ? 'bg-[#292218] text-[#e5b96f]' : 'text-[#828898] hover:text-[#eceef2]'
              }`}
              title="Thumbnail Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-[#292218] text-[#e5b96f]' : 'text-[#828898] hover:text-[#eceef2]'
              }`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Autoplay toggle */}
          <button
            onClick={onToggleAutoPlayNext}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              autoPlayNext
                ? 'bg-[#292218] border-[#7d5d2e] text-[#e5b96f]'
                : 'bg-[#1b1e27] border-[#292d3b] text-[#868d9d] hover:bg-[#202430]'
            }`}
            title="When active, automatically advances to the next clip in folder upon clip end"
          >
            <span>Auto-Advance:</span>
            <span className="font-semibold">{autoPlayNext ? 'ON' : 'OFF'}</span>
          </button>

          {/* Open folder button */}
          <button
            onClick={() => folderInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-semibold text-[#14120c] bg-[#e5b96f] hover:bg-[#f0c883] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            title="Select a whole folder with multiple Nikon ZR video clips"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Load Video Folder</span>
          </button>

          {/* Add more videos button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium text-[#f0f3f8] bg-[#242733] hover:bg-[#323646] border border-[#3d4254] rounded-lg transition-colors flex items-center gap-1.5"
            title="Add multiple video files to this playlist"
          >
            <Plus className="w-3.5 h-3.5 text-[#e5b96f]" />
            <span>Add Clips</span>
          </button>

          {playlist.length > 0 && (
            <button
              onClick={onClearPlaylist}
              className="p-1.5 text-[#e06464] hover:bg-[#2c1d1d] rounded-lg transition-colors"
              title="Clear entire playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Collapse/Expand toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 text-[#94a3b8] hover:text-[#eceef2] hover:bg-[#202430] rounded-lg transition-colors flex items-center gap-1"
            title={isCollapsed ? 'Expand Playlist' : 'Collapse Playlist'}
          >
            {isCollapsed ? (
              <span className="flex items-center gap-1 text-[11px] font-mono text-[#e5b96f]">
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-mono text-[#8a91a0]">
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Collapse</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Playlist Content (Now Playing, Thumbnails / List, or Empty State) */}
      {!isCollapsed && (
        <>
          {/* Playlist Status Bar / Active clip info */}
          {playlist.length > 0 ? (
            <div className="p-3 bg-[#181b24] rounded-lg border border-[#2b2f3d] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-[#797f90]">
                    Now Playing ({currentIndex + 1} of {playlist.length})
                  </span>
                  <span className="text-xs font-semibold text-[#e5b96f] flex items-center gap-1.5 truncate max-w-[340px]">
                    <Film className="w-3.5 h-3.5 text-[#e5b96f]" />
                    <span className="truncate">{playlist[currentIndex]?.name}</span>
                  </span>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={onPrevClip}
                  disabled={currentIndex <= 0}
                  className="px-2.5 py-1 text-xs rounded bg-[#20232e] hover:bg-[#2b2f3d] text-[#c5cad3] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  title="Play previous clip in queue"
                >
                  <SkipBack className="w-3 h-3" />
                  <span>Previous</span>
                </button>
                <button
                  onClick={onNextClip}
                  disabled={currentIndex >= playlist.length - 1}
                  className="px-2.5 py-1 text-xs rounded bg-[#20232e] hover:bg-[#2b2f3d] text-[#c5cad3] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  title="Play next clip in queue"
                >
                  <span>Next</span>
                  <SkipForward className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="py-4 px-5 bg-[#171a23]/60 border border-dashed border-[#292d3b] rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#292218] border border-[#7d5d2e]/60 flex items-center justify-center shrink-0">
                  <Folder className="w-4 h-4 text-[#e5b96f]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#d5dae6]">No folder or video clips loaded</p>
                  <p className="text-[11px] text-[#787f90] mt-0.5">
                    Load a folder of Nikon ZR clips or batch-select files to play in sequence.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#14120c] bg-[#e5b96f] hover:bg-[#f0c883] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Select Folder</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium text-[#f0f3f8] bg-[#242733] hover:bg-[#323646] border border-[#3d4254] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#e5b96f]" />
                  <span>Add Clips</span>
                </button>
              </div>
            </div>
          )}

      {/* Thumbnail View (Grid of Video Cards) */}
      {playlist.length > 0 && viewMode === 'thumbnails' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 max-h-[460px] overflow-y-auto pr-1">
          {playlist.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={item.id}
                onClick={() => onSelectClip(idx)}
                className={`group flex flex-col rounded-xl overflow-hidden border text-left transition-all relative ${
                  isCurrent
                    ? 'bg-[#292218] border-[#e5b96f] ring-2 ring-[#e5b96f]/50 shadow-lg'
                    : 'bg-[#181a23] border-[#292d3a] hover:border-[#484e62] hover:bg-[#1e212c]'
                }`}
              >
                {/* 16:9 Thumbnail Stage */}
                <div className="relative w-full aspect-video bg-[#0c0d12] overflow-hidden flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#555b6d] bg-gradient-to-br from-[#12141a] to-[#0b0c10]">
                      <Film className="w-6 h-6 mb-1 text-[#434756]" />
                      <span className="text-[10px] font-mono">Generating...</span>
                    </div>
                  )}

                  {/* Gradient shadow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                  {/* Top-Left: Clip Index */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isCurrent ? 'bg-[#e5b96f] text-black shadow-md' : 'bg-black/70 text-[#cbd0dc] backdrop-blur-sm'
                    }`}>
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Top-Right: Playing Indicator */}
                  {isCurrent && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#e5b96f] text-black flex items-center gap-1 shadow-md animate-pulse">
                        <Play className="w-2.5 h-2.5 fill-current" />
                        PLAYING
                      </span>
                    </div>
                  )}

                  {/* Bottom-Right: Duration pill */}
                  {item.duration !== undefined && item.duration > 0 && (
                    <div className="absolute bottom-1.5 right-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums bg-black/80 text-[#e4e7ee] backdrop-blur-sm">
                        {formatDuration(item.duration)}
                      </span>
                    </div>
                  )}

                  {/* Hover play icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                    <div className="w-9 h-9 rounded-full bg-[#e5b96f]/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Card Footer Info */}
                <div className="p-2.5 flex flex-col gap-0.5 min-w-0">
                  <span
                    className={`text-xs font-medium truncate ${isCurrent ? 'text-[#e5b96f] font-semibold' : 'text-[#d7dbe6]'}`}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#767d8e]">
                    <span>{item.sizeMB} MB</span>
                    <span className="text-[#a0a6b5] group-hover:text-[#e5b96f] transition-colors">
                      {isCurrent ? 'Playing' : 'Play ▶'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Compact List View */}
      {playlist.length > 0 && viewMode === 'list' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[380px] overflow-y-auto pr-1">
          {playlist.map((item, idx) => {
            const isCurrent = idx === currentIndex;
            return (
              <button
                key={item.id}
                onClick={() => onSelectClip(idx)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-[#292218] border-[#7d5d2e] ring-1 ring-[#e5b96f]/40'
                    : 'bg-[#1a1d26] border-[#282c39] hover:bg-[#202430] hover:border-[#3b4152]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Thumbnail mini preview */}
                  <div className="w-12 h-8 rounded bg-[#0c0d12] overflow-hidden shrink-0 border border-[#2b2e3b]">
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#555]">
                        <Film className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-xs font-semibold truncate ${isCurrent ? 'text-[#e5b96f]' : 'text-[#e0e4ed]'}`}>
                      {item.name}
                    </span>
                    <span className="text-[10px] font-mono text-[#767d8f]">
                      #{idx + 1} · {item.sizeMB} MB {item.duration ? `· ${formatDuration(item.duration)}` : ''}
                    </span>
                  </div>
                </div>

                {isCurrent && (
                  <span className="text-[10px] font-mono text-[#e5b96f] bg-[#3b2f1e] px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>PLAYING</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
        </>
      )}
    </div>
  );
};
