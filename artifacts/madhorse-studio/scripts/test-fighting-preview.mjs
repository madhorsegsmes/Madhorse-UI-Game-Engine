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
        import { getPrimitive, getTransform } from './src/lib/scene-model';
        import { cameraWorldMatrix, makeGameViewCamera } from './src/lib/game-camera';
        import { createFightingPreviewCamera } from './src/lib/fighting-preview-camera';
        import { createCharacterBodyMesh } from './src/lib/character-builder-geometry';

        const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
        const floor = getTransform(starter.entities.find(e => e.name === 'Fighting Stage Floor'));
        assert(Math.abs(floor.position.z / 10 + floor.scale.z / 2) < 1e-8,
          'Stage surface must be at the fighters feet, not above their ankles');
        const roots = starter.entities.filter(e => e.name === 'Player Fighter' || e.name === 'Training Rival');
        assert.equal(roots.length, 2);
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
        console.log('PASS: Both editable fighter models fit inside the template camera at six card widths; invalid aspect ratios are safe.');
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
