import {build} from 'esbuild';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),temp=await mkdtemp(join(tmpdir(),'madhorse-basketball-'));
try{
  if(!process.argv.includes('--fixture-only')){
    const result=await build({absWorkingDir:project,bundle:true,platform:'node',format:'esm',write:false,
      stdin:{resolveDir:project,loader:'ts',contents:`
        import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
        import {unzipSync,strFromU8} from 'fflate';
        import {createGameStarterKit} from './src/lib/scene-starter-kits';
        import {isSceneGraph,getWorldTransform} from './src/lib/scene-model';
        import {buildBasketballWorld,createBasketballSession,stepBasketball,poseBasketballEntities,basketballCamera,EMPTY_BASKETBALL_INPUT as idle} from './src/lib/basketball-runtime';
        import {createGameCamera} from './src/lib/game-camera';
        import {saveFreshWorkspace,loadFreshWorkspace} from './src/lib/fresh-workspace-storage';
        import {createWebGameData,isWebGameData} from './src/lib/web-game-format';
        import {assembleWebGame} from './src/lib/web-game-export';
        import {DEFAULT_SCENE_RENDER_SETTINGS} from './src/hooks/use-scene-render-settings';
        const kit=createGameStarterKit('basketball',{x:-15,y:50,z:0}),authored=JSON.stringify(kit.entities);
        assert(isSceneGraph(kit.entities),'basketball starter must pass complete scene validation');
        const w=buildBasketballWorld(kit.entities);assert.deepEqual(w.errors,[]);assert.equal(w.players.length,6);assert(w.indicatorId);
        assert.equal(w.hoops.home.y,3.05);assert.equal(w.hoops.away.y,3.05);
        assert.equal(w.hoops.home.z-w.hoops.away.z,24);
        let s=createBasketballSession(w,7);const before=JSON.stringify(s),start=s.players.find(p=>p.id===s.controlledId);
        let moved=stepBasketball(w,s,{...idle,x:1},1/60);
        assert(moved.players.find(p=>p.id===s.controlledId).x>start.x);assert.equal(JSON.stringify(s),before,'no in-place session mutations');
        let switched=stepBasketball(w,s,{...idle,switchPlayer:true},1/60);assert.notEqual(switched.controlledId,s.controlledId);
        const charging=stepBasketball(w,s,{...idle,shootHeld:true},1/60);
        assert(charging.charging);const blurred=stepBasketball(w,charging,idle,1/60);
        assert.equal(blurred.charging,false);assert.equal(blurred.charge,0,'losing held input must cancel the shot meter');
        s.shotClock=5;s=stepBasketball(w,s,{...idle,pass:true},1/60);assert.equal(s.flight.kind,'pass');
        for(let i=0;i<80&&s.flight;i++)s=stepBasketball(w,s,idle,1/60);
        assert(s.holderId);assert.equal(s.holderId,s.controlledId);assert(s.shotClock<5,'a pass must not reset the shot clock');
        function shot(range,seed=7,charge=.75){
          let state=createBasketballSession(w,seed),player=state.players.find(p=>p.id===state.controlledId);
          player.x=w.hoops.home.x;player.z=w.hoops.home.z-range;
          for(const p of state.players)if(w.players.find(a=>a.id===p.id).team==='away'){p.x=5;p.z=w.center.z-10;}
          state.charging=true;state.charge=charge;state=stepBasketball(w,state,{...idle,shootReleased:true},1/60);
          assert.equal(state.homeScore,0,'a button press alone is not a basket');assert.equal(state.flight.kind,'shot');
          let peak=0;for(let i=0;i<180&&state.flight;i++){state=stepBasketball(w,state,idle,1/60);peak=Math.max(peak,state.ball.y);}
          assert(peak>w.hoops.home.y,'shot must travel on an arc above the rim');return state;
        }
        assert.equal(shot(3.5).homeScore,2,'inside arc scores two at the physical rim');
        assert.equal(shot(8).homeScore,3,'long shot scores three');
        const missed=shot(3.5,0xdeadbeef,0);assert.equal(missed.homeScore,0);assert(missed.log.some(v=>v.includes('rebound')));
        s=createBasketballSession(w,7);s.holderId=w.players.find(p=>p.team==='away').id;s.lastTeam='away';s.holderSince=-5;
        let aiShot=false;for(let i=0;i<1000&&!s.over;i++){s=stepBasketball(w,s,idle,1/60);if(s.flight?.kind==='shot'&&s.flight.team==='away')aiShot=true;}
        assert(aiShot,'rivals must actually drive and shoot');
        s=createBasketballSession(w,7);s.shotClock=.001;s=stepBasketball(w,s,idle,1/60);
        assert.equal(w.players.find(p=>p.id===s.holderId).team,'away');assert.equal(s.shotClock,24);
        s=createBasketballSession(w,7);s.remaining=.001;s.homeScore=4;s=stepBasketball(w,s,idle,1/60);
        assert(s.over);assert.equal(stepBasketball(w,s,{...idle,shootReleased:true},1/60),s);
        const replay=createBasketballSession(w,7);assert.equal(replay.homeScore,0);assert.equal(replay.remaining,180);
        const posed=poseBasketballEntities(w,moved,kit.entities);
        assert(posed.some(e=>e.runtimePose?.basketball),'athletes must use temporary cached-rig animation');
        const ring=getWorldTransform(posed,w.indicatorId),player=moved.players.find(p=>p.id===moved.controlledId);
        assert(Math.abs((ring.position.x-50)/10-player.x)<.001);
        assert.equal(JSON.stringify(kit.entities),authored,'playing/posing must preserve authored assets and anatomy');
        assert(basketballCamera(createGameCamera(kit.entities),w).position.y>=15);
        const blank=createGameStarterKit('blank',{x:0,y:0,z:0});assert.deepEqual(blank.entities,[]);assert.deepEqual(blank.generatedAssets,[]);assert(isSceneGraph(blank.entities));
        const source=(k,name)=>({projectName:name,entities:k.entities,camera:createGameCamera(k.entities),assets:k.generatedAssets.map(x=>x.asset),
          animations:[],animationControllers:[],uiControls:[],scripts:[],prefabs:[],builderHistory:[],builderDraft:null,builderDraftRequest:'',builderBuildLogs:[]});
        const storage=new Map();globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
        saveFreshWorkspace(source(kit,'Basketball'),'sports-test');const previous=[...storage.entries()];
        saveFreshWorkspace(source(blank,'My Blank Canvas'),'blank-test');
        const restored=loadFreshWorkspace('blank-test');assert.deepEqual(restored.entities,[]);assert.deepEqual(restored.assets,[]);assert.equal(restored.projectName,'My Blank Canvas');
        for(const [key,value]of previous)assert.equal(storage.get(key),value,'new blank project must not overwrite existing sports project');
        delete globalThis.window;
        const runtimeDir=${JSON.stringify(join(project,'public/game-player'))},manifest=JSON.parse(await readFile(runtimeDir+'/bundle.json','utf8'));
        const runtime=await Promise.all(manifest.files.map(async path=>({path,blob:new Blob([await readFile(runtimeDir+'/'+path)])})));
        assert.throws(()=>createWebGameData('Blank Canvas',source(blank,'Blank Canvas'),DEFAULT_SCENE_RENDER_SETTINGS),/valid, active objects/,'empty projects should require content before game export');
        for(const [k,name]of [[kit,'Basketball']]){
          const data=createWebGameData(name,source(k,name),DEFAULT_SCENE_RENDER_SETTINGS),files=new Map(k.generatedAssets.map(x=>[x.asset.id,x.file]));
          const zip=await assembleWebGame(data,runtime,async id=>files.get(id)??null),entries=unzipSync(new Uint8Array(await zip.arrayBuffer()));
          const exported=JSON.parse(strFromU8(entries['game.json']));assert(isWebGameData(exported));
          for(const path of Object.values(exported.assetFiles))assert(entries[path]);
          assert.equal(exported.entities.length,k.entities.length);
        }
        console.log('PASS: validated 3v3 court/humans/rims, movement, switching, passing without clock reset, physical 2/3-point shots, misses, real rival shots, violations, result/restart, temporary rig motion, source isolation, empty-project save/reload/isolation, basketball ZIP and explicit empty-game export guard.');
      `}});
    await writeFile(join(temp,'test.mjs'),result.outputFiles[0].text);await import(pathToFileURL(join(temp,'test.mjs')).href);
  }
  const fixture=resolve(project,'../../generated-artifacts/basketball-preview');await mkdir(fixture,{recursive:true});
  const resolvePackage=createRequire(join(project,'package.json')).resolve;
  await build({absWorkingDir:project,bundle:true,platform:'browser',format:'esm',jsx:'automatic',outfile:join(fixture,'app.js'),
    plugins:[{name:'single-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:resolvePackage(args.path)}));}}],
    stdin:{resolveDir:project,loader:'tsx',contents:`
      import {useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
      import {ScenePreview3D} from './src/components/scene-preview-3d';import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {createGameCamera} from './src/lib/game-camera';
      const kit=createGameStarterKit('basketball',{x:-15,y:50,z:0}),blank=createGameStarterKit('blank',{x:0,y:0,z:0}),noop=()=>{};
      const urls=Object.fromEntries(kit.generatedAssets.map(({asset,file})=>[asset.id,URL.createObjectURL(file)]));
      function App(){const [playing,setPlaying]=useState(true),[empty,setEmpty]=useState(false),k=empty?blank:kit;
        return <><header><b>{empty?'Blank Canvas':'Sports · 3D Basketball'}</b><span>
          <button data-testid="fixture-toggle-blank" onClick={()=>setEmpty(!empty)}>Toggle blank project</button>
          <button data-testid="fixture-toggle-play" onClick={()=>setPlaying(!playing)}>{playing?'Stop test':'Play test'}</button></span></header>
          <main style={{height:'calc(100vh - 48px)',position:'relative'}}>
          <ScenePreview3D entities={k.entities} assets={k.generatedAssets.map(x=>x.asset)} assetUrls={urls} gameView gameRunning={playing&&!empty}
            primaryCamera={createGameCamera(k.entities)} selectedEntityId={null} playerPreviewPosition={{x:0,y:0}} transformMode="translate" readOnly
            onSelectEntity={noop} onTransformCommit={noop} onTransformModeChange={noop}
            graphicsFallback={<div data-testid="gpu-unavailable" style={{padding:24,color:'#ccd9eb'}}>This capture browser has no WebGL2. The actual 3D court requires a WebGL2-capable PC. Gameplay HUD uses the real basketball runtime. Blank scene: {k.entities.length} objects.</div>}/>
          </main></>;
      }
      flushSync(()=>createRoot(document.getElementById('root'),{onUncaughtError:e=>document.body.textContent=String(e)}).render(<App/>));
    `}});
  const prefix='/madhorse-studio/@fs'+fixture;
  await writeFile(join(fixture,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Basketball and Blank Canvas verification</title><link rel="stylesheet" href="${prefix}/app.css"><style>html,body{margin:0;height:100%;background:#111622;color:white;font:14px system-ui}header{height:48px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 14px}header button{padding:5px 10px;margin-left:8px}</style></head><body><div id="root"></div><script type="module" src="${prefix}/app.js"></script></body></html>`);
  console.log('Actual-component fixture:',fixture+'/index.html');
}finally{await rm(temp,{recursive:true,force:true});}
