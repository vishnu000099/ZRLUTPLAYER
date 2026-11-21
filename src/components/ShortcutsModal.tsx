import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause playback' },
    { key: 'J / K / L', desc: 'Reverse play (J), Pause (K), Fast forward (L)' },
    { key: '← / →', desc: 'Seek 5 seconds backward / forward' },
    { key: '[ / ]', desc: 'Step 1 frame backward / forward' },
    { key: 'B', desc: 'Bypass / Enable 3D LUT instantly' },
    { key: 'S', desc: 'Cycle split-screen modes (Off, Vertical, Side-by-Side)' },
    { key: 'Shift + ← / →', desc: 'Previous / Next clip in folder queue' },
    { key: 'C', desc: 'Capture full-resolution graded PNG snapshot' },
    { key: 'F', desc: 'Toggle Fullscreen stage' },
    { key: 'Home / 0', desc: 'Jump to beginning of clip' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-[#161820] border border-[#2e3240] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#252834]">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#e5b96f]" />
            <h3 className="text-sm font-bold text-[#f4f6fa]">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[#8e94a4] hover:text-[#eceef2] hover:bg-[#222530] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
          {shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between py-2 border-b border-[#20232e] text-xs last:border-none"
            >
              <span className="text-[#a8afbf]">{sc.desc}</span>
              <kbd className="px-2 py-1 rounded bg-[#20232d] border border-[#3b4052] font-mono text-[11px] text-[#e5b96f] shadow-sm">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-[#12141a] border-t border-[#252834] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-[#14120c] bg-[#e5b96f] hover:bg-[#f0c883] rounded-lg transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
