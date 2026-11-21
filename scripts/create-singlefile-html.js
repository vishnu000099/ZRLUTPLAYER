import fs from 'fs';
import path from 'path';

// Read dist/index.html and inline CSS and JS
let html = fs.readFileSync('dist/index.html', 'utf8');

// Find CSS files in dist/assets
const assetFiles = fs.readdirSync('dist/assets');
const cssFile = assetFiles.find(f => f.endsWith('.css'));
const jsFile = assetFiles.find(f => f.endsWith('.js'));

if (cssFile) {
  const cssContent = fs.readFileSync(path.join('dist/assets', cssFile), 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]+>/, `<style>${cssContent}</style>`);
}

if (jsFile) {
  const jsContent = fs.readFileSync(path.join('dist/assets', jsFile), 'utf8');
  html = html.replace(/<script type="module"[^>]+><\/script>/, `<script type="module">${jsContent}</script>`);
}

fs.writeFileSync('public/downloads/Nikon-ZR-LUT-Player-Portable.html', html, 'utf8');
console.log('Generated public/downloads/Nikon-ZR-LUT-Player-Portable.html successfully (' + (html.length / 1024).toFixed(1) + ' KB)');
