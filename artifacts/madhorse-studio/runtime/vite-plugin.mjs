import { cp } from 'node:fs/promises';
import path from 'node:path';
import { prepareRuntimes, runtimeDirectory } from './prepare.mjs';
import { serveFile } from './static.mjs';

export function runtimeAssetsPlugin(basePath) {
  let outputDirectory;
  const prefix = `${basePath.replace(/\/$/, '')}/runtimes`;
  return {
    name: 'madhorse-isolated-runtime-assets',
    async buildStart() { await prepareRuntimes(); },
    configResolved(config) { outputDirectory = path.resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const pathname = decodeURIComponent((req.url ?? '').split('?')[0]);
          if (!pathname.startsWith(`${prefix}/`)) return next();
          if (!await serveFile(runtimeDirectory, pathname.slice(prefix.length), req, res)) {
            res.statusCode = 404;
            res.end('Runtime asset not found');
          }
        } catch {
          res.statusCode = 400;
          res.end('Invalid runtime asset request');
        }
      });
    },
    async closeBundle() {
      if (outputDirectory) await cp(runtimeDirectory, path.join(outputDirectory, 'runtimes'), { recursive: true });
    },
  };
}
