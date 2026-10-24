import assert from 'node:assert/strict';
import test from 'node:test';
import { compileBuilderPlan } from '../src/lib/mad-builder';
import { getPrimitive } from '../src/lib/scene-model';
import { getPbrSurfacePreset, matchPbrSurfacePreset, pbrSurfacePresets } from '../src/lib/pbr-surface-presets';

test('surface presets use bounded physically based material values', () => {
  assert.ok(pbrSurfacePresets.every(preset =>
    preset.roughness >= 0 && preset.roughness <= 1 &&
    preset.metalness >= 0 && preset.metalness <= 1 &&
    preset.opacity >= 0.05 && preset.opacity <= 1,
  ));
  assert.equal(getPbrSurfacePreset('glass')?.opacity, 0.25);
  assert.equal(matchPbrSurfacePreset(0.2, 1, 1), 'bare-metal');
  assert.equal(matchPbrSurfacePreset(0.5, 0.1, 1), 'custom');
});

test('Mad Builder persists roughness and metalness on editable scene geometry', () => {
  const build = compileBuilderPlan({
    title: 'Painted test cube',
    summary: 'A cube with a painted surface.',
    warnings: [],
    parts: [{
      key: 'cube',
      parentKey: null,
      kind: 'box',
      shape: 'cube',
      name: 'Painted Cube',
      position: { x: 0, y: 0.5, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      size: { x: 1, y: 1, z: 1 },
      color: '#aabbcc',
      roughness: 0.38,
      metalness: 0.05,
    }],
  }, [], []);
  const primitive = getPrimitive(build.entities.find(entity => entity.name === 'Painted Cube')!);
  assert.equal(primitive?.roughness, 0.38);
  assert.equal(primitive?.metalness, 0.05);
});
