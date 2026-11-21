import {
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  Input,
  BlobSource,
  ALL_FORMATS,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  Quality,
  VideoSampleSink
} from 'mediabunny';
import { VideoExportOptions, calculateExportDimensions } from './videoExporter';
import { detectSourceVideoFps } from './fpsDetector';
import {
  SHARED_VERTEX_SHADER,
  EXPORT_FRAGMENT_SHADER,
  upload3dLutTexture,
  applyColorPipelineUniforms
} from '../color/colorPipeline';

const VERTEX_SHADER = SHARED_VERTEX_SHADER;
const FRAGMENT_SHADER = EXPORT_FRAGMENT_SHADER;

/**
 * Calculates a target hardware video bitrate in bits per second matching the requested CRF quality
 */
export function calculateBitrateForCrf(crf: number, width: number, height: number, fps: number): number {
  // CRF 12 (highest quality / ~45 Mbps) to CRF 28 (compressed proxy / ~5 Mbps) at 1080p 30fps
  const clampedCrf = Math.max(12, Math.min(28, crf));
  const t = (28 - clampedCrf) / 16; // 0 to 1
  const baseBitrate1080p = 5_000_000 + Math.pow(t, 1.8) * 40_000_000;

  const resolutionScale = (width * height) / (1920 * 1080);
  const fpsScale = Math.max(15, fps) / 30;

  return Math.round(Math.max(1_500_000, baseBitrate1080p * resolutionScale * fpsScale));
}

/**
 * Hardware-accelerated Video Export Engine
 * Encodes H.264 via WebCodecs API with hardware acceleration preferred, packaged into MP4 using Mediabunny.
 */
export async function exportHardwareGradedVideo(
  options: VideoExportOptions
): Promise<{ blob: Blob; url: string; fileName: string }> {
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

  if (abortSignal?.aborted) {
    throw new Error('Export cancelled by user');
  }

  const startTimeMs = Date.now();

  // 1. Output Dimensions and Timing
  const originalWidth = videoElement.videoWidth || 1920;
  const originalHeight = videoElement.videoHeight || 1080;

  const { width: exportWidth, height: exportHeight } = calculateExportDimensions(
    originalWidth,
    originalHeight,
    config.preserveResolution,
    config.targetResolution
  );

  // Frame Rate Calculation:
  // If preserveFps is true, detect the true source video framerate (e.g., 23.976, 24, 25, 29.97, 50, 59.94, 60).
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

  const isCpuMode = config.encoderEngine === 'cpu';
  const engineLabel = isCpuMode ? 'Streaming CPU' : 'Hardware GPU';

  onProgress({
    phase: 'initializing',
    percent: 1,
    currentFrame: 0,
    totalFrames,
    fps: 0,
    elapsedSeconds: 0,
    remainingSeconds: Math.round(totalFrames / (isCpuMode ? 28 : 50)),
    stageMessage: `Initializing WebCodecs ${isCpuMode ? 'CPU software' : 'hardware'} encoder (streaming O(1) memory pipeline)...`,
    engine: config.encoderEngine
  });

  // 2. Setup WebGL Canvas and 3D LUT Shaders
  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  const is10Bit = config.bitDepth === '10bit';

  // Request WebGL2 context first for high bit-depth color pipelines
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
    antialias: false,
    powerPreference: 'high-performance'
  })) as (WebGL2RenderingContext | WebGLRenderingContext);

  if (!gl) {
    throw new Error('WebGL is not supported on this browser/GPU for video frame processing.');
  }

  if (isWebGL2) {
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('EXT_color_buffer_float');
  }

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

  // 3. Configure Mediabunny Output with WebCodecs hardware encoding
  const targetBitrate = calculateBitrateForCrf(config.crf, exportWidth, exportHeight, fps);

  // Determine fullCodecString with capability validation
  let fullCodecString: string | undefined = undefined;
  if (is10Bit && typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
    const candidateProfiles = ['avc1.6e0028', 'avc1.6e002a', 'avc1.6e0033'];
    for (const c of candidateProfiles) {
      try {
        const support10 = await VideoEncoder.isConfigSupported({
          codec: c,
          width: exportWidth,
          height: exportHeight,
          bitrate: targetBitrate,
          framerate: fps,
          hardwareAcceleration: isCpuMode ? 'prefer-software' : 'prefer-hardware'
        });
        if (support10.supported) {
          fullCodecString = c;
          break;
        }
      } catch {
        // try next profile
      }
    }

    if (!fullCodecString) {
      // If hardware VideoEncoder doesn't support 10-bit High 10 profile on this GPU/OS,
      // fail fast so exportGradedVideo routes to the high-precision 16-bit CPU engine!
      throw new Error('Hardware encoder does not support native 10-bit H.264 (High 10 Profile). Falling back to 16-bit precision CPU encoder.');
    }
  }

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target
  });

  // Mediabunny CanvasSource with WebCodecs hardware or software streaming pipeline
  // NOTE: Mediabunny forbids providing both top-level config.bitrate and config.quality simultaneously.
  // The target bitrate and VBR mode are configured inside the Quality instance.
  const acceleration: 'prefer-hardware' | 'prefer-software' = isCpuMode ? 'prefer-software' : 'prefer-hardware';
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    hardwareAcceleration: acceleration,
    ...(fullCodecString ? { fullCodecString } : {}),
    keyFrameInterval: 2,
    quality: new Quality({
      bitrate: targetBitrate,
      bitrateMode: 'variable'
    })
  });

  output.addVideoTrack(videoSource);

  // 4. Resolve source media blob (from sourceFile or videoElement.src) to guarantee sequential decode
  let sourceBlob: Blob | File | null = sourceFile || null;
  if (!sourceBlob && videoElement.src) {
    try {
      const resp = await fetch(videoElement.src);
      sourceBlob = await resp.blob();
    } catch (fetchErr) {
      console.warn('Could not retrieve media blob from videoElement.src:', fetchErr);
    }
  }

  // Optional: Extract & Remux Audio with Mediabunny if enabled & available
  let audioInputTrack: any = null;
  let audioSource: EncodedAudioPacketSource | null = null;
  let audioSink: EncodedPacketSink | null = null;
  let videoSampleSink: VideoSampleSink | null = null;

  if (sourceBlob) {
    try {
      const mediaInput = new Input({
        source: new BlobSource(sourceBlob),
        formats: ALL_FORMATS
      });

      if (config.includeAudio) {
        try {
          const primaryAudio = await mediaInput.getPrimaryAudioTrack();
          if (primaryAudio) {
            const codec = await primaryAudio.getCodec();
            if (codec && (codec === 'aac' || codec === 'mp3' || codec === 'opus')) {
              audioSource = new EncodedAudioPacketSource(codec);
              output.addAudioTrack(audioSource);
              audioInputTrack = primaryAudio;
              audioSink = new EncodedPacketSink(primaryAudio);
            }
          }
        } catch (audioErr) {
          console.warn('Hardware audio remuxing skipped:', audioErr);
          audioSource = null;
        }
      }

      // Initialize direct WebCodecs VideoSampleSink for seamless sequential frame decoding (zero seeking)
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
    } catch (inputErr) {
      console.warn('Mediabunny input initialization failed:', inputErr);
    }
  }

  // 5. Start Mediabunny MP4 muxing pipeline
  await output.start();

  const initialVideoTime = videoElement.currentTime;
  const initialPaused = videoElement.paused;
  if (!initialPaused) {
    videoElement.pause();
  }

  const renderStartTime = Date.now();
  let lastPreviewThumb = '';

  try {
    // 6. Hardware Encoding Loop
    if (videoSampleSink) {
      let frameIndex = 0;
      for await (const sample of videoSampleSink.samples(startTime, endTime)) {
        if (abortSignal?.aborted) {
          await output.cancel().catch(() => {});
          throw new Error('Export cancelled by user');
        }

        // Draw decoded frame into WebGL
        const canvasImageSource = sample.toCanvasImageSource();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasImageSource);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.finish();

        // Feed canvas into WebCodecs hardware encoder with accurate PTS and duration
        const timestampInSeconds = Math.max(0, sample.timestamp - startTime);
        const durationInSeconds = sample.duration > 0 ? sample.duration : (1 / fps);
        await videoSource.add(timestampInSeconds, durationInSeconds);

        sample.close();

        frameIndex++;
        if (frameIndex % 8 === 0 || frameIndex >= totalFrames) {
          lastPreviewThumb = canvas.toDataURL('image/jpeg', 0.35);
        }

        const elapsed = (Date.now() - renderStartTime) / 1000;
        const currentFps = frameIndex / Math.max(0.1, elapsed);
        const remainingFrames = Math.max(0, totalFrames - frameIndex);
        const estRemaining = Math.max(1, Math.round(remainingFrames / Math.max(1, currentFps)));
        const percent = Math.min(94, Math.round((frameIndex / Math.max(1, totalFrames)) * 94));

        onProgress({
          phase: 'encoding',
          percent,
          currentFrame: frameIndex,
          totalFrames,
          fps: Math.round(currentFps * 10) / 10,
          elapsedSeconds: Math.round(elapsed),
          remainingSeconds: estRemaining,
          stageMessage: `${engineLabel} Encoding (${frameIndex}/${totalFrames}) · ${(targetBitrate / 1_000_000).toFixed(1)} Mbps · ${Math.round(currentFps)} fps`,
          previewThumbnail: lastPreviewThumb,
          engine: config.encoderEngine
        });
      }
    } else {
      // Frame-accurate HTMLVideoElement seeking fallback
      for (let frame = 0; frame < totalFrames; frame++) {
        if (abortSignal?.aborted) {
          await output.cancel().catch(() => {});
          throw new Error('Export cancelled by user');
        }

        const frameTargetTime = startTime + frame / fps;

        // Frame-accurate seek: Wait for seeked AND requestVideoFrameCallback/requestAnimationFrame
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
          // 2500ms safety timeout for high-bitrate GOPs (NEVER 180ms which cuts off decoding)
          setTimeout(finish, 2500);
        });

        // Update WebGL texture and render graded frame
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.finish();

        const timestampInSeconds = frame / fps;
        const durationInSeconds = 1 / fps;
        await videoSource.add(timestampInSeconds, durationInSeconds);

        if (frame % 8 === 0 || frame === totalFrames - 1) {
          lastPreviewThumb = canvas.toDataURL('image/jpeg', 0.35);
        }

        const elapsed = (Date.now() - renderStartTime) / 1000;
        const currentFps = (frame + 1) / Math.max(0.1, elapsed);
        const remainingFrames = totalFrames - (frame + 1);
        const estRemaining = Math.max(1, Math.round(remainingFrames / Math.max(1, currentFps)));
        const percent = Math.min(94, Math.round(((frame + 1) / totalFrames) * 94));

        onProgress({
          phase: 'encoding',
          percent,
          currentFrame: frame + 1,
          totalFrames,
          fps: Math.round(currentFps * 10) / 10,
          elapsedSeconds: Math.round(elapsed),
          remainingSeconds: estRemaining,
          stageMessage: `${engineLabel} Encoding (${frame + 1}/${totalFrames}) · ${(targetBitrate / 1_000_000).toFixed(1)} Mbps · ${Math.round(currentFps)} fps`,
          previewThumbnail: lastPreviewThumb,
          engine: config.encoderEngine
        });
      }
    }

    // 6. Feed audio packets if audio track was added
    if (audioSource && audioSink && audioInputTrack) {
      try {
        onProgress({
          phase: 'encoding',
          percent: 95,
          currentFrame: totalFrames,
          totalFrames,
          fps,
          elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
          remainingSeconds: 2,
          stageMessage: 'Packaging audio stream into MP4...',
          previewThumbnail: lastPreviewThumb,
          engine: 'hardware'
        });

        for await (const packet of audioSink.packets()) {
          if (packet.timestamp >= startTime && packet.timestamp <= endTime) {
            await audioSource.add(packet);
          }
          if (packet.timestamp > endTime) break;
        }
      } catch (err) {
        console.warn('Audio packets pass-through ended or skipped:', err);
      }
    }

    // 7. Finalize Mediabunny MP4 Container
    onProgress({
      phase: 'encoding',
      percent: 97,
      currentFrame: totalFrames,
      totalFrames,
      fps,
      elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
      remainingSeconds: 1,
      stageMessage: 'Finalizing fast-start MP4 container with Mediabunny...',
      previewThumbnail: lastPreviewThumb,
      engine: 'hardware'
    });

    await output.finalize();

    const outputBuffer = target.buffer;
    if (!outputBuffer) {
      throw new Error('Hardware encoder output buffer is empty.');
    }

    const outputBlob = new Blob([outputBuffer], { type: 'video/mp4' });
    const outputUrl = URL.createObjectURL(outputBlob);

    // Formulate descriptive file name
    const cleanBase = sourceFileName.replace(/\.[^/.]+$/, '');
    const lutTag = lutData && lutEnabled ? `_${lutData.name.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const bitDepthTag = `_${config.bitDepth || '8bit'}`;
    const outputFileName = `${cleanBase}_graded${lutTag}_h264_hw${bitDepthTag}_crf${config.crf}.mp4`;

    const totalElapsed = Math.round((Date.now() - startTimeMs) / 1000);

    onProgress({
      phase: 'completed',
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      fps,
      elapsedSeconds: totalElapsed,
      remainingSeconds: 0,
      stageMessage: `Hardware export complete! Saved in ${totalElapsed}s (${(outputBlob.size / (1024 * 1024)).toFixed(1)} MB)`,
      previewThumbnail: lastPreviewThumb,
      outputBlob,
      outputUrl,
      outputFileName,
      engine: 'hardware'
    });

    return { blob: outputBlob, url: outputUrl, fileName: outputFileName };
  } finally {
    videoElement.currentTime = initialVideoTime;
    if (!initialPaused) {
      videoElement.play().catch(() => {});
    }

    try {
      if (videoTex) gl.deleteTexture(videoTex);
      if (lutTex) gl.deleteTexture(lutTex);
      if (posBuf) gl.deleteBuffer(posBuf);
      if (program) gl.deleteProgram(program);
    } catch (_) {}
  }
}
