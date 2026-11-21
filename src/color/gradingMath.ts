import { ColorAdjustments } from '../types';
import { REC709_LUMA_COEFF, srgbToLinear, linearToSrgb } from './colorSpaces';

export { srgbToLinear, linearToSrgb };

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Calculates Rec.709 photometric luminance for an RGB triplet
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  return r * REC709_LUMA_COEFF[0] + g * REC709_LUMA_COEFF[1] + b * REC709_LUMA_COEFF[2];
}

/**
 * Stage 1: Exposure Adjustment (EV stops)
 * Formula: color * 2^exposure
 */
export function applyExposure(
  rgb: [number, number, number],
  exposureEv: number
): [number, number, number] {
  const factor = Math.pow(2.0, exposureEv);
  return [rgb[0] * factor, rgb[1] * factor, rgb[2] * factor];
}

/**
 * Stage 2: Professional Colorimetric White Balance (Linear Radiance Working Space)
 * 
 * Rather than naive additive channel shifts which degrade black points and invert colors:
 * 1. Converts display gamma signal to linear radiance working space.
 * 2. Computes calibrated chromatic gains along the Planckian blackbody locus (temperature)
 *    and orthogonal magenta/green axis (tint).
 * 3. Normalizes gains using ITU-R BT.709 photometric luminance weights so that neutral tones
 *    preserve their exact exposure/luminance without blowing out or crushing.
 * 4. Strictly preserves true black (0, 0, 0) and smooth highlight roll-off.
 * 5. Converts back through the standard output transfer function.
 */
export function applyWhiteBalance(
  rgb: [number, number, number],
  temperatureNorm: number,
  tintNorm: number
): [number, number, number] {
  if (Math.abs(temperatureNorm) < 0.0001 && Math.abs(tintNorm) < 0.0001) {
    return [rgb[0], rgb[1], rgb[2]];
  }

  // 1. Convert to linear working space preserving intermediate floating-point range
  const linR = srgbToLinear(rgb[0]);
  const linG = srgbToLinear(rgb[1]);
  const linB = srgbToLinear(rgb[2]);

  // 2. Calibrated chromatic gains (exponential formulation ensures strictly positive radiance)
  const rawR = Math.exp(temperatureNorm * 0.35 + tintNorm * 0.12);
  const rawG = Math.exp(-tintNorm * 0.24);
  const rawB = Math.exp(-temperatureNorm * 0.35 + tintNorm * 0.12);

  // 3. Luminance-preserving normalization using Rec.709 photometric weights
  const lumFactor = rawR * REC709_LUMA_COEFF[0] + rawG * REC709_LUMA_COEFF[1] + rawB * REC709_LUMA_COEFF[2];
  const invLum = 1.0 / Math.max(0.0001, lumFactor);

  const balancedLinR = linR * (rawR * invLum);
  const balancedLinG = linG * (rawG * invLum);
  const balancedLinB = linB * (rawB * invLum);

  // 4. Return to gamma space without premature clipping
  return [
    linearToSrgb(balancedLinR),
    linearToSrgb(balancedLinG),
    linearToSrgb(balancedLinB)
  ];
}

/**
 * Stage 3: Highlights & Shadows Masking
 * Smooth roll-off masks:
 * - Shadows mask: 1.0 - smoothstep(0.0, 0.6, lum)
 * - Highlights mask: smoothstep(0.4, 1.0, lum)
 */
export function applyHighlightsShadows(
  rgb: [number, number, number],
  highlightsNorm: number,
  shadowsNorm: number
): [number, number, number] {
  const lum = calculateLuminance(rgb[0], rgb[1], rgb[2]);
  const shadowMask = 1.0 - smoothstep(0.0, 0.6, lum);
  const highlightMask = smoothstep(0.4, 1.0, lum);

  const offset = shadowMask * shadowsNorm * 0.25 + highlightMask * highlightsNorm * 0.25;
  return [rgb[0] + offset, rgb[1] + offset, rgb[2] + offset];
}

/**
 * Stage 4: Contrast around midpoint 0.5
 * Formula: (color - 0.5) * contrast + 0.5
 */
export function applyContrast(
  rgb: [number, number, number],
  contrast: number
): [number, number, number] {
  return [
    (rgb[0] - 0.5) * contrast + 0.5,
    (rgb[1] - 0.5) * contrast + 0.5,
    (rgb[2] - 0.5) * contrast + 0.5
  ];
}

/**
 * Stage 5: Saturation
 * Desaturate or saturate around Rec.709 luminance
 * Formula: mix(vec3(lum), color, saturation)
 */
export function applySaturation(
  rgb: [number, number, number],
  saturation: number
): [number, number, number] {
  const lum = calculateLuminance(rgb[0], rgb[1], rgb[2]);
  return [
    lerp(lum, rgb[0], saturation),
    lerp(lum, rgb[1], saturation),
    lerp(lum, rgb[2], saturation)
  ];
}

/**
 * Master Color Adjustment Pipeline (CPU execution)
 * Performs the exact same stages and mathematical order as the GLSL fragment shader:
 * 1. Exposure
 * 2. White Balance (Temperature & Tint)
 * 3. Highlights & Shadows
 * 4. Contrast
 * 5. Saturation
 */
export function applyColorAdjustmentsCpu(
  rgb: [number, number, number],
  adjustments: ColorAdjustments
): [number, number, number] {
  // 1. Exposure (in EV)
  let result = applyExposure(rgb, adjustments.exposure);

  // 2. Temperature & Tint (-100..+100 converted to normalized -1..+1)
  result = applyWhiteBalance(result, adjustments.temperature / 100, adjustments.tint / 100);

  // 3. Highlights & Shadows (-100..+100 converted to normalized -1..+1)
  result = applyHighlightsShadows(result, adjustments.highlights / 100, adjustments.shadows / 100);

  // 4. Contrast around midpoint 0.5
  result = applyContrast(result, adjustments.contrast);

  // 5. Saturation
  result = applySaturation(result, adjustments.saturation);

  // Preserve full floating-point intermediate values into 3D LUT stage
  return result;
}

/**
 * Stage 6: Final Output Range & Gamut Mapping
 * Applied strictly at the final output stage of the complete grading pipeline.
 * Safely maps floating-point values into display/broadcast legal range [0.0, 1.0].
 */
export function finalOutputMappingCpu(
  rgb: [number, number, number]
): [number, number, number] {
  return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
}
