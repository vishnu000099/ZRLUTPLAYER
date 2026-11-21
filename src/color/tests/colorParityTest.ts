import { ColorAdjustments, LutData, LutInterpolationMode } from '../../types';
import { executeColorGradeCpu } from '../colorPipeline';
import {
  SHARED_VERTEX_SHADER,
  EXPORT_FRAGMENT_SHADER
} from '../shaders/grading.glsl';
import { applyColorPipelineUniforms } from '../colorPipeline';
import { upload3dLutTexture } from '../lutProcessor';

export interface TestVector {
  name: string;
  rgb: [number, number, number];
}

export interface TestCaseResult {
  operation: string;
  vectorName: string;
  inputRgb: [number, number, number];
  cpuRgb: [number, number, number];
  gpuRgb: [number, number, number];
  deltaR: number;
  deltaG: number;
  deltaB: number;
  maxDelta: number;
  rmse: number;
  tolerance: number;
  passed: boolean;
  notes?: string;
}

export interface OperationSummary {
  operation: string;
  description: string;
  testCount: number;
  passedCount: number;
  maxDelta: number;
  avgDelta: number;
  passed: boolean;
}

export interface ParityAuditReport {
  timestamp: string;
  gpuRenderer: string;
  gpuVendor: string;
  tolerance: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallMaxDelta: number;
  overallAvgDelta: number;
  passed: boolean;
  operations: OperationSummary[];
  testCases: TestCaseResult[];
}

/**
 * Standard, colorimetrically calibrated RGB test vectors covering the full gamut:
 * - Neutral tones (pure black, 18% gray, 50% gray, peak white)
 * - Saturated primaries & secondaries
 * - Memory colors (Caucasian skin, melanin-rich skin, sky, foliage)
 * - Extreme shadow & highlight boundary conditions
 */
export const STANDARD_TEST_VECTORS: TestVector[] = [
  { name: 'Pure Black (0% IRE)', rgb: [0.0, 0.0, 0.0] },
  { name: 'Deep Shadow (5% IRE)', rgb: [0.05, 0.05, 0.05] },
  { name: '18% Middle Gray (Standard Neutral)', rgb: [0.18, 0.18, 0.18] },
  { name: '50% Midtone (Midpoint 0.5)', rgb: [0.5, 0.5, 0.5] },
  { name: 'Highlight Roll-off (90% IRE)', rgb: [0.9, 0.9, 0.9] },
  { name: 'Peak Specular White (100% IRE)', rgb: [1.0, 1.0, 1.0] },
  { name: 'Saturated Red Primary', rgb: [1.0, 0.0, 0.0] },
  { name: 'Saturated Green Primary', rgb: [0.0, 1.0, 0.0] },
  { name: 'Saturated Blue Primary', rgb: [0.0, 0.0, 1.0] },
  { name: 'Secondary Yellow', rgb: [1.0, 1.0, 0.0] },
  { name: 'Secondary Cyan', rgb: [0.0, 1.0, 1.0] },
  { name: 'Secondary Magenta', rgb: [1.0, 0.0, 1.0] },
  { name: 'Natural Skin Tone (Light)', rgb: [0.86, 0.68, 0.58] },
  { name: 'Melanin Skin Tone (Deep)', rgb: [0.44, 0.30, 0.22] },
  { name: 'Atmospheric Sky Blue', rgb: [0.42, 0.65, 0.88] },
  { name: 'Foliage Chlorophyll Green', rgb: [0.24, 0.48, 0.20] },
  { name: 'Warm Sunset Orange', rgb: [0.92, 0.48, 0.18] },
  { name: 'Arbitrary Gamut Triplet (Non-Uniform)', rgb: [0.37, 0.68, 0.19] }
];

/**
 * Creates a synthetic 3D LUT (17x17x17) with non-linear chromatic curves
 * to rigorously exercise both Trilinear and Tetrahedral interpolation algorithms.
 */
export function createSyntheticParityLut(size = 17): LutData {
  const width = size * size;
  const height = size;
  const totalPixels = width * height;
  const data = new Uint8Array(totalPixels * 4);
  const floatData = new Float32Array(totalPixels * 4);

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const nr = r / (size - 1);
        const ng = g / (size - 1);
        const nb = b / (size - 1);

        // Film-style non-linear curve: warm highlight compression, cool shadow split
        const filmR = Math.min(1.0, Math.pow(nr, 0.92) * 1.04);
        const filmG = Math.min(1.0, Math.pow(ng, 1.00));
        const filmB = Math.min(1.0, Math.pow(nb, 1.08) * 0.96);

        const x = b * size + r;
        const y = g;
        const idx = (y * width + x) * 4;

        data[idx] = Math.round(filmR * 255);
        data[idx + 1] = Math.round(filmG * 255);
        data[idx + 2] = Math.round(filmB * 255);
        data[idx + 3] = 255;

        floatData[idx] = filmR;
        floatData[idx + 1] = filmG;
        floatData[idx + 2] = filmB;
        floatData[idx + 3] = 1.0;
      }
    }
  }

  return {
    name: 'Parity Audit Synthetic 3D LUT',
    size,
    data,
    floatData,
    domainMin: [0.0, 0.0, 0.0],
    domainMax: [1.0, 1.0, 1.0],
    sourceType: 'preset'
  };
}

/**
 * Default neutral adjustments (identity pass-through)
 */
export function createDefaultAdjustments(): ColorAdjustments {
  return {
    exposure: 0,
    contrast: 1.0,
    saturation: 1.0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    lutStrength: 1.0
  };
}

/**
 * Headless WebGL test harness for measuring GPU pipeline output
 */
class WebGlParityHarness {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private program: WebGLProgram;
  private inputTexture: WebGLTexture;
  private lutTexture: WebGLTexture;
  private quadBuffer: WebGLBuffer;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1;
    this.canvas.height = 1;

    const gl =
      this.canvas.getContext('webgl2', { preserveDrawingBuffer: true }) ||
      this.canvas.getContext('webgl', { preserveDrawingBuffer: true });

    if (!gl) {
      throw new Error('WebGL not supported in current environment');
    }
    this.gl = gl;

    // Compile vertex shader
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, SHARED_VERTEX_SHADER);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('Vertex shader compile error: ' + gl.getShaderInfoLog(vs));
    }

    // Compile export fragment shader
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, EXPORT_FRAGMENT_SHADER);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('Fragment shader compile error: ' + gl.getShaderInfoLog(fs));
    }

    // Link shader program
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Shader link error: ' + gl.getProgramInfoLog(program));
    }
    this.program = program;

    // Setup full-screen quad geometry
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    // Setup input video texture (Texture Unit 0)
    this.inputTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Setup 3D LUT texture (Texture Unit 1)
    this.lutTexture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  public getGpuInfo(): { vendor: string; renderer: string } {
    const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      return {
        vendor: this.gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || 'Unknown Vendor',
        renderer: this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU'
      };
    }
    return {
      vendor: this.gl.getParameter(this.gl.VENDOR) || 'Generic Vendor',
      renderer: this.gl.getParameter(this.gl.RENDERER) || 'Generic WebGL'
    };
  }

  public renderGpu(
    inputRgb: [number, number, number],
    adjustments: ColorAdjustments,
    lutData: LutData | null,
    lutEnabled: boolean,
    interpolationMode: LutInterpolationMode
  ): [number, number, number] {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.viewport(0, 0, 1, 1);

    // 1. Upload 1x1 input pixel to Texture Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.inputTexture);
    const pixelBytes = new Uint8Array([
      Math.min(255, Math.max(0, Math.round(inputRgb[0] * 255))),
      Math.min(255, Math.max(0, Math.round(inputRgb[1] * 255))),
      Math.min(255, Math.max(0, Math.round(inputRgb[2] * 255))),
      255
    ]);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixelBytes
    );

    const uVideoLoc = gl.getUniformLocation(this.program, 'u_video');
    if (uVideoLoc) gl.uniform1i(uVideoLoc, 0);

    // 2. Upload LUT texture to Texture Unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
    upload3dLutTexture(gl, this.lutTexture, lutData, lutEnabled);

    const uLutLoc = gl.getUniformLocation(this.program, 'u_lut');
    if (uLutLoc) gl.uniform1i(uLutLoc, 1);

    // 3. Bind all color grading uniforms identically to preview and exporters
    applyColorPipelineUniforms(
      gl,
      this.program,
      adjustments,
      lutData,
      lutEnabled,
      interpolationMode
    );

    // 4. Setup quad attributes and draw
    const aPosLoc = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPosLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // 5. Read back rendered pixel from GPU
    const outPixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, outPixel);

    return [outPixel[0] / 255, outPixel[1] / 255, outPixel[2] / 255];
  }

  public destroy(): void {
    const gl = this.gl;
    gl.deleteTexture(this.inputTexture);
    gl.deleteTexture(this.lutTexture);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteProgram(this.program);
  }
}

/**
 * Executes a full automated audit of all color operations comparing CPU vs GPU.
 *
 * Operations audited function-by-function:
 * 1. exposure (positive and negative EV)
 * 2. temperature (warm and cool linear chromatic shifts)
 * 3. tint (magenta and green linear chromatic shifts)
 * 4. highlights (highlight roll-off and lift)
 * 5. shadows (shadow lift and crush)
 * 6. contrast (low and high slope)
 * 7. saturation (desaturation and hypersaturation)
 * 8. LUT strength (variable opacity blends)
 * 9. LUT interpolation (Trilinear mode)
 * 10. LUT interpolation (Tetrahedral Pro mode)
 * 11. LUT domain handling (non-standard domain min/max)
 * 12. Full Composite Grade (all primary controls + 3D LUT + Tetrahedral)
 */
export async function runFullColorParitySuite(): Promise<ParityAuditReport> {
  const harness = new WebGlParityHarness();
  const gpuInfo = harness.getGpuInfo();

  // Quantization tolerance:
  // Standard 8-bit unsigned byte readback has discrete step of 1/255 ≈ 0.00392.
  // 2-bit quantization rounding ceiling is 0.008 (less than 1% DeltaE).
  const TOLERANCE = 0.008;

  const testLut = createSyntheticParityLut(17);
  const results: TestCaseResult[] = [];

  interface AuditScenario {
    operation: string;
    description: string;
    adjustments: ColorAdjustments;
    lutData: LutData | null;
    lutEnabled: boolean;
    interpolationMode: LutInterpolationMode;
  }

  const scenarios: AuditScenario[] = [
    // 1. Exposure (+1.25 EV boost)
    {
      operation: 'exposure',
      description: 'Exposure Boost (+1.25 EV stops)',
      adjustments: { ...createDefaultAdjustments(), exposure: 1.25 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 2. Exposure (-1.00 EV drop)
    {
      operation: 'exposure',
      description: 'Exposure Reduction (-1.00 EV stops)',
      adjustments: { ...createDefaultAdjustments(), exposure: -1.0 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 3. Temperature (Warm +65 in linear radiance space)
    {
      operation: 'temperature',
      description: 'Colorimetric White Balance (Warm +65)',
      adjustments: { ...createDefaultAdjustments(), temperature: 65 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 4. Temperature (Cool -60 in linear radiance space)
    {
      operation: 'temperature',
      description: 'Colorimetric White Balance (Cool -60)',
      adjustments: { ...createDefaultAdjustments(), temperature: -60 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 5. Tint (Magenta +50 in linear radiance space)
    {
      operation: 'tint',
      description: 'Colorimetric Tint (Magenta +50)',
      adjustments: { ...createDefaultAdjustments(), tint: 50 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 6. Tint (Green -50 in linear radiance space)
    {
      operation: 'tint',
      description: 'Colorimetric Tint (Green -50)',
      adjustments: { ...createDefaultAdjustments(), tint: -50 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 7. Highlights (Roll-off compression -70)
    {
      operation: 'highlights',
      description: 'Highlights Roll-off (-70)',
      adjustments: { ...createDefaultAdjustments(), highlights: -70 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 8. Shadows (Shadow Lift +60)
    {
      operation: 'shadows',
      description: 'Shadows Lift (+60)',
      adjustments: { ...createDefaultAdjustments(), shadows: 60 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 9. Contrast (Punchy contrast factor 1.40)
    {
      operation: 'contrast',
      description: 'Contrast S-Curve (Factor 1.40)',
      adjustments: { ...createDefaultAdjustments(), contrast: 1.4 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 10. Saturation (Monochrome desaturation 0.0)
    {
      operation: 'saturation',
      description: 'Saturation (Full Desaturation 0.0)',
      adjustments: { ...createDefaultAdjustments(), saturation: 0.0 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 11. Saturation (Vibrant boost 1.60)
    {
      operation: 'saturation',
      description: 'Saturation (Vibrant Boost 1.60)',
      adjustments: { ...createDefaultAdjustments(), saturation: 1.6 },
      lutData: null,
      lutEnabled: false,
      interpolationMode: 'tetrahedral'
    },
    // 12. LUT Strength (50% blend opacity)
    {
      operation: 'LUT strength',
      description: 'LUT Opacity Blend (50% Strength)',
      adjustments: { ...createDefaultAdjustments(), lutStrength: 0.5 },
      lutData: testLut,
      lutEnabled: true,
      interpolationMode: 'tetrahedral'
    },
    // 13. LUT Interpolation (Trilinear 8-tap mode)
    {
      operation: 'LUT interpolation',
      description: 'LUT Interpolation: Trilinear Mode',
      adjustments: createDefaultAdjustments(),
      lutData: testLut,
      lutEnabled: true,
      interpolationMode: 'trilinear'
    },
    // 14. LUT Interpolation (Tetrahedral Pro 6-simplex mode)
    {
      operation: 'LUT interpolation',
      description: 'LUT Interpolation: Tetrahedral Pro Mode',
      adjustments: createDefaultAdjustments(),
      lutData: testLut,
      lutEnabled: true,
      interpolationMode: 'tetrahedral'
    },
    // 15. LUT Domain Handling (Extended dynamic range domain)
    {
      operation: 'LUT domain handling',
      description: 'Custom LUT Domain Bounds ([-0.05..1.15])',
      adjustments: createDefaultAdjustments(),
      lutData: {
        ...testLut,
        domainMin: [-0.05, -0.05, -0.05],
        domainMax: [1.15, 1.15, 1.15]
      },
      lutEnabled: true,
      interpolationMode: 'tetrahedral'
    },
    // 16. Full Composite Pipeline (Combined grading controls + 3D LUT)
    {
      operation: 'full pipeline',
      description: 'Full Composite Pipeline (All Adjustments + 3D LUT)',
      adjustments: {
        exposure: 0.35,
        contrast: 1.15,
        saturation: 1.1,
        temperature: 25,
        tint: -15,
        highlights: -30,
        shadows: 20,
        lutStrength: 0.85
      },
      lutData: testLut,
      lutEnabled: true,
      interpolationMode: 'tetrahedral'
    }
  ];

  // Execute all scenarios against standard test vectors
  for (const scenario of scenarios) {
    for (const vector of STANDARD_TEST_VECTORS) {
      // Ensure input vector is quantized to exact 8-bit steps so both CPU and GPU receive identical inputs
      const quantizedInput: [number, number, number] = [
        Math.round(vector.rgb[0] * 255) / 255,
        Math.round(vector.rgb[1] * 255) / 255,
        Math.round(vector.rgb[2] * 255) / 255
      ];

      // 1. CPU Pipeline Execution
      const cpuRgb = executeColorGradeCpu(
        quantizedInput,
        scenario.adjustments,
        scenario.lutData,
        scenario.lutEnabled,
        scenario.interpolationMode
      );

      // 2. GPU Pipeline Execution (Identical shader and uniforms)
      const gpuRgb = harness.renderGpu(
        quantizedInput,
        scenario.adjustments,
        scenario.lutData,
        scenario.lutEnabled,
        scenario.interpolationMode
      );

      // 3. Difference and Error Computation
      const deltaR = Math.abs(cpuRgb[0] - gpuRgb[0]);
      const deltaG = Math.abs(cpuRgb[1] - gpuRgb[1]);
      const deltaB = Math.abs(cpuRgb[2] - gpuRgb[2]);
      const maxDelta = Math.max(deltaR, deltaG, deltaB);
      const rmse = Math.sqrt((deltaR * deltaR + deltaG * deltaG + deltaB * deltaB) / 3);

      const passed = maxDelta <= TOLERANCE;

      results.push({
        operation: scenario.operation,
        vectorName: `${scenario.description} · ${vector.name}`,
        inputRgb: quantizedInput,
        cpuRgb,
        gpuRgb,
        deltaR,
        deltaG,
        deltaB,
        maxDelta,
        rmse,
        tolerance: TOLERANCE,
        passed,
        notes: passed
          ? `Parity verified (max delta ${(maxDelta * 255).toFixed(2)}/255)`
          : `Delta exceeds tolerance ${(maxDelta * 255).toFixed(2)}/255`
      });
    }
  }

  harness.destroy();

  // Aggregate Operation Summaries
  const operationsMap = new Map<string, { deltas: number[]; passedCount: number; totalCount: number; desc: string }>();

  for (const r of results) {
    if (!operationsMap.has(r.operation)) {
      operationsMap.set(r.operation, {
        deltas: [],
        passedCount: 0,
        totalCount: 0,
        desc: r.operation
      });
    }
    const op = operationsMap.get(r.operation)!;
    op.deltas.push(r.maxDelta);
    op.totalCount++;
    if (r.passed) op.passedCount++;
  }

  const operations: OperationSummary[] = Array.from(operationsMap.entries()).map(([name, data]) => {
    const maxDelta = Math.max(...data.deltas);
    const avgDelta = data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length;
    return {
      operation: name,
      description: name.toUpperCase(),
      testCount: data.totalCount,
      passedCount: data.passedCount,
      maxDelta,
      avgDelta,
      passed: data.passedCount === data.totalCount
    };
  });

  const allDeltas = results.map((r) => r.maxDelta);
  const overallMaxDelta = Math.max(...allDeltas);
  const overallAvgDelta = allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length;
  const passedTests = results.filter((r) => r.passed).length;

  return {
    timestamp: new Date().toISOString(),
    gpuRenderer: gpuInfo.renderer,
    gpuVendor: gpuInfo.vendor,
    tolerance: TOLERANCE,
    totalTests: results.length,
    passedTests,
    failedTests: results.length - passedTests,
    overallMaxDelta,
    overallAvgDelta,
    passed: passedTests === results.length,
    operations,
    testCases: results
  };
}
