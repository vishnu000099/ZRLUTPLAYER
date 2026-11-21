/**
 * End-to-end tests for the Electron build. Drives the real app (app:// protocol,
 * sandboxed renderer) with Playwright and verifies outputs with ffprobe.
 *
 *   node scripts/electron-test.mjs [--only=name1,name2]
 *
 * Env:
 *   ZR_ELECTRON_EXE   optional path to electron.exe (default: node_modules/electron)
 *   ZR_APP_PATH       optional app path to launch (default: project root)
 *   ZR_MEDIA_DIR      folder with test clips (default: test-output/media)
 *   ZR_OFFLINE=1      route all network through a dead proxy (offline simulation)
 */
import { _electron } from 'playwright-core';
import electronPath from 'electron';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'test-output');
const DL = path.join(OUT, 'downloads');
const SHOTS = path.join(OUT, 'screens');
const MEDIA = process.env.ZR_MEDIA_DIR || path.join(OUT, 'media');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);

fs.rmSync(DL, { recursive: true, force: true });
fs.mkdirSync(DL, { recursive: true });
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const externalRequests = [];
const pageErrors = [];

const args = [...(process.env.ZR_EXTRA_ARGS ? process.env.ZR_EXTRA_ARGS.split(' ') : []), process.env.ZR_APP_PATH || '.'];
if (process.env.ZR_OFFLINE === '1') args.unshift('--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=<-loopback>');

const app = await _electron.launch({
  executablePath: process.env.ZR_ELECTRON_EXE || electronPath,
  args,
  env: { ...process.env, ZR_TEST_DOWNLOAD_DIR: DL },
  timeout: 60000,
});
const page = await app.firstWindow();
page.setDefaultTimeout(20000);
page.on('request', (r) => {
  const u = r.url();
  if (!/^(app|blob|data|devtools|chrome-extension):/.test(u)) externalRequests.push(u);
});
page.on('pageerror', (e) => pageErrors.push(e.message));
const warnings = [];
page.on('console', (m) => {
  if (m.type() === 'error' && !(m.text().includes('ERR_FILE_NOT_FOUND') && blobPending())) pageErrors.push('console: ' + m.text());
  if (m.type() === 'warning') warnings.push(m.text());
});
const blobNoise = [];
let lastBlobFail = 0;
const blobPending = () => Date.now() - lastBlobFail < 2000;
page.on('requestfailed', (r) => { if (r.url().startsWith('blob:')) lastBlobFail = Date.now(); }); page.on('requestfailed', (r) => (r.url().startsWith('blob:') ? blobNoise : pageErrors).push('requestfailed: ' + r.url().slice(0, 140) + ' ' + (r.failure()?.errorText || '')));
await page.waitForLoadState('load');
// The player's <video> is created with document.createElement and never attached to the
// DOM, so record created video elements (first one = main player) before the app boots.
await page.addInitScript(() => {
  const orig = Document.prototype.createElement;
  window.__zrVideos = [];
  Document.prototype.createElement = function (tag, opts) {
    const el = orig.call(this, tag, opts);
    if (String(tag).toLowerCase() === 'video') window.__zrVideos.push(el);
    return el;
  };
});
await page.reload();
await page.waitForLoadState('load');
await page.waitForTimeout(1500);
pageErrors.length = 0; // drop requests aborted by the harness reload above

// ---------------------------------------------------------------- helpers
const sleep = (ms) => page.waitForTimeout(ms);
async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}
async function test(name, fn) {
  if (only.length && !only.includes(name)) return;
  const t0 = Date.now();
  try {
    const detail = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, detail: detail || '' });
    console.log(`PASS  ${name}  ${detail || ''}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, detail: String(err?.message || err).split('\n')[0] });
    console.log(`FAIL  ${name}  ${String(err?.message || err).split('\n')[0]}`);
    await shot(`FAIL_${name}`).catch(() => {});
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,duration:format=duration,size', '-of', 'json', file]);
  return JSON.parse(String(out));
}
async function waitForDownload(predicate, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const files = fs.readdirSync(DL).filter((f) => { try { return !f.endsWith('.crdownload') && predicate(f); } catch { return false; } });
    for (const f of files) {
      const p = path.join(DL, f);
      try {
        const s1 = fs.statSync(p).size;
        await sleep(1500);
        if (s1 > 0 && fs.statSync(p).size === s1) return p;
      } catch { /* file renamed mid-poll; retry */ }
    }
    await sleep(1000);
  }
  throw new Error(`no download matched within ${timeoutMs / 1000}s`);
}
/** Mean RGB of the main WebGL viewport canvas (largest canvas on the page). */
async function canvasStats() {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.width > 0);
    canvases.sort((a, b) => b.width * b.height - a.width * a.height);
    const c = canvases[0];
    if (!c) return null;
    const w = 160, h = 90;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(c, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let r = 0, g = 0, b = 0, left = 0, right = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const l = d[i] + d[i + 1] + d[i + 2];
      r += d[i]; g += d[i + 1]; b += d[i + 2];
      if (x < w / 2) left += l; else right += l;
    }
    const n = w * h;
    const glType = (() => { try { return c.getContext('webgl2') ? 'webgl2' : c.getContext('webgl') ? 'webgl' : '2d?'; } catch { return 'n/a'; } })();
    return { w: c.width, h: c.height, r: r / n, g: g / n, b: b / n, left: left / (n / 2) / 3, right: right / (n / 2) / 3, glType };
  });
}
async function videoState() {
  return page.evaluate(() => {
    const v = window.__zrVideos[0];
    return v ? { t: v.currentTime, d: v.duration, paused: v.paused, rs: v.readyState, w: v.videoWidth, h: v.videoHeight, err: v.error?.message || null } : null;
  });
}
async function openTab(label) {
  await page.getByRole('button', { name: label, exact: false }).first().click();
  await sleep(400);
}
async function memoryMB() {
  const metrics = await app.evaluate(({ app }) => app.getAppMetrics());
  const total = metrics.reduce((s, m) => s + (m.memory?.workingSetSize || 0), 0) / 1024;
  const renderer = metrics.filter((m) => m.type === 'Tab').reduce((s, m) => s + m.memory.workingSetSize, 0) / 1024;
  return { total: Math.round(total), renderer: Math.round(renderer) };
}
async function unlockExportIfNeeded() {
  const input = page.getByPlaceholder('Enter passcode');
  if (await input.count()) {
    await input.first().fill('0554318462'); // app's own built-in passcode (see report)
    await sleep(300);
    if (await input.count()) await input.first().press('Enter');
    await sleep(500);
  }
}
async function loadVideo(file) {
  await page.setInputFiles('input[type="file"][accept*="video"]:not([multiple])', file).catch(async () => {
    await page.locator('input[type="file"][accept*="video"]').first().setInputFiles(file);
  });
  await page.waitForFunction(() => { const v = window.__zrVideos[0]; return v && v.readyState >= 2 && v.videoWidth > 0; }, null, { timeout: 30000 });
  await sleep(800);
}
async function runExport(engine, expectAudio) {
  try { return await runExportInner(engine, expectAudio); } finally {
    const again = page.locator('button[title="Export another video"]');
    if (await again.count()) await again.click().catch(() => {});
  }
}
async function runExportInner(engine, expectAudio) {
  await openTab('Export video');
  await unlockExportIfNeeded();
  await page.getByRole('button', { name: engine === 'hardware' ? /Hardware Accelerated/ : /Software CPU/ }).first().click();
  await page.locator('button[title^="Fast 5-second test render"]').click();
  // Move earlier exports aside so identical output names can't collide.
  const prev = path.join(DL, 'previous'); fs.mkdirSync(prev, { recursive: true });
  for (const f of fs.readdirSync(DL)) if (f.endsWith('.mp4')) fs.renameSync(path.join(DL, f), path.join(prev, `${Date.now()}_${f}`));
  const before = new Set(fs.readdirSync(DL));
  await page.getByRole('button', { name: /Start Exporting Graded Video/ }).click();
  const t0 = Date.now();
  const file = await waitForDownload((f) => f.endsWith('.mp4') && (!before.has(f) || fs.statSync(path.join(DL, f)).mtimeMs > t0), Number(process.env.ZR_EXPORT_TIMEOUT_MS || 300000));
  let usedEngine = /_hw_/.test(path.basename(file)) ? 'hardware' : 'cpu-fallback';
  if (engine === 'hardware' && usedEngine !== 'hardware') {
    const hwAvailable = await page.evaluate(async () => (await VideoEncoder.isConfigSupported({ codec: 'avc1.640028', width: 1920, height: 1080, bitrate: 1e7, framerate: 30, hardwareAcceleration: 'prefer-hardware' })).supported);
    assert(!hwAvailable, 'hardware encoder is available but export fell back to CPU');
  }
  const info = ffprobe(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  assert(v, 'no video stream in export');
  const dur = Number(info.format.duration);
  assert(dur > 3 && dur < 7, `unexpected duration ${dur}`);
  if (expectAudio) assert(a, 'audio track missing from export · ' + (warnings.filter((w) => /udio/.test(w)).slice(-1)[0] || 'no audio warning').slice(0, 400));
  // Reset panel for the next export
  const again = page.locator('button[title="Export another video"]');
  if (await again.count()) await again.click();
  return { file, detail: `[${engine === 'hardware' ? usedEngine : 'cpu'}] ${path.basename(file)} · ${v.codec_name} ${v.width}x${v.height} ${v.pix_fmt} · ${dur.toFixed(2)}s · audio=${a ? a.codec_name : 'none'} · ${(Number(info.format.size) / 1e6).toFixed(1)} MB` };
}

// ------------------------------------------------------------------ tests
await test('app-shell-security', async () => {
  const r = await page.evaluate(() => ({ url: location.href, req: typeof require, proc: typeof process, desk: window.zrDesktop?.isDesktop }));
  assert(r.url.startsWith('app://zr/'), 'not served from app://');
  assert(r.req === 'undefined' && r.proc === 'undefined', 'Node APIs leaked into renderer');
  const prefs = await app.evaluate(({ BrowserWindow }) => {
    const wp = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
    return { ci: wp.contextIsolation, sb: wp.sandbox, ni: wp.nodeIntegration };
  });
  assert(prefs.ci === true && prefs.sb === true && prefs.ni === false, 'webPreferences not hardened: ' + JSON.stringify(prefs));
  const nav = await page.evaluate(async () => { const before = location.href; const a = document.createElement('a'); a.href = 'https://example.com'; a.target = '_self'; return before; });
  return `${r.url} · contextIsolation, sandbox on · nodeIntegration off`;
});

await test('fonts-local', async () => {
  const fams = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family}`); });
  assert(fams.some((f) => f.includes('Plus Jakarta Sans')), 'Plus Jakarta Sans not loaded');
  return [...new Set(fams)].join(', ');
});

await test('builtin-lut-autoload', async () => {
  await page.getByText('Arrilogc3').first().waitFor({ timeout: 10000 });
  return 'Arrilogc3 (33³) loaded from bundled /luts at startup';
});

await test('video-import-playback', async () => {
  await loadVideo(path.join(MEDIA, 'clip_h264_aac.mp4'));
  const s0 = await videoState();
  await page.evaluate(() => window.__zrVideos[0].play());
  await sleep(1500);
  const s1 = await videoState();
  assert(s1.t > s0.t + 0.5, `playback did not advance (${s0.t} -> ${s1.t})`);
  await page.evaluate(() => window.__zrVideos[0].pause());
  await shot('01_video_loaded');
  return `${s1.w}x${s1.h}, ${s1.d.toFixed(1)}s, advanced ${(s1.t - s0.t).toFixed(2)}s`;
});

await test('webgl-rendering', async () => {
  const s = await canvasStats();
  assert(s && s.glType.startsWith('webgl'), 'viewport canvas has no WebGL context');
  const lum = (s.r + s.g + s.b) / 3;
  assert(lum > 10, `canvas looks blank (mean ${lum.toFixed(1)})`);
  const gpu = await app.evaluate(async ({ app }) => { const i = await app.getGPUInfo('basic'); return i.gpuDevice?.find((d) => d.active)?.deviceString || i.auxAttributes?.glRenderer || 'unknown'; });
  return `${s.glType} ${s.w}x${s.h}, mean RGB ${s.r.toFixed(0)}/${s.g.toFixed(0)}/${s.b.toFixed(0)} · GPU: ${gpu}`;
});

let lutOnStats;
await test('lut-toggle-changes-image', async () => {
  lutOnStats = await canvasStats();
  const cb = page.getByText('Enable 3D LUT').first();
  await cb.click(); await sleep(600);
  const off = await canvasStats();
  await cb.click(); await sleep(600);
  const diff = Math.abs(off.r - lutOnStats.r) + Math.abs(off.g - lutOnStats.g) + Math.abs(off.b - lutOnStats.b);
  assert(diff > 3, `LUT on/off produced no visible change (Δ=${diff.toFixed(2)})`);
  return `Δ mean RGB on vs off = ${diff.toFixed(1)}`;
});

await test('builtin-lut-catalog', async () => {
  await openTab('LUT Library');
  await shot('02_lut_library');
  const item = page.getByText(/N-Log/i).first();
  await item.click();
  await sleep(1500);
  const header = await page.getByText(/N-Log/i).count();
  // Also try a LUT with a very long file name (path-length check)
  const longItem = page.getByText(/R4 Very Soft Rolloff/).first();
  if (await longItem.count()) { await longItem.click(); await sleep(1200); }
  const errs = pageErrors.filter((e) => /Failed to load|HTTP 404|app:\/\/zr\/luts/.test(e));
  assert(errs.length === 0, 'catalog LUT fetch error: ' + errs[0]);
  await shot('03_catalog_lut');
  return `Nikon N-Log + long-name REC709 catalog LUTs loaded (${header} matches)`;
});

await test('custom-cube-import', async () => {
  // Strong synthetic LUT: channel swap R<->B, so the effect is unambiguous.
  const N = 17; const lines = ['TITLE "ZR Test Swap"', `LUT_3D_SIZE ${N}`];
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) lines.push(`${(b / (N - 1)).toFixed(6)} ${(g / (N - 1)).toFixed(6)} ${(r / (N - 1)).toFixed(6)}`);
  const cube = path.join(OUT, 'ZR_Test_Swap.cube'); fs.writeFileSync(cube, lines.join('\n'));
  await openTab('LUT Library');
  const before = await canvasStats();
  await page.locator('input[type="file"][accept*=".cube"]').first().setInputFiles(cube);
  await sleep(1500);
  await page.getByText('ZR Test Swap').first().waitFor({ timeout: 5000 }).catch(() => page.getByText('ZR_Test_Swap').first().waitFor({ timeout: 5000 }));
  const after = await canvasStats();
  const diff = Math.abs(after.r - before.r) + Math.abs(after.b - before.b);
  assert(diff > 2, `custom LUT made no visible change (Δ=${diff.toFixed(2)})`);
  await shot('04_custom_cube');
  return `imported 17³ swap LUT, Δ R+B = ${diff.toFixed(1)}`;
});

await test('split-screen', async () => {
  const sel = page.locator('select').filter({ has: page.locator('option[value="vertical"]') }).first();
  for (const mode of ['vertical', 'horizontal', 'side-by-side']) {
    await sel.selectOption(mode); await sleep(700);
    await shot(`05_split_${mode}`);
  }
  await sel.selectOption('vertical'); await sleep(700);
  const s = await canvasStats();
  await sel.selectOption('off'); await sleep(400);
  assert(Math.abs(s.left - s.right) > 1, `vertical split shows no difference between halves (L=${s.left.toFixed(1)} R=${s.right.toFixed(1)})`);
  return `vertical/horizontal/side-by-side rendered; L/R luma ${s.left.toFixed(0)} vs ${s.right.toFixed(0)}`;
});

await test('png-snapshot', async () => {
  const before = new Set(fs.readdirSync(DL));
  await page.locator('button[title="Capture full-resolution graded PNG snapshot"]').click();
  const f = await waitForDownload((n) => n.endsWith('.png') && !before.has(n), 15000);
  const buf = fs.readFileSync(f);
  assert(buf.slice(1, 4).toString() === 'PNG', 'not a PNG');
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  return `${path.basename(f)} ${w}x${h} ${(buf.length / 1024).toFixed(0)} KB`;
});

await test('lut-export-cube', async () => {
  await openTab('Color Grading');
  await page.getByRole('button', { name: /Export \.CUBE/ }).first().click();
  await sleep(500);
  const pass = page.locator('input[type="password"], input[placeholder*="asscode"]');
  const modalText = await page.evaluate(() => document.body.innerText);
  assert(/UI lock only/.test(modalText) && /UI Lock/.test(modalText), 'LUT dialog UI-lock wording missing');
  assert(!/Passcode Protected|authoriz/i.test(modalText), 'LUT dialog still claims protection');
  if (await pass.count()) { await pass.first().fill('0554318462'); await sleep(300); if (await pass.count()) await pass.first().press('Enter'); await sleep(500); }
  const before = new Set(fs.readdirSync(DL));
  await page.getByRole('button', { name: /Download \.CUBE LUT/ }).click();
  const f = await waitForDownload((n) => n.toLowerCase().endsWith('.cube') && !before.has(n), 20000);
  const txt = fs.readFileSync(f, 'utf8');
  const size = Number((txt.match(/LUT_3D_SIZE\s+(\d+)/) || [])[1]);
  const rows = txt.split('\n').filter((l) => /^\s*-?\d/.test(l)).length;
  assert(size && rows === size ** 3, `bad cube: size ${size}, rows ${rows}`);
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  if (await cancel.count()) await cancel.first().click();
  await sleep(300);
  return `${path.basename(f)} LUT_3D_SIZE ${size}, ${rows} rows`;
});

await test('ui-lock-wording', async () => {
  await page.evaluate(() => sessionStorage.removeItem('nikon_zr_export_unlocked'));
  await openTab('Export video');
  const lockBtn = page.locator('button[title="Lock the Export Video panel (UI lock)"]');
  if (await lockBtn.count()) { await lockBtn.click(); await sleep(400); }
  const text = await page.evaluate(() => document.body.innerText);
  assert(/Export Video Locked/.test(text), 'locked panel title missing');
  assert(/UI lock only/.test(text), 'UI-lock disclaimer missing');
  assert(!/Protected|Access denied|authoriz|Secure Studio/i.test(text), 'security claim still visible');
  await page.getByPlaceholder('Enter passcode').fill('1111111111'); await page.getByPlaceholder('Enter passcode').press('Enter'); await sleep(300);
  const wrong = await page.getByText('Incorrect passcode. Please try again.').count();
  assert(wrong === 1, 'wrong-code message not shown');
  await page.getByPlaceholder('Enter passcode').fill('0554318462'); await page.getByPlaceholder('Enter passcode').press('Enter'); await sleep(400);
  assert(await page.getByRole('button', { name: /Start Exporting Graded Video/ }).count() === 1, 'correct code did not unlock');
  return 'locked/disclaimer/wrong-code/unlock behave as before; no security claims shown';
});

await test('export-webcodecs-hw', async () => {
  const caps = await page.evaluate(async () => { const r = await VideoEncoder.isConfigSupported({ codec: 'avc1.640033', width: 1920, height: 1080, bitrate: 2e7, framerate: 25, hardwareAcceleration: 'prefer-hardware' }); return r.supported; });
  const m0 = await memoryMB();
  const { detail } = await runExport('hardware', true);
  const m1 = await memoryMB();
  return `${detail} · VideoEncoder HW support=${caps} · mem ${m0.total}→${m1.total} MB`;
});

await test('export-ffmpeg-cpu', async () => {
  const m0 = await memoryMB();
  const { detail } = await runExport('cpu', true);
  const m1 = await memoryMB();
  return `${detail} · mem ${m0.total}→${m1.total} MB`;
});

await test('folder-import-playlist', async () => {
  await openTab('Playlist').catch(() => {});
  await page.locator('input[type="file"][webkitdirectory]').first().setInputFiles(path.join(MEDIA, 'clips'));
  await sleep(2500);
  await shot('06_playlist');
  const names = ['a_bars.mp4', 'b_testsrc.mp4', 'c_mandel.mov'];
  const found = [];
  for (const n of names) if (await page.getByText(n).count()) found.push(n);
  assert(found.length === 3, `playlist shows ${found.length}/3 clips: ${found.join(',')}`);
  const v1 = await videoState();
  await page.keyboard.press('Shift+ArrowRight'); await sleep(1500);
  const v2 = await videoState();
  assert(v2 && v2.w > 0, 'no clip loaded after next');
  return `3 clips queued · ${v1?.w}x${v1?.h} → next clip ${v2.w}x${v2.h}`;
});

await test('large-4k-hevc10', async () => {
  const f = path.join(MEDIA, 'zr_like_hevc10_4k.mov');
  const m0 = await memoryMB();
  await loadVideo(f);
  await page.evaluate(() => window.__zrVideos[0].play());
  await sleep(3000);
  const s = await videoState();
  await page.evaluate(() => window.__zrVideos[0].pause());
  const q = await page.evaluate(() => { const v = window.__zrVideos[0]; const q = v.getVideoPlaybackQuality(); return { total: q.totalVideoFrames, dropped: q.droppedVideoFrames }; });
  const m1 = await memoryMB();
  await shot('07_hevc10_4k');
  assert(s.w === 3840 && s.t > 1, `4K HEVC did not play (${JSON.stringify(s)})`);
  return `HEVC Main10 3840x2160 played ${s.t.toFixed(1)}s · frames ${q.total} dropped ${q.dropped} · mem ${m0.total}→${m1.total} MB`;
});

if (process.env.ZR_LARGE_FILE) {
  await test('large-file-memory', async () => {
    const f = process.env.ZR_LARGE_FILE;
    const sizeGB = fs.statSync(f).size / 1e9;
    const m0 = await memoryMB();
    await loadVideo(f);
    await page.evaluate(() => { const v = window.__zrVideos[0]; v.currentTime = v.duration * 0.8; return v.play(); });
    await sleep(3000);
    const s = await videoState();
    await page.evaluate(() => window.__zrVideos[0].pause());
    const m1 = await memoryMB();
    const { detail } = await runExport('hardware', true);
    const m2 = await memoryMB();
    assert(s.t > 1, 'large file did not play after seek');
    return `${sizeGB.toFixed(2)} GB file · seek to 80% + play OK · mem idle ${m0.total} → playing ${m1.total} → after HW export ${m2.total} MB · ${detail}`;
  });
  if (process.env.ZR_LARGE_CPU === '1') {
    await test('large-file-cpu-export', async () => {
      const { detail } = await runExport('cpu', true);
      return detail;
    });
  }
}

await test('no-external-network', async () => {
  assert(externalRequests.length === 0, `external requests: ${externalRequests.slice(0, 3).join(', ')}`);
  return process.env.ZR_OFFLINE === '1' ? 'offline mode (dead proxy): 0 external requests' : '0 external requests during the whole run';
});

await test('gpu-status', async () => {
  const st = await app.evaluate(({ app }) => app.getGPUFeatureStatus());
  const info = await app.evaluate(async ({ app }) => { const i = await app.getGPUInfo('complete'); return { dev: (i.gpuDevice || []).map((d) => d.vendorId + ':' + d.deviceId + (d.active ? '*' : '')), renderer: i.auxAttributes?.glRenderer, venc: (i.videoEncodeAcceleratorSupportedProfile || []).length }; });
  return JSON.stringify({ gpu_compositing: st.gpu_compositing, webgl2: st.webgl2, video_decode: st.video_decode, video_encode: st.video_encode, ...info });
});

await test('no-renderer-errors', async () => {
  const known = pageErrors.filter((e) => /VideoSample was garbage collected/.test(e));
  const real = pageErrors.filter((e) => !/Autofill|DevTools|VideoSample was garbage collected/.test(e));
  assert(real.length === 0, real.slice(0, 3).join(' | '));
  return `no page errors (${blobNoise.length} revoked blob: URL fetches ignored; ${known.length} pre-existing mediabunny VideoSample GC notices)`;
});

await app.close();

const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} passed`);
fs.writeFileSync(path.join(OUT, `results${process.env.ZR_OFFLINE === '1' ? '-offline' : ''}.json`), JSON.stringify(results, null, 2));
process.exit(pass === results.length ? 0 : 1);
