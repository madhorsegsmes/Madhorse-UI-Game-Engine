import http from 'node:http';
import path from 'node:path';
import { serveFile, readIndex } from './runtime/static.mjs';

const root = path.join(import.meta.dirname, 'dist/public');
const base = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base && !pathname.startsWith(`${base}/`)) return res.writeHead(404).end();
    const relative = pathname.slice(base.length);
    if (await serveFile(root, relative, req, res)) return;
    if (relative.startsWith('/runtimes/') || relative.startsWith('/assets/')) return res.writeHead(404).end();
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(await readIndex(root));
  } catch {
    res.writeHead(500).end('Unable to serve the application');
  }
});
server.listen(Number(process.env.PORT), '0.0.0.0');
