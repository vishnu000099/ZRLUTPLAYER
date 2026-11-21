import { canEncodeVideo } from 'mediabunny';
import { EncoderCapabilities } from '../types';

let cachedCapabilities: EncoderCapabilities | null = null;

/**
 * Detects GPU renderer information via WebGL debug extensions
 */
export function getGpuInfo(): { vendor?: string; renderer?: string } {
  if (typeof document === 'undefined') return {};
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return {};

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return {};

    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    return {
      vendor: typeof vendor === 'string' ? vendor : undefined,
      renderer: typeof renderer === 'string' ? renderer : undefined
    };
  } catch {
    return {};
  }
}

/**
 * Detects browser hardware encoding capabilities (WebCodecs API & Mediabunny)
 */
export async function detectEncoderCapabilities(): Promise<EncoderCapabilities> {
  if (cachedCapabilities) {
    return cachedCapabilities;
  }

  const gpu = getGpuInfo();
  const gpuLabel = gpu.renderer || gpu.vendor || 'System GPU';

  // Check WebCodecs availability
  const hasWebCodecs = typeof window !== 'undefined' && typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder !== 'undefined';

  if (!hasWebCodecs) {
    cachedCapabilities = {
      webCodecsSupported: false,
      hardwareAccelerated: false,
      h264Supported: false,
      details: 'WebCodecs API not available in this browser. Software encoder will be used.',
      gpuName: gpuLabel,
      gpuRenderer: gpu.renderer,
      recommendedEngine: 'cpu'
    };
    return cachedCapabilities;
  }

  let hardwareAccelerated = false;
  let h264Supported = false;
  let h264_10bitSupported = false;

  // 1. Test WebCodecs native isConfigSupported with prefer-hardware
  try {
    if (typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
      // Test standard H.264 8-bit High Profile (avc1.640028)
      const support8bit = await VideoEncoder.isConfigSupported({
        codec: 'avc1.640028',
        width: 1920,
        height: 1080,
        bitrate: 10_000_000,
        framerate: 30,
        hardwareAcceleration: 'prefer-hardware'
      });

      if (support8bit.supported) {
        h264Supported = true;
        // Check if hardware acceleration is preferred/supported
        hardwareAccelerated = support8bit.config?.hardwareAcceleration !== 'prefer-software';
      } else {
        // Fallback test for Main profile (avc1.4d002a)
        const supportMain = await VideoEncoder.isConfigSupported({
          codec: 'avc1.4d002a',
          width: 1920,
          height: 1080,
          bitrate: 8_000_000,
          framerate: 30,
          hardwareAcceleration: 'prefer-hardware'
        });
        if (supportMain.supported) {
          h264Supported = true;
          hardwareAccelerated = supportMain.config?.hardwareAcceleration !== 'prefer-software';
        }
      }

      // Test 10-bit H.264 (High 10 Profile: avc1.6e0028)
      try {
        const support10bit = await VideoEncoder.isConfigSupported({
          codec: 'avc1.6e0028',
          width: 1920,
          height: 1080,
          bitrate: 15_000_000,
          framerate: 30,
          hardwareAcceleration: 'prefer-hardware'
        });
        h264_10bitSupported = !!support10bit.supported;
      } catch {
        h264_10bitSupported = false;
      }
    }
  } catch (e) {
    console.warn('Native VideoEncoder capability check encountered an issue:', e);
  }

  // 2. Cross-verify with Mediabunny's canEncodeVideo
  try {
    const mbCanEncode = await canEncodeVideo('avc', {
      width: 1920,
      height: 1080,
      hardwareAcceleration: 'prefer-hardware'
    });
    if (mbCanEncode) {
      h264Supported = true;
      hardwareAccelerated = true;
    }
  } catch (e) {
    console.warn('Mediabunny canEncodeVideo check:', e);
  }

  let details = '';
  if (hardwareAccelerated) {
    details = `Hardware-accelerated H.264 detected via WebCodecs (${gpuLabel}). Packaged with Mediabunny MP4 muxer.`;
  } else if (h264Supported) {
    details = `WebCodecs H.264 supported (Software fallback). Mediabunny MP4 container active.`;
  } else {
    details = `WebCodecs H.264 not available on this platform. Please use CPU encoder.`;
  }

  cachedCapabilities = {
    webCodecsSupported: hasWebCodecs,
    hardwareAccelerated,
    h264Supported,
    h264_10bitSupported,
    details,
    gpuName: gpuLabel,
    gpuRenderer: gpu.renderer,
    recommendedEngine: (hardwareAccelerated || h264Supported) ? 'hardware' : 'cpu'
  };

  return cachedCapabilities;
}
