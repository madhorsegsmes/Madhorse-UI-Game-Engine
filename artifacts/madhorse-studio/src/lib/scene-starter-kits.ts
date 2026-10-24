import { createGameFeature } from './game-feature-model';
import { createPlayerAction } from './player-action-model';
import { createPluginComponent } from './scene-plugin-catalog';
import {
  createPhysicsComponent, createStoryboardComponent, createTransformComponent,
  type PrimitiveShape, type SceneEntity, type StoryboardBeat, type Vector3, type VisualLogicNode,
} from './scene-model';

export type GameStarterKitId = 'shooter' | 'rpg' | 'puzzle' | 'fighting';
export const gameStarterKits: { id: GameStarterKitId; title: string; description: string }[] = [
  { id: 'shooter', title: 'FPS Training Arena', description: 'A first-person camera with shooting, ammo, targets, health, and a small test arena.' },
  { id: 'rpg', title: 'RPG Quest', description: 'A player with inventory and spells, a character to meet, and a quest path to explore.' },
  { id: 'puzzle', title: 'Key-and-Gate Puzzle', description: 'Find a key, enter a trigger, and use safe visual logic to open the gate.' },
  { id: 'fighting', title: '2D Fighting Arena', description: 'Classic arcade-fighter starter with editable fighters, a CPU rival, move sets, rounds, health bars, and an editable stage.' },
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
): SceneEntity {
  const transform = createTransformComponent(position);
  transform.scale = scale;
  transform.rotation = rotation;
  return {
    id: crypto.randomUUID(), name, parentId, active: true,
    components: [
      transform,
      { id: crypto.randomUUID(), type: 'primitive', enabled: true, shape, color, textureAssetId: null, roughness: 0.72, metalness: 0.08 },
    ],
  };
}

function createFighterParts(root: SceneEntity, main: string, trim: string, skin: string): SceneEntity[] {
  const parts: {
    name: string; shape: PrimitiveShape; color: string; position: Vector3; scale: Vector3; rotation?: Vector3;
  }[] = [
    { name: 'Torso Armor', shape: 'rounded-cube', color: main, position: { x: 0, y: 0, z: 0.06 }, scale: { x: 0.54, y: 0.34, z: 0.44 } },
    { name: 'Head', shape: 'sphere', color: skin, position: { x: 0, y: 0, z: 0.43 }, scale: { x: 0.28, y: 0.28, z: 0.25 } },
    { name: 'Headband', shape: 'rounded-cube', color: trim, position: { x: 0, y: -0.02, z: 0.53 }, scale: { x: 0.31, y: 0.3, z: 0.08 } },
    { name: 'Left Shoulder', shape: 'sphere', color: trim, position: { x: -0.34, y: 0, z: 0.2 }, scale: { x: 0.25, y: 0.25, z: 0.23 } },
    { name: 'Right Shoulder', shape: 'sphere', color: trim, position: { x: 0.34, y: 0, z: 0.2 }, scale: { x: 0.25, y: 0.25, z: 0.23 } },
    { name: 'Left Forearm', shape: 'capsule', color: main, position: { x: -0.45, y: 0, z: -0.01 }, scale: { x: 0.16, y: 0.17, z: 0.38 }, rotation: { x: 0, y: 0, z: 18 } },
    { name: 'Right Forearm', shape: 'capsule', color: main, position: { x: 0.45, y: 0, z: -0.01 }, scale: { x: 0.16, y: 0.17, z: 0.38 }, rotation: { x: 0, y: 0, z: -18 } },
    { name: 'Left Glove', shape: 'sphere', color: trim, position: { x: -0.52, y: -0.03, z: -0.18 }, scale: { x: 0.2, y: 0.2, z: 0.18 } },
    { name: 'Right Glove', shape: 'sphere', color: trim, position: { x: 0.52, y: -0.03, z: -0.18 }, scale: { x: 0.2, y: 0.2, z: 0.18 } },
    { name: 'Left Leg', shape: 'capsule', color: main, position: { x: -0.18, y: 0, z: -0.42 }, scale: { x: 0.19, y: 0.2, z: 0.43 } },
    { name: 'Right Leg', shape: 'capsule', color: main, position: { x: 0.18, y: 0, z: -0.42 }, scale: { x: 0.19, y: 0.2, z: 0.43 } },
    { name: 'Left Boot', shape: 'rounded-cube', color: trim, position: { x: -0.2, y: -0.04, z: -0.67 }, scale: { x: 0.29, y: 0.34, z: 0.16 } },
    { name: 'Right Boot', shape: 'rounded-cube', color: trim, position: { x: 0.2, y: -0.04, z: -0.67 }, scale: { x: 0.29, y: 0.34, z: 0.16 } },
  ];
  return parts.map(part => createVisualPart(
    `${root.name} · ${part.name}`, root.id, part.shape, part.color,
    { x: part.position.x * 10, y: part.position.y * 10, z: part.position.z * 10 },
    part.scale, part.rotation,
  ));
}

function createFightingStarterKit(center: Vector3): {
  entities: SceneEntity[];
  playerId: string;
  title: string;
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
  const player = createActor('Player Fighter', { x: center.x - 40, y: center.y, z: center.z + 12 }, '#9f3037', 'character-controller-player');
  const rival = createActor('Training Rival', { x: center.x + 40, y: center.y, z: center.z + 12 }, '#315998', 'character-controller-npc');
  player.components = player.components.map(component =>
    component.type === 'physics' ? createPhysicsComponent('dynamic') : component,
  );
  rival.components = rival.components.map(component =>
    component.type === 'physics' ? createPhysicsComponent('dynamic') : component,
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
    player, ...createFighterParts(player, '#9f3037', '#e2a56c', '#d7a27d'),
    rival, ...createFighterParts(rival, '#315998', '#efc760', '#b8795d'),
  ];
  return { entities, playerId: player.id, title: '2D Fighting Arena' };
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

export function createGameStarterKit(kind: GameStarterKitId, anchor: Vector3): {
  entities: SceneEntity[];
  playerId: string;
  title: string;
} {
  const center = { x: anchor.x + 65, y: anchor.y, z: anchor.z };
  if (kind === 'fighting') return createFightingStarterKit(center);
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
