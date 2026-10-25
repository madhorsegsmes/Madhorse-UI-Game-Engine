import { build } from 'esbuild';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'madhorse-scene-checks-'));
const fixtures = `
  import { createGameCamera } from './src/lib/game-camera';
  import { createPbrMaterialAsset } from './src/lib/pbr-material';
  function source() {
    const entities = [{id:'cube', name:'Cube', parentId:null, active:true, components:[
      {id:'transform',type:'transform',enabled:true,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
    ]}];
    return { entities, camera:createGameCamera(entities), assets:[], scripts:[], animations:[],
      animationControllers:[], uiControls:[], prefabs:[] };
  }
  function file(id, kind='model') {
    return {id,name:id+'.glb',kind,mimeType:'model/gltf-binary',size:64,addedAt:'2026-01-01T00:00:00.000Z'};
  }
  function damagedSource() {
    const s = source();
    s.entities[0].components.push({id:'primitive',type:'primitive',enabled:true,shape:'cube',color:'#808080',textureAssetId:'missing-texture'});
    s.assets.push(file('missing-local-model'));
    return s;
  }
`;
try {
  if (!process.argv.includes('--preview-only')) {
  const bundle = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { analyzeScene, checkSceneFiles } from './src/lib/scene-readiness';
      import { createWebGameData } from './src/lib/web-game-format';
      import { DEFAULT_SCENE_RENDER_SETTINGS } from './src/hooks/use-scene-render-settings';
      ${fixtures}
      const codes = report => report.findings.map(item => item.code);
      const clean = source();
      const before = JSON.stringify(clean);
      const good = await checkSceneFiles(analyzeScene(clean, 'Game'), [], async () => { throw Error('unexpected lookup'); });
      assert.equal(good.summary.errors, 0);
      assert.equal(good.summary.warnings, 0);
      assert.equal(good.files.complete, true);
      assert.equal(JSON.stringify(clean), before);

      const broken = source();
      broken.entities[0].parentId = 'missing';
      assert(codes(analyzeScene(broken, 'Game')).includes('missing-parent'));
      broken.entities[0].parentId = 'cube';
      assert(codes(analyzeScene(broken, 'Game')).includes('hierarchy-cycle'));
      broken.entities.push(structuredClone(broken.entities[0]));
      assert(codes(analyzeScene(broken, 'Game')).includes('duplicate-object-id'));
      broken.camera.fov = NaN;
      assert(codes(analyzeScene(broken, 'Game')).includes('camera-invalid'));
      assert(codes(analyzeScene(source(), ' ')).includes('project-name'));

      const materialSource = source();
      const mat = createPbrMaterialAsset('Steel');
      mat.pbrMaterial.maps.normal = 'absent';
      mat.size = JSON.stringify(mat.pbrMaterial).length;
      materialSource.assets.push(mat);
      assert(codes(analyzeScene(materialSource, 'Game')).includes('missing-asset'));
      assert.throws(() => createWebGameData('Game', materialSource, DEFAULT_SCENE_RENDER_SETTINGS), /valid image asset/);
      materialSource.assets.push(file('absent', 'audio'));
      assert(codes(analyzeScene(materialSource, 'Game')).includes('asset-kind'));
      assert.throws(() => createWebGameData('Game', materialSource, DEFAULT_SCENE_RENDER_SETTINGS), /valid image asset/);
      materialSource.assets[1].kind = 'image';
      assert.equal(analyzeScene(materialSource, 'Game').summary.errors, 0);
      assert.equal(createWebGameData('Game', materialSource, DEFAULT_SCENE_RENDER_SETTINGS).assets.length, 2);

      const local = source();
      local.assets.push(file('ok'), file('lost'), file('blocked'), file('empty'), file('large'));
      const captured = JSON.stringify(local);
      const checked = await checkSceneFiles(analyzeScene(local, 'Game'), local.assets, async id => {
        if (id === 'blocked') throw Error('storage unavailable');
        if (id === 'lost') return null;
        return {size:id === 'large' ? 101*1024*1024 : id === 'empty' ? 0 : 64};
      });
      assert.equal(checked.files.checked, 4);
      assert.equal(checked.files.missing, 1);
      assert.equal(checked.files.complete, false);
      for (const code of ['file-missing','file-unverified','file-empty','file-limit']) assert(codes(checked).includes(code), code);
      assert.equal(JSON.stringify(local), captured);

      const big = source(); big.assets = Array.from({length:3},(_,i)=>file('big'+i));
      const over = await checkSceneFiles(analyzeScene(big,'Game'), big.assets, async()=>({size:90*1024*1024}));
      assert(codes(over).includes('total-file-limit'));
      const headroom = await checkSceneFiles(analyzeScene(big,'Game'), big.assets, async()=>({size:75*1024*1024}));
      assert(codes(headroom).includes('export-headroom'));

      const many = source(); many.assets = Array.from({length:2001},(_,i)=>file('file'+i));
      let active=0, maxActive=0, lookups=0;
      const bounded = await checkSceneFiles(analyzeScene(many,'Game'), many.assets, async()=> {
        lookups++; active++; maxActive=Math.max(maxActive,active);
        await new Promise(resolve=>setTimeout(resolve,0)); active--; return null;
      });
      assert.equal(lookups,2000); assert(maxActive<=4);
      assert.equal(bounded.files.complete,false); assert.equal(bounded.findings.length,200);
      assert(bounded.omittedFindings>0); assert(codes(bounded).includes('file-missing'));
      assert.equal(bounded.summary.errors,2000);
      assert.equal(bounded.summary.warnings,1);

      const aborter = new AbortController();
      let started=0;
      await assert.rejects(checkSceneFiles(analyzeScene(many,'Game'), many.assets, async()=> {
        started++; aborter.abort(); return {size:1};
      }, aborter.signal), error=>error.name==='AbortError');
      assert(started<=4);
      const pendingAbort = new AbortController();
      const pending = checkSceneFiles(analyzeScene(local,'Game'), local.assets,
        () => new Promise(() => {}), pendingAbort.signal);
      setTimeout(() => pendingAbort.abort(), 5);
      await assert.rejects(pending, error => error.name === 'AbortError');

      const privateSource = source();
      privateSource.scripts.push({id:'script',name:'Script',source:'DO_NOT_INCLUDE_SCRIPT_SOURCE'});
      privateSource.entities[0].components.push({id:'script-component',type:'script',enabled:true,scriptId:'script'});
      const privacy = analyzeScene(privateSource,'Game');
      assert(codes(privacy).includes('offline-script'));
      assert(!JSON.stringify(privacy).includes('DO_NOT_INCLUDE_SCRIPT_SOURCE'));
      const freeze = value => { if (value && typeof value==='object') {Object.freeze(value); Object.values(value).forEach(freeze);} };
      freeze(privateSource);
      analyzeScene(privateSource,'Game');
      console.log('PASS: metadata links, cycles, camera, PBR maps/export guards, file presence/errors/budgets, bounded concurrency/results, cancellation, privacy and source preservation.');
    ` },
    absWorkingDir: project, bundle: true, platform: 'node', format: 'esm',
    packages: 'external', write: false,
  });
  const entry = join(temp, 'checks.mjs');
  await writeFile(entry, bundle.outputFiles[0].text);
  // External packages resolve from the artifact rather than the temporary folder.
  const { spawnSync } = await import('node:child_process');
  const executable = join(project, 'node_modules', '.cache', 'scene-readiness-test.mjs');
  await mkdir(dirname(executable), { recursive: true });
  await writeFile(executable, bundle.outputFiles[0].text);
  try {
    const run = spawnSync(process.execPath, [executable], { cwd: project, encoding: 'utf8' });
    process.stdout.write(run.stdout); process.stderr.write(run.stderr);
    if (run.status !== 0) throw Error('Scene readiness tests failed.');
  } finally { await rm(executable, { force: true }); }
  }

  const preview = resolve(project, '../../generated-artifacts/scene-checks-preview');
  await mkdir(preview, { recursive: true });
  await build({
    stdin: { resolveDir: project, loader: 'tsx', contents: `
      import React from 'react';
      import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom';
      import {SceneReadinessDialog} from './src/components/scene-readiness-dialog';
      ${fixtures}
      const root = createRoot(document.getElementById('root'), {onUncaughtError(error) {
        document.getElementById('root').textContent = String(error); console.error(error);
      }});
      flushSync(() => root.render(
        <SceneReadinessDialog source={damagedSource()} projectId="scene-checks-isolated-fixture"
          projectName="Scene Checks Preview"
          onClose={()=>document.getElementById('root').textContent='Report closed'}
          onInspect={id=>document.getElementById('root').textContent='Inspect requested: '+id} />
      ));
    ` },
    absWorkingDir: project, bundle: true, platform: 'browser', format: 'esm',
    minify: true, jsx: 'automatic',
    plugins: [{ name: 'single-react', setup(builder) {
      const resolve = createRequire(join(project, 'package.json')).resolve;
      builder.onResolve({filter: new RegExp('^react(?:/.*)?$')}, args => ({path: resolve(args.path)}));
    } }],
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.BASE_URL': '"/madhorse-studio/"' },
    outfile: join(preview, 'app.js'),
  });
  const previewUrl = `/madhorse-studio/@fs${preview}`;
  await writeFile(join(preview, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><title>Scene Checks — Isolated Verification</title><link rel="stylesheet" href="${previewUrl}/app.css"></head><body style="margin:0;background:#0e0b15;font-family:Arial,sans-serif"><div id="root"></div><script type="module" src="${previewUrl}/app.js"></script></body></html>`);
  console.log('Generated isolated UI preview using the actual dialog and read-only asset-vault implementation.');
} finally { await rm(temp, { recursive: true, force: true }); }
