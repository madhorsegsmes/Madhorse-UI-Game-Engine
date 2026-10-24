import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'madhorse-plugins-'));
try {
  const result = await build({
    stdin: {
      resolveDir: dirname(dirname(fileURLToPath(import.meta.url))),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import { createStarterCube, getTransform, isSceneEntity } from './src/lib/scene-model';
        import { createPluginComponent } from './src/lib/scene-plugin-catalog';
        import { advanceSceneRuntime, createSceneRuntimeState } from './src/lib/scene-play-runtime';
        const make = (id, kind, x = 50) => {
          const entity = createStarterCube();
          entity.id = id;
          getTransform(entity).position.x = x;
          if (kind) entity.components.push(createPluginComponent(kind, 0).component);
          return entity;
        };
        const idle = { moveX: 0, moveY: 0, jumpPressed: false };
        const player = make('player', 'character-controller-player');
        const npc = make('npc', 'character-controller-npc', 90);
        const original = JSON.stringify([player, npc]);
        const step = advanceSceneRuntime([player, npc], .05, .05,
          { ...idle, moveX: 1 }, createSceneRuntimeState([player, npc]));
        assert(getTransform(step.entities[0]).position.x > 50);
        assert(getTransform(step.entities[1]).position.x < 90);
        assert.equal(JSON.stringify([player, npc]), original, 'saved entities remain untouched');
        const controller = npc.components.find(c => c.type === 'characterController');
        controller.enabled = false;
        const disabled = advanceSceneRuntime([player, npc], .05, .05, idle, createSceneRuntimeState([player, npc]));
        assert.equal(getTransform(disabled.entities[1]).position.x, 90);
        const zone = make('zone', 'trigger-zone-box');
        const target = make('target', null, 90);
        const trigger = zone.components.find(c => c.type === 'triggerZone');
        trigger.action = 'toggle-target'; trigger.targetEntityId = target.id;
        const scene = [player, zone, target];
        const state = createSceneRuntimeState(scene);
        const entered = advanceSceneRuntime(scene, .05, .05, idle, state);
        assert.equal(entered.events.length, 1);
        assert.equal(entered.entities[2].active, false);
        assert.equal(target.active, true);
        const stillInside = advanceSceneRuntime(entered.entities, .05, .1, idle, state);
        assert.equal(stillInside.events.length, 0);
        assert.equal(stillInside.entities[2].active, false);
        trigger.enabled = false;
        const off = advanceSceneRuntime(scene, .05, .05, idle, createSceneRuntimeState(scene));
        assert.equal(off.events.length, 0);
        const patrol = make('patrol', 'character-controller-patrol');
        const patrolled = advanceSceneRuntime([patrol], .01, .01, idle, createSceneRuntimeState([patrol]));
        assert(Math.abs(getTransform(patrolled.entities[0]).position.x - 50) < 1);
        assert(isSceneEntity(make('sky', 'skybox')));
        assert.equal(createPluginComponent('script', 0).component.enabled, false);
        console.log('PASS: plugin defaults, movement, NPC follow, disabled components, trigger entry, runtime-only state, patrol and skybox validation.');
      `,
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
  });
  const path = join(directory, 'test.mjs');
  await writeFile(path, result.outputFiles[0].text);
  await import(pathToFileURL(path).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
