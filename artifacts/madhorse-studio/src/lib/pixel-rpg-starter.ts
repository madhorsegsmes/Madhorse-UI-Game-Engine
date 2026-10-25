import { createGameFeature } from './game-feature-model';
import { createTransformComponent, type SceneEntity, type ProjectAsset, type Vector3 } from './scene-model';
import { pixelRpgSpriteSvg, type PixelRpgSpriteKind } from './pixel-rpg-art';
import { RPG_TILE } from './pixel-rpg-runtime';

export const PIXEL_RPG_CONTROLS = 'Click the map to focus. WASD / arrow keys: walk. E / Enter: talk or heal. In battle: 1 attack, 2 capture, 3 run. Catch a creature in the northeast tall grass, then return to the guide. Stop Play/Test to edit sprites, map positions, dialogue and RPG stats. Play/Test restarts fresh; simulated progress does not overwrite authored scene data.';
export function createPixelRpgStarter(center:Vector3) {
  const kinds:PixelRpgSpriteKind[]=['meadow','path','water','tree','house','clinic','player','guide','grass','fence','sign','mosskit','cindlet','ball'];
  const generatedAssets=kinds.map(kind=>{
    const file=new File([pixelRpgSpriteSvg(kind)],`${kind}.svg`,{type:'image/svg+xml'});
    const asset:ProjectAsset={id:crypto.randomUUID(),name:`Mosslight · ${kind}.svg`,kind:'image',mimeType:file.type,size:file.size,addedAt:new Date().toISOString()};
    return {asset,file};
  });
  const ids=new Map(kinds.map((kind,i)=>[kind,generatedAssets[i].asset.id]));
  const entities:SceneEntity[]=[];
  const left=center.x-48,top=center.y-36;
  function add(name:string,kind:PixelRpgSpriteKind,col:number,row:number,role:string,w=1,h=1,repeat=false) {
    const feature=createGameFeature('creature-rpg');
    feature.settings.role=role; feature.settings.repeatTexture=repeat;
    const entity:SceneEntity={id:crypto.randomUUID(),name,parentId:null,active:true,components:[
      createTransformComponent({x:left+(col+w/2)*RPG_TILE,y:top+(row+h/2)*RPG_TILE,z:role==='world'?0:role==='grass'||kind==='path'?1:role==='player'?4:2}),
      {id:crypto.randomUUID(),type:'spriteRenderer',enabled:true,assetId:ids.get(kind)!,tint:'#ffffff',width:w*RPG_TILE,height:h*RPG_TILE},
      feature,
    ]};
    entities.push(entity);return {entity,feature};
  }
  add('Mosslight map · edit size here','meadow',0,0,'world',24,18,true);
  add('Town path · north south','path',9,2,'decoration',1,15,true);
  add('Town path · east west','path',7,11,'decoration',15,1,true);
  add('Bluebell pond','water',2,3,'solid',4,3,true);
  add('Red-roof cottage','house',5,7,'solid',3,3);
  add('Trail cottage','house',17,11,'solid',3,3);
  add('Healing house','clinic',12,9,'solid',3,3);
  for(let col=0;col<24;col++) for(const row of [0,17]) add(`Boundary tree ${col},${row}`,'tree',col,row,'solid');
  for(let row=1;row<17;row++) for(const col of [0,23]) add(`Boundary tree ${col},${row}`,'tree',col,row,'solid');
  for(const [col,row] of [[3,9],[3,10],[19,8],[20,8],[21,8],[4,14],[5,14],[6,14]]) add(`Shade tree ${col},${row}`,'tree',col,row,'solid');
  for(let col=15;col<=21;col++) for(let row=3;row<=6;row++) add(`Wild grass ${col},${row}`,'grass',col,row,'grass',1,1,true);
  const player=add('Player · town explorer','player',9,12,'player');
  const guide=add('Guide · first quest','guide',10,12,'quest-guide');
  guide.feature.settings.dialogue='Welcome! Walk northeast into the tall grass. Weaken a wild creature, capture it with an orb, then bring your new friend back to me.';
  const healer=add('Healing neighbor','guide',12,12,'healer');
  healer.feature.settings.dialogue='Your companion is fully healed! I also topped up your capture orbs. Come back whenever you need help.';
  const neighbor=add('Village neighbor','guide',6,12,'npc');
  neighbor.feature.settings.dialogue='Mosskits like the tall grass northeast of town. The blue-roof house is a good place to rest.';
  const companion=add('Starting companion · Cindlet','cindlet',2,20,'companion');
  companion.feature.settings.creatureName='Cindlet';
  const moss=add('Wild creature · Mosskit','mosskit',18,4,'creature');
  moss.feature.settings.creatureName='Mosskit';moss.feature.settings.maxHealth=18;moss.feature.settings.damage=3;
  const ember=add('Wild creature · Cindlet','cindlet',20,5,'creature');
  ember.feature.settings.creatureName='Cindlet';ember.feature.settings.maxHealth=20;ember.feature.settings.damage=4;
  return {entities,playerId:player.entity.id,title:'2D RPG · Mosslight Trail',generatedAssets};
}
