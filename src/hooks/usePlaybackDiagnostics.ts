import { useState, useCallback } from 'react';
import { PlaybackResolution, PlaybackTestResult } from '../types';

export function usePlaybackDiagnostics() {
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<PlaybackTestResult | null>(null);
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);

  const handleRunPlaybackTest = useCallback(
    async (
      video: HTMLVideoElement | null,
      gpuInfo: { vendor: string; renderer: string },
      onSelectMode: (res: PlaybackResolution) => void
    ) => {
      if (!video || !video.videoWidth) return;

      setIsRunningTest(true);
      const wasPaused = video.paused;
      const oldTime = video.currentTime;
      const oldRate = video.playbackRate;

      const testStart = Math.min(Math.max(0, oldTime), Math.max(0, (video.duration || 60) - 5));
      const testSeconds = 3;

      let beforeDropped: number | null = null;
      let afterDropped: number | null = null;
      let beforeTotal: number | null = null;
      let afterTotal: number | null = null;

      try {
        if (typeof (video as any).getVideoPlaybackQuality === 'function') {
          const q = (video as any).getVideoPlaybackQuality();
          beforeDropped = q.droppedVideoFrames;
          beforeTotal = q.totalVideoFrames;
        } else if ('webkitDroppedFrameCount' in video) {
          beforeDropped = (video as any).webkitDroppedFrameCount;
          beforeTotal = (video as any).webkitDecodedFrameCount;
        }

        video.pause();
        video.currentTime = testStart;
        video.playbackRate = 1;
        await video.play().catch(() => {});

        await new Promise((resolve) => setTimeout(resolve, testSeconds * 1000));

        if (typeof (video as any).getVideoPlaybackQuality === 'function') {
          const q = (video as any).getVideoPlaybackQuality();
          afterDropped = q.droppedVideoFrames;
          afterTotal = q.totalVideoFrames;
        } else if ('webkitDroppedFrameCount' in video) {
          afterDropped = (video as any).webkitDroppedFrameCount;
          afterTotal = (video as any).webkitDecodedFrameCount;
        }

        const dropped =
          beforeDropped !== null && afterDropped !== null
            ? Math.max(0, afterDropped - beforeDropped)
            : 0;
        const total =
          beforeTotal !== null && afterTotal !== null
            ? Math.max(0, afterTotal - beforeTotal)
            : 90;
        const dropPct = total > 0 ? (dropped / total) * 100 : 0;

        const pixels = video.videoWidth * video.videoHeight;
        let rec: PlaybackResolution = 'original';
        let reason = '';

        if (dropPct >= 8 || pixels >= 3840 * 2160) {
          rec = '1080';
          reason =
            dropPct >= 8
              ? `Decoder dropped ~${dropPct.toFixed(1)}% of frames during full playback. 1080p proxy processing avoids GPU pipeline bottlenecks.`
              : '4K/UHD high-resolution source. 1080p processing reduces texture transfer and GPU load for buttery 60fps scrubbing.';
        } else if (dropPct >= 3 || pixels >= 2560 * 1440) {
          rec = '1080';
          reason = `Slight frame drop detected (${dropPct.toFixed(1)}%). 1080p proxy processing will ensure stable playback.`;
        } else {
          rec = 'original';
          reason = `Smooth playback confirmed (${dropPct.toFixed(1)}% drops). Hardware easily handles original source resolution.`;
        }

        onSelectMode(rec);
        setTestResult({
          totalFrames: total,
          droppedFrames: dropped,
          droppedPercent: dropPct,
          testedResolution: `${video.videoWidth}×${video.videoHeight}`,
          recommendedMode: rec,
          reason,
          gpuVendor: gpuInfo.vendor,
          gpuRenderer: gpuInfo.renderer
        });
      } catch (err: any) {
        alert(`Benchmark error: ${err.message}`);
      } finally {
        video.pause();
        video.currentTime = oldTime;
        video.playbackRate = oldRate;
        if (!wasPaused) video.play().catch(() => {});
        setIsRunningTest(false);
      }
    },
    []
  );

  return {
    isDiagnosticsOpen,
    setIsDiagnosticsOpen,
    testResult,
    isRunningTest,
    handleRunPlaybackTest
  };
}
