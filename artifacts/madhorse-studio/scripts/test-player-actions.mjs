import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'madhorse-actions-'));
try {
  const bundle = await build({
    stdin: {
      resolveDir: dirname(dirname(fileURLToPath(import.meta.url))),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import { createStarterCube, getTransform, isSceneEntity } from './src/lib/scene-model';
        import { createPluginComponent, matchesPluginComponent } from './src/lib/scene-plugin-catalog';
        import { playerActionNames, playerActionDraft, playerActionFromDraft, playerActionPrefix } from './src/lib/player-action-model';
        import { createGameFeature, gameFeatureNames, gameFeatureDraft, gameFeatureFromDraft, gameFeaturePrefix } from './src/lib/game-feature-model';
        import { advanceSceneRuntime, createSceneRuntimeState } from './src/lib/scene-play-runtime';
        const idle = { moveX: 0, moveY: 0, jumpPressed: false, heldKeys: [], pressedKeys: [] };
        const player = (...actions) => {
          const entity = createStarterCube();
          entity.id = 'player';
          entity.components.push(createPluginComponent('character-controller-player', 0).component);
          for (const action of actions) entity.components.push(createPluginComponent('action-' + action, 0).component);
          return entity;
        };
        const target = (y = 70, x = 50) => {
          const entity = createStarterCube();
          entity.id = 'target'; entity.name = 'Practice Target';
          Object.assign(getTransform(entity).position, { x, y });
          return entity;
        };
        const action = (entity, kind) => entity.components.find(c => c.type === 'playerAction' && c.action === kind);
        const feature = (entity, kind) => entity.components.find(c => c.type === 'gameFeature' && c.kind === kind);
        const attachFeatures = (entity, ...kinds) => {
          for (const kind of kinds) entity.components.push(createPluginComponent('feature-' + kind, 0).component);
          return entity;
        };
        const step = (scene, state, input = idle, time = .05) => advanceSceneRuntime(scene, .05, time, { ...idle, ...input }, state);
        const all = player(...playerActionNames);
        assert(isSceneEntity(all), 'all seven plugins coexist and validate');
        for (const name of playerActionNames) {
          const component = action(all, name);
          assert(matchesPluginComponent(component, 'action-' + name));
          assert.deepEqual(playerActionFromDraft(component, playerActionDraft(component)), component);
        }
        assert(!matchesPluginComponent(action(all, 'run'), 'action-crouch'));
        const bad = structuredClone(all);
        action(bad, 'crouch').key = action(bad, 'run').key;
        assert(!isSceneEntity(bad), 'conflicting controls rejected');
        action(bad, 'crouch').enabled = false;
        assert(isSceneEntity(bad), 'disabled action may reuse a key');
        const invalid = structuredClone(all);
        action(invalid, 'craft').settings.woodCost = 1.5;
        assert(!isSceneEntity(invalid), 'fractional recipe costs rejected');

        const walker = player('run', 'crouch');
        const snapshot = JSON.stringify(walker);
        const walking = step([walker], createSceneRuntimeState([walker]), { moveX: 1 });
        const running = step([walker], createSceneRuntimeState([walker]), { moveX: 1, heldKeys: ['shift'] });
        assert.equal(getTransform(running.entities[0]).position.x - 50, 2 * (getTransform(walking.entities[0]).position.x - 50));
        assert.equal(running.audioEvents[0].action, 'run');
        const crouchState = createSceneRuntimeState([walker]);
        const crouching = step([walker], crouchState, { moveX: 1, heldKeys: ['c', 'shift'] });
        assert.equal(getTransform(crouching.entities[0]).scale.z, .55);
        assert.equal(crouching.hud.mode, 'Crouching', 'crouch takes priority over run');
        const stand = step(crouching.entities, crouchState, idle, .1);
        assert.equal(getTransform(stand.entities[0]).scale.z, 1, 'standing restores original height');
        assert.equal(JSON.stringify(walker), snapshot, 'movement never changes authored scene');
        const custom = player('run');
        const draft = playerActionDraft(action(custom, 'run'));
        draft[playerActionPrefix(action(custom, 'run').id) + 'key'] = 'q';
        draft[playerActionPrefix(action(custom, 'run').id) + 'speedMultiplier'] = '3';
        custom.components = custom.components.map(c => c.type === 'playerAction' ? playerActionFromDraft(c, draft) : c);
        assert(isSceneEntity(custom));
        assert.equal(step([custom], createSceneRuntimeState([custom]), { moveX: 1, heldKeys: ['q'] }).hud.mode, 'Running');
        action(custom, 'run').enabled = false;
        assert.equal(step([custom], createSceneRuntimeState([custom]), { moveX: 1, heldKeys: ['q'] }).audioEvents.length, 0);

        const fighter = player('fight');
        const combatScene = [fighter, target()];
        const combatSaved = JSON.stringify(combatScene);
        const combatState = createSceneRuntimeState(combatScene);
        let combat = step(combatScene, combatState, { pressedKeys: ['f'] });
        assert.equal(combatState.actions.health.get('target'), 75);
        assert.equal(combat.audioEvents[0].action, 'fight');
        combat = step(combat.entities, combatState, { pressedKeys: ['f'] }, .1);
        assert.equal(combatState.actions.health.get('target'), 75, 'cooldown blocks rapid repeat');
        for (const time of [.6, 1.1, 1.6]) combat = step(combat.entities, combatState, { pressedKeys: ['f'] }, time);
        assert.equal(combat.entities.find(e => e.id === 'target').active, false);
        assert.equal(JSON.stringify(combatScene), combatSaved, 'defeated targets remain in saved scene');
        const expired = step(combat.entities, combatState, idle, 2);
        assert(!expired.entities.some(e => e.id.startsWith('runtime-effect-')), 'temporary visuals expire');
        const shooter = player('shoot');
        const shootScene = [shooter, target(200)];
        const shootState = createSceneRuntimeState(shootScene);
        const shot = step(shootScene, shootState, { pressedKeys: ['j'] });
        assert.equal(shootState.actions.health.get('target'), 80);
        assert(shot.entities.some(e => e.id.startsWith('runtime-effect-')), 'shots have visible tracers');
        assert.equal(shot.audioEvents[0].action, 'shoot');
        const offAimScene = [shooter, target(50, 200)];
        const offAimState = createSceneRuntimeState(offAimScene);
        step(offAimScene, offAimState, { pressedKeys: ['j'] });
        assert(!offAimState.actions.health.has('target'), 'off-axis targets are not hit');
        action(shooter, 'shoot').targetId = 'target';
        const aimedState = createSceneRuntimeState(offAimScene);
        step(offAimScene, aimedState, { pressedKeys: ['j'] });
        assert.equal(aimedState.actions.health.get('target'), 80, 'chosen target receives aimed shot');

        const racer = player('race');
        const raceState = createSceneRuntimeState([racer]);
        let racing = step([racer], raceState, { moveY: 1, pressedKeys: ['r'] });
        assert.equal(racing.hud.mode, 'Driving');
        assert(getTransform(racing.entities[0]).position.y > 50);
        racing = step(racing.entities, raceState, { moveY: 1, moveX: 1 }, .1);
        assert(getTransform(racing.entities[0]).rotation.z > 0, 'steering rotates vehicle');
        assert(racing.hud.speed > 0);
        const parked = step(racing.entities, raceState, { pressedKeys: ['r'] }, .15);
        assert.equal(parked.hud.mode, 'Walking');
        assert.equal(parked.hud.speed, 0);

        const builder = player('craft', 'build');
        const buildSaved = JSON.stringify(builder);
        const buildState = createSceneRuntimeState([builder]);
        const crafted = step([builder], buildState, { pressedKeys: ['k'] });
        assert.equal(crafted.hud.wood, 8);
        assert.equal(crafted.hud.planks, 7);
        assert.equal(crafted.audioEvents[0].action, 'craft');
        const built = step(crafted.entities, buildState, { pressedKeys: ['b'] }, .4);
        assert.equal(built.hud.planks, 6);
        const block = built.entities.find(e => e.id.startsWith('runtime-build-'));
        assert(block && isSceneEntity(block), 'building creates real valid geometry');
        assert.equal(built.audioEvents[0].action, 'build');
        const overlap = step(built.entities, buildState, { pressedKeys: ['b'] }, .8);
        assert.equal(overlap.hud.planks, 6, 'blocked placements do not use resources');
        assert.equal(overlap.entities.filter(e => e.id.startsWith('runtime-build-')).length, 1);
        assert.match(overlap.hud.message, /blocked/);
        assert.equal(JSON.stringify(builder), buildSaved, 'inventory and buildings do not mutate authoring data');
        const reset = step([builder], createSceneRuntimeState([builder]));
        assert.equal(reset.hud.wood, 10);
        assert.equal(reset.hud.planks, 3);
        assert.equal(reset.entities.length, 1);
        const empty = player('craft', 'build');
        action(empty, 'craft').settings.startingWood = 0;
        action(empty, 'build').settings.startingPlanks = 0;
        const noResources = step([empty], createSceneRuntimeState([empty]), { pressedKeys: ['k', 'b'] });
        assert.equal(noResources.audioEvents.length, 0);
        assert.equal(noResources.entities.length, 1);
        assert.equal(noResources.hud.planks, 0);
        const other = player('run'); other.id = 'other';
        const preferred = step([walker, other], createSceneRuntimeState([walker, other], 'other'), { moveX: 1 });
        assert.equal(getTransform(preferred.entities.find(e => e.id === 'player')).position.x, 50);
        assert(getTransform(preferred.entities.find(e => e.id === 'other')).position.x > 50);
        const allFeatures = attachFeatures(player(), ...gameFeatureNames);
        assert(isSceneEntity(allFeatures), 'all nine new plugin types can share one object');
        for (const name of gameFeatureNames) {
          const part = feature(allFeatures, name);
          assert(isSceneEntity({ ...allFeatures, components: allFeatures.components.map(c => c === part ? gameFeatureFromDraft(part, gameFeatureDraft(part)) : c) }));
          assert(isSceneEntity({ ...createStarterCube(), components: [...createStarterCube().components, part] }));
        }
        const invalidFeatures = structuredClone(allFeatures);
        feature(invalidFeatures, 'health').settings.startingHealth = 101;
        assert(!isSceneEntity(invalidFeatures), 'starting health cannot exceed maximum');
        const conflictingFeatures = structuredClone(allFeatures);
        feature(conflictingFeatures, 'interact').settings.key = 'c';
        conflictingFeatures.components.push(createPluginComponent('action-crouch', 0).component);
        assert(!isSceneEntity(conflictingFeatures), 'interact key conflicts cannot be saved');
        const featureAudio = feature(allFeatures, 'door');
        featureAudio.volume = 1.1;
        assert(!isSceneEntity(allFeatures), 'feature sound volume is bounded');

        const collector = attachFeatures(player(), 'health', 'inventory', 'interact', 'status-bar');
        const woodPickup = target(65);
        const pickup = createPluginComponent('feature-pickup', 0).component;
        pickup.settings.item = 'wood'; pickup.settings.amount = 5;
        woodPickup.components.push(pickup);
        const pickupScene = [collector, woodPickup];
        const pickupSaved = JSON.stringify(pickupScene);
        const pickupState = createSceneRuntimeState(pickupScene);
        const gathered = step(pickupScene, pickupState, { pressedKeys: ['e'] });
        assert.equal(gathered.hud.wood, 15);
        assert.equal(gathered.hud.health, 100);
        assert.equal(gathered.hud.showHealth, true);
        assert.match(gathered.hud.inventoryText, /Wood 15/);
        assert.equal(gathered.entities.find(e => e.id === 'target').active, false);
        assert.equal(gathered.audioEvents[0].action, 'craft');
        assert.equal(JSON.stringify(pickupScene), pickupSaved, 'pickup only changes Play Test data');

        const doorPlayer = attachFeatures(player(), 'inventory', 'interact');
        const keyPickup = target(60);
        const keyComponent = createPluginComponent('feature-pickup', 0).component;
        keyComponent.settings.item = 'keys';
        keyPickup.components.push(keyComponent);
        const lockedDoor = target(75, 50);
        lockedDoor.id = 'door'; lockedDoor.name = 'Locked Door';
        lockedDoor.components.push(createPluginComponent('feature-door', 0).component);
        feature(lockedDoor, 'door').settings.locked = true;
        const doorScene = [doorPlayer, keyPickup, lockedDoor];
        const doorSaved = JSON.stringify(doorScene);
        const doorState = createSceneRuntimeState(doorScene);
        let doorStep = step(doorScene, doorState, { pressedKeys: ['e'] }, .1);
        assert.equal(doorStep.hud.extraControls[0].key, 'e');
        assert.match(doorStep.hud.inventoryText, /Keys 1/);
        doorStep = step(doorStep.entities, doorState, { pressedKeys: ['e'] }, .4);
        assert.equal(doorStep.entities.find(e => e.id === 'door').active, false, 'a key opens the door');
        assert.match(doorStep.hud.inventoryText, /Keys 0/);
        doorStep = step(doorStep.entities, doorState, { pressedKeys: ['e'] }, .8);
        assert.equal(doorStep.entities.find(e => e.id === 'door').active, true, 'open doors can be closed again');
        assert.equal(JSON.stringify(doorScene), doorSaved);

        const checkpointPlayer = attachFeatures(player(), 'health', 'interact', 'status-bar');
        feature(checkpointPlayer, 'health').settings.startingHealth = 20;
        const checkpoint = target(70); checkpoint.id = 'checkpoint'; checkpoint.name = 'Save Point';
        checkpoint.components.push(createPluginComponent('feature-checkpoint', 0).component);
        const attacker = target(200); attacker.id = 'npc'; attacker.name = 'Practice Enemy';
        const enemyController = createPluginComponent('character-controller-npc', 0).component;
        enemyController.enabled = false;
        attacker.components.push(enemyController);
        const enemyHealth = createPluginComponent('feature-health', 0).component;
        enemyHealth.settings.contactDamage = 20;
        attacker.components.push(enemyHealth);
        const checkpointScene = [checkpointPlayer, checkpoint, attacker];
        const checkpointSaved = JSON.stringify(checkpointScene);
        const checkpointState = createSceneRuntimeState(checkpointScene);
        let marked = step(checkpointScene, checkpointState, { pressedKeys: ['e'] }, .1);
        assert.match(marked.hud.message, /Checkpoint saved/);
        assert.equal(marked.hud.health, 100, 'checkpoint restores health');
        let nearEnemy = marked.entities.map(e => e.id === 'npc' ? {
          ...e, components: e.components.map(c => c.type === 'transform' ? { ...c, position: { ...c.position, y: 60 } } : c),
        } : e);
        for (const time of [1.1, 2.1, 3.1, 4.1, 5.1]) nearEnemy = step(nearEnemy, checkpointState, idle, time).entities;
        const restored = step(nearEnemy, checkpointState, idle, 6.1);
        assert.equal(restored.hud.health, 100, 'health returns after respawn at zero');
        assert.deepEqual(getTransform(restored.entities.find(e => e.id === 'player')).position, { x: 50, y: 70, z: 0 });
        assert.equal(JSON.stringify(checkpointScene), checkpointSaved);

        const reader = attachFeatures(player(), 'interact', 'status-bar');
        const sign = target(70); sign.id = 'sign';
        sign.components.push(createPluginComponent('feature-message', 0).component);
        const textScene = [reader, sign];
        const told = step(textScene, createSceneRuntimeState(textScene), { pressedKeys: ['e'] });
        assert.equal(told.hud.message, 'Welcome!');
        const effectTarget = target(70); effectTarget.id = 'sparkle';
        effectTarget.components.push(createPluginComponent('feature-visual-effect', 0).component);
        const effectScene = [reader, effectTarget];
        const effected = step(effectScene, createSceneRuntimeState(effectScene), { pressedKeys: ['e'] });
        assert.match(effected.hud.message, /Sparkle effect/);
        assert.equal(effected.entities.filter(e => e.id.startsWith('runtime-effect-')).length, 8);
        assert.equal(JSON.stringify(effectScene), JSON.stringify([reader, effectTarget]), 'effects leave the authored scene untouched');
        console.log('PASS: player action controls and all three plugin sets, feature settings, health/damage/respawn, inventory, interaction/pickups, locked doors, checkpoints, signs, effects, sounds, and saved-scene isolation.');
      `,
    },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const path = join(directory, 'test.mjs');
  await writeFile(path, bundle.outputFiles[0].text);
  await import(pathToFileURL(path).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
