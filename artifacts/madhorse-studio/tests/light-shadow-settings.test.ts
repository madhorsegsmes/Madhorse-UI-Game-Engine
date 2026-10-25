import test from 'node:test';
import assert from 'node:assert/strict';
import { isSceneComponent } from '../src/lib/scene-model';

const directionalLight = {
  id: 'sun',
  type: 'light',
  enabled: true,
  kind: 'directional',
  color: '#ffffff',
  intensity: 1,
} as const;

test('legacy directional lights remain valid and keep their former shadow defaults', () => {
  assert.equal(isSceneComponent(directionalLight), true);
});

test('directional lights accept editable shadow toggle and supported map sizes', () => {
  for (const shadowMapSize of [512, 1024, 2048]) {
    assert.equal(isSceneComponent({ ...directionalLight, castShadow: true, shadowMapSize }), true);
  }
  assert.equal(isSceneComponent({ ...directionalLight, castShadow: false, shadowMapSize: 1024 }), true);
});

test('invalid shadow values are rejected instead of silently persisted', () => {
  assert.equal(isSceneComponent({ ...directionalLight, castShadow: 'yes' }), false);
  assert.equal(isSceneComponent({ ...directionalLight, shadowMapSize: 4096 }), false);
});
