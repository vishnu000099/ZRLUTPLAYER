import { useState, useEffect, useCallback, RefObject } from 'react';
import { ColorAdjustments } from '../types';
import { WebGLPlayer } from '../utils/webglPlayer';

export const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
  exposure: 0,
  contrast: 1,
  saturation: 1,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  lutStrength: 1
};

export function useColorGrading(playerRef?: RefObject<WebGLPlayer | null>) {
  const [adjustments, setAdjustments] = useState<ColorAdjustments>(DEFAULT_ADJUSTMENTS);

  const updateAdjustment = useCallback((field: keyof ColorAdjustments, value: number) => {
    setAdjustments((prev) => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const resetAdjustments = useCallback(() => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
  }, []);

  // Synchronize adjustments directly to WebGL player
  useEffect(() => {
    if (playerRef?.current) {
      playerRef.current.setAdjustments(adjustments);
    }
  }, [adjustments, playerRef]);

  return {
    adjustments,
    setAdjustments,
    updateAdjustment,
    resetAdjustments
  };
}
