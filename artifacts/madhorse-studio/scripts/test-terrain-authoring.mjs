import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'madhorse-terrain-'));
try {
  const result = await build({
    stdin: {
      resolveDir: dirname(dirname(fileURLToPath(import.meta.url))),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import { createPhysicsComponent, createSceneEntity, getPrimitive, getTransform, isSceneGraph, isSceneEntity, SCENE_ORIGIN } from './src/lib/scene-model';
        import { appendTerrainBrushEdit, createTerrainTreeGrove, createTerrainWater } from './src/lib/terrain-authoring';
        import { createPrimitiveGeometry } from './src/lib/scene-view-geometry';

        const terrain = createSceneEntity('Terrain', SCENE_ORIGIN, null, false);
        terrain.components = [
          getTransform(terrain),
          createPhysicsComponent('static'),
          {
            id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'terrain',
            color: '#62745b', textureAssetId: null,
            terrainSettings: { width: 40, depth: 40, height: 12, mountainHeight: 24, riverDepth: 5, riverCount: 1 },
          },
        ];
        assert(isSceneEntity(terrain));
        const unchanged = JSON.stringify(terrain);
        const raised = appendTerrainBrushEdit(terrain, 'raise');
        const lowered = appendTerrainBrushEdit(terrain, 'lower');
        const smoothed = appendTerrainBrushEdit(terrain, 'smooth');
        assert(raised && lowered && smoothed);
        assert.equal(JSON.stringify(terrain), unchanged, 'brush tools do not mutate the saved input scene');
        assert.equal(getPrimitive(raised).terrainEdits[0].action, 'raise');
        assert.equal(getPrimitive(lowered).terrainEdits[0].action, 'lower');
        assert.equal(getPrimitive(smoothed).terrainEdits[0].action, 'smooth');
        const center = 48 * 97 + 48;
        const baseHeight = createPrimitiveGeometry('terrain', getPrimitive(terrain).terrainSettings).getAttribute('position').getY(center);
        const raisedHeight = createPrimitiveGeometry('terrain', getPrimitive(raised).terrainSettings, getPrimitive(raised).terrainEdits).getAttribute('position').getY(center);
        const loweredHeight = createPrimitiveGeometry('terrain', getPrimitive(lowered).terrainSettings, getPrimitive(lowered).terrainEdits).getAttribute('position').getY(center);
        const smoothedGeometry = createPrimitiveGeometry('terrain', getPrimitive(smoothed).terrainSettings, getPrimitive(smoothed).terrainEdits);
        const baseGeometry = createPrimitiveGeometry('terrain', getPrimitive(terrain).terrainSettings);
        const neighbor = center + 1;
        assert(raisedHeight > baseHeight, 'raise terrain changes the mesh up');
        assert(loweredHeight < baseHeight, 'lower terrain changes the mesh down');
        assert(
          Math.abs(smoothedGeometry.getAttribute('position').getY(center) - baseGeometry.getAttribute('position').getY(neighbor)) <
            Math.abs(baseHeight - baseGeometry.getAttribute('position').getY(neighbor)),
          'smooth terrain reduces the height difference at the brush center',
        );
        assert.equal(getPrimitive(JSON.parse(JSON.stringify(raised))).terrainEdits.length, 1, 'terrain edits survive project JSON saves');

        let full = terrain;
        for (let index = 0; index < 128; index++) full = appendTerrainBrushEdit(full, 'raise');
        assert.equal(appendTerrainBrushEdit(full, 'raise'), null, 'terrain edit storage is bounded');

        const grove = createTerrainTreeGrove(terrain);
        assert.equal(grove.filter(entity => /^Tree \\d+$/.test(entity.name)).length, 3, 'a grove contains three editable trees');
        assert.equal(grove.filter(entity => getPrimitive(entity)?.shape === 'cylinder').length, 3, 'each tree has a trunk');
        assert.equal(grove.filter(entity => getPrimitive(entity)?.shape === 'cone').length, 3, 'each tree has a canopy');
        const water = createTerrainWater(terrain);
        assert.equal(getPrimitive(water).shape, 'plane');
        assert.equal(getPrimitive(water).color, '#429ed1');
        assert(isSceneGraph([terrain, ...grove, water]), 'trees and water are valid, parented scene entities');
        console.log('PASS: terrain raise/lower/smooth mesh edits, bounded saved strokes, editable tree grove, water plane, and valid scene hierarchy.');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  const path = join(directory, 'test.mjs');
  await writeFile(path, result.outputFiles[0].text);
  await import(pathToFileURL(path).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
