import { useState, useEffect, useCallback, RefObject } from 'react';
import { ChartCorners, ChartType, ColorCheckerAnalysis } from '../types';
import { DEFAULT_CHART_CORNERS, sampleColorChecker, autoDetectChartCorners } from '../utils/colorChecker';
import { WebGLPlayer } from '../utils/webglPlayer';

interface ColorCheckerSamplingOptions {
  videoLoaded: boolean;
  currentTab: string;
  playerRef: RefObject<WebGLPlayer | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function useColorChecker(options?: ColorCheckerSamplingOptions) {
  // 4-Corner ColorChecker Tool & WB Automation State
  const [colorCheckerActive, setColorCheckerActive] = useState<boolean>(false);
  const [chartType, setChartType] = useState<ChartType>('video');
  const [chartCorners, setChartCorners] = useState<ChartCorners>(DEFAULT_CHART_CORNERS);
  const [colorCheckerAnalysis, setColorCheckerAnalysis] = useState<ColorCheckerAnalysis | null>(null);
  const [checkerSampleSource, setCheckerSampleSource] = useState<'graded' | 'raw'>('graded');

  // Select Skin Area Picker Tool State
  const [isSelectingSkinArea, setIsSelectingSkinArea] = useState<boolean>(false);
  const [skinSelectionRect, setSkinSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [skinSelectionStats, setSkinSelectionStats] = useState<{ pixelCount: number; framePercentage: number; width: number; height: number } | null>(null);

  const handleToggleColorChecker = useCallback((onOpenTab?: () => void) => {
    setColorCheckerActive((prev) => {
      const next = !prev;
      if (next && onOpenTab) {
        onOpenTab();
      }
      return next;
    });
  }, []);

  const handleAutoDetectChartCorners = useCallback(() => {
    const targetSource =
      checkerSampleSource === 'raw' && options?.videoRef?.current
        ? options.videoRef.current
        : (options?.canvasRef?.current || options?.videoRef?.current);

    if (targetSource) {
      const detected = autoDetectChartCorners(targetSource);
      setChartCorners(detected);
    }
  }, [checkerSampleSource, options?.canvasRef, options?.videoRef]);

  const handleResetChartCorners = useCallback(() => {
    setChartCorners(DEFAULT_CHART_CORNERS);
  }, []);

  const handleStartSkinSelection = useCallback((onPausePlayback?: () => void, onOpenScopes?: () => void) => {
    if (onPausePlayback) onPausePlayback();
    if (onOpenScopes) onOpenScopes();
    setIsSelectingSkinArea(true);
  }, []);

  const handleCancelSkinSelection = useCallback(() => {
    setIsSelectingSkinArea(false);
  }, []);

  const handleSkinAreaSelected = useCallback(
    (
      rect: { x: number; y: number; width: number; height: number },
      stats: { pixelCount: number; framePercentage: number; width: number; height: number },
      onOpenScopes?: () => void
    ) => {
      setSkinSelectionRect(rect);
      setSkinSelectionStats(stats);
      setIsSelectingSkinArea(false);
      if (onOpenScopes) onOpenScopes();
    },
    []
  );

  const handleClearSkinSelection = useCallback(() => {
    setSkinSelectionRect(null);
    setSkinSelectionStats(null);
    setIsSelectingSkinArea(false);
  }, []);

  // Auto-sample ColorChecker patches from video or graded canvas
  useEffect(() => {
    if (!options?.videoLoaded || (!colorCheckerActive && options?.currentTab !== 'checker')) return;
    let animId = 0;
    let lastTime = 0;

    const updateColorChecker = (time: number) => {
      // Throttle sampling to ~12fps for optimal performance
      if (time - lastTime > 80) {
        lastTime = time;
        let imgData: ImageData | null = null;
        if (options.playerRef.current) {
          imgData = options.playerRef.current.getSampleImageData(
            checkerSampleSource,
            options.videoRef.current,
            480,
            270
          );
        }

        if (imgData) {
          try {
            const res = sampleColorChecker(imgData, chartCorners, chartType);
            setColorCheckerAnalysis(res);
          } catch {
            // buffer locked
          }
        } else {
          const targetSource =
            checkerSampleSource === 'raw' && options.videoRef.current
              ? options.videoRef.current
              : (options.canvasRef.current || options.videoRef.current);

          if (targetSource) {
            try {
              const res = sampleColorChecker(targetSource, chartCorners, chartType);
              setColorCheckerAnalysis(res);
            } catch {
              // buffer locked
            }
          }
        }
      }
      animId = requestAnimationFrame(updateColorChecker);
    };

    animId = requestAnimationFrame(updateColorChecker);
    return () => cancelAnimationFrame(animId);
  }, [
    options?.videoLoaded,
    colorCheckerActive,
    options?.currentTab,
    chartCorners,
    checkerSampleSource,
    chartType,
    options?.playerRef,
    options?.videoRef,
    options?.canvasRef
  ]);

  return {
    colorCheckerActive,
    setColorCheckerActive,
    chartType,
    setChartType,
    chartCorners,
    setChartCorners,
    colorCheckerAnalysis,
    checkerSampleSource,
    setCheckerSampleSource,
    isSelectingSkinArea,
    setIsSelectingSkinArea,
    skinSelectionRect,
    skinSelectionStats,
    handleToggleColorChecker,
    handleAutoDetectChartCorners,
    handleResetChartCorners,
    handleStartSkinSelection,
    handleCancelSkinSelection,
    handleSkinAreaSelected,
    handleClearSkinSelection
  };
}
