import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'madhorse-foundations-'));
try {
  const result = await build({
    stdin: { resolveDir: project, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { Texture, SRGBColorSpace } from 'three';
      import { SimulationClock } from './src/lib/simulation-clock';
      import { physicsContactPairs } from './src/lib/physics-broadphase';
      import { stepPhysicsScene } from './src/lib/physics-simulation';
      import { createSceneEntity, getPhysicsComponent, getTransform } from './src/lib/scene-model';
      import { createSceneTextureCache } from './src/lib/scene-texture-cache';
      import { DEFAULT_SCENE_RENDER_SETTINGS, normalizeSceneRenderSettings } from './src/hooks/use-scene-render-settings';

      for (const fps of [30,60,120,144,240]) {
        const clock = new SimulationClock(0);
        let steps=0;
        for(let frame=1;frame<=fps*2;frame++) steps+=clock.advance(frame*1000/fps).steps;
        assert.equal(steps,120,'Two seconds simulate identically at '+fps+'Hz');
      }
      const clock=new SimulationClock(0);
      assert.equal(clock.advance(5000).steps,5,'Long stalls have bounded catch-up');
      assert.equal(clock.advance(5017).steps,1,'No simulation backlog survives a stall');
      assert.equal(clock.advance(1e6,true).steps,0,'Hidden-page pause drops accumulated time');
      assert.equal(clock.advance(1e6+17).steps,1,'Resume never fast-forwards the game');
      assert.equal(clock.advance(NaN).steps,0,'Bad timestamps cannot corrupt game state');
      assert.equal(DEFAULT_SCENE_RENDER_SETTINGS.quality,'high');
      assert.equal(normalizeSceneRenderSettings(null).quality,'high');
      for(const quality of ['balanced','performance','high'])
        assert.equal(normalizeSceneRenderSettings({quality}).quality,quality,'Existing preferences survive');
      assert.equal(normalizeSceneRenderSettings({exposure:Infinity}).exposure,1);
      assert.equal(normalizeSceneRenderSettings({exposure:999}).exposure,1.6);
      assert.equal(normalizeSceneRenderSettings({background:'bad'}).background,DEFAULT_SCENE_RENDER_SETTINGS.background);

      const body=(x,y,z,sx=8,sy=8,sz=8,dynamic=true)=>({
        position:{x,y,z},halfSize:{x:sx,y:sy,z:sz},inverseMass:dynamic?1:0,physics:{colliderEnabled:true}
      });
      const bodies=Array.from({length:300},(_,i)=>body(
        ((i*73)%1009)-500,((i*197)%1013)-500,((i*101)%127)-60,
        i%9+2,i%13+2,i%7+2,i%4===0));
      bodies.push(body(0,0,0,2000,2000,20,false),body(-63,-64,3,8,8,8,true));
      for(const dimension of ['2d','3d']) {
        const expected=[];
        const axes=dimension==='2d'?['x','y']:['x','y','z'];
        for(let a=0;a<bodies.length;a++) for(let b=a+1;b<bodies.length;b++) {
          if(!bodies[a].inverseMass&&!bodies[b].inverseMass)continue;
          if(axes.every(axis=>Math.abs(bodies[a].position[axis]-bodies[b].position[axis])<
            bodies[a].halfSize[axis]+bodies[b].halfSize[axis])) expected.push([a,b]);
        }
        assert.deepEqual(physicsContactPairs(bodies,dimension),expected,'Spatial hash misses no '+dimension+' contacts');
      }
      assert.deepEqual(physicsContactPairs(Array.from({length:1000},(_,i)=>body(i*100,0,20,5,5,5,i===0)),'3d'),[]);
      const entity=(name,x,type)=>{
        const e=createSceneEntity(name,{x,y:0,z:10},null,false);
        const p=getPhysicsComponent(e);p.enabled=true;p.bodyType=type;p.size={x:10,y:10,z:10};
        p.restitution=0;p.friction=.4;p.mass=1;p.gravityScale=1;
        return e;
      };
      const dynamic=entity('body',0,'dynamic'),wall=entity('wall',8,'static');
      const scene=[dynamic,wall], saved=JSON.stringify(scene),velocities=new Map();
      velocities.set('deleted',{x:1,y:2,z:3});
      const world={dimension:'3d',gravity:{x:0,y:0,z:-9.81}};
      const stepped=stepPhysicsScene(scene,world,1/60,velocities);
      assert(getTransform(stepped[0]).position.x<=-2,'Body resolves static-wall overlap');
      assert(!velocities.has('deleted'),'Deleted body velocities are released');
      assert.equal(JSON.stringify(scene),saved,'Physics never changes authored scene data');
      assert.equal(stepPhysicsScene(scene,world,NaN,velocities),scene);
      let fallen=scene.slice(0,1);
      for(let i=0;i<180;i++)fallen=stepPhysicsScene(fallen,world,1/60,velocities);
      assert(getTransform(fallen[0]).position.z>=5,'A falling body remains above the floor');

      let requests=0, ready, failed;
      const cache=createSceneTextureCache((url,onReady,onFailed)=>{requests++;ready=onReady;failed=onFailed;});
      const received=[];
      const a=cache.acquire('shared.png',8,{ready:t=>received.push(t),failed:()=>assert.fail('unexpected texture failure')});
      const b=cache.acquire('shared.png',8,{ready:t=>received.push(t),failed:()=>assert.fail('unexpected texture failure')});
      assert.equal(requests,1,'Repeated surface maps share one upload/load');
      const texture=new Texture();let disposed=0;texture.addEventListener('dispose',()=>disposed++);
      ready(texture);
      assert.equal(received.length,2);assert.equal(received[0],received[1]);
      assert.equal(texture.anisotropy,8);assert.equal(texture.colorSpace,SRGBColorSpace);
      a();await Promise.resolve();assert.equal(disposed,0,'One material cannot dispose another material map');
      b();const c=cache.acquire('shared.png',8,{ready:()=>{},failed:()=>{}});
      await Promise.resolve();assert.equal(disposed,0,'Immediate remount retains its map');
      c();await Promise.resolve();assert.equal(disposed,1,'Last lease releases GPU memory');
      let lateDisposed=0;
      const release=cache.acquire('late.png',8,{ready:()=>assert.fail('released subscriber fired'),failed:()=>{}});
      const lateReady=ready;release();await Promise.resolve();
      const late=new Texture();late.addEventListener('dispose',()=>lateDisposed++);
      lateReady(late);assert.equal(lateDisposed,1,'Late loads are disposed after unmount');
      let errors=0;
      cache.acquire('retry.png',8,{ready:()=>{},failed:()=>errors++});failed();
      assert.equal(errors,1);
      const retry=cache.acquire('retry.png',8,{ready:()=>{},failed:()=>{}});
      ready(new Texture());retry();await Promise.resolve();
      console.log('PASS: fixed 60Hz simulation at five refresh rates, pause/stall bounds, preserved gaming-PC preferences, 2D/3D broadphase parity, collision/floor behavior, source-data protection, and shared texture lifecycle.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false,
  });
  const file = join(directory, 'test.mjs');
  await writeFile(file, result.outputFiles[0].text);
  await import(pathToFileURL(file).href);
} finally { await rm(directory, { recursive: true, force: true }); }
