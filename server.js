/**
 * SAHAY Disaster Relief Coordination Platform
 * --------------------------------------------
 * High performance HTTP server providing REST API endpoints & static frontend serving.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './src/routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
      const pathname = url.pathname;

      // Handle REST API routes
      if (pathname.startsWith('/api')) {
        let body = null;
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          body = await parseJsonBody(req);
        }
        return handleApiRequest(req, res, pathname, url.searchParams, body);
      }

      // Serve Static Frontend Assets
      let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);

      // Security check: prevent directory traversal
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        return res.end('Access Denied');
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          // SPA fallback: return index.html for unknown web paths
          const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
          if (fs.existsSync(fallbackPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return fs.createReadStream(fallbackPath).pipe(res);
          }
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
      });
    } catch (err) {
      console.error('[Server Error]', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal Server Error', message: err.message }));
    }
  });
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      // Safeguard against oversized payloads (>2MB)
      if (raw.length > 2 * 1024 * 1024) {
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed);
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

// Start standalone server when executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 3000;
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`\n==========================================================`);
    console.log(`🚀 SAHAY Disaster Relief & Coordination Platform`);
    console.log(`🌐 Live Dashboard: http://localhost:${PORT}`);
    console.log(`📡 REST API Health: http://localhost:${PORT}/api/health`);
    console.log(`==========================================================\n`);
  });
}
