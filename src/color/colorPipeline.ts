import { ColorAdjustments, LutData, LutInterpolationMode } from '../types';
import { applyColorAdjustmentsCpu, finalOutputMappingCpu } from './gradingMath';
import { sampleLutCpu, sampleLutTrilinearCpu, sampleLutTetrahedralCpu, upload3dLutTexture } from './lutProcessor';

export * from './colorSpaces';
export * from './gradingMath';
export * from './lutProcessor';
export * from './shaders/grading.glsl';

/**
 * Authoritatively binds all color grading uniforms to the active WebGL program.
 * Ensures identical uniform naming, normalization, and domain handling across
 * Preview, CPU Exporter, and Hardware Exporter.
 */
export function applyColorPipelineUniforms(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  program: WebGLProgram,
  adjustments: ColorAdjustments,
  lutData: LutData | null,
  lutEnabled: boolean,
  interpolationMode: LutInterpolationMode = 'tetrahedral'
): void {
  // 1. 3D LUT configuration uniforms
  const uLutSize = gl.getUniformLocation(program, 'u_lutSize');
  if (uLutSize) gl.uniform1f(uLutSize, lutData?.size || 2);

  const uDomainMin = gl.getUniformLocation(program, 'u_domainMin');
  if (uDomainMin) gl.uniform3fv(uDomainMin, lutData?.domainMin || [0, 0, 0]);

  const uDomainMax = gl.getUniformLocation(program, 'u_domainMax');
  if (uDomainMax) gl.uniform3fv(uDomainMax, lutData?.domainMax || [1, 1, 1]);

  const uLutOn = gl.getUniformLocation(program, 'u_lutOn');
  if (uLutOn) gl.uniform1f(uLutOn, lutEnabled && !!lutData ? 1.0 : 0.0);

  const uStrength = gl.getUniformLocation(program, 'u_strength');
  if (uStrength) gl.uniform1f(uStrength, adjustments.lutStrength);

  // LUT Interpolation: 0.0 = tetrahedral (default), 1.0 = trilinear
  const uInterp = gl.getUniformLocation(program, 'u_interpolationMode');
  if (uInterp) gl.uniform1f(uInterp, interpolationMode === 'trilinear' ? 1.0 : 0.0);

  // 2. Primary color adjustments uniforms
  const uExposure = gl.getUniformLocation(program, 'u_exposure');
  if (uExposure) gl.uniform1f(uExposure, adjustments.exposure);

  const uContrast = gl.getUniformLocation(program, 'u_contrast');
  if (uContrast) gl.uniform1f(uContrast, adjustments.contrast);

  const uSaturation = gl.getUniformLocation(program, 'u_saturation');
  if (uSaturation) gl.uniform1f(uSaturation, adjustments.saturation);

  // Scaled from -100..+100 to normalized -1.0..+1.0
  const uTemperature = gl.getUniformLocation(program, 'u_temperature');
  if (uTemperature) gl.uniform1f(uTemperature, adjustments.temperature / 100);

  const uTint = gl.getUniformLocation(program, 'u_tint');
  if (uTint) gl.uniform1f(uTint, adjustments.tint / 100);

  const uHighlights = gl.getUniformLocation(program, 'u_highlights');
  if (uHighlights) gl.uniform1f(uHighlights, adjustments.highlights / 100);

  const uShadows = gl.getUniformLocation(program, 'u_shadows');
  if (uShadows) gl.uniform1f(uShadows, adjustments.shadows / 100);
}

/**
 * Executes the complete color grade pipeline on the CPU:
 * 1. Primary Color Adjustments (Exposure -> Temp/Tint -> Highlights/Shadows -> Contrast -> Saturation)
 * 2. 3D LUT Sampling (Tetrahedral or Trilinear)
 * 3. LUT Strength Blending
 * Guaranteed to match WebGL processColorGrade(vec3).
 */
export function executeColorGradeCpu(
  rgb: [number, number, number],
  adjustments: ColorAdjustments,
  lutData: LutData | null,
  lutEnabled: boolean,
  interpolationMode: LutInterpolationMode = 'tetrahedral'
): [number, number, number] {
  // 1. Primary Adjustments
  let processed = applyColorAdjustmentsCpu(rgb, adjustments);

  // 2. 3D LUT Application
  if (lutEnabled && lutData) {
    const lutSample = sampleLutCpu(lutData, processed[0], processed[1], processed[2], interpolationMode);
    const strength = Math.max(0, Math.min(1, adjustments.lutStrength));
    processed = [
      processed[0] * (1 - strength) + lutSample[0] * strength,
      processed[1] * (1 - strength) + lutSample[1] * strength,
      processed[2] * (1 - strength) + lutSample[2] * strength
    ];
  }

  // 3. Final Output Stage: Output range and gamut mapping matching WebGL finalOutputMapping
  return finalOutputMappingCpu(processed);
}

export { upload3dLutTexture };
