import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { loadLocalAsset } from './asset-vault';
import { createWebGameData, type WebGameData } from './web-game-format';
import type { FreshWorkspaceSnapshot } from './fresh-workspace-storage';
import type { SceneRenderSettings } from '@/hooks/use-scene-render-settings';

type ArchiveEntry = { path: string; blob: Blob };
import { MAX_WEB_GAME_ASSET_BYTES as MAX_ASSET_BYTES, MAX_WEB_GAME_TOTAL_BYTES as MAX_EXPORT_BYTES } from './web-game-limits';

export function safeRuntimePath(path: unknown): path is string {
  return typeof path === 'string' &&
    (path === 'index.html' || path === 'NOTICE.txt' || /^assets\/[a-zA-Z0-9_./-]+$/.test(path)) &&
    !path.split('/').some(part => !part || part === '.' || part === '..');
}

async function zipFiles(entries: ArchiveEntry[], onProgress: (message: string) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    let settled = false;
    const zip = new Zip((error, bytes, final) => {
      if (settled) return;
      if (error) { settled = true; zip.terminate(); reject(error); return; }
      if (bytes) chunks.push(bytes);
      if (final) { settled = true; resolve(new Blob(chunks, { type: 'application/zip' })); }
    });
    void (async () => {
      try {
        for (const [index, entry] of entries.entries()) {
          onProgress(`Packaging file ${index + 1} of ${entries.length}…`);
          const file = new ZipPassThrough(entry.path);
          zip.add(file);
          const reader = entry.blob.stream().getReader();
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              file.push(value);
            }
            file.push(new Uint8Array(), true);
          } finally { reader.releaseLock(); }
        }
        zip.end();
      } catch (error) { if (!settled) { settled = true; zip.terminate(); reject(error); } }
    })();
  });
}

export async function assembleWebGame(
  game: WebGameData,
  runtime: ArchiveEntry[],
  readAsset: (id: string) => Promise<Blob | null>,
  onProgress: (message: string) => void = () => {},
) {
  const entries = [...runtime];
  if (!runtime.some(file => file.path === 'index.html') || runtime.some(file => !safeRuntimePath(file.path)) ||
      new Set(runtime.map(file => file.path)).size !== runtime.length) {
    throw new Error('The web player bundle is missing or invalid. Rebuild Studio before exporting.');
  }
  const payload = structuredClone(game);
  let totalBytes = entries.reduce((total, entry) => total + entry.blob.size, 0);
  for (const [index, asset] of payload.assets.entries()) {
    if (asset.kind === 'data' || asset.kind === 'pbr-material') continue;
    onProgress(`Reading asset ${index + 1} of ${payload.assets.length}: ${asset.name}`);
    const blob = await readAsset(asset.id);
    if (!blob) throw new Error(`Asset “${asset.name}” is missing from this browser. No incomplete game was downloaded.`);
    if (blob.size > MAX_ASSET_BYTES) throw new Error(`Asset “${asset.name}” exceeds the 100 MB export limit.`);
    totalBytes += blob.size;
    if (totalBytes > MAX_EXPORT_BYTES) throw new Error('This game exceeds the 256 MB web export limit.');
    const extension = asset.name.split('.').pop()?.toLowerCase() ?? 'bin';
    if (extension === 'gltf' || extension === 'glb') {
      let model;
      try {
        if (extension === 'gltf') model = JSON.parse(await blob.text());
        else {
          const header = new DataView(await blob.slice(0, 20).arrayBuffer());
          if (header.byteLength !== 20 || header.getUint32(0, true) !== 0x46546c67 ||
              header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== blob.size ||
              header.getUint32(16, true) !== 0x4e4f534a) throw new Error('Invalid GLB header');
          const jsonLength = header.getUint32(12, true);
          if (jsonLength > 20 * 1024 * 1024 || jsonLength + 20 > blob.size) throw new Error('Invalid GLB JSON length');
          model = JSON.parse(await blob.slice(20, 20 + jsonLength).text());
        }
        if (!model || typeof model !== 'object' ||
            model.buffers !== undefined && !Array.isArray(model.buffers) ||
            model.images !== undefined && !Array.isArray(model.images)) throw new Error('Invalid model structure');
      }
      catch { throw new Error(`Model “${asset.name}” is not a valid glTF/GLB model.`); }
      if ([...(model.buffers ?? []), ...(model.images ?? [])].some(item =>
        item && typeof item.uri === 'string' && !/^data:/i.test(item.uri))) {
        throw new Error(`Model “${asset.name}” references external files. Convert it to a self-contained GLB before exporting.`);
      }
    }
    const path = `game-assets/${String(index + 1).padStart(4, '0')}.${/^[a-z0-9]{1,10}$/.test(extension) ? extension : 'bin'}`;
    payload.assetFiles[asset.id] = path;
    entries.push({ path, blob });
  }
  const json = JSON.stringify(payload);
  if (strToU8(json).length > 20 * 1024 * 1024) throw new Error('This scene exceeds the 20 MB scene-data export limit.');
  entries.push({ path: 'game.json', blob: new Blob([json], { type: 'application/json' }) });
  entries.push({ path: 'README.txt', blob: new Blob([
    `${payload.name} — Madhorse standalone web game\n\n` +
    'Extract this ZIP into an empty folder. Serve it with any static HTTP server or static web host.\n' +
    'For example, with Python 3 installed, open a terminal in that folder and run:\n' +
    '  python3 -m http.server 8080\nThen open http://localhost:8080 in your browser.\n\n' +
    'Do not double-click index.html: browsers block module and asset loading over file://.\n' +
    'Keep index.html, assets/, game-assets/, and game.json together. Subfolder hosting is supported.\n' +
    'No Madhorse account or Studio server is needed. No user script source, AI conversations, or credentials are packaged.\n' +
    'Use Play to start, Escape to pause, Restart to restore the exported starting state, and V to switch supported camera perspectives.\n\n' +
    'EXPORT LIMITATIONS\n' + payload.limitations.map(item => `- ${item}`).join('\n') +
    '\n\nOnly use assets you have permission to distribute. Embedded GLB models are recommended for portable materials.\n',
  ], { type: 'text/plain' }) });
  return zipFiles(entries, onProgress);
}

export async function exportWebGame(
  projectId: string,
  name: string,
  snapshot: FreshWorkspaceSnapshot,
  settings: SceneRenderSettings,
  onProgress: (message: string) => void,
) {
  const game = createWebGameData(name, snapshot, settings);
  const root = new URL(`${import.meta.env.BASE_URL}game-player/`, window.location.origin);
  onProgress('Loading the standalone web player…');
  const response = await fetch(new URL('bundle.json', root), { cache: 'no-store' });
  if (!response.ok) throw new Error('The web player bundle is unavailable. Restart or rebuild Studio and try again.');
  const manifest: { files?: unknown } = await response.json();
  if (!Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 150 ||
      !manifest.files.every(safeRuntimePath) || new Set(manifest.files).size !== manifest.files.length) {
    throw new Error('Invalid web player bundle manifest. Rebuild Studio before exporting.');
  }
  const runtime: ArchiveEntry[] = [];
  let runtimeBytes = 0;
  for (const path of manifest.files) {
    const file = await fetch(new URL(path, root), { cache: 'no-store' });
    if (!file.ok) throw new Error(`Player file “${path}” could not be loaded. No game was downloaded.`);
    const blob = await file.blob();
    runtimeBytes += blob.size;
    if (runtimeBytes > 50 * 1024 * 1024) throw new Error('The web player bundle exceeds its 50 MB safety limit.');
    runtime.push({ path, blob });
  }
  const blob = await assembleWebGame(game, runtime, id => loadLocalAsset(projectId, id), onProgress);
  const safeName = name.trim().replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 70) || 'madhorse-game';
  return { blob, fileName: `${safeName}-web-game.zip` };
}
