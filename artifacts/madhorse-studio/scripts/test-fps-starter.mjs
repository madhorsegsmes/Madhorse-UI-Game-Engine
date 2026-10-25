import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-fps-'));
try {
  const result = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { createGameStarterKit } from './src/lib/scene-starter-kits';
      import { advanceSceneRuntime, createSceneRuntimeState } from './src/lib/scene-play-runtime';
      import { getTransform, isSceneEntity } from './src/lib/scene-model';
      import { firstPersonHit, firstPersonMove } from './src/lib/fps-aim';
      const kit = createGameStarterKit('shooter', { x: -15, y: 50, z: 0 });
      const original = JSON.stringify(kit.entities);
      assert(kit.entities.every(isSceneEntity), 'Invalid FPS entities: ' + kit.entities.filter(e => !isSceneEntity(e)).map(e => e.name).join(', '));
      assert.equal(kit.generatedAssets.length, 2);
      assert.equal(kit.entities.filter(e => /^Range Target [0-9]+$/.test(e.name)).length, 6);
      const restored = JSON.parse(original);
      assert(restored.every(isSceneEntity), 'FPS project survives serialization');
      function runtime() {
        let entities = JSON.parse(original);
        const state = createSceneRuntimeState(entities, kit.playerId);
        let now = 0;
        return {
          get entities() { return entities; }, state,
          player() { return entities.find(e => e.id === kit.playerId); },
          step(input = {}, count = 1) {
            let result;
            for (let i = 0; i < count; i++) {
              now += .05;
              result = advanceSceneRuntime(entities, .05, now, { moveX: 0, moveY: 0, jumpPressed: false, lookYaw: 0, lookPitch: 0, ...input }, state);
              entities = result.entities;
            }
            return result;
          },
          shoot() { const result = this.step({ pressedKeys: ['j'] }); this.step({}, 6); return result; },
        };
      }
      const firstTarget = kit.entities.find(e => e.name === 'Range Target 1');
      assert.equal(firstPersonHit(kit.entities, kit.playerId, 0, 0, 55)?.id, firstTarget.id, 'Initial crosshair must hit the visible starting target');
      assert.notEqual(firstPersonHit(kit.entities, kit.playerId, 0, 45, 55)?.id, firstTarget.id, 'Pitch changes the shot');
      const forward = runtime();
      const start = { ...getTransform(forward.player()).position };
      forward.step({ moveY: 1 }, 20);
      assert(getTransform(forward.player()).position.y > start.y + 40, 'Spawn lane must permit forward walking');
      const turned = runtime();
      turned.step({ moveY: 1, lookYaw: 90 }, 10);
      assert(getTransform(turned.player()).position.x > start.x + 20, 'Forward movement follows mouse yaw');
      assert(Math.abs(getTransform(turned.player()).rotation.z - 90) < .001, 'Camera yaw follows look, not strafe direction');
      const strafe = firstPersonMove(1, 0, 90);
      assert(Math.abs(strafe.moveX) < .001 && strafe.moveY < -.99);
      const walking = runtime(), running = runtime();
      walking.step({ moveY: 1 });
      running.step({ moveY: 1, heldKeys: ['shift'] });
      assert(getTransform(running.player()).position.y > getTransform(walking.player()).position.y, 'Sprint increases actual movement');
      const crouch = runtime();
      const height = getTransform(crouch.player()).scale.z;
      crouch.step({ heldKeys: ['c'] });
      assert(getTransform(crouch.player()).scale.z < height);
      crouch.step();
      assert.equal(getTransform(crouch.player()).scale.z, height);
      const jump = runtime();
      jump.step({ jumpPressed: true });
      assert(getTransform(jump.player()).position.z > 0);
      jump.step({}, 100);
      assert(Math.abs(getTransform(jump.player()).position.z) < .01, 'Jump returns to the deck');
      const cover = runtime();
      Object.assign(getTransform(cover.player()).position, { x: 0, y: 30, z: 0 }); // world -5,-2, behind tall cover
      assert.equal(firstPersonHit(cover.entities, kit.playerId, 0, 0, 55)?.id,
        cover.entities.find(e => e.name === 'Cover crate · 3').id, 'Tall cover blocks the ray');
      const wall = runtime();
      Object.assign(getTransform(wall.player()).position, { x: 180, y: -70, z: 0 });
      wall.step({ moveY: 1, lookYaw: 90 }, 40);
      assert(getTransform(wall.player()).position.x < 190, 'Perimeter wall stops the player');
      const combat = runtime();
      let hud;
      for (let i = 0; i < 4; i++) hud = combat.shoot().hud;
      assert.equal(combat.entities.find(e => e.id === firstTarget.id).active, false, 'Four aimed shots defeat the first target');
      assert.equal(combat.state.actions.health.get(firstTarget.id), 0);
      assert.match(hud.resourceText, /Ammo 8/);
      hud = combat.step({ pressedKeys: ['r'] }).hud;
      assert.match(hud.resourceText, /Ammo 12/);
      assert.match(hud.resourceText, /Spare 92/);
      for (const target of combat.entities.filter(e => /^Range Target [0-9]+$/.test(e.name) && e.active)) {
        const targetPosition = getTransform(target).position;
        Object.assign(getTransform(combat.player()).position, { x: targetPosition.x, y: targetPosition.y - 10, z: 0 });
        combat.step({ pressedKeys: ['r'] }); combat.step({}, 25);
        for (let i = 0; i < 4; i++) combat.shoot();
      }
      assert(combat.entities.filter(e => /^Range Target [0-9]+$/.test(e.name)).every(e => !e.active),
        'Targets remaining: ' + JSON.stringify(combat.entities.filter(e => /^Range Target [0-9]+$/.test(e.name) && e.active).map(e => ({ name: e.name, health: combat.state.actions.health.get(e.id) }))));
      assert.equal(JSON.stringify(kit.entities), original, 'Play Test never changes saved template data');
      assert.equal(runtime().entities.filter(e => /^Range Target [0-9]+$/.test(e.name) && e.active).length, 6, 'Restart restores all six targets');
      console.log('PASS: FPS data, spawn lane, mouse-relative walking/strafe, sprint, crouch, jump, cover and wall collisions, aimed combat, ammo/reload, all-six-target completion, and reset.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
    alias: { '@': join(project, 'src') }, logLevel: 'silent',
  });
  const file = join(directory, 'fps-test.mjs');
  await writeFile(file, result.outputFiles[0].text);
  await import(pathToFileURL(file).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
