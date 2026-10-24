import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneEditorFramePose } from '../src/lib/scene-view-geometry';
import type { GameCamera } from '../src/lib/game-camera';

const camera: GameCamera = {
  position: { x: 9, y: 6, z: -8 }, target: { x: 5, y: 1, z: 3 }, fov: 50,
};

test('default editor framing centers X at zero and looks at the plane, without moving the authored camera', () => {
  const original = JSON.stringify(camera);
  const pose = sceneEditorFramePose(camera, 16 / 9);
  assert.equal(pose.position.x, 0);
  assert.deepEqual(pose.target, { x: 0, y: 0, z: 0 });
  assert.ok(pose.position.y > 0);
  assert.ok(pose.position.z < 0);
  assert.equal(JSON.stringify(camera), original);
  const zoom = sceneEditorFramePose(camera, 16 / 9, 200);
  assert.equal(zoom.position.y, pose.position.y / 2);
});

test('explicit build/character focus still frames its requested center', () => {
  const center = { x: 7, y: 2, z: 4 };
  const pose = sceneEditorFramePose(camera, 1, 100, { center, radius: 3 });
  assert.deepEqual(pose.target, center);
  assert.equal(pose.position.x, center.x);
  assert.ok(pose.position.y > center.y && pose.position.z < center.z);
});
