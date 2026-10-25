import { build } from 'esbuild';
import { mkdtemp, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'madhorse-history-'));
try {
  const test = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { SceneEditHistory, describeSceneEdit } from './src/lib/scene-edit-history';
      import { duplicateSceneSelection, filterSceneHierarchy } from './src/lib/scene-object-actions';
      const empty = { entities: [], camera: { x: 0 }, assets: [], animations: [], animationControllers: [], prefabs: [], uiControls: [], scripts: [] };
      const created = { ...empty, entities: [{ id: 'box', name: 'Box', parentId: null, components: [{ type: 'transform', position: { x: 0 } }] }],
        assets: [{ id: 'material' }], animations: [{ targetEntityId: 'box' }], animationControllers: [{ targetEntityId: 'box' }],
        uiControls: [{ id: 'control' }], scripts: [{ id: 'script', content: 'data-only test source' }], prefabs: [{ id: 'prefab' }] };
      const history = new SceneEditHistory(empty);
      assert(!history.summary.canUndo);
      assert.equal(describeSceneEdit(empty, created).label, 'Create Box');
      history.record(created, 'Create Box', null, 1000);
      const moved = structuredClone(created);
      moved.entities[0].components[0].position.x = 5;
      moved.camera.x = 3;
      history.record(moved, 'Edit Box', 'entity:box', 2000);
      const movedAgain = structuredClone(moved);
      movedAgain.entities[0].components[0].position.x = 10;
      history.record(movedAgain, 'Edit Box', 'entity:box', 2100);
      assert.equal(history.summary.steps, 3, 'A continuous gesture should coalesce');
      assert.deepEqual(history.undo().value, created, 'Undo must restore all authored data together');
      assert.deepEqual(history.redo().value, movedAgain);
      assert.deepEqual(history.undo().value, created);
      const removal = { ...empty };
      assert.equal(describeSceneEdit(created, removal).label, 'Delete Box');
      history.record(removal, 'Delete Box', null, 3000);
      assert(!history.summary.canRedo, 'Editing after Undo must discard the abandoned redo branch');
      const recovered = history.undo().value;
      assert.deepEqual(recovered, created, 'Delete undo must recover assets, controllers, UI, scripts and prefabs');
      recovered.entities[0].name = 'Mutated external copy';
      assert.deepEqual(history.redo().value, removal);
      assert.deepEqual(history.undo().value, created, 'Returned snapshots must not mutate stored history');
      const otherProject = new SceneEditHistory({ project: 'other' });
      assert(!otherProject.summary.canUndo, 'New project sessions cannot inherit another project history');
      const bounded = new SceneEditHistory({ n: 0 }, 3, 256);
      for (let n = 1; n < 10; n++) bounded.record({ n }, 'Edit', null, n * 1000);
      assert.equal(bounded.summary.steps, 3);
      assert(bounded.summary.bytes <= 256);
      assert.equal(bounded.undo().value.n, 8); assert.equal(bounded.undo().value.n, 7);
      assert.equal(bounded.undo(), null, 'Trimmed history cannot be restored');
      const oversized = new SceneEditHistory({ n: 0 }, 10, 64);
      oversized.record({ text: 'x'.repeat(1000) }, 'Large edit', null, 1000);
      assert.equal(oversized.summary.steps, 0); assert.equal(oversized.summary.bytes, 0);
      assert(oversized.summary.notice.includes('memory limit'));
      oversized.record({ n: 2 }, 'Small edit', null, 2000);
      assert.equal(oversized.summary.steps, 1); assert(!oversized.summary.canUndo);
      const object = (id, name, parentId = null, components = []) => ({ id, name, parentId, active: true, components });
      const graph = { ...empty, entities: [
        object('outside', 'External parent'),
        object('root', 'Group', 'outside', [{ id: 'transform', type: 'transform', position: { x: 0, y: 0, z: 0 } },
          { id: 'trigger', type: 'triggerZone', logicNodes: [{ id: 'node', type: 'enable-target', targetEntityId: 'leaf' }, { id: 'external-node', type: 'enable-target', targetEntityId: 'outside' }] }]),
        object('child', 'Child', 'root', [{ id: 'mesh', type: 'meshAsset', assetId: 'root', scriptId: 'script' }]),
        object('leaf', 'UI Leaf', 'child', [{ id: 'canvas', type: 'uiCanvas', controlId: 'ui' }]),
        object('old-copy', 'Group (Copy)')],
        assets: [{ id: 'root', fileName: 'shared.glb' }],
        scripts: [{ id: 'script', content: 'root stays source text, not executable code' }],
        uiControls: [{ id: 'ui', style: { color: '#fff' } }],
        animations: [{ id: 'clip', name: 'Idle', targetEntityId: 'leaf', keyframes: [{ id: 'keyframe', position: { x: 0 } }] }],
        animationControllers: [{ id: 'controller', name: 'Idle controller', targetEntityId: 'leaf', states: { idle: ['clip', 'shared-external'] } }],
      };
      const beforeCopy = JSON.stringify(graph);
      const copied = duplicateSceneSelection(graph, 'root');
      assert.equal(copied.count, 3);
      const [rootCopy, childCopy, leafCopy] = copied.state.entities.slice(-3);
      assert.equal(rootCopy.id, copied.rootId); assert.equal(rootCopy.name, 'Group (Copy 2)');
      assert.equal(rootCopy.parentId, 'outside'); assert.equal(childCopy.parentId, rootCopy.id);
      assert.equal(leafCopy.parentId, childCopy.id);
      assert.deepEqual(rootCopy.components[0].position, graph.entities[1].components[0].position);
      assert.notEqual(rootCopy.components[0].id, 'transform');
      assert.equal(rootCopy.components[1].logicNodes[0].targetEntityId, leafCopy.id);
      assert.notEqual(rootCopy.components[1].logicNodes[0].id, 'node');
      assert.equal(rootCopy.components[1].logicNodes[1].targetEntityId, 'outside');
      assert.equal(childCopy.components[0].assetId, 'root', 'Asset references must not be remapped like entity links');
      assert.equal(childCopy.components[0].scriptId, 'script');
      assert.strictEqual(copied.state.scripts, graph.scripts); assert.strictEqual(copied.state.assets, graph.assets);
      assert.notEqual(leafCopy.components[0].controlId, 'ui');
      assert.equal(copied.state.uiControls[1].id, leafCopy.components[0].controlId);
      assert.notStrictEqual(copied.state.uiControls[1].style, graph.uiControls[0].style);
      assert.equal(copied.state.animations[1].targetEntityId, leafCopy.id);
      assert.notEqual(copied.state.animations[1].keyframes[0].id, 'keyframe');
      assert.equal(copied.state.animationControllers[1].targetEntityId, leafCopy.id);
      assert.deepEqual(copied.state.animationControllers[1].states.idle, [copied.state.animations[1].id, 'shared-external']);
      assert.equal(JSON.stringify(graph), beforeCopy, 'Duplication must not mutate source objects or resources');
      const copyHistory = new SceneEditHistory(graph);
      copyHistory.record(copied.state, 'Duplicate group', null, 1000);
      assert.deepEqual(copyHistory.undo().value, graph);
      assert.deepEqual(copyHistory.redo().value, copied.state);
      const found = filterSceneHierarchy(graph.entities, 'ui LEAF');
      assert.equal(found.matches, 1); assert.deepEqual(found.entities.map(entity => entity.id), ['outside', 'root', 'child', 'leaf']);
      assert.equal(filterSceneHierarchy(graph.entities, 'missing [').matches, 0);
      assert.strictEqual(filterSceneHierarchy(graph.entities, '').entities, graph.entities);
      assert.equal(filterSceneHierarchy([object('a', 'Match', 'b'), object('b', 'Other', 'a')], 'match').entities.length, 2);
      assert.throws(() => duplicateSceneSelection(graph, 'absent'), /Select a scene object/);
      const blankCanvasCopy = duplicateSceneSelection({ ...graph, uiControls: [] }, 'root');
      assert.equal(blankCanvasCopy.state.uiControls.length, 0, 'Blank canvases must not fabricate UI definitions');
      assert.notEqual(blankCanvasCopy.state.entities.at(-1).components[0].controlId, 'ui', 'Blank canvas slots need independent IDs');
      assert.throws(() => duplicateSceneSelection({ ...graph, animations: Array.from({ length: 100 }, (_, i) => ({ ...graph.animations[0], id: 'clip' + i })) }, 'root'), /100 animations/);
      assert.throws(() => duplicateSceneSelection({ ...graph, animationControllers: Array.from({ length: 100 }, (_, i) => ({ ...graph.animationControllers[0], id: 'controller' + i })) }, 'root'), /100 animation controllers/);
      assert.throws(() => duplicateSceneSelection({ ...empty, entities: Array.from({ length: 10000 }, (_, i) => object('limit' + i, 'Limit')) }, 'limit0'), /limit/);
      console.log('PASS: subtree duplication, internal/external links, independent UI and clips, shared files, atomic Undo/Redo, hierarchy ancestor search and safety limits.');
      console.log('PASS: scene transactions, drag coalescing, deletion recovery, immutable snapshots, redo invalidation, project isolation, and bounded memory.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  await writeFile(join(temp, 'test.mjs'), test.outputFiles[0].contents);
  await import(pathToFileURL(join(temp, 'test.mjs')).href);
} finally { await rm(temp, { recursive: true, force: true }); }

if (process.env.BUILD_HISTORY_FIXTURE === '1') {
  const root = resolve(project, '../../generated-artifacts/history-smoke-src');
  const outDir = resolve(project, '../../generated-artifacts/history-smoke');
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><title>Scene history integration fixture</title></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>');
  await writeFile(join(root, 'main.tsx'), `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import StudioProjects from '${join(project, 'src/components/studio-projects.tsx')}';
    import { loadStudioProjects, saveStudioProjects } from '${join(project, 'src/lib/studio-projects.ts')}';
    import { loadFreshWorkspace, saveFreshWorkspace } from '${join(project, 'src/lib/fresh-workspace-storage.ts')}';
    import { createGameCamera } from '${join(project, 'src/lib/game-camera.ts')}';
    import '${join(project, 'src/index.css')}';
    const projectId = 'scene-history-synthetic';
    if (!loadStudioProjects().projects.some(project => project.id === projectId)) {
      saveStudioProjects({ activeId: projectId, projects: [{ id: projectId, name: 'Scene History Test' }] });
      saveFreshWorkspace({ projectName: 'Scene History Test', entities: [], camera: createGameCamera([]),
        assets: [], animations: [], animationControllers: [], prefabs: [], uiControls: [], scripts: [],
        builderHistory: [], builderDraft: null, builderDraftRequest: '', builderBuildLogs: [] }, projectId);
    }
    window.historyFixture = { projectId, read: () => loadFreshWorkspace(projectId),
      write: snapshot => saveFreshWorkspace(snapshot, projectId), registry: loadStudioProjects };
    createRoot(document.getElementById('root')).render(<StudioProjects />);
  `);
  const { build: viteBuild } = await import('vite');
  const react = (await import('@vitejs/plugin-react')).default;
  const tailwind = (await import('@tailwindcss/vite')).default;
  await viteBuild({
    configFile: false, root, publicDir: false, base: './',
    plugins: [react(), tailwind()],
    resolve: { alias: {
      '@': join(project, 'src'), '@assets': resolve(project, '../../attached_assets'),
      'react': join(project, 'node_modules/react'), 'react-dom': join(project, 'node_modules/react-dom'),
    }, dedupe: ['react', 'react-dom'] },
    build: { outDir, emptyOutDir: true, sourcemap: false },
  });
  await cp(join(project, 'public/game-player'), join(outDir, 'game-player'), { recursive: true });
  console.log('Synthetic editor fixture:', outDir);
}
