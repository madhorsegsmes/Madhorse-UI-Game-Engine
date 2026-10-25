import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(project, '../../generated-artifacts/collision-inspector-preview');
const require = createRequire(resolve(project, 'package.json'));
await mkdir(output, { recursive: true });
await build({
  stdin: { resolveDir: project, loader: 'tsx', contents: `
    import { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { SceneObjectInspector } from './src/components/scene-object-inspector';
    import { createPhysicsComponent } from './src/lib/scene-model';
    function Preview() {
      const [entity,setEntity]=useState({id:'collision-preview',name:'Collision test object',
        parentId:null,active:true,components:[
          {id:'t',type:'transform',enabled:true,position:{x:0,y:0,z:0},
            rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1}},createPhysicsComponent()
        ]});
      return <SceneObjectInspector embedded entity={entity} assets={[]} assetUrls={{}}
        onClose={()=>{}} onSave={saved=>{ window.__savedCollisionObject=saved;setEntity(saved);}} />;
    }
    flushSync(()=>createRoot(document.getElementById('root')).render(<Preview/>));
    for(const details of document.querySelectorAll('details'))details.open=true;
    if(new URL(location.href).searchParams.has('verifyPreset')){
      const label=Array.from(document.querySelectorAll('label')).find(item=>
        item.textContent.trim().startsWith('Collision preset'));
      const select=label?.querySelector('select');
      if(!select)throw new Error('Actual collision preset control was not rendered');
      flushSync(()=>{
        select.value='projectile';
        select.dispatchEvent(new Event('change',{bubbles:true}));
      });
      document.querySelector('form').requestSubmit();
      const physics=window.__savedCollisionObject?.components.find(item=>item.type==='physics');
      const result=document.createElement('p');
      result.id='preset-save-verification';
      if(physics?.collisionLayer!==4 || physics?.collisionMask!==47 || physics?.continuousCollision!==true || physics?.simulateInPlay!==true){
        result.textContent='FAIL: preset did not reach the actual inspector Save Changes callback';
        result.style.color='#ff5656';
        console.error(result.textContent);
      }else{
        result.textContent='PASS: actual inspector saved Projectile group, mask 47, continuous detection and Simulate in Play.';
        result.style.color='#8dffc4';
      }
      document.body.prepend(result);
    }
  ` },
  plugins: [{ name: 'single-react', setup(builder) {
    builder.onResolve({ filter: /^react(?:-dom)?(?:[/].*)?$/ }, args => ({ path: require.resolve(args.path) }));
  } }],
  bundle: true, format: 'esm', platform: 'browser', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"development"' }, outfile: resolve(output, 'app.js'),
  logLevel: 'silent',
});
await writeFile(resolve(output, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<title>Actual collision inspector — isolated verification</title>
<style>body{background:#11121a;color:#eee;font:14px Arial;margin:30px auto;max-width:650px}fieldset{border:1px solid #555;margin:12px 0;padding:16px}label{display:flex;gap:10px;align-items:center;margin:7px 0}input,select,button{font:inherit;padding:5px}input[type=number]{width:100px}summary{cursor:pointer;font-weight:bold}small{color:#aaa}p{line-height:1.5}</style>
</head><body><div id="root"></div><script type="module" src="./app.js"></script></body></html>`);
console.log('Actual object inspector fixture: /@fs' + output + '/index.html');
