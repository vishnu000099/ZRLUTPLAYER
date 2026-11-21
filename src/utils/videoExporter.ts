import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { ColorAdjustments, ExportConfig, ExportProgress, LutData } from '../types';
import { exportHardwareGradedVideo } from './hardwareVideoExporter';
import { detectSourceVideoFps } from './fpsDetector';
import { Input, BlobSource, ALL_FORMATS, VideoSampleSink } from 'mediabunny';
import {
  SHARED_VERTEX_SHADER,
  EXPORT_FRAGMENT_SHADER,
  upload3dLutTexture,
  applyColorPipelineUniforms
} from '../color/colorPipeline';

const VERTEX_SHADER = SHARED_VERTEX_SHADER;
const FRAGMENT_SHADER = EXPORT_FRAGMENT_SHADER;

/**
 * Calculates proportional output dimensions and floors to strictly even numbers.
 * Guarantees that scaled dimensions never overshoot the target bounding box (1080p or 720p).
 */
export function calculateExportDimensions(
  originalWidth: number,
  originalHeight: number,
  preserveResolution: boolean,
  targetResolution?: 'original' | '1080' | '720'
): { width: number; height: number } {
  if (preserveResolution || !targetResolution || targetResolution === 'original') {
    const w = Math.floor(originalWidth / 2) * 2;
    const h = Math.floor(originalHeight / 2) * 2;
    return { width: Math.max(2, w), height: Math.max(2, h) };
  }

  let maxW = 1920;
  let maxH = 1080;
  if (targetResolution === '720') {
    maxW = 1280;
    maxH = 720;
  }

  // Calculate proportional scale factor
  const scale = Math.min(maxW / originalWidth, maxH / originalHeight);

  // Floor to even number: strictly prevents overshooting maxW and maxH
  let width = Math.floor((originalWidth * scale) / 2) * 2;
  let height = Math.floor((originalHeight * scale) / 2) * 2;

  // Strict clamp bounds
  width = Math.min(maxW, Math.max(2, width));
  height = Math.min(maxH, Math.max(2, height));

  // Guarantee even parity (required by H.264/H.265 encoders)
  if (width % 2 !== 0) width -= 1;
  if (height % 2 !== 0) height -= 1;

  return { width, height };
}

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

// Global concurrency guard: ensure only one export pipeline runs at a time
let isExportRunning = false;

/**
 * Sweeps and cleans virtual filesystem artifacts from FFmpeg WASM memory.
 * Can be called before export (to clear residual files from crashed runs)
 * and in finally blocks (to guarantee no frames remain upon error or abort).
 */
export async function cleanFFmpegVirtualFs(ffmpeg: FFmpeg, trackedFiles?: Iterable<string>): Promise<void> {
  // 1. Delete all explicitly tracked files
  if (trackedFiles) {
    for (const f of trackedFiles) {
      try {
        await ffmpeg.deleteFile(f);
      } catch {
        // file not found or already deleted
      }
    }
  }

  // 2. Scan virtual filesystem root and sweep any leftover artifacts
  try {
    const entries = await ffmpeg.listDir('.');
    for (const entry of entries) {
      if (!entry.isDir && entry.name !== '.' && entry.name !== '..') {
        const n = entry.name;
        if (
          n.startsWith('chk_') ||
          n.startsWith('slice_') ||
          n.startsWith('f_') ||
          n.endsWith('.jpg') ||
          n.endsWith('.ppm') ||
          n.endsWith('.mp4') ||
          n.endsWith('.aac') ||
          n.endsWith('.txt')
        ) {
          try {
            await ffmpeg.deleteFile(n);
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err) {
    console.debug('Virtual FS sweep notice:', err);
  }
}

let activeLogCallback: ((msg: string) => void) | null = null;

export async function getFFmpeg(onLog?: (msg: string) => void): Promise<FFmpeg> {
  activeLogCallback = onLog || null;

  if (ffmpegInstance && ffmpegLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  ffmpeg.on('log', ({ message }) => {
    if (activeLogCallback) {
      activeLogCallback(message);
    }
  });

  try {
    // 1. First attempt to load local bundled core from /public/ffmpeg/
    const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');
    await ffmpeg.load({ coreURL, wasmURL });
  } catch (err) {
    console.warn('Local ffmpeg load failed, attempting CDN fallback:', err);
    // 2. Fallback to jsDelivr CDN
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
    await ffmpeg.load({ coreURL, wasmURL });
  }

  ffmpegInstance = ffmpeg;
  ffmpegLoaded = true;
  return ffmpeg;
}

export interface VideoExportOptions {
  videoElement: HTMLVideoElement;
  sourceFile?: File | Blob | null;
  sourceFileName?: string;
  adjustments: ColorAdjustments;
  lutData: LutData | null;
  lutEnabled: boolean;
  config: ExportConfig;
  onProgress: (progress: ExportProgress) => void;
  abortSignal?: AbortSignal;
}

export async function exportGradedVideo(options: VideoExportOptions): Promise<{ blob: Blob; url: string; fileName: string }> {
  if (isExportRunning) {
    throw new Error('An export is already in progress. Please wait for it to complete or cancel it before starting another.');
  }
  isExportRunning = true;

  try {
    // Check if WebCodecs streaming engine is supported in this browser
    // (Available across all modern Chromium, Safari 16.4+, and Firefox 130+).
    // This engine executes the optimal architecture:
    // Decode frame -> GPU grade in WebGL -> immediately encode to videoSource -> release frame -> next frame!
    // It natively supports both 'hardware' (prefer-hardware GPU) and 'cpu' (prefer-software CPU) with O(1) single-frame memory.
    const hasWebCodecs = typeof window !== 'undefined' && typeof (window as any).VideoEncoder !== 'undefined';

    if (options.config.encoderEngine === 'cpu') {
      return await exportCpuGradedVideo(options);
    }

    if (hasWebCodecs) {
      try {
        return await exportHardwareGradedVideo(options);
      } catch (streamErr: any) {
        if (options.abortSignal?.aborted || streamErr?.message?.includes('cancelled')) {
          throw streamErr;
        }
        console.warn('Streaming video export encountered an error, falling back to chunked WASM engine:', streamErr);
        options.onProgress({
          phase: 'initializing',
          percent: 2,
          currentFrame: 0,
          totalFrames: 100,
          fps: 0,
          elapsedSeconds: 0,
          remainingSeconds: 60,
          stageMessage: 'Streaming encoder fallback. Switching to bounded chunked WASM engine...',
          engine: 'cpu'
        });
        return await exportCpuGradedVideo(options);
      }
    }

    // Pure WASM fallback for older browsers without WebCodecs API
    return await exportCpuGradedVideo(options);
  } finally {
    isExportRunning = false;
  }
}

export async function exportCpuGradedVideo(options: VideoExportOptions): Promise<{ blob: Blob; url: string; fileName: string }> {
  const {
    videoElement,
    sourceFile,
    sourceFileName = 'video',
    adjustments,
    lutData,
    lutEnabled,
    config,
    onProgress,
    abortSignal
  } = options;

  const directCallLock = !isExportRunning;
  if (directCallLock) {
    isExportRunning = true;
  }

  if (abortSignal?.aborted) {
    if (directCallLock) isExportRunning = false;
    throw new Error('Export cancelled by user');
  }

  let ffmpegRef: FFmpeg | null = null;
  let progressHandler: (() => void) | null = null;
  const createdTempFiles = new Set<string>();

  const startTimeMs = Date.now();

  // 1. Determine Output Dimensions (proportional scaling with floor-to-even)
  const originalWidth = videoElement.videoWidth || 1920;
  const originalHeight = videoElement.videoHeight || 1080;

  const { width: exportWidth, height: exportHeight } = calculateExportDimensions(
    originalWidth,
    originalHeight,
    config.preserveResolution,
    config.targetResolution
  );

  // Frame Rate Calculation:
  // If preserveFps is true, detect the authentic source video framerate (e.g., 23.976, 24, 25, 29.97, 50, 59.94, 60).
  // Otherwise, use the user's explicitly selected targetFps.
  let exportFps = 30;
  if (config.preserveFps) {
    exportFps = await detectSourceVideoFps(sourceFile, config.targetFps || 30);
  } else {
    exportFps = config.targetFps || 30;
  }
  const fps = Math.max(1, Math.min(120, exportFps));
  const videoDuration = Math.max(0.1, videoElement.duration || 1);

  let startTime = 0;
  let endTime = videoDuration;

  if (config.exportRange === 'in-out' && config.startTime !== undefined && config.endTime !== undefined) {
    startTime = Math.max(0, config.startTime);
    endTime = Math.min(videoDuration, config.endTime);
  } else if (config.exportRange === 'preview-5s') {
    startTime = 0;
    endTime = Math.min(5, videoDuration);
  }

  const rangeDuration = Math.max(0.1, endTime - startTime);
  const totalFrames = Math.max(1, Math.round(rangeDuration * fps));

  onProgress({
    phase: 'initializing',
    percent: 1,
    currentFrame: 0,
    totalFrames,
    fps: 0,
    elapsedSeconds: 0,
    remainingSeconds: Math.round(totalFrames / 15),
    stageMessage: 'Loading video encoding engine...'
  });

  // 2. Load FFmpeg
  const ffmpeg = await getFFmpeg();
  ffmpegRef = ffmpeg;

  // Clean virtual filesystem before export begins to purge any orphaned files from crashed sessions
  await cleanFFmpegVirtualFs(ffmpeg);

  // Attach progress listener and track reference so it is guaranteed detached in finally
  progressHandler = () => {};
  ffmpeg.on('progress', progressHandler);

  if (abortSignal?.aborted) {
    throw new Error('Export cancelled by user');
  }

  // 3. Setup Offscreen WebGL Canvas & Context
  onProgress({
    phase: 'initializing',
    percent: 5,
    currentFrame: 0,
    totalFrames,
    fps: 0,
    elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
    remainingSeconds: Math.round(totalFrames / 15),
    stageMessage: `Preparing WebGL 3D LUT pipeline (${exportWidth}×${exportHeight} @ ${fps} fps)...`
  });

  const is10Bit = config.bitDepth === '10bit';
  const vcodec = 'libx264';
  const pixFmt = is10Bit ? 'yuv420p10le' : 'yuv420p';
  const codecDisplayName = is10Bit ? 'H.264 10-bit' : 'H.264 8-bit';

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  // Request WebGL2 context for high-precision float rendering
  const gl2 = canvas.getContext('webgl2', {
    preserveDrawingBuffer: true,
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance'
  });
  const isWebGL2 = !!gl2;
  const gl = (gl2 || canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    alpha: false,
    antialias: false
  })) as (WebGL2RenderingContext | WebGLRenderingContext);

  if (!gl) {
    throw new Error('WebGL is not supported for video frame rendering.');
  }

  const extFloatLinear = isWebGL2 ? gl.getExtension('OES_texture_float_linear') : null;
  const extColorBufferFloat = isWebGL2 ? gl.getExtension('EXT_color_buffer_float') : null;

  // Compile shaders
  const compileShader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const err = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Shader compile error: ${err}`);
    }
    return s;
  };

  const program = gl.createProgram()!;
  const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }

  gl.useProgram(program);

  // Quad geometry
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Setup video texture
  const videoTex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, videoTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program, 'u_video'), 0);

  // Setup 3D LUT Texture (High-Precision 32-bit Float Texture Atlas)
  const lutTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE1);
  upload3dLutTexture(gl, lutTex, lutData, lutEnabled);
  gl.uniform1i(gl.getUniformLocation(program, 'u_lut'), 1);

  // Authoritatively bind color grading pipeline uniforms (LUT + Primary adjustments + Interpolation)
  applyColorPipelineUniforms(gl, program, adjustments, lutData, lutEnabled, config.interpolationMode || 'tetrahedral');

  gl.viewport(0, 0, exportWidth, exportHeight);

  // Rolling slice chunking: encodes frames in 30-frame slices to keep memory tightly bounded
  const CHUNK_SIZE = 30;
  const chunkCount = Math.ceil(totalFrames / CHUNK_SIZE);
  const frameFileExt = 'jpg';
  const chunkMp4Files: string[] = [];
  const renderStartTime = Date.now();
  let lastPreviewThumb = '';

  const initialVideoTime = videoElement.currentTime;
  const initialPaused = videoElement.paused;
  if (!initialPaused) {
    videoElement.pause();
  }

  // 4. Resolve source media blob to enable sequential decode without seeking
  let sourceBlob: Blob | File | null = sourceFile || null;
  if (!sourceBlob && videoElement.src) {
    try {
      const resp = await fetch(videoElement.src);
      sourceBlob = await resp.blob();
    } catch {
      sourceBlob = null;
    }
  }

  let videoSampleSink: VideoSampleSink | null = null;
  if (sourceBlob) {
    try {
      const mediaInput = new Input({
        source: new BlobSource(sourceBlob),
        formats: ALL_FORMATS
      });
      const primaryVideo = await mediaInput.getPrimaryVideoTrack();
      if (primaryVideo) {
        const canDecode = await primaryVideo.canDecode().catch(() => false);
        if (canDecode) {
          videoSampleSink = new VideoSampleSink(primaryVideo);
        } else {
          try {
            videoSampleSink = new VideoSampleSink(primaryVideo);
          } catch {
            videoSampleSink = null;
          }
        }
      }
    } catch (e) {
      console.warn('CPU export VideoSampleSink setup error:', e);
      videoSampleSink = null;
    }
  }

  try {
    const jpegQuality = is10Bit ? 0.98 : 0.95;

    const captureCurrentFrame = async (globalFrame: number, chunkIdx: number, frameInChunk: number): Promise<string> => {
      // 1. Render graded frame directly to canvas drawing buffer (matching preview output identically)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, exportWidth, exportHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 2. Capture high-fidelity frame buffer directly from GPU canvas
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', jpegQuality);
      });
      if (!blob) throw new Error(`Failed to capture video frame #${globalFrame}`);

      // 3. Write JPEG frame to FFmpeg virtual filesystem for libx264 encoding
      const frameBuffer = await blob.arrayBuffer();
      const frameFileName = `chk_${chunkIdx}_${String(frameInChunk).padStart(4, '0')}.jpg`;
      await ffmpeg.writeFile(frameFileName, new Uint8Array(frameBuffer));
      return frameFileName;
    };

    const updateThumbnailPreview = (globalFrame: number) => {
      if (globalFrame % 8 === 0 || globalFrame >= totalFrames - 1) {
        lastPreviewThumb = canvas.toDataURL('image/jpeg', 0.35);
      }
    };

    if (videoSampleSink) {
      // Prioritized Sequential Decode Architecture: zero HTML video seeking!
      let globalFrame = 0;
      let chunkIdx = 0;
      let currentChunkFrames: string[] = [];

      for await (const sample of videoSampleSink.samples(startTime, endTime)) {
        if (abortSignal?.aborted) {
          throw new Error('Export cancelled by user');
        }

        const canvasImageSource = sample.toCanvasImageSource();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasImageSource);

        const frameFileName = await captureCurrentFrame(globalFrame, chunkIdx, currentChunkFrames.length);
        currentChunkFrames.push(frameFileName);
        createdTempFiles.add(frameFileName);

        // Release decoded sample immediately
        sample.close();

        globalFrame++;
        updateThumbnailPreview(globalFrame);

        const elapsed = (Date.now() - renderStartTime) / 1000;
        const currentFps = globalFrame / Math.max(0.1, elapsed);
        const remainingFrames = Math.max(0, totalFrames - globalFrame);
        const estRemaining = Math.max(1, Math.round(remainingFrames / Math.max(1, currentFps)));
        const renderPercent = Math.min(85, Math.round((globalFrame / Math.max(1, totalFrames)) * 85));

        onProgress({
          phase: 'rendering',
          percent: renderPercent,
          currentFrame: globalFrame,
          totalFrames,
          fps: Math.round(currentFps * 10) / 10,
          elapsedSeconds: Math.round(elapsed),
          remainingSeconds: estRemaining,
          stageMessage: `Sequential decode (${globalFrame}/${totalFrames} · slice ${chunkIdx + 1} · ${is10Bit ? '10-bit H.264' : '8-bit'})...`,
          previewThumbnail: lastPreviewThumb,
          engine: 'cpu'
        });

        if (currentChunkFrames.length >= CHUNK_SIZE) {
          const chunkMp4Name = `slice_${String(chunkIdx).padStart(4, '0')}.mp4`;
          const chunkArgs = [
            '-framerate', String(fps),
            '-i', `chk_${chunkIdx}_%04d.${frameFileExt}`,
            '-c:v', vcodec,
            '-preset', 'ultrafast',
            '-crf', String(config.crf),
            '-pix_fmt', pixFmt,
            chunkMp4Name
          ];
          const chunkExecCode = await ffmpeg.exec(chunkArgs);
          if (chunkExecCode !== 0) {
            throw new Error(`Encoding chunk ${chunkIdx} exited with code ${chunkExecCode}`);
          }
          chunkMp4Files.push(chunkMp4Name);
          createdTempFiles.add(chunkMp4Name);

          for (const frameName of currentChunkFrames) {
            await ffmpeg.deleteFile(frameName).catch(() => {});
            createdTempFiles.delete(frameName);
          }
          currentChunkFrames = [];
          chunkIdx++;
        }
      }

      // Encode trailing partial chunk if any frames remain
      if (currentChunkFrames.length > 0) {
        const chunkMp4Name = `slice_${String(chunkIdx).padStart(4, '0')}.mp4`;
        const chunkArgs = [
          '-framerate', String(fps),
          '-i', `chk_${chunkIdx}_%04d.${frameFileExt}`,
          '-c:v', vcodec,
          '-preset', 'ultrafast',
          '-crf', String(config.crf),
          '-pix_fmt', pixFmt,
          chunkMp4Name
        ];
        const chunkExecCode = await ffmpeg.exec(chunkArgs);
        if (chunkExecCode !== 0) {
          throw new Error(`Encoding final chunk ${chunkIdx} exited with code ${chunkExecCode}`);
        }
        chunkMp4Files.push(chunkMp4Name);
        createdTempFiles.add(chunkMp4Name);

        for (const frameName of currentChunkFrames) {
          await ffmpeg.deleteFile(frameName).catch(() => {});
          createdTempFiles.delete(frameName);
        }
      }
    } else {
      // Monotonic step fallback only if VideoSampleSink is unavailable
      for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
        if (abortSignal?.aborted) {
          throw new Error('Export cancelled by user');
        }

        const chunkStartFrame = chunkIdx * CHUNK_SIZE;
        const chunkEndFrame = Math.min(totalFrames, (chunkIdx + 1) * CHUNK_SIZE);
        const chunkFrameCount = chunkEndFrame - chunkStartFrame;
        const currentChunkFrames: string[] = [];

        for (let f = 0; f < chunkFrameCount; f++) {
          if (abortSignal?.aborted) {
            throw new Error('Export cancelled by user');
          }

          const globalFrame = chunkStartFrame + f;
          const frameTargetTime = startTime + (globalFrame / fps);

          await new Promise<void>((resolve) => {
            let isDone = false;
            const finish = () => {
              if (!isDone) {
                isDone = true;
                videoElement.removeEventListener('seeked', onSeeked);
                resolve();
              }
            };

            const onSeeked = () => {
              if ('requestVideoFrameCallback' in videoElement) {
                (videoElement as any).requestVideoFrameCallback(() => finish());
              } else {
                requestAnimationFrame(() => finish());
              }
            };

            videoElement.addEventListener('seeked', onSeeked, { once: true });
            videoElement.currentTime = frameTargetTime;
            setTimeout(finish, 2500);
          });

          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, videoTex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);

          const frameFileName = await captureCurrentFrame(globalFrame, chunkIdx, currentChunkFrames.length);
          currentChunkFrames.push(frameFileName);
          createdTempFiles.add(frameFileName);

          updateThumbnailPreview(globalFrame);

          const elapsed = (Date.now() - renderStartTime) / 1000;
          const currentFps = (globalFrame + 1) / Math.max(0.1, elapsed);
          const remainingFrames = totalFrames - (globalFrame + 1);
          const estRemaining = Math.max(1, Math.round(remainingFrames / Math.max(1, currentFps)));
          const renderPercent = Math.min(85, Math.round(((globalFrame + 1) / totalFrames) * 85));

          onProgress({
            phase: 'rendering',
            percent: renderPercent,
            currentFrame: globalFrame + 1,
            totalFrames,
            fps: Math.round(currentFps * 10) / 10,
            elapsedSeconds: Math.round(elapsed),
            remainingSeconds: estRemaining,
            stageMessage: `Rendering frames (${globalFrame + 1}/${totalFrames} · slice ${chunkIdx + 1}/${chunkCount} · ${is10Bit ? '10-bit H.264' : '8-bit'})...`,
            previewThumbnail: lastPreviewThumb,
            engine: 'cpu'
          });
        }

        const chunkMp4Name = `slice_${String(chunkIdx).padStart(4, '0')}.mp4`;
        const chunkArgs = [
          '-framerate', String(fps),
          '-i', `chk_${chunkIdx}_%04d.${frameFileExt}`,
          '-c:v', vcodec,
          '-preset', 'ultrafast',
          '-crf', String(config.crf),
          '-pix_fmt', pixFmt,
          chunkMp4Name
        ];

        const chunkExecCode = await ffmpeg.exec(chunkArgs);
        if (chunkExecCode !== 0) {
          throw new Error(`Encoding chunk ${chunkIdx} exited with code ${chunkExecCode}`);
        }
        chunkMp4Files.push(chunkMp4Name);
        createdTempFiles.add(chunkMp4Name);

        for (const frameName of currentChunkFrames) {
          await ffmpeg.deleteFile(frameName).catch(() => {});
          createdTempFiles.delete(frameName);
        }
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('Export cancelled by user');
    }

    // 5. Check & Extract Source Audio
    let hasAudioTrack = false;
    if (config.includeAudio && sourceFile) {
      try {
        onProgress({
          phase: 'encoding',
          percent: 88,
          currentFrame: totalFrames,
          totalFrames,
          fps,
          elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
          remainingSeconds: 5,
          stageMessage: 'Extracting original audio track...',
          previewThumbnail: lastPreviewThumb,
          engine: 'cpu'
        });

        await ffmpeg.writeFile('source_media.mp4', await fetchFile(sourceFile));
        createdTempFiles.add('source_media.mp4');

        const audioArgs = [
          '-ss', String(startTime),
          '-t', String(rangeDuration),
          '-i', 'source_media.mp4',
          '-vn',
          '-c:a', 'aac',
          '-b:a', '256k',
          'audio_track.aac'
        ];
        const res = await ffmpeg.exec(audioArgs);
        if (res === 0) {
          createdTempFiles.add('audio_track.aac');
          hasAudioTrack = true;
        }
      } catch (audioErr) {
        console.warn('Audio extraction skipped or not available in source file:', audioErr);
        hasAudioTrack = false;
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('Export cancelled by user');
    }

    // 6. Concatenate Slices into Master Container (Zero Re-encoding, Copy-Only Stream)
    const concatText = chunkMp4Files.map((fn) => `file '${fn}'`).join('\n');
    await ffmpeg.writeFile('concat_list.txt', new TextEncoder().encode(concatText));
    createdTempFiles.add('concat_list.txt');

    onProgress({
      phase: 'encoding',
      percent: 92,
      currentFrame: totalFrames,
      totalFrames,
      fps,
      elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
      remainingSeconds: 2,
      stageMessage: `Assembling master ${codecDisplayName} container...`,
      previewThumbnail: lastPreviewThumb,
      engine: 'cpu'
    });

    const finalArgs = [
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat_list.txt'
    ];

    if (hasAudioTrack) {
      finalArgs.push('-i', 'audio_track.aac');
    }

    finalArgs.push('-c', 'copy');

    if (hasAudioTrack) {
      finalArgs.push('-shortest');
    }

    finalArgs.push('-movflags', '+faststart', 'output.mp4');
    createdTempFiles.add('output.mp4');

    const concatExec = await ffmpeg.exec(finalArgs);
    if (concatExec !== 0) {
      throw new Error(`Concatenating video slices failed with exit code ${concatExec}`);
    }

    // 7. Read Output MP4 from FFmpeg Filesystem
    onProgress({
      phase: 'encoding',
      percent: 98,
      currentFrame: totalFrames,
      totalFrames,
      fps,
      elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
      remainingSeconds: 1,
      stageMessage: 'Packaging master MP4 container...',
      previewThumbnail: lastPreviewThumb,
      engine: 'cpu'
    });

    const outputData = await ffmpeg.readFile('output.mp4');
    const outputUint8 = typeof outputData === 'string'
      ? new TextEncoder().encode(outputData)
      : outputData;
    const outputBlob = new Blob([outputUint8.slice().buffer as ArrayBuffer], { type: 'video/mp4' });
    const outputUrl = URL.createObjectURL(outputBlob);

    // Formulate a professional file name
    const cleanBase = sourceFileName.replace(/\.[^/.]+$/, '');
    const lutTag = lutData && lutEnabled ? `_${lutData.name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const bitDepthTag = `_${config.bitDepth || '8bit'}`;
    const outputFileName = `${cleanBase}_graded${lutTag}_${config.codec}${bitDepthTag}_crf${config.crf}.mp4`;

    const totalElapsed = Math.round((Date.now() - startTimeMs) / 1000);

    onProgress({
      phase: 'completed',
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      fps,
      elapsedSeconds: totalElapsed,
      remainingSeconds: 0,
      stageMessage: `Export complete! Saved in ${totalElapsed}s (${(outputBlob.size / (1024 * 1024)).toFixed(1)} MB)`,
      previewThumbnail: lastPreviewThumb,
      outputBlob,
      outputUrl,
      outputFileName
    });

    return { blob: outputBlob, url: outputUrl, fileName: outputFileName };
  } finally {
    if (directCallLock) {
      isExportRunning = false;
    }

    // 1. Detach event listeners to prevent listener accumulation
    if (ffmpegRef && progressHandler) {
      try {
        ffmpegRef.off('progress', progressHandler);
      } catch (_) {}
    }

    // 2. Guarantee full virtual filesystem cleanup on completion, error, or user cancellation
    if (ffmpegRef) {
      try {
        await cleanFFmpegVirtualFs(ffmpegRef, createdTempFiles);
      } catch (_) {}
    }

    // 3. Restore video state
    videoElement.currentTime = initialVideoTime;
    if (!initialPaused) {
      videoElement.play().catch(() => {});
    }

    // 4. Clean up WebGL resources
    try {
      if (videoTex) gl.deleteTexture(videoTex);
      if (lutTex) gl.deleteTexture(lutTex);
      if (posBuf) gl.deleteBuffer(posBuf);
      if (program) gl.deleteProgram(program);
    } catch (_) {}
  }
}
