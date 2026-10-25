import { getTransform, type SceneEntity } from './scene-model';
import type { GameFeatureComponent } from './game-feature-model';

export const RPG_TILE = 4;
export function rpgFeature(entity: SceneEntity) {
  return entity.components.find((c): c is GameFeatureComponent => c.type === 'gameFeature' && c.kind === 'creature-rpg' && c.enabled);
}
export const isPixelRpgScene = (entities: SceneEntity[]) => entities.some(entity => entity.active &&
  ['world','player'].includes(String(rpgFeature(entity)?.settings.role)) &&
  entity.components.some(component=>component.type==='spriteRenderer'&&component.enabled));
export type RpgActor = { entity: SceneEntity; role: string; x: number; y: number; z: number; w: number; h: number; angle: number; feature?: GameFeatureComponent };
export type RpgWorld = { actors: RpgActor[]; player?: RpgActor; companion?: RpgActor; wild: RpgActor[]; left: number; top: number; width: number; height: number };
export function buildRpgWorld(entities: SceneEntity[]): RpgWorld {
  const byId = new Map(entities.map(entity => [entity.id, entity]));
  type Pose = {x:number;y:number;z:number;sx:number;sy:number;angle:number};
  const cache = new Map<string, Pose | null>();
  function pose(entity: SceneEntity, ancestors = new Set<string>()): Pose | null {
    if (cache.has(entity.id)) return cache.get(entity.id)!;
    if (!entity.active || ancestors.has(entity.id) || ancestors.size > 64) return null;
    const transform = getTransform(entity), t = transform.position;
    const chain = new Set(ancestors).add(entity.id);
    const parent = entity.parentId ? byId.get(entity.parentId) : undefined;
    const p = parent ? pose(parent, chain) : null;
    if (entity.parentId && !p) return null;
    const a = (p?.angle ?? 0) * Math.PI / 180;
    const x = t.x * (p?.sx ?? 1), y = t.y * (p?.sy ?? 1);
    const result = {x:(p?.x ?? 0)+x*Math.cos(a)-y*Math.sin(a),y:(p?.y ?? 0)+x*Math.sin(a)+y*Math.cos(a),
      z:t.z+(p?.z ?? 0),sx:transform.scale.x*(p?.sx ?? 1),sy:transform.scale.y*(p?.sy ?? 1),angle:transform.rotation.z+(p?.angle ?? 0)};
    cache.set(entity.id,result); return result;
  }
  const actors: RpgActor[] = [];
  for (const entity of entities) {
    const p = pose(entity), sprite = entity.components.find(c => c.type === 'spriteRenderer' && c.enabled);
    if (!p || sprite?.type !== 'spriteRenderer') continue;
    const feature = rpgFeature(entity);
    actors.push({entity,feature,role:String(feature?.settings.role ?? 'decoration'),x:p.x,y:p.y,z:p.z,
      w:sprite.width*Math.abs(p.sx),h:sprite.height*Math.abs(p.sy),angle:p.angle});
  }
  const backdrop = actors.find(actor => actor.role === 'world');
  return {actors, player:actors.find(actor => actor.role === 'player'), companion:actors.find(actor => actor.role === 'companion'),
    wild:actors.filter(actor => actor.role === 'creature'),left:backdrop ? backdrop.x-backdrop.w/2 : 2,
    top:backdrop ? backdrop.y-backdrop.h/2 : 14,width:backdrop?.w || 96,height:backdrop?.h || 72};
}
export type RpgSession = {
  x:number;y:number;hp:number;maxHp:number;orbs:number;grassSteps:number;encounters:number;
  party:string[];questStarted:boolean;questComplete:boolean;message:string;seed:number;
  battle:null|{enemyId:string;hp:number;maxHp:number};
};
const stat = (actor: RpgActor | undefined, key: string, fallback: number) => {
  const value = Number(actor?.feature?.settings[key]); return Number.isFinite(value) && value > 0 ? value : fallback;
};
export function createRpgSession(world: RpgWorld): RpgSession {
  const maxHp = stat(world.companion,'maxHealth',24);
  return {x:world.player?.x ?? 50,y:world.player?.y ?? 50,hp:maxHp,maxHp,
    orbs:Math.max(0,Number(world.player?.feature?.settings.captureBalls ?? 5)),grassSteps:0,encounters:0,party:[],
    questStarted:false,questComplete:false,seed:4231,battle:null,
    message:world.player ? 'Mosslight Trail · Talk to the guide beside you with E.' : 'No player: give a sprite the 2D Creature RPG → Player role.'};
}
function contains(actor:RpgActor,x:number,y:number,margin=0) {
  const a=actor.angle*Math.PI/180, dx=x-actor.x,dy=y-actor.y;
  return Math.abs(dx*Math.cos(a)+dy*Math.sin(a)) < actor.w/2+margin &&
    Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)) < actor.h/2+margin;
}
export function moveRpg(session:RpgSession,world:RpgWorld,dx:number,dy:number):RpgSession {
  if (!world.player || session.battle || Math.abs(dx)+Math.abs(dy)!==1) return session;
  const x=session.x+dx*RPG_TILE,y=session.y+dy*RPG_TILE;
  if (x<world.left+RPG_TILE/2 || x>world.left+world.width-RPG_TILE/2 ||
      y<world.top+RPG_TILE/2 || y>world.top+world.height-RPG_TILE/2) return session;
  if (world.actors.some(actor => ['solid','npc','quest-guide','healer'].includes(actor.role) && contains(actor,x,y,RPG_TILE*.2))) return session;
  const grass=world.actors.some(actor => actor.role==='grass' && contains(actor,x,y));
  const steps=grass ? session.grassSteps+1 : 0;
  const next={...session,x,y,grassSteps:steps};
  if (grass && steps>=stat(world.player,'encounterSteps',4) && world.wild.length && world.companion) {
    const enemy=world.wild[session.encounters%world.wild.length];
    const hp=stat(enemy,'maxHealth',18);
    return {...next,grassSteps:0,encounters:session.encounters+1,battle:{enemyId:enemy.entity.id,hp,maxHp:hp},
      message:`A wild ${enemy.feature?.settings.creatureName ?? enemy.entity.name} appeared!`};
  }
  return next;
}
export function interactRpg(session:RpgSession,world:RpgWorld):RpgSession {
  if (session.battle) return session;
  const neighbors=world.actors.filter(actor => ['npc','quest-guide','healer'].includes(actor.role) &&
    Math.hypot(actor.x-session.x,actor.y-session.y)<=RPG_TILE*1.45);
  const actor=neighbors.sort((a,b)=>Math.hypot(a.x-session.x,a.y-session.y)-Math.hypot(b.x-session.x,b.y-session.y))[0];
  if (!actor) return {...session,message:'Stand beside a neighbor and press E. Wild creatures live in the tall grass.'};
  if (actor.role==='healer') return {...session,hp:session.maxHp,orbs:Math.max(3,session.orbs),
    message:String(actor.feature?.settings.dialogue || 'Your companion is healed, and your orbs are restocked!')};
  if (actor.role==='npc') return {...session,message:String(actor.feature?.settings.dialogue || 'Hello, explorer!')};
  if (session.party.length) return {...session,questStarted:true,questComplete:true,message:`Quest complete! You brought ${session.party[0]} home. Keep exploring or stop and edit your adventure.`};
  return {...session,questStarted:true,message:String(actor.feature?.settings.dialogue || 'Catch a wild creature, then bring your new friend back to me!')};
}
export function battleRpg(session:RpgSession,world:RpgWorld,action:'attack'|'capture'|'run'):RpgSession {
  if (!session.battle) return session;
  const enemy=world.wild.find(actor=>actor.entity.id===session.battle!.enemyId);
  if (!enemy || !world.companion) return {...session,battle:null,message:'A battle object was removed. Return to the map.'};
  if (action==='run') return {...session,battle:null,grassSteps:0,message:'You returned safely to the trail.'};
  let next={...session,battle:{...session.battle},party:[...session.party]};
  const name=String(enemy.feature?.settings.creatureName || enemy.entity.name);
  if (action==='attack') {
    next.battle.hp=Math.max(0,next.battle.hp-stat(world.companion,'damage',6));
    if (!next.battle.hp) return {...next,battle:null,message:`You won against ${name}! Heal up or find another wild friend.`};
    next.message=`Your companion attacked ${name}.`;
  } else {
    if (!session.orbs) return {...session,message:'No capture orbs left. Run, then visit the healing neighbor.'};
    next.orbs--; next.seed=(Math.imul(next.seed,1664525)+1013904223)>>>0;
    if (next.seed/4294967296 < .35+(1-next.battle.hp/next.battle.maxHp)*.6) {
      next.party.push(name);
      return {...next,battle:null,message:`Captured ${name}! Return to the guide beside the town path.`};
    }
    next.message=`${name} broke free!`;
  }
  next.hp=Math.max(0,next.hp-stat(enemy,'damage',3));
  if (!next.hp) return {...next,x:world.player?.x ?? session.x,y:world.player?.y ?? session.y,hp:next.maxHp,
    battle:null,grassSteps:0,orbs:Math.max(3,next.orbs),message:'Your companion fainted. Back in town, your team was healed. Try again!'};
  return {...next,message:`${next.message} ${name} struck back.`};
}
