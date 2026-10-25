import { getWorldTransform, type SceneEntity, type Vector3 } from './scene-model';
import type { GameFeatureComponent } from './game-feature-model';

export const cartFeature=(entity:SceneEntity) => entity.components.find((component):component is GameFeatureComponent=>
  component.type==='gameFeature'&&component.enabled&&component.kind==='cart-racer');
export type CartGate={id:string;index:number;position:Vector3;yaw:number;width:number;clearance:number};
export type CartCourse={gates:CartGate[];error:string|null};
export type CartRaceProgress={
  completedLaps:number;nextGate:number;startedAt:number;lapStartedAt:number;elapsed:number;
  bestLap:number|null;finished:boolean;previous:Vector3;error:string|null;
};
export function readCartCourse(entities:SceneEntity[]):CartCourse {
  const byId=new Map(entities.map(entity=>[entity.id,entity]));
  const gates:CartGate[]=[];
  for(const entity of entities){
    const feature=cartFeature(entity);
    if(!entity.active||feature?.settings.role!=='gate')continue;
    let parent=entity.parentId?byId.get(entity.parentId):undefined;
    const seen=new Set([entity.id]);let active=true;
    while(parent){if(!parent.active||seen.has(parent.id)){active=false;break;}seen.add(parent.id);parent=parent.parentId?byId.get(parent.parentId):undefined;}
    if(!active)continue;
    const transform=getWorldTransform(entities,entity.id);if(!transform)continue;
    gates.push({id:entity.id,index:Number(feature.settings.gateIndex),position:{...transform.position},
      yaw:-transform.rotation.z*Math.PI/180,width:Number(feature.settings.gateWidth)*Math.abs(transform.scale.x)*10,
      clearance:Number(feature.settings.gateDepth)*Math.abs(transform.scale.z)*10});
  }
  gates.sort((a,b)=>a.index-b.index);
  const valid=gates.length>0&&gates.every((gate,index)=>gate.index===index&&Number.isFinite(gate.width)&&gate.width>0);
  return {gates,error:valid?null:'Add checkpoint gates with unique consecutive order numbers starting at 0.'};
}
export function createCartProgress(position:Vector3,now:number):CartRaceProgress {
  return {completedLaps:0,nextGate:0,startedAt:now,lapStartedAt:now,elapsed:0,bestLap:null,finished:false,previous:{...position},error:null};
}
export function advanceCartProgress(previous:CartRaceProgress,position:Vector3,now:number,laps:number,course:CartCourse):CartRaceProgress {
  if(previous.finished)return previous;
  const next={...previous,previous:{...position},elapsed:Math.max(0,now-previous.startedAt),error:course.error};
  if(course.error)return next;
  const gate=course.gates[previous.nextGate];
  if(!gate)return {...next,error:'The expected checkpoint was removed. Stop Play/Test and fix the gate order.'};
  const a=previous.previous,b=position;
  // Ignore teleports; normal movement is substepped by the shared scene runtime.
  if(Math.hypot(b.x-a.x,b.y-a.y)>120)return next;
  const sine=Math.sin(gate.yaw),cosine=Math.cos(gate.yaw);
  const forward=(p:Vector3)=>(p.x-gate.position.x)*sine+(p.y-gate.position.y)*cosine;
  const before=forward(a),after=forward(b);
  if(before>0||after<=0||after<=before)return next;
  const fraction=-before/(after-before);
  const x=a.x+(b.x-a.x)*fraction-gate.position.x,y=a.y+(b.y-a.y)*fraction-gate.position.y;
  const z=a.z+(b.z-a.z)*fraction-gate.position.z;
  if(Math.abs(x*cosine-y*sine)>gate.width/2||Math.abs(z)>gate.clearance)return next;
  next.nextGate++;
  if(next.nextGate===course.gates.length){
    next.nextGate=0;next.completedLaps++;
    const duration=Math.max(0,now-previous.lapStartedAt);
    next.bestLap=previous.bestLap===null?duration:Math.min(previous.bestLap,duration);
    next.lapStartedAt=now;next.finished=next.completedLaps>=Math.max(1,laps);
  }
  return next;
}
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,'0')}`;
export function cartRaceText(progress:CartRaceProgress,laps:number,gateCount:number) {
  if(progress.error)return `Race setup: ${progress.error}`;
  return `${progress.finished?'FINISHED':`Lap ${Math.min(laps,progress.completedLaps+1)}/${laps} · Gate ${progress.nextGate+1}/${gateCount}`} · Time ${clock(progress.elapsed)} · Best ${progress.bestLap===null?'—':clock(progress.bestLap)}`;
}
/** Source XY yaw is counter-clockwise; driving heading is clockwise from +Y. */
export function cartChaseCamera<T extends {position:Vector3;target:Vector3}>(base:T,entities:SceneEntity[],playerId:string,firstPerson=false):T|null {
  const player=entities.find(entity=>entity.id===playerId);
  if(!player||cartFeature(player)?.settings.role!=='player')return null;
  const pose=getWorldTransform(entities,player.id);if(!pose)return null;
  const heading=-pose.rotation.z*Math.PI/180,sine=Math.sin(heading),cosine=Math.cos(heading);
  const x=(pose.position.x-50)/10,y=pose.position.z/10,z=(pose.position.y-50)/10;
  if(firstPerson)return {...base,rotation:undefined,
    position:{x:x+sine*.6,y:y+.95,z:z+cosine*.6},
    target:{x:x+sine*8,y:y+.95,z:z+cosine*8}};
  return {...base,rotation:undefined,
    position:{x:x-sine*6.5+cosine*1.2,y:y+3.1,z:z-cosine*6.5-sine*1.2},
    target:{x:x+sine*2.4,y:y+.9,z:z+cosine*2.4}};
}
