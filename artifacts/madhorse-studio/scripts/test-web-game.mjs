import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { unzipSync } from 'fflate';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'madhorse-web-game-'));
const fixture = resolve(project, '../../generated-artifacts/web-game-smoke');
try {
  const manifest = JSON.parse(await readFile(join(project, 'public/game-player/bundle.json'), 'utf8'));
  const runtimeFiles = [];
  for (const path of manifest.files) {
    runtimeFiles.push({ path, bytes: [...await readFile(join(project, 'public/game-player', path))] });
  }
  const bundled = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { writeFile } from 'node:fs/promises';
      import { createGameStarterKit } from './src/lib/scene-starter-kits';
      import { createGameCamera } from './src/lib/game-camera';
      import { getTransform } from './src/lib/scene-model';
      import { createPbrMaterialAsset } from './src/lib/pbr-material';
      import { DEFAULT_SCENE_RENDER_SETTINGS } from './src/hooks/use-scene-render-settings';
      import { createWebGameData, isWebGameData } from './src/lib/web-game-format';
      import { assembleWebGame, safeRuntimePath } from './src/lib/web-game-export';
      import { StandaloneSimulation } from './src/game-player/simulation';
      import { unzipSync, strFromU8 } from 'fflate';
      const runtimeBytes = JSON.parse(await (await import('node:fs/promises')).readFile(${JSON.stringify(join(temp, 'runtime.json'))}, 'utf8'));
      const runtime = runtimeBytes.map(file => ({ path: file.path, blob: new Blob([new Uint8Array(file.bytes)]) }));
      const kit = createGameStarterKit('shooter', { x: -15, y: 50, z: 0 });
      const assets = kit.generatedAssets.map(item => item.asset);
      const source = {
        entities: kit.entities, camera: createGameCamera(kit.entities), assets: [...assets, createPbrMaterialAsset()],
        animations: [], animationControllers: [], uiControls: [], scripts: [{ source: 'PRIVATE_SCRIPT_DO_NOT_EXPORT' }],
        builderHistory: [], builderDraft: null, builderDraftRequest: 'PRIVATE_BUILDER_DO_NOT_EXPORT', builderBuildLogs: [], prefabs: [],
      };
      source.entities.find(entity => entity.id === kit.playerId).components.push({
        id: crypto.randomUUID(), type: 'script', enabled: true, scriptId: 'private-script',
      });
      const starting = JSON.stringify(source);
      const game = createWebGameData('Export Smoke Test', source, DEFAULT_SCENE_RENDER_SETTINGS);
      assert(game.entities.every(entity => entity.components.every(component =>
        !['script', 'multiplayerPlugin'].includes(component.type) || !component.enabled)));
      assert(game.limitations.some(item => item.includes('scripts')));
      assert(game.limitations.some(item => item.includes('single-player')));
      assert(!JSON.stringify(game).includes('PRIVATE_'), 'Private source/history must never ship');
      const blobs = new Map(kit.generatedAssets.map(item => [item.asset.id, item.file]));
      const archive = await assembleWebGame(game, runtime, async id => blobs.get(id) ?? null);
      const bytes = new Uint8Array(await archive.arrayBuffer());
      const entries = unzipSync(bytes);
      assert(entries['index.html'] && entries['game.json'] && entries['README.txt'] && entries['NOTICE.txt']);
      const exported = JSON.parse(strFromU8(entries['game.json']));
      assert(isWebGameData(exported), 'Exported data must validate independently of Studio');
      for (const path of Object.values(exported.assetFiles)) assert(entries[path], 'Missing packaged asset ' + path);
      assert(!Object.keys(entries).some(path => path.includes('..') || path.startsWith('/')));
      assert.equal(JSON.stringify(source), starting, 'Export cannot mutate the saved project');
      const sim = new StandaloneSimulation(exported);
      const initial = structuredClone(getTransform(sim.player).position);
      for (let i = 0; i < 30; i++) sim.step(1/60, { moveX: 0, moveY: 1, jumpPressed: false, heldKeys: ['w'], pressedKeys: [] });
      assert.notDeepEqual(getTransform(sim.player).position, initial, 'Standalone gameplay must actually move the player');
      sim.togglePerspective(); assert.equal(sim.perspective, 'third-person');
      assert.notDeepEqual(sim.camera.position, sim.camera.target);
      sim.togglePerspective(); assert.equal(sim.perspective, 'first-person');
      const fresh = new StandaloneSimulation(exported);
      assert.deepEqual(getTransform(fresh.player).position, initial, 'Restart must restore initial state');
      assert.equal(JSON.stringify(source), starting, 'Play cannot mutate the saved project');
      await assert.rejects(() => assembleWebGame(game, runtime, async () => null), /missing/);
      await assert.rejects(() => assembleWebGame(game, [{ path: '../index.html', blob: new Blob(['bad']) }], async () => null), /invalid/);
      assert(!safeRuntimePath('assets/../secrets')); assert(!safeRuntimePath('https://evil.example/x'));
      assert(!safeRuntimePath('/index.html')); assert(safeRuntimePath('assets/player-1.js'));
      const gltf = structuredClone(game);
      gltf.assets = [{ id: 'external-model', name: 'external.gltf', kind: 'model', mimeType: 'model/gltf+json', size: 10, addedAt: new Date().toISOString() }];
      await assert.rejects(() => assembleWebGame(gltf, runtime, async () =>
        new Blob([JSON.stringify({ buffers: [{ uri: '../missing.bin' }] })])), /self-contained GLB/);
      const glb = structuredClone(gltf);
      glb.assets[0].name = 'external.glb';
      const chunk = new TextEncoder().encode(JSON.stringify({ images: [{ uri: 'https://example.invalid/missing.png' }] }).padEnd(128, ' '));
      const header = new ArrayBuffer(20);
      const view = new DataView(header);
      [0x46546c67, 2, 20 + chunk.length, chunk.length, 0x4e4f534a].forEach((value, index) => view.setUint32(index * 4, value, true));
      await assert.rejects(() => assembleWebGame(glb, runtime, async () => new Blob([header, chunk])), /self-contained GLB/);
      await assert.rejects(() => assembleWebGame(gltf, runtime, async () => ({ size: 101 * 1024 * 1024 })), /100 MB/);
      const missingReference = structuredClone(source);
      missingReference.entities[0].components.push({ id: crypto.randomUUID(), type: 'spriteRenderer', enabled: true, assetId: 'nonexistent', tint: '#ffffff', width: 1, height: 1 });
      assert.throws(() => createWebGameData('Bad', missingReference, DEFAULT_SCENE_RENDER_SETTINGS), /missing asset|invalid/i);
      await writeFile(${JSON.stringify(join(temp, 'game.zip'))}, bytes);
      console.log('PASS: ZIP completeness, asset validation, private-data exclusion, offline script isolation, gameplay movement, camera switching, restart, source preservation, and explicit failure paths.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
    alias: { '@': join(project, 'src') },
    define: { 'import.meta.env.BASE_URL': '"/madhorse-studio/"' },
  });
  await writeFile(join(temp, 'runtime.json'), JSON.stringify(runtimeFiles));
  await writeFile(join(temp, 'test.mjs'), bundled.outputFiles[0].contents);
  await import(pathToFileURL(join(temp, 'test.mjs')).href);
  const entries = unzipSync(await readFile(join(temp, 'game.zip')));
  await rm(fixture, { recursive: true, force: true });
  for (const [path, bytes] of Object.entries(entries)) {
    const out = join(fixture, path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, bytes);
  }
  // A second copy verifies relative asset URLs when hosted under a path prefix.
  await mkdir(join(fixture, 'nested'), { recursive: true });
  for (const [path, bytes] of Object.entries(entries)) {
    const out = join(fixture, 'nested', path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, bytes);
  }
  // Exercise the actual export dialog with synthetic project data, not a user's saved project or an auth bypass.
  for (const file of runtimeFiles) {
    const out = join(fixture, 'game-player', file.path);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, new Uint8Array(file.bytes));
  }
  await writeFile(join(fixture, 'game-player/bundle.json'), JSON.stringify(manifest));
  const harness = await build({
    stdin: { resolveDir: project, loader: 'tsx', contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { WebGameExportDialog } from './src/components/web-game-export-dialog';
      import { createGameStarterKit } from './src/lib/scene-starter-kits';
      import { createGameCamera } from './src/lib/game-camera';
      import { saveLocalAsset } from './src/lib/asset-vault';
      const kit = createGameStarterKit('shooter', { x: -15, y: 50, z: 0 });
      const snapshot = { entities: kit.entities, camera: createGameCamera(kit.entities),
        assets: kit.generatedAssets.map(item => item.asset), animations: [], animationControllers: [],
        uiControls: [], scripts: [], builderHistory: [], builderDraft: null, builderDraftRequest: '',
        builderBuildLogs: [], prefabs: [] };
      window.testSource = snapshot;
      window.testSourceBefore = JSON.stringify(snapshot);
      const missing = new URLSearchParams(location.search).has('missing');
      const projectId = missing ? 'export-test-missing' : 'export-test-ready';
      async function init() {
        if (!missing) for (const item of kit.generatedAssets) await saveLocalAsset(projectId, item.asset.id, item.file);
        function Harness() {
          const [open, setOpen] = useState(false);
          return <><h1>Synthetic export integration test</h1><p>No account or user project is used here.</p>
            <button data-testid="open-export" onClick={() => setOpen(true)}>Export web game</button>
            {open && <WebGameExportDialog projectId={projectId} name="Synthetic Export" snapshot={snapshot} onClose={() => setOpen(false)} />}
          </>;
        }
        createRoot(document.getElementById('root')).render(<Harness />);
      }
      void init();
    ` },
    bundle: true, platform: 'browser', format: 'esm', write: false, jsx: 'automatic',
    alias: { '@': join(project, 'src') },
    define: { 'import.meta.env.BASE_URL': '"/"', 'process.env.NODE_ENV': '"production"' },
  });
  await writeFile(join(fixture, 'export-check.js'), harness.outputFiles[0].contents);
  await writeFile(join(fixture, 'export-check.css'), await readFile(join(project, 'src/components/studio-projects.css')));
  await writeFile(join(fixture, 'export-check.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Export test harness</title>
    <link rel="stylesheet" href="./export-check.css"><style>body{background:#14171c;color:white;font:14px system-ui;padding:20px}
    button{padding:8px 12px}.studio-project-dialog{background:#20232a;color:white;border:1px solid silver;padding:22px}</style></head>
    <body><div id="root"></div><script type="module" src="./export-check.js"></script></body></html>`);
  console.log('Standalone browser fixture generated at', fixture);
} finally { await rm(temp, { recursive: true, force: true }); }
