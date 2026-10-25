import {getWorldTransform,localTransformFromWorld,type SceneEntity} from './scene-model';
import {isCharacterBuilderModelRoot} from './character-builder-geometry';
import type {GameFeatureComponent} from './game-feature-model';
import type {GameCamera} from './game-camera';

type Team='home'|'away';
type Point={x:number;y:number;z:number};
export type BasketballInput={x:number;z:number;sprint:boolean;shootHeld:boolean;shootReleased:boolean;pass:boolean;steal:boolean;switchPlayer:boolean};
export const EMPTY_BASKETBALL_INPUT:BasketballInput={x:0,z:0,sprint:false,shootHeld:false,shootReleased:false,pass:false,steal:false,switchPlayer:false};
export type BasketballWorld={arenaId:string|null;ballId:string|null;indicatorId:string|null;center:{x:number;z:number};width:number;length:number;
  matchSeconds:number;homeName:string;awayName:string;players:Array<{id:string;team:Team;number:number;x:number;z:number;y:number;speed:number}>;
  hoops:Record<Team,Point>;errors:string[]};
type Player={id:string;x:number;z:number;y:number;yaw:number;moving?:boolean};
type Flight={kind:'shot'|'pass';elapsed:number;duration:number;start:Point;target:Point;shooterId:string;receiverId?:string;points:number;team:Team};
export type BasketballState={time:number;remaining:number;shotClock:number;homeScore:number;awayScore:number;controlledId:string;holderId:string|null;
  players:Player[];ball:Point;flight:Flight|null;looseTime:number;charge:number;charging:boolean;seed:number;over:boolean;
  message:string;log:string[];velocity:Point;lastTeam:Team;holderSince:number;lastSteal:number};
const feature=(e:SceneEntity)=>e.components.find((c):c is GameFeatureComponent=>c.type==='gameFeature'&&c.enabled&&c.kind==='basketball');
const opposite=(team:Team):Team=>team==='home'?'away':'home';
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function isBasketballScene(entities:SceneEntity[]){return entities.some(e=>e.active&&feature(e)?.settings.role==='arena');}
export function buildBasketballWorld(entities:SceneEntity[]):BasketballWorld{
  const byId=new Map(entities.map(e=>[e.id,e]));
  const enabled=(e:SceneEntity)=>{const seen=new Set<string>();let p:SceneEntity|undefined=e;
    while(p){if(!p.active||seen.has(p.id))return false;seen.add(p.id);p=p.parentId?byId.get(p.parentId):undefined;}return true;};
  const active=entities.filter(enabled),arena=active.find(e=>feature(e)?.settings.role==='arena'),s=arena?feature(arena)!.settings:{};
  const point=(id:string):Point=>{const t=getWorldTransform(entities,id)?.position??{x:50,y:50,z:0};return{x:(t.x-50)/10,y:t.z/10,z:(t.y-50)/10};};
  const center=arena?point(arena.id):{x:0,y:0,z:0};
  const world:BasketballWorld={arenaId:arena?.id??null,ballId:null,indicatorId:null,center,width:Number(s.courtWidth??15),length:Number(s.courtLength??28),
    matchSeconds:Number(s.matchSeconds??180),homeName:String(s.homeName??'Metro Comets'),awayName:String(s.awayName??'Harbor Waves'),
    players:[],hoops:{home:{x:center.x,y:3.05,z:center.z+12},away:{x:center.x,y:3.05,z:center.z-12}},errors:[]};
  for(const e of active){const f=feature(e);if(!f)continue;const p=point(e.id);
    if(f.settings.role==='ball')world.ballId=e.id;
    if(f.settings.role==='indicator')world.indicatorId=e.id;
    if(f.settings.role==='player')world.players.push({id:e.id,team:f.settings.team as Team,number:Number(f.settings.jerseyNumber),...p,speed:Number(f.settings.moveSpeed)});
    if(f.settings.role==='hoop')world.hoops[f.settings.team as Team]=p;
  }
  const start=world.players.find(p=>p.team==='home'&&feature(byId.get(p.id)!)?.settings.controlled===true);
  if(start)world.players=[start,...world.players.filter(p=>p!==start)];
  if(!arena)world.errors.push('Add an enabled basketball arena.');
  if(!world.ballId)world.errors.push('Add an enabled basketball ball.');
  for(const team of ['home','away'] as const){
    if(!world.players.some(p=>p.team===team))world.errors.push('Add a '+team+' player.');
    if(world.players.filter(p=>p.team===team).length>5)world.errors.push('Use up to five players per team.');
    if(!active.some(e=>feature(e)?.settings.role==='hoop'&&feature(e)?.settings.team===team))world.errors.push('Add the '+team+' attacking hoop at its rim center.');
  }
  return world;
}
function note(s:BasketballState,message:string){s.message=message;s.log=[...s.log.slice(-8),message];}
function rand(s:BasketballState){let n=s.seed|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.seed=n>>>0;return s.seed/4294967296;}
const definition=(w:BasketballWorld,id:string)=>w.players.find(p=>p.id===id);
function takeBall(w:BasketballWorld,s:BasketballState,id:string,reason?:string,offensiveRebound=false){
  const player=definition(w,id);if(!player)return;
  if(player.team!==s.lastTeam)s.shotClock=24;
  else if(offensiveRebound)s.shotClock=14;
  s.holderId=id;s.lastTeam=player.team;s.holderSince=s.time;s.flight=null;s.looseTime=0;s.charging=false;s.charge=0;
  if(reason)note(s,reason);
}
function inbound(w:BasketballWorld,s:BasketballState,team:Team,reason:string){
  s.players=w.players.map(p=>({id:p.id,x:p.x,z:p.z,y:p.y,yaw:p.team==='home'?0:180}));
  const carrier=w.players.find(p=>p.team===team);if(carrier)takeBall(w,s,carrier.id);
  s.shotClock=24;note(s,reason);
}
export function createBasketballSession(w:BasketballWorld,seed=78123):BasketballState{
  const player=w.players.find(p=>p.team==='home');
  const state:BasketballState={time:0,remaining:w.matchSeconds,shotClock:24,homeScore:0,awayScore:0,controlledId:player?.id??'',holderId:player?.id??null,
    players:w.players.map(p=>({id:p.id,x:p.x,z:p.z,y:p.y,yaw:p.team==='home'?0:180})),ball:{x:player?.x??0,y:1,z:player?.z??0},
    flight:null,looseTime:0,charge:0,charging:false,seed:seed||1,over:false,message:'',log:[],velocity:{x:0,y:0,z:0},lastTeam:'home',holderSince:0,lastSteal:-3};
  note(state,w.errors.length?w.errors.join(' '):'Home ball. Move with WASD; hold Space and release in the green zone to shoot.');
  return state;
}
function shoot(w:BasketballWorld,s:BasketballState,shooter:Player,charge:number){
  const d=definition(w,shooter.id)!;const hoop=w.hoops[d.team],range=distance(shooter,hoop);
  const contest=s.players.filter(p=>definition(w,p.id)?.team!==d.team&&distance(p,shooter)<2).length;
  const quality=clamp(.93*(1-Math.abs(charge-.75)/.75)-Math.max(0,range-4)*.065-contest*.13,.04,.95);
  const made=rand(s)<quality,angle=rand(s)*Math.PI*2,offset=made?rand(s)*.07:.32+rand(s)*.65;
  const target={x:hoop.x+Math.cos(angle)*offset,y:hoop.y,z:hoop.z+Math.sin(angle)*offset};
  s.flight={kind:'shot',elapsed:0,duration:1.05+range*.025,start:{x:shooter.x,y:shooter.y+1.8,z:shooter.z},target,shooterId:shooter.id,
    points:range>=6.75?3:2,team:d.team};
  s.holderId=null;s.charging=false;s.charge=0;note(s,(d.team==='home'?w.homeName:w.awayName)+' #'+d.number+' shoots for '+s.flight.points+'.');
}
function pass(w:BasketballWorld,s:BasketballState,from:Player,to:Player){
  const team=definition(w,from.id)!.team;
  s.flight={kind:'pass',elapsed:0,duration:clamp(distance(from,to)/15,.22,.65),start:{x:from.x,y:from.y+1.15,z:from.z},
    target:{x:to.x,y:to.y+1.15,z:to.z},shooterId:from.id,receiverId:to.id,points:0,team};
  s.holderId=null;s.charging=false;s.charge=0;
  if(team==='home')s.controlledId=to.id;
  note(s,'Pass to #'+definition(w,to.id)!.number+'.');
}
export function stepBasketball(w:BasketballWorld,source:BasketballState,input:BasketballInput,delta:number):BasketballState{
  if(source.over||w.errors.length||delta<=0)return source;
  const dt=clamp(delta,0,1/20),s:BasketballState={...source,players:source.players.map(p=>({...p,moving:false})),ball:{...source.ball},
    velocity:{...source.velocity},flight:source.flight?{...source.flight,start:{...source.flight.start},target:{...source.flight.target}}:null,log:source.log};
  s.time+=dt;s.remaining=Math.max(0,s.remaining-dt);
  if(!s.remaining&&s.flight?.kind!=='shot'){s.over=true;note(s,s.homeScore===s.awayScore?'Exhibition finished in a draw.':(s.homeScore>s.awayScore?w.homeName:w.awayName)+' wins the exhibition!');return s;}
  if(!s.flight||s.flight.kind==='pass')s.shotClock-=dt;
  if(s.shotClock<=0){inbound(w,s,opposite(s.lastTeam),'24-second violation. Possession changes.');}
  const teammates=w.players.filter(p=>p.team==='home');
  if(input.switchPlayer&&teammates.length){const index=teammates.findIndex(p=>p.id===s.controlledId);s.controlledId=teammates[(index+1)%teammates.length].id;s.charging=false;s.charge=0;}
  const controlled=s.players.find(p=>p.id===s.controlledId);
  const move=(p:Player,dx:number,dz:number,speed:number)=>{
    const len=Math.hypot(dx,dz);if(len<.001)return;const amount=Math.min(1,len);
    p.x=clamp(p.x+dx/len*speed*dt*amount,w.center.x-w.width/2+.4,w.center.x+w.width/2-.4);
    p.z=clamp(p.z+dz/len*speed*dt*amount,w.center.z-w.length/2+.4,w.center.z+w.length/2-.4);
    p.yaw=-Math.atan2(dx,dz)*180/Math.PI;
    p.moving=true;
  };
  if(controlled)move(controlled,input.x,input.z,definition(w,controlled.id)!.speed*(input.sprint?1.35:1));
  const holder=s.players.find(p=>p.id===s.holderId),offense=holder?definition(w,holder.id)!.team:s.lastTeam;
  for(const p of s.players){
    if(p.id===s.controlledId)continue;
    const def=definition(w,p.id)!;let target:{x:number;z:number};
    if(!s.holderId&&!s.flight)target=s.ball;
    else if(p.id===s.holderId){const hoop=w.hoops[def.team],direction=Math.sign(hoop.z-w.center.z)||1;
      target={x:hoop.x+(def.number%2?1.4:-1.4),z:hoop.z-direction*3.2};}
    else if(def.team===offense){const hoop=w.hoops[def.team],direction=Math.sign(hoop.z-w.center.z)||1;
      target={x:w.center.x+(def.number%2?4.4:-4.4),z:hoop.z-direction*(5+def.number%2*2)};}
    else{const attackers=s.players.filter(a=>definition(w,a.id)?.team!==def.team);
      const mark=holder&&distance(p,holder)<4?holder:attackers[(def.number-1)%Math.max(1,attackers.length)];
      const ownHoop=w.hoops[opposite(def.team)];target=mark?{x:mark.x+(ownHoop.x-mark.x)*.14,z:mark.z+(ownHoop.z-mark.z)*.14}:ownHoop;}
    const dx=target.x-p.x,dz=target.z-p.z;if(Math.hypot(dx,dz)>.25)move(p,dx,dz,def.speed*.82);
  }
  for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){
    const a=s.players[i],b=s.players[j],d=distance(a,b);if(d<.65){const dx=d>.001?(a.x-b.x)/d:1,dz=d>.001?(a.z-b.z)/d:0,push=(.65-d)*.5;
      a.x+=dx*push;a.z+=dz*push;b.x-=dx*push;b.z-=dz*push;}
  }
  for(const p of s.players){p.x=clamp(p.x,w.center.x-w.width/2+.4,w.center.x+w.width/2-.4);p.z=clamp(p.z,w.center.z-w.length/2+.4,w.center.z+w.length/2-.4);}
  if(input.steal&&controlled&&holder&&definition(w,holder.id)?.team==='away'){
    if(distance(controlled,holder)>1.6)note(s,'Move closer to the ball carrier to steal.');
    else if(s.time-s.lastSteal>1){s.lastSteal=s.time;if(rand(s)<.52)takeBall(w,s,controlled.id,'Clean steal! Home possession.');else note(s,'Steal missed. Stay in front of the ball carrier.');}
  }
  const current=s.players.find(p=>p.id===s.holderId);
  if(current){
    const def=definition(w,current.id)!;
    if(current.id===s.controlledId){
      if(!input.shootHeld&&!input.shootReleased){s.charging=false;s.charge=0;}
      if(input.shootHeld){s.charging=true;s.charge=clamp(s.charge+dt/.95,0,1);}
      if(input.shootReleased)shoot(w,s,current,s.charging?s.charge:.75);
      else if(input.pass){const receivers=s.players.filter(p=>p.id!==current.id&&definition(w,p.id)?.team==='home').sort((a,b)=>distance(a,w.hoops.home)-distance(b,w.hoops.home));
        if(receivers[0])pass(w,s,current,receivers[0]);}
    }else{
      const age=s.time-s.holderSince;
      if(age>1.8&&(distance(current,w.hoops[def.team])<5.5||s.shotClock<5))shoot(w,s,current,.68+rand(s)*.12);
      else if(age>3&&def.team==='home'&&controlled&&distance(controlled,current)>2)pass(w,s,current,controlled);
    }
    if(s.holderId&&s.time-s.lastSteal>2&&s.time-s.holderSince>1.2){
      const defender=s.players.find(p=>p.id!==s.controlledId&&definition(w,p.id)?.team!==def.team&&distance(p,current)<.9);
      if(defender){s.lastSteal=s.time;if(rand(s)<.19)takeBall(w,s,defender.id,'The defense steals possession.');}
    }
  }else{s.charging=false;s.charge=0;}
  if(s.flight){
    const f=s.flight;f.elapsed+=dt;
    if(f.kind==='pass'){const receiver=s.players.find(p=>p.id===f.receiverId);if(receiver)f.target={x:receiver.x,y:receiver.y+1.15,z:receiver.z};}
    const t=clamp(f.elapsed/f.duration,0,1);
    s.ball={x:f.start.x+(f.target.x-f.start.x)*t,z:f.start.z+(f.target.z-f.start.z)*t,
      y:f.start.y+(f.target.y-f.start.y)*t+(f.kind==='shot'?4.905*f.duration*f.duration:1.4)*t*(1-t)};
    if(f.kind==='pass'&&t>.2){
      const interceptor=s.players.find(p=>p.id!==f.shooterId&&definition(w,p.id)?.team!==f.team&&distance(p,s.ball)<.65);
      if(interceptor)takeBall(w,s,interceptor.id,'Pass intercepted.');
    }
    if(s.flight&&t>=1){
      if(f.kind==='pass'&&f.receiverId)takeBall(w,s,f.receiverId);
      else if(f.kind==='shot'){
        if(distance(f.target,w.hoops[f.team])<=.12){
          if(f.team==='home')s.homeScore+=f.points;else s.awayScore+=f.points;
          inbound(w,s,opposite(f.team),(f.team==='home'?w.homeName:w.awayName)+' scores '+f.points+'!');
        }else{s.flight=null;s.holderId=null;s.looseTime=0;s.velocity={x:(rand(s)-.5)*2,y:1,z:(rand(s)-.5)*2};note(s,'Off the rim — rebound!');}
      }
    }
  }else if(!s.holderId){
    s.looseTime+=dt;s.velocity.y-=9.81*dt;s.ball.x+=s.velocity.x*dt;s.ball.z+=s.velocity.z*dt;s.ball.y+=s.velocity.y*dt;
    if(s.ball.y<.12){s.ball.y=.12;s.velocity.y=Math.abs(s.velocity.y)*.48;s.velocity.x*=.88;s.velocity.z*=.88;}
    const rebounder=s.players.filter(p=>distance(p,s.ball)<.8&&s.ball.y<p.y+2.1).sort((a,b)=>distance(a,s.ball)-distance(b,s.ball))[0];
    if(rebounder&&s.looseTime>.1)takeBall(w,s,rebounder.id,'Rebound: '+(definition(w,rebounder.id)?.team==='home'?w.homeName:w.awayName)+'.',definition(w,rebounder.id)?.team===s.lastTeam);
    else if(s.looseTime>5||Math.abs(s.ball.x-w.center.x)>w.width/2+.5||Math.abs(s.ball.z-w.center.z)>w.length/2+.5)inbound(w,s,opposite(s.lastTeam),'Out of play. New possession.');
  }
  if(s.holderId){const carrier=s.players.find(p=>p.id===s.holderId)!;const yaw=-carrier.yaw*Math.PI/180;
    s.ball={x:carrier.x+Math.cos(yaw)*.34,z:carrier.z-Math.sin(yaw)*.34,y:carrier.y+.2+Math.abs(Math.sin(s.time*10))*.8};}
  return s;
}
export function poseBasketballEntities(w:BasketballWorld,s:BasketballState,entities:SceneEntity[]):SceneEntity[]{
  const byId=new Map(entities.map(e=>[e.id,e]));
  const positions=new Map(s.players.map(p=>[p.id,{x:p.x,y:p.y,z:p.z,yaw:p.yaw}]));
  if(w.ballId)positions.set(w.ballId,{...s.ball,yaw:s.time*150});
  const controlled=s.players.find(p=>p.id===s.controlledId);
  if(w.indicatorId&&controlled)positions.set(w.indicatorId,{x:controlled.x,y:.018,z:controlled.z,yaw:0});
  return entities.map(e=>{
    let posed=e;
    const p=positions.get(e.id);
    if(p)posed={...e,components:e.components.map(c=>c.type!=='transform'?c:
      {...c,...localTransformFromWorld(entities,{...c,position:{x:50+p.x*10,y:50+p.z*10,z:p.y*10},rotation:{...c.rotation,z:p.yaw}},e.parentId)})};
    if(isCharacterBuilderModelRoot(e)){
      let ancestor:SceneEntity|undefined=e;const seen=new Set<string>();
      while(ancestor&&!positions.has(ancestor.id)&&!seen.has(ancestor.id)){seen.add(ancestor.id);ancestor=ancestor.parentId?byId.get(ancestor.parentId):undefined;}
      const player=ancestor?s.players.find(player=>player.id===ancestor!.id):null;
      if(player)posed={...posed,runtimePose:{time:s.time,moving:Boolean(player.moving),blocking:false,defeated:false,
        basketball:{shoot:s.flight?.kind==='shot'&&s.flight.shooterId===player.id?Math.max(0,1-s.flight.elapsed/s.flight.duration):s.charging&&s.holderId===player.id?s.charge:0,
          dribble:s.holderId===player.id,passing:s.flight?.kind==='pass'&&s.flight.shooterId===player.id?1-s.flight.elapsed/s.flight.duration:0}}};
    }
    return posed;
  });
}
export function basketballCamera(base:GameCamera,w:BasketballWorld,_state?:BasketballState):GameCamera {
  return {...base,position:{x:w.center.x+w.width*1.15,y:Math.max(15,w.length*.6),z:w.center.z-w.length*.82},
    target:{x:w.center.x,y:1,z:w.center.z},fov:52};
}
