import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');

function getFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const relPath = path.join(base, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath, relPath));
    } else {
      results.push({ fullPath, relPath: relPath.replace(/\\/g, '/') });
    }
  });
  return results;
}

const files = getFiles(distDir);
const fileMap = {};

for (const f of files) {
  const content = fs.readFileSync(f.fullPath);
  const ext = path.extname(f.relPath).toLowerCase();
  let mime = 'application/octet-stream';
  if (ext === '.html') mime = 'text/html; charset=utf-8';
  else if (ext === '.js') mime = 'application/javascript; charset=utf-8';
  else if (ext === '.css') mime = 'text/css; charset=utf-8';
  else if (ext === '.json') mime = 'application/json; charset=utf-8';
  else if (ext === '.png') mime = 'image/png';
  else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
  else if (ext === '.svg') mime = 'image/svg+xml';

  fileMap['/' + f.relPath] = {
    mime,
    base64: content.toString('base64')
  };
}

const serverCode = `// Auto-generated standalone Windows launcher
const http = require('http');
const { exec } = require('child_process');

const FILES = ${JSON.stringify(fileMap, null, 2)};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/' || url === '') url = '/index.html';

  const file = FILES[url] || FILES['/index.html'];
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  const buf = Buffer.from(file.base64, 'base64');
  res.writeHead(200, {
    'Content-Type': file.mime,
    'Content-Length': buf.length,
    'Cache-Control': 'no-cache'
  });
  res.end(buf);
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const appUrl = \`http://127.0.0.1:\${port}/\`;

  console.log('===============================================================');
  console.log('      NIKON ZR LUT PLAYER - STANDALONE WINDOWS APP             ');
  console.log('===============================================================');
  console.log(' WebGL 3D LUT Player & Proxy Colorist is running.');
  console.log(' URL: ' + appUrl);
  console.log(' Press Ctrl+C in this console window to exit.');
  console.log('===============================================================');

  // Try opening with Edge in app mode (looks like a native desktop app without browser chrome)
  // Fallback to standard system default browser
  const winCmd = \`start msedge --app="\${appUrl}" --window-size=1400,900 || start \${appUrl}\`;
  exec(winCmd, (err) => {
    if (err) {
      // Fallback
      exec(\`start \${appUrl}\`);
    }
  });
});
`;

fs.writeFileSync(path.resolve('scripts/standalone-server.js'), serverCode, 'utf8');
console.log('Generated scripts/standalone-server.js successfully with', Object.keys(fileMap).length, 'embedded files.');
