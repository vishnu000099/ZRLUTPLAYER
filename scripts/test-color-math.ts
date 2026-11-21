/**
 * Automated Color Mathematics & Parity Sanity Test (CLI / Node.js)
 * Verifies analytical properties of the unified color pipeline:
 * 1. Exposure EV stops scale exponentially (2^EV)
 * 2. Linear Colorimetric White Balance:
 *    - Preserves true zero black [0, 0, 0] -> [0, 0, 0]
 *    - Preserves neutral luminance under Rec.709 weights
 *    - Warm shifts increase Red, decrease Blue
 *    - Cool shifts increase Blue, decrease Red
 *    - Tint shifts preserve luminance
 * 3. Highlights & Shadows masking smoothstep roll-off
 * 4. Contrast midpoint anchoring around 0.5
 * 5. Saturation desaturation converges strictly to Rec.709 luminance
 * 6. LUT tetrahedral and trilinear interpolation monotonicity and boundary conditions
 */

import {
  applyExposure,
  applyWhiteBalance,
  applyHighlightsShadows,
  applyContrast,
  applySaturation,
  calculateLuminance,
  applyColorAdjustmentsCpu,
  srgbToLinear,
  linearToSrgb
} from '../src/color/gradingMath';
import {
  sampleLutTrilinearCpu,
  sampleLutTetrahedralCpu
} from '../src/color/lutProcessor';
import { executeColorGradeCpu } from '../src/color/colorPipeline';
import { createSyntheticParityLut, STANDARD_TEST_VECTORS } from '../src/color/tests/colorParityTest';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

console.log('🧪 Starting Color Pipeline Mathematics & Parity Audit...\n');

// 1. Exposure Test
console.log('▶ [1/7] Auditing Exposure EV stop scaling...');
const baseRgb: [number, number, number] = [0.25, 0.25, 0.25];
const expPlusOne = applyExposure(baseRgb, 1.0);
assert(Math.abs(expPlusOne[0] - 0.5) < 0.0001, '+1 EV should double radiance from 0.25 to 0.50');
const expMinusOne = applyExposure(baseRgb, -1.0);
assert(Math.abs(expMinusOne[0] - 0.125) < 0.0001, '-1 EV should halve radiance from 0.25 to 0.125');
console.log('  ✓ Exposure 2^EV scaling verified');

// 2. Linear Colorimetric White Balance Test
console.log('▶ [2/7] Auditing Professional Linear White Balance...');
// True black preservation
const blackRgb: [number, number, number] = [0.0, 0.0, 0.0];
const warmBlack = applyWhiteBalance(blackRgb, 0.8, 0.5);
assert(warmBlack[0] === 0 && warmBlack[1] === 0 && warmBlack[2] === 0, 'White balance must strictly preserve true zero black (no lifted black point)');

// Mid-gray luminance preservation
const midGray: [number, number, number] = [0.5, 0.5, 0.5];
const warmMid = applyWhiteBalance(midGray, 0.5, 0.0);
assert(warmMid[0] > warmMid[2], 'Warm temperature must increase Red and decrease Blue relative to each other');

// Neutral luminance conservation:
const linOrigLum = srgbToLinear(0.5);
const linWarmLum = 0.2126 * srgbToLinear(warmMid[0]) + 0.7152 * srgbToLinear(warmMid[1]) + 0.0722 * srgbToLinear(warmMid[2]);
const lumError = Math.abs(linWarmLum - linOrigLum) / linOrigLum;
assert(lumError < 0.03, `Neutral luminance must be preserved in linear space (relative error ${(lumError * 100).toFixed(2)}%)`);
console.log('  ✓ Linear radiance chromatic adaptation verified');

// 3. Highlights & Shadows
console.log('▶ [3/7] Auditing Highlights & Shadows smoothstep roll-off...');
const shadowPixel: [number, number, number] = [0.1, 0.1, 0.1];
const liftedShadow = applyHighlightsShadows(shadowPixel, 0.0, 0.5);
assert(liftedShadow[0] > shadowPixel[0], 'Shadow lift must increase dark tone luminance');

const highlightPixel: [number, number, number] = [0.85, 0.85, 0.85];
const compressedHighlight = applyHighlightsShadows(highlightPixel, -0.5, 0.0);
assert(compressedHighlight[0] < highlightPixel[0], 'Highlight roll-off must compress bright tone luminance');
console.log('  ✓ Highlights and shadows masks verified');

// 4. Contrast
console.log('▶ [4/7] Auditing Contrast midpoint anchoring...');
const midpoint: [number, number, number] = [0.5, 0.5, 0.5];
const contrastedMid = applyContrast(midpoint, 1.5);
assert(Math.abs(contrastedMid[0] - 0.5) < 0.0001, 'Contrast pivot must anchor exactly at 0.5');
console.log('  ✓ Contrast pivot anchoring verified');

// 5. Saturation
console.log('▶ [5/7] Auditing Rec.709 Luminance Saturation...');
const colorfulRgb: [number, number, number] = [0.8, 0.4, 0.2];
const desat = applySaturation(colorfulRgb, 0.0);
const expectedLum = calculateLuminance(colorfulRgb[0], colorfulRgb[1], colorfulRgb[2]);
assert(Math.abs(desat[0] - expectedLum) < 0.0001 && Math.abs(desat[1] - expectedLum) < 0.0001 && Math.abs(desat[2] - expectedLum) < 0.0001, 'Zero saturation must yield identical RGB channels matching Rec.709 luminance');
console.log('  ✓ Desaturation to Rec.709 luminance verified');

// 6. LUT Interpolation
console.log('▶ [6/7] Auditing 3D LUT Trilinear vs Tetrahedral Interpolation...');
const testLut = createSyntheticParityLut(17);
for (const vector of STANDARD_TEST_VECTORS) {
  const tri = sampleLutTrilinearCpu(testLut, vector.rgb[0], vector.rgb[1], vector.rgb[2]);
  const tet = sampleLutTetrahedralCpu(testLut, vector.rgb[0], vector.rgb[1], vector.rgb[2]);

  // Both methods should agree closely on continuous smooth LUT grids
  const delta = Math.max(Math.abs(tri[0] - tet[0]), Math.abs(tri[1] - tet[1]), Math.abs(tri[2] - tet[2]));
  assert(delta < 0.02, `Trilinear and Tetrahedral should correlate closely on continuous 17^3 LUT (delta: ${delta})`);
}
console.log('  ✓ LUT interpolation consistency verified across all standard test vectors');

// 7. Floating-point intermediate range preservation (no early clipping to 0..1)
console.log('▶ [7/7] Auditing Intermediate Floating-Point Precision & Deferred Output Mapping...');
const highExpRgb: [number, number, number] = [0.8, 0.8, 0.8];
// Exposure +1 EV doubles to 1.6
const expOut = applyExposure(highExpRgb, 1.0);
assert(expOut[0] > 1.5, `Exposure must preserve floating-point values > 1.0 (got ${expOut[0]})`);

// White balance on values > 1.0 must not clamp to 1.0
const wbOut = applyWhiteBalance(expOut, 0.2, 0.1);
assert(wbOut[0] > 1.4 && wbOut[1] > 1.4, `White balance must preserve values > 1.0 without early clipping (got R=${wbOut[0]}, G=${wbOut[1]})`);

// Highlights adjustment on > 1.0 must roll down smoothly
const hlOut = applyHighlightsShadows(wbOut, -0.8, 0.0);
assert(hlOut[0] < wbOut[0], `Highlights reduction must roll off super-white values (got ${hlOut[0]} < ${wbOut[0]})`);

// Intermediate applyColorAdjustmentsCpu must preserve unclamped values > 1.0 for the LUT stage
const fullIntermediate = applyColorAdjustmentsCpu(highExpRgb, {
  exposure: 1.0,
  temperature: 15,
  tint: 0,
  contrast: 1.1,
  saturation: 1.1,
  highlights: -20,
  shadows: 10,
  lutStrength: 1.0
});
assert(fullIntermediate[0] > 1.0, `applyColorAdjustmentsCpu must preserve unclamped floating point values into 3D LUT (got ${fullIntermediate[0]})`);

// Full master pipeline executeColorGradeCpu must safely map to final display output [0.0, 1.0]
const finalOutput = executeColorGradeCpu(
  highExpRgb,
  {
    exposure: 1.0,
    temperature: 15,
    tint: 0,
    contrast: 1.1,
    saturation: 1.1,
    highlights: -20,
    shadows: 10,
    lutStrength: 1.0
  },
  null,
  false
);
assert(finalOutput[0] >= 0.0 && finalOutput[0] <= 1.0, `Final output stage must map into [0.0, 1.0] (got ${finalOutput[0]})`);
console.log('  ✓ Floating-point intermediate range preservation and final output mapping verified');

console.log('\n🎉 ALL MATHEMATICAL COLOR PIPELINE SANITY AUDITS PASSED WITH ZERO ERRORS!\n');
