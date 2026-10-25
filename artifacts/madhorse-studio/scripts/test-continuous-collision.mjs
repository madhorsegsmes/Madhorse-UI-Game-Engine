import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temporary = await mkdtemp(join(tmpdir(), 'madhorse-ccd-'));
try {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { sweepBox } from './src/lib/physics-sweep';
      import { createPhysicsComponent, getTransform, getPhysicsComponent, isPhysicsComponent } from './src/lib/scene-model';
      import { stepPhysicsScene } from './src/lib/physics-simulation';
      import { collisionPresets, collisionPresetDraft, collisionLayers, isCollisionFilter } from './src/lib/collision-layers';
      import { createWebGameData } from './src/lib/web-game-format';
      import { createGameCamera } from './src/lib/game-camera';
      import { DEFAULT_SCENE_RENDER_SETTINGS } from './src/hooks/use-scene-render-settings';
      import { advanceSceneRuntime, createSceneRuntimeState } from './src/lib/scene-play-runtime';
      import { StandaloneSimulation } from './src/game-player/simulation';
      import { stepRuntimeRigidBodies } from './src/lib/runtime-rigid-bodies';
      const axes=['x','y','z'], half={x:.5,y:.5,z:.5};
      const origin={x:0,y:0,z:0}, target={x:40,y:0,z:0};
      const hit=sweepBox(origin,{x:100,y:0,z:0},half,target,half,axes);
      assert.equal(hit.time,.39); assert.equal(hit.normal,-1); assert.equal(hit.axis,'x');
      assert.equal(sweepBox({x:100,y:0,z:0},{x:-100,y:0,z:0},half,target,half,axes).normal,1);
      assert.equal(sweepBox(origin,{x:0,y:0,z:0},half,target,half,axes),null);
      assert.equal(sweepBox(origin,{x:10,y:0,z:0},half,target,half,axes),null);
      assert.equal(sweepBox(target,{x:10,y:0,z:0},half,target,half,axes),null,'Initial overlaps use discrete resolution');
      assert.equal(sweepBox({x:39,y:0,z:0},{x:-10,y:0,z:0},half,target,half,axes),null,'Moving away from a touching face must not stick');
      assert.equal(sweepBox({x:39,y:0,z:0},{x:10,y:0,z:0},half,target,half,axes).time,0);
      assert.equal(sweepBox({x:0,y:1,z:0},{x:100,y:0,z:0},half,target,half,axes),null,'Parallel edge grazing must not stick');
      function body(id,x,type,continuous=false) {
        return {id,name:id,parentId:null,active:true,components:[
          {id:id+'t',type:'transform',enabled:true,position:{x,y:100,z:100},
            rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
          {...createPhysicsComponent(type),size:{x:1,y:type==='static'?200:1,z:type==='static'?200:1},
            gravityScale:0,friction:0,continuousCollision:continuous}
        ]};
      }
      const world={dimension:'3d',gravity:{x:0,y:0,z:0}};
      function run(entities,velocity={x:10000,y:0,z:0},settings=world){
        const before=JSON.stringify(entities), velocities=new Map([['moving',{...velocity}]]);
        const result=stepPhysicsScene(entities,settings,.016,velocities);
        assert.equal(JSON.stringify(entities),before,'Saved scene must remain unchanged');
        return {position:getTransform(result[0]).position,velocity:velocities.get('moving')};
      }
      const wall=body('wall',40,'static');
      assert.equal(run([body('moving',0,'dynamic'),wall]).position.x,160,'Legacy discrete behavior remains unchanged');
      const checked=run([body('moving',0,'dynamic',true),wall]);
      assert(checked.position.x>38.99 && checked.position.x<39);
      assert.equal(Math.abs(checked.velocity.x),0);
      const reverse=run([body('moving',100,'dynamic',true),wall],{x:-10000,y:0,z:0});
      assert(reverse.position.x>41 && reverse.position.x<41.01);
      const slide=run([body('moving',0,'dynamic',true),wall],{x:10000,y:1000,z:0});
      assert(Math.abs(slide.position.y-116)<.0001,'Remaining tangential motion is preserved');
      assert(run([body('moving',0,'dynamic',true),body('far',80,'static'),wall]).position.x<39,'Nearest hit wins regardless of object order');
      const masked=body('moving',0,'dynamic',true);
      getPhysicsComponent(masked).collisionMask=0;
      assert.equal(run([masked,wall]).position.x,160,'Sweeps honor collision masks');
      const noCollider=body('wall',40,'static');
      getPhysicsComponent(noCollider).colliderEnabled=false;
      assert.equal(run([body('moving',0,'dynamic',true),noCollider]).position.x,160);
      const dynamicTarget=body('wall',40,'dynamic');
      assert.equal(run([body('moving',0,'dynamic',true),dynamicTarget]).position.x,160,'Moving-body CCD is not advertised or silently simulated');
      const twoD=run([body('moving',0,'dynamic',true),wall],{x:10000,y:0,z:0},{...world,dimension:'2d'});
      assert(twoD.position.x<39); assert.equal(twoD.position.z,100);
      const left=body('left',-20,'static'), bouncing=body('moving',0,'dynamic',true);
      for(const item of [left,wall,bouncing])getPhysicsComponent(item).restitution=1;
      const bounced=run([bouncing,left,wall]);
      assert(bounced.position.x>=-19 && bounced.position.x<=39,'Bounded multi-hit resolution remains inside both walls');
      assert(Number.isFinite(bounced.velocity.x));
      for(const preset of collisionPresets) {
        assert(isCollisionFilter(preset));
        const draft=collisionPresetDraft(preset.id);
        const mask=collisionLayers.reduce((m,_,i)=>draft['physics.collides.'+i]==='true'?m|(1<<i):m,0);
        assert.equal(mask,preset.collisionMask);
        assert.equal(draft['physics.collisionLayer'],String(preset.collisionLayer));
        assert.equal(draft['physics.continuousCollision'],String(preset.continuousCollision));
      }
      assert.equal(collisionPresetDraft('unknown'),null);
      assert.equal(collisionPresetDraft('projectile')['physics.continuousCollision'],'true');
      const legacy={...createPhysicsComponent()}; delete legacy.continuousCollision;
      assert(isPhysicsComponent(legacy));
      assert(!isPhysicsComponent({...legacy,continuousCollision:'yes'}));
      const entities=[body('moving',0,'dynamic',true),wall];
      const exported=createWebGameData('CCD test',{entities,camera:createGameCamera(entities),assets:[],scripts:[],
        animations:[],animationControllers:[],uiControls:[],prefabs:[]},DEFAULT_SCENE_RENDER_SETTINGS);
      assert.equal(getPhysicsComponent(exported.entities[0]).continuousCollision,true);
      const physics=getPhysicsComponent(entities[0]);
      physics.simulateInPlay=true;
      physics.initialVelocity={x:10000,y:0,z:0};
      assert(!isPhysicsComponent({...physics,initialVelocity:{x:Infinity,y:0,z:0}}));
      assert(!isPhysicsComponent({...physics,simulateInPlay:'true'}));
      const input={moveX:0,moveY:0,jumpPressed:false};
      const original=JSON.stringify(entities);
      const runtime=createSceneRuntimeState(entities);
      const studio=advanceSceneRuntime(entities,.016,.016,input,runtime);
      const studioX=getTransform(studio.entities[0]).position.x;
      assert(studioX>38.99 && studioX<39,'Actual Studio scene runtime must call CCD physics');
      assert.equal(getPhysicsComponent(studio.entities[0]).bodyType,'dynamic','Temporary kinematic proxies never replace real components');
      assert.equal(JSON.stringify(entities),original);
      const game=createWebGameData('Runtime CCD',{entities,camera:createGameCamera(entities),assets:[],scripts:[],
        animations:[],animationControllers:[],uiControls:[],prefabs:[]},DEFAULT_SCENE_RENDER_SETTINGS);
      assert.equal(getPhysicsComponent(game.entities[0]).simulateInPlay,true);
      assert.deepEqual(getPhysicsComponent(game.entities[0]).initialVelocity,{x:10000,y:0,z:0});
      const standalone=new StandaloneSimulation(game);
      standalone.step(.016,input);
      assert.equal(getTransform(standalone.entities[0]).position.x,studioX,'Exported player and Studio use the same physics');
      standalone.step(.016,input);
      assert.equal(getTransform(standalone.entities[0]).position.x,studioX,'Launch velocity is initialized once, not every frame');
      assert.equal(getTransform(game.entities[0]).position.x,0,'Exported starting state remains immutable');
      const oldScene=[body('moving',0,'dynamic'),body('wall',40,'static')];
      assert.equal(getTransform(advanceSceneRuntime(oldScene,.016,.016,input,createSceneRuntimeState(oldScene)).entities[0]).position.x,0,
        'Old scenes are not silently opted into new physical movement');
      const velocities=new Map([['moving',{x:10000,y:0,z:0}]]);
      assert.equal(stepRuntimeRigidBodies(entities,.016,velocities,()=>true),entities,'Controller-owned movement must not be overwritten');
      assert.equal(velocities.size,0,'Unused runtime velocities are released');
      const falling=body('moving',0,'dynamic');
      getPhysicsComponent(falling).simulateInPlay=true;
      getPhysicsComponent(falling).gravityScale=1;
      assert(getTransform(advanceSceneRuntime([falling],.016,.016,input,createSceneRuntimeState([falling])).entities[0]).position.z<100,
        'Opt-in ordinary rigid bodies also receive gravity in the real runtime');
      console.log('PASS: swept TOI, both directions, touching/grazing, stationary walls, sliding, nearest hit, masks, disabled colliders, 2D/3D, bounded ricochets, presets, legacy data and actual web export.');
      console.log('PASS: actual Studio scene runtime, actual standalone simulation, launch velocity initialization, gravity, controller ownership, immutable game data and opt-in compatibility.');
    `},
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
  });
  const output = join(temporary, 'test.mjs');
  await writeFile(output, bundle.outputFiles[0].text);
  await import(pathToFileURL(output).href);
} finally { await rm(temporary, { recursive: true, force: true }); }
