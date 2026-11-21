/**
 * Sandboxed preload. Exposes a tiny, read-only description of the desktop host.
 * No Node APIs, file system access or IPC channels are handed to the renderer.
 */
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('zrDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  versions: Object.freeze({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  }),
}));
