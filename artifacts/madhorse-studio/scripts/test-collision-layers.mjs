import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const temporary = await mkdtemp(join(tmpdir(), 'madhorse-collision-'));
try {
  const built = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import assert from 'node:assert/strict';
      import { canBodiesCollide, isCollisionFilter, collidesWithWorldFloor } from './src/lib/collision-layers';
      import { createPhysicsComponent, isPhysicsComponent } from './src/lib/scene-model';
      import { stepPhysicsScene } from './src/lib/physics-simulation';
      import { createWebGameData } from './src/lib/web-game-format';
      import { createGameCamera } from './src/lib/game-camera';
      import { DEFAULT_SCENE_RENDER_SETTINGS } from './src/hooks/use-scene-render-settings';
      assert(canBodiesCollide({}, {}), 'Old saves retain their contact behavior');
      for (let layer=0; layer<6; layer++) {
        assert(canBodiesCollide({collisionLayer:layer}, {}));
        assert(!canBodiesCollide({collisionLayer:layer,collisionMask:0}, {}));
        assert(!canBodiesCollide({}, {collisionLayer:layer,collisionMask:0}));
      }
      assert(!isCollisionFilter({collisionLayer:6}));
      assert(!isCollisionFilter({collisionLayer:-1}));
      assert(!isCollisionFilter({collisionMask:64}));
      assert(!isCollisionFilter({collisionMask:1.2}));
      assert(!isCollisionFilter({collisionMask:NaN}));
      assert(collidesWithWorldFloor({collisionMask:2}));
      assert(!collidesWithWorldFloor({collisionMask:1}));
      const physics=createPhysicsComponent();
      assert(isPhysicsComponent(physics));
      assert(isPhysicsComponent({...physics,collisionLayer:undefined,collisionMask:undefined}));
      assert(!isPhysicsComponent({...physics,collisionMask:-1}));
      assert.deepEqual(JSON.parse(JSON.stringify(physics)),physics);
      function body(id, x, type, filter={}) {
        return {id,name:id,active:true,parentId:null,components:[
          {id:id+'t',type:'transform',enabled:true,position:{x,y:100,z:100},
            rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},
          {...createPhysicsComponent(type),size:{x:1,y:1,z:1},gravityScale:0,...filter}
        ]};
      }
      const world={dimension:'3d',gravity:{x:0,y:0,z:0}};
      const moving=body('a',0,'dynamic',{collisionLayer:2});
      const fixed=body('b',.75,'static',{collisionLayer:3});
      const entities=[moving,fixed], before=JSON.stringify(entities);
      const exported=createWebGameData('Collision test',{
        entities,camera:createGameCamera(entities),assets:[],scripts:[],animations:[],
        animationControllers:[],uiControls:[],prefabs:[]
      },DEFAULT_SCENE_RENDER_SETTINGS);
      assert.equal(exported.entities[0].components.find(c=>c.type==='physics').collisionLayer,2);
      assert.equal(exported.entities[0].components.find(c=>c.type==='physics').collisionMask,63);
      const allowed=stepPhysicsScene(entities,world,.016,new Map());
      assert(allowed[0].components[0].position.x<0, 'Allowed contacts separate overlapping bodies');
      assert.equal(JSON.stringify(entities),before,'Simulation must not mutate the saved scene');
      for (const blocked of [
        [body('a',0,'dynamic',{collisionLayer:2,collisionMask:2}),fixed],
        [moving,body('b',.75,'static',{collisionLayer:3,collisionMask:1})],
        [body('a',0,'dynamic',{collisionMask:0}),fixed],
      ]) {
        assert.equal(stepPhysicsScene(blocked,world,.016,new Map())[0].components[0].position.x,0,
          'Either side can suppress contact resolution');
      }
      const falling=body('fall',20,'dynamic',{collisionMask:0});
      falling.components[0].position.z=-10;
      assert.equal(stepPhysicsScene([falling],world,.016,new Map())[0].components[0].position.z,-10);
      console.log('PASS: six collision groups, mutual masks, strict validation, saved-data compatibility, real contact filtering and floor filtering.');
    ` },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
  });
  const file = join(temporary, 'test.mjs');
  await writeFile(file, built.outputFiles[0].text);
  await import(pathToFileURL(file).href);
} finally { await rm(temporary, { recursive: true, force: true }); }
