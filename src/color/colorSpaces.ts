/**
 * Color Spaces & Transfer Function Constants
 * Standard matrix coefficients and chromaticity definitions.
 */

// ITU-R BT.709 (Rec.709) standard luminance coefficients
export const REC709_LUMA_COEFF = [0.2126, 0.7152, 0.0722] as const;

// ITU-R BT.2020 (Rec.2020) standard luminance coefficients
export const REC2020_LUMA_COEFF = [0.2627, 0.6780, 0.0593] as const;

// SMPTE RP 431-2 (DCI-P3) luminance coefficients
export const DCIP3_LUMA_COEFF = [0.20949, 0.72160, 0.06891] as const;

/**
 * Standard IEC 61966-2-1 sRGB Transfer Function (EOTF) with extended range.
 * Converts gamma-encoded values to linear photometric radiance without clipping
 * values > 1.0, and extends linearly below 0 to preserve signs without NaN.
 */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Standard IEC 61966-2-1 Inverse sRGB Transfer Function (OETF) with extended range.
 * Converts linear photometric radiance to gamma-encoded signal without clipping
 * values > 1.0, and extends linearly below 0 to preserve signs without NaN.
 */
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1.0 / 2.4) - 0.055;
}

/**
 * Rec.709 Transfer Function (OETF)
 * Linear to gamma-encoded signal
 */
export function linearToRec709(linear: number): number {
  const l = Math.max(0, linear);
  if (l < 0.0181) {
    return 4.5 * l;
  }
  return 1.0993 * Math.pow(l, 0.45) - 0.0993;
}

/**
 * Rec.709 Inverse Transfer Function (EOTF)
 * Gamma-encoded signal to display linear
 */
export function rec709ToLinear(gamma: number): number {
  const g = Math.max(0, gamma);
  if (g < 0.0814) {
    return g / 4.5;
  }
  return Math.pow((g + 0.0993) / 1.0993, 1 / 0.45);
}

/**
 * Simple display gamma 2.4 decoding
 */
export function gamma24ToLinear(v: number): number {
  return Math.pow(Math.max(0, v), 2.4);
}

/**
 * Simple display gamma 2.4 encoding
 */
export function linearToGamma24(l: number): number {
  return Math.pow(Math.max(0, l), 1 / 2.4);
}
