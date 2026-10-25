import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const stdlib = createRequire(require.resolve('@react-three/drei')).resolve('three-stdlib').replace(/index\.cjs$/, 'controls/TransformControls.js');
const temporary = await mkdtemp(join(tmpdir(), 'madhorse-transform-'));
try {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import * as THREE from 'three';
      import {TransformControls} from 'three-stdlib';
      import {DEFAULT_TRANSFORM_SETTINGS as defaults,normalizeTransformSettings,transformGizmoOptions,safeGizmoScale} from './src/lib/scene-transform-settings';
      assert.deepEqual(normalizeTransformSettings(null),defaults);
      assert.deepEqual(normalizeTransformSettings({snap:'yes',space:'bad',moveStep:NaN}),defaults);
      const bounded=normalizeTransformSettings({moveStep:-1,turnStep:Infinity,scaleStep:100});
      assert.equal(bounded.moveStep,.01);assert.equal(bounded.turnStep,15);assert.equal(bounded.scaleStep,10);
      assert.equal(transformGizmoOptions(defaults,'translate',true).space,'world');
      assert.equal(transformGizmoOptions(defaults,'translate',false).space,'local');
      assert.equal(transformGizmoOptions(defaults,'rotate',true).space,'local');
      assert.equal(transformGizmoOptions(defaults,'scale',false).translationSnap,null);
      const settings={...defaults,snap:true,space:'world',moveStep:.5,turnStep:15,scaleStep:.25};
      assert.equal(transformGizmoOptions(settings,'scale',false).space,'local');
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
      camera.position.z=10;camera.lookAt(0,0,0);scene.add(camera);
      const object=new THREE.Object3D();scene.add(object);
      const controls=new TransformControls(camera);scene.add(controls);controls.attach(object);
      const configure=(mode,axis)=>{
        controls.setMode(mode);const options=transformGizmoOptions(settings,mode,false);
        controls.setSpace(options.space);controls.setTranslationSnap(options.translationSnap);
        controls.setRotationSnap(options.rotationSnap);controls.setScaleSnap(options.scaleSnap);
        controls.axis=axis;scene.updateMatrixWorld(true);controls.updateMatrixWorld(true);
      };
      configure('translate','X');
      controls.pointerDown({x:0,y:0,button:0});controls.pointerMove({x:.13,y:0,button:-1});
      assert(Math.abs(object.position.x-1)<1e-6,'Actual Drei/three-stdlib controls snap world translation');
      controls.pointerUp({button:0});object.position.set(0,0,0);
      // E is the screen-facing roll ring. Z x eye is zero with a camera on +Z.
      configure('rotate','E');
      controls.pointerDown({x:.1,y:0,button:0});
      controls.pointerMove({x:.1*Math.cos(Math.PI/9),y:.1*Math.sin(Math.PI/9),button:-1});
      assert(Math.abs(Math.abs(THREE.MathUtils.radToDeg(object.rotation.z))-15)<1e-5,'Actual rotation uses degree-to-radian snapping; observed '+THREE.MathUtils.radToDeg(object.rotation.z)+' degrees');
      controls.pointerUp({button:0});object.rotation.set(0,0,0);
      configure('scale','X');
      controls.pointerDown({x:.1,y:.1,button:0});controls.pointerMove({x:.137,y:.1,button:-1});
      assert(Math.abs(object.scale.x-1.25)<1e-6,'Actual scale snapping uses ratio steps');
      controls.pointerUp({button:0});
      const fallback=new THREE.Vector3(1,2,3);
      assert.equal(safeGizmoScale(new THREE.Vector3(0,1,1),fallback),fallback);
      assert.equal(safeGizmoScale(new THREE.Vector3(-1,1,1),fallback),fallback);
      assert.equal(safeGizmoScale(new THREE.Vector3(NaN,1,1),fallback),fallback);
      assert.notEqual(safeGizmoScale(new THREE.Vector3(.25,1,1),fallback),fallback);
      settings.space='local';object.scale.set(1,1,1);object.rotation.z=Math.PI/2;
      configure('translate','X');
      controls.pointerDown({x:0,y:0,button:0});controls.pointerMove({x:0,y:.13,button:-1});
      assert(Math.abs(object.position.y-1)<1e-6&&Math.abs(object.position.x)<1e-6,'Local X follows the rotated object');
      controls.pointerUp({button:0});controls.detach();
      console.log('PASS: defaults/validation, real TransformControls world and rotated-local drags, turn/scale snapping, disabled snapping, and positive-scale recovery.');
    ` },
    alias: { 'three-stdlib': stdlib },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
  });
  const path = join(temporary, 'test.mjs');
  await writeFile(path, bundle.outputFiles[0].text);
  await import(pathToFileURL(path).href);
} finally { await rm(temporary, { recursive: true, force: true }); }
