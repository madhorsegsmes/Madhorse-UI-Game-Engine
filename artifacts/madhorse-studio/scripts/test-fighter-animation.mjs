import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-fighter-animation-'));
try {
  const result = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import * as THREE from 'three';
      import { createGameStarterKit } from './src/lib/scene-starter-kits';
      import { getTransform } from './src/lib/scene-model';
      import { createCharacterBodyMesh } from './src/lib/character-builder-geometry';
      import { createCharacterSkinRig } from './src/lib/character-skin-rig';
      import { fighterAttackDuration, fighterAttackEnvelope } from './src/lib/fighter-playback';
      import { createSceneRuntimeState, advanceSceneRuntime } from './src/lib/scene-play-runtime';
      const starter = createGameStarterKit('fighting', {x:50,y:50,z:0});
      const saved = JSON.stringify(starter.entities);
      const root = starter.entities.find(e => e.id === starter.playerId);
      const parts = starter.entities.filter(e => e.parentId === root.id);
      const body = createCharacterBodyMesh(parts);
      assert(body, 'Default fighter has a continuous smooth body');
      const rig = createCharacterSkinRig(body);
      const geometry = rig.geometry;
      const positions = geometry.getAttribute('position');
      const weights = geometry.getAttribute('skinWeight');
      const indices = geometry.getAttribute('skinIndex');
      assert.equal(weights.count, positions.count);
      assert(geometry.getAttribute('normal') && geometry.getAttribute('uv'), 'Smooth lighting and skin detail UVs exist');
      for(let i=0; i<weights.count; i++) {
        let sum = 0;
        for(let j=0; j<4; j++) {
          assert(indices.array[i*4+j] < rig.skeleton.bones.length);
          sum += weights.array[i*4+j];
        }
        assert(Math.abs(sum-1)<1e-5, 'Every vertex has normalized skin weights');
      }
      const idle = {time:0, moving:false, blocking:false, defeated:false};
      const hand = new THREE.Vector3(-.11,1.45,.23);
      const handBone = rig.nearestBone(hand);
      const foot = new THREE.Vector3(.12,.04,.14);
      const footBone = rig.nearestBone(foot);
      rig.update(undefined,0);
      assert(hand.clone().applyMatrix4(rig.matrices[handBone]).distanceTo(hand)<1e-6, 'Authoring pose remains untouched');
      const light = {kind:'light-attack', startedAt:0, duration:fighterAttackDuration('light-attack')};
      rig.update({...idle, attack:light}, light.duration*.27);
      const punched = hand.clone().applyMatrix4(rig.matrices[handBone]);
      assert(punched.z > hand.z+.12, 'Jab visibly extends the fist instead of flashing');
      const head = new THREE.Vector3(0,1.7,.04);
      assert(head.clone().applyMatrix4(rig.matrices[rig.nearestBone(head)]).distanceTo(head)<.12, 'Head does not stretch with a punch');
      const kick = {kind:'special-attack',startedAt:0,duration:fighterAttackDuration('special-attack')};
      rig.update({...idle,attack:kick}, kick.duration*.27);
      assert(foot.clone().applyMatrix4(rig.matrices[footBone]).y > .5, 'Special move raises the kicking leg');
      rig.update({...idle,blocking:true},.1);
      assert(hand.clone().applyMatrix4(rig.matrices[handBone]).y > hand.y+.06, 'Guard raises the hands');
      assert.equal(fighterAttackEnvelope(light, light.duration), 0, 'Attack recovers fully');
      const geometryData = positions.array;
      const started = performance.now();
      for(let frame=0; frame<120; frame++) {
        rig.update({...idle, moving:true, attack:light, hitAt:.4},frame/60);
        assert(rig.matrices.every(m=>m.elements.every(Number.isFinite)), 'All animation matrices stay finite');
        assert.equal(rig.geometry,geometry);
        assert.equal(rig.geometry.getAttribute('position').array,geometryData, 'Animation never remeshes the body');
      }
      console.log('120 rig frames: '+(performance.now()-started).toFixed(1)+'ms; '+positions.count+' cached vertices');
      rig.dispose(); body.geometry.dispose();

      const entities = JSON.parse(saved);
      const player = entities.find(e=>e.id===root.id);
      const rival = entities.find(e=>e.name==='Training Rival');
      getTransform(player).position.x=50;
      getTransform(rival).position.x=58;
      const state = createSceneRuntimeState(entities,player.id);
      let live=entities;
      const action = kind=>player.components.find(c=>c.type==='playerAction'&&c.action===kind);
      function step(time, pressed=[], held=[], moveX=0) {
        const result=advanceSceneRuntime(live,.016,time,{moveX,moveY:0,pressedKeys:pressed,heldKeys:held},state);
        live=result.entities;
        return result;
      }
      const pose = id=>live.find(e=>e.id===id).runtimePose;
      const lightKey=action('light-attack').key;
      step(.01,[lightKey]);
      assert.equal(pose(player.id).attack.kind,'light-attack');
      assert.equal(pose(rival.id).hitAt,.01,'Actual landed hit triggers rival recoil');
      assert(pose(rival.id).attack,'CPU attacks have animation events too');
      step(.2,[lightKey]);
      assert.equal(pose(player.id).attack.startedAt,.01,'Cooldown does not create fake attacks');
      step(.27);
      assert.equal(pose(player.id).attack.startedAt,.27,'Early tap buffers into the next valid attack');
      step(.29,[lightKey]);
      step(.6);
      assert.equal(pose(player.id).attack.startedAt,.27,'Expired input never causes a late unwanted attack');
      step(.65,[],[action('block').key]);
      assert(pose(player.id).blocking,'Held guard reaches the animated rig');
      step(.7,[],[],1);
      assert(pose(player.id).moving,'Movement reaches the walking animation');
      state.actions.players.get(player.id).specialMeter=100;
      step(.8,[action('special-attack').key]);
      assert.equal(pose(player.id).attack.kind,'special-attack','Accepted special move starts its own animation');
      assert.equal(JSON.stringify(starter.entities),saved,'Play Test never rewrites the authored fighter or transforms');
      const fresh=createSceneRuntimeState(starter.entities,root.id);
      assert.equal(fresh.actions.combatMotion.size,0,'Restart clears all transient motion events');
      let opening=JSON.parse(saved);
      const openingState=createSceneRuntimeState(opening,root.id);
      for(let frame=1;frame<=38;frame++) opening=advanceSceneRuntime(opening,.016,frame*.016,
        {moveX:1,moveY:0,pressedKeys:[],heldKeys:['d']},openingState).entities;
      assert(openingState.actions.players.get(root.id).health >= 75,'A real 600ms opening movement may take a hit but cannot instantly KO the player');
      assert.equal(openingState.actions.players.get(root.id).roundNumber,1);
      console.log('PASS: smooth weighted skin, real jab/kick/guard, head stability, cached geometry, CPU/hit reactions, accepted-action timing, input buffering, expiry, walk state and reset.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const file = join(directory, 'test.mjs');
  await writeFile(file, result.outputFiles[0].text);
  await import(pathToFileURL(file).href);
} finally {
  await rm(directory, { recursive: true, force: true });
}
