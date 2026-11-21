import { ColorAdjustments, LutData, LutInterpolationMode, PlaybackResolution, SplitMode } from '../types';
import {
  SHARED_VERTEX_SHADER,
  COLOR_UNIFORMS_GLSL,
  PROCESS_COLOR_GRADE_GLSL,
  upload3dLutTexture,
  applyColorPipelineUniforms,
  executeColorGradeCpu
} from '../color/colorPipeline';

const VERTEX_SHADER = SHARED_VERTEX_SHADER;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 v_uv;

  ${COLOR_UNIFORMS_GLSL}
  ${PROCESS_COLOR_GRADE_GLSL}

  uniform float u_splitMode; // 0=off, 1=vertical, 2=horizontal, 3=side-by-side
  uniform float u_splitPos;
  uniform vec2 u_videoSize;
  uniform vec2 u_canvasSize;

  void main() {
    float videoAspect = u_videoSize.x / max(u_videoSize.y, 1.0);
    float canvasAspect = u_canvasSize.x / max(u_canvasSize.y, 1.0);

    // Normal fit uv
    vec2 uv = v_uv;
    if (u_splitMode == 3.0) {
      // Side-by-side mode: map left half to full video, right half to full video
      if (v_uv.x < 0.5) {
        uv.x = v_uv.x * 2.0;
      } else {
        uv.x = (v_uv.x - 0.5) * 2.0;
      }
      float halfCanvasAspect = (u_canvasSize.x * 0.5) / max(u_canvasSize.y, 1.0);
      if (halfCanvasAspect > videoAspect) {
        float used = videoAspect / halfCanvasAspect;
        uv.x = (uv.x - 0.5) / used + 0.5;
      } else {
        float used = halfCanvasAspect / videoAspect;
        uv.y = (uv.y - 0.5) / used + 0.5;
      }
    } else {
      if (canvasAspect > videoAspect) {
        float used = videoAspect / canvasAspect;
        uv.x = (uv.x - 0.5) / used + 0.5;
      } else {
        float used = canvasAspect / videoAspect;
        uv.y = (v_uv.y - 0.5) / used + 0.5;
      }
    }

    // Letterbox background: clean deep dark tone #090a0d
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.035, 0.039, 0.047, 1.0);
      return;
    }

    vec3 rawSrc = texture2D(u_video, uv).rgb;
    vec3 graded = processColorGrade(rawSrc);

    if (u_splitMode == 1.0) {
      // Vertical split
      if (v_uv.x < u_splitPos) {
        gl_FragColor = vec4(rawSrc, 1.0);
      } else {
        gl_FragColor = vec4(graded, 1.0);
      }
      // Amber hairline divider
      if (abs(v_uv.x - u_splitPos) < 0.0015) {
        gl_FragColor = vec4(0.90, 0.73, 0.44, 1.0);
      }
    } else if (u_splitMode == 2.0) {
      // Horizontal split
      if (v_uv.y > u_splitPos) {
        gl_FragColor = vec4(rawSrc, 1.0);
      } else {
        gl_FragColor = vec4(graded, 1.0);
      }
      if (abs(v_uv.y - u_splitPos) < 0.002) {
        gl_FragColor = vec4(0.90, 0.73, 0.44, 1.0);
      }
    } else if (u_splitMode == 3.0) {
      // Side-by-side
      if (v_uv.x < 0.5) {
        gl_FragColor = vec4(rawSrc, 1.0);
      } else {
        gl_FragColor = vec4(graded, 1.0);
      }
      if (abs(v_uv.x - 0.5) < 0.002) {
        gl_FragColor = vec4(0.90, 0.73, 0.44, 1.0);
      }
    } else {
      // Full view
      gl_FragColor = vec4(graded, 1.0);
    }
  }
`;

export class WebGLPlayer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private videoTexture: WebGLTexture | null = null;
  private lutTexture: WebGLTexture | null = null;
  private downscaleCanvas: HTMLCanvasElement;
  private downscaleCtx: CanvasRenderingContext2D;
  private isReady: boolean = false;
  private lastW: number = 0;
  private lastH: number = 0;

  // Active state
  private lutData: LutData | null = null;
  private lutEnabled: boolean = true;
  private interpolationMode: LutInterpolationMode = 'tetrahedral';
  private adjustments: ColorAdjustments = {
    exposure: 0,
    contrast: 1,
    saturation: 1,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    lutStrength: 1
  };
  private splitMode: SplitMode = 'off';
  private splitPos: number = 0.5;
  private resolution: PlaybackResolution = 'original';

  private isWebGL2: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.downscaleCanvas = document.createElement('canvas');
    this.downscaleCtx = this.downscaleCanvas.getContext('2d', { alpha: false, desynchronized: true })!;
    this.initGL();
  }

  private initGL() {
    try {
      const gl2 = this.canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        preserveDrawingBuffer: true
      });

      if (gl2) {
        this.gl = gl2;
        this.isWebGL2 = true;
        // Enable linear filtering for float textures if supported
        gl2.getExtension('OES_texture_float_linear');
        gl2.getExtension('EXT_color_buffer_float');
      } else {
        this.gl = this.canvas.getContext('webgl', {
          alpha: false,
          antialias: false,
          preserveDrawingBuffer: true
        });
        this.isWebGL2 = false;
      }

      if (!this.gl) throw new Error('WebGL is not supported in this browser.');

      const gl = this.gl;
      const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

      this.program = gl.createProgram()!;
      gl.attachShader(this.program, vs);
      gl.attachShader(this.program, fs);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(this.program) || 'Program link failed');
      }

      gl.useProgram(this.program);

      // Vertex quad
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

      const pos = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      // Texture 0: Video
      this.videoTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_video'), 0);

      // Texture 1: LUT Atlas
      this.lutTexture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_lut'), 1);

      gl.activeTexture(gl.TEXTURE0);
      this.isReady = true;
    } catch (err) {
      console.error('WebGL initialization error:', err);
      this.isReady = false;
    }
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl!;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const msg = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failure: ${msg}`);
    }
    return shader;
  }

  public setLut(lut: LutData | null) {
    this.lutData = lut;
    if (!this.gl || !this.lutTexture) return;

    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE1);
    upload3dLutTexture(gl, this.lutTexture, lut, this.lutEnabled);
    gl.activeTexture(gl.TEXTURE0);
  }

  public setLutEnabled(enabled: boolean) {
    this.lutEnabled = enabled;
    if (this.gl && this.lutTexture) {
      this.gl.activeTexture(this.gl.TEXTURE1);
      upload3dLutTexture(this.gl, this.lutTexture, this.lutData, this.lutEnabled);
      this.gl.activeTexture(this.gl.TEXTURE0);
    }
  }

  public setInterpolationMode(mode: LutInterpolationMode) {
    this.interpolationMode = mode;
  }

  public getInterpolationMode(): LutInterpolationMode {
    return this.interpolationMode;
  }

  public setAdjustments(adj: ColorAdjustments) {
    this.adjustments = { ...adj };
  }

  public setSplitMode(mode: SplitMode, pos: number = 0.5) {
    this.splitMode = mode;
    this.splitPos = pos;
  }

  public setResolution(res: PlaybackResolution) {
    this.resolution = res;
  }

  public render(video: HTMLVideoElement | null) {
    if (!this.isReady || !this.gl || !this.program) return;
    const gl = this.gl;

    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));

    if (w !== this.lastW || h !== this.lastH) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.lastW = w;
      this.lastH = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    let vidW = 1920;
    let vidH = 1080;

    if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      vidW = video.videoWidth;
      vidH = video.videoHeight;
      this.updateVideoTexture(video);
    }

    // Set 3D LUT Texture
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);

    // Apply authoritative color grading pipeline uniforms (LUT + Primary grading + Interpolation)
    applyColorPipelineUniforms(gl, this.program, this.adjustments, this.lutData, this.lutEnabled, this.interpolationMode);

    let splitModeVal = 0.0;
    if (this.splitMode === 'vertical') splitModeVal = 1.0;
    else if (this.splitMode === 'horizontal') splitModeVal = 2.0;
    else if (this.splitMode === 'side-by-side') splitModeVal = 3.0;

    gl.uniform1f(gl.getUniformLocation(this.program, 'u_splitMode'), splitModeVal);
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_splitPos'), this.splitPos);
    gl.uniform2fv(gl.getUniformLocation(this.program, 'u_videoSize'), [vidW, vidH]);
    gl.uniform2fv(gl.getUniformLocation(this.program, 'u_canvasSize'), [w, h]);

    // Draw full-screen triangle strip
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.flush();
    gl.activeTexture(gl.TEXTURE0);
  }

  // Offscreen Analysis FBO for 100% reliable Graded / Raw pixel readback across all browsers
  private analysisFbo: WebGLFramebuffer | null = null;
  private analysisTex: WebGLTexture | null = null;
  private analysisW: number = 0;
  private analysisH: number = 0;
  private analysisPixels: Uint8Array | null = null;
  private readbackCanvas: HTMLCanvasElement | null = null;
  private readbackCtx: CanvasRenderingContext2D | null = null;

  private ensureAnalysisFbo(w: number, h: number): boolean {
    if (!this.gl) return false;
    const gl = this.gl;
    if (this.analysisFbo && this.analysisTex && this.analysisW === w && this.analysisH === h) {
      return true;
    }
    if (this.analysisFbo) {
      gl.deleteFramebuffer(this.analysisFbo);
      this.analysisFbo = null;
    }
    if (this.analysisTex) {
      gl.deleteTexture(this.analysisTex);
      this.analysisTex = null;
    }

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      return false;
    }

    this.analysisFbo = fbo;
    this.analysisTex = tex;
    this.analysisW = w;
    this.analysisH = h;
    this.analysisPixels = new Uint8Array(w * h * 4);
    return true;
  }

  public updateVideoTexture(video: HTMLVideoElement) {
    if (!this.gl || !this.videoTexture || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      return;
    }
    const gl = this.gl;
    const vidW = video.videoWidth;
    const vidH = video.videoHeight;

    let targetW = vidW;
    let targetH = vidH;

    const maxDim = this.resolution === '1080' ? 1920 : this.resolution === '720' ? 1280 : this.resolution === '480' ? 854 : 0;
    if (maxDim && Math.max(targetW, targetH) > maxDim) {
      const scale = maxDim / Math.max(targetW, targetH);
      targetW = Math.max(2, Math.round((vidW * scale) / 2) * 2);
      targetH = Math.max(2, Math.round((vidH * scale) / 2) * 2);
    }

    if (this.downscaleCanvas.width !== targetW || this.downscaleCanvas.height !== targetH) {
      this.downscaleCanvas.width = targetW;
      this.downscaleCanvas.height = targetH;
    }

    this.downscaleCtx.drawImage(video, 0, 0, targetW, targetH);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, this.downscaleCanvas);
  }

  /**
   * Retrieves an accurate ImageData frame from either:
   * 1. 'graded': Evaluated through the WebGL fragment shader with active 3D LUT + EV + Kelvin/Tint + Contrast + Saturation
   * 2. 'raw': Direct un-graded camera/log video pixels without any LUT or color transforms
   */
  public getSampleImageData(
    sourceType: 'graded' | 'raw',
    video: HTMLVideoElement | null,
    targetW: number = 320,
    targetH: number = 180
  ): ImageData | null {
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      this.updateVideoTexture(video);
    }

    // Attempt hardware-accelerated GPU offscreen FBO rendering
    if (this.gl && this.program && this.positionBuffer && this.ensureAnalysisFbo(targetW, targetH)) {
      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.analysisFbo);
      gl.viewport(0, 0, targetW, targetH);
      gl.useProgram(this.program);

      // Bind vertex buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      const pos = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

      // Video texture (unit 0)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_video'), 0);

      // LUT texture (unit 1)
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTexture);
      gl.uniform1i(gl.getUniformLocation(this.program, 'u_lut'), 1);

      const isGraded = sourceType === 'graded';
      if (isGraded) {
        applyColorPipelineUniforms(gl, this.program, this.adjustments, this.lutData, this.lutEnabled, this.interpolationMode);
      } else {
        applyColorPipelineUniforms(
          gl,
          this.program,
          {
            exposure: 0,
            contrast: 1,
            saturation: 1,
            temperature: 0,
            tint: 0,
            highlights: 0,
            shadows: 0,
            lutStrength: 0
          },
          null,
          false,
          'tetrahedral'
        );
      }

      // Analysis FBO is strictly 1:1 mapped (no split screen, no letterbox)
      gl.uniform1f(gl.getUniformLocation(this.program, 'u_splitMode'), 0.0);
      gl.uniform1f(gl.getUniformLocation(this.program, 'u_splitPos'), 0.5);
      gl.uniform2fv(gl.getUniformLocation(this.program, 'u_videoSize'), [targetW, targetH]);
      gl.uniform2fv(gl.getUniformLocation(this.program, 'u_canvasSize'), [targetW, targetH]);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      const pixels = this.analysisPixels || new Uint8Array(targetW * targetH * 4);
      gl.readPixels(0, 0, targetW, targetH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Unbind FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Create output ImageData with vertical flip (WebGL bottom-left to 2D top-left)
      if (!this.readbackCanvas || this.readbackCanvas.width !== targetW || this.readbackCanvas.height !== targetH) {
        this.readbackCanvas = document.createElement('canvas');
        this.readbackCanvas.width = targetW;
        this.readbackCanvas.height = targetH;
        this.readbackCtx = this.readbackCanvas.getContext('2d', { willReadFrequently: true });
      }
      const ctx = this.readbackCtx;
      if (ctx) {
        const outImgData = ctx.createImageData(targetW, targetH);
        const out = outImgData.data;
        const rowBytes = targetW * 4;
        let hasContent = false;
        for (let y = 0; y < targetH; y++) {
          const srcY = targetH - 1 - y;
          const srcOffset = srcY * rowBytes;
          const dstOffset = y * rowBytes;
          for (let x = 0; x < rowBytes; x += 4) {
            const r = pixels[srcOffset + x];
            const g = pixels[srcOffset + x + 1];
            const b = pixels[srcOffset + x + 2];
            out[dstOffset + x] = r;
            out[dstOffset + x + 1] = g;
            out[dstOffset + x + 2] = b;
            out[dstOffset + x + 3] = 255;
            if (r > 0 || g > 0 || b > 0) hasContent = true;
          }
        }
        if (hasContent) {
          return outImgData;
        }
      }
    }

    // Fail-safe CPU fallback if WebGL FBO readback is unsupported or empty
    if (video && video.readyState >= 2 && video.videoWidth > 0) {
      if (!this.readbackCanvas || this.readbackCanvas.width !== targetW || this.readbackCanvas.height !== targetH) {
        this.readbackCanvas = document.createElement('canvas');
        this.readbackCanvas.width = targetW;
        this.readbackCanvas.height = targetH;
        this.readbackCtx = this.readbackCanvas.getContext('2d', { willReadFrequently: true });
      }
      const ctx = this.readbackCtx;
      if (ctx) {
        ctx.drawImage(video, 0, 0, targetW, targetH);
        const rawImg = ctx.getImageData(0, 0, targetW, targetH);
        if (sourceType === 'raw') {
          return rawImg;
        }
        // Software grading fallback
        return applySoftwareGrade(rawImg, this.adjustments, this.lutData, this.lutEnabled);
      }
    }

    return null;
  }

  public captureSnapshotPng(): string | null {
    if (!this.canvas) return null;
    return this.canvas.toDataURL('image/png');
  }

  public getGpuInfo(): { vendor: string; renderer: string } {
    if (!this.gl) return { vendor: 'Unknown', renderer: 'Software / Unavailable' };
    const dbgRenderInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
    if (dbgRenderInfo) {
      return {
        vendor: this.gl.getParameter(dbgRenderInfo.UNMASKED_VENDOR_WEBGL) || 'Unknown GPU Vendor',
        renderer: this.gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || 'WebGL Renderer'
      };
    }
    return {
      vendor: this.gl.getParameter(this.gl.VENDOR) || 'Generic',
      renderer: this.gl.getParameter(this.gl.RENDERER) || 'WebGL'
    };
  }

  public destroy() {
    this.isReady = false;
    if (this.gl) {
      if (this.analysisFbo) this.gl.deleteFramebuffer(this.analysisFbo);
      if (this.analysisTex) this.gl.deleteTexture(this.analysisTex);
    }
  }
}

/**
 * CPU Software Fallback to guarantee that Graded WebGL and Raw footage
 * always evaluate different, mathematically exact color states even if WebGL FBO readback fails.
 */
function applySoftwareGrade(
  rawImg: ImageData,
  adj: ColorAdjustments,
  lutData: LutData | null,
  lutEnabled: boolean
): ImageData {
  const out = new ImageData(new Uint8ClampedArray(rawImg.data), rawImg.width, rawImg.height);
  const data = out.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const rgb: [number, number, number] = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    const graded = executeColorGradeCpu(rgb, adj, lutData, lutEnabled);
    data[i] = Math.max(0, Math.min(255, Math.round(graded[0] * 255)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(graded[1] * 255)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(graded[2] * 255)));
  }

  return out;
}
