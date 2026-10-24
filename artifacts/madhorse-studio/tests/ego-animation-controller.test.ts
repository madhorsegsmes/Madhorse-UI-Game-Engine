import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEgoAnimationController, createEgoAnimationPack, isEgoAnimationControllerCollection } from '../src/lib/ego-animation-controller';
import { isGameAnimationCollection } from '../src/lib/game-api';
import { createEgoCharacterScene } from '../src/lib/character-builder-starter';
import { getTransform } from '../src/lib/scene-model';
import { advanceSceneRuntime, createSceneRuntimeState } from '../src/lib/scene-play-runtime';
import { createPlayerAction } from '../src/lib/player-action-model';

test('Ego builds editable action clips and a valid genre controller for a character', () => {
  const scene = createEgoCharacterScene('human', 1.8);
  const pack = createEgoAnimationPack(scene.entities, scene.characterId, ['fighting', 'kart-racing']);

  assert.ok(isGameAnimationCollection(pack.animations));
  assert.ok(isEgoAnimationControllerCollection([pack.controller]));
  assert.ok(pack.controller.states.idle?.length);
  assert.ok(pack.controller.states.walk?.length);
  assert.ok(pack.controller.states.attack?.length);
  assert.ok(pack.controller.states.drive?.length);

  const walkClip = pack.animations.find(animation =>
    animation.id === pack.controller.states.walk?.[0],
  );
  assert.ok(walkClip);
  const before = scene.entities.find(entity => entity.id === walkClip.targetEntityId);
  assert.ok(before);
  const originalRotation = getTransform(before).rotation.x;
  const animated = applyEgoAnimationController(scene.entities, pack.animations, pack.controller, 'walk', 0.1);
  const after = animated.find(entity => entity.id === walkClip.targetEntityId);
  assert.ok(after);
  assert.notEqual(getTransform(after).rotation.x, originalRotation);
});

test('Play/Test reports locomotion and combat animation states from controls', () => {
  const player = {
    id: 'player-test',
    name: 'Player',
    parentId: null,
    active: true,
    components: [
      {
        id: 'transform-test',
        type: 'transform' as const,
        enabled: true as const,
        position: { x: 50, y: 50, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      {
        id: 'controller-test',
        type: 'characterController' as const,
        enabled: true,
        role: 'player' as const,
        perspective: 'third-person' as const,
        behavior: 'direct-control' as const,
        moveSpeed: 4,
        jumpHeight: 1,
        followDistance: 2,
        patrolRadius: 2,
      },
      createPlayerAction('run'),
      createPlayerAction('fight'),
    ],
  };
  const state = createSceneRuntimeState([player], player.id);
  const running = advanceSceneRuntime([player], 1 / 60, 1, {
    moveX: 1, moveY: 0, jumpPressed: false, heldKeys: ['shift'], pressedKeys: [],
  }, state);
  assert.equal(running.animationState, 'run');

  const attacking = advanceSceneRuntime([player], 1 / 60, 1.1, {
    moveX: 0, moveY: 0, jumpPressed: false, heldKeys: [], pressedKeys: ['f'],
  }, state);
  assert.equal(attacking.animationState, 'attack');
});

test('creature controllers animate wings, fins, and segmented bodies', () => {
  for (const species of ['avian', 'aquatic', 'serpentine', 'insectoid', 'dragon'] as const) {
    const scene = createEgoCharacterScene(species, 1.8);
    const pack = createEgoAnimationPack(scene.entities, scene.characterId, ['rpg']);
    assert.ok(isGameAnimationCollection(pack.animations), species);
    assert.ok(isEgoAnimationControllerCollection([pack.controller]), species);
    assert.ok(pack.controller.states.walk?.length, species);
    assert.ok(pack.controller.states.attack?.length, species);
    const targetIds = new Set(scene.entities.map(entity => entity.id));
    assert.ok(pack.animations.every(clip => targetIds.has(clip.targetEntityId)));
    if (species === 'avian' || species === 'dragon') {
      assert.ok(pack.animations.some(clip => clip.name.includes('Wing motion')));
    }
    if (species === 'aquatic') {
      assert.ok(pack.animations.some(clip => clip.name.includes('Tail sway')));
    }
  }
});
