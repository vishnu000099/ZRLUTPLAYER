# Nikon ZR LUT Player — Desktop (Electron)

The original React + Vite app is unchanged in structure; Electron wraps it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run electron:dev` | Vite dev server + Electron window (hot reload) |
| `npm run electron:start` | Production build, run in Electron |
| `npm run dist:win` | Windows NSIS installer + portable `.exe` → `release/` |
| `npm run dist:mac` | macOS DMGs for Intel (x64) and Apple Silicon (arm64). **Run on a Mac.** |
| `npm run test:electron` | End-to-end tests (needs `ffprobe` on PATH and clips in `test-output/media`) |
| `npm run dev` / `npm run build` | Original web workflow, still works |

## Architecture

- `electron/main.ts`: serves `dist/` from a private `app://zr/` origin with a strict CSP
  (no remote origins, `wasm-unsafe-eval` only for FFmpeg.wasm). Root-relative paths like
  `/luts/...` and `/ffmpeg/...` work unchanged and the app is fully offline.
- Renderer is locked down: `contextIsolation`, `sandbox`, no `nodeIntegration`, no navigation
  away from the app; `mailto:`/`https:` links open in the OS.
- `electron/preload.ts` exposes only a frozen `window.zrDesktop` description (no IPC, no fs).
- Browser downloads (video export, LUT export, PNG snapshots) become native **Save As** dialogs;
  the last folder is remembered in `%APPDATA%/Nikon ZR LUT Player/settings.json`.
- Native menu: File → Open Video (Ctrl/Cmd+O), Open Folder (Ctrl/Cmd+Shift+O), View, Window, Help.
- Fonts are bundled via `@fontsource`; the FFmpeg core is bundled (no CDN fallback).
- `public/assets/aistudio/` (78 MB of AI Studio assets) stays in the project but is excluded
  from installers (`electron-builder.yml`).

## Known limitations

- **Hardware (WebCodecs) encoding on Windows:** Electron 45's sandboxed GPU process reports no
  hardware encoders on the test machine (Chrome 157 on the same machine does). The app
  automatically falls back to the FFmpeg CPU encoder, which works (with audio) but is about 10×
  slower at 4K. Re-test with newer Electron releases.
- **Unsigned builds:** Windows SmartScreen and macOS Gatekeeper will warn until the builds are
  code-signed (Windows certificate; Apple Developer ID + notarization).
- **Exports are assembled in memory** before saving (existing app design). Very long exports need
  RAM roughly equal to the output size.
- **Windows path length:** running from source in a very deep folder can exceed the 260-character
  limit for some bundled LUT names. Installed builds are unaffected (files live inside `app.asar`).
