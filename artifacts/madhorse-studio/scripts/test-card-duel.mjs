import {build} from 'esbuild';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..'),temp=await mkdtemp(join(tmpdir(),'madhorse-duel-'));
try{
  const result=await build({absWorkingDir:project,bundle:true,platform:'node',format:'esm',write:false,
    stdin:{resolveDir:project,loader:'ts',contents:`
      import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
      import {unzipSync,strFromU8} from 'fflate';
      import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {isSceneGraph} from './src/lib/scene-model';
      import {buildDuelWorld,createDuelSession,duelAction,playRivalTurn,isCardDuelScene} from './src/lib/card-duel-runtime';
      import {createGameCamera} from './src/lib/game-camera';
      import {createWebGameData,isWebGameData} from './src/lib/web-game-format';
      import {assembleWebGame} from './src/lib/web-game-export';
      import {DEFAULT_SCENE_RENDER_SETTINGS} from './src/hooks/use-scene-render-settings';
      const kit=createGameStarterKit('card-duel',{x:-15,y:50,z:0}),authored=JSON.stringify(kit.entities);
      assert(isSceneGraph(kit.entities));assert(isCardDuelScene(kit.entities));
      const world=buildDuelWorld(kit.entities);assert.deepEqual(world.errors,[]);
      assert.equal(world.playerDeck.length,20);assert.equal(world.rivalDeck.length,20);
      assert.equal(Object.keys(world.cards).length,13);
      const fresh=()=>createDuelSession(world,1337),card=name=>Object.values(world.cards).find(c=>c.name===name);
      const instance=(name,uid='test')=>({uid,cardId:card(name).id});
      const monster=(name,position='attack',uid=name)=>({instance:instance(name,uid),position,attacked:false,summonedTurn:0,changedTurn:-1,bonusAttack:0});
      let s=fresh();assert.equal(s.player.life,4000);assert.equal(s.player.hand.length,4);assert.equal(s.player.deck.length,15);
      assert.equal(s.player.field.filter(Boolean).length,1);
      assert.deepEqual(fresh(),fresh(),'fixed seeds must reproduce test deals');
      const before=JSON.stringify(s);const first=duelAction(world,s,{type:'battle'});
      assert.equal(first.phase,'main');assert.equal(JSON.stringify(s),before,'actions must not mutate source sessions');
      s.player.hand=[instance('Dawn Knight'),instance('Cloud Wolf','second')];
      s=duelAction(world,s,{type:'summon',hand:0});assert.equal(s.player.field.filter(Boolean).length,2);
      s=duelAction(world,s,{type:'summon',hand:0});assert.equal(s.player.field.filter(Boolean).length,2,'only one normal summon');
      s=fresh();s.player.hand=[instance('Astral Drake')];s.player.field=[monster('Dawn Knight'),null,null];
      const illegal=duelAction(world,s,{type:'summon',hand:0});assert.equal(illegal.player.hand.length,1);
      s.player.field[1]=monster('Cloud Wolf');
      s=duelAction(world,s,{type:'summon',hand:0,tributes:[0,1]});assert.equal(s.player.grave.length,2);
      assert.equal(s.player.field.filter(Boolean).length,1);
      assert.equal(world.cards[s.player.field.find(Boolean).instance.cardId].name,'Astral Drake');
      s=fresh();s.turnNumber=3;s.phase='battle';s.player.field=[monster('Dawn Knight'),null,null];
      s.rival.field=[monster('Cloud Wolf'),null,null];
      s=duelAction(world,s,{type:'attack',slot:0,target:0});assert.equal(s.rival.life,3600);assert.equal(s.rival.field[0],null);
      const twice=duelAction(world,s,{type:'attack',slot:0});assert.equal(twice.rival.life,3600,'one attack per monster');
      s=fresh();s.turnNumber=3;s.phase='battle';s.player.field=[monster('Dawn Knight'),null,null];
      s.rival.field=[monster('Stone Sentinel','defense'),null,null];
      s=duelAction(world,s,{type:'attack',slot:0,target:0});assert.equal(s.player.life,3800);assert(s.player.field[0]);assert(s.rival.field[0]);
      s=fresh();s.turnNumber=3;s.phase='battle';s.player.field=[monster('Dawn Knight'),null,null];s.rival.field=[null,null,null];
      s.rival.traps[0]={instance:instance('Moon Ward'),setTurn:2};
      s=duelAction(world,s,{type:'attack',slot:0});assert.equal(s.rival.life,4000);assert.equal(s.rival.traps[0],null);assert.equal(s.rival.grave.length,1);
      s=fresh();s.player.life=2000;s.player.hand=[instance('Mending Dawn')];
      s=duelAction(world,s,{type:'spell',hand:0});assert.equal(s.player.life,2700);
      s.player.hand=[instance('Valor Bloom')];s=duelAction(world,s,{type:'spell',hand:0,target:1});assert.equal(s.player.field[1].bonusAttack,600);
      s.player.hand=[instance('Surveyor’s Insight')];const deckSize=s.player.deck.length;s=duelAction(world,s,{type:'spell',hand:0});assert.equal(s.player.deck.length,deckSize-2);assert.equal(s.player.hand.length,2);
      s.player.hand=[instance('Shatter Sigil')];s=duelAction(world,s,{type:'spell',hand:0,target:1});assert.equal(s.rival.field[1],null);
      s=fresh();s.rival.life=100;s.player.hand=[instance('Spark Lance')];s=duelAction(world,s,{type:'spell',hand:0});assert.equal(s.winner,'player');
      assert.equal(duelAction(world,s,{type:'end-turn'}),s,'finished duel must freeze');
      s=fresh();s.turn='rival';s.turnNumber=2;s.player.life=100;s.rival.hand=[instance('Spark Lance')];s=playRivalTurn(world,s);assert.equal(s.winner,'rival');
      s=fresh();s.rival.deck=[];s=duelAction(world,s,{type:'end-turn'});assert.equal(s.winner,'player','deck exhaustion wins');
      s=fresh();s=duelAction(world,s,{type:'end-turn'});assert.equal(s.turn,'rival');
      s=playRivalTurn(world,s);assert(s.winner||s.turn==='player');assert(s.turnNumber>=3);
      const modified=structuredClone(kit.entities),definition=modified.find(e=>e.id===card('Dawn Knight').id);
      definition.name='Custom Dawn';definition.components.find(c=>c.type==='gameFeature').settings.attack=2400;
      const edited=buildDuelWorld(modified);assert.equal(edited.cards[definition.id].name,'Custom Dawn');assert.equal(edited.cards[definition.id].attack,2400);
      const table=modified.find(e=>e.id===world.boardId).components.find(c=>c.type==='gameFeature');table.settings.openingField=false;
      assert.equal(createDuelSession(buildDuelWorld(modified),1).player.field.filter(Boolean).length,0);
      assert.equal(JSON.stringify(kit.entities),authored,'all tests must preserve authored project data');
      const source={entities:kit.entities,camera:createGameCamera(kit.entities),assets:kit.generatedAssets.map(x=>x.asset),
        animations:[],animationControllers:[],uiControls:[],scripts:[],prefabs:[],builderHistory:[],builderDraft:null,builderDraftRequest:'',builderBuildLogs:[]};
      const data=createWebGameData('Card Duel test',source,DEFAULT_SCENE_RENDER_SETTINGS);
      const runtimeDir=${JSON.stringify(join(project,'public/game-player'))},manifest=JSON.parse(await readFile(runtimeDir+'/bundle.json','utf8'));
      const runtime=await Promise.all(manifest.files.map(async path=>({path,blob:new Blob([await readFile(runtimeDir+'/'+path)])})));
      const files=new Map(kit.generatedAssets.map(x=>[x.asset.id,x.file])),archive=await assembleWebGame(data,runtime,async id=>files.get(id)??null);
      const entries=unzipSync(new Uint8Array(await archive.arrayBuffer())),exported=JSON.parse(strFromU8(entries['game.json']));
      assert(isWebGameData(exported));assert(isCardDuelScene(exported.entities));
      for(const path of Object.values(exported.assetFiles))assert(entries[path],'every original card/background image must export');
      console.log('Card Duel passed: validated scene/decks, summoning limits, tributes, combat, defense, one-shot wards, spells, AI turns, both winners, deck-out, authored edits, session/source isolation and portable ZIP.');
    `}});
  await writeFile(join(temp,'test.mjs'),result.outputFiles[0].text);await import(pathToFileURL(join(temp,'test.mjs')).href);
  const fixture=resolve(project,'../../generated-artifacts/card-duel-preview');await mkdir(fixture,{recursive:true});
  const resolvePackage=createRequire(join(project,'package.json')).resolve;
  await build({absWorkingDir:project,bundle:true,platform:'browser',format:'esm',jsx:'automatic',outfile:join(fixture,'app.js'),
    plugins:[{name:'single-react',setup(b){b.onResolve({filter:/^react(?:\/.*)?$/},args=>({path:resolvePackage(args.path)}));}}],
    stdin:{resolveDir:project,loader:'tsx',contents:`
      import {useState} from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
      import {ScenePreview3D} from './src/components/scene-preview-3d';import {createGameStarterKit} from './src/lib/scene-starter-kits';
      import {createGameCamera} from './src/lib/game-camera';
      const kit=createGameStarterKit('card-duel',{x:-15,y:50,z:0}),camera=createGameCamera(kit.entities);
      const urls=Object.fromEntries(kit.generatedAssets.map(({asset,file})=>[asset.id,URL.createObjectURL(file)]));
      const noop=()=>{};
      function App(){const [playing,setPlaying]=useState(true),[selected,onSelectEntity]=useState(null);
        const props={entities:kit.entities,assets:kit.generatedAssets.map(x=>x.asset),assetUrls:urls,primaryCamera:camera,
          projectName:'Card Duel · Astral Nexus',selectedEntityId:selected,playerPreviewPosition:{x:0,y:0},
          transformMode:'translate',onSelectEntity,onTransformCommit:noop,onTransformModeChange:noop};
        return <><header><b>Actual Card Duel template</b> <button data-testid="fixture-toggle-play" onClick={()=>setPlaying(!playing)}>{playing?'Stop test':'Play test'}</button></header>
          <main style={{height:'calc(100vh - 52px)',position:'relative'}}><ScenePreview3D {...props} gameView readOnly gameRunning={playing}/></main></>;
      }
      flushSync(()=>createRoot(document.getElementById('root'),{onUncaughtError:e=>document.body.textContent=String(e)}).render(<App/>));
    `}});
  const prefix='/madhorse-studio/@fs'+fixture;
  await writeFile(join(fixture,'index.html'),`<!doctype html><html><head><meta charset="utf-8"><title>Actual Card Duel template verification</title><link rel="stylesheet" href="${prefix}/app.css"><style>html,body{margin:0;height:100%;background:#111622;color:white;font:14px system-ui}header{box-sizing:border-box;height:52px;display:flex;align-items:center;justify-content:space-between;padding:10px 18px}header button{padding:6px 18px}</style></head><body><div id="root"></div><script type="module" src="${prefix}/app.js"></script></body></html>`);
  console.log('Actual-component fixture:',fixture+'/index.html');
}finally{await rm(temp,{recursive:true,force:true});}
