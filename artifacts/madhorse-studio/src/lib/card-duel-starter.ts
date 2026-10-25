import {createGameFeature} from './game-feature-model';
import {createTransformComponent,type SceneEntity,type ProjectAsset,type Vector3} from './scene-model';
import {createDuelCardArt} from './card-duel-art';

export const CARD_DUEL_CONTROLS='Select a hand card, then Summon, Play Spell or Set Ward. One normal summon per turn; level 5–6 needs one tribute and level 7–8 needs two. Select your monster and an enemy zone to attack in the Battle phase. The first turn cannot attack. End Turn lets Nova play. Reduce rival life to zero or exhaust their deck. Edit cards, artwork, copies, life and names in the Hierarchy. Stop/restart resets this test duel.';
const definitions=[
  {name:'Ember Wyvern',art:'dragon',attack:1600,defense:1000,level:4,copies:3,color:'#c87848',description:'A swift flame guardian of the dawn sky.'},
  {name:'Stone Sentinel',art:'golem',attack:1000,defense:1900,level:4,copies:2,color:'#b3a16c',description:'A patient guardian. Use defense position to hold the field.'},
  {name:'Tide Arcanist',art:'mage',attack:1400,defense:1300,level:4,copies:2,color:'#57a8bf',description:'A wanderer who carries the wisdom of ocean stars.'},
  {name:'Cloud Wolf',art:'wolf',attack:1300,defense:900,level:3,copies:2,color:'#98a5cf',description:'A nimble spirit that races between the clouds.'},
  {name:'Dawn Knight',art:'knight',attack:1700,defense:900,level:4,copies:2,color:'#d2b267',description:'A brave defender with a blade of sunrise.'},
  {name:'Solar Phoenix',art:'phoenix',attack:2200,defense:1800,level:6,copies:1,color:'#e78e52',description:'Tribute one friendly monster to summon this radiant guardian.'},
  {name:'Astral Drake',art:'dragon',attack:2700,defense:2300,level:7,copies:1,color:'#aa7cc8',description:'Tribute two friendly monsters to summon this star-born dragon.'},
  {name:'Mending Dawn',art:'heal',effect:'heal',power:700,copies:1,color:'#52b9a1',description:'Restore 700 life points, up to your starting total.'},
  {name:'Spark Lance',art:'spark',effect:'damage',power:500,copies:1,color:'#52b9a1',description:'Deal 500 damage directly to the rival’s life points.'},
  {name:'Shatter Sigil',art:'shatter',effect:'destroy',power:0,copies:1,color:'#52b9a1',description:'Destroy one opposing monster. Choose an enemy zone, or target the weakest automatically.'},
  {name:'Moon Ward',art:'ward',effect:'shield',power:0,copies:2,color:'#b879b3',description:'Set this trap face down. On a later turn, cancel the next incoming attack once.'},
  {name:'Valor Bloom',art:'boost',effect:'boost',power:600,copies:1,color:'#52b9a1',description:'Give a friendly monster 600 extra attack until the turn ends.'},
  {name:'Surveyor’s Insight',art:'draw',effect:'draw',power:2,copies:1,color:'#52b9a1',description:'Draw two cards. Drawing from an empty deck loses the duel.'},
];
export function createCardDuelStarter(center:Vector3){
  const generatedAssets:Array<{asset:ProjectAsset;file:File}>=[],entities:SceneEntity[]=[];
  function image(name:string,svg:string){
    const file=new File([svg],name,{type:'image/svg+xml'});
    const asset:ProjectAsset={id:crypto.randomUUID(),name,kind:'image',mimeType:file.type,size:file.size,addedAt:new Date().toISOString()};
    generatedAssets.push({asset,file});return asset.id;
  }
  const boardImage=image('Astral Nexus · duel table.svg','<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><defs><radialGradient id="g"><stop stop-color="#24496b"/><stop offset="1" stop-color="#101629"/></radialGradient></defs><path fill="url(#g)" d="M0 0H1200V800H0z"/><g fill="none" stroke="#57bdc5" opacity=".18"><circle cx="600" cy="400" r="280"/><circle cx="600" cy="400" r="245"/><path d="M100 400H1100M600 0V800M200 100L1000 700M1000 100L200 700"/></g><g fill="#bddde8" opacity=".4"><circle cx="80" cy="90" r="2"/><circle cx="1090" cy="300" r="2"/><circle cx="120" cy="650" r="2"/><circle cx="900" cy="70" r="2"/></g></svg>');
  const boardFeature=createGameFeature('card-duel');boardFeature.settings.role='board';
  const board:SceneEntity={id:crypto.randomUUID(),name:'Duel Table · Rules & Background',parentId:null,active:true,components:[
    createTransformComponent(center),{id:crypto.randomUUID(),type:'spriteRenderer',enabled:true,assetId:boardImage,tint:'#ffffff',width:120,height:80},boardFeature]};
  entities.push(board);
  for(const [index,definition] of definitions.entries()){
    const f=createGameFeature('card-duel');
    const monster='attack' in definition;
    Object.assign(f.settings,{role:'card',cardType:monster?'monster':definition.effect==='shield'?'trap':'spell',
      attack:monster?definition.attack:0,defense:monster?definition.defense:0,level:monster?definition.level:1,
      effect:'effect' in definition?definition.effect:'none',power:'power' in definition?definition.power:0,
      copies:definition.copies,description:definition.description,cardColor:definition.color});
    const art=image(definition.name+'.svg',createDuelCardArt(definition.art,definition.color));
    entities.push({id:crypto.randomUUID(),name:definition.name,parentId:null,active:true,components:[
      createTransformComponent({x:center.x-42+(index%7)*14,y:center.y+52+Math.floor(index/7)*21,z:2}),
      {id:crypto.randomUUID(),type:'spriteRenderer',enabled:true,assetId:art,tint:'#ffffff',width:12,height:17},f]});
  }
  return {title:'Card Duel · Astral Nexus',entities,playerId:board.id,generatedAssets};
}
