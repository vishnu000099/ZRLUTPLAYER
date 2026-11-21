import { useState, useEffect } from 'react';

interface KeyboardShortcutsOptions {
  onPlayToggle: () => void;
  onPrevClip: () => void;
  onNextClip: () => void;
  onSeekRelative: (seconds: number) => void;
  onStepFrame: (direction: number) => void;
  onSpeedMultiply: (factor: number) => void;
  onPause: () => void;
  onToggleLut: () => void;
  onCycleSplitMode: () => void;
  onSnapshot: () => void;
  onToggleFullscreen: () => void;
  onSeekToStart: () => void;
}

export function useKeyboardShortcuts(options: KeyboardShortcutsOptions) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          options.onPlayToggle();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            options.onPrevClip();
          } else {
            options.onSeekRelative(-5);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            options.onNextClip();
          } else {
            options.onSeekRelative(5);
          }
          break;
        case 'BracketLeft':
          e.preventDefault();
          options.onStepFrame(-1);
          break;
        case 'BracketRight':
          e.preventDefault();
          options.onStepFrame(1);
          break;
        case 'KeyJ':
          e.preventDefault();
          options.onSpeedMultiply(0.5);
          break;
        case 'KeyK':
          e.preventDefault();
          options.onPause();
          break;
        case 'KeyL':
          e.preventDefault();
          options.onSpeedMultiply(2.0);
          break;
        case 'KeyB':
          e.preventDefault();
          options.onToggleLut();
          break;
        case 'KeyS':
          e.preventDefault();
          options.onCycleSplitMode();
          break;
        case 'KeyC':
          e.preventDefault();
          options.onSnapshot();
          break;
        case 'KeyF':
          e.preventDefault();
          options.onToggleFullscreen();
          break;
        case 'PageUp':
          e.preventDefault();
          options.onPrevClip();
          break;
        case 'PageDown':
          e.preventDefault();
          options.onNextClip();
          break;
        case 'Digit0':
        case 'Home':
          e.preventDefault();
          options.onSeekToStart();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [options]);

  return {
    isShortcutsOpen,
    setIsShortcutsOpen
  };
}
