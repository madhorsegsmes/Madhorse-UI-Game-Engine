import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temporary = await mkdtemp(join(tmpdir(), 'madhorse-hierarchy-'));
try {
  const bundled = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {filterSceneHierarchy,hierarchyFilterOptions} from './src/lib/scene-object-actions';
        const node=(id,name,types=[],parentId=null,active=true)=>({id,name,parentId,active,components:types.map(type=>({id:id+'-'+type,type,enabled:true}))});
        const items=[
          node('root','Zone'),
          node('house','Stone house',['primitive'], 'root'),
          node('guard','Night guard',['characterController','physics'], 'root'),
          node('lamp','Lantern',['light'], 'root'),
          node('camera','Scout camera',['camera'], 'root'),
          node('dialog','Gate dialogue',['script','triggerZone'], 'root'),
          node('steps','Footsteps',['playerWalkAudio'], 'root'),
          node('screen','Map display',['uiCanvas'], 'root'),
          node('off','Hidden torch',['light'], 'root',false),
          node('group','Quiet group',[], 'root'),
          node('audio','Ambient track',['gameAudio']),
          node('clone','Imported model',['modelRenderer']),
          node('canvas','Music UI',['uiCanvas']),
          node('event','Shared state',['multiplayerPlugin']),
          node('effect','Glow effect',['effect']),
          node('logic','Starter',['playerAction']),
          node('title','Sky',['skybox']),
          node('move','Character',['primitive','script']),
          node('second','Second room'),
          node('endless','Endless mode',['gameFeature']),
          node('story','Mission',['storyboard']),
          node('box','Collider',['physics']),
        ];
        assert.deepEqual(filterSceneHierarchy(items,'').entities,items,'All/search default stays backward-compatible.');
        const ids=(filter)=>filterSceneHierarchy(items,'',filter).entities.map(x=>x.id);
        const filtered=(filter)=>filterSceneHierarchy(items,'',filter);
        assert.deepEqual(ids('visuals'),['root','house','clone','move']);
        assert.equal(filtered('physics').matches,2);assert(ids('physics').includes('root'));
        assert.equal(filtered('lighting').matches,3);assert(ids('lighting').includes('off'));
        assert.equal(filtered('camera').matches,1);assert(ids('camera').includes('root'));
        assert.equal(filtered('scripts').matches,2);
        assert.equal(filtered('audio').matches,2);
        assert.equal(filtered('ui').matches,2);
        assert.equal(filtered('gameplay').matches,7);
        assert.deepEqual(ids('inactive'),['root','off'],'Type filters preserve only matching leaves and their parent path.');
        assert.equal(filtered('visuals').matches,3,'Visual-only object count.');
        assert.deepEqual(filterSceneHierarchy(items,'night','all').entities.map(x=>x.id),['root','guard']);
        assert.deepEqual(filterSceneHierarchy(items,'NIGHT','gameplay').entities.map(x=>x.id),['root','guard']);
        assert.equal(filterSceneHierarchy(items,'missing','physics').matches,0);
        assert.strictEqual(filterSceneHierarchy(items,'','all').entities,items);
        assert.equal(new Set(hierarchyFilterOptions.map(x=>x.value)).size,hierarchyFilterOptions.length);
        const cycle=[node('a','A',[],'b'),node('b','B',[],'a'),node('linked','Point',['light'],'a')];
        assert.deepEqual(filterSceneHierarchy(cycle,'point','lighting').entities.map(x=>x.id),['a','b','linked'],'Cycles do not hang path projection.');
        console.log('PASS: all object-type filters, name+type composition, parent paths, result counts, legacy search/default, inactive state and cyclic ancestry.');
      ` },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
  });
  const file=join(temporary,'test.mjs');
  await writeFile(file,bundled.outputFiles[0].text);
  await import(pathToFileURL(file).href);
} finally { await rm(temporary,{recursive:true,force:true}); }
