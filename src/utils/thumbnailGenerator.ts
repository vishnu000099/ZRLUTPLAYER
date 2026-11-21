/**
 * Client-side video thumbnail and duration generator for local video files.
 * Uses offscreen video + canvas to capture frame thumbnails without uploading to any server.
 */

const thumbnailCache = new Map<string, { dataUrl: string; duration: number }>();

export interface ThumbnailResult {
  dataUrl: string;
  duration: number;
}

export async function generateVideoThumbnail(file: File): Promise<ThumbnailResult> {
  const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    let isDone = false;
    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    const finish = (result: ThumbnailResult) => {
      if (isDone) return;
      isDone = true;
      thumbnailCache.set(cacheKey, result);
      cleanup();
      resolve(result);
    };

    video.onloadedmetadata = () => {
      const dur = video.duration || 0;
      // Seek slightly into the video to avoid initial black frames
      const seekTarget = Math.min(1.0, Math.max(0.1, dur * 0.1));
      video.currentTime = seekTarget;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = 320;
        const aspect = (video.videoHeight || 9) / (video.videoWidth || 16);
        const height = Math.round(width * aspect) || 180;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          finish({ dataUrl, duration: video.duration || 0 });
          return;
        }
      } catch (err) {
        console.warn('Could not capture canvas frame:', err);
      }
      finish({ dataUrl: '', duration: video.duration || 0 });
    };

    video.onerror = () => {
      finish({ dataUrl: '', duration: 0 });
    };

    // Safety timeout in case browser cannot decode codec
    setTimeout(() => {
      if (!isDone) {
        finish({ dataUrl: '', duration: video.duration || 0 });
      }
    }, 4000);
  });
}
