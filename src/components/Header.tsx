import React, { useRef } from 'react';
import { Film, Upload, FolderPlus, HelpCircle, Mail, Monitor, Download } from 'lucide-react';
import { PlaybackResolution } from '../types';

interface HeaderProps {
  onOpenVideoFile: (file: File) => void;
  onOpenFolder: (files: FileList | File[]) => void;
  onOpenShortcuts: () => void;
  onOpenDiagnostics?: () => void;
  onOpenContact: () => void;
  onOpenExport?: () => void;
  fileName?: string;
  playbackResolution: PlaybackResolution;
  onResolutionChange: (res: PlaybackResolution) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenVideoFile,
  onOpenFolder,
  onOpenShortcuts,
  onOpenDiagnostics,
  onOpenContact,
  onOpenExport,
  fileName,
  playbackResolution,
  onResolutionChange
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onOpenVideoFile(file);
      e.target.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onOpenFolder(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#242733] bg-[#12141a]/95 backdrop-blur-md sticky top-0 z-40 select-none">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#272118] border border-[#523e21] flex items-center justify-center text-[#e5b96f]">
          <Film className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-[#f4f6fa] whitespace-nowrap">
            Nikon ZR Player
          </span>
          <span className="text-[10px] text-[#9399a8] font-mono tracking-wide whitespace-nowrap">
            ProRes / H.264 Proxy Colorist Suite
          </span>
        </div>
      </div>

      {/* Zone 2: Actions & Utilities (Benchmark, Shortcuts, Open Folder, Open Video) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Hidden File Input for single video */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="video/*,.mp4,.mov,.m4v,.mkv,.webm"
          className="hidden"
        />

        {/* Hidden Folder Input for directory */}
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFolderChange}
          // @ts-expect-error webkitdirectory is supported in all modern browsers
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
        />

        <button
          onClick={onOpenContact}
          className="px-2.5 py-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#252936] text-[#c5cad3] hover:text-[#f4f6fa] border border-[#2b2f3d] text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
          title="Contact the developer (shyju7896@gmail.com)"
        >
          <Mail className="w-3.5 h-3.5 text-[#e5b96f]" />
          <span className="hidden sm:inline">Contact the developer</span>
          <span className="sm:hidden">Contact</span>
        </button>

        {/* Display Resolution Toggle Button (Full Resolution, 1080p, 720p) */}
        <div className="hidden sm:flex items-center rounded-lg bg-[#1a1d26] border border-[#2b2f3d] p-0.5 shadow-sm">
          <button
            onClick={() => {
              const order: PlaybackResolution[] = ['original', '1080', '720'];
              const currentIdx = order.indexOf(playbackResolution);
              const nextRes = order[(currentIdx + 1) % order.length];
              onResolutionChange(nextRes);
            }}
            className="px-2 py-1 text-xs font-mono font-medium text-[#e5b96f] hover:text-[#f3cd8c] flex items-center gap-1.5 transition-colors cursor-pointer"
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

          <div className="flex items-center border-l border-[#2b2f3d] pl-0.5 pr-0.5">
            <button
              onClick={() => onResolutionChange('original')}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                playbackResolution === 'original'
                  ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                  : 'text-[#6c7385] hover:text-[#d5dae6]'
              }`}
              title="Full Resolution (Native video resolution)"
            >
              Full
            </button>
            <button
              onClick={() => onResolutionChange('1080')}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                playbackResolution === '1080'
                  ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                  : 'text-[#6c7385] hover:text-[#d5dae6]'
              }`}
              title="1080p (Full HD 1920x1080)"
            >
              1080p
            </button>
            <button
              onClick={() => onResolutionChange('720')}
              className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors ${
                playbackResolution === '720'
                  ? 'bg-[#292218] text-[#e5b96f] font-bold border border-[#523e21]'
                  : 'text-[#6c7385] hover:text-[#d5dae6]'
              }`}
              title="720p (HD 1280x720 proxy)"
            >
              720p
            </button>
          </div>
        </div>

        <button
          onClick={onOpenShortcuts}
          className="p-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#252936] text-[#9399a8] hover:text-[#f0f3f8] border border-[#2b2f3d] transition-colors"
          title="Keyboard shortcuts guide"
          aria-label="Keyboard shortcuts"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        <button
          onClick={() => folderInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-[#e5b96f] bg-[#292218] hover:bg-[#382d1c] border border-[#523e21] rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          title="Load a folder with multiple video clips"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open Folder</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium text-[#dce1eb] bg-[#1a1d26] hover:bg-[#252936] border border-[#2b2f3d] rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          title="Open single video file"
        >
          <Upload className="w-3.5 h-3.5 text-[#e5b96f]" />
          <span>Open Video</span>
        </button>

        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#14120c] bg-[#e5b96f] hover:bg-[#f0c883] rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Export Video"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Export video</span>
          </button>
        )}
      </div>
    </header>
  );
};
