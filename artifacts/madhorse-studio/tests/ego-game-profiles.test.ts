import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgoUiKit, egoGameTypes, egoPlayerActions, getEgoGameLabel } from '../src/lib/ego-ui-kit';
import { analyzeEgoGameVision } from '../src/lib/ego-game-language';
import { createEgoWorkspaceContext } from '../src/lib/ego-workspace-context';
import { createSceneEntity } from '../src/lib/scene-model';

test('Ego includes shooter, kingdom strategy, and separate 2D/3D creature adventure profiles', () => {
  const values = new Set(egoGameTypes.map(type => type.value));
  for (const value of [
    'third-person-shooter',
    'kingdom-strategy',
    'creature-adventure-2d',
    'creature-adventure-3d',
  ] as const) assert.ok(values.has(value));

  assert.equal(getEgoGameLabel('third-person-shooter'), 'Third-Person Shooter');
  assert.ok(egoPlayerActions['third-person-shooter'].includes('shoot'));
  assert.ok(egoPlayerActions['kingdom-strategy'].includes('command'));
  assert.ok(egoPlayerActions['creature-adventure-2d'].includes('follow'));
  assert.ok(createEgoUiKit(['kingdom-strategy'], 0).some(item => item.label === 'Kingdom Resources'));
  assert.ok(createEgoUiKit(['creature-adventure-2d'], 0).some(item => item.label === 'Party'));
});

test('Ego maps natural game descriptions to the new genre guidance', () => {
  const analysis = analyzeEgoGameVision('Build a kingdom strategy and a 2D creature collection adventure with a third person shooter mode.');
  const concepts = new Set(analysis.detected.map(entry => entry.concept.id));
  assert.ok(concepts.has('third-person-shooter'));
  assert.ok(concepts.has('kingdom-strategy'));
  assert.ok(concepts.has('creature-adventure'));
});

test('Ego guide reflects current selection, camera, scene objects, and reusable assets', () => {
  const hero = createSceneEntity('Hero', { x: 50, y: 50, z: 0 }, null, false);
  const project = {
    entities: [hero],
    assets: [{ id: 'model-hero', name: 'hero.glb', kind: 'model' as const, mimeType: 'model/gltf-binary', size: 120, addedAt: 'now' }],
  };
  const context = createEgoWorkspaceContext(project, hero.id, {
    position: { x: 0, y: 6, z: -8 },
    target: { x: 0, y: 0, z: 0 },
    fov: 50,
  });

  assert.equal(context.selectedName, 'Hero');
  assert.equal(context.activeObjectCount, 1);
  assert.equal(context.assets[0]?.name, 'hero.glb');
  assert.match(context.plannerSummary, /hero\.glb|asset IDs and names are supplied separately/);
  assert.ok(context.steps.some(step => step.includes('Panel 3')));
  assert.ok(context.steps.some(step => step.includes('Panel 5')));
});
