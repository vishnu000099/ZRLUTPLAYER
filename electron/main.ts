/**
 * Nikon ZR LUT Player — Electron main process.
 *
 * Responsibilities (the React renderer is unchanged and knows nothing about Electron):
 *  - Serve the built Vite app from a privileged `app://zr/` origin so root-relative
 *    URLs (/luts/..., /ffmpeg/...) keep working, fully offline, with a strict CSP.
 *  - Lock down the renderer: context isolation, sandbox, no Node integration,
 *    no navigation away from the app, external links opened in the OS.
 *  - Turn browser downloads (video export, LUT export, PNG snapshots) into native
 *    Save As dialogs that remember the last folder.
 *  - Provide a native application menu that drives the app's existing controls.
 */
import { app, BrowserWindow, Menu, net, protocol, session, shell, dialog } from 'electron';
import type { MenuItemConstructorOptions, WebContents } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const APP_SCHEME = 'app';
const APP_HOST = 'zr';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DEV_URL = process.env.ELECTRON_RENDERER_URL; // set by scripts/electron-dev.mjs
const isDev = !!DEV_URL;

// Test hook: when set, downloads are saved straight into this folder instead of
// opening the Save As dialog (used only by the automated Electron test suite).
const TEST_DOWNLOAD_DIR = process.env.ZR_TEST_DOWNLOAD_DIR;

const RENDERER_ROOT = path.join(__dirname, '..', 'dist');

/**
 * Content Security Policy for the packaged app.
 *  - 'wasm-unsafe-eval' lets FFmpeg.wasm compile; no general eval is allowed.
 *  - blob: is required for video object URLs, FFmpeg core blob URLs, and exports.
 *  - No remote origins at all: the app runs fully offline.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

// ---------------------------------------------------------------------------
// Small persisted settings (last Save As folder, window bounds)
// ---------------------------------------------------------------------------
type Settings = {
  lastSaveDir?: string;
  bounds?: { x?: number; y?: number; width: number; height: number; maximized?: boolean };
};
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function readSettings(): Settings {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) as Settings;
  } catch {
    return {};
  }
}
function writeSettings(patch: Partial<Settings>): void {
  try {
    const next = { ...readSettings(), ...patch };
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[zr] could not persist settings:', err);
  }
}

// ---------------------------------------------------------------------------
// app:// protocol — serves dist/ (inside app.asar when packaged)
// ---------------------------------------------------------------------------
function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 });
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';

    const filePath = path.normalize(path.join(RENDERER_ROOT, rel));
    // Block path traversal outside the renderer root.
    if (filePath !== RENDERER_ROOT && !filePath.startsWith(RENDERER_ROOT + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }

    let response: Response;
    try {
      // Only forward Range (for media seeking); CORS headers such as Origin must not
      // be passed to the file:// fetch or it rejects font/worker requests.
      const range = request.headers.get('range');
      response = await net.fetch(pathToFileURL(filePath).toString(), range ? { headers: { range } } : undefined);
    } catch (err) {
      console.warn('[zr] app:// fetch failed for', rel, err);
      return new Response('Not found', { status: 404 });
    }

    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    if (filePath.endsWith('.wasm')) headers.set('Content-Type', 'application/wasm');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}

// ---------------------------------------------------------------------------
// Downloads → native Save As
// ---------------------------------------------------------------------------
const FILTERS: Record<string, Electron.FileFilter> = {
  '.mp4': { name: 'MP4 Video', extensions: ['mp4'] },
  '.mov': { name: 'QuickTime Movie', extensions: ['mov'] },
  '.cube': { name: 'CUBE 3D LUT', extensions: ['cube'] },
  '.png': { name: 'PNG Image', extensions: ['png'] },
  '.jpg': { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
  '.json': { name: 'JSON', extensions: ['json'] },
  '.csv': { name: 'CSV', extensions: ['csv'] },
};

function configureDownloads(ses: Electron.Session): void {
  ses.on('will-download', (_event, item) => {
    const fileName = item.getFilename();
    const ext = path.extname(fileName).toLowerCase();

    if (TEST_DOWNLOAD_DIR) {
      fs.mkdirSync(TEST_DOWNLOAD_DIR, { recursive: true });
      item.setSavePath(path.join(TEST_DOWNLOAD_DIR, fileName));
    } else {
      const baseDir = readSettings().lastSaveDir || app.getPath(ext === '.mp4' || ext === '.mov' ? 'videos' : 'documents');
      item.setSaveDialogOptions({
        title: 'Save As',
        defaultPath: path.join(baseDir, fileName),
        filters: [...(FILTERS[ext] ? [FILTERS[ext]] : []), { name: 'All Files', extensions: ['*'] }],
      });
    }

    item.once('done', (_e, state) => {
      const saved = item.getSavePath();
      if (state === 'completed' && saved) {
        if (!TEST_DOWNLOAD_DIR) writeSettings({ lastSaveDir: path.dirname(saved) });
        console.log(`[zr] saved ${saved}`);
      } else if (state === 'interrupted') {
        dialog.showErrorBox('Save failed', `Could not save ${fileName}.`);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Renderer hardening
// ---------------------------------------------------------------------------
function isAppUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (isDev && DEV_URL) return u.origin === new URL(DEV_URL).origin;
    return u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST;
  } catch {
    return false;
  }
}

function openExternalSafely(raw: string): void {
  try {
    const u = new URL(raw);
    if (u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:') {
      void shell.openExternal(u.toString());
    }
  } catch {
    /* ignore malformed URLs */
  }
}

function hardenWebContents(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('blob:') && !isAppUrl(url)) openExternalSafely(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
}

function configurePermissions(ses: Electron.Session): void {
  const allowed = new Set(['fullscreen', 'clipboard-sanitized-write', 'clipboard-read']);
  ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed.has(permission)));
  ses.setPermissionCheckHandler((_wc, permission) => allowed.has(permission));
}

// ---------------------------------------------------------------------------
// Window + menu
// ---------------------------------------------------------------------------
let mainWindow: BrowserWindow | null = null;

/** Click one of the app's existing hidden <input type="file"> controls with a user gesture. */
function clickRendererInput(selector: string): void {
  if (!mainWindow) return;
  const code = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) { el.click(); return true; } return false; })()`;
  void mainWindow.webContents.executeJavaScript(code, true);
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Video…',
          accelerator: 'CmdOrCtrl+O',
          click: () => clickRendererInput('input[type="file"][accept*="video"]'),
        },
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => clickRendererInput('input[type="file"][webkitdirectory]'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        ...(isDev
          ? ([{ type: 'separator' }, { role: 'reload' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[])
          : []),
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: `About ${app.getName()}`,
          click: () =>
            dialog.showMessageBox({
              type: 'info',
              title: app.getName(),
              message: app.getName(),
              detail: `Version ${app.getVersion()}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
            }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const saved = readSettings().bounds;
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1600,
    height: saved?.height ?? 980,
    x: saved?.x,
    y: saved?.y,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0e1014',
    title: 'Nikon ZR LUT Player',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      backgroundThrottling: false, // keep exports running when the window is in the background
    },
  });

  if (saved?.maximized) mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    writeSettings({ bounds: { ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() } });
  };
  mainWindow.on('close', persistBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(isDev ? DEV_URL! : `${APP_ORIGIN}/index.html`);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('web-contents-created', (_e, contents) => hardenWebContents(contents));

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('app.zrplayer.lutplayer');
    registerAppProtocol();
    configureDownloads(session.defaultSession);
    configurePermissions(session.defaultSession);
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
