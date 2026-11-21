import { useState, useRef, useCallback } from 'react';
import { ExportProgress } from '../types';

export function useVideoExport() {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>({
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

  const startExport = useCallback(() => {
    setIsExporting(true);
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
  }, []);

  const finishExport = useCallback(() => {
    setIsExporting(false);
  }, []);

  return {
    isExporting,
    setIsExporting,
    exportProgress,
    setExportProgress,
    startExport,
    cancelExport,
    finishExport,
    abortControllerRef
  };
}
