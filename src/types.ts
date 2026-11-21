export interface LutData {
  name: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Uint8Array; // 2D packed atlas RGBA (width: size*size, height: size)
  floatData?: Float32Array; // High-precision 32-bit floating point atlas (width: size*size, height: size * 4 floats)
  rawCubeText?: string;
  sourceType: 'preset' | 'custom';
  description?: string;
}

export interface ColorAdjustments {
  exposure: number; // -2.0 to +2.0 EV
  contrast: number; // 0.5 to 1.5
  saturation: number; // 0.0 to 2.0
  temperature: number; // -100 to +100
  tint: number; // -100 to +100
  highlights: number; // -100 to +100
  shadows: number; // -100 to +100
  lutStrength: number; // 0.0 to 1.0 (0% - 100%)
}

export type PlaybackResolution = 'original' | '1080' | '720' | '480';

export type SplitMode = 'off' | 'vertical' | 'horizontal' | 'side-by-side';

export type ActiveTab = 'grading' | 'lut' | 'scopes' | 'checker' | 'playlist' | 'export';

export type VideoCodec = 'h264';
export type EncodingPreset = 'medium' | 'slow' | 'veryslow';
export type BitDepth = '8bit' | '10bit';
export type EncoderEngine = 'hardware' | 'cpu';

export interface EncoderCapabilities {
  webCodecsSupported: boolean;
  hardwareAccelerated: boolean;
  h264Supported: boolean;
  h264_10bitSupported?: boolean;
  details: string;
  gpuName?: string;
  gpuRenderer?: string;
  recommendedEngine?: EncoderEngine;
}

export type LutInterpolationMode = 'tetrahedral' | 'trilinear';

export interface ExportConfig {
  encoderEngine: EncoderEngine; // 'hardware' (WebCodecs + Mediabunny) | 'cpu' (FFmpeg libx264)
  codec: VideoCodec;
  bitDepth?: BitDepth;
  crf: number; // 12 - 28
  preset: EncodingPreset;
  preserveResolution: boolean;
  preserveFps: boolean;
  targetResolution?: 'original' | '1080' | '720';
  targetFps?: number;
  includeAudio: boolean;
  exportRange: 'full' | 'in-out' | 'preview-5s';
  startTime?: number;
  endTime?: number;
  interpolationMode?: LutInterpolationMode; // 'tetrahedral' (Pro default) | 'trilinear'
}

export interface ExportProgress {
  phase: 'idle' | 'initializing' | 'rendering' | 'encoding' | 'completed' | 'error' | 'aborted';
  percent: number; // 0 - 100
  currentFrame: number;
  totalFrames: number;
  fps: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  stageMessage: string;
  previewThumbnail?: string;
  error?: string;
  outputBlob?: Blob;
  outputUrl?: string;
  outputFileName?: string;
  engine?: EncoderEngine;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface ChartCorners {
  tl: Point2D; // Top-Left (near Patch 0: Dark skin)
  tr: Point2D; // Top-Right (near Patch 5: Bluish green)
  br: Point2D; // Bottom-Right (near Patch 23: Black)
  bl: Point2D; // Bottom-Left (near Patch 18: White)
}

export type ChartType = 'classic24' | 'video' | 'spyder24';

export interface PatchSample {
  index: number;
  row: number; // 0..3 or 0..5
  col: number; // 0..5 or 0..2
  name: string;
  isNeutral: boolean;
  category?: 'skin' | 'grayscale' | 'chromatic' | 'limit';
  targetIRE?: number; // For video grayscale bars (e.g. 100, 40, 25, 0)
  measuredIRE?: number;
  // Normalized center coordinate in video frame [0, 1]
  center: Point2D;
  // Reference color values
  referenceLab: [number, number, number];
  referenceSrgb: [number, number, number]; // [0, 255]
  // Measured color values
  measuredRgb: [number, number, number]; // [0, 255]
  measuredRgbNorm: [number, number, number]; // [0, 1]
  measuredLab: [number, number, number];
  deltaE: number; // Delta E (CIE76 color error)
  reliability: number; // 0.0 to 1.0 (based on std dev / uniformity)
}

export interface VideoChartTelemetry {
  whiteIRE: number; // 0 - 100+
  midGrayIRE: number; // 0 - 100 (target ~40-45)
  darkGrayIRE: number; // 0 - 100 (target ~25-30)
  blackIRE: number; // 0 - 100 (target ~0-5)
  skinToneDeviationDeg: number; // e.g. +1.4° (towards magenta) or -2.1°
  skinToneAngleDeg: number;
  clippingHighlights: boolean; // true if White > 250
  crushedShadows: boolean; // true if Black < 10
}

export interface ColorCheckerAnalysis {
  chartType: ChartType;
  patches: PatchSample[];
  averageDeltaE: number;
  maxDeltaE: number;
  minReliability: number;
  // White Balance metrics computed from neutral row or video grayscale bars
  neutralBalance: {
    rGain: number; // relative to green
    gGain: number;
    bGain: number; // relative to green
    colorTempKelvinShift: number; // Estimated K shift e.g. +320K or -450K
    recommendedTemp: number; // -100 to +100
    recommendedTint: number; // -100 to +100
    recommendedExposureEV: number; // -2.0 to +2.0 EV
    recommendedContrast: number; // e.g. 1.05
    recommendedSaturation: number; // e.g. 1.02
    castDescription: string; // e.g. "Warm Amber cast (+8.4°)", "Cool Blue cast (-6.1°)"
    neutralUniformityPct: number; // 0 - 100%
  };
  videoTelemetry?: VideoChartTelemetry;
  // 3x3 Color Correction Matrix
  ccm: number[]; // 9 elements row-major [m00, m01, m02, m10, m11, m12, m20, m21, m22]
  isChartVisible: boolean;
  timestamp: number;
}

export interface PlaylistItem {
  id: string;
  name: string;
  file: File;
  sizeMB: number;
  thumbnailUrl?: string;
  duration?: number;
}

export interface CameraMetadata {
  cameraModel: string;
  lens: string;
  pictureProfile: string;
  cameraTimestamp: string;
}

export interface VideoMetadata {
  name: string;
  width: number;
  height: number;
  duration: number;
  fileSizeMB?: number;
  fps: number;
  cameraMetadata?: CameraMetadata;
}

export interface PlaybackTestResult {
  totalFrames: number;
  droppedFrames: number;
  droppedPercent: number;
  testedResolution: string;
  recommendedMode: PlaybackResolution;
  reason: string;
  gpuVendor?: string;
  gpuRenderer?: string;
}
