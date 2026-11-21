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

## Export passcode = UI lock (not security)

The Export Video panel and the .CUBE export dialog keep their passcode screens, but the code
(`src/utils/uiLock.ts`) ships inside the app and anyone can read it. It is a convenience UI lock
only; it does not protect the application, its LUTs or exported files, and the UI says so.

## Building the macOS DMGs (GitHub Actions)

1. Push this project to a GitHub repository (the workflow is `.github/workflows/desktop-build.yml`).
2. On GitHub: **Actions → Desktop build → Run workflow** (or push a tag such as `v1.0.0`).
3. When the run finishes, download the **macos-dmg** artifact. It contains
   `Nikon-ZR-LUT-Player-1.0.0-mac-x64.dmg` (Intel) and `Nikon-ZR-LUT-Player-1.0.0-mac-arm64.dmg`
   (Apple Silicon). The **windows-installers** artifact contains the Windows builds.
4. Without secrets the DMGs are unsigned: on first launch, right-click the app → **Open**.
   For signed and notarized builds, add these repository secrets (Settings → Secrets and variables
   → Actions): `CSC_LINK` (base64 Developer ID Application .p12), `CSC_KEY_PASSWORD`, `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

On a Mac you can also build locally: `npm ci && npm run dist:mac`.

## Known limitations

- **Hardware (WebCodecs) encoding on Windows:** with Electron's GPU sandbox enabled, no hardware
  video encoders are exposed on the test machine. Tested on Electron 45.4.1 (latest stable,
  Chromium 156) and 46.0.0-alpha.12 (Chromium 160); Chrome 157 on the same machine does expose
  them. By decision the GPU sandbox stays on: the app automatically falls back to the FFmpeg CPU
  encoder, which works (with audio) but is roughly 10× slower at 4K. Re-test when upgrading Electron.
- **Unsigned builds:** Windows SmartScreen and macOS Gatekeeper will warn until the builds are
  code-signed (Windows certificate; Apple Developer ID + notarization).
- **Exports are assembled in memory** before saving (existing app design). Very long exports need
  RAM roughly equal to the output size.
- **Windows path length:** running from source in a very deep folder can exceed the 260-character
  limit for some bundled LUT names. Installed builds are unaffected (files live inside `app.asar`).
