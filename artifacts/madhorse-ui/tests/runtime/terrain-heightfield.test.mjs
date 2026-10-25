import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: `
    export * from './src/lib/terrain-heightfield';
    export { createPrimitiveGeometry } from './src/lib/scene-view-geometry';
    export { createSceneElement, capturePrefab, instantiatePrefab } from './src/lib/scene-authoring';
    export { getPrimitive, getTransform, isSceneGraph, isSceneComponent } from './src/lib/scene-model';
  `, resolveDir: new URL('../../', import.meta.url).pathname },
  bundle: true, write: false, platform: 'node', format: 'esm',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { createTerrainHeightfield, isTerrainHeightfield, sculptTerrain, createPrimitiveGeometry,
  createSceneElement, getPrimitive, getTransform, isSceneGraph, isSceneComponent, capturePrefab, instantiatePrefab } = api;
const dab = (field, mode, extra = {}) => sculptTerrain(field, { x: 0, z: 0, radius: 2, strength: .5, mode, ...extra });
const center = 16 * 33 + 16;

test('legacy procedural terrain and new grid match, with finite geometry and normals', () => {
  const field = createTerrainHeightfield();
  assert.equal(field.heights.length, 1089);
  for (const data of [undefined, field]) {
    const geometry = createPrimitiveGeometry('terrain', data);
    const positions = geometry.getAttribute('position');
    assert.equal(positions.count, 1089);
    for (let i = 0; i < positions.count; i++) {
      const expected = Math.sin(positions.getX(i) * .45) * Math.cos(positions.getZ(i) * .4) * .65 - .05;
      assert.ok(Math.abs(positions.getY(i) - expected) < 1e-6);
    }
    assert.ok([...geometry.getAttribute('normal').array].every(Number.isFinite));
    assert.ok(Number.isFinite(geometry.boundingSphere.radius));
    geometry.dispose();
  }
});

test('raise/lower are localized, immutable, and independent of transforms/cameras', () => {
  const terrain = createSceneElement('terrain', []);
  const transform = structuredClone(getTransform(terrain));
  const field = getPrimitive(terrain).heightfield;
  const original = structuredClone(field);
  const raised = dab(field, 'raise'), lowered = dab(field, 'lower');
  assert.ok(raised.heights[center] > field.heights[center]);
  assert.ok(lowered.heights[center] < field.heights[center]);
  assert.equal(raised.heights[0], field.heights[0]);
  assert.deepEqual(field, original);
  assert.deepEqual(getTransform(terrain), transform);
});

test('smooth reduces a peak using a stable prior neighborhood and handles edges', () => {
  const field = { version: 1, heights: Array(1089).fill(0) };
  field.heights[center] = 8;
  const smooth = dab(field, 'smooth', { strength: 1 });
  assert.ok(smooth.heights[center] < 8);
  assert.ok(smooth.heights[center] > 0);
  assert.equal(smooth.heights[0], 0);
  for (const mode of ['raise', 'lower', 'smooth']) {
    const edge = dab(field, mode, { x: -10, z: -10, radius: 6 });
    assert.ok(isTerrainHeightfield(edge));
  }
});

test('repeated saturated edits remain bounded, finite and renderable', () => {
  let field = createTerrainHeightfield();
  for (const mode of ['raise', 'lower', 'smooth']) {
    for (let i = 0; i < 100; i++) field = dab(field, mode, { strength: 1, radius: 6 });
    assert.ok(isTerrainHeightfield(field));
    const geometry = createPrimitiveGeometry('terrain', field);
    assert.ok([...geometry.getAttribute('position').array, ...geometry.getAttribute('normal').array].every(Number.isFinite));
    geometry.dispose();
  }
});

test('rejects oversized, missing, sparse, nonnumeric, nonfinite and out-of-range data', () => {
  const field = createTerrainHeightfield();
  const invalid = [
    null, {}, { ...field, version: 2 }, { ...field, heights: [] },
    { ...field, heights: Array(1090).fill(0) }, { ...field, heights: Array(1089) },
    ...[NaN, Infinity, -Infinity, 8.001, -8.001, '0', null].map((value) =>
      ({ ...field, heights: field.heights.map((h, i) => i === center ? value : h) })),
  ];
  for (const value of invalid) {
    assert.equal(isTerrainHeightfield(value), false);
    if (value !== undefined) assert.throws(() => createPrimitiveGeometry('terrain', value));
  }
  for (const extra of [{ radius: 0 }, { radius: 100 }, { strength: NaN }, { x: Infinity }, { mode: 'flatten' }]) {
    assert.throws(() => dab(field, 'raise', extra));
  }
});

test('scene JSON round trip and prefab copies retain heights without sharing mutations', () => {
  const terrain = createSceneElement('terrain', []);
  const primitive = getPrimitive(terrain);
  primitive.heightfield = dab(primitive.heightfield, 'raise');
  const restored = JSON.parse(JSON.stringify([terrain]));
  assert.ok(isSceneGraph(restored));
  assert.deepEqual(getPrimitive(restored[0]).heightfield, primitive.heightfield);
  const copy = instantiatePrefab(capturePrefab([terrain], terrain.id, 'Hill', [])).entities[0];
  assert.deepEqual(getPrimitive(copy).heightfield, primitive.heightfield);
  getPrimitive(copy).heightfield.heights[0] = 4;
  assert.notEqual(primitive.heightfield.heights[0], 4);
  const legacy = { ...primitive }; delete legacy.heightfield;
  assert.ok(isSceneComponent(legacy));
  assert.equal(isSceneComponent({ ...primitive, shape: 'cube' }), false);
  assert.equal(isSceneComponent({ ...primitive, heightfield: { version: 1, heights: [] } }), false);
});
