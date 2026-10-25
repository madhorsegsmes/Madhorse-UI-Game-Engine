import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScenePreview3DProps } from './scene-preview-3d';
import { battleRpg, buildRpgWorld, createRpgSession, interactRpg, moveRpg, RPG_TILE, type RpgActor } from '@/lib/pixel-rpg-runtime';
import { getTransform } from '@/lib/scene-model';
import './pixel-rpg-viewport.css';

const WIDTH=384, HEIGHT=288;
export function PixelRpgViewport(props: ScenePreview3DProps & { playing: boolean }) {
  const {entities,assetUrls,playing,staticPreview,onGraphicsReady}=props;
  const world=useMemo(()=>buildRpgWorld(entities),[entities]);
  const kinds=new Map(props.assets.map(asset=>[asset.id,asset.kind]));
  const imageKey=JSON.stringify([...new Set(world.actors.flatMap(actor=>actor.entity.components.flatMap(component=>
    component.type==='spriteRenderer'&&component.enabled&&component.assetId&&kinds.get(component.assetId)==='image'?[component.assetId]:[])))].sort());
  const imageIds=useMemo(()=>new Set<string>(JSON.parse(imageKey)),[imageKey]);
  const [session,setSession]=useState(()=>createRpgSession(world));
  const [images,setImages]=useState<Record<string,HTMLImageElement>>({});
  const [failed,setFailed]=useState<string[]>([]);
  const canvas=useRef<HTMLCanvasElement>(null), host=useRef<HTMLDivElement>(null);
  const tintCache=useRef(new Map<string,HTMLCanvasElement>());
  const drag=useRef<{actor:RpgActor;x:number;y:number;px:number;py:number}|null>(null);
  const lastMove=useRef(0);
  const readyCallback=useRef(onGraphicsReady);readyCallback.current=onGraphicsReady;
  const travel=useRef({x:session.x,y:session.y,fromX:session.x,fromY:session.y,time:0});
  const shown=playing?session:createRpgSession(world);
  useEffect(()=>{
    setSession(createRpgSession(world));
    // Simulation is temporary; changing viewport mode resets it, never the authored map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[playing]);
  useEffect(()=>{
    const t=travel.current;
    if(t.x!==shown.x||t.y!==shown.y) travel.current={x:shown.x,y:shown.y,fromX:t.x,fromY:t.y,time:performance.now()};
  },[shown.x,shown.y]);
  useEffect(()=>{
    let cancelled=false; setImages({});setFailed([]);tintCache.current.clear();
    const list=Object.entries(assetUrls).filter(([id])=>imageIds.has(id)).map(([id,url])=>{
      const image=new Image();
      image.onload=()=>{if(!cancelled)setImages(current=>({...current,[id]:image}));};
      image.onerror=()=>{if(!cancelled)setFailed(current=>[...current,id]);};
      image.src=url; return image;
    });
    return()=>{cancelled=true;list.forEach(image=>{image.onload=null;image.onerror=null;});};
  },[assetUrls,imageIds]);
  useEffect(()=>{if(canvas.current?.getContext('2d'))readyCallback.current?.();},[]);
  useEffect(()=>{
    const context=canvas.current?.getContext('2d');if(!context)return;
    let frame=0;
    function draw(now:number) {
      const ctx=context!;ctx.imageSmoothingEnabled=false;ctx.fillStyle='#233b39';ctx.fillRect(0,0,WIDTH,HEIGHT);
      const sx=WIDTH/world.width,sy=HEIGHT/world.height;
      function sprite(actor:RpgActor,x=actor.x,y=actor.y,w=actor.w*sx,h=actor.h*sy,screen=false) {
        const renderer=actor.entity.components.find(c=>c.type==='spriteRenderer'&&c.enabled);
        const image=renderer?.type==='spriteRenderer'&&renderer.assetId?images[renderer.assetId]:undefined;
        let bitmap:CanvasImageSource|undefined=image;
        if(image&&renderer?.type==='spriteRenderer'&&renderer.tint.toLowerCase()!=='#ffffff') {
          const key=`${renderer.assetId}:${renderer.tint}`;
          let tinted=tintCache.current.get(key);
          if(!tinted){
            tinted=document.createElement('canvas');tinted.width=Math.min(1024,image.naturalWidth);tinted.height=Math.min(1024,image.naturalHeight);
            const c=tinted.getContext('2d');
            if(c){c.drawImage(image,0,0,tinted.width,tinted.height);c.globalCompositeOperation='multiply';c.fillStyle=renderer.tint;c.fillRect(0,0,tinted.width,tinted.height);c.globalCompositeOperation='destination-in';c.drawImage(image,0,0,tinted.width,tinted.height);}
            if(tintCache.current.size>=128)tintCache.current.clear();
            tintCache.current.set(key,tinted);
          } bitmap=tinted;
        }
        ctx.save();ctx.translate(screen?x:Math.round((x-world.left)*sx),screen?y:Math.round((y-world.top)*sy));
        if(!screen)ctx.rotate(actor.angle*Math.PI/180);
        if(bitmap){
          const pattern=actor.feature?.settings.repeatTexture&&!screen?ctx.createPattern(bitmap,'repeat'):null;
          if(pattern&&image){
            const bw=bitmap instanceof HTMLCanvasElement?bitmap.width:image.naturalWidth,bh=bitmap instanceof HTMLCanvasElement?bitmap.height:image.naturalHeight;
            pattern.setTransform(new DOMMatrix().scale(RPG_TILE*sx/bw,RPG_TILE*sy/bh));
            ctx.save();ctx.translate(-w/2,-h/2);ctx.fillStyle=pattern;ctx.fillRect(0,0,w,h);ctx.restore();
          }
          else ctx.drawImage(bitmap,-w/2,-h/2,w,h);
        }else{ctx.fillStyle='#787987';ctx.fillRect(-w/2,-h/2,w,h);}
        if(!playing&&props.selectedEntityId===actor.entity.id){ctx.strokeStyle='#ffed91';ctx.lineWidth=1;ctx.strokeRect(-w/2+.5,-h/2+.5,w-1,h-1);}
        ctx.restore();
      }
      if(shown.battle&&playing) {
        ctx.fillStyle='#e8e9bc';ctx.fillRect(0,0,WIDTH,HEIGHT);
        ctx.fillStyle='#9cbb7a';ctx.fillRect(220,85,140,17);ctx.fillRect(25,209,140,17);
        const enemy=world.wild.find(actor=>actor.entity.id===shown.battle?.enemyId);
        if(enemy)sprite(enemy,280,65,80,80,true);
        if(world.companion)sprite(world.companion,95,182,88,88,true);
        ctx.font='bold 12px monospace';ctx.fillStyle='#263e39';
        ctx.fillText(String(enemy?.feature?.settings.creatureName??'Wild creature'),22,28);
        ctx.fillText(String(world.companion?.feature?.settings.creatureName??'Companion'),220,168);
        const bar=(x:number,y:number,value:number,max:number)=>{ctx.fillStyle='#334c43';ctx.fillRect(x,y,140,10);ctx.fillStyle=value/max>.3?'#56a868':'#cf624b';ctx.fillRect(x+2,y+2,136*Math.max(0,value/max),6);};
        bar(22,39,shown.battle.hp,shown.battle.maxHp);bar(220,180,shown.hp,shown.maxHp);
        ctx.font='11px monospace';ctx.fillStyle='#263e39';ctx.fillText(`HP ${shown.hp}/${shown.maxHp}`,220,207);
        ctx.fillText(`ORBS ${shown.orbs}   FRIENDS ${shown.party.length}`,22,265);
      } else {
        const t=travel.current,p=playing?Math.min(1,(now-t.time)/90):1;
        const actors=[...world.actors].filter(actor=>actor.role!=='companion').sort((a,b)=>a.z-b.z||a.y-b.y);
        for(const actor of actors) {
          if(actor.role==='player'&&playing)sprite(actor,t.fromX+(shown.x-t.fromX)*p,t.fromY+(shown.y-t.fromY)*p);
          else sprite(actor);
        }
        ctx.fillStyle='#17352fe6';ctx.fillRect(4,4,208,19);
        ctx.fillStyle='#ecf3c7';ctx.font='bold 10px monospace';
        ctx.fillText(shown.questComplete?'QUEST COMPLETE · MOSSLIGHT TRAIL':'MOSSLIGHT TRAIL · 2D RPG',10,17);
      }
      if(playing)frame=requestAnimationFrame(draw);
    }
    draw(performance.now());return()=>cancelAnimationFrame(frame);
  },[world,shown,images,playing,props.selectedEntityId]);
  function point(event:React.PointerEvent<HTMLCanvasElement>) {
    const rect=event.currentTarget.getBoundingClientRect(),scale=Math.min(rect.width/WIDTH,rect.height/HEIGHT);
    const x=(event.clientX-rect.left-(rect.width-WIDTH*scale)/2)/scale;
    const y=(event.clientY-rect.top-(rect.height-HEIGHT*scale)/2)/scale;
    if(x<0||y<0||x>WIDTH||y>HEIGHT)return null;
    return {x:world.left+x/WIDTH*world.width,y:world.top+y/HEIGHT*world.height};
  }
  function action(choice:'attack'|'capture'|'run'){setSession(current=>battleRpg(current,world,choice));host.current?.focus();}
  const missing=world.actors.some(actor=>{const c=actor.entity.components.find(c=>c.type==='spriteRenderer'&&c.enabled);return c?.type==='spriteRenderer'&&(!c.assetId||!assetUrls[c.assetId]||!imageIds.has(c.assetId));});
  return <div ref={host} tabIndex={playing?0:-1} className={`pixel-rpg ${staticPreview?'pixel-rpg--preview':''}`}
    data-testid="pixel-rpg-viewport" data-player-x={shown.x} data-player-y={shown.y} data-rpg-battle={Boolean(shown.battle&&playing)}
    aria-label="Mosslight Trail 2D RPG. Click to focus. Arrow keys or WASD walk; E talks; battle keys 1, 2 and 3."
    onKeyDown={event=>{
      if(!playing || (event.target instanceof HTMLElement && event.target.closest('button')))return;
      const key=event.key.toLowerCase(),steps:Record<string,[number,number]>={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};
      if(!steps[key]&&!['e','enter','1','2','3'].includes(key))return;
      event.preventDefault();event.stopPropagation();
      if(steps[key]){if(event.repeat&&performance.now()-lastMove.current<130)return;lastMove.current=performance.now();const [dx,dy]=steps[key];setSession(current=>moveRpg(current,world,dx,dy));}
      else if(event.repeat)return;
      else if(key==='e'||key==='enter')setSession(current=>interactRpg(current,world));
      else action(key==='1'?'attack':key==='2'?'capture':'run');
    }}>
    <div className="pixel-rpg__screen">
      <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Editable pixel-art town and creature battle scene"
        onPointerDown={event=>{
          host.current?.focus();if(playing||props.readOnly||staticPreview)return;
          const p=point(event);if(!p)return;
          const actor=[...world.actors].filter(a=>a.role!=='companion').sort((a,b)=>b.z-a.z||b.y-a.y).find(a=>Math.abs(a.x-p.x)<a.w/2&&Math.abs(a.y-p.y)<a.h/2);
          if(!actor)return;props.onSelectEntity(actor.entity.id);
          if(actor.role==='world'||actor.entity.parentId)return;
          drag.current={actor,x:p.x,y:p.y,px:event.clientX,py:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event=>{
          const start=drag.current;drag.current=null;if(!start)return;
          if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
          const p=point(event);if(!p||Math.hypot(event.clientX-start.px,event.clientY-start.py)<4)return;
          const previous=getTransform(start.actor.entity).position;
          props.onTransformCommit(start.actor.entity.id,{position:{...previous,x:previous.x+Math.round((p.x-start.x)/RPG_TILE)*RPG_TILE,y:previous.y+Math.round((p.y-start.y)/RPG_TILE)*RPG_TILE}});
        }} onPointerCancel={()=>{drag.current=null;}} />
      {(failed.length>0||missing)&&<span className="pixel-rpg__asset-warning">Sprite files missing or loading. Restore missing images through Hierarchy.</span>}
    </div>
    {!staticPreview&&<div className="pixel-rpg__footer">
      <p role="status" data-testid="pixel-rpg-message">{playing?shown.message:'2D scene · Select a sprite or drag an unlinked sprite to move it. Edit dialogue and stats in object settings. Press Play Test to explore.'}</p>
      {playing&&<span className="pixel-rpg__stats">HP {shown.hp}/{shown.maxHp} · Orbs {shown.orbs} · Friends {shown.party.length} · {shown.questComplete?'Quest complete':'Quest: capture a creature and return to the guide'}</span>}
      {playing&&(shown.battle?<div className="pixel-rpg__actions"><button onClick={()=>action('attack')}>1 · Attack</button><button onClick={()=>action('capture')}>2 · Capture ({shown.orbs})</button><button onClick={()=>action('run')}>3 · Run</button></div>
        :<span className="pixel-rpg__keys">Click map · WASD / arrows: walk · E / Enter: talk or heal</span>)}
    </div>}
  </div>;
}
