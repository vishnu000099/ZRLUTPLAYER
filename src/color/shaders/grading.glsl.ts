/**
 * Unified Color Processing Shader Chunks & Master Pipelines
 * 
 * IMPORTANT: This file is the SINGLE SOURCE OF TRUTH for color grading math in WebGL.
 * The preview player (webglPlayer.ts), CPU exporter (videoExporter.ts), and
 * WebCodecs hardware exporter (hardwareVideoExporter.ts) MUST ALL use the functions
 * defined here to guarantee: Preview Output == Exported Output.
 */

export const SHARED_VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = (a_position + 1.0) * 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

/**
 * Common Uniforms required for primary color grading and 3D LUT sampling
 */
export const COLOR_UNIFORMS_GLSL = `
  uniform sampler2D u_video;
  uniform sampler2D u_lut;
  uniform float u_lutSize;
  uniform vec3 u_domainMin;
  uniform vec3 u_domainMax;
  uniform float u_lutOn;
  uniform float u_strength;

  // Primary color grading uniforms
  uniform float u_exposure;     // EV stops (-2.0 to +2.0)
  uniform float u_contrast;     // Contrast factor (0.5 to 1.5)
  uniform float u_saturation;   // Saturation factor (0.0 to 2.0)
  uniform float u_temperature;  // White balance temp (-1.0 to +1.0)
  uniform float u_tint;         // Green/Magenta tint (-1.0 to +1.0)
  uniform float u_highlights;   // Highlight roll-off (-1.0 to +1.0)
  uniform float u_shadows;      // Shadow lift/crush (-1.0 to +1.0)

  // LUT Interpolation: 0.0 = Tetrahedral (High-precision Pro mode), 1.0 = Trilinear (Fast/Compatibility)
  uniform float u_interpolationMode;
`;

/**
 * High-Precision 3D LUT Sampling GLSL Functions
 * Supports both Tetrahedral (optimal 4-simplex interpolation with zero diagonal curvature error)
 * and classic Trilinear (8-tap cubic interpolation).
 */
export const LUT_SAMPLING_GLSL = `
  vec3 lutFetch(float r, float g, float b) {
    float x = (b * u_lutSize + r + 0.5) / (u_lutSize * u_lutSize);
    float y = (g + 0.5) / u_lutSize;
    return texture2D(u_lut, vec2(x, y)).rgb;
  }

  vec3 sampleLutTrilinear(vec3 lo, vec3 hi, vec3 f) {
    vec3 c000 = lutFetch(lo.r, lo.g, lo.b);
    vec3 c100 = lutFetch(hi.r, lo.g, lo.b);
    vec3 c010 = lutFetch(lo.r, hi.g, lo.b);
    vec3 c110 = lutFetch(hi.r, hi.g, lo.b);

    vec3 c001 = lutFetch(lo.r, lo.g, hi.b);
    vec3 c101 = lutFetch(hi.r, lo.g, hi.b);
    vec3 c011 = lutFetch(lo.r, hi.g, hi.b);
    vec3 c111 = lutFetch(hi.r, hi.g, hi.b);

    vec3 c00 = mix(c000, c100, f.r);
    vec3 c10 = mix(c010, c110, f.r);
    vec3 c01 = mix(c001, c101, f.r);
    vec3 c11 = mix(c011, c111, f.r);

    vec3 c0 = mix(c00, c10, f.g);
    vec3 c1 = mix(c01, c11, f.g);

    return mix(c0, c1, f.b);
  }

  vec3 sampleLutTetrahedral(vec3 lo, vec3 hi, vec3 f) {
    vec3 p0 = lutFetch(lo.r, lo.g, lo.b);
    vec3 p3 = lutFetch(hi.r, hi.g, hi.b);
    vec3 p1;
    vec3 p2;
    float w0, w1, w2, w3;

    if (f.r >= f.g) {
      if (f.g >= f.b) {
        // Simplex 1: f.r >= f.g >= f.b
        p1 = lutFetch(hi.r, lo.g, lo.b);
        p2 = lutFetch(hi.r, hi.g, lo.b);
        w0 = 1.0 - f.r;
        w1 = f.r - f.g;
        w2 = f.g - f.b;
        w3 = f.b;
      } else if (f.r >= f.b) {
        // Simplex 2: f.r >= f.b > f.g
        p1 = lutFetch(hi.r, lo.g, lo.b);
        p2 = lutFetch(hi.r, lo.g, hi.b);
        w0 = 1.0 - f.r;
        w1 = f.r - f.b;
        w2 = f.b - f.g;
        w3 = f.g;
      } else {
        // Simplex 3: f.b > f.r >= f.g
        p1 = lutFetch(lo.r, lo.g, hi.b);
        p2 = lutFetch(hi.r, lo.g, hi.b);
        w0 = 1.0 - f.b;
        w1 = f.b - f.r;
        w2 = f.r - f.g;
        w3 = f.g;
      }
    } else {
      if (f.b >= f.g) {
        // Simplex 4: f.b >= f.g > f.r
        p1 = lutFetch(lo.r, lo.g, hi.b);
        p2 = lutFetch(lo.r, hi.g, hi.b);
        w0 = 1.0 - f.b;
        w1 = f.b - f.g;
        w2 = f.g - f.r;
        w3 = f.r;
      } else if (f.b >= f.r) {
        // Simplex 5: f.g > f.b >= f.r
        p1 = lutFetch(lo.r, hi.g, lo.b);
        p2 = lutFetch(lo.r, hi.g, hi.b);
        w0 = 1.0 - f.g;
        w1 = f.g - f.b;
        w2 = f.b - f.r;
        w3 = f.r;
      } else {
        // Simplex 6: f.g >= f.r > f.b
        p1 = lutFetch(lo.r, hi.g, lo.b);
        p2 = lutFetch(hi.r, hi.g, lo.b);
        w0 = 1.0 - f.g;
        w1 = f.g - f.r;
        w2 = f.r - f.b;
        w3 = f.b;
      }
    }

    return p0 * w0 + p1 * w1 + p2 * w2 + p3 * w3;
  }

  vec3 sampleLut(vec3 color) {
    vec3 span = max(u_domainMax - u_domainMin, vec3(0.000001));
    vec3 c = clamp((color - u_domainMin) / span, 0.0, 1.0) * (u_lutSize - 1.0);
    vec3 lo = floor(c);
    vec3 hi = min(lo + 1.0, vec3(u_lutSize - 1.0));
    vec3 f = fract(c);

    if (u_interpolationMode > 0.5) {
      return sampleLutTrilinear(lo, hi, f);
    } else {
      return sampleLutTetrahedral(lo, hi, f);
    }
  }
`;

/**
 * Primary Color Adjustments GLSL Function
 * 1. Exposure (in EV)
 * 2. Temperature & Tint
 * 3. Highlights & Shadows
 * 4. Contrast
 * 5. Saturation
 */
export const COLOR_ADJUSTMENTS_GLSL = `
  vec3 srgbToLinear(vec3 c) {
    vec3 low = c / 12.92;
    vec3 safeBase = max((c + 0.055) / 1.055, vec3(0.0));
    vec3 high = pow(safeBase, vec3(2.4));
    return mix(low, high, step(vec3(0.04045), c));
  }

  vec3 linearToSrgb(vec3 c) {
    vec3 low = c * 12.92;
    vec3 safeBase = max(c, vec3(0.0));
    vec3 high = 1.055 * pow(safeBase, vec3(1.0 / 2.4)) - 0.055;
    return mix(low, high, step(vec3(0.0031308), c));
  }

  vec3 applyWhiteBalanceLinear(vec3 rgb, float temperature, float tint) {
    if (abs(temperature) < 0.0001 && abs(tint) < 0.0001) {
      return rgb;
    }
    vec3 lin = srgbToLinear(rgb);
    float rawR = exp(temperature * 0.35 + tint * 0.12);
    float rawG = exp(-tint * 0.24);
    float rawB = exp(-temperature * 0.35 + tint * 0.12);

    float lumFactor = dot(vec3(rawR, rawG, rawB), vec3(0.2126, 0.7152, 0.0722));
    vec3 gains = vec3(rawR, rawG, rawB) / max(0.0001, lumFactor);

    vec3 balancedLin = lin * gains;
    return linearToSrgb(balancedLin);
  }

  vec3 applyColorAdjustments(vec3 rgb) {
    // 1. Exposure (in EV)
    vec3 color = rgb * pow(2.0, u_exposure);

    // 2. Colorimetric White Balance in Linear Radiance Working Space
    color = applyWhiteBalanceLinear(color, u_temperature, u_tint);

    // 3. Highlights & Shadows
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float shadowMask = 1.0 - smoothstep(0.0, 0.6, lum);
    float highlightMask = smoothstep(0.4, 1.0, lum);
    color += shadowMask * u_shadows * 0.25;
    color += highlightMask * u_highlights * 0.25;

    // 4. Contrast around midpoint 0.5
    color = (color - 0.5) * u_contrast + 0.5;

    // 5. Saturation around Rec.709 luminance
    float finalLum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(finalLum), color, u_saturation);

    // Preserve floating-point intermediate values for 3D LUT stage
    return color;
  }
`;

/**
 * Master Color Processing Pipeline GLSL Function
 * Applies primary grading, then samples 3D LUT, blends by lutStrength,
 * and applies final output range mapping at the very end.
 */
export const PROCESS_COLOR_GRADE_GLSL = `
  ${LUT_SAMPLING_GLSL}
  ${COLOR_ADJUSTMENTS_GLSL}

  vec3 finalOutputMapping(vec3 color) {
    // Output range and gamut mapping at the final output stage
    return clamp(color, 0.0, 1.0);
  }

  vec3 processColorGrade(vec3 inputRgb) {
    vec3 processed = applyColorAdjustments(inputRgb);
    if (u_lutOn > 0.5) {
      vec3 lutColor = sampleLut(processed);
      processed = mix(processed, lutColor, clamp(u_strength, 0.0, 1.0));
    }
    // Only apply output range mapping at the final output stage
    return finalOutputMapping(processed);
  }
`;

/**
 * Complete, authoritative Export Fragment Shader
 * Used identically by both CPU and Hardware video exporters.
 */
export const EXPORT_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  ${COLOR_UNIFORMS_GLSL}
  ${PROCESS_COLOR_GRADE_GLSL}

  void main() {
    // Invert Y for standard texture mapping
    vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
    vec4 rawColor = texture2D(u_video, uv);
    vec3 graded = processColorGrade(rawColor.rgb);
    gl_FragColor = vec4(graded, 1.0);
  }
`;
