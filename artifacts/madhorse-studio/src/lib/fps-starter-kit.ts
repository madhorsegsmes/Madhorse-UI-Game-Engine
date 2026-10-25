import { createSceneEntity, createPhysicsComponent, getTransform, type SceneEntity, type Vector3, type ProjectAsset } from './scene-model';
import { createPluginComponent } from './scene-plugin-catalog';
import { createGameFeature } from './game-feature-model';
import { createPlayerAction } from './player-action-model';
import { createEgoCharacterScene, createEgoClothingTextureAsset } from './character-builder-starter';

export const FPS_CONTROLS = 'Click the viewport to capture the mouse. Mouse: look · WASD: move/strafe · Left click or J: shoot · R: reload · Shift: sprint · C: crouch · Space: jump · Esc: release mouse / stop test. Clear all six range targets. Play Test changes reset when stopped.';
export const THIRD_PERSON_SHOOTER_CONTROLS = 'Click the viewport to capture the mouse. Mouse: look · WASD: move/strafe · Left click or J: shoot · R: reload · Shift: sprint · C: crouch · Space: jump · Esc: release mouse / stop test.';

function addMultiplayerComponent(entity: SceneEntity, kind: 'multiplayer-player' | 'multiplayer-object') {
  const mode = kind === 'multiplayer-player' ? 'player' : 'object';
  if (entity.components.some(component => component.type === 'multiplayerPlugin' && component.mode === mode)) return;
  const plugin = createPluginComponent(kind, 0).component;
  if (plugin.type === 'multiplayerPlugin') entity.components.push(plugin);
}

function createDetailedOperative(offset: { x: number; z: number }, name: string, clothingTextureAssetId: string) {
  const build = createEgoCharacterScene('human', 1.8, offset, name, clothingTextureAssetId);
  const root = build.entities.find(entity => entity.id === build.setupId)!;
  const body = build.entities.find(entity => entity.id === build.characterId)!;
  root.name = name;
  root.isGroup = true;
  root.generatedBy = 'character-builder';
  const model = body.components.find(component => component.type === 'modelRenderer');
  if (model) root.components.push({ ...model, id: crypto.randomUUID() });
  const parts = build.entities.filter(entity => entity.parentId === body.id);
  for (const part of parts) part.parentId = root.id;
  return { root, parts };
}

export function createFpsStarterKit(center: Vector3, perspective: 'first-person' | 'third-person' = 'first-person') {
  const entities: SceneEntity[] = [];
  const generatedAssets: Array<{ asset: ProjectAsset; file: File }> = [];
  const thirdPerson = perspective === 'third-person';
  function texture(name: string, svg: string) {
    const file = new File([svg], name, { type: 'image/svg+xml' });
    const asset: ProjectAsset = { id: crypto.randomUUID(), name, kind: 'image', mimeType: file.type, size: file.size, addedAt: new Date().toISOString() };
    generatedAssets.push({ asset, file });
    return asset.id;
  }
  const steel = texture('fps-brushed-steel.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#626e78"/><path d="M0 0H256V256H0ZM128 0V256M0 128H256" fill="none" stroke="#28343f" stroke-width="5"/><path d="M8 32H248M8 64H248M8 96H248M8 160H248M8 192H248M8 224H248" stroke="#8f9ba6" opacity=".2"/><g fill="#b1b8bb"><circle cx="12" cy="12" r="3"/><circle cx="244" cy="12" r="3"/><circle cx="12" cy="244" r="3"/><circle cx="244" cy="244" r="3"/></g></svg>');
  const hazard = texture('fps-hazard-stripes.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><pattern id="p" width="64" height="64" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#dbaa42"/><rect width="32" height="64" fill="#202630"/></pattern></defs><rect width="256" height="256" fill="url(#p)"/></svg>');
  const pos = (x: number, y: number, z: number) => ({ x: center.x + x * 10, y: center.y + y * 10, z: center.z + z * 10 });
  function box(name: string, x: number, y: number, z: number, w: number, d: number, h: number, color: string, solid = true, textureAssetId: string | null = null) {
    const entity = createSceneEntity(name, pos(x, y, z), null, false);
    entity.components = [getTransform(entity)];
    getTransform(entity).scale = { x: w, y: d, z: h };
    entity.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'rounded-cube', color, roughness: .48, metalness: .35, textureAssetId });
    if (solid) {
      const physics = createPhysicsComponent('static');
      physics.size = { x: w * 10, y: d * 10, z: h * 10 };
      entity.components.push(physics);
    }
    entities.push(entity);
    return entity;
  }
  box('Training Deck · editable floor', 0, 0, -.25, 28, 36, .5, '#697984', true, steel);
  for (const side of [-1, 1]) {
    box(`${side < 0 ? 'West' : 'East'} perimeter wall`, side * 14, 0, 2, .5, 36, 4, '#273747', true, steel);
    for (let i = 0; i < 6; i++) {
      box(`Wall buttress · ${side} / ${i + 1}`, side * 13.6, -15 + i * 6, 2.1, .65, .75, 4.2, '#51616e');
      box(`Cyan wall strip · ${side} / ${i + 1}`, side * 13.2, -15 + i * 6, 2.3, .08, .42, 3, '#59d3df', false);
    }
  }
  box('North target backstop', 0, 18, 2.5, 28, .65, 5, '#293c50', true, steel);
  box('South entry wall', 0, -18, 2, 28, .5, 4, '#273747', true, steel);
  for (let i = 0; i < 8; i++) box(`Ceiling gantry · ${i + 1}`, 0, -16 + i * 4.5, 5, 28, .25, .25, '#3a4b5b', false);
  for (const side of [-1, 1]) {
    box(`Lane boundary · ${side}`, side * 2.7, 1, .018, .09, 28, .025, '#e2c170', false);
    box(`Service platform · ${side}`, side * 10.5, 9, .3, 4, 12, .6, '#43505a', true, steel);
  }
  for (const [i, [x, y, w, d, h]] of [
    [-6, -6, 3, 2, 1.3], [6, -3, 3, 2, 1.3], [-5, 3, 2.4, 2, 2],
    [5.5, 6, 3, 2, 1.3], [-8, 12, 2.4, 2.4, 2.4], [8, 14, 2, 2, 2],
  ].entries()) {
    box(`Cover crate · ${i + 1}`, x, y, h / 2, w, d, h, '#64756d', true, steel);
    box(`Crate hazard trim · ${i + 1}`, x, y - d / 2 - .015, h * .65, w * .9, .035, .2, '#ffffff', false, hazard);
  }
  const clothingTexture = thirdPerson ? createEgoClothingTextureAsset() : null;
  if (clothingTexture) generatedAssets.push(clothingTexture);
  const detailedOperative = clothingTexture
    ? createDetailedOperative({ x: 0, z: -12 }, 'Ironlight Operative · Player', clothingTexture.asset.id)
    : null;
  const player = detailedOperative?.root ?? createSceneEntity('FPS Player', pos(0, -12, 0), null, false);
  if (!detailedOperative) player.components = [getTransform(player)];
  const controller = createPluginComponent(
    thirdPerson ? 'character-controller-third-person' : 'character-controller-player',
    0,
  ).component;
  if (controller.type === 'characterController') {
    controller.perspective = perspective;
    controller.moveSpeed = thirdPerson ? 6 : 5;
  }
  const body = createPhysicsComponent('dynamic');
  body.size = { x: 6, y: 6, z: 18 };
  const shoot = createPlayerAction('shoot');
  shoot.settings.damage = 25; shoot.settings.range = 55;
  const reload = createPlayerAction('reload');
  reload.settings.magazineSize = 12; reload.settings.reserveAmmo = 96;
  const health = createGameFeature('health');
  health.settings.contactDamage = 0;
  player.components.push(controller, body, health, createGameFeature('status-bar'), shoot, reload,
    createPlayerAction('run'), createPlayerAction('crouch'));
  addMultiplayerComponent(player, 'multiplayer-player');
  if (!detailedOperative) {
    player.components.push({ id: crypto.randomUUID(), type: 'primitive', enabled: true, shape: 'capsule', color: '#628392', textureAssetId: null });
    getTransform(player).scale = { x: .6, y: .6, z: 1.8 };
  }
  entities.push(player, ...(detailedOperative?.parts ?? []));
  if (thirdPerson && clothingTexture) {
    for (const [name, offset] of [
      ['Moving Target Operative · Alpha', { x: -8, z: 5 }],
      ['Moving Target Operative · Bravo', { x: 8, z: 13 }],
    ] as const) {
      const target = createDetailedOperative(offset, name, clothingTexture.asset.id);
      const patrol = createPluginComponent('character-controller-patrol', 0).component;
      if (patrol.type === 'characterController') {
        patrol.role = 'npc';
        patrol.behavior = 'patrol';
        patrol.perspective = 'third-person';
        patrol.moveSpeed = 0.8;
        patrol.patrolRadius = 0.65;
      }
      const health = createGameFeature('health');
      health.settings.contactDamage = 0;
      target.root.components.push(
        patrol,
        createPhysicsComponent('dynamic'),
        health,
        createGameFeature('status-bar'),
      );
      addMultiplayerComponent(target.root, 'multiplayer-object');
      entities.push(target.root, ...target.parts);
    }
  }
  // Independent pieces: users can remodel or replace the weapon in Hierarchy.
  const weapon = createSceneEntity('FPS Carbine · editable weapon', { x: 4.6, y: 7.5, z: 6.5 }, player.id, false);
  weapon.components = [getTransform(weapon)];
  weapon.isGroup = true;
  entities.push(weapon);
  for (const [name, x, y, z, w, d, h, color] of [
    ['Receiver', 0, 0, 0, .22, .52, .13, '#33434d'],
    ['Barrel', 0, .37, .025, .07, .36, .07, '#8c9ba2'],
    ['Grip', 0, -.08, -.12, .09, .13, .22, '#242a30'],
    ['Optic', 0, .05, .11, .1, .15, .08, '#62d6dc'],
  ] as const) {
    const part = box(`Carbine · ${name}`, 0, 0, 0, w / .6, d / .6, h / 1.8, color, false);
    part.parentId = weapon.id;
    getTransform(part).position = { x: x * 10 / .6, y: y * 10 / .6, z: z * 10 / 1.8 };
  }
  for (const [i, [x, y]] of [[0, -2], [-4, 6], [3, 10], [-9, 15], [0, 16], [9, 4]].entries()) {
    const target = box(`Range Target ${i + 1}`, x, y, .9, .7, .55, 1.8, '#b85d47');
    addMultiplayerComponent(target, 'multiplayer-object');
    const targetHealth = createGameFeature('health');
    targetHealth.settings.contactDamage = 0;
    target.components.push(targetHealth);
    const face = box(`Target ${i + 1} · illuminated face`, 0, 0, 0, .46, .045, .55, '#ffd481', false);
    face.parentId = target.id;
    getTransform(face).position = { x: 0, y: -5.5, z: 2 };
    getTransform(face).scale = { x: .65, y: .08, z: .32 };
  }
  const sky = createSceneEntity('FPS Sky Background', { ...center }, null, false);
  sky.components = [getTransform(sky)];
  sky.components.push({ id: crypto.randomUUID(), type: 'skybox', enabled: true, color: '#192c42' });
  entities.push(sky);
  for (const [name, kind, color, intensity, x, y, z] of [
    ['Facility fill', 'ambient', '#b2cadd', .65, 0, 0, 0],
    ['Sunlight', 'directional', '#ffe2b0', 1.5, -7, -9, 12],
    ['North blue practical', 'point', '#51c9ed', 2.2, 0, 12, 4],
  ] as const) {
    const light = createSceneEntity(name, pos(x, y, z), null, false);
    light.components = [getTransform(light)];
    light.components.push({ id: crypto.randomUUID(), type: 'light', enabled: true, kind, color, intensity });
    entities.push(light);
  }
  return {
    entities,
    playerId: player.id,
    title: thirdPerson ? 'Third-Person Shooter · Ironlight Ops' : 'FPS · Ironlight Training Facility',
    generatedAssets,
  };
}
