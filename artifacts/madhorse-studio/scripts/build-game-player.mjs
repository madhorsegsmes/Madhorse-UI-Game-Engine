import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(project, 'public/game-player');
const result = await build({
  configFile: false, root: join(project, 'src/game-player'), publicDir: false, base: './',
  plugins: [react()],
  resolve: { alias: { '@': join(project, 'src'), '@assets': resolve(project, '../../attached_assets') },
    dedupe: ['react', 'react-dom'] },
  build: { outDir, emptyOutDir: true, sourcemap: false },
});
const notices = ['Madhorse standalone web player — third-party license notices\n'];
const packages = new Set();
for (const output of (Array.isArray(result) ? result : [result])) {
  if (!('output' in output)) continue;
  for (const chunk of output.output) {
    if (chunk.type !== 'chunk') continue;
    for (const id of Object.keys(chunk.modules)) {
      if (id.includes('\0')) continue; // Rollup's virtual CommonJS proxies are not filesystem paths.
      const marker = id.lastIndexOf('/node_modules/');
      if (marker < 0) continue;
      const rest = id.slice(marker + '/node_modules/'.length).split('/');
      const name = rest[0].startsWith('@') ? rest.slice(0, 2).join('/') : rest[0];
      packages.add(id.slice(0, marker + '/node_modules/'.length) + name);
    }
  }
}
for (const packagePath of [...packages].sort()) {
  const pkg = JSON.parse(await readFile(join(packagePath, 'package.json'), 'utf8'));
  let found = false;
  for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    try { notices.push(`\n--- ${pkg.name} ${pkg.version} ---\n${await readFile(join(packagePath, file), 'utf8')}`); found = true; break; }
    catch { /* Try the package's next conventional license filename. */ }
  }
  if (!found) notices.push(`\n--- ${pkg.name} ${pkg.version} ---\nLicense: ${pkg.license ?? 'See package repository'}\n${typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url ?? ''}`);
}
await writeFile(join(outDir, 'NOTICE.txt'), notices.join('\n'));
async function filesIn(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesIn(join(dir, entry.name), `${path}/`));
    else if (entry.name !== 'bundle.json') files.push(path);
  }
  return files.sort();
}
await writeFile(join(outDir, 'bundle.json'), JSON.stringify({ version: 1, files: await filesIn(outDir) }));
console.log('Built standalone web player and export manifest.');
