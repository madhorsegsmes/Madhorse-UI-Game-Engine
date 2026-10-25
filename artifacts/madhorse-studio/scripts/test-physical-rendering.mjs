import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(join(tmpdir(), 'madhorse-physical-rendering-'));
try {
  const bundle = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { installReflectionEnvironment, reflectionStrength, FrameIntervalWindow } from './src/lib/physical-rendering';
      import { normalizeSceneRenderSettings, DEFAULT_SCENE_RENDER_SETTINGS } from './src/hooks/use-scene-render-settings';
      let disposed = 0, builds = 0;
      const texture = { id: 'generated' }, customTexture = { id: 'authored-hdr' };
      const scene = { environment: null, environmentIntensity: 1.25 };
      const build = () => { builds++; return { texture, dispose() { disposed++; } }; };
      const environment = installReflectionEnvironment(scene, build, 0.65);
      assert.equal(builds, 1); assert.strictEqual(scene.environment, texture);
      assert.equal(scene.environmentIntensity, .65);
      environment.setIntensity(2.5);
      assert.equal(scene.environmentIntensity, 2); assert.equal(builds, 1, 'Slider changes must not allocate another environment');
      environment.setIntensity(-1); assert.equal(scene.environmentIntensity, 0);
      environment.dispose(); environment.dispose();
      assert.equal(disposed, 1); assert.equal(scene.environment, null); assert.equal(scene.environmentIntensity, 1.25);
      environment.setIntensity(1); assert.equal(scene.environmentIntensity, 1.25);
      scene.environment = customTexture;
      assert.equal(installReflectionEnvironment(scene, build, 1), null);
      assert.equal(builds, 1); assert.strictEqual(scene.environment, customTexture);
      scene.environment = null;
      const replacement = installReflectionEnvironment(scene, build, .5);
      scene.environment = customTexture; scene.environmentIntensity = 1.7;
      replacement.dispose();
      assert.equal(disposed, 2); assert.strictEqual(scene.environment, customTexture);
      assert.equal(scene.environmentIntensity, 1.7, 'Cleanup must not overwrite a subsequently authored environment');
      scene.environment = null;
      assert.throws(() => installReflectionEnvironment(scene, () => { throw new Error('GPU allocation failed'); }, 1), /allocation/);
      assert.equal(scene.environment, null); assert.equal(scene.environmentIntensity, 1.7);
      const restored = installReflectionEnvironment(scene, build, .65);
      assert.strictEqual(scene.environment, texture); restored.dispose();
      assert.equal(disposed, 3, 'A regenerated context environment must be disposable');
      assert.equal(reflectionStrength(Infinity), .65);
      assert.equal(normalizeSceneRenderSettings({}).quality, 'high');
      assert.equal(normalizeSceneRenderSettings({}).environmentReflections, true);
      assert.equal(normalizeSceneRenderSettings({ studioLighting: false }).environmentReflections, false);
      assert.equal(normalizeSceneRenderSettings({ quality: 'performance' }).environmentReflections, false);
      const saved = normalizeSceneRenderSettings({ ...DEFAULT_SCENE_RENDER_SETTINGS, quality: 'balanced', environmentReflections: false, reflectionIntensity: 1.2 });
      assert.equal(saved.quality, 'balanced'); assert.equal(saved.environmentReflections, false);
      assert.equal(saved.reflectionIntensity, 1.2);
      assert.deepEqual(normalizeSceneRenderSettings(JSON.parse(JSON.stringify(saved))), saved);
      assert.equal(normalizeSceneRenderSettings({ reflectionIntensity: -10 }).reflectionIntensity, 0);
      assert.equal(normalizeSceneRenderSettings({ reflectionIntensity: Infinity }).reflectionIntensity, .65);
      const intervals = new FrameIntervalWindow(180);
      assert.equal(intervals.summary, null);
      intervals.push(NaN); intervals.push(Infinity); intervals.push(0); intervals.push(-1);
      assert.equal(intervals.summary, null);
      for (let i = 0; i < 60; i++) intervals.push(1 / 60);
      assert(Math.abs(intervals.summary.fps - 60) < .0001);
      assert.equal(intervals.summary.overBudget, false);
      intervals.push(1);
      assert.equal(intervals.summary.worstMs, 1000, 'Visible stutters must not be hidden by delta clamping');
      assert(intervals.summary.fps < 60);
      for (let i = 0; i < 200; i++) intervals.push(1 / 30);
      assert.equal(intervals.summary.frames, 180); assert.equal(intervals.summary.overBudget, true);
      assert(Math.abs(intervals.summary.p95Ms - 1000 / 30) < .0001);
      intervals.reset(); assert.equal(intervals.summary, null);
      assert.equal(new FrameIntervalWindow(100000).capacity, 600);
      console.log('PASS: reflection ownership, cleanup, custom HDR priority, strength limits, saved quality compatibility, bounded real-frame statistics, p95 and visible stutters.');
      console.log('GPU shading and context restoration still require a real WebGL-capable browser; these resource tests do not prove image quality or frame rate.');
    ` }, bundle: true, platform: 'node', format: 'esm', write: false,
  });
  await writeFile(join(temp, 'test.mjs'), bundle.outputFiles[0].contents);
  await import(pathToFileURL(join(temp, 'test.mjs')).href);
} finally {
  await rm(temp, { recursive: true, force: true });
}
