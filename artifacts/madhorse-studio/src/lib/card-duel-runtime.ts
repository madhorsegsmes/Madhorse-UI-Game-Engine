import type {SceneEntity} from './scene-model';
import type {GameFeatureComponent} from './game-feature-model';

export type DuelCard={id:string;name:string;type:'monster'|'spell'|'trap';attack:number;defense:number;level:number;
  effect:'none'|'heal'|'damage'|'destroy'|'shield'|'boost'|'draw';power:number;description:string;artAssetId:string|null;color:string};
export type DuelInstance={uid:string;cardId:string};
export type DuelMonster={instance:DuelInstance;position:'attack'|'defense';attacked:boolean;summonedTurn:number;changedTurn:number;bonusAttack:number};
export type DuelSide={life:number;deck:DuelInstance[];hand:DuelInstance[];field:(DuelMonster|null)[];
  traps:({instance:DuelInstance;setTurn:number}|null)[];grave:DuelInstance[];summoned:boolean};
export type DuelWorld={boardId:string|null;startingLife:number;openingHand:number;openingField:boolean;playerName:string;rivalName:string;
  boardColor:string;boardArtAssetId:string|null;cards:Record<string,DuelCard>;playerDeck:DuelInstance[];rivalDeck:DuelInstance[];errors:string[]};
export type DuelState={turn:'player'|'rival';phase:'main'|'battle';turnNumber:number;player:DuelSide;rival:DuelSide;
  winner:'player'|'rival'|null;message:string;log:string[];seed:number};
export type DuelAction=
  |{type:'summon';hand:number;position?:'attack'|'defense';tributes?:number[]}
  |{type:'spell';hand:number;target?:number}
  |{type:'set-trap';hand:number}
  |{type:'battle'}|{type:'attack';slot:number;target?:number}
  |{type:'position';slot:number}|{type:'end-turn'};
type Seat='player'|'rival';
const other=(seat:Seat):Seat=>seat==='player'?'rival':'player';
const feature=(entity:SceneEntity)=>entity.components.find((c):c is GameFeatureComponent=>c.type==='gameFeature'&&c.enabled&&c.kind==='card-duel');
export function isCardDuelScene(entities:SceneEntity[]) {return entities.some(e=>e.active&&feature(e)?.settings.role==='board');}
export function buildDuelWorld(entities:SceneEntity[]):DuelWorld {
  const byId=new Map(entities.map(e=>[e.id,e]));
  const active=(entity:SceneEntity)=>{const seen=new Set<string>();let current:SceneEntity|undefined=entity;
    while(current){if(!current.active||seen.has(current.id))return false;seen.add(current.id);current=current.parentId?byId.get(current.parentId):undefined;}return true;};
  const board=entities.find(e=>active(e)&&feature(e)?.settings.role==='board'),settings=board?feature(board)!.settings:{};
  const world:DuelWorld={boardId:board?.id??null,startingLife:Number(settings.startingLife??4000),openingHand:Number(settings.openingHand??4),
    openingField:settings.openingField!==false,playerName:String(settings.playerName??'You'),rivalName:String(settings.rivalName??'Nova'),
    boardColor:String(settings.boardColor??'#111e39'),boardArtAssetId:null,cards:{},playerDeck:[],rivalDeck:[],errors:[]};
  if(!board)world.errors.push('Add an enabled Card Duel table.');
  const tableSprite=board?.components.find(c=>c.type==='spriteRenderer'&&c.enabled);
  if(tableSprite?.type==='spriteRenderer')world.boardArtAssetId=tableSprite.assetId;
  for(const entity of entities){
    if(!active(entity))continue;
    const f=feature(entity);if(f?.settings.role!=='card')continue;
    const s=f.settings,sprite=entity.components.find(c=>c.type==='spriteRenderer'&&c.enabled);
    const card:DuelCard={id:entity.id,name:entity.name,type:s.cardType as DuelCard['type'],attack:Number(s.attack),defense:Number(s.defense),
      level:Number(s.level),effect:s.effect as DuelCard['effect'],power:Number(s.power),description:String(s.description),
      artAssetId:sprite?.type==='spriteRenderer'?sprite.assetId:null,color:String(s.cardColor)};
    world.cards[card.id]=card;
    for(const seat of ['player','rival'] as const)if(s.owner==='both'||s.owner===seat){
      const deck=seat==='player'?world.playerDeck:world.rivalDeck;
      for(let i=0;i<Number(s.copies)&&deck.length<=60;i++)deck.push({uid:seat+':'+card.id+':'+i,cardId:card.id});
    }
    if(card.type==='trap'&&card.effect!=='shield')world.errors.push(card.name+': traps currently support the Shield effect.');
    if(card.type==='spell'&&!['heal','damage','destroy','boost','draw'].includes(card.effect))world.errors.push(card.name+': choose a supported spell effect.');
  }
  for(const seat of ['player','rival'] as const){
    const deck=seat==='player'?world.playerDeck:world.rivalDeck;
    if(deck.length<Math.max(8,world.openingHand+1)||deck.length>60)world.errors.push((seat==='player'?world.playerName:world.rivalName)+': use 8–60 cards in the deck.');
    if(!deck.some(c=>world.cards[c.cardId].type==='monster'&&world.cards[c.cardId].level<=4))world.errors.push('Each deck needs a level 1–4 monster.');
  }
  return world;
}
function random(seed:number){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
function shuffled(deck:DuelInstance[],seed:number){const next=deck.map(c=>({...c}));for(let i=next.length-1;i>0;i--){seed=random(seed);const j=seed%(i+1);[next[i],next[j]]=[next[j],next[i]];}return {deck:next,seed};}
const makeMonster=(instance:DuelInstance,turn:number,position:'attack'|'defense'='attack'):DuelMonster=>({instance,position,attacked:false,summonedTurn:turn,changedTurn:-1,bonusAttack:0});
const note=(state:DuelState,message:string)=>{state.message=message;state.log=[...state.log.slice(-23),message];};
function draw(state:DuelState,seat:Seat){
  const card=state[seat].deck.shift();
  if(!card){state.winner=other(seat);note(state,(seat==='player'?'Your':'The rival’s')+' deck is empty. '+(state.winner==='player'?'You win!':'The rival wins.'));return false;}
  state[seat].hand.push(card);return true;
}
export function createDuelSession(world:DuelWorld,seed=Math.floor(Math.random()*0xffffffff)||1):DuelState {
  const p=shuffled(world.playerDeck,seed||1),r=shuffled(world.rivalDeck,p.seed);
  const side=(deck:DuelInstance[]):DuelSide=>({life:world.startingLife,deck,hand:[],field:[null,null,null],traps:[null,null,null],grave:[],summoned:false});
  const state:DuelState={turn:'player',phase:'main',turnNumber:1,player:side(p.deck),rival:side(r.deck),winner:null,
    message:'',log:[],seed:r.seed};
  if(world.errors.length){note(state,world.errors.join(' '));return state;}
  for(const seat of ['player','rival'] as const){
    if(world.openingField){const i=state[seat].deck.findIndex(c=>world.cards[c.cardId].type==='monster'&&world.cards[c.cardId].level<=4);
      if(i>=0)state[seat].field[1]=makeMonster(state[seat].deck.splice(i,1)[0],0);}
    for(let i=0;i<world.openingHand;i++)draw(state,seat);
  }
  note(state,'Your main phase. Summon once, play spells or set a ward. No attacks on the first turn.');
  return state;
}
const tributeCount=(level:number)=>level>=7?2:level>=5?1:0;
const cardOf=(world:DuelWorld,monster:DuelMonster)=>world.cards[monster.instance.cardId];
const atk=(world:DuelWorld,monster:DuelMonster)=>cardOf(world,monster).attack+monster.bonusAttack;
function defeat(state:DuelState,seat:Seat,slot:number){const monster=state[seat].field[slot];if(monster){state[seat].grave.push(monster.instance);state[seat].field[slot]=null;}}
function checkLife(state:DuelState,world:DuelWorld){
  for(const seat of ['player','rival'] as const)if(state[seat].life<=0){state[seat].life=0;state.winner=other(seat);
    note(state,state.winner==='player'?'Victory! '+world.rivalName+' has no life points.':'Defeat. Your life points reached zero.');break;}
}
function apply(world:DuelWorld,source:DuelState,action:DuelAction,seat:Seat):DuelState {
  if(source.winner||world.errors.length||source.turn!==seat)return source;
  const state=structuredClone(source),own=state[seat],enemy=state[other(seat)],name=seat==='player'?world.playerName:world.rivalName;
  const fail=(message:string)=>{note(state,message);return state;};
  if(action.type==='battle'){
    if(state.turnNumber===1)return fail('The first turn has no battle phase.');
    state.phase='battle';note(state,name+' enters the battle phase.');return state;
  }
  if(action.type==='end-turn'){
    for(const side of [own,enemy])for(const m of side.field)if(m)m.bonusAttack=0;
    state.turn=other(seat);state.phase='main';state.turnNumber++;
    const incoming=state[state.turn];incoming.summoned=false;
    for(const monster of incoming.field)if(monster)monster.attacked=false;
    note(state,(state.turn==='player'?world.playerName:world.rivalName)+' starts turn '+state.turnNumber+'.');
    draw(state,state.turn);return state;
  }
  if(action.type==='summon'||action.type==='spell'||action.type==='set-trap'){
    if(state.phase!=='main')return fail('Play or set cards during the main phase.');
    const instance=own.hand[action.hand],card=instance&&world.cards[instance.cardId];
    if(!card)return fail('Choose a card from your hand.');
    if(action.type==='summon'){
      if(card.type!=='monster')return fail('Only monster cards can be summoned.');
      if(own.summoned)return fail('You already used your normal summon this turn.');
      const required=tributeCount(card.level);
      const available=own.field.map((m,i)=>m?i:-1).filter(i=>i>=0).sort((a,b)=>atk(world,own.field[a]!)-atk(world,own.field[b]!));
      const tributes=action.tributes?.length?action.tributes:available.slice(0,required);
      if(tributes.length!==required||new Set(tributes).size!==tributes.length||tributes.some(i=>!own.field[i]))return fail('Choose '+required+' different friendly monsters as tributes.');
      const slot=own.field.findIndex((m,i)=>!m||tributes.includes(i));
      if(slot<0)return fail('All three monster zones are full.');
      for(const i of tributes)defeat(state,seat,i);
      own.hand.splice(action.hand,1);own.field[slot]=makeMonster(instance,state.turnNumber,action.position??'attack');own.summoned=true;
      note(state,name+' summons '+card.name+(required?' with '+required+' tribute(s).':'.'));return state;
    }
    if(action.type==='set-trap'){
      if(card.type!=='trap'||card.effect!=='shield')return fail('Choose a Shield trap to set.');
      const slot=own.traps.findIndex(t=>!t);if(slot<0)return fail('All three support zones are full.');
      own.hand.splice(action.hand,1);own.traps[slot]={instance,setTurn:state.turnNumber};note(state,name+' sets a face-down ward.');return state;
    }
    if(card.type!=='spell')return fail('Choose a spell card.');
    const occupied=enemy.field.map((m,i)=>m?i:-1).filter(i=>i>=0);
    const target=action.target??occupied.sort((a,b)=>atk(world,enemy.field[a]!)-atk(world,enemy.field[b]!))[0];
    if(card.effect==='destroy'&&!enemy.field[target])return fail('There is no enemy monster to destroy.');
    const friendly=action.target??own.field.findIndex(Boolean);
    if(card.effect==='boost'&&!own.field[friendly])return fail('Choose a friendly monster to boost.');
    own.hand.splice(action.hand,1);own.grave.push(instance);
    if(card.effect==='heal')own.life=Math.min(world.startingLife,own.life+card.power);
    else if(card.effect==='damage')enemy.life=Math.max(0,enemy.life-card.power);
    else if(card.effect==='destroy')defeat(state,other(seat),target);
    else if(card.effect==='boost')own.field[friendly]!.bonusAttack+=card.power;
    else if(card.effect==='draw'){for(let i=0;i<Math.min(2,Math.max(1,card.power))&&!state.winner;i++)draw(state,seat);}
    if(!state.winner)note(state,name+' plays '+card.name+'.');
    checkLife(state,world);return state;
  }
  const monster=own.field[action.slot];
  if(!monster)return fail('Choose a friendly monster.');
  if(action.type==='position'){
    if(state.phase!=='main'||monster.summonedTurn===state.turnNumber||monster.changedTurn===state.turnNumber||monster.attacked)return fail('Change position once in the main phase, after its summoning turn.');
    monster.position=monster.position==='attack'?'defense':'attack';monster.changedTurn=state.turnNumber;
    note(state,cardOf(world,monster).name+' changes to '+monster.position+' position.');return state;
  }
  if(state.phase!=='battle'||state.turnNumber===1)return fail('Enter the battle phase first; the opening turn cannot attack.');
  if(monster.position!=='attack'||monster.attacked)return fail('This monster cannot attack again this turn.');
  const target=action.target,defender=target===undefined?null:enemy.field[target];
  if(target!==undefined&&!defender)return fail('Choose an occupied enemy zone.');
  if(!defender&&enemy.field.some(Boolean))return fail('Clear the opposing monsters before attacking directly.');
  monster.attacked=true;
  const ward=enemy.traps.findIndex(t=>t&&t.setTurn<state.turnNumber);
  if(ward>=0){enemy.grave.push(enemy.traps[ward]!.instance);enemy.traps[ward]=null;note(state,'A hidden ward cancels '+cardOf(world,monster).name+'’s attack.');return state;}
  if(!defender){enemy.life=Math.max(0,enemy.life-atk(world,monster));note(state,cardOf(world,monster).name+' attacks directly for '+atk(world,monster)+'.');}
  else{
    const offense=atk(world,monster),defense=defender.position==='attack'?atk(world,defender):cardOf(world,defender).defense;
    const difference=offense-defense;
    if(difference>0){defeat(state,other(seat),target!);if(defender.position==='attack')enemy.life=Math.max(0,enemy.life-difference);}
    else if(difference<0){own.life=Math.max(0,own.life+difference);if(defender.position==='attack')defeat(state,seat,action.slot);}
    else if(defender.position==='attack'){defeat(state,seat,action.slot);defeat(state,other(seat),target!);}
    note(state,cardOf(world,monster).name+' battles '+cardOf(world,defender).name+'.');
  }
  checkLife(state,world);return state;
}
export function duelAction(world:DuelWorld,state:DuelState,action:DuelAction):DuelState {return apply(world,state,action,'player');}
export function playRivalTurn(world:DuelWorld,source:DuelState):DuelState {
  if(source.turn!=='rival'||source.winner||world.errors.length)return source;
  let state=source;
  // Bounded AI uses its own hand and public field only.
  const spell=state.rival.hand.findIndex(i=>{const c=world.cards[i.cardId];return c.type==='spell'&&(
    c.effect==='damage'||c.effect==='heal'&&state.rival.life<world.startingLife||
    c.effect==='destroy'&&state.player.field.some(Boolean)||c.effect==='boost'&&state.rival.field.some(Boolean)||
    c.effect==='draw'&&state.rival.deck.length>=2);});
  if(spell>=0)state=apply(world,state,{type:'spell',hand:spell},'rival');
  if(state.winner)return state;
  const occupied=state.rival.field.map((m,i)=>m?i:-1).filter(i=>i>=0).sort((a,b)=>atk(world,state.rival.field[a]!)-atk(world,state.rival.field[b]!));
  const candidates=state.rival.hand.map((i,index)=>({card:world.cards[i.cardId],index}))
    .filter(({card})=>card.type==='monster'&&tributeCount(card.level)<=occupied.length)
    .sort((a,b)=>b.card.attack-a.card.attack);
  if(candidates.length&&!state.rival.summoned){
    const {card,index}=candidates[0],required=tributeCount(card.level);
    if(required||occupied.length<3)state=apply(world,state,{type:'summon',hand:index,tributes:occupied.slice(0,required)},'rival');
  }
  const trap=state.rival.hand.findIndex(i=>world.cards[i.cardId].type==='trap');
  if(trap>=0)state=apply(world,state,{type:'set-trap',hand:trap},'rival');
  for(let i=0;i<3;i++){const m=state.rival.field[i];if(m?.position==='defense')state=apply(world,state,{type:'position',slot:i},'rival');}
  state=apply(world,state,{type:'battle'},'rival');
  for(let slot=0;slot<3&&!state.winner;slot++){
    const m=state.rival.field[slot];if(!m||m.position!=='attack'||m.attacked)continue;
    const targets=state.player.field.map((target,index)=>({target,index})).filter(({target})=>target);
    targets.sort((a,b)=>(a.target!.position==='defense'?cardOf(world,a.target!).defense:atk(world,a.target!))-
      (b.target!.position==='defense'?cardOf(world,b.target!).defense:atk(world,b.target!)));
    const target=targets[0],strength=target?(target.target!.position==='defense'?cardOf(world,target.target!).defense:atk(world,target.target!)):0;
    if(!target||atk(world,m)>=strength)state=apply(world,state,{type:'attack',slot,target:target?.index},'rival');
  }
  if(!state.winner)state=apply(world,state,{type:'end-turn'},'rival');
  return state;
}
