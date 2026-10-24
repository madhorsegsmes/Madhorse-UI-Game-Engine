import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgoUiKit, egoGameTypes, egoPlayerActions, getEgoGameLabel } from '../src/lib/ego-ui-kit';
import { analyzeEgoGameVision } from '../src/lib/ego-game-language';
import { createEgoWorkspaceContext } from '../src/lib/ego-workspace-context';
import { createSceneEntity } from '../src/lib/scene-model';
import { PRIMARY_CAMERA_ID } from '../src/lib/camera-editor';

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

test('Ego reads current project and interface mode without a pixel capture', () => {
  const camera = { position: { x: 0, y: 6, z: -8 }, target: { x: 0, y: 0, z: 0 }, fov: 50 };
  const ui = { projectName: 'My Game', view: 'canvas' as const, toolset: 'world' as const, activeTool: 'Raise terrain', inspectorName: null };
  const context = createEgoWorkspaceContext({ entities: [], assets: [] }, PRIMARY_CAMERA_ID, camera, ui);
  assert.equal(context.selectedName, 'Game Camera');
  assert.match(context.interfaceSummary!, /My Game.*Canvas \/ Game Camera.*Raise terrain/);
  assert.match(context.plannerSummary, /Project: My Game/);
  assert.ok(context.steps.some(step => step.includes('Press Canvas again')));
  const playContext = createEgoWorkspaceContext({ entities: [], assets: [] }, null, camera, { ...ui, view: 'play', inspectorName: 'Hero' });
  assert.ok(playContext.steps.some(step => step.includes('Stop Play Test')));
  assert.match(playContext.interfaceSummary!, /editing Hero/);
  assert.ok(playContext.steps.some(step => step.includes('Press Settings')));
});
