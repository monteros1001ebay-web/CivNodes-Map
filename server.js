'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '127.0.0.1';

// Resolved against this file, not the cwd, so `node server.js` works from anywhere.
const ROOT = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const TEXTUAL = new Set(['.html', '.css', '.js', '.json', '.svg']);

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  return TEXTUAL.has(ext) ? `${type}; charset=utf-8` : type;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Maps a request URL onto a file inside ROOT, or null if it escapes ROOT.
function resolveFile(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.split('?')[0].split('#')[0]);
  } catch {
    return null; // malformed percent-encoding
  }

  if (pathname.endsWith('/')) pathname += 'index.html';

  const file = path.resolve(ROOT, '.' + path.posix.normalize(pathname));

  // Containment check: the resolved path must sit under ROOT.
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return null;

  return file;
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return send(res, 405, 'Method Not Allowed\n');
  }

  const file = resolveFile(req.url);
  if (!file) return send(res, 403, 'Forbidden\n');

  fs.stat(file, (err, stats) => {
    if (err || !stats.isFile()) {
      if (err && err.code !== 'ENOENT' && err.code !== 'ENOTDIR') {
        console.error(`  500 ${file}: ${err.message}`);
        return send(res, 500, 'Internal Server Error\n');
      }
      return send(res, 404, 'Not Found\n');
    }

    res.writeHead(200, {
      'Content-Type': contentType(file),
      'Content-Length': stats.size,
    });

    if (req.method === 'HEAD') return res.end();

    // Streamed rather than buffered: index.html alone is ~320KB.
    const stream = fs.createReadStream(file);
    stream.on('error', (streamErr) => {
      console.error(`  stream ${file}: ${streamErr.message}`);
      res.destroy();
    });
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to pick another, e.g. PORT=3000 node server.js`);
  } else {
    console.error(`Server error: ${err.message}`);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`Serving ${ROOT}`);
  console.log(`CivNodes Locator: http://${HOST}:${PORT}/`);
});
