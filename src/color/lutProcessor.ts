import { LutData } from '../types';
import { clamp01, lerp } from './gradingMath';

// Identity 2x2 LUT fallback RGBA bytes
export const IDENTITY_LUT_2X2_DATA = new Uint8Array([
  0, 0, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 255, 255, 0, 255,
  0, 0, 255, 255, 255, 0, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255
]);

/**
 * Trilinear interpolation on 3D LUT 2D packed atlas (CPU implementation).
 * Automatically prefers 32-bit floatData if available for 10-bit+ precision.
 */
export function sampleLutTrilinearCpu(
  lut: LutData,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const size = lut.size;
  const width = size * size;
  const domainMin = lut.domainMin || [0, 0, 0];
  const domainMax = lut.domainMax || [1, 1, 1];

  // Remap input into LUT domain
  const spanR = Math.max(0.000001, domainMax[0] - domainMin[0]);
  const spanG = Math.max(0.000001, domainMax[1] - domainMin[1]);
  const spanB = Math.max(0.000001, domainMax[2] - domainMin[2]);

  const normR = clamp01((r - domainMin[0]) / spanR);
  const normG = clamp01((g - domainMin[1]) / spanG);
  const normB = clamp01((b - domainMin[2]) / spanB);

  const cr = normR * (size - 1);
  const cg = normG * (size - 1);
  const cb = normB * (size - 1);

  const r0 = Math.floor(cr);
  const r1 = Math.min(r0 + 1, size - 1);
  const fr = cr - r0;

  const g0 = Math.floor(cg);
  const g1 = Math.min(g0 + 1, size - 1);
  const fg = cg - g0;

  const b0 = Math.floor(cb);
  const b1 = Math.min(b0 + 1, size - 1);
  const fb = cb - b0;

  const getRgbAt = (ri: number, gi: number, bi: number): [number, number, number] => {
    const x = bi * size + ri;
    const y = gi;
    const idx = (y * width + x) * 4;

    if (lut.floatData) {
      return [lut.floatData[idx], lut.floatData[idx + 1], lut.floatData[idx + 2]];
    }
    return [lut.data[idx] / 255, lut.data[idx + 1] / 255, lut.data[idx + 2] / 255];
  };

  const c000 = getRgbAt(r0, g0, b0);
  const c100 = getRgbAt(r1, g0, b0);
  const c010 = getRgbAt(r0, g1, b0);
  const c110 = getRgbAt(r1, g1, b0);

  const c001 = getRgbAt(r0, g0, b1);
  const c101 = getRgbAt(r1, g0, b1);
  const c011 = getRgbAt(r0, g1, b1);
  const c111 = getRgbAt(r1, g1, b1);

  const c00 = [lerp(c000[0], c100[0], fr), lerp(c000[1], c100[1], fr), lerp(c000[2], c100[2], fr)];
  const c10 = [lerp(c010[0], c110[0], fr), lerp(c010[1], c110[1], fr), lerp(c010[2], c110[2], fr)];
  const c01 = [lerp(c001[0], c101[0], fr), lerp(c001[1], c101[1], fr), lerp(c001[2], c101[2], fr)];
  const c11 = [lerp(c011[0], c111[0], fr), lerp(c011[1], c111[1], fr), lerp(c011[2], c111[2], fr)];

  const c0 = [lerp(c00[0], c10[0], fg), lerp(c00[1], c10[1], fg), lerp(c00[2], c10[2], fg)];
  const c1 = [lerp(c01[0], c11[0], fg), lerp(c01[1], c11[1], fg), lerp(c01[2], c11[2], fg)];

  return [
    lerp(c0[0], c1[0], fb),
    lerp(c0[1], c1[1], fb),
    lerp(c0[2], c1[2], fb)
  ];
}

/**
 * Tetrahedral interpolation on 3D LUT 2D packed atlas (CPU implementation).
 * Subdivides each cube cell into 6 tetrahedra for superior diagonal color accuracy.
 */
export function sampleLutTetrahedralCpu(
  lut: LutData,
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const size = lut.size;
  const width = size * size;
  const domainMin = lut.domainMin || [0, 0, 0];
  const domainMax = lut.domainMax || [1, 1, 1];

  const spanR = Math.max(0.000001, domainMax[0] - domainMin[0]);
  const spanG = Math.max(0.000001, domainMax[1] - domainMin[1]);
  const spanB = Math.max(0.000001, domainMax[2] - domainMin[2]);

  const normR = clamp01((r - domainMin[0]) / spanR);
  const normG = clamp01((g - domainMin[1]) / spanG);
  const normB = clamp01((b - domainMin[2]) / spanB);

  const cr = normR * (size - 1);
  const cg = normG * (size - 1);
  const cb = normB * (size - 1);

  const r0 = Math.floor(cr);
  const r1 = Math.min(r0 + 1, size - 1);
  const fr = cr - r0;

  const g0 = Math.floor(cg);
  const g1 = Math.min(g0 + 1, size - 1);
  const fg = cg - g0;

  const b0 = Math.floor(cb);
  const b1 = Math.min(b0 + 1, size - 1);
  const fb = cb - b0;

  const getRgbAt = (ri: number, gi: number, bi: number): [number, number, number] => {
    const x = bi * size + ri;
    const y = gi;
    const idx = (y * width + x) * 4;

    if (lut.floatData) {
      return [lut.floatData[idx], lut.floatData[idx + 1], lut.floatData[idx + 2]];
    }
    return [lut.data[idx] / 255, lut.data[idx + 1] / 255, lut.data[idx + 2] / 255];
  };

  const p0 = getRgbAt(r0, g0, b0);
  const p3 = getRgbAt(r1, g1, b1);
  let p1: [number, number, number];
  let p2: [number, number, number];
  let w0: number, w1: number, w2: number, w3: number;

  if (fr >= fg) {
    if (fg >= fb) {
      // Simplex 1: fr >= fg >= fb
      p1 = getRgbAt(r1, g0, b0);
      p2 = getRgbAt(r1, g1, b0);
      w0 = 1.0 - fr;
      w1 = fr - fg;
      w2 = fg - fb;
      w3 = fb;
    } else if (fr >= fb) {
      // Simplex 2: fr >= fb > fg
      p1 = getRgbAt(r1, g0, b0);
      p2 = getRgbAt(r1, g0, b1);
      w0 = 1.0 - fr;
      w1 = fr - fb;
      w2 = fb - fg;
      w3 = fg;
    } else {
      // Simplex 3: fb > fr >= fg
      p1 = getRgbAt(r0, g0, b1);
      p2 = getRgbAt(r1, g0, b1);
      w0 = 1.0 - fb;
      w1 = fb - fr;
      w2 = fr - fg;
      w3 = fg;
    }
  } else {
    if (fb >= fg) {
      // Simplex 4: fb >= fg > fr
      p1 = getRgbAt(r0, g0, b1);
      p2 = getRgbAt(r0, g1, b1);
      w0 = 1.0 - fb;
      w1 = fb - fg;
      w2 = fg - fr;
      w3 = fr;
    } else if (fb >= fr) {
      // Simplex 5: fg > fb >= fr
      p1 = getRgbAt(r0, g1, b0);
      p2 = getRgbAt(r0, g1, b1);
      w0 = 1.0 - fg;
      w1 = fg - fb;
      w2 = fb - fr;
      w3 = fr;
    } else {
      // Simplex 6: fg >= fr > fb
      p1 = getRgbAt(r0, g1, b0);
      p2 = getRgbAt(r1, g1, b0);
      w0 = 1.0 - fg;
      w1 = fg - fr;
      w2 = fr - fb;
      w3 = fb;
    }
  }

  return [
    p0[0] * w0 + p1[0] * w1 + p2[0] * w2 + p3[0] * w3,
    p0[1] * w0 + p1[1] * w1 + p2[1] * w2 + p3[1] * w3,
    p0[2] * w0 + p1[2] * w1 + p2[2] * w2 + p3[2] * w3
  ];
}

/**
 * Samples 3D LUT on CPU using selected interpolation mode (tetrahedral by default).
 */
export function sampleLutCpu(
  lut: LutData,
  r: number,
  g: number,
  b: number,
  mode: 'tetrahedral' | 'trilinear' = 'tetrahedral'
): [number, number, number] {
  if (mode === 'trilinear') {
    return sampleLutTrilinearCpu(lut, r, g, b);
  }
  return sampleLutTetrahedralCpu(lut, r, g, b);
}

/**
 * Uploads 3D LUT texture to GPU with full precision handling.
 * Shared across preview player, CPU exporter, and WebCodecs hardware exporter.
 */
export function upload3dLutTexture(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  texture: WebGLTexture,
  lutData: LutData | null,
  lutEnabled: boolean
): void {
  const isWebGL2 =
    (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) ||
    'RGBA16F' in gl;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  if (lutData && lutEnabled) {
    const size = lutData.size;
    const width = size * size;
    const height = size;

    // Use floating-point texture if WebGL2 and floatData is available
    if (isWebGL2 && lutData.floatData) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        (gl as WebGL2RenderingContext).RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        lutData.floatData
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        lutData.data
      );
    }
  } else {
    // 2x2 identity LUT fallback
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      4,
      2,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      IDENTITY_LUT_2X2_DATA
    );
  }
}
