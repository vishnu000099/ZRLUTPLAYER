// Development: start the Vite dev server, then launch Electron pointed at it.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import electronPath from 'electron';

await import('./build-electron.mjs');

const server = await createServer({ server: { port: 3000, host: '127.0.0.1', strictPort: true } });
await server.listen();
const url = `http://127.0.0.1:${server.config.server.port}/`;
console.log(`[dev] Vite ready at ${url}`);

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RENDERER_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
