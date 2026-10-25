import {build} from 'esbuild';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(tmpdir(),'madhorse-cart-'));
try{
  const result=await build({absWorkingDir:project,bundle:true,platform:'node',format:'esm',write:false,
    stdin:{resolveDir:project,loader:'ts',contents:`
      import assert from 'node:assert/strict';
      import {readFile} from 'node:fs/promises';
      import {unzipSync,strFromU8} from 'fflate';
      import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {getTransform,getWorldTransform,isSceneGraph} from './src/lib/scene-model';
      import {createGameCamera} from './src/lib/game-camera';
      import {createWebGameData,isWebGameData} from './src/lib/web-game-format';
      import {assembleWebGame} from './src/lib/web-game-export';
      import {DEFAULT_SCENE_RENDER_SETTINGS} from './src/hooks/use-scene-render-settings';
      import {cartFeature,readCartCourse,createCartProgress,advanceCartProgress} from './src/lib/cart-racer-runtime';
      import {StandaloneSimulation} from './src/game-player/simulation';
      const kit=createGameStarterKit('cart-racer',{x:-15,y:50,z:0});
      assert(isSceneGraph(kit.entities),'whole editable scene must validate');
      const authored=JSON.stringify(kit.entities);
      const course=readCartCourse(kit.entities);
      assert.equal(course.error,null);assert.equal(course.gates.length,4);
      const originX=(course.gates[1].position.x+course.gates[3].position.x)/2;
      const originY=(course.gates[0].position.y+course.gates[2].position.y)/2;
      const radiusX=(course.gates[3].position.x-course.gates[1].position.x)/20;
      const radiusY=(course.gates[0].position.y-course.gates[2].position.y)/20;
      const player=kit.entities.find(e=>e.id===kit.playerId),spawn=getTransform(player).position;
      const across=(gate,forward,side=0,height=5.5)=>({
        x:gate.position.x+Math.sin(gate.yaw)*forward+Math.cos(gate.yaw)*side,
        y:gate.position.y+Math.cos(gate.yaw)*forward-Math.sin(gate.yaw)*side,z:gate.position.z+height});
      let progress=createCartProgress(spawn,0),time=0;
      // No skipping, reversing, camping in a gate or passing far outside its width.
      const north=course.gates[0],finish=course.gates[3];
      for(const [a,b] of [[across(finish,-20),across(finish,20)],
        [across(north,20),across(north,-20)],
        [across(north,-20,100),across(north,20,100)],
        [across(north,0),across(north,0)],
        [across(north,-20,0,100),across(north,20,0,100)]]){
        let state=createCartProgress(a,0);state=advanceCartProgress(state,b,1,3,course);
        assert.equal(state.nextGate,0);assert.equal(state.completedLaps,0);
      }
      for(let lap=0;lap<3;lap++)for(const gate of course.gates){
        progress=advanceCartProgress(progress,across(gate,-20),++time,3,course);
        progress=advanceCartProgress(progress,across(gate,20),++time,3,course);
      }
      assert(progress.finished);assert.equal(progress.completedLaps,3);assert(progress.bestLap>0);
      assert.deepEqual(advanceCartProgress(progress,spawn,999,3,course),progress,'finish clock must stop');
      const missing=kit.entities.filter(e=>cartFeature(e)?.settings.gateIndex!==1||cartFeature(e)?.settings.role!=='gate');
      assert(readCartCourse(missing).error,'deleting a checkpoint must not silently shorten a lap');
      const source={entities:kit.entities,camera:createGameCamera(kit.entities),assets:kit.generatedAssets.map(x=>x.asset),
        animations:[],animationControllers:[],uiControls:[],scripts:[],prefabs:[],builderHistory:[],builderDraft:null,builderDraftRequest:'',builderBuildLogs:[]};
      const data=createWebGameData('Cart Racer Stylized test',source,DEFAULT_SCENE_RENDER_SETTINGS);
      // Asset paths are filled by assembleWebGame; validate the completed ZIP below.
      const sim=new StandaloneSimulation(data),dt=1/30;
      let hud,completed=false,maxSpeed=0;
      // Drive the actual assembled map through the shared Studio/export runtime.
      // Pure pursuit uses the same throttle and steering inputs a PC player uses.
      for(let frame=0;frame<4500;frame++){
        const pose=getTransform(sim.player),motion=sim.state.actions.players.get(kit.playerId);
        const x=(pose.position.x-originX)/10,z=(pose.position.y-originY)/10;
        const theta=Math.atan2(z/radiusY,x/radiusX),lookAhead=theta+.24;
        const heading=Math.atan2(radiusX*Math.cos(lookAhead)-x,radiusY*Math.sin(lookAhead)-z);
        const current=motion?.heading??0;
        const error=Math.atan2(Math.sin(heading-current),Math.cos(heading-current));
        const input={moveX:Math.max(-1,Math.min(1,error/.4)),moveY:(motion?.speed??0)<8?1:0,heldKeys:[],pressedKeys:[]};
        const result=sim.step(dt,input);hud=result.hud;
        maxSpeed=Math.max(maxSpeed,sim.state.actions.players.get(kit.playerId)?.speed??0);
        if(sim.state.actions.players.get(kit.playerId)?.raceProgress?.finished){completed=true;break;}
      }
      const final=sim.state.actions.players.get(kit.playerId);
      assert(completed,'actual track must be drivable for all three laps; '+JSON.stringify({position:getTransform(sim.player).position,race:final?.raceProgress,heading:final?.heading}));
      assert(maxSpeed>=7.9);assert.equal(final.raceProgress.completedLaps,3);
      assert(hud?.resourceText.includes('FINISHED'),'race stats must reach the real HUD');
      const stopped={...getTransform(sim.player).position};
      for(let i=0;i<20;i++)sim.step(dt,{moveX:1,moveY:1,pressedKeys:['r']});
      assert(Math.hypot(getTransform(sim.player).position.x-stopped.x,getTransform(sim.player).position.y-stopped.y)<.001,'kart must stop after finish');
      const wheel=sim.entities.find(e=>e.name.includes('front tire'));
      assert(wheel&&getWorldTransform(sim.entities,wheel.id),'attached wheels must follow kart pose');
      assert(sim.camera.position.x!==data.camera.position.x,'chase camera must follow the kart');
      const reset=new StandaloneSimulation(data);assert.deepEqual(getTransform(reset.player).position,spawn);
      assert.equal(reset.state.actions.players.size,0,'restart must create fresh runtime resources');
      const drive=new StandaloneSimulation(data);
      const wallTest=new StandaloneSimulation(data);
      getTransform(wallTest.player).rotation.z=-90;
      for(let i=0;i<120;i++)wallTest.step(dt,{moveX:0,moveY:1});
      assert(getTransform(wallTest.player).position.x<spawn.x+60,'solid outer barrier must stop the kart');
      for(let i=0;i<45;i++)drive.step(dt,{moveX:0,moveY:1});
      const forward=drive.state.actions.players.get(kit.playerId).speed;
      for(let i=0;i<20;i++)drive.step(dt,{moveX:0,moveY:-1});
      assert(drive.state.actions.players.get(kit.playerId).speed<forward,'S must brake');
      // Camera/visual yaw must agree with the direction of travel.
      const turn=new StandaloneSimulation(data);
      for(let i=0;i<35;i++)turn.step(dt,{moveX:.3,moveY:1});
      assert(getTransform(turn.player).rotation.z<0,'clockwise movement requires counter-clockwise source yaw');
      turn.togglePerspective();
      const viewHeading=-getTransform(turn.player).rotation.z*Math.PI/180;
      const facing=turn.camera;
      assert(Math.abs(Math.atan2(facing.target.x-facing.position.x,facing.target.z-facing.position.z)-viewHeading)<.001,
        'optional first-person view must face the actual driving direction');
      const runtimeDir=${JSON.stringify(join(project,'public/game-player'))};
      const manifest=JSON.parse(await readFile(runtimeDir+'/bundle.json','utf8'));
      const runtime=await Promise.all(manifest.files.map(async path=>({path,blob:new Blob([await readFile(runtimeDir+'/'+path)])})));
      const files=new Map(kit.generatedAssets.map(x=>[x.asset.id,x.file]));
      const archive=await assembleWebGame(data,runtime,async id=>files.get(id)??null);
      const entries=unzipSync(new Uint8Array(await archive.arrayBuffer()));
      const exported=JSON.parse(strFromU8(entries['game.json']));
      assert(isWebGameData(exported));
      for(const path of Object.values(exported.assetFiles))assert(entries[path],'export must include every kart/track texture');
      assert.equal(JSON.stringify(kit.entities),authored,'Play/Test must preserve all authored objects and settings');
      console.log('Cart Racer passed: valid scene, directional ordered gates, three actual driven laps, solid barrier collision, finish freeze, HUD, braking, yaw, chase camera, fresh restart, source preservation and portable ZIP assets.');
    `}});
  await writeFile(join(temp,'test.mjs'),result.outputFiles[0].text);
  await import(pathToFileURL(join(temp,'test.mjs')).href);
  const fixture=resolve(project,'../../generated-artifacts/cart-racer-preview');
  await mkdir(fixture,{recursive:true});
  const resolvePackage=createRequire(join(project,'package.json')).resolve;
  await build({absWorkingDir:project,bundle:true,platform:'browser',format:'esm',jsx:'automatic',outfile:join(fixture,'app.js'),
    plugins:[{name:'single-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:resolvePackage(args.path)}));}}],
    stdin:{resolveDir:project,loader:'tsx',contents:`
      import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
      import {ScenePreview3D} from './src/components/scene-preview-3d';
      import {SceneRenderFallback} from './src/components/scene-render-fallback';
      import {DEFAULT_SCENE_RENDER_SETTINGS} from './src/hooks/use-scene-render-settings';
      import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {createGameCamera} from './src/lib/game-camera';
      const kit=createGameStarterKit('cart-racer',{x:-15,y:50,z:0});
      const urls=Object.fromEntries(kit.generatedAssets.map(({asset,file})=>[asset.id,URL.createObjectURL(file)]));
      const base=createGameCamera(kit.entities);
      const cameras=[
        {...base,placement:'custom',fov:44,position:{x:32,y:4.2,z:11},target:{x:26,y:.9,z:3}},
        {...base,placement:'custom',fov:48,position:{x:46.5,y:47,z:-46},target:{x:0,y:0,z:0}}
      ];
      const noop=()=>{};
      flushSync(()=>createRoot(document.getElementById('root'),{onUncaughtError:e=>document.body.textContent=String(e)}).render(
        <>{cameras.map((camera,i)=><section key={i}>
          <h2>{i?'Editable track overview':'Cart Racer Stylized · actual Hub preview camera'}</h2>
          <div style={{height:440,position:'relative'}}>
            <ScenePreview3D entities={kit.entities} assets={kit.generatedAssets.map(x=>x.asset)} assetUrls={urls}
              gameView readOnly staticPreview projectName="Cart Racer Stylized" primaryCamera={camera} gameCamera={camera}
              selectedEntityId={null} playerPreviewPosition={{x:0,y:0}} transformMode="translate"
              graphicsFallback={<SceneRenderFallback entities={kit.entities} camera={camera} settings={DEFAULT_SCENE_RENDER_SETTINGS}
                zoom={100} sceneFocus={null} gameView assetUrls={urls}/>}
              onSelectEntity={noop} onTransformCommit={noop} onTransformModeChange={noop}/>
          </div>
        </section>)}</>
      ));
    `}});
  const prefix='/madhorse-studio/@fs'+fixture;
  await writeFile(join(fixture,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Actual Cart Racer scene verification</title><link rel="stylesheet" href="${prefix}/app.css"><style>body{margin:0;padding:16px;background:#15171d;color:white;font:14px system-ui}#root{display:grid;grid-template-columns:1fr 1fr;gap:16px}section{min-width:0}h2{font-size:16px}</style></head><body><div id="root"></div><script type="module" src="${prefix}/app.js"></script></body></html>`);
  console.log('Actual-component preview:',fixture+'/index.html');
}finally{await rm(temp,{recursive:true,force:true});}
