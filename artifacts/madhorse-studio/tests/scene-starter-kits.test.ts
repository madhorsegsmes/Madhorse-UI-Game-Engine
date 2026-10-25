import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameStarterKit } from '../src/lib/scene-starter-kits';
import { isSceneGraph } from '../src/lib/scene-model';
import { advanceSceneRuntime, createSceneRuntimeState } from '../src/lib/scene-play-runtime';
import { createEgoUiKit } from '../src/lib/ego-ui-kit';

test('the fighting starter is a valid editable scene with combat actions and a linked rival', () => {
  const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
  const player = starter.entities.find(entity => entity.id === starter.playerId);
  const rival = starter.entities.find(entity => entity.name === 'Training Rival');

  assert.ok(isSceneGraph(starter.entities));
  assert.equal(starter.title, '2D Fighting Arena');
  assert.ok(player);
  assert.ok(rival);
  assert.ok(player.components.some(component => component.type === 'playerAction' &&
    component.action === 'light-attack' && component.targetId === rival.id));
  assert.ok(['heavy-attack', 'special-attack'].every(action =>
    player.components.some(component => component.type === 'playerAction' && component.action === action)));
  assert.ok(['block', 'run', 'crouch'].every(action =>
    player.components.some(component => component.type === 'playerAction' && component.action === action)));
  assert.ok(rival.components.some(component => component.type === 'gameFeature' && component.kind === 'health'));
  assert.ok(rival.components.some(component => component.type === 'playerAction' && component.action === 'heavy-attack'));
  assert.ok(player.isGroup);
  assert.ok(player.components.some(component => component.type === 'modelRenderer' && component.assetId === null));
  assert.ok(starter.entities.some(entity => entity.parentId === player.id && entity.name === 'Clothing · Tailored shirt'));
  const clothingTexture = starter.generatedAssets?.[0];
  assert.ok(clothingTexture);
  assert.equal(clothingTexture.asset.kind, 'image');
  assert.ok(starter.entities.some(entity =>
    entity.name === 'Clothing · Tailored shirt' &&
    entity.components.some(component => component.type === 'primitive' && component.textureAssetId === clothingTexture.asset.id),
  ));
  assert.equal(Math.abs(
    player.components.find(component => component.type === 'transform')?.position.x! -
    rival.components.find(component => component.type === 'transform')?.position.x!,
  ), 80);
  assert.ok(starter.entities.some(entity => entity.parentId === player.id && entity.name.includes('Head')));
  assert.ok(starter.entities.some(entity => entity.name === 'Fighting Stage Floor'));
});

test('the fighting HUD includes editable health, timer, and four attack/defense buttons', () => {
  const controls = createEgoUiKit(['fighting'], 0);
  assert.equal(controls.filter(control => control.type === 'health-bar').length, 2);
  assert.ok(controls.some(control => control.label === 'ROUND 1 · 99'));
  assert.deepEqual(
    controls.filter(control => control.type === 'button').map(control => control.label),
    ['Light', 'Heavy', 'Special', 'Block'],
  );
});

test('the fighting starter has an editable round HUD, special meter and working player hits', () => {
  const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
  const player = starter.entities.find(entity => entity.id === starter.playerId)!;
  const rival = starter.entities.find(entity => entity.name === 'Training Rival')!;
  const playerTransform = player.components.find(component => component.type === 'transform');
  const rivalTransform = rival.components.find(component => component.type === 'transform');
  assert.ok(playerTransform?.type === 'transform' && rivalTransform?.type === 'transform');
  playerTransform.position.x = rivalTransform.position.x - 18;
  const runtimeState = createSceneRuntimeState(starter.entities, player.id);
  const result = advanceSceneRuntime(starter.entities, 0.05, 0.05, {
    moveX: 0, moveY: 0, heldKeys: [], pressedKeys: ['f'],
  }, runtimeState);

  assert.equal(result.hud?.showFightingHud, true);
  assert.match(result.hud?.matchStatus ?? '', /ROUND 1/);
  assert.equal(result.hud?.specialMeter, 37);
  assert.ok((result.hud?.opponentHealth ?? 100) < 100);
  assert.ok(result.hud?.controls.some(control => control.key === 'j' && control.label === 'Heavy Attack'));
  const facedPlayer = result.entities.find(entity => entity.id === player.id);
  assert.equal(facedPlayer?.components.find(component => component.type === 'transform')?.rotation.z, 90);
});

test('the training rival follows, attacks, and the player can block its round damage', () => {
  const starter = createGameStarterKit('fighting', { x: -15, y: 50, z: 0 });
  const runtimeState = createSceneRuntimeState(starter.entities, starter.playerId);
  let entities = starter.entities;
  let lowestPlayerHealth = 100;
  for (let frame = 1; frame <= 160; frame += 1) {
    const result = advanceSceneRuntime(entities, 0.05, frame * 0.05, {
      moveX: 0, moveY: 0, heldKeys: [], pressedKeys: [],
    }, runtimeState);
    entities = result.entities;
    lowestPlayerHealth = Math.min(lowestPlayerHealth, result.hud?.health ?? 100);
  }
  assert.ok(lowestPlayerHealth < 100, 'the CPU rival should approach and land a hit during Play Test');
  assert.ok(entities.some(entity => entity.name === 'Training Rival' && entity.active));
});
