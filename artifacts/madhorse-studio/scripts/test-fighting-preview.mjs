import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-fighting-preview-'));
try {
  const result = await build({
    stdin: {
      resolveDir: project, loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import { Vector3 } from 'three';
        import { createGameStarterKit } from './src/lib/scene-starter-kits';
        import { getPrimitive, getTransform, getSpriteRenderer, getModelRenderer, isSceneEntity } from './src/lib/scene-model';
        import { cameraWorldMatrix, makeGameViewCamera } from './src/lib/game-camera';
        import { createFightingPreviewCamera } from './src/lib/fighting-preview-camera';
        import { createCharacterBodyMesh } from './src/lib/character-builder-geometry';
        import { fighterVisualMode, withFighterVisual } from './src/lib/fighter-visual';
        import { withSceneModelAppearance } from './src/lib/scene-model-appearance';

        const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
        const floor = getTransform(starter.entities.find(e => e.name === 'Fighting Stage Floor'));
        assert(Math.abs(floor.position.z / 10 + floor.scale.z / 2) < 1e-8,
          'Stage surface must be at the fighters feet, not above their ankles');
        const roots = starter.entities.filter(e => e.name === 'Player Fighter' || e.name === 'Training Rival');
        assert.equal(roots.length, 2);
        const image = starter.generatedAssets[0].asset;
        const modelAsset = { ...image, id: 'test-model', kind: 'model', name: 'fighter.glb' };
        const rts = createGameStarterKit('rts', { x: -15, y: 50, z: 0 });
        for (const kit of [starter, rts]) {
          const before = JSON.stringify(kit.entities);
          assert(kit.entities.some(entity => entity.components.some(c => c.type === 'skybox')), 'Both templates expose a sky object');
          for (const part of kit.entities.filter(entity => getPrimitive(entity))) {
            const replacement = withSceneModelAppearance(part, modelAsset.id, [modelAsset]);
            assert.equal(replacement.id, part.id);
            assert.equal(getModelRenderer(replacement).assetId, modelAsset.id);
            assert(isSceneEntity(JSON.parse(JSON.stringify(replacement))));
            const restored = withSceneModelAppearance(replacement, '', [modelAsset]);
            assert.equal(getModelRenderer(restored).enabled, false);
            assert.deepEqual(restored.components.filter(c => c.type !== 'modelRenderer'), part.components.filter(c => c.type !== 'modelRenderer'));
          }
          assert.equal(JSON.stringify(kit.entities), before, 'Visual replacement never mutates the original template pieces');
        }
        assert.throws(() => withSceneModelAppearance(starter.entities.find(e => getPrimitive(e)), image.id, [image]), /3D model/);
        for (const root of roots) {
          const originalGameplay = root.components.filter(c => !['modelRenderer', 'spriteRenderer'].includes(c.type));
          const sprite = withFighterVisual(root, 'sprite', image.id, [image, modelAsset]);
          assert.equal(fighterVisualMode(sprite), 'sprite');
          assert.equal(sprite.id, root.id);
          assert.equal(getSpriteRenderer(sprite).height, 18);
          assert.equal(getModelRenderer(sprite).enabled, false);
          assert(isSceneEntity(sprite));
          const model = withFighterVisual(sprite, 'model', modelAsset.id, [image, modelAsset]);
          assert.equal(fighterVisualMode(model), 'model');
          assert.equal(getSpriteRenderer(model).enabled, false);
          assert.equal(getModelRenderer(model).assetId, modelAsset.id);
          const restored = withFighterVisual(model, 'default', '', [image, modelAsset]);
          assert.equal(fighterVisualMode(restored), 'default');
          for (const changed of [sprite, model, restored]) {
            assert.deepEqual(changed.components.filter(c => !['modelRenderer', 'spriteRenderer'].includes(c.type)), originalGameplay);
            assert(isSceneEntity(JSON.parse(JSON.stringify(changed))), 'Replacement survives saved-project serialization');
          }
          assert.throws(() => withFighterVisual(root, 'model', image.id, [image]), /3D model/);
          assert.throws(() => withFighterVisual(root, 'sprite', 'missing', [image]), /2D image/);
          assert.throws(() => withFighterVisual(root, 'sprite', image.id, [image], { width: 0, height: 18 }), /width and height/);
        }
        const parts = starter.entities.filter(e => roots.some(root => root.id === e.parentId) && getPrimitive(e));
        assert(parts.length > 40, 'Both fighters must have real editable geometry');
        for (const root of roots) {
          const body = createCharacterBodyMesh(
            starter.entities.filter(e => e.parentId === root.id),
            { resolution: 24, maxTriangles: 5000 },
          );
          assert(body && body.geometry.drawRange.count > 0, 'Thumbnail renders the actual smooth body');
          assert(body.geometry.drawRange.count <= 15000, 'Thumbnail body has a bounded face budget');
          body.geometry.dispose();
        }
        for (const width of [128, 200, 331.484, 364.375, 480, 720]) {
          const aspect = width / 134;
          const camera = makeGameViewCamera(createFightingPreviewCamera(aspect), aspect);
          for (const part of parts) {
            const matrix = cameraWorldMatrix(starter.entities, part.id);
            assert(matrix, 'Every fighter part has a valid world transform');
            for (const x of [-.5, .5]) for (const y of [-.5, .5]) for (const z of [-.5, .5]) {
              const point = new Vector3(x, y, z).applyMatrix4(matrix).project(camera);
              assert(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1,
                width + 'px preview clips ' + part.name + ': ' + point.toArray());
            }
          }
        }
        for (const aspect of [0, -1, NaN, Infinity]) {
          assert(Number.isFinite(createFightingPreviewCamera(aspect).position.z));
        }
        console.log('PASS: Both fighters support 2D/3D/default replacement without losing gameplay; asset validation, saved data, and camera framing at six card widths pass.');
      `,
    },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'warning',
  });
  const output = join(directory, 'regression.mjs');
  await writeFile(output, result.outputFiles[0].contents);
  await import(pathToFileURL(output).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
