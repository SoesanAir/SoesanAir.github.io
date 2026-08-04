'use strict';
/* ============================================================
   Static server for the environment editor.

   Node built-ins only — no npm install, so it runs anywhere node does. Serves the
   WebGame/ folder (the parent of tools/) so ./assets and ./vendor resolve exactly
   as they do in the deployed game, and on Windows it opens the editor in the
   default browser.

   Usage:  node tools/serve.js [port] [--open /editor.html]
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const port = parseInt(process.argv[2], 10) || 8110;
const openIdx = process.argv.indexOf('--open');
const openPath = openIdx >= 0 ? process.argv[openIdx + 1] : null;
const ROOT = path.resolve(__dirname, '..');   // WebGame/

/* Module scripts and .glb both need the right Content-Type or the browser refuses
   them — a .js served as text/plain is a hard module-load error, not a warning. */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.map': 'application/json'
};

const server = http.createServer((req, res) => {
  try {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/editor.html';
    const full = path.normalize(path.join(ROOT, urlPath));
    /* Keep requests inside ROOT — a local tool is still worth not letting a stray
       ../ walk the disk. */
    if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
      res.writeHead(403); res.end('forbidden'); return;
    }
    fs.stat(full, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
      const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      const stream = fs.createReadStream(full);
      /* A client that aborts a request (three.js cancels in-flight loads all the
         time) fires 'error' on the stream; unhandled, it takes the whole server
         down and every later fetch dies with "Failed to fetch". Swallow it. */
      stream.on('error', () => { try { res.destroy(); } catch {} });
      res.on('error', () => { try { stream.destroy(); } catch {} });
      stream.pipe(res);
    });
  } catch (e) { try { res.writeHead(500); res.end('error'); } catch {} }
});
/* Never let a stray socket/stream error kill the static server. */
server.on('clientError', (e, sock) => { try { sock.destroy(); } catch {} });
process.on('uncaughtException', e => console.error('serve.js (ignored):', e && e.message));

server.listen(port, () => {
  const url = `http://localhost:${port}${openPath || '/editor.html'}`;
  console.log('Castaway environment editor');
  console.log('  serving ' + ROOT);
  console.log('  ' + url);
  console.log('Press Ctrl+C to stop.');
  if (openPath) {
    if (process.platform === 'win32') exec('start "" "' + url + '"');
    else if (process.platform === 'darwin') exec('open "' + url + '"');
    else exec('xdg-open "' + url + '"');
  }
});
