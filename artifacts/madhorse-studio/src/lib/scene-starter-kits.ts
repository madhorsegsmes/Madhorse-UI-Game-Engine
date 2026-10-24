import { createGameFeature } from './game-feature-model';
import { createPlayerAction } from './player-action-model';
import { createPluginComponent } from './scene-plugin-catalog';
import {
  createPhysicsComponent, createStoryboardComponent, createTransformComponent,
  type PrimitiveShape, type SceneEntity, type StoryboardBeat, type Vector3, type VisualLogicNode,
} from './scene-model';

export type GameStarterKitId = 'shooter' | 'rpg' | 'puzzle';
export const gameStarterKits: { id: GameStarterKitId; title: string; description: string }[] = [
  { id: 'shooter', title: 'Shooter Arena', description: 'A playable character with aiming, ammo, targets, health, and a small test arena.' },
  { id: 'rpg', title: 'RPG Quest', description: 'A player with inventory and spells, a character to meet, and a quest path to explore.' },
  { id: 'puzzle', title: 'Key-and-Gate Puzzle', description: 'Find a key, enter a trigger, and use safe visual logic to open the gate.' },
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

function createActor(name: string, position: Vector3, color: string, controllerKind: 'character-controller-player' | 'character-controller-patrol') {
  const actor = createObject(name, 'capsule', color, position, { x: 1, y: 1, z: 1.8 });
  actor.components = [
    ...actor.components,
    createPluginComponent(controllerKind, 0).component,
  ];
  return actor;
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
  const floor = createObject('Starter Arena', 'plane', '#414653',
    { x: center.x, y: center.y, z: center.z - 3 }, { x: 18, y: 18, z: 0.5 });
  const player = createActor('Player', { ...center, z: center.z + 1.4 }, '#6397d8', 'character-controller-player');
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
    player.components.push(createGameFeature('interact'), createGameFeature('inventory'), createGameFeature('status-bar'));
    entities.push(key, gate, zone, createStoryboard('Key-and-Gate Puzzle', [
      { title: 'Find the key', note: 'Walk to Puzzle Key and press Interact while nearby.' },
      { title: 'Reach the gate', note: 'Enter Gate Trigger with the key in your inventory.' },
      { title: 'Open the gate', note: 'The visual flow checks for a key, enables the gate, then shows a message.' },
    ]));
  }

  return { entities, playerId: player.id, title: gameStarterKits.find(kit => kit.id === kind)!.title };
}
