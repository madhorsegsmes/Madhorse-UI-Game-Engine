import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';

const types = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm',
  '.json': 'application/json', '.html': 'text/html', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.zip': 'application/zip', '.tar': 'application/x-tar',
};

export async function serveFile(root, pathname, req, res) {
  const filePath = path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(`${path.resolve(root)}${path.sep}`)) return false;
  let info;
  try { info = await stat(filePath); } catch { return false; }
  if (!info.isFile()) return false;
  res.setHeader('Content-Type', types[path.extname(filePath)] ?? 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Last-Modified', info.mtime.toUTCString());
  if (req.headers['if-modified-since'] === info.mtime.toUTCString()) {
    res.statusCode = 304;
    res.end();
  } else {
    res.setHeader('Content-Length', info.size);
    if (req.method === 'HEAD') res.end();
    else createReadStream(filePath).pipe(res);
  }
  return true;
}

export async function readIndex(root) {
  return readFile(path.join(root, 'index.html'));
}
