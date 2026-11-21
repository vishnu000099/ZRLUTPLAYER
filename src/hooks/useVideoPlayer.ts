import { useState, useRef, useEffect, useCallback } from 'react';
import {
  CameraMetadata,
  PlaybackResolution,
  SplitMode,
  VideoMetadata
} from '../types';
import { WebGLPlayer } from '../utils/webglPlayer';
import { parseVideoCameraMetadata } from '../utils/videoMetadataParser';
import { detectSourceVideoFps } from '../utils/fpsDetector';

interface UseVideoPlayerOptions {
  onEnded?: () => void;
}

export function useVideoPlayer(options?: UseVideoPlayerOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<WebGLPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoUrlRef = useRef<string | null>(null);

  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMetadata | null>(null);
  const [cameraMeta, setCameraMeta] = useState<CameraMetadata | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(true);

  const [splitMode, setSplitMode] = useState<SplitMode>('off');
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [playbackRes, setPlaybackRes] = useState<PlaybackResolution>('original');

  const [gpuInfo, setGpuInfo] = useState<{ vendor: string; renderer: string }>({
    vendor: 'Detecting…',
    renderer: 'WebGL'
  });

  const onEndedRef = useRef<(() => void) | undefined>(options?.onEnded);
  const isLoopingRef = useRef<boolean>(isLooping);

  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  // Load a video File into video element
  const loadVideoFile = useCallback((file: File, autoPlay = true) => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
    }
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setVideoUrl(url);

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.src = url;
      video.load();
      if (autoPlay) {
        video.play().catch(() => {});
      }
    }

    setVideoMeta({
      name: file.name,
      width: 1920,
      height: 1080,
      duration: 0,
      fileSizeMB: Number((file.size / (1024 * 1024)).toFixed(1)),
      fps: 24
    });

    parseVideoCameraMetadata(file).then((detectedMeta) => {
      setCameraMeta(detectedMeta);
      setVideoMeta((prev) => (prev ? { ...prev, cameraMetadata: detectedMeta } : null));
    });

    detectSourceVideoFps(file).then((detectedFps) => {
      setVideoMeta((prev) => (prev ? { ...prev, fps: detectedFps } : null));
    });
  }, []);

  // Initialize hidden HTMLVideoElement & WebGL Player instance
  useEffect(() => {
    const video = document.createElement('video');
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.volume = volume;
    video.loop = false; // Looping handled via onEnded
    videoRef.current = video;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    const onEnded = () => {
      if (onEndedRef.current) {
        onEndedRef.current();
      } else if (isLoopingRef.current) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        setIsPlaying(false);
      }
    };

    const onTimeUpdate = () => {
      if (video) setCurrentTime(video.currentTime);
    };

    const onLoadedMetadata = () => {
      if (video) {
        setDuration(video.duration || 60);
        setVideoLoaded(true);
        video.play().catch(() => {});
      }
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    if (canvasRef.current) {
      const player = new WebGLPlayer(canvasRef.current);
      playerRef.current = player;
      player.setSplitMode(splitMode, splitPos);
      player.setResolution(playbackRes);
      setGpuInfo(player.getGpuInfo());
    }

    // Animation render loop
    let rafId: number;
    const renderLoop = () => {
      if (playerRef.current) {
        playerRef.current.render(videoRef.current);
      }
      rafId = requestAnimationFrame(renderLoop);
    };
    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (playerRef.current) playerRef.current.destroy();
    };
  }, []);

  // Sync split mode & resolution to WebGL player
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setSplitMode(splitMode, splitPos);
    }
  }, [splitMode, splitPos]);

  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setResolution(playbackRes);
    }
  }, [playbackRes]);

  // Transport Handlers
  const handlePlayToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  const handleStop = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video && Number.isFinite(time)) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleStepFrame = useCallback((direction: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    const frameDuration = 1 / (videoMeta?.fps || 24);
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + direction * frameDuration));
  }, [videoMeta?.fps]);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    setIsMuted(false);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = false;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = newSpeed;
    }
  }, []);

  const handleToggleLoop = useCallback(() => {
    setIsLooping((prev) => !prev);
  }, []);

  const handleSnapshot = useCallback(() => {
    if (!playerRef.current) return;
    const dataUrl = playerRef.current.captureSnapshotPng();
    if (!dataUrl) return;

    const a = document.createElement('a');
    a.href = dataUrl;
    const timeStr = Math.round(currentTime).toString().padStart(4, '0');
    a.download = `Nikon_ZR_Snapshot_${timeStr}s_${Date.now()}.png`;
    a.click();
  }, [currentTime]);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      canvasRef.current?.parentElement?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  return {
    canvasRef,
    playerRef,
    videoRef,
    videoLoaded,
    videoUrl,
    videoMeta,
    cameraMeta,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    speed,
    isLooping,
    splitMode,
    setSplitMode,
    splitPos,
    setSplitPos,
    playbackRes,
    setPlaybackRes,
    gpuInfo,
    loadVideoFile,
    handlePlayToggle,
    handleStop,
    handleSeek,
    handleStepFrame,
    handleVolumeChange,
    handleToggleMute,
    handleSpeedChange,
    handleToggleLoop,
    handleSnapshot,
    handleToggleFullscreen
  };
}
