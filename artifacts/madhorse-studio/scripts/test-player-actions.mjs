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
        console.log('PASS: seven action defaults, save/restore, key conflicts, run/crouch, damage/cooldowns/aim, racing, crafting, building/resources, sounds, transient cleanup, selected player, and saved-scene isolation.');
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
