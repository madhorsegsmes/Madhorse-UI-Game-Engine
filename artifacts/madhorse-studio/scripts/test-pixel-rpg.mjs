import { build } from 'esbuild';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const temp=await mkdtemp(join(tmpdir(),'madhorse-pixel-rpg-'));
try {
  const test=await build({absWorkingDir:project,bundle:true,platform:'node',format:'esm',write:false,
    stdin:{resolveDir:project,loader:'ts',contents:`
      import assert from 'node:assert/strict';
      import {readFile} from 'node:fs/promises';
      import {unzipSync,strFromU8} from 'fflate';
      import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {isSceneGraph} from './src/lib/scene-model';
      import {createGameCamera} from './src/lib/game-camera';
      import {createWebGameData,isWebGameData} from './src/lib/web-game-format';
      import {assembleWebGame} from './src/lib/web-game-export';
      import {DEFAULT_SCENE_RENDER_SETTINGS} from './src/hooks/use-scene-render-settings';
      import {buildRpgWorld,createRpgSession,moveRpg,interactRpg,battleRpg,isPixelRpgScene,RPG_TILE} from './src/lib/pixel-rpg-runtime';
      const kit=createGameStarterKit('pixel-rpg',{x:-15,y:50,z:0});
      assert(isSceneGraph(kit.entities),'starter must survive scene validation');
      const before=JSON.stringify(kit.entities);
      const world=buildRpgWorld(kit.entities);
      assert(isPixelRpgScene(kit.entities));assert(world.player);assert(world.companion);assert.equal(world.wild.length,2);
      let state=createRpgSession(world);
      assert.equal(moveRpg(state,world,1,0),state,'guide must block the adjacent tile');
      state=interactRpg(state,world);assert(state.questStarted);assert(!state.questComplete);
      function walkTo(current,col,row){
        const target={x:world.left+(col+.5)*RPG_TILE,y:world.top+(row+.5)*RPG_TILE};
        const key=p=>p.x+','+p.y, queue=[{x:current.x,y:current.y,path:[]}],seen=new Set([key(current)]);
        let found;
        for(let i=0;i<queue.length&&i<1000;i++){
          const node=queue[i];if(key(node)===key(target)){found=node.path;break;}
          for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
            const next=moveRpg({...current,x:node.x,y:node.y,battle:null,grassSteps:0},{...world,wild:[]},dx,dy);
            if(!seen.has(key(next))){seen.add(key(next));queue.push({...next,path:[...node.path,[dx,dy]]});}
          }
        }
        assert(found,'assembled map has no path to '+col+','+row);
        for(const [dx,dy] of found)current=moveRpg(current,world,dx,dy);
        return current;
      }
      state=walkTo(state,18,5);assert(state.battle,'four grass steps must begin a real battle');
      assert.equal(moveRpg(state,world,1,0),state,'battle must stop exploration movement');
      const battleStart=structuredClone(state);
      state=battleRpg(state,world,'attack');state=battleRpg(state,world,'attack');
      assert(state.battle.hp<battleStart.battle.hp);assert(state.hp<state.maxHp);
      state=battleRpg({...state,seed:0},world,'capture');assert.equal(state.party.length,1);assert(!state.battle);assert.equal(state.orbs,4);
      state=walkTo(state,9,12);assert(!state.battle,'return route must not trap the player in unavoidable encounters');
      state=interactRpg(state,world);assert(state.questComplete,'capturing and returning must finish the quest');
      state=walkTo({...state,hp:1,orbs:0},12,13);state=interactRpg(state,world);
      assert.equal(state.hp,state.maxHp);assert(state.orbs>=3,'healer must prevent an empty-bag softlock');
      const escaped=battleRpg(battleStart,world,'run');assert(!escaped.battle);
      const rescued=battleRpg({...battleStart,hp:1,seed:4231},world,'attack');
      assert(!rescued.battle);assert.equal(rescued.hp,rescued.maxHp);assert.equal(rescued.x,world.player.x);
      const source={entities:kit.entities,camera:createGameCamera(kit.entities),assets:kit.generatedAssets.map(item=>item.asset),
        animations:[],animationControllers:[],uiControls:[],scripts:[],prefabs:[],builderHistory:[],builderDraft:null,builderDraftRequest:'',builderBuildLogs:[]};
      const portable=createWebGameData('Mosslight test',source,DEFAULT_SCENE_RENDER_SETTINGS);
      const runtimeDir=${JSON.stringify(join(project,'public/game-player'))};
      const manifest=JSON.parse(await readFile(runtimeDir+'/bundle.json','utf8'));
      const runtime=await Promise.all(manifest.files.map(async path=>({path,blob:new Blob([await readFile(runtimeDir+'/'+path)])})));
      const files=new Map(kit.generatedAssets.map(item=>[item.asset.id,item.file]));
      const archive=await assembleWebGame(portable,runtime,async id=>files.get(id)??null);
      const entries=unzipSync(new Uint8Array(await archive.arrayBuffer()));
      const exported=JSON.parse(strFromU8(entries['game.json']));
      assert(isWebGameData(exported),'RPG components and sprite references must survive web export validation');
      for(const path of Object.values(exported.assetFiles))assert(entries[path],'sprite file missing from export');
      assert(isPixelRpgScene(exported.entities));assert.equal(JSON.stringify(kit.entities),before,'simulation must not alter authored scene data');
      assert.deepEqual(createRpgSession(world),createRpgSession(world),'new Play/Test sessions must start fresh');
      console.log('Pixel RPG passed: scene validation, assembled-map collision/pathing, dialogue, encounter, battle, capture, quest completion, healing, escape, rescue, source preservation, portable web-game data.');
    `}});
  await writeFile(join(temp,'test.mjs'),test.outputFiles[0].text);
  await import(pathToFileURL(join(temp,'test.mjs')).href);
  const fixture=resolve(project,'../../generated-artifacts/pixel-rpg-preview');
  await mkdir(fixture,{recursive:true});
  const resolvePackage=createRequire(join(project,'package.json')).resolve;
  await build({absWorkingDir:project,bundle:true,platform:'browser',format:'esm',jsx:'automatic',outfile:join(fixture,'app.js'),
    plugins:[{name:'single-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:resolvePackage(args.path)}));}}],
    stdin:{resolveDir:project,loader:'tsx',contents:`
      import {createRoot} from 'react-dom/client';
      import {flushSync} from 'react-dom';
      import {PixelRpgViewport} from './src/components/pixel-rpg-viewport';
      import {createPixelRpgStarter} from './src/lib/pixel-rpg-starter';
      import {createGameCamera} from './src/lib/game-camera';
      const kit=createPixelRpgStarter({x:50,y:50,z:0}),urls=Object.fromEntries(kit.generatedAssets.map(({asset,file})=>[asset.id,URL.createObjectURL(file)]));
      const noop=()=>{};
      flushSync(()=>createRoot(document.getElementById('root'),{onUncaughtError:e=>document.body.textContent=String(e)}).render(
        <PixelRpgViewport entities={kit.entities} assets={kit.generatedAssets.map(item=>item.asset)} assetUrls={urls}
          playing gameView readOnly projectName="Mosslight Trail" selectedEntityId={null} playerPreviewPosition={{x:0,y:0}}
          transformMode="translate" onSelectEntity={noop} onTransformCommit={noop} onTransformModeChange={noop}
          primaryCamera={createGameCamera(kit.entities)} />
      ));
    `}});
  const prefix='/madhorse-studio/@fs'+fixture;
  await writeFile(join(fixture,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Mosslight Trail · actual RPG runtime fixture</title><link rel="stylesheet" href="${prefix}/app.css"><style>html,body{margin:0;height:100%;background:#101b25}#root{height:100%;max-width:1100px;margin:auto}</style></head><body><div id="root"></div><script type="module" src="${prefix}/app.js"></script></body></html>`);
  console.log('Actual-component preview:',fixture+'/index.html');
} finally {await rm(temp,{recursive:true,force:true});}
