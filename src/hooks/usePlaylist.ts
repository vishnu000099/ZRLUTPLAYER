import { useState, useRef, useEffect, useCallback } from 'react';
import { PlaylistItem } from '../types';
import { generateVideoThumbnail } from '../utils/thumbnailGenerator';

interface UsePlaylistOptions {
  onSelectClip: (item: PlaylistItem, index: number) => void;
  isLooping?: boolean;
}

export function usePlaylist(options: UsePlaylistOptions) {
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentClipIndex, setCurrentClipIndex] = useState<number>(0);
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);

  const playlistRef = useRef<PlaylistItem[]>([]);
  const currentClipIndexRef = useRef<number>(0);
  const autoPlayNextRef = useRef<boolean>(true);
  const isLoopingRef = useRef<boolean>(true);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentClipIndexRef.current = currentClipIndex;
  }, [currentClipIndex]);

  useEffect(() => {
    autoPlayNextRef.current = autoPlayNext;
  }, [autoPlayNext]);

  useEffect(() => {
    isLoopingRef.current = options.isLooping ?? true;
  }, [options.isLooping]);

  const handlePlayClipIndex = useCallback(
    (index: number) => {
      const pl = playlistRef.current;
      if (index < 0 || index >= pl.length) return;
      const item = pl[index];
      setCurrentClipIndex(index);
      currentClipIndexRef.current = index;
      options.onSelectClip(item, index);
    },
    [options]
  );

  const handleNextClip = useCallback(() => {
    const pl = playlistRef.current;
    const nextIdx = currentClipIndexRef.current + 1;
    if (nextIdx < pl.length) {
      handlePlayClipIndex(nextIdx);
    } else if (isLoopingRef.current && pl.length > 0) {
      handlePlayClipIndex(0);
    }
  }, [handlePlayClipIndex]);

  const handlePrevClip = useCallback(() => {
    const prevIdx = currentClipIndexRef.current - 1;
    if (prevIdx >= 0) {
      handlePlayClipIndex(prevIdx);
    }
  }, [handlePlayClipIndex]);

  const handleLoadFolder = useCallback(
    (rawFiles: FileList | File[]) => {
      const filesArray = Array.from(rawFiles);
      const videoFiles = filesArray.filter((file) => {
        const name = file.name.toLowerCase();
        return (
          name.endsWith('.mp4') ||
          name.endsWith('.mov') ||
          name.endsWith('.m4v') ||
          name.endsWith('.webm') ||
          name.endsWith('.mkv') ||
          file.type.startsWith('video/')
        );
      });

      if (videoFiles.length === 0) {
        alert('No compatible video files (.mp4, .mov, etc.) were found in this folder.');
        return;
      }

      videoFiles.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      );

      const items: PlaylistItem[] = videoFiles.map((file) => ({
        id: `${file.name}_${file.size}_${file.lastModified}`,
        name: file.name,
        file,
        sizeMB: Number((file.size / (1024 * 1024)).toFixed(1))
      }));

      setPlaylist(items);
      playlistRef.current = items;
      handlePlayClipIndex(0);

      items.forEach((item) => {
        generateVideoThumbnail(item.file).then((thumb) => {
          if (thumb.dataUrl) {
            setPlaylist((prev) =>
              prev.map((p) =>
                p.id === item.id ? { ...p, thumbnailUrl: thumb.dataUrl, duration: thumb.duration } : p
              )
            );
          }
        });
      });
    },
    [handlePlayClipIndex]
  );

  const handleAddFilesToPlaylist = useCallback((rawFiles: FileList | File[]) => {
    const filesArray = Array.from(rawFiles);
    const videoFiles = filesArray.filter((file) => {
      const name = file.name.toLowerCase();
      return (
        name.endsWith('.mp4') ||
        name.endsWith('.mov') ||
        name.endsWith('.m4v') ||
        name.endsWith('.webm') ||
        name.endsWith('.mkv') ||
        file.type.startsWith('video/')
      );
    });

    if (videoFiles.length === 0) return;

    const newItems: PlaylistItem[] = videoFiles.map((file) => ({
      id: `${file.name}_${file.size}_${file.lastModified}_${Date.now()}`,
      name: file.name,
      file,
      sizeMB: Number((file.size / (1024 * 1024)).toFixed(1))
    }));

    setPlaylist((prev) => [...prev, ...newItems]);

    newItems.forEach((item) => {
      generateVideoThumbnail(item.file).then((thumb) => {
        if (thumb.dataUrl) {
          setPlaylist((prev) =>
            prev.map((p) =>
              p.id === item.id ? { ...p, thumbnailUrl: thumb.dataUrl, duration: thumb.duration } : p
            )
          );
        }
      });
    });
  }, []);

  const handleClearPlaylist = useCallback(() => {
    setPlaylist([]);
    playlistRef.current = [];
  }, []);

  const handleLoadSingleVideo = useCallback(
    (file: File) => {
      const singleItem: PlaylistItem = {
        id: `${file.name}_${file.size}_${file.lastModified}`,
        name: file.name,
        file,
        sizeMB: Number((file.size / (1024 * 1024)).toFixed(1))
      };

      setPlaylist([singleItem]);
      playlistRef.current = [singleItem];
      setCurrentClipIndex(0);
      currentClipIndexRef.current = 0;

      generateVideoThumbnail(file).then((thumb) => {
        if (thumb.dataUrl) {
          setPlaylist((prev) =>
            prev.map((p) =>
              p.id === singleItem.id ? { ...p, thumbnailUrl: thumb.dataUrl, duration: thumb.duration } : p
            )
          );
        }
      });

      options.onSelectClip(singleItem, 0);
    },
    [options]
  );

  return {
    playlist,
    setPlaylist,
    currentClipIndex,
    setCurrentClipIndex,
    autoPlayNext,
    setAutoPlayNext,
    playlistRef,
    currentClipIndexRef,
    autoPlayNextRef,
    handlePlayClipIndex,
    handleNextClip,
    handlePrevClip,
    handleLoadFolder,
    handleAddFilesToPlaylist,
    handleClearPlaylist,
    handleLoadSingleVideo
  };
}
