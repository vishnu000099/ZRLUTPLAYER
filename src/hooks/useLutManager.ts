import { useState, useEffect, useCallback, RefObject } from 'react';
import { LutData, LutInterpolationMode } from '../types';
import { PRESET_LUTS } from '../utils/lutPresets';
import { parseCubeText } from '../utils/cubeParser';
import { WebGLPlayer } from '../utils/webglPlayer';

export function useLutManager(playerRef?: RefObject<WebGLPlayer | null>) {
  const [activeLut, setActiveLut] = useState<LutData | null>(PRESET_LUTS[0]);
  const [lutEnabled, setLutEnabled] = useState<boolean>(true);
  const [customLuts, setCustomLuts] = useState<LutData[]>([]);
  const [interpolationMode, setInterpolationMode] = useState<LutInterpolationMode>('tetrahedral');

  const handleLoadCubeText = useCallback((text: string, filename: string): LutData => {
    const parsed = parseCubeText(text, filename);
    setCustomLuts((prev) => [parsed, ...prev.filter((l) => l.name !== parsed.name)]);
    setActiveLut(parsed);
    setLutEnabled(true);
    return parsed;
  }, []);

  const handleToggleLut = useCallback(() => {
    setLutEnabled((prev) => !prev);
  }, []);

  // Auto-load high-precision 33³ Arrilogc3 cube on initial mount
  useEffect(() => {
    let cancelled = false;
    fetch('/luts/Lumix/ARRI_LogC2Video_709_davinci3d_33.cube')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch Arrilogc3 cube');
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const parsed = parseCubeText(text, 'Arrilogc3');
        parsed.name = 'Arrilogc3';
        setActiveLut((current) => {
          if (!current || current.name === 'Arrilogc3') {
            return parsed;
          }
          return current;
        });
      })
      .catch((err) => {
        console.warn('Could not load Arrilogc3 cube file:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Synchronize state with WebGL player
  useEffect(() => {
    if (playerRef?.current) {
      playerRef.current.setLut(activeLut);
    }
  }, [activeLut, playerRef]);

  useEffect(() => {
    if (playerRef?.current) {
      playerRef.current.setLutEnabled(lutEnabled);
    }
  }, [lutEnabled, playerRef]);

  useEffect(() => {
    if (playerRef?.current) {
      playerRef.current.setInterpolationMode(interpolationMode);
    }
  }, [interpolationMode, playerRef]);

  return {
    activeLut,
    setActiveLut,
    lutEnabled,
    setLutEnabled,
    handleToggleLut,
    customLuts,
    setCustomLuts,
    interpolationMode,
    setInterpolationMode,
    handleLoadCubeText
  };
}
