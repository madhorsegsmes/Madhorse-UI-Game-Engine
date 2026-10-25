import { createGameFeature } from './game-feature-model';
import { createPlayerAction } from './player-action-model';
import { createPluginComponent } from './scene-plugin-catalog';
import { applyEgoFighterAppearance, createEgoCharacterScene, createEgoClothingTextureAsset } from './character-builder-starter';
import { defaultFightingAppearancePair, type FightingAppearancePair } from './fighter-appearance';
import {
  createPhysicsComponent, createStoryboardComponent, createTransformComponent, getPrimitive, getTransform,
  type EffectComponent, type PrimitiveShape, type ProjectAsset, type SceneEntity, type StoryboardBeat,
  type TerrainBrushEdit, type Vector3, type VisualLogicNode,
} from './scene-model';

export type GameStarterKitId = 'shooter' | 'rpg' | 'puzzle' | 'fighting' | 'rts';
export const gameStarterKits: { id: GameStarterKitId; title: string; description: string }[] = [
  { id: 'shooter', title: 'FPS Training Arena', description: 'A first-person camera with shooting, ammo, targets, health, and a small test arena.' },
  { id: 'rpg', title: 'RPG Quest', description: 'A player with inventory and spells, a character to meet, and a quest path to explore.' },
  { id: 'puzzle', title: 'Key-and-Gate Puzzle', description: 'Find a key, enter a trigger, and use safe visual logic to open the gate.' },
  { id: 'fighting', title: '2D Fighting Arena', description: 'A fixed side-view 3D arena with detailed human fighters, optional FBX replacements, editable combat moves, health bars, and an editable stage.' },
  { id: 'rts', title: 'RTS · Sunstone Vale', description: 'An editable isometric medieval settlement with a central keep, cottages, farms, roads, woods, resource sites, squads, and an RTS command HUD.' },
];

function createObject(name: string, shape: PrimitiveShape, color: string, position: Vector3, scale: Vector3): SceneEntity {
  const transform = createTransformComponent(position);
  transform.scale = scale;
  return {
    id: crypto.randomUUID(), name, parentId: null, active: true,
    components: [
      transform,
      { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape, color, textureAssetId: null },
      createPhysicsComponent('static'),
    ],
  };
}

function createActor(name: string, position: Vector3, color: string, controllerKind: 'character-controller-player' | 'character-controller-patrol' | 'character-controller-npc') {
  const actor = createObject(name, 'capsule', color, position, { x: 1, y: 1, z: 1.8 });
  actor.components = [
    ...actor.components,
    createPluginComponent(controllerKind, 0).component,
  ];
  return actor;
}

function createVisualPart(
  name: string,
  parentId: string | null,
  shape: PrimitiveShape,
  color: string,
  position: Vector3,
  scale: Vector3,
  rotation: Vector3 = { x: 0, y: 0, z: 0 },
  textureAssetId: string | null = null,
): SceneEntity {
  const transform = createTransformComponent(position);
  transform.scale = scale;
  transform.rotation = rotation;
  return {
    id: crypto.randomUUID(), name, parentId, active: true,
    components: [
      transform,
      { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape, color, textureAssetId, roughness: 0.72, metalness: 0.08 },
    ],
  };
}

export function poseFighterGuard(build: ReturnType<typeof createEgoCharacterScene>, tint: string) {
  for (const side of [-1, 1] as const) {
    const label = side < 0 ? 'Left' : 'Right';
    const pose: Record<string, { x: number; height: number; depth: number; rotation?: number }> = {
      [`Skin · ${label} upper arm`]: { x: side * 0.34, height: 1.39, depth: 0.02, rotation: side * 22 },
      [`Skin · ${label} elbow`]: { x: side * 0.25, height: 1.31, depth: 0.075 },
      [`Skin · ${label} forearm`]: { x: side * 0.19, height: 1.37, depth: 0.105, rotation: side * 42 },
      [`Skin · ${label} wrist`]: { x: side * 0.13, height: 1.42, depth: 0.15 },
      [`Skin · ${label} palm`]: { x: side * 0.11, height: 1.44, depth: 0.18 },
    };
    for (const [name, point] of Object.entries(pose)) {
      const part = build.entities.find(entity => entity.name === name);
      if (!part) continue;
      const transform = getTransform(part);
      transform.position = { x: 50 + point.x * 10, y: 50 + point.depth * 10, z: 50 + point.height * 10 };
      if (point.rotation !== undefined) transform.rotation.y = point.rotation;
    }
    for (const part of build.entities.filter(entity => entity.name.startsWith(`Skin · ${label} hand · finger `))) {
      const transform = getTransform(part);
      transform.position.x = 50 + side * 0.115 * 10;
      transform.position.y = 50 + 0.19 * 10;
      transform.position.z = 50 + 1.41 * 10;
    }
  }
  for (const entity of build.entities) {
    if (entity.name.startsWith('Clothing ·')) {
      const primitive = getPrimitive(entity);
      if (primitive?.textureAssetId) primitive.color = tint;
    }
  }
}

function flattenCharacterFighter(build: ReturnType<typeof createEgoCharacterScene>, name: string) {
  const root = build.entities.find(entity => entity.id === build.setupId)!;
  const bodyRoot = build.entities.find(entity => entity.id === build.characterId)!;
  const modelRenderer = bodyRoot.components.find(component => component.type === 'modelRenderer');
  root.name = name;
  root.isGroup = true;
  root.generatedBy = 'character-builder';
  if (modelRenderer) root.components.push({ ...modelRenderer, id: crypto.randomUUID() });
  const parts = build.entities.filter(entity => entity.parentId === bodyRoot.id);
  for (const part of parts) part.parentId = root.id;
  return { root, entities: [root, ...parts] };
}

function createFightingStarterKit(center: Vector3, appearances: FightingAppearancePair = defaultFightingAppearancePair): {
  entities: SceneEntity[];
  playerId: string;
  title: string;
  generatedAssets: Array<{ asset: ProjectAsset; file: File }>;
} {
  const floor = createObject('Fighting Stage Floor', 'rounded-cube', '#292d38',
    { x: center.x, y: center.y, z: center.z - 0.24 }, { x: 16, y: 7, z: 0.48 });
  const backdrop = createVisualPart('Arena Backdrop', null, 'rounded-cube', '#171b26',
    { x: center.x, y: center.y + 33.5, z: center.z + 34 }, { x: 16, y: 0.28, z: 6.8 });
  const leftLight = createVisualPart('Crimson Arena Light', null, 'sphere', '#d94a43',
    { x: center.x - 62, y: center.y + 19, z: center.z + 42.5 }, { x: 0.58, y: 0.58, z: 0.58 });
  const rightLight = createVisualPart('Blue Arena Light', null, 'sphere', '#527de1',
    { x: center.x + 62, y: center.y + 19, z: center.z + 42.5 }, { x: 0.58, y: 0.58, z: 0.58 });
  const stageStripe = createVisualPart('Stage Center Stripe', null, 'rounded-cube', '#9a4546',
    { x: center.x, y: center.y - 23, z: center.z + 0.2 }, { x: 15.2, y: 0.12, z: 0.08 });
  const clothingTexture = createEgoClothingTextureAsset();
  const playerBuild = createEgoCharacterScene(appearances.player.race, 1.8, { x: -4, z: 0 }, 'Player Fighter', clothingTexture.asset.id);
  const rivalBuild = createEgoCharacterScene(appearances.rival.race, 1.8, { x: 4, z: 0 }, 'Training Rival', clothingTexture.asset.id);
  poseFighterGuard(playerBuild, '#a94750');
  poseFighterGuard(rivalBuild, '#5578ba');
  applyEgoFighterAppearance(playerBuild, appearances.player, '#a94750');
  applyEgoFighterAppearance(rivalBuild, appearances.rival, '#5578ba');
  const playerFighter = flattenCharacterFighter(playerBuild, 'Player Fighter');
  const rivalFighter = flattenCharacterFighter(rivalBuild, 'Training Rival');
  const player = playerFighter.root;
  const rival = rivalFighter.root;
  getTransform(player).rotation.z = 90;
  getTransform(rival).rotation.z = -90;
  player.components.push(
    createPhysicsComponent('dynamic'),
    createPluginComponent('character-controller-player', 0).component,
  );
  rival.components.push(
    createPhysicsComponent('dynamic'),
    createPluginComponent('character-controller-npc', 0).component,
  );

  const playerHealth = createGameFeature('health');
  const rivalHealth = createGameFeature('health');
  if (rivalHealth.type === 'gameFeature') rivalHealth.settings.contactDamage = 0;
  const playerActions = ['light-attack', 'heavy-attack', 'special-attack'].map(name => {
    const action = createPlayerAction(name as 'light-attack' | 'heavy-attack' | 'special-attack');
    action.targetId = rival.id;
    return action;
  });
  player.components.push(
    playerHealth,
    createGameFeature('status-bar'),
    ...playerActions,
    createPlayerAction('block'),
    createPlayerAction('run'),
    createPlayerAction('crouch'),
  );
  const rivalLight = createPlayerAction('light-attack');
  const rivalHeavy = createPlayerAction('heavy-attack');
  rivalLight.targetId = player.id;
  rivalHeavy.targetId = player.id;
  rival.components.push(rivalHealth, createGameFeature('status-bar'), rivalLight, rivalHeavy);

  const entities = [
    floor, backdrop, leftLight, rightLight, stageStripe,
    ...playerFighter.entities,
    ...rivalFighter.entities,
  ];
  return {
    entities,
    playerId: player.id,
    title: '2D Fighting Arena',
    generatedAssets: [clothingTexture],
  };
}

function createStoryboard(title: string, beatValues: Omit<StoryboardBeat, 'id' | 'complete'>[]) {
  const entity: SceneEntity = {
    id: crypto.randomUUID(), name: `${title} Storyboard`, parentId: null, active: true, isGroup: true,
    components: [createTransformComponent(), createStoryboardComponent(title)],
  };
  const board = entity.components.find(component => component.type === 'storyboard');
  if (board?.type === 'storyboard') {
    board.beats = beatValues.map(beat => ({ ...beat, id: crypto.randomUUID(), complete: false }));
  }
  return entity;
}

function createRtsTextureAsset(filename: string, svg: string) {
  const file = new File([svg], filename, { type: 'image/svg+xml' });
  const asset: ProjectAsset = {
    id: crypto.randomUUID(),
    name: filename,
    kind: 'image',
    mimeType: file.type,
    size: file.size,
    addedAt: new Date().toISOString(),
  };
  return { asset, file };
}

function localPartPosition(x: number, y: number, z: number): Vector3 {
  return { x: 50 + x * 10, y: 50 + y * 10, z: 50 + z * 10 };
}

function createRtsGroup(name: string, position: Vector3): SceneEntity {
  return {
    id: crypto.randomUUID(),
    name,
    parentId: null,
    active: true,
    isGroup: true,
    components: [createTransformComponent(position)],
  };
}

function createRtsTree(center: Vector3, x: number, y: number, index: number): SceneEntity[] {
  const root = createRtsGroup(`Environment · ${index % 2 ? 'Pine' : 'Redwood'} ${index + 1}`, {
    x: center.x + x * 10, y: center.y + y * 10, z: center.z,
  });
  const leaf = index % 3 === 0 ? '#547d4c' : index % 3 === 1 ? '#668b51' : '#3e704a';
  return [
    root,
    createVisualPart('Bark trunk · ridged', root.id, 'cylinder', '#674834', localPartPosition(0, 0, 0.92), { x: 0.38, y: 0.38, z: 1.84 }),
    createVisualPart('Root flare · west', root.id, 'cone', '#60402e', localPartPosition(-0.15, 0, 0.16), { x: 0.68, y: 0.62, z: 0.5 }),
    createVisualPart('Root flare · east', root.id, 'cone', '#745038', localPartPosition(0.16, 0.08, 0.18), { x: 0.6, y: 0.58, z: 0.46 }),
    createVisualPart('Branch · sunward', root.id, 'cylinder', '#755037', localPartPosition(-0.35, 0.04, 1.36), { x: 0.14, y: 0.15, z: 1.02 }, { x: 12, y: 0, z: -25 }),
    createVisualPart('Branch · valley', root.id, 'cylinder', '#755037', localPartPosition(0.32, -0.04, 1.42), { x: 0.12, y: 0.14, z: 0.88 }, { x: -8, y: 0, z: 22 }),
    createVisualPart('Canopy · lower', root.id, index % 2 ? 'cone' : 'sphere', leaf, localPartPosition(0, 0, 1.68), { x: 1.95, y: 1.9, z: 1.84 }),
    createVisualPart('Canopy · middle', root.id, 'sphere', index % 2 ? '#729257' : '#466f45', localPartPosition(0.1, 0, 2.18), { x: 1.48, y: 1.56, z: 1.52 }),
    createVisualPart('Canopy · crown', root.id, 'cone', '#8ba861', localPartPosition(0.02, 0, 2.72), { x: 1.08, y: 1.12, z: 1.46 }),
    createVisualPart('Canopy · sunlit edge', root.id, 'sphere', '#a3b56b', localPartPosition(-0.42, -0.2, 1.95), { x: 0.62, y: 0.64, z: 0.48 }),
    createVisualPart('Canopy · shadow edge', root.id, 'sphere', '#3d6542', localPartPosition(0.46, 0.24, 1.68), { x: 0.74, y: 0.76, z: 0.58 }),
  ];
}

function createRtsBuilding(
  name: string,
  center: Vector3,
  offset: { x: number; y: number },
  color: string,
  stoneTextureId: string,
  size: { x: number; y: number; z: number } = { x: 4.1, y: 3.5, z: 2.8 },
  roofTextureId?: string,
): SceneEntity[] {
  const root = createObject(
    name,
    'rounded-cube',
    color,
    { x: center.x + offset.x * 10, y: center.y + offset.y * 10, z: center.z + size.z * 5 },
    size,
  );
  const body = getPrimitive(root);
  if (body) {
    body.textureAssetId = stoneTextureId;
    body.roughness = 0.88;
  }
  root.components.push(createGameFeature('health'), createGameFeature('status-bar'));
  return [
    root,
    createVisualPart('Stone footing', root.id, 'rounded-cube', '#77736b', localPartPosition(0, 0, -size.z * 0.39), {
      x: size.x * 1.1, y: size.y * 1.08, z: 0.42,
    }, { x: 0, y: 0, z: 0 }, stoneTextureId),
    createVisualPart('Terracotta roof · tiled', root.id, 'cone', color, localPartPosition(0, 0, size.z * 0.56), {
      x: size.x * 1.08, y: size.y * 1.1, z: 1.05,
    }, { x: 0, y: 0, z: 0 }, roofTextureId ?? null),
    ...([-1, 1] as const).flatMap((sideX) => ([-1, 1] as const).map(sideY =>
      createVisualPart(`Corner bastion · ${sideX > 0 ? 'east' : 'west'} ${sideY > 0 ? 'north' : 'south'}`,
        root.id, 'cylinder', '#8d8a7e',
        localPartPosition(sideX * size.x * 0.4, sideY * size.y * 0.4, size.z * 0.26),
        { x: 0.48, y: 0.48, z: Math.min(2.1, size.z * 0.76) },
        { x: 0, y: 0, z: 0 }, stoneTextureId),
    )),
    ...Array.from({ length: 7 }, (_, index) => {
      const x = ((index - 3) / 3) * size.x * 0.42;
      return createVisualPart(`Crenellation · north ${index + 1}`, root.id, 'rounded-cube', '#c5bba3',
        localPartPosition(x, size.y * 0.43, size.z * 0.62), { x: 0.36, y: 0.32, z: 0.34 });
    }),
    ...Array.from({ length: 7 }, (_, index) => {
      const x = ((index - 3) / 3) * size.x * 0.42;
      return createVisualPart(`Crenellation · south ${index + 1}`, root.id, 'rounded-cube', '#c5bba3',
        localPartPosition(x, -size.y * 0.43, size.z * 0.62), { x: 0.36, y: 0.32, z: 0.34 });
    }),
    createVisualPart('Gatehouse door', root.id, 'rounded-cube', '#3d2925', localPartPosition(0, -size.y * 0.48, 0.05), {
      x: 0.76, y: 0.18, z: 1.34,
    }),
    createVisualPart('Gatehouse arch', root.id, 'rounded-cube', '#c4a06a', localPartPosition(0, -size.y * 0.51, 0.8), {
      x: 1.18, y: 0.14, z: 0.16,
    }),
    createVisualPart('Alliance banner', root.id, 'rounded-cube', color, localPartPosition(size.x * 0.34, 0, size.z * 0.62), {
      x: 0.14, y: 0.08, z: 0.92,
    }),
    createVisualPart('Banner pole', root.id, 'cylinder', '#d7c397', localPartPosition(size.x * 0.34, 0, size.z * 0.85), {
      x: 0.06, y: 0.06, z: 1.16,
    }),
    createVisualPart('North window · glass', root.id, 'rounded-cube', '#9fe4e6', localPartPosition(-size.x * 0.26, -size.y * 0.51, 0.78), {
      x: 0.42, y: 0.09, z: 0.48,
    }),
    createVisualPart('South window · glass', root.id, 'rounded-cube', '#9fe4e6', localPartPosition(size.x * 0.26, -size.y * 0.51, 0.78), {
      x: 0.42, y: 0.09, z: 0.48,
    }),
    createVisualPart('North window · bronze frame', root.id, 'rounded-cube', '#b58e52', localPartPosition(-size.x * 0.26, -size.y * 0.53, 0.78), {
      x: 0.5, y: 0.08, z: 0.56,
    }),
    createVisualPart('South window · bronze frame', root.id, 'rounded-cube', '#b58e52', localPartPosition(size.x * 0.26, -size.y * 0.53, 0.78), {
      x: 0.5, y: 0.08, z: 0.56,
    }),
  ];
}

function createRtsPickup(
  name: string,
  item: 'wood' | 'planks' | 'coins',
  amount: number,
  center: Vector3,
  offset: { x: number; y: number },
  color: string,
): SceneEntity {
  const node = createObject(name, 'octahedron', color, {
    x: center.x + offset.x * 10,
    y: center.y + offset.y * 10,
    z: center.z + 0.45 * 10,
  }, { x: 0.72, y: 0.72, z: 0.72 });
  const pickup = createGameFeature('pickup');
  if (pickup.type === 'gameFeature') {
    pickup.settings.item = item;
    pickup.settings.amount = amount;
  }
  node.components.push(pickup);
  return node;
}

function createRtsUnit(
  name: string,
  offset: { x: number; y: number },
  tint: string,
  controllerKind: 'character-controller-player' | 'character-controller-npc' | 'character-controller-patrol',
  clothingTextureId: string,
): SceneEntity[] {
  const build = createEgoCharacterScene('human', 1.8, { x: offset.x, z: offset.y }, name, clothingTextureId);
  poseFighterGuard(build, tint);
  const unit = flattenCharacterFighter(build, name);
  getTransform(unit.root).rotation.z = offset.x < 0 ? 90 : -90;
  const controller = createPluginComponent(controllerKind, 0).component;
  if (controller.type === 'characterController' && controllerKind === 'character-controller-npc') {
    controller.followDistance = 6;
  }
  unit.root.components.push(
    createPhysicsComponent('dynamic'),
    controller,
    createGameFeature('health'),
    createGameFeature('status-bar'),
  );
  return unit.entities;
}

function createRtsLight(
  name: string,
  kind: 'directional' | 'ambient' | 'point',
  color: string,
  intensity: number,
  rotation: Vector3,
  position: Vector3 = { x: 50, y: 50, z: 0 },
) {
  const light = createPluginComponent(`light-${kind}`, 0).component;
  if (light.type === 'light') {
    light.color = color;
    light.intensity = intensity;
  }
  const entity: SceneEntity = {
    id: crypto.randomUUID(),
    name,
    parentId: null,
    active: true,
    components: [createTransformComponent(position), light],
  };
  getTransform(entity).rotation = rotation;
  return entity;
}

function createRtsEffectEntity(
  name: string,
  position: Vector3,
  color: string,
  style: NonNullable<EffectComponent['style']>,
  intensity: number,
  parentId: string | null = null,
): SceneEntity {
  const entity: SceneEntity = {
    id: crypto.randomUUID(),
    name,
    parentId,
    active: true,
    components: [
      createTransformComponent(position),
      { id: crypto.randomUUID(), type: 'effect', enabled: true, color, intensity, style },
    ],
  };
  return entity;
}

function createRtsHouse(
  center: Vector3,
  offset: { x: number; y: number },
  name: string,
  wallColor: string,
  roofColor: string,
  wallTextureId: string,
  roofTextureId: string,
): SceneEntity[] {
  const root = createRtsGroup(name, {
    x: center.x + offset.x * 10,
    y: center.y + offset.y * 10,
    z: center.z,
  });
  root.components.push(createGameFeature('health'), createGameFeature('status-bar'));
  return [
    root,
    createVisualPart('Stone foundation', root.id, 'rounded-cube', '#776c58',
      localPartPosition(0, 0, 0.18), { x: 3.45, y: 2.95, z: 0.36 }, { x: 0, y: 0, z: 0 }, wallTextureId),
    createVisualPart('Limewashed cottage walls', root.id, 'rounded-cube', wallColor,
      localPartPosition(0, 0, 1.08), { x: 2.85, y: 2.45, z: 1.72 }, { x: 0, y: 0, z: 0 }, wallTextureId),
    createVisualPart('Terracotta hipped roof', root.id, 'pyramid', roofColor,
      localPartPosition(0, 0, 2.2), { x: 3.25, y: 2.9, z: 1.38 }, { x: 0, y: 0, z: 0 }, roofTextureId),
    createVisualPart('Timber front door', root.id, 'rounded-cube', '#56392d',
      localPartPosition(0, -1.24, 0.61), { x: 0.56, y: 0.12, z: 1.12 }),
    createVisualPart('Door lintel', root.id, 'rounded-cube', '#9a7750',
      localPartPosition(0, -1.32, 1.22), { x: 0.78, y: 0.1, z: 0.14 }),
    ...([-0.82, 0.82] as const).flatMap((x, index) => [
      createVisualPart(`Leadlight window · ${index + 1}`, root.id, 'rounded-cube', '#8cc2bf',
        localPartPosition(x, -1.27, 1.16), { x: 0.48, y: 0.1, z: 0.54 }),
      createVisualPart(`Window timber frame · ${index + 1}`, root.id, 'rounded-cube', '#815a3d',
        localPartPosition(x, -1.34, 1.16), { x: 0.59, y: 0.08, z: 0.65 }),
      createVisualPart(`Window shutter · ${index + 1}`, root.id, 'rounded-cube', '#527044',
        localPartPosition(x - 0.37, -1.3, 1.16), { x: 0.18, y: 0.12, z: 0.58 }),
    ]),
    createVisualPart('Stone chimney', root.id, 'rounded-cube', '#71634f',
      localPartPosition(0.92, 0.48, 2.76), { x: 0.46, y: 0.48, z: 1.12 }, { x: 0, y: 0, z: 0 }, wallTextureId),
    createVisualPart('Entry step', root.id, 'rounded-cube', '#b3a181',
      localPartPosition(0, -1.48, 0.15), { x: 0.92, y: 0.52, z: 0.22 }),
  ];
}

function createRtsFarmPlot(
  center: Vector3,
  offset: { x: number; y: number },
  name: string,
  soilTextureId: string,
  cropTextureId: string,
): SceneEntity[] {
  const root = createRtsGroup(name, {
    x: center.x + offset.x * 10,
    y: center.y + offset.y * 10,
    z: center.z,
  });
  const rows = [-1.8, -0.6, 0.6, 1.8];
  const plants = [-1.45, 0, 1.45];
  return [
    root,
    createVisualPart('Tilled field bed', root.id, 'rounded-cube', '#806346',
      localPartPosition(0, 0, 0.08), { x: 6.3, y: 5.2, z: 0.16 }, { x: 0, y: 0, z: 0 }, soilTextureId),
    ...rows.flatMap((x, row) => [
      createVisualPart(`Furrow · ${row + 1}`, root.id, 'rounded-cube', '#ad9168',
        localPartPosition(x, 0, 0.2), { x: 0.18, y: 4.65, z: 0.12 }),
      ...plants.map((y, index) => createVisualPart(`Crop bundle · row ${row + 1} · ${index + 1}`,
        root.id, 'cone', row % 2 ? '#708c42' : '#839b4a',
        localPartPosition(x, y, 0.54), { x: 0.48, y: 0.42, z: 0.76 },
        { x: 0, y: 0, z: (index - 1) * 11 }, cropTextureId)),
    ]),
    ...[-1, 1].map((side, index) => createVisualPart(`Field boundary · ${index + 1}`,
      root.id, 'rounded-cube', '#766047',
      localPartPosition(side * 3.05, 0, 0.18), { x: 0.16, y: 5.1, z: 0.3 })),
  ];
}

function createRtsShrub(center: Vector3, x: number, y: number, index: number): SceneEntity[] {
  const root = createRtsGroup(`Settlement undergrowth · ${index + 1}`, {
    x: center.x + x * 10, y: center.y + y * 10, z: center.z,
  });
  const foliage = index % 2 ? '#759866' : '#66875f';
  return [
    root,
    createVisualPart('Shrub base', root.id, 'sphere', '#58483a', localPartPosition(0, 0, 0.24), { x: 1.15, y: 0.95, z: 0.42 }),
    createVisualPart('Leaf cluster · left', root.id, 'sphere', foliage, localPartPosition(-0.34, 0, 0.52), { x: 0.9, y: 0.78, z: 0.8 }),
    createVisualPart('Leaf cluster · right', root.id, 'sphere', index % 3 ? '#8caa69' : '#527950', localPartPosition(0.34, 0.06, 0.58), { x: 0.78, y: 0.84, z: 0.82 }),
    createVisualPart('Flower cluster', root.id, 'sphere', index % 2 ? '#e3d18d' : '#d89879',
      localPartPosition(-0.13, -0.38, 0.79), { x: 0.22, y: 0.22, z: 0.2 }),
  ];
}

function createRtsStarterKit(center: Vector3): {
  entities: SceneEntity[];
  playerId: string;
  title: string;
  generatedAssets: Array<{ asset: ProjectAsset; file: File }>;
} {
  const clothing = createEgoClothingTextureAsset();
  const meadow = createRtsTextureAsset('madhorse-rts-grassland-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <pattern id="grass" width="96" height="96" patternUnits="userSpaceOnUse">
        <rect width="96" height="96" fill="#627d4d"/>
        <path d="M8 72 18 40m4 35 12-26m20 31 8-37m6 28 13-23m4 28 8-34M30 13l5 20m28-19-4 16m21-9-1 20" stroke="#93a864" stroke-width="3" opacity=".62"/>
        <circle cx="18" cy="19" r="3" fill="#bdad70" opacity=".48"/><circle cx="72" cy="76" r="2" fill="#c3b87b" opacity=".5"/>
      </pattern>
      <radialGradient id="light"><stop stop-color="#a9b875" stop-opacity=".2"/><stop offset="1" stop-color="#263b2c" stop-opacity=".34"/></radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#grass)"/><rect width="1024" height="1024" fill="url(#light)"/>
    <path d="M0 140 1024 90M0 820 1024 900M180 0 240 1024M760 0 690 1024" stroke="#d2c58c" stroke-width="4" opacity=".12"/>
  </svg>`);
  const stone = createRtsTextureAsset('madhorse-rts-cut-stone-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>
      <pattern id="blocks" width="128" height="88" patternUnits="userSpaceOnUse">
        <rect width="128" height="88" fill="#817c70"/>
        <path d="M0 1h127M0 87h127M1 0v43m62 0V0m63 0v43M32 44v43m64-43v43m32-43v43" fill="none" stroke="#484840" stroke-width="5" opacity=".76"/>
        <path d="M4 8h49m27 0h39M5 53h20m38 0h25m21 0h13" stroke="#c1bba7" stroke-width="3" opacity=".3"/>
      </pattern>
    </defs>
    <rect width="1024" height="1024" fill="url(#blocks)"/>
    <path d="M0 0h1024v1024H0z" fill="none" stroke="#d7cba9" stroke-width="20" opacity=".08"/>
  </svg>`);
  const roof = createRtsTextureAsset('madhorse-rts-terracotta-roof-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><pattern id="tiles" width="104" height="76" patternUnits="userSpaceOnUse">
      <rect width="104" height="76" fill="#954d3d"/>
      <path d="M2 2h99v35H2zM-50 40h100v34H-50zM54 40h100v34H54z" fill="#ad6650" stroke="#513b36" stroke-width="5"/>
      <path d="M10 7h75M59 46h84" stroke="#e0a17a" stroke-width="3" opacity=".34"/>
    </pattern></defs><rect width="1024" height="1024" fill="url(#tiles)"/>
  </svg>`);
  const crops = createRtsTextureAsset('madhorse-rts-cultivated-field-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><pattern id="rows" width="128" height="128" patternUnits="userSpaceOnUse">
      <rect width="128" height="128" fill="#8b704d"/>
      <path d="M12 0v128M34 0v128M56 0v128M78 0v128M100 0v128M122 0v128"
        stroke="#a9895b" stroke-width="8" opacity=".72"/>
      <path d="M23 0v128M45 0v128M67 0v128M89 0v128M111 0v128"
        stroke="#667c3d" stroke-width="5" opacity=".88"/>
    </pattern></defs><rect width="1024" height="1024" fill="url(#rows)"/>
  </svg>`);
  const soil = createRtsTextureAsset('madhorse-rts-packed-earth-road-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><pattern id="earth" width="128" height="128" patternUnits="userSpaceOnUse">
      <rect width="128" height="128" fill="#9c8060"/>
      <path d="m8 25 42-9 26 9-10 15-41 5zm58 55 38-14 20 14-22 19-41-4zM13 106l30-17 24 14-4 19-41 3z"
        fill="#bea17a" opacity=".52"/>
      <path d="m4 54 36-7m50-26 27 11M66 112l35-10" stroke="#574b3c" stroke-width="5" opacity=".38"/>
    </pattern></defs><rect width="1024" height="1024" fill="url(#earth)"/>
  </svg>`);
  const water = createRtsTextureAsset('madhorse-rts-village-well-water-texture.svg', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs><linearGradient id="water" y2="1"><stop stop-color="#83d1d4"/><stop offset=".5" stop-color="#327d91"/><stop offset="1" stop-color="#225b79"/></linearGradient>
      <pattern id="ripples" width="180" height="110" patternUnits="userSpaceOnUse">
        <rect width="180" height="110" fill="url(#water)"/>
        <path d="M-20 30q24-13 48 0t48 0 48 0 48 0M-24 79q24-13 48 0t48 0 48 0 48 0" fill="none" stroke="#e1ffff" stroke-width="4" opacity=".42"/>
      </pattern></defs><rect width="1024" height="1024" fill="url(#ripples)"/>
  </svg>`);

  const terrain = createObject('Sunstone Vale · Market Plain', 'terrain', '#829a67',
    { x: center.x, y: center.y, z: center.z }, { x: 1, y: 1, z: 0.76 });
  const terrainPrimitive = getPrimitive(terrain);
  if (terrainPrimitive) {
    terrainPrimitive.terrainSettings = {
      width: 40, depth: 34, height: 3, mountainHeight: 2.4, riverDepth: 0, riverCount: 0,
    };
    const edits: Array<Omit<TerrainBrushEdit, 'id'> & { id?: string }> = [
      { action: 'smooth', x: 0, z: 0, radius: 10, strength: 0.22 },
      { action: 'raise', x: -16, z: 12, radius: 5.2, strength: 0.26 },
      { action: 'smooth', x: -16, z: 12, radius: 3.4, strength: 0.3 },
      { action: 'raise', x: 16, z: -13, radius: 4.8, strength: 0.2 },
    ];
    terrainPrimitive.terrainEdits = edits.map(edit => ({ ...edit, id: crypto.randomUUID() }));
    terrainPrimitive.textureAssetId = meadow.asset.id;
    terrainPrimitive.roughness = 1;
  }
  const terrainTransform = getTransform(terrain);
  terrainTransform.scale = { x: 1, y: 1, z: 0.76 };
  const road = createObject('King’s Road · Main Market Way', 'rounded-cube', '#ad9871',
    { x: center.x, y: center.y - 3 * 10, z: center.z + 0.025 }, { x: 28, y: 2.6, z: 0.12 });
  const roadSurface = getPrimitive(road);
  if (roadSurface) {
    roadSurface.textureAssetId = soil.asset.id;
    roadSurface.roughness = 0.92;
  }
  const eastLane = createObject('East Lane · Orchard Road', 'rounded-cube', '#ad9871',
    { x: center.x + 8 * 10, y: center.y + 3.5 * 10, z: center.z + 0.025 }, { x: 2.6, y: 14, z: 0.12 });
  const laneSurface = getPrimitive(eastLane);
  if (laneSurface) {
    laneSurface.textureAssetId = soil.asset.id;
    laneSurface.roughness = 0.92;
  }
  const square = createObject('Market Square · Stone Paving', 'rounded-cube', '#97896f',
    { x: center.x + 1.3 * 10, y: center.y - 3 * 10, z: center.z + 0.1 }, { x: 7.2, y: 5.8, z: 0.18 });
  const squareSurface = getPrimitive(square);
  if (squareSurface) {
    squareSurface.textureAssetId = stone.asset.id;
    squareSurface.roughness = 0.78;
  }
  const well = createRtsGroup('Village Well · Market Square', {
    x: center.x + 1.5 * 10, y: center.y - 3 * 10, z: center.z,
  });
  const wellWater = createVisualPart('Still water', well.id, 'cylinder', '#4d8b91',
    localPartPosition(0, 0, 0.42), { x: 1.08, y: 1.08, z: 0.12 }, { x: 0, y: 0, z: 0 }, water.asset.id);
  const wellEntities = [
    well,
    ...([-1, 1] as const).flatMap(side => [
      createVisualPart(`Cut-stone well rim · ${side < 0 ? 'west' : 'east'}`, well.id, 'rounded-cube', '#887c64',
        localPartPosition(side * 0.66, 0, 0.36), { x: 0.3, y: 1.58, z: 0.46 }, { x: 0, y: 0, z: 0 }, stone.asset.id),
      createVisualPart(`Cut-stone well rim · ${side < 0 ? 'south' : 'north'}`, well.id, 'rounded-cube', '#887c64',
        localPartPosition(0, side * 0.66, 0.36), { x: 1.58, y: 0.3, z: 0.46 }, { x: 0, y: 0, z: 0 }, stone.asset.id),
    ]),
    wellWater,
    ...([-1, 1] as const).map(side => createVisualPart(`Well timber post · ${side > 0 ? 'east' : 'west'}`,
      well.id, 'cylinder', '#65472f', localPartPosition(side * 0.82, 0, 1.02), { x: 0.13, y: 0.13, z: 1.55 })),
    createVisualPart('Well lifting beam', well.id, 'cylinder', '#745137',
      localPartPosition(0, 0, 1.72), { x: 0.09, y: 0.09, z: 1.72 }, { x: 0, y: 90, z: 0 }),
  ];
  const waterSurface = getPrimitive(wellWater);
  if (waterSurface) {
    waterSurface.opacity = 0.88;
    waterSurface.roughness = 0.24;
  }

  const rallyPoint = createObject('Rally Beacon · Market Gate', 'octahedron', '#e8c667',
    { x: center.x + 4.5 * 10, y: center.y - 3 * 10, z: center.z + 0.8 * 10 }, { x: 0.58, y: 0.58, z: 1.25 });
  const home = createRtsBuilding('Sunstone Keep · Central Hall', center, { x: 0, y: 0 }, '#b65543', stone.asset.id, undefined, roof.asset.id);
  const barracks = createRtsBuilding('Vale Guard Barracks · West', center, { x: -11, y: -6 }, '#a94e3f', stone.asset.id,
    { x: 3.5, y: 2.8, z: 2.2 }, roof.asset.id);
  const enemyKeep = createRtsBuilding('East Gate Outpost', center, { x: 14, y: 1 }, '#73584b', stone.asset.id, undefined, roof.asset.id);
  const enemyBarracks = createRtsBuilding('East Gate Guardhouse', center, { x: 12, y: 6 }, '#6b5246', stone.asset.id,
    { x: 3.5, y: 2.8, z: 2.2 }, roof.asset.id);
  const homeTower = createRtsBuilding('West Watchtower', center, { x: -15, y: 3 }, '#b18b52', stone.asset.id,
    { x: 1.6, y: 1.6, z: 3.8 }, roof.asset.id);
  const eastTower = createRtsBuilding('East Watchtower', center, { x: 16, y: -9 }, '#9f805a', stone.asset.id,
    { x: 1.6, y: 1.6, z: 3.8 }, roof.asset.id);
  const fieldCommander = createRtsUnit('Field Commander', { x: -7, y: 0 }, '#a74e45',
    'character-controller-player', clothing.asset.id);
  getTransform(fieldCommander[0]).rotation.z = 0;
  const alliedUnits = [
    ...createRtsUnit('Vale Guard · 01', { x: -9, y: -1.8 }, '#ba6550', 'character-controller-npc', clothing.asset.id),
    ...createRtsUnit('Vale Guard · 02', { x: -9, y: 1.4 }, '#ba6550', 'character-controller-npc', clothing.asset.id),
    ...createRtsUnit('Vale Scout', { x: -11, y: 4 }, '#81995a', 'character-controller-npc', clothing.asset.id),
  ];
  const enemyUnits = [
    ...createRtsUnit('East Gate Guard · 01', { x: 11, y: -0.8 }, '#78614f', 'character-controller-patrol', clothing.asset.id),
    ...createRtsUnit('East Gate Guard · 02', { x: 11, y: 2.2 }, '#78614f', 'character-controller-patrol', clothing.asset.id),
  ];
  const pickups = [
    createRtsPickup('Timber Cache · 36', 'wood', 36, center, { x: -7, y: 2.2 }, '#6e9a52'),
    createRtsPickup('Stone Supply · 24', 'planks', 24, center, { x: -8.5, y: -2 }, '#a79c82'),
    createRtsPickup('Coin Pouch · 40', 'coins', 40, center, { x: -5.5, y: 3.7 }, '#d4b248'),
    createRtsPickup('Enemy Supply · 20', 'planks', 20, center, { x: 8.2, y: 5 }, '#8797a8'),
  ];
  const cottages = [
    ...createRtsHouse(center, { x: 6, y: -7 }, 'Baker’s Cottage', '#d2bd91', '#a7533d', stone.asset.id, roof.asset.id),
    ...createRtsHouse(center, { x: 9.5, y: 0.5 }, 'Miller’s Cottage', '#c8b487', '#8e4939', stone.asset.id, roof.asset.id),
    ...createRtsHouse(center, { x: 5.5, y: 7.5 }, 'Village Hall', '#d4c59d', '#9b5540', stone.asset.id, roof.asset.id),
    ...createRtsHouse(center, { x: -6.5, y: -7.5 }, 'Woodcutter’s House', '#c3ac80', '#80503a', stone.asset.id, roof.asset.id),
  ];
  const farmPlots = [
    ...createRtsFarmPlot(center, { x: 14, y: 9.5 }, 'Southfield · Barley Farm', soil.asset.id, crops.asset.id),
    ...createRtsFarmPlot(center, { x: -14, y: -10 }, 'Northfield · Sun Wheat', soil.asset.id, crops.asset.id),
  ];
  const trees = [
    [-19, 5], [-18, 9], [-16, 13], [-13, 15], [-9, 15], [-18, -12], [-15, -15],
    [18, -13], [16, -15], [19, -8], [18, -4], [14, 15], [8, 15], [3, 15],
  ].flatMap(([x, y], index) => createRtsTree(center, x, y, index));
  const understory = [
    [-17, 7], [-15, 12], [-12, 14], [17, -11], [15, -13], [18, -6], [11, 14],
  ].flatMap(([x, y], index) => createRtsShrub(center, x, y, index));
  const rocks = [
    [-17.2, -4.5], [17.6, 5], [-9, 13.2], [9, -13], [18.1, 2], [-18.2, -1],
  ].map(([x, y], index) => createVisualPart(
    `Stone outcrop · ${index + 1}`, null, 'icosahedron', index % 2 ? '#77776e' : '#918776',
    { x: center.x + x * 10, y: center.y + y * 10, z: center.z + 0.44 * 10 },
    { x: 1.6 + (index % 2) * 0.45, y: 1.15, z: 0.8 },
  ));
  const marketCart = createRtsGroup('Market Cart · Grain and Barrels', {
    x: center.x + 4.8 * 10, y: center.y - 2.8 * 10, z: center.z,
  });
  const cartParts = [
    marketCart,
    createVisualPart('Oak cart bed', marketCart.id, 'rounded-cube', '#795238',
      localPartPosition(0, 0, 0.62), { x: 1.8, y: 1.1, z: 0.24 }),
    createVisualPart('Barrel · left', marketCart.id, 'cylinder', '#94633e',
      localPartPosition(-0.35, 0, 1.02), { x: 0.42, y: 0.42, z: 0.64 }),
    createVisualPart('Barrel · right', marketCart.id, 'cylinder', '#a57b4e',
      localPartPosition(0.36, 0, 1.02), { x: 0.42, y: 0.42, z: 0.64 }),
    ...([-1, 1] as const).map(side => createVisualPart(`Cart wheel · ${side < 0 ? 'west' : 'east'}`,
      marketCart.id, 'cylinder', '#503b2e', localPartPosition(side * 0.72, 0, 0.42),
      { x: 0.54, y: 0.54, z: 0.16 }, { x: 0, y: 90, z: 0 })),
  ];
  const landmarkEffects = [
    createRtsEffectEntity('Market square · warm lantern motes',
      { x: center.x + 2 * 10, y: center.y - 3 * 10, z: center.z + 1.5 * 10 }, '#ffd17d', 'motes', 1.5),
    createRtsEffectEntity('Sunstone Keep · warm rally aura',
      { x: center.x, y: center.y, z: center.z + 1.35 * 10 }, '#f0b56b', 'aura', 1.2),
  ];
  const lights = [
    createRtsLight('Sunlight · Late Afternoon', 'directional', '#ffe0a1', 1.35, { x: -34, y: 22, z: 18 }),
    createRtsLight('Sky Fill · Warm Bounce', 'ambient', '#e8d8bc', 0.58, { x: 0, y: 0, z: 0 }),
    createRtsLight('Market Lantern · Well', 'point', '#ffd38a', 0.8, { x: 0, y: 0, z: 0 },
      { x: center.x + 1.5 * 10, y: center.y - 3 * 10, z: center.z + 3.1 * 10 }),
  ];
  const sky = createRtsGroup('Sunstone Vale · Evening Sky', { x: 50, y: 50, z: 0 });
  sky.components.push({ id: crypto.randomUUID(), type: 'skybox', enabled: true, color: '#a28a70' });

  const player = fieldCommander[0];
  const inventory = createGameFeature('inventory');
  if (inventory.type === 'gameFeature') {
    inventory.settings.startingWood = 60;
    inventory.settings.startingPlanks = 24;
    inventory.settings.startingCoins = 100;
  }
  const command = createPlayerAction('command');
  command.targetId = rallyPoint.id;
  command.settings.radius = 12;
  const gather = createPlayerAction('gather');
  gather.settings.range = 4;
  const craft = createPlayerAction('craft');
  const build = createPlayerAction('build');
  build.settings.startingPlanks = 24;
  const run = createPlayerAction('run');
  const fight = createPlayerAction('fight');
  player.components.push(
    inventory,
    createGameFeature('interact'),
    command,
    gather,
    craft,
    build,
    run,
    fight,
  );

  return {
    entities: [
      terrain, road, eastLane, square, ...wellEntities, rallyPoint, ...home, ...barracks, ...enemyKeep, ...enemyBarracks,
      ...homeTower, ...eastTower, sky, ...lights, ...fieldCommander, ...alliedUnits, ...enemyUnits,
      ...cottages, ...farmPlots, ...cartParts, ...pickups, ...trees, ...understory, ...rocks, ...landmarkEffects,
      createStoryboard('Sunstone Vale · First Campaign', [
        { title: 'Gather supplies', note: 'Move near Timber Cache, Stone Supply, or Coin Pouch and use G to gather.' },
        { title: 'Rally the village guard', note: 'Press T to send nearby allied NPCs to the Market Gate beacon. Use WASD to move and hold Shift to run.' },
        { title: 'Secure the harvest', note: 'Survey the barley and wheat plots, cottages, woods, and resource sites around Sunstone Keep.' },
        { title: 'Defend the east road', note: 'Use K to craft planks, B to place an editable construction block, and F to fight; then customize the keep, farms, roads, squads, and mission.' },
      ]),
    ],
    playerId: player.id,
    title: 'RTS · Sunstone Vale',
    generatedAssets: [clothing, meadow, stone, roof, crops, soil, water],
  };
}

export function createGameStarterKit(
  kind: GameStarterKitId,
  anchor: Vector3,
  fightingAppearances: FightingAppearancePair = defaultFightingAppearancePair,
): {
  entities: SceneEntity[];
  playerId: string;
  title: string;
  generatedAssets?: Array<{ asset: ProjectAsset; file: File }>;
} {
  const center = { x: anchor.x + 65, y: anchor.y, z: anchor.z };
  if (kind === 'fighting') return createFightingStarterKit(center, fightingAppearances);
  if (kind === 'rts') return createRtsStarterKit(center);
  const floor = createObject('Starter Arena', 'plane', '#414653',
    { x: center.x, y: center.y, z: center.z - 3 }, { x: 18, y: 18, z: 0.5 });
  const player = createActor('Player', { ...center, z: center.z + 1.4 }, '#6397d8', 'character-controller-player');
  if (kind === 'shooter') {
    const controller = player.components.find(component => component.type === 'characterController');
    if (controller?.type === 'characterController') controller.perspective = 'first-person';
  }
  player.components = player.components.map(component =>
    component.type === 'physics' ? createPhysicsComponent('dynamic') : component,
  );
  player.components.push(createGameFeature('health'), createGameFeature('status-bar'));
  const entities: SceneEntity[] = [floor, player];

  if (kind === 'shooter') {
    player.components.push(createPlayerAction('shoot'), createPlayerAction('reload'), createPlayerAction('crouch'), createPlayerAction('run'));
    const target = createActor('Target Dummy', { x: center.x, y: center.y + 8, z: center.z + 1.4 }, '#c14654', 'character-controller-patrol');
    const targetHealth = createGameFeature('health');
    if (targetHealth.type === 'gameFeature') targetHealth.settings.contactDamage = 0;
    target.components.push(targetHealth);
    const cover = createObject('Practice Cover', 'rounded-cube', '#767984',
      { x: center.x + 4, y: center.y + 5, z: center.z - 1 }, { x: 2, y: 1, z: 2 });
    entities.push(target, cover, createStoryboard('Shooter Mission', [
      { title: 'Move through the arena', note: 'Use WASD to move and press Space to jump.' },
      { title: 'Practice your aim', note: 'Select Target Dummy in your shooting settings to focus your shots.' },
      { title: 'Manage ammunition', note: 'Use your reload key before the magazine runs out.' },
    ]));
  } else if (kind === 'rpg') {
    player.components.push(
      createPlayerAction('fight'), createPlayerAction('cast'), createPlayerAction('heal'),
      createPlayerAction('run'), createGameFeature('inventory'), createGameFeature('interact'),
    );
    const guide = createActor('Quest Guide', { x: center.x, y: center.y + 7, z: center.z + 1.4 }, '#64a787', 'character-controller-patrol');
    guide.components.push(createGameFeature('message'));
    entities.push(guide, createObject('Quest Marker', 'octahedron', '#efc262',
      { x: center.x - 7, y: center.y + 11, z: center.z + 1 }, { x: 0.8, y: 0.8, z: 0.8 }),
    createStoryboard('RPG Quest', [
      { title: 'Meet the guide', note: 'Walk near Quest Guide and use the Interact key to read the sign.' },
      { title: 'Learn your skills', note: 'Try your spell, melee, and heal actions in Play Test.' },
      { title: 'Mark your next objective', note: 'Edit this storyboard and add your own quest steps.' },
    ]));
  } else {
    const key = createObject('Puzzle Key', 'octahedron', '#f0cb59',
      { x: center.x + 6, y: center.y + 2, z: center.z + 1 }, { x: 0.55, y: 0.55, z: 0.55 });
    const pickup = createGameFeature('pickup');
    if (pickup.type === 'gameFeature') pickup.settings.item = 'keys';
    key.components.push(pickup);
    const gate = createObject('Puzzle Gate', 'cube', '#9564c7',
      { x: center.x + 14, y: center.y + 2, z: center.z + 1 }, { x: 1.5, y: 0.7, z: 2 });
    gate.active = false;
    const zone = createObject('Gate Trigger', 'sphere', '#59b2c7',
      { x: center.x + 12, y: center.y + 2, z: center.z }, { x: 2.5, y: 2.5, z: 2 });
    const trigger = createPluginComponent('trigger-zone-box', 0).component;
    if (trigger.type === 'triggerZone') {
      trigger.size = { x: 4, y: 4, z: 4 };
      trigger.message = 'A key unlocks the way.';
      const nodes: VisualLogicNode[] = [
        { id: crypto.randomUUID(), type: 'condition-item', item: 'keys', minimum: 1, failMessage: 'Find the puzzle key first.' },
        { id: crypto.randomUUID(), type: 'enable-target', targetEntityId: gate.id },
        { id: crypto.randomUUID(), type: 'message', message: 'The gate opened!' },
      ];
      trigger.logicNodes = nodes;
    }
    zone.components.push(trigger);
    player.components.push(createGameFeature('interact'), createGameFeature('inventory'));
    entities.push(key, gate, zone, createStoryboard('Key-and-Gate Puzzle', [
      { title: 'Find the key', note: 'Walk to Puzzle Key and press Interact while nearby.' },
      { title: 'Reach the gate', note: 'Enter Gate Trigger with the key in your inventory.' },
      { title: 'Open the gate', note: 'The visual flow checks for a key, enables the gate, then shows a message.' },
    ]));
  }

  return { entities, playerId: player.id, title: gameStarterKits.find(kit => kit.id === kind)!.title };
}
